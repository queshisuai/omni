package com.omni.ticket.service;

import com.omni.exception.BusinessException;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.SessionSeat;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.entity.TicketTypeArea;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.SessionSeatMapper;
import com.omni.ticket.mapper.TicketTypeAreaMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.search.SearchIndexMqProducer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TicketTypeAreaServiceTest {

    @Mock
    private TicketTypeMapper ticketTypeMapper;
    @Mock
    private TicketTypeAreaMapper ticketTypeAreaMapper;
    @Mock
    private SessionSeatMapper sessionSeatMapper;
    @Mock
    private SessionMapper sessionMapper;
    @Mock
    private SearchIndexMqProducer searchIndexMqProducer;

    private TicketTypeAreaService service;

    @BeforeEach
    void setUp() {
        service = new TicketTypeAreaService(ticketTypeMapper, ticketTypeAreaMapper, sessionSeatMapper, sessionMapper, searchIndexMqProducer);
    }

    @Test
    void createTicketTypeRejectsAreaAlreadyBoundInSameSession() {
        when(ticketTypeAreaMapper.selectList(any())).thenReturn(Collections.singletonList(new TicketTypeArea()));

        TicketType ticketType = ticketType(101L);

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.createTicketType(ticketType, Arrays.asList(11L)));

        assertEquals("同一场次区域只能绑定一个票档", error.getMessage());
        verify(ticketTypeMapper, never()).insert(any());
    }

    @Test
    void createTicketTypeCalculatesStockFromAvailableSessionSeats() {
        when(ticketTypeAreaMapper.selectList(any())).thenReturn(Collections.emptyList());
        when(sessionSeatMapper.selectList(any())).thenReturn(Arrays.asList(seat(1L), seat(2L), seat(3L)));
        when(sessionMapper.selectById(101L)).thenReturn(session(101L, 10L));

        TicketType result = service.createTicketType(ticketType(101L), Arrays.asList(11L));

        assertEquals(3, result.getTotalStock());
        assertEquals(3, result.getRemainStock());
        verify(ticketTypeMapper).insert(result);
        ArgumentCaptor<TicketTypeArea> captor = ArgumentCaptor.forClass(TicketTypeArea.class);
        verify(ticketTypeAreaMapper).insert(captor.capture());
        assertEquals(101L, captor.getValue().getSessionId());
        assertEquals(11L, captor.getValue().getAreaId());
        verify(searchIndexMqProducer).refreshActivity(10L);
    }

    private TicketType ticketType(Long sessionId) {
        TicketType ticketType = new TicketType();
        ticketType.setSessionId(sessionId);
        ticketType.setName("VIP");
        ticketType.setPrice(new BigDecimal("680"));
        ticketType.setStatus(1);
        return ticketType;
    }

    private SessionSeat seat(Long id) {
        SessionSeat seat = new SessionSeat();
        seat.setId(id);
        seat.setStatus(1);
        return seat;
    }

    private Session session(Long id, Long activityId) {
        Session session = new Session();
        session.setId(id);
        session.setActivityId(activityId);
        return session;
    }
}
