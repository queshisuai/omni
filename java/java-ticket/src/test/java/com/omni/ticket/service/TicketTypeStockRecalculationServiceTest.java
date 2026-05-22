package com.omni.ticket.service;

import com.omni.ticket.entity.SeatBlock;
import com.omni.ticket.entity.SessionSeat;
import com.omni.ticket.entity.TicketGroup;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.mapper.SeatBlockMapper;
import com.omni.ticket.mapper.SessionSeatMapper;
import com.omni.ticket.mapper.TicketGroupMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TicketTypeStockRecalculationServiceTest {
    @Mock
    private TicketTypeMapper ticketTypeMapper;
    @Mock
    private SessionSeatMapper sessionSeatMapper;
    @Mock
    private SeatBlockMapper seatBlockMapper;
    @Mock
    private TicketGroupMapper ticketGroupMapper;

    private TicketTypeStockRecalculationService service;

    @BeforeEach
    void setUp() {
        service = new TicketTypeStockRecalculationService(ticketTypeMapper, sessionSeatMapper, seatBlockMapper, ticketGroupMapper);
    }

    @Test
    void recalculateForSessionUpdatesTicketTypeStocksFromSessionSeats() {
        TicketType vip = ticketType(1001L, 99L);
        TicketType normal = ticketType(1002L, 99L);
        when(ticketTypeMapper.selectList(any())).thenReturn(List.of(vip, normal));
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of(
                seat(1L, 1001L, 1, null, null),
                seat(2L, 1001L, 1, 9001L, null),
                seat(3L, 1001L, 1, null, LocalDateTime.now()),
                seat(4L, 1001L, 2, null, LocalDateTime.now()),
                seat(5L, 1001L, 3, 9002L, null),
                seat(6L, 1001L, 4, null, null),
                seat(7L, 1002L, 1, null, null),
                seat(8L, 1002L, 4, null, null),
                seat(9L, null, 1, null, null)
        ));

        service.recalculateForSession(99L);

        ArgumentCaptor<TicketType> captor = ArgumentCaptor.forClass(TicketType.class);
        verify(ticketTypeMapper, times(2)).updateById(captor.capture());
        assertEquals(5, vip.getTotalStock());
        assertEquals(1, vip.getRemainStock());
        assertEquals(1, normal.getTotalStock());
        assertEquals(1, normal.getRemainStock());
    }

    @Test
    void recalculateForSessionSkipsNullTicketTypesAndNullSeats() {
        TicketType withoutId = ticketType(null, 99L);
        TicketType normal = ticketType(1002L, 99L);
        when(ticketTypeMapper.selectList(any())).thenReturn(List.of(withoutId, normal));
        List<SessionSeat> seats = new ArrayList<>();
        seats.add(null);
        seats.add(seat(7L, 1002L, 1, null, null));
        when(sessionSeatMapper.selectList(any())).thenReturn(seats);

        service.recalculateForSession(99L);

        verify(ticketTypeMapper, never()).updateById(withoutId);
        verify(ticketTypeMapper).updateById(normal);
        assertEquals(1, normal.getTotalStock());
        assertEquals(1, normal.getRemainStock());
    }

    @Test
    void recalculateForSessionKeepsStandingBlockCapacityStock() {
        TicketType standing = ticketType(1003L, 99L);
        standing.setName("普通站区");
        standing.setPrice(new BigDecimal("380.00"));
        standing.setTotalStock(0);
        standing.setRemainStock(0);
        standing.setStatus(1);
        when(ticketTypeMapper.selectList(any())).thenReturn(List.of(standing));
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of());
        when(seatBlockMapper.selectList(any())).thenReturn(List.of(standingBlock(20L, "general", 300)));
        when(ticketGroupMapper.selectList(any())).thenReturn(List.of(group("general", "普通站区", new BigDecimal("380.00"))));

        service.recalculateForSession(99L);

        verify(ticketTypeMapper).updateById(standing);
        assertEquals(300, standing.getTotalStock());
        assertEquals(300, standing.getRemainStock());
    }

    @Test
    void recalculateForSessionFailsClosedWhenStandingDependenciesMissing() {
        TicketTypeStockRecalculationService legacyService = new TicketTypeStockRecalculationService(ticketTypeMapper, sessionSeatMapper);
        TicketType standing = ticketType(1003L, 99L);
        standing.setName("普通站区");
        standing.setPrice(new BigDecimal("380.00"));
        standing.setStatus(1);
        when(ticketTypeMapper.selectList(any())).thenReturn(List.of(standing));
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of());

        com.omni.exception.BusinessException error = assertThrows(com.omni.exception.BusinessException.class,
                () -> legacyService.recalculateForSession(99L));

        assertEquals(503, error.getCode());
        verify(ticketTypeMapper, never()).updateById(any());
    }

    private TicketType ticketType(Long id, Long sessionId) {
        TicketType ticketType = new TicketType();
        ticketType.setId(id);
        ticketType.setSessionId(sessionId);
        return ticketType;
    }

    private SessionSeat seat(Long id, Long ticketTypeId, Integer status, Long orderId, LocalDateTime lockExpireTime) {
        SessionSeat seat = new SessionSeat();
        seat.setId(id);
        seat.setSessionId(99L);
        seat.setTicketTypeId(ticketTypeId);
        seat.setStatus(status);
        seat.setOrderId(orderId);
        seat.setLockExpireTime(lockExpireTime);
        return seat;
    }

    private SeatBlock standingBlock(Long id, String groupKey, int capacity) {
        SeatBlock block = new SeatBlock();
        block.setId(id);
        block.setOwnerType("session");
        block.setOwnerId(99L);
        block.setBlockType("standingBlock");
        block.setTicketGroupKey(groupKey);
        block.setCapacity(capacity);
        block.setStatus(1);
        return block;
    }

    private TicketGroup group(String groupKey, String name, BigDecimal price) {
        TicketGroup group = new TicketGroup();
        group.setGroupKey(groupKey);
        group.setName(name);
        group.setActivityPrice(price);
        group.setStatus(1);
        return group;
    }
}
