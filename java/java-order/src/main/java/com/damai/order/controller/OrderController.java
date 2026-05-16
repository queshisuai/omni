package com.damai.order.controller;

import com.damai.common.result.Result;
import com.damai.order.dto.CreateOrderRequest;
import com.damai.order.entity.Order;
import com.damai.order.service.OrderService;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 订单接口
 */
@RestController
@RequestMapping("/api/order")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
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
     * 取消订单
     */
    @DeleteMapping("/{id}")
    public Result<Void> cancelOrder(@PathVariable Long id) {
        orderService.cancelOrder(id);
        return Result.success();
    }

    /**
     * 沙盒支付：直接将订单标记为已支付并返回结果
     */
    @PostMapping("/{id}/pay")
    public Result<Map<String, Object>> initiatePay(@PathVariable Long id) {
        Order order = orderService.getOrderDetail(id);
        if (order.getStatus() != OrderService.STATUS_PENDING) {
            return Result.fail(400, "订单状态不允许支付");
        }
        // 沙盒模式：直接标记为已支付
        orderService.markPaid(id);
        Map<String, Object> payInfo = new HashMap<>();
        payInfo.put("orderNo", order.getOrderNo());
        payInfo.put("amount", order.getAmount());
        payInfo.put("payUrl", "/orders");
        payInfo.put("status", "PAID");
        return Result.success(payInfo);
    }
}
