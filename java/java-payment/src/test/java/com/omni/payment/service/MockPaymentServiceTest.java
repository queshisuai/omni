package com.omni.payment.service;

import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.payment.client.OrderClient;
import com.omni.payment.dto.MockPayResponse;
import com.omni.payment.dto.OrderInfoResponse;
import com.omni.payment.entity.Payment;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MockPaymentServiceTest {

    @Test
    void payCreatesMockPaymentAndMarksOrderPaid() {
        OrderClient orderClient = mock(OrderClient.class);
        PaymentService paymentService = mock(PaymentService.class);
        PaymentConfirmationService confirmationService = mock(PaymentConfirmationService.class);
        MockPaymentService service = new MockPaymentService(
                orderClient,
                paymentService,
                confirmationService,
                "internal-token"
        );
        OrderInfoResponse order = order(100L, 2004L, 1);
        Payment payment = payment(100L, "PAY1001");
        when(orderClient.getOrder(100L, "internal-token")).thenReturn(Result.success(order));
        when(paymentService.recordLocalPaymentConfirmation(100L, new BigDecimal("280.00"))).thenReturn(payment);

        MockPayResponse response = service.pay(100L, 2004L);

        assertEquals(100L, response.getOrderId());
        assertEquals("DM1001", response.getOrderNo());
        assertEquals("PAY1001", response.getPaymentNo());
        assertEquals(2, response.getOrderStatus());
        assertEquals("本地支付确认成功", response.getMessage());
        verify(paymentService).recordLocalPaymentConfirmation(100L, new BigDecimal("280.00"));
        verify(confirmationService).confirmLocalPaymentConfirmation(payment);
    }

    @Test
    void payRejectsOtherUsersOrderBeforeCreatingPayment() {
        OrderClient orderClient = mock(OrderClient.class);
        PaymentService paymentService = mock(PaymentService.class);
        PaymentConfirmationService confirmationService = mock(PaymentConfirmationService.class);
        MockPaymentService service = new MockPaymentService(
                orderClient,
                paymentService,
                confirmationService,
                "internal-token"
        );
        when(orderClient.getOrder(100L, "internal-token")).thenReturn(Result.success(order(100L, 2005L, 1)));

        BusinessException error = assertThrows(BusinessException.class, () -> service.pay(100L, 2004L));

        assertEquals(ResultCode.FORBIDDEN.getCode(), error.getCode());
        assertEquals("不能支付他人的订单", error.getMessage());
        verify(paymentService, never()).recordLocalPaymentConfirmation(100L, new BigDecimal("280.00"));
        verify(confirmationService, never()).confirmLocalPaymentConfirmation(org.mockito.ArgumentMatchers.any());
    }

    private OrderInfoResponse order(Long id, Long userId, Integer status) {
        OrderInfoResponse order = new OrderInfoResponse();
        order.setId(id);
        order.setOrderNo("DM1001");
        order.setUserId(userId);
        order.setAmount(new BigDecimal("280.00"));
        order.setStatus(status);
        return order;
    }

    private Payment payment(Long orderId, String paymentNo) {
        Payment payment = new Payment();
        payment.setOrderId(orderId);
        payment.setPaymentNo(paymentNo);
        payment.setStatus(PaymentService.STATUS_SUCCESS);
        return payment;
    }
}
