package com.omni.ticket.controller;

import com.omni.common.result.Result;
import com.omni.common.util.JwtUtil;
import com.omni.ticket.dto.DeactivateOrganizerRequest;
import com.omni.ticket.dto.DeleteActivityRequest;
import com.omni.ticket.dto.DeleteActivityResponse;
import com.omni.ticket.dto.RefundImpactResponse;
import com.omni.ticket.dto.ActivityArtistDto;
import com.omni.ticket.dto.SeatLayoutTemplateCandidateResponse;
import com.omni.ticket.dto.SeatCraftLayoutDtos;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Artist;
import com.omni.ticket.entity.SessionSeat;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.ArtistMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.service.UserAccessService;
import com.omni.ticket.mapper.VenueMapper;
import com.omni.ticket.service.ActivityAdminService;
import com.omni.ticket.service.ActivityArtistService;
import com.omni.ticket.service.ArtistAdminService;
import com.omni.ticket.service.ActivitySeatLayoutService;
import com.omni.ticket.service.AdminSummaryService;
import com.omni.ticket.service.VenueDefaultLayoutService;
import com.omni.ticket.service.SeatTemplateService;
import com.omni.ticket.service.SessionAdminService;
import com.omni.ticket.service.SessionSeatLayoutService;
import com.omni.ticket.service.SessionSeatProtectionService;
import com.omni.ticket.service.SessionSeatService;
import com.omni.ticket.service.TicketTypeAreaService;
import com.omni.ticket.service.TicketTypeStockRecalculationService;
import com.omni.ticket.service.TourStationService;
import com.omni.ticket.service.VenueApplicationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import com.omni.ticket.entity.Tour;

@ExtendWith(MockitoExtension.class)
class AdminControllerTest {

    @Mock
    private ActivityMapper activityMapper;
    @Mock
    private ArtistMapper artistMapper;
    @Mock
    private SessionMapper sessionMapper;
    @Mock
    private TicketTypeMapper ticketTypeMapper;
    @Mock
    private VenueMapper venueMapper;
    @Mock
    private UserAccessService userAccessService;
    @Mock
    private ActivityAdminService activityAdminService;
    @Mock
    private ActivityArtistService activityArtistService;
    @Mock
    private ArtistAdminService artistAdminService;
    @Mock
    private SessionAdminService sessionAdminService;
    @Mock
    private VenueApplicationService venueApplicationService;
    @Mock
    private SeatTemplateService seatTemplateService;
    @Mock
    private TicketTypeAreaService ticketTypeAreaService;
    @Mock
    private AdminSummaryService adminSummaryService;
    @Mock
    private SessionSeatService sessionSeatService;
    @Mock
    private VenueDefaultLayoutService venueDefaultLayoutService;
    @Mock
    private ActivitySeatLayoutService activitySeatLayoutService;
    @Mock
    private SessionSeatLayoutService sessionSeatLayoutService;
    @Mock
    private TourStationService tourStationService;
    @Mock
    private SessionSeatProtectionService sessionSeatProtectionService;
    @Mock
    private TicketTypeStockRecalculationService stockRecalculationService;

    @Test
    void deactivateOrganizerUsesAuthorizationTokenAsOperator() {
        AdminController controller = controller();
        DeactivateOrganizerRequest request = new DeactivateOrganizerRequest();
        request.setUserId(9999L);
        request.setOrganizerId(2003L);
        request.setConfirmRefund(true);
        RefundImpactResponse response = new RefundImpactResponse();
        when(activityAdminService.deactivateOrganizer(any())).thenReturn(response);

        Result<RefundImpactResponse> result = controller.deactivateOrganizer(
                "Bearer " + JwtUtil.generateToken(2002L, "13800000001", "admin"), request);

        ArgumentCaptor<DeactivateOrganizerRequest> captor = ArgumentCaptor.forClass(DeactivateOrganizerRequest.class);
        verify(activityAdminService).deactivateOrganizer(captor.capture());
        assertEquals(200, result.getCode());
        assertEquals(2002L, captor.getValue().getUserId());
    }

    @Test
    void deactivateOrganizerRejectsMissingAuthorization() {
        AdminController controller = controller();

        Result<RefundImpactResponse> result = controller.deactivateOrganizer(null, new DeactivateOrganizerRequest());

        assertEquals(401, result.getCode());
        verify(activityAdminService, never()).deactivateOrganizer(any());
    }

    @Test
    void createVenueSeatRejectsEmptyRequestBody() {
        AdminController controller = controller();

        Result<?> result = controller.createVenueSeat(1L, null);

        assertEquals(400, result.getCode());
        assertEquals("座位参数不能为空", result.getMessage());
        verify(seatTemplateService, never()).createSeat(any());
    }

    @Test
    void deleteSessionDelegatesToService() {
        AdminController controller = controller();

        Result<Void> result = controller.deleteSession(2003L, 50L);

        assertEquals(200, result.getCode());
    }

    @Test
    void deleteActivityRejectsBlankReason() {
        AdminController controller = controller();
        DeleteActivityRequest request = new DeleteActivityRequest();
        request.setUserId(2003L);
        request.setReason(" ");

        Result<?> result = controller.deleteActivity(10L, request);

        assertEquals(400, result.getCode());
        assertEquals("删除原因不能为空", result.getMessage());
        verify(activityAdminService, never()).deleteActivity(any(), any());
    }

    @Test
    void deleteActivityDelegatesToService() {
        AdminController controller = controller();
        DeleteActivityRequest request = new DeleteActivityRequest();
        request.setUserId(2003L);
        request.setReason("演出计划取消");
        DeleteActivityResponse response = new DeleteActivityResponse();
        response.setActivityId(10L);
        when(activityAdminService.deleteActivity(10L, request)).thenReturn(response);

        Result<DeleteActivityResponse> result = controller.deleteActivity(10L, request);

        assertEquals(200, result.getCode());
        assertEquals(10L, result.getData().getActivityId());
        verify(activityAdminService).deleteActivity(10L, request);
    }

    @Test
    void createTicketTypeRejectsEmptyLayoutSectionIds() {
        AdminController controller = controller();
        when(userAccessService.requireAdminOrOrganizerRole(2003L)).thenReturn("organizer");
        com.omni.ticket.entity.Session mockSession = new com.omni.ticket.entity.Session();
        mockSession.setActivityId(10L);
        mockSession.setVenueId(1L);
        when(sessionMapper.selectById(1L)).thenReturn(mockSession);
        com.omni.ticket.entity.Activity mockActivity = new com.omni.ticket.entity.Activity();
        mockActivity.setOrganizerId(2003L);
        when(activityMapper.selectById(10L)).thenReturn(mockActivity);

        Result<TicketType> result = controller.createTicketType(Map.of(
                "userId", 2003L, "sessionId", 1L, "name", "VIP", "price", "500", "totalStock", "100", "layoutSectionIds", Collections.emptyList()
        ));

        assertEquals(400, result.getCode());
    }

    @Test
    void deleteTicketTypeRejectsProtectedSeats() {
        AdminController controller = controller();
        when(userAccessService.requireAdminOrOrganizerRole(2003L)).thenReturn("organizer");
        TicketType ticketType = new TicketType();
        ticketType.setId(900L);
        ticketType.setSessionId(99L);
        when(ticketTypeMapper.selectById(900L)).thenReturn(ticketType);
        com.omni.ticket.entity.Session session = new com.omni.ticket.entity.Session();
        session.setId(99L);
        session.setActivityId(10L);
        when(sessionMapper.selectById(99L)).thenReturn(session);
        Activity activity = new Activity();
        activity.setOrganizerId(2003L);
        when(activityMapper.selectById(10L)).thenReturn(activity);
        when(sessionSeatProtectionService.findProtectedSeatIds(99L)).thenReturn(java.util.Set.of(7001L));
        SessionSeat protectedSeat = new SessionSeat();
        protectedSeat.setId(7001L);
        protectedSeat.setSessionId(99L);
        protectedSeat.setTicketTypeId(900L);
        when(sessionSeatService.listBySession(99L)).thenReturn(List.of(protectedSeat));

        Result<Void> result = controller.deleteTicketType(2003L, 900L);

        assertEquals(400, result.getCode());
        assertEquals("该票档已有购票订单，请先完成退款后再删除。", result.getMessage());
        verify(ticketTypeMapper, never()).deleteById(900L);
        verify(stockRecalculationService, never()).recalculateForSession(any());
    }

    @Test
    void createTourDraftDelegatesToService() {
        AdminController controller = controller();
        Tour tour = new Tour();
        tour.setId(20L);
        when(tourStationService.createTourDraft(any(), any())).thenReturn(tour);

        Result<Tour> result = controller.createTourDraft(Map.of("userId", 2003L, "title", "巡演"));

        assertEquals(200, result.getCode());
        assertEquals(20L, result.getData().getId());
        verify(tourStationService).createTourDraft(2003L, Map.of("userId", 2003L, "title", "巡演"));
    }

    @Test
    void updateSessionSeatLayoutDelegatesToService() {
        AdminController controller = controller();
        SeatCraftLayoutDtos.LayoutSaveRequest request = new SeatCraftLayoutDtos.LayoutSaveRequest();
        request.setUserId(2003L);
        SeatCraftLayoutDtos.LayoutResponse layout = new SeatCraftLayoutDtos.LayoutResponse();
        layout.setName("场次 SeatCraft 座位图");
        request.setLayout(layout);
        when(sessionSeatLayoutService.updateLayout(2003L, 10L, layout)).thenReturn(layout);

        Result<SeatCraftLayoutDtos.LayoutResponse> result = controller.updateSessionSeatLayout(10L, request);

        assertEquals(200, result.getCode());
        assertEquals("场次 SeatCraft 座位图", result.getData().getName());
        verify(sessionSeatLayoutService).updateLayout(2003L, 10L, layout);
    }

    @Test
    void createActivityStoresExternalVenueApprovalProof() {
        AdminController controller = controller();
        when(userAccessService.requireAdminOrOrganizerRole(2003L)).thenReturn("organizer");

        Result<Activity> result = controller.createActivity(Map.of(
                "userId", 2003L,
                "categoryId", 1L,
                "artistId", 1L,
                "name", "审批凭证演出",
                "venueApprovalNo", "BJ-WH-2026-001",
                "venueApprovalFileUrl", "https://example.com/approval.pdf",
                "venueApprovalNote", "已取得城市主管部门审批"
        ));

        ArgumentCaptor<Activity> captor = ArgumentCaptor.forClass(Activity.class);
        verify(activityMapper).insert(captor.capture());
        assertEquals(200, result.getCode());
        assertEquals("BJ-WH-2026-001", captor.getValue().getVenueApprovalNo());
        assertEquals("https://example.com/approval.pdf", captor.getValue().getVenueApprovalFileUrl());
        assertEquals("已取得城市主管部门审批", captor.getValue().getVenueApprovalNote());
    }

    @Test
    void createActivityStoresSeatMapVisibility() {
        AdminController controller = controller();
        when(userAccessService.requireAdminOrOrganizerRole(2003L)).thenReturn("organizer");

        Result<Activity> result = controller.createActivity(Map.of(
                "userId", 2003L,
                "categoryId", 1L,
                "artistId", 1L,
                "name", "座位图可见性演出",
                "seatMapVisibility", "published"
        ));

        ArgumentCaptor<Activity> captor = ArgumentCaptor.forClass(Activity.class);
        verify(activityMapper).insert(captor.capture());
        assertEquals(200, result.getCode());
        assertEquals("published", captor.getValue().getSeatMapVisibility());
    }

    @Test
    void createActivityCreatesArtistFromName() {
        AdminController controller = controller();
        when(userAccessService.requireAdminOrOrganizerRole(2003L)).thenReturn("organizer");
        when(artistMapper.insert(any())).thenAnswer(invocation -> {
            Artist artist = invocation.getArgument(0);
            artist.setId(88L);
            return 1;
        });

        Result<Activity> result = controller.createActivity(Map.of(
                "userId", 2003L,
                "categoryId", 1L,
                "artistName", "新乐队",
                "name", "按艺人姓名创建活动"
        ));

        ArgumentCaptor<Artist> artistCaptor = ArgumentCaptor.forClass(Artist.class);
        ArgumentCaptor<Activity> activityCaptor = ArgumentCaptor.forClass(Activity.class);
        verify(artistMapper).insert(artistCaptor.capture());
        verify(activityMapper).insert(activityCaptor.capture());
        assertEquals(200, result.getCode());
        assertEquals("新乐队", artistCaptor.getValue().getName());
        assertEquals(88L, activityCaptor.getValue().getArtistId());
    }

    @Test
    void getAdminActivityReturnsArtistName() {
        AdminController controller = controller();
        when(userAccessService.requireAdminOrOrganizerRole(2003L)).thenReturn("organizer");
        Activity activity = new Activity();
        activity.setId(10L);
        activity.setOrganizerId(2003L);
        activity.setArtistId(88L);
        when(activityMapper.selectById(10L)).thenReturn(activity);
        Artist artist = new Artist();
        artist.setId(88L);
        artist.setName("新乐队");
        when(artistMapper.selectById(88L)).thenReturn(artist);

        Result<Activity> result = controller.getAdminActivity(10L, 2003L);

        assertEquals(200, result.getCode());
        assertEquals("新乐队", result.getData().getArtistName());
    }

    @Test
    void updateActivityUpdatesArtistFromName() {
        AdminController controller = controller();
        when(userAccessService.requireAdminOrOrganizerRole(2003L)).thenReturn("organizer");
        Activity activity = new Activity();
        activity.setId(10L);
        activity.setOrganizerId(2003L);
        activity.setArtistId(1L);
        when(activityMapper.selectById(10L)).thenReturn(activity);
        when(artistMapper.insert(any())).thenAnswer(invocation -> {
            Artist artist = invocation.getArgument(0);
            artist.setId(89L);
            return 1;
        });

        Result<Activity> result = controller.updateActivity(10L, Map.of(
                "userId", 2003L,
                "artistName", "新组合"
        ));

        ArgumentCaptor<Activity> activityCaptor = ArgumentCaptor.forClass(Activity.class);
        verify(activityMapper).updateById(activityCaptor.capture());
        assertEquals(200, result.getCode());
        assertEquals(89L, activityCaptor.getValue().getArtistId());
    }

    @Test
    void createActivityStoresLineupAndSyncsPrimaryArtist() {
        AdminController controller = controller();
        when(userAccessService.requireAdminOrOrganizerRole(2003L)).thenReturn("organizer");

        Result<Activity> result = controller.createActivity(Map.of(
                "userId", 2003L,
                "categoryId", 1L,
                "name", "多艺人活动",
                "artists", List.of(
                        Map.of("artistId", 1L, "isPrimary", false, "sort", 1, "visibility", "public"),
                        Map.of("artistId", 2L, "isPrimary", true, "sort", 2, "visibility", "public")
                )
        ));

        ArgumentCaptor<Activity> activityCaptor = ArgumentCaptor.forClass(Activity.class);
        verify(activityMapper).insert(activityCaptor.capture());
        verify(activityArtistService).saveLineup(any(), any());
        assertEquals(200, result.getCode());
        assertEquals(2L, activityCaptor.getValue().getArtistId());
    }

    @Test
    void getAdminActivityReturnsFullLineupIncludingHiddenGuest() {
        AdminController controller = controller();
        when(userAccessService.requireAdminOrOrganizerRole(2003L)).thenReturn("organizer");
        Activity activity = new Activity();
        activity.setId(10L);
        activity.setOrganizerId(2003L);
        when(activityMapper.selectById(10L)).thenReturn(activity);
        ActivityArtistDto visible = new ActivityArtistDto();
        visible.setArtistId(1L);
        visible.setName("周杰伦");
        visible.setVisibility("public");
        ActivityArtistDto hidden = new ActivityArtistDto();
        hidden.setArtistId(2L);
        hidden.setName("保密嘉宾");
        hidden.setVisibility("hidden");
        when(activityArtistService.listAdminLineup(10L)).thenReturn(List.of(visible, hidden));

        Result<Activity> result = controller.getAdminActivity(10L, 2003L);

        assertEquals(200, result.getCode());
        assertEquals(2, result.getData().getArtists().size());
        assertEquals("周杰伦", result.getData().getArtistName());
    }

    @Test
    void listVenueSeatLayoutTemplatesDelegatesToApplicationService() {
        AdminController controller = controller();
        SeatLayoutTemplateCandidateResponse candidate = new SeatLayoutTemplateCandidateResponse();
        candidate.setSourceType("legacy_venue_default");
        candidate.setSourceId(7L);
        when(venueApplicationService.listSeatLayoutTemplates(2003L, 99L)).thenReturn(List.of(candidate));

        Result<List<SeatLayoutTemplateCandidateResponse>> result = controller.listVenueSeatLayoutTemplates(99L, 2003L);

        assertEquals(200, result.getCode());
        assertEquals("legacy_venue_default", result.getData().get(0).getSourceType());
        verify(venueApplicationService).listSeatLayoutTemplates(2003L, 99L);
    }

    private AdminController controller() {
        return new AdminController(activityMapper, artistMapper, sessionMapper, ticketTypeMapper, venueMapper, userAccessService, activityAdminService, sessionAdminService, venueApplicationService, seatTemplateService, ticketTypeAreaService, adminSummaryService, sessionSeatService, venueDefaultLayoutService, activitySeatLayoutService, sessionSeatLayoutService, tourStationService, null, sessionSeatProtectionService, stockRecalculationService, activityArtistService, artistAdminService);
    }
}
