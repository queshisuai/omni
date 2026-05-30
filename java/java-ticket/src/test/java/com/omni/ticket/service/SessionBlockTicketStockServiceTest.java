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
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

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
    void generateForSessionSkipsHiddenAndDeletedOverrideSeatsAndAdjustsStock() {
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 1L));
        when(sessionSeatMapper.selectCount(any())).thenReturn(0L);
        when(seatBlockMapper.selectList(any())).thenReturn(List.of(gridBlock(10L, "floor", "vip")));
        when(seatOverrideMapper.selectList(any())).thenReturn(List.of(
                override(10L, 1, 2, "hidden"),
                override(10L, 2, 1, "deleted")
        ));
        when(ticketGroupMapper.selectList(any())).thenReturn(List.of(group("vip", "VIP", new BigDecimal("880.00"))));
        doAnswer(invocation -> {
            TicketType ticketType = invocation.getArgument(0);
            ticketType.setId(900L);
            return 1;
        }).when(ticketTypeMapper).insert(any(TicketType.class));

        int generated = service.generateForSession(99L);

        assertEquals(2, generated);
        verify(ticketTypeMapper).insert(org.mockito.ArgumentMatchers.argThat(ticketType -> Integer.valueOf(2).equals(ticketType.getTotalStock())
                && Integer.valueOf(2).equals(ticketType.getRemainStock())));
        ArgumentCaptor<SessionSeat> seatCaptor = ArgumentCaptor.forClass(SessionSeat.class);
        verify(sessionSeatMapper, org.mockito.Mockito.times(2)).insert(seatCaptor.capture());
        assertEquals(List.of(1, 2), seatCaptor.getAllValues().stream().map(SessionSeat::getGeneratedRowNo).collect(Collectors.toList()));
        assertEquals(List.of(1, 2), seatCaptor.getAllValues().stream().map(SessionSeat::getGeneratedSeatNo).collect(Collectors.toList()));
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
        when(seatBlockMapper.selectList(any())).thenReturn(List.of());

        int generated = service.generateForSession(99L);

        assertEquals(0, generated);
        verify(ticketTypeMapper, never()).insert(any());
    }

    @Test
    void generateForSessionCreatesOnlyMissingBlockSeatsWhenOtherBlocksAlreadyExist() {
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 1L));
        when(sessionSeatMapper.selectCount(any())).thenReturn(1L);
        when(seatBlockMapper.selectList(any())).thenReturn(List.of(gridBlock(10L, "floor", "vip"), gridBlock(11L, "balcony", "vip")));
        when(seatOverrideMapper.selectList(any())).thenReturn(List.of());
        when(ticketGroupMapper.selectList(any())).thenReturn(List.of(group("vip", "VIP", new BigDecimal("880.00"))));
        TicketType vip = new TicketType();
        vip.setId(900L);
        vip.setSessionId(99L);
        vip.setName("VIP");
        vip.setPrice(new BigDecimal("880.00"));
        vip.setTotalStock(4);
        vip.setRemainStock(4);
        vip.setStatus(1);
        when(ticketTypeMapper.selectList(any())).thenReturn(List.of(vip));
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of(
                existingSeat(10L, 1, 1),
                existingSeat(10L, 1, 2),
                existingSeat(10L, 2, 1),
                existingSeat(10L, 2, 2)
        ));

        int generated = service.generateForSession(99L);

        assertEquals(4, generated);
        verify(ticketTypeMapper, never()).insert(any());
        ArgumentCaptor<SessionSeat> seatCaptor = ArgumentCaptor.forClass(SessionSeat.class);
        verify(sessionSeatMapper, org.mockito.Mockito.times(4)).insert(seatCaptor.capture());
        assertEquals(List.of(11L, 11L, 11L, 11L), seatCaptor.getAllValues().stream().map(SessionSeat::getSeatBlockId).collect(Collectors.toList()));
        assertEquals(List.of(900L, 900L, 900L, 900L), seatCaptor.getAllValues().stream().map(SessionSeat::getTicketTypeId).collect(Collectors.toList()));
    }

    @Test
    void generateForSessionCreatesOnlyMissingSeatsInsideExistingBlock() {
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 1L));
        when(sessionSeatMapper.selectCount(any())).thenReturn(1L);
        when(seatBlockMapper.selectList(any())).thenReturn(List.of(gridBlock(10L, "floor", "vip")));
        when(seatOverrideMapper.selectList(any())).thenReturn(List.of());
        when(ticketGroupMapper.selectList(any())).thenReturn(List.of(group("vip", "VIP", new BigDecimal("880.00"))));
        TicketType vip = new TicketType();
        vip.setId(900L);
        vip.setSessionId(99L);
        vip.setName("VIP");
        vip.setPrice(new BigDecimal("880.00"));
        vip.setStatus(1);
        when(ticketTypeMapper.selectList(any())).thenReturn(List.of(vip));
        SessionSeat existing = new SessionSeat();
        existing.setSessionId(99L);
        existing.setSeatBlockId(10L);
        existing.setGeneratedRowNo(1);
        existing.setGeneratedSeatNo(1);
        existing.setStatus(1);
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of(existing));

        int generated = service.generateForSession(99L);

        assertEquals(3, generated);
        verify(ticketTypeMapper, never()).insert(any());
        ArgumentCaptor<SessionSeat> seatCaptor = ArgumentCaptor.forClass(SessionSeat.class);
        verify(sessionSeatMapper, org.mockito.Mockito.times(3)).insert(seatCaptor.capture());
        assertEquals(List.of(2, 1, 2), seatCaptor.getAllValues().stream().map(SessionSeat::getGeneratedSeatNo).collect(Collectors.toList()));
        assertEquals(List.of(1, 2, 2), seatCaptor.getAllValues().stream().map(SessionSeat::getGeneratedRowNo).collect(Collectors.toList()));
    }

    @Test
    void generateForSessionDoesNotBackfillHiddenOrDeletedSeatsWhenSeatsAlreadyExist() {
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 1L));
        when(sessionSeatMapper.selectCount(any())).thenReturn(1L);
        when(seatBlockMapper.selectList(any())).thenReturn(List.of(gridBlock(10L, "floor", "vip")));
        when(seatOverrideMapper.selectList(any())).thenReturn(List.of(
                override(10L, 1, 2, "hidden"),
                override(10L, 2, 1, "deleted")
        ));
        when(ticketGroupMapper.selectList(any())).thenReturn(List.of(group("vip", "VIP", new BigDecimal("880.00"))));
        TicketType vip = new TicketType();
        vip.setId(900L);
        vip.setSessionId(99L);
        vip.setName("VIP");
        vip.setPrice(new BigDecimal("880.00"));
        vip.setStatus(1);
        when(ticketTypeMapper.selectList(any())).thenReturn(List.of(vip));
        SessionSeat existing = new SessionSeat();
        existing.setSessionId(99L);
        existing.setSeatBlockId(10L);
        existing.setGeneratedRowNo(1);
        existing.setGeneratedSeatNo(1);
        existing.setStatus(1);
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of(existing));

        int generated = service.generateForSession(99L);

        assertEquals(1, generated);
        verify(ticketTypeMapper, never()).insert(any());
        ArgumentCaptor<SessionSeat> seatCaptor = ArgumentCaptor.forClass(SessionSeat.class);
        verify(sessionSeatMapper).insert(seatCaptor.capture());
        assertEquals(2, seatCaptor.getValue().getGeneratedRowNo());
        assertEquals(2, seatCaptor.getValue().getGeneratedSeatNo());
    }

    @Test
    void generateForSessionIgnoresDisabledSeatsWhenRebuildingMissingBlockSeats() {
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 1L));
        when(sessionSeatMapper.selectCount(any())).thenReturn(1L);
        when(seatBlockMapper.selectList(any())).thenReturn(List.of(gridBlock(10L, "floor", "vip")));
        when(seatOverrideMapper.selectList(any())).thenReturn(Collections.emptyList());
        when(ticketGroupMapper.selectList(any())).thenReturn(List.of(group("vip", "VIP", new BigDecimal("880.00"))));
        TicketType vip = new TicketType();
        vip.setId(900L);
        vip.setSessionId(99L);
        vip.setName("VIP");
        vip.setPrice(new BigDecimal("880.00"));
        vip.setTotalStock(4);
        vip.setRemainStock(4);
        vip.setStatus(1);
        when(ticketTypeMapper.selectList(any())).thenReturn(List.of(vip));
        SessionSeat existing = new SessionSeat();
        existing.setSessionId(99L);
        existing.setSeatBlockId(10L);
        existing.setGeneratedRowNo(1);
        existing.setGeneratedSeatNo(1);
        existing.setStatus(4);
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of(existing));

        int generated = service.generateForSession(99L);

        assertEquals(4, generated);
        verify(ticketTypeMapper, never()).insert(any());
        ArgumentCaptor<SessionSeat> seatCaptor = ArgumentCaptor.forClass(SessionSeat.class);
        verify(sessionSeatMapper, org.mockito.Mockito.times(4)).insert(seatCaptor.capture());
        assertEquals(List.of(10L, 10L, 10L, 10L), seatCaptor.getAllValues().stream().map(SessionSeat::getSeatBlockId).collect(Collectors.toList()));
        assertEquals(List.of(1, 1, 2, 2), seatCaptor.getAllValues().stream().map(SessionSeat::getGeneratedRowNo).collect(Collectors.toList()));
        assertEquals(List.of(1, 2, 1, 2), seatCaptor.getAllValues().stream().map(SessionSeat::getGeneratedSeatNo).collect(Collectors.toList()));
    }

    @Test
    void generateForSessionRejectsPriceMismatchWhenReusingTicketTypeByName() {
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 1L));
        when(sessionSeatMapper.selectCount(any())).thenReturn(1L);
        when(seatBlockMapper.selectList(any())).thenReturn(List.of(gridBlock(10L, "floor", "vip"), gridBlock(11L, "balcony", "vip")));
        when(seatOverrideMapper.selectList(any())).thenReturn(List.of());
        when(ticketGroupMapper.selectList(any())).thenReturn(List.of(group("vip", "VIP", new BigDecimal("880.00"))));
        TicketType vipExisting = new TicketType();
        vipExisting.setId(900L);
        vipExisting.setSessionId(99L);
        vipExisting.setName("VIP");
        vipExisting.setPrice(new BigDecimal("980.00"));
        vipExisting.setStatus(1);
        when(ticketTypeMapper.selectList(any())).thenReturn(List.of(vipExisting));

        int generated = service.generateForSession(99L);

        assertEquals(8, generated);
        verify(ticketTypeMapper).insert(org.mockito.ArgumentMatchers.argThat(ticketType -> "VIP".equals(ticketType.getName())
                && new BigDecimal("880.00").compareTo(ticketType.getPrice()) == 0));
    }

    @Test
    void generateForSessionCreatesTicketTypeForMissingBlockWithNewGroup() {
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 1L));
        when(sessionSeatMapper.selectCount(any())).thenReturn(1L);
        when(seatBlockMapper.selectList(any())).thenReturn(List.of(gridBlock(10L, "floor", "vip"), gridBlock(11L, "balcony", "newVip")));
        when(seatOverrideMapper.selectList(any())).thenReturn(List.of());
        when(ticketGroupMapper.selectList(any())).thenReturn(List.of(
                group("vip", "VIP", new BigDecimal("880.00")),
                group("newVip", "新增VIP", new BigDecimal("1280.00"))));
        TicketType vip = new TicketType();
        vip.setId(900L);
        vip.setSessionId(99L);
        vip.setName("VIP");
        vip.setStatus(1);
        when(ticketTypeMapper.selectList(any())).thenReturn(List.of(vip));
        doAnswer(invocation -> {
            TicketType ticketType = invocation.getArgument(0);
            ticketType.setId(901L);
            return 1;
        }).when(ticketTypeMapper).insert(any(TicketType.class));
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of(
                existingSeat(10L, 1, 1),
                existingSeat(10L, 1, 2),
                existingSeat(10L, 2, 1),
                existingSeat(10L, 2, 2)
        ));

        int generated = service.generateForSession(99L);

        assertEquals(4, generated);
        verify(ticketTypeMapper).insert(org.mockito.ArgumentMatchers.argThat(ticketType -> "新增VIP".equals(ticketType.getName())
                && new BigDecimal("1280.00").compareTo(ticketType.getPrice()) == 0
                && Integer.valueOf(4).equals(ticketType.getTotalStock())
                && Integer.valueOf(4).equals(ticketType.getRemainStock())));
        ArgumentCaptor<SessionSeat> seatCaptor = ArgumentCaptor.forClass(SessionSeat.class);
        verify(sessionSeatMapper, org.mockito.Mockito.times(4)).insert(seatCaptor.capture());
        assertEquals(List.of(901L, 901L, 901L, 901L), seatCaptor.getAllValues().stream().map(SessionSeat::getTicketTypeId).collect(Collectors.toList()));
    }

    @Test
    void generateForSessionDoesNotReuseCachedTicketTypeForSameNameDifferentPriceGroups() {
        when(sessionMapper.selectById(99L)).thenReturn(session(99L, 1L));
        when(sessionSeatMapper.selectCount(any())).thenReturn(1L);
        when(seatBlockMapper.selectList(any())).thenReturn(List.of(
                gridBlock(10L, "floor", "vipA"),
                gridBlock(11L, "balcony", "vipB")
        ));
        when(seatOverrideMapper.selectList(any())).thenReturn(List.of());
        when(ticketGroupMapper.selectList(any())).thenReturn(List.of(
                group("vipA", "VIP", new BigDecimal("880.00")),
                group("vipB", "VIP", new BigDecimal("1280.00"))
        ));
        TicketType vip = new TicketType();
        vip.setId(900L);
        vip.setSessionId(99L);
        vip.setName("VIP");
        vip.setPrice(new BigDecimal("880.00"));
        vip.setStatus(1);
        when(ticketTypeMapper.selectList(any())).thenReturn(List.of(vip));
        doAnswer(invocation -> {
            TicketType ticketType = invocation.getArgument(0);
            ticketType.setId(901L);
            return 1;
        }).when(ticketTypeMapper).insert(any(TicketType.class));
        when(sessionSeatMapper.selectList(any())).thenReturn(List.of(
                existingSeat(10L, 1, 1),
                existingSeat(10L, 1, 2),
                existingSeat(10L, 2, 1),
                existingSeat(10L, 2, 2)
        ));

        int generated = service.generateForSession(99L);

        assertEquals(4, generated);
        verify(ticketTypeMapper).insert(org.mockito.ArgumentMatchers.argThat(ticketType -> "VIP".equals(ticketType.getName())
                && new BigDecimal("1280.00").compareTo(ticketType.getPrice()) == 0));
        ArgumentCaptor<SessionSeat> seatCaptor = ArgumentCaptor.forClass(SessionSeat.class);
        verify(sessionSeatMapper, org.mockito.Mockito.times(4)).insert(seatCaptor.capture());
        assertEquals(List.of(901L, 901L, 901L, 901L), seatCaptor.getAllValues().stream().map(SessionSeat::getTicketTypeId).collect(Collectors.toList()));
    }

    private Session session(Long id, Long venueId) {
        Session session = new Session();
        session.setId(id);
        session.setVenueId(venueId);
        return session;
    }

    private SessionSeat existingSeat(Long blockId, int rowNo, int seatNo) {
        SessionSeat seat = new SessionSeat();
        seat.setSessionId(99L);
        seat.setSeatBlockId(blockId);
        seat.setGeneratedRowNo(rowNo);
        seat.setGeneratedSeatNo(seatNo);
        seat.setStatus(1);
        return seat;
    }

    private SeatOverride override(Long blockId, int rowNo, int seatNo, String status) {
        SeatOverride override = new SeatOverride();
        override.setBlockId(blockId);
        override.setRowNo(rowNo);
        override.setSeatNo(seatNo);
        override.setStatus(status);
        return override;
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

    private TicketGroup group(String groupKey, String name, BigDecimal activityPrice, BigDecimal defaultPrice) {
        TicketGroup group = group(groupKey, name, activityPrice);
        group.setDefaultPrice(defaultPrice);
        return group;
    }
}
