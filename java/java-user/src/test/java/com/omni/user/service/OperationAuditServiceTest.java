package com.omni.user.service;

import com.omni.common.dto.OperationAuditWriteRequest;
import com.omni.user.entity.OperationAuditLog;
import com.omni.user.mapper.OperationAuditLogMapper;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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

    @Test
    void listsAuditLogsWithFilters() {
        OperationAuditLog log = new OperationAuditLog();
        log.setId(9L);
        log.setOperatorId(7L);
        log.setOperatorRole("platform_super_admin");
        log.setAction("rbac.role_permission.update");
        log.setTargetType("rbac_role");
        log.setTargetRef("support_manager");
        log.setSuccess(true);
        log.setTraceId("trace-abc-001");
        log.setCreateTime(LocalDateTime.now());
        when(mapper.selectList(any())).thenReturn(List.of(log));

        var items = service.list(7L, "rbac.role_permission.update", "rbac_role", true, "trace-abc-001", 20);

        assertEquals(1, items.size());
        assertEquals("platform_super_admin", items.get(0).getOperatorRole());
        assertEquals("support_manager", items.get(0).getTargetRef());
    }
}
