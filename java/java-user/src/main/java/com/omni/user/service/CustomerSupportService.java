package com.omni.user.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.user.client.NotificationInternalClient;
import com.omni.user.dto.NotificationMessageRequest;
import com.omni.user.dto.SupportConversationRequest;
import com.omni.user.dto.SupportConversationResponse;
import com.omni.user.dto.SupportMessageRequest;
import com.omni.user.dto.SupportMessageResponse;
import com.omni.user.entity.SupportConversation;
import com.omni.user.entity.SupportMessage;
import com.omni.user.entity.User;
import com.omni.user.mapper.SupportConversationMapper;
import com.omni.user.mapper.SupportMessageMapper;
import com.omni.user.mapper.UserMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.stream.Collectors;

@Service
public class CustomerSupportService {

    private static final Logger log = LoggerFactory.getLogger(CustomerSupportService.class);

    private static final String ROLE_ADMIN = "admin";
    private static final String ROLE_SUPPORT = "support";
    private static final String STATUS_OPEN = "OPEN";
    private static final String STATUS_WAITING_AGENT = "WAITING_AGENT";
    private static final String STATUS_ASSIGNED = "ASSIGNED";
    private static final String STATUS_CLOSE_REQUESTED = "CLOSE_REQUESTED";
    private static final String STATUS_CLOSED = "CLOSED";
    private static final String SOURCE_AI = "AI";
    private static final String SOURCE_HUMAN = "HUMAN";
    private static final String AUTO_CLOSE_MESSAGE = "用户超过30分钟未继续咨询，系统已自动结束会话。";
    private static final long HELP_PRESENCE_TTL_SECONDS = 60L;

    private final SupportConversationMapper conversationMapper;
    private final SupportMessageMapper messageMapper;
    private final UserMapper userMapper;
    private final SupportAiService supportAiService;
    private final NotificationInternalClient notificationClient;
    private final String internalApiToken;
    private final ConcurrentMap<Long, LocalDateTime> helpPresence = new ConcurrentHashMap<>();

    public CustomerSupportService(SupportConversationMapper conversationMapper,
                                  SupportMessageMapper messageMapper,
                                  UserMapper userMapper,
                                  SupportAiService supportAiService,
                                  NotificationInternalClient notificationClient,
                                  @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.conversationMapper = conversationMapper;
        this.messageMapper = messageMapper;
        this.userMapper = userMapper;
        this.supportAiService = supportAiService;
        this.notificationClient = notificationClient;
        this.internalApiToken = internalApiToken;
    }

    @Transactional
    public SupportConversationResponse startConversation(Long userId, SupportConversationRequest request) {
        requireActiveUser(userId);
        String initialMessage = request == null ? null : trimToNull(request.getInitialMessage());
        boolean preferHuman = request != null && Boolean.TRUE.equals(request.getPreferHuman());
        SupportConversation conversation = new SupportConversation();
        conversation.setUserId(userId);
        conversation.setSubject(buildSubject(request == null ? null : request.getSubject(), initialMessage));
        conversation.setStatus(preferHuman ? STATUS_WAITING_AGENT : STATUS_OPEN);
        conversation.setSourceType(preferHuman ? SOURCE_HUMAN : SOURCE_AI);
        conversation.setLastMessage(initialMessage == null ? "用户发起在线客服咨询" : initialMessage);
        touch(conversation);
        conversationMapper.insert(conversation);

        if (initialMessage != null) {
            insertMessage(conversation.getId(), userId, "USER", initialMessage);
            if (!preferHuman) {
                String answer = supportAiService.answer(initialMessage);
                insertMessage(conversation.getId(), null, "AI", answer);
                conversation.setLastMessage(answer);
                touch(conversation);
                conversationMapper.updateById(conversation);
            }
        }
        return toConversationResponse(conversation);
    }

    public List<SupportConversationResponse> listMine(Long userId) {
        requireActiveUser(userId);
        return conversationMapper.selectList(new LambdaQueryWrapper<SupportConversation>()
                        .eq(SupportConversation::getUserId, userId)
                        .orderByDesc(SupportConversation::getUpdateTime)
                        .orderByDesc(SupportConversation::getId))
                .stream()
                .map(this::toConversationResponse)
                .collect(Collectors.toList());
    }

    public List<SupportConversationResponse> listAgentConversations(Long agentUserId, String status) {
        User agent = requireSupportOrAdmin(agentUserId);
        LambdaQueryWrapper<SupportConversation> wrapper = new LambdaQueryWrapper<SupportConversation>()
                .orderByDesc(SupportConversation::getUpdateTime)
                .orderByDesc(SupportConversation::getId);
        String normalizedStatus = trimToNull(status);
        if (normalizedStatus != null) {
            wrapper.eq(SupportConversation::getStatus, normalizedStatus);
        } else {
            wrapper.ne(SupportConversation::getStatus, STATUS_CLOSED);
            if (ROLE_SUPPORT.equals(agent.getRole())) {
                wrapper.in(SupportConversation::getStatus, STATUS_WAITING_AGENT, STATUS_ASSIGNED, STATUS_CLOSE_REQUESTED);
            }
        }
        if (ROLE_SUPPORT.equals(agent.getRole())) {
            wrapper.and(w -> w.isNull(SupportConversation::getAssignedAgentId)
                    .or()
                    .eq(SupportConversation::getAssignedAgentId, agentUserId));
        }
        return conversationMapper.selectList(wrapper).stream()
                .filter(conversation -> !ROLE_SUPPORT.equals(agent.getRole())
                        || normalizedStatus != null
                        || STATUS_WAITING_AGENT.equals(conversation.getStatus())
                        || STATUS_ASSIGNED.equals(conversation.getStatus())
                        || STATUS_CLOSE_REQUESTED.equals(conversation.getStatus()))
                .map(this::toConversationResponse)
                .collect(Collectors.toList());
    }

    public List<SupportMessageResponse> listMessages(Long actorUserId, Long conversationId) {
        SupportConversation conversation = requireVisibleConversation(actorUserId, conversationId);
        return messageMapper.selectList(new LambdaQueryWrapper<SupportMessage>()
                        .eq(SupportMessage::getConversationId, conversation.getId())
                        .orderByAsc(SupportMessage::getId))
                .stream()
                .map(this::toMessageResponse)
                .collect(Collectors.toList());
    }

    public void markHelpPresence(Long userId) {
        markHelpPresence(userId, LocalDateTime.now());
    }

    public void markHelpPresence(Long userId, LocalDateTime now) {
        if (userId == null) {
            return;
        }
        requireActiveUser(userId);
        helpPresence.put(userId, now == null ? LocalDateTime.now() : now);
    }

    public void clearHelpPresence(Long userId) {
        if (userId == null) {
            return;
        }
        helpPresence.remove(userId);
    }

    @Transactional
    public SupportMessageResponse sendMessage(Long actorUserId, Long conversationId, SupportMessageRequest request) {
        String content = request == null ? null : trimToNull(request.getContent());
        if (content == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "消息内容不能为空");
        }
        User actor = requireActiveUser(actorUserId);
        SupportConversation conversation = requireVisibleConversation(actorUserId, conversationId);
        String senderType = actorUserId.equals(conversation.getUserId()) ? "USER" : "AGENT";
        SupportMessage message = insertMessage(conversation.getId(), actorUserId, senderType, content);
        conversation.setLastMessage(content);
        if ("USER".equals(senderType) && STATUS_CLOSE_REQUESTED.equals(conversation.getStatus())) {
            conversation.setStatus(STATUS_ASSIGNED);
        }
        if ("AGENT".equals(senderType) && conversation.getAssignedAgentId() == null) {
            conversation.setAssignedAgentId(actorUserId);
            conversation.setSourceType(SOURCE_HUMAN);
            conversation.setStatus(STATUS_ASSIGNED);
        }
        touch(conversation);
        conversationMapper.updateById(conversation);
        if ("AGENT".equals(senderType)) {
            notifySupportReply(conversation);
        }

        if ("USER".equals(senderType) && SOURCE_AI.equals(conversation.getSourceType()) && conversation.getAssignedAgentId() == null) {
            String answer = supportAiService.answer(content);
            insertMessage(conversation.getId(), null, "AI", answer);
            conversation.setLastMessage(answer);
            touch(conversation);
            conversationMapper.updateById(conversation);
        }
        return toMessageResponse(message);
    }

    @Transactional
    public SupportConversationResponse handoff(Long userId, Long conversationId) {
        SupportConversation conversation = requireOwnerConversation(userId, conversationId);
        conversation.setSourceType(SOURCE_HUMAN);
        conversation.setStatus(STATUS_WAITING_AGENT);
        conversation.setLastMessage("用户已申请转人工客服");
        touch(conversation);
        conversationMapper.updateById(conversation);
        insertMessage(conversation.getId(), null, "SYSTEM", "人工介入请等待");
        return toConversationResponse(conversation);
    }

    @Transactional
    public SupportConversationResponse claim(Long agentUserId, Long conversationId) {
        User agent = requireSupportOrAdmin(agentUserId);
        SupportConversation conversation = requireConversation(conversationId);
        if (STATUS_CLOSED.equals(conversation.getStatus())) {
            throw new BusinessException(ResultCode.CONFLICT, "已结束的会话不能接入");
        }
        String joinedMessage = buildAgentJoinedMessage(agent);
        conversation.setAssignedAgentId(agentUserId);
        conversation.setSourceType(SOURCE_HUMAN);
        conversation.setStatus(STATUS_ASSIGNED);
        conversation.setLastMessage(joinedMessage);
        touch(conversation);
        conversationMapper.updateById(conversation);
        insertMessage(conversation.getId(), agentUserId, "SYSTEM", joinedMessage);
        return toConversationResponse(conversation);
    }

    @Transactional
    public SupportConversationResponse close(Long agentUserId, Long conversationId) {
        requireSupportOrAdmin(agentUserId);
        SupportConversation conversation = requireConversation(conversationId);
        if (STATUS_CLOSED.equals(conversation.getStatus())) {
            throw new BusinessException(ResultCode.CONFLICT, "会话已结束");
        }
        conversation.setStatus(STATUS_CLOSE_REQUESTED);
        conversation.setLastMessage("人工客服申请结束会话，请确认是否结束。");
        touch(conversation);
        conversationMapper.updateById(conversation);
        insertMessage(conversation.getId(), agentUserId, "SYSTEM", "人工客服申请结束会话，请确认是否结束。");
        return toConversationResponse(conversation);
    }

    @Transactional
    public SupportConversationResponse confirmClose(Long userId, Long conversationId) {
        SupportConversation conversation = requireOwnerConversation(userId, conversationId);
        if (!STATUS_CLOSE_REQUESTED.equals(conversation.getStatus())) {
            throw new BusinessException(ResultCode.CONFLICT, "当前会话未申请结束");
        }
        conversation.setStatus(STATUS_CLOSED);
        conversation.setClosedAt(LocalDateTime.now());
        conversation.setLastMessage("用户已确认结束会话");
        touch(conversation);
        conversationMapper.updateById(conversation);
        insertMessage(conversation.getId(), userId, "SYSTEM", "用户已确认结束会话");
        return toConversationResponse(conversation);
    }

    @Scheduled(fixedDelay = 60_000L)
    @Transactional
    public void closeInactiveAssignedHumanConversationsOnSchedule() {
        int closedCount = closeInactiveAssignedHumanConversations(LocalDateTime.now());
        if (closedCount > 0) {
            log.info("自动结束超时客服会话: count={}", closedCount);
        }
    }

    public int closeInactiveAssignedHumanConversations(LocalDateTime now) {
        LocalDateTime effectiveNow = now == null ? LocalDateTime.now() : now;
        LocalDateTime deadline = effectiveNow.minusMinutes(30);
        List<SupportConversation> conversations = conversationMapper.selectList(new LambdaQueryWrapper<SupportConversation>()
                .eq(SupportConversation::getSourceType, SOURCE_HUMAN)
                .eq(SupportConversation::getStatus, STATUS_ASSIGNED));
        int closedCount = 0;
        for (SupportConversation conversation : conversations) {
            SupportMessage lastUserMessage = messageMapper.selectOne(new LambdaQueryWrapper<SupportMessage>()
                    .eq(SupportMessage::getConversationId, conversation.getId())
                    .eq(SupportMessage::getSenderType, "USER")
                    .orderByDesc(SupportMessage::getCreateTime)
                    .orderByDesc(SupportMessage::getId)
                    .last("limit 1"));
            if (lastUserMessage == null || lastUserMessage.getCreateTime() == null) {
                continue;
            }
            if (!lastUserMessage.getCreateTime().isBefore(deadline)) {
                continue;
            }
            conversation.setStatus(STATUS_CLOSED);
            conversation.setClosedAt(effectiveNow);
            conversation.setLastMessage(AUTO_CLOSE_MESSAGE);
            touch(conversation, effectiveNow);
            conversationMapper.updateById(conversation);
            insertMessage(conversation.getId(), null, "SYSTEM", AUTO_CLOSE_MESSAGE);
            closedCount++;
        }
        return closedCount;
    }

    private SupportConversation requireVisibleConversation(Long actorUserId, Long conversationId) {
        User actor = requireActiveUser(actorUserId);
        SupportConversation conversation = requireConversation(conversationId);
        if (!isSupportRole(actor.getRole()) && !actorUserId.equals(conversation.getUserId())) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权查看该客服会话");
        }
        return conversation;
    }

    private SupportConversation requireOwnerConversation(Long userId, Long conversationId) {
        SupportConversation conversation = requireConversation(conversationId);
        if (!userId.equals(conversation.getUserId())) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权操作该客服会话");
        }
        return conversation;
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
        if (!isSupportRole(user.getRole())) {
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

    private boolean isSupportRole(String role) {
        return ROLE_SUPPORT.equals(role) || ROLE_ADMIN.equals(role);
    }

    private SupportMessage insertMessage(Long conversationId, Long senderUserId, String senderType, String content) {
        SupportMessage message = new SupportMessage();
        message.setConversationId(conversationId);
        message.setSenderUserId(senderUserId);
        message.setSenderType(senderType);
        message.setContent(content);
        messageMapper.insert(message);
        return message;
    }

    private void touch(SupportConversation conversation) {
        conversation.setUpdateTime(LocalDateTime.now());
    }

    private void touch(SupportConversation conversation, LocalDateTime now) {
        conversation.setUpdateTime(now == null ? LocalDateTime.now() : now);
    }

    private void notifySupportReply(SupportConversation conversation) {
        if (conversation == null || conversation.getUserId() == null || notificationClient == null || !StringUtils.hasText(internalApiToken)) {
            return;
        }
        if (isUserViewingHelp(conversation.getUserId(), LocalDateTime.now())) {
            return;
        }
        try {
            NotificationMessageRequest request = new NotificationMessageRequest(
                    conversation.getUserId(),
                    null,
                    "SUPPORT_REPLY",
                    "人工客服回复了你的咨询，请查看客服会话。");
            request.setActionHref("/help");
            request.setActionLabel("查看客服会话");
            request.setAggregateKey("SUPPORT_REPLY:" + conversation.getId());
            notificationClient.createMessage(request, internalApiToken);
        } catch (RuntimeException e) {
            log.warn("客服回复通知发送失败: conversationId={}, userId={}, message={}",
                    conversation.getId(), conversation.getUserId(), e.getMessage());
        }
    }

    private boolean isUserViewingHelp(Long userId, LocalDateTime now) {
        if (userId == null) {
            return false;
        }
        LocalDateTime lastSeen = helpPresence.get(userId);
        if (lastSeen == null) {
            return false;
        }
        LocalDateTime effectiveNow = now == null ? LocalDateTime.now() : now;
        if (lastSeen.isBefore(effectiveNow.minusSeconds(HELP_PRESENCE_TTL_SECONDS))) {
            helpPresence.remove(userId, lastSeen);
            return false;
        }
        return true;
    }

    private String buildSubject(String subject, String initialMessage) {
        String explicit = trimToNull(subject);
        if (explicit != null) return abbreviate(explicit, 40);
        String message = trimToNull(initialMessage);
        return message == null ? "在线客服咨询" : abbreviate(message, 40);
    }

    private String abbreviate(String value, int maxLength) {
        if (value.length() <= maxLength) return value;
        return value.substring(0, maxLength);
    }

    private String buildAgentJoinedMessage(User agent) {
        String nickname = agent == null ? null : trimToNull(agent.getNickname());
        return nickname == null ? "人工客服已介入" : nickname + "已介入";
    }

    private SupportConversationResponse toConversationResponse(SupportConversation conversation) {
        SupportConversationResponse response = new SupportConversationResponse();
        response.setId(conversation.getId());
        response.setUserId(conversation.getUserId());
        User customer = conversation.getUserId() == null ? null : userMapper.selectById(conversation.getUserId());
        if (customer != null) {
            response.setUserNickname(customer.getNickname());
            response.setUserPhoneMask(maskPhone(customer.getPhone()));
        }
        response.setSubject(conversation.getSubject());
        response.setStatus(conversation.getStatus());
        response.setSourceType(conversation.getSourceType());
        response.setAssignedAgentId(conversation.getAssignedAgentId());
        response.setLastMessage(conversation.getLastMessage());
        response.setCreateTime(conversation.getCreateTime());
        response.setUpdateTime(conversation.getUpdateTime());
        response.setClosedAt(conversation.getClosedAt());
        return response;
    }

    private String maskPhone(String phone) {
        String value = trimToNull(phone);
        if (value == null) return null;
        if (value.length() < 7) return value;
        return value.substring(0, 3) + "****" + value.substring(value.length() - 4);
    }

    private SupportMessageResponse toMessageResponse(SupportMessage message) {
        SupportMessageResponse response = new SupportMessageResponse();
        response.setId(message.getId());
        response.setConversationId(message.getConversationId());
        response.setSenderUserId(message.getSenderUserId());
        response.setSenderType(message.getSenderType());
        response.setSenderDisplayName(buildSenderDisplayName(message));
        response.setContent(message.getContent());
        response.setCreateTime(message.getCreateTime());
        return response;
    }

    private String buildSenderDisplayName(SupportMessage message) {
        if (message == null) return null;
        if ("AI".equals(message.getSenderType())) return "AI 客服";
        if ("SYSTEM".equals(message.getSenderType())) return "系统";
        if (message.getSenderUserId() == null) return null;
        User user = userMapper.selectById(message.getSenderUserId());
        if (user == null) return null;
        String nickname = trimToNull(user.getNickname());
        if (nickname != null) return nickname;
        String phoneMask = maskPhone(user.getPhone());
        if (phoneMask != null) return phoneMask;
        return "用户 " + user.getId();
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
