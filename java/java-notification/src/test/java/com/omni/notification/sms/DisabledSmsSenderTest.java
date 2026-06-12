package com.omni.notification.sms;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;

class DisabledSmsSenderTest {

    @Test
    void springContextCreatesDisabledSenderWhenSmsProviderIsNotConfigured() {
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            context.register(SmsSenderConfig.class);

            context.refresh();

            assertInstanceOf(DisabledSmsSender.class, context.getBean(SmsSender.class));
        }
    }

    @Test
    void sendReturnsSkippedWhenSmsProviderIsNotConfigured() {
        DisabledSmsSender sender = new DisabledSmsSender();
        SmsSendRequest request = new SmsSendRequest();
        request.setEventId("refund-approved:9001");
        request.setEventType("REFUND_APPROVED");
        request.setUserId(2004L);
        request.setContent("退款已通过。");

        SmsSendResult result = sender.send(request);

        assertEquals("SKIPPED", result.getStatus());
        assertNull(result.getProviderMessageId());
        assertEquals("短信渠道未配置", result.getFailureReason());
    }
}
