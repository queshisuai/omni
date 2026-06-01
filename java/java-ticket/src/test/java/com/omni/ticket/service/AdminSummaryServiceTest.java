package com.omni.ticket.service;

import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.ticket.client.OrderInternalClient;
import com.omni.ticket.dto.AdminSummaryResponse;
import com.omni.ticket.dto.PaidOrderCountRequest;
import com.omni.ticket.dto.PaidOrderCountResponse;
import com.omni.ticket.dto.PaidOrdersBySessionsRequest;
import com.omni.ticket.dto.OrderInfoResponse;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Session;
import com.omni.ticket.mapper.TourMapper;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.service.UserAccessService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminSummaryServiceTest {

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
    private TourMapper tourMapper;

    private AdminSummaryService service;

    @BeforeEach
    void setUp() {
        service = new AdminSummaryService(activityMapper, sessionMapper, ticketTypeMapper,
                userAccessService, orderInternalClient, tourMapper, "internal-token");
    }

    @Test
    void adminSummaryCountsAllActivitiesAndUsesPaidOrderCountFromOrderService() {
        when(userAccessService.requireAdminOrOrganizer(2002L)).thenReturn(user(2002L, "admin"));
        when(activityMapper.selectList(any())).thenReturn(activities(30, 2003L));
        when(tourMapper.selectCount(any())).thenReturn(1L);
        when(sessionMapper.selectList(any())).thenReturn(Arrays.asList(session(10L), session(11L)));
        when(ticketTypeMapper.selectCount(any())).thenReturn(90L);
        when(orderInternalClient.countPaidBySessions(any(PaidOrderCountRequest.class), eq("internal-token")))
                .thenReturn(Result.success(new PaidOrderCountResponse(12L)));

        AdminSummaryResponse summary = service.getSummary(2002L);

        assertEquals(31L, summary.getActivityCount());
        assertEquals(90L, summary.getTicketTypeCount());
        assertEquals(12L, summary.getPaidOrderCount());
        ArgumentCaptor<PaidOrderCountRequest> requestCaptor = ArgumentCaptor.forClass(PaidOrderCountRequest.class);
        verify(orderInternalClient).countPaidBySessions(requestCaptor.capture(), eq("internal-token"));
        assertEquals(Arrays.asList(10L, 11L), requestCaptor.getValue().getSessionIds());
    }

    @Test
    void organizerSummaryCountsOnlyOwnActivitiesAndUsesPaidOrderCountFromOrderService() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(activityMapper.selectList(any())).thenReturn(Arrays.asList(activity(101L, 2003L), activity(102L, 2003L)));
        when(tourMapper.selectCount(any())).thenReturn(1L);
        when(sessionMapper.selectList(any())).thenReturn(Collections.singletonList(session(20L)));
        when(ticketTypeMapper.selectCount(any())).thenReturn(6L);
        when(orderInternalClient.countPaidBySessions(any(PaidOrderCountRequest.class), eq("internal-token")))
                .thenReturn(Result.success(new PaidOrderCountResponse(3L)));

        AdminSummaryResponse summary = service.getSummary(2003L);

        assertEquals(3L, summary.getActivityCount());
        assertEquals(6L, summary.getTicketTypeCount());
        assertEquals(3L, summary.getPaidOrderCount());
        verify(orderInternalClient).countPaidBySessions(any(PaidOrderCountRequest.class), eq("internal-token"));
        verify(activityMapper).selectList(any());
    }

    @Test
    void adminSummaryIncludesOperationalDashboardMetrics() {
        when(userAccessService.requireAdminOrOrganizer(2002L)).thenReturn(user(2002L, "admin"));
        Activity first = activity(101L, 2003L);
        first.setName("热门活动A");
        Activity second = activity(102L, 2003L);
        second.setName("热门活动B");
        second.setPublishStatus("risk_suspended");
        when(activityMapper.selectList(any())).thenReturn(Arrays.asList(first, second));
        when(tourMapper.selectCount(any())).thenReturn(0L);
        when(sessionMapper.selectList(any())).thenReturn(Arrays.asList(session(10L, 101L), session(11L, 102L)));
        when(ticketTypeMapper.selectCount(any())).thenReturn(2L);
        when(orderInternalClient.countPaidBySessions(any(PaidOrderCountRequest.class), eq("internal-token")))
                .thenReturn(Result.success(new PaidOrderCountResponse(2L)));
        when(orderInternalClient.listPaidBySessions(any(PaidOrdersBySessionsRequest.class), eq("internal-token")))
                .thenReturn(Result.success(List.of(
                        order(1L, 10L, 2),
                        order(2L, 10L, 2),
                        order(3L, 11L, 3)
                )));

        AdminSummaryResponse summary = service.getSummary(2002L);

        assertEquals(2L, summary.getHotActivities().get(0).getOrderCount());
        assertEquals("热门活动A", summary.getHotActivities().get(0).getActivityName());
        assertEquals(1L, summary.getPaymentTimeoutCount());
        assertEquals(3L, summary.getOrderCount());
        assertEquals(1L, summary.getRiskHitCount());
        assertEquals(2L, summary.getRiskCheckCount());
        verify(orderInternalClient).listPaidBySessions(any(PaidOrdersBySessionsRequest.class), eq("internal-token"));
    }

    @Test
    void returnsZeroPaidOrderCountAndSkipsOrderServiceWhenNoSessions() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(activityMapper.selectList(any())).thenReturn(Collections.singletonList(activity(101L, 2003L)));
        when(sessionMapper.selectList(any())).thenReturn(Collections.emptyList());

        AdminSummaryResponse summary = service.getSummary(2003L);

        assertEquals(1L, summary.getActivityCount());
        assertEquals(0L, summary.getTicketTypeCount());
        assertEquals(0L, summary.getPaidOrderCount());
        verify(orderInternalClient, never()).countPaidBySessions(any(PaidOrderCountRequest.class), anyString());
    }

    @Test
    void rejectsNonAdminOrOrganizer() {
        when(userAccessService.requireAdminOrOrganizer(2004L)).thenThrow(new BusinessException(403, "无权限"));

        BusinessException error = assertThrows(BusinessException.class, () -> service.getSummary(2004L));

        assertEquals("无权限", error.getMessage());
    }

    @Test
    void throwsInternalErrorWhenOrderServiceReturnsNonSuccessCode() {
        when(userAccessService.requireAdminOrOrganizer(2002L)).thenReturn(user(2002L, "admin"));
        when(activityMapper.selectList(any())).thenReturn(Collections.singletonList(activity(101L, 2002L)));
        when(sessionMapper.selectList(any())).thenReturn(Collections.singletonList(session(10L)));
        when(ticketTypeMapper.selectCount(any())).thenReturn(1L);
        when(orderInternalClient.countPaidBySessions(any(PaidOrderCountRequest.class), eq("internal-token")))
                .thenReturn(Result.fail(503, "订单服务不可用"));

        BusinessException error = assertThrows(BusinessException.class, () -> service.getSummary(2002L));

        assertEquals(ResultCode.INTERNAL_ERROR.getCode(), error.getCode());
        assertEquals("统计已支付订单失败: 订单服务不可用", error.getMessage());
    }

    @Test
    void throwsInternalErrorAndSkipsOrderServiceWhenInternalTokenMissing() {
        service = new AdminSummaryService(activityMapper, sessionMapper, ticketTypeMapper,
                userAccessService, orderInternalClient, tourMapper, "");
        when(userAccessService.requireAdminOrOrganizer(2002L)).thenReturn(user(2002L, "admin"));
        when(activityMapper.selectList(any())).thenReturn(Collections.singletonList(activity(101L, 2002L)));
        when(sessionMapper.selectList(any())).thenReturn(Collections.singletonList(session(10L)));
        when(ticketTypeMapper.selectCount(any())).thenReturn(1L);

        BusinessException error = assertThrows(BusinessException.class, () -> service.getSummary(2002L));

        assertEquals(ResultCode.INTERNAL_ERROR.getCode(), error.getCode());
        assertEquals("内部接口令牌未配置", error.getMessage());
        verify(orderInternalClient, never()).countPaidBySessions(any(PaidOrderCountRequest.class), anyString());
    }

    private InternalUserRefResponse user(Long id, String role) {
        InternalUserRefResponse user = new InternalUserRefResponse();
        user.setId(id);
        user.setRole(role);
        return user;
    }

    private List<Activity> activities(int count, Long organizerId) {
        java.util.ArrayList<Activity> activities = new java.util.ArrayList<>();
        for (long i = 1; i <= count; i++) {
            activities.add(activity(i, organizerId));
        }
        return activities;
    }

    private Activity activity(Long id, Long organizerId) {
        Activity activity = new Activity();
        activity.setId(id);
        activity.setOrganizerId(organizerId);
        return activity;
    }

    private Session session(Long id) {
        Session session = new Session();
        session.setId(id);
        return session;
    }

    private Session session(Long id, Long activityId) {
        Session session = session(id);
        session.setActivityId(activityId);
        return session;
    }

    private OrderInfoResponse order(Long id, Long sessionId, Integer status) {
        OrderInfoResponse order = new OrderInfoResponse();
        order.setId(id);
        order.setSessionId(sessionId);
        order.setStatus(status);
        return order;
    }
}
