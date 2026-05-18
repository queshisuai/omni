package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.ticket.client.OrderInternalClient;
import com.omni.ticket.client.PaymentInternalClient;
import com.omni.ticket.dto.DeactivateActivityRequest;
import com.omni.ticket.dto.DirectRefundRequest;
import com.omni.ticket.dto.DirectRefundResponse;
import com.omni.ticket.dto.OrderInfoResponse;
import com.omni.ticket.dto.PaidOrdersBySessionsRequest;
import com.omni.ticket.dto.RefundImpactResponse;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.entity.UserRef;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.mapper.UserRefMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ActivityAdminService {

    private static final String REFUND_STATUS_SUCCESS = "SUCCESS";
    private static final String REFUND_STATUS_FAILED = "FAILED";
    private static final String REFUND_STATUS_UNKNOWN = "UNKNOWN";
    private static final String REFUND_STATUS_COMPENSATION_REQUIRED = "COMPENSATION_REQUIRED";

    private final ActivityMapper activityMapper;
    private final SessionMapper sessionMapper;
    private final TicketTypeMapper ticketTypeMapper;
    private final UserRefMapper userRefMapper;
    private final OrderInternalClient orderInternalClient;
    private final PaymentInternalClient paymentInternalClient;
    private final String internalApiToken;

    public ActivityAdminService(ActivityMapper activityMapper,
                                SessionMapper sessionMapper,
                                TicketTypeMapper ticketTypeMapper,
                                UserRefMapper userRefMapper,
                                OrderInternalClient orderInternalClient,
                                PaymentInternalClient paymentInternalClient,
                                @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.activityMapper = activityMapper;
        this.sessionMapper = sessionMapper;
        this.ticketTypeMapper = ticketTypeMapper;
        this.userRefMapper = userRefMapper;
        this.orderInternalClient = orderInternalClient;
        this.paymentInternalClient = paymentInternalClient;
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
        UserRef user = userRefMapper.selectById(request.getUserId());
        String role = user != null ? user.getRole() : null;
        if (!"admin".equals(role) && !"organizer".equals(role)) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权限");
        }
        if ("organizer".equals(role) && !request.getUserId().equals(activity.getOrganizerId())) {
            throw new BusinessException(ResultCode.FORBIDDEN, "只能管理自己主办的活动");
        }
        if (!Boolean.TRUE.equals(request.getConfirmRefund())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "下架活动前必须确认同意为所有已支付订单退款");
        }
        String token = requireInternalApiToken();

        List<Session> sessions = sessionMapper.selectList(new LambdaQueryWrapper<Session>()
                .eq(Session::getActivityId, activityId));
        List<Long> sessionIds = sessions.stream().map(Session::getId).collect(Collectors.toList());
        List<TicketType> ticketTypes = sessionIds.isEmpty()
                ? Collections.emptyList()
                : ticketTypeMapper.selectList(new LambdaQueryWrapper<TicketType>()
                .in(TicketType::getSessionId, sessionIds));

        activity.setStatus(0);
        activityMapper.updateById(activity);
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

        int successCount = 0;
        int failedCount = 0;
        int unknownCount = 0;
        int compensationRequiredCount = 0;
        List<DirectRefundResponse> failures = new ArrayList<>();
        for (OrderInfoResponse order : paidOrders) {
            try {
                DirectRefundResponse result = unwrapRefund(paymentInternalClient.directRefund(
                        new DirectRefundRequest(order.getId(), request.getReason()), token), order);
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
        response.setActivityId(activity.getId());
        response.setActivityName(activity.getName());
        response.setDeactivatedActivityCount(1);
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

    private DirectRefundResponse failureOf(OrderInfoResponse order, String status, String message) {
        DirectRefundResponse failure = new DirectRefundResponse();
        failure.setOrderId(order != null ? order.getId() : null);
        failure.setOrderNo(order != null ? order.getOrderNo() : null);
        failure.setStatus(status);
        failure.setSuccess(false);
        failure.setMessage(StringUtils.hasText(message) ? message : "退款失败");
        return failure;
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
