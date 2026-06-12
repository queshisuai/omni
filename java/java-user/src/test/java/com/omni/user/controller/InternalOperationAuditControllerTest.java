package com.omni.user.controller;

import com.omni.common.dto.OperationAuditWriteRequest;
import com.omni.user.service.OperationAuditService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class InternalOperationAuditControllerTest {

    private final OperationAuditService operationAuditService = mock(OperationAuditService.class);
    private final InternalOperationAuditController controller =
            new InternalOperationAuditController(operationAuditService, "internal-token");

    @Test
    void writeAuditRequiresInternalToken() {
        OperationAuditWriteRequest request = new OperationAuditWriteRequest();

        var result = controller.writeAudit("wrong-token", request);

        assertEquals(403, result.getCode());
        verify(operationAuditService, never()).write(request);
    }

    @Test
    void writeAuditDelegatesToAuditServiceWhenTokenMatches() {
        OperationAuditWriteRequest request = new OperationAuditWriteRequest();
        request.setOperatorId(2003L);
        request.setOperatorRole("organizer");
        request.setAction("activity.deactivate.refund");
        request.setTargetType("activity");
        request.setTargetId(900001L);
        request.setTargetRef("测试活动");
        request.setReason("批量下架活动自动退款");
        request.setResult("下架活动 1 个，退款成功 2 笔");
        request.setSuccess(true);

        var result = controller.writeAudit("internal-token", request);

        assertEquals(200, result.getCode());
        verify(operationAuditService).write(same(request));
    }
}
