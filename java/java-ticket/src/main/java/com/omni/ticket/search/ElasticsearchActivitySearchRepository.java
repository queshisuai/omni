package com.omni.ticket.search;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.ticket.dto.ActivityVO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Repository
public class ElasticsearchActivitySearchRepository {

    private static final String DEFAULT_INDEX_ALIAS = "omni_activity_search_current";

    private final ElasticsearchClient elasticsearchClient;
    private final String indexAlias;

    @Autowired
    public ElasticsearchActivitySearchRepository(ElasticsearchClient elasticsearchClient, SearchProperties searchProperties) {
        this(elasticsearchClient, searchProperties == null ? DEFAULT_INDEX_ALIAS : searchProperties.getEs().getIndexAlias());
    }

    public ElasticsearchActivitySearchRepository(ElasticsearchClient elasticsearchClient, String indexAlias) {
        this.elasticsearchClient = elasticsearchClient;
        this.indexAlias = StringUtils.hasText(indexAlias) ? indexAlias : DEFAULT_INDEX_ALIAS;
    }

    public Page<ActivityVO> search(ActivitySearchRequest request) {
        ActivitySearchRequest actualRequest = request == null ? new ActivitySearchRequest() : request;
        int page = actualRequest.getPage() == null || actualRequest.getPage() <= 0 ? 1 : actualRequest.getPage();
        int size = actualRequest.getSize() == null || actualRequest.getSize() <= 0 ? 10 : actualRequest.getSize();
        Map<String, Object> response = elasticsearchClient.search(indexAlias, buildSearchBody(actualRequest, page, size));
        return toPage(response, page, size);
    }

    private Map<String, Object> buildSearchBody(ActivitySearchRequest request, int page, int size) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("from", (page - 1) * size);
        body.put("size", size);
        body.put("query", Map.of("bool", buildBoolQuery(request)));
        body.put("sort", buildSort(request.getSort()));
        return body;
    }

    private Map<String, Object> buildBoolQuery(ActivitySearchRequest request) {
        List<Object> must = new ArrayList<>();
        List<Object> filter = new ArrayList<>();
        if (StringUtils.hasText(request.getKeyword())) {
            must.add(Map.of("multi_match", Map.of(
                    "query", request.getKeyword().trim(),
                    "fields", List.of("name^3", "artistName^2", "artistNames^2", "categoryName", "venueCity", "searchText")
            )));
        }
        if (request.getCategoryId() != null) {
            filter.add(Map.of("term", Map.of("categoryId", request.getCategoryId())));
        }
        if (StringUtils.hasText(request.getCity())) {
            filter.add(Map.of("term", Map.of("cities.keyword", request.getCity().trim())));
        }
        if (request.getDateFrom() != null || request.getDateTo() != null) {
            Map<String, Object> range = new LinkedHashMap<>();
            if (request.getDateFrom() != null) range.put("gte", request.getDateFrom().atStartOfDay().toString());
            if (request.getDateTo() != null) range.put("lte", request.getDateTo().atTime(23, 59, 59).toString());
            filter.add(Map.of("range", Map.of("startTime", range)));
        }
        if (request.getMinPrice() != null || request.getMaxPrice() != null) {
            Map<String, Object> range = new LinkedHashMap<>();
            if (request.getMinPrice() != null) range.put("gte", request.getMinPrice());
            if (request.getMaxPrice() != null) range.put("lte", request.getMaxPrice());
            filter.add(Map.of("range", Map.of("minPrice", range)));
        }
        if (StringUtils.hasText(request.getSaleStatus())) {
            filter.add(Map.of("term", Map.of("saleStatus", request.getSaleStatus().trim())));
        }
        if (Boolean.TRUE.equals(request.getSeatMapOnly())) {
            filter.add(Map.of("term", Map.of("seatMapVisibility", "published")));
        }
        if (request.getRealNameRequired() != null) {
            filter.add(Map.of("term", Map.of("realNameRequired", request.getRealNameRequired())));
        }
        Map<String, Object> bool = new LinkedHashMap<>();
        bool.put("must", must.isEmpty() ? List.of(Map.of("match_all", Map.of())) : must);
        if (!filter.isEmpty()) {
            bool.put("filter", filter);
        }
        return bool;
    }

    private List<Object> buildSort(String sort) {
        String normalized = StringUtils.hasText(sort) ? sort.trim().toLowerCase(Locale.ROOT) : "";
        if ("relevance".equals(normalized)) {
            return List.of(Map.of("_score", Map.of("order", "desc")), Map.of("startTime", Map.of("order", "asc", "missing", "_last")));
        }
        if ("recent".equals(normalized)) {
            return List.of(Map.of("startTime", Map.of("order", "asc", "missing", "_last")));
        }
        if ("newest".equals(normalized)) {
            return List.of(Map.of("id", Map.of("order", "desc", "missing", "_last")));
        }
        if ("price_asc".equals(normalized)) {
            return List.of(Map.of("minPrice", Map.of("order", "asc", "missing", "_last")));
        }
        if ("price_desc".equals(normalized)) {
            return List.of(Map.of("minPrice", Map.of("order", "desc", "missing", "_last")));
        }
        return List.of(Map.of("status", Map.of("order", "desc", "missing", "_last")),
                Map.of("startTime", Map.of("order", "asc", "missing", "_last")));
    }

    @SuppressWarnings("unchecked")
    private Page<ActivityVO> toPage(Map<String, Object> response, int page, int size) {
        Map<String, Object> hits = (Map<String, Object>) response.getOrDefault("hits", Map.of());
        long total = parseTotal(hits.get("total"));
        List<Map<String, Object>> hitList = (List<Map<String, Object>>) hits.getOrDefault("hits", List.of());
        List<ActivityVO> records = new ArrayList<>();
        for (Map<String, Object> hit : hitList) {
            Object source = hit.get("_source");
            if (source instanceof Map<?, ?>) {
                records.add(toActivityVo((Map<String, Object>) source));
            }
        }
        Page<ActivityVO> result = new Page<>(page, size, total);
        result.setRecords(records);
        result.setTotal(total);
        result.setPages((total + size - 1L) / size);
        return result;
    }

    @SuppressWarnings("unchecked")
    private long parseTotal(Object total) {
        if (total instanceof Number) {
            return ((Number) total).longValue();
        }
        if (total instanceof Map<?, ?>) {
            Object value = ((Map<String, Object>) total).get("value");
            if (value instanceof Number) {
                return ((Number) value).longValue();
            }
        }
        return 0L;
    }

    private ActivityVO toActivityVo(Map<String, Object> source) {
        ActivityVO vo = new ActivityVO();
        vo.setId(toLong(source.get("id")));
        vo.setItemType(toStringValue(source.get("itemType")));
        vo.setName(toStringValue(source.get("name")));
        vo.setPoster(toStringValue(source.get("poster")));
        vo.setCategoryName(toStringValue(source.get("categoryName")));
        vo.setArtistName(toStringValue(source.get("artistName")));
        vo.setVenueCity(toStringValue(source.get("venueCity")));
        vo.setStartTime(toLocalDateTime(source.get("startTime")));
        vo.setMinPrice(toBigDecimal(source.get("minPrice")));
        vo.setSeatMapVisibility(toStringValue(source.get("seatMapVisibility")));
        vo.setRealNameRequired(toBoolean(source.get("realNameRequired")));
        vo.setTicketTransferAllowed(toBoolean(source.get("ticketTransferAllowed")));
        vo.setStatus(toInteger(source.get("status")));
        return vo;
    }

    private Long toLong(Object value) {
        if (value instanceof Number) return ((Number) value).longValue();
        if (value == null) return null;
        return Long.valueOf(String.valueOf(value));
    }

    private Integer toInteger(Object value) {
        if (value instanceof Number) return ((Number) value).intValue();
        if (value == null) return null;
        return Integer.valueOf(String.valueOf(value));
    }

    private BigDecimal toBigDecimal(Object value) {
        if (value instanceof BigDecimal) return (BigDecimal) value;
        if (value instanceof Number || value instanceof String) return new BigDecimal(String.valueOf(value));
        return null;
    }

    private LocalDateTime toLocalDateTime(Object value) {
        if (!StringUtils.hasText(toStringValue(value))) return null;
        return LocalDateTime.parse(String.valueOf(value));
    }

    private Boolean toBoolean(Object value) {
        if (value instanceof Boolean) return (Boolean) value;
        if (value == null) return null;
        return Boolean.valueOf(String.valueOf(value));
    }

    private String toStringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
