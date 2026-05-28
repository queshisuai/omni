package com.omni.ticket.controller;

import com.alibaba.csp.sentinel.slots.block.BlockException;
import com.omni.common.result.Result;
import com.omni.ticket.client.OrderInternalClient;
import com.omni.ticket.dto.SeatMapResponse;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.SessionSeatLayoutMapper;
import com.omni.ticket.mapper.SessionSeatLayoutSectionMapper;
import com.omni.ticket.mapper.SessionSeatMapper;
import com.omni.ticket.mapper.TicketTypeAreaMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.mapper.VenueAreaMapper;
import com.omni.ticket.service.SeatCraftBlockLayoutService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class SeatControllerSentinelTest {
    @Test
    void getSeatMapBlockedReturnsTooManyRequestsWithoutCallingDependencies() {
        ActivityMapper activityMapper = mock(ActivityMapper.class);
        SessionMapper sessionMapper = mock(SessionMapper.class);
        TicketTypeMapper ticketTypeMapper = mock(TicketTypeMapper.class);
        TicketTypeAreaMapper ticketTypeAreaMapper = mock(TicketTypeAreaMapper.class);
        VenueAreaMapper venueAreaMapper = mock(VenueAreaMapper.class);
        SessionSeatMapper sessionSeatMapper = mock(SessionSeatMapper.class);
        SessionSeatLayoutMapper sessionSeatLayoutMapper = mock(SessionSeatLayoutMapper.class);
        SessionSeatLayoutSectionMapper sessionSeatLayoutSectionMapper = mock(SessionSeatLayoutSectionMapper.class);
        SeatCraftBlockLayoutService seatCraftBlockLayoutService = mock(SeatCraftBlockLayoutService.class);
        OrderInternalClient orderInternalClient = mock(OrderInternalClient.class);
        SeatController controller = new SeatController(
                activityMapper,
                sessionMapper,
                ticketTypeMapper,
                ticketTypeAreaMapper,
                venueAreaMapper,
                sessionSeatMapper,
                sessionSeatLayoutMapper,
                sessionSeatLayoutSectionMapper,
                seatCraftBlockLayoutService,
                orderInternalClient,
                "test-internal-token");

        Result<SeatMapResponse> result = controller.getSeatMapBlocked(1001L, 2001L, mock(BlockException.class));

        assertEquals(429, result.getCode());
        assertEquals("系统繁忙，请稍后重试", result.getMessage());
        assertNull(result.getData());
        verifyNoInteractions(
                activityMapper,
                sessionMapper,
                ticketTypeMapper,
                ticketTypeAreaMapper,
                venueAreaMapper,
                sessionSeatMapper,
                sessionSeatLayoutMapper,
                sessionSeatLayoutSectionMapper,
                seatCraftBlockLayoutService,
                orderInternalClient);
    }
}
