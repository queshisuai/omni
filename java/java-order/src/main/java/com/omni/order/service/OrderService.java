package com.omni.order.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.order.client.PaymentInternalClient;
import com.omni.order.dto.CreateOrderRequest;
import com.omni.order.dto.LockSeatsRequest;
import com.omni.order.dto.OrderListItemResponse;
import com.omni.order.dto.PaymentSyncDecisionResponse;
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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

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
    private final PaymentInternalClient paymentInternalClient;
    private final String internalApiToken;

    public OrderService(OrderMapper orderMapper) {
        this(orderMapper, null);
    }

    public OrderService(OrderMapper orderMapper, OrderSeatMapper orderSeatMapper) {
        this(orderMapper, orderSeatMapper, null, null, null, null);
    }

    @Autowired
    public OrderService(OrderMapper orderMapper,
                        OrderSeatMapper orderSeatMapper,
                        SessionSeatMapper sessionSeatMapper,
                        TicketTypeMapper ticketTypeMapper,
                        PaymentInternalClient paymentInternalClient,
                        @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.orderMapper = orderMapper;
        this.orderSeatMapper = orderSeatMapper;
        this.sessionSeatMapper = sessionSeatMapper;
        this.ticketTypeMapper = ticketTypeMapper;
        this.paymentInternalClient = paymentInternalClient;
        this.internalApiToken = internalApiToken;
    }

    public OrderService(OrderMapper orderMapper,
                        OrderSeatMapper orderSeatMapper,
                        SessionSeatMapper sessionSeatMapper,
                        TicketTypeMapper ticketTypeMapper) {
        this(orderMapper, orderSeatMapper, sessionSeatMapper, ticketTypeMapper, null, "test-internal-token");
    }

    /**
     * 创建订单
     */
    public Order createOrder(CreateOrderRequest request) {
        int quantity = requirePositiveQuantity(request.getQuantity());
        BigDecimal unitPrice = request.getUnitPrice();
        if (ticketTypeMapper != null) {
            TicketType ticketType = ticketTypeMapper.selectById(request.getTicketTypeId());
            if (ticketType == null) {
                throw new BusinessException(ResultCode.NOT_FOUND, "票档不存在");
            }
            unitPrice = ticketType.getPrice();
            lockTicketStock(request.getTicketTypeId(), quantity);
        }
        Order order = buildPendingOrder(request.getUserId(), request.getSessionId(), request.getTicketTypeId(), quantity,
                unitPrice != null ? unitPrice : MOCK_TICKET_PRICE);
        orderMapper.insert(order);
        log.info("订单创建成功: orderNo={}, userId={}, amount={}", order.getOrderNo(), request.getUserId(), order.getAmount());
        return order;
    }

    /**
     * 标记订单为已支付
     */
    @Transactional
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
        int updated = orderMapper.updateStatusIfCurrent(id, STATUS_PENDING, STATUS_PAID);
        if (updated != 1) {
            Order latest = orderMapper.selectById(id);
            if (latest != null && latest.getStatus() == STATUS_PAID) {
                return latest;
            }
            throw new BusinessException(ResultCode.CONFLICT, "订单状态已变化，不能标记为已支付");
        }
        order.setStatus(STATUS_PAID);
        order.setUpdateTime(LocalDateTime.now());
        markSeatsSold(order);
        log.info("订单已标记为已支付: id={}, orderNo={}", id, order.getOrderNo());
        return order;
    }

    public Order createOrderWithSeats(LockSeatsRequest request) {
        boolean hasSeatIds = request.getSeatIds() != null && !request.getSeatIds().isEmpty();
        int quantity = hasSeatIds ? request.getSeatIds().size() : requirePositiveQuantity(request.getQuantity());
        BigDecimal unitPrice = request.getUnitPrice();
        if (ticketTypeMapper != null) {
            TicketType ticketType = ticketTypeMapper.selectById(request.getTicketTypeId());
            if (ticketType == null) {
                throw new BusinessException(ResultCode.NOT_FOUND, "票档不存在");
            }
            unitPrice = ticketType.getPrice();
        }
        if (hasSeatIds && sessionSeatMapper != null) {
            validateAndLockSeats(request);
        } else if (!hasSeatIds) {
            lockTicketStock(request.getTicketTypeId(), quantity);
        }
        Order order = buildPendingOrder(
                request.getUserId(),
                request.getSessionId(),
                request.getTicketTypeId(),
                quantity,
                unitPrice != null ? unitPrice : MOCK_TICKET_PRICE);
        orderMapper.insert(order);
        if (hasSeatIds && orderSeatMapper != null) {
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

    private int requirePositiveQuantity(Integer quantity) {
        if (quantity == null || quantity <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "购买数量不正确");
        }
        return quantity;
    }

    private void lockTicketStock(Long ticketTypeId, int quantity) {
        if (ticketTypeMapper == null) {
            return;
        }
        int locked = ticketTypeMapper.decreaseRemainStockIfEnough(ticketTypeId, quantity);
        if (locked != 1) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "票档库存不足");
        }
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
        return orderMapper.selectVisibleOrderListItems(userId);
    }

    public List<OrderListItemResponse> listTrashOrderItems(Long userId) {
        return orderMapper.selectTrashOrderListItems(userId);
    }

    public void hideOrder(Long id, Long userId) {
        Order order = getUserOwnedOrder(id, userId);
        if (order.getStatus() == STATUS_PAID) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "已支付订单退款完成前不能删除");
        }
        LocalDateTime now = LocalDateTime.now();
        order.setUserHidden(true);
        order.setUserDeletedAt(now);
        order.setUserDeleteExpiresAt(now.plusDays(7));
        order.setUpdateTime(now);
        orderMapper.updateById(order);
    }

    public void restoreOrder(Long id, Long userId) {
        Order order = getUserOwnedOrder(id, userId);
        order.setUserHidden(false);
        order.setUserDeletedAt(null);
        order.setUserDeleteExpiresAt(null);
        order.setUpdateTime(LocalDateTime.now());
        orderMapper.updateById(order);
    }

    private Order getUserOwnedOrder(Long id, Long userId) {
        Order order = orderMapper.selectById(id);
        if (order == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "订单不存在");
        }
        if (userId == null || !userId.equals(order.getUserId())) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权限操作该订单");
        }
        return order;
    }

    public Long countPaidOrdersBySessions(List<Long> sessionIds) {
        if (sessionIds == null || sessionIds.isEmpty()) {
            return 0L;
        }
        Long count = orderMapper.countPaidOrdersBySessions(sessionIds);
        return count != null ? count : 0L;
    }

    public List<Order> listPaidOrdersBySessions(List<Long> sessionIds) {
        return listOrdersBySessions(sessionIds, true);
    }

    public List<Order> listOrdersBySessions(List<Long> sessionIds, boolean paidOnly) {
        if (sessionIds == null || sessionIds.isEmpty()) {
            return java.util.Collections.emptyList();
        }
        LambdaQueryWrapper<Order> wrapper = new LambdaQueryWrapper<>();
        wrapper.in(Order::getSessionId, sessionIds);
        if (paidOnly) {
            wrapper.eq(Order::getStatus, STATUS_PAID);
        }
        wrapper.orderByAsc(Order::getId);
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
    @Transactional
    public void cancelOrder(Long id) {
        Order order = orderMapper.selectById(id);
        if (order == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "订单不存在");
        }
        if (order.getStatus() != STATUS_PENDING) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "只能取消待支付状态的订单");
        }
        assertPendingOrderSafeToCancel(order);
        cancelPendingOrderOrThrow(order);
        releaseLockedSeats(order);
        restoreStockForStockOnlyOrder(order);
        log.info("订单已取消: orderNo={}", order.getOrderNo());
    }

    @Transactional
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
            if (order == null) {
                continue;
            }
            if (order.getStatus() == STATUS_PENDING) {
                try {
                    assertPendingOrderSafeToCancel(order);
                    cancelPendingOrderOrThrow(order);
                } catch (BusinessException e) {
                    log.warn("过期锁释放前确认支付状态失败，跳过释放: orderId={}, orderNo={}, message={}", order.getId(), order.getOrderNo(), e.getMessage());
                    continue;
                }
            } else if (order.getStatus() != STATUS_CANCELLED) {
                continue;
            }
            releaseLockedSeat(orderSeat);
            released++;
        }
        return released;
    }

    private void assertPendingOrderSafeToCancel(Order order) {
        if (paymentInternalClient == null) {
            if (StringUtils.hasText(internalApiToken) && "test-internal-token".equals(internalApiToken)) {
                return;
            }
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "支付状态确认客户端未配置");
        }
        if (!StringUtils.hasText(internalApiToken)) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "内部接口令牌未配置，无法确认支付状态");
        }
        Result<PaymentSyncDecisionResponse> result;
        try {
            result = paymentInternalClient.syncOrderForCancel(order.getId(), internalApiToken);
        } catch (RuntimeException e) {
            log.warn("取消订单前确认支付状态失败: orderId={}, orderNo={}", order.getId(), order.getOrderNo(), e);
            throw new BusinessException(ResultCode.CONFLICT, "支付状态确认中，请稍后刷新后再操作");
        }
        if (result == null || result.getCode() != 200 || result.getData() == null) {
            throw new BusinessException(ResultCode.CONFLICT, "支付状态确认中，请稍后刷新后再操作");
        }
        PaymentSyncDecisionResponse decision = result.getData();
        if (Boolean.TRUE.equals(decision.getPaid())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "订单已支付，不能取消");
        }
        if (!Boolean.TRUE.equals(decision.getSafeToCancel())) {
            throw new BusinessException(ResultCode.CONFLICT, "支付状态确认中，请稍后刷新后再操作");
        }
    }

    private void cancelPendingOrderOrThrow(Order order) {
        int updated = orderMapper.updateStatusIfCurrent(order.getId(), STATUS_PENDING, STATUS_CANCELLED);
        if (updated != 1) {
            throw new BusinessException(ResultCode.CONFLICT, "订单状态已变化，请刷新后重试");
        }
        order.setStatus(STATUS_CANCELLED);
        order.setUpdateTime(LocalDateTime.now());
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

    private void restoreStockForStockOnlyOrder(Order order) {
        if (ticketTypeMapper == null || order == null || order.getQuantity() == null || order.getQuantity() <= 0) {
            return;
        }
        if (orderSeatMapper == null || order.getId() == null) {
            ticketTypeMapper.increaseRemainStock(order.getTicketTypeId(), order.getQuantity());
            return;
        }
        List<OrderSeat> orderSeats = orderSeatMapper.selectList(new LambdaQueryWrapper<OrderSeat>()
                .eq(OrderSeat::getOrderId, order.getId()));
        if (orderSeats == null || orderSeats.isEmpty()) {
            ticketTypeMapper.increaseRemainStock(order.getTicketTypeId(), order.getQuantity());
        }
    }

    private void releaseLockedSeat(OrderSeat orderSeat) {
        int released = sessionSeatMapper.releaseLockedSeatForOrder(orderSeat.getSessionSeatId(), orderSeat.getOrderId());
        if (released != 1) {
            log.warn("释放座位锁失败，座位状态或订单归属已变化: orderSeatId={}, sessionSeatId={}, orderId={}", orderSeat.getId(), orderSeat.getSessionSeatId(), orderSeat.getOrderId());
            return;
        }
        orderSeat.setStatus(ORDER_SEAT_RELEASED);
        orderSeat.setUpdateTime(LocalDateTime.now());
        orderSeatMapper.updateById(orderSeat);
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
