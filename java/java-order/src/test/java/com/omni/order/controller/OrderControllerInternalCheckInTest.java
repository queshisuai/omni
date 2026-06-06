package com.omni.order.controller;

import com.omni.common.result.Result;
import com.omni.order.dto.TicketCheckInOverviewRequest;
import com.omni.order.dto.TicketCheckInOverviewResponse;
import com.omni.order.dto.TicketCheckInRecordQueryRequest;
import com.omni.order.dto.TicketCheckInRecordResponse;
import com.omni.order.dto.TicketCheckInSyncRequest;
import com.omni.order.service.OrderService;
import com.omni.order.service.TicketCheckInService;
import com.omni.order.service.TicketWalletService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrderControllerInternalCheckInTest {
    private static final String SECRET = "omni-jwt-secretomni-jwt-secretomni-jwt-secret";

    private OrderService orderService;
    private TicketWalletService ticketWalletService;
    private TicketCheckInService ticketCheckInService;
    private OrderController controller;

    @BeforeEach
    void setUp() {
        orderService = mock(OrderService.class);
        ticketWalletService = mock(TicketWalletService.class);
        ticketCheckInService = mock(TicketCheckInService.class);
        controller = new OrderController(orderService, ticketWalletService, ticketCheckInService,
                "test-internal-token", SECRET);
    }

    @Test
    void syncCheckInTicketRejectsMissingToken() {
        TicketCheckInSyncRequest request = syncRequest();

        Result<TicketCheckInRecordResponse> result = controller.syncCheckInTicket(request, null);

        assertEquals(403, result.getCode());
        assertEquals("无权限", result.getMessage());
        assertNull(result.getData());
        verify(ticketCheckInService, never()).syncCheckIn(request);
    }

    @Test
    void syncCheckInTicketDelegatesToServiceWhenTokenIsValid() {
        TicketCheckInSyncRequest request = syncRequest();
        TicketCheckInRecordResponse response = record("REQ-1", "SUCCESS");
        when(ticketCheckInService.syncCheckIn(request)).thenReturn(response);

        Result<TicketCheckInRecordResponse> result =
                controller.syncCheckInTicket(request, "test-internal-token");

        assertEquals(200, result.getCode());
        assertEquals(response, result.getData());
        verify(ticketCheckInService).syncCheckIn(request);
    }

    @Test
    void listCheckInRecordsDelegatesToServiceWhenTokenIsValid() {
        TicketCheckInRecordQueryRequest request = new TicketCheckInRecordQueryRequest();
        request.setSessionId(101L);
        request.setResult("SUCCESS");
        TicketCheckInRecordResponse response = record("REQ-2", "SUCCESS");
        when(ticketCheckInService.listRecords(request)).thenReturn(List.of(response));

        Result<List<TicketCheckInRecordResponse>> result =
                controller.listCheckInRecords(request, "test-internal-token");

        assertEquals(200, result.getCode());
        assertEquals(List.of(response), result.getData());
        verify(ticketCheckInService).listRecords(request);
    }

    @Test
    void getCheckInOverviewDelegatesToServiceWhenTokenIsValid() {
        TicketCheckInOverviewRequest request = new TicketCheckInOverviewRequest();
        request.setSessionId(101L);
        TicketCheckInOverviewResponse response = new TicketCheckInOverviewResponse();
        response.setSessionId(101L);
        response.setTotalTickets(100L);
        response.setCheckedInCount(62L);
        response.setUnusedCount(38L);
        response.setFailedCount(3L);
        response.setDuplicateCount(2L);
        when(ticketCheckInService.getOverview(request)).thenReturn(response);

        Result<TicketCheckInOverviewResponse> result =
                controller.getCheckInOverview(request, "test-internal-token");

        assertEquals(200, result.getCode());
        assertEquals(response, result.getData());
        verify(ticketCheckInService).getOverview(request);
    }

    private TicketCheckInSyncRequest syncRequest() {
        TicketCheckInSyncRequest request = new TicketCheckInSyncRequest();
        request.setRequestId("REQ-1");
        request.setEntryCode("entry-code");
        request.setDeviceCode("GATE-SH-001");
        request.setOperatorUserId(3008L);
        request.setChannel("INTERNAL_SYNC");
        return request;
    }

    private TicketCheckInRecordResponse record(String requestId, String result) {
        TicketCheckInRecordResponse response = new TicketCheckInRecordResponse();
        response.setId(1L);
        response.setRequestId(requestId);
        response.setTicketId(3001L);
        response.setTicketNo("ET3001");
        response.setSessionId(101L);
        response.setResult(result);
        response.setCheckedInAt(LocalDateTime.now());
        response.setCreateTime(LocalDateTime.now());
        return response;
    }
}
