package com.omni.ticket.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.ActivityDetailVO;
import com.omni.ticket.dto.ActivityVO;
import com.omni.ticket.entity.*;
import com.omni.ticket.mapper.*;
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
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * C端活动浏览 - Service层搜索与详情测试
 * 覆盖 AB-001 ~ AB-020 的 Service 层逻辑
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("活动搜索与详情 - ActivityService")
class ActivityServiceSearchTest {

    @Mock ActivityMapper activityMapper;
    @Mock CategoryMapper categoryMapper;
    @Mock ArtistMapper artistMapper;
    @Mock SessionMapper sessionMapper;
    @Mock VenueMapper venueMapper;
    @Mock TicketTypeMapper ticketTypeMapper;
    @Mock TourMapper tourMapper;
    @Mock StationMapper stationMapper;

    @BeforeAll
    static void ensureJwtSecret() {
        if (System.getenv("JWT_SECRET") == null || System.getenv("JWT_SECRET").isBlank()) {
            System.setProperty("JWT_SECRET", "test-jwt-secret-must-be-at-least-32-bytes");
        }
    }

    /**
     * 快捷调用: 13个参数一次性传入
     */
    private Page<ActivityVO> search(Integer page, Integer size, Long categoryId, String keyword,
                                     String city, LocalDate dateFrom, LocalDate dateTo,
                                     BigDecimal minPrice, BigDecimal maxPrice, String saleStatus,
                                     Boolean seatMapOnly, Boolean realNameRequired, String sort) {
        return service().searchActivities(page, size, categoryId, keyword, city,
                dateFrom, dateTo, minPrice, maxPrice, saleStatus, seatMapOnly, realNameRequired, sort);
    }

    @Nested
    @DisplayName("搜索过滤逻辑")
    class SearchFilterTests {

        @Test
        @DisplayName("AB-003: 按关键词匹配活动名")
        void searchByKeywordMatchesName() {
            Activity activity = activity(1L, "周杰伦世界巡回演唱会", 1001L, "published");
            Page<Activity> page = pageOf(activity);
            when(activityMapper.selectPage(any(), any())).thenReturn(page);
            when(sessionMapper.selectList(any())).thenReturn(Collections.emptyList());

            Page<ActivityVO> result = search(1, 10, null, "周杰伦", null, null, null, null, null, null, null, null, null);

            assertEquals(1, result.getRecords().size());
            assertEquals("周杰伦世界巡回演唱会", result.getRecords().get(0).getName());
        }

        @Test
        @DisplayName("AB-003: 关键词不匹配返回空")
        void searchByKeywordNoMatch() {
            Activity activity = activity(1L, "摇滚音乐节", 1001L, "published");
            Page<Activity> page = pageOf(activity);
            when(activityMapper.selectPage(any(), any())).thenReturn(page);
            when(sessionMapper.selectList(any())).thenReturn(Collections.emptyList());

            Page<ActivityVO> result = search(1, 10, null, "不存在的关键词XYZ", null, null, null, null, null, null, null, null, null);

            assertEquals(0, result.getRecords().size());
        }

        @Test
        @DisplayName("AB-004: 按城市过滤 - 不匹配则排除")
        void searchByCityNoMatch() {
            Activity activity = activity(1L, "北京演出", 1001L, "published");
            Page<Activity> page = pageOf(activity);
            when(activityMapper.selectPage(any(), any())).thenReturn(page);
            Session session = session(1L, 1L, 101L);
            when(sessionMapper.selectList(any())).thenReturn(List.of(session));
            Venue venue = venue(101L, "北京");
            when(venueMapper.selectBatchIds(any())).thenReturn(List.of(venue));

            Page<ActivityVO> result = search(1, 10, null, null, "上海", null, null, null, null, null, null, null, null);

            assertEquals(0, result.getRecords().size());
        }

        @Test
        @DisplayName("AB-006: 价格在范围内 - 匹配")
        void searchByPriceRangeMatch() {
            Activity activity = activity(1L, "中价位演出", 1001L, "published");
            Page<Activity> page = pageOf(activity);
            when(activityMapper.selectPage(any(), any())).thenReturn(page);
            Session session = session(1L, 1L, 101L);
            when(sessionMapper.selectList(any())).thenReturn(List.of(session));
            Venue venue = venue(101L, "上海");
            when(venueMapper.selectBatchIds(any())).thenReturn(List.of(venue));
            TicketType ticketType = ticketType(10L, 1L, new BigDecimal("299.00"), 1);
            when(ticketTypeMapper.selectList(any())).thenReturn(List.of(ticketType));

            Page<ActivityVO> result = search(1, 10, null, null, null, null, null, new BigDecimal("100"), new BigDecimal("500"), null, null, null, null);

            assertEquals(1, result.getRecords().size());
        }

        @Test
        @DisplayName("AB-006: 价格超出范围 - 不匹配")
        void searchByPriceRangeNoMatch() {
            Activity activity = activity(1L, "高价演出", 1001L, "published");
            Page<Activity> page = pageOf(activity);
            when(activityMapper.selectPage(any(), any())).thenReturn(page);
            Session session = session(1L, 1L, 101L);
            when(sessionMapper.selectList(any())).thenReturn(List.of(session));
            Venue venue = venue(101L, "上海");
            when(venueMapper.selectBatchIds(any())).thenReturn(List.of(venue));
            TicketType ticketType = ticketType(10L, 1L, new BigDecimal("999.00"), 1);
            when(ticketTypeMapper.selectList(any())).thenReturn(List.of(ticketType));

            Page<ActivityVO> result = search(1, 10, null, null, null, null, null, new BigDecimal("100"), new BigDecimal("500"), null, null, null, null);

            assertEquals(0, result.getRecords().size());
        }

        @Test
        @DisplayName("AB-008: seatMapOnly过滤 - 有座位图保留")
        void searchSeatMapOnlyMatch() {
            Activity activity = activity(1L, "有座位图", 1001L, "published");
            activity.setSeatMapVisibility("published");
            Page<Activity> page = pageOf(activity);
            when(activityMapper.selectPage(any(), any())).thenReturn(page);
            Session session = session(1L, 1L, 101L);
            when(sessionMapper.selectList(any())).thenReturn(List.of(session));
            Venue venue = venue(101L, "北京");
            when(venueMapper.selectBatchIds(any())).thenReturn(List.of(venue));
            TicketType ticketType = ticketType(10L, 1L, new BigDecimal("199"), 1);
            when(ticketTypeMapper.selectList(any())).thenReturn(List.of(ticketType));

            Page<ActivityVO> result = search(1, 10, null, null, null, null, null, null, null, null, true, null, null);

            assertEquals(1, result.getRecords().size());
        }

        @Test
        @DisplayName("AB-008: seatMapOnly过滤 - 隐藏座位图排除")
        void searchSeatMapOnlyExcludeHidden() {
            Activity activity = activity(1L, "隐藏座位图", 1001L, "published");
            activity.setSeatMapVisibility("hidden");
            Page<Activity> page = pageOf(activity);
            when(activityMapper.selectPage(any(), any())).thenReturn(page);
            Session session = session(1L, 1L, 101L);
            when(sessionMapper.selectList(any())).thenReturn(List.of(session));
            Venue venue = venue(101L, "北京");
            when(venueMapper.selectBatchIds(any())).thenReturn(List.of(venue));
            TicketType ticketType = ticketType(10L, 1L, new BigDecimal("199"), 1);
            when(ticketTypeMapper.selectList(any())).thenReturn(List.of(ticketType));

            Page<ActivityVO> result = search(1, 10, null, null, null, null, null, null, null, null, true, null, null);

            assertEquals(0, result.getRecords().size());
        }

        @Test
        @DisplayName("AB-009: realNameRequired过滤")
        void searchRealNameRequiredFilter() {
            Activity a1 = activity(1L, "实名活动", 1001L, "published");
            a1.setRealNameRequired(true);
            Activity a2 = activity(2L, "非实名活动", 1002L, "published");
            a2.setRealNameRequired(false);
            Page<Activity> page = new Page<>(1, 10, 2);
            page.setRecords(List.of(a1, a2));
            when(activityMapper.selectPage(any(), any())).thenReturn(page);
            Session s1 = session(1L, 1L, 101L);
            Session s2 = session(2L, 2L, 101L);
            when(sessionMapper.selectList(any())).thenReturn(List.of(s1, s2));
            Venue venue = venue(101L, "北京");
            when(venueMapper.selectBatchIds(any())).thenReturn(List.of(venue));
            TicketType tt1 = ticketType(10L, 1L, new BigDecimal("199"), 1);
            TicketType tt2 = ticketType(11L, 2L, new BigDecimal("299"), 1);
            when(ticketTypeMapper.selectList(any())).thenReturn(List.of(tt1, tt2));

            Page<ActivityVO> result = search(1, 10, null, null, null, null, null, null, null, null, null, true, null);

            assertEquals(1, result.getRecords().size());
            assertTrue(result.getRecords().get(0).getRealNameRequired());
        }

        @Test
        @DisplayName("AB-007: 售卖状态过滤")
        void searchSaleStatusOnSale() {
            Activity activity = activity(1L, "在售", 1001L, "published");
            activity.setStatus(1);
            Page<Activity> page = pageOf(activity);
            when(activityMapper.selectPage(any(), any())).thenReturn(page);
            Session session = session(1L, 1L, 101L);
            when(sessionMapper.selectList(any())).thenReturn(List.of(session));
            Venue venue = venue(101L, "北京");
            when(venueMapper.selectBatchIds(any())).thenReturn(List.of(venue));
            TicketType ticketType = ticketType(10L, 1L, new BigDecimal("199"), 1);
            when(ticketTypeMapper.selectList(any())).thenReturn(List.of(ticketType));

            Page<ActivityVO> result = search(1, 10, null, null, null, null, null, null, null, "on_sale", null, null, null);

            assertEquals(1, result.getRecords().size());
        }

        @Test
        @DisplayName("AB-011: 排序 - newest按ID倒序")
        void searchSortNewest() {
            Activity a1 = activity(10L, "旧活动", 1001L, "published");
            Activity a2 = activity(20L, "新活动", 1001L, "published");
            Page<Activity> page = new Page<>(1, 10, 2);
            page.setRecords(List.of(a1, a2));
            when(activityMapper.selectPage(any(), any())).thenReturn(page);
            Session s1 = session(1L, 10L, 101L);
            Session s2 = session(2L, 20L, 101L);
            when(sessionMapper.selectList(any())).thenReturn(List.of(s1, s2));
            Venue venue = venue(101L, "北京");
            when(venueMapper.selectBatchIds(any())).thenReturn(List.of(venue));
            TicketType tt1 = ticketType(10L, 1L, new BigDecimal("199"), 1);
            TicketType tt2 = ticketType(11L, 2L, new BigDecimal("299"), 1);
            when(ticketTypeMapper.selectList(any())).thenReturn(List.of(tt1, tt2));

            Page<ActivityVO> result = search(1, 10, null, null, null, null, null, null, null, null, null, null, "newest");

            assertEquals(2, result.getRecords().size());
            assertEquals(20L, result.getRecords().get(0).getId());
            assertEquals(10L, result.getRecords().get(1).getId());
        }

        @Test
        @DisplayName("AB-012: 多条件组合")
        void searchMultipleFilters() {
            Activity activity = activity(1L, "周杰伦北京演唱会", 1001L, "published");
            Page<Activity> page = pageOf(activity);
            when(activityMapper.selectPage(any(), any())).thenReturn(page);
            Session session = session(1L, 1L, 101L);
            when(sessionMapper.selectList(any())).thenReturn(List.of(session));
            Venue venue = venue(101L, "北京");
            when(venueMapper.selectBatchIds(any())).thenReturn(List.of(venue));
            TicketType ticketType = ticketType(10L, 1L, new BigDecimal("299"), 1);
            when(ticketTypeMapper.selectList(any())).thenReturn(List.of(ticketType));

            Page<ActivityVO> result = search(1, 10, null, "周杰伦", "北京", null, null, new BigDecimal("100"), new BigDecimal("500"), "on_sale", null, null, "newest");

            assertEquals(1, result.getRecords().size());
        }
    }

    @Nested
    @DisplayName("活动详情")
    class ActivityDetailTests {

        @Test
        @DisplayName("AB-016: 获取已发布活动详情")
        void getActivityDetailPublished() {
            Activity activity = activity(10L, "测试活动", 1001L, "published");
            when(activityMapper.selectById(10L)).thenReturn(activity);
            when(sessionMapper.selectList(any())).thenReturn(Collections.emptyList());
            when(categoryMapper.selectById(1001L)).thenReturn(category(1001L, "演唱会"));

            ActivityService service = service();
            ActivityDetailVO detail = service.getActivityDetail(10L);

            assertNotNull(detail);
            assertNotNull(detail.getActivity());
            assertEquals(10L, detail.getActivity().getId());
            assertEquals("测试活动", detail.getActivity().getName());
            assertEquals("published", detail.getActivity().getPublishStatus());
        }

        @Test
        @DisplayName("AB-018: 草稿活动抛出异常")
        void getActivityDetailDraftException() {
            Activity activity = activity(10L, "草稿活动", 1001L, "draft");
            when(activityMapper.selectById(10L)).thenReturn(activity);

            ActivityService service = service();
            assertThrows(BusinessException.class, () -> service.getActivityDetail(10L));
        }

        @Test
        @DisplayName("AB-019: 下架活动抛出异常")
        void getActivityDetailDeactivatedException() {
            Activity activity = activity(10L, "下架活动", 1001L, "deactivated");
            when(activityMapper.selectById(10L)).thenReturn(activity);

            ActivityService service = service();
            assertThrows(BusinessException.class, () -> service.getActivityDetail(10L));
        }

        @Test
        @DisplayName("AB-020: 不存在活动抛出异常")
        void getActivityDetailNotFound() {
            when(activityMapper.selectById(999999L)).thenReturn(null);

            ActivityService service = service();
            assertThrows(BusinessException.class, () -> service.getActivityDetail(999999L));
        }
    }

    @Nested
    @DisplayName("分类列表")
    class CategoryListTests {

        @Test
        @DisplayName("AB-021: 获取分类列表")
        void listCategories() {
            when(categoryMapper.selectList(any())).thenReturn(List.of(
                    category(1001L, "演唱会"), category(1002L, "话剧")));

            ActivityService service = service();
            List<Category> result = service.listCategories();

            assertEquals(2, result.size());
        }
    }

    @Nested
    @DisplayName("边界与异常")
    class BoundaryTests {

        @Test
        @DisplayName("AB-013: page=0 自动修正为1")
        void searchPageZeroAutoFix() {
            Activity activity = activity(1L, "测试", 1001L, "published");
            Page<Activity> page = pageOf(activity);
            when(activityMapper.selectPage(any(), any())).thenReturn(page);
            when(sessionMapper.selectList(any())).thenReturn(Collections.emptyList());

            Page<ActivityVO> result = search(0, 10, null, null, null, null, null, null, null, null, null, null, null);

            assertNotNull(result);
        }

        @Test
        @DisplayName("AB-013: page超大返回空列表")
        void searchPageVeryLarge() {
            Activity activity = activity(1L, "测试", 1001L, "published");
            Page<Activity> page = pageOf(activity);
            when(activityMapper.selectPage(any(), any())).thenReturn(page);
            when(sessionMapper.selectList(any())).thenReturn(List.of());
            when(categoryMapper.selectBatchIds(any())).thenReturn(Collections.emptyList());

            Page<ActivityVO> result = search(99999, 10, null, null, null, null, null, null, null, null, null, null, null);

            assertTrue(result.getRecords().isEmpty());
        }

        @Test
        @DisplayName("AB-005: 日期范围from之后无匹配")
        void searchDateFromAfterActivity() {
            Activity activity = activity(1L, "早期活动", 1001L, "published");
            Page<Activity> page = pageOf(activity);
            when(activityMapper.selectPage(any(), any())).thenReturn(page);
            Session session = session(1L, 1L, 101L);
            session.setStartTime(LocalDateTime.of(2026, 6, 1, 19, 30));
            when(sessionMapper.selectList(any())).thenReturn(List.of(session));
            Venue venue = venue(101L, "北京");
            when(venueMapper.selectBatchIds(any())).thenReturn(List.of(venue));
            TicketType ticketType = ticketType(10L, 1L, new BigDecimal("199"), 1);
            when(ticketTypeMapper.selectList(any())).thenReturn(List.of(ticketType));

            Page<ActivityVO> result = search(1, 10, null, null, null, LocalDate.of(2026, 7, 1), null, null, null, null, null, null, null);

            assertEquals(0, result.getRecords().size());
        }

        @Test
        @DisplayName("AB-005: 日期to之前无匹配")
        void searchDateToBeforeActivity() {
            Activity activity = activity(1L, "后期活动", 1001L, "published");
            Page<Activity> page = pageOf(activity);
            when(activityMapper.selectPage(any(), any())).thenReturn(page);
            Session session = session(1L, 1L, 101L);
            session.setStartTime(LocalDateTime.of(2026, 12, 1, 19, 30));
            when(sessionMapper.selectList(any())).thenReturn(List.of(session));
            Venue venue = venue(101L, "北京");
            when(venueMapper.selectBatchIds(any())).thenReturn(List.of(venue));
            TicketType ticketType = ticketType(10L, 1L, new BigDecimal("199"), 1);
            when(ticketTypeMapper.selectList(any())).thenReturn(List.of(ticketType));

            Page<ActivityVO> result = search(1, 10, null, null, null, null, LocalDate.of(2026, 11, 30), null, null, null, null, null, null);

            assertEquals(0, result.getRecords().size());
        }

        @Test
        @DisplayName("AB-014: 空结果total=0")
        void searchNoActivities() {
            Page<Activity> page = new Page<>(1, 10, 0);
            page.setRecords(Collections.emptyList());
            when(activityMapper.selectPage(any(), any())).thenReturn(page);

            Page<ActivityVO> result = search(1, 10, null, null, null, null, null, null, null, null, null, null, null);

            assertEquals(0, result.getTotal());
            assertTrue(result.getRecords().isEmpty());
        }
    }

    // ======================== 测试辅助 ========================

    private ActivityService service() {
        return new ActivityService(activityMapper, categoryMapper, artistMapper,
                sessionMapper, venueMapper, ticketTypeMapper, null, tourMapper, stationMapper);
    }

    private static Page<Activity> pageOf(Activity activity) {
        Page<Activity> page = new Page<>(1, 10, 1);
        page.setRecords(List.of(activity));
        return page;
    }

    private Activity activity(Long id, String name, Long categoryId, String publishStatus) {
        Activity a = new Activity();
        a.setId(id);
        a.setName(name);
        a.setCategoryId(categoryId);
        a.setPublishStatus(publishStatus);
        a.setStatus(1);
        return a;
    }

    private Session session(Long id, Long activityId, Long venueId) {
        Session s = new Session();
        s.setId(id);
        s.setActivityId(activityId);
        s.setVenueId(venueId);
        s.setStartTime(LocalDateTime.of(2026, 7, 15, 19, 30));
        s.setStatus(1);
        return s;
    }

    private Venue venue(Long id, String city) {
        Venue v = new Venue();
        v.setId(id);
        v.setCity(city);
        v.setStatus(1);
        return v;
    }

    private TicketType ticketType(Long id, Long sessionId, BigDecimal price, Integer status) {
        TicketType tt = new TicketType();
        tt.setId(id);
        tt.setSessionId(sessionId);
        tt.setPrice(price);
        tt.setStatus(status);
        return tt;
    }

    private Category category(Long id, String name) {
        Category c = new Category();
        c.setId(id);
        c.setName(name);
        return c;
    }
}
