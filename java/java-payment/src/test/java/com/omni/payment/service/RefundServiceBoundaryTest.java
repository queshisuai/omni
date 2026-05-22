package com.omni.payment.service;

import com.alipay.api.AlipayClient;
import com.alipay.api.request.AlipayTradeRefundRequest;
import com.alipay.api.response.AlipayTradeRefundResponse;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.omni.common.result.Result;
import com.omni.exception.BusinessException;
import com.omni.payment.client.OrderClient;
import com.omni.payment.config.AlipayProperties;
import com.omni.payment.client.TicketRefundReviewInternalClient;
import com.omni.payment.client.UserInternalClient;
import com.omni.payment.dto.InternalUserRefResponse;
import com.omni.payment.dto.MarkPartialRefundedRequest;
import com.omni.payment.dto.OrderInfoResponse;
import com.omni.payment.dto.OrderRefundOptionsResponse;
import com.omni.payment.dto.RefundSeatOptionResponse;
import com.omni.payment.dto.RefundRequestVO;
import com.omni.payment.dto.TicketRefundReviewPermissionResponse;
import com.omni.payment.entity.Payment;
import com.omni.payment.entity.RefundRequest;
import com.omni.payment.mapper.PaymentMapper;
import com.omni.payment.mapper.RefundRequestMapper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class RefundServiceBoundaryTest {

    private OrderClient orderClient;
    private RefundRequestMapper refundRequestMapper;
    private PaymentMapper paymentMapper;
    private UserInternalClient userInternalClient;
    private TicketRefundReviewInternalClient ticketRefundReviewInternalClient;
    private AlipayClient alipayClient;
    private RefundService service;

    @BeforeEach
    void setUp() {
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new Configuration(), ""), RefundRequest.class);
        orderClient = mock(OrderClient.class);
        refundRequestMapper = mock(RefundRequestMapper.class);
        paymentMapper = mock(PaymentMapper.class);
        userInternalClient = mock(UserInternalClient.class);
        ticketRefundReviewInternalClient = mock(TicketRefundReviewInternalClient.class);
        alipayClient = mock(AlipayClient.class);
        service = new RefundService(
                alipayProperties(), orderClient, refundRequestMapper, paymentMapper,
                userInternalClient, ticketRefundReviewInternalClient, "test-internal-token", () -> alipayClient);
    }

    @Test
    void applyPartialRefundCalculatesAmountFromOrderOptions() {
        OrderInfoResponse order = order(10L, "DM-TEST-001", new BigDecimal("760.00"), 2);
        order.setUserId(2004L);
        OrderRefundOptionsResponse options = refundOptions(10L, 2, 0, 2, new BigDecimal("380.00"));
        when(orderClient.getOrder(10L, "test-internal-token")).thenReturn(Result.success(order));
        when(orderClient.getRefundOptions(10L, "test-internal-token")).thenReturn(Result.success(options));
        when(paymentMapper.selectOne(any())).thenReturn(successPayment(order));
        when(refundRequestMapper.insert(any(RefundRequest.class))).thenAnswer(invocation -> {
            RefundRequest refund = invocation.getArgument(0);
            refund.setId(1L);
            return 1;
        });

        RefundRequestVO result = service.applyRefund(10L, 2004L, "只退一张", null, 1, List.of());

        assertEquals(new BigDecimal("380.00"), result.getAmount());
        assertEquals("partial", result.getRefundType());
        assertEquals(1, result.getQuantity());
        ArgumentCaptor<RefundRequest> captor = ArgumentCaptor.forClass(RefundRequest.class);
        verify(refundRequestMapper).insert(captor.capture());
        assertEquals("partial", captor.getValue().getRefundType());
        assertEquals(1, captor.getValue().getQuantity());
    }

    @Test
    void applyPartialRefundRejectsQuantityOverRefundable() {
        OrderInfoResponse order = order(10L, "DM-TEST-001", new BigDecimal("760.00"), 2);
        order.setUserId(2004L);
        when(orderClient.getOrder(10L, "test-internal-token")).thenReturn(Result.success(order));
        when(orderClient.getRefundOptions(10L, "test-internal-token"))
                .thenReturn(Result.success(refundOptions(10L, 2, 1, 1, new BigDecimal("380.00"))));

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.applyRefund(10L, 2004L, "超量", null, 2, List.of()));

        assertEquals("可退款票数不足", error.getMessage());
        verify(refundRequestMapper, never()).insert(any());
    }

    @Test
    void applyRefundRejectsAnyPendingRefundEvenWhenLatestIsPartialSuccess() {
        OrderInfoResponse order = order(10L, "DM-TEST-001", new BigDecimal("760.00"), 2);
        order.setUserId(2004L);
        RefundRequest partialSuccess = refund(1L, 10L, new BigDecimal("380.00"), 1);
        partialSuccess.setRefundType("partial");
        RefundRequest pending = refund(2L, 10L, new BigDecimal("380.00"), 0);
        pending.setRefundType("partial");
        when(orderClient.getOrder(10L, "test-internal-token")).thenReturn(Result.success(order));
        when(refundRequestMapper.selectOne(any())).thenReturn(partialSuccess);
        when(refundRequestMapper.selectList(any())).thenReturn(List.of(pending));

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.applyRefund(10L, 2004L, "再次申请", null, 1, List.of()));

        assertEquals("该订单已有退款申请，不允许重复申请", error.getMessage());
        verify(orderClient, never()).getRefundOptions(anyLong(), anyString());
        verify(refundRequestMapper, never()).insert(any());
    }

    @Test
    void applyPartialRefundRequiresSeatIdsWhenOrderHasRefundableSeats() {
        OrderInfoResponse order = order(10L, "DM-TEST-001", new BigDecimal("760.00"), 2);
        order.setUserId(2004L);
        OrderRefundOptionsResponse options = refundOptions(10L, 2, 0, 2, new BigDecimal("380.00"));
        options.setSeats(List.of(refundSeat(101L), refundSeat(102L)));
        when(orderClient.getOrder(10L, "test-internal-token")).thenReturn(Result.success(order));
        when(orderClient.getRefundOptions(10L, "test-internal-token")).thenReturn(Result.success(options));

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.applyRefund(10L, 2004L, "有座订单", null, 1, List.of()));

        assertEquals("有座订单必须选择退款座位", error.getMessage());
        verify(refundRequestMapper, never()).insert(any());
    }

    @Test
    void approvePartialRefundMarksOrderPartialRefunded() throws Exception {
        Long refundId = 500L;
        Long reviewerId = 2002L;
        RefundRequest pending = refund(refundId, 10L, new BigDecimal("380.00"), 0);
        pending.setUserId(2004L);
        pending.setPaymentId(90L);
        pending.setRefundNo("RF-PARTIAL-1");
        pending.setRefundType("partial");
        pending.setQuantity(1);
        pending.setOrderSeatIds("101");
        RefundRequest processing = refund(refundId, 10L, new BigDecimal("380.00"), 4);
        processing.setUserId(2004L);
        processing.setPaymentId(90L);
        processing.setRefundNo("RF-PARTIAL-1");
        processing.setRefundType("partial");
        processing.setQuantity(1);
        processing.setOrderSeatIds("101");
        RefundRequest succeeded = refund(refundId, 10L, new BigDecimal("380.00"), 1);
        succeeded.setUserId(2004L);
        succeeded.setPaymentId(90L);
        succeeded.setRefundNo("RF-PARTIAL-1");
        succeeded.setRefundType("partial");
        succeeded.setQuantity(1);
        succeeded.setOrderSeatIds("101");
        when(refundRequestMapper.selectById(refundId)).thenReturn(pending, processing, succeeded);
        OrderInfoResponse order = order(10L, "DM-TEST-001", new BigDecimal("760.00"), 2);
        order.setSessionId(3001L);
        when(orderClient.getOrder(10L, "test-internal-token")).thenReturn(Result.success(order));
        OrderRefundOptionsResponse options = refundOptions(10L, 2, 0, 2, new BigDecimal("380.00"));
        options.setSeats(List.of(refundSeat(101L), refundSeat(102L)));
        when(orderClient.getRefundOptions(10L, "test-internal-token")).thenReturn(Result.success(options));
        when(userInternalClient.getUserRef(reviewerId, "test-internal-token"))
                .thenReturn(Result.success(adminUser(reviewerId)));
        when(paymentMapper.selectById(90L)).thenReturn(successPayment(order));
        when(refundRequestMapper.update(any(), any())).thenReturn(1);
        AlipayTradeRefundResponse alipayResponse = mock(AlipayTradeRefundResponse.class);
        when(alipayResponse.isSuccess()).thenReturn(true);
        when(alipayResponse.getTradeNo()).thenReturn("ALI-REFUND-1");
        when(alipayClient.execute(any(AlipayTradeRefundRequest.class))).thenReturn(alipayResponse);
        when(orderClient.markPartialRefunded(eq(10L), any(MarkPartialRefundedRequest.class), eq("test-internal-token")))
                .thenReturn(Result.success(order));

        RefundRequestVO result = service.approve(refundId, reviewerId, "同意");

        assertEquals(1, result.getStatus());
        ArgumentCaptor<MarkPartialRefundedRequest> captor = ArgumentCaptor.forClass(MarkPartialRefundedRequest.class);
        verify(orderClient).markPartialRefunded(eq(10L), captor.capture(), eq("test-internal-token"));
        assertEquals(1, captor.getValue().getQuantity());
        assertEquals(List.of(101L), captor.getValue().getOrderSeatIds());
        verify(orderClient, never()).markRefunded(anyLong(), anyString());
    }

    @Test
    void approvePartialRefundMarksFailedWhenOrderUpdateFailsAfterAlipaySuccess() throws Exception {
        Long refundId = 501L;
        Long reviewerId = 2002L;
        RefundRequest pending = refund(refundId, 10L, new BigDecimal("380.00"), 0);
        pending.setPaymentId(90L);
        pending.setRefundNo("RF-PARTIAL-2");
        pending.setRefundType("partial");
        pending.setQuantity(1);
        RefundRequest processing = refund(refundId, 10L, new BigDecimal("380.00"), 4);
        processing.setPaymentId(90L);
        processing.setRefundNo("RF-PARTIAL-2");
        processing.setRefundType("partial");
        processing.setQuantity(1);
        RefundRequest failed = refund(refundId, 10L, new BigDecimal("380.00"), 3);
        failed.setPaymentId(90L);
        failed.setRefundNo("RF-PARTIAL-2");
        failed.setRefundType("partial");
        failed.setQuantity(1);
        when(refundRequestMapper.selectById(refundId)).thenReturn(pending, processing, failed);
        OrderInfoResponse order = order(10L, "DM-TEST-001", new BigDecimal("760.00"), 2);
        when(orderClient.getOrder(10L, "test-internal-token")).thenReturn(Result.success(order));
        when(orderClient.getRefundOptions(10L, "test-internal-token"))
                .thenReturn(Result.success(refundOptions(10L, 2, 0, 2, new BigDecimal("380.00"))));
        when(userInternalClient.getUserRef(reviewerId, "test-internal-token"))
                .thenReturn(Result.success(adminUser(reviewerId)));
        when(paymentMapper.selectById(90L)).thenReturn(successPayment(order));
        when(refundRequestMapper.update(any(), any())).thenReturn(1);
        AlipayTradeRefundResponse alipayResponse = mock(AlipayTradeRefundResponse.class);
        when(alipayResponse.isSuccess()).thenReturn(true);
        when(alipayResponse.getTradeNo()).thenReturn("ALI-REFUND-2");
        when(alipayClient.execute(any(AlipayTradeRefundRequest.class))).thenReturn(alipayResponse);
        when(orderClient.markPartialRefunded(eq(10L), any(MarkPartialRefundedRequest.class), eq("test-internal-token")))
                .thenReturn(Result.fail(500, "order failed"));

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.approve(refundId, reviewerId, "同意"));

        assertEquals("支付宝退款已成功，但订单状态更新失败，需人工补偿", error.getMessage());
        verify(orderClient).markPartialRefunded(eq(10L), any(MarkPartialRefundedRequest.class), eq("test-internal-token"));
        verify(refundRequestMapper, times(2)).update(any(), any());
    }

    @Test
    void approvePartialRefundRejectsQuantityDriftBeforeAlipay() throws Exception {
        Long refundId = 502L;
        Long reviewerId = 2002L;
        RefundRequest pending = refund(refundId, 10L, new BigDecimal("760.00"), 0);
        pending.setPaymentId(90L);
        pending.setRefundNo("RF-PARTIAL-3");
        pending.setRefundType("partial");
        pending.setQuantity(2);
        when(refundRequestMapper.selectById(refundId)).thenReturn(pending);
        OrderInfoResponse order = order(10L, "DM-TEST-001", new BigDecimal("760.00"), 2);
        when(orderClient.getOrder(10L, "test-internal-token")).thenReturn(Result.success(order));
        when(userInternalClient.getUserRef(reviewerId, "test-internal-token"))
                .thenReturn(Result.success(adminUser(reviewerId)));
        when(paymentMapper.selectById(90L)).thenReturn(successPayment(order));
        when(refundRequestMapper.update(any(), any())).thenReturn(1);
        when(orderClient.getRefundOptions(10L, "test-internal-token"))
                .thenReturn(Result.success(refundOptions(10L, 2, 1, 1, new BigDecimal("380.00"))));

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.approve(refundId, reviewerId, "同意"));

        assertEquals("当前可退款票数不足，请拒绝后让用户重新申请", error.getMessage());
        verify(alipayClient, never()).execute(any(AlipayTradeRefundRequest.class));
        verify(refundRequestMapper).update(any(), any());
    }

    @Test
    void approvePartialRefundRejectsUnavailableSeatBeforeAlipay() throws Exception {
        Long refundId = 503L;
        Long reviewerId = 2002L;
        RefundRequest pending = refund(refundId, 10L, new BigDecimal("380.00"), 0);
        pending.setPaymentId(90L);
        pending.setRefundNo("RF-PARTIAL-4");
        pending.setRefundType("partial");
        pending.setQuantity(1);
        pending.setOrderSeatIds("101");
        when(refundRequestMapper.selectById(refundId)).thenReturn(pending);
        OrderInfoResponse order = order(10L, "DM-TEST-001", new BigDecimal("760.00"), 2);
        when(orderClient.getOrder(10L, "test-internal-token")).thenReturn(Result.success(order));
        when(userInternalClient.getUserRef(reviewerId, "test-internal-token"))
                .thenReturn(Result.success(adminUser(reviewerId)));
        when(paymentMapper.selectById(90L)).thenReturn(successPayment(order));
        when(refundRequestMapper.update(any(), any())).thenReturn(1);
        OrderRefundOptionsResponse options = refundOptions(10L, 2, 0, 2, new BigDecimal("380.00"));
        options.setSeats(List.of(refundSeat(102L)));
        when(orderClient.getRefundOptions(10L, "test-internal-token")).thenReturn(Result.success(options));

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.approve(refundId, reviewerId, "同意"));

        assertEquals("退款座位当前不可退，请拒绝后让用户重新申请", error.getMessage());
        verify(alipayClient, never()).execute(any(AlipayTradeRefundRequest.class));
        verify(refundRequestMapper).update(any(), any());
    }

    @Test
    void adminRejectsPendingRefundWithoutRefMappers() {
        Long refundId = 100L;
        Long reviewerId = 2002L;
        String reviewNote = "退款理由不充分";

        RefundRequest pending = refund(refundId, 10L, new BigDecimal("100.00"), 0);
        when(refundRequestMapper.selectById(refundId)).thenReturn(pending);

        OrderInfoResponse order = order(10L, "DM-TEST-001", new BigDecimal("100.00"), 2);
        when(orderClient.getOrder(10L, "test-internal-token")).thenReturn(Result.success(order));

        InternalUserRefResponse adminUser = new InternalUserRefResponse();
        adminUser.setId(reviewerId);
        adminUser.setRole("admin");
        when(userInternalClient.getUserRef(reviewerId, "test-internal-token"))
                .thenReturn(Result.success(adminUser));

        when(refundRequestMapper.update(any(), any())).thenReturn(1);

        RefundRequest rejected = refund(refundId, 10L, new BigDecimal("100.00"), 2);
        rejected.setReviewerId(reviewerId);
        rejected.setReviewNote(reviewNote);
        rejected.setReviewTime(LocalDateTime.now());
        when(refundRequestMapper.selectById(refundId)).thenReturn(pending, rejected);

        RefundRequestVO result = service.reject(refundId, reviewerId, reviewNote);

        assertNotNull(result);
        assertEquals(refundId, result.getId());
        assertEquals(2, result.getStatus().intValue());
        verify(userInternalClient).getUserRef(reviewerId, "test-internal-token");
        verify(ticketRefundReviewInternalClient, never()).checkPermission(any(), any(), any());
    }

    @Test
    void organizerRejectsPendingRefundWhenPermissionGranted() {
        Long refundId = 100L;
        Long reviewerId = 2003L;
        String reviewNote = "同意退款";

        RefundRequest pending = refund(refundId, 10L, new BigDecimal("100.00"), 0);
        when(refundRequestMapper.selectById(refundId)).thenReturn(pending);

        OrderInfoResponse order = order(10L, "DM-TEST-001", new BigDecimal("100.00"), 2);
        order.setSessionId(3001L);
        when(orderClient.getOrder(10L, "test-internal-token")).thenReturn(Result.success(order));

        InternalUserRefResponse organizerUser = new InternalUserRefResponse();
        organizerUser.setId(reviewerId);
        organizerUser.setRole("organizer");
        when(userInternalClient.getUserRef(reviewerId, "test-internal-token"))
                .thenReturn(Result.success(organizerUser));

        TicketRefundReviewPermissionResponse permission = new TicketRefundReviewPermissionResponse();
        permission.setAllowed(true);
        permission.setSessionId(3001L);
        permission.setActivityId(5001L);
        permission.setOrganizerId(reviewerId);
        when(ticketRefundReviewInternalClient.checkPermission(3001L, reviewerId, "test-internal-token"))
                .thenReturn(Result.success(permission));

        when(refundRequestMapper.update(any(), any())).thenReturn(1);

        RefundRequest rejected = refund(refundId, 10L, new BigDecimal("100.00"), 2);
        rejected.setReviewerId(reviewerId);
        rejected.setReviewNote(reviewNote);
        rejected.setReviewTime(LocalDateTime.now());
        when(refundRequestMapper.selectById(refundId)).thenReturn(pending, rejected);

        RefundRequestVO result = service.reject(refundId, reviewerId, reviewNote);

        assertNotNull(result);
        assertEquals(refundId, result.getId());
        assertEquals(2, result.getStatus().intValue());
        verify(ticketRefundReviewInternalClient).checkPermission(3001L, reviewerId, "test-internal-token");
    }

    @Test
    void organizerCannotRejectWhenPermissionDenied() {
        Long refundId = 100L;
        Long reviewerId = 9999L;
        String reviewNote = "我要退款";

        RefundRequest pending = refund(refundId, 10L, new BigDecimal("100.00"), 0);
        when(refundRequestMapper.selectById(refundId)).thenReturn(pending);

        OrderInfoResponse order = order(10L, "DM-TEST-001", new BigDecimal("100.00"), 2);
        order.setSessionId(3001L);
        when(orderClient.getOrder(10L, "test-internal-token")).thenReturn(Result.success(order));

        InternalUserRefResponse organizerUser = new InternalUserRefResponse();
        organizerUser.setId(reviewerId);
        organizerUser.setRole("organizer");
        when(userInternalClient.getUserRef(reviewerId, "test-internal-token"))
                .thenReturn(Result.success(organizerUser));

        TicketRefundReviewPermissionResponse permission = new TicketRefundReviewPermissionResponse();
        permission.setAllowed(false);
        permission.setSessionId(3001L);
        permission.setActivityId(5001L);
        permission.setOrganizerId(2003L);
        permission.setReason("审核人不是活动主办方");
        when(ticketRefundReviewInternalClient.checkPermission(3001L, reviewerId, "test-internal-token"))
                .thenReturn(Result.success(permission));

        assertThrows(BusinessException.class,
                () -> service.reject(refundId, reviewerId, reviewNote));

        verify(ticketRefundReviewInternalClient).checkPermission(3001L, reviewerId, "test-internal-token");
        verify(refundRequestMapper, never()).update(any(), any());
    }

    @Test
    void applyRefundMapsOrderServiceExceptionBeforeInsert() {
        when(orderClient.getOrder(30L, "test-internal-token")).thenThrow(new RuntimeException("timeout"));

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.applyRefund(30L, 2004L, "测试退款"));
        assertEquals("订单服务无响应", error.getMessage());
        verify(refundRequestMapper, never()).insert(any());
    }

    @Test
    void rejectRefundMapsUserServiceExceptionBeforeUpdate() {
        Long refundId = 200L;
        Long reviewerId = 2002L;

        RefundRequest pending = refund(refundId, 10L, new BigDecimal("100.00"), 0);
        when(refundRequestMapper.selectById(refundId)).thenReturn(pending);

        OrderInfoResponse order = order(10L, "DM-TEST-001", new BigDecimal("100.00"), 2);
        when(orderClient.getOrder(10L, "test-internal-token")).thenReturn(Result.success(order));

        when(userInternalClient.getUserRef(reviewerId, "test-internal-token"))
                .thenThrow(new RuntimeException("timeout"));

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.reject(refundId, reviewerId, "拒绝"));
        assertEquals("用户服务无响应", error.getMessage());
        verify(refundRequestMapper, never()).update(any(), any());
    }

    @Test
    void rejectRefundMapsTicketServiceExceptionBeforeUpdate() {
        Long refundId = 300L;
        Long reviewerId = 2003L;

        RefundRequest pending = refund(refundId, 10L, new BigDecimal("100.00"), 0);
        when(refundRequestMapper.selectById(refundId)).thenReturn(pending);

        OrderInfoResponse order = order(10L, "DM-TEST-001", new BigDecimal("100.00"), 2);
        order.setSessionId(3001L);
        when(orderClient.getOrder(10L, "test-internal-token")).thenReturn(Result.success(order));

        InternalUserRefResponse organizerUser = new InternalUserRefResponse();
        organizerUser.setId(reviewerId);
        organizerUser.setRole("organizer");
        when(userInternalClient.getUserRef(reviewerId, "test-internal-token"))
                .thenReturn(Result.success(organizerUser));

        when(ticketRefundReviewInternalClient.checkPermission(3001L, reviewerId, "test-internal-token"))
                .thenThrow(new RuntimeException("timeout"));

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.reject(refundId, reviewerId, "拒绝"));
        assertEquals("票务服务无响应", error.getMessage());
        verify(refundRequestMapper, never()).update(any(), any());
    }

    private RefundRequest refund(Long id, Long orderId, BigDecimal amount, Integer status) {
        RefundRequest r = new RefundRequest();
        r.setId(id);
        r.setOrderId(orderId);
        r.setAmount(amount);
        r.setStatus(status);
        return r;
    }

    private OrderInfoResponse order(Long id, String orderNo, BigDecimal amount, Integer status) {
        OrderInfoResponse o = new OrderInfoResponse();
        o.setId(id);
        o.setOrderNo(orderNo);
        o.setAmount(amount);
        o.setStatus(status);
        return o;
    }

    private OrderRefundOptionsResponse refundOptions(Long orderId, int totalQuantity, int refundedQuantity,
                                                     int refundableQuantity, BigDecimal unitPrice) {
        OrderRefundOptionsResponse options = new OrderRefundOptionsResponse();
        options.setOrderId(orderId);
        options.setTotalQuantity(totalQuantity);
        options.setRefundedQuantity(refundedQuantity);
        options.setRefundableQuantity(refundableQuantity);
        options.setUnitPrice(unitPrice);
        options.setSeats(List.of());
        return options;
    }

    private RefundSeatOptionResponse refundSeat(Long orderSeatId) {
        RefundSeatOptionResponse seat = new RefundSeatOptionResponse();
        seat.setOrderSeatId(orderSeatId);
        return seat;
    }

    private Payment successPayment(OrderInfoResponse order) {
        Payment payment = new Payment();
        payment.setId(90L);
        payment.setOrderId(order.getId());
        payment.setOutTradeNo(order.getOrderNo());
        payment.setTradeNo("ALI-TRADE-1");
        payment.setAmount(order.getAmount());
        payment.setStatus(PaymentService.STATUS_SUCCESS);
        return payment;
    }

    private InternalUserRefResponse adminUser(Long reviewerId) {
        InternalUserRefResponse admin = new InternalUserRefResponse();
        admin.setId(reviewerId);
        admin.setRole("admin");
        return admin;
    }

    private AlipayProperties alipayProperties() {
        AlipayProperties properties = new AlipayProperties();
        properties.setGatewayUrl("https://openapi-sandbox.dl.alipaydev.com/gateway.do");
        properties.setAppId("app-id");
        properties.setMerchantPrivateKey("merchant-private-key");
        properties.setAlipayPublicKey("alipay-public-key");
        return properties;
    }
}
