package com.omni.order.controller;

import com.omni.common.result.Result;
import com.omni.order.dto.SessionSeatUsageItemResponse;
import com.omni.order.dto.SessionSeatUsageRequest;
import com.omni.order.dto.SessionSeatUsageResponse;
import com.omni.order.dto.TicketCheckInRequest;
import com.omni.order.dto.TicketCheckInResponse;
import com.omni.order.service.OrderService;
import com.omni.order.service.TicketWalletService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrderControllerInternalSeatUsageTest {

    private OrderService orderService;
    private TicketWalletService ticketWalletService;
    private OrderController controller;

    @BeforeEach
    void setUp() {
        orderService = mock(OrderService.class);
        ticketWalletService = mock(TicketWalletService.class);
        controller = new OrderController(orderService, ticketWalletService, "test-internal-token", "omni-jwt-secretomni-jwt-secretomni-jwt-secret");
    }

    @Test
    void inspectInternalSessionSeatUsageRejectsInvalidToken() {
        SessionSeatUsageRequest request = new SessionSeatUsageRequest();
        request.setSessionSeatIds(List.of(11L, 12L));

        Result<SessionSeatUsageResponse> result = controller.inspectInternalSessionSeatUsage(request, "wrong-token");

        assertEquals(403, result.getCode());
        assertEquals("无权限", result.getMessage());
        assertNull(result.getData());
        verify(orderService, never()).inspectSessionSeatUsage(List.of(11L, 12L));
    }

    @Test
    void inspectInternalSessionSeatUsageDelegatesToServiceWhenTokenIsValid() {
        SessionSeatUsageRequest request = new SessionSeatUsageRequest();
        request.setSessionSeatIds(List.of(11L, 12L));
        SessionSeatUsageItemResponse item = new SessionSeatUsageItemResponse(11L, true, false, 1001L, 2);
        SessionSeatUsageResponse response = new SessionSeatUsageResponse(List.of(item));
        when(orderService.inspectSessionSeatUsage(List.of(11L, 12L))).thenReturn(response);

        Result<SessionSeatUsageResponse> result = controller.inspectInternalSessionSeatUsage(request, "test-internal-token");

        assertEquals(200, result.getCode());
        assertEquals(response, result.getData());
        verify(orderService).inspectSessionSeatUsage(List.of(11L, 12L));
    }

    @Test
    void inspectInternalSessionSeatUsageTreatsMissingBodyAsEmptyRequest() {
        SessionSeatUsageResponse response = new SessionSeatUsageResponse(Collections.emptyList());
        when(orderService.inspectSessionSeatUsage(Collections.emptyList())).thenReturn(response);

        Result<SessionSeatUsageResponse> result = controller.inspectInternalSessionSeatUsage(null, "test-internal-token");

        assertEquals(200, result.getCode());
        assertEquals(response, result.getData());
        verify(orderService).inspectSessionSeatUsage(Collections.emptyList());
    }

    @Test
    void checkInTicketRejectsInvalidToken() {
        TicketCheckInRequest request = new TicketCheckInRequest();
        request.setEntryCode("code");

        Result<TicketCheckInResponse> result = controller.checkInTicket(request, "wrong-token");

        assertEquals(403, result.getCode());
        verify(ticketWalletService, never()).checkIn("code");
    }

    @Test
    void checkInTicketDelegatesToWalletServiceWhenTokenIsValid() {
        TicketCheckInRequest request = new TicketCheckInRequest();
        request.setEntryCode("code");
        TicketCheckInResponse response = new TicketCheckInResponse();
        response.setTicketId(3001L);
        when(ticketWalletService.checkIn("code")).thenReturn(response);

        Result<TicketCheckInResponse> result = controller.checkInTicket(request, "test-internal-token");

        assertEquals(200, result.getCode());
        assertEquals(3001L, result.getData().getTicketId());
        verify(ticketWalletService).checkIn("code");
    }
}
