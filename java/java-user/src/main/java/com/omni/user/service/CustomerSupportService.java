package com.omni.user.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class CustomerSupportService {

    private static final String ROLE_ADMIN = "admin";
    private static final String ROLE_SUPPORT = "support";
    private static final String STATUS_OPEN = "OPEN";
    private static final String STATUS_WAITING_AGENT = "WAITING_AGENT";
    private static final String STATUS_ASSIGNED = "ASSIGNED";
    private static final String STATUS_CLOSED = "CLOSED";
    private static final String SOURCE_AI = "AI";
    private static final String SOURCE_HUMAN = "HUMAN";

    private final SupportConversationMapper conversationMapper;
    private final SupportMessageMapper messageMapper;
    private final UserMapper userMapper;
    private final SupportAiService supportAiService;

    public CustomerSupportService(SupportConversationMapper conversationMapper,
                                  SupportMessageMapper messageMapper,
                                  UserMapper userMapper,
                                  SupportAiService supportAiService) {
        this.conversationMapper = conversationMapper;
        this.messageMapper = messageMapper;
        this.userMapper = userMapper;
        this.supportAiService = supportAiService;
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
        conversationMapper.insert(conversation);

        if (initialMessage != null) {
            insertMessage(conversation.getId(), userId, "USER", initialMessage);
            if (!preferHuman) {
                String answer = supportAiService.answer(initialMessage);
                insertMessage(conversation.getId(), null, "AI", answer);
                conversation.setLastMessage(answer);
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
        }
        if (ROLE_SUPPORT.equals(agent.getRole())) {
            wrapper.and(w -> w.isNull(SupportConversation::getAssignedAgentId)
                    .or()
                    .eq(SupportConversation::getAssignedAgentId, agentUserId));
        }
        return conversationMapper.selectList(wrapper).stream()
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

    @Transactional
    public SupportMessageResponse sendMessage(Long actorUserId, Long conversationId, SupportMessageRequest request) {
        String content = request == null ? null : trimToNull(request.getContent());
        if (content == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "消息内容不能为空");
        }
        User actor = requireActiveUser(actorUserId);
        SupportConversation conversation = requireVisibleConversation(actorUserId, conversationId);
        String senderType = isSupportRole(actor.getRole()) ? "AGENT" : "USER";
        SupportMessage message = insertMessage(conversation.getId(), actorUserId, senderType, content);
        conversation.setLastMessage(content);
        if ("AGENT".equals(senderType) && conversation.getAssignedAgentId() == null) {
            conversation.setAssignedAgentId(actorUserId);
            conversation.setSourceType(SOURCE_HUMAN);
            conversation.setStatus(STATUS_ASSIGNED);
        }
        conversationMapper.updateById(conversation);

        if ("USER".equals(senderType) && SOURCE_AI.equals(conversation.getSourceType()) && conversation.getAssignedAgentId() == null) {
            String answer = supportAiService.answer(content);
            insertMessage(conversation.getId(), null, "AI", answer);
            conversation.setLastMessage(answer);
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
        conversationMapper.updateById(conversation);
        insertMessage(conversation.getId(), null, "SYSTEM", "已为你转接人工客服，请保持页面打开。");
        return toConversationResponse(conversation);
    }

    @Transactional
    public SupportConversationResponse claim(Long agentUserId, Long conversationId) {
        requireSupportOrAdmin(agentUserId);
        SupportConversation conversation = requireConversation(conversationId);
        if (STATUS_CLOSED.equals(conversation.getStatus())) {
            throw new BusinessException(ResultCode.CONFLICT, "已结束的会话不能接入");
        }
        conversation.setAssignedAgentId(agentUserId);
        conversation.setSourceType(SOURCE_HUMAN);
        conversation.setStatus(STATUS_ASSIGNED);
        conversation.setLastMessage("人工客服已接入");
        conversationMapper.updateById(conversation);
        insertMessage(conversation.getId(), agentUserId, "SYSTEM", "人工客服已接入");
        return toConversationResponse(conversation);
    }

    @Transactional
    public SupportConversationResponse close(Long agentUserId, Long conversationId) {
        requireSupportOrAdmin(agentUserId);
        SupportConversation conversation = requireConversation(conversationId);
        conversation.setStatus(STATUS_CLOSED);
        conversation.setClosedAt(LocalDateTime.now());
        conversation.setLastMessage("会话已结束");
        conversationMapper.updateById(conversation);
        insertMessage(conversation.getId(), agentUserId, "SYSTEM", "会话已结束");
        return toConversationResponse(conversation);
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

    private SupportConversationResponse toConversationResponse(SupportConversation conversation) {
        SupportConversationResponse response = new SupportConversationResponse();
        response.setId(conversation.getId());
        response.setUserId(conversation.getUserId());
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

    private SupportMessageResponse toMessageResponse(SupportMessage message) {
        SupportMessageResponse response = new SupportMessageResponse();
        response.setId(message.getId());
        response.setConversationId(message.getConversationId());
        response.setSenderUserId(message.getSenderUserId());
        response.setSenderType(message.getSenderType());
        response.setContent(message.getContent());
        response.setCreateTime(message.getCreateTime());
        return response;
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
