package com.omni.user.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.common.dto.InternalAuthContextResponse;
import com.omni.common.dto.OperationAuditWriteRequest;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.user.dto.OrganizerDirectoryResponse;
import com.omni.user.entity.OrganizerApplication;
import com.omni.user.entity.OrganizerOpsAssignment;
import com.omni.user.entity.User;
import com.omni.user.mapper.OrganizerApplicationMapper;
import com.omni.user.mapper.OrganizerOpsAssignmentMapper;
import com.omni.user.mapper.UserMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class OrganizerDirectoryService {

    private static final Set<String> PERMISSIONS = Set.of("organizer.review", "organizer.account.manage");
    private final UserMapper userMapper;
    private final OrganizerApplicationMapper applicationMapper;
    private final OrganizerOpsAssignmentMapper assignmentMapper;
    private final RbacService rbacService;
    private final OperationAuditService auditService;

    public OrganizerDirectoryService(UserMapper userMapper,
                                    OrganizerApplicationMapper applicationMapper,
                                    OrganizerOpsAssignmentMapper assignmentMapper,
                                    RbacService rbacService,
                                    OperationAuditService auditService) {
        this.userMapper = userMapper;
        this.applicationMapper = applicationMapper;
        this.assignmentMapper = assignmentMapper;
        this.rbacService = rbacService;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public Page<OrganizerDirectoryResponse> list(Long operatorId, Integer page, Integer size,
                                                   String keyword, String followUpOperator,
                                                   String cooperationStatus) {
        requireAnyPermission(operatorId);
        long current = page == null || page < 1 ? 1 : page;
        long pageSize = size == null ? 10 : Math.min(Math.max(size, 1), 50);
        LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<User>()
                .orderByDesc(User::getUpdateTime)
                .orderByDesc(User::getId);
        if ("FROZEN".equalsIgnoreCase(cooperationStatus)) {
            wrapper.eq(User::getOrganizerStatus, 3);
        } else if ("ACTIVE".equalsIgnoreCase(cooperationStatus)) {
            wrapper.eq(User::getRole, "organizer").eq(User::getOrganizerStatus, 1);
        } else {
            wrapper.and(w -> w.eq(User::getRole, "organizer")
                    .eq(User::getOrganizerStatus, 1)
                    .or()
                    .eq(User::getOrganizerStatus, 3));
        }
        if (keyword != null && !keyword.trim().isEmpty()) {
            String value = keyword.trim();
            wrapper.and(w -> w.like(User::getOrganizerName, value)
                    .or().like(User::getNickname, value)
                    .or().like(User::getPhone, value)
                    .or().like(User::getId, value));
        }
        String followUpValue = followUpOperator == null ? "" : followUpOperator.trim();
        if (!followUpValue.isEmpty()) {
            List<Long> matchedOperatorIds = findMatchedOperatorIds(followUpValue);
            if (matchedOperatorIds.isEmpty()) {
                return new Page<>(current, pageSize, 0);
            }
            List<Long> organizerIds = assignmentMapper.selectList(
                            new LambdaQueryWrapper<OrganizerOpsAssignment>()
                                    .in(OrganizerOpsAssignment::getAssignedOperatorId, matchedOperatorIds))
                    .stream()
                    .map(OrganizerOpsAssignment::getOrganizerUserId)
                    .filter(Objects::nonNull)
                    .distinct()
                    .collect(Collectors.toList());
            if (organizerIds.isEmpty()) {
                return new Page<>(current, pageSize, 0);
            }
            wrapper.in(User::getId, organizerIds);
        }
        Page<User> users = userMapper.selectPage(new Page<>(current, pageSize), wrapper);
        List<User> records = users.getRecords();
        Page<OrganizerDirectoryResponse> result = new Page<>(current, pageSize, users.getTotal());
        if (records.isEmpty()) return result;

        List<Long> organizerIds = records.stream().map(User::getId).collect(Collectors.toList());
        Map<Long, OrganizerOpsAssignment> assignments = assignmentMapper.selectList(
                        new LambdaQueryWrapper<OrganizerOpsAssignment>()
                                .in(OrganizerOpsAssignment::getOrganizerUserId, organizerIds))
                .stream().collect(Collectors.toMap(OrganizerOpsAssignment::getOrganizerUserId, Function.identity(), (a, b) -> a));
        List<Long> operatorIds = assignments.values().stream()
                .map(OrganizerOpsAssignment::getAssignedOperatorId)
                .filter(Objects::nonNull).distinct().collect(Collectors.toList());
        Map<Long, User> operators = operatorIds.isEmpty() ? Map.of() : userMapper.selectBatchIds(operatorIds)
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));
        Map<Long, OrganizerApplication> approvedApplications = applicationMapper.selectList(
                        new LambdaQueryWrapper<OrganizerApplication>()
                                .in(OrganizerApplication::getUserId, organizerIds)
                                .eq(OrganizerApplication::getStatus, 1)
                                .orderByDesc(OrganizerApplication::getCreateTime)
                                .orderByDesc(OrganizerApplication::getId))
                .stream().collect(Collectors.toMap(OrganizerApplication::getUserId, Function.identity(), (a, b) -> a));

        List<OrganizerDirectoryResponse> responses = records.stream()
                .map(user -> toResponse(user, assignments.get(user.getId()), operators,
                        approvedApplications.get(user.getId())))
                .collect(Collectors.toList());
        result.setRecords(responses);
        return result;
    }

    private List<Long> findMatchedOperatorIds(String keyword) {
        LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<User>()
                .like(User::getNickname, keyword)
                .or()
                .like(User::getPhone, keyword);
        try {
            wrapper.or().eq(User::getId, Long.valueOf(keyword));
        } catch (NumberFormatException ignored) {
            // 跟进人筛选也支持按运营员昵称或手机号查询。
        }
        return userMapper.selectList(wrapper).stream()
                .map(User::getId)
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());
    }

    @Transactional
    public OrganizerDirectoryResponse revoke(Long operatorId, Long organizerId, String reason) {
        requireAnyPermission(operatorId);
        String normalizedReason = requireText(reason, "取消合作/冻结原因不能为空");
        User organizer = userMapper.selectById(organizerId);
        if (organizer == null) throw new BusinessException(ResultCode.NOT_FOUND, "主办方不存在");
        if (!"organizer".equals(organizer.getRole()) || !Integer.valueOf(1).equals(organizer.getOrganizerStatus())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "当前主办方状态不能冻结");
        }
        organizer.setRole("user");
        organizer.setOrganizerStatus(3);
        organizer.setUpdateTime(LocalDateTime.now());
        userMapper.updateById(organizer);

        OperationAuditWriteRequest audit = new OperationAuditWriteRequest();
        audit.setOperatorId(operatorId);
        audit.setOperatorRole(resolveOperatorRole(operatorId));
        audit.setAction("organizer.revoke");
        audit.setTargetType("user");
        audit.setTargetId(organizerId);
        audit.setTargetRef(organizer.getOrganizerName());
        audit.setReason(normalizedReason);
        audit.setResult("主办方资质已冻结");
        audit.setSuccess(true);
        auditService.write(audit);
        return toResponse(organizer, null, Map.of(), null);
    }

    private OrganizerDirectoryResponse toResponse(User user, OrganizerOpsAssignment assignment,
                                                   Map<Long, User> operators, OrganizerApplication application) {
        OrganizerDirectoryResponse response = new OrganizerDirectoryResponse();
        response.setOrganizerId(user.getId());
        response.setOrganizerName(user.getOrganizerName() == null ? user.getNickname() : user.getOrganizerName());
        response.setSubjectType(application == null ? null : application.getSubjectType());
        response.setQualificationNo(application == null ? null : application.getLicenseNo());
        response.setContactName(application == null ? user.getNickname() : application.getContactName());
        response.setContactPhone(application == null ? user.getPhone() : application.getContactPhone());
        if (assignment != null) {
            response.setFollowUpOperatorId(assignment.getAssignedOperatorId());
            User operator = operators.get(assignment.getAssignedOperatorId());
            response.setFollowUpOperatorName(operator == null ? null : operator.getNickname());
        }
        response.setCooperationStatus(Integer.valueOf(3).equals(user.getOrganizerStatus()) ? "FROZEN" : "ACTIVE");
        return response;
    }

    private void requireAnyPermission(Long operatorId) {
        InternalAuthContextResponse auth = rbacService.getInternalAuthContext(operatorId);
        if (auth != null && auth.getPermissionCodes() != null
                && auth.getPermissionCodes().stream().anyMatch(PERMISSIONS::contains)) return;
        throw new BusinessException(ResultCode.FORBIDDEN, "无权限");
    }

    private String resolveOperatorRole(Long operatorId) {
        InternalAuthContextResponse auth = rbacService.getInternalAuthContext(operatorId);
        return auth == null || auth.getEffectiveRole() == null ? "unknown" : auth.getEffectiveRole();
    }

    private String requireText(String value, String message) {
        if (value == null || value.trim().isEmpty()) {
            throw new BusinessException(ResultCode.BAD_REQUEST, message);
        }
        return value.trim();
    }
}
