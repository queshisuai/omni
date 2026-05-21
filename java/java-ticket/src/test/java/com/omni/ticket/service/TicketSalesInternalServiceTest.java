package com.omni.ticket.service;

import com.omni.exception.BusinessException;
import com.omni.ticket.dto.TicketSalesLockRequest;
import com.omni.ticket.dto.TicketSalesOrderRequest;
import com.omni.ticket.dto.TicketSalesQuoteRequest;
import com.omni.ticket.dto.TicketSalesQuoteResponse;
import com.omni.ticket.dto.TicketSalesSeatLockResponse;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.SessionSeatMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.mapper.VenueMapper;
import org.junit.jupiter.api.Test;

import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.Venue;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
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
    void lockStockDecreasesTicketTypeStock() {
        TicketTypeMapper ticketTypeMapper = mock(TicketTypeMapper.class);
        TicketSalesInternalService service = service(ticketTypeMapper, mock(SessionSeatMapper.class));
        when(ticketTypeMapper.decreaseRemainStockIfEnough(4001L, 2)).thenReturn(1);

        TicketSalesLockRequest request = lockRequest(null, 2);

        service.lockStock(request);

        verify(ticketTypeMapper).decreaseRemainStockIfEnough(4001L, 2);
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

    private TicketSalesInternalService service(TicketTypeMapper ticketTypeMapper, SessionSeatMapper sessionSeatMapper) {
        return new TicketSalesInternalService(
                ticketTypeMapper, mock(SessionMapper.class), mock(ActivityMapper.class),
                mock(VenueMapper.class), sessionSeatMapper);
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
