package com.omni.order.service;

import com.omni.order.mapper.OrderMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrderAdminStatsServiceTest {

    @Test
    void countPaidOrdersBySessionsReturnsMapperCountForNonEmptySessionIds() {
        OrderMapper orderMapper = mock(OrderMapper.class);
        OrderService orderService = new OrderService(orderMapper);
        List<Long> sessionIds = List.of(10L, 11L);
        when(orderMapper.countPaidOrdersBySessions(sessionIds)).thenReturn(3L);

        Long count = orderService.countPaidOrdersBySessions(sessionIds);

        assertEquals(3L, count);
        verify(orderMapper).countPaidOrdersBySessions(sessionIds);
    }

    @Test
    void countPaidOrdersBySessionsReturnsZeroForEmptyOrNullSessionIds() {
        OrderMapper orderMapper = mock(OrderMapper.class);
        OrderService orderService = new OrderService(orderMapper);

        assertEquals(0L, orderService.countPaidOrdersBySessions(List.of()));
        assertEquals(0L, orderService.countPaidOrdersBySessions(null));
        verify(orderMapper, never()).countPaidOrdersBySessions(any());
    }

    @Test
    void countPaidOrdersBySessionsReturnsZeroWhenMapperReturnsNull() {
        OrderMapper orderMapper = mock(OrderMapper.class);
        OrderService orderService = new OrderService(orderMapper);
        List<Long> sessionIds = List.of(10L);
        when(orderMapper.countPaidOrdersBySessions(sessionIds)).thenReturn(null);

        assertEquals(0L, orderService.countPaidOrdersBySessions(sessionIds));
    }
}
