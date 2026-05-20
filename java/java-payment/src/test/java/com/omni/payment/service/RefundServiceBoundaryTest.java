package com.omni.payment.service;

import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.omni.common.result.Result;
import com.omni.exception.BusinessException;
import com.omni.payment.client.OrderClient;
import com.omni.payment.client.TicketRefundReviewInternalClient;
import com.omni.payment.client.UserInternalClient;
import com.omni.payment.dto.InternalUserRefResponse;
import com.omni.payment.dto.OrderInfoResponse;
import com.omni.payment.dto.RefundRequestVO;
import com.omni.payment.dto.TicketRefundReviewPermissionResponse;
import com.omni.payment.entity.RefundRequest;
import com.omni.payment.mapper.PaymentMapper;
import com.omni.payment.mapper.RefundRequestMapper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class RefundServiceBoundaryTest {

    private OrderClient orderClient;
    private RefundRequestMapper refundRequestMapper;
    private PaymentMapper paymentMapper;
    private UserInternalClient userInternalClient;
    private TicketRefundReviewInternalClient ticketRefundReviewInternalClient;
    private RefundService service;

    @BeforeEach
    void setUp() {
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new Configuration(), ""), RefundRequest.class);
        orderClient = mock(OrderClient.class);
        refundRequestMapper = mock(RefundRequestMapper.class);
        paymentMapper = mock(PaymentMapper.class);
        userInternalClient = mock(UserInternalClient.class);
        ticketRefundReviewInternalClient = mock(TicketRefundReviewInternalClient.class);
        service = new RefundService(
                null, orderClient, refundRequestMapper, paymentMapper,
                userInternalClient, ticketRefundReviewInternalClient, "test-internal-token");
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
}
