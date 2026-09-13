package com.omni.ticket.service;

import com.omni.common.result.Result;
import com.omni.exception.BusinessException;
import com.omni.ticket.client.OrderInternalClient;
import com.omni.ticket.dto.AdminRecentOrderContextResponse;
import com.omni.ticket.dto.InternalUserRefResponse;
import com.omni.ticket.dto.OrderInfoResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Service
public class AdminOrderContextService {
    private static final int MAX_RECENT_ORDERS = 2;

    private final OrderInternalClient orderInternalClient;
    private final UserAccessService userAccessService;
    private final String internalApiToken;

    public AdminOrderContextService(OrderInternalClient orderInternalClient,
                                    UserAccessService userAccessService,
                                    @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.orderInternalClient = orderInternalClient;
        this.userAccessService = userAccessService;
        this.internalApiToken = internalApiToken;
    }

    public AdminRecentOrderContextResponse getRecentOrderContext(Long customerUserId, Long operatorUserId) {
        if (customerUserId == null || customerUserId <= 0) {
            throw new BusinessException(400, "用户ID不正确");
        }
        authorize(operatorUserId);

        AdminRecentOrderContextResponse response = new AdminRecentOrderContextResponse();
        response.setUserId(customerUserId);
        if (internalApiToken == null || internalApiToken.trim().isEmpty()) {
            return response;
        }
        try {
            Result<List<OrderInfoResponse>> result = orderInternalClient.listInternalUserOrders(
                    customerUserId, MAX_RECENT_ORDERS, internalApiToken);
            if (result == null || result.getCode() != 200 || result.getData() == null) {
                return response;
            }
            response.setOrders(mapOrders(result.getData()));
        } catch (RuntimeException ignored) {
            // 订单画像是弱依赖，票务服务异常时不影响客服主流程。
        }
        return response;
    }

    private void authorize(Long operatorUserId) {
        InternalUserRefResponse operator = userAccessService.requireUser(operatorUserId);
        if (userAccessService.isAdmin(operator)) {
            return;
        }
        if (!userAccessService.hasAnyPermission(operatorUserId,
                "support.conversation.view", "cs.manage", "cs.review")) {
            throw new BusinessException(403, "无权限");
        }
    }

    private List<AdminRecentOrderContextResponse.OrderSummary> mapOrders(List<OrderInfoResponse> source) {
        if (source == null || source.isEmpty()) {
            return Collections.emptyList();
        }
        List<AdminRecentOrderContextResponse.OrderSummary> result = new ArrayList<>();
        for (OrderInfoResponse order : source) {
            if (order == null) {
                continue;
            }
            AdminRecentOrderContextResponse.OrderSummary summary = new AdminRecentOrderContextResponse.OrderSummary();
            summary.setOrderId(order.getId());
            summary.setOrderNo(order.getOrderNo());
            summary.setActivityName(order.getActivityName());
            summary.setVenueName(order.getVenueName());
            summary.setSessionTime(order.getSessionTime());
            summary.setTicketName(order.getTicketName());
            summary.setSeatLabels(order.getSeatLabels());
            summary.setStatus(order.getStatus());
            summary.setFulfillmentStatus(toFulfillmentStatus(order.getStatus()));
            result.add(summary);
            if (result.size() == MAX_RECENT_ORDERS) {
                break;
            }
        }
        return result;
    }

    private String toFulfillmentStatus(Integer status) {
        if (status == null) {
            return "状态未知";
        }
        switch (status) {
            case 1:
                return "待支付";
            case 2:
                return "已出票";
            case 3:
                return "已取消";
            case 4:
                return "已退票";
            default:
                return "状态未知";
        }
    }
}
