package com.omni.user.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.dto.InternalAuthContextResponse;
import com.omni.common.dto.OperationAuditWriteRequest;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.user.dto.OrganizerOpsAssignmentRequest;
import com.omni.user.dto.OrganizerOpsAssignmentResponse;
import com.omni.user.dto.OrganizerOpsFollowUpRequest;
import com.omni.user.dto.OrganizerOpsFollowUpResponse;
import com.omni.user.entity.OrganizerOpsAssignment;
import com.omni.user.entity.OrganizerOpsFollowUp;
import com.omni.user.mapper.OrganizerOpsAssignmentMapper;
import com.omni.user.mapper.OrganizerOpsFollowUpMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class OrganizerOpsService {

    private static final Logger log = LoggerFactory.getLogger(OrganizerOpsService.class);
    private static final String PERMISSION_FOLLOW_MANAGE = "organizer.follow.manage";
    private static final String PERMISSION_ASSIGN_MANAGE = "organizer.assign.manage";
    private static final List<String> RISK_LEVELS = List.of("normal", "watch", "high");
    private static final List<String> STATUSES = List.of("active", "pending_material", "restricted", "inactive");

    private final OrganizerOpsAssignmentMapper assignmentMapper;
    private final OrganizerOpsFollowUpMapper followUpMapper;
    private final RbacService rbacService;
    private final OperationAuditService auditService;

    public OrganizerOpsService(OrganizerOpsAssignmentMapper assignmentMapper,
                               OrganizerOpsFollowUpMapper followUpMapper,
                               RbacService rbacService,
                               OperationAuditService auditService) {
        this.assignmentMapper = assignmentMapper;
        this.followUpMapper = followUpMapper;
        this.rbacService = rbacService;
        this.auditService = auditService;
    }

    public List<OrganizerOpsAssignmentResponse> listAssignments(Long operatorId) {
        requireAnyPermission(operatorId, PERMISSION_FOLLOW_MANAGE, "organizer.review");
        return assignmentMapper.selectList(new LambdaQueryWrapper<OrganizerOpsAssignment>()
                        .orderByAsc(OrganizerOpsAssignment::getNextFollowAt)
                        .orderByDesc(OrganizerOpsAssignment::getUpdateTime)
                        .orderByDesc(OrganizerOpsAssignment::getOrganizerUserId))
                .stream()
                .map(this::toAssignmentResponse)
                .collect(Collectors.toList());
    }

    public List<OrganizerOpsFollowUpResponse> listFollowUps(Long operatorId, Long organizerUserId) {
        requireAnyPermission(operatorId, PERMISSION_FOLLOW_MANAGE, "organizer.review");
        Long organizerId = requireId(organizerUserId, "主办方ID不能为空");
        return followUpMapper.selectList(new LambdaQueryWrapper<OrganizerOpsFollowUp>()
                        .eq(OrganizerOpsFollowUp::getOrganizerUserId, organizerId)
                        .orderByDesc(OrganizerOpsFollowUp::getCreateTime)
                        .orderByDesc(OrganizerOpsFollowUp::getId))
                .stream()
                .map(this::toFollowUpResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public OrganizerOpsAssignmentResponse updateAssignment(Long operatorId, Long organizerUserId,
                                                           OrganizerOpsAssignmentRequest request) {
        if (request == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "分配参数不能为空");
        }
        return toAssignmentResponse(updateAssignment(
                operatorId,
                organizerUserId,
                request.getAssignedOperatorId(),
                request.getRiskLevel(),
                request.getStatus(),
                request.getNextFollowAt()
        ));
    }

    @Transactional
    public OrganizerOpsFollowUpResponse createFollowUp(Long operatorId, Long organizerUserId,
                                                       OrganizerOpsFollowUpRequest request) {
        if (request == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "跟进参数不能为空");
        }
        return toFollowUpResponse(createFollowUp(
                operatorId,
                organizerUserId,
                request.getFollowType(),
                request.getContent(),
                request.getNextFollowAt()
        ));
    }

    @Transactional
    public OrganizerOpsFollowUp createFollowUp(Long operatorId, Long organizerUserId, String followType,
                                               String content, LocalDateTime nextFollowAt) {
        InternalAuthContextResponse auth = requirePermission(operatorId, PERMISSION_FOLLOW_MANAGE);
        Long organizerId = requireId(organizerUserId, "主办方ID不能为空");
        String normalizedFollowType = requireText(followType, "跟进方式不能为空").toUpperCase();
        String normalizedContent = requireText(content, "跟进内容不能为空");
        LocalDateTime now = LocalDateTime.now();

        OrganizerOpsFollowUp followUp = new OrganizerOpsFollowUp();
        followUp.setOrganizerUserId(organizerId);
        followUp.setOperatorId(operatorId);
        followUp.setFollowType(normalizedFollowType);
        followUp.setContent(normalizedContent);
        followUp.setNextFollowAt(nextFollowAt);
        followUp.setCreateTime(now);
        followUpMapper.insert(followUp);

        upsertFollowSnapshot(organizerId, operatorId, nextFollowAt, now);
        auditWrite(auth, operatorId, "organizer_ops.follow_up.create", organizerId,
                normalizedFollowType, "新增主办方跟进记录", "新增成功");
        return followUp;
    }

    @Transactional
    public OrganizerOpsAssignment updateAssignment(Long operatorId, Long organizerUserId, Long assignedOperatorId,
                                                   String riskLevel, String status, LocalDateTime nextFollowAt) {
        InternalAuthContextResponse auth = requirePermission(operatorId, PERMISSION_ASSIGN_MANAGE);
        Long organizerId = requireId(organizerUserId, "主办方ID不能为空");
        Long assigneeId = requireId(assignedOperatorId, "负责人ID不能为空");
        String normalizedRiskLevel = normalizeRiskLevel(riskLevel);
        String normalizedStatus = normalizeStatus(status);
        LocalDateTime now = LocalDateTime.now();

        OrganizerOpsAssignment assignment = assignmentMapper.selectById(organizerId);
        boolean create = assignment == null;
        if (create) {
            assignment = new OrganizerOpsAssignment();
            assignment.setOrganizerUserId(organizerId);
            assignment.setCreateTime(now);
        }
        assignment.setAssignedOperatorId(assigneeId);
        assignment.setRiskLevel(normalizedRiskLevel);
        assignment.setStatus(normalizedStatus);
        assignment.setNextFollowAt(nextFollowAt);
        assignment.setUpdateTime(now);

        if (create) {
            assignmentMapper.insert(assignment);
        } else {
            assignmentMapper.updateById(assignment);
        }
        auditWrite(auth, operatorId, "organizer_ops.assignment.update", organizerId,
                Long.toString(assigneeId), "更新主办方运营分配", "更新成功");
        return assignment;
    }

    private void upsertFollowSnapshot(Long organizerUserId, Long operatorId, LocalDateTime nextFollowAt, LocalDateTime now) {
        OrganizerOpsAssignment assignment = assignmentMapper.selectById(organizerUserId);
        if (assignment == null) {
            assignment = new OrganizerOpsAssignment();
            assignment.setOrganizerUserId(organizerUserId);
            assignment.setAssignedOperatorId(operatorId);
            assignment.setRiskLevel("normal");
            assignment.setStatus("active");
            assignment.setNextFollowAt(nextFollowAt);
            assignment.setLastFollowAt(now);
            assignment.setCreateTime(now);
            assignment.setUpdateTime(now);
            assignmentMapper.insert(assignment);
            return;
        }
        if (assignment.getAssignedOperatorId() == null) {
            assignment.setAssignedOperatorId(operatorId);
        }
        if (nextFollowAt != null) {
            assignment.setNextFollowAt(nextFollowAt);
        }
        assignment.setLastFollowAt(now);
        assignment.setUpdateTime(now);
        assignmentMapper.updateById(assignment);
    }

    private InternalAuthContextResponse requirePermission(Long operatorId, String permissionCode) {
        if (operatorId == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
        InternalAuthContextResponse auth = rbacService.getInternalAuthContext(operatorId);
        if (auth.getPermissionCodes() == null || !auth.getPermissionCodes().contains(permissionCode)) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权限");
        }
        return auth;
    }

    private InternalAuthContextResponse requireAnyPermission(Long operatorId, String... permissionCodes) {
        if (operatorId == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
        InternalAuthContextResponse auth = rbacService.getInternalAuthContext(operatorId);
        if (auth.getPermissionCodes() == null) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权限");
        }
        for (String permissionCode : permissionCodes) {
            if (auth.getPermissionCodes().contains(permissionCode)) {
                return auth;
            }
        }
        throw new BusinessException(ResultCode.FORBIDDEN, "无权限");
    }

    private Long requireId(Long value, String message) {
        if (value == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, message);
        }
        return value;
    }

    private String requireText(String value, String message) {
        if (!StringUtils.hasText(value)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, message);
        }
        return value.trim();
    }

    private String normalizeRiskLevel(String value) {
        String normalized = requireText(value, "风险等级不能为空").toLowerCase();
        if (!RISK_LEVELS.contains(normalized)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "风险等级不正确");
        }
        return normalized;
    }

    private String normalizeStatus(String value) {
        String normalized = requireText(value, "跟进状态不能为空").toLowerCase();
        if (!STATUSES.contains(normalized)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "跟进状态不正确");
        }
        return normalized;
    }

    private void auditWrite(InternalAuthContextResponse auth, Long operatorId, String action, Long targetId,
                            String targetRef, String reason, String result) {
        try {
            OperationAuditWriteRequest request = new OperationAuditWriteRequest();
            request.setOperatorId(operatorId);
            request.setOperatorRole(auth.getEffectiveRole() == null ? "unknown" : auth.getEffectiveRole());
            request.setAction(action);
            request.setTargetType("organizer_ops_assignment");
            request.setTargetId(targetId);
            request.setTargetRef(targetRef);
            request.setReason(reason);
            request.setResult(result);
            request.setSuccess(true);
            auditService.write(request);
        } catch (RuntimeException e) {
            log.warn("Failed to write organizer ops audit action={}: {}", action, e.getMessage());
        }
    }

    private OrganizerOpsAssignmentResponse toAssignmentResponse(OrganizerOpsAssignment assignment) {
        OrganizerOpsAssignmentResponse response = new OrganizerOpsAssignmentResponse();
        response.setOrganizerUserId(assignment.getOrganizerUserId());
        response.setAssignedOperatorId(assignment.getAssignedOperatorId());
        response.setRiskLevel(assignment.getRiskLevel());
        response.setStatus(assignment.getStatus());
        response.setNextFollowAt(assignment.getNextFollowAt());
        response.setLastFollowAt(assignment.getLastFollowAt());
        response.setCreateTime(assignment.getCreateTime());
        response.setUpdateTime(assignment.getUpdateTime());
        return response;
    }

    private OrganizerOpsFollowUpResponse toFollowUpResponse(OrganizerOpsFollowUp followUp) {
        OrganizerOpsFollowUpResponse response = new OrganizerOpsFollowUpResponse();
        response.setId(followUp.getId());
        response.setOrganizerUserId(followUp.getOrganizerUserId());
        response.setOperatorId(followUp.getOperatorId());
        response.setFollowType(followUp.getFollowType());
        response.setContent(followUp.getContent());
        response.setNextFollowAt(followUp.getNextFollowAt());
        response.setCreateTime(followUp.getCreateTime());
        return response;
    }
}
