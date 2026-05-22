package com.omni.payment.service;

import com.omni.payment.client.OrderClient;
import com.omni.payment.client.TicketRefundReviewInternalClient;
import com.omni.payment.client.UserInternalClient;
import com.omni.payment.config.AlipayProperties;
import com.omni.payment.mapper.PaymentMapper;
import com.omni.payment.mapper.RefundRequestMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.AutowiredAnnotationBeanPostProcessor;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;

class RefundServiceInjectionTest {

    @Test
    void springCanCreateRefundServiceWithConstructorInjection() {
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            context.registerBean(AutowiredAnnotationBeanPostProcessor.class);
            context.registerBean(AlipayProperties.class, AlipayProperties::new);
            context.registerBean(OrderClient.class, () -> mock(OrderClient.class));
            context.registerBean(RefundRequestMapper.class, () -> mock(RefundRequestMapper.class));
            context.registerBean(PaymentMapper.class, () -> mock(PaymentMapper.class));
            context.registerBean(UserInternalClient.class, () -> mock(UserInternalClient.class));
            context.registerBean(TicketRefundReviewInternalClient.class, () -> mock(TicketRefundReviewInternalClient.class));
            context.registerBean(RefundService.class);

            context.refresh();

            assertNotNull(context.getBean(RefundService.class));
        }
    }
}
