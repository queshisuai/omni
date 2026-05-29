package com.omni.order.service;

import com.omni.order.dto.OrderListItemResponse;
import com.omni.order.entity.Order;
import com.omni.order.mapper.OrderMapper;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrderListServiceTest {

    @Test
    void listOrderItemsReturnsSnapshotActivityTicketAndVenueData() {
        OrderMapper orderMapper = mock(OrderMapper.class);
        OrderListItemResponse item = new OrderListItemResponse();
        item.setId(10L);
        item.setOrderNo("REAL_ORDER_001");
        item.setUserId(2004L);
        item.setSessionId(1L);
        item.setTicketTypeId(3L);
        item.setQuantity(1);
        item.setAmount(new BigDecimal("380.00"));
        item.setStatus(OrderService.STATUS_PAID);
        item.setCreateTime(LocalDateTime.of(2026, 6, 1, 10, 0));
        item.setActivityId(1L);
        item.setActivityName("真实购票活动");
        item.setActivityPoster("poster.jpg");
        item.setVenueName("真实场馆");
        item.setSessionTime(LocalDateTime.of(2026, 6, 22, 19, 30));
        item.setTicketName("普通票");
        item.setUnitPrice(new BigDecimal("380.00"));
        when(orderMapper.selectVisibleOrderListItems(2004L)).thenReturn(Collections.singletonList(item));

        OrderService service = new OrderService(orderMapper);

        OrderListItemResponse result = service.listOrderItems(2004L).get(0);

        assertEquals("真实购票活动", result.getActivityName());
        assertEquals("真实场馆", result.getVenueName());
        assertEquals("普通票", result.getTicketName());
    }

    @Test
    void listOrderItemsReturnsGrabMatchedTicketSnapshot() {
        OrderMapper orderMapper = mock(OrderMapper.class);
        OrderListItemResponse item = new OrderListItemResponse();
        item.setId(10L);
        item.setGrabRequestId("GRAB1");
        item.setRequestedTicketTypeId(1L);
        item.setMatchedTicketTypeId(2L);
        item.setAutoDowngraded(true);
        when(orderMapper.selectVisibleOrderListItems(2004L)).thenReturn(Collections.singletonList(item));

        OrderService service = new OrderService(orderMapper);

        OrderListItemResponse result = service.listOrderItems(2004L).get(0);

        assertEquals("GRAB1", result.getGrabRequestId());
        assertEquals(1L, result.getRequestedTicketTypeId());
        assertEquals(2L, result.getMatchedTicketTypeId());
        assertEquals(Boolean.TRUE, result.getAutoDowngraded());
    }

    @Test
    void listOrderItemsExcludesTrashOrders() {
        OrderMapper orderMapper = mock(OrderMapper.class);
        when(orderMapper.selectVisibleOrderListItems(2004L)).thenReturn(List.of(new OrderListItemResponse()));

        OrderService service = new OrderService(orderMapper);

        assertEquals(1, service.listOrderItems(2004L).size());
        verify(orderMapper).selectVisibleOrderListItems(2004L);
        verify(orderMapper, never()).selectOrderListItems(2004L);
    }

    @Test
    void listTrashOrderItemsReturnsOnlyTrashOrders() {
        OrderMapper orderMapper = mock(OrderMapper.class);
        when(orderMapper.selectTrashOrderListItems(2004L)).thenReturn(List.of(new OrderListItemResponse()));

        OrderService service = new OrderService(orderMapper);

        assertEquals(1, service.listTrashOrderItems(2004L).size());
        verify(orderMapper).selectTrashOrderListItems(2004L);
    }

    @Test
    void hideOrderMovesCancelledOrderToTrashForSevenDays() {
        OrderMapper orderMapper = mock(OrderMapper.class);
        Order order = order(10L, 2004L, OrderService.STATUS_CANCELLED);
        when(orderMapper.selectById(10L)).thenReturn(order);

        OrderService service = new OrderService(orderMapper);
        service.hideOrder(10L, 2004L);

        assertTrue(order.getUserHidden());
        assertTrue(order.getUserDeletedAt().isBefore(order.getUserDeleteExpiresAt()));
        assertEquals(order.getUserDeletedAt().plusDays(7), order.getUserDeleteExpiresAt());
        verify(orderMapper).updateById(order);
    }

    @Test
    void hideOrderRejectsPaidOrderBeforeRefund() {
        OrderMapper orderMapper = mock(OrderMapper.class);
        Order order = order(10L, 2004L, OrderService.STATUS_PAID);
        when(orderMapper.selectById(10L)).thenReturn(order);

        OrderService service = new OrderService(orderMapper);

        assertThrows(RuntimeException.class, () -> service.hideOrder(10L, 2004L));
        verify(orderMapper, never()).updateById(any());
    }

    @Test
    void restoreOrderClearsTrashFields() {
        OrderMapper orderMapper = mock(OrderMapper.class);
        Order order = order(10L, 2004L, OrderService.STATUS_CANCELLED);
        order.setUserHidden(true);
        order.setUserDeletedAt(LocalDateTime.now().minusDays(1));
        order.setUserDeleteExpiresAt(LocalDateTime.now().plusDays(6));
        when(orderMapper.selectById(10L)).thenReturn(order);

        OrderService service = new OrderService(orderMapper);
        service.restoreOrder(10L, 2004L);

        assertFalse(order.getUserHidden());
        assertEquals(null, order.getUserDeletedAt());
        assertEquals(null, order.getUserDeleteExpiresAt());
        verify(orderMapper).updateById(order);
    }

    private Order order(Long id, Long userId, int status) {
        Order order = new Order();
        order.setId(id);
        order.setUserId(userId);
        order.setStatus(status);
        return order;
    }
}
