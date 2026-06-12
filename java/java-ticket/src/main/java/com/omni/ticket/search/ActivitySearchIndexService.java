package com.omni.ticket.search;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.ActivityArtistDto;
import com.omni.ticket.dto.ActivityDetailVO;
import com.omni.ticket.dto.ActivityVO;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Category;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.entity.Venue;
import com.omni.ticket.service.ActivityService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.IndexOperations;
import org.springframework.data.elasticsearch.core.document.Document;
import org.springframework.data.elasticsearch.core.index.AliasAction;
import org.springframework.data.elasticsearch.core.index.AliasActionParameters;
import org.springframework.data.elasticsearch.core.index.AliasActions;
import org.springframework.data.elasticsearch.core.index.AliasData;
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ActivitySearchIndexService {

    private static final int REBUILD_PAGE_SIZE = 100;
    private static final String MAPPING_RESOURCE = "search/omni_activity_v1_mapping.json";
    private static final DateTimeFormatter INDEX_SUFFIX_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS");

    private final ActivitySearchProvider dbProvider;
    private final DbActivitySearchProvider.ActivityPageSource rebuildPageSource;
    private final ActivityService activityService;
    private final ElasticsearchOperations operations;
    private final ActivitySearchDocumentBuilder documentBuilder;
    private final ActivitySearchProperties properties;

    @Autowired
    public ActivitySearchIndexService(ActivityService activityService,
                                      ElasticsearchOperations operations,
                                      ActivitySearchDocumentBuilder documentBuilder,
                                      ActivitySearchProperties properties) {
        this(new DbActivitySearchProvider(activityService::listActivities),
                activityService::listActivities,
                activityService,
                operations,
                documentBuilder,
                properties);
    }

    public ActivitySearchIndexService(ActivitySearchProvider dbProvider,
                                      ElasticsearchOperations operations,
                                      ActivitySearchDocumentBuilder documentBuilder,
                                      ActivitySearchProperties properties) {
        this(dbProvider, null, null, operations, documentBuilder, properties);
    }

    public ActivitySearchIndexService(ActivitySearchProvider dbProvider,
                                      DbActivitySearchProvider.ActivityPageSource rebuildPageSource,
                                      ElasticsearchOperations operations,
                                      ActivitySearchDocumentBuilder documentBuilder,
                                      ActivitySearchProperties properties) {
        this(dbProvider, rebuildPageSource, null, operations, documentBuilder, properties);
    }

    public ActivitySearchIndexService(ActivitySearchProvider dbProvider,
                                      ActivityService activityService,
                                      ElasticsearchOperations operations,
                                      ActivitySearchDocumentBuilder documentBuilder,
                                      ActivitySearchProperties properties) {
        this(dbProvider, null, activityService, operations, documentBuilder, properties);
    }

    public ActivitySearchIndexService(ActivitySearchProvider dbProvider,
                                      DbActivitySearchProvider.ActivityPageSource rebuildPageSource,
                                      ActivityService activityService,
                                      ElasticsearchOperations operations,
                                      ActivitySearchDocumentBuilder documentBuilder,
                                      ActivitySearchProperties properties) {
        this.dbProvider = dbProvider;
        this.rebuildPageSource = rebuildPageSource;
        this.activityService = activityService;
        this.operations = operations;
        this.documentBuilder = documentBuilder;
        this.properties = properties == null ? new ActivitySearchProperties() : properties;
    }

    public ActivitySearchRebuildResult rebuildAll() {
        LocalDateTime startedAt = LocalDateTime.now();
        String indexName = resolveRebuildIndexName(startedAt);
        String aliasName = resolveAliasName();
        IndexCoordinates indexCoordinates = IndexCoordinates.of(indexName);
        IndexOperations indexOperations = operations.indexOps(indexCoordinates);

        if (!indexOperations.create(Collections.emptyMap(), loadMapping())) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "搜索索引创建失败");
        }

        long indexedCount = 0;
        int pageNumber = 1;
        while (true) {
            Page<ActivityVO> page = loadRebuildPage(pageNumber);
            List<ActivityVO> records = page == null || page.getRecords() == null
                    ? Collections.emptyList()
                    : page.getRecords();
            if (records.isEmpty()) {
                break;
            }
            for (ActivityVO activity : records) {
                operations.save(documentBuilder.fromActivityVo(activity), indexCoordinates);
                indexedCount++;
            }
            if (records.size() < REBUILD_PAGE_SIZE) {
                break;
            }
            pageNumber++;
        }

        indexOperations.refresh();
        switchAlias(indexOperations, aliasName, indexName);

        ActivitySearchRebuildResult result = new ActivitySearchRebuildResult();
        result.setIndexedCount(indexedCount);
        result.setIndexName(indexName);
        result.setAliasName(aliasName);
        result.setStartedAt(startedAt);
        result.setFinishedAt(LocalDateTime.now());
        return result;
    }

    private Page<ActivityVO> loadRebuildPage(int pageNumber) {
        if (rebuildPageSource != null) {
            return rebuildPageSource.listActivities(pageNumber, REBUILD_PAGE_SIZE, null);
        }
        return dbProvider.search(ActivitySearchRequest.builder()
                .page(pageNumber)
                .size(REBUILD_PAGE_SIZE)
                .build());
    }

    public void upsertActivity(Long activityId) {
        if (activityId == null || activityId <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "活动ID不正确");
        }
        if (activityService == null) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "活动搜索索引单条重建未配置活动服务");
        }
        ActivityDetailVO detail;
        try {
            detail = activityService.getActivityDetail(activityId);
        } catch (BusinessException e) {
            if (e.getCode() == ResultCode.NOT_FOUND.getCode()) {
                deleteActivity(activityId);
                return;
            }
            throw e;
        }
        operations.save(documentBuilder.fromActivityVo(toSearchVo(detail)), aliasCoordinates());
    }

    public void deleteActivity(Long activityId) {
        if (activityId == null || activityId <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "活动ID不正确");
        }
        operations.delete(activityDocumentId(activityId), aliasCoordinates());
    }

    private String activityDocumentId(Long activityId) {
        return "activity:" + activityId;
    }

    private ActivityVO toSearchVo(ActivityDetailVO detail) {
        if (detail == null || detail.getActivity() == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "活动不存在");
        }
        Activity activity = detail.getActivity();
        ActivityVO vo = new ActivityVO();
        vo.setId(activity.getId());
        vo.setItemType("activity");
        vo.setName(activity.getName());
        vo.setPoster(activity.getPoster());
        vo.setSeatMapVisibility(activity.getSeatMapVisibility());
        vo.setRealNameRequired(Boolean.TRUE.equals(activity.getRealNameRequired()));
        vo.setTicketTransferAllowed(!Boolean.FALSE.equals(activity.getTicketTransferAllowed()));
        vo.setStatus(activity.getStatus());
        Category category = detail.getCategory();
        if (category != null) {
            vo.setCategoryName(category.getName());
        }
        vo.setArtists(detail.getArtists());
        vo.setArtistName(resolveArtistName(detail));
        List<ActivityDetailVO.SessionDetail> sessions = detail.getSessions() == null
                ? Collections.emptyList()
                : detail.getSessions();
        sessions.stream()
                .filter(Objects::nonNull)
                .map(ActivityDetailVO.SessionDetail::getSession)
                .filter(Objects::nonNull)
                .map(Session::getStartTime)
                .filter(Objects::nonNull)
                .min(LocalDateTime::compareTo)
                .ifPresent(vo::setStartTime);
        sessions.stream()
                .filter(Objects::nonNull)
                .map(ActivityDetailVO.SessionDetail::getVenue)
                .filter(Objects::nonNull)
                .map(Venue::getCity)
                .filter(StringUtils::hasText)
                .findFirst()
                .ifPresent(vo::setVenueCity);
        vo.setMinPrice(resolveMinPrice(sessions));
        return vo;
    }

    private String resolveArtistName(ActivityDetailVO detail) {
        List<ActivityArtistDto> artists = detail.getArtists();
        if (artists != null && !artists.isEmpty()) {
            String names = artists.stream()
                    .map(ActivityArtistDto::getName)
                    .filter(StringUtils::hasText)
                    .collect(Collectors.joining("、"));
            if (StringUtils.hasText(names)) {
                return names;
            }
        }
        if (detail.getArtist() != null) {
            return detail.getArtist().getName();
        }
        return null;
    }

    private BigDecimal resolveMinPrice(List<ActivityDetailVO.SessionDetail> sessions) {
        return sessions.stream()
                .filter(Objects::nonNull)
                .flatMap(session -> {
                    List<TicketType> ticketTypes = session.getTicketTypes() == null
                            ? Collections.emptyList()
                            : session.getTicketTypes();
                    return ticketTypes.stream();
                })
                .filter(Objects::nonNull)
                .map(TicketType::getPrice)
                .filter(Objects::nonNull)
                .min(BigDecimal::compareTo)
                .orElse(null);
    }

    private IndexCoordinates aliasCoordinates() {
        return IndexCoordinates.of(resolveAliasName());
    }

    private String resolveIndexName() {
        if (StringUtils.hasText(properties.getIndexName())) {
            return properties.getIndexName().trim();
        }
        return "omni_activity_v1";
    }

    private String resolveRebuildIndexName(LocalDateTime startedAt) {
        return resolveIndexName()
                + "_"
                + INDEX_SUFFIX_FORMATTER.format(startedAt)
                + "_"
                + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    }

    private String resolveAliasName() {
        if (StringUtils.hasText(properties.getAliasName())) {
            return properties.getAliasName().trim();
        }
        return "omni_activity_current";
    }

    private Document loadMapping() {
        try (InputStream inputStream = Thread.currentThread().getContextClassLoader()
                .getResourceAsStream(MAPPING_RESOURCE)) {
            if (inputStream == null) {
                throw new BusinessException(ResultCode.INTERNAL_ERROR, "搜索索引映射文件缺失");
            }
            String json = new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
            Document root = Document.parse(json);
            Object mappings = root.get("mappings");
            if (mappings instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> mapping = (Map<String, Object>) mappings;
                return Document.from(mapping);
            }
            return root;
        } catch (IOException e) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "搜索索引映射文件读取失败");
        }
    }

    private void switchAlias(IndexOperations indexOperations, String aliasName, String indexName) {
        List<AliasAction> actions = new ArrayList<>();
        Map<String, Set<AliasData>> existingAliases = indexOperations.getAliases(aliasName);
        if (existingAliases != null) {
            existingAliases.keySet().forEach(existingIndex -> actions.add(new AliasAction.Remove(
                    AliasActionParameters.builder()
                            .withIndices(existingIndex)
                            .withAliases(aliasName)
                            .build())));
        }
        actions.add(new AliasAction.Add(AliasActionParameters.builder()
                .withIndices(indexName)
                .withAliases(aliasName)
                .build()));
        boolean switched = indexOperations.alias(new AliasActions(actions.toArray(new AliasAction[0])));
        if (!switched) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "搜索索引别名切换失败");
        }
    }
}
