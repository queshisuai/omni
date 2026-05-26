package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.ticket.client.OrderInternalClient;
import com.omni.ticket.dto.AdminSummaryResponse;
import com.omni.ticket.dto.PaidOrderCountRequest;
import com.omni.ticket.dto.PaidOrderCountResponse;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.entity.Tour;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.TourMapper;
import com.omni.ticket.service.UserAccessService;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class AdminSummaryService {

    private final ActivityMapper activityMapper;
    private final SessionMapper sessionMapper;
    private final TicketTypeMapper ticketTypeMapper;
    private final UserAccessService userAccessService;
    private final OrderInternalClient orderInternalClient;
    private final TourMapper tourMapper;
    private final String internalApiToken;

    public AdminSummaryService(ActivityMapper activityMapper,
                                SessionMapper sessionMapper,
                                 TicketTypeMapper ticketTypeMapper,
                                 UserAccessService userAccessService,
                                 OrderInternalClient orderInternalClient,
                                 TourMapper tourMapper,
                                 @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.activityMapper = activityMapper;
        this.sessionMapper = sessionMapper;
        this.ticketTypeMapper = ticketTypeMapper;
        this.userAccessService = userAccessService;
        this.orderInternalClient = orderInternalClient;
        this.tourMapper = tourMapper;
        this.internalApiToken = internalApiToken;
    }

    public AdminSummaryResponse getSummary(Long userId) {
        InternalUserRefResponse user = userAccessService.requireAdminOrOrganizer(userId);
        String role = user.getRole();

        LambdaQueryWrapper<Activity> activityWrapper = new LambdaQueryWrapper<>();
        if ("organizer".equals(role)) {
            activityWrapper.eq(Activity::getOrganizerId, userId);
        }
        activityWrapper.eq(Activity::getStatus, 1)
                .eq(Activity::getPublishStatus, "published")
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

        Long announcedTourCount = countAnnouncedTours(role, userId);
        return new AdminSummaryResponse(activities.size() + announcedTourCount, ticketTypeCount != null ? ticketTypeCount : 0L, paidOrderCount);
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
}
