package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.ticket.client.OrderInternalClient;
import com.omni.ticket.client.PaymentInternalClient;
import com.omni.ticket.dto.DeactivateActivityRequest;
import com.omni.ticket.dto.DeactivateOrganizerRequest;
import com.omni.ticket.dto.DeleteActivityRequest;
import com.omni.ticket.dto.DeleteActivityResponse;
import com.omni.ticket.dto.DirectRefundRequest;
import com.omni.ticket.dto.DirectRefundResponse;
import com.omni.ticket.dto.OrderInfoResponse;
import com.omni.ticket.dto.PaidOrdersBySessionsRequest;
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
import com.omni.ticket.service.UserAccessService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.time.LocalDateTime;
import java.util.stream.Collectors;

@Service
public class ActivityAdminService {

    private static final String PUBLISH_STATUS_DEACTIVATED = "deactivated";
    private static final String PUBLISH_STATUS_PUBLISHED = "published";
    private static final String REFUND_STATUS_SUCCESS = "SUCCESS";
    private static final String REFUND_STATUS_FAILED = "FAILED";
    private static final String REFUND_STATUS_UNKNOWN = "UNKNOWN";
    private static final String REFUND_STATUS_COMPENSATION_REQUIRED = "COMPENSATION_REQUIRED";
    // organizer_status: 0待审核, 1已认证, 2已拒绝, 3已取消资格
    private static final int ORGANIZER_STATUS_CANCELLED = 3;

    private final ActivityMapper activityMapper;
    private final SessionMapper sessionMapper;
    private final TicketTypeMapper ticketTypeMapper;
    private final UserAccessService userAccessService;
    private final OrderInternalClient orderInternalClient;
    private final PaymentInternalClient paymentInternalClient;
    private final ActivityArtistMapper activityArtistMapper;
    private final ArtistMapper artistMapper;
    private final String internalApiToken;

    public ActivityAdminService(ActivityMapper activityMapper,
                                SessionMapper sessionMapper,
                                TicketTypeMapper ticketTypeMapper,
                                 UserAccessService userAccessService,
                                 OrderInternalClient orderInternalClient,
                                 PaymentInternalClient paymentInternalClient,
                                 @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this(activityMapper, sessionMapper, ticketTypeMapper, userAccessService, orderInternalClient, paymentInternalClient,
                null, null, internalApiToken);
    }

    @Autowired
    public ActivityAdminService(ActivityMapper activityMapper,
                                SessionMapper sessionMapper,
                                TicketTypeMapper ticketTypeMapper,
                                UserAccessService userAccessService,
                                OrderInternalClient orderInternalClient,
                                PaymentInternalClient paymentInternalClient,
                                ActivityArtistMapper activityArtistMapper,
                                ArtistMapper artistMapper,
                                @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.activityMapper = activityMapper;
        this.sessionMapper = sessionMapper;
        this.ticketTypeMapper = ticketTypeMapper;
        this.userAccessService = userAccessService;
        this.orderInternalClient = orderInternalClient;
        this.paymentInternalClient = paymentInternalClient;
        this.activityArtistMapper = activityArtistMapper;
        this.artistMapper = artistMapper;
        this.internalApiToken = internalApiToken;
    }

    public RefundImpactResponse deactivateActivity(Long activityId, DeactivateActivityRequest request) {
        if (request == null || request.getUserId() == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "下架参数不能为空");
        }
        Activity activity = activityMapper.selectById(activityId);
        if (activity == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "活动不存在");
        }
        InternalUserRefResponse user = userAccessService.requireAdminOrOrganizer(request.getUserId());
        String role = user.getRole();
        if ("organizer".equals(role) && !request.getUserId().equals(activity.getOrganizerId())) {
            throw new BusinessException(ResultCode.FORBIDDEN, "只能管理自己主办的活动");
        }
        if (!Boolean.TRUE.equals(request.getConfirmRefund())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "下架活动前必须确认同意为所有已支付订单退款");
        }
        return deactivateActivities(Collections.singletonList(activity), request.getReason());
    }

    public void updateActivityStatus(Long activityId, UpdateActivityStatusRequest request) {
        if (request == null || request.getUserId() == null || request.getStatus() == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "活动状态参数不能为空");
        }
        Activity activity = activityMapper.selectById(activityId);
        if (activity == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "活动不存在");
        }
        InternalUserRefResponse user = userAccessService.requireAdminOrOrganizer(request.getUserId());
        String role = user.getRole();
        if ("organizer".equals(role) && !request.getUserId().equals(activity.getOrganizerId())) {
            throw new BusinessException(ResultCode.FORBIDDEN, "只能管理自己主办的活动");
        }
        if (Integer.valueOf(1).equals(request.getStatus())) {
            validatePublishable(activityId);
            if (PUBLISH_STATUS_DEACTIVATED.equals(activity.getPublishStatus())) {
                activity.setPublishStatus(PUBLISH_STATUS_PUBLISHED);
            }
        }
        activity.setStatus(request.getStatus());
        activityMapper.updateById(activity);
    }

    public DeleteActivityResponse deleteActivity(Long activityId, DeleteActivityRequest request) {
        if (activityId == null || activityId <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "活动ID不正确");
        }
        if (request == null || request.getUserId() == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "删除参数不能为空");
        }
        if (!StringUtils.hasText(request.getReason())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "删除原因不能为空");
        }
        Activity activity = activityMapper.selectById(activityId);
        if (activity == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "活动不存在");
        }
        InternalUserRefResponse user = userAccessService.requireAdminOrOrganizer(request.getUserId());
        if ("organizer".equals(user.getRole()) && !request.getUserId().equals(activity.getOrganizerId())) {
            throw new BusinessException(ResultCode.FORBIDDEN, "只能管理自己主办的活动");
        }

        List<Session> sessions = sessionMapper.selectList(new LambdaQueryWrapper<Session>()
                .eq(Session::getActivityId, activityId));
        List<Long> sessionIds = sessions == null ? Collections.emptyList()
                : sessions.stream().map(Session::getId).collect(Collectors.toList());
        List<OrderInfoResponse> paidOrders = sessionIds.isEmpty()
                ? Collections.emptyList()
                : unwrapOrders(orderInternalClient.listPaidBySessions(new PaidOrdersBySessionsRequest(sessionIds), requireInternalApiToken()));
        if (paidOrders != null && !paidOrders.isEmpty() && !"deactivated".equals(activity.getPublishStatus())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "活动存在已支付订单，请先下架并完成退款");
        }

        activity.setStatus(0);
        activity.setPublishStatus("deleted");
        activity.setDeleteReason(request.getReason().trim());
        activity.setDeletedBy(request.getUserId());
        activity.setDeletedAt(LocalDateTime.now());
        activityMapper.updateById(activity);

        DeleteActivityResponse response = new DeleteActivityResponse();
        response.setActivityId(activityId);
        response.setStatus(activity.getStatus());
        response.setPublishStatus(activity.getPublishStatus());
        response.setDeleted(true);
        response.setRefundBlocked(false);
        response.setMessage("活动已删除");
        return response;
    }

    public RefundImpactResponse deactivateOrganizer(DeactivateOrganizerRequest request) {
        if (request == null || request.getUserId() == null || request.getOrganizerId() == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "取消主办方资格参数不能为空");
        }
        userAccessService.requireAdmin(request.getUserId());
        if (!Boolean.TRUE.equals(request.getConfirmRefund())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "取消主办方资格前必须确认同意为该主办方所有已支付订单退款");
        }
        InternalUserRefResponse organizer = userAccessService.requireUser(request.getOrganizerId());
        if (!"organizer".equals(organizer.getRole())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "当前用户不是主办方");
        }

        List<Activity> activities = activityMapper.selectList(new LambdaQueryWrapper<Activity>()
                .eq(Activity::getOrganizerId, request.getOrganizerId()));
        RefundImpactResponse response = deactivateActivities(activities, request.getReason());

        throw new BusinessException(ResultCode.INTERNAL_ERROR, "取消主办方资格需通过用户服务接口处理");
    }

    public RefundImpactResponse deactivateActivities(List<Activity> activities, String reason) {
        String token = requireInternalApiToken();
        if (activities == null) {
            activities = Collections.emptyList();
        }
        List<Long> activityIds = activities.stream().map(Activity::getId).collect(Collectors.toList());

        List<Session> sessions = activityIds.isEmpty()
                ? Collections.emptyList()
                : sessionMapper.selectList(new LambdaQueryWrapper<Session>()
                .in(Session::getActivityId, activityIds));
        List<Long> sessionIds = sessions.stream().map(Session::getId).collect(Collectors.toList());
        List<TicketType> ticketTypes = sessionIds.isEmpty()
                ? Collections.emptyList()
                : ticketTypeMapper.selectList(new LambdaQueryWrapper<TicketType>()
                .in(TicketType::getSessionId, sessionIds));

        for (Activity activity : activities) {
            activity.setStatus(0);
            activity.setPublishStatus(PUBLISH_STATUS_DEACTIVATED);
            activityMapper.updateById(activity);
        }
        for (Session session : sessions) {
            session.setStatus(0);
            sessionMapper.updateById(session);
        }
        for (TicketType ticketType : ticketTypes) {
            ticketType.setStatus(0);
            ticketTypeMapper.updateById(ticketType);
        }

        List<OrderInfoResponse> paidOrders = sessionIds.isEmpty()
                ? Collections.emptyList()
                : unwrapOrders(orderInternalClient.listPaidBySessions(new PaidOrdersBySessionsRequest(sessionIds), token));
        if (paidOrders == null) {
            paidOrders = Collections.emptyList();
        }
        paidOrders = deduplicateOrders(paidOrders);

        int successCount = 0;
        int failedCount = 0;
        int unknownCount = 0;
        int compensationRequiredCount = 0;
        List<DirectRefundResponse> failures = new ArrayList<>();
        for (OrderInfoResponse order : paidOrders) {
            try {
                DirectRefundResponse result = unwrapRefund(paymentInternalClient.directRefund(
                        new DirectRefundRequest(order.getId(), reason), token), order);
                String status = normalizeStatus(result);
                if (REFUND_STATUS_SUCCESS.equals(status)) {
                    successCount++;
                } else if (REFUND_STATUS_UNKNOWN.equals(status)) {
                    unknownCount++;
                    failures.add(result != null ? result : failureOf(order, REFUND_STATUS_UNKNOWN, "退款结果未知，请查询/人工确认"));
                } else if (REFUND_STATUS_COMPENSATION_REQUIRED.equals(status)) {
                    compensationRequiredCount++;
                    failures.add(result != null ? result : failureOf(order, REFUND_STATUS_COMPENSATION_REQUIRED, "需人工处理"));
                } else {
                    failedCount++;
                    failures.add(result != null ? result : failureOf(order, REFUND_STATUS_FAILED, "退款服务无响应"));
                }
            } catch (RuntimeException e) {
                failedCount++;
                failures.add(failureOf(order, REFUND_STATUS_FAILED, e.getMessage()));
            }
        }

        RefundImpactResponse response = new RefundImpactResponse();
        if (activities.size() == 1) {
            response.setActivityId(activities.get(0).getId());
            response.setActivityName(activities.get(0).getName());
        } else {
            response.setActivityName("主办方活动批量下架");
        }
        response.setDeactivatedActivityCount(activities.size());
        response.setDeactivatedSessionCount(sessions.size());
        response.setDeactivatedTicketTypeCount(ticketTypes.size());
        response.setPaidOrderCount(paidOrders.size());
        response.setRefundSuccessCount(successCount);
        response.setRefundFailedCount(failedCount);
        response.setRefundUnknownCount(unknownCount);
        response.setRefundCompensationRequiredCount(compensationRequiredCount);
        response.setFailures(failures);
        return response;
    }

    public void validatePublishableForReview(Long activityId) {
        validatePublishable(activityId);
    }

    private void validatePublishable(Long activityId) {
        List<Session> activeSessions = sessionMapper.selectList(new LambdaQueryWrapper<Session>()
                .eq(Session::getActivityId, activityId)
                .eq(Session::getStatus, 1));
        if (activeSessions == null || activeSessions.isEmpty()) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "上架活动前至少需要一个有效场次");
        }
        List<Long> sessionIds = activeSessions.stream().map(Session::getId).collect(Collectors.toList());
        List<TicketType> activeTicketTypes = ticketTypeMapper.selectList(new LambdaQueryWrapper<TicketType>()
                .in(TicketType::getSessionId, sessionIds)
                .eq(TicketType::getStatus, 1));
        if (activeTicketTypes == null || activeTicketTypes.isEmpty()) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "上架活动前至少需要一个可售票档");
        }
        validatePublishableArtists(activityId);
    }

    private void validatePublishableArtists(Long activityId) {
        if (activityArtistMapper == null || artistMapper == null) {
            return;
        }
        List<ActivityArtist> lineup = activityArtistMapper.selectList(new LambdaQueryWrapper<ActivityArtist>()
                .eq(ActivityArtist::getActivityId, activityId)
                .eq(ActivityArtist::getStatus, 1));
        if (lineup == null || lineup.isEmpty()) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "上架活动前至少需要一个已审核艺人");
        }
        List<Long> artistIds = lineup.stream()
                .map(ActivityArtist::getArtistId)
                .filter(id -> id != null && id > 0)
                .distinct()
                .collect(Collectors.toList());
        if (artistIds.isEmpty()) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "阵容中存在不可用艺人，暂不能上架");
        }
        List<Artist> artists = artistMapper.selectBatchIds(artistIds);
        if (artists == null || artists.size() != artistIds.size()) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "阵容中存在不可用艺人，暂不能上架");
        }
        for (Artist artist : artists) {
            if (artist == null || artist.getId() == null || !Integer.valueOf(1).equals(artist.getStatus())) {
                throw new BusinessException(ResultCode.BAD_REQUEST, "阵容中存在不可用艺人，暂不能上架");
            }
            if (StringUtils.hasText(artist.getReviewStatus()) && !"approved".equals(artist.getReviewStatus())) {
                throw new BusinessException(ResultCode.BAD_REQUEST, "阵容中存在未审核艺人，请先完成艺人档案审核");
            }
            if ("risky".equals(artist.getRiskStatus())) {
                throw new BusinessException(ResultCode.BAD_REQUEST, "阵容中存在风险艺人，暂不能上架");
            }
        }
    }

    private DirectRefundResponse failureOf(OrderInfoResponse order, String status, String message) {
        DirectRefundResponse failure = new DirectRefundResponse();
        failure.setOrderId(order != null ? order.getId() : null);
        failure.setOrderNo(order != null ? order.getOrderNo() : null);
        failure.setStatus(status);
        failure.setSuccess(false);
        failure.setMessage(StringUtils.hasText(message) ? message : "退款失败");
        return failure;
    }

    private List<OrderInfoResponse> deduplicateOrders(List<OrderInfoResponse> orders) {
        Map<Long, OrderInfoResponse> deduplicated = new LinkedHashMap<>();
        List<OrderInfoResponse> ordersWithoutId = new ArrayList<>();
        for (OrderInfoResponse order : orders) {
            if (order == null || order.getId() == null) {
                ordersWithoutId.add(order);
                continue;
            }
            deduplicated.putIfAbsent(order.getId(), order);
        }
        List<OrderInfoResponse> result = new ArrayList<>(deduplicated.values());
        result.addAll(ordersWithoutId);
        return result;
    }

    private String normalizeStatus(DirectRefundResponse result) {
        if (result == null) {
            return REFUND_STATUS_FAILED;
        }
        if (StringUtils.hasText(result.getStatus())) {
            return result.getStatus();
        }
        return Boolean.TRUE.equals(result.getSuccess()) ? REFUND_STATUS_SUCCESS : REFUND_STATUS_FAILED;
    }

    private List<OrderInfoResponse> unwrapOrders(Result<List<OrderInfoResponse>> result) {
        if (result == null || result.getCode() != ResultCode.SUCCESS.getCode()) {
            String message = result != null && StringUtils.hasText(result.getMessage()) ? result.getMessage() : "订单服务无响应";
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "查询已支付订单失败: " + message);
        }
        return result.getData() != null ? result.getData() : Collections.emptyList();
    }

    private DirectRefundResponse unwrapRefund(Result<DirectRefundResponse> result, OrderInfoResponse order) {
        if (result == null || result.getCode() != ResultCode.SUCCESS.getCode()) {
            String message = result != null && StringUtils.hasText(result.getMessage()) ? result.getMessage() : "退款服务无响应";
            return failureOf(order, REFUND_STATUS_FAILED, message);
        }
        return result.getData();
    }

    private String requireInternalApiToken() {
        if (!StringUtils.hasText(internalApiToken)) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "内部接口令牌未配置");
        }
        return internalApiToken;
    }
}
