package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.common.result.Result;
import com.omni.common.util.JwtUtil;
import com.omni.exception.BusinessException;
import com.omni.ticket.controller.AdminController;
import com.omni.ticket.dto.*;
import com.omni.ticket.entity.Artist;
import com.omni.ticket.mapper.*;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 艺人管理与审核 — 补充单元测试
 * 覆盖 AR-001 ~ AR-018 中未覆盖的用例
 * 与 ArtistAdminServiceTest / ArtistGovernanceServiceTest 互补
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("艺人管理与审核")
class ArtistManagementReviewTest {

    // Service mocks
    @Mock ArtistMapper artistMapper;
    @Mock UserAccessService userAccessService;

    // Controller mocks
    @Mock ActivityMapper activityMapper;
    @Mock com.omni.ticket.mapper.ArtistMapper ctlArtistMapper;
    @Mock SessionMapper sessionMapper;
    @Mock TicketTypeMapper ticketTypeMapper;
    @Mock VenueMapper venueMapper;
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
    @Mock com.omni.ticket.service.ArtistAdminService ctlArtistAdminService;
    @Mock ActivityRiskResponseService activityRiskResponseService;
    @Mock TicketAssetService ticketAssetService;
    @Mock PrivateAssetService privateAssetService;
    @Mock SeatCraftLayoutVersionService seatCraftLayoutVersionService;
    @Mock ActivityDraftService activityDraftService;
    @Mock StationConfigVersionService stationConfigVersionService;
    @Mock ActivityMarketingService activityMarketingService;
    @Mock com.omni.ticket.service.OrderAdminQueryService orderAdminQueryService;

    @BeforeAll
    static void ensureJwtSecret() {
        if (System.getenv("JWT_SECRET") == null || System.getenv("JWT_SECRET").isBlank()) {
            System.setProperty("JWT_SECRET", "test-jwt-secret-must-be-at-least-32-bytes");
        }
    }

    // ==================== 辅助方法 ====================

    private AdminController controller() {
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

    private String adminToken() {
        return "Bearer " + JwtUtil.generateToken(2002L, "13800000001", "admin");
    }

    private String organizerToken() {
        return "Bearer " + JwtUtil.generateToken(2003L, "13800000002", "organizer");
    }

    private String userToken() {
        return "Bearer " + JwtUtil.generateToken(2004L, "13900000001", "user");
    }

    private InternalUserRefResponse u(Long id, String role) {
        InternalUserRefResponse r = new InternalUserRefResponse();
        r.setId(id); r.setRole(role); r.setStatus(1);
        return r;
    }

    private Artist artist(Long id, String name, String reviewStatus, Long submittedBy) {
        Artist a = new Artist();
        a.setId(id); a.setName(name); a.setReviewStatus(reviewStatus);
        a.setRiskStatus("normal"); a.setSubmittedBy(submittedBy); a.setStatus(1);
        return a;
    }

    // ==================== 3.1 艺人提交与编辑 ====================

    @Nested
    @DisplayName("艺人提交与编辑")
    class ArtistSubmitAndEditTests {

        @Test
        @DisplayName("AR-001: 提交新艺人资料 → Service层")
        void submitNewArtist() {
            ArtistGovernanceService service = new ArtistGovernanceService(artistMapper, userAccessService);
            ArtistSubmissionRequest request = new ArtistSubmissionRequest();
            request.setUserId(2003L);
            request.setName("周杰伦");
            request.setAlias("Jay Chou");
            request.setArtistType("singer");
            request.setCountryOrRegion("中国台湾");
            request.setAgency("杰威尔音乐");
            request.setRepresentativeWorks("《青花瓷》《稻香》");

            when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "artist.manage", "activity.manage", "tour.manage"))
                    .thenReturn(u(2003L, "organizer"));
            when(artistMapper.insert(any(Artist.class))).thenAnswer(inv -> {
                Artist a = inv.getArgument(0);
                a.setId(3001L);
                return 1;
            });

            Artist result = service.submit(request);

            assertNotNull(result);
            assertEquals(3001L, result.getId());
            assertEquals("周杰伦", result.getName());
            assertEquals("pending", result.getReviewStatus());
            assertEquals("normal", result.getRiskStatus());
            assertEquals(2003L, result.getSubmittedBy());
            verify(artistMapper).insert(any(Artist.class));
        }

        @Test
        @DisplayName("AR-002: 编辑自己的待审核提交 → Service层")
        void editOwnPendingSubmission() {
            ArtistGovernanceService service = new ArtistGovernanceService(artistMapper, userAccessService);
            Artist artist = artist(3001L, "旧名称", "pending", 2003L);
            when(artistMapper.selectById(3001L)).thenReturn(artist);
            when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "artist.manage"))
                    .thenReturn(u(2003L, "organizer"));

            ArtistUpdateRequest request = new ArtistUpdateRequest();
            request.setUserId(2003L);
            request.setName("新名称");

            Artist result = service.updateProfile(3001L, request);

            assertEquals("新名称", result.getName());
            verify(artistMapper).updateById(artist);
        }

        @Test
        @DisplayName("AR-003: admin编辑任意艺人 → Service层")
        void adminEditAnyArtist() {
            ArtistGovernanceService service = new ArtistGovernanceService(artistMapper, userAccessService);
            Artist artist = artist(3001L, "旧名称", "approved", 2003L);
            when(artistMapper.selectById(3001L)).thenReturn(artist);
            when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2002L, "artist.manage"))
                    .thenReturn(u(2002L, "admin"));
            when(userAccessService.hasPlatformPermission(2002L, "artist.manage")).thenReturn(true);

            ArtistUpdateRequest request = new ArtistUpdateRequest();
            request.setUserId(2002L);
            request.setName("admin修改");

            Artist result = service.updateProfile(3001L, request);

            assertEquals("admin修改", result.getName());
            verify(artistMapper).updateById(artist);
        }

        @Test
        @DisplayName("AR-004: 编辑已审核艺人（非admin）→ 403")
        void organizerEditApprovedArtist() {
            ArtistGovernanceService service = new ArtistGovernanceService(artistMapper, userAccessService);
            Artist artist = artist(3001L, "已审核艺人", "approved", 2003L);
            when(artistMapper.selectById(3001L)).thenReturn(artist);
            when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "artist.manage"))
                    .thenReturn(u(2003L, "organizer"));

            ArtistUpdateRequest request = new ArtistUpdateRequest();
            request.setUserId(2003L);
            request.setName("尝试修改");

            BusinessException ex = assertThrows(BusinessException.class,
                    () -> service.updateProfile(3001L, request));
            assertTrue(ex.getMessage().contains("只能编辑自己提交且待审核"));
            verify(artistMapper, never()).updateById(any());
        }

        @Test
        @DisplayName("AR-005: 搜索艺人 → ArtistAdminService.search")
        void searchArtists() {
            ArtistAdminService service = new ArtistAdminService(artistMapper);
            Artist a1 = artist(3001L, "周杰伦", "approved", 2003L);
            Artist a2 = artist(3002L, "周深", "approved", 2003L);
            when(artistMapper.selectList(any())).thenReturn(List.of(a1, a2));

            List<ArtistSearchResponse> result = service.search("周");

            assertEquals(2, result.size());
            assertEquals("周杰伦", result.get(0).getName());
        }

        @Test
        @DisplayName("AR-005: 搜索艺人无匹配 → 空列表")
        void searchArtistsNoMatch() {
            ArtistAdminService service = new ArtistAdminService(artistMapper);
            when(artistMapper.selectList(any())).thenReturn(Collections.emptyList());

            List<ArtistSearchResponse> result = service.search("不存在");

            assertTrue(result.isEmpty());
        }
    }

    // ==================== 3.2 艺人审核 ====================

    @Nested
    @DisplayName("艺人审核")
    class ArtistReviewTests {

        @Test
        @DisplayName("AR-006: 查看待审核列表 → admin only")
        void listPendingArtists() {
            ArtistGovernanceService service = new ArtistGovernanceService(artistMapper, userAccessService);
            when(userAccessService.requirePlatformPermission(2002L, "artist.manage")).thenReturn(null);
            Artist p1 = artist(3001L, "待审艺人A", "pending", 2003L);
            Artist p2 = artist(3002L, "待审艺人B", "pending", 2005L);
            when(artistMapper.selectList(any())).thenReturn(List.of(p1, p2));

            List<Artist> result = service.listPending(2002L);

            assertEquals(2, result.size());
            assertEquals("pending", result.get(0).getReviewStatus());
            assertEquals("pending", result.get(1).getReviewStatus());
        }

        @Test
        @DisplayName("AR-007: admin审核通过")
        void adminApproveArtist() {
            ArtistGovernanceService service = new ArtistGovernanceService(artistMapper, userAccessService);
            Artist artist = artist(3001L, "待审艺人", "pending", 2003L);
            when(artistMapper.selectById(3001L)).thenReturn(artist);
            when(userAccessService.requirePlatformPermission(2002L, "artist.manage")).thenReturn(null);

            ArtistReviewRequest request = new ArtistReviewRequest();
            request.setUserId(2002L);
            request.setAction("approve");
            request.setNote("审核通过");

            Artist result = service.review(3001L, request);

            assertEquals("approved", result.getReviewStatus());
            assertEquals("审核通过", result.getReviewNote());
            assertEquals(2002L, result.getReviewedBy());
            assertNotNull(result.getReviewedAt());
            verify(artistMapper).updateById(artist);
        }

        @Test
        @DisplayName("AR-008: admin审核拒绝")
        void adminRejectArtist() {
            ArtistGovernanceService service = new ArtistGovernanceService(artistMapper, userAccessService);
            Artist artist = artist(3001L, "待审艺人", "pending", 2003L);
            when(artistMapper.selectById(3001L)).thenReturn(artist);
            when(userAccessService.requirePlatformPermission(2002L, "artist.manage")).thenReturn(null);

            ArtistReviewRequest request = new ArtistReviewRequest();
            request.setUserId(2002L);
            request.setAction("reject");
            request.setNote("资料不全");

            Artist result = service.review(3001L, request);

            assertEquals("rejected", result.getReviewStatus());
            assertEquals("资料不全", result.getReviewNote());
            verify(artistMapper).updateById(artist);
        }

        @Test
        @DisplayName("AR-009: organizer尝试审核 → 403")
        void organizerReviewRejected() {
            ArtistGovernanceService service = new ArtistGovernanceService(artistMapper, userAccessService);
            when(userAccessService.requirePlatformPermission(2003L, "artist.manage"))
                    .thenThrow(new BusinessException(403, "仅平台管理员可操作"));

            ArtistReviewRequest request = new ArtistReviewRequest();
            request.setUserId(2003L);
            request.setAction("approve");

            assertThrows(BusinessException.class, () -> service.review(3001L, request));
            verify(artistMapper, never()).updateById(any());
        }

        @Test
        @DisplayName("AR-006: organizer 查看待审核列表 → 403 (Controller)")
        void organizerListPendingController() {
            AdminController ctl = controller();
            when(artistGovernanceService.listPending(2003L))
                    .thenThrow(new BusinessException(403, "无权限"));

            assertThrows(BusinessException.class, () -> ctl.listPendingArtists(organizerToken()));
            verify(artistGovernanceService).listPending(2003L);
        }

        @Test
        @DisplayName("AR-009: organizer 审核 → Controller 层委托 Service（Service 层校验角色）")
        void organizerReviewDelegatesToService() {
            AdminController ctl = controller();
            Artist artist = artist(3001L, "待审", "pending", 2003L);
            when(artistGovernanceService.review(eq(3001L), any())).thenReturn(artist);

            ArtistReviewRequest request = new ArtistReviewRequest();
            Result<?> result = ctl.reviewArtist(organizerToken(), 3001L, request);

            assertEquals(200, result.getCode());
            // Controller 层不校验角色，委托给 artistGovernanceService.review()
            // 角色校验在 Service 层的 requireAdmin 中
            verify(artistGovernanceService).review(eq(3001L), any());
        }
    }

    // ==================== 3.3 艺人列表与过滤 ====================

    @Nested
    @DisplayName("艺人列表与过滤")
    class ArtistListFilterTests {

        @Test
        @DisplayName("AR-010: 查看全部艺人 → ArtistAdminService.listManageable")
        void listAllArtists() {
            ArtistAdminService service = new ArtistAdminService(artistMapper);
            Page<Artist> page = new Page<>(1, 10, 3);
            page.setRecords(List.of(
                    artist(1L, "A", "approved", 2003L),
                    artist(2L, "B", "approved", 2005L),
                    artist(3L, "C", "pending", 2003L)));
            when(artistMapper.selectPage(any(), any())).thenReturn(page);

            Page<Artist> result = service.listManageable(2002L, "admin", 1, 10, null, null, null);

            assertEquals(3, result.getRecords().size());
            assertEquals(3, result.getTotal());
        }

        @Test
        @DisplayName("AR-011: 按审核状态过滤")
        void filterByReviewStatus() {
            ArtistAdminService service = new ArtistAdminService(artistMapper);
            Page<Artist> page = new Page<>(1, 10, 1);
            page.setRecords(List.of(artist(1L, "待审A", "pending", 2003L)));
            when(artistMapper.selectPage(any(), any())).thenReturn(page);

            Page<Artist> result = service.listManageable(2002L, "admin", 1, 10, null, "pending", null);

            assertEquals(1, result.getRecords().size());
            assertEquals("pending", result.getRecords().get(0).getReviewStatus());
        }

        @Test
        @DisplayName("AR-012: 按风险状态过滤")
        void filterByRiskStatus() {
            ArtistAdminService service = new ArtistAdminService(artistMapper);
            Page<Artist> page = new Page<>(1, 10, 0);
            page.setRecords(Collections.emptyList());
            when(artistMapper.selectPage(any(), any())).thenReturn(page);

            Page<Artist> result = service.listManageable(2002L, "admin", 1, 10, null, null, "risky");

            assertEquals(0, result.getRecords().size());
        }

        @Test
        @DisplayName("AR-013: 获取艺人详情")
        void getArtistDetail() {
            ArtistAdminService service = new ArtistAdminService(artistMapper);
            Artist artist = artist(3001L, "周杰伦", "approved", 2003L);
            when(artistMapper.selectById(3001L)).thenReturn(artist);

            Artist result = service.getById(3001L);

            assertNotNull(result);
            assertEquals("周杰伦", result.getName());
        }
    }

    // ==================== 3.4 权限与异常 ====================

    @Nested
    @DisplayName("权限与异常")
    class PermissionAndErrorTests {

        @Test
        @DisplayName("AR-014: user角色提交艺人 → 403")
        void userSubmitArtistRejected() {
            ArtistGovernanceService service = new ArtistGovernanceService(artistMapper, userAccessService);
            when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2004L, "artist.manage", "activity.manage", "tour.manage"))
                    .thenThrow(new BusinessException(403, "无权限"));

            ArtistSubmissionRequest request = new ArtistSubmissionRequest();
            request.setUserId(2004L);
            request.setName("艺人名");

            assertThrows(BusinessException.class, () -> service.submit(request));
            verify(artistMapper, never()).insert(any());
        }

        @Test
        @DisplayName("AR-014: user角色 → Controller 层委托 Service（Service 层校验角色）")
        void userSubmitArtistDelegatesToService() {
            AdminController ctl = controller();
            Artist artist = artist(3001L, "艺人名", "pending", 2004L);
            when(artistGovernanceService.submit(any())).thenReturn(artist);

            ArtistSubmissionRequest request = new ArtistSubmissionRequest();
            request.setName("艺人名");
            Result<?> result = ctl.submitArtist(userToken(), request);

            assertEquals(200, result.getCode());
            // Controller 层不校验角色，委托给 artistGovernanceService.submit()
            // requireAdminOrOrganizer 在 Service 层调用
            verify(artistGovernanceService).submit(any());
        }

        @Test
        @DisplayName("AR-015: 无token → 401 (search)")
        void noTokenSearch() {
            AdminController ctl = controller();

            Result<?> result = ctl.searchArtists(null, "周杰伦");

            assertEquals(401, result.getCode());
        }

        @Test
        @DisplayName("AR-015: 无token → 401 (submit)")
        void noTokenSubmit() {
            AdminController ctl = controller();

            Result<?> result = ctl.submitArtist(null, new ArtistSubmissionRequest());

            assertEquals(401, result.getCode());
        }

        @Test
        @DisplayName("AR-016: artist名称不能为空 → 400")
        void artistNameEmpty() {
            ArtistGovernanceService service = new ArtistGovernanceService(artistMapper, userAccessService);
            when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "artist.manage", "activity.manage", "tour.manage"))
                    .thenReturn(u(2003L, "organizer"));

            ArtistSubmissionRequest request = new ArtistSubmissionRequest();
            request.setUserId(2003L);
            request.setName("");

            BusinessException ex = assertThrows(BusinessException.class,
                    () -> service.submit(request));
            assertTrue(ex.getMessage().contains("名称不能为空"));
            verify(artistMapper, never()).insert(any());
        }

        @Test
        @DisplayName("AR-017: 不存在的艺人ID → 404")
        void nonExistentArtistId() {
            ArtistGovernanceService service = new ArtistGovernanceService(artistMapper, userAccessService);
            when(artistMapper.selectById(999999L)).thenReturn(null);

            ArtistUpdateRequest request = new ArtistUpdateRequest();
            request.setUserId(2003L);
            request.setName("修改不存在");

            assertThrows(BusinessException.class, () -> service.updateProfile(999999L, request));
            verify(artistMapper, never()).updateById(any());
        }

        @Test
        @DisplayName("AR-017: getById 不存在的艺人")
        void getByIdNonExistent() {
            ArtistAdminService service = new ArtistAdminService(artistMapper);
            when(artistMapper.selectById(999999L)).thenReturn(null);

            Artist result = service.getById(999999L);

            assertNull(result);
        }

        @Test
        @DisplayName("AR-018: 搜索关键词为空 → 返回全部")
        void searchWithEmptyKeyword() {
            ArtistAdminService service = new ArtistAdminService(artistMapper);
            Artist a1 = artist(3001L, "A", "approved", 2003L);
            Artist a2 = artist(3002L, "B", "approved", 2003L);
            when(artistMapper.selectList(any())).thenReturn(List.of(a1, a2));

            // 空关键词 → 不加 like 条件，返回 status=1 的所有艺人（最多20）
            List<ArtistSearchResponse> result = service.search("");

            assertEquals(2, result.size());
        }
    }
}
