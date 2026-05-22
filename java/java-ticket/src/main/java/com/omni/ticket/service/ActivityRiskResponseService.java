package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.ticket.client.NotificationInternalClient;
import com.omni.ticket.dto.ActivityRiskResolutionRequest;
import com.omni.ticket.dto.ActivityRiskResolutionResponse;
import com.omni.ticket.dto.ActivityRiskResolutionReviewRequest;
import com.omni.ticket.dto.NotificationMessageRequest;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.ActivityArtist;
import com.omni.ticket.entity.ActivityRiskResolution;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.mapper.ActivityArtistMapper;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.ActivityRiskResolutionMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ActivityRiskResponseService {
    private final ActivityMapper activityMapper;
    private final ActivityArtistMapper activityArtistMapper;
    private final SessionMapper sessionMapper;
    private final TicketTypeMapper ticketTypeMapper;
    private final ActivityRiskResolutionMapper resolutionMapper;
    private final UserAccessService userAccessService;
    private final NotificationInternalClient notificationClient;
    private final ActivityAdminService activityAdminService;
    private final String internalToken;

    public ActivityRiskResponseService(ActivityMapper activityMapper,
                                       ActivityArtistMapper activityArtistMapper,
                                       SessionMapper sessionMapper,
                                       TicketTypeMapper ticketTypeMapper,
                                       ActivityRiskResolutionMapper resolutionMapper,
                                       UserAccessService userAccessService,
                                       NotificationInternalClient notificationClient,
                                       ActivityAdminService activityAdminService,
                                       @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalToken) {
        this.activityMapper = activityMapper;
        this.activityArtistMapper = activityArtistMapper;
        this.sessionMapper = sessionMapper;
        this.ticketTypeMapper = ticketTypeMapper;
        this.resolutionMapper = resolutionMapper;
        this.userAccessService = userAccessService;
        this.notificationClient = notificationClient;
        this.activityAdminService = activityAdminService;
        this.internalToken = internalToken;
    }

    public int suspendPublishedActivitiesForRiskArtist(Long artistId, String reason) {
        if (artistId == null || artistId <= 0) return 0;
        List<ActivityArtist> lineups = activityArtistMapper.selectList(new LambdaQueryWrapper<ActivityArtist>()
                .eq(ActivityArtist::getArtistId, artistId)
                .eq(ActivityArtist::getStatus, 1));
        if (lineups == null || lineups.isEmpty()) return 0;
        List<Long> activityIds = lineups.stream().map(ActivityArtist::getActivityId).distinct().collect(Collectors.toList());
        List<Activity> activities = activityMapper.selectList(new LambdaQueryWrapper<Activity>()
                .in(Activity::getId, activityIds)
                .eq(Activity::getPublishStatus, "published"));
        int count = 0;
        for (Activity activity : activities) {
            suspendActivity(activity, artistId, reason);
            count++;
        }
        return count;
    }

    public ActivityRiskResolutionResponse submitResolution(Long activityId, ActivityRiskResolutionRequest request) {
        if (request == null || request.getUserId() == null) throw new BusinessException(ResultCode.BAD_REQUEST, "处理申请参数不能为空");
        Activity activity = requireActivity(activityId);
        String role = userAccessService.requireAdminOrOrganizerRole(request.getUserId());
        if ("organizer".equals(role) && !request.getUserId().equals(activity.getOrganizerId())) {
            throw new BusinessException(ResultCode.FORBIDDEN, "只能处理自己主办的活动");
        }
        ActivityRiskResolution resolution = new ActivityRiskResolution();
        resolution.setActivityId(activityId);
        resolution.setOrganizerId(activity.getOrganizerId());
        resolution.setStatus("pending");
        resolution.setResolutionNote(trimToNull(request.getResolutionNote()));
        resolution.setSubmittedBy(request.getUserId());
        resolution.setCreateTime(LocalDateTime.now());
        resolutionMapper.insert(resolution);
        notifyUser(2002L, "TODO", "活动恢复售票申请待审核：" + activity.getName());
        return toResponse(resolution);
    }

    public List<ActivityRiskResolutionResponse> listResolutions(Long userId, String status) {
        String role = userAccessService.requireAdminOrOrganizerRole(userId);
        LambdaQueryWrapper<ActivityRiskResolution> wrapper = new LambdaQueryWrapper<ActivityRiskResolution>()
                .orderByDesc(ActivityRiskResolution::getCreateTime);
        if (StringUtils.hasText(status)) wrapper.eq(ActivityRiskResolution::getStatus, status.trim());
        if ("organizer".equals(role)) wrapper.eq(ActivityRiskResolution::getOrganizerId, userId);
        return resolutionMapper.selectList(wrapper).stream().map(this::toResponse).collect(Collectors.toList());
    }

    public ActivityRiskResolutionResponse reviewResolution(Long id, ActivityRiskResolutionReviewRequest request) {
        if (request == null || request.getUserId() == null) throw new BusinessException(ResultCode.BAD_REQUEST, "审核参数不能为空");
        userAccessService.requireAdmin(request.getUserId());
        ActivityRiskResolution resolution = resolutionMapper.selectById(id);
        if (resolution == null) throw new BusinessException(ResultCode.NOT_FOUND, "处理申请不存在");
        Activity activity = requireActivity(resolution.getActivityId());
        LocalDateTime now = LocalDateTime.now();
        if ("approve".equals(request.getAction())) {
            activityAdminService.validatePublishableForReview(activity.getId());
            restoreActivity(activity);
            resolution.setStatus("approved");
            notifyUser(activity.getOrganizerId(), "IN_APP", "活动恢复售票申请已通过：" + activity.getName());
        } else if ("reject".equals(request.getAction())) {
            resolution.setStatus("rejected");
            notifyUser(activity.getOrganizerId(), "IN_APP", "活动恢复售票申请已拒绝：" + activity.getName());
        } else {
            throw new BusinessException(ResultCode.BAD_REQUEST, "审核动作不正确");
        }
        resolution.setReviewNote(trimToNull(request.getReviewNote()));
        resolution.setReviewedBy(request.getUserId());
        resolution.setReviewedAt(now);
        resolution.setUpdateTime(now);
        resolutionMapper.updateById(resolution);
        return toResponse(resolution);
    }

    private void suspendActivity(Activity activity, Long artistId, String reason) {
        activity.setStatus(0);
        activity.setPublishStatus("risk_suspended");
        activity.setRiskSuspendedReason(reason);
        activity.setRiskSuspendedAt(LocalDateTime.now());
        activityMapper.updateById(activity);
        List<Session> sessions = sessionMapper.selectList(new LambdaQueryWrapper<Session>().eq(Session::getActivityId, activity.getId()));
        for (Session session : sessions) {
            session.setStatus(0);
            sessionMapper.updateById(session);
        }
        List<Long> sessionIds = sessions.stream().map(Session::getId).collect(Collectors.toList());
        List<TicketType> ticketTypes = sessionIds.isEmpty() ? Collections.emptyList()
                : ticketTypeMapper.selectList(new LambdaQueryWrapper<TicketType>().in(TicketType::getSessionId, sessionIds));
        for (TicketType ticketType : ticketTypes) {
            ticketType.setStatus(0);
            ticketTypeMapper.updateById(ticketType);
        }
        ActivityRiskResolution resolution = new ActivityRiskResolution();
        resolution.setActivityId(activity.getId());
        resolution.setOrganizerId(activity.getOrganizerId());
        resolution.setRiskArtistId(artistId);
        resolution.setStatus("pending");
        resolution.setSubmittedBy(activity.getOrganizerId());
        resolution.setResolutionNote("系统因风险艺人自动停止售票，等待主办方处理");
        resolution.setCreateTime(LocalDateTime.now());
        resolutionMapper.insert(resolution);
        notifyUser(activity.getOrganizerId(), "TODO", "活动暂时停止售票，请处理阵容风险：" + activity.getName());
    }

    private void restoreActivity(Activity activity) {
        activity.setStatus(1);
        activity.setPublishStatus("published");
        activity.setRiskRestoredAt(LocalDateTime.now());
        activityMapper.updateById(activity);
        List<Session> sessions = sessionMapper.selectList(new LambdaQueryWrapper<Session>().eq(Session::getActivityId, activity.getId()));
        for (Session session : sessions) {
            session.setStatus(1);
            sessionMapper.updateById(session);
        }
        List<Long> sessionIds = sessions.stream().map(Session::getId).collect(Collectors.toList());
        List<TicketType> ticketTypes = sessionIds.isEmpty() ? Collections.emptyList()
                : ticketTypeMapper.selectList(new LambdaQueryWrapper<TicketType>().in(TicketType::getSessionId, sessionIds));
        for (TicketType ticketType : ticketTypes) {
            ticketType.setStatus(1);
            ticketTypeMapper.updateById(ticketType);
        }
    }

    private Activity requireActivity(Long activityId) {
        Activity activity = activityMapper.selectById(activityId);
        if (activity == null) throw new BusinessException(ResultCode.NOT_FOUND, "活动不存在");
        return activity;
    }

    private void notifyUser(Long userId, String type, String content) {
        if (notificationClient == null || !StringUtils.hasText(internalToken) || userId == null) return;
        notificationClient.createMessage(new NotificationMessageRequest(userId, null, type, content), internalToken);
    }

    private String trimToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private ActivityRiskResolutionResponse toResponse(ActivityRiskResolution resolution) {
        ActivityRiskResolutionResponse response = new ActivityRiskResolutionResponse();
        response.setId(resolution.getId());
        response.setActivityId(resolution.getActivityId());
        response.setOrganizerId(resolution.getOrganizerId());
        response.setRiskArtistId(resolution.getRiskArtistId());
        response.setStatus(resolution.getStatus());
        response.setResolutionNote(resolution.getResolutionNote());
        response.setReviewNote(resolution.getReviewNote());
        response.setSubmittedBy(resolution.getSubmittedBy());
        response.setReviewedBy(resolution.getReviewedBy());
        response.setReviewedAt(resolution.getReviewedAt());
        return response;
    }
}
