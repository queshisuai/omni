package com.omni.user.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.user.dto.SupportContextResponse;
import com.omni.user.dto.SupportCopilotContext;
import com.omni.user.entity.SupportConversation;
import com.omni.user.entity.SupportMessage;
import com.omni.user.mapper.SupportConversationMapper;
import com.omni.user.mapper.SupportMessageMapper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class SupportCopilotContextService {
    private static final int MESSAGE_LIMIT = 50;
    private final SupportConversationMapper conversationMapper;
    private final SupportMessageMapper messageMapper;
    private final SupportContextService supportContextService;
    private final ObjectMapper objectMapper;

    public SupportCopilotContextService(SupportConversationMapper conversationMapper,
                                        SupportMessageMapper messageMapper,
                                        SupportContextService supportContextService,
                                        ObjectMapper objectMapper) {
        this.conversationMapper = conversationMapper;
        this.messageMapper = messageMapper;
        this.supportContextService = supportContextService;
        this.objectMapper = objectMapper;
    }

    public SupportCopilotContext build(Long actorUserId, Long conversationId) {
        SupportConversation conversation = conversationMapper.selectById(conversationId);
        if (conversation == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "客服会话不存在");
        }
        List<SupportMessage> latestMessages = safeList(messageMapper.selectList(new LambdaQueryWrapper<SupportMessage>()
                .eq(SupportMessage::getConversationId, conversationId)
                .orderByDesc(SupportMessage::getId)
                .last("LIMIT 1")));
        Long cutoff = latestMessages.isEmpty() ? null : latestMessages.get(0).getId();

        List<SupportMessage> publicMessages = safeList(messageMapper.selectList(new LambdaQueryWrapper<SupportMessage>()
                .eq(SupportMessage::getConversationId, conversationId)
                .in(SupportMessage::getSenderType, "USER", "AI", "AGENT")
                .orderByDesc(SupportMessage::getId)
                .last("LIMIT " + MESSAGE_LIMIT)));
        if (publicMessages.isEmpty()) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "客服会话暂无可用消息");
        }
        publicMessages = new ArrayList<>(publicMessages.subList(0, Math.min(MESSAGE_LIMIT, publicMessages.size())));
        Collections.reverse(publicMessages);

        SupportContextResponse businessContext = supportContextService.getContext(actorUserId, conversationId);
        Map<String, String> facts = SupportCopilotFactCatalog.snapshot(businessContext);
        SupportCopilotContext result = new SupportCopilotContext();
        result.setConversationId(conversationId);
        result.setMessageCutoff(cutoff);
        result.setConversation(conversation);
        result.setBusinessContext(businessContext);
        result.setFacts(facts);
        List<SupportCopilotContext.SupportCopilotMessage> messages = new ArrayList<>();
        for (SupportMessage source : publicMessages) {
            SupportCopilotContext.SupportCopilotMessage message =
                    new SupportCopilotContext.SupportCopilotMessage();
            message.setId(source.getId());
            message.setSenderType(source.getSenderType());
            message.setContent(sanitize(source.getContent()));
            messages.add(message);
        }
        result.setMessages(messages);
        result.setContextDigest(digest(conversation, cutoff, facts));
        return result;
    }

    public Long latestMessageId(Long conversationId) {
        List<SupportMessage> latest = safeList(messageMapper.selectList(new LambdaQueryWrapper<SupportMessage>()
                .eq(SupportMessage::getConversationId, conversationId)
                .orderByDesc(SupportMessage::getId)
                .last("LIMIT 1")));
        return latest.isEmpty() ? null : latest.get(0).getId();
    }

    private String digest(SupportConversation conversation, Long cutoff, Map<String, String> facts) {
        Map<String, Object> source = new LinkedHashMap<>();
        source.put("messageCutoff", cutoff);
        Map<String, Object> businessState = new LinkedHashMap<>();
        businessState.put("status", conversation.getStatus());
        businessState.put("sourceType", conversation.getSourceType());
        businessState.put("subject", conversation.getSubject());
        businessState.put("escalatedToAdmin", conversation.getEscalatedToAdmin());
        businessState.put("escalationReason", conversation.getEscalationReason());
        source.put("conversation", businessState);
        source.put("facts", facts);
        try {
            byte[] bytes = objectMapper.writeValueAsString(source).getBytes(StandardCharsets.UTF_8);
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(bytes);
            StringBuilder hex = new StringBuilder(64);
            for (byte item : digest) hex.append(String.format("%02x", item));
            return hex.toString();
        } catch (Exception e) {
            throw new IllegalStateException("无法生成上下文摘要", e);
        }
    }

    private String sanitize(String content) {
        if (!StringUtils.hasText(content)) return "";
        String value = content;
        value = value.replaceAll("(?i)(password|passwd|token|access_token|internal.api.token)\\s*[:=]\\s*\\S+",
                "$1=[已脱敏]");
        value = value.replaceAll("\\b\\d{18}[0-9Xx]?\\b", "[证件号已脱敏]");
        value = value.replaceAll("\\b1\\d{10}\\b", "[手机号已脱敏]");
        return value;
    }

    private static <T> List<T> safeList(List<T> values) {
        return values == null ? Collections.emptyList() : values;
    }
}
