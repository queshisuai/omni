package com.omni.user.service;

import com.omni.common.dto.OperationAuditWriteRequest;
import com.omni.user.entity.OperationAuditLog;
import com.omni.user.mapper.OperationAuditLogMapper;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

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
}
