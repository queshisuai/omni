package com.omni.user.controller;

import com.omni.common.dto.ExceptionTaskCreateRequest;
import com.omni.common.dto.ExceptionTaskResponse;
import com.omni.common.dto.ReconciliationBatchCreateRequest;
import com.omni.common.dto.ReconciliationBatchResponse;
import com.omni.common.result.Result;
import com.omni.user.service.ExceptionWorkbenchService;
import com.omni.user.service.ReconciliationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/console")
public class InternalWorkbenchController {

    private final ExceptionWorkbenchService exceptionWorkbenchService;
    private final ReconciliationService reconciliationService;

    public InternalWorkbenchController(ExceptionWorkbenchService exceptionWorkbenchService,
                                       ReconciliationService reconciliationService) {
        this.exceptionWorkbenchService = exceptionWorkbenchService;
        this.reconciliationService = reconciliationService;
    }

    @GetMapping("/exception-tasks")
    public Result<java.util.List<ExceptionTaskResponse>> listExceptionTasks() {
        return Result.success(exceptionWorkbenchService.listByStatus(null));
    }

    @PostMapping("/exception-tasks")
    public Result<ExceptionTaskResponse> createExceptionTask(@RequestBody ExceptionTaskCreateRequest request) {
        return Result.success(exceptionWorkbenchService.create(request));
    }

    @GetMapping("/reconciliation/batches")
    public Result<java.util.List<ReconciliationBatchResponse>> listBatches() {
        return Result.success(java.util.Collections.emptyList());
    }

    @PostMapping("/reconciliation/batches")
    public Result<ReconciliationBatchResponse> createBatch(@RequestBody ReconciliationBatchCreateRequest request) {
        return Result.success(reconciliationService.createBatch(request));
    }
}
