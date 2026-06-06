package com.omni.ticket.service;

import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.ticket.client.OrderInternalClient;
import com.omni.ticket.dto.CheckInOverviewRequest;
import com.omni.ticket.dto.CheckInOverviewResponse;
import com.omni.ticket.dto.CheckInRecordQueryRequest;
import com.omni.ticket.dto.CheckInRecordResponse;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Session;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.SessionMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Collections;
import java.util.List;

@Service
public class CheckInAdminQueryService {
    private final UserAccessService userAccessService;
    private final ActivityMapper activityMapper;
    private final SessionMapper sessionMapper;
    private final OrderInternalClient orderInternalClient;
    private final String internalApiToken;

    public CheckInAdminQueryService(UserAccessService userAccessService,
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

    public CheckInOverviewResponse getOverview(Long userId, Long sessionId) {
        InternalUserRefResponse user = requireCheckInViewer(userId, sessionId);
        ensureOrganizerOwnsSessionIfNeeded(user, sessionId);
        CheckInOverviewRequest request = new CheckInOverviewRequest();
        request.setSessionId(sessionId);
        Result<CheckInOverviewResponse> result;
        try {
            result = orderInternalClient.getCheckInOverview(request, requireInternalToken());
        } catch (RuntimeException e) {
            throw unavailable();
        }
        if (result == null || result.getCode() != ResultCode.SUCCESS.getCode()) {
            throw unavailable();
        }
        if (result.getData() != null) {
            return result.getData();
        }
        CheckInOverviewResponse empty = new CheckInOverviewResponse();
        empty.setSessionId(sessionId);
        empty.setTotalTickets(0L);
        empty.setCheckedInCount(0L);
        empty.setUnusedCount(0L);
        empty.setFailedCount(0L);
        empty.setDuplicateCount(0L);
        return empty;
    }

    public List<CheckInRecordResponse> listRecords(Long userId, Long sessionId, String result, Integer page, Integer size) {
        InternalUserRefResponse user = requireCheckInViewer(userId, sessionId);
        ensureOrganizerOwnsSessionIfNeeded(user, sessionId);
        CheckInRecordQueryRequest request = new CheckInRecordQueryRequest();
        request.setSessionId(sessionId);
        request.setResult(result);
        request.setPage(page);
        request.setSize(size);
        Result<List<CheckInRecordResponse>> response;
        try {
            response = orderInternalClient.listCheckInRecords(request, requireInternalToken());
        } catch (RuntimeException e) {
            throw unavailable();
        }
        if (response == null || response.getCode() != ResultCode.SUCCESS.getCode()) {
            throw unavailable();
        }
        return response.getData() == null ? Collections.emptyList() : response.getData();
    }

    private InternalUserRefResponse requireCheckInViewer(Long userId, Long sessionId) {
        if (sessionId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "场次信息无效");
        }
        return userAccessService.requireAdminOrOrganizerOrAnyPermission(userId, "checkin.view", "order.view");
    }

    private void ensureOrganizerOwnsSessionIfNeeded(InternalUserRefResponse user, Long sessionId) {
        if (!"organizer".equals(user.getRole())) {
            return;
        }
        Session session = sessionMapper.selectById(sessionId);
        if (session == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "场次不存在");
        }
        Activity activity = activityMapper.selectById(session.getActivityId());
        if (activity == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "活动不存在");
        }
        if (!user.getId().equals(activity.getOrganizerId())) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权限");
        }
    }

    private String requireInternalToken() {
        if (!StringUtils.hasText(internalApiToken)) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "内部接口令牌未配置");
        }
        return internalApiToken;
    }

    private BusinessException unavailable() {
        return new BusinessException(ResultCode.INTERNAL_ERROR, "入场核验记录暂不可用");
    }
}
