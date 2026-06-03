package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.Result;
import com.omni.common.util.JwtUtil;
import com.omni.exception.BusinessException;
import com.omni.ticket.controller.AdminController;
import com.omni.ticket.dto.*;
import com.omni.ticket.entity.*;
import com.omni.ticket.mapper.*;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 艺人风险治理 — 完整单元测试
 * 覆盖 RK-001 ~ RK-016
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("艺人风险治理")
class ArtistRiskGovernanceTest {

    // === risk marking mocks ===
    @Mock ArtistMapper artistMapper;
    @Mock UserAccessService userAccessService;
    @Mock ActivityRiskResponseService activityRiskResponseService;

    // === cascade suspension mocks ===
    @Mock ActivityMapper activityMapper;
    @Mock ActivityArtistMapper activityArtistMapper;
    @Mock SessionMapper sessionMapper;
    @Mock TicketTypeMapper ticketTypeMapper;
    @Mock ActivityRiskResolutionMapper resolutionMapper;
    @Mock com.omni.ticket.client.NotificationInternalClient notificationClient;
    @Mock ActivityAdminService activityAdminService;

    // === controller mocks (for adminSuspend + risk update endpoints) ===
    @Mock com.omni.ticket.mapper.ArtistMapper ctlArtistMapper;
    @Mock com.omni.ticket.mapper.VenueMapper venueMapper;
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
    @Mock com.omni.ticket.service.ArtistAdminService ctlArtistAdminService;
    @Mock TicketAssetService ticketAssetService;
    @Mock PrivateAssetService privateAssetService;
    @Mock SeatCraftLayoutVersionService seatCraftLayoutVersionService;
    @Mock ActivityDraftService activityDraftService;
    @Mock StationConfigVersionService stationConfigVersionService;
    @Mock ActivityMarketingService activityMarketingService;
    @Mock com.omni.ticket.service.OrderAdminQueryService orderAdminQueryService;

    private ArtistGovernanceService riskService;
    private ActivityRiskResponseService suspendService;

    @BeforeAll
    static void ensureJwtSecret() {
        if (System.getenv("JWT_SECRET") == null || System.getenv("JWT_SECRET").isBlank()) {
            System.setProperty("JWT_SECRET", "test-jwt-secret-must-be-at-least-32-bytes");
        }
    }

    @BeforeEach
    void setUp() {
        riskService = new ArtistGovernanceService(artistMapper, userAccessService, activityRiskResponseService);
        suspendService = new ActivityRiskResponseService(activityMapper, activityArtistMapper,
                sessionMapper, ticketTypeMapper, resolutionMapper, userAccessService,
                notificationClient, activityAdminService, "test-token");
    }

    // ==================== 3.1 风险标记 (RK-001 ~ RK-006) ====================

    @Nested
    @DisplayName("风险标记")
    class RiskMarkingTests {

        @Test
        @DisplayName("RK-001: admin 标记艺人为风险")
        void markArtistAsRisky() {
            Artist artist = artist(3001L, "normal");
            when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
            when(artistMapper.selectById(3001L)).thenReturn(artist);

            ArtistRiskRequest request = riskReq(2002L, "risky", "涉事原因");
            Artist result = riskService.updateRisk(3001L, request);

            assertEquals("risky", result.getRiskStatus());
            assertEquals("涉事原因", result.getRiskReason());
            assertEquals(2002L, result.getRiskMarkedBy());
            assertNotNull(result.getRiskMarkedAt());
            verify(artistMapper).updateById(artist);
        }

        @Test
        @DisplayName("RK-002: 标记风险后活动自动暂停")
        void markRiskTriggersCascadeSuspend() {
            Artist artist = artist(3001L, "normal");
            when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
            when(artistMapper.selectById(3001L)).thenReturn(artist);
            when(activityRiskResponseService.suspendPublishedActivitiesForRiskArtist(3001L, "涉事原因")).thenReturn(2);

            ArtistRiskRequest request = riskReq(2002L, "risky", "涉事原因");
            Artist result = riskService.updateRisk(3001L, request);

            assertEquals("risky", result.getRiskStatus());
            verify(activityRiskResponseService).suspendPublishedActivitiesForRiskArtist(3001L, "涉事原因");
        }

        @Test
        @DisplayName("RK-003: 标记风险后场次/票档暂停(cascade)")
        void cascadeSuspendSetsSessionAndTicketTypeStatusZero() {
            Activity activity = activity(100L, "published", 2003L);
            activity.setName("演唱会");
            Session session = session(1001L, 100L);
            TicketType ticketType = ticketType(2001L, 1001L);

            when(activityArtistMapper.selectList(any())).thenReturn(List.of(lineup(3001L, 100L)));
            when(activityMapper.selectList(any())).thenReturn(List.of(activity));
            when(sessionMapper.selectList(any())).thenReturn(List.of(session));
            when(ticketTypeMapper.selectList(any())).thenReturn(List.of(ticketType));
            when(resolutionMapper.insert(any())).thenReturn(1);

            int count = suspendService.suspendPublishedActivitiesForRiskArtist(3001L, "风险原因");

            assertEquals(1, count);
            assertEquals("risk_suspended", activity.getPublishStatus());
            assertEquals(0, activity.getStatus());
            assertEquals(0, session.getStatus());
            assertEquals(0, ticketType.getStatus());
            verify(activityMapper).updateById(activity);
            verify(sessionMapper).updateById(session);
            verify(ticketTypeMapper).updateById(ticketType);
        }

        @Test
        @DisplayName("RK-004: 标记风险后记录操作信息")
        void markRiskRecordsAuditFields() {
            Artist artist = artist(3001L, "normal");
            when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
            when(artistMapper.selectById(3001L)).thenReturn(artist);

            ArtistRiskRequest request = riskReq(2002L, "risky", "违规演出");
            riskService.updateRisk(3001L, request);

            assertEquals("risky", artist.getRiskStatus());
            assertEquals("违规演出", artist.getRiskReason());
            assertEquals(2002L, artist.getRiskMarkedBy());
            assertNotNull(artist.getRiskMarkedAt());
        }

        @Test
        @DisplayName("RK-005: admin清除风险标记")
        void clearRiskMark() {
            Artist artist = artist(3001L, "risky");
            artist.setRiskReason("之前的原因");
            when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
            when(artistMapper.selectById(3001L)).thenReturn(artist);

            ArtistRiskRequest request = riskReq(2002L, "normal", null);
            Artist result = riskService.updateRisk(3001L, request);

            assertEquals("normal", result.getRiskStatus());
            assertNull(result.getRiskReason());
            assertEquals(2002L, result.getRiskClearedBy());
            assertNotNull(result.getRiskClearedAt());
            verify(artistMapper).updateById(artist);
        }

        @Test
        @DisplayName("RK-006: 已标记风险的艺人再次标记 → 幂等")
        void remarkAlreadyRiskyArtist() {
            Artist artist = artist(3001L, "risky");
            artist.setRiskReason("旧原因");
            artist.setRiskMarkedBy(2002L);
            when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
            when(artistMapper.selectById(3001L)).thenReturn(artist);

            ArtistRiskRequest request = riskReq(2002L, "risky", "新原因");
            Artist result = riskService.updateRisk(3001L, request);

            // 重新标记 → 更新为新原因和时间
            assertEquals("risky", result.getRiskStatus());
            assertEquals("新原因", result.getRiskReason());
            verify(artistMapper).updateById(artist);
        }
    }

    // ==================== 3.2 级联暂停验证 (RK-007 ~ RK-009) ====================

    @Nested
    @DisplayName("级联暂停验证")
    class CascadeSuspendTests {

        @Test
        @DisplayName("RK-007: 多活动关联同一艺人 → 全部暂停")
        void multipleActivitiesAllSuspended() {
            Activity a1 = activity(100L, "published", 2003L);
            Activity a2 = activity(200L, "published", 2003L);
            Activity a3 = activity(300L, "published", 2003L);

            when(activityArtistMapper.selectList(any())).thenReturn(List.of(
                    lineup(3001L, 100L), lineup(3001L, 200L), lineup(3001L, 300L)));
            when(activityMapper.selectList(any())).thenReturn(List.of(a1, a2, a3));
            when(sessionMapper.selectList(any())).thenReturn(Collections.emptyList());
            when(resolutionMapper.insert(any())).thenReturn(1);

            int count = suspendService.suspendPublishedActivitiesForRiskArtist(3001L, "原因");

            assertEquals(3, count);
            assertEquals("risk_suspended", a1.getPublishStatus());
            assertEquals("risk_suspended", a2.getPublishStatus());
            assertEquals("risk_suspended", a3.getPublishStatus());
        }

        @Test
        @DisplayName("RK-008: 仅published活动受影响，draft不受影响")
        void onlyPublishedSuspended() {
            Activity published = activity(100L, "published", 2003L);
            // draft 活动不在 suspendPublishedActivitiesForRiskArtist 的查询范围

            when(activityArtistMapper.selectList(any())).thenReturn(List.of(
                    lineup(3001L, 100L)));
            when(activityMapper.selectList(any())).thenReturn(List.of(published));
            when(sessionMapper.selectList(any())).thenReturn(Collections.emptyList());
            when(resolutionMapper.insert(any())).thenReturn(1);

            int count = suspendService.suspendPublishedActivitiesForRiskArtist(3001L, "原因");

            assertEquals(1, count);
            // 仅 published 活动被查询和暂停
            ArgumentCaptor<LambdaQueryWrapper<Activity>> captor = ArgumentCaptor.forClass(LambdaQueryWrapper.class);
            verify(activityMapper).selectList(captor.capture());
        }

        @Test
        @DisplayName("RK-009: 无关联活动 → 无级联")
        void noActivitiesNoCascade() {
            when(activityArtistMapper.selectList(any())).thenReturn(Collections.emptyList());

            int count = suspendService.suspendPublishedActivitiesForRiskArtist(3001L, "原因");

            assertEquals(0, count);
            verify(activityMapper, never()).updateById(any());
        }
    }

    // ==================== 3.3 管理员手动暂停 (RK-010 ~ RK-011) ====================

    @Nested
    @DisplayName("管理员手动暂停")
    class AdminSuspendTests {

        @Test
        @DisplayName("RK-010: admin手动暂停活动")
        void adminSuspendActivity() {
            Activity activity = activity(100L, "published", 2003L);
            activity.setName("手动暂停活动");
            Session session = session(1001L, 100L);
            TicketType ticketType = ticketType(2001L, 1001L);

            when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
            when(activityMapper.selectById(100L)).thenReturn(activity);
            when(sessionMapper.selectList(any())).thenReturn(List.of(session));
            when(ticketTypeMapper.selectList(any())).thenReturn(List.of(ticketType));
            when(resolutionMapper.insert(any())).thenReturn(1);

            ActivityRiskResolutionResponse result = suspendService.adminSuspendActivity(100L, 2002L, "平台停售");

            assertNotNull(result);
            assertEquals(100L, result.getActivityId());
            assertEquals("risk_suspended", activity.getPublishStatus());
            assertEquals(0, activity.getStatus());
        }

        @Test
        @DisplayName("RK-011: 暂停已暂停的活动 → 拒绝")
        void suspendAlreadySuspended() {
            Activity activity = activity(100L, "risk_suspended", 2003L);

            when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
            when(activityMapper.selectById(100L)).thenReturn(activity);

            BusinessException ex = assertThrows(BusinessException.class,
                    () -> suspendService.adminSuspendActivity(100L, 2002L, "再次停售"));
            assertTrue(ex.getMessage().contains("仅已发布活动"));
            verify(activityMapper, never()).updateById(any());
        }
    }

    // ==================== 3.4 权限与异常 (RK-012 ~ RK-016) ====================

    @Nested
    @DisplayName("权限与异常")
    class PermissionAndErrorTests {

        @Test
        @DisplayName("RK-012: organizer标记艺人风险 → 403")
        void organizerMarkRiskRejected() {
            when(userAccessService.requireAdmin(2003L))
                    .thenThrow(new BusinessException(403, "仅平台管理员可操作"));

            ArtistRiskRequest request = riskReq(2003L, "risky", "原因");
            assertThrows(BusinessException.class, () -> riskService.updateRisk(3001L, request));
            verify(artistMapper, never()).updateById(any());
        }

        @Test
        @DisplayName("RK-013: user标记艺人风险 → 403")
        void userMarkRiskRejected() {
            when(userAccessService.requireAdmin(2004L))
                    .thenThrow(new BusinessException(403, "仅平台管理员可操作"));

            ArtistRiskRequest request = riskReq(2004L, "risky", "原因");
            assertThrows(BusinessException.class, () -> riskService.updateRisk(3001L, request));
            verify(artistMapper, never()).updateById(any());
        }

        @Test
        @DisplayName("RK-014: 无token → 401 (Controller)")
        void noTokenControllerReturns401() {
            // Use controller to test JWT parsing
            com.omni.ticket.controller.AdminController ctl = controller();

            Result<?> result = ctl.updateArtistRisk(null, 3001L, new ArtistRiskRequest());

            assertEquals(401, result.getCode());
        }

        @Test
        @DisplayName("RK-015: 不存在的艺人ID → 404")
        void nonExistentArtist() {
            when(artistMapper.selectById(999999L)).thenReturn(null);

            ArtistRiskRequest request = riskReq(2002L, "risky", "原因");
            assertThrows(BusinessException.class, () -> riskService.updateRisk(999999L, request));
            verify(artistMapper, never()).updateById(any());
        }

        @Test
        @DisplayName("RK-016: 非法riskStatus → 400")
        void invalidRiskStatus() {
            Artist artist = artist(3001L, "normal");
            when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
            when(artistMapper.selectById(3001L)).thenReturn(artist);

            ArtistRiskRequest request = riskReq(2002L, "invalid_status", "原因");
            BusinessException ex = assertThrows(BusinessException.class,
                    () -> riskService.updateRisk(3001L, request));
            assertTrue(ex.getMessage().contains("风险状态不正确"));
            verify(artistMapper, never()).updateById(any());
        }

        @Test
        @DisplayName("RK-016: riskStatus=risky但无reason → 400")
        void riskyWithoutReason() {
            when(userAccessService.requireAdmin(2002L)).thenReturn(user(2002L, "admin"));
            // reason为空 → 在 requireArtist(selectById) 之前就抛出异常

            ArtistRiskRequest request = riskReq(2002L, "risky", "");
            BusinessException ex = assertThrows(BusinessException.class,
                    () -> riskService.updateRisk(3001L, request));
            assertTrue(ex.getMessage().contains("必须填写原因"));
            verify(artistMapper, never()).selectById(anyLong());
            verify(artistMapper, never()).updateById(any());
        }
    }

    // ==================== 辅助 ====================

    private com.omni.ticket.controller.AdminController controller() {
        return new AdminController(activityMapper, ctlArtistMapper, sessionMapper, ticketTypeMapper,
                venueMapper, userAccessService, activityAdminService, sessionAdminService,
                venueApplicationService, seatTemplateService, ticketTypeAreaService,
                adminSummaryService, sessionSeatService, venueDefaultLayoutService,
                activitySeatLayoutService, sessionSeatLayoutService, tourStationService,
                orderAdminQueryService, sessionSeatProtectionService, stockRecalculationService,
                activityArtistService, ctlArtistAdminService, artistGovernanceService,
                activityRiskResponseService, ticketAssetService, privateAssetService,
                seatCraftLayoutVersionService, activityDraftService, stationConfigVersionService,
                activityMarketingService);
    }

    private static ArtistRiskRequest riskReq(Long userId, String status, String reason) {
        ArtistRiskRequest r = new ArtistRiskRequest();
        r.setUserId(userId);
        r.setRiskStatus(status);
        r.setReason(reason);
        return r;
    }

    private static Artist artist(Long id, String riskStatus) {
        Artist a = new Artist();
        a.setId(id);
        a.setName("测试艺人" + id);
        a.setStatus(1);
        a.setRiskStatus(riskStatus);
        a.setReviewStatus("approved");
        return a;
    }

    private static Activity activity(Long id, String publishStatus, Long organizerId) {
        Activity a = new Activity();
        a.setId(id);
        a.setPublishStatus(publishStatus);
        a.setStatus("published".equals(publishStatus) ? 1 : 0);
        a.setOrganizerId(organizerId);
        return a;
    }

    private static Session session(Long id, Long activityId) {
        Session s = new Session();
        s.setId(id);
        s.setActivityId(activityId);
        s.setStatus(1);
        return s;
    }

    private static TicketType ticketType(Long id, Long sessionId) {
        TicketType t = new TicketType();
        t.setId(id);
        t.setSessionId(sessionId);
        t.setStatus(1);
        return t;
    }

    private static ActivityArtist lineup(Long artistId, Long activityId) {
        ActivityArtist aa = new ActivityArtist();
        aa.setArtistId(artistId);
        aa.setActivityId(activityId);
        aa.setStatus(1);
        return aa;
    }

    private static InternalUserRefResponse user(Long id, String role) {
        InternalUserRefResponse u = new InternalUserRefResponse();
        u.setId(id);
        u.setRole(role);
        u.setStatus(1);
        return u;
    }
}
