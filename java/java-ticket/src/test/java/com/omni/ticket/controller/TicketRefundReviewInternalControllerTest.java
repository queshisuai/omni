package com.omni.ticket.controller;

import com.omni.common.result.Result;
import com.omni.ticket.dto.TicketRefundReviewPermissionResponse;
import com.omni.ticket.service.TicketRefundReviewInternalService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class TicketRefundReviewInternalControllerTest {
    private final TicketRefundReviewInternalService service = mock(TicketRefundReviewInternalService.class);
    private final TicketRefundReviewInternalController controller =
            new TicketRefundReviewInternalController(service, "test-internal-token");

    @Test
    void checkPermissionRejectsMissingToken() {
        Result<TicketRefundReviewPermissionResponse> result =
                controller.checkPermission(3001L, 2003L, null);

        assertEquals(403, result.getCode());
        verifyNoInteractions(service);
    }

    @Test
    void checkPermissionRejectsWrongToken() {
        Result<TicketRefundReviewPermissionResponse> result =
                controller.checkPermission(3001L, 2003L, "wrong-token");

        assertEquals(403, result.getCode());
        verifyNoInteractions(service);
    }

    @Test
    void checkPermissionDelegatesWhenTokenMatches() {
        TicketRefundReviewPermissionResponse response = new TicketRefundReviewPermissionResponse();
        response.setAllowed(true);
        response.setSessionId(3001L);
        response.setActivityId(5001L);
        response.setOrganizerId(2003L);
        when(service.checkPermission(3001L, 2003L)).thenReturn(response);

        Result<TicketRefundReviewPermissionResponse> result =
                controller.checkPermission(3001L, 2003L, "test-internal-token");

        assertEquals(200, result.getCode());
        assertEquals(true, result.getData().getAllowed());
        assertEquals(3001L, result.getData().getSessionId());
        assertEquals(5001L, result.getData().getActivityId());
        assertEquals(2003L, result.getData().getOrganizerId());
        assertNull(result.getData().getReason());
    }

    @Test
    void checkPermissionDelegatesWhenTokenMatchesAndReturnsDenied() {
        TicketRefundReviewPermissionResponse response = new TicketRefundReviewPermissionResponse();
        response.setAllowed(false);
        response.setSessionId(3001L);
        response.setActivityId(5001L);
        response.setOrganizerId(2003L);
        response.setReason("审核人不是活动主办方");
        when(service.checkPermission(3001L, 9999L)).thenReturn(response);

        Result<TicketRefundReviewPermissionResponse> result =
                controller.checkPermission(3001L, 9999L, "test-internal-token");

        assertEquals(200, result.getCode());
        assertEquals(false, result.getData().getAllowed());
        assertEquals("审核人不是活动主办方", result.getData().getReason());
    }
}
