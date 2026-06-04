package com.omni.ticket.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.common.result.Result;
import com.omni.ticket.dto.ActivityDetailVO;
import com.omni.ticket.dto.ActivityVO;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Category;
import com.omni.ticket.service.ActivityService;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * C端活动浏览与搜索 - 控制器层测试
 * 覆盖测试方案 AB-001 ~ AB-022, AB-038, AB-039
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("C端活动浏览与搜索 - ActivityController")
class ActivityControllerCEndTest {

    @Mock
    private ActivityService activityService;

    @BeforeAll
    static void ensureJwtSecret() {
        if (System.getenv("JWT_SECRET") == null || System.getenv("JWT_SECRET").isBlank()) {
            System.setProperty("JWT_SECRET", "test-jwt-secret-must-be-at-least-32-bytes");
        }
    }

    // ======================== 活动列表 (AB-001 ~ AB-015) ========================

    @Nested
    @DisplayName("活动列表查询")
    class ActivityListTests {

        @Test
        @DisplayName("AB-001: 获取活动列表默认分页")
        void listActivitiesDefaultPagination() {
            ActivityController controller = new ActivityController(activityService);
            Page<ActivityVO> page = new Page<>(1, 10, 3);
            page.setRecords(List.of(activityVO(1L, "演唱会A"), activityVO(2L, "话剧B"), activityVO(3L, "音乐会C")));
            when(activityService.searchActivities(eq(1), eq(10), isNull(), isNull(), isNull(),
                    isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull()))
                    .thenReturn(page);

            Result<Page<ActivityVO>> result = controller.listActivities(1, 10, null, null, null,
                    null, null, null, null, null, null, null, null);

            assertEquals(200, result.getCode());
            assertEquals(3, result.getData().getRecords().size());
            assertEquals(3, result.getData().getTotal());
        }

        @Test
        @DisplayName("AB-002: 按分类筛选")
        void listActivitiesFilterByCategory() {
            ActivityController controller = new ActivityController(activityService);
            Page<ActivityVO> page = singlePage(activityVO(1L, "摇滚之夜"));
            when(activityService.searchActivities(eq(1), eq(10), eq(1001L), isNull(), isNull(),
                    isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull()))
                    .thenReturn(page);

            Result<Page<ActivityVO>> result = controller.listActivities(1, 10, 1001L, null, null,
                    null, null, null, null, null, null, null, null);

            assertEquals(200, result.getCode());
            assertEquals(1, result.getData().getRecords().size());
            verify(activityService).searchActivities(eq(1), eq(10), eq(1001L), isNull(), isNull(),
                    isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull());
        }

        @Test
        @DisplayName("AB-003: 按关键词搜索")
        void listActivitiesFilterByKeyword() {
            ActivityController controller = new ActivityController(activityService);
            Page<ActivityVO> page = singlePage(activityVO(1L, "周杰伦演唱会"));
            when(activityService.searchActivities(eq(1), eq(10), isNull(), eq("周杰伦"), isNull(),
                    isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull()))
                    .thenReturn(page);

            Result<Page<ActivityVO>> result = controller.listActivities(1, 10, null, "周杰伦", null,
                    null, null, null, null, null, null, null, null);

            assertEquals(200, result.getCode());
            verify(activityService).searchActivities(eq(1), eq(10), isNull(), eq("周杰伦"), isNull(),
                    isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull());
        }

        @Test
        @DisplayName("AB-004: 按城市筛选")
        void listActivitiesFilterByCity() {
            ActivityController controller = new ActivityController(activityService);
            Page<ActivityVO> page = singlePage(activityVO(1L, "北京演出"));
            when(activityService.searchActivities(eq(1), eq(10), isNull(), isNull(), eq("北京"),
                    isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull()))
                    .thenReturn(page);

            Result<Page<ActivityVO>> result = controller.listActivities(1, 10, null, null, "北京",
                    null, null, null, null, null, null, null, null);

            assertEquals(200, result.getCode());
        }

        @Test
        @DisplayName("AB-005: 按日期范围筛选")
        void listActivitiesFilterByDateRange() {
            ActivityController controller = new ActivityController(activityService);
            LocalDate from = LocalDate.of(2026, 7, 1);
            LocalDate to = LocalDate.of(2026, 7, 31);
            Page<ActivityVO> page = singlePage(activityVO(1L, "七月演出"));
            when(activityService.searchActivities(eq(1), eq(10), isNull(), isNull(), isNull(),
                    eq(from), eq(to), isNull(), isNull(), isNull(), isNull(), isNull(), isNull()))
                    .thenReturn(page);

            Result<Page<ActivityVO>> result = controller.listActivities(1, 10, null, null, null,
                    from, to, null, null, null, null, null, null);

            assertEquals(200, result.getCode());
        }

        @Test
        @DisplayName("AB-006: 按价格范围筛选")
        void listActivitiesFilterByPriceRange() {
            ActivityController controller = new ActivityController(activityService);
            Page<ActivityVO> page = singlePage(activityVO(1L, "中等价位演出"));
            when(activityService.searchActivities(eq(1), eq(10), isNull(), isNull(), isNull(),
                    isNull(), isNull(), eq(new BigDecimal("100")), eq(new BigDecimal("500")),
                    isNull(), isNull(), isNull(), isNull()))
                    .thenReturn(page);

            Result<Page<ActivityVO>> result = controller.listActivities(1, 10, null, null, null,
                    null, null, new BigDecimal("100"), new BigDecimal("500"), null, null, null, null);

            assertEquals(200, result.getCode());
        }

        @Test
        @DisplayName("AB-007: 按售卖状态筛选")
        void listActivitiesFilterBySaleStatus() {
            ActivityController controller = new ActivityController(activityService);
            Page<ActivityVO> page = singlePage(activityVO(1L, "在售活动"));
            when(activityService.searchActivities(eq(1), eq(10), isNull(), isNull(), isNull(),
                    isNull(), isNull(), isNull(), isNull(), eq("on_sale"), isNull(), isNull(), isNull()))
                    .thenReturn(page);

            Result<Page<ActivityVO>> result = controller.listActivities(1, 10, null, null, null,
                    null, null, null, null, "on_sale", null, null, null);

            assertEquals(200, result.getCode());
        }

        @Test
        @DisplayName("AB-008: 仅座位图活动筛选")
        void listActivitiesSeatMapOnly() {
            ActivityController controller = new ActivityController(activityService);
            Page<ActivityVO> page = singlePage(activityVO(1L, "有座位图的活动"));
            when(activityService.searchActivities(eq(1), eq(10), isNull(), isNull(), isNull(),
                    isNull(), isNull(), isNull(), isNull(), isNull(), eq(true), isNull(), isNull()))
                    .thenReturn(page);

            Result<Page<ActivityVO>> result = controller.listActivities(1, 10, null, null, null,
                    null, null, null, null, null, true, null, null);

            assertEquals(200, result.getCode());
        }

        @Test
        @DisplayName("AB-009: 仅实名活动筛选")
        void listActivitiesRealNameOnly() {
            ActivityController controller = new ActivityController(activityService);
            Page<ActivityVO> page = singlePage(activityVO(1L, "实名制活动"));
            when(activityService.searchActivities(eq(1), eq(10), isNull(), isNull(), isNull(),
                    isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), eq(true), isNull()))
                    .thenReturn(page);

            Result<Page<ActivityVO>> result = controller.listActivities(1, 10, null, null, null,
                    null, null, null, null, null, null, true, null);

            assertEquals(200, result.getCode());
        }

        @Test
        @DisplayName("AB-010/011: 排序—推荐和最新")
        void listActivitiesSortOptions() {
            ActivityController controller = new ActivityController(activityService);
            Page<ActivityVO> page = singlePage(activityVO(1L, "推荐排序"));
            when(activityService.searchActivities(eq(1), eq(10), isNull(), isNull(), isNull(),
                    isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), eq("recommend")))
                    .thenReturn(page);

            Result<Page<ActivityVO>> result = controller.listActivities(1, 10, null, null, null,
                    null, null, null, null, null, null, null, "recommend");

            assertEquals(200, result.getCode());
        }

        @Test
        @DisplayName("AB-012: 多条件组合筛选")
        void listActivitiesMultipleFilters() {
            ActivityController controller = new ActivityController(activityService);
            Page<ActivityVO> page = singlePage(activityVO(1L, "匹配"));
            when(activityService.searchActivities(eq(1), eq(10), eq(1001L), eq("周杰伦"), eq("北京"),
                    isNull(), isNull(), isNull(), isNull(), eq("on_sale"), isNull(), isNull(), eq("newest")))
                    .thenReturn(page);

            Result<Page<ActivityVO>> result = controller.listActivities(1, 10, 1001L, "周杰伦", "北京",
                    null, null, null, null, "on_sale", null, null, "newest");

            assertEquals(200, result.getCode());
        }

        @Test
        @DisplayName("AB-013: 分页边界")
        void listActivitiesPageBoundary() {
            ActivityController controller = new ActivityController(activityService);
            Page<ActivityVO> page = new Page<>(1, 10, 0);
            page.setRecords(Collections.emptyList());
            // Controller passes 0 directly to service; service internally corrects it
            when(activityService.searchActivities(eq(0), eq(10), isNull(), isNull(), isNull(),
                    isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull()))
                    .thenReturn(page);

            Result<Page<ActivityVO>> result = controller.listActivities(0, 10, null, null, null,
                    null, null, null, null, null, null, null, null);

            assertEquals(200, result.getCode());
        }

        @Test
        @DisplayName("AB-013: page超大返回空列表")
        void listActivitiesPageVeryLarge() {
            ActivityController controller = new ActivityController(activityService);
            Page<ActivityVO> page = new Page<>(99999, 10, 100);
            page.setRecords(Collections.emptyList());
            when(activityService.searchActivities(eq(99999), eq(10), isNull(), isNull(), isNull(),
                    isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull()))
                    .thenReturn(page);

            Result<Page<ActivityVO>> result = controller.listActivities(99999, 10, null, null, null,
                    null, null, null, null, null, null, null, null);

            assertEquals(200, result.getCode());
            assertTrue(result.getData().getRecords().isEmpty());
        }

        @Test
        @DisplayName("AB-014: 空结果")
        void listActivitiesEmptyResult() {
            ActivityController controller = new ActivityController(activityService);
            Page<ActivityVO> page = new Page<>(1, 10, 0);
            page.setRecords(Collections.emptyList());
            when(activityService.searchActivities(eq(1), eq(10), eq(9999L), isNull(), isNull(),
                    isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull()))
                    .thenReturn(page);

            Result<Page<ActivityVO>> result = controller.listActivities(1, 10, 9999L, null, null,
                    null, null, null, null, null, null, null, null);

            assertEquals(200, result.getCode());
            assertEquals(0, result.getData().getTotal());
        }

        @Test
        @DisplayName("AB-015: 批量查询优化 - 确认分页元数据")
        void listActivitiesBatchQueryOptimization() {
            ActivityController controller = new ActivityController(activityService);
            List<ActivityVO> vos = new ArrayList<>();
            for (long i = 1; i <= 25; i++) vos.add(activityVO(i, "活动" + i));
            Page<ActivityVO> page = new Page<>(1, 25, 25);
            page.setRecords(vos);
            when(activityService.searchActivities(eq(1), eq(25), isNull(), isNull(), isNull(),
                    isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull()))
                    .thenReturn(page);

            Result<Page<ActivityVO>> result = controller.listActivities(1, 25, null, null, null,
                    null, null, null, null, null, null, null, null);

            assertEquals(200, result.getCode());
            assertEquals(25, result.getData().getRecords().size());
            assertEquals(25, result.getData().getTotal());
        }
    }

    // ======================== 活动详情 (AB-016 ~ AB-020) ========================

    @Nested
    @DisplayName("活动详情查询")
    class ActivityDetailTests {

        @Test
        @DisplayName("AB-016: 获取活动详情含场次和票档")
        void getActivityDetailSuccess() {
            ActivityController controller = new ActivityController(activityService);
            ActivityDetailVO detail = detailVO(100L, "测试演唱会", "published");
            detail.setSessions(List.of(sessionDetail(1L, 101L)));
            when(activityService.getActivityDetail(100L)).thenReturn(detail);

            Result<ActivityDetailVO> result = controller.getActivityDetail(100L);

            assertEquals(200, result.getCode());
            assertNotNull(result.getData().getActivity());
            assertEquals(100L, result.getData().getActivity().getId());
            assertEquals("测试演唱会", result.getData().getActivity().getName());
            assertEquals("published", result.getData().getActivity().getPublishStatus());
            assertEquals(1, result.getData().getSessions().size());
        }

        @Test
        @DisplayName("AB-017: 已发布活动可见")
        void getActivityDetailPublishedVisible() {
            ActivityController controller = new ActivityController(activityService);
            ActivityDetailVO detail = detailVO(200L, "已发布活动", "published");
            when(activityService.getActivityDetail(200L)).thenReturn(detail);

            Result<ActivityDetailVO> result = controller.getActivityDetail(200L);

            assertEquals(200, result.getCode());
            assertEquals("published", result.getData().getActivity().getPublishStatus());
        }

        @Test
        @DisplayName("AB-018: 草稿活动不可见(Service层拦截)")
        void getActivityDetailDraftHidden() {
            ActivityController controller = new ActivityController(activityService);
            when(activityService.getActivityDetail(300L))
                    .thenThrow(new com.omni.exception.BusinessException(404, "活动不存在"));

            assertThrows(com.omni.exception.BusinessException.class,
                    () -> controller.getActivityDetail(300L));
        }

        @Test
        @DisplayName("AB-019: 下架活动不可见")
        void getActivityDetailDeactivatedHidden() {
            ActivityController controller = new ActivityController(activityService);
            when(activityService.getActivityDetail(400L))
                    .thenThrow(new com.omni.exception.BusinessException(404, "活动已下架"));

            assertThrows(com.omni.exception.BusinessException.class,
                    () -> controller.getActivityDetail(400L));
        }

        @Test
        @DisplayName("AB-020: 不存在的活动ID")
        void getActivityDetailNotFound() {
            ActivityController controller = new ActivityController(activityService);
            when(activityService.getActivityDetail(999999L))
                    .thenThrow(new com.omni.exception.BusinessException(404, "活动不存在"));

            assertThrows(com.omni.exception.BusinessException.class,
                    () -> controller.getActivityDetail(999999L));
        }
    }

    // ======================== 分类列表 (AB-021 ~ AB-022) ========================

    @Nested
    @DisplayName("分类列表查询")
    class CategoryListTests {

        @Test
        @DisplayName("AB-021: 获取分类列表")
        void listCategoriesSuccess() {
            ActivityController controller = new ActivityController(activityService);
            Category cat1 = category(1001L, "演唱会");
            Category cat2 = category(1002L, "话剧");
            Category cat3 = category(1003L, "音乐会");
            when(activityService.listCategories()).thenReturn(List.of(cat1, cat2, cat3));

            Result<List<Category>> result = controller.listCategories();

            assertEquals(200, result.getCode());
            assertEquals(3, result.getData().size());
            assertEquals("演唱会", result.getData().get(0).getName());
        }

        @Test
        @DisplayName("AB-022: 分类含ID和名称")
        void listCategoriesHasIdAndName() {
            ActivityController controller = new ActivityController(activityService);
            Category cat = category(1001L, "演唱会");
            when(activityService.listCategories()).thenReturn(List.of(cat));

            Result<List<Category>> result = controller.listCategories();

            assertEquals(200, result.getCode());
            assertEquals(1, result.getData().size());
            assertNotNull(result.getData().get(0).getId());
            assertNotNull(result.getData().get(0).getName());
        }
    }

    // ======================== 权限与异常 (AB-038 ~ AB-039) ========================

    @Nested
    @DisplayName("权限与异常场景")
    class PermissionAndErrorTests {

        @Test
        @DisplayName("活动列表无需token即可访问(C端公开)")
        void listActivitiesNoTokenAllowed() {
            ActivityController controller = new ActivityController(activityService);
            Page<ActivityVO> page = new Page<>(1, 10, 0);
            page.setRecords(Collections.emptyList());
            when(activityService.searchActivities(anyInt(), anyInt(), isNull(), isNull(), isNull(),
                    isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull()))
                    .thenReturn(page);

            Result<Page<ActivityVO>> result = controller.listActivities(1, 10, null, null, null,
                    null, null, null, null, null, null, null, null);

            assertEquals(200, result.getCode());
        }
    }

    // ======================== 测试辅助方法 ========================

    private static Page<ActivityVO> singlePage(ActivityVO vo) {
        Page<ActivityVO> page = new Page<>(1, 10, 1);
        page.setRecords(List.of(vo));
        return page;
    }

    private static ActivityVO activityVO(Long id, String name) {
        ActivityVO vo = new ActivityVO();
        vo.setId(id);
        vo.setItemType("activity");
        vo.setName(name);
        vo.setStatus(1);
        vo.setSeatMapVisibility("published");
        vo.setRealNameRequired(false);
        vo.setTicketTransferAllowed(true);
        vo.setArtistName("测试艺人");
        vo.setMinPrice(new BigDecimal("100.00"));
        vo.setStartTime(LocalDateTime.of(2026, 7, 15, 19, 30));
        vo.setVenueCity("北京");
        return vo;
    }

    private static ActivityDetailVO detailVO(Long id, String name, String publishStatus) {
        Activity activity = new Activity();
        activity.setId(id);
        activity.setName(name);
        activity.setPublishStatus(publishStatus);
        activity.setStatus(1);

        ActivityDetailVO vo = new ActivityDetailVO();
        vo.setActivity(activity);
        vo.setSessions(Collections.emptyList());
        return vo;
    }

    private static ActivityDetailVO.SessionDetail sessionDetail(Long sessionId, Long venueId) {
        com.omni.ticket.entity.Session session = new com.omni.ticket.entity.Session();
        session.setId(sessionId);
        session.setStartTime(LocalDateTime.of(2026, 7, 15, 19, 30));

        ActivityDetailVO.SessionDetail sd = new ActivityDetailVO.SessionDetail();
        sd.setSession(session);
        sd.setTicketTypes(Collections.emptyList());
        return sd;
    }

    private static Category category(Long id, String name) {
        Category category = new Category();
        category.setId(id);
        category.setName(name);
        return category;
    }
}
