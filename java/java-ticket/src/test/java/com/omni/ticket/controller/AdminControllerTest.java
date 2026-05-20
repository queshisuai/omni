package com.omni.ticket.controller;

import com.omni.common.result.Result;
import com.omni.common.util.JwtUtil;
import com.omni.ticket.dto.DeactivateOrganizerRequest;
import com.omni.ticket.dto.RefundImpactResponse;
import com.omni.ticket.dto.SeatCraftLayoutDtos;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.service.UserAccessService;
import com.omni.ticket.mapper.VenueMapper;
import com.omni.ticket.service.ActivityAdminService;
import com.omni.ticket.service.ActivitySeatLayoutService;
import com.omni.ticket.service.AdminSummaryService;
import com.omni.ticket.service.VenueDefaultLayoutService;
import com.omni.ticket.service.SeatTemplateService;
import com.omni.ticket.service.SessionAdminService;
import com.omni.ticket.service.SessionSeatLayoutService;
import com.omni.ticket.service.SessionSeatService;
import com.omni.ticket.service.TicketTypeAreaService;
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
import java.util.Map;

import com.omni.ticket.entity.Tour;

@ExtendWith(MockitoExtension.class)
class AdminControllerTest {

    @Mock
    private ActivityMapper activityMapper;
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

    private AdminController controller() {
        return new AdminController(activityMapper, sessionMapper, ticketTypeMapper, venueMapper, userAccessService, activityAdminService, sessionAdminService, venueApplicationService, seatTemplateService, ticketTypeAreaService, adminSummaryService, sessionSeatService, venueDefaultLayoutService, activitySeatLayoutService, sessionSeatLayoutService, tourStationService, null);
    }
}
