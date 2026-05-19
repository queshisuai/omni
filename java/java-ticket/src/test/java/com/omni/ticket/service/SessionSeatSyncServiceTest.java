package com.omni.ticket.service;

import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.VenueSeat;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.SessionSeatMapper;
import com.omni.ticket.mapper.VenueSeatMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SessionSeatSyncServiceTest {

    @Mock
    private SessionMapper sessionMapper;
    @Mock
    private VenueSeatMapper venueSeatMapper;
    @Mock
    private SessionSeatMapper sessionSeatMapper;
    @Mock
    private SessionSeatLayoutService sessionSeatLayoutService;

    private SessionSeatService service;

    @BeforeEach
    void setUp() {
        service = new SessionSeatService(sessionMapper, venueSeatMapper, sessionSeatMapper);
    }

    @Test
    void canSyncSessionReturnsTrueWhenNoTradingSeats() {
        when(sessionSeatMapper.countTradingSeats(101L)).thenReturn(0L);

        assertTrue(service.canSyncSession(101L));
    }

    @Test
    void canSyncSessionReturnsFalseWhenTradingSeatsExist() {
        when(sessionSeatMapper.countTradingSeats(101L)).thenReturn(2L);

        assertFalse(service.canSyncSession(101L));
    }

    @Test
    void canSyncSessionReturnsTrueWhenOnlyDisabledSeatsExist() {
        when(sessionSeatMapper.countTradingSeats(101L)).thenReturn(0L);

        assertTrue(service.canSyncSession(101L));
    }

    @Test
    void rebuildForSessionDeletesAndRecreatesWhenNoTradingSeats() {
        Session session = new Session();
        session.setId(101L);
        session.setVenueId(1L);
        when(sessionSeatMapper.countTradingSeats(101L)).thenReturn(0L);
        when(sessionMapper.selectById(101L)).thenReturn(session);
        when(sessionSeatMapper.selectCount(any())).thenReturn(2L);
        when(sessionSeatMapper.deleteSyncableBySessionId(101L)).thenReturn(2);
        when(venueSeatMapper.selectList(any())).thenReturn(Arrays.asList(
                seat(1L, 11L, 1, 1),
                seat(2L, 11L, 1, 2)
        ));

        assertEquals(2, service.rebuildForSession(101L));

        verify(sessionSeatMapper).deleteSyncableBySessionId(101L);
        verify(sessionSeatMapper, times(2)).insert(any());
    }

    @Test
    void rebuildForSessionSkipsWhenTradingSeatsExist() {
        when(sessionSeatMapper.countTradingSeats(101L)).thenReturn(1L);

        assertEquals(0, service.rebuildForSession(101L));

        verify(sessionSeatMapper, never()).deleteSyncableBySessionId(101L);
        verify(sessionSeatMapper, never()).insert(any());
    }

    @Test
    void disableAvailableSeatsByVenueSeatIdDelegatesMapperForValidSeatId() {
        when(sessionSeatMapper.disableAvailableByVenueSeatId(9L)).thenReturn(3);

        assertEquals(3, service.disableAvailableSeatsByVenueSeatId(9L));

        verify(sessionSeatMapper).disableAvailableByVenueSeatId(9L);
    }

    @Test
    void rebuildForSessionSkipsWhenHasSeatCraftLayout() {
        when(sessionSeatMapper.countTradingSeats(101L)).thenReturn(0L);
        when(sessionSeatLayoutService.hasLayout(101L)).thenReturn(true);
        SessionSeatService serviceWithLayout = new SessionSeatService(sessionMapper, venueSeatMapper, sessionSeatMapper, sessionSeatLayoutService);

        assertEquals(0, serviceWithLayout.rebuildForSession(101L));

        verify(sessionSeatMapper, never()).deleteSyncableBySessionId(101L);
        verify(sessionSeatMapper, never()).insert(any());
    }

    private VenueSeat seat(Long id, Long areaId, Integer rowNo, Integer seatNo) {
        VenueSeat seat = new VenueSeat();
        seat.setId(id);
        seat.setVenueId(1L);
        seat.setAreaId(areaId);
        seat.setRowNo(rowNo);
        seat.setSeatNo(seatNo);
        seat.setSeatLabel(rowNo + "排" + seatNo + "座");
        seat.setStatus(1);
        return seat;
    }
}
