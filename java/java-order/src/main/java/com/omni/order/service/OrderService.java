package com.omni.order.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.order.client.PaymentInternalClient;
import com.omni.order.client.TicketSalesInternalClient;
import com.omni.order.client.UserInternalClient;
import com.omni.order.dto.CreateOrderRequest;
import com.omni.order.dto.LockSeatsRequest;
import com.omni.order.dto.MarkPartialRefundedRequest;
import com.omni.order.dto.OrderListItemResponse;
import com.omni.order.dto.PaymentSyncDecisionResponse;
import com.omni.order.dto.RefundOptionsResponse;
import com.omni.order.dto.RefundSeatOptionResponse;
import com.omni.order.dto.SessionSeatUsageItemResponse;
import com.omni.order.dto.SessionSeatUsageResponse;
import com.omni.order.dto.TicketSalesLockRequest;
import com.omni.order.dto.TicketSalesOrderRequest;
import com.omni.order.dto.TicketSalesQuoteRequest;
import com.omni.order.dto.TicketSalesQuoteResponse;
import com.omni.order.dto.InternalUserRefResponse;
import com.omni.order.dto.TicketSalesSeatLockResponse;
import com.omni.order.entity.Order;
import com.omni.order.entity.OrderSeat;
import com.omni.order.entity.OrderSnapshot;
import com.omni.order.mapper.OrderMapper;
import com.omni.order.mapper.OrderSeatMapper;
import com.omni.order.mapper.OrderSnapshotMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class OrderService {

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);

    public static final int STATUS_PENDING = 1;
    public static final int STATUS_PAID = 2;
    public static final int STATUS_CANCELLED = 3;
    public static final int STATUS_REFUNDED = 4;
    private static final int ORDER_SEAT_LOCKED = 1;
    private static final int ORDER_SEAT_SOLD = 2;
    private static final int ORDER_SEAT_REFUNDED = 3;
    private static final int ORDER_SEAT_RELEASED = 4;

    private final OrderMapper orderMapper;
    private final OrderSeatMapper orderSeatMapper;
    private final OrderSnapshotMapper orderSnapshotMapper;
    private final PaymentInternalClient paymentInternalClient;
    private final TicketSalesInternalClient ticketSalesInternalClient;
    private final UserInternalClient userInternalClient;
    private final String internalApiToken;

    public OrderService(OrderMapper orderMapper) {
        this(orderMapper, null, null, null, null, null, null);
    }

    public OrderService(OrderMapper orderMapper, OrderSeatMapper orderSeatMapper) {
        this(orderMapper, orderSeatMapper, null, null, null, null, null);
    }

    @Autowired
    public OrderService(OrderMapper orderMapper,
                        OrderSeatMapper orderSeatMapper,
                        OrderSnapshotMapper orderSnapshotMapper,
                        PaymentInternalClient paymentInternalClient,
                        TicketSalesInternalClient ticketSalesInternalClient,
                        UserInternalClient userInternalClient,
                        @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.orderMapper = orderMapper;
        this.orderSeatMapper = orderSeatMapper;
        this.orderSnapshotMapper = orderSnapshotMapper;
        this.paymentInternalClient = paymentInternalClient;
        this.ticketSalesInternalClient = ticketSalesInternalClient;
        this.userInternalClient = userInternalClient;
        this.internalApiToken = internalApiToken;
    }

    public OrderService(OrderMapper orderMapper,
                        OrderSeatMapper orderSeatMapper,
                        OrderSnapshotMapper orderSnapshotMapper,
                        PaymentInternalClient paymentInternalClient,
                        TicketSalesInternalClient ticketSalesInternalClient,
                        UserInternalClient userInternalClient) {
        this(orderMapper, orderSeatMapper, orderSnapshotMapper, paymentInternalClient, ticketSalesInternalClient, userInternalClient, "test-internal-token");
    }

    public OrderService(OrderMapper orderMapper,
                        OrderSeatMapper orderSeatMapper,
                        PaymentInternalClient paymentInternalClient,
                        TicketSalesInternalClient ticketSalesInternalClient,
                        UserInternalClient userInternalClient) {
        this(orderMapper, orderSeatMapper, null, paymentInternalClient, ticketSalesInternalClient, userInternalClient, "test-internal-token");
    }

    public OrderService(OrderMapper orderMapper,
                        OrderSeatMapper orderSeatMapper,
                        OrderSnapshotMapper orderSnapshotMapper,
                        PaymentInternalClient paymentInternalClient,
                        TicketSalesInternalClient ticketSalesInternalClient) {
        this(orderMapper, orderSeatMapper, orderSnapshotMapper, paymentInternalClient, ticketSalesInternalClient, null, "test-internal-token");
    }

    @Deprecated
    public OrderService(OrderMapper orderMapper,
                        OrderSeatMapper orderSeatMapper,
                        PaymentInternalClient paymentInternalClient,
                        TicketSalesInternalClient ticketSalesInternalClient) {
        this(orderMapper, orderSeatMapper, null, paymentInternalClient, ticketSalesInternalClient, null, "test-internal-token");
    }

    public Order createOrder(CreateOrderRequest request) {
        int quantity = requirePositiveQuantity(request.getQuantity());
        validateUserExists(request.getUserId());
        TicketSalesQuoteResponse quote = quoteTickets(request.getSessionId(), request.getTicketTypeId(), null, quantity);
        validatePerUserLimit(request.getUserId(), quote, quantity);
        Order order = buildPendingOrder(request.getUserId(), request.getSessionId(), request.getTicketTypeId(), quantity, quote.getUnitPrice());
        lockStockForOrder(order);
        orderMapper.insert(order);
        writeSnapshot(order, quote);
        log.info("订单创建成功: orderNo={}, userId={}, amount={}", order.getOrderNo(), request.getUserId(), order.getAmount());
        return order;
    }

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
        confirmTicketsSold(order);
        log.info("订单已标记为已支付: id={}, orderNo={}", id, order.getOrderNo());
        return order;
    }

    public Order createOrderWithSeats(LockSeatsRequest request) {
        boolean hasSeatIds = request.getSeatIds() != null && !request.getSeatIds().isEmpty();
        int quantity = hasSeatIds ? request.getSeatIds().size() : requirePositiveQuantity(request.getQuantity());
        validateUserExists(request.getUserId());
        TicketSalesQuoteResponse quote = quoteTickets(request.getSessionId(), request.getTicketTypeId(), request.getSeatIds(), quantity);
        validatePerUserLimit(request.getUserId(), quote, quantity);
        TicketSalesLockRequest lockRequest = new TicketSalesLockRequest();
        lockRequest.setOrderId(0L);
        lockRequest.setSessionId(request.getSessionId());
        lockRequest.setTicketTypeId(request.getTicketTypeId());
        lockRequest.setSeatIds(request.getSeatIds());
        lockRequest.setQuantity(quantity);
        lockRequest.setLockExpireTime(LocalDateTime.now().plusMinutes(15));
        lockRequest.setAllocateRandom(!hasSeatIds);
        TicketSalesSeatLockResponse lockResponse = lockSeats(lockRequest);
        List<Long> lockedSeatIds = lockResponse.getLockedSeatIds() != null ? lockResponse.getLockedSeatIds() : request.getSeatIds();
        if (!hasSeatIds && lockResponse.getSeatLabels() != null) {
            quote.setSeatLabels(String.join(", ", lockResponse.getSeatLabels()));
        }
        Order order = buildPendingOrder(
                request.getUserId(),
                request.getSessionId(),
                request.getTicketTypeId(),
                quantity,
                quote.getUnitPrice());
        orderMapper.insert(order);
        writeSnapshot(order, quote);
        if (lockedSeatIds != null && !lockedSeatIds.isEmpty() && orderSeatMapper != null) {
            LocalDateTime now = LocalDateTime.now();
            LocalDateTime expireTime = now.plusMinutes(15);
            for (Long seatId : lockedSeatIds) {
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
            refundTickets(order);
            return order;
        }
        throw new BusinessException(ResultCode.BAD_REQUEST, "订单状态不允许退款");
    }

    public RefundOptionsResponse getRefundOptions(Long orderId) {
        Order order = getOrderDetail(orderId);
        if (order.getStatus() != STATUS_PAID) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "仅已支付订单可退款");
        }
        List<OrderSeat> seats = orderSeatMapper.selectRefundableSeatsByOrderId(orderId);
        int refunded = safeCount(orderSeatMapper.countRefundedSeatsByOrderId(orderId));
        int refundable = seats == null || seats.isEmpty() ? order.getQuantity() - refunded : seats.size();

        RefundOptionsResponse response = new RefundOptionsResponse();
        response.setOrderId(orderId);
        response.setTotalQuantity(order.getQuantity());
        response.setRefundedQuantity(refunded);
        response.setRefundableQuantity(Math.max(refundable, 0));
        response.setUnitPrice(order.getAmount().divide(BigDecimal.valueOf(order.getQuantity()), 2, RoundingMode.HALF_UP));
        response.setSeats((seats == null ? Collections.<OrderSeat>emptyList() : seats).stream()
                .map(this::toRefundSeatOption)
                .collect(Collectors.toList()));
        return response;
    }

    public RefundOptionsResponse getUserRefundOptions(Long orderId, Long userId) {
        Order order = getUserOwnedOrder(orderId, userId);
        if (order.getStatus() != STATUS_PAID) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "仅已支付订单可退款");
        }
        return getRefundOptions(orderId);
    }

    @Transactional
    public Order markPartialRefunded(Long orderId, MarkPartialRefundedRequest request) {
        Order order = getOrderDetail(orderId);
        if (order.getStatus() != STATUS_PAID) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "订单状态不允许退款");
        }
        int quantity = requireRefundQuantity(request);
        List<OrderSeat> refundableSeats = orderSeatMapper.selectRefundableSeatsByOrderId(orderId);
        int refunded = safeCount(orderSeatMapper.countRefundedSeatsByOrderId(orderId));
        boolean hasSeats = refundableSeats != null && !refundableSeats.isEmpty();
        int refundable = hasSeats ? refundableSeats.size() : order.getQuantity() - refunded;
        if (quantity > refundable) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "可退款票数不足");
        }

        List<OrderSeat> selectedSeats = selectRefundSeats(refundableSeats, request != null ? request.getOrderSeatIds() : null, quantity);
        refundTickets(order, selectedSeats, quantity);
        if (!selectedSeats.isEmpty()) {
            orderSeatMapper.updateStatusByIds(selectedSeats.stream().map(OrderSeat::getId).collect(Collectors.toList()), ORDER_SEAT_REFUNDED);
        } else {
            recordQuantityOnlyRefund(order, quantity);
        }

        if (refunded + quantity >= order.getQuantity()) {
            order.setStatus(STATUS_REFUNDED);
            order.setUpdateTime(LocalDateTime.now());
            orderMapper.updateById(order);
        }
        return order;
    }

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

    private int safeCount(Integer count) {
        return count == null ? 0 : count;
    }

    private RefundSeatOptionResponse toRefundSeatOption(OrderSeat seat) {
        RefundSeatOptionResponse response = new RefundSeatOptionResponse();
        response.setOrderSeatId(seat.getId());
        response.setSessionSeatId(seat.getSessionSeatId());
        response.setSessionId(seat.getSessionId());
        response.setTicketTypeId(seat.getTicketTypeId());
        response.setSeatLabel(seat.getSessionSeatId() != null ? String.valueOf(seat.getSessionSeatId()) : null);
        return response;
    }

    private int requireRefundQuantity(MarkPartialRefundedRequest request) {
        if (request == null || request.getQuantity() == null || request.getQuantity() <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "退款数量不正确");
        }
        return request.getQuantity();
    }

    private List<OrderSeat> selectRefundSeats(List<OrderSeat> refundableSeats, List<Long> orderSeatIds, int quantity) {
        if (refundableSeats == null || refundableSeats.isEmpty()) {
            return Collections.emptyList();
        }
        if (orderSeatIds == null || orderSeatIds.isEmpty()) {
            return refundableSeats.stream().limit(quantity).collect(Collectors.toList());
        }
        if (orderSeatIds.size() != quantity) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "退款座位数量不匹配");
        }
        Set<Long> ids = new HashSet<>(orderSeatIds);
        List<OrderSeat> selected = refundableSeats.stream()
                .filter(seat -> ids.contains(seat.getId()))
                .collect(Collectors.toList());
        if (selected.size() != quantity) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "可退款票数不足");
        }
        return selected;
    }

    private void recordQuantityOnlyRefund(Order order, int quantity) {
        LocalDateTime now = LocalDateTime.now();
        for (int i = 0; i < quantity; i++) {
            OrderSeat refundRecord = new OrderSeat();
            refundRecord.setOrderId(order.getId());
            refundRecord.setSessionId(order.getSessionId());
            refundRecord.setTicketTypeId(order.getTicketTypeId());
            refundRecord.setStatus(ORDER_SEAT_REFUNDED);
            refundRecord.setCreateTime(now);
            refundRecord.setUpdateTime(now);
            orderSeatMapper.insert(refundRecord);
        }
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

    public SessionSeatUsageResponse inspectSessionSeatUsage(List<Long> sessionSeatIds) {
        if (sessionSeatIds == null || sessionSeatIds.isEmpty()) {
            return new SessionSeatUsageResponse(Collections.emptyList());
        }
        List<Long> ids = sessionSeatIds.stream()
                .filter(id -> id != null)
                .distinct()
                .collect(Collectors.toList());
        if (ids.isEmpty()) {
            return new SessionSeatUsageResponse(Collections.emptyList());
        }

        Map<Long, OrderSeat> usedSeats = new LinkedHashMap<>();
        List<OrderSeat> orderSeats = orderSeatMapper.selectList(new LambdaQueryWrapper<OrderSeat>()
                .in(OrderSeat::getSessionSeatId, ids));
        if (orderSeats != null) {
            for (OrderSeat orderSeat : orderSeats) {
                Integer status = orderSeat.getStatus();
                if (orderSeat.getSessionSeatId() != null && status != null
                        && (status == ORDER_SEAT_LOCKED || status == ORDER_SEAT_SOLD)) {
                    usedSeats.putIfAbsent(orderSeat.getSessionSeatId(), orderSeat);
                }
            }
        }

        List<SessionSeatUsageItemResponse> seats = new ArrayList<>();
        for (Long id : ids) {
            OrderSeat orderSeat = usedSeats.get(id);
            if (orderSeat != null) {
                seats.add(new SessionSeatUsageItemResponse(id, true, false, orderSeat.getOrderId(), orderSeat.getStatus()));
            } else {
                seats.add(new SessionSeatUsageItemResponse(id, false, true, null, null));
            }
        }
        return new SessionSeatUsageResponse(seats);
    }

    public Order getOrderDetail(Long id) {
        Order order = orderMapper.selectById(id);
        if (order == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "订单不存在");
        }
        return order;
    }

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
        releaseLockedResources(order);
        log.info("订单已取消: orderNo={}", order.getOrderNo());
    }

    @Transactional
    public int releaseExpiredSeatLocks() {
        if (orderSeatMapper == null) {
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
            releaseSingleLockedSeat(orderSeat);
            released++;
        }
        return released;
    }

    private void writeSnapshot(Order order, TicketSalesQuoteResponse quote) {
        if (orderSnapshotMapper == null || order == null || quote == null) {
            return;
        }
        OrderSnapshot snapshot = new OrderSnapshot();
        snapshot.setOrderId(order.getId());
        snapshot.setActivityId(quote.getActivityId());
        snapshot.setActivityName(quote.getActivityName());
        snapshot.setActivityPoster(quote.getActivityPoster());
        snapshot.setTourId(quote.getTourId());
        snapshot.setStationId(quote.getStationId());
        snapshot.setSessionId(order.getSessionId());
        snapshot.setSessionTime(quote.getSessionTime());
        snapshot.setVenueName(quote.getVenueName());
        snapshot.setTicketTypeId(order.getTicketTypeId());
        snapshot.setTicketName(quote.getTicketName());
        snapshot.setUnitPrice(quote.getUnitPrice());
        snapshot.setQuantity(order.getQuantity());
        snapshot.setSeatLabels(quote.getSeatLabels());
        LocalDateTime now = LocalDateTime.now();
        snapshot.setCreateTime(now);
        snapshot.setUpdateTime(now);
        orderSnapshotMapper.insert(snapshot);
    }

    // --- Internal helpers ---

    private void validateUserExists(Long userId) {
        if (userInternalClient == null) {
            return;
        }
        if (userId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "用户ID不能为空");
        }
        String token = requireInternalApiToken("用户服务接口令牌未配置");
        Result<InternalUserRefResponse> result;
        try {
            result = userInternalClient.getUserRef(userId, token);
        } catch (RuntimeException e) {
            log.error("用户服务调用失败: userId={}", userId, e);
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "用户服务无响应");
        }
        if (result == null || result.getCode() != ResultCode.SUCCESS.getCode() || result.getData() == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "用户不存在");
        }
        Integer status = result.getData().getStatus();
        if (status == null || status != 1) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "用户状态不可用");
        }
    }

    private int requirePositiveQuantity(Integer quantity) {
        if (quantity == null || quantity <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "购买数量不正确");
        }
        return quantity;
    }

    private TicketSalesQuoteResponse quoteTickets(Long sessionId, Long ticketTypeId, List<Long> seatIds, int quantity) {
        String token = requireInternalApiToken("票务库存接口令牌未配置");
        TicketSalesQuoteRequest request = new TicketSalesQuoteRequest();
        request.setSessionId(sessionId);
        request.setTicketTypeId(ticketTypeId);
        request.setSeatIds(seatIds);
        request.setQuantity(quantity);
        Result<TicketSalesQuoteResponse> result = ticketSalesInternalClient.quote(request, token);
        if (result == null || result.getCode() != ResultCode.SUCCESS.getCode() || result.getData() == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, result != null ? result.getMessage() : "票务服务无响应");
        }
        return result.getData();
    }

    private void validatePerUserLimit(Long userId, TicketSalesQuoteResponse quote, int quantity) {
        Integer limit = quote.getPerUserLimit();
        if (limit == null) {
            return;
        }
        if (quote.getActivityId() == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "活动限购信息不完整");
        }
        Integer existing = orderMapper.sumEffectiveQuantityByUserAndActivity(userId, quote.getActivityId());
        int effective = existing == null ? 0 : existing;
        if (effective + quantity > limit) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "超过本活动个人限购数量");
        }
    }

    private void lockStockForOrder(Order order) {
        String token = requireInternalApiToken("票务库存接口令牌未配置");
        TicketSalesLockRequest request = new TicketSalesLockRequest();
        request.setOrderId(order.getId() != null ? order.getId() : 0L);
        request.setSessionId(order.getSessionId());
        request.setTicketTypeId(order.getTicketTypeId());
        request.setQuantity(order.getQuantity());
        Result<Void> result = ticketSalesInternalClient.lockStock(request, token);
        if (result == null || result.getCode() != ResultCode.SUCCESS.getCode()) {
            throw new BusinessException(ResultCode.BAD_REQUEST, result != null ? result.getMessage() : "票务服务无响应");
        }
    }

    private void lockStockForTicketType(Long ticketTypeId, int quantity) {
        String token = requireInternalApiToken("票务库存接口令牌未配置");
        TicketSalesLockRequest request = new TicketSalesLockRequest();
        request.setOrderId(0L);
        request.setTicketTypeId(ticketTypeId);
        request.setQuantity(quantity);
        Result<Void> result = ticketSalesInternalClient.lockStock(request, token);
        if (result == null || result.getCode() != ResultCode.SUCCESS.getCode()) {
            throw new BusinessException(ResultCode.BAD_REQUEST, result != null ? result.getMessage() : "票务服务无响应");
        }
    }

    private TicketSalesSeatLockResponse lockSeats(TicketSalesLockRequest lockRequest) {
        String token = requireInternalApiToken("票务库存接口令牌未配置");
        Result<TicketSalesSeatLockResponse> result = ticketSalesInternalClient.lockSeats(lockRequest, token);
        if (result == null || result.getCode() != ResultCode.SUCCESS.getCode() || result.getData() == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, result != null ? result.getMessage() : "票务服务无响应");
        }
        return result.getData();
    }

    private void confirmTicketsSold(Order order) {
        if (orderSeatMapper == null) {
            return;
        }
        List<OrderSeat> orderSeats = orderSeatMapper.selectList(new LambdaQueryWrapper<OrderSeat>()
                .eq(OrderSeat::getOrderId, order.getId())
                .eq(OrderSeat::getStatus, ORDER_SEAT_LOCKED));
        TicketSalesOrderRequest request = new TicketSalesOrderRequest();
        request.setOrderId(order.getId());
        request.setSessionId(order.getSessionId());
        request.setTicketTypeId(order.getTicketTypeId());
        request.setQuantity(order.getQuantity());
        if (orderSeats != null && !orderSeats.isEmpty()) {
            LocalDateTime now = LocalDateTime.now();
            List<Long> seatIds = new ArrayList<>();
            for (OrderSeat orderSeat : orderSeats) {
                orderSeat.setStatus(ORDER_SEAT_SOLD);
                orderSeat.setUpdateTime(now);
                orderSeatMapper.updateById(orderSeat);
                seatIds.add(orderSeat.getSessionSeatId());
            }
            request.setSeatIds(seatIds);
        }
        String token = requireInternalApiToken("票务库存接口令牌未配置");
        Result<Void> result = ticketSalesInternalClient.confirmSold(request, token);
        if (result == null || result.getCode() != ResultCode.SUCCESS.getCode()) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, result != null ? result.getMessage() : "票务服务无响应");
        }
    }

    private void releaseLockedResources(Order order) {
        if (orderSeatMapper == null || order == null || order.getId() == null) {
            return;
        }
        List<OrderSeat> orderSeats = orderSeatMapper.selectList(new LambdaQueryWrapper<OrderSeat>()
                .eq(OrderSeat::getOrderId, order.getId())
                .eq(OrderSeat::getStatus, ORDER_SEAT_LOCKED));
        TicketSalesOrderRequest request = new TicketSalesOrderRequest();
        request.setOrderId(order.getId());
        request.setSessionId(order.getSessionId());
        request.setTicketTypeId(order.getTicketTypeId());
        request.setQuantity(order.getQuantity());
        if (orderSeats != null && !orderSeats.isEmpty()) {
            List<Long> seatIds = new ArrayList<>();
            for (OrderSeat orderSeat : orderSeats) {
                seatIds.add(orderSeat.getSessionSeatId());
            }
            request.setSeatIds(seatIds);
        }
        String token = requireInternalApiToken("票务库存接口令牌未配置");
        Result<Void> result = ticketSalesInternalClient.release(request, token);
        if (result != null && result.getCode() == ResultCode.SUCCESS.getCode()) {
            if (orderSeats != null) {
                LocalDateTime now = LocalDateTime.now();
                for (OrderSeat orderSeat : orderSeats) {
                    orderSeat.setStatus(ORDER_SEAT_RELEASED);
                    orderSeat.setUpdateTime(now);
                    orderSeatMapper.updateById(orderSeat);
                }
            }
        } else {
            log.warn("释放票务资源失败: orderId={}", order.getId());
        }
    }

    private void releaseSingleLockedSeat(OrderSeat orderSeat) {
        TicketSalesOrderRequest request = new TicketSalesOrderRequest();
        request.setOrderId(orderSeat.getOrderId());
        request.setSessionId(orderSeat.getSessionId());
        request.setTicketTypeId(orderSeat.getTicketTypeId());
        request.setSeatIds(List.of(orderSeat.getSessionSeatId()));
        request.setQuantity(1);
        String token = requireInternalApiToken("票务库存接口令牌未配置");
        Result<Void> result = ticketSalesInternalClient.release(request, token);
        if (result == null || result.getCode() != ResultCode.SUCCESS.getCode()) {
            log.warn("释放座位锁失败，票务服务拒绝: orderSeatId={}, sessionSeatId={}, orderId={}",
                    orderSeat.getId(), orderSeat.getSessionSeatId(), orderSeat.getOrderId());
            return;
        }
        orderSeat.setStatus(ORDER_SEAT_RELEASED);
        orderSeat.setUpdateTime(LocalDateTime.now());
        orderSeatMapper.updateById(orderSeat);
    }

    private void refundTickets(Order order) {
        if (orderSeatMapper == null || order == null || order.getId() == null) {
            return;
        }
        List<OrderSeat> orderSeats = orderSeatMapper.selectList(new LambdaQueryWrapper<OrderSeat>()
                .eq(OrderSeat::getOrderId, order.getId())
                .eq(OrderSeat::getStatus, ORDER_SEAT_SOLD));
        TicketSalesOrderRequest request = new TicketSalesOrderRequest();
        request.setOrderId(order.getId());
        request.setSessionId(order.getSessionId());
        request.setTicketTypeId(order.getTicketTypeId());
        request.setQuantity(order.getQuantity());
        if (orderSeats != null && !orderSeats.isEmpty()) {
            LocalDateTime now = LocalDateTime.now();
            List<Long> seatIds = orderSeats.stream().map(OrderSeat::getSessionSeatId).collect(Collectors.toList());
            request.setSeatIds(seatIds);
            for (OrderSeat orderSeat : orderSeats) {
                orderSeat.setStatus(ORDER_SEAT_REFUNDED);
                orderSeat.setUpdateTime(now);
                orderSeatMapper.updateById(orderSeat);
            }
        }
        String token = requireInternalApiToken("票务库存接口令牌未配置");
        Result<Void> result = ticketSalesInternalClient.refund(request, token);
        if (result == null || result.getCode() != ResultCode.SUCCESS.getCode()) {
            log.warn("退款恢复票务资源失败: orderId={}", order.getId());
        }
    }

    private void refundTickets(Order order, List<OrderSeat> orderSeats, int quantity) {
        TicketSalesOrderRequest request = new TicketSalesOrderRequest();
        request.setOrderId(order.getId());
        request.setSessionId(order.getSessionId());
        request.setTicketTypeId(order.getTicketTypeId());
        request.setQuantity(quantity);
        if (orderSeats != null && !orderSeats.isEmpty()) {
            request.setSeatIds(orderSeats.stream().map(OrderSeat::getSessionSeatId).collect(Collectors.toList()));
        }
        String token = requireInternalApiToken("票务库存接口令牌未配置");
        Result<Void> result = ticketSalesInternalClient.refund(request, token);
        if (result == null || result.getCode() != ResultCode.SUCCESS.getCode()) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, result != null ? result.getMessage() : "票务服务无响应");
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

    private String requireInternalApiToken(String message) {
        if (!StringUtils.hasText(internalApiToken)) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, message);
        }
        return internalApiToken;
    }
}
