package com.omni.ticket.controller;

import com.omni.common.result.Result;
import com.omni.common.util.JwtUtil;
import com.omni.ticket.dto.SubscriptionCalendarResponse;
import com.omni.ticket.dto.SubscriptionRequest;
import com.omni.ticket.dto.SubscriptionResponse;
import com.omni.ticket.service.PerformanceSubscriptionService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SubscriptionControllerTest {

    @Mock
    private PerformanceSubscriptionService subscriptionService;

    @Test
    void createSubscriptionUsesAuthorizationToken() {
        SubscriptionController controller = new SubscriptionController(subscriptionService);
        SubscriptionRequest request = new SubscriptionRequest();
        request.setTargetType("ACTIVITY_WANT");
        request.setTargetId(7L);
        SubscriptionResponse response = new SubscriptionResponse();
        response.setUserId(2004L);
        when(subscriptionService.createSubscription(2004L, request)).thenReturn(response);

        Result<SubscriptionResponse> result = controller.createSubscription(token(), request);

        assertEquals(200, result.getCode());
        assertEquals(2004L, result.getData().getUserId());
        verify(subscriptionService).createSubscription(2004L, request);
        verify(subscriptionService, never()).createSubscription(9999L, request);
    }

    @Test
    void listSubscriptionsRejectsMissingAuthorization() {
        SubscriptionController controller = new SubscriptionController(subscriptionService);

        Result<List<SubscriptionResponse>> result = controller.listSubscriptions(null);

        assertEquals(401, result.getCode());
        verify(subscriptionService, never()).listSubscriptions(2004L);
    }

    @Test
    void calendarUsesAuthorizationToken() {
        SubscriptionController controller = new SubscriptionController(subscriptionService);
        SubscriptionCalendarResponse response = new SubscriptionCalendarResponse();
        response.setFileName("omni-calendar-2004.ics");
        when(subscriptionService.createCalendar(2004L)).thenReturn(response);

        Result<SubscriptionCalendarResponse> result = controller.createCalendar(token());

        assertEquals(200, result.getCode());
        assertEquals("omni-calendar-2004.ics", result.getData().getFileName());
        verify(subscriptionService).createCalendar(2004L);
    }

    private String token() {
        return "Bearer " + JwtUtil.generateToken(2004L, "13800000004", "user");
    }
}
