package com.omni.ticket.controller;

import com.omni.common.result.Result;
import com.omni.common.util.JwtUtil;
import com.omni.ticket.dto.DeactivateOrganizerRequest;
import com.omni.ticket.dto.RefundImpactResponse;
import com.omni.ticket.dto.SeatCraftLayoutDtos;
import com.omni.ticket.dto.SeatTemplateSyncResponse;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.mapper.UserRefMapper;
import com.omni.ticket.mapper.VenueMapper;
import com.omni.ticket.service.ActivityAdminService;
import com.omni.ticket.service.ActivitySeatLayoutService;
import com.omni.ticket.service.AdminSummaryService;
import com.omni.ticket.service.SeatCraftTemplateService;
import com.omni.ticket.service.SeatTemplateService;
import com.omni.ticket.service.SessionAdminService;
import com.omni.ticket.service.SessionSeatLayoutService;
import com.omni.ticket.service.SessionSeatService;
import com.omni.ticket.service.TicketTypeAreaService;
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

import com.omni.ticket.entity.UserRef;

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
    private UserRefMapper userRefMapper;
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
    private SeatCraftTemplateService seatCraftTemplateService;
    @Mock
    private ActivitySeatLayoutService activitySeatLayoutService;
    @Mock
    private SessionSeatLayoutService sessionSeatLayoutService;

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

        Result<SeatTemplateSyncResponse> result = controller.createVenueSeat(1L, null);

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
        UserRef mockUser = new UserRef();
        mockUser.setRole("organizer");
        when(userRefMapper.selectById(2003L)).thenReturn(mockUser);
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

    private AdminController controller() {
        return new AdminController(activityMapper, sessionMapper, ticketTypeMapper, venueMapper, userRefMapper, activityAdminService, sessionAdminService, venueApplicationService, seatTemplateService, ticketTypeAreaService, adminSummaryService, sessionSeatService, seatCraftTemplateService, activitySeatLayoutService, sessionSeatLayoutService);
    }
}
