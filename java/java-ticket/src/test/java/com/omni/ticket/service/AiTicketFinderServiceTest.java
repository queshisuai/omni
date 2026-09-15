package com.omni.ticket.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.ticket.ai.TicketIntent;
import com.omni.ticket.ai.TicketIntentParseResult;
import com.omni.ticket.ai.TicketIntentParser;
import com.omni.ticket.dto.ActivityVO;
import com.omni.ticket.search.ActivitySearchProvider;
import com.omni.ticket.search.ActivitySearchRequest;
import com.omni.exception.BusinessException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AiTicketFinderServiceTest {

    @Test
    void clarificationStopsBeforeCandidateRetrieval() {
        TicketIntentParser parser = mock(TicketIntentParser.class);
        ActivitySearchProvider searchProvider = mock(ActivitySearchProvider.class);
        TicketAvailabilityQueryService availability = mock(TicketAvailabilityQueryService.class);
        TicketResultFormatter formatter = mock(TicketResultFormatter.class);
        TicketIntent intent = TicketIntent.builder().sortPreference("RECOMMENDED").build();
        when(parser.parse("便宜一点")).thenReturn(new TicketIntentParseResult(
                "request-1", intent, List.of("请提供活动名称、城市或日期范围中的至少一项")));

        var response = new AiTicketFinderService(parser, searchProvider, availability, formatter)
                .search("便宜一点");

        assertEquals(true, response.getClarification().isRequired());
        assertEquals(0, response.getResults().size());
        verifyNoInteractions(searchProvider, availability, formatter);
    }

    @Test
    void finalOrderingUsesJavaComparatorNotModelOutputOrder() {
        TicketIntentParser parser = mock(TicketIntentParser.class);
        ActivitySearchProvider searchProvider = mock(ActivitySearchProvider.class);
        TicketAvailabilityQueryService availability = mock(TicketAvailabilityQueryService.class);
        TicketResultFormatter formatter = mock(TicketResultFormatter.class);
        TicketIntent intent = TicketIntent.builder().keyword("演唱会").sortPreference("PRICE_ASC").build();
        when(parser.parse("便宜的演唱会")).thenReturn(new TicketIntentParseResult("request-2", intent, List.of()));
        Page<ActivityVO> page = new Page<>(1, 100, 2);
        page.setRecords(List.of(candidate(1L), candidate(2L)));
        when(searchProvider.search(any(ActivitySearchRequest.class))).thenReturn(page);
        TicketFinderResult expensive = result(2L, new BigDecimal("500.00"));
        TicketFinderResult cheap = result(1L, new BigDecimal("100.00"));
        when(availability.findAvailable(any(), any())).thenReturn(List.of(expensive, cheap));
        when(formatter.explain("request-2", List.of(cheap, expensive), null)).thenReturn("说明");

        var response = new AiTicketFinderService(parser, searchProvider, availability, formatter)
                .search("便宜的演唱会");

        assertEquals(cheap.getTicketTypeId(), response.getResults().get(0).getTicketTypeId());
        assertEquals(expensive.getTicketTypeId(), response.getResults().get(1).getTicketTypeId());
        verify(formatter).explain("request-2", List.of(cheap, expensive), null);
    }

    @Test
    void propagatesElasticsearchFailureWithoutDatabaseFallback() {
        TicketIntentParser parser = mock(TicketIntentParser.class);
        ActivitySearchProvider searchProvider = mock(ActivitySearchProvider.class);
        TicketAvailabilityQueryService availability = mock(TicketAvailabilityQueryService.class);
        TicketResultFormatter formatter = mock(TicketResultFormatter.class);
        TicketIntent intent = TicketIntent.builder().keyword("演唱会").build();
        when(parser.parse("演唱会")).thenReturn(new TicketIntentParseResult("request-3", intent, List.of()));
        when(searchProvider.search(any(ActivitySearchRequest.class)))
                .thenThrow(new BusinessException(503, "搜索服务暂时不可用，请稍后重试"));

        BusinessException exception = org.junit.jupiter.api.Assertions.assertThrows(BusinessException.class,
                () -> new AiTicketFinderService(parser, searchProvider, availability, formatter)
                        .search("演唱会"));

        assertEquals(503, exception.getCode());
        verifyNoInteractions(availability, formatter);
    }

    private ActivityVO candidate(Long id) {
        ActivityVO vo = new ActivityVO();
        vo.setId(id);
        vo.setItemType("activity");
        return vo;
    }

    private TicketFinderResult result(Long id, BigDecimal price) {
        TicketFinderResult result = new TicketFinderResult();
        result.setActivityId(id);
        result.setSessionId(id);
        result.setTicketTypeId(id);
        result.setPrice(price);
        result.setSessionStartTime(LocalDateTime.of(2026, 9, 20, 19, 30));
        result.setAvailableQuantity(3);
        return result;
    }
}
