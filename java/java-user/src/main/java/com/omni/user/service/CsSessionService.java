package com.omni.user.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.common.dto.InternalAuthContextResponse;
import com.omni.common.dto.OperationAuditWriteRequest;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.user.dto.CsAuditRequest;
import com.omni.user.dto.CsInternalNoteRequest;
import com.omni.user.dto.CsOrgTreeResponse;
import com.omni.user.dto.CsSessionMessageResponse;
import com.omni.user.dto.CsSessionQuery;
import com.omni.user.dto.CsSessionResponse;
import com.omni.user.dto.CsTransferRequest;
import com.omni.user.dto.CsUserSessionHistoryResponse;
import com.omni.user.entity.CsAgentMember;
import com.omni.user.entity.CsSessionAudit;
import com.omni.user.entity.CsSkillGroup;
import com.omni.user.entity.SupportConversation;
import com.omni.user.entity.SupportConversationAudit;
import com.omni.user.entity.SupportConversationNote;
import com.omni.user.entity.SupportMessage;
import com.omni.user.entity.User;
import com.omni.user.mapper.CsAgentMemberMapper;
import com.omni.user.mapper.CsSessionAuditMapper;
import com.omni.user.mapper.CsSkillGroupMapper;
import com.omni.user.mapper.SupportConversationAuditMapper;
import com.omni.user.mapper.SupportConversationMapper;
import com.omni.user.mapper.SupportConversationNoteMapper;
import com.omni.user.mapper.SupportMessageMapper;
import com.omni.user.mapper.SupportAccountMapper;
import com.omni.user.mapper.UserMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class CsSessionService {
    private static final String ROLE_SUPPORT = "support";
    private static final String ROLE_ADMIN = "admin";
    private static final String STATUS_OPEN = "OPEN";
    private static final String STATUS_WAITING_AGENT = "WAITING_AGENT";
    private static final String STATUS_ASSIGNED = "ASSIGNED";
    private static final String STATUS_CLOSE_REQUESTED = "CLOSE_REQUESTED";
    private static final String STATUS_CLOSED = "CLOSED";

    private final CsSkillGroupMapper groupMapper;
    private final CsAgentMemberMapper memberMapper;
    private final CsSessionAuditMapper sessionAuditMapper;
    private final SupportConversationMapper conversationMapper;
    private final SupportMessageMapper messageMapper;
    private final SupportConversationAuditMapper conversationAuditMapper;
    private final SupportConversationNoteMapper noteMapper;
    private final SupportAccountMapper supportAccountMapper;
    private final UserMapper userMapper;
    private final RbacService rbacService;
    private final OperationAuditService operationAuditService;

    public CsSessionService(CsSkillGroupMapper groupMapper,
                            CsAgentMemberMapper memberMapper,
                            CsSessionAuditMapper sessionAuditMapper,
                            SupportConversationMapper conversationMapper,
                            SupportMessageMapper messageMapper,
                            SupportConversationAuditMapper conversationAuditMapper,
                            SupportConversationNoteMapper noteMapper,
                            SupportAccountMapper supportAccountMapper,
                            UserMapper userMapper,
                            RbacService rbacService,
                            OperationAuditService operationAuditService) {
        this.groupMapper = groupMapper;
        this.memberMapper = memberMapper;
        this.sessionAuditMapper = sessionAuditMapper;
        this.conversationMapper = conversationMapper;
        this.messageMapper = messageMapper;
        this.conversationAuditMapper = conversationAuditMapper;
        this.noteMapper = noteMapper;
        this.supportAccountMapper = supportAccountMapper;
        this.userMapper = userMapper;
        this.rbacService = rbacService;
        this.operationAuditService = operationAuditService;
    }

    public CsOrgTreeResponse getOrgTree(Long actorUserId) {
        Access access = requireView(actorUserId);
        List<CsSkillGroup> groups = safeList(groupMapper.selectList(new LambdaQueryWrapper<>()));
        if (access.manager && !access.globalManager) {
            groups = groups.stream()
                    .filter(item -> item.getId() != null && access.leaderGroupIds.contains(item.getId()))
                    .collect(Collectors.toList());
        }
        List<CsAgentMember> members = safeList(memberMapper.selectList(new LambdaQueryWrapper<>()));
        List<SupportConversation> conversations = visibleConversations(access, safeList(
                conversationMapper.selectList(new LambdaQueryWrapper<>())));
        LocalDateTime now = LocalDateTime.now();

        CsOrgTreeResponse response = new CsOrgTreeResponse();
        response.setActiveCount(conversations.stream().filter(this::isActive).count());
        response.setTotalCount(conversations.stream().filter(this::isClosed).count());
        response.setPublicPoolCount(conversations.stream().filter(this::isPublicPool).count());
        response.setPublicPoolTimeoutCount(conversations.stream()
                .filter(this::isPublicPool)
                .filter(item -> isSlaTimeout(item, now))
                .count());
        response.setAiResolvedCount(conversations.stream()
                .filter(item -> "AI".equals(item.getSourceType()) && STATUS_CLOSED.equals(item.getStatus()))
                .count());
        response.setAiHumanCount(conversations.stream()
                .filter(item -> "AI".equals(item.getSourceType()) && !STATUS_CLOSED.equals(item.getStatus()))
                .count());

        Map<Long, List<CsAgentMember>> membersByGroup = members.stream()
                .collect(Collectors.groupingBy(CsAgentMember::getGroupId));
        Map<Long, CsSkillGroup> groupsById = groups.stream()
                .filter(item -> item.getId() != null)
                .collect(Collectors.toMap(CsSkillGroup::getId, item -> item, (left, right) -> left));
        List<CsOrgTreeResponse.Group> groupResponses = new ArrayList<>();
        for (CsSkillGroup group : groups) {
            if (!Integer.valueOf(1).equals(group.getStatus())) continue;
            CsOrgTreeResponse.Group groupResponse = new CsOrgTreeResponse.Group();
            groupResponse.setId(group.getId());
            groupResponse.setGroupCode(group.getGroupCode());
            groupResponse.setGroupName(group.getGroupName());
            groupResponse.setLeaderUserId(group.getLeaderUserId());
            groupResponse.setLeaderName(displayName(group.getLeaderUserId()));
            groupResponse.setActiveCount(conversations.stream()
                    .filter(item -> same(group.getId(), item.getSkillGroupId())
                            && isActive(item)).count());
            groupResponse.setTotalCount(conversations.stream()
                    .filter(item -> same(group.getId(), item.getSkillGroupId()) && isClosed(item)).count());
            groupResponse.setWaitingCount(conversations.stream()
                    .filter(item -> same(group.getId(), item.getSkillGroupId()) && isPublicPool(item)).count());
            groupResponse.setOverdueCount(conversations.stream()
                    .filter(item -> same(group.getId(), item.getSkillGroupId()) && isSlaTimeout(item, now)).count());

            List<CsOrgTreeResponse.Agent> agentResponses = new ArrayList<>();
            for (CsAgentMember member : membersByGroup.getOrDefault(group.getId(), Collections.emptyList())) {
                CsOrgTreeResponse.Agent agent = new CsOrgTreeResponse.Agent();
                agent.setUserId(member.getUserId());
                agent.setAgentName(StringUtils.hasText(member.getAgentName())
                        ? member.getAgentName() : displayName(member.getUserId()));
                agent.setAgentStatus(member.getAgentStatus());
                agent.setActiveSessionCount(conversations.stream()
                        .filter(item -> same(member.getUserId(), item.getAssignedAgentId()) && isActive(item)).count());
                agent.setTotalCount(conversations.stream()
                        .filter(item -> same(member.getUserId(), item.getAssignedAgentId()) && isClosed(item)).count());
                agentResponses.add(agent);
            }
            groupResponse.setAgents(agentResponses);
            groupResponses.add(groupResponse);
        }
        response.setGroups(groupResponses);
        return response;
    }

    public List<CsUserSessionHistoryResponse> listUserSessionHistory(Long actorUserId, Long userId) {
        Access access = requireView(actorUserId);
        if (userId == null) throw new BusinessException(ResultCode.BAD_REQUEST, "用户ID不能为空");
        LambdaQueryWrapper<SupportConversation> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SupportConversation::getUserId, userId);
        applyVisibility(wrapper, access);
        wrapper.orderByDesc(SupportConversation::getCreateTime)
                .orderByDesc(SupportConversation::getId);
        Set<Long> auditedIds = access.reviewer && !access.manager
                ? allAuditedSessionIds() : Collections.emptySet();
        return safeList(conversationMapper.selectList(wrapper))
                .stream()
                .filter(item -> isHistoryVisible(access, item, auditedIds))
                .sorted((left, right) -> {
                    LocalDateTime leftTime = left.getCreateTime();
                    LocalDateTime rightTime = right.getCreateTime();
                    if (leftTime == null && rightTime != null) return 1;
                    if (leftTime != null && rightTime == null) return -1;
                    if (leftTime != null && rightTime != null) {
                        int compared = rightTime.compareTo(leftTime);
                        if (compared != 0) return compared;
                    }
                    Long leftId = left.getId();
                    Long rightId = right.getId();
                    if (leftId == null && rightId != null) return 1;
                    if (leftId != null && rightId == null) return -1;
                    if (leftId == null) return 0;
                    return rightId.compareTo(leftId);
                })
                .map(this::toHistoryResponse)
                .collect(Collectors.toList());
    }

    private boolean isHistoryVisible(Access access, SupportConversation item, Set<Long> auditedIds) {
        if (access.globalManager) return true;
        if (access.manager) {
            return item.getSkillGroupId() != null && access.leaderGroupIds.contains(item.getSkillGroupId());
        }
        if (access.reviewer) {
            return isClosed(item) && (item.getId() == null || !auditedIds.contains(item.getId()));
        }
        return same(access.actorId, item.getAssignedAgentId()) || isPublicPool(item);
    }

    public String mapStatus(String status, boolean hasAudit) {
        if (STATUS_CLOSED.equals(status)) return hasAudit ? "CLOSED" : "NEED_AUDIT";
        return "ACTIVE";
    }

    public SupportConversation requireVisibleConversation(Long actorUserId, Long sessionId) {
        Access access = requireView(actorUserId);
        return requireVisibleConversation(access, sessionId);
    }

    public Page<CsSessionResponse> listSessions(Long actorUserId, CsSessionQuery query) {
        Access access = requireView(actorUserId);
        CsSessionQuery effective = query == null ? new CsSessionQuery() : query;
        int page = normalizePage(effective.getPage());
        int size = normalizeSize(effective.getSize());
        LambdaQueryWrapper<SupportConversation> wrapper = new LambdaQueryWrapper<>();
        applyVisibility(wrapper, access);
        if (effective.getGroupId() != null) wrapper.eq(SupportConversation::getSkillGroupId, effective.getGroupId());
        if (effective.getAgentId() != null) wrapper.eq(SupportConversation::getAssignedAgentId, effective.getAgentId());
        if (Boolean.TRUE.equals(effective.getUnassignedOnly())) {
            wrapper.isNull(SupportConversation::getAssignedAgentId);
        }
        String sourceType = trimToNull(effective.getSourceType());
        if (sourceType != null) wrapper.eq(SupportConversation::getSourceType, sourceType);
        String status = trimToNull(effective.getStatus());
        if (!access.manager && access.reviewer) {
            status = "NEED_AUDIT";
        }
        boolean needAudit = "NEED_AUDIT".equals(status);
        if ("CLOSED".equals(status) || needAudit) {
            wrapper.eq(SupportConversation::getStatus, STATUS_CLOSED);
        } else {
            wrapper.ne(SupportConversation::getStatus, STATUS_CLOSED);
        }
        if (needAudit) {
            Set<Long> auditedIds = allAuditedSessionIds();
            if (!auditedIds.isEmpty()) {
                wrapper.notIn(SupportConversation::getId, auditedIds);
            }
        }
        if (Boolean.TRUE.equals(effective.getSlaTimeoutOnly())) {
            wrapper.eq(SupportConversation::getSlaTimeoutFlag, true);
        }
        String keyword = trimToNull(effective.getKeyword());
        if (keyword != null) {
            wrapper.and(item -> item.like(SupportConversation::getSubject, keyword)
                    .or().like(SupportConversation::getLastMessage, keyword)
                    .or().eq(SupportConversation::getUserId, parseLong(keyword)));
        }
        applySort(wrapper, effective.getSort());

        Page<SupportConversation> source = conversationMapper.selectPage(new Page<>(page, size), wrapper);
        List<SupportConversation> records = source == null ? Collections.emptyList() : source.getRecords();
        Set<Long> auditedIds = auditedSessionIds(records);
        final String resultStatus = status;
        List<CsSessionResponse> converted = records.stream()
                .map(item -> toResponse(item, auditedIds.contains(item.getId())))
                .filter(item -> !"NEED_AUDIT".equals(resultStatus) || Boolean.TRUE.equals(item.getNeedAudit()))
                .collect(Collectors.toList());
        Page<CsSessionResponse> result = new Page<>(page, size, source == null ? 0 : source.getTotal());
        result.setRecords(converted);
        return result;
    }

    public List<CsSessionMessageResponse> listMessages(Long actorUserId, Long sessionId) {
        Access access = requireView(actorUserId);
        SupportConversation conversation = requireVisibleConversation(access, sessionId);
        return safeList(messageMapper.selectList(new LambdaQueryWrapper<SupportMessage>()
                .eq(SupportMessage::getConversationId, conversation.getId())
                .orderByAsc(SupportMessage::getId))).stream().map(this::toMessage).collect(Collectors.toList());
    }

    @Transactional
    public CsSessionResponse claim(Long actorUserId, Long sessionId) {
        Access access = requireView(actorUserId);
        SupportConversation conversation = requireVisibleConversation(access, sessionId);
        if (!isPublicPool(conversation)) {
            throw new BusinessException(ResultCode.CONFLICT, "当前会话不在公共待认领池");
        }
        conversation.setAssignedAgentId(actorUserId);
        conversation.setStatus(STATUS_ASSIGNED);
        conversation.setSourceType("HUMAN");
        conversation.setUpdateTime(LocalDateTime.now());
        conversationMapper.updateById(conversation);
        insertSystemEvent(conversation, actorUserId, "客服已认领会话");
        writeOperationAudit(actorUserId, "CS_SESSION_CLAIM", sessionId, "认领公共待认领会话", "认领成功");
        return toResponse(conversation, false);
    }

    @Transactional
    public CsSessionResponse transfer(Long actorUserId, Long sessionId, CsTransferRequest request) {
        Access access = requireManage(actorUserId);
        String note = request == null ? null : trimToNull(request.getTransferNote());
        if (request == null || request.getTargetGroupId() == null || request.getTargetAgentId() == null || note == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "请选择目标技能组、目标坐席并填写转接附言");
        }
        SupportConversation conversation = requireVisibleConversation(access, sessionId);
        CsSkillGroup group = groupMapper.selectById(request.getTargetGroupId());
        CsAgentMember member = memberMapper.selectOne(new LambdaQueryWrapper<CsAgentMember>()
                .eq(CsAgentMember::getGroupId, request.getTargetGroupId())
                .eq(CsAgentMember::getUserId, request.getTargetAgentId()));
        if (group == null || !Integer.valueOf(1).equals(group.getStatus()) || member == null
                || !Integer.valueOf(1).equals(member.getAgentStatus())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "目标技能组或坐席不可接待");
        }
        String fromStatus = conversation.getStatus();
        conversation.setSkillGroupId(request.getTargetGroupId());
        conversation.setAssignedAgentId(request.getTargetAgentId());
        conversation.setSourceType("HUMAN");
        conversation.setStatus(STATUS_ASSIGNED);
        conversation.setUpdateTime(LocalDateTime.now());
        conversationMapper.updateById(conversation);
        insertSystemEvent(conversation, actorUserId, "会话已转接至" + group.getGroupName() + "，附言：" + note);
        writeConversationAudit(sessionId, actorUserId, "TRANSFERRED", fromStatus, STATUS_ASSIGNED, note);
        writeOperationAudit(actorUserId, "CS_SESSION_TRANSFER", sessionId, note, "转接成功");
        return toResponse(conversation, false);
    }

    @Transactional
    public CsSessionResponse escalate(Long actorUserId, Long sessionId, String reason) {
        Access access = requireManage(actorUserId);
        SupportConversation conversation = requireVisibleConversation(access, sessionId);
        String detail = trimToNull(reason);
        conversation.setEscalatedToAdmin(true);
        conversation.setEscalationReason(detail);
        conversation.setEscalatedAt(LocalDateTime.now());
        conversation.setUpdateTime(LocalDateTime.now());
        conversationMapper.updateById(conversation);
        insertSystemEvent(conversation, actorUserId, detail == null ? "会话已升级工单" : "会话已升级工单：" + detail);
        writeOperationAudit(actorUserId, "CS_SESSION_ESCALATE", sessionId,
                detail == null ? "升级疑难客诉" : detail, "升级成功");
        return toResponse(conversation, false);
    }

    @Transactional
    public CsSessionResponse audit(Long actorUserId, Long sessionId, CsAuditRequest request) {
        Access access = requireManage(actorUserId);
        if (request == null || request.getScore() == null || request.getScore() < 1 || request.getScore() > 5) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "质检评分必须为1至5分");
        }
        SupportConversation conversation = requireVisibleConversation(access, sessionId);
        CsSessionAudit audit = new CsSessionAudit();
        audit.setSessionId(sessionId);
        audit.setAuditorUserId(actorUserId);
        audit.setScore(request.getScore());
        audit.setComments(trimToNull(request.getComments()));
        audit.setIsResolved(request.getIsResolved() == null || request.getIsResolved());
        audit.setCreateTime(LocalDateTime.now());
        sessionAuditMapper.insert(audit);
        writeOperationAudit(actorUserId, "CS_SESSION_QUALITY_AUDIT", sessionId,
                audit.getComments(), "质检评分：" + request.getScore());
        return toResponse(conversation, true);
    }

    @Transactional
    public CsInternalNoteRequest addInternalNote(Long actorUserId, Long sessionId, CsInternalNoteRequest request) {
        Access access = requireView(actorUserId);
        requireVisibleConversation(access, sessionId);
        String content = request == null ? null : trimToNull(request.getContent());
        if (content == null || content.length() > 500) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "内部备注不能为空且不能超过500字");
        }
        SupportConversationNote note = new SupportConversationNote();
        note.setConversationId(sessionId);
        note.setAuthorUserId(actorUserId);
        note.setContent(content);
        note.setCreateTime(LocalDateTime.now());
        noteMapper.insert(note);
        return request;
    }

    private Access requireView(Long actorUserId) {
        if (actorUserId == null) throw new BusinessException(ResultCode.UNAUTHORIZED);
        User user = userMapper.selectById(actorUserId);
        if (user == null || Integer.valueOf(0).equals(user.getStatus())
                || (!ROLE_SUPPORT.equals(user.getRole()) && !ROLE_ADMIN.equals(user.getRole()))) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权限查看客服会话");
        }
        InternalAuthContextResponse auth = rbacService.getInternalAuthContext(actorUserId);
        List<String> permissions = auth == null || auth.getPermissionCodes() == null
                ? Collections.emptyList() : auth.getPermissionCodes();
        boolean globalManager = ROLE_ADMIN.equals(user.getRole())
                || "platform_super_admin".equals(auth == null ? null : auth.getEffectiveRole())
                || permissions.contains("cs.manage");
        boolean teamLeader = "support_manager".equals(auth == null ? null : auth.getEffectiveRole());
        boolean manager = globalManager || teamLeader;
        boolean reviewer = manager || permissions.contains("cs.review");
        if (!manager && !reviewer && !permissions.contains("support.conversation.view")) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权限查看客服会话");
        }
        List<Long> leaderGroupIds = teamLeader && !globalManager
                ? safeList(groupMapper.selectList(new LambdaQueryWrapper<CsSkillGroup>()
                .eq(CsSkillGroup::getLeaderUserId, actorUserId)
                .eq(CsSkillGroup::getStatus, 1))).stream()
                .map(CsSkillGroup::getId)
                .filter(item -> item != null)
                .collect(Collectors.toList())
                : Collections.emptyList();
        return new Access(actorUserId, manager, reviewer, globalManager, leaderGroupIds);
    }

    private Access requireManage(Long actorUserId) {
        Access access = requireView(actorUserId);
        if (!access.manager) throw new BusinessException(ResultCode.FORBIDDEN, "无权限执行客服管理操作");
        return access;
    }

    private SupportConversation requireVisibleConversation(Access access, Long sessionId) {
        if (sessionId == null) throw new BusinessException(ResultCode.BAD_REQUEST, "客服会话ID不能为空");
        SupportConversation conversation = conversationMapper.selectById(sessionId);
        if (conversation == null) throw new BusinessException(ResultCode.NOT_FOUND, "客服会话不存在");
        if (!access.manager && access.reviewer
                && (!STATUS_CLOSED.equals(conversation.getStatus())
                || allAuditedSessionIds().contains(conversation.getId()))) {
            throw new BusinessException(ResultCode.FORBIDDEN, "该会话不在待主管质检队列");
        }
        if (access.manager && !access.globalManager
                && (conversation.getSkillGroupId() == null
                || !access.leaderGroupIds.contains(conversation.getSkillGroupId()))) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权查看该客服会话");
        }
        if (!access.manager && !access.reviewer
                && !same(access.actorId, conversation.getAssignedAgentId())
                && !isPublicPool(conversation)) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权查看该客服会话");
        }
        return conversation;
    }

    private List<SupportConversation> visibleConversations(Access access, List<SupportConversation> source) {
        if (access.globalManager) return source;
        if (access.manager) {
            return source.stream()
                    .filter(item -> item.getSkillGroupId() != null
                            && access.leaderGroupIds.contains(item.getSkillGroupId()))
                    .collect(Collectors.toList());
        }
        if (access.reviewer) {
            Set<Long> auditedIds = auditedSessionIds(source);
            return source.stream()
                    .filter(item -> STATUS_CLOSED.equals(item.getStatus()))
                    .filter(item -> item.getId() == null || !auditedIds.contains(item.getId()))
                    .collect(Collectors.toList());
        }
        return source.stream().filter(item -> same(access.actorId, item.getAssignedAgentId()) || isPublicPool(item))
                .collect(Collectors.toList());
    }

    private void applyVisibility(LambdaQueryWrapper<SupportConversation> wrapper, Access access) {
        if (access.globalManager) return;
        if (access.manager) {
            if (access.leaderGroupIds.isEmpty()) {
                wrapper.eq(SupportConversation::getSkillGroupId, -1L);
            } else {
                wrapper.in(SupportConversation::getSkillGroupId, access.leaderGroupIds);
            }
            return;
        }
        if (access.reviewer) {
            wrapper.eq(SupportConversation::getStatus, STATUS_CLOSED);
            return;
        }
        wrapper.and(item -> item.eq(SupportConversation::getAssignedAgentId, access.actorId)
                .or(inner -> inner.eq(SupportConversation::getStatus, STATUS_WAITING_AGENT)
                        .isNull(SupportConversation::getAssignedAgentId)));
    }

    private void applySort(LambdaQueryWrapper<SupportConversation> wrapper, String sort) {
        if ("sla_waiting".equals(sort)) {
            wrapper.orderByDesc(SupportConversation::getSlaTimeoutFlag)
                    .orderByDesc(SupportConversation::getLastUserMessageAt);
        } else {
            wrapper.orderByDesc(SupportConversation::getUpdateTime)
                    .orderByDesc(SupportConversation::getId);
        }
    }

    private Set<Long> auditedSessionIds(List<SupportConversation> records) {
        if (records.isEmpty()) return Collections.emptySet();
        List<Long> ids = records.stream().map(SupportConversation::getId).filter(item -> item != null).collect(Collectors.toList());
        return new HashSet<>(safeList(sessionAuditMapper.selectList(new LambdaQueryWrapper<CsSessionAudit>()
                .in(CsSessionAudit::getSessionId, ids))).stream()
                .map(CsSessionAudit::getSessionId).collect(Collectors.toList()));
    }

    private Set<Long> allAuditedSessionIds() {
        return new HashSet<>(safeList(sessionAuditMapper.selectList(new LambdaQueryWrapper<CsSessionAudit>()))
                .stream()
                .map(CsSessionAudit::getSessionId)
                .filter(item -> item != null)
                .collect(Collectors.toList()));
    }

    private CsSessionResponse toResponse(SupportConversation source, boolean audited) {
        CsSessionResponse response = new CsSessionResponse();
        response.setId(source.getId());
        response.setUserId(source.getUserId());
        User user = source.getUserId() == null ? null : userMapper.selectById(source.getUserId());
        response.setUserNickname(user == null ? null : user.getNickname());
        response.setUserPhoneMask(maskPhone(user == null ? null : user.getPhone()));
        response.setSubject(source.getSubject());
        response.setStatus(mapStatus(source.getStatus(), audited));
        response.setSourceType(source.getSourceType());
        response.setAssignedAgentId(source.getAssignedAgentId());
        response.setAssignedAgentName(displayName(source.getAssignedAgentId()));
        response.setSkillGroupId(source.getSkillGroupId());
        response.setSkillGroupName(groupName(source.getSkillGroupId()));
        response.setLastMessage(source.getLastMessage());
        response.setCreateTime(source.getCreateTime());
        response.setUpdateTime(source.getUpdateTime());
        response.setClosedAt(source.getClosedAt());
        response.setSlaTimeoutFlag(Boolean.TRUE.equals(source.getSlaTimeoutFlag()));
        response.setSlaOverdue(isSlaTimeout(source, LocalDateTime.now()));
        response.setUserWaitingSeconds(waitingSeconds(source, LocalDateTime.now()));
        response.setNeedAudit(STATUS_CLOSED.equals(source.getStatus()) && !audited);
        response.setLatestAuditScore(latestAuditScore(source.getId()));
        response.setEscalatedToAdmin(Boolean.TRUE.equals(source.getEscalatedToAdmin()));
        return response;
    }

    private Integer latestAuditScore(Long sessionId) {
        if (sessionId == null) return null;
        CsSessionAudit audit = sessionAuditMapper.selectOne(new LambdaQueryWrapper<CsSessionAudit>()
                .eq(CsSessionAudit::getSessionId, sessionId)
                .orderByDesc(CsSessionAudit::getCreateTime)
                .last("LIMIT 1"));
        return audit == null ? null : audit.getScore();
    }

    private CsSessionMessageResponse toMessage(SupportMessage source) {
        CsSessionMessageResponse response = new CsSessionMessageResponse();
        response.setId(source.getId());
        response.setSessionId(source.getConversationId());
        response.setSenderUserId(source.getSenderUserId());
        response.setSenderType(source.getSenderType());
        response.setSenderDisplayName("AI".equals(source.getSenderType()) ? "AI 客服"
                : "SYSTEM".equals(source.getSenderType()) ? "系统" : displayName(source.getSenderUserId()));
        response.setContent(source.getContent());
        response.setCreateTime(source.getCreateTime());
        return response;
    }

    private void insertSystemEvent(SupportConversation conversation, Long actorUserId, String content) {
        SupportMessage message = new SupportMessage();
        message.setConversationId(conversation.getId());
        message.setSenderUserId(actorUserId);
        message.setSenderType("SYSTEM");
        message.setContent(content);
        message.setCreateTime(LocalDateTime.now());
        messageMapper.insert(message);
        conversation.setLastMessage(content);
        conversation.setUpdateTime(LocalDateTime.now());
        conversationMapper.updateById(conversation);
    }

    private void writeConversationAudit(Long sessionId, Long actorUserId, String action,
                                       String fromStatus, String toStatus, String detail) {
        SupportConversationAudit audit = new SupportConversationAudit();
        audit.setConversationId(sessionId);
        audit.setActorUserId(actorUserId);
        audit.setAction(action);
        audit.setFromStatus(fromStatus);
        audit.setToStatus(toStatus);
        audit.setDetail(detail);
        audit.setCreateTime(LocalDateTime.now());
        conversationAuditMapper.insert(audit);
    }

    private void writeOperationAudit(Long actorUserId, String action, Long sessionId, String reason, String result) {
        OperationAuditWriteRequest request = new OperationAuditWriteRequest();
        request.setOperatorId(actorUserId);
        InternalAuthContextResponse auth = rbacService.getInternalAuthContext(actorUserId);
        request.setOperatorRole(auth == null || !StringUtils.hasText(auth.getEffectiveRole())
                ? "unknown" : auth.getEffectiveRole());
        request.setAction(action);
        request.setTargetType("cs_session");
        request.setTargetId(sessionId);
        request.setTargetRef("客服会话-" + sessionId);
        request.setReason(reason);
        request.setResult(result);
        request.setSuccess(true);
        operationAuditService.write(request);
    }

    private boolean isPublicPool(SupportConversation item) {
        return item != null && STATUS_WAITING_AGENT.equals(item.getStatus()) && item.getAssignedAgentId() == null;
    }

    private boolean isActive(SupportConversation item) {
        return item != null && !STATUS_CLOSED.equals(item.getStatus());
    }

    private boolean isClosed(SupportConversation item) {
        return item != null && STATUS_CLOSED.equals(item.getStatus());
    }

    private CsUserSessionHistoryResponse toHistoryResponse(SupportConversation source) {
        CsUserSessionHistoryResponse response = new CsUserSessionHistoryResponse();
        response.setSessionId(source.getId());
        response.setCreatedAt(source.getCreateTime());
        response.setAgentName(displayName(source.getAssignedAgentId()));
        response.setCategory(source.getSubject());
        response.setStatus(isClosed(source) ? STATUS_CLOSED : "ACTIVE");
        response.setClosedAt(source.getClosedAt());
        response.setCloseReason(StringUtils.hasText(source.getCloseRequestReason())
                ? source.getCloseRequestReason() : source.getEscalationReason());
        return response;
    }

    private boolean isSlaTimeout(SupportConversation item, LocalDateTime now) {
        if (item == null || STATUS_CLOSED.equals(item.getStatus())) return false;
        if (Boolean.TRUE.equals(item.getSlaTimeoutFlag())) return true;
        Long waiting = waitingSeconds(item, now);
        return waiting != null && waiting >= 180;
    }

    private Long waitingSeconds(SupportConversation item, LocalDateTime now) {
        if (item == null || item.getLastUserMessageAt() == null) return null;
        if (item.getLastAgentMessageAt() != null && !item.getLastUserMessageAt().isAfter(item.getLastAgentMessageAt())) {
            return 0L;
        }
        return Math.max(0L, Duration.between(item.getLastUserMessageAt(), now).getSeconds());
    }

    private String groupName(Long groupId) {
        if (groupId == null) return null;
        CsSkillGroup group = groupMapper.selectById(groupId);
        return group == null ? null : group.getGroupName();
    }

    private String displayName(Long userId) {
        if (userId == null) return null;
        User user = userMapper.selectById(userId);
        if (user == null) return "用户 " + userId;
        if (StringUtils.hasText(user.getNickname())) return user.getNickname();
        return maskPhone(user.getPhone());
    }

    private String maskPhone(String phone) {
        if (!StringUtils.hasText(phone)) return null;
        String value = phone.trim();
        return value.length() < 7 ? "****" : value.substring(0, 3) + "****" + value.substring(value.length() - 4);
    }

    private static boolean same(Long left, Long right) {
        return left != null && left.equals(right);
    }

    private static <T> List<T> safeList(List<T> values) {
        return values == null ? Collections.emptyList() : values;
    }

    private static String trimToNull(String value) {
        if (!StringUtils.hasText(value)) return null;
        return value.trim();
    }

    private static Long parseLong(String value) {
        try { return Long.valueOf(value); } catch (NumberFormatException ignored) { return -1L; }
    }

    private static int normalizePage(Integer value) {
        return value == null || value < 1 ? 1 : value;
    }

    private static int normalizeSize(Integer value) {
        return value == null || value < 1 ? 30 : Math.min(value, 100);
    }

    private static class Access {
        private final Long actorId;
        private final boolean manager;
        private final boolean reviewer;
        private final boolean globalManager;
        private final List<Long> leaderGroupIds;

        private Access(Long actorId, boolean manager, boolean reviewer, boolean globalManager, List<Long> leaderGroupIds) {
            this.actorId = actorId;
            this.manager = manager;
            this.reviewer = reviewer;
            this.globalManager = globalManager;
            this.leaderGroupIds = leaderGroupIds;
        }
    }
}
