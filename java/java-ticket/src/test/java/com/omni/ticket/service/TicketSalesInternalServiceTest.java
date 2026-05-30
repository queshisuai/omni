package com.omni.ticket.service;

import com.omni.exception.BusinessException;
import com.omni.ticket.dto.TicketSalesLockRequest;
import com.omni.ticket.dto.TicketSalesOrderRequest;
import com.omni.ticket.dto.TicketSalesQuoteRequest;
import com.omni.ticket.dto.TicketSalesQuoteResponse;
import com.omni.ticket.dto.TicketSalesSeatLockResponse;
import com.omni.ticket.entity.SeatBlock;
import com.omni.ticket.entity.TicketGroup;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.SeatBlockMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.SessionSeatMapper;
import com.omni.ticket.mapper.TicketGroupMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.mapper.VenueMapper;
import org.junit.jupiter.api.Test;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.Venue;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TicketSalesInternalServiceTest {

    @Test
    void quoteRejectsUnknownTicketType() {
        TicketTypeMapper ticketTypeMapper = mock(TicketTypeMapper.class);
        SessionMapper sessionMapper = mock(SessionMapper.class);
        ActivityMapper activityMapper = mock(ActivityMapper.class);
        VenueMapper venueMapper = mock(VenueMapper.class);
        SessionSeatMapper sessionSeatMapper = mock(SessionSeatMapper.class);
        TicketSalesInternalService service = new TicketSalesInternalService(
                ticketTypeMapper, sessionMapper, activityMapper, venueMapper, sessionSeatMapper);

        TicketSalesQuoteRequest request = new TicketSalesQuoteRequest();
        request.setSessionId(3001L);
        request.setTicketTypeId(4001L);
        request.setQuantity(2);

        BusinessException exception = assertThrows(BusinessException.class, () -> service.quote(request));

        assertEquals("票档不存在", exception.getMessage());
    }

    @Test
    void quoteReturnsBackendPriceAndQuantity() {
        TicketTypeMapper ticketTypeMapper = mock(TicketTypeMapper.class);
        SessionMapper sessionMapper = mock(SessionMapper.class);
        ActivityMapper activityMapper = mock(ActivityMapper.class);
        VenueMapper venueMapper = mock(VenueMapper.class);
        SessionSeatMapper sessionSeatMapper = mock(SessionSeatMapper.class);
        TicketSalesInternalService service = new TicketSalesInternalService(
                ticketTypeMapper, sessionMapper, activityMapper, venueMapper, sessionSeatMapper);

        TicketType ticketType = new TicketType();
        ticketType.setId(4001L);
        ticketType.setSessionId(3001L);
        ticketType.setName("看台A");
        ticketType.setPrice(new BigDecimal("380.00"));
        ticketType.setStatus(1);
        when(ticketTypeMapper.selectById(4001L)).thenReturn(ticketType);
        when(sessionSeatMapper.selectSessionSellable(3001L)).thenReturn(true);

        TicketSalesQuoteRequest request = new TicketSalesQuoteRequest();
        request.setSessionId(3001L);
        request.setTicketTypeId(4001L);
        request.setQuantity(2);

        TicketSalesQuoteResponse response = service.quote(request);

        assertEquals(new BigDecimal("380.00"), response.getUnitPrice());
        assertEquals("看台A", response.getTicketName());
        assertEquals(2, response.getQuantity());
        assertEquals(false, response.getSeatBased());
    }

    @Test
    void quoteRejectsWhenSessionNotSellable() {
        TicketTypeMapper ticketTypeMapper = mock(TicketTypeMapper.class);
        SessionMapper sessionMapper = mock(SessionMapper.class);
        ActivityMapper activityMapper = mock(ActivityMapper.class);
        VenueMapper venueMapper = mock(VenueMapper.class);
        SessionSeatMapper sessionSeatMapper = mock(SessionSeatMapper.class);
        TicketSalesInternalService service = new TicketSalesInternalService(
                ticketTypeMapper, sessionMapper, activityMapper, venueMapper, sessionSeatMapper);

        TicketType ticketType = ticketType(4001L, "A区票", new BigDecimal("380.00"));
        when(ticketTypeMapper.selectById(4001L)).thenReturn(ticketType);
        when(sessionSeatMapper.selectSessionSellable(3001L)).thenReturn(false);

        TicketSalesQuoteRequest request = new TicketSalesQuoteRequest();
        request.setSessionId(3001L);
        request.setTicketTypeId(4001L);
        request.setQuantity(1);

        BusinessException exception = assertThrows(BusinessException.class, () -> service.quote(request));

        assertEquals("session is not sellable", exception.getMessage());
        verify(sessionMapper, never()).selectById(3001L);
    }

    @Test
    void listVisibleTicketTypesHidesAllWhenSessionNotSellable() {
        TicketTypeMapper ticketTypeMapper = mock(TicketTypeMapper.class);
        SessionSeatMapper sessionSeatMapper = mock(SessionSeatMapper.class);
        TicketSalesInternalService service = service(ticketTypeMapper, sessionSeatMapper);
        when(sessionSeatMapper.selectSessionSellable(3001L)).thenReturn(false);
        when(ticketTypeMapper.selectBatchIds(List.of(4001L))).thenReturn(List.of(ticketType(4001L, "A区票", new BigDecimal("380.00"))));

        com.omni.ticket.dto.TicketTypesVisibleRequest request = new com.omni.ticket.dto.TicketTypesVisibleRequest();
        request.setSessionId(3001L);
        request.setTicketTypeIds(List.of(4001L));

        assertTrue(service.listVisibleTicketTypes(request).isEmpty());
    }

    @Test
    void lockStockDecreasesTicketTypeStock() {
        TicketTypeMapper ticketTypeMapper = mock(TicketTypeMapper.class);
        TicketSalesInternalService service = service(ticketTypeMapper, mock(SessionSeatMapper.class));
        when(ticketTypeMapper.decreaseRemainStockIfEnough(4001L, 2)).thenReturn(1);

        TicketSalesLockRequest request = lockRequest(null, 2);

        service.lockStock(request);

        verify(ticketTypeMapper).decreaseRemainStockIfEnough(4001L, 2);
    }

    @Test
    void lockStockRejectsWhenSessionNotSellableBeforeStockDecrease() {
        TicketTypeMapper ticketTypeMapper = mock(TicketTypeMapper.class);
        SessionSeatMapper sessionSeatMapper = mock(SessionSeatMapper.class);
        TicketSalesInternalService service = service(ticketTypeMapper, sessionSeatMapper);
        when(sessionSeatMapper.selectSessionSellable(3001L)).thenReturn(false);

        BusinessException exception = assertThrows(BusinessException.class, () -> service.lockStock(lockRequest(null, 2)));

        assertEquals("session is not sellable", exception.getMessage());
        verify(ticketTypeMapper, never()).decreaseRemainStockIfEnough(4001L, 2);
    }

    @Test
    void lockSeatsLocksEachSeat() {
        SessionSeatMapper sessionSeatMapper = mock(SessionSeatMapper.class);
        TicketSalesInternalService service = service(mock(TicketTypeMapper.class), sessionSeatMapper);
        when(sessionSeatMapper.lockSeat(eq(501L), eq(3001L), eq(4001L), any())).thenReturn(1);
        when(sessionSeatMapper.lockSeat(eq(502L), eq(3001L), eq(4001L), any())).thenReturn(1);

        TicketSalesSeatLockResponse response = service.lockSeats(lockRequest(List.of(501L, 502L), 2));

        assertEquals(List.of(501L, 502L), response.getLockedSeatIds());
    }

    @Test
    void lockSeatsRejectsWhenSessionNotSellableBeforeSeatLock() {
        SessionSeatMapper sessionSeatMapper = mock(SessionSeatMapper.class);
        TicketSalesInternalService service = service(mock(TicketTypeMapper.class), sessionSeatMapper);
        when(sessionSeatMapper.selectSessionSellable(3001L)).thenReturn(false);

        BusinessException exception = assertThrows(BusinessException.class, () -> service.lockSeats(lockRequest(List.of(501L), 1)));

        assertEquals("session is not sellable", exception.getMessage());
        verify(sessionSeatMapper, never()).lockSeat(any(), any(), any(), any());
    }

    @Test
    void lockSeatsRandomlyAllocatesRealSeatsWhenSeatIdsMissing() {
        SessionSeatMapper sessionSeatMapper = mock(SessionSeatMapper.class);
        TicketSalesInternalService service = service(mock(TicketTypeMapper.class), sessionSeatMapper);
        when(sessionSeatMapper.selectRandomAvailableSeatIds(3001L, 4001L, 2)).thenReturn(List.of(601L, 602L));
        when(sessionSeatMapper.lockSeat(eq(601L), eq(3001L), eq(4001L), any())).thenReturn(1);
        when(sessionSeatMapper.lockSeat(eq(602L), eq(3001L), eq(4001L), any())).thenReturn(1);
        when(sessionSeatMapper.selectSeatLabelsByIds(List.of(601L, 602L))).thenReturn(List.of("A区1排1座", "A区1排2座"));

        TicketSalesLockRequest request = lockRequest(null, 2);
        request.setAllocateRandom(true);

        TicketSalesSeatLockResponse response = service.lockSeats(request);

        assertEquals(List.of(601L, 602L), response.getLockedSeatIds());
        assertEquals(List.of("A区1排1座", "A区1排2座"), response.getSeatLabels());
    }

    @Test
    void lockSeatsFallsBackToTicketStockForBoundSeatlessStandingTicketType() {
        TicketTypeMapper ticketTypeMapper = mock(TicketTypeMapper.class);
        SessionSeatMapper sessionSeatMapper = mock(SessionSeatMapper.class);
        SeatBlockMapper seatBlockMapper = mock(SeatBlockMapper.class);
        TicketGroupMapper ticketGroupMapper = mock(TicketGroupMapper.class);
        TicketSalesInternalService service = service(ticketTypeMapper, sessionSeatMapper, seatBlockMapper, ticketGroupMapper);
        TicketType ticketType = ticketType(4001L, "站区票", new BigDecimal("280.00"));
        ticketType.setSeatBlockId(7001L);
        SeatBlock standingBlock = new SeatBlock();
        standingBlock.setId(7001L);
        standingBlock.setOwnerType("session");
        standingBlock.setOwnerId(3001L);
        standingBlock.setBlockType("standingBlock");
        standingBlock.setTicketGroupKey("standing-1");
        standingBlock.setCapacity(300);
        standingBlock.setStatus(1);
        TicketGroup standingGroup = new TicketGroup();
        standingGroup.setName("站区票");
        standingGroup.setActivityPrice(new BigDecimal("280.00"));
        when(ticketTypeMapper.selectById(4001L)).thenReturn(ticketType);
        when(sessionSeatMapper.selectRandomAvailableSeatIds(3001L, 4001L, 2)).thenReturn(List.of());
        when(seatBlockMapper.selectById(7001L)).thenReturn(standingBlock);
        when(ticketGroupMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(standingGroup);
        when(ticketTypeMapper.decreaseRemainStockIfEnough(4001L, 2)).thenReturn(1);

        TicketSalesLockRequest request = lockRequest(null, 2);
        request.setAllocateRandom(true);

        TicketSalesSeatLockResponse response = service.lockSeats(request);

        assertEquals(List.of(), response.getLockedSeatIds());
        assertEquals(List.of("系统分配站区票 x2"), response.getSeatLabels());
        verify(ticketTypeMapper).decreaseRemainStockIfEnough(4001L, 2);
        verify(sessionSeatMapper, never()).lockSeat(any(), any(), any(), any());
    }

    @Test
    void lockSeatsRejectsSeatlessStandingTicketTypeWithoutExplicitSeatBlockBinding() {
        TicketTypeMapper ticketTypeMapper = mock(TicketTypeMapper.class);
        SessionSeatMapper sessionSeatMapper = mock(SessionSeatMapper.class);
        SeatBlockMapper seatBlockMapper = mock(SeatBlockMapper.class);
        TicketGroupMapper ticketGroupMapper = mock(TicketGroupMapper.class);
        TicketSalesInternalService service = service(ticketTypeMapper, sessionSeatMapper, seatBlockMapper, ticketGroupMapper);
        TicketType ticketType = ticketType(4001L, "站区票", new BigDecimal("280.00"));
        SeatBlock standingBlock = new SeatBlock();
        standingBlock.setId(7001L);
        standingBlock.setTicketGroupKey("standing-1");
        TicketGroup standingGroup = new TicketGroup();
        standingGroup.setName("站区票");
        standingGroup.setActivityPrice(new BigDecimal("280.00"));
        when(ticketTypeMapper.selectById(4001L)).thenReturn(ticketType);
        when(sessionSeatMapper.selectRandomAvailableSeatIds(3001L, 4001L, 2)).thenReturn(List.of());

        TicketSalesLockRequest request = lockRequest(null, 2);
        request.setAllocateRandom(true);

        BusinessException exception = assertThrows(BusinessException.class, () -> service.lockSeats(request));

        assertEquals("票档库存不足", exception.getMessage());
        verify(seatBlockMapper, never()).selectList(any(LambdaQueryWrapper.class));
        verify(ticketGroupMapper, never()).selectOne(any(LambdaQueryWrapper.class));
        verify(ticketTypeMapper, never()).decreaseRemainStockIfEnough(4001L, 2);
    }

    @Test
    void lockSeatsDoesNotFallbackForSeatedTicketTypeWhenRealSeatsAreInsufficient() {
        TicketTypeMapper ticketTypeMapper = mock(TicketTypeMapper.class);
        SessionSeatMapper sessionSeatMapper = mock(SessionSeatMapper.class);
        SeatBlockMapper seatBlockMapper = mock(SeatBlockMapper.class);
        TicketGroupMapper ticketGroupMapper = mock(TicketGroupMapper.class);
        TicketSalesInternalService service = service(ticketTypeMapper, sessionSeatMapper, seatBlockMapper, ticketGroupMapper);
        when(ticketTypeMapper.selectById(4001L)).thenReturn(ticketType(4001L, "A区票", new BigDecimal("380.00")));
        when(sessionSeatMapper.selectRandomAvailableSeatIds(3001L, 4001L, 2)).thenReturn(List.of(601L));
        when(seatBlockMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());

        TicketSalesLockRequest request = lockRequest(null, 2);
        request.setAllocateRandom(true);

        BusinessException exception = assertThrows(BusinessException.class, () -> service.lockSeats(request));

        assertEquals("票档库存不足", exception.getMessage());
        verify(ticketTypeMapper, never()).decreaseRemainStockIfEnough(4001L, 2);
        verify(sessionSeatMapper, never()).lockSeat(any(), any(), any(), any());
    }

    @Test
    void lockStockThrowsWhenInsufficientStock() {
        TicketTypeMapper ticketTypeMapper = mock(TicketTypeMapper.class);
        TicketSalesInternalService service = service(ticketTypeMapper, mock(SessionSeatMapper.class));
        when(ticketTypeMapper.decreaseRemainStockIfEnough(4001L, 2)).thenReturn(0);

        TicketSalesLockRequest request = lockRequest(null, 2);

        BusinessException exception = assertThrows(BusinessException.class, () -> service.lockStock(request));

        assertEquals("票档库存不足", exception.getMessage());
    }

    @Test
    void confirmSoldMarksSeats() {
        SessionSeatMapper sessionSeatMapper = mock(SessionSeatMapper.class);
        TicketSalesInternalService service = service(mock(TicketTypeMapper.class), sessionSeatMapper);

        TicketSalesOrderRequest request = new TicketSalesOrderRequest();
        request.setOrderId(88L);
        request.setSessionId(3001L);
        request.setTicketTypeId(4001L);
        request.setSeatIds(List.of(501L, 502L));

        service.confirmSold(request);

        verify(sessionSeatMapper).markSeatSold(501L, 3001L, 88L);
        verify(sessionSeatMapper).markSeatSold(502L, 3001L, 88L);
    }

    @Test
    void quoteReturnsTourStationAndSeatLabels() {
        TicketTypeMapper ticketTypeMapper = mock(TicketTypeMapper.class);
        SessionMapper sessionMapper = mock(SessionMapper.class);
        ActivityMapper activityMapper = mock(ActivityMapper.class);
        VenueMapper venueMapper = mock(VenueMapper.class);
        SessionSeatMapper sessionSeatMapper = mock(SessionSeatMapper.class);
        TicketSalesInternalService service = new TicketSalesInternalService(
                ticketTypeMapper, sessionMapper, activityMapper, venueMapper, sessionSeatMapper);

        TicketType ticketType = new TicketType();
        ticketType.setId(4001L);
        ticketType.setSessionId(3001L);
        ticketType.setName("看台A");
        ticketType.setPrice(new BigDecimal("380.00"));
        ticketType.setStatus(1);
        when(ticketTypeMapper.selectById(4001L)).thenReturn(ticketType);
        when(sessionSeatMapper.selectSessionSellable(3001L)).thenReturn(true);

        Session session = new Session();
        session.setId(3001L);
        session.setActivityId(2001L);
        session.setVenueId(1001L);
        session.setStartTime(LocalDateTime.of(2026, 6, 22, 19, 30));
        when(sessionMapper.selectById(3001L)).thenReturn(session);

        Activity activity = new Activity();
        activity.setId(2001L);
        activity.setName("巡演北京站");
        activity.setPoster("poster.jpg");
        activity.setTourId(9001L);
        activity.setStationId(9101L);
        when(activityMapper.selectById(2001L)).thenReturn(activity);

        Venue venue = new Venue();
        venue.setId(1001L);
        venue.setName("国家体育馆");
        when(venueMapper.selectById(1001L)).thenReturn(venue);
        when(sessionSeatMapper.selectSeatLabelsByIds(List.of(501L, 502L))).thenReturn(List.of("A-1", "A-2"));

        TicketSalesQuoteRequest request = new TicketSalesQuoteRequest();
        request.setSessionId(3001L);
        request.setTicketTypeId(4001L);
        request.setSeatIds(List.of(501L, 502L));

        TicketSalesQuoteResponse response = service.quote(request);

        assertEquals(9001L, response.getTourId());
        assertEquals(9101L, response.getStationId());
        assertEquals("A-1, A-2", response.getSeatLabels());
        assertEquals("国家体育馆", response.getVenueName());
    }

    @Test
    void quoteReturnsPerUserLimitFromActivity() {
        TicketTypeMapper ticketTypeMapper = mock(TicketTypeMapper.class);
        SessionMapper sessionMapper = mock(SessionMapper.class);
        ActivityMapper activityMapper = mock(ActivityMapper.class);
        VenueMapper venueMapper = mock(VenueMapper.class);
        SessionSeatMapper sessionSeatMapper = mock(SessionSeatMapper.class);
        TicketSalesInternalService service = new TicketSalesInternalService(
                ticketTypeMapper, sessionMapper, activityMapper, venueMapper, sessionSeatMapper);

        TicketType ticketType = new TicketType();
        ticketType.setId(3001L);
        ticketType.setSessionId(2001L);
        ticketType.setName("看台");
        ticketType.setPrice(new BigDecimal("380.00"));
        ticketType.setStatus(1);
        when(ticketTypeMapper.selectById(3001L)).thenReturn(ticketType);
        when(sessionSeatMapper.selectSessionSellable(2001L)).thenReturn(true);

        Session session = new Session();
        session.setId(2001L);
        session.setActivityId(1001L);
        when(sessionMapper.selectById(2001L)).thenReturn(session);

        Activity activity = new Activity();
        activity.setId(1001L);
        activity.setName("南京站");
        activity.setPerUserLimit(2);
        when(activityMapper.selectById(1001L)).thenReturn(activity);

        TicketSalesQuoteRequest request = new TicketSalesQuoteRequest();
        request.setSessionId(2001L);
        request.setTicketTypeId(3001L);
        request.setQuantity(1);

        TicketSalesQuoteResponse response = service.quote(request);

        assertEquals(2, response.getPerUserLimit());
    }

    private TicketSalesInternalService service(TicketTypeMapper ticketTypeMapper, SessionSeatMapper sessionSeatMapper) {
        when(sessionSeatMapper.selectSessionSellable(3001L)).thenReturn(true);
        return new TicketSalesInternalService(
                ticketTypeMapper, mock(SessionMapper.class), mock(ActivityMapper.class),
                mock(VenueMapper.class), sessionSeatMapper);
    }

    private TicketSalesInternalService service(TicketTypeMapper ticketTypeMapper,
                                               SessionSeatMapper sessionSeatMapper,
                                               SeatBlockMapper seatBlockMapper,
                                               TicketGroupMapper ticketGroupMapper) {
        when(sessionSeatMapper.selectSessionSellable(3001L)).thenReturn(true);
        return new TicketSalesInternalService(
                ticketTypeMapper, mock(SessionMapper.class), mock(ActivityMapper.class),
                mock(VenueMapper.class), sessionSeatMapper, seatBlockMapper, ticketGroupMapper);
    }

    private TicketType ticketType(Long id, String name, BigDecimal price) {
        TicketType ticketType = new TicketType();
        ticketType.setId(id);
        ticketType.setSessionId(3001L);
        ticketType.setName(name);
        ticketType.setPrice(price);
        ticketType.setStatus(1);
        return ticketType;
    }

    private TicketSalesLockRequest lockRequest(List<Long> seatIds, Integer quantity) {
        TicketSalesLockRequest request = new TicketSalesLockRequest();
        request.setOrderId(88L);
        request.setSessionId(3001L);
        request.setTicketTypeId(4001L);
        request.setSeatIds(seatIds);
        request.setQuantity(quantity);
        request.setLockExpireTime(LocalDateTime.now().plusMinutes(15));
        return request;
    }
}
