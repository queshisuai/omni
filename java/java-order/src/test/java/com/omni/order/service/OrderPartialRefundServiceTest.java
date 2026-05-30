package com.omni.order.service;

import com.omni.common.result.Result;
import com.omni.exception.BusinessException;
import com.omni.order.client.TicketSalesInternalClient;
import com.omni.order.dto.MarkPartialRefundedRequest;
import com.omni.order.dto.RefundOptionsResponse;
import com.omni.order.entity.Order;
import com.omni.order.entity.OrderSeat;
import com.omni.order.mapper.OrderMapper;
import com.omni.order.mapper.OrderSeatMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderPartialRefundServiceTest {

    @Mock
    private OrderMapper orderMapper;

    @Mock
    private OrderSeatMapper orderSeatMapper;

    @Mock
    private TicketSalesInternalClient ticketSalesInternalClient;

    private OrderService service;

    @BeforeEach
    void setUp() {
        service = new OrderService(orderMapper, orderSeatMapper, null, null, ticketSalesInternalClient);
    }

    @Test
    void markPartialRefundedRefundsSelectedSeatAndKeepsOrderPaid() {
        Order order = paidOrder(10L, 2);
        OrderSeat seat = soldSeat(900L, 800L);
        when(orderMapper.selectByIdForUpdate(10L)).thenReturn(order);
        when(orderSeatMapper.selectRefundableSeatsByOrderId(10L)).thenReturn(List.of(seat));
        when(orderSeatMapper.countRefundedSeatsByOrderId(10L)).thenReturn(0);
        when(orderSeatMapper.updateRefundedStatusByOrderIdAndIds(10L, List.of(900L))).thenReturn(1);
        when(ticketSalesInternalClient.refund(any(), anyString())).thenReturn(Result.success());

        MarkPartialRefundedRequest request = new MarkPartialRefundedRequest();
        request.setQuantity(1);
        request.setOrderSeatIds(List.of(900L));

        Order result = service.markPartialRefunded(10L, request);

        assertEquals(OrderService.STATUS_PAID, result.getStatus());
        verify(orderSeatMapper).updateRefundedStatusByOrderIdAndIds(10L, List.of(900L));
        verify(orderMapper, never()).updateById(any(Order.class));
        verify(ticketSalesInternalClient).refund(any(), anyString());
    }

    @Test
    void markPartialRefundedMarksOrderRefundedWhenAllTicketsRefunded() {
        Order order = paidOrder(10L, 2);
        OrderSeat first = soldSeat(900L, 800L);
        OrderSeat second = soldSeat(901L, 801L);
        when(orderMapper.selectByIdForUpdate(10L)).thenReturn(order);
        when(orderSeatMapper.selectRefundableSeatsByOrderId(10L)).thenReturn(List.of(first, second));
        when(orderSeatMapper.countRefundedSeatsByOrderId(10L)).thenReturn(0);
        when(orderSeatMapper.updateRefundedStatusByOrderIdAndIds(10L, List.of(900L, 901L))).thenReturn(2);
        when(ticketSalesInternalClient.refund(any(), anyString())).thenReturn(Result.success());

        MarkPartialRefundedRequest request = new MarkPartialRefundedRequest();
        request.setQuantity(2);
        request.setOrderSeatIds(List.of(900L, 901L));

        Order result = service.markPartialRefunded(10L, request);

        assertEquals(OrderService.STATUS_REFUNDED, result.getStatus());
        ArgumentCaptor<Order> captor = ArgumentCaptor.forClass(Order.class);
        verify(orderMapper).updateById(captor.capture());
        assertEquals(OrderService.STATUS_REFUNDED, captor.getValue().getStatus());
    }

    @Test
    void getUserRefundOptionsRejectsOtherUsersOrder() {
        Order order = paidOrder(10L, 2);
        order.setUserId(2004L);
        when(orderMapper.selectById(10L)).thenReturn(order);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.getUserRefundOptions(10L, 9999L));

        assertEquals("无权限操作该订单", ex.getMessage());
        verify(orderSeatMapper, never()).selectRefundableSeatsByOrderId(any());
    }

    @Test
    void markPartialRefundedRejectsQuantityMoreThanRefundable() {
        Order order = paidOrder(10L, 2);
        OrderSeat seat = soldSeat(900L, 800L);
        when(orderMapper.selectByIdForUpdate(10L)).thenReturn(order);
        when(orderSeatMapper.selectRefundableSeatsByOrderId(10L)).thenReturn(List.of(seat));
        when(orderSeatMapper.countRefundedSeatsByOrderId(10L)).thenReturn(1);

        MarkPartialRefundedRequest request = new MarkPartialRefundedRequest();
        request.setQuantity(2);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.markPartialRefunded(10L, request));

        assertEquals("可退款票数不足", ex.getMessage());
        verify(ticketSalesInternalClient, never()).refund(any(), anyString());
    }

    @Test
    void getRefundOptionsReturnsRefundableSeatsAndUnitPrice() {
        Order order = paidOrder(10L, 2);
        OrderSeat seat = soldSeat(900L, 800L);
        seat.setSeatLabel("A-1");
        when(orderMapper.selectById(10L)).thenReturn(order);
        when(orderSeatMapper.selectRefundableSeatsByOrderId(10L)).thenReturn(List.of(seat));
        when(orderSeatMapper.countRefundedSeatsByOrderId(10L)).thenReturn(1);

        RefundOptionsResponse response = service.getRefundOptions(10L);

        assertEquals(2, response.getTotalQuantity());
        assertEquals(1, response.getRefundedQuantity());
        assertEquals(1, response.getRefundableQuantity());
        assertEquals(new BigDecimal("380.00"), response.getUnitPrice());
        assertEquals(900L, response.getSeats().get(0).getOrderSeatId());
        assertEquals("A-1", response.getSeats().get(0).getSeatLabel());
    }

    @Test
    void quantityOnlyRefundPersistsProgressAndReducesRefundOptions() {
        Order order = paidOrder(10L, 2);
        when(orderMapper.selectById(10L)).thenReturn(order);
        when(orderMapper.selectByIdForUpdate(10L)).thenReturn(order);
        when(orderSeatMapper.selectRefundableSeatsByOrderId(10L)).thenReturn(List.of());
        when(orderSeatMapper.countRefundedSeatsByOrderId(10L)).thenReturn(0, 1);
        when(ticketSalesInternalClient.refund(any(), anyString())).thenReturn(Result.success());

        MarkPartialRefundedRequest request = new MarkPartialRefundedRequest();
        request.setQuantity(1);

        service.markPartialRefunded(10L, request);
        RefundOptionsResponse response = service.getRefundOptions(10L);

        assertEquals(1, response.getRefundedQuantity());
        assertEquals(1, response.getRefundableQuantity());
        verify(orderSeatMapper).insert(any(OrderSeat.class));
    }

    @Test
    void quantityOnlyRefundMarksOrderRefundedWhenAllTicketsRefunded() {
        Order order = paidOrder(10L, 2);
        when(orderMapper.selectByIdForUpdate(10L)).thenReturn(order);
        when(orderSeatMapper.selectRefundableSeatsByOrderId(10L)).thenReturn(List.of());
        when(orderSeatMapper.countRefundedSeatsByOrderId(10L)).thenReturn(1);
        when(ticketSalesInternalClient.refund(any(), anyString())).thenReturn(Result.success());

        MarkPartialRefundedRequest request = new MarkPartialRefundedRequest();
        request.setQuantity(1);

        Order result = service.markPartialRefunded(10L, request);

        assertEquals(OrderService.STATUS_REFUNDED, result.getStatus());
        verify(orderSeatMapper).insert(any(OrderSeat.class));
        verify(orderMapper).updateById(any(Order.class));
    }

    @Test
    void quantityOnlyRefundRejectsQuantityMoreThanRemaining() {
        Order order = paidOrder(10L, 2);
        when(orderMapper.selectByIdForUpdate(10L)).thenReturn(order);
        when(orderSeatMapper.selectRefundableSeatsByOrderId(10L)).thenReturn(List.of());
        when(orderSeatMapper.countRefundedSeatsByOrderId(10L)).thenReturn(1);

        MarkPartialRefundedRequest request = new MarkPartialRefundedRequest();
        request.setQuantity(2);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.markPartialRefunded(10L, request));

        assertEquals("可退款票数不足", ex.getMessage());
        verify(orderSeatMapper, never()).insert(any(OrderSeat.class));
        verify(ticketSalesInternalClient, never()).refund(any(), anyString());
    }

    @Test
    void seatRefundDoesNotCallTicketWhenConditionalUpdateMisses() {
        Order order = paidOrder(10L, 2);
        OrderSeat seat = soldSeat(900L, 800L);
        when(orderMapper.selectByIdForUpdate(10L)).thenReturn(order);
        when(orderSeatMapper.selectRefundableSeatsByOrderId(10L)).thenReturn(List.of(seat));
        when(orderSeatMapper.countRefundedSeatsByOrderId(10L)).thenReturn(0);
        when(orderSeatMapper.updateRefundedStatusByOrderIdAndIds(10L, List.of(900L))).thenReturn(0);

        MarkPartialRefundedRequest request = new MarkPartialRefundedRequest();
        request.setQuantity(1);
        request.setOrderSeatIds(List.of(900L));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.markPartialRefunded(10L, request));

        assertEquals("所选票已存在退款申请或已退款", ex.getMessage());
        verify(ticketSalesInternalClient, never()).refund(any(), anyString());
    }

    @Test
    void quantityOnlyRefundRecordsLocalProgressBeforeTicketRefund() {
        Order order = paidOrder(10L, 2);
        when(orderMapper.selectByIdForUpdate(10L)).thenReturn(order);
        when(orderSeatMapper.selectRefundableSeatsByOrderId(10L)).thenReturn(List.of());
        when(orderSeatMapper.countRefundedSeatsByOrderId(10L)).thenReturn(0);
        when(ticketSalesInternalClient.refund(any(), anyString())).thenReturn(Result.success());

        MarkPartialRefundedRequest request = new MarkPartialRefundedRequest();
        request.setQuantity(1);

        service.markPartialRefunded(10L, request);

        InOrder inOrder = inOrder(orderSeatMapper, ticketSalesInternalClient);
        inOrder.verify(orderSeatMapper).insert(any(OrderSeat.class));
        inOrder.verify(ticketSalesInternalClient).refund(any(), anyString());
    }

    @Test
    void markPartialRefundedPropagatesTicketRefundFailure() {
        Order order = paidOrder(10L, 2);
        when(orderMapper.selectByIdForUpdate(10L)).thenReturn(order);
        when(orderSeatMapper.selectRefundableSeatsByOrderId(10L)).thenReturn(List.of());
        when(orderSeatMapper.countRefundedSeatsByOrderId(10L)).thenReturn(0);
        when(ticketSalesInternalClient.refund(any(), anyString())).thenThrow(new IllegalStateException("ticket down"));

        MarkPartialRefundedRequest request = new MarkPartialRefundedRequest();
        request.setQuantity(1);

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> service.markPartialRefunded(10L, request));

        assertEquals("ticket down", ex.getMessage());
        verify(orderSeatMapper).insert(any(OrderSeat.class));
    }

    private Order paidOrder(Long id, int quantity) {
        Order order = new Order();
        order.setId(id);
        order.setUserId(2004L);
        order.setSessionId(300L);
        order.setTicketTypeId(400L);
        order.setQuantity(quantity);
        order.setAmount(new BigDecimal("760.00"));
        order.setStatus(OrderService.STATUS_PAID);
        return order;
    }

    private OrderSeat soldSeat(Long orderSeatId, Long sessionSeatId) {
        OrderSeat seat = new OrderSeat();
        seat.setId(orderSeatId);
        seat.setOrderId(10L);
        seat.setSessionSeatId(sessionSeatId);
        seat.setSessionId(300L);
        seat.setTicketTypeId(400L);
        seat.setStatus(2);
        return seat;
    }
}
