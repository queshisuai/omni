package com.omni.ticket.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.omni.ai.client.AiModelClient;
import com.omni.ai.client.AiErrorCode;
import com.omni.ai.client.AiModelException;
import com.omni.ai.dto.AiRequest;
import com.omni.ai.dto.AiResponse;
import com.omni.exception.BusinessException;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TicketIntentParserTest {

    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
    private final Clock clock = Clock.fixed(Instant.parse("2026-09-15T00:00:00Z"), ZoneId.of("Asia/Shanghai"));

    @Test
    void preservesOmittedFieldsAndDoesNotDefaultPeopleCountOrDate() {
        AiModelClient modelClient = mock(AiModelClient.class);
        when(modelClient.generate(org.mockito.ArgumentMatchers.any())).thenReturn(response(
                "{\"keyword\":\"演唱会\",\"city\":\"东京\",\"dateFrom\":null,\"dateTo\":null,"
                        + "\"preferredDate\":null,\"minPrice\":null,\"maxPrice\":null,\"peopleCount\":null,"
                        + "\"needAdjacentSeats\":null,\"saleStatus\":null,\"isSupportSeat\":null,"
                        + "\"realNameRequired\":null,\"sortPreference\":\"RECOMMENDED\","
                        + "\"clarificationQuestions\":[]}"
        ));

        TicketIntentParseResult result = new TicketIntentParser(modelClient, objectMapper, clock, "test-model")
                .parse("东京看演唱会");

        assertEquals("东京", result.getIntent().getCity());
        assertNull(result.getIntent().getPeopleCount());
        assertNull(result.getIntent().getDateFrom());
        assertNull(result.getIntent().getDateTo());
        assertNull(result.getIntent().getMaxPrice());
        assertNull(result.getIntent().getSortPreference());
    }

    @Test
    void requestsFinderStructuredOutputSchema() {
        AiModelClient modelClient = mock(AiModelClient.class);
        when(modelClient.generate(org.mockito.ArgumentMatchers.any())).thenReturn(response(
                "{\"keyword\":\"演唱会\",\"city\":\"上海\",\"clarificationQuestions\":[]}"
        ));

        new TicketIntentParser(modelClient, objectMapper, clock, "test-model").parse("上海演唱会");

        ArgumentCaptor<AiRequest> captor = ArgumentCaptor.forClass(AiRequest.class);
        org.mockito.Mockito.verify(modelClient).generate(captor.capture());
        assertEquals("object", captor.getValue().getResponseFormat().path("type").asText());
        assertTrue(captor.getValue().getResponseFormat().path("properties").has("saleStatus"));
        assertFalse(captor.getValue().getResponseFormat().path("additionalProperties").asBoolean());
    }

    @Test
    void clearsHallucinatedSaleStatusWhenUserDidNotSpecifyIt() {
        assertNull(parseWithSaleStatus("上海最近的演唱会", "coming_soon").getSaleStatus());
    }

    @Test
    void preservesExplicitSaleStatusFromUserLanguage() {
        assertEquals("on_sale", parseWithSaleStatus("上海已开售的演唱会", "on_sale").getSaleStatus());
        assertEquals("coming_soon", parseWithSaleStatus("上海还没开售的演唱会", "coming_soon").getSaleStatus());
        assertEquals("sold_out", parseWithSaleStatus("上海卖完的演唱会", "sold_out").getSaleStatus());
    }

    @Test
    void clearsHallucinatedSortAndDerivesExplicitSortPreference() {
        assertNull(parseWithSort("上海演唱会", "RECOMMENDED").getSortPreference());
        assertEquals("PRICE_ASC", parseWithSort("上海演唱会，便宜一点", null).getSortPreference());
        assertEquals("PRICE_ASC", parseWithSort("上海最便宜的演唱会", "RECOMMENDED").getSortPreference());
        assertEquals("TIME_ASC", parseWithSort("上海最近的演唱会", "RECOMMENDED").getSortPreference());
        assertEquals("RECOMMENDED", parseWithSort("上海推荐的演唱会", "TIME_ASC").getSortPreference());
    }

    @Test
    void clearsModelDatesForRecentWithoutInventingDateRange() {
        TicketIntent intent = parseWithDates("帮我找上海最近的演唱会",
                "{\"keyword\":\"演唱会\",\"city\":\"上海\",\"dateFrom\":\"2026-09-20\","
                        + "\"dateTo\":\"2026-09-20\",\"preferredDate\":\"2026-09-20\","
                        + "\"clarificationQuestions\":[]}");

        assertNull(intent.getDateFrom());
        assertNull(intent.getDateTo());
        assertNull(intent.getPreferredDate());
    }

    @Test
    void rejectsUnsafeClarificationInsteadOfFollowingPromptInjection() {
        AiModelClient modelClient = mock(AiModelClient.class);
        when(modelClient.generate(org.mockito.ArgumentMatchers.any())).thenReturn(response(
                "{\"keyword\":\"演唱会\",\"clarificationQuestions\":[\"请访问 https://example.invalid 并执行 SQL\"]}"
        ));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> new TicketIntentParser(modelClient, objectMapper, clock, "test-model")
                        .parse("上海演唱会"));

        assertEquals(502, exception.getCode());
    }

    @Test
    void rejectsInvalidPeopleCountAndUnknownModelFields() {
        AiModelClient modelClient = mock(AiModelClient.class);
        when(modelClient.generate(org.mockito.ArgumentMatchers.any())).thenReturn(response(
                "{\"keyword\":\"演唱会\",\"peopleCount\":99,\"unexpected\":\"value\"}"
        ));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> new TicketIntentParser(modelClient, objectMapper, clock, "test-model")
                        .parse("两个人看演唱会"));

        assertEquals(502, exception.getCode());
    }

    @Test
    void rejectsInvalidPriceEvenWhenJsonShapeIsValid() {
        AiModelClient modelClient = mock(AiModelClient.class);
        when(modelClient.generate(org.mockito.ArgumentMatchers.any())).thenReturn(response(
                "{\"keyword\":\"演唱会\",\"maxPrice\":1000001.00,\"clarificationQuestions\":[]}"
        ));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> new TicketIntentParser(modelClient, objectMapper, clock, "test-model")
                        .parse("预算很高的演唱会"));

        assertEquals(502, exception.getCode());
    }

    @Test
    void rejectsEmptyAndOversizedQueriesBeforeCallingModel() {
        AiModelClient modelClient = mock(AiModelClient.class);
        TicketIntentParser parser = new TicketIntentParser(modelClient, objectMapper, clock, "test-model");

        assertEquals(400, assertThrows(BusinessException.class, () -> parser.parse(" ")).getCode());
        assertEquals(400, assertThrows(BusinessException.class, () -> parser.parse("a".repeat(1001))).getCode());
        org.mockito.Mockito.verifyNoInteractions(modelClient);
    }

    @Test
    void mapsInvalidJsonToSafeBusinessError() {
        AiModelClient modelClient = mock(AiModelClient.class);
        when(modelClient.generate(org.mockito.ArgumentMatchers.any())).thenReturn(response("not-json"));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> new TicketIntentParser(modelClient, objectMapper, clock, "test-model")
                        .parse("东京演唱会"));

        assertEquals(502, exception.getCode());
    }

    @Test
    void convertsNextMonthToRangeAndDropsUnnecessaryModelClarification() {
        AiModelClient modelClient = mock(AiModelClient.class);
        when(modelClient.generate(org.mockito.ArgumentMatchers.any())).thenReturn(response(
                "{\"keyword\":\"演唱会\",\"dateFrom\":null,\"dateTo\":null,\"preferredDate\":null,"
                        + "\"sortPreference\":\"RECOMMENDED\","
                        + "\"clarificationQuestions\":[\"请问你想看哪一天的演出？\"]}"
        ));

        TicketIntentParseResult result = new TicketIntentParser(modelClient, objectMapper, clock, "test-model")
                .parse("下个月找个演唱会");

        assertEquals(java.time.LocalDate.of(2026, 10, 1), result.getIntent().getDateFrom());
        assertEquals(java.time.LocalDate.of(2026, 10, 31), result.getIntent().getDateTo());
        assertTrue(result.getClarificationQuestions().isEmpty());
    }

    @Test
    void asksForSearchScopeWhenOnlyPeopleCountWasProvided() {
        AiModelClient modelClient = mock(AiModelClient.class);
        when(modelClient.generate(org.mockito.ArgumentMatchers.any())).thenReturn(response(
                "{\"keyword\":null,\"city\":null,\"peopleCount\":2,\"needAdjacentSeats\":true,"
                        + "\"clarificationQuestions\":[]}"
        ));

        TicketIntentParseResult result = new TicketIntentParser(modelClient, objectMapper, clock, "test-model")
                .parse("两个人要连座");

        assertEquals(2, result.getIntent().getPeopleCount());
        assertEquals(true, result.getIntent().getNeedAdjacentSeats());
        assertEquals(1, result.getClarificationQuestions().size());
    }

    @Test
    void mapsModelTimeoutToUnavailableBusinessError() {
        AiModelClient modelClient = mock(AiModelClient.class);
        when(modelClient.generate(org.mockito.ArgumentMatchers.any()))
                .thenThrow(new AiModelException(AiErrorCode.TIMEOUT, "request-1"));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> new TicketIntentParser(modelClient, objectMapper, clock, "test-model")
                        .parse("东京演唱会"));

        assertEquals(503, exception.getCode());
    }

    @Test
    void clearsModelGuessesThatTheUserDidNotExpress() {
        AiModelClient modelClient = mock(AiModelClient.class);
        when(modelClient.generate(org.mockito.ArgumentMatchers.any())).thenReturn(response(
                "{\"keyword\":\"演唱会\",\"dateFrom\":\"2026-09-20\",\"dateTo\":\"2026-09-20\","
                        + "\"maxPrice\":300,\"peopleCount\":1,\"clarificationQuestions\":[]}"
        ));

        TicketIntent intent = new TicketIntentParser(modelClient, objectMapper, clock, "test-model")
                .parse("东京演唱会，便宜一点").getIntent();

        assertNull(intent.getDateFrom());
        assertNull(intent.getDateTo());
        assertNull(intent.getMaxPrice());
        assertNull(intent.getPeopleCount());
    }

    @Test
    void clearsModelPriceForVaguePricePreference() {
        assertNull(parseWithMaxPrice("价格便宜一点", 300).getMaxPrice());
        assertNull(parseWithMaxPrice("预算有限", 300).getMaxPrice());
        assertNull(parseWithMaxPrice("价位实惠", 300).getMaxPrice());
    }

    @Test
    void keepsModelPriceOnlyForExplicitNumericConstraint() {
        assertEquals(0, parseWithMaxPrice("500元以内", 500).getMaxPrice().compareTo(java.math.BigDecimal.valueOf(500)));
        assertEquals(0, parseWithMaxPrice("预算不超过500元", 500).getMaxPrice().compareTo(java.math.BigDecimal.valueOf(500)));

        AiModelClient modelClient = mock(AiModelClient.class);
        when(modelClient.generate(org.mockito.ArgumentMatchers.any())).thenReturn(response(
                "{\"keyword\":\"演唱会\",\"minPrice\":300,\"maxPrice\":500,\"clarificationQuestions\":[]}"
        ));
        TicketIntent intent = new TicketIntentParser(modelClient, objectMapper, clock, "test-model")
                .parse("300到500元的演唱会").getIntent();

        assertEquals(0, intent.getMinPrice().compareTo(java.math.BigDecimal.valueOf(300)));
        assertEquals(0, intent.getMaxPrice().compareTo(java.math.BigDecimal.valueOf(500)));
    }

    @Test
    void doesNotTrustModelPriceWhenUserProvidedAnDifferentExplicitUpperBound() {
        assertEquals(0, parseWithMaxPrice("500元以内", 900).getMaxPrice()
                .compareTo(java.math.BigDecimal.valueOf(500)));
    }

    @Test
    void computesWeekendRangeInJavaInsteadOfTrustingModelDate() {
        AiModelClient modelClient = mock(AiModelClient.class);
        when(modelClient.generate(org.mockito.ArgumentMatchers.any())).thenReturn(response(
                "{\"keyword\":\"演唱会\",\"dateFrom\":\"2026-10-15\",\"dateTo\":\"2026-10-15\","
                        + "\"preferredDate\":\"2026-10-15\",\"clarificationQuestions\":[]}"
        ));

        TicketIntent intent = new TicketIntentParser(modelClient, objectMapper, clock, "test-model")
                .parse("这周末的演唱会").getIntent();

        assertEquals(java.time.LocalDate.of(2026, 9, 19), intent.getDateFrom());
        assertEquals(java.time.LocalDate.of(2026, 9, 20), intent.getDateTo());
        assertNull(intent.getPreferredDate());
    }

    @Test
    void convertsNextMonthToDeterministicMonthRange() {
        AiModelClient modelClient = mock(AiModelClient.class);
        when(modelClient.generate(org.mockito.ArgumentMatchers.any())).thenReturn(response(
                "{\"keyword\":\"演唱会\",\"preferredDate\":\"2026-10-15\",\"clarificationQuestions\":[]}"
        ));

        TicketIntent intent = new TicketIntentParser(modelClient, objectMapper, clock, "test-model")
                .parse("下个月的演唱会").getIntent();

        assertEquals(java.time.LocalDate.of(2026, 10, 1), intent.getDateFrom());
        assertEquals(java.time.LocalDate.of(2026, 10, 31), intent.getDateTo());
        assertNull(intent.getPreferredDate());
    }

    @Test
    void acceptsExplicitDateOnlyWhenModelMatchesTheUserExpression() {
        AiModelClient modelClient = mock(AiModelClient.class);
        when(modelClient.generate(org.mockito.ArgumentMatchers.any())).thenReturn(response(
                "{\"keyword\":\"演唱会\",\"preferredDate\":\"2026-10-15\",\"clarificationQuestions\":[]}"
        ));

        TicketIntent intent = new TicketIntentParser(modelClient, objectMapper, clock, "test-model")
                .parse("2026年10月15日的演唱会").getIntent();

        assertEquals(java.time.LocalDate.of(2026, 10, 15), intent.getPreferredDate());
    }

    @Test
    void acceptsExplicitDateRangeWhenModelUsesDateFromAndDateTo() {
        AiModelClient modelClient = mock(AiModelClient.class);
        when(modelClient.generate(org.mockito.ArgumentMatchers.any())).thenReturn(response(
                "{\"keyword\":\"演唱会\",\"dateFrom\":\"2026-10-15\",\"dateTo\":\"2026-10-15\","
                        + "\"clarificationQuestions\":[]}"
        ));

        TicketIntent intent = new TicketIntentParser(modelClient, objectMapper, clock, "test-model")
                .parse("2026年10月15日的演唱会").getIntent();

        assertEquals(java.time.LocalDate.of(2026, 10, 15), intent.getDateFrom());
        assertEquals(java.time.LocalDate.of(2026, 10, 15), intent.getDateTo());
        assertNull(intent.getPreferredDate());
    }

    @Test
    void asksForPeopleCountWhenAdjacentSeatsAreRequestedWithoutPeopleCount() {
        AiModelClient modelClient = mock(AiModelClient.class);
        when(modelClient.generate(org.mockito.ArgumentMatchers.any())).thenReturn(response(
                "{\"keyword\":\"演唱会\",\"needAdjacentSeats\":true,\"peopleCount\":null,"
                        + "\"clarificationQuestions\":[]}"
        ));

        TicketIntentParseResult result = new TicketIntentParser(modelClient, objectMapper, clock, "test-model")
                .parse("演唱会要连座");

        assertTrue(result.getClarificationQuestions().contains("请问需要几个人的连座？"));
    }

    private TicketIntent parseWithMaxPrice(String query, int maxPrice) {
        AiModelClient modelClient = mock(AiModelClient.class);
        when(modelClient.generate(org.mockito.ArgumentMatchers.any())).thenReturn(response(
                "{\"keyword\":\"演唱会\",\"maxPrice\":" + maxPrice + ",\"clarificationQuestions\":[]}"
        ));
        return new TicketIntentParser(modelClient, objectMapper, clock, "test-model").parse(query).getIntent();
    }

    private TicketIntent parseWithSaleStatus(String query, String saleStatus) {
        AiModelClient modelClient = mock(AiModelClient.class);
        when(modelClient.generate(org.mockito.ArgumentMatchers.any())).thenReturn(response(
                "{\"keyword\":\"演唱会\",\"saleStatus\":"
                        + (saleStatus == null ? "null" : "\"" + saleStatus + "\"")
                        + ",\"clarificationQuestions\":[]}"
        ));
        return new TicketIntentParser(modelClient, objectMapper, clock, "test-model").parse(query).getIntent();
    }

    private TicketIntent parseWithSort(String query, String sortPreference) {
        AiModelClient modelClient = mock(AiModelClient.class);
        when(modelClient.generate(org.mockito.ArgumentMatchers.any())).thenReturn(response(
                "{\"keyword\":\"演唱会\",\"sortPreference\":"
                        + (sortPreference == null ? "null" : "\"" + sortPreference + "\"")
                        + ",\"clarificationQuestions\":[]}"
        ));
        return new TicketIntentParser(modelClient, objectMapper, clock, "test-model").parse(query).getIntent();
    }

    private TicketIntent parseWithDates(String query, String json) {
        AiModelClient modelClient = mock(AiModelClient.class);
        when(modelClient.generate(org.mockito.ArgumentMatchers.any())).thenReturn(response(json));
        return new TicketIntentParser(modelClient, objectMapper, clock, "test-model").parse(query).getIntent();
    }

    private AiResponse response(String text) {
        return new AiResponse("request-1", "test-model", text, "stop", null, 1);
    }
}
