package com.omni.user.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.omni.ai.client.AiErrorCode;
import com.omni.ai.client.AiCancellationToken;
import com.omni.ai.client.AiModelClient;
import com.omni.ai.client.AiModelException;
import com.omni.ai.dto.AiMessage;
import com.omni.ai.dto.AiRequest;
import com.omni.ai.prompt.PromptTemplate;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.user.dto.*;
import com.omni.user.entity.SupportAiSuggestion;
import com.omni.user.entity.SupportConversation;
import com.omni.user.mapper.SupportAiSuggestionMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class SupportCopilotService {
    private static final String PERMISSION_USE = "support.ai.use";
    private static final String PERMISSION_REVIEW = "support.ai.review";
    private static final String PROMPT_VERSION = "v1";
    private final SupportAiSuggestionMapper suggestionMapper;
    private final CsSessionService csSessionService;
    private final RbacService rbacService;
    private final SupportCopilotContextService contextService;
    private final com.omni.ai.client.AiModelClient aiModelClient;
    private final ObjectMapper objectMapper;
    private final String systemPrompt;

    public SupportCopilotService(SupportAiSuggestionMapper suggestionMapper,
                                 CsSessionService csSessionService,
                                 RbacService rbacService,
                                 SupportCopilotContextService contextService,
                                 AiModelClient aiModelClient,
                                 ObjectMapper objectMapper) {
        this.suggestionMapper = suggestionMapper;
        this.csSessionService = csSessionService;
        this.rbacService = rbacService;
        this.contextService = contextService;
        this.aiModelClient = aiModelClient;
        this.objectMapper = objectMapper;
        this.systemPrompt = PromptTemplate.fromResource(
                SupportCopilotService.class, "/prompts/support-copilot-v1.txt",
                "support-copilot", PROMPT_VERSION, Collections.emptySet()).render(Collections.emptyMap());
    }

    @Transactional(noRollbackFor = BusinessException.class)
    public CsCopilotSuggestionResponse generate(Long actorUserId, Long sessionId) {
        rbacService.requireAnyPermission(actorUserId, PERMISSION_USE);
        SupportConversation conversation = csSessionService.requireVisibleConversation(actorUserId, sessionId);
        SupportCopilotContext context = contextService.build(actorUserId, sessionId);
        SupportAiSuggestion suggestion = new SupportAiSuggestion();
        suggestion.setConversationId(conversation.getId());
        suggestion.setAgentId(actorUserId);
        suggestion.setMessageCutoff(context.getMessageCutoff());
        suggestion.setContextDigest(context.getContextDigest());
            suggestion.setStatus(SupportAiSuggestionStatus.GENERATING.name());
            suggestion.setPromptVersion(PROMPT_VERSION);
            suggestion.setCreateTime(LocalDateTime.now());
            suggestion.setUpdateTime(suggestion.getCreateTime());
            suggestionMapper.insertSuggestion(suggestion);
        try {
            SupportCopilotModelOutput output = callModel(context);
            SupportCopilotFactValidator.validate(output, context.getBusinessContext());
            List<String> factKeys = new ArrayList<>();
            for (SupportCopilotModelOutput.SourceEvidenceItem item : output.getSourceEvidence()) {
                factKeys.add(item.getFactKey());
            }
            List<CsCopilotSourceEvidenceResponse> evidence =
                    SupportCopilotFactCatalog.hydrateEvidence(factKeys, context.getBusinessContext());
            String missingInformation = json(output.getMissingInformation());
            String sourceEvidence = json(evidence);
            int updated = suggestionMapper.markReady(
                    suggestion.getId(), output.getSuggestionText(), output.getSummary(),
                    output.getIssueType(), output.getRecommendedAction(), missingInformation,
                    sourceEvidence, output.getModel(), LocalDateTime.now());
            if (updated == 0 && suggestion.getId() != null) {
                throw new IllegalStateException("AI 建议状态更新失败");
            }
            suggestion.setStatus(SupportAiSuggestionStatus.READY.name());
            suggestion.setSuggestionText(output.getSuggestionText());
            suggestion.setSummary(output.getSummary());
            suggestion.setIssueType(output.getIssueType());
            suggestion.setRecommendedAction(output.getRecommendedAction());
            suggestion.setMissingInformation(missingInformation);
            suggestion.setSourceEvidence(sourceEvidence);
            suggestion.setModel(output.getModel());
            return toResponse(loadOrLocal(suggestion));
        } catch (AiModelException e) {
            fail(suggestion, failureCode(e), publicFailure(e));
            throw new BusinessException(aiHttpCode(e), publicFailure(e));
        } catch (IllegalArgumentException e) {
            fail(suggestion, "INVALID_OUTPUT", "模型输出无法通过校验");
            throw new BusinessException(502, "模型输出无法通过校验");
        } catch (RuntimeException e) {
            fail(suggestion, "AI_FAILURE", "AI 建议生成失败");
            throw new BusinessException(503, "AI 建议暂时不可用");
        }
    }

    @Transactional(noRollbackFor = BusinessException.class)
    public CsCopilotSuggestionResponse accept(Long actorUserId, Long suggestionId) {
        requireActionPermission(actorUserId);
        SupportAiSuggestion suggestion = requireSuggestion(suggestionId);
        csSessionService.requireVisibleConversation(actorUserId, suggestion.getConversationId());
        SupportAiSuggestionStatus.require(suggestion.getStatus());
        if (!SupportAiSuggestionStatus.READY.name().equals(suggestion.getStatus())) {
            throw new BusinessException(ResultCode.CONFLICT, "AI 建议当前不可接受");
        }
        SupportCopilotContext current = contextService.build(actorUserId, suggestion.getConversationId());
        if (!same(current.getMessageCutoff(), suggestion.getMessageCutoff())
                || !same(current.getContextDigest(), suggestion.getContextDigest())) {
            expire(suggestion);
            throw new BusinessException(ResultCode.CONFLICT, "AI 建议已过期");
        }
        int updated = suggestionMapper.transitionToAccepted(
                suggestionId, SupportAiSuggestionStatus.READY.name(),
                SupportAiSuggestionStatus.ACCEPTED.name(), current.getMessageCutoff(),
                current.getContextDigest(), LocalDateTime.now());
        if (updated == 0) {
            expireIfStillCurrent(suggestionId, SupportAiSuggestionStatus.READY.name());
            throw new BusinessException(ResultCode.CONFLICT, "AI 建议已被其他操作处理");
        }
        suggestion.setStatus(SupportAiSuggestionStatus.ACCEPTED.name());
        return toResponse(loadOrLocal(suggestion));
    }

    @Transactional(noRollbackFor = BusinessException.class)
    public CsCopilotSuggestionResponse edit(Long actorUserId, Long suggestionId, CsCopilotEditRequest request) {
        requireActionPermission(actorUserId);
        SupportAiSuggestion suggestion = requireSuggestion(suggestionId);
        csSessionService.requireVisibleConversation(actorUserId, suggestion.getConversationId());
        SupportAiSuggestionStatus.require(suggestion.getStatus());
        if (!SupportAiSuggestionStatus.ACCEPTED.name().equals(suggestion.getStatus())) {
            throw new BusinessException(ResultCode.CONFLICT, "只有已接受的 AI 建议可以编辑");
        }
        String editedText = request == null ? null : request.getEditedText();
        if (!StringUtils.hasText(editedText) || editedText.trim().length() > 5000) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "人工草稿不能为空且不能超过5000字");
        }
        SupportCopilotContext current = contextService.build(actorUserId, suggestion.getConversationId());
        if (!same(current.getMessageCutoff(), suggestion.getMessageCutoff())
                || !same(current.getContextDigest(), suggestion.getContextDigest())) {
            expire(suggestion);
            throw new BusinessException(ResultCode.CONFLICT, "AI 建议已过期");
        }
        int updated = suggestionMapper.transitionToEdited(
                suggestionId, SupportAiSuggestionStatus.ACCEPTED.name(),
                SupportAiSuggestionStatus.ACCEPTED_EDITED.name(), editedText.trim(),
                current.getMessageCutoff(), current.getContextDigest(), LocalDateTime.now());
        if (updated == 0) {
            expireIfStillCurrent(suggestionId, SupportAiSuggestionStatus.ACCEPTED.name());
            throw new BusinessException(ResultCode.CONFLICT, "AI 建议已被其他操作处理");
        }
        suggestion.setStatus(SupportAiSuggestionStatus.ACCEPTED_EDITED.name());
        suggestion.setEditedText(editedText.trim());
        return toResponse(loadOrLocal(suggestion));
    }

    @Transactional(noRollbackFor = BusinessException.class)
    public CsCopilotSuggestionResponse reject(Long actorUserId, Long suggestionId, CsCopilotRejectRequest request) {
        requireActionPermission(actorUserId);
        SupportAiSuggestion suggestion = requireSuggestion(suggestionId);
        csSessionService.requireVisibleConversation(actorUserId, suggestion.getConversationId());
        SupportAiSuggestionStatus.require(suggestion.getStatus());
        if (!SupportAiSuggestionStatus.READY.name().equals(suggestion.getStatus())) {
            throw new BusinessException(ResultCode.CONFLICT, "AI 建议当前不可拒绝");
        }
        String reason = request == null ? null : trim(request.getReason());
        int updated = suggestionMapper.transitionToRejected(
                suggestionId, SupportAiSuggestionStatus.READY.name(),
                SupportAiSuggestionStatus.REJECTED.name(), reason, LocalDateTime.now());
        if (updated == 0) {
            throw new BusinessException(ResultCode.CONFLICT, "AI 建议已被其他操作处理");
        }
        suggestion.setStatus(SupportAiSuggestionStatus.REJECTED.name());
        suggestion.setRejectReason(reason);
        return toResponse(loadOrLocal(suggestion));
    }

    private SupportCopilotModelOutput callModel(SupportCopilotContext context) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("messageCutoff", context.getMessageCutoff());
            payload.put("facts", context.getFacts());
            payload.put("messages", context.getMessages());
            String userPrompt = objectMapper.writeValueAsString(payload);
            com.omni.ai.dto.AiResponse response = aiModelClient.generate(
                    new AiRequest(null, null, systemPrompt,
                            Collections.singletonList(new AiMessage("user", userPrompt)),
                            0.1, 1200, null, schema()), new AiCancellationToken());
            SupportCopilotModelOutput output = SupportCopilotModelOutput.parseStrict(response.getText());
            output.setModel(response.getModel());
            return output;
        } catch (AiModelException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("模型输出无法解析", e);
        }
    }

    private JsonNode schema() {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("type", "object");
        root.put("additionalProperties", false);
        ObjectNode properties = root.putObject("properties");
        properties.putObject("suggestionText").put("type", "string");
        properties.putObject("summary").put("type", "string");
        properties.putObject("issueType").put("type", "string");
        properties.putObject("recommendedAction").put("type", "string");
        properties.putObject("missingInformation").put("type", "array").putObject("items").put("type", "string");
        ObjectNode evidence = properties.putObject("sourceEvidence");
        evidence.put("type", "array");
        ObjectNode evidenceItem = evidence.putObject("items");
        evidenceItem.put("type", "object");
        evidenceItem.put("additionalProperties", false);
        evidenceItem.putObject("properties").putObject("factKey").put("type", "string");
        evidenceItem.putArray("required").add("factKey");
        ArrayNode required = root.putArray("required");
        required.add("suggestionText").add("sourceEvidence");
        return root;
    }

    private void requireActionPermission(Long actorUserId) {
        rbacService.requireAnyPermission(actorUserId, PERMISSION_REVIEW);
    }

    private SupportAiSuggestion requireSuggestion(Long suggestionId) {
        if (suggestionId == null) throw new BusinessException(ResultCode.BAD_REQUEST, "AI 建议ID不能为空");
        SupportAiSuggestion suggestion = suggestionMapper.selectSuggestionById(suggestionId);
        if (suggestion == null) throw new BusinessException(ResultCode.NOT_FOUND, "AI 建议不存在");
        return suggestion;
    }

    private void expire(SupportAiSuggestion suggestion) {
        suggestionMapper.expireIfCurrent(suggestion.getId(), suggestion.getStatus(), LocalDateTime.now());
    }

    private void expireIfStillCurrent(Long suggestionId, String status) {
        suggestionMapper.expireIfCurrent(suggestionId, status, LocalDateTime.now());
    }

    private void fail(SupportAiSuggestion suggestion, String code, String reason) {
        if (suggestion.getId() != null) {
            suggestionMapper.markFailed(suggestion.getId(), code, reason, LocalDateTime.now());
        }
    }

    private SupportAiSuggestion loadOrLocal(SupportAiSuggestion local) {
        SupportAiSuggestion stored = local.getId() == null ? null : suggestionMapper.selectSuggestionById(local.getId());
        return stored == null ? local : stored;
    }

    private CsCopilotSuggestionResponse toResponse(SupportAiSuggestion source) {
        CsCopilotSuggestionResponse response = new CsCopilotSuggestionResponse();
        response.setSuggestionId(source.getId());
        response.setConversationId(source.getConversationId());
        response.setAgentId(source.getAgentId());
        response.setMessageCutoff(source.getMessageCutoff());
        response.setContextDigest(source.getContextDigest());
        response.setStatus(SupportAiSuggestionStatus.require(source.getStatus()));
        response.setSuggestionText(source.getSuggestionText());
        response.setSummary(source.getSummary());
        response.setIssueType(source.getIssueType());
        response.setRecommendedAction(source.getRecommendedAction());
        response.setEditedText(source.getEditedText());
        response.setCreateTime(source.getCreateTime());
        response.setUpdateTime(source.getUpdateTime());
        response.setAcceptedAt(source.getAcceptedAt());
        response.setEditedAt(source.getEditedAt());
        response.setRejectedAt(source.getRejectedAt());
        response.setMissingInformation(readList(source.getMissingInformation(), String.class));
        response.setSourceEvidence(readList(source.getSourceEvidence(), CsCopilotSourceEvidenceResponse.class));
        return response;
    }

    private <T> List<T> readList(String value, Class<T> type) {
        if (!StringUtils.hasText(value)) return new ArrayList<>();
        try {
            return objectMapper.readValue(value, objectMapper.getTypeFactory()
                    .constructCollectionType(List.class, type));
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value == null ? Collections.emptyList() : value);
        } catch (Exception e) {
            throw new IllegalArgumentException("无法保存 AI 建议结构化字段", e);
        }
    }

    private int aiHttpCode(AiModelException e) {
        return e.getCode() == AiErrorCode.TIMEOUT || e.getCode() == AiErrorCode.UNAVAILABLE
                || e.getCode() == AiErrorCode.DISABLED ? 503 : 502;
    }

    private String failureCode(AiModelException e) {
        return e.getCode().name();
    }

    private String publicFailure(AiModelException e) {
        return aiHttpCode(e) == 503 ? "AI 建议暂时不可用" : "AI 模型输出处理失败";
    }

    private static String trim(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private static boolean same(Object left, Object right) {
        return left == null ? right == null : left.equals(right);
    }
}
