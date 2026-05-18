package com.omni.order.service;

import com.omni.order.dto.OrderListItemResponse;
import com.omni.order.mapper.OrderMapper;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OrderListServiceTest {

    @Test
    void listOrderItemsReturnsRealActivityTicketAndVenueData() {
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
        when(orderMapper.selectOrderListItems(2004L)).thenReturn(Collections.singletonList(item));

        OrderService service = new OrderService(orderMapper);

        OrderListItemResponse result = service.listOrderItems(2004L).get(0);

        assertEquals("真实购票活动", result.getActivityName());
        assertEquals("真实场馆", result.getVenueName());
        assertEquals("普通票", result.getTicketName());
    }
}
