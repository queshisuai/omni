package com.omni.ticket.controller;

import com.omni.common.result.Result;
import com.omni.common.util.JwtUtil;
import com.omni.ticket.dto.DeactivateOrganizerRequest;
import com.omni.ticket.dto.RefundImpactResponse;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.mapper.UserRefMapper;
import com.omni.ticket.mapper.VenueMapper;
import com.omni.ticket.service.ActivityAdminService;
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

    private AdminController controller() {
        return new AdminController(activityMapper, sessionMapper, ticketTypeMapper, venueMapper, userRefMapper, activityAdminService);
    }
}
