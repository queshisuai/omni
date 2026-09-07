package com.omni.payment.controller;

import com.alibaba.csp.sentinel.slots.block.BlockException;
import com.alibaba.csp.sentinel.slots.block.flow.FlowException;
import com.omni.common.result.Result;
import com.omni.common.util.JwtUtil;
import com.omni.payment.dto.ApplyRefundRequest;
import com.omni.payment.dto.BatchReviewRefundRequest;
import com.omni.payment.dto.RefundRequestVO;
import com.omni.payment.service.RefundService;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RefundControllerTest {

    private RefundService refundService;
    private RefundController controller;

    @BeforeAll
    static void jwt() {
        if (System.getenv("JWT_SECRET") == null || System.getenv("JWT_SECRET").isBlank()) {
            System.setProperty("JWT_SECRET", "test-jwt-secret-must-be-at-least-32-bytes");
        }
    }

    @BeforeEach
    void setUp() {
        refundService = mock(RefundService.class);
        controller = new RefundController(refundService, "test-internal-token");
    }

    @Test
    void applyBlockedReturnsBusyResponseWithoutCallingService() {
        ApplyRefundRequest request = new ApplyRefundRequest();
        BlockException exception = new FlowException("payment-refund-apply");

        Result<RefundRequestVO> result = controller.applyBlocked("Bearer token", request, exception);

        assertEquals(429, result.getCode());
        assertEquals("系统繁忙，请稍后重试", result.getMessage());
        assertNull(result.getData());
        verify(refundService, never()).applyRefund(any(), any(), any(), any(), any(), any());
    }

    @Test
    void internalListUserRefundsRequiresToken() {
        Result<List<RefundRequestVO>> result = controller.listInternalUserRefunds(2004L, 5, null);

        assertEquals(403, result.getCode());
        assertNull(result.getData());
        verify(refundService, never()).listUserRefunds(any());
    }

    @Test
    void internalListUserRefundsReturnsLimitedRefunds() {
        RefundRequestVO first = new RefundRequestVO();
        first.setId(501L);
        RefundRequestVO second = new RefundRequestVO();
        second.setId(502L);
        when(refundService.listUserRefunds(2004L)).thenReturn(List.of(first, second));

        Result<List<RefundRequestVO>> result = controller.listInternalUserRefunds(2004L, 1, "test-internal-token");

        assertEquals(200, result.getCode());
        assertEquals(List.of(first), result.getData());
        verify(refundService).listUserRefunds(2004L);
    }

    @Test
    void batchReviewDelegatesToRefundServiceWithAuthenticatedReviewer() {
        BatchReviewRefundRequest request = new BatchReviewRefundRequest();
        request.setIds(List.of(1001L, 1002L));
        request.setAction("APPROVE");
        request.setReason("系统核销异常统一批量退款");
        RefundRequestVO reviewed = new RefundRequestVO();
        reviewed.setId(1001L);
        String token = "Bearer " + JwtUtil.generateToken(7L, "13800000001", "admin");
        when(refundService.batchReview(7L, request.getIds(), "APPROVE", "系统核销异常统一批量退款"))
                .thenReturn(List.of(reviewed));

        Result<List<RefundRequestVO>> result = controller.batchReview(token, request);

        assertEquals(200, result.getCode());
        assertEquals(List.of(reviewed), result.getData());
        verify(refundService).batchReview(7L, request.getIds(), "APPROVE", "系统核销异常统一批量退款");
    }
}
