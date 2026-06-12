package com.omni.user.service;

import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.user.client.GrabSupportContextInternalClient;
import com.omni.user.client.NotificationSupportContextInternalClient;
import com.omni.user.client.OrderSupportContextInternalClient;
import com.omni.user.client.PaymentSupportContextInternalClient;
import com.omni.user.dto.SupportContextResponse;
import com.omni.user.entity.SupportAccount;
import com.omni.user.entity.SupportConversation;
import com.omni.user.entity.User;
import com.omni.user.mapper.SupportAccountMapper;
import com.omni.user.mapper.SupportConversationMapper;
import com.omni.user.mapper.UserMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Collections;
import java.util.List;
import java.util.function.Supplier;

@Service
public class SupportContextService {

    private static final int CONTEXT_LIMIT = 5;
    private static final String ROLE_ADMIN = "admin";
    private static final String ROLE_SUPPORT = "support";
    private static final String SUPPORT_ROLE_MANAGER = "support_manager";
    private static final String STATUS_WAITING_AGENT = "WAITING_AGENT";

    private final SupportConversationMapper conversationMapper;
    private final UserMapper userMapper;
    private final SupportAccountMapper supportAccountMapper;
    private final OrderSupportContextInternalClient orderClient;
    private final PaymentSupportContextInternalClient paymentClient;
    private final NotificationSupportContextInternalClient notificationClient;
    private final GrabSupportContextInternalClient grabClient;
    private final String internalApiToken;

    public SupportContextService(SupportConversationMapper conversationMapper,
                                 UserMapper userMapper,
                                 SupportAccountMapper supportAccountMapper) {
        this(conversationMapper, userMapper, supportAccountMapper, null, null, null, null, null);
    }

    @Autowired
    public SupportContextService(SupportConversationMapper conversationMapper,
                                 UserMapper userMapper,
                                 SupportAccountMapper supportAccountMapper,
                                 OrderSupportContextInternalClient orderClient,
                                 PaymentSupportContextInternalClient paymentClient,
                                 NotificationSupportContextInternalClient notificationClient,
                                 GrabSupportContextInternalClient grabClient,
                                 @Value("${internal.api.token:${INTERNAL_API_TOKEN:omni-local-internal-token}}") String internalApiToken) {
        this.conversationMapper = conversationMapper;
        this.userMapper = userMapper;
        this.supportAccountMapper = supportAccountMapper;
        this.orderClient = orderClient;
        this.paymentClient = paymentClient;
        this.notificationClient = notificationClient;
        this.grabClient = grabClient;
        this.internalApiToken = internalApiToken;
    }

    public SupportContextResponse getContext(Long actorUserId, Long conversationId) {
        User actor = requireSupportOrAdmin(actorUserId);
        SupportConversation conversation = requireVisibleConversation(actor, actorUserId, conversationId);
        User user = userMapper.selectById(conversation.getUserId());
        SupportContextResponse response = SupportContextResponse.empty(
                conversation.getId(),
                conversation.getUserId(),
                displayName(user, conversation.getUserId()),
                maskPhone(user == null ? null : user.getPhone()));
        if (!hasContextClients()) {
            return response;
        }
        Long userId = conversation.getUserId();
        response.setOrders(safeLoad("orders", "订单上下文暂不可用",
                () -> orderClient.listOrders(userId, CONTEXT_LIMIT, internalApiToken), response));
        response.setTickets(safeLoad("tickets", "票夹上下文暂不可用",
                () -> orderClient.listTickets(userId, CONTEXT_LIMIT, internalApiToken), response));
        response.setRefunds(safeLoad("refunds", "退款上下文暂不可用",
                () -> paymentClient.listRefunds(userId, CONTEXT_LIMIT, internalApiToken), response));
        response.setNotifications(safeLoad("notifications", "通知上下文暂不可用",
                () -> notificationClient.listNotifications(userId, CONTEXT_LIMIT, internalApiToken), response));
        response.setGrabRequests(safeLoad("grabRequests", "抢票上下文暂不可用",
                () -> grabClient.listGrabRequests(userId, CONTEXT_LIMIT, internalApiToken), response));
        response.setWaitlist(safeLoad("waitlist", "候补上下文暂不可用",
                () -> grabClient.listWaitlistEntries(userId, CONTEXT_LIMIT, internalApiToken), response));
        return response;
    }

    private boolean hasContextClients() {
        return orderClient != null
                && paymentClient != null
                && notificationClient != null
                && grabClient != null;
    }

    private <T> List<T> safeLoad(String section,
                                 String message,
                                 Supplier<Result<List<T>>> loader,
                                 SupportContextResponse response) {
        try {
            Result<List<T>> result = loader.get();
            if (result == null || result.getCode() != ResultCode.SUCCESS.getCode() || result.getData() == null) {
                response.addError(section, message);
                return Collections.emptyList();
            }
            return result.getData();
        } catch (RuntimeException e) {
            response.addError(section, message);
            return Collections.emptyList();
        }
    }

    private SupportConversation requireVisibleConversation(User actor, Long actorUserId, Long conversationId) {
        SupportConversation conversation = requireConversation(conversationId);
        if (ROLE_ADMIN.equals(actor.getRole()) || hasSupportManagerScope(actor)) {
            return conversation;
        }
        if (STATUS_WAITING_AGENT.equals(conversation.getStatus()) && conversation.getAssignedAgentId() == null) {
            return conversation;
        }
        if (actorUserId.equals(conversation.getAssignedAgentId())) {
            return conversation;
        }
        throw new BusinessException(ResultCode.FORBIDDEN, "无权查看该客服会话");
    }

    private SupportConversation requireConversation(Long conversationId) {
        if (conversationId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "客服会话ID不能为空");
        }
        SupportConversation conversation = conversationMapper.selectById(conversationId);
        if (conversation == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "客服会话不存在");
        }
        return conversation;
    }

    private User requireSupportOrAdmin(Long userId) {
        User user = requireActiveUser(userId);
        if (!ROLE_SUPPORT.equals(user.getRole()) && !ROLE_ADMIN.equals(user.getRole())) {
            throw new BusinessException(ResultCode.FORBIDDEN, "仅客服或平台管理员可以处理会话");
        }
        return user;
    }

    private User requireActiveUser(Long userId) {
        if (userId == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
        User user = userMapper.selectById(userId);
        if (user == null || Integer.valueOf(0).equals(user.getStatus())) {
            throw new BusinessException(ResultCode.UNAUTHORIZED, "账号不可用");
        }
        return user;
    }

    private boolean hasSupportManagerScope(User user) {
        if (user == null || supportAccountMapper == null || !ROLE_SUPPORT.equals(user.getRole())) {
            return false;
        }
        SupportAccount account = supportAccountMapper.selectById(user.getId());
        return account != null
                && !Integer.valueOf(0).equals(account.getStatus())
                && SUPPORT_ROLE_MANAGER.equals(account.getSupportRole());
    }

    private String displayName(User user, Long userId) {
        if (user != null && StringUtils.hasText(user.getNickname())) {
            return user.getNickname();
        }
        String phoneMask = maskPhone(user == null ? null : user.getPhone());
        if (StringUtils.hasText(phoneMask)) {
            return phoneMask;
        }
        return "用户 " + userId;
    }

    private String maskPhone(String phone) {
        if (!StringUtils.hasText(phone)) {
            return null;
        }
        String trimmed = phone.trim();
        if (trimmed.length() < 7) {
            return "****";
        }
        return trimmed.substring(0, 3) + "****" + trimmed.substring(trimmed.length() - 4);
    }
}
