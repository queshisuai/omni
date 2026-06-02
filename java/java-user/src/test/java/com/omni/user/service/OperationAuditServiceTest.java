package com.omni.user.service;

import com.omni.common.dto.OperationAuditWriteRequest;
import com.omni.user.entity.OperationAuditLog;
import com.omni.user.mapper.OperationAuditLogMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class OperationAuditServiceTest {

    private final OperationAuditLogMapper mapper = mock(OperationAuditLogMapper.class);
    private final OperationAuditService service = new OperationAuditService(mapper);

    @Test
    void recordsFailedActionWithOperatorRoleAndTraceId() {
        OperationAuditWriteRequest request = new OperationAuditWriteRequest();
        request.setOperatorId(7L);
        request.setOperatorRole("support_manager");
        request.setAction("support.account.create");
        request.setTargetType("support_account");
        request.setTargetId(3L);
        request.setTargetRef("13900000002");
        request.setReason("新开客服账号");
        request.setResult("手机号重复");
        request.setSuccess(false);
        request.setErrorMessage("该手机号已存在");
        request.setTraceId("trace-abc-001");

        service.write(request);

        verify(mapper).insert(argThat(log ->
                Long.valueOf(7L).equals(log.getOperatorId())
                        && "support_manager".equals(log.getOperatorRole())
                        && "support.account.create".equals(log.getAction())
                        && Boolean.FALSE.equals(log.getSuccess())
                        && "trace-abc-001".equals(log.getTraceId())
        ));
    }
}
