package com.omni.user.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.user.dto.ResolvedAttendeeResponse;
import com.omni.user.dto.UserAttendeeRequest;
import com.omni.user.dto.UserAttendeeResponse;
import com.omni.user.entity.UserAttendee;
import com.omni.user.mapper.UserAttendeeMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class UserAttendeeService {
    private static final int STATUS_ACTIVE = 1;
    private static final int STATUS_DELETED = 0;
    private static final String ID_CARD = "ID_CARD";

    private final UserAttendeeMapper mapper;

    public UserAttendeeService(UserAttendeeMapper mapper) {
        this.mapper = mapper;
    }

    @Transactional(rollbackFor = Exception.class)
    public UserAttendeeResponse create(Long userId, UserAttendeeRequest request) {
        UserAttendee attendee = buildAttendee(userId, request);
        mapper.insert(attendee);
        return toResponse(attendee);
    }

    public List<UserAttendeeResponse> listMine(Long userId) {
        if (userId == null) {
            return Collections.emptyList();
        }
        List<UserAttendee> attendees = mapper.selectList(new LambdaQueryWrapper<UserAttendee>()
                .eq(UserAttendee::getUserId, userId)
                .eq(UserAttendee::getStatus, STATUS_ACTIVE)
                .orderByDesc(UserAttendee::getIsDefault)
                .orderByDesc(UserAttendee::getCreateTime));
        if (attendees == null) {
            return Collections.emptyList();
        }
        return attendees.stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional(rollbackFor = Exception.class)
    public UserAttendeeResponse update(Long userId, Long id, UserAttendeeRequest request) {
        UserAttendee existing = requireOwnedActive(userId, id);
        UserAttendee next = buildAttendee(userId, request);
        next.setId(existing.getId());
        next.setCreateTime(existing.getCreateTime());
        next.setUpdateTime(LocalDateTime.now());
        mapper.updateById(next);
        return toResponse(next);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(Long userId, Long id) {
        requireOwnedActive(userId, id);
        mapper.update(null, new LambdaUpdateWrapper<UserAttendee>()
                .eq(UserAttendee::getId, id)
                .eq(UserAttendee::getUserId, userId)
                .eq(UserAttendee::getStatus, STATUS_ACTIVE)
                .set(UserAttendee::getStatus, STATUS_DELETED)
                .set(UserAttendee::getUpdateTime, LocalDateTime.now()));
    }

    public List<ResolvedAttendeeResponse> resolve(Long userId, List<Long> attendeeIds) {
        if (userId == null || attendeeIds == null || attendeeIds.isEmpty()) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "请选择实名观演人");
        }
        List<Long> ids = attendeeIds.stream().filter(Objects::nonNull).collect(Collectors.toList());
        if (ids.size() != attendeeIds.size()) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "请选择实名观演人");
        }
        List<UserAttendee> attendees = mapper.selectBatchIds(ids);
        Map<Long, UserAttendee> byId = attendees == null ? Collections.emptyMap()
                : attendees.stream().collect(Collectors.toMap(UserAttendee::getId, attendee -> attendee, (a, b) -> a));
        List<ResolvedAttendeeResponse> resolved = new ArrayList<>();
        for (Long id : ids) {
            UserAttendee attendee = byId.get(id);
            if (attendee == null || !userId.equals(attendee.getUserId()) || !Integer.valueOf(STATUS_ACTIVE).equals(attendee.getStatus())) {
                throw new BusinessException(ResultCode.BAD_REQUEST, "实名观演人不属于当前用户或已被删除");
            }
            resolved.add(toResolved(attendee));
        }
        return resolved;
    }

    private UserAttendee buildAttendee(Long userId, UserAttendeeRequest request) {
        if (userId == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "请先登录");
        }
        if (request == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "请填写实名观演人信息");
        }
        String realName = requireText(request.getRealName(), "请填写观演人姓名");
        String idType = StringUtils.hasText(request.getIdType()) ? request.getIdType().trim().toUpperCase() : ID_CARD;
        if (!ID_CARD.equals(idType)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "暂不支持该证件类型");
        }
        String normalizedIdNo = normalizeIdNo(request.getIdNo());
        LocalDateTime now = LocalDateTime.now();
        UserAttendee attendee = new UserAttendee();
        attendee.setUserId(userId);
        attendee.setRealName(realName);
        attendee.setIdType(idType);
        attendee.setIdNoHash(hashIdNo(idType, normalizedIdNo));
        attendee.setIdNoMask(maskIdNo(normalizedIdNo));
        attendee.setIdNoEncrypted(null);
        attendee.setPhone(trimToNull(request.getPhone()));
        attendee.setIsDefault(Boolean.TRUE.equals(request.getIsDefault()));
        attendee.setStatus(STATUS_ACTIVE);
        attendee.setCreateTime(now);
        attendee.setUpdateTime(now);
        return attendee;
    }

    private UserAttendee requireOwnedActive(Long userId, Long id) {
        if (userId == null || id == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "实名观演人信息无效");
        }
        UserAttendee attendee = mapper.selectById(id);
        if (attendee == null || !userId.equals(attendee.getUserId()) || !Integer.valueOf(STATUS_ACTIVE).equals(attendee.getStatus())) {
            throw new BusinessException(ResultCode.NOT_FOUND, "实名观演人不存在或已被删除");
        }
        return attendee;
    }

    private UserAttendeeResponse toResponse(UserAttendee attendee) {
        UserAttendeeResponse response = new UserAttendeeResponse();
        response.setId(attendee.getId());
        response.setRealName(attendee.getRealName());
        response.setIdType(attendee.getIdType());
        response.setIdNoMask(attendee.getIdNoMask());
        response.setPhone(attendee.getPhone());
        response.setIsDefault(attendee.getIsDefault());
        response.setStatus(attendee.getStatus());
        response.setCreateTime(attendee.getCreateTime());
        response.setUpdateTime(attendee.getUpdateTime());
        return response;
    }

    private ResolvedAttendeeResponse toResolved(UserAttendee attendee) {
        ResolvedAttendeeResponse response = new ResolvedAttendeeResponse();
        response.setId(attendee.getId());
        response.setRealName(attendee.getRealName());
        response.setIdType(attendee.getIdType());
        response.setIdNoHash(attendee.getIdNoHash());
        response.setIdNoMask(attendee.getIdNoMask());
        response.setPhone(attendee.getPhone());
        return response;
    }

    private String requireText(String value, String message) {
        String trimmed = trimToNull(value);
        if (trimmed == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, message);
        }
        return trimmed;
    }

    private String normalizeIdNo(String value) {
        String normalized = trimToNull(value);
        if (normalized == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "请填写证件号");
        }
        normalized = normalized.replace(" ", "").toUpperCase();
        if (normalized.length() < 6 || normalized.length() > 32) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "证件号格式不正确");
        }
        return normalized;
    }

    private String maskIdNo(String value) {
        if (value.length() <= 6) {
            return value;
        }
        String prefix = value.substring(0, 3);
        String suffix = value.substring(value.length() - 3);
        return prefix + "***********" + suffix;
    }

    private String hashIdNo(String idType, String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest((idType + ":" + value).getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(hashed.length * 2);
            for (byte b : hashed) {
                builder.append(String.format("%02x", b));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "证件信息处理失败");
        }
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
