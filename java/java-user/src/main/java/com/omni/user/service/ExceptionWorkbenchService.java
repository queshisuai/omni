package com.omni.user.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.dto.ExceptionTaskCreateRequest;
import com.omni.common.dto.ExceptionTaskResponse;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.user.entity.ExceptionTask;
import com.omni.user.mapper.ExceptionTaskMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ExceptionWorkbenchService {

    private static final String STATUS_PENDING = "pending";
    private static final String STATUS_PROCESSING = "processing";
    private static final String STATUS_RESOLVED = "resolved";
    private static final String STATUS_CLOSED = "closed";

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
        task.setStatus(STATUS_PENDING);
        task.setReason(request.getReason());
        task.setTraceId(UUID.randomUUID().toString().replace("-", ""));
        task.setCreateTime(LocalDateTime.now());
        task.setUpdateTime(LocalDateTime.now());
        exceptionTaskMapper.insert(task);
        return toResponse(task);
    }

    public List<ExceptionTaskResponse> listByStatus(String status) {
        String normalizedStatus = normalize(status);
        LambdaQueryWrapper<ExceptionTask> wrapper = StringUtils.hasText(normalizedStatus)
                ? new LambdaQueryWrapper<ExceptionTask>().eq(ExceptionTask::getStatus, normalizedStatus)
                : null;
        List<ExceptionTask> tasks = exceptionTaskMapper.selectList(wrapper);
        return tasks.stream()
                .filter(task -> !StringUtils.hasText(normalizedStatus) || normalizedStatus.equals(task.getStatus()))
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public ExceptionTaskResponse claim(Long taskId, Long operatorId, String operatorRole) {
        ExceptionTask task = loadTask(taskId);
        if (!STATUS_PENDING.equals(task.getStatus())) {
            throw new BusinessException(ResultCode.CONFLICT, "只有待处理任务可以认领");
        }
        return updateStatus(task, STATUS_PROCESSING, task.getResult(), operatorId, operatorRole);
    }

    @Transactional
    public ExceptionTaskResponse resolve(Long taskId, String result, Long operatorId, String operatorRole) {
        String normalizedResult = requireResult(result);
        ExceptionTask task = loadTask(taskId);
        if (!STATUS_PROCESSING.equals(task.getStatus())) {
            throw new BusinessException(ResultCode.CONFLICT, "只有处理中任务可以标记已处理");
        }
        return updateStatus(task, STATUS_RESOLVED, normalizedResult, operatorId, operatorRole);
    }

    @Transactional
    public ExceptionTaskResponse close(Long taskId, String result, Long operatorId, String operatorRole) {
        String normalizedResult = requireResult(result);
        ExceptionTask task = loadTask(taskId);
        if (STATUS_RESOLVED.equals(task.getStatus()) || STATUS_CLOSED.equals(task.getStatus())) {
            throw new BusinessException(ResultCode.CONFLICT, "已结束任务不能重复关闭");
        }
        return updateStatus(task, STATUS_CLOSED, normalizedResult, operatorId, operatorRole);
    }

    private ExceptionTask loadTask(Long taskId) {
        if (taskId == null || taskId <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "异常任务ID不能为空");
        }
        ExceptionTask task = exceptionTaskMapper.selectById(taskId);
        if (task == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "异常任务不存在");
        }
        return task;
    }

    private ExceptionTaskResponse updateStatus(ExceptionTask task, String status, String result, Long operatorId, String operatorRole) {
        task.setStatus(status);
        task.setResult(result);
        task.setOperatorId(operatorId);
        task.setOperatorRole(StringUtils.hasText(operatorRole) ? operatorRole : "unknown");
        task.setUpdateTime(LocalDateTime.now());
        exceptionTaskMapper.updateById(task);
        return toResponse(task);
    }

    private String requireResult(String result) {
        String normalizedResult = normalize(result);
        if (!StringUtils.hasText(normalizedResult)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "处理结果不能为空");
        }
        return normalizedResult;
    }

    private String normalize(String value) {
        return value == null ? null : value.trim();
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
