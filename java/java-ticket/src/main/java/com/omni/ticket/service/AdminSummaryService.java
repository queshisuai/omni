package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
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
import com.omni.ticket.entity.PerformanceSubscription;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.entity.Tour;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.PerformanceSubscriptionMapper;
import com.omni.ticket.mapper.TourMapper;
import com.omni.ticket.service.UserAccessService;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class AdminSummaryService {

    private final ActivityMapper activityMapper;
    private final SessionMapper sessionMapper;
    private final TicketTypeMapper ticketTypeMapper;
    private final UserAccessService userAccessService;
    private final OrderInternalClient orderInternalClient;
    private final TourMapper tourMapper;
    private final PerformanceSubscriptionMapper performanceSubscriptionMapper;
    private final String internalApiToken;

    public AdminSummaryService(ActivityMapper activityMapper,
                                SessionMapper sessionMapper,
                                 TicketTypeMapper ticketTypeMapper,
                                 UserAccessService userAccessService,
                                 OrderInternalClient orderInternalClient,
                                 TourMapper tourMapper,
                                 PerformanceSubscriptionMapper performanceSubscriptionMapper,
                                 @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.activityMapper = activityMapper;
        this.sessionMapper = sessionMapper;
        this.ticketTypeMapper = ticketTypeMapper;
        this.userAccessService = userAccessService;
        this.orderInternalClient = orderInternalClient;
        this.tourMapper = tourMapper;
        this.performanceSubscriptionMapper = performanceSubscriptionMapper;
        this.internalApiToken = internalApiToken;
    }

    public AdminSummaryResponse getSummary(Long userId) {
        InternalUserRefResponse user = userAccessService.requireAdminOrOrganizerOrAnyPermission(
                userId, "activity.manage", "tour.manage", "session.manage", "order.view");
        String role = user.getRole();

        LambdaQueryWrapper<Activity> activityWrapper = new LambdaQueryWrapper<>();
        if ("organizer".equals(role)) {
            activityWrapper.eq(Activity::getOrganizerId, userId);
        }
        activityWrapper.eq(Activity::getStatus, 1)
                .isNull(Activity::getDeletedAt);
        List<Activity> activities = activityMapper.selectList(activityWrapper);
        if (activities == null) {
            activities = Collections.emptyList();
        }
        List<Long> activityIds = activities.stream().map(Activity::getId).collect(Collectors.toList());

        List<Session> sessions = activityIds.isEmpty()
                ? Collections.emptyList()
                : sessionMapper.selectList(new LambdaQueryWrapper<Session>().in(Session::getActivityId, activityIds));
        if (sessions == null) {
            sessions = Collections.emptyList();
        }
        List<Long> sessionIds = sessions.stream().map(Session::getId).collect(Collectors.toList());

        Long ticketTypeCount = sessionIds.isEmpty()
                ? 0L
                : ticketTypeMapper.selectCount(new LambdaQueryWrapper<TicketType>().in(TicketType::getSessionId, sessionIds));
        Long paidOrderCount = sessionIds.isEmpty() ? 0L : countPaidOrders(sessionIds);
        List<OrderInfoResponse> orders = listOrders(sessionIds);

        Long announcedTourCount = countAnnouncedTours(role, userId);
        AdminSummaryResponse response = new AdminSummaryResponse(activities.size() + announcedTourCount, ticketTypeCount != null ? ticketTypeCount : 0L, paidOrderCount);
        enrichOperationalMetrics(response, activities, sessions, orders);
        return response;
    }

    private Long countAnnouncedTours(String role, Long userId) {
        LambdaQueryWrapper<Tour> wrapper = new LambdaQueryWrapper<Tour>()
                .eq(Tour::getStatus, 1)
                .eq(Tour::getReviewStatus, "announced");
        if ("organizer".equals(role)) {
            wrapper.eq(Tour::getOrganizerId, userId);
        }
        Long count = tourMapper.selectCount(wrapper);
        return count == null ? 0L : count;
    }

    private Long countPaidOrders(List<Long> sessionIds) {
        if (!StringUtils.hasText(internalApiToken)) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "内部接口令牌未配置");
        }
        Result<PaidOrderCountResponse> result = orderInternalClient.countPaidBySessions(
                new PaidOrderCountRequest(sessionIds), internalApiToken);
        if (result == null || result.getCode() != ResultCode.SUCCESS.getCode()) {
            String message = result != null && StringUtils.hasText(result.getMessage()) ? result.getMessage() : "订单服务无响应";
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "统计已支付订单失败: " + message);
        }
        PaidOrderCountResponse data = result.getData();
        return data != null && data.getPaidOrderCount() != null ? data.getPaidOrderCount() : 0L;
    }

    private List<OrderInfoResponse> listOrders(List<Long> sessionIds) {
        if (sessionIds.isEmpty() || !StringUtils.hasText(internalApiToken)) {
            return Collections.emptyList();
        }
        Result<List<OrderInfoResponse>> result = orderInternalClient.listPaidBySessions(
                new PaidOrdersBySessionsRequest(sessionIds, false), internalApiToken);
        if (result == null || result.getCode() != ResultCode.SUCCESS.getCode() || result.getData() == null) {
            return Collections.emptyList();
        }
        return result.getData();
    }

    private void enrichOperationalMetrics(AdminSummaryResponse response,
                                          List<Activity> activities,
                                          List<Session> sessions,
                                          List<OrderInfoResponse> orders) {
        Map<Long, Activity> activityById = activities.stream()
                .filter(activity -> activity.getId() != null)
                .collect(Collectors.toMap(Activity::getId, activity -> activity, (a, b) -> a));
        Map<Long, Long> activityIdBySessionId = sessions.stream()
                .filter(session -> session.getId() != null && session.getActivityId() != null)
                .collect(Collectors.toMap(Session::getId, Session::getActivityId, (a, b) -> a));

        response.setOrderCount((long) orders.size());
        response.setPaymentTimeoutCount(orders.stream()
                .filter(order -> Integer.valueOf(3).equals(order.getStatus()))
                .count());
        response.setRiskCheckCount((long) activities.size());
        response.setRiskHitCount(activities.stream()
                .filter(this::isRiskHit)
                .count());
        List<Long> activityIds = activities.stream()
                .map(Activity::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        response.setInterestCount(countSubscriptions(activityIds, List.of("ACTIVITY_WANT", "WAITLIST_REMINDER")));
        response.setReminderCount(countSubscriptions(activityIds, List.of("SALE_REMINDER", "WAITLIST_REMINDER")));

        Map<Long, List<OrderInfoResponse>> ordersByActivity = orders.stream()
                .map(order -> new OrderActivityPair(order, activityIdBySessionId.get(order.getSessionId())))
                .filter(pair -> pair.activityId != null)
                .collect(Collectors.groupingBy(pair -> pair.activityId,
                        Collectors.mapping(pair -> pair.order, Collectors.toList())));
        List<AdminSummaryResponse.HotActivityResponse> hotActivities = ordersByActivity.entrySet().stream()
                .map(entry -> {
                    Activity activity = activityById.get(entry.getKey());
                    String name = activity != null ? activity.getName() : "活动 " + entry.getKey();
                    long paidCount = entry.getValue().stream()
                            .filter(order -> Integer.valueOf(2).equals(order.getStatus()))
                            .count();
                    return new AdminSummaryResponse.HotActivityResponse(entry.getKey(), name, (long) entry.getValue().size(), paidCount);
                })
                .sorted((a, b) -> {
                    int byOrder = b.getOrderCount().compareTo(a.getOrderCount());
                    return byOrder != 0 ? byOrder : a.getActivityId().compareTo(b.getActivityId());
                })
                .limit(5)
                .collect(Collectors.toList());
        response.setHotActivities(hotActivities);
    }

    private boolean isRiskHit(Activity activity) {
        return activity != null
                && ("risk_suspended".equals(activity.getPublishStatus()) || activity.getRiskSuspendedAt() != null);
    }

    private Long countSubscriptions(List<Long> activityIds, List<String> targetTypes) {
        if (activityIds == null || activityIds.isEmpty()) {
            return 0L;
        }
        Long count = performanceSubscriptionMapper.selectCount(new LambdaQueryWrapper<PerformanceSubscription>()
                .in(PerformanceSubscription::getActivityId, activityIds)
                .eq(PerformanceSubscription::getStatus, 1)
                .in(PerformanceSubscription::getTargetType, targetTypes));
        return count == null ? 0L : count;
    }

    private static class OrderActivityPair {
        private final OrderInfoResponse order;
        private final Long activityId;

        private OrderActivityPair(OrderInfoResponse order, Long activityId) {
            this.order = Objects.requireNonNull(order);
            this.activityId = activityId;
        }
    }
}
