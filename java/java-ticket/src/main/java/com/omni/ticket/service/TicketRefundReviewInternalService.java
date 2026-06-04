package com.omni.ticket.service;

import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.TicketRefundReviewPermissionResponse;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Session;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.SessionMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class TicketRefundReviewInternalService {
    private static final String PERMISSION_REFUND_REVIEW = "refund.review";

    private final SessionMapper sessionMapper;
    private final ActivityMapper activityMapper;
    private final UserAccessService userAccessService;

    @Autowired
    public TicketRefundReviewInternalService(SessionMapper sessionMapper, ActivityMapper activityMapper, UserAccessService userAccessService) {
        this.sessionMapper = sessionMapper;
        this.activityMapper = activityMapper;
        this.userAccessService = userAccessService;
    }

    public TicketRefundReviewInternalService(SessionMapper sessionMapper, ActivityMapper activityMapper) {
        this(sessionMapper, activityMapper, null);
    }

    public TicketRefundReviewPermissionResponse checkPermission(Long sessionId, Long reviewerId) {
        if (sessionId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "场次ID不能为空");
        }
        if (reviewerId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "审核人ID不能为空");
        }

        TicketRefundReviewPermissionResponse response = new TicketRefundReviewPermissionResponse();
        response.setSessionId(sessionId);

        Session session = sessionMapper.selectById(sessionId);
        if (session == null) {
            response.setAllowed(false);
            response.setReason("场次不存在");
            return response;
        }

        if (session.getActivityId() == null) {
            response.setAllowed(false);
            response.setReason("场次未关联活动");
            return response;
        }

        Activity activity = activityMapper.selectById(session.getActivityId());
        if (activity == null) {
            response.setAllowed(false);
            response.setReason("活动不存在");
            return response;
        }

        response.setActivityId(activity.getId());
        response.setOrganizerId(activity.getOrganizerId());

        if (hasPlatformRefundReviewPermission(reviewerId) || reviewerId.equals(activity.getOrganizerId())) {
            response.setAllowed(true);
        } else {
            response.setAllowed(false);
            response.setReason("审核人不是活动主办方");
        }

        return response;
    }

    private boolean hasPlatformRefundReviewPermission(Long reviewerId) {
        if (userAccessService == null) {
            return false;
        }
        try {
            userAccessService.requirePlatformPermission(reviewerId, PERMISSION_REFUND_REVIEW);
            return true;
        } catch (BusinessException e) {
            if (e.getCode() == ResultCode.FORBIDDEN.getCode()) {
                return false;
            }
            throw e;
        }
    }
}
