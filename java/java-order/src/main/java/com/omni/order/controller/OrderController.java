package com.omni.order.controller;

import com.alibaba.csp.sentinel.annotation.SentinelResource;
import com.alibaba.csp.sentinel.slots.block.BlockException;
import com.omni.common.result.Result;
import com.omni.order.config.OrderSentinelConfig;
import com.omni.order.dto.CreateOrderRequest;
import com.omni.order.dto.CreateTeamOrderRequest;
import com.omni.order.dto.LockSeatsRequest;
import com.omni.order.dto.MarkPartialRefundedRequest;
import com.omni.order.dto.OrderListItemResponse;
import com.omni.order.dto.OrderSeatItemResponse;
import com.omni.order.dto.PaidOrderCountRequest;
import com.omni.order.dto.PaidOrderCountResponse;
import com.omni.order.dto.PaidOrdersBySessionsRequest;
import com.omni.order.dto.RefundOptionsResponse;
import com.omni.order.dto.SessionSeatUsageRequest;
import com.omni.order.dto.SessionSeatUsageResponse;
import com.omni.order.dto.TicketCheckInRequest;
import com.omni.order.dto.TicketCheckInResponse;
import com.omni.order.dto.TicketEntryCodeResponse;
import com.omni.order.dto.TicketTransferClaimRequest;
import com.omni.order.dto.TicketTransferClaimResponse;
import com.omni.order.dto.TicketTransferCreateResponse;
import com.omni.order.dto.TicketTransferRevokeResponse;
import com.omni.order.dto.TicketWalletItemResponse;
import com.omni.order.entity.Order;
import com.omni.order.service.OrderService;
import com.omni.order.service.TicketWalletService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * 订单接口
 */
@RestController
@RequestMapping("/api/order")
public class OrderController {

    private final OrderService orderService;
    private final TicketWalletService ticketWalletService;
    private final String internalApiToken;
    private final String jwtSecret;

    public OrderController(OrderService orderService,
                           @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken,
                           @Value("${jwt.secret:${JWT_SECRET:omni-jwt-secretomni-jwt-secretomni-jwt-secret}}") String jwtSecret) {
        this(orderService, null, internalApiToken, jwtSecret);
    }

    @Autowired
    public OrderController(OrderService orderService,
                           TicketWalletService ticketWalletService,
                           @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken,
                           @Value("${jwt.secret:${JWT_SECRET:omni-jwt-secretomni-jwt-secretomni-jwt-secret}}") String jwtSecret) {
        this.orderService = orderService;
        this.ticketWalletService = ticketWalletService;
        this.internalApiToken = internalApiToken;
        this.jwtSecret = jwtSecret;
    }

    /**
     * 创建订单
     */
    @PostMapping("/create")
    public Result<Order> createOrder(@RequestBody CreateOrderRequest request,
                                     @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long userId = requireAuthenticatedUserId(authorization);
        if (userId == null) {
            return Result.fail(401, "未登录");
        }
        request.setUserId(userId);
        Order order = orderService.createOrder(request);
        return Result.success(order);
    }

    @PostMapping("/create-with-seats")
    public Result<Order> createOrderWithSeats(@RequestBody LockSeatsRequest request,
                                              @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long userId = requireAuthenticatedUserId(authorization);
        if (userId == null) {
            return Result.fail(401, "未登录");
        }
        request.setUserId(userId);
        return Result.success(orderService.createOrderWithSeats(request));
    }

    @PostMapping("/internal/create")
    @SentinelResource(value = OrderSentinelConfig.INTERNAL_CREATE_ORDER_RESOURCE, blockHandler = "createInternalOrderBlocked")
    public Result<Order> createInternalOrder(@RequestBody CreateOrderRequest request,
                                             @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        return Result.success(orderService.createOrder(request));
    }

    public Result<Order> createInternalOrderBlocked(CreateOrderRequest request, String token, BlockException exception) {
        return Result.fail(429, "系统繁忙，请稍后重试");
    }

    @PostMapping("/internal/create-with-seats")
    @SentinelResource(value = OrderSentinelConfig.INTERNAL_CREATE_ORDER_WITH_SEATS_RESOURCE, blockHandler = "createInternalOrderWithSeatsBlocked")
    public Result<Order> createInternalOrderWithSeats(@RequestBody LockSeatsRequest request,
                                                      @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        return Result.success(orderService.createOrderWithSeats(request));
    }

    public Result<Order> createInternalOrderWithSeatsBlocked(LockSeatsRequest request, String token, BlockException exception) {
        return Result.fail(429, "系统繁忙，请稍后重试");
    }

    /**
     * 用户订单列表
     */
    @PostMapping("/internal/team/create-with-locked-seats")
    @SentinelResource(value = OrderSentinelConfig.INTERNAL_CREATE_TEAM_ORDER_WITH_LOCKED_SEATS_RESOURCE, blockHandler = "createInternalTeamOrderBlocked")
    public Result<Order> createInternalTeamOrder(@RequestBody CreateTeamOrderRequest request,
                                                 @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "forbidden");
        }
        return Result.success(orderService.createTeamOrderWithLockedSeats(request));
    }

    public Result<Order> createInternalTeamOrderBlocked(CreateTeamOrderRequest request, String token, BlockException exception) {
        return Result.fail(429, "系统繁忙，请稍后重试");
    }

    @GetMapping("/my")
    public Result<List<OrderListItemResponse>> listOrders(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long userId = requireAuthenticatedUserId(authorization);
        if (userId == null) {
            return unauthorized();
        }
        List<OrderListItemResponse> orders = orderService.listOrderItems(userId);
        return Result.success(orders);
    }

    @GetMapping("/tickets")
    public Result<List<TicketWalletItemResponse>> listMyTickets(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long userId = requireAuthenticatedUserId(authorization);
        if (userId == null) {
            return unauthorized();
        }
        return Result.success(ticketWalletService.listMyTickets(userId));
    }

    @PostMapping("/tickets/{ticketId}/entry-code")
    public Result<TicketEntryCodeResponse> createTicketEntryCode(
            @PathVariable Long ticketId,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long userId = requireAuthenticatedUserId(authorization);
        if (userId == null) {
            return unauthorized();
        }
        return Result.success(ticketWalletService.createEntryCode(userId, ticketId));
    }

    @PostMapping("/tickets/{ticketId}/transfer")
    public Result<TicketTransferCreateResponse> createTicketTransfer(
            @PathVariable Long ticketId,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long userId = requireAuthenticatedUserId(authorization);
        if (userId == null) {
            return unauthorized();
        }
        return Result.success(ticketWalletService.createTransfer(userId, ticketId));
    }

    @PostMapping("/tickets/transfers/claim")
    public Result<TicketTransferClaimResponse> claimTicketTransfer(
            @RequestBody(required = false) TicketTransferClaimRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long userId = requireAuthenticatedUserId(authorization);
        if (userId == null) {
            return unauthorized();
        }
        return Result.success(ticketWalletService.claimTransfer(userId, request != null ? request.getTransferCode() : null));
    }

    @PostMapping("/tickets/{ticketId}/transfer/revoke")
    public Result<TicketTransferRevokeResponse> revokeTicketTransfer(
            @PathVariable Long ticketId,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long userId = requireAuthenticatedUserId(authorization);
        if (userId == null) {
            return unauthorized();
        }
        return Result.success(ticketWalletService.revokeTransfer(userId, ticketId));
    }

    @GetMapping("/user/{userId}")
    public Result<List<OrderListItemResponse>> listOrders(@PathVariable Long userId,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        return listOrders(authorization);
    }

    @GetMapping("/my/trash")
    public Result<List<OrderListItemResponse>> listTrashOrders(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long userId = requireAuthenticatedUserId(authorization);
        if (userId == null) {
            return unauthorized();
        }
        return Result.success(orderService.listTrashOrderItems(userId));
    }

    @GetMapping("/user/{userId}/trash")
    public Result<List<OrderListItemResponse>> listTrashOrders(@PathVariable Long userId,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        return listTrashOrders(authorization);
    }

    @PostMapping("/{id}/hide")
    public Result<Void> hideOrder(@PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long userId = requireAuthenticatedUserId(authorization);
        if (userId == null) {
            return unauthorized();
        }
        orderService.hideOrder(id, userId);
        return Result.success();
    }

    @PostMapping("/{id}/restore")
    public Result<Void> restoreOrder(@PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long userId = requireAuthenticatedUserId(authorization);
        if (userId == null) {
            return unauthorized();
        }
        orderService.restoreOrder(id, userId);
        return Result.success();
    }

    /**
     * 订单详情
     */
    @GetMapping("/{id}")
    public Result<Order> getOrderDetail(@PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long userId = requireAuthenticatedUserId(authorization);
        if (userId == null) {
            return unauthorized();
        }
        Order order = orderService.getUserOrderDetail(id, userId);
        return Result.success(order);
    }

    @GetMapping("/{id}/refund-options")
    public Result<RefundOptionsResponse> getRefundOptions(@PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long userId = requireAuthenticatedUserId(authorization);
        if (userId == null) {
            return unauthorized();
        }
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

    @GetMapping("/internal/grab-requests/{grabRequestId}")
    public Result<OrderListItemResponse> getInternalOrderByGrabRequest(
            @PathVariable String grabRequestId,
            @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        return Result.success(orderService.findOrderByGrabRequestId(grabRequestId));
    }

    @GetMapping("/internal/{id}/refund-options")
    public Result<RefundOptionsResponse> getInternalRefundOptions(@PathVariable Long id,
            @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        return Result.success(orderService.getRefundOptions(id));
    }

    @GetMapping("/internal/{id}/seats")
    public Result<List<OrderSeatItemResponse>> listInternalOrderSeats(@PathVariable Long id,
            @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "forbidden");
        }
        return Result.success(orderService.listInternalOrderSeats(id));
    }

    @PostMapping("/internal/paid-by-sessions")
    public Result<List<OrderListItemResponse>> listInternalPaidOrdersBySessions(
            @RequestBody(required = false) PaidOrdersBySessionsRequest request,
            @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        List<Long> sessionIds = request != null ? request.getSessionIds() : java.util.Collections.emptyList();
        boolean paidOnly = request == null || !Boolean.FALSE.equals(request.getPaidOnly());
        return Result.success(orderService.listOrderItemsBySessions(sessionIds, paidOnly));
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

    @PostMapping("/internal/tickets/check-in")
    public Result<TicketCheckInResponse> checkInTicket(
            @RequestBody(required = false) TicketCheckInRequest request,
            @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        return Result.success(ticketWalletService.checkIn(request != null ? request.getEntryCode() : null));
    }

    /**
     * 取消订单
     */
    @DeleteMapping("/{id}")
    public Result<Void> cancelOrder(@PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Long userId = requireAuthenticatedUserId(authorization);
        if (userId == null) {
            return unauthorized();
        }
        orderService.cancelUserOrder(id, userId);
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
    @SentinelResource(value = OrderSentinelConfig.INTERNAL_MARK_PAID_RESOURCE, blockHandler = "markInternalPaidBlocked")
    public Result<Order> markInternalPaid(@PathVariable Long id,
                                            @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        Order order = orderService.markPaid(id);
        return Result.success(order);
    }

    public Result<Order> markInternalPaidBlocked(Long id, String token, BlockException exception) {
        return Result.fail(429, "系统繁忙，请稍后重试");
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

    private Long requireAuthenticatedUserId(String authorization) {
        if (!StringUtils.hasText(authorization) || !authorization.startsWith("Bearer ")) {
            return null;
        }
        try {
            Claims claims = Jwts.parserBuilder()
                    .setSigningKey(Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8)))
                    .build()
                    .parseClaimsJws(authorization.substring("Bearer ".length()))
                    .getBody();
            Object userId = claims.get("userId");
            if (userId == null) {
                userId = claims.getSubject();
            }
            if (userId == null) {
                return null;
            }
            return Long.valueOf(String.valueOf(userId));
        } catch (RuntimeException e) {
            return null;
        }
    }

    private <T> Result<T> unauthorized() {
        return Result.fail(401, "未登录");
    }

    private boolean isValidInternalToken(String token) {
        return StringUtils.hasText(internalApiToken) && internalApiToken.equals(token);
    }
}
