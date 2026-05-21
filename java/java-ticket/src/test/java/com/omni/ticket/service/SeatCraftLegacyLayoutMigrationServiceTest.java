package com.omni.ticket.service;

import com.omni.ticket.dto.SeatCraftLayoutDtos;
import com.omni.ticket.entity.SessionSeat;
import com.omni.ticket.mapper.SessionSeatMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SeatCraftLegacyLayoutMigrationServiceTest {
    @Mock
    private SessionSeatMapper sessionSeatMapper;

    @Test
    void buildsDefaultSeatCraftLayoutFromLegacySeats() {
        SessionSeat first = seat(1L, 10L, 100L, 1, 1);
        SessionSeat second = seat(2L, 10L, 100L, 1, 2);
        when(sessionSeatMapper.selectList(any())).thenReturn(Arrays.asList(first, second));

        SeatCraftLegacyLayoutMigrationService service = new SeatCraftLegacyLayoutMigrationService(sessionSeatMapper);
        SeatCraftLayoutDtos.LayoutResponse layout = service.buildFromLegacySeats(10L);

        assertFalse(layout.getSections().isEmpty());
        assertEquals("默认区域", layout.getSections().get(0).getName());
        assertEquals(2, layout.getSections().get(0).getSeatCount());
        assertEquals(100L, layout.getSections().get(0).getTicketTypeId());
    }

    private SessionSeat seat(Long id, Long sessionId, Long ticketTypeId, Integer rowNo, Integer seatNo) {
        SessionSeat seat = new SessionSeat();
        seat.setId(id);
        seat.setSessionId(sessionId);
        seat.setTicketTypeId(ticketTypeId);
        seat.setRowNo(rowNo);
        seat.setSeatNo(seatNo);
        seat.setSeatLabel(rowNo + "排" + seatNo + "座");
        seat.setStatus(1);
        return seat;
    }
}
