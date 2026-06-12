package com.omni.common.mq;

import com.omni.common.mq.message.ActivitySearchIndexMessage;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class ActivitySearchIndexMessageTest {

    @Test
    void buildsUpsertMessageWithStableEventIdPrefix() {
        ActivitySearchIndexMessage message = ActivitySearchIndexMessage.upsert(900001L);

        assertEquals(900001L, message.getActivityId());
        assertEquals(ActivitySearchIndexMessage.EVENT_TYPE_UPSERT, message.getEventType());
        assertNotNull(message.getOccurredAt());
        assertNotNull(message.getEventId());
        assertEquals(true, message.getEventId().startsWith("activity-search:900001:UPSERT:"));
    }

    @Test
    void buildsDeleteMessageWithStableEventIdPrefix() {
        ActivitySearchIndexMessage message = ActivitySearchIndexMessage.delete(900001L);

        assertEquals(900001L, message.getActivityId());
        assertEquals(ActivitySearchIndexMessage.EVENT_TYPE_DELETE, message.getEventType());
        assertNotNull(message.getOccurredAt());
        assertNotNull(message.getEventId());
        assertEquals(true, message.getEventId().startsWith("activity-search:900001:DELETE:"));
    }
}
