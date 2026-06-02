package com.omni.user.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.dto.OperationAuditWriteRequest;
import com.omni.user.dto.OperationAuditLogResponse;
import com.omni.user.entity.OperationAuditLog;
import com.omni.user.mapper.OperationAuditLogMapper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class OperationAuditService {

    private final OperationAuditLogMapper mapper;

    public OperationAuditService(OperationAuditLogMapper mapper) {
        this.mapper = mapper;
    }

    public void write(OperationAuditWriteRequest request) {
        OperationAuditLog log = new OperationAuditLog();
        log.setOperatorId(request.getOperatorId());
        log.setOperatorRole(request.getOperatorRole() == null ? "unknown" : request.getOperatorRole());
        log.setAction(request.getAction());
        log.setTargetType(request.getTargetType());
        log.setTargetId(request.getTargetId());
        log.setTargetRef(request.getTargetRef());
        log.setReason(request.getReason());
        log.setResult(request.getResult());
        log.setSuccess(request.getSuccess() != null ? request.getSuccess() : true);
        log.setErrorMessage(request.getErrorMessage());
        log.setTraceId(request.getTraceId());
        log.setCreateTime(LocalDateTime.now());
        mapper.insert(log);
    }

    public List<OperationAuditLogResponse> list(Long operatorId, String action, String targetType,
                                                Boolean success, String traceId, Integer limit) {
        int queryLimit = normalizeLimit(limit);
        LambdaQueryWrapper<OperationAuditLog> wrapper = new LambdaQueryWrapper<OperationAuditLog>()
                .orderByDesc(OperationAuditLog::getCreateTime)
                .orderByDesc(OperationAuditLog::getId)
                .last("LIMIT " + queryLimit);
        if (operatorId != null) {
            wrapper.eq(OperationAuditLog::getOperatorId, operatorId);
        }
        if (StringUtils.hasText(action)) {
            wrapper.eq(OperationAuditLog::getAction, action.trim());
        }
        if (StringUtils.hasText(targetType)) {
            wrapper.eq(OperationAuditLog::getTargetType, targetType.trim());
        }
        if (success != null) {
            wrapper.eq(OperationAuditLog::getSuccess, success);
        }
        if (StringUtils.hasText(traceId)) {
            wrapper.eq(OperationAuditLog::getTraceId, traceId.trim());
        }
        return mapper.selectList(wrapper).stream().map(this::toResponse).collect(Collectors.toList());
    }

    private int normalizeLimit(Integer limit) {
        if (limit == null) return 100;
        if (limit < 1) return 1;
        return Math.min(limit, 200);
    }

    private OperationAuditLogResponse toResponse(OperationAuditLog log) {
        OperationAuditLogResponse response = new OperationAuditLogResponse();
        response.setId(log.getId());
        response.setOperatorId(log.getOperatorId());
        response.setOperatorRole(log.getOperatorRole());
        response.setAction(log.getAction());
        response.setTargetType(log.getTargetType());
        response.setTargetId(log.getTargetId());
        response.setTargetRef(log.getTargetRef());
        response.setReason(log.getReason());
        response.setResult(log.getResult());
        response.setSuccess(log.getSuccess());
        response.setErrorMessage(log.getErrorMessage());
        response.setTraceId(log.getTraceId());
        response.setCreateTime(log.getCreateTime());
        return response;
    }
}
