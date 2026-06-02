package com.omni.user.service;

import com.omni.common.dto.ExceptionTaskCreateRequest;
import com.omni.common.dto.ExceptionTaskResponse;
import com.omni.user.entity.ExceptionTask;
import com.omni.user.entity.ExceptionTaskEvidence;
import com.omni.user.mapper.ExceptionTaskMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ExceptionWorkbenchService {

    private final ExceptionTaskMapper exceptionTaskMapper;

    public ExceptionWorkbenchService(ExceptionTaskMapper exceptionTaskMapper) {
        this.exceptionTaskMapper = exceptionTaskMapper;
    }

    @Transactional
    public ExceptionTaskResponse create(ExceptionTaskCreateRequest request) {
        ExceptionTask task = new ExceptionTask();
        task.setTaskType(request.getTaskType());
        task.setBusinessNo(request.getBusinessNo());
        task.setOrderNo(request.getOrderNo());
        task.setPaymentNo(request.getPaymentNo());
        task.setRefundNo(request.getRefundNo());
        task.setTicketNo(request.getTicketNo());
        task.setSeverity(request.getSeverity());
        task.setStatus("pending");
        task.setReason(request.getReason());
        task.setTraceId(UUID.randomUUID().toString().replace("-", ""));
        task.setCreateTime(LocalDateTime.now());
        task.setUpdateTime(LocalDateTime.now());
        exceptionTaskMapper.insert(task);
        return toResponse(task);
    }

    public List<ExceptionTaskResponse> listByStatus(String status) {
        List<ExceptionTask> tasks = exceptionTaskMapper.selectList(null);
        return tasks.stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public void resolve(Long taskId, String result, Long operatorId, String operatorRole) {
        ExceptionTask task = exceptionTaskMapper.selectById(taskId);
        if (task == null) return;
        task.setStatus("resolved");
        task.setResult(result);
        task.setOperatorId(operatorId);
        task.setOperatorRole(operatorRole);
        task.setUpdateTime(LocalDateTime.now());
        exceptionTaskMapper.updateById(task);
    }

    private ExceptionTaskResponse toResponse(ExceptionTask task) {
        ExceptionTaskResponse resp = new ExceptionTaskResponse();
        resp.setId(task.getId());
        resp.setTaskType(task.getTaskType());
        resp.setBusinessNo(task.getBusinessNo());
        resp.setOrderNo(task.getOrderNo());
        resp.setSeverity(task.getSeverity());
        resp.setStatus(task.getStatus());
        resp.setReason(task.getReason());
        resp.setResult(task.getResult());
        resp.setOperatorId(task.getOperatorId());
        resp.setOperatorRole(task.getOperatorRole());
        resp.setTraceId(task.getTraceId());
        resp.setCreateTime(task.getCreateTime());
        return resp;
    }
}
