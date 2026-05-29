package com.omni.order.service;

import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.order.client.TicketSalesInternalClient;
import com.omni.order.dto.MarkPartialRefundedRequest;
import com.omni.order.entity.Order;
import com.omni.order.mapper.OrderMapper;
import com.omni.order.mapper.OrderSeatMapper;
import io.seata.spring.annotation.GlobalTransactional;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OrderSeataCancelRefundTest {

    @Test
    void cancelOrderHasGlobalTransactionalRollbackForException() throws Exception {
        Method method = OrderService.class.getMethod("cancelOrder", Long.class);

        GlobalTransactional annotation = method.getAnnotation(GlobalTransactional.class);

        assertNotNull(annotation);
        assertEquals("omni-cancel-order", annotation.name());
        assertTrue(Arrays.asList(annotation.rollbackFor()).contains(Exception.class));
    }

    @Test
    void markRefundedHasGlobalTransactionalRollbackForException() throws Exception {
        Method method = OrderService.class.getMethod("markRefunded", Long.class);

        GlobalTransactional annotation = method.getAnnotation(GlobalTransactional.class);

        assertNotNull(annotation);
        assertEquals("omni-mark-refunded", annotation.name());
        assertTrue(Arrays.asList(annotation.rollbackFor()).contains(Exception.class));
    }

    @Test
    void markPartialRefundedHasGlobalTransactionalRollbackForException() throws Exception {
        Method method = OrderService.class.getMethod("markPartialRefunded", Long.class, MarkPartialRefundedRequest.class);

        GlobalTransactional globalTransactional = method.getAnnotation(GlobalTransactional.class);
        Transactional transactional = method.getAnnotation(Transactional.class);

        assertNotNull(globalTransactional);
        assertEquals("omni-mark-partial-refunded", globalTransactional.name());
        assertTrue(Arrays.asList(globalTransactional.rollbackFor()).contains(Exception.class));
        assertNotNull(transactional);
        assertTrue(Arrays.asList(transactional.rollbackFor()).contains(Exception.class));
    }

    @Test
    void cancelOrderThrowsWhenTicketReleaseFails() {
        OrderMapper orderMapper = mock(OrderMapper.class);
        OrderSeatMapper orderSeatMapper = mock(OrderSeatMapper.class);
        TicketSalesInternalClient ticketSalesInternalClient = mock(TicketSalesInternalClient.class);
        OrderService service = new OrderService(orderMapper, orderSeatMapper, null, null, ticketSalesInternalClient);
        Order order = pendingOrder(10L);
        when(orderMapper.selectById(10L)).thenReturn(order);
        when(orderMapper.updateStatusIfCurrent(10L, OrderService.STATUS_PENDING, OrderService.STATUS_CANCELLED)).thenReturn(1);
        when(orderSeatMapper.selectList(any())).thenReturn(List.of());
        when(ticketSalesInternalClient.release(any(), anyString())).thenReturn(Result.fail(ResultCode.INTERNAL_ERROR.getCode(), "票务释放失败"));

        BusinessException error = assertThrows(BusinessException.class, () -> service.cancelOrder(10L));

        assertEquals("票务释放失败", error.getMessage());
    }

    @Test
    void markRefundedThrowsWhenTicketRefundFails() {
        OrderMapper orderMapper = mock(OrderMapper.class);
        OrderSeatMapper orderSeatMapper = mock(OrderSeatMapper.class);
        TicketSalesInternalClient ticketSalesInternalClient = mock(TicketSalesInternalClient.class);
        OrderService service = new OrderService(orderMapper, orderSeatMapper, null, null, ticketSalesInternalClient);
        Order order = paidOrder(10L);
        when(orderMapper.selectById(10L)).thenReturn(order);
        when(orderSeatMapper.selectList(any())).thenReturn(List.of());
        when(ticketSalesInternalClient.refund(any(), anyString())).thenReturn(Result.fail(ResultCode.INTERNAL_ERROR.getCode(), "票务退款失败"));

        BusinessException error = assertThrows(BusinessException.class, () -> service.markRefunded(10L));

        assertEquals("票务退款失败", error.getMessage());
    }

    private Order pendingOrder(Long id) {
        Order order = baseOrder(id);
        order.setStatus(OrderService.STATUS_PENDING);
        return order;
    }

    private Order paidOrder(Long id) {
        Order order = baseOrder(id);
        order.setStatus(OrderService.STATUS_PAID);
        return order;
    }

    private Order baseOrder(Long id) {
        Order order = new Order();
        order.setId(id);
        order.setOrderNo("DM1001");
        order.setUserId(2004L);
        order.setSessionId(300L);
        order.setTicketTypeId(400L);
        order.setQuantity(1);
        order.setAmount(new BigDecimal("280.00"));
        return order;
    }
}
