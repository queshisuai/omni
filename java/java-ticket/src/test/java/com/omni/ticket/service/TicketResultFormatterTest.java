package com.omni.ticket.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.omni.ai.client.AiModelClient;
import com.omni.ai.dto.AiResponse;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TicketResultFormatterTest {

    @Test
    void fallsBackToDeterministicChineseFactsWhenModelAddsUnsafeContent() {
        AiModelClient modelClient = mock(AiModelClient.class);
        when(modelClient.generate(any())).thenReturn(
                new AiResponse("request-1", "test-model", "请访问 https://example.com", "stop", null, 1));
        TicketFinderResult result = new TicketFinderResult();
        result.setPrice(new BigDecimal("380.00"));
        result.setAvailableQuantity(1);

        String explanation = new TicketResultFormatter(modelClient, new ObjectMapper())
                .explain("request-1", List.of(result), 2);

        assertTrue(explanation.contains("1 个"));
        assertTrue(explanation.contains("2 人"));
    }

    @Test
    void fallsBackWhenModelInventsAvailabilityQuantity() {
        AiModelClient modelClient = mock(AiModelClient.class);
        when(modelClient.generate(any())).thenReturn(
                new AiResponse("request-1", "test-model", "还有 2 张票可售。", "stop", null, 1));
        TicketFinderResult result = new TicketFinderResult();
        result.setPrice(new BigDecimal("380.00"));
        result.setAvailableQuantity(1);

        String explanation = new TicketResultFormatter(modelClient, new ObjectMapper())
                .explain("request-1", List.of(result), 2);

        assertTrue(explanation.contains("1 个"));
        assertTrue(explanation.contains("2 人"));
        assertTrue(!explanation.contains("还有 2 张票"));
    }

    @Test
    void acceptsArabicNumbersThatArePresentInFacts() {
        AiModelClient modelClient = mock(AiModelClient.class);
        when(modelClient.generate(any())).thenReturn(
                new AiResponse("request-1", "test-model", "已找到 1 个符合条件的票档。", "stop", null, 1));
        TicketFinderResult result = new TicketFinderResult();
        result.setPrice(new BigDecimal("380.00"));
        result.setAvailableQuantity(1);

        String explanation = new TicketResultFormatter(modelClient, new ObjectMapper())
                .explain("request-1", List.of(result), null);

        assertEquals("已找到 1 个符合条件的票档。", explanation);
    }

    @Test
    void fallsBackWhenModelInventsActivityName() {
        AiModelClient modelClient = mock(AiModelClient.class);
        when(modelClient.generate(any())).thenReturn(
                new AiResponse("request-1", "test-model", "已找到 1 个虚构活动。", "stop", null, 1));
        TicketFinderResult result = result("真实演唱会", "东京巨蛋", "东京");

        String explanation = new TicketResultFormatter(modelClient, new ObjectMapper())
                .explain("request-1", List.of(result), null);

        assertTrue(explanation.contains("实时票务数据"));
        assertTrue(!explanation.contains("虚构活动"));
    }

    @Test
    void fallsBackWhenModelInventsVenueNameOrBusinessAction() {
        AiModelClient modelClient = mock(AiModelClient.class);
        when(modelClient.generate(any())).thenReturn(
                new AiResponse("request-1", "test-model", "请立即下单，票在虚构场馆。", "stop", null, 1));
        TicketFinderResult result = result("真实演唱会", "东京巨蛋", "东京");

        String explanation = new TicketResultFormatter(modelClient, new ObjectMapper())
                .explain("request-1", List.of(result), null);

        assertTrue(explanation.contains("实时票务数据"));
        assertTrue(!explanation.contains("立即下单"));
        assertTrue(!explanation.contains("虚构场馆"));
    }

    @Test
    void fallsBackWhenModelClaimsAdjacentSeatsWithoutConfirmedFact() {
        AiModelClient modelClient = mock(AiModelClient.class);
        when(modelClient.generate(any())).thenReturn(
                new AiResponse("request-1", "test-model", "该票档支持连座。", "stop", null, 1));
        TicketFinderResult result = result("真实演唱会", "东京巨蛋", "东京");

        String explanation = new TicketResultFormatter(modelClient, new ObjectMapper())
                .explain("request-1", List.of(result), 2);

        assertTrue(explanation.contains("实时票务数据"));
        assertTrue(!explanation.contains("支持连座"));
    }

    private TicketFinderResult result(String activityName, String venueName, String city) {
        TicketFinderResult result = new TicketFinderResult();
        result.setActivityName(activityName);
        result.setVenueName(venueName);
        result.setCity(city);
        result.setTicketTypeName("看台");
        result.setPrice(new BigDecimal("380.00"));
        result.setAvailableQuantity(1);
        result.setSaleStatus("on_sale");
        return result;
    }
}
