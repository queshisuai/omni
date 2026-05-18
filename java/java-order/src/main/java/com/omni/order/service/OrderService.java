package com.omni.order.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.order.dto.CreateOrderRequest;
import com.omni.order.dto.LockSeatsRequest;
import com.omni.order.dto.OrderListItemResponse;
import com.omni.order.entity.Order;
import com.omni.order.entity.OrderSeat;
import com.omni.order.entity.SessionSeat;
import com.omni.order.entity.TicketType;
import com.omni.order.mapper.OrderMapper;
import com.omni.order.mapper.OrderSeatMapper;
import com.omni.order.mapper.SessionSeatMapper;
import com.omni.order.mapper.TicketTypeMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
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
    private static final int ORDER_SEAT_LOCKED = 1;
    private static final int ORDER_SEAT_SOLD = 2;
    private static final int ORDER_SEAT_REFUNDED = 3;
    private static final int ORDER_SEAT_RELEASED = 4;
    private static final int SESSION_SEAT_AVAILABLE = 1;
    private static final int SESSION_SEAT_LOCKED = 2;
    private static final int SESSION_SEAT_SOLD = 3;
    private static final int SESSION_SEAT_REFUNDED_UNAVAILABLE = 4;

    private final OrderMapper orderMapper;
    private final OrderSeatMapper orderSeatMapper;
    private final SessionSeatMapper sessionSeatMapper;
    private final TicketTypeMapper ticketTypeMapper;

    public OrderService(OrderMapper orderMapper) {
        this(orderMapper, null);
    }

    public OrderService(OrderMapper orderMapper, OrderSeatMapper orderSeatMapper) {
        this(orderMapper, orderSeatMapper, null, null);
    }

    @Autowired
    public OrderService(OrderMapper orderMapper,
                        OrderSeatMapper orderSeatMapper,
                        SessionSeatMapper sessionSeatMapper,
                        TicketTypeMapper ticketTypeMapper) {
        this.orderMapper = orderMapper;
        this.orderSeatMapper = orderSeatMapper;
        this.sessionSeatMapper = sessionSeatMapper;
        this.ticketTypeMapper = ticketTypeMapper;
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
        markSeatsSold(order);
        log.info("订单已标记为已支付: id={}, orderNo={}", id, order.getOrderNo());
        return order;
    }

    public Order createOrderWithSeats(LockSeatsRequest request) {
        if (request.getSeatIds() == null || request.getSeatIds().isEmpty()) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "请选择座位");
        }
        BigDecimal unitPrice = request.getUnitPrice();
        if (ticketTypeMapper != null) {
            TicketType ticketType = ticketTypeMapper.selectById(request.getTicketTypeId());
            if (ticketType == null) {
                throw new BusinessException(ResultCode.NOT_FOUND, "票档不存在");
            }
            unitPrice = ticketType.getPrice();
        }
        if (sessionSeatMapper != null) {
            validateAndLockSeats(request);
        }
        Order order = buildPendingOrder(
                request.getUserId(),
                request.getSessionId(),
                request.getTicketTypeId(),
                request.getSeatIds().size(),
                unitPrice != null ? unitPrice : MOCK_TICKET_PRICE);
        orderMapper.insert(order);
        if (orderSeatMapper != null) {
            LocalDateTime now = LocalDateTime.now();
            LocalDateTime expireTime = now.plusMinutes(15);
            for (Long seatId : request.getSeatIds()) {
                OrderSeat orderSeat = new OrderSeat();
                orderSeat.setOrderId(order.getId());
                orderSeat.setSessionSeatId(seatId);
                orderSeat.setSessionId(request.getSessionId());
                orderSeat.setTicketTypeId(request.getTicketTypeId());
                orderSeat.setStatus(1);
                orderSeat.setLockExpireTime(expireTime);
                orderSeat.setCreateTime(now);
                orderSeat.setUpdateTime(now);
                orderSeatMapper.insert(orderSeat);
            }
        }
        return order;
    }

    private void validateAndLockSeats(LockSeatsRequest request) {
        LocalDateTime expireTime = LocalDateTime.now().plusMinutes(15);
        for (Long seatId : request.getSeatIds()) {
            SessionSeat seat = sessionSeatMapper.selectById(seatId);
            if (seat == null || !request.getSessionId().equals(seat.getSessionId()) || !Integer.valueOf(SESSION_SEAT_AVAILABLE).equals(seat.getStatus())) {
                throw new BusinessException(ResultCode.BAD_REQUEST, "座位已锁定或不可售");
            }
            seat.setStatus(SESSION_SEAT_LOCKED);
            seat.setTicketTypeId(request.getTicketTypeId());
            seat.setLockExpireTime(expireTime);
            seat.setUpdateTime(LocalDateTime.now());
            sessionSeatMapper.updateById(seat);
        }
    }

    private void markSeatsSold(Order order) {
        if (orderSeatMapper == null || sessionSeatMapper == null) {
            return;
        }
        List<OrderSeat> orderSeats = orderSeatMapper.selectList(new LambdaQueryWrapper<OrderSeat>()
                .eq(OrderSeat::getOrderId, order.getId())
                .eq(OrderSeat::getStatus, ORDER_SEAT_LOCKED));
        if (orderSeats == null || orderSeats.isEmpty()) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        for (OrderSeat orderSeat : orderSeats) {
            orderSeat.setStatus(ORDER_SEAT_SOLD);
            orderSeat.setUpdateTime(now);
            orderSeatMapper.updateById(orderSeat);
            SessionSeat sessionSeat = sessionSeatMapper.selectById(orderSeat.getSessionSeatId());
            if (sessionSeat != null) {
                sessionSeat.setStatus(SESSION_SEAT_SOLD);
                sessionSeat.setOrderId(order.getId());
                sessionSeat.setTicketTypeId(order.getTicketTypeId());
                sessionSeat.setUpdateTime(now);
                sessionSeatMapper.updateById(sessionSeat);
            }
        }
        if (ticketTypeMapper != null) {
            TicketType ticketType = ticketTypeMapper.selectById(order.getTicketTypeId());
            if (ticketType != null) {
                ticketType.setRemainStock(Math.max(0, ticketType.getRemainStock() - orderSeats.size()));
                ticketTypeMapper.updateById(ticketType);
            }
        }
    }

    private Order buildPendingOrder(Long userId, Long sessionId, Long ticketTypeId, Integer quantity, BigDecimal unitPrice) {
        String orderNo = "DM" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
                + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        Order order = new Order();
        order.setOrderNo(orderNo);
        order.setUserId(userId);
        order.setSessionId(sessionId);
        order.setTicketTypeId(ticketTypeId);
        order.setQuantity(quantity);
        order.setAmount(unitPrice.multiply(BigDecimal.valueOf(quantity)));
        order.setStatus(STATUS_PENDING);
        return order;
    }

    /**
     * 标记订单为已退款
     */
    public Order markRefunded(Long id) {
        Order order = orderMapper.selectById(id);
        if (order == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "订单不存在");
        }
        if (order.getStatus() == STATUS_REFUNDED) {
            return order;
        }
        if (order.getStatus() == STATUS_PAID) {
            order.setStatus(STATUS_REFUNDED);
            order.setUpdateTime(LocalDateTime.now());
            orderMapper.updateById(order);
            restoreSeatsAfterRefund(order);
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

    public List<OrderListItemResponse> listOrderItems(Long userId) {
        return orderMapper.selectOrderListItems(userId);
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
        releaseLockedSeats(order);
        log.info("订单已取消: orderNo={}", order.getOrderNo());
    }

    public int releaseExpiredSeatLocks() {
        if (orderSeatMapper == null || sessionSeatMapper == null) {
            return 0;
        }
        List<OrderSeat> expiredSeats = orderSeatMapper.selectList(new LambdaQueryWrapper<OrderSeat>()
                .eq(OrderSeat::getStatus, ORDER_SEAT_LOCKED)
                .le(OrderSeat::getLockExpireTime, LocalDateTime.now()));
        if (expiredSeats == null || expiredSeats.isEmpty()) {
            return 0;
        }
        int released = 0;
        for (OrderSeat orderSeat : expiredSeats) {
            Order order = orderMapper.selectById(orderSeat.getOrderId());
            if (order != null && order.getStatus() == STATUS_PENDING) {
                order.setStatus(STATUS_CANCELLED);
                order.setUpdateTime(LocalDateTime.now());
                orderMapper.updateById(order);
            }
            releaseLockedSeat(orderSeat);
            released++;
        }
        return released;
    }

    private void releaseLockedSeats(Order order) {
        if (orderSeatMapper == null || sessionSeatMapper == null || order == null || order.getId() == null) {
            return;
        }
        List<OrderSeat> orderSeats = orderSeatMapper.selectList(new LambdaQueryWrapper<OrderSeat>()
                .eq(OrderSeat::getOrderId, order.getId())
                .eq(OrderSeat::getStatus, ORDER_SEAT_LOCKED));
        if (orderSeats == null || orderSeats.isEmpty()) {
            return;
        }
        for (OrderSeat orderSeat : orderSeats) {
            releaseLockedSeat(orderSeat);
        }
    }

    private void releaseLockedSeat(OrderSeat orderSeat) {
        orderSeat.setStatus(ORDER_SEAT_RELEASED);
        orderSeat.setUpdateTime(LocalDateTime.now());
        orderSeatMapper.updateById(orderSeat);
        SessionSeat sessionSeat = sessionSeatMapper.selectById(orderSeat.getSessionSeatId());
        if (sessionSeat == null) {
            return;
        }
        sessionSeat.setStatus(SESSION_SEAT_AVAILABLE);
        sessionSeat.setOrderId(null);
        sessionSeat.setTicketTypeId(null);
        sessionSeat.setLockExpireTime(null);
        sessionSeat.setUpdateTime(LocalDateTime.now());
        sessionSeatMapper.updateById(sessionSeat);
    }

    private void restoreSeatsAfterRefund(Order order) {
        if (orderSeatMapper == null || sessionSeatMapper == null || order == null || order.getId() == null) {
            return;
        }
        List<OrderSeat> orderSeats = orderSeatMapper.selectList(new LambdaQueryWrapper<OrderSeat>()
                .eq(OrderSeat::getOrderId, order.getId())
                .eq(OrderSeat::getStatus, ORDER_SEAT_SOLD));
        if (orderSeats == null || orderSeats.isEmpty()) {
            return;
        }
        boolean canResell = canResellRefundedSeats(order);
        int restored = 0;
        LocalDateTime now = LocalDateTime.now();
        for (OrderSeat orderSeat : orderSeats) {
            orderSeat.setStatus(ORDER_SEAT_REFUNDED);
            orderSeat.setUpdateTime(now);
            orderSeatMapper.updateById(orderSeat);

            SessionSeat sessionSeat = sessionSeatMapper.selectById(orderSeat.getSessionSeatId());
            if (sessionSeat == null) {
                continue;
            }
            if (canResell) {
                sessionSeat.setStatus(SESSION_SEAT_AVAILABLE);
                sessionSeat.setOrderId(null);
                sessionSeat.setTicketTypeId(null);
                sessionSeat.setLockExpireTime(null);
                restored++;
            } else {
                sessionSeat.setStatus(SESSION_SEAT_REFUNDED_UNAVAILABLE);
            }
            sessionSeat.setUpdateTime(now);
            sessionSeatMapper.updateById(sessionSeat);
        }
        if (restored > 0 && ticketTypeMapper != null) {
            ticketTypeMapper.increaseRemainStock(order.getTicketTypeId(), restored);
        }
    }

    private boolean canResellRefundedSeats(Order order) {
        if (sessionSeatMapper == null || ticketTypeMapper == null) {
            return false;
        }
        LocalDateTime startTime = sessionSeatMapper.selectSessionStartTime(order.getSessionId());
        if (startTime == null || !startTime.isAfter(LocalDateTime.now().plusHours(24))) {
            return false;
        }
        return Boolean.TRUE.equals(sessionSeatMapper.selectSessionSellable(order.getSessionId()))
                && Boolean.TRUE.equals(ticketTypeMapper.selectTicketTypeSellable(order.getTicketTypeId()));
    }
}
