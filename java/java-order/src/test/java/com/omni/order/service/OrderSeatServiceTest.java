package com.omni.order.service;

import com.omni.order.dto.LockSeatsRequest;
import com.omni.order.entity.Order;
import com.omni.order.entity.OrderSeat;
import com.omni.order.entity.SessionSeat;
import com.omni.order.entity.TicketType;
import com.omni.order.mapper.OrderMapper;
import com.omni.order.mapper.OrderSeatMapper;
import com.omni.order.mapper.SessionSeatMapper;
import com.omni.order.mapper.TicketTypeMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderSeatServiceTest {

    @Mock
    private OrderMapper orderMapper;

    @Mock
    private OrderSeatMapper orderSeatMapper;

    @Mock
    private SessionSeatMapper sessionSeatMapper;

    @Mock
    private TicketTypeMapper ticketTypeMapper;

    private OrderService service;

    @BeforeEach
    void setUp() {
        service = new OrderService(orderMapper, orderSeatMapper, sessionSeatMapper, ticketTypeMapper);
    }

    @Test
    void createOrderWithSeatsCreatesPendingOrderAndLocksSeats() {
        LockSeatsRequest request = new LockSeatsRequest();
        request.setUserId(2004L);
        request.setSessionId(101L);
        request.setTicketTypeId(1001L);
        request.setSeatIds(Arrays.asList(11L, 12L));
        request.setUnitPrice(new BigDecimal("280.00"));
        TicketType ticketType = new TicketType();
        ticketType.setId(1001L);
        ticketType.setPrice(new BigDecimal("280.00"));
        when(ticketTypeMapper.selectById(1001L)).thenReturn(ticketType);
        when(sessionSeatMapper.selectById(11L)).thenReturn(availableSessionSeat(11L, 101L));
        when(sessionSeatMapper.selectById(12L)).thenReturn(availableSessionSeat(12L, 101L));

        Order order = service.createOrderWithSeats(request);

        assertEquals(2, order.getQuantity());
        assertEquals(new BigDecimal("560.00"), order.getAmount());
        assertEquals(OrderService.STATUS_PENDING, order.getStatus());
        verify(orderMapper).insert(any());
    }

    @Test
    void cancelOrderReleasesLockedSeats() {
        Order order = pendingOrder(1001L, 101L, 2001L);
        OrderSeat orderSeat = lockedOrderSeat(9001L, order.getId(), 3001L, 101L, 2001L);
        SessionSeat sessionSeat = lockedSessionSeat(3001L, 101L, 2001L, order.getId());
        when(orderMapper.selectById(order.getId())).thenReturn(order);
        when(orderSeatMapper.selectList(any())).thenReturn(List.of(orderSeat));
        when(sessionSeatMapper.selectById(3001L)).thenReturn(sessionSeat);

        service.cancelOrder(order.getId());

        assertEquals(OrderService.STATUS_CANCELLED, order.getStatus());
        assertEquals(4, orderSeat.getStatus());
        assertEquals(1, sessionSeat.getStatus());
        assertEquals(null, sessionSeat.getOrderId());
        assertEquals(null, sessionSeat.getTicketTypeId());
        assertEquals(null, sessionSeat.getLockExpireTime());
        verify(orderMapper).updateById(order);
        verify(sessionSeatMapper).updateById(sessionSeat);
    }

    @Test
    void releaseExpiredSeatLocksMakesExpiredLockedSeatsAvailable() {
        Order order = pendingOrder(1002L, 102L, 2002L);
        OrderSeat expiredSeat = lockedOrderSeat(9002L, order.getId(), 3002L, 102L, 2002L);
        expiredSeat.setLockExpireTime(LocalDateTime.now().minusMinutes(1));
        SessionSeat sessionSeat = lockedSessionSeat(3002L, 102L, 2002L, order.getId());
        when(orderSeatMapper.selectList(any())).thenReturn(List.of(expiredSeat));
        when(orderMapper.selectById(order.getId())).thenReturn(order);
        when(sessionSeatMapper.selectById(3002L)).thenReturn(sessionSeat);

        int released = service.releaseExpiredSeatLocks();

        assertEquals(1, released);
        assertEquals(OrderService.STATUS_CANCELLED, order.getStatus());
        assertEquals(4, expiredSeat.getStatus());
        assertEquals(1, sessionSeat.getStatus());
        assertEquals(null, sessionSeat.getOrderId());
        assertEquals(null, sessionSeat.getTicketTypeId());
        assertEquals(null, sessionSeat.getLockExpireTime());
        verify(orderMapper).updateById(order);
        verify(sessionSeatMapper).updateById(sessionSeat);
    }

    @Test
    void markRefundedRestoresSoldSeatsWhenSessionStartsAfterTwentyFourHours() {
        Order order = paidOrder(1003L, 103L, 2003L);
        OrderSeat soldSeat = soldOrderSeat(9003L, order.getId(), 3003L, 103L, 2003L);
        SessionSeat sessionSeat = soldSessionSeat(3003L, 103L, 2003L, order.getId());
        when(orderMapper.selectById(order.getId())).thenReturn(order);
        when(orderSeatMapper.selectList(any())).thenReturn(List.of(soldSeat));
        when(sessionSeatMapper.selectById(3003L)).thenReturn(sessionSeat);
        when(sessionSeatMapper.selectSessionStartTime(103L)).thenReturn(LocalDateTime.now().plusHours(25));
        when(sessionSeatMapper.selectSessionSellable(103L)).thenReturn(true);
        when(ticketTypeMapper.selectTicketTypeSellable(2003L)).thenReturn(true);

        service.markRefunded(order.getId());

        assertEquals(1, sessionSeat.getStatus());
        assertEquals(null, sessionSeat.getOrderId());
        assertEquals(null, sessionSeat.getTicketTypeId());
        ArgumentCaptor<OrderSeat> captor = ArgumentCaptor.forClass(OrderSeat.class);
        verify(orderSeatMapper).updateById(captor.capture());
        assertEquals(3, captor.getValue().getStatus());
        verify(sessionSeatMapper).updateById(sessionSeat);
        verify(ticketTypeMapper).increaseRemainStock(2003L, 1);
    }

    @Test
    void markRefundedDoesNotRestoreSoldSeatsWithinTwentyFourHours() {
        Order order = paidOrder(1004L, 104L, 2004L);
        OrderSeat soldSeat = soldOrderSeat(9004L, order.getId(), 3004L, 104L, 2004L);
        SessionSeat sessionSeat = soldSessionSeat(3004L, 104L, 2004L, order.getId());
        when(orderMapper.selectById(order.getId())).thenReturn(order);
        when(orderSeatMapper.selectList(any())).thenReturn(List.of(soldSeat));
        when(sessionSeatMapper.selectById(3004L)).thenReturn(sessionSeat);
        when(sessionSeatMapper.selectSessionStartTime(104L)).thenReturn(LocalDateTime.now().plusHours(23));

        service.markRefunded(order.getId());

        assertEquals(4, sessionSeat.getStatus());
        assertEquals(order.getId(), sessionSeat.getOrderId());
        verify(sessionSeatMapper).updateById(sessionSeat);
        verify(ticketTypeMapper, times(0)).increaseRemainStock(2004L, 1);
    }

    private Order pendingOrder(Long id, Long sessionId, Long ticketTypeId) {
        Order order = baseOrder(id, sessionId, ticketTypeId);
        order.setStatus(OrderService.STATUS_PENDING);
        return order;
    }

    private Order paidOrder(Long id, Long sessionId, Long ticketTypeId) {
        Order order = baseOrder(id, sessionId, ticketTypeId);
        order.setStatus(OrderService.STATUS_PAID);
        return order;
    }

    private Order baseOrder(Long id, Long sessionId, Long ticketTypeId) {
        Order order = new Order();
        order.setId(id);
        order.setOrderNo("DM" + id);
        order.setUserId(2004L);
        order.setSessionId(sessionId);
        order.setTicketTypeId(ticketTypeId);
        order.setQuantity(1);
        order.setAmount(new BigDecimal("280.00"));
        return order;
    }

    private OrderSeat lockedOrderSeat(Long id, Long orderId, Long sessionSeatId, Long sessionId, Long ticketTypeId) {
        OrderSeat seat = orderSeat(id, orderId, sessionSeatId, sessionId, ticketTypeId);
        seat.setStatus(1);
        seat.setLockExpireTime(LocalDateTime.now().plusMinutes(15));
        return seat;
    }

    private OrderSeat soldOrderSeat(Long id, Long orderId, Long sessionSeatId, Long sessionId, Long ticketTypeId) {
        OrderSeat seat = orderSeat(id, orderId, sessionSeatId, sessionId, ticketTypeId);
        seat.setStatus(2);
        return seat;
    }

    private OrderSeat orderSeat(Long id, Long orderId, Long sessionSeatId, Long sessionId, Long ticketTypeId) {
        OrderSeat seat = new OrderSeat();
        seat.setId(id);
        seat.setOrderId(orderId);
        seat.setSessionSeatId(sessionSeatId);
        seat.setSessionId(sessionId);
        seat.setTicketTypeId(ticketTypeId);
        return seat;
    }

    private SessionSeat lockedSessionSeat(Long id, Long sessionId, Long ticketTypeId, Long orderId) {
        SessionSeat seat = sessionSeat(id, sessionId, ticketTypeId, orderId);
        seat.setStatus(2);
        seat.setLockExpireTime(LocalDateTime.now().plusMinutes(15));
        return seat;
    }

    private SessionSeat availableSessionSeat(Long id, Long sessionId) {
        SessionSeat seat = sessionSeat(id, sessionId, null, null);
        seat.setStatus(1);
        return seat;
    }

    private SessionSeat soldSessionSeat(Long id, Long sessionId, Long ticketTypeId, Long orderId) {
        SessionSeat seat = sessionSeat(id, sessionId, ticketTypeId, orderId);
        seat.setStatus(3);
        return seat;
    }

    private SessionSeat sessionSeat(Long id, Long sessionId, Long ticketTypeId, Long orderId) {
        SessionSeat seat = new SessionSeat();
        seat.setId(id);
        seat.setSessionId(sessionId);
        seat.setTicketTypeId(ticketTypeId);
        seat.setOrderId(orderId);
        return seat;
    }
}
