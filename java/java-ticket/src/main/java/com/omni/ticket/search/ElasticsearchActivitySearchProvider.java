package com.omni.ticket.search;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.ActivityVO;
import org.elasticsearch.index.query.BoolQueryBuilder;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.index.query.RangeQueryBuilder;
import org.elasticsearch.search.sort.SortBuilder;
import org.elasticsearch.search.sort.SortBuilders;
import org.elasticsearch.search.sort.SortOrder;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.SearchHits;
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates;
import org.springframework.data.elasticsearch.core.query.NativeSearchQuery;
import org.springframework.data.elasticsearch.core.query.NativeSearchQueryBuilder;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Component
@ConditionalOnProperty(prefix = "omni.search", name = "provider", havingValue = "elasticsearch")
public class ElasticsearchActivitySearchProvider implements ActivitySearchProvider {

    private static final String SEARCH_UNAVAILABLE_MESSAGE = "搜索服务暂时不可用，请稍后重试";

    private final ElasticsearchOperations operations;
    private final ActivitySearchProperties properties;

    public ElasticsearchActivitySearchProvider(ElasticsearchOperations operations, ActivitySearchProperties properties) {
        this.operations = operations;
        this.properties = properties == null ? new ActivitySearchProperties() : properties;
    }

    @Override
    public Page<ActivityVO> search(ActivitySearchRequest request) {
        ActivitySearchRequest safeRequest = request == null ? ActivitySearchRequest.builder().build() : request;
        int safePage = safeRequest.getPage() == null || safeRequest.getPage() <= 0 ? 1 : safeRequest.getPage();
        int safeSize = safeRequest.getSize() == null || safeRequest.getSize() <= 0 ? 10 : safeRequest.getSize();
        try {
            NativeSearchQuery query = buildQuery(safeRequest, safePage, safeSize);
            SearchHits<ActivitySearchDocument> hits = operations.search(query, ActivitySearchDocument.class,
                    IndexCoordinates.of(properties.getAliasName()));
            List<ActivityVO> records = hits.getSearchHits().stream()
                    .map(hit -> toActivityVo(hit.getContent()))
                    .collect(Collectors.toList());
            Page<ActivityVO> page = new Page<>(safePage, safeSize, hits.getTotalHits());
            page.setRecords(records);
            page.setTotal(hits.getTotalHits());
            page.setPages((hits.getTotalHits() + safeSize - 1L) / safeSize);
            return page;
        } catch (BusinessException e) {
            throw e;
        } catch (RuntimeException e) {
            if (properties.isRequireElasticsearch()) {
                throw new BusinessException(503, SEARCH_UNAVAILABLE_MESSAGE);
            }
            throw e;
        }
    }

    private NativeSearchQuery buildQuery(ActivitySearchRequest request, int page, int size) {
        BoolQueryBuilder boolQuery = QueryBuilders.boolQuery();
        if (StringUtils.hasText(request.getKeyword())) {
            boolQuery.must(QueryBuilders.multiMatchQuery(request.getKeyword().trim(),
                    "activityName", "artistName", "categoryName", "venueName"));
        }
        if (request.getCategoryId() != null) {
            boolQuery.filter(QueryBuilders.termQuery("categoryId", request.getCategoryId()));
        }
        if (StringUtils.hasText(request.getCity())) {
            boolQuery.filter(QueryBuilders.termQuery("city", request.getCity().trim()));
        }
        if (StringUtils.hasText(request.getSaleStatus())) {
            boolQuery.filter(QueryBuilders.termQuery("saleStatus", request.getSaleStatus().trim().toLowerCase(Locale.ROOT)));
        }
        if (Boolean.TRUE.equals(request.getSeatMapOnly())) {
            boolQuery.filter(QueryBuilders.termQuery("seatMapVisibility", "published"));
        }
        if (request.getRealNameRequired() != null) {
            boolQuery.filter(QueryBuilders.termQuery("realNameRequired", request.getRealNameRequired()));
        }
        applyDateRange(boolQuery, request.getDateFrom(), request.getDateTo());
        applyPriceRange(boolQuery, request.getMinPrice(), request.getMaxPrice());

        NativeSearchQueryBuilder builder = new NativeSearchQueryBuilder()
                .withQuery(boolQuery)
                .withPageable(PageRequest.of(page - 1, size))
                .withTrackTotalHits(true);
        resolveSorts(request.getSort()).forEach(builder::withSort);
        return builder.build();
    }

    private void applyDateRange(BoolQueryBuilder boolQuery, LocalDate dateFrom, LocalDate dateTo) {
        if (dateFrom == null && dateTo == null) {
            return;
        }
        RangeQueryBuilder range = QueryBuilders.rangeQuery("startTime");
        if (dateFrom != null) {
            range.gte(dateFrom.atStartOfDay().toString());
        }
        if (dateTo != null) {
            range.lte(dateTo.atTime(LocalTime.MAX).toString());
        }
        boolQuery.filter(range);
    }

    private void applyPriceRange(BoolQueryBuilder boolQuery, BigDecimal minPrice, BigDecimal maxPrice) {
        if (minPrice == null && maxPrice == null) {
            return;
        }
        RangeQueryBuilder range = QueryBuilders.rangeQuery("minPrice");
        if (minPrice != null) {
            range.gte(minPrice);
        }
        if (maxPrice != null) {
            range.lte(maxPrice);
        }
        boolQuery.filter(range);
    }

    private List<SortBuilder<?>> resolveSorts(String sort) {
        String normalized = StringUtils.hasText(sort) ? sort.trim().toLowerCase(Locale.ROOT) : "";
        List<SortBuilder<?>> sorts = new ArrayList<>();
        if ("recent".equals(normalized)) {
            sorts.add(SortBuilders.fieldSort("startTime").order(SortOrder.ASC));
        } else if ("newest".equals(normalized)) {
            sorts.add(SortBuilders.fieldSort("updatedAt").order(SortOrder.DESC));
        } else if ("price_asc".equals(normalized)) {
            sorts.add(SortBuilders.fieldSort("minPrice").order(SortOrder.ASC));
        } else if ("price_desc".equals(normalized)) {
            sorts.add(SortBuilders.fieldSort("minPrice").order(SortOrder.DESC));
        } else {
            sorts.add(SortBuilders.fieldSort("hotScore").order(SortOrder.DESC));
            sorts.add(SortBuilders.fieldSort("startTime").order(SortOrder.ASC));
        }
        return sorts;
    }

    private ActivityVO toActivityVo(ActivitySearchDocument document) {
        ActivityVO vo = new ActivityVO();
        vo.setItemType(document.getItemType());
        vo.setId("tour".equals(document.getItemType()) ? document.getTourId() : document.getActivityId());
        vo.setName(document.getActivityName());
        vo.setArtistName(document.getArtistName());
        vo.setCategoryName(document.getCategoryName());
        vo.setVenueCity(document.getCity());
        vo.setStartTime(parseDateTime(document.getStartTime()));
        vo.setMinPrice(document.getMinPrice());
        vo.setSeatMapVisibility(document.getSeatMapVisibility());
        vo.setRealNameRequired(document.getRealNameRequired());
        vo.setTicketTransferAllowed(document.getTicketTransferAllowed());
        vo.setStatus(toActivityStatus(document.getSaleStatus()));
        return vo;
    }

    private Integer toActivityStatus(String saleStatus) {
        if ("on_sale".equals(saleStatus)) return 1;
        if ("coming_soon".equals(saleStatus)) return 2;
        if ("sold_out".equals(saleStatus)) return 3;
        return null;
    }

    private LocalDateTime parseDateTime(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return LocalDateTime.parse(value);
    }
}
