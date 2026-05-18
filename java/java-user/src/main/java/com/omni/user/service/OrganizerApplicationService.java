package com.omni.user.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.user.dto.OrganizerApplicationRequest;
import com.omni.user.dto.OrganizerApplicationResponse;
import com.omni.user.entity.OrganizerApplication;
import com.omni.user.entity.User;
import com.omni.user.mapper.OrganizerApplicationMapper;
import com.omni.user.mapper.UserMapper;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class OrganizerApplicationService {

    private static final int STATUS_PENDING = 0;
    private static final int STATUS_APPROVED = 1;
    private static final int STATUS_REJECTED = 2;
    private static final Set<String> SUBJECT_TYPES = Set.of("personal", "enterprise");

    private final OrganizerApplicationMapper organizerApplicationMapper;
    private final UserMapper userMapper;
    private final TransactionTemplate transactionTemplate;

    public OrganizerApplicationService(OrganizerApplicationMapper organizerApplicationMapper,
                                       UserMapper userMapper,
                                       PlatformTransactionManager transactionManager) {
        this.organizerApplicationMapper = organizerApplicationMapper;
        this.userMapper = userMapper;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.transactionTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_NESTED);
    }

    @Transactional
    public OrganizerApplicationResponse submitOrUpdate(Long userId, OrganizerApplicationRequest request) {
        if (request == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "入驻申请参数不能为空");
        }
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "用户不存在");
        }
        if ("organizer".equals(user.getRole()) || "admin".equals(user.getRole())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "当前账号已具备后台权限");
        }

        String organizerName = requireText(request.getOrganizerName(), "主办方名称不能为空");
        String subjectType = requireText(request.getSubjectType(), "主体类型不能为空");
        String contactName = requireText(request.getContactName(), "联系人不能为空");
        String contactPhone = requireText(request.getContactPhone(), "联系电话不能为空");
        String contactEmail = trimToNull(request.getContactEmail());
        if (!SUBJECT_TYPES.contains(subjectType)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "主体类型只能为personal或enterprise");
        }
        if (contactEmail != null && !contactEmail.contains("@")) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "邮箱格式不正确");
        }

        OrganizerApplication application = findByUserId(userId);
        LocalDateTime now = LocalDateTime.now();
        if (application == null) {
            application = new OrganizerApplication();
            application.setUserId(userId);
            application.setCreateTime(now);
        } else if (Integer.valueOf(STATUS_APPROVED).equals(application.getStatus()) && !isCancelledOrganizer(user)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "入驻申请已通过");
        } else if (!Integer.valueOf(STATUS_PENDING).equals(application.getStatus())
                && !Integer.valueOf(STATUS_REJECTED).equals(application.getStatus())
                && !(Integer.valueOf(STATUS_APPROVED).equals(application.getStatus()) && isCancelledOrganizer(user))) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "入驻申请状态不允许修改");
        }

        application.setOrganizerName(organizerName);
        application.setSubjectType(subjectType);
        application.setContactName(contactName);
        application.setContactPhone(contactPhone);
        application.setContactEmail(contactEmail);
        application.setLicenseNo(trimToNull(request.getLicenseNo()));
        application.setBusinessScope(trimToNull(request.getBusinessScope()));
        application.setDescription(trimToNull(request.getDescription()));
        application.setStatus(STATUS_PENDING);
        application.setUpdateTime(now);

        if (application.getId() == null) {
            try {
                insertApplicationInNewTransaction(application);
            } catch (DuplicateKeyException e) {
                application = findByUserId(userId);
                if (application == null) {
                    throw e;
                }
                if (Integer.valueOf(STATUS_APPROVED).equals(application.getStatus()) && !isCancelledOrganizer(user)) {
                    throw new BusinessException(ResultCode.BAD_REQUEST, "入驻申请已通过");
                }
                if (!Integer.valueOf(STATUS_PENDING).equals(application.getStatus())
                        && !Integer.valueOf(STATUS_REJECTED).equals(application.getStatus())
                        && !(Integer.valueOf(STATUS_APPROVED).equals(application.getStatus()) && isCancelledOrganizer(user))) {
                    throw new BusinessException(ResultCode.BAD_REQUEST, "入驻申请状态不允许修改");
                }
                applyApplicationFields(application, request, organizerName, subjectType, contactName, contactPhone, contactEmail, now);
                updateApplicationForResubmit(application, now);
            }
        } else {
            updateApplicationForResubmit(application, now);
        }

        user.setOrganizerStatus(STATUS_PENDING);
        user.setOrganizerName(organizerName);
        userMapper.updateById(user);

        return toResponse(application, user);
    }

    public OrganizerApplicationResponse getMine(Long userId) {
        OrganizerApplication application = findByUserId(userId);
        if (application == null) {
            return null;
        }
        User user = userMapper.selectById(application.getUserId());
        return toResponse(application, user);
    }

    public List<OrganizerApplicationResponse> listForAdmin(Long reviewerId, Integer status) {
        requireAdmin(reviewerId);
        LambdaQueryWrapper<OrganizerApplication> wrapper = new LambdaQueryWrapper<>();
        if (status != null) {
            wrapper.eq(OrganizerApplication::getStatus, status);
        }
        wrapper.orderByDesc(OrganizerApplication::getCreateTime);
        List<OrganizerApplication> applications = organizerApplicationMapper.selectList(wrapper);
        if (applications.isEmpty()) {
            return List.of();
        }
        List<Long> userIds = applications.stream()
                .map(OrganizerApplication::getUserId)
                .distinct()
                .collect(Collectors.toList());
        Map<Long, User> users = userMapper.selectBatchIds(userIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        return applications.stream()
                .map(application -> toResponse(application, users.get(application.getUserId())))
                .collect(Collectors.toList());
    }

    @Transactional
    public OrganizerApplicationResponse approve(Long id, Long reviewerId, String reviewNote) {
        requireAdmin(reviewerId);
        OrganizerApplication application = requirePendingApplication(id);
        LocalDateTime now = LocalDateTime.now();

        LambdaUpdateWrapper<OrganizerApplication> updateWrapper = new LambdaUpdateWrapper<>();
        updateWrapper.eq(OrganizerApplication::getId, id)
                .eq(OrganizerApplication::getStatus, STATUS_PENDING)
                .set(OrganizerApplication::getStatus, STATUS_APPROVED)
                .set(OrganizerApplication::getReviewerId, reviewerId)
                .set(OrganizerApplication::getReviewNote, trimToNull(reviewNote))
                .set(OrganizerApplication::getReviewTime, now)
                .set(OrganizerApplication::getUpdateTime, now);
        int updated = organizerApplicationMapper.update(null, updateWrapper);
        if (updated != 1) {
            throw new BusinessException(ResultCode.CONFLICT, "仅待审核申请可处理");
        }

        User user = userMapper.selectById(application.getUserId());
        if (user == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "用户不存在");
        }
        user.setRole("organizer");
        user.setOrganizerStatus(STATUS_APPROVED);
        user.setOrganizerName(application.getOrganizerName());
        userMapper.updateById(user);

        application.setStatus(STATUS_APPROVED);
        application.setReviewerId(reviewerId);
        application.setReviewNote(trimToNull(reviewNote));
        application.setReviewTime(now);
        application.setUpdateTime(now);
        return toResponse(application, user);
    }

    @Transactional
    public OrganizerApplicationResponse reject(Long id, Long reviewerId, String reviewNote) {
        requireAdmin(reviewerId);
        String note = requireText(reviewNote, "驳回原因不能为空");
        OrganizerApplication application = requirePendingApplication(id);
        LocalDateTime now = LocalDateTime.now();

        LambdaUpdateWrapper<OrganizerApplication> updateWrapper = new LambdaUpdateWrapper<>();
        updateWrapper.eq(OrganizerApplication::getId, id)
                .eq(OrganizerApplication::getStatus, STATUS_PENDING)
                .set(OrganizerApplication::getStatus, STATUS_REJECTED)
                .set(OrganizerApplication::getReviewerId, reviewerId)
                .set(OrganizerApplication::getReviewNote, note)
                .set(OrganizerApplication::getReviewTime, now)
                .set(OrganizerApplication::getUpdateTime, now);
        int updated = organizerApplicationMapper.update(null, updateWrapper);
        if (updated != 1) {
            throw new BusinessException(ResultCode.CONFLICT, "仅待审核申请可处理");
        }

        User user = userMapper.selectById(application.getUserId());
        if (user == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "用户不存在");
        }
        user.setOrganizerStatus(STATUS_REJECTED);
        userMapper.updateById(user);

        application.setStatus(STATUS_REJECTED);
        application.setReviewerId(reviewerId);
        application.setReviewNote(note);
        application.setReviewTime(now);
        application.setUpdateTime(now);
        return toResponse(application, user);
    }

    private OrganizerApplication requirePendingApplication(Long id) {
        OrganizerApplication application = organizerApplicationMapper.selectById(id);
        if (application == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "入驻申请不存在");
        }
        if (!Integer.valueOf(STATUS_PENDING).equals(application.getStatus())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "仅待审核申请可处理");
        }
        return application;
    }

    private void insertApplicationInNewTransaction(OrganizerApplication application) {
        transactionTemplate.executeWithoutResult(status -> organizerApplicationMapper.insert(application));
    }

    private void updateApplicationForResubmit(OrganizerApplication application, LocalDateTime now) {
        LambdaUpdateWrapper<OrganizerApplication> updateWrapper = new LambdaUpdateWrapper<>();
        updateWrapper.eq(OrganizerApplication::getId, application.getId())
                .in(OrganizerApplication::getStatus, STATUS_PENDING, STATUS_REJECTED, STATUS_APPROVED)
                .set(OrganizerApplication::getOrganizerName, application.getOrganizerName())
                .set(OrganizerApplication::getSubjectType, application.getSubjectType())
                .set(OrganizerApplication::getContactName, application.getContactName())
                .set(OrganizerApplication::getContactPhone, application.getContactPhone())
                .set(OrganizerApplication::getContactEmail, application.getContactEmail())
                .set(OrganizerApplication::getLicenseNo, application.getLicenseNo())
                .set(OrganizerApplication::getBusinessScope, application.getBusinessScope())
                .set(OrganizerApplication::getDescription, application.getDescription())
                .set(OrganizerApplication::getStatus, STATUS_PENDING)
                .set(OrganizerApplication::getReviewerId, null)
                .set(OrganizerApplication::getReviewNote, null)
                .set(OrganizerApplication::getReviewTime, null)
                .set(OrganizerApplication::getUpdateTime, now);
        int updated = organizerApplicationMapper.update(null, updateWrapper);
        if (updated != 1) {
            throw new BusinessException(ResultCode.CONFLICT, "申请状态已变更，请刷新后重试");
        }
        application.setStatus(STATUS_PENDING);
        application.setReviewerId(null);
        application.setReviewNote(null);
        application.setReviewTime(null);
        application.setUpdateTime(now);
    }

    private boolean isCancelledOrganizer(User user) {
        return user != null && "user".equals(user.getRole()) && Integer.valueOf(3).equals(user.getOrganizerStatus());
    }

    private void applyApplicationFields(OrganizerApplication application,
                                        OrganizerApplicationRequest request,
                                        String organizerName,
                                        String subjectType,
                                        String contactName,
                                        String contactPhone,
                                        String contactEmail,
                                        LocalDateTime now) {
        application.setOrganizerName(organizerName);
        application.setSubjectType(subjectType);
        application.setContactName(contactName);
        application.setContactPhone(contactPhone);
        application.setContactEmail(contactEmail);
        application.setLicenseNo(trimToNull(request.getLicenseNo()));
        application.setBusinessScope(trimToNull(request.getBusinessScope()));
        application.setDescription(trimToNull(request.getDescription()));
        application.setStatus(STATUS_PENDING);
        application.setUpdateTime(now);
    }

    private void requireAdmin(Long reviewerId) {
        User reviewer = userMapper.selectById(reviewerId);
        if (reviewer == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "用户不存在");
        }
        if (!"admin".equals(reviewer.getRole())) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权限");
        }
    }

    private OrganizerApplication findByUserId(Long userId) {
        LambdaQueryWrapper<OrganizerApplication> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(OrganizerApplication::getUserId, userId);
        return organizerApplicationMapper.selectOne(wrapper);
    }

    private OrganizerApplicationResponse toResponse(OrganizerApplication application, User user) {
        OrganizerApplicationResponse response = new OrganizerApplicationResponse();
        response.setId(application.getId());
        response.setUserId(application.getUserId());
        response.setOrganizerName(application.getOrganizerName());
        response.setSubjectType(application.getSubjectType());
        response.setContactName(application.getContactName());
        response.setContactPhone(application.getContactPhone());
        response.setContactEmail(application.getContactEmail());
        response.setLicenseNo(application.getLicenseNo());
        response.setBusinessScope(application.getBusinessScope());
        response.setDescription(application.getDescription());
        response.setStatus(application.getStatus());
        response.setReviewerId(application.getReviewerId());
        response.setReviewNote(application.getReviewNote());
        response.setCreateTime(application.getCreateTime());
        response.setUpdateTime(application.getUpdateTime());
        response.setReviewTime(application.getReviewTime());
        if (user != null) {
            response.setPhone(user.getPhone());
            response.setNickname(user.getNickname());
            response.setRole(user.getRole());
            response.setOrganizerStatus(user.getOrganizerStatus());
        }
        return response;
    }

    private String requireText(String value, String message) {
        String trimmed = trimToNull(value);
        if (trimmed == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, message);
        }
        return trimmed;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
