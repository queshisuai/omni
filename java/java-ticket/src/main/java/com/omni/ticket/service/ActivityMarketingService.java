package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.ticket.client.OrderInternalClient;
import com.omni.ticket.dto.ActivityFunnelStepResponse;
import com.omni.ticket.dto.ActivityMarketingOverviewResponse;
import com.omni.ticket.dto.ActivityMarketingRuleRequest;
import com.omni.ticket.dto.ActivityMarketingRuleResponse;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.dto.OrderInfoResponse;
import com.omni.ticket.dto.PaidOrdersBySessionsRequest;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.ActivityMarketingRule;
import com.omni.ticket.entity.PerformanceSubscription;
import com.omni.ticket.entity.Session;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.ActivityMarketingRuleMapper;
import com.omni.ticket.mapper.PerformanceSubscriptionMapper;
import com.omni.ticket.mapper.SessionMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class ActivityMarketingService {

    private static final String ROLE_ORGANIZER = "organizer";
    private static final String DISCOUNT_NONE = "NONE";
    private static final String DISCOUNT_FULL_REDUCTION = "FULL_REDUCTION";
    private static final String DISCOUNT_DIRECT_REDUCTION = "DIRECT_REDUCTION";
    private static final Integer ORDER_STATUS_PAID = 2;
    private static final Integer ORDER_STATUS_CANCELLED = 3;

    private final ActivityMapper activityMapper;
    private final SessionMapper sessionMapper;
    private final ActivityMarketingRuleMapper marketingRuleMapper;
    private final PerformanceSubscriptionMapper subscriptionMapper;
    private final UserAccessService userAccessService;
    private final OrderInternalClient orderInternalClient;
    private final String internalApiToken;

    public ActivityMarketingService(ActivityMapper activityMapper,
                                    SessionMapper sessionMapper,
                                    ActivityMarketingRuleMapper marketingRuleMapper,
                                    PerformanceSubscriptionMapper subscriptionMapper,
                                    UserAccessService userAccessService,
                                    OrderInternalClient orderInternalClient,
                                    @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.activityMapper = activityMapper;
        this.sessionMapper = sessionMapper;
        this.marketingRuleMapper = marketingRuleMapper;
        this.subscriptionMapper = subscriptionMapper;
        this.userAccessService = userAccessService;
        this.orderInternalClient = orderInternalClient;
        this.internalApiToken = internalApiToken;
    }

    public ActivityMarketingOverviewResponse getMarketing(Long operatorId, Long activityId) {
        Activity activity = requireManageableActivity(operatorId, activityId);
        ActivityMarketingRule rule = selectRule(activityId);
        return buildOverview(activity, rule);
    }

    public ActivityMarketingOverviewResponse saveMarketing(Long operatorId, Long activityId, ActivityMarketingRuleRequest request) {
        Activity activity = requireManageableActivity(operatorId, activityId);
        ActivityMarketingRule existing = selectRule(activityId);
        ActivityMarketingRule rule = existing == null ? new ActivityMarketingRule() : existing;
        applyRequest(rule, activityId, request == null ? new ActivityMarketingRuleRequest() : request);
        LocalDateTime now = LocalDateTime.now();
        rule.setUpdateTime(now);
        if (rule.getId() == null) {
            rule.setCreateTime(now);
            marketingRuleMapper.insert(rule);
        } else {
            marketingRuleMapper.updateById(rule);
        }
        return buildOverview(activity, rule);
    }

    private Activity requireManageableActivity(Long operatorId, Long activityId) {
        if (activityId == null || activityId <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "活动ID不正确");
        }
        InternalUserRefResponse user = userAccessService.requireAdminOrOrganizer(operatorId);
        Activity activity = activityMapper.selectById(activityId);
        if (activity == null || activity.getDeletedAt() != null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "活动不存在");
        }
        if (ROLE_ORGANIZER.equals(user.getRole()) && !Objects.equals(activity.getOrganizerId(), operatorId)) {
            throw new BusinessException(ResultCode.FORBIDDEN, "只能管理自己主办活动的营销配置");
        }
        return activity;
    }

    private ActivityMarketingRule selectRule(Long activityId) {
        return marketingRuleMapper.selectOne(new LambdaQueryWrapper<ActivityMarketingRule>()
                .eq(ActivityMarketingRule::getActivityId, activityId)
                .last("LIMIT 1"));
    }

    private void applyRequest(ActivityMarketingRule rule, Long activityId, ActivityMarketingRuleRequest request) {
        boolean enabled = Boolean.TRUE.equals(request.getEnabled());
        String discountType = normalizeDiscountType(request.getDiscountType(), enabled);
        BigDecimal thresholdAmount = normalizeAmount(request.getThresholdAmount());
        BigDecimal discountAmount = normalizeAmount(request.getDiscountAmount());
        Integer maxCouponCount = normalizePositiveInteger(request.getMaxCouponCount());
        Integer perUserLimit = normalizePositiveInteger(request.getPerUserLimit());

        if (enabled) {
            if (!StringUtils.hasText(request.getCouponName())) {
                throw new BusinessException(ResultCode.BAD_REQUEST, "优惠名称不能为空");
            }
            if (discountAmount == null || discountAmount.compareTo(BigDecimal.ZERO) <= 0) {
                throw new BusinessException(ResultCode.BAD_REQUEST, "优惠金额必须大于0");
            }
            if (DISCOUNT_FULL_REDUCTION.equals(discountType)
                    && (thresholdAmount == null || thresholdAmount.compareTo(discountAmount) <= 0)) {
                throw new BusinessException(ResultCode.BAD_REQUEST, "满减门槛必须大于优惠金额");
            }
            if (maxCouponCount == null || maxCouponCount <= 0) {
                throw new BusinessException(ResultCode.BAD_REQUEST, "发券数量必须大于0");
            }
        }

        rule.setActivityId(activityId);
        rule.setEnabled(enabled);
        rule.setCouponName(StringUtils.hasText(request.getCouponName()) ? request.getCouponName().trim() : null);
        rule.setDiscountType(discountType);
        rule.setThresholdAmount(thresholdAmount);
        rule.setDiscountAmount(discountAmount);
        rule.setMaxCouponCount(maxCouponCount);
        rule.setPerUserLimit(perUserLimit);
        rule.setClaimedCount(rule.getClaimedCount() == null ? 0 : rule.getClaimedCount());
        rule.setUsedCount(rule.getUsedCount() == null ? 0 : rule.getUsedCount());
        rule.setStatus(enabled ? 1 : 0);
        rule.setStartTime(request.getStartTime());
        rule.setEndTime(request.getEndTime());
    }

    private String normalizeDiscountType(String raw, boolean enabled) {
        if (!enabled) return DISCOUNT_NONE;
        String value = StringUtils.hasText(raw) ? raw.trim().toUpperCase(Locale.ROOT) : DISCOUNT_FULL_REDUCTION;
        if (DISCOUNT_FULL_REDUCTION.equals(value) || DISCOUNT_DIRECT_REDUCTION.equals(value)) {
            return value;
        }
        throw new BusinessException(ResultCode.BAD_REQUEST, "优惠类型不正确");
    }

    private BigDecimal normalizeAmount(BigDecimal value) {
        return value == null ? null : value.setScale(2, java.math.RoundingMode.HALF_UP);
    }

    private Integer normalizePositiveInteger(Integer value) {
        return value == null || value <= 0 ? null : value;
    }

    private ActivityMarketingOverviewResponse buildOverview(Activity activity, ActivityMarketingRule rule) {
        ActivityMarketingOverviewResponse response = new ActivityMarketingOverviewResponse();
        response.setActivityId(activity.getId());
        response.setActivityName(activity.getName());
        response.setRule(ActivityMarketingRuleResponse.from(rule));
        response.setFunnelSteps(buildFunnel(activity.getId()));
        return response;
    }

    private List<ActivityFunnelStepResponse> buildFunnel(Long activityId) {
        List<Session> sessions = sessionMapper.selectList(new LambdaQueryWrapper<Session>()
                .eq(Session::getActivityId, activityId));
        if (sessions == null) {
            sessions = Collections.emptyList();
        }
        List<Long> sessionIds = sessions.stream().map(Session::getId).filter(Objects::nonNull).collect(Collectors.toList());
        List<OrderInfoResponse> orders = listOrders(sessionIds);
        long paidCount = orders.stream().filter(order -> ORDER_STATUS_PAID.equals(order.getStatus())).count();
        long cancelledCount = orders.stream().filter(order -> ORDER_STATUS_CANCELLED.equals(order.getStatus())).count();
        long interestCount = countInterest(activityId);
        return List.of(
                new ActivityFunnelStepResponse("exposure", "曝光", 0L),
                new ActivityFunnelStepResponse("detail", "详情页", 0L),
                new ActivityFunnelStepResponse("interest", "候补/想看", interestCount),
                new ActivityFunnelStepResponse("order", "下单", (long) orders.size()),
                new ActivityFunnelStepResponse("paid", "支付", paidCount),
                new ActivityFunnelStepResponse("cancelled", "取消/超时", cancelledCount)
        );
    }

    private long countInterest(Long activityId) {
        Long count = subscriptionMapper.selectCount(new LambdaQueryWrapper<PerformanceSubscription>()
                .eq(PerformanceSubscription::getActivityId, activityId)
                .eq(PerformanceSubscription::getStatus, 1)
                .in(PerformanceSubscription::getTargetType, List.of("ACTIVITY_WANT", "SALE_REMINDER", "WAITLIST_REMINDER")));
        return count == null ? 0L : count;
    }

    private List<OrderInfoResponse> listOrders(List<Long> sessionIds) {
        if (sessionIds.isEmpty() || orderInternalClient == null || !StringUtils.hasText(internalApiToken)) {
            return Collections.emptyList();
        }
        Result<List<OrderInfoResponse>> result = orderInternalClient.listPaidBySessions(
                new PaidOrdersBySessionsRequest(sessionIds, false), internalApiToken);
        if (result == null || result.getCode() != ResultCode.SUCCESS.getCode() || result.getData() == null) {
            return Collections.emptyList();
        }
        return result.getData();
    }
}
