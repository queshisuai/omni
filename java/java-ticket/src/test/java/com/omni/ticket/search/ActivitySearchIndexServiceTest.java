package com.omni.ticket.search;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.ActivityDetailVO;
import com.omni.ticket.dto.ActivityVO;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Category;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.entity.Venue;
import com.omni.ticket.service.ActivityService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.IndexOperations;
import org.springframework.data.elasticsearch.core.document.Document;
import org.springframework.data.elasticsearch.core.index.AliasActions;
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ActivitySearchIndexServiceTest {

    private final ActivitySearchIndexService.RebuildPageSource pageSource = mock(ActivitySearchIndexService.RebuildPageSource.class);
    private final ElasticsearchOperations operations = mock(ElasticsearchOperations.class);
    private final IndexOperations indexOperations = mock(IndexOperations.class);
    private final ActivityService activityService = mock(ActivityService.class);
    private final ActivitySearchDocumentBuilder documentBuilder = new ActivitySearchDocumentBuilder();
    private final ActivitySearchProperties properties = new ActivitySearchProperties();
    private final ActivitySearchIndexService indexService =
            new ActivitySearchIndexService(pageSource, operations, documentBuilder, properties);

    @Test
    void rebuildCreatesIndexWritesDocumentsAndSwitchesAlias() {
        properties.setIndexName("omni_activity_v20260606");
        properties.setAliasName("omni_activity_current");
        when(operations.indexOps(any(IndexCoordinates.class))).thenReturn(indexOperations);
        when(indexOperations.create(anyMap(), any(Document.class))).thenReturn(true);
        when(indexOperations.getAliases("omni_activity_current")).thenReturn(Collections.emptyMap());
        when(indexOperations.alias(any(AliasActions.class))).thenReturn(true);
        when(pageSource.listActivities(any(), any(), any()))
                .thenReturn(pageWith(activity(900001L), activity(900002L)));

        ActivitySearchRebuildResult result = indexService.rebuildAll();

        assertEquals(2, result.getIndexedCount());
        assertTrue(result.getIndexName().startsWith("omni_activity_v20260606_"));
        assertEquals("omni_activity_current", result.getAliasName());
        assertNotNull(result.getStartedAt());
        assertNotNull(result.getFinishedAt());
        verify(indexOperations).create(anyMap(), any(Document.class));
        verify(operations, times(2)).save(any(ActivitySearchDocument.class), any(IndexCoordinates.class));
        verify(indexOperations).alias(any(AliasActions.class));
    }

    @Test
    void rebuildUsesUniquePhysicalIndexNameForRepeatedRebuilds() {
        properties.setIndexName("omni_activity_v20260606");
        when(operations.indexOps(any(IndexCoordinates.class))).thenReturn(indexOperations);
        when(indexOperations.create(anyMap(), any(Document.class))).thenReturn(true);
        when(indexOperations.getAliases("omni_activity_current")).thenReturn(Collections.emptyMap());
        when(indexOperations.alias(any(AliasActions.class))).thenReturn(true);
        when(pageSource.listActivities(any(), any(), any())).thenReturn(pageWith(activity(900001L)));

        ActivitySearchRebuildResult result = indexService.rebuildAll();

        assertTrue(result.getIndexName().startsWith("omni_activity_v20260606_"));
        assertNotEquals("omni_activity_v20260606", result.getIndexName());
    }

    @Test
    void rebuildUsesRawActivityPagesInsteadOfSearchProviderPagination() {
        ActivitySearchIndexService.RebuildPageSource rawPageSource = mock(ActivitySearchIndexService.RebuildPageSource.class);
        ActivitySearchIndexService rawPageIndexService =
                new ActivitySearchIndexService(rawPageSource, operations, documentBuilder, properties);
        when(operations.indexOps(any(IndexCoordinates.class))).thenReturn(indexOperations);
        when(indexOperations.create(anyMap(), any(Document.class))).thenReturn(true);
        when(indexOperations.getAliases("omni_activity_current")).thenReturn(Collections.emptyMap());
        when(indexOperations.alias(any(AliasActions.class))).thenReturn(true);
        when(rawPageSource.listActivities(1, 100, null)).thenReturn(pageWith(activities(900001L, 100)));
        when(rawPageSource.listActivities(2, 100, null)).thenReturn(pageWith(activities(900101L, 42)));

        ActivitySearchRebuildResult result = rawPageIndexService.rebuildAll();

        assertEquals(142, result.getIndexedCount());
        verify(rawPageSource).listActivities(1, 100, null);
        verify(rawPageSource).listActivities(2, 100, null);
    }

    @Test
    void rebuildDoesNotSwitchAliasWhenDocumentWriteFails() {
        properties.setIndexName("omni_activity_v20260606");
        when(operations.indexOps(any(IndexCoordinates.class))).thenReturn(indexOperations);
        when(indexOperations.create(anyMap(), any(Document.class))).thenReturn(true);
        when(pageSource.listActivities(any(), any(), any())).thenReturn(pageWith(activity(900001L)));
        when(operations.save(any(ActivitySearchDocument.class), any(IndexCoordinates.class)))
                .thenThrow(new RuntimeException("write failed"));

        org.junit.jupiter.api.Assertions.assertThrows(RuntimeException.class, indexService::rebuildAll);

        verify(indexOperations, never()).alias(any(AliasActions.class));
    }

    @Test
    void rebuildReadsPageSourceWithSafePaging() {
        properties.setIndexName("omni_activity_v20260606");
        when(operations.indexOps(any(IndexCoordinates.class))).thenReturn(indexOperations);
        when(indexOperations.create(anyMap(), any(Document.class))).thenReturn(true);
        when(indexOperations.getAliases("omni_activity_current")).thenReturn(Collections.emptyMap());
        when(indexOperations.alias(any(AliasActions.class))).thenReturn(true);
        when(pageSource.listActivities(any(), any(), any())).thenReturn(pageWith(activity(900001L)));

        indexService.rebuildAll();

        verify(pageSource).listActivities(1, 100, null);
    }

    @Test
    void upsertActivityWritesDocumentToAlias() {
        properties.setAliasName("omni_activity_current");
        ActivitySearchIndexService singleIndexService =
                new ActivitySearchIndexService(pageSource, activityService, operations, documentBuilder, properties);
        when(activityService.getActivityDetail(900001L)).thenReturn(activityDetail(900001L));

        singleIndexService.upsertActivity(900001L);

        ArgumentCaptor<ActivitySearchDocument> documentCaptor = ArgumentCaptor.forClass(ActivitySearchDocument.class);
        verify(operations).save(documentCaptor.capture(), any(IndexCoordinates.class));
        assertEquals("activity:900001", documentCaptor.getValue().getId());
        assertEquals(1001L, documentCaptor.getValue().getCategoryId());
        assertEquals(2002L, documentCaptor.getValue().getOrganizerId());
        assertEquals("国家体育场", documentCaptor.getValue().getVenueName());
        assertEquals("北京", documentCaptor.getValue().getCity());
        assertEquals(new BigDecimal("580"), documentCaptor.getValue().getMinPrice());
        assertEquals(new BigDecimal("1880"), documentCaptor.getValue().getMaxPrice());
    }

    @Test
    void upsertActivityDeletesDocumentWhenActivityIsNoLongerPublic() {
        properties.setAliasName("omni_activity_current");
        ActivitySearchIndexService singleIndexService =
                new ActivitySearchIndexService(pageSource, activityService, operations, documentBuilder, properties);
        when(activityService.getActivityDetail(900001L))
                .thenThrow(new BusinessException(ResultCode.NOT_FOUND, "活动不存在"));

        singleIndexService.upsertActivity(900001L);

        verify(operations).delete("activity:900001", IndexCoordinates.of("omni_activity_current"));
    }

    @Test
    void deleteActivityDeletesDocumentFromAlias() {
        properties.setAliasName("omni_activity_current");
        ActivitySearchIndexService singleIndexService =
                new ActivitySearchIndexService(pageSource, activityService, operations, documentBuilder, properties);

        singleIndexService.deleteActivity(900001L);

        verify(operations).delete("activity:900001", IndexCoordinates.of("omni_activity_current"));
    }

    private static Page<ActivityVO> pageWith(ActivityVO... activities) {
        Page<ActivityVO> page = new Page<>(1, 100, activities.length);
        page.setRecords(List.of(activities));
        return page;
    }

    private static ActivityVO[] activities(Long firstId, int count) {
        ActivityVO[] activities = new ActivityVO[count];
        for (int i = 0; i < count; i++) {
            activities[i] = activity(firstId + i);
        }
        return activities;
    }

    private static ActivityVO activity(Long id) {
        ActivityVO vo = new ActivityVO();
        vo.setId(id);
        vo.setItemType("activity");
        vo.setName("Activity " + id);
        vo.setArtistName("Artist");
        vo.setCategoryName("Concert");
        vo.setVenueCity("Beijing");
        vo.setStartTime(LocalDateTime.parse("2026-06-22T19:30:00"));
        vo.setMinPrice(new BigDecimal("580"));
        vo.setSeatMapVisibility("published");
        vo.setRealNameRequired(true);
        vo.setTicketTransferAllowed(false);
        vo.setStatus(1);
        return vo;
    }

    private static ActivityDetailVO activityDetail(Long id) {
        Activity activity = new Activity();
        activity.setId(id);
        activity.setName("Activity " + id);
        activity.setCategoryId(1001L);
        activity.setOrganizerId(2002L);
        activity.setSeatMapVisibility("published");
        activity.setRealNameRequired(true);
        activity.setTicketTransferAllowed(false);
        activity.setStatus(1);

        Category category = new Category();
        category.setId(1001L);
        category.setName("演唱会");

        Session session = new Session();
        session.setStartTime(LocalDateTime.parse("2026-06-22T19:30:00"));

        Venue venue = new Venue();
        venue.setCity("北京");
        venue.setName("国家体育场");

        TicketType ticketType = new TicketType();
        ticketType.setPrice(new BigDecimal("580"));
        TicketType vipTicketType = new TicketType();
        vipTicketType.setPrice(new BigDecimal("1880"));

        ActivityDetailVO.SessionDetail sessionDetail = new ActivityDetailVO.SessionDetail();
        sessionDetail.setSession(session);
        sessionDetail.setVenue(venue);
        sessionDetail.setTicketTypes(List.of(ticketType, vipTicketType));

        ActivityDetailVO detail = new ActivityDetailVO();
        detail.setActivity(activity);
        detail.setCategory(category);
        detail.setSessions(List.of(sessionDetail));
        return detail;
    }
}

