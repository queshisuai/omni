package com.omni.user.controller;

import com.omni.common.dto.OperationAuditWriteRequest;
import com.omni.common.result.Result;
import com.omni.user.service.OperationAuditService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/user/internal/operation-audits")
public class InternalOperationAuditController {

    private final OperationAuditService operationAuditService;
    private final String internalApiToken;

    public InternalOperationAuditController(OperationAuditService operationAuditService,
                                            @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.operationAuditService = operationAuditService;
        this.internalApiToken = internalApiToken;
    }

    @PostMapping
    public Result<Void> writeAudit(
            @RequestHeader(value = "X-Internal-Token", required = false) String token,
            @RequestBody OperationAuditWriteRequest request) {
        if (!StringUtils.hasText(internalApiToken) || !internalApiToken.equals(token)) {
            return Result.fail(403, "无权限");
        }
        operationAuditService.write(request);
        return Result.success();
    }
}
