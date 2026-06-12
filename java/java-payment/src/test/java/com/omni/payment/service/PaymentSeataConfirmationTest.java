package com.omni.payment.service;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.payment.client.OrderClient;
import com.omni.payment.dto.OrderInfoResponse;
import com.omni.payment.entity.Payment;
import com.omni.payment.mapper.PaymentMapper;
import io.seata.spring.annotation.GlobalTransactional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.slf4j.LoggerFactory;

import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PaymentSeataConfirmationTest {

    @Test
    void confirmPaymentHasGlobalTransactionalRollbackForException() throws Exception {
        Method method = PaymentConfirmationService.class.getMethod(
                "confirmPayment",
                Payment.class,
                String.class,
                String.class,
                String.class,
                String.class
        );

        GlobalTransactional annotation = method.getAnnotation(GlobalTransactional.class);

        assertNotNull(annotation);
        assertEquals("omni-confirm-payment", annotation.name());
        assertTrue(Arrays.asList(annotation.rollbackFor()).contains(Exception.class));
    }

    @Test
    void confirmPaymentMarksOrderBeforeUpdatingPaymentSuccess() {
        OrderClient orderClient = mock(OrderClient.class);
        PaymentMapper paymentMapper = mock(PaymentMapper.class);
        PaymentConfirmationService service = new PaymentConfirmationService(orderClient, paymentMapper, "internal-token");
        Payment payment = pendingPayment();
        when(orderClient.markPaid(10L, "internal-token")).thenReturn(Result.success(order(10L)));

        service.confirmPayment(payment, "TRADE1001", "BUYER1001", "raw", "callback");

        var order = inOrder(orderClient, paymentMapper);
        order.verify(orderClient).markPaid(10L, "internal-token");
        ArgumentCaptor<Payment> paymentCaptor = ArgumentCaptor.forClass(Payment.class);
        order.verify(paymentMapper).updateById(paymentCaptor.capture());
        Payment updated = paymentCaptor.getValue();
        assertEquals(PaymentService.STATUS_SUCCESS, updated.getStatus());
        assertEquals("TRADE1001", updated.getTradeNo());
        assertEquals("BUYER1001", updated.getBuyerId());
    }

    @Test
    void confirmPaymentLogsSegmentedLatencyForOrderConfirmationAndPaymentUpdate() {
        OrderClient orderClient = mock(OrderClient.class);
        PaymentMapper paymentMapper = mock(PaymentMapper.class);
        PaymentConfirmationService service = new PaymentConfirmationService(orderClient, paymentMapper, "internal-token");
        Payment payment = pendingPayment();
        when(orderClient.markPaid(10L, "internal-token")).thenReturn(Result.success(order(10L)));
        ch.qos.logback.classic.Logger logger = (ch.qos.logback.classic.Logger) LoggerFactory.getLogger(PaymentConfirmationService.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        logger.setLevel(Level.INFO);
        try {
            service.confirmPayment(payment, "TRADE1001", "BUYER1001", "raw", "callback");
        } finally {
            logger.detachAppender(appender);
        }

        String message = appender.list.stream()
                .map(ILoggingEvent::getFormattedMessage)
                .filter(line -> line.contains("支付确认链路耗时"))
                .findFirst()
                .orElse("");

        assertTrue(message.contains("paymentId=100"));
        assertTrue(message.contains("orderId=10"));
        assertTrue(message.contains("outcome=CONFIRMED"));
        assertTrue(message.contains("orderMarkPaidMs="));
        assertTrue(message.contains("paymentUpdateMs="));
        assertTrue(message.contains("totalMs="));
    }

    @Test
    void confirmPaymentIsIdempotentWhenPaymentAlreadySuccessAndTradeNoMatches() {
        OrderClient orderClient = mock(OrderClient.class);
        PaymentMapper paymentMapper = mock(PaymentMapper.class);
        PaymentConfirmationService service = new PaymentConfirmationService(orderClient, paymentMapper, "internal-token");
        Payment payment = successPayment("TRADE1001");
        when(orderClient.markPaid(10L, "internal-token")).thenReturn(Result.success(order(10L)));

        service.confirmPayment(payment, "TRADE1001", "BUYER1001", "raw", "callback");

        verify(orderClient).markPaid(10L, "internal-token");
        verify(paymentMapper, never()).updateById(payment);
    }

    @Test
    void confirmPaymentRejectsAlreadySuccessWithDifferentTradeNo() {
        OrderClient orderClient = mock(OrderClient.class);
        PaymentMapper paymentMapper = mock(PaymentMapper.class);
        PaymentConfirmationService service = new PaymentConfirmationService(orderClient, paymentMapper, "internal-token");
        Payment payment = successPayment("TRADE1001");

        BusinessException error = assertThrows(
                BusinessException.class,
                () -> service.confirmPayment(payment, "TRADE2002", "BUYER1001", "raw", "callback")
        );

        assertEquals("支付流水交易号不一致", error.getMessage());
        verify(orderClient, never()).markPaid(10L, "internal-token");
        verify(paymentMapper, never()).updateById(payment);
    }

    private Payment pendingPayment() {
        Payment payment = new Payment();
        payment.setId(100L);
        payment.setOrderId(10L);
        payment.setPaymentNo("PAY1001");
        payment.setPaymentMethod("ALIPAY");
        payment.setOutTradeNo("DM1001");
        payment.setAmount(new BigDecimal("280.00"));
        payment.setStatus(PaymentService.STATUS_PENDING);
        return payment;
    }

    private Payment successPayment(String tradeNo) {
        Payment payment = pendingPayment();
        payment.setStatus(PaymentService.STATUS_SUCCESS);
        payment.setTradeNo(tradeNo);
        return payment;
    }

    private OrderInfoResponse order(Long id) {
        OrderInfoResponse order = new OrderInfoResponse();
        order.setId(id);
        order.setOrderNo("DM1001");
        order.setAmount(new BigDecimal("280.00"));
        order.setStatus(2);
        return order;
    }
}
