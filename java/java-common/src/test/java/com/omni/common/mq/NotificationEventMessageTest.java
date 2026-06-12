package com.omni.common.mq;

import com.omni.common.mq.message.NotificationEventMessage;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class NotificationEventMessageTest {

    @Test
    void defaultsToInAppChannelAndNormalPriority() {
        NotificationEventMessage message = new NotificationEventMessage();
        message.setEventId("support-reply:99");
        message.setEventType("SUPPORT_REPLY");
        message.setUserId(2004L);
        message.setContent("人工客服回复了你的咨询，请查看客服会话。");

        assertEquals(List.of("IN_APP"), message.effectiveChannels());
        assertEquals("NORMAL", message.effectivePriority());
    }

    @Test
    void normalizesChannelsAndKeepsPayload() {
        NotificationEventMessage message = new NotificationEventMessage();
        message.setChannels(List.of("sms", "IN_APP", " ", "sms"));
        message.setPayload(Map.of("activityName", "周杰伦演唱会", "amount", 1880));

        assertEquals(List.of("SMS", "IN_APP"), message.effectiveChannels());
        assertEquals("周杰伦演唱会", message.getPayload().get("activityName"));
        assertEquals(1880, message.getPayload().get("amount"));
    }
}
