package com.omni.order.controller;

import com.omni.common.result.Result;
import com.omni.order.dto.CreateOrderRequest;
import com.omni.order.dto.PaidOrdersBySessionsRequest;
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

    /**
     * 用户订单列表
     */
    @GetMapping("/user/{userId}")
    public Result<List<Order>> listOrders(@PathVariable Long userId) {
        List<Order> orders = orderService.listOrders(userId);
        return Result.success(orders);
    }

    /**
     * 订单详情
     */
    @GetMapping("/{id}")
    public Result<Order> getOrderDetail(@PathVariable Long id) {
        Order order = orderService.getOrderDetail(id);
        return Result.success(order);
    }

    /**
     * 内部订单详情
     */
    @GetMapping("/internal/{id}")
    public Result<Order> getInternalOrderDetail(@PathVariable Long id,
                                                  @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        Order order = orderService.getOrderDetail(id);
        return Result.success(order);
    }

    @PostMapping("/internal/paid-by-sessions")
    public Result<List<Order>> listInternalPaidOrdersBySessions(
            @RequestBody(required = false) PaidOrdersBySessionsRequest request,
            @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        List<Long> sessionIds = request != null ? request.getSessionIds() : java.util.Collections.emptyList();
        return Result.success(orderService.listPaidOrdersBySessions(sessionIds));
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

    private boolean isValidInternalToken(String token) {
        return StringUtils.hasText(internalApiToken) && internalApiToken.equals(token);
    }
}
