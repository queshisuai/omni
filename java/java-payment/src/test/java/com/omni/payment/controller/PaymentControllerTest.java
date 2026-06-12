package com.omni.payment.controller;

import com.omni.common.result.Result;
import com.omni.exception.BusinessException;
import com.omni.payment.service.MockPaymentService;
import com.omni.payment.service.PaymentService;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class PaymentControllerTest {

    @Test
    void legacyPayEndpointGuidesUsersToAlipayPagePayOnly() {
        PaymentService paymentService = mock(PaymentService.class);
        MockPaymentService mockPaymentService = mock(MockPaymentService.class);
        PaymentController controller = new PaymentController(paymentService, mockPaymentService);

        Result<Void> result = controller.mockPay(null);

        assertEquals(400, result.getCode());
        assertEquals("请使用支付宝支付页面支付", result.getMessage());
        verify(mockPaymentService, never()).pay(any(), any());
    }

    @Test
    void mockPayForDemoIsDisabledByDefaultBeforeRequestValidation() {
        PaymentService paymentService = mock(PaymentService.class);
        MockPaymentService mockPaymentService = mock(MockPaymentService.class);
        PaymentController controller = new PaymentController(paymentService, mockPaymentService);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> controller.mockPayForDemo(null, null)
        );

        assertEquals("当前环境未启用本地支付确认", exception.getMessage());
        verify(mockPaymentService, never()).pay(any(), any());
    }

    @Test
    void mockPayForDemoUsesExistingValidationWhenExplicitlyEnabled() {
        PaymentService paymentService = mock(PaymentService.class);
        MockPaymentService mockPaymentService = mock(MockPaymentService.class);
        PaymentController controller = new PaymentController(paymentService, mockPaymentService);
        ReflectionTestUtils.setField(controller, "mockPaymentEnabled", true);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> controller.mockPayForDemo(null, null)
        );

        assertEquals("支付参数不能为空", exception.getMessage());
        verify(mockPaymentService, never()).pay(any(), any());
    }
}
