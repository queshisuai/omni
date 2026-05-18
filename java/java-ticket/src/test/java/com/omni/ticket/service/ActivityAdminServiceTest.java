package com.omni.ticket.service;

import com.omni.common.result.Result;
import com.omni.exception.BusinessException;
import com.omni.ticket.client.OrderInternalClient;
import com.omni.ticket.client.PaymentInternalClient;
import com.omni.ticket.dto.DeactivateOrganizerRequest;
import com.omni.ticket.dto.DeactivateActivityRequest;
import com.omni.ticket.dto.DirectRefundResponse;
import com.omni.ticket.dto.OrderInfoResponse;
import com.omni.ticket.dto.RefundImpactResponse;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.entity.UserRef;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.mapper.UserRefMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ActivityAdminServiceTest {

    @Mock
    private ActivityMapper activityMapper;
    @Mock
    private SessionMapper sessionMapper;
    @Mock
    private TicketTypeMapper ticketTypeMapper;
    @Mock
    private UserRefMapper userRefMapper;
    @Mock
    private OrderInternalClient orderInternalClient;
    @Mock
    private PaymentInternalClient paymentInternalClient;

    private ActivityAdminService service;

    @BeforeEach
    void setUp() {
        service = new ActivityAdminService(
                activityMapper,
                sessionMapper,
                ticketTypeMapper,
                userRefMapper,
                orderInternalClient,
                paymentInternalClient,
                "test-token");
    }

    @Test
    void deactivateActivityRejectsWhenRefundNotConfirmed() {
        Activity activity = activity(10L, 2003L);
        when(activityMapper.selectById(10L)).thenReturn(activity);
        when(userRefMapper.selectById(2003L)).thenReturn(user(2003L, "organizer"));

        DeactivateActivityRequest request = new DeactivateActivityRequest();
        request.setUserId(2003L);
        request.setConfirmRefund(false);

        assertThrows(BusinessException.class, () -> service.deactivateActivity(10L, request));
        verify(activityMapper, never()).updateById(any());
        verify(paymentInternalClient, never()).directRefund(any(), any());
    }

    @Test
    void deactivateActivityRejectsOrganizerForOtherActivity() {
        Activity activity = activity(10L, 9999L);
        when(activityMapper.selectById(10L)).thenReturn(activity);
        when(userRefMapper.selectById(2003L)).thenReturn(user(2003L, "organizer"));

        DeactivateActivityRequest request = new DeactivateActivityRequest();
        request.setUserId(2003L);
        request.setConfirmRefund(true);

        assertThrows(BusinessException.class, () -> service.deactivateActivity(10L, request));
        verify(activityMapper, never()).updateById(any());
        verify(paymentInternalClient, never()).directRefund(any(), any());
    }

    @Test
    void deactivateActivityDisablesActivitySessionsTicketTypesAndCallsDirectRefund() {
        Activity activity = activity(10L, 2003L);
        Session firstSession = session(101L, 10L);
        Session secondSession = session(102L, 10L);
        TicketType firstTicketType = ticketType(1001L, 101L);
        TicketType secondTicketType = ticketType(1002L, 102L);
        OrderInfoResponse paidOrder = order(5001L, "DM5001", 101L);
        DirectRefundResponse refundResponse = new DirectRefundResponse();
        refundResponse.setOrderId(5001L);
        refundResponse.setOrderNo("DM5001");
        refundResponse.setStatus("SUCCESS");
        refundResponse.setSuccess(true);
        refundResponse.setMessage("退款成功");

        when(activityMapper.selectById(10L)).thenReturn(activity);
        when(userRefMapper.selectById(2003L)).thenReturn(user(2003L, "organizer"));
        when(sessionMapper.selectList(any())).thenReturn(Arrays.asList(firstSession, secondSession));
        when(ticketTypeMapper.selectList(any())).thenReturn(Arrays.asList(firstTicketType, secondTicketType));
        when(orderInternalClient.listPaidBySessions(any(), eq("test-token"))).thenReturn(Result.success(Collections.singletonList(paidOrder)));
        when(paymentInternalClient.directRefund(any(), eq("test-token"))).thenReturn(Result.success(refundResponse));

        DeactivateActivityRequest request = new DeactivateActivityRequest();
        request.setUserId(2003L);
        request.setConfirmRefund(true);
        request.setReason("活动取消");

        RefundImpactResponse response = service.deactivateActivity(10L, request);

        assertEquals(0, activity.getStatus());
        assertEquals(0, firstSession.getStatus());
        assertEquals(0, secondSession.getStatus());
        assertEquals(0, firstTicketType.getStatus());
        assertEquals(0, secondTicketType.getStatus());
        assertEquals(1, response.getRefundSuccessCount());
        assertEquals(0, response.getRefundFailedCount());
        assertEquals(0, response.getRefundUnknownCount());
        assertEquals(0, response.getRefundCompensationRequiredCount());
        verify(activityMapper).updateById(activity);
        verify(sessionMapper).updateById(firstSession);
        verify(sessionMapper).updateById(secondSession);
        verify(ticketTypeMapper).updateById(firstTicketType);
        verify(ticketTypeMapper).updateById(secondTicketType);
        verify(paymentInternalClient).directRefund(any(), eq("test-token"));
    }

    @Test
    void deactivateActivitySeparatesFailedUnknownAndCompensationRefunds() {
        Activity activity = activity(10L, 2003L);
        Session session = session(101L, 10L);
        TicketType ticketType = ticketType(1001L, 101L);
        OrderInfoResponse failedOrder = order(5001L, "DM5001", 101L);
        OrderInfoResponse unknownOrder = order(5002L, "DM5002", 101L);
        OrderInfoResponse compensationOrder = order(5003L, "DM5003", 101L);
        DirectRefundResponse failed = refund(5001L, "DM5001", "FAILED", false, "支付流水缺失");
        DirectRefundResponse unknown = refund(5002L, "DM5002", "UNKNOWN", false, "支付宝退款异常，结果未知，请查询/人工确认");
        DirectRefundResponse compensation = refund(5003L, "DM5003", "COMPENSATION_REQUIRED", false, "支付宝已成功退款，但订单状态更新失败，需人工处理");

        when(activityMapper.selectById(10L)).thenReturn(activity);
        when(userRefMapper.selectById(2003L)).thenReturn(user(2003L, "organizer"));
        when(sessionMapper.selectList(any())).thenReturn(Collections.singletonList(session));
        when(ticketTypeMapper.selectList(any())).thenReturn(Collections.singletonList(ticketType));
        when(orderInternalClient.listPaidBySessions(any(), eq("test-token")))
                .thenReturn(Result.success(Arrays.asList(failedOrder, unknownOrder, compensationOrder)));
        when(paymentInternalClient.directRefund(any(), eq("test-token")))
                .thenReturn(Result.success(failed), Result.success(unknown), Result.success(compensation));

        DeactivateActivityRequest request = new DeactivateActivityRequest();
        request.setUserId(2003L);
        request.setConfirmRefund(true);

        RefundImpactResponse response = service.deactivateActivity(10L, request);

        assertEquals(0, response.getRefundSuccessCount());
        assertEquals(1, response.getRefundFailedCount());
        assertEquals(1, response.getRefundUnknownCount());
        assertEquals(1, response.getRefundCompensationRequiredCount());
        assertEquals(3, response.getFailures().size());
        assertEquals("FAILED", response.getFailures().get(0).getStatus());
        assertEquals("UNKNOWN", response.getFailures().get(1).getStatus());
        assertEquals("COMPENSATION_REQUIRED", response.getFailures().get(2).getStatus());
        assertEquals("DM5003", response.getFailures().get(2).getOrderNo());
    }

    @Test
    void deactivateActivityDeduplicatesPaidOrdersBeforeDirectRefund() {
        Activity activity = activity(10L, 2003L);
        Session session = session(101L, 10L);
        TicketType ticketType = ticketType(1001L, 101L);
        OrderInfoResponse firstOrder = order(5001L, "DM5001", 101L);
        OrderInfoResponse duplicateOrder = order(5001L, "DM5001", 101L);

        when(activityMapper.selectById(10L)).thenReturn(activity);
        when(userRefMapper.selectById(2003L)).thenReturn(user(2003L, "organizer"));
        when(sessionMapper.selectList(any())).thenReturn(Collections.singletonList(session));
        when(ticketTypeMapper.selectList(any())).thenReturn(Collections.singletonList(ticketType));
        when(orderInternalClient.listPaidBySessions(any(), eq("test-token")))
                .thenReturn(Result.success(Arrays.asList(firstOrder, duplicateOrder)));
        when(paymentInternalClient.directRefund(any(), eq("test-token")))
                .thenReturn(Result.success(refund(5001L, "DM5001", "SUCCESS", true, "退款成功")));

        DeactivateActivityRequest request = new DeactivateActivityRequest();
        request.setUserId(2003L);
        request.setConfirmRefund(true);

        RefundImpactResponse response = service.deactivateActivity(10L, request);

        assertEquals(1, response.getPaidOrderCount());
        assertEquals(1, response.getRefundSuccessCount());
        verify(paymentInternalClient, times(1)).directRefund(any(), eq("test-token"));
    }

    @Test
    void deactivateOrganizerRejectsNonAdminOperator() {
        when(userRefMapper.selectById(2003L)).thenReturn(user(2003L, "organizer"));

        DeactivateOrganizerRequest request = new DeactivateOrganizerRequest();
        request.setUserId(2003L);
        request.setOrganizerId(2004L);
        request.setConfirmRefund(true);

        assertThrows(BusinessException.class, () -> service.deactivateOrganizer(request));
        verify(activityMapper, never()).updateById(any());
        verify(userRefMapper, never()).updateById(any());
        verify(paymentInternalClient, never()).directRefund(any(), any());
    }

    @Test
    void deactivateOrganizerRejectsWhenRefundNotConfirmed() {
        when(userRefMapper.selectById(2002L)).thenReturn(user(2002L, "admin"));

        DeactivateOrganizerRequest request = new DeactivateOrganizerRequest();
        request.setUserId(2002L);
        request.setOrganizerId(2003L);
        request.setConfirmRefund(false);

        assertThrows(BusinessException.class, () -> service.deactivateOrganizer(request));
        verify(activityMapper, never()).updateById(any());
        verify(userRefMapper, never()).updateById(any());
        verify(paymentInternalClient, never()).directRefund(any(), any());
    }

    @Test
    void deactivateOrganizerDowngradesRoleDisablesAllActivitiesAndRefundsPaidOrders() {
        UserRef admin = user(2002L, "admin");
        UserRef organizer = user(2003L, "organizer");
        organizer.setOrganizerStatus(1);
        Activity firstActivity = activity(10L, 2003L);
        Activity secondActivity = activity(11L, 2003L);
        Session firstSession = session(101L, 10L);
        Session secondSession = session(102L, 11L);
        TicketType firstTicketType = ticketType(1001L, 101L);
        TicketType secondTicketType = ticketType(1002L, 102L);
        OrderInfoResponse firstOrder = order(5001L, "DM5001", 101L);
        OrderInfoResponse secondOrder = order(5002L, "DM5002", 102L);

        when(userRefMapper.selectById(2002L)).thenReturn(admin);
        when(userRefMapper.selectById(2003L)).thenReturn(organizer);
        when(activityMapper.selectList(any())).thenReturn(Arrays.asList(firstActivity, secondActivity));
        when(sessionMapper.selectList(any())).thenReturn(Arrays.asList(firstSession, secondSession));
        when(ticketTypeMapper.selectList(any())).thenReturn(Arrays.asList(firstTicketType, secondTicketType));
        when(orderInternalClient.listPaidBySessions(any(), eq("test-token")))
                .thenReturn(Result.success(Arrays.asList(firstOrder, secondOrder)));
        when(paymentInternalClient.directRefund(any(), eq("test-token")))
                .thenReturn(Result.success(refund(5001L, "DM5001", "SUCCESS", true, "退款成功")),
                        Result.success(refund(5002L, "DM5002", "FAILED", false, "退款失败")));

        DeactivateOrganizerRequest request = new DeactivateOrganizerRequest();
        request.setUserId(2002L);
        request.setOrganizerId(2003L);
        request.setConfirmRefund(true);
        request.setReason("取消主办方资格");

        RefundImpactResponse response = service.deactivateOrganizer(request);

        assertEquals("user", organizer.getRole());
        assertEquals(3, organizer.getOrganizerStatus());
        assertEquals(0, firstActivity.getStatus());
        assertEquals(0, secondActivity.getStatus());
        assertEquals(0, firstSession.getStatus());
        assertEquals(0, secondSession.getStatus());
        assertEquals(0, firstTicketType.getStatus());
        assertEquals(0, secondTicketType.getStatus());
        assertEquals(2, response.getDeactivatedActivityCount());
        assertEquals(2, response.getDeactivatedSessionCount());
        assertEquals(2, response.getDeactivatedTicketTypeCount());
        assertEquals(2, response.getPaidOrderCount());
        assertEquals(1, response.getRefundSuccessCount());
        assertEquals(1, response.getRefundFailedCount());
        assertEquals(0, response.getRefundUnknownCount());
        assertEquals(0, response.getRefundCompensationRequiredCount());
        assertEquals(1, response.getFailures().size());
        verify(userRefMapper).updateById(organizer);
        verify(activityMapper).updateById(firstActivity);
        verify(activityMapper).updateById(secondActivity);
        verify(paymentInternalClient, times(2)).directRefund(any(), eq("test-token"));
    }

    private Activity activity(Long id, Long organizerId) {
        Activity activity = new Activity();
        activity.setId(id);
        activity.setName("测试活动");
        activity.setOrganizerId(organizerId);
        activity.setStatus(1);
        return activity;
    }

    private UserRef user(Long id, String role) {
        UserRef user = new UserRef();
        user.setId(id);
        user.setRole(role);
        return user;
    }

    private Session session(Long id, Long activityId) {
        Session session = new Session();
        session.setId(id);
        session.setActivityId(activityId);
        session.setStatus(1);
        return session;
    }

    private TicketType ticketType(Long id, Long sessionId) {
        TicketType ticketType = new TicketType();
        ticketType.setId(id);
        ticketType.setSessionId(sessionId);
        ticketType.setStatus(1);
        return ticketType;
    }

    private OrderInfoResponse order(Long id, String orderNo, Long sessionId) {
        OrderInfoResponse order = new OrderInfoResponse();
        order.setId(id);
        order.setOrderNo(orderNo);
        order.setSessionId(sessionId);
        return order;
    }

    private DirectRefundResponse refund(Long orderId, String orderNo, String status, Boolean success, String message) {
        DirectRefundResponse refund = new DirectRefundResponse();
        refund.setOrderId(orderId);
        refund.setOrderNo(orderNo);
        refund.setStatus(status);
        refund.setSuccess(success);
        refund.setMessage(message);
        return refund;
    }
}
