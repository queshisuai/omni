package com.omni.user.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.user.dto.UserBrowseHistoryRequest;
import com.omni.user.dto.UserBrowseHistoryResponse;
import com.omni.user.entity.UserBrowseHistory;
import com.omni.user.mapper.UserBrowseHistoryMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class UserBrowseHistoryService {
    private static final int HISTORY_LIMIT = 50;

    private final UserBrowseHistoryMapper mapper;

    public UserBrowseHistoryService(UserBrowseHistoryMapper mapper) {
        this.mapper = mapper;
    }

    @Transactional
    public UserBrowseHistoryResponse record(Long userId, UserBrowseHistoryRequest request) {
        if (userId == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
        if (request == null || request.getActivityId() == null || request.getActivityId() <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "活动ID不正确");
        }
        LocalDateTime now = LocalDateTime.now();
        UserBrowseHistory existing = mapper.selectOne(new LambdaQueryWrapper<UserBrowseHistory>()
                .eq(UserBrowseHistory::getUserId, userId)
                .eq(UserBrowseHistory::getActivityId, request.getActivityId())
                .last("LIMIT 1"));

        UserBrowseHistory history = existing == null ? new UserBrowseHistory() : existing;
        history.setUserId(userId);
        history.setActivityId(request.getActivityId());
        history.setActivityName(defaultText(request.getActivityName(), "演出 " + request.getActivityId()));
        history.setPoster(trimToNull(request.getPoster()));
        history.setCategory(trimToNull(request.getCategory()));
        history.setArtist(trimToNull(request.getArtist()));
        history.setCity(trimToNull(request.getCity()));
        history.setViewedAt(now);
        history.setUpdateTime(now);
        if (existing == null) {
            history.setCreateTime(now);
            mapper.insert(history);
        } else {
            mapper.updateById(history);
        }
        return toResponse(history);
    }

    public List<UserBrowseHistoryResponse> listMine(Long userId) {
        if (userId == null) {
            return Collections.emptyList();
        }
        List<UserBrowseHistory> rows = mapper.selectList(new LambdaQueryWrapper<UserBrowseHistory>()
                .eq(UserBrowseHistory::getUserId, userId)
                .orderByDesc(UserBrowseHistory::getViewedAt)
                .orderByDesc(UserBrowseHistory::getId)
                .last("LIMIT " + HISTORY_LIMIT));
        if (rows == null) return Collections.emptyList();
        return rows.stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public void clearMine(Long userId) {
        if (userId == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
        mapper.delete(new LambdaQueryWrapper<UserBrowseHistory>()
                .eq(UserBrowseHistory::getUserId, userId));
    }

    private UserBrowseHistoryResponse toResponse(UserBrowseHistory history) {
        UserBrowseHistoryResponse response = new UserBrowseHistoryResponse();
        response.setId(history.getId());
        response.setActivityId(history.getActivityId());
        response.setActivityName(history.getActivityName());
        response.setPoster(history.getPoster());
        response.setCategory(history.getCategory());
        response.setArtist(history.getArtist());
        response.setCity(history.getCity());
        response.setViewedAt(history.getViewedAt());
        response.setCreateTime(history.getCreateTime());
        response.setUpdateTime(history.getUpdateTime());
        return response;
    }

    private String defaultText(String value, String fallback) {
        String trimmed = trimToNull(value);
        return trimmed == null ? fallback : trimmed;
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
