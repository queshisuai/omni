package com.omni.ticket.search;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.ActivityVO;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.SearchHit;
import org.springframework.data.elasticsearch.core.SearchHits;
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates;
import org.springframework.data.elasticsearch.core.query.NativeSearchQuery;
import org.springframework.data.elasticsearch.core.query.Query;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ElasticsearchActivitySearchProviderTest {

    private final ElasticsearchOperations operations = mock(ElasticsearchOperations.class);
    private final ActivitySearchProperties properties = new ActivitySearchProperties();
    private final ElasticsearchActivitySearchProvider provider =
            new ElasticsearchActivitySearchProvider(operations, properties);

    @Test
    void buildsKeywordAndFilterQuery() {
        SearchHits<ActivitySearchDocument> hits = searchHits(List.of(), 0);
        when(operations.search(anyQuery(), eq(ActivitySearchDocument.class), any(IndexCoordinates.class)))
                .thenReturn(hits);
        ActivitySearchRequest request = ActivitySearchRequest.builder()
                .page(2)
                .size(20)
                .keyword("jay")
                .city("Beijing")
                .saleStatus("on_sale")
                .seatMapOnly(true)
                .realNameRequired(true)
                .sort("price_desc")
                .build();

        provider.search(request);

        ArgumentCaptor<Query> queryCaptor = ArgumentCaptor.forClass(Query.class);
        ArgumentCaptor<IndexCoordinates> indexCaptor = ArgumentCaptor.forClass(IndexCoordinates.class);
        verify(operations).search(queryCaptor.capture(), eq(ActivitySearchDocument.class), indexCaptor.capture());
        NativeSearchQuery query = (NativeSearchQuery) queryCaptor.getValue();
        String queryJson = query.getQuery().toString();

        assertEquals(20, query.getPageable().getPageSize());
        assertEquals(1, query.getPageable().getPageNumber());
        assertEquals("omni_activity_current", indexCaptor.getValue().getIndexName());
        assertTrue(queryJson.contains("multi_match"));
        assertTrue(queryJson.contains("activityName"));
        assertTrue(queryJson.contains("artistName"));
        assertTrue(queryJson.contains("city"));
        assertTrue(queryJson.contains("saleStatus"));
        assertTrue(queryJson.contains("seatMapVisibility"));
        assertTrue(queryJson.contains("realNameRequired"));
        assertTrue(query.getElasticsearchSorts().get(0).toString().contains("minPrice"));
        assertTrue(query.getElasticsearchSorts().get(0).toString().contains("desc"));
    }

    @Test
    void buildsRangeFiltersAndDefaultSort() {
        SearchHits<ActivitySearchDocument> hits = searchHits(List.of(), 0);
        when(operations.search(anyQuery(), eq(ActivitySearchDocument.class), any(IndexCoordinates.class)))
                .thenReturn(hits);
        ActivitySearchRequest request = ActivitySearchRequest.builder()
                .page(1)
                .size(10)
                .categoryId(1001L)
                .dateFrom(LocalDate.of(2026, 6, 1))
                .dateTo(LocalDate.of(2026, 6, 30))
                .minPrice(new BigDecimal("100"))
                .maxPrice(new BigDecimal("800"))
                .build();

        provider.search(request);

        ArgumentCaptor<Query> queryCaptor = ArgumentCaptor.forClass(Query.class);
        verify(operations).search(queryCaptor.capture(), eq(ActivitySearchDocument.class), any(IndexCoordinates.class));
        NativeSearchQuery query = (NativeSearchQuery) queryCaptor.getValue();
        String queryJson = query.getQuery().toString();

        assertTrue(queryJson.contains("categoryId"));
        assertTrue(queryJson.contains("startTime"));
        assertTrue(queryJson.contains("minPrice"));
        assertTrue(query.getElasticsearchSorts().get(0).toString().contains("hotScore"));
        assertTrue(query.getElasticsearchSorts().get(1).toString().contains("startTime"));
    }

    @Test
    void relevanceSortKeepsElasticsearchScoreOrdering() {
        SearchHits<ActivitySearchDocument> hits = searchHits(List.of(), 0);
        when(operations.search(anyQuery(), eq(ActivitySearchDocument.class), any(IndexCoordinates.class)))
                .thenReturn(hits);

        provider.search(ActivitySearchRequest.builder()
                .page(1)
                .size(10)
                .keyword("成都音乐节")
                .sort("relevance")
                .build());

        ArgumentCaptor<Query> queryCaptor = ArgumentCaptor.forClass(Query.class);
        verify(operations).search(queryCaptor.capture(), eq(ActivitySearchDocument.class), any(IndexCoordinates.class));
        NativeSearchQuery query = (NativeSearchQuery) queryCaptor.getValue();

        assertTrue(query.getElasticsearchSorts().isEmpty());
    }

    @Test
    void mapsSearchHitsToActivityPage() {
        ActivitySearchDocument document = new ActivitySearchDocument();
        document.setId("activity:900001");
        document.setActivityId(900001L);
        document.setItemType("activity");
        document.setPoster("/uploads/ticket/activity-poster/2026/09/jay.webp");
        document.setCategoryId(1001L);
        document.setOrganizerId(2002L);
        document.setActivityName("Jay Chou Carnival World Tour Beijing");
        document.setArtistName("Jay Chou");
        document.setCategoryName("Concert");
        document.setCity("Beijing");
        document.setVenueName("National Stadium");
        document.setStartTime("2026-06-22T19:30:00");
        document.setMinPrice(new BigDecimal("580"));
        document.setMaxPrice(new BigDecimal("1880"));
        document.setSeatMapVisibility("published");
        document.setRealNameRequired(true);
        document.setTicketTransferAllowed(false);
        document.setSaleStatus("on_sale");
        SearchHits<ActivitySearchDocument> hits = searchHits(List.of(document), 1);
        when(operations.search(anyQuery(), eq(ActivitySearchDocument.class), any(IndexCoordinates.class)))
                .thenReturn(hits);

        Page<ActivityVO> result = provider.search(ActivitySearchRequest.builder().page(1).size(10).build());

        assertEquals(1, result.getTotal());
        assertEquals(1, result.getRecords().size());
        ActivityVO vo = result.getRecords().get(0);
        assertEquals(900001L, vo.getId());
        assertEquals("activity", vo.getItemType());
        assertEquals(1001L, vo.getCategoryId());
        assertEquals(2002L, vo.getOrganizerId());
        assertEquals("Jay Chou Carnival World Tour Beijing", vo.getName());
        assertEquals("/uploads/ticket/activity-poster/2026/09/jay.webp", vo.getPoster());
        assertEquals("Jay Chou", vo.getArtistName());
        assertEquals("Concert", vo.getCategoryName());
        assertEquals("Beijing", vo.getVenueCity());
        assertEquals("National Stadium", vo.getVenueName());
        assertEquals(new BigDecimal("580"), vo.getMinPrice());
        assertEquals(new BigDecimal("1880"), vo.getMaxPrice());
        assertEquals(1, vo.getStatus());
    }

    @Test
    void mapsTourSearchHitToTourId() {
        ActivitySearchDocument document = new ActivitySearchDocument();
        document.setId("tour:5");
        document.setTourId(5L);
        document.setItemType("tour");
        document.setActivityName("巡演项目");
        document.setSaleStatus("on_sale");
        SearchHits<ActivitySearchDocument> hits = searchHits(List.of(document), 1);
        when(operations.search(anyQuery(), eq(ActivitySearchDocument.class), any(IndexCoordinates.class)))
                .thenReturn(hits);

        Page<ActivityVO> result = provider.search(ActivitySearchRequest.builder().page(1).size(10).build());

        assertEquals(5L, result.getRecords().get(0).getId());
        assertEquals("tour", result.getRecords().get(0).getItemType());
    }

    @Test
    void throwsControlledBusinessExceptionWhenRequiredSearchFails() {
        properties.setRequireElasticsearch(true);
        when(operations.search(anyQuery(), eq(ActivitySearchDocument.class), any(IndexCoordinates.class)))
                .thenThrow(new RuntimeException("connect failed"));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> provider.search(ActivitySearchRequest.builder().page(1).size(10).build()));

        assertEquals(503, exception.getCode());
        assertEquals("搜索服务暂时不可用，请稍后重试", exception.getMessage());
    }

    @Test
    void propagatesExistingBusinessException() {
        BusinessException original = new BusinessException(400, "搜索参数不正确");
        when(operations.search(anyQuery(), eq(ActivitySearchDocument.class), any(IndexCoordinates.class)))
                .thenThrow(original);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> provider.search(ActivitySearchRequest.builder().page(1).size(10).build()));

        assertSame(original, exception);
    }

    @SuppressWarnings("unchecked")
    private Query anyQuery() {
        return any(Query.class);
    }

    @SuppressWarnings("unchecked")
    private SearchHits<ActivitySearchDocument> searchHits(List<ActivitySearchDocument> documents, long totalHits) {
        SearchHits<ActivitySearchDocument> hits = mock(SearchHits.class);
        List<SearchHit<ActivitySearchDocument>> searchHitList = documents.stream()
                .map(document -> new SearchHit<>("omni_activity_current", document.getId(), null,
                        1.0f, null, Collections.emptyMap(), document))
                .collect(Collectors.toList());
        when(hits.getSearchHits()).thenReturn(searchHitList);
        when(hits.getTotalHits()).thenReturn(totalHits);
        return hits;
    }
}
