package com.omni.order.service;

import com.omni.common.result.Result;
import com.omni.exception.BusinessException;
import com.omni.order.client.PaymentInternalClient;
import com.omni.order.client.TicketSalesInternalClient;
import com.omni.order.client.UserInternalClient;
import com.omni.order.config.OrderSentinelConfig;
import com.omni.order.dto.CreateOrderRequest;
import com.omni.order.dto.CreateTeamOrderRequest;
import com.omni.order.dto.InternalUserRefResponse;
import com.omni.order.dto.LockSeatsRequest;
import com.omni.order.dto.OrderListItemResponse;
import com.omni.order.dto.TicketSalesLockRequest;
import com.omni.order.dto.TicketSalesQuoteResponse;
import com.omni.order.dto.TicketSalesSeatLockResponse;
import com.omni.order.entity.Order;
import com.omni.order.entity.OrderSeat;
import com.omni.order.entity.OrderSnapshot;
import com.omni.order.mapper.OrderMapper;
import com.omni.order.mapper.OrderSeatMapper;
import com.omni.order.mapper.OrderSnapshotMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import com.alibaba.csp.sentinel.slots.block.RuleConstant;
import com.alibaba.csp.sentinel.slots.block.degrade.DegradeRule;
import com.alibaba.csp.sentinel.slots.block.degrade.DegradeRuleManager;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private OrderMapper orderMapper;

    @Mock
    private OrderSeatMapper orderSeatMapper;

    @Mock
    private OrderSnapshotMapper orderSnapshotMapper;

    @Mock
    private PaymentInternalClient paymentInternalClient;

    @Mock
    private TicketSalesInternalClient ticketSalesInternalClient;

    @Mock
    private UserInternalClient userInternalClient;

    private OrderService service;

    @BeforeEach
    void setUp() {
        service = new OrderService(orderMapper, orderSeatMapper, orderSnapshotMapper, paymentInternalClient, ticketSalesInternalClient, userInternalClient);
    }

    @AfterEach
    void tearDown() {
        DegradeRuleManager.loadRules(List.of());
    }

    @Test
    void createOrderOpensUserValidateCircuitAfterRuntimeFailures() {
        CreateOrderRequest request = new CreateOrderRequest();
        request.setUserId(2004L);
        request.setSessionId(10L);
        request.setTicketTypeId(20L);
        request.setQuantity(1);
        when(userInternalClient.getUserRef(eq(2004L), anyString())).thenThrow(new RuntimeException("timeout"));
        loadExceptionRatioRule(OrderSentinelConfig.USER_VALIDATE_RESOURCE);

        assertThrows(BusinessException.class, () -> service.createOrder(request));

        BusinessException blocked = assertThrows(BusinessException.class, () -> service.createOrder(request));
        assertEquals("用户服务暂不可用，请稍后重试", blocked.getMessage());
    }

    @Test
    void createOrderOpensTicketSalesCircuitAfterRuntimeFailures() {
        CreateOrderRequest request = new CreateOrderRequest();
        request.setUserId(2004L);
        request.setSessionId(10L);
        request.setTicketTypeId(20L);
        request.setQuantity(1);
        when(userInternalClient.getUserRef(eq(2004L), anyString())).thenReturn(Result.success(activeUser()));
        when(ticketSalesInternalClient.quote(any(), anyString())).thenThrow(new RuntimeException("timeout"));
        loadExceptionRatioRule(OrderSentinelConfig.TICKET_SALES_RESOURCE);

        assertThrows(RuntimeException.class, () -> service.createOrder(request));

        BusinessException blocked = assertThrows(BusinessException.class, () -> service.createOrder(request));
        assertEquals("票务服务暂不可用，请稍后重试", blocked.getMessage());
    }

    @Test
    void createOrderRejectsWhenActivityLimitExceeded() {
        CreateOrderRequest request = new CreateOrderRequest();
        request.setUserId(2004L);
        request.setSessionId(10L);
        request.setTicketTypeId(20L);
        request.setQuantity(2);

        TicketSalesQuoteResponse quote = quoteWithLimit(2);
        when(userInternalClient.getUserRef(eq(2004L), anyString())).thenReturn(Result.success(activeUser()));
        when(ticketSalesInternalClient.quote(any(), anyString())).thenReturn(Result.success(quote));
        when(orderMapper.sumEffectiveQuantityByUserAndActivity(2004L, 100L)).thenReturn(2);

        BusinessException ex = assertThrows(BusinessException.class, () -> service.createOrder(request));

        assertEquals("超过本活动个人限购数量", ex.getMessage());
        verify(orderMapper, never()).insert(any(Order.class));
    }

    @Test
    void createOrderRejectsWhenQuotePriceExceedsAuthorizedMax() {
        CreateOrderRequest request = new CreateOrderRequest();
        request.setUserId(2004L);
        request.setSessionId(101L);
        request.setTicketTypeId(1L);
        request.setQuantity(1);
        request.setAuthorizedMaxUnitPrice(new BigDecimal("980.00"));

        TicketSalesQuoteResponse quote = quoteWithoutLimit(1);
        quote.setTicketTypeId(1L);
        quote.setUnitPrice(new BigDecimal("1280.00"));
        when(userInternalClient.getUserRef(eq(2004L), anyString())).thenReturn(Result.success(activeUser()));
        when(ticketSalesInternalClient.quote(any(), anyString())).thenReturn(Result.success(quote));

        BusinessException exception = assertThrows(BusinessException.class, () -> service.createOrder(request));

        assertTrue(exception.getMessage().contains("authorized price"));
        verify(orderMapper, never()).insert(any(Order.class));
        verify(orderSnapshotMapper, never()).insert(any(OrderSnapshot.class));
    }

    @Test
    void createOrderRejectsGrabOrderMissingAuthorizedMaxBeforeLockOrInsert() {
        CreateOrderRequest request = new CreateOrderRequest();
        request.setUserId(2004L);
        request.setSessionId(101L);
        request.setTicketTypeId(1L);
        request.setQuantity(1);
        request.setGrabRequestId("GRAB-MISSING-AUTH");

        TicketSalesQuoteResponse quote = quoteWithoutLimit(1);
        quote.setUnitPrice(new BigDecimal("1280.00"));
        when(userInternalClient.getUserRef(eq(2004L), anyString())).thenReturn(Result.success(activeUser()));
        when(ticketSalesInternalClient.quote(any(), anyString())).thenReturn(Result.success(quote));

        assertThrows(BusinessException.class, () -> service.createOrder(request));

        verify(ticketSalesInternalClient, never()).lockStock(any(), anyString());
        verify(orderMapper, never()).insert(any(Order.class));
        verify(orderSnapshotMapper, never()).insert(any(OrderSnapshot.class));
    }

    @Test
    void createOrderWithSeatsRejectsGrabOrderMissingAuthorizedMaxBeforeLockOrInsert() {
        LockSeatsRequest request = new LockSeatsRequest();
        request.setUserId(2004L);
        request.setSessionId(101L);
        request.setTicketTypeId(1L);
        request.setSeatIds(List.of(301L));
        request.setGrabRequestId("GRAB-SEAT-MISSING-AUTH");

        TicketSalesQuoteResponse quote = quoteWithoutLimit(1);
        quote.setUnitPrice(new BigDecimal("1280.00"));
        when(userInternalClient.getUserRef(eq(2004L), anyString())).thenReturn(Result.success(activeUser()));
        when(ticketSalesInternalClient.quote(any(), anyString())).thenReturn(Result.success(quote));

        assertThrows(BusinessException.class, () -> service.createOrderWithSeats(request));

        verify(ticketSalesInternalClient, never()).lockSeats(any(), anyString());
        verify(orderMapper, never()).insert(any(Order.class));
        verify(orderSnapshotMapper, never()).insert(any(OrderSnapshot.class));
    }

    @Test
    void createTeamOrderUsesLeaderLimitAndDoesNotRelockSeats() {
        CreateTeamOrderRequest request = teamOrderRequest();

        TicketSalesQuoteResponse quote = quoteWithLimit(2);
        when(userInternalClient.getUserRef(eq(2004L), anyString())).thenReturn(Result.success(activeUser()));
        when(ticketSalesInternalClient.quote(any(), anyString())).thenReturn(Result.success(quote));
        when(orderMapper.sumEffectiveQuantityByUserAndActivity(2004L, 100L)).thenReturn(1);
        when(ticketSalesInternalClient.validateTeamSeatLock(any(), anyString())).thenReturn(Result.success(validTeamLock()));
        doAnswer(invocation -> {
            Order order = invocation.getArgument(0);
            order.setId(81L);
            return 1;
        }).when(orderMapper).insert(any(Order.class));

        Order order = service.createTeamOrderWithLockedSeats(request);

        assertEquals(2004L, order.getUserId());
        assertEquals(2, order.getQuantity());
        assertEquals(new BigDecimal("200.00"), order.getAmount());
        verify(orderMapper).sumEffectiveQuantityByUserAndActivity(2004L, 100L);
        ArgumentCaptor<TicketSalesLockRequest> validationCaptor = ArgumentCaptor.forClass(TicketSalesLockRequest.class);
        verify(ticketSalesInternalClient).validateTeamSeatLock(validationCaptor.capture(), anyString());
        assertEquals("TEAM-GRAB-1", validationCaptor.getValue().getLockRequestId());
        assertEquals(List.of(301L, 302L), validationCaptor.getValue().getSeatIds());
        verify(ticketSalesInternalClient, never()).lockSeats(any(), anyString());
        verify(ticketSalesInternalClient, never()).lockStock(any(), anyString());
    }

    @Test
    void createTeamOrderRejectsWhenTicketLockDoesNotBelongToRequest() {
        CreateTeamOrderRequest request = teamOrderRequest();
        TicketSalesSeatLockResponse invalid = new TicketSalesSeatLockResponse();
        invalid.setValid(false);
        invalid.setLockedSeatIds(List.of(301L));

        when(userInternalClient.getUserRef(eq(2004L), anyString())).thenReturn(Result.success(activeUser()));
        when(ticketSalesInternalClient.quote(any(), anyString())).thenReturn(Result.success(quoteWithoutLimit(2)));
        when(ticketSalesInternalClient.validateTeamSeatLock(any(), anyString())).thenReturn(Result.success(invalid));

        assertThrows(BusinessException.class, () -> service.createTeamOrderWithLockedSeats(request));

        verify(orderMapper, never()).insert(any(Order.class));
        verify(orderSeatMapper, never()).insert(any(OrderSeat.class));
        verify(ticketSalesInternalClient, never()).lockSeats(any(), anyString());
    }

    @Test
    void createTeamOrderStoresOrderOwnedSeatLabels() {
        CreateTeamOrderRequest request = teamOrderRequest();
        when(userInternalClient.getUserRef(eq(2004L), anyString())).thenReturn(Result.success(activeUser()));
        when(ticketSalesInternalClient.quote(any(), anyString())).thenReturn(Result.success(quoteWithoutLimit(2)));
        when(ticketSalesInternalClient.validateTeamSeatLock(any(), anyString())).thenReturn(Result.success(validTeamLock()));
        doAnswer(invocation -> {
            Order order = invocation.getArgument(0);
            order.setId(82L);
            return 1;
        }).when(orderMapper).insert(any(Order.class));

        service.createTeamOrderWithLockedSeats(request);

        ArgumentCaptor<OrderSeat> seatCaptor = ArgumentCaptor.forClass(OrderSeat.class);
        verify(orderSeatMapper, org.mockito.Mockito.times(2)).insert(seatCaptor.capture());
        assertEquals(List.of("A-1", "A-2"), seatCaptor.getAllValues().stream()
                .map(OrderSeat::getSeatLabel)
                .collect(java.util.stream.Collectors.toList()));

        ArgumentCaptor<OrderSnapshot> snapshotCaptor = ArgumentCaptor.forClass(OrderSnapshot.class);
        verify(orderSnapshotMapper).insert(snapshotCaptor.capture());
        assertEquals("A-1, A-2", snapshotCaptor.getValue().getSeatLabels());
        assertEquals(7001L, snapshotCaptor.getValue().getTeamId());
        assertEquals("TEAM-GRAB-1", snapshotCaptor.getValue().getTeamGrabRequestId());
        assertEquals(Boolean.TRUE, snapshotCaptor.getValue().getTeamOrder());
    }

    @Test
    void createOrderWritesGrabSnapshotFields() {
        CreateOrderRequest request = new CreateOrderRequest();
        request.setUserId(2004L);
        request.setSessionId(101L);
        request.setTicketTypeId(2L);
        request.setQuantity(1);
        request.setAuthorizedMaxUnitPrice(new BigDecimal("980.00"));
        request.setGrabRequestId("GRAB1");
        request.setRequestedTicketTypeId(1L);
        request.setMatchedTicketTypeId(2L);
        request.setAutoDowngraded(true);

        TicketSalesQuoteResponse quote = quoteWithoutLimit(1);
        quote.setTicketTypeId(2L);
        quote.setUnitPrice(new BigDecimal("980.00"));
        quote.setTicketName("B");
        when(userInternalClient.getUserRef(eq(2004L), anyString())).thenReturn(Result.success(activeUser()));
        when(ticketSalesInternalClient.quote(any(), anyString())).thenReturn(Result.success(quote));
        when(ticketSalesInternalClient.lockStock(any(TicketSalesLockRequest.class), anyString())).thenReturn(Result.success());

        service.createOrder(request);

        ArgumentCaptor<OrderSnapshot> snapshotCaptor = ArgumentCaptor.forClass(OrderSnapshot.class);
        verify(orderSnapshotMapper).insert(snapshotCaptor.capture());
        assertEquals("GRAB1", snapshotCaptor.getValue().getGrabRequestId());
        assertEquals(1L, snapshotCaptor.getValue().getRequestedTicketTypeId());
        assertEquals(2L, snapshotCaptor.getValue().getMatchedTicketTypeId());
        assertEquals(Boolean.TRUE, snapshotCaptor.getValue().getAutoDowngraded());
    }

    @Test
    void findOrderByGrabRequestIdReturnsOrderSummary() {
        OrderListItemResponse order = new OrderListItemResponse();
        order.setId(14L);
        order.setOrderNo("DM20260530120000ABCDEF");
        order.setStatus(1);
        order.setGrabRequestId("GRAB-20260530-1");
        when(orderMapper.selectOrderListItemByGrabRequestId("GRAB-20260530-1")).thenReturn(order);

        OrderListItemResponse result = service.findOrderByGrabRequestId("GRAB-20260530-1");

        assertEquals(14L, result.getId());
        assertEquals("DM20260530120000ABCDEF", result.getOrderNo());
        assertEquals(1, result.getStatus());
        assertEquals("GRAB-20260530-1", result.getGrabRequestId());
    }

    @Test
    void findOrderByGrabRequestIdReturnsNullWhenMissing() {
        when(orderMapper.selectOrderListItemByGrabRequestId("GRAB-20260530-missing")).thenReturn(null);

        OrderListItemResponse result = service.findOrderByGrabRequestId("GRAB-20260530-missing");

        assertNull(result);
    }

    @Test
    void createOrderWithSeatsRejectsWhenActivityLimitExceeded() {
        LockSeatsRequest request = new LockSeatsRequest();
        request.setUserId(2004L);
        request.setSessionId(10L);
        request.setTicketTypeId(20L);
        request.setSeatIds(List.of(301L, 302L));

        TicketSalesQuoteResponse quote = quoteWithLimit(2);
        when(userInternalClient.getUserRef(eq(2004L), anyString())).thenReturn(Result.success(activeUser()));
        when(ticketSalesInternalClient.quote(any(), anyString())).thenReturn(Result.success(quote));
        when(orderMapper.sumEffectiveQuantityByUserAndActivity(2004L, 100L)).thenReturn(2);

        BusinessException ex = assertThrows(BusinessException.class, () -> service.createOrderWithSeats(request));

        assertEquals("超过本活动个人限购数量", ex.getMessage());
        verify(orderMapper, never()).insert(any(Order.class));
        verify(ticketSalesInternalClient, never()).lockSeats(any(), anyString());
    }

    @Test
    void createOrderCountsPendingOrdersAgainstActivityLimit() {
        CreateOrderRequest request = new CreateOrderRequest();
        request.setUserId(2004L);
        request.setSessionId(10L);
        request.setTicketTypeId(20L);
        request.setQuantity(2);

        TicketSalesQuoteResponse quote = quoteWithLimit(2);
        when(userInternalClient.getUserRef(eq(2004L), anyString())).thenReturn(Result.success(activeUser()));
        when(ticketSalesInternalClient.quote(any(), anyString())).thenReturn(Result.success(quote));
        when(orderMapper.sumEffectiveQuantityByUserAndActivity(2004L, 100L)).thenReturn(2);

        BusinessException ex = assertThrows(BusinessException.class, () -> service.createOrder(request));

        assertEquals("超过本活动个人限购数量", ex.getMessage());
        verify(orderMapper).sumEffectiveQuantityByUserAndActivity(2004L, 100L);
        verify(orderMapper, never()).insert(any(Order.class));
        verify(ticketSalesInternalClient, never()).lockStock(any(), anyString());
    }

    @Test
    void createOrderDoesNotCheckQuantityWhenActivityHasNoPerUserLimit() {
        CreateOrderRequest request = new CreateOrderRequest();
        request.setUserId(2004L);
        request.setSessionId(10L);
        request.setTicketTypeId(20L);
        request.setQuantity(5);

        TicketSalesQuoteResponse quote = quoteWithoutLimit(5);
        when(userInternalClient.getUserRef(eq(2004L), anyString())).thenReturn(Result.success(activeUser()));
        when(ticketSalesInternalClient.quote(any(), anyString())).thenReturn(Result.success(quote));
        when(ticketSalesInternalClient.lockStock(any(TicketSalesLockRequest.class), anyString())).thenReturn(Result.success());

        service.createOrder(request);

        verify(orderMapper, never()).sumEffectiveQuantityByUserAndActivity(any(), any());
        verify(orderMapper).insert(any(Order.class));
    }

    @Test
    void createOrderRejectsLimitQuoteWithoutActivityId() {
        CreateOrderRequest request = new CreateOrderRequest();
        request.setUserId(2004L);
        request.setSessionId(10L);
        request.setTicketTypeId(20L);
        request.setQuantity(1);

        TicketSalesQuoteResponse quote = quoteWithLimit(1);
        quote.setActivityId(null);
        when(userInternalClient.getUserRef(eq(2004L), anyString())).thenReturn(Result.success(activeUser()));
        when(ticketSalesInternalClient.quote(any(), anyString())).thenReturn(Result.success(quote));

        BusinessException ex = assertThrows(BusinessException.class, () -> service.createOrder(request));

        assertEquals("活动限购信息不完整", ex.getMessage());
        verify(orderMapper, never()).sumEffectiveQuantityByUserAndActivity(any(), any());
        verify(orderMapper, never()).insert(any(Order.class));
        verify(ticketSalesInternalClient, never()).lockStock(any(), anyString());
    }

    private TicketSalesQuoteResponse quoteWithLimit(int quantity) {
        TicketSalesQuoteResponse quote = new TicketSalesQuoteResponse();
        quote.setActivityId(100L);
        quote.setPerUserLimit(3);
        quote.setUnitPrice(new BigDecimal("100.00"));
        quote.setQuantity(quantity);
        return quote;
    }

    private TicketSalesQuoteResponse quoteWithoutLimit(int quantity) {
        TicketSalesQuoteResponse quote = new TicketSalesQuoteResponse();
        quote.setActivityId(100L);
        quote.setUnitPrice(new BigDecimal("100.00"));
        quote.setQuantity(quantity);
        return quote;
    }

    private CreateTeamOrderRequest teamOrderRequest() {
        CreateTeamOrderRequest request = new CreateTeamOrderRequest();
        request.setTeamId(7001L);
        request.setUserId(2004L);
        request.setPayerUserId(2004L);
        request.setSessionId(101L);
        request.setTicketTypeId(1L);
        request.setQuantity(2);
        request.setTeamGrabRequestId("TEAM-GRAB-1");
        request.setGrabRequestId("GRAB-LEADER-1");
        request.setMatchedStrategy("STRICT_CONTIGUOUS");
        request.setAuthorizedMaxUnitPrice(new BigDecimal("100.00"));
        request.setSeats(List.of(teamSeat(301L, "A-1"), teamSeat(302L, "A-2")));
        return request;
    }

    private CreateTeamOrderRequest.TeamOrderSeatItem teamSeat(Long sessionSeatId, String seatLabel) {
        CreateTeamOrderRequest.TeamOrderSeatItem seat = new CreateTeamOrderRequest.TeamOrderSeatItem();
        seat.setSessionSeatId(sessionSeatId);
        seat.setSeatLabel(seatLabel);
        return seat;
    }

    private TicketSalesSeatLockResponse validTeamLock() {
        TicketSalesSeatLockResponse response = new TicketSalesSeatLockResponse();
        response.setValid(true);
        response.setLockedSeatIds(List.of(301L, 302L));
        response.setSeatLabels(List.of("ticket-label-1", "ticket-label-2"));
        return response;
    }

    private InternalUserRefResponse activeUser() {
        InternalUserRefResponse user = new InternalUserRefResponse();
        user.setId(2004L);
        user.setPhone("13900000001");
        user.setRole("user");
        user.setStatus(1);
        return user;
    }

    private void loadExceptionRatioRule(String resource) {
        DegradeRule rule = new DegradeRule();
        rule.setResource(resource);
        rule.setGrade(RuleConstant.DEGRADE_GRADE_EXCEPTION_RATIO);
        rule.setCount(0.5);
        rule.setMinRequestAmount(1);
        rule.setTimeWindow(10);
        DegradeRuleManager.loadRules(List.of(rule));
    }
}
