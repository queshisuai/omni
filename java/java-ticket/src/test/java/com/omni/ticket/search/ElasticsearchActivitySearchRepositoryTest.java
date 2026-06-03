package com.omni.ticket.search;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.omni.ticket.dto.ActivityVO;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ElasticsearchActivitySearchRepositoryTest {

    @Test
    void buildsBoolQueryWithKeywordFiltersAndRelevanceSort() throws JsonProcessingException {
        FakeElasticsearchClient client = new FakeElasticsearchClient(searchHit(document()));
        ElasticsearchActivitySearchRepository repository =
                new ElasticsearchActivitySearchRepository(client, "omni_activity_search_current");

        Page<ActivityVO> result = repository.search(ActivitySearchRequest.builder()
                .page(1)
                .size(20)
                .keyword("周杰伦")
                .city("上海")
                .minPrice(new BigDecimal("180"))
                .maxPrice(new BigDecimal("580"))
                .saleStatus("on_sale")
                .realNameRequired(true)
                .seatMapOnly(true)
                .sort("relevance")
                .build());

        assertEquals("omni_activity_search_current", client.lastIndexAlias);
        assertEquals(1, result.getTotal());
        assertEquals(10L, result.getRecords().get(0).getId());
        String json = new ObjectMapper().writeValueAsString(client.lastSearchBody);
        assertTrue(json.contains("\"multi_match\""));
        assertTrue(json.contains("\"cities.keyword\""));
        assertTrue(json.contains("\"realNameRequired\""));
        assertTrue(json.contains("\"seatMapVisibility\""));
        assertTrue(json.contains("\"saleStatus\""));
        assertFalse(json.contains("\"seatMapVisibility.keyword\""));
        assertFalse(json.contains("\"saleStatus.keyword\""));
        assertTrue(json.contains("\"_score\""));
    }

    private Map<String, Object> searchHit(Map<String, Object> source) {
        return Map.of("_id", "activity:10", "_score", 1.0, "_source", source);
    }

    private Map<String, Object> document() {
        return Map.ofEntries(
                Map.entry("id", 10),
                Map.entry("itemType", "activity"),
                Map.entry("name", "周末演唱会"),
                Map.entry("poster", "/background.png"),
                Map.entry("categoryName", "演唱会"),
                Map.entry("artistName", "周杰伦"),
                Map.entry("venueCity", "上海"),
                Map.entry("startTime", "2026-06-20T19:30:00"),
                Map.entry("minPrice", 380.00),
                Map.entry("seatMapVisibility", "published"),
                Map.entry("realNameRequired", true),
                Map.entry("ticketTransferAllowed", true),
                Map.entry("status", 1)
        );
    }

    private static class FakeElasticsearchClient implements ElasticsearchClient {
        private final Map<String, Object> hit;
        private String lastIndexAlias;
        private Map<String, Object> lastSearchBody;

        FakeElasticsearchClient(Map<String, Object> hit) {
            this.hit = hit;
        }

        @Override
        public boolean isAvailable() {
            return true;
        }

        @Override
        public Map<String, Object> search(String indexAlias, Map<String, Object> body) {
            this.lastIndexAlias = indexAlias;
            this.lastSearchBody = body;
            return Map.of("hits", Map.of("total", Map.of("value", 1), "hits", List.of(hit)));
        }

        @Override
        public void putJson(String path, Map<String, Object> body) {}

        @Override
        public void postJson(String path, Map<String, Object> body) {}

        @Override
        public void delete(String path) {}
    }
}
