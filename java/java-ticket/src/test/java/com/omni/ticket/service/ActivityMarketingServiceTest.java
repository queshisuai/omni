package com.omni.ticket.service;

import com.omni.common.result.Result;
import com.omni.exception.BusinessException;
import com.omni.ticket.client.OrderInternalClient;
import com.omni.ticket.dto.ActivityMarketingRuleRequest;
import com.omni.ticket.dto.ActivityMarketingOverviewResponse;
import com.omni.ticket.dto.OrderInfoResponse;
import com.omni.ticket.dto.PaidOrdersBySessionsRequest;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.ActivityMarketingRule;
import com.omni.ticket.entity.Session;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.ActivityMarketingRuleMapper;
import com.omni.ticket.mapper.PerformanceSubscriptionMapper;
import com.omni.ticket.mapper.SessionMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ActivityMarketingServiceTest {

    @Mock
    private ActivityMapper activityMapper;
    @Mock
    private SessionMapper sessionMapper;
    @Mock
    private ActivityMarketingRuleMapper marketingRuleMapper;
    @Mock
    private PerformanceSubscriptionMapper subscriptionMapper;
    @Mock
    private UserAccessService userAccessService;
    @Mock
    private OrderInternalClient orderInternalClient;

    private ActivityMarketingService service;

    @BeforeEach
    void setUp() {
        service = new ActivityMarketingService(activityMapper, sessionMapper, marketingRuleMapper,
                subscriptionMapper, userAccessService, orderInternalClient, "internal-token");
    }

    @Test
    void savesFullReductionRuleForOwnedActivity() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(activityMapper.selectById(101L)).thenReturn(activity(101L, 2003L, "测试演唱会"));
        when(marketingRuleMapper.selectOne(any())).thenReturn(null);

        ActivityMarketingRuleRequest request = new ActivityMarketingRuleRequest();
        request.setEnabled(true);
        request.setCouponName("开票满减");
        request.setDiscountType("FULL_REDUCTION");
        request.setThresholdAmount(new BigDecimal("300.00"));
        request.setDiscountAmount(new BigDecimal("30.00"));
        request.setMaxCouponCount(500);
        request.setPerUserLimit(1);

        ActivityMarketingOverviewResponse response = service.saveMarketing(2003L, 101L, request);

        assertEquals(101L, response.getActivityId());
        assertEquals("测试演唱会", response.getActivityName());
        assertEquals("FULL_REDUCTION", response.getRule().getDiscountType());
        assertEquals(new BigDecimal("300.00"), response.getRule().getThresholdAmount());
        assertEquals(new BigDecimal("30.00"), response.getRule().getDiscountAmount());
        ArgumentCaptor<ActivityMarketingRule> captor = ArgumentCaptor.forClass(ActivityMarketingRule.class);
        verify(marketingRuleMapper).insert(captor.capture());
        assertEquals(101L, captor.getValue().getActivityId());
        assertEquals(true, captor.getValue().getEnabled());
        assertEquals("开票满减", captor.getValue().getCouponName());
    }

    @Test
    void rejectsOrganizerEditingOtherActivityMarketingRule() {
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(activityMapper.selectById(101L)).thenReturn(activity(101L, 9999L, "别人的活动"));

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.saveMarketing(2003L, 101L, new ActivityMarketingRuleRequest()));

        assertEquals("只能管理自己主办活动的营销配置", error.getMessage());
        verify(marketingRuleMapper, never()).insert(any());
    }

    @Test
    void buildsFunnelFromSubscriptionsAndOrders() {
        when(userAccessService.requireAdminOrOrganizer(2002L)).thenReturn(user(2002L, "admin"));
        when(activityMapper.selectById(101L)).thenReturn(activity(101L, 2003L, "测试演唱会"));
        when(marketingRuleMapper.selectOne(any())).thenReturn(null);
        when(sessionMapper.selectList(any())).thenReturn(List.of(session(11L), session(12L)));
        when(subscriptionMapper.selectCount(any())).thenReturn(18L);
        when(orderInternalClient.listPaidBySessions(any(PaidOrdersBySessionsRequest.class), eq("internal-token")))
                .thenReturn(Result.success(List.of(order(1L, 11L, 1), order(2L, 11L, 2), order(3L, 12L, 3))));

        ActivityMarketingOverviewResponse response = service.getMarketing(2002L, 101L);

        assertEquals(6, response.getFunnelSteps().size());
        assertEquals("候补/想看", response.getFunnelSteps().get(2).getLabel());
        assertEquals(18L, response.getFunnelSteps().get(2).getCount());
        assertEquals("下单", response.getFunnelSteps().get(3).getLabel());
        assertEquals(3L, response.getFunnelSteps().get(3).getCount());
        assertEquals("支付", response.getFunnelSteps().get(4).getLabel());
        assertEquals(1L, response.getFunnelSteps().get(4).getCount());
        assertEquals("取消/超时", response.getFunnelSteps().get(5).getLabel());
        assertEquals(1L, response.getFunnelSteps().get(5).getCount());
    }

    private InternalUserRefResponse user(Long id, String role) {
        InternalUserRefResponse user = new InternalUserRefResponse();
        user.setId(id);
        user.setRole(role);
        return user;
    }

    private Activity activity(Long id, Long organizerId, String name) {
        Activity activity = new Activity();
        activity.setId(id);
        activity.setOrganizerId(organizerId);
        activity.setName(name);
        activity.setStatus(1);
        return activity;
    }

    private Session session(Long id) {
        Session session = new Session();
        session.setId(id);
        session.setActivityId(101L);
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
