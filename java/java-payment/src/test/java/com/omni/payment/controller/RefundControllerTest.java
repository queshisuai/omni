package com.omni.payment.controller;

import com.alibaba.csp.sentinel.slots.block.BlockException;
import com.alibaba.csp.sentinel.slots.block.flow.FlowException;
import com.omni.common.result.Result;
import com.omni.payment.dto.ApplyRefundRequest;
import com.omni.payment.dto.RefundRequestVO;
import com.omni.payment.service.RefundService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class RefundControllerTest {

    private RefundService refundService;
    private RefundController controller;

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
}
