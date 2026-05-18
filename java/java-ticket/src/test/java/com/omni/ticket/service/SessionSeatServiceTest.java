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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SessionSeatServiceTest {

    @Mock
    private SessionMapper sessionMapper;
    @Mock
    private VenueSeatMapper venueSeatMapper;
    @Mock
    private SessionSeatMapper sessionSeatMapper;

    private SessionSeatService service;

    @BeforeEach
    void setUp() {
        service = new SessionSeatService(sessionMapper, venueSeatMapper, sessionSeatMapper);
    }

    @Test
    void generateForSessionCopiesEnabledVenueSeatsOnce() {
        Session session = new Session();
        session.setId(101L);
        session.setVenueId(1L);
        when(sessionMapper.selectById(101L)).thenReturn(session);
        when(sessionSeatMapper.selectCount(any())).thenReturn(0L);
        when(venueSeatMapper.selectList(any())).thenReturn(Arrays.asList(
                seat(1L, 11L, 1, 1),
                seat(2L, 11L, 1, 2),
                seat(3L, 11L, 1, 3),
                seat(4L, 11L, 2, 1),
                seat(5L, 11L, 2, 2),
                seat(6L, 11L, 2, 3)
        ));

        int generated = service.generateForSession(101L);

        assertEquals(6, generated);
        verify(sessionSeatMapper, times(6)).insert(any());
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
