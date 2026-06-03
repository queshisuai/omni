package com.omni.ticket.service;

import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.common.util.JwtUtil;
import com.omni.exception.BusinessException;
import com.omni.ticket.client.OrderInternalClient;
import com.omni.ticket.controller.AdminController;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.dto.OrderInfoResponse;
import com.omni.ticket.dto.PaidOrdersBySessionsRequest;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Session;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.SessionMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * B端后台订单管理 - 完整单元测试
 * 覆盖 AO-001 ~ AO-019 (Service层 + Controller层)
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("B端后台订单管理")
class AdminOrderManagementTest {

    // ---- Service 层 Mocks ----
    @Mock UserAccessService userAccessService;
    @Mock ActivityMapper activityMapper;
    @Mock SessionMapper sessionMapper;
    @Mock OrderInternalClient orderInternalClient;

    private OrderAdminQueryService service;

    // ---- Controller 层 Mocks (复用 ActivityMapper 和 userAccessService) ----
    @Mock com.omni.ticket.mapper.ArtistMapper artistMapper;
    @Mock com.omni.ticket.mapper.TicketTypeMapper ticketTypeMapper;
    @Mock com.omni.ticket.mapper.VenueMapper venueMapper;
    @Mock ActivityAdminService activityAdminService;
    @Mock SessionAdminService sessionAdminService;
    @Mock VenueApplicationService venueApplicationService;
    @Mock com.omni.ticket.service.SeatTemplateService seatTemplateService;
    @Mock com.omni.ticket.service.TicketTypeAreaService ticketTypeAreaService;
    @Mock AdminSummaryService adminSummaryService;
    @Mock com.omni.ticket.service.SessionSeatService sessionSeatService;
    @Mock VenueDefaultLayoutService venueDefaultLayoutService;
    @Mock ActivitySeatLayoutService activitySeatLayoutService;
    @Mock SessionSeatLayoutService sessionSeatLayoutService;
    @Mock TourStationService tourStationService;
    @Mock com.omni.ticket.service.SessionSeatProtectionService sessionSeatProtectionService;
    @Mock TicketTypeStockRecalculationService stockRecalculationService;
    @Mock ActivityArtistService activityArtistService;
    @Mock com.omni.ticket.service.ArtistAdminService artistAdminService;
    @Mock ArtistGovernanceService artistGovernanceService;
    @Mock ActivityRiskResponseService activityRiskResponseService;
    @Mock TicketAssetService ticketAssetService;
    @Mock PrivateAssetService privateAssetService;
    @Mock SeatCraftLayoutVersionService seatCraftLayoutVersionService;
    @Mock ActivityDraftService activityDraftService;
    @Mock StationConfigVersionService stationConfigVersionService;
    @Mock ActivityMarketingService activityMarketingService;

    @BeforeAll
    static void ensureJwtSecret() {
        if (System.getenv("JWT_SECRET") == null || System.getenv("JWT_SECRET").isBlank()) {
            System.setProperty("JWT_SECRET", "test-jwt-secret-must-be-at-least-32-bytes");
        }
    }

    @BeforeEach
    void setUp() {
        service = new OrderAdminQueryService(userAccessService, activityMapper, sessionMapper,
                orderInternalClient, "test-token");
    }

    // ==================== 辅助方法 ====================

    private AdminController controller() {
        return new AdminController(activityMapper, artistMapper, sessionMapper, ticketTypeMapper,
                venueMapper, userAccessService, activityAdminService, sessionAdminService,
                venueApplicationService, seatTemplateService, ticketTypeAreaService,
                adminSummaryService, sessionSeatService, venueDefaultLayoutService,
                activitySeatLayoutService, sessionSeatLayoutService, tourStationService,
                null, // OrderAdminQueryService — not needed for basic auth tests
                sessionSeatProtectionService, stockRecalculationService,
                activityArtistService, artistAdminService, artistGovernanceService,
                activityRiskResponseService, ticketAssetService, privateAssetService,
                seatCraftLayoutVersionService, activityDraftService, stationConfigVersionService,
                activityMarketingService);
    }

    private AdminController controllerWithOrderService() {
        // We need a controller with the real OrderAdminQueryService mock wired in
        // The AdminController constructor takes OrderAdminQueryService at position 18
        return new AdminController(activityMapper, artistMapper, sessionMapper, ticketTypeMapper,
                venueMapper, userAccessService, activityAdminService, sessionAdminService,
                venueApplicationService, seatTemplateService, ticketTypeAreaService,
                adminSummaryService, sessionSeatService, venueDefaultLayoutService,
                activitySeatLayoutService, sessionSeatLayoutService, tourStationService,
                service, // OrderAdminQueryService → the real service under test
                sessionSeatProtectionService, stockRecalculationService,
                activityArtistService, artistAdminService, artistGovernanceService,
                activityRiskResponseService, ticketAssetService, privateAssetService,
                seatCraftLayoutVersionService, activityDraftService, stationConfigVersionService,
                activityMarketingService);
    }

    private String adminToken() {
        return "Bearer " + JwtUtil.generateToken(2002L, "13800000001", "admin");
    }

    private String organizerToken() {
        return "Bearer " + JwtUtil.generateToken(2003L, "13800000002", "organizer");
    }

    private String userToken() {
        return "Bearer " + JwtUtil.generateToken(2004L, "13900000001", "user");
    }

    private InternalUserRefResponse user(Long id, String role) {
        InternalUserRefResponse u = new InternalUserRefResponse();
        u.setId(id);
        u.setRole(role);
        u.setStatus(1);
        return u;
    }

    private Activity activity(Long id, String name, Long organizerId) {
        Activity a = new Activity();
        a.setId(id);
        a.setName(name);
        a.setOrganizerId(organizerId);
        return a;
    }

    private Session session(Long id, Long activityId) {
        Session s = new Session();
        s.setId(id);
        s.setActivityId(activityId);
        return s;
    }

    private OrderInfoResponse order(Long id, Long sessionId, Integer status) {
        OrderInfoResponse o = new OrderInfoResponse();
        o.setId(id);
        o.setOrderNo("ORDER-" + id);
        o.setUserId(2004L);
        o.setSessionId(sessionId);
        o.setQuantity(2);
        o.setAmount(new BigDecimal("200.00"));
        o.setStatus(status);
        return o;
    }

    // ==================== Service层测试 ====================

    @Nested
    @DisplayName("Service层 - 管理员查询")
    class AdminQueryServiceTests {

        @Test
        @DisplayName("AO-001: admin查看全部订单")
        void adminListAllOrders() {
            when(userAccessService.requireAdminOrOrganizer(2002L)).thenReturn(user(2002L, "admin"));
            Activity a1 = activity(100L, "演唱会A", 2003L);
            Activity a2 = activity(200L, "话剧B", 2005L);
            when(activityMapper.selectList(any())).thenReturn(List.of(a1, a2));
            Session s1 = session(1001L, 100L);
            Session s2 = session(2002L, 200L);
            when(sessionMapper.selectList(any())).thenReturn(List.of(s1, s2));
            OrderInfoResponse o1 = order(5001L, 1001L, 2);
            OrderInfoResponse o2 = order(5002L, 2002L, 2);
            when(orderInternalClient.listPaidBySessions(any(PaidOrdersBySessionsRequest.class), eq("test-token")))
                    .thenReturn(Result.success(List.of(o1, o2)));

            List<OrderInfoResponse> result = service.listOrders(2002L, false);

            assertEquals(2, result.size());
            // 确认 activityName 被填充
            assertNotNull(o1.getActivityName());
            assertNotNull(o2.getActivityName());
        }

        @Test
        @DisplayName("AO-002: admin按paidOnly=true筛选")
        void adminFilterPaidOnly() {
            when(userAccessService.requireAdminOrOrganizer(2002L)).thenReturn(user(2002L, "admin"));
            Activity a1 = activity(100L, "活动", 2003L);
            when(activityMapper.selectList(any())).thenReturn(List.of(a1));
            Session s1 = session(1001L, 100L);
            when(sessionMapper.selectList(any())).thenReturn(List.of(s1));
            OrderInfoResponse paidOrder = order(5001L, 1001L, 2);
            when(orderInternalClient.listPaidBySessions(any(PaidOrdersBySessionsRequest.class), eq("test-token")))
                    .thenReturn(Result.success(List.of(paidOrder)));

            List<OrderInfoResponse> result = service.listOrders(2002L, true);

            assertEquals(1, result.size());
            // 验证传给 order client 的 paidOnly=true
            ArgumentCaptor<PaidOrdersBySessionsRequest> captor = ArgumentCaptor.forClass(PaidOrdersBySessionsRequest.class);
            verify(orderInternalClient).listPaidBySessions(captor.capture(), eq("test-token"));
            assertTrue(captor.getValue().getPaidOnly());
        }

        @Test
        @DisplayName("AO-003: admin按paidOnly=false查询（全部订单）")
        void adminListAllOrdersPaidOnlyFalse() {
            when(userAccessService.requireAdminOrOrganizer(2002L)).thenReturn(user(2002L, "admin"));
            Activity a1 = activity(100L, "活动", 2003L);
            when(activityMapper.selectList(any())).thenReturn(List.of(a1));
            Session s1 = session(1001L, 100L);
            when(sessionMapper.selectList(any())).thenReturn(List.of(s1));
            OrderInfoResponse o1 = order(5001L, 1001L, 2);
            OrderInfoResponse o2 = order(5002L, 1001L, 4); // REFUNDED
            when(orderInternalClient.listPaidBySessions(any(PaidOrdersBySessionsRequest.class), eq("test-token")))
                    .thenReturn(Result.success(List.of(o1, o2)));

            List<OrderInfoResponse> result = service.listOrders(2002L, false);

            assertEquals(2, result.size());
        }

        @Test
        @DisplayName("AO-004: 订单统计 — 无订单时返回空列表")
        void adminListOrdersEmpty() {
            when(userAccessService.requireAdminOrOrganizer(2002L)).thenReturn(user(2002L, "admin"));
            when(activityMapper.selectList(any())).thenReturn(Collections.emptyList());

            List<OrderInfoResponse> result = service.listOrders(2002L, false);

            assertEquals(0, result.size());
            verify(orderInternalClient, never()).listPaidBySessions(any(), any());
        }
    }

    @Nested
    @DisplayName("Service层 - 主办方查询")
    class OrganizerQueryServiceTests {

        @Test
        @DisplayName("AO-005: organizer仅查看自己活动的订单")
        void organizerListOwnOrders() {
            when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
            // organizer → 查询organizerId=2003的活动
            when(activityMapper.selectList(any())).thenAnswer(inv -> {
                // 验证 lambda 过滤了 organizerId
                return List.of(activity(100L, "我的活动", 2003L));
            });
            Session s1 = session(1001L, 100L);
            when(sessionMapper.selectList(any())).thenReturn(List.of(s1));
            OrderInfoResponse o1 = order(5001L, 1001L, 2);
            when(orderInternalClient.listPaidBySessions(any(PaidOrdersBySessionsRequest.class), eq("test-token")))
                    .thenReturn(Result.success(List.of(o1)));

            List<OrderInfoResponse> result = service.listOrders(2003L, false);

            assertEquals(1, result.size());
            assertEquals("我的活动", o1.getActivityName());
        }

        @Test
        @DisplayName("AO-006: organizer看不到他人活动的订单")
        void organizerCannotSeeOtherActivities() {
            when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
            // organizer 只查 organizerId=2003，不会返回他人活动
            Activity ownActivity = activity(100L, "我的活动", 2003L);
            when(activityMapper.selectList(any())).thenReturn(List.of(ownActivity));
            Session s1 = session(1001L, 100L);
            when(sessionMapper.selectList(any())).thenReturn(List.of(s1));
            OrderInfoResponse o1 = order(5001L, 1001L, 2);
            when(orderInternalClient.listPaidBySessions(any(PaidOrdersBySessionsRequest.class), eq("test-token")))
                    .thenReturn(Result.success(List.of(o1)));

            List<OrderInfoResponse> result = service.listOrders(2003L, false);

            assertEquals(1, result.size());
            // 验证查询时使用了 organizerId=2003 过滤
            ArgumentCaptor<com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<Activity>> captor =
                    ArgumentCaptor.forClass(com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper.class);
            verify(activityMapper).selectList(captor.capture());
        }

        @Test
        @DisplayName("AO-007: organizer按paidOnly筛选")
        void organizerFilterPaidOnly() {
            when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
            Activity a1 = activity(100L, "活动", 2003L);
            when(activityMapper.selectList(any())).thenReturn(List.of(a1));
            Session s1 = session(1001L, 100L);
            when(sessionMapper.selectList(any())).thenReturn(List.of(s1));
            when(orderInternalClient.listPaidBySessions(any(PaidOrdersBySessionsRequest.class), eq("test-token")))
                    .thenReturn(Result.success(Collections.emptyList()));

            List<OrderInfoResponse> result = service.listOrders(2003L, true);

            assertTrue(result.isEmpty());
            ArgumentCaptor<PaidOrdersBySessionsRequest> captor = ArgumentCaptor.forClass(PaidOrdersBySessionsRequest.class);
            verify(orderInternalClient).listPaidBySessions(captor.capture(), eq("test-token"));
            assertTrue(captor.getValue().getPaidOnly());
        }
    }

    @Nested
    @DisplayName("Service层 - 权限校验")
    class ServicePermissionTests {

        @Test
        @DisplayName("AO-009: user角色→requireAdminOrOrganizer 拒绝")
        void userRoleRejected() {
            when(userAccessService.requireAdminOrOrganizer(2004L))
                    .thenThrow(new BusinessException(ResultCode.FORBIDDEN, "无权限"));

            assertThrows(BusinessException.class, () -> service.listOrders(2004L, false));
            verify(activityMapper, never()).selectList(any());
        }

        @Test
        @DisplayName("ao-017: 无活动时返回空列表")
        void noActivitiesEmptyResult() {
            when(userAccessService.requireAdminOrOrganizer(2002L)).thenReturn(user(2002L, "admin"));
            when(activityMapper.selectList(any())).thenReturn(Collections.emptyList());

            List<OrderInfoResponse> result = service.listOrders(2002L, false);

            assertTrue(result.isEmpty());
            verify(sessionMapper, never()).selectList(any());
        }

        @Test
        @DisplayName("AO-017: 有活动但无场次时返回空列表")
        void hasActivitiesNoSessions() {
            when(userAccessService.requireAdminOrOrganizer(2002L)).thenReturn(user(2002L, "admin"));
            when(activityMapper.selectList(any())).thenReturn(List.of(activity(100L, "活动", 2003L)));
            when(sessionMapper.selectList(any())).thenReturn(Collections.emptyList());

            List<OrderInfoResponse> result = service.listOrders(2002L, false);

            assertTrue(result.isEmpty());
            verify(orderInternalClient, never()).listPaidBySessions(any(), any());
        }

        @Test
        @DisplayName("internalApiToken 为空 → 抛异常")
        void missingInternalToken() {
            service = new OrderAdminQueryService(userAccessService, activityMapper, sessionMapper,
                    orderInternalClient, ""); // 空 token

            when(userAccessService.requireAdminOrOrganizer(2002L)).thenReturn(user(2002L, "admin"));
            when(activityMapper.selectList(any())).thenReturn(List.of(activity(100L, "活动", 2003L)));
            when(sessionMapper.selectList(any())).thenReturn(List.of(session(1001L, 100L)));

            assertThrows(BusinessException.class, () -> service.listOrders(2002L, false));
        }

        @Test
        @DisplayName("订单服务返回失败→抛异常")
        void orderServiceError() {
            when(userAccessService.requireAdminOrOrganizer(2002L)).thenReturn(user(2002L, "admin"));
            when(activityMapper.selectList(any())).thenReturn(List.of(activity(100L, "活动", 2003L)));
            when(sessionMapper.selectList(any())).thenReturn(List.of(session(1001L, 100L)));
            when(orderInternalClient.listPaidBySessions(any(PaidOrdersBySessionsRequest.class), eq("test-token")))
                    .thenReturn(Result.fail(500, "订单服务内部错误"));

            assertThrows(BusinessException.class, () -> service.listOrders(2002L, false));
        }
    }

    // ==================== Controller 层测试 ====================

    @Nested
    @DisplayName("Controller层 - 权限与JWT校验")
    class ControllerPermissionTests {

        @Test
        @DisplayName("AO-010: 无token → 401")
        void noTokenReturns401() {
            AdminController controller = controller();

            Result<?> result = controller.listAdminOrders(null, 2002L, false);

            assertEquals(401, result.getCode());
        }

        @Test
        @DisplayName("AO-011: 伪造token → 401")
        void forgedTokenReturns401() {
            AdminController controller = controller();

            Result<?> result = controller.listAdminOrders("Bearer invalid.fake.token", 2002L, false);

            assertEquals(401, result.getCode());
        }

        @Test
        @DisplayName("AO-010: Authorization 无 Bearer 前缀 → 401")
        void tokenWithoutBearerPrefixRejected() {
            AdminController controller = controller();

            Result<?> result = controller.listAdminOrders("no-bearer", 2002L, false);

            assertEquals(401, result.getCode());
        }
    }

    @Nested
    @DisplayName("Controller层 - 分页行为验证")
    class ControllerPaginationTests {

        @Test
        @DisplayName("AO-012/016: 当前API返回List, 无分页 — 验证为已知限制")
        void noPaginationInCurrentApi() {
            // 当前 listAdminOrders 返回 Result<List<OrderInfoResponse>>，不是 Page
            // 分页需由调用方或前端实现
            AdminController controller = controllerWithOrderService();

            when(userAccessService.requireAdminOrOrganizer(2002L)).thenReturn(user(2002L, "admin"));
            when(activityMapper.selectList(any())).thenReturn(Collections.emptyList());

            Result<?> result = controller.listAdminOrders(adminToken(), null, false);

            assertEquals(200, result.getCode());
            @SuppressWarnings("unchecked")
            List<OrderInfoResponse> data = (List<OrderInfoResponse>) result.getData();
            assertNotNull(data);
        }
    }

    @Nested
    @DisplayName("Controller 层 - 与 Service 集成验证")
    class ControllerServiceIntegrationTests {

        @Test
        @DisplayName("AO-001: admin通过Controller查看订单 → 调用service.listOrders(2002L, false)")
        void adminControllerDelegatesToService() {
            AdminController controller = controllerWithOrderService();

            when(userAccessService.requireAdminOrOrganizer(2002L)).thenReturn(user(2002L, "admin"));
            when(activityMapper.selectList(any())).thenReturn(Collections.emptyList());

            Result<?> result = controller.listAdminOrders(adminToken(), 9999L, false);

            assertEquals(200, result.getCode());
            // userId query param 9999 被忽略，JWT 中的 2002 被使用
            verify(userAccessService).requireAdminOrOrganizer(2002L);
            verify(userAccessService, never()).requireAdminOrOrganizer(9999L);
        }

        @Test
        @DisplayName("AO-005: organizer通过Controller查看订单 → 调用service.listOrders(2003L, false)")
        void organizerControllerDelegatesToService() {
            AdminController controller = controllerWithOrderService();

            when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
            when(activityMapper.selectList(any())).thenReturn(Collections.emptyList());

            Result<?> result = controller.listAdminOrders(organizerToken(), 8888L, false);

            assertEquals(200, result.getCode());
            verify(userAccessService).requireAdminOrOrganizer(2003L);
            verify(userAccessService, never()).requireAdminOrOrganizer(8888L);
        }

        @Test
        @DisplayName("AO-002: admin+paidOnly=true → controller 正确传递参数")
        void adminControllerPaidOnlyTrue() {
            AdminController controller = controllerWithOrderService();

            when(userAccessService.requireAdminOrOrganizer(2002L)).thenReturn(user(2002L, "admin"));
            when(activityMapper.selectList(any())).thenReturn(Collections.emptyList());

            Result<?> result = controller.listAdminOrders(adminToken(), null, true);

            assertEquals(200, result.getCode());
        }

        @Test
        @DisplayName("AO-007: organizer+paidOnly=true → 正确传递")
        void organizerControllerPaidOnlyTrue() {
            AdminController controller = controllerWithOrderService();

            when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
            when(activityMapper.selectList(any())).thenReturn(Collections.emptyList());

            Result<?> result = controller.listAdminOrders(organizerToken(), null, true);

            assertEquals(200, result.getCode());
        }
    }
}
