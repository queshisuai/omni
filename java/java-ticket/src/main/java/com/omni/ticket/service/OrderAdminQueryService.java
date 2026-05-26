package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.ticket.client.OrderInternalClient;
import com.omni.ticket.dto.OrderInfoResponse;
import com.omni.ticket.dto.PaidOrdersBySessionsRequest;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Session;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.service.UserAccessService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class OrderAdminQueryService {
    private final UserAccessService userAccessService;
    private final ActivityMapper activityMapper;
    private final SessionMapper sessionMapper;
    private final OrderInternalClient orderInternalClient;
    private final String internalApiToken;

    public OrderAdminQueryService(UserAccessService userAccessService,
                                  ActivityMapper activityMapper,
                                  SessionMapper sessionMapper,
                                  OrderInternalClient orderInternalClient,
                                  @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.userAccessService = userAccessService;
        this.activityMapper = activityMapper;
        this.sessionMapper = sessionMapper;
        this.orderInternalClient = orderInternalClient;
        this.internalApiToken = internalApiToken;
    }

    public List<OrderInfoResponse> listOrders(Long userId, Boolean paidOnly) {
        InternalUserRefResponse user = userAccessService.requireAdminOrOrganizer(userId);
        String role = user.getRole();
        List<Activity> activities = "organizer".equals(role)
                ? activityMapper.selectList(new LambdaQueryWrapper<Activity>().eq(Activity::getOrganizerId, userId))
                : activityMapper.selectList(new LambdaQueryWrapper<Activity>());
        if (activities == null || activities.isEmpty()) {
            return Collections.emptyList();
        }
        List<Long> activityIds = activities.stream().map(Activity::getId).collect(Collectors.toList());
        List<Session> sessions = sessionMapper.selectList(new LambdaQueryWrapper<Session>().in(Session::getActivityId, activityIds));
        if (sessions == null || sessions.isEmpty()) {
            return Collections.emptyList();
        }
        if (!StringUtils.hasText(internalApiToken)) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "内部接口令牌未配置");
        }
        List<Long> sessionIds = sessions.stream().map(Session::getId).collect(Collectors.toList());
        Result<List<OrderInfoResponse>> result = orderInternalClient.listPaidBySessions(
                new PaidOrdersBySessionsRequest(sessionIds, paidOnly), internalApiToken);
        if (result == null || result.getCode() != ResultCode.SUCCESS.getCode()) {
            String message = result != null && StringUtils.hasText(result.getMessage()) ? result.getMessage() : "订单服务无响应";
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "查询订单失败: " + message);
        }
        List<OrderInfoResponse> orders = result.getData() == null ? Collections.emptyList() : result.getData();
        Map<Long, String> activityNameBySessionId = new HashMap<>();
        Map<Long, Activity> activityById = activities.stream().collect(Collectors.toMap(Activity::getId, activity -> activity, (first, second) -> first));
        for (Session session : sessions) {
            Activity activity = activityById.get(session.getActivityId());
            if (activity != null) {
                activityNameBySessionId.put(session.getId(), activity.getName());
            }
        }
        for (OrderInfoResponse order : orders) {
            order.setActivityName(activityNameBySessionId.get(order.getSessionId()));
        }
        return orders;
    }
}
