package com.omni.payment.controller;

import com.alibaba.csp.sentinel.slots.block.BlockException;
import com.alibaba.csp.sentinel.slots.block.flow.FlowException;
import com.omni.common.result.Result;
import com.omni.payment.dto.PaymentStatusResponse;
import com.omni.payment.service.AlipayService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.servlet.http.HttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class AlipayControllerTest {

    private AlipayService alipayService;
    private AlipayController controller;

    @BeforeEach
    void setUp() {
        alipayService = mock(AlipayService.class);
        controller = new AlipayController(alipayService, "test-internal-token");
    }

    @Test
    void syncBlockedReturnsBusyResponseWithoutCallingService() {
        BlockException exception = new FlowException("payment-alipay-sync");

        Result<PaymentStatusResponse> result = controller.syncBlocked(14L, exception);

        assertEquals(429, result.getCode());
        assertEquals("系统繁忙，请稍后重试", result.getMessage());
        assertNull(result.getData());
        verify(alipayService, never()).syncByOrderId(any());
    }

    @Test
    void notifyBlockedReturnsFailureWithoutCallingService() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        BlockException exception = new FlowException("payment-alipay-notify");

        String result = controller.notifyBlocked(request, exception);

        assertEquals("failure", result);
        verify(alipayService, never()).handleNotify(any());
    }
}
