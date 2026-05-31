package com.omni.order.controller;

import com.omni.common.result.Result;
import com.omni.order.dto.CreateOrderRequest;
import com.omni.order.dto.LockSeatsRequest;
import com.omni.order.entity.Order;
import com.omni.order.service.OrderService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrderControllerPublicAuthTest {
    private static final String SECRET = "omni-jwt-secretomni-jwt-secretomni-jwt-secret";

    @Test
    void publicCreateOrderUsesJwtUserIdInsteadOfBodyUserId() {
        OrderService orderService = mock(OrderService.class);
        when(orderService.createOrder(any(CreateOrderRequest.class))).thenAnswer(invocation -> {
            CreateOrderRequest request = invocation.getArgument(0);
            Order order = new Order();
            order.setId(9001L);
            order.setUserId(request.getUserId());
            return order;
        });
        OrderController controller = new OrderController(orderService, "internal-token", SECRET);
        CreateOrderRequest request = new CreateOrderRequest();
        request.setUserId(9999L);
        request.setSessionId(3L);
        request.setTicketTypeId(91L);
        request.setQuantity(1);

        Result<Order> result = controller.createOrder(request, bearer(2004L));

        assertEquals(200, result.getCode());
        assertEquals(2004L, result.getData().getUserId());
        verify(orderService).createOrder(argThat(argument -> argument.getUserId().equals(2004L)));
    }

    @Test
    void publicCreateOrderRejectsMissingJwt() {
        OrderService orderService = mock(OrderService.class);
        OrderController controller = new OrderController(orderService, "internal-token", SECRET);

        Result<Order> result = controller.createOrder(new CreateOrderRequest(), null);

        assertEquals(401, result.getCode());
        verify(orderService, never()).createOrder(any());
    }

    @Test
    void publicCreateOrderWithSeatsUsesJwtUserIdInsteadOfBodyUserId() {
        OrderService orderService = mock(OrderService.class);
        when(orderService.createOrderWithSeats(any(LockSeatsRequest.class))).thenAnswer(invocation -> {
            LockSeatsRequest request = invocation.getArgument(0);
            Order order = new Order();
            order.setId(9002L);
            order.setUserId(request.getUserId());
            return order;
        });
        OrderController controller = new OrderController(orderService, "internal-token", SECRET);
        LockSeatsRequest request = new LockSeatsRequest();
        request.setUserId(9999L);
        request.setSessionId(3L);
        request.setTicketTypeId(91L);
        request.setSeatIds(List.of(1L));
        request.setQuantity(1);

        Result<Order> result = controller.createOrderWithSeats(request, bearer(2004L));

        assertEquals(200, result.getCode());
        assertEquals(2004L, result.getData().getUserId());
        verify(orderService).createOrderWithSeats(argThat(argument -> argument.getUserId().equals(2004L)));
    }

    @Test
    void publicListOrdersUsesJwtUserId() {
        OrderService orderService = mock(OrderService.class);
        OrderController controller = new OrderController(orderService, "internal-token", SECRET);

        controller.listOrders(bearer(2004L));

        verify(orderService).listOrderItems(2004L);
    }

    @Test
    void publicListOrdersRejectsMissingJwt() {
        OrderService orderService = mock(OrderService.class);
        OrderController controller = new OrderController(orderService, "internal-token", SECRET);

        Result<List<com.omni.order.dto.OrderListItemResponse>> result = controller.listOrders(null);

        assertEquals(401, result.getCode());
        verify(orderService, never()).listOrderItems(any());
    }

    @Test
    void publicTrashOrdersUsesJwtUserId() {
        OrderService orderService = mock(OrderService.class);
        OrderController controller = new OrderController(orderService, "internal-token", SECRET);

        controller.listTrashOrders(bearer(2004L));

        verify(orderService).listTrashOrderItems(2004L);
    }

    @Test
    void publicHideOrderUsesJwtUserId() {
        OrderService orderService = mock(OrderService.class);
        OrderController controller = new OrderController(orderService, "internal-token", SECRET);

        controller.hideOrder(9001L, bearer(2004L));

        verify(orderService).hideOrder(9001L, 2004L);
    }

    @Test
    void publicRestoreOrderUsesJwtUserId() {
        OrderService orderService = mock(OrderService.class);
        OrderController controller = new OrderController(orderService, "internal-token", SECRET);

        controller.restoreOrder(9001L, bearer(2004L));

        verify(orderService).restoreOrder(9001L, 2004L);
    }

    @Test
    void publicRefundOptionsUsesJwtUserId() {
        OrderService orderService = mock(OrderService.class);
        OrderController controller = new OrderController(orderService, "internal-token", SECRET);

        controller.getRefundOptions(9001L, bearer(2004L));

        verify(orderService).getUserRefundOptions(9001L, 2004L);
    }

    @Test
    void publicCancelOrderUsesJwtUserId() {
        OrderService orderService = mock(OrderService.class);
        OrderController controller = new OrderController(orderService, "internal-token", SECRET);

        controller.cancelOrder(9001L, bearer(2004L));

        verify(orderService).cancelUserOrder(9001L, 2004L);
    }

    private static String bearer(Long userId) {
        Key key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        String token = Jwts.builder()
                .claim("userId", userId)
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
        return "Bearer " + token;
    }
}
