package com.omni.order.controller;

import com.omni.common.result.Result;
import com.omni.order.dto.CreateOrderRequest;
import com.omni.order.dto.LockSeatsRequest;
import com.omni.order.dto.MarkPartialRefundedRequest;
import com.omni.order.dto.OrderListItemResponse;
import com.omni.order.dto.PaidOrderCountRequest;
import com.omni.order.dto.PaidOrderCountResponse;
import com.omni.order.dto.PaidOrdersBySessionsRequest;
import com.omni.order.dto.RefundOptionsResponse;
import com.omni.order.dto.SessionSeatUsageRequest;
import com.omni.order.dto.SessionSeatUsageResponse;
import com.omni.order.entity.Order;
import com.omni.order.service.OrderService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 订单接口
 */
@RestController
@RequestMapping("/api/order")
public class OrderController {

    private final OrderService orderService;
    private final String internalApiToken;

    public OrderController(OrderService orderService,
                           @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.orderService = orderService;
        this.internalApiToken = internalApiToken;
    }

    /**
     * 创建订单
     */
    @PostMapping("/create")
    public Result<Order> createOrder(@RequestBody CreateOrderRequest request) {
        Order order = orderService.createOrder(request);
        return Result.success(order);
    }

    @PostMapping("/create-with-seats")
    public Result<Order> createOrderWithSeats(@RequestBody LockSeatsRequest request) {
        return Result.success(orderService.createOrderWithSeats(request));
    }

    /**
     * 用户订单列表
     */
    @GetMapping("/user/{userId}")
    public Result<List<OrderListItemResponse>> listOrders(@PathVariable Long userId) {
        List<OrderListItemResponse> orders = orderService.listOrderItems(userId);
        return Result.success(orders);
    }

    @GetMapping("/user/{userId}/trash")
    public Result<List<OrderListItemResponse>> listTrashOrders(@PathVariable Long userId) {
        return Result.success(orderService.listTrashOrderItems(userId));
    }

    @PostMapping("/{id}/hide")
    public Result<Void> hideOrder(@PathVariable Long id, @RequestParam Long userId) {
        orderService.hideOrder(id, userId);
        return Result.success();
    }

    @PostMapping("/{id}/restore")
    public Result<Void> restoreOrder(@PathVariable Long id, @RequestParam Long userId) {
        orderService.restoreOrder(id, userId);
        return Result.success();
    }

    /**
     * 订单详情
     */
    @GetMapping("/{id}")
    public Result<Order> getOrderDetail(@PathVariable Long id) {
        Order order = orderService.getOrderDetail(id);
        return Result.success(order);
    }

    @GetMapping("/{id}/refund-options")
    public Result<RefundOptionsResponse> getRefundOptions(@PathVariable Long id, @RequestParam Long userId) {
        return Result.success(orderService.getUserRefundOptions(id, userId));
    }

    /**
     * 内部订单详情
     */
    @GetMapping("/internal/{id}")
    public Result<OrderListItemResponse> getInternalOrderDetail(@PathVariable Long id,
                                                                @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        return Result.success(orderService.getOrderItemDetail(id));
    }

    @GetMapping("/internal/{id}/refund-options")
    public Result<RefundOptionsResponse> getInternalRefundOptions(@PathVariable Long id,
            @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        return Result.success(orderService.getRefundOptions(id));
    }

    @PostMapping("/internal/paid-by-sessions")
    public Result<List<Order>> listInternalPaidOrdersBySessions(
            @RequestBody(required = false) PaidOrdersBySessionsRequest request,
            @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        List<Long> sessionIds = request != null ? request.getSessionIds() : java.util.Collections.emptyList();
        boolean paidOnly = request == null || !Boolean.FALSE.equals(request.getPaidOnly());
        return Result.success(orderService.listOrdersBySessions(sessionIds, paidOnly));
    }

    @PostMapping("/internal/paid-count-by-sessions")
    public Result<PaidOrderCountResponse> countInternalPaidOrdersBySessions(
            @RequestBody(required = false) PaidOrderCountRequest request,
            @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        List<Long> sessionIds = request != null ? request.getSessionIds() : java.util.Collections.emptyList();
        return Result.success(new PaidOrderCountResponse(orderService.countPaidOrdersBySessions(sessionIds)));
    }

    @PostMapping("/internal/session-seats/usage")
    public Result<SessionSeatUsageResponse> inspectInternalSessionSeatUsage(
            @RequestBody(required = false) SessionSeatUsageRequest request,
            @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        List<Long> sessionSeatIds = request != null ? request.getSessionSeatIds() : java.util.Collections.emptyList();
        return Result.success(orderService.inspectSessionSeatUsage(sessionSeatIds));
    }

    /**
     * 取消订单
     */
    @DeleteMapping("/{id}")
    public Result<Void> cancelOrder(@PathVariable Long id) {
        orderService.cancelOrder(id);
        return Result.success();
    }

    /**
     * 旧沙盒支付接口已禁用，避免绕过支付宝支付。
     */
    @PostMapping("/{id}/pay")
    public Result<Void> initiatePay(@PathVariable Long id) {
        return Result.fail(400, "请通过支付宝支付");
    }

    /**
     * 内部支付回调：标记订单为已支付
     */
    @PostMapping("/internal/{id}/paid")
    public Result<Order> markInternalPaid(@PathVariable Long id,
                                            @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        Order order = orderService.markPaid(id);
        return Result.success(order);
    }

    /**
     * 内部退款回调：标记订单为已退款
     */
    @PostMapping("/internal/{id}/refunded")
    public Result<Order> markInternalRefunded(@PathVariable Long id,
                                                @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        Order order = orderService.markRefunded(id);
        return Result.success(order);
    }

    @PostMapping("/internal/{id}/partial-refunded")
    public Result<Order> markInternalPartialRefunded(@PathVariable Long id,
            @RequestBody MarkPartialRefundedRequest request,
            @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        return Result.success(orderService.markPartialRefunded(id, request));
    }

    private boolean isValidInternalToken(String token) {
        return StringUtils.hasText(internalApiToken) && internalApiToken.equals(token);
    }
}
