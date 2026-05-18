package com.omni.order.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.order.dto.CreateOrderRequest;
import com.omni.order.entity.Order;
import com.omni.order.mapper.OrderMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

/**
 * 订单服务
 */
@Service
public class OrderService {

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);
    private static final BigDecimal MOCK_TICKET_PRICE = new BigDecimal("280.00");

    /** 订单状态 */
    public static final int STATUS_PENDING = 1;
    public static final int STATUS_PAID = 2;
    public static final int STATUS_CANCELLED = 3;
    public static final int STATUS_REFUNDED = 4;

    private final OrderMapper orderMapper;

    public OrderService(OrderMapper orderMapper) {
        this.orderMapper = orderMapper;
    }

    /**
     * 创建订单
     */
    public Order createOrder(CreateOrderRequest request) {
        // 生成订单号
        String orderNo = "DM" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
                + UUID.randomUUID().toString().substring(0, 6).toUpperCase();

        Order order = new Order();
        order.setOrderNo(orderNo);
        order.setUserId(request.getUserId());
        order.setSessionId(request.getSessionId());
        order.setTicketTypeId(request.getTicketTypeId());
        order.setQuantity(request.getQuantity());
        order.setAmount(request.getUnitPrice() != null
                ? request.getUnitPrice().multiply(BigDecimal.valueOf(request.getQuantity()))
                : MOCK_TICKET_PRICE.multiply(BigDecimal.valueOf(request.getQuantity())));
        order.setStatus(STATUS_PENDING);

        orderMapper.insert(order);
        log.info("订单创建成功: orderNo={}, userId={}, amount={}", orderNo, request.getUserId(), order.getAmount());
        return order;
    }

    /**
     * 标记订单为已支付
     */
    public Order markPaid(Long id) {
        Order order = orderMapper.selectById(id);
        if (order == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "订单不存在");
        }
        if (order.getStatus() == STATUS_PAID) {
            return order;
        }
        if (order.getStatus() != STATUS_PENDING) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "订单状态不允许支付");
        }
        order.setStatus(STATUS_PAID);
        order.setUpdateTime(LocalDateTime.now());
        orderMapper.updateById(order);
        log.info("订单已标记为已支付: id={}, orderNo={}", id, order.getOrderNo());
        return order;
    }

    /**
     * 标记订单为已退款
     */
    public Order markRefunded(Long id) {
        LambdaUpdateWrapper<Order> wrapper = new LambdaUpdateWrapper<>();
        wrapper.eq(Order::getId, id)
                .eq(Order::getStatus, STATUS_PAID)
                .set(Order::getStatus, STATUS_REFUNDED)
                .set(Order::getUpdateTime, LocalDateTime.now());
        int updated = orderMapper.update(null, wrapper);
        if (updated == 1) {
            return orderMapper.selectById(id);
        }

        Order order = orderMapper.selectById(id);
        if (order == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "订单不存在");
        }
        if (order.getStatus() == STATUS_REFUNDED) {
            return order;
        }
        throw new BusinessException(ResultCode.BAD_REQUEST, "订单状态不允许退款");
    }

    /**
     * 用户订单列表
     */
    public List<Order> listOrders(Long userId) {
        LambdaQueryWrapper<Order> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Order::getUserId, userId)
               .orderByDesc(Order::getCreateTime);
        return orderMapper.selectList(wrapper);
    }

    public List<Order> listPaidOrdersBySessions(List<Long> sessionIds) {
        if (sessionIds == null || sessionIds.isEmpty()) {
            return java.util.Collections.emptyList();
        }
        LambdaQueryWrapper<Order> wrapper = new LambdaQueryWrapper<>();
        wrapper.in(Order::getSessionId, sessionIds)
                .eq(Order::getStatus, STATUS_PAID)
                .orderByAsc(Order::getId);
        return orderMapper.selectList(wrapper);
    }

    /**
     * 订单详情
     */
    public Order getOrderDetail(Long id) {
        Order order = orderMapper.selectById(id);
        if (order == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "订单不存在");
        }
        return order;
    }

    /**
     * 取消订单
     */
    public void cancelOrder(Long id) {
        Order order = orderMapper.selectById(id);
        if (order == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "订单不存在");
        }
        if (order.getStatus() != STATUS_PENDING) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "只能取消待支付状态的订单");
        }
        order.setStatus(STATUS_CANCELLED);
        order.setUpdateTime(LocalDateTime.now());
        orderMapper.updateById(order);
        log.info("订单已取消: orderNo={}", order.getOrderNo());
    }
}
