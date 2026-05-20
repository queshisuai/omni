package com.omni.ticket.service;

import com.omni.ticket.entity.SeatBlock;
import com.omni.ticket.entity.SeatOverride;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.SessionSeat;
import com.omni.ticket.entity.TicketGroup;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.mapper.SeatBlockMapper;
import com.omni.ticket.mapper.SeatOverrideMapper;
import com.omni.ticket.mapper.SessionMapper;
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
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SessionBlockTicketStockServiceTest {
    @Mock
    private SessionMapper sessionMapper;
    @Mock
    private SeatBlockMapper seatBlockMapper;
    @Mock
    private SeatOverrideMapper seatOverrideMapper;
    @Mock
    private TicketGroupMapper ticketGroupMapper;
    @Mock
    private TicketTypeMapper ticketTypeMapper;
    @Mock
    private SessionSeatMapper sessionSeatMapper;

    private SessionBlockTicketStockService service;

    @BeforeEach
    void setUp() {
        service = new SessionBlockTicketStockService(sessionMapper, seatBlockMapper, seatOverrideMapper,
                ticketGroupMapper, ticketTypeMapper, sessionSeatMapper, new SeatBlockGeometryService());
    }

    @Test
    void generateForSessionCreatesTicketTypeAndSeatsFromGridBlock() {
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 1L));
        when(sessionSeatMapper.selectCount(any())).thenReturn(0L);
        when(seatBlockMapper.selectList(any())).thenReturn(List.of(gridBlock(10L, "floor", "vip")));
        when(seatOverrideMapper.selectList(any())).thenReturn(List.of());
        when(ticketGroupMapper.selectList(any())).thenReturn(List.of(group("vip", "VIP", new BigDecimal("880.00"))));
        doAnswer(invocation -> {
            TicketType ticketType = invocation.getArgument(0);
            ticketType.setId(900L);
            return 1;
        }).when(ticketTypeMapper).insert(any(TicketType.class));

        int generated = service.generateForSession(99L);

        assertEquals(4, generated);
        verify(ticketTypeMapper).insert(org.mockito.ArgumentMatchers.argThat(ticketType -> Long.valueOf(99L).equals(ticketType.getSessionId())
                && "VIP".equals(ticketType.getName())
                && new BigDecimal("880.00").compareTo(ticketType.getPrice()) == 0
                && Integer.valueOf(4).equals(ticketType.getTotalStock())
                && Integer.valueOf(4).equals(ticketType.getRemainStock())
                && Integer.valueOf(1).equals(ticketType.getStatus())
                && ticketType.getCreateTime() != null));
        ArgumentCaptor<SessionSeat> seatCaptor = ArgumentCaptor.forClass(SessionSeat.class);
        verify(sessionSeatMapper, org.mockito.Mockito.times(4)).insert(seatCaptor.capture());
        SessionSeat firstSeat = seatCaptor.getAllValues().get(0);
        assertEquals(99L, firstSeat.getSessionId());
        assertEquals(1L, firstSeat.getVenueId());
        assertEquals(10L, firstSeat.getSeatBlockId());
        assertEquals("vip", firstSeat.getTicketGroupKey());
        assertEquals(1, firstSeat.getGeneratedRowNo());
        assertEquals(1, firstSeat.getGeneratedSeatNo());
        assertEquals(1, firstSeat.getRowNo());
        assertEquals(1, firstSeat.getSeatNo());
        assertEquals("1排1座", firstSeat.getSeatLabel());
        assertEquals(900L, firstSeat.getTicketTypeId());
        assertNotNull(firstSeat.getCreateTime());
        assertNotNull(firstSeat.getUpdateTime());
    }

    @Test
    void generateForSessionUsesStandingCapacityWithoutInsertingSeats() {
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 1L));
        when(sessionSeatMapper.selectCount(any())).thenReturn(0L);
        when(seatBlockMapper.selectList(any())).thenReturn(List.of(standingBlock(11L, "stand", "general", 300)));
        when(seatOverrideMapper.selectList(any())).thenReturn(List.of());
        when(ticketGroupMapper.selectList(any())).thenReturn(List.of(group("general", "普通站区", new BigDecimal("380.00"))));

        int generated = service.generateForSession(99L);

        assertEquals(0, generated);
        verify(ticketTypeMapper).insert(org.mockito.ArgumentMatchers.argThat(ticketType -> Integer.valueOf(300).equals(ticketType.getTotalStock())
                && Integer.valueOf(300).equals(ticketType.getRemainStock())));
        verify(sessionSeatMapper, never()).insert(any(SessionSeat.class));
    }

    @Test
    void generateForSessionReturnsZeroWhenSeatsAlreadyExist() {
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 1L));
        when(sessionSeatMapper.selectCount(any())).thenReturn(1L);

        int generated = service.generateForSession(99L);

        assertEquals(0, generated);
        verify(seatBlockMapper, never()).selectList(any());
        verify(ticketTypeMapper, never()).insert(any());
    }

    private Session session(Long id, Long venueId) {
        Session session = new Session();
        session.setId(id);
        session.setVenueId(venueId);
        return session;
    }

    private SeatBlock gridBlock(Long id, String blockKey, String groupKey) {
        SeatBlock block = new SeatBlock();
        block.setId(id);
        block.setBlockKey(blockKey);
        block.setBlockType("gridBlock");
        block.setTicketGroupKey(groupKey);
        block.setRows(2);
        block.setCols(2);
        block.setStatus(1);
        return block;
    }

    private SeatBlock standingBlock(Long id, String blockKey, String groupKey, int capacity) {
        SeatBlock block = new SeatBlock();
        block.setId(id);
        block.setBlockKey(blockKey);
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
