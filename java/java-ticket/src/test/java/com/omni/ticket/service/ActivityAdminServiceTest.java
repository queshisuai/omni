package com.omni.ticket.service;

import com.omni.common.mq.message.NotificationEventMessage;
import com.omni.common.dto.OperationAuditWriteRequest;
import com.omni.common.result.Result;
import com.omni.exception.BusinessException;
import com.omni.ticket.client.OrderInternalClient;
import com.omni.ticket.client.PaymentInternalClient;
import com.omni.ticket.dto.ActivityBuyerNotificationRequest;
import com.omni.ticket.dto.ActivityBuyerNotificationResponse;
import com.omni.ticket.dto.DeactivateOrganizerRequest;
import com.omni.ticket.dto.DeactivateActivityRequest;
import com.omni.ticket.dto.DeleteActivityRequest;
import com.omni.ticket.dto.DeleteActivityResponse;
import com.omni.ticket.dto.DirectRefundResponse;
import com.omni.ticket.dto.OrderInfoResponse;
import com.omni.ticket.dto.RefundImpactResponse;
import com.omni.ticket.dto.UpdateActivityStatusRequest;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.ActivityArtist;
import com.omni.ticket.entity.Artist;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.ActivityArtistMapper;
import com.omni.ticket.mapper.ArtistMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.mq.NotificationMqProducer;
import com.omni.ticket.search.ActivitySearchIndexEventPublisher;
import com.omni.ticket.service.UserAccessService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.AutowiredAnnotationBeanPostProcessor;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.mock;
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
    private UserAccessService userAccessService;
    @Mock
    private OrderInternalClient orderInternalClient;
    @Mock
    private PaymentInternalClient paymentInternalClient;
    @Mock
    private ActivityArtistMapper activityArtistMapper;
    @Mock
    private ArtistMapper artistMapper;
    @Mock
    private ActivitySearchIndexEventPublisher searchIndexEventPublisher;
    @Mock
    private NotificationMqProducer notificationProducer;

    private ActivityAdminService service;

    @Test
    void springCanCreateActivityAdminServiceWithConstructorInjection() {
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            context.registerBean(AutowiredAnnotationBeanPostProcessor.class);
            context.registerBean(ActivityMapper.class, () -> mock(ActivityMapper.class));
            context.registerBean(SessionMapper.class, () -> mock(SessionMapper.class));
            context.registerBean(TicketTypeMapper.class, () -> mock(TicketTypeMapper.class));
            context.registerBean(UserAccessService.class, () -> mock(UserAccessService.class));
            context.registerBean(OrderInternalClient.class, () -> mock(OrderInternalClient.class));
            context.registerBean(PaymentInternalClient.class, () -> mock(PaymentInternalClient.class));
            context.registerBean(ActivityArtistMapper.class, () -> mock(ActivityArtistMapper.class));
            context.registerBean(ArtistMapper.class, () -> mock(ArtistMapper.class));
            context.registerBean(ActivityAdminService.class);

            context.refresh();

            org.junit.jupiter.api.Assertions.assertNotNull(context.getBean(ActivityAdminService.class));
        }
    }

    @BeforeEach
    void setUp() {
        service = new ActivityAdminService(
                activityMapper,
                sessionMapper,
                ticketTypeMapper,
                userAccessService,
                orderInternalClient,
                paymentInternalClient,
                activityArtistMapper,
                artistMapper,
                searchIndexEventPublisher,
                "test-token");
        service.setNotificationProducer(notificationProducer);
    }

    @Test
    void deactivateActivityRejectsWhenRefundNotConfirmed() {
        Activity activity = activity(10L, 2003L);
        when(activityMapper.selectById(10L)).thenReturn(activity);
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));

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
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));

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
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));
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
        assertEquals("deactivated", activity.getPublishStatus());
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
        verify(searchIndexEventPublisher).publishDelete(10L);
        verify(userAccessService).writeOperationAudit(argThat(audit ->
                Long.valueOf(2003L).equals(audit.getOperatorId())
                        && "organizer".equals(audit.getOperatorRole())
                        && "activity.deactivate.refund".equals(audit.getAction())
                        && "activity".equals(audit.getTargetType())
                        && Long.valueOf(10L).equals(audit.getTargetId())
                        && "测试活动".equals(audit.getTargetRef())
                        && "活动取消".equals(audit.getReason())
                        && Boolean.TRUE.equals(audit.getSuccess())
                        && audit.getResult().contains("已支付订单 1 笔")
                        && audit.getResult().contains("退款成功 1 笔")
        ));
    }

    @Test
    void deactivateActivitySendsCancelledEventToPaidOrderUsers() {
        Activity activity = activity(10L, 2003L);
        Session session = session(101L, 10L);
        TicketType ticketType = ticketType(1001L, 101L);
        OrderInfoResponse paidOrder = order(5001L, "DM5001", 101L);
        paidOrder.setUserId(2004L);
        DirectRefundResponse refundResponse = refund(5001L, "DM5001", "SUCCESS", true, "退款成功");

        when(activityMapper.selectById(10L)).thenReturn(activity);
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));
        when(sessionMapper.selectList(any())).thenReturn(List.of(session));
        when(ticketTypeMapper.selectList(any())).thenReturn(List.of(ticketType));
        when(orderInternalClient.listPaidBySessions(any(), eq("test-token"))).thenReturn(Result.success(List.of(paidOrder)));
        when(paymentInternalClient.directRefund(any(), eq("test-token"))).thenReturn(Result.success(refundResponse));

        DeactivateActivityRequest request = new DeactivateActivityRequest();
        request.setUserId(2003L);
        request.setConfirmRefund(true);
        request.setReason("活动取消");

        service.deactivateActivity(10L, request);

        ArgumentCaptor<NotificationEventMessage> captor = ArgumentCaptor.forClass(NotificationEventMessage.class);
        verify(notificationProducer).sendNotificationEvent(captor.capture());
        NotificationEventMessage event = captor.getValue();
        assertEquals("activity-cancelled:10:5001", event.getEventId());
        assertEquals("ACTIVITY_CANCELLED", event.getEventType());
        assertEquals("ACTIVITY_CANCELLED:5001", event.getAggregateKey());
        assertEquals(2004L, event.getUserId());
        assertEquals(5001L, event.getOrderId());
        assertEquals(10L, event.getActivityId());
        assertEquals(List.of("IN_APP", "SMS"), event.getChannels());
        assertEquals("/orders/5001", event.getActionHref());
        assertEquals("查看订单", event.getActionLabel());
    }

    @Test
    void notifyActivityBuyersSendsInAppEventsAndWritesAudit() {
        Activity activity = activity(10L, 2003L);
        Session session = session(101L, 10L);
        OrderInfoResponse firstOrder = order(5001L, "DM5001", 101L);
        firstOrder.setUserId(2004L);
        OrderInfoResponse secondOrder = order(5002L, "DM5002", 101L);
        secondOrder.setUserId(2004L);
        OrderInfoResponse skippedOrder = order(5003L, "DM5003", 101L);

        when(activityMapper.selectById(10L)).thenReturn(activity);
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));
        when(sessionMapper.selectList(any())).thenReturn(List.of(session));
        when(orderInternalClient.listPaidBySessions(any(), eq("test-token"))).thenReturn(Result.success(List.of(firstOrder, secondOrder, skippedOrder)));

        ActivityBuyerNotificationRequest request = new ActivityBuyerNotificationRequest();
        request.setUserId(2003L);
        request.setConfirmNotify(true);
        request.setContent("演出入场时间有调整，请提前查看订单详情。");

        ActivityBuyerNotificationResponse response = service.notifyActivityBuyers(10L, request);

        assertEquals(10L, response.getActivityId());
        assertEquals("测试活动", response.getActivityName());
        assertEquals(3, response.getPaidOrderCount());
        assertEquals(2, response.getNotificationCount());
        assertEquals(1, response.getNotifiedUserCount());
        assertEquals(1, response.getSkippedOrderCount());

        ArgumentCaptor<NotificationEventMessage> captor = ArgumentCaptor.forClass(NotificationEventMessage.class);
        verify(notificationProducer, times(2)).sendNotificationEvent(captor.capture());
        NotificationEventMessage event = captor.getAllValues().get(0);
        assertEquals("ACTIVITY_BUYER_NOTICE", event.getEventType());
        assertEquals(2004L, event.getUserId());
        assertEquals(5001L, event.getOrderId());
        assertEquals(10L, event.getActivityId());
        assertEquals(List.of("IN_APP"), event.getChannels());
        assertEquals("/orders/5001", event.getActionHref());
        assertEquals("查看订单", event.getActionLabel());
        assertEquals("演出入场时间有调整，请提前查看订单详情。", event.getContent());

        verify(userAccessService).writeOperationAudit(argThat(audit ->
                Long.valueOf(2003L).equals(audit.getOperatorId())
                        && "organizer".equals(audit.getOperatorRole())
                        && "activity.buyers.notify".equals(audit.getAction())
                        && "activity".equals(audit.getTargetType())
                        && Long.valueOf(10L).equals(audit.getTargetId())
                        && "测试活动".equals(audit.getTargetRef())
                        && Boolean.TRUE.equals(audit.getSuccess())
                        && audit.getReason().contains("演出入场时间有调整")
                        && audit.getResult().contains("已支付订单 3 笔")
                        && audit.getResult().contains("通知用户 1 人")
                        && audit.getResult().contains("站内通知 2 条")
        ));
    }

    @Test
    void updateActivityStatusPublishesSearchIndexUpsertWhenActivityIsEnabled() {
        Activity activity = activity(10L, 2003L);
        Session session = session(101L, 10L);
        TicketType ticketType = ticketType(1001L, 101L);
        ActivityArtist lineup = new ActivityArtist();
        lineup.setActivityId(10L);
        lineup.setArtistId(3001L);
        lineup.setStatus(1);
        Artist artist = new Artist();
        artist.setId(3001L);
        artist.setStatus(1);
        artist.setReviewStatus("approved");
        artist.setRiskStatus("normal");
        when(activityMapper.selectById(10L)).thenReturn(activity);
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));
        when(sessionMapper.selectList(any())).thenReturn(Collections.singletonList(session));
        when(ticketTypeMapper.selectList(any())).thenReturn(Collections.singletonList(ticketType));
        when(activityArtistMapper.selectList(any())).thenReturn(Collections.singletonList(lineup));
        when(artistMapper.selectBatchIds(any())).thenReturn(Collections.singletonList(artist));

        UpdateActivityStatusRequest request = new UpdateActivityStatusRequest();
        request.setUserId(2003L);
        request.setStatus(1);

        service.updateActivityStatus(10L, request);

        verify(searchIndexEventPublisher).publishUpsert(10L);
    }

    @Test
    void updateActivityStatusPublishesSearchIndexDeleteWhenActivityIsDisabled() {
        Activity activity = activity(10L, 2003L);
        when(activityMapper.selectById(10L)).thenReturn(activity);
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));

        UpdateActivityStatusRequest request = new UpdateActivityStatusRequest();
        request.setUserId(2003L);
        request.setStatus(0);

        service.updateActivityStatus(10L, request);

        verify(searchIndexEventPublisher).publishDelete(10L);
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
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));
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
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));
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
    void deleteActivityWithSessionsMarksDeletedAndStoresReason() {
        Activity activity = activity(10L, 2003L);
        activity.setPublishStatus("deactivated");
        Session session = session(101L, 10L);
        when(activityMapper.selectById(10L)).thenReturn(activity);
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));
        when(sessionMapper.selectList(any())).thenReturn(Collections.singletonList(session));
        when(orderInternalClient.listPaidBySessions(any(), eq("test-token"))).thenReturn(Result.success(Collections.emptyList()));

        DeleteActivityRequest request = new DeleteActivityRequest();
        request.setUserId(2003L);
        request.setReason("演出计划取消");

        DeleteActivityResponse response = service.deleteActivity(10L, request);

        assertEquals(Boolean.TRUE, response.getDeleted());
        assertEquals("deleted", activity.getPublishStatus());
        assertEquals(0, activity.getStatus());
        assertEquals("演出计划取消", activity.getDeleteReason());
        verify(activityMapper).updateById(activity);
        verify(activityMapper, never()).deleteById(10L);
    }

    @Test
    void deactivateOrganizerRejectsNonAdminOperator() {
        when(userAccessService.requirePlatformPermission(2003L, "organizer.review")).thenThrow(new BusinessException(403, "无权限"));

        DeactivateOrganizerRequest request = new DeactivateOrganizerRequest();
        request.setUserId(2003L);
        request.setOrganizerId(2004L);
        request.setConfirmRefund(true);

        assertThrows(BusinessException.class, () -> service.deactivateOrganizer(request));
        verify(activityMapper, never()).updateById(any());
        verify(paymentInternalClient, never()).directRefund(any(), any());
    }

    @Test
    void deactivateOrganizerRejectsWhenRefundNotConfirmed() {
        when(userAccessService.requirePlatformPermission(2002L, "organizer.review")).thenReturn(null);

        DeactivateOrganizerRequest request = new DeactivateOrganizerRequest();
        request.setUserId(2002L);
        request.setOrganizerId(2003L);
        request.setConfirmRefund(false);

        assertThrows(BusinessException.class, () -> service.deactivateOrganizer(request));
        verify(activityMapper, never()).updateById(any());
        verify(paymentInternalClient, never()).directRefund(any(), any());
    }

    @Test
    void deactivateOrganizerDeactivatesActivitiesAndRefundsPaidOrders() {
        InternalUserRefResponse admin = user(2002L, "admin");
        InternalUserRefResponse organizer = user(2003L, "organizer");
        organizer.setOrganizerStatus(1);
        Activity firstActivity = activity(10L, 2003L);
        Activity secondActivity = activity(11L, 2003L);
        Session firstSession = session(101L, 10L);
        Session secondSession = session(102L, 11L);
        TicketType firstTicketType = ticketType(1001L, 101L);
        TicketType secondTicketType = ticketType(1002L, 102L);
        OrderInfoResponse firstOrder = order(5001L, "DM5001", 101L);
        OrderInfoResponse secondOrder = order(5002L, "DM5002", 102L);

        when(userAccessService.requirePlatformPermission(2002L, "organizer.review")).thenReturn(null);
        when(userAccessService.requireUser(2003L)).thenReturn(organizer);
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

        BusinessException exception = assertThrows(BusinessException.class, () -> service.deactivateOrganizer(request));

        assertEquals(500, exception.getCode());
        assertEquals(0, firstActivity.getStatus());
        assertEquals(0, secondActivity.getStatus());
        assertEquals(0, firstSession.getStatus());
        assertEquals(0, secondSession.getStatus());
        assertEquals(0, firstTicketType.getStatus());
        assertEquals(0, secondTicketType.getStatus());
        verify(activityMapper).updateById(firstActivity);
        verify(activityMapper).updateById(secondActivity);
        verify(paymentInternalClient, times(2)).directRefund(any(), eq("test-token"));
    }

    @Test
    void publishActivityRejectsWhenNoActiveSession() {
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));
        when(sessionMapper.selectList(any())).thenReturn(Collections.emptyList());

        UpdateActivityStatusRequest request = new UpdateActivityStatusRequest();
        request.setUserId(2003L);
        request.setStatus(1);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.updateActivityStatus(10L, request));

        assertEquals("上架活动前至少需要一个有效场次", exception.getMessage());
        verify(activityMapper, never()).updateById(any());
    }

    @Test
    void publishActivityRejectsWhenNoActiveTicketType() {
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));
        when(sessionMapper.selectList(any())).thenReturn(Collections.singletonList(session(101L, 10L)));
        when(ticketTypeMapper.selectList(any())).thenReturn(Collections.emptyList());

        UpdateActivityStatusRequest request = new UpdateActivityStatusRequest();
        request.setUserId(2003L);
        request.setStatus(1);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.updateActivityStatus(10L, request));

        assertEquals("上架活动前至少需要一个可售票档", exception.getMessage());
        verify(activityMapper, never()).updateById(any());
    }

    @Test
    void publishActivityRejectsWhenNoLineupArtist() {
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));
        when(sessionMapper.selectList(any())).thenReturn(Collections.singletonList(session(101L, 10L)));
        when(ticketTypeMapper.selectList(any())).thenReturn(Collections.singletonList(ticketType(1001L, 101L)));
        when(activityArtistMapper.selectList(any())).thenReturn(Collections.emptyList());

        UpdateActivityStatusRequest request = new UpdateActivityStatusRequest();
        request.setUserId(2003L);
        request.setStatus(1);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.updateActivityStatus(10L, request));

        assertEquals("上架活动前至少需要一个已审核艺人", exception.getMessage());
        verify(activityMapper, never()).updateById(any());
    }

    @Test
    void publishActivityRejectsPendingLineupArtist() {
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));
        when(sessionMapper.selectList(any())).thenReturn(Collections.singletonList(session(101L, 10L)));
        when(ticketTypeMapper.selectList(any())).thenReturn(Collections.singletonList(ticketType(1001L, 101L)));
        when(activityArtistMapper.selectList(any())).thenReturn(Collections.singletonList(activityArtist(501L)));
        when(artistMapper.selectBatchIds(any())).thenReturn(Collections.singletonList(artist(501L, "pending", "normal", 1)));

        UpdateActivityStatusRequest request = new UpdateActivityStatusRequest();
        request.setUserId(2003L);
        request.setStatus(1);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.updateActivityStatus(10L, request));

        assertEquals("阵容中存在未审核艺人，请先完成艺人档案审核", exception.getMessage());
        verify(activityMapper, never()).updateById(any());
    }

    @Test
    void publishActivityRejectsRiskyLineupArtist() {
        when(activityMapper.selectById(10L)).thenReturn(activity(10L, 2003L));
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));
        when(sessionMapper.selectList(any())).thenReturn(Collections.singletonList(session(101L, 10L)));
        when(ticketTypeMapper.selectList(any())).thenReturn(Collections.singletonList(ticketType(1001L, 101L)));
        when(activityArtistMapper.selectList(any())).thenReturn(Collections.singletonList(activityArtist(501L)));
        when(artistMapper.selectBatchIds(any())).thenReturn(Collections.singletonList(artist(501L, "approved", "risky", 1)));

        UpdateActivityStatusRequest request = new UpdateActivityStatusRequest();
        request.setUserId(2003L);
        request.setStatus(1);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.updateActivityStatus(10L, request));

        assertEquals("阵容中存在风险艺人，暂不能上架", exception.getMessage());
        verify(activityMapper, never()).updateById(any());
    }

    @Test
    void publishActivityAllowsApprovedNormalLineupArtist() {
        Activity activity = activity(10L, 2003L);
        when(activityMapper.selectById(10L)).thenReturn(activity);
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));
        when(sessionMapper.selectList(any())).thenReturn(Collections.singletonList(session(101L, 10L)));
        when(ticketTypeMapper.selectList(any())).thenReturn(Collections.singletonList(ticketType(1001L, 101L)));
        when(activityArtistMapper.selectList(any())).thenReturn(Collections.singletonList(activityArtist(501L)));
        when(artistMapper.selectBatchIds(any())).thenReturn(Collections.singletonList(artist(501L, "approved", "normal", 1)));

        UpdateActivityStatusRequest request = new UpdateActivityStatusRequest();
        request.setUserId(2003L);
        request.setStatus(1);

        service.updateActivityStatus(10L, request);

        assertEquals(1, activity.getStatus());
        verify(activityMapper).updateById(activity);
    }

    @Test
    void publishActivityRestoresDeactivatedPublishStatus() {
        Activity activity = activity(10L, 2003L);
        activity.setStatus(0);
        activity.setPublishStatus("deactivated");
        when(activityMapper.selectById(10L)).thenReturn(activity);
        when(userAccessService.requireAdminOrOrganizerOrAnyPermission(2003L, "activity.manage")).thenReturn(user(2003L, "organizer"));
        when(sessionMapper.selectList(any())).thenReturn(Collections.singletonList(session(101L, 10L)));
        when(ticketTypeMapper.selectList(any())).thenReturn(Collections.singletonList(ticketType(1001L, 101L)));
        when(activityArtistMapper.selectList(any())).thenReturn(Collections.singletonList(activityArtist(501L)));
        when(artistMapper.selectBatchIds(any())).thenReturn(Collections.singletonList(artist(501L, "approved", "normal", 1)));

        UpdateActivityStatusRequest request = new UpdateActivityStatusRequest();
        request.setUserId(2003L);
        request.setStatus(1);

        service.updateActivityStatus(10L, request);

        assertEquals(1, activity.getStatus());
        assertEquals("published", activity.getPublishStatus());
        verify(activityMapper).updateById(activity);
    }

    private Activity activity(Long id, Long organizerId) {
        Activity activity = new Activity();
        activity.setId(id);
        activity.setName("测试活动");
        activity.setOrganizerId(organizerId);
        activity.setStatus(1);
        return activity;
    }

    private InternalUserRefResponse user(Long id, String role) {
        InternalUserRefResponse user = new InternalUserRefResponse();
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

    private ActivityArtist activityArtist(Long artistId) {
        ActivityArtist activityArtist = new ActivityArtist();
        activityArtist.setActivityId(10L);
        activityArtist.setArtistId(artistId);
        activityArtist.setStatus(1);
        return activityArtist;
    }

    private Artist artist(Long id, String reviewStatus, String riskStatus, Integer status) {
        Artist artist = new Artist();
        artist.setId(id);
        artist.setName("测试艺人");
        artist.setReviewStatus(reviewStatus);
        artist.setRiskStatus(riskStatus);
        artist.setStatus(status);
        return artist;
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
