package com.omni.ticket.search;

import com.omni.ticket.controller.ActivitySearchIndexController;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class ActivitySearchIndexConditionalBeanTest {

    @Test
    void elasticsearchIndexBeansOnlyLoadForElasticsearchProvider() {
        assertElasticsearchProviderCondition(ActivitySearchIndexService.class);
        assertElasticsearchProviderCondition(ActivitySearchIndexEventListener.class);
        assertElasticsearchProviderCondition(ActivitySearchIndexController.class);
    }

    private void assertElasticsearchProviderCondition(Class<?> type) {
        ConditionalOnProperty condition = type.getAnnotation(ConditionalOnProperty.class);
        assertNotNull(condition, type.getSimpleName() + " 必须按搜索 Provider 条件装配");
        assertEquals("omni.search", condition.prefix());
        assertEquals("provider", condition.name()[0]);
        assertEquals("elasticsearch", condition.havingValue());
    }
}
