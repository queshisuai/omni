package com.omni.order.service;

import com.omni.order.dto.SessionSeatUsageItemResponse;
import com.omni.order.dto.SessionSeatUsageResponse;
import com.omni.order.entity.Order;
import com.omni.order.entity.OrderSeat;
import com.omni.order.mapper.OrderMapper;
import com.omni.order.mapper.OrderSeatMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderServiceSeatUsageTest {

    @Mock
    private OrderMapper orderMapper;

    @Mock
    private OrderSeatMapper orderSeatMapper;

    private OrderService service;

    @BeforeEach
    void setUp() {
        service = new OrderService(orderMapper, orderSeatMapper);
    }

    @Test
    void inspectSessionSeatUsageReturnsEmptyForNullOrEmptyInput() {
        assertTrue(service.inspectSessionSeatUsage(null).getSeats().isEmpty());
        assertTrue(service.inspectSessionSeatUsage(List.of()).getSeats().isEmpty());

        verify(orderSeatMapper, never()).selectList(any());
    }

    @Test
    void inspectSessionSeatUsageDeduplicatesInputAndMarksUsedSeatsNotEditable() {
        OrderSeat usedSeat = orderSeat(1L, 101L, 11L, 2);
        OrderSeat duplicateUsedSeat = orderSeat(2L, 102L, 11L, 1);
        duplicateUsedSeat.setLockExpireTime(LocalDateTime.now().plusMinutes(5));
        Order paidOrder = order(101L, OrderService.STATUS_PAID);
        Order pendingOrder = order(102L, OrderService.STATUS_PENDING);
        when(orderSeatMapper.selectList(any())).thenReturn(List.of(usedSeat, duplicateUsedSeat));
        when(orderMapper.selectBatchIds(List.of(101L, 102L))).thenReturn(List.of(paidOrder, pendingOrder));

        SessionSeatUsageResponse response = service.inspectSessionSeatUsage(Arrays.asList(11L, null, 12L, 11L));

        assertEquals(2, response.getSeats().size());
        SessionSeatUsageItemResponse first = response.getSeats().get(0);
        assertEquals(11L, first.getSessionSeatId());
        assertTrue(first.getUsedByOrder());
        assertFalse(first.getEditable());
        assertEquals(101L, first.getOrderId());
        assertEquals(2, first.getOrderSeatStatus());

        SessionSeatUsageItemResponse second = response.getSeats().get(1);
        assertEquals(12L, second.getSessionSeatId());
        assertFalse(second.getUsedByOrder());
        assertTrue(second.getEditable());
        assertNull(second.getOrderId());
        assertNull(second.getOrderSeatStatus());

        verify(orderSeatMapper).selectList(any());
    }

    @Test
    void inspectSessionSeatUsageTreatsRefundedAndReleasedSeatsAsEditable() {
        OrderSeat refundedSeat = orderSeat(1L, 101L, 11L, 3);
        OrderSeat releasedSeat = orderSeat(2L, 102L, 12L, 4);
        Order refundedOrder = order(101L, OrderService.STATUS_REFUNDED);
        Order cancelledOrder = order(102L, OrderService.STATUS_CANCELLED);
        when(orderSeatMapper.selectList(any())).thenReturn(List.of(refundedSeat, releasedSeat));
        when(orderMapper.selectBatchIds(List.of(101L, 102L))).thenReturn(List.of(refundedOrder, cancelledOrder));

        SessionSeatUsageResponse response = service.inspectSessionSeatUsage(List.of(11L, 12L));

        assertEquals(2, response.getSeats().size());
        SessionSeatUsageItemResponse refunded = response.getSeats().get(0);
        assertEquals(11L, refunded.getSessionSeatId());
        assertFalse(refunded.getUsedByOrder());
        assertTrue(refunded.getEditable());
        assertNull(refunded.getOrderId());
        assertNull(refunded.getOrderSeatStatus());

        SessionSeatUsageItemResponse released = response.getSeats().get(1);
        assertEquals(12L, released.getSessionSeatId());
        assertFalse(released.getUsedByOrder());
        assertTrue(released.getEditable());
        assertNull(released.getOrderId());
        assertNull(released.getOrderSeatStatus());
    }

    @Test
    void inspectSessionSeatUsagePrefersCurrentOccupancyOverRefundedHistory() {
        OrderSeat refundedSeat = orderSeat(1L, 101L, 11L, 3);
        OrderSeat lockedSeat = orderSeat(2L, 102L, 11L, 1);
        lockedSeat.setLockExpireTime(LocalDateTime.now().plusMinutes(5));
        Order refundedOrder = order(101L, OrderService.STATUS_REFUNDED);
        Order pendingOrder = order(102L, OrderService.STATUS_PENDING);
        when(orderSeatMapper.selectList(any())).thenReturn(List.of(refundedSeat, lockedSeat));
        when(orderMapper.selectBatchIds(List.of(101L, 102L))).thenReturn(List.of(refundedOrder, pendingOrder));

        SessionSeatUsageResponse response = service.inspectSessionSeatUsage(List.of(11L));

        assertEquals(1, response.getSeats().size());
        SessionSeatUsageItemResponse seat = response.getSeats().get(0);
        assertEquals(11L, seat.getSessionSeatId());
        assertTrue(seat.getUsedByOrder());
        assertFalse(seat.getEditable());
        assertEquals(102L, seat.getOrderId());
        assertEquals(1, seat.getOrderSeatStatus());
    }

    @Test
    void inspectSessionSeatUsageIgnoresSeatsFromCancelledOrders() {
        OrderSeat cancelledOrderSeat = orderSeat(1L, 101L, 11L, 2);
        Order cancelledOrder = order(101L, OrderService.STATUS_CANCELLED);
        when(orderSeatMapper.selectList(any())).thenReturn(List.of(cancelledOrderSeat));
        when(orderMapper.selectBatchIds(List.of(101L))).thenReturn(List.of(cancelledOrder));

        SessionSeatUsageResponse response = service.inspectSessionSeatUsage(List.of(11L));

        assertEquals(1, response.getSeats().size());
        SessionSeatUsageItemResponse seat = response.getSeats().get(0);
        assertEquals(11L, seat.getSessionSeatId());
        assertFalse(seat.getUsedByOrder());
        assertTrue(seat.getEditable());
        assertNull(seat.getOrderId());
        assertNull(seat.getOrderSeatStatus());
    }

    @Test
    void inspectSessionSeatUsageReturnsEmptyWhenOnlyNullIdsProvided() {
        SessionSeatUsageResponse response = service.inspectSessionSeatUsage(Arrays.asList(null, null));

        assertTrue(response.getSeats().isEmpty());
        verify(orderSeatMapper, never()).selectList(any());
    }

    private OrderSeat orderSeat(Long id, Long orderId, Long sessionSeatId, Integer status) {
        OrderSeat seat = new OrderSeat();
        seat.setId(id);
        seat.setOrderId(orderId);
        seat.setSessionSeatId(sessionSeatId);
        seat.setStatus(status);
        return seat;
    }

    private Order order(Long id, Integer status) {
        Order order = new Order();
        order.setId(id);
        order.setStatus(status);
        return order;
    }
}
