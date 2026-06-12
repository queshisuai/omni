package com.omni.user.service;

import com.omni.common.dto.ExceptionTaskCreateRequest;
import com.omni.common.dto.ExceptionTaskResponse;
import com.omni.exception.BusinessException;
import com.omni.user.entity.ExceptionTask;
import com.omni.user.mapper.ExceptionTaskMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ExceptionWorkbenchServiceTest {

    private ExceptionTaskMapper mapper;
    private ExceptionWorkbenchService service;

    @BeforeEach
    void setUp() {
        mapper = mock(ExceptionTaskMapper.class);
        service = new ExceptionWorkbenchService(mapper);
    }

    @Test
    void createsExceptionTaskWhenRefundBecomesCompensationRequired() {
        when(mapper.insert(any(ExceptionTask.class))).thenAnswer(invocation -> {
            ExceptionTask task = invocation.getArgument(0);
            task.setId(1L);
            return 1;
        });

        ExceptionTaskCreateRequest request = new ExceptionTaskCreateRequest();
        request.setTaskType("abnormal_refund");
        request.setBusinessNo("RF202606020001");
        request.setOrderNo("OM202606020001");
        request.setReason("支付宝退款结果未知");
        request.setSeverity("high");
        request.setEvidenceUrls(List.of("https://example.com/evidence/1.png"));

        ExceptionTaskResponse response = service.create(request);

        assertEquals("abnormal_refund", response.getTaskType());
        assertEquals("pending", response.getStatus());
        verify(mapper).insert(any(ExceptionTask.class));
    }

    @Test
    void filtersExceptionTasksByStatusForConsoleQueue() {
        ExceptionTask pending = task(1L, "pending");
        ExceptionTask resolved = task(2L, "resolved");
        when(mapper.selectList(any())).thenReturn(List.of(pending, resolved));

        List<ExceptionTaskResponse> response = service.listByStatus("pending");

        assertEquals(1, response.size());
        assertEquals("pending", response.get(0).getStatus());
    }

    @Test
    void claimsPendingExceptionTaskForCurrentOperator() {
        ExceptionTask task = task(10L, "pending");
        when(mapper.selectById(10L)).thenReturn(task);

        ExceptionTaskResponse response = service.claim(10L, 2002L, "platform_super_admin");

        assertEquals("processing", response.getStatus());
        assertEquals(2002L, response.getOperatorId());
        assertEquals("platform_super_admin", response.getOperatorRole());
        ArgumentCaptor<ExceptionTask> captor = ArgumentCaptor.forClass(ExceptionTask.class);
        verify(mapper).updateById(captor.capture());
        assertEquals("processing", captor.getValue().getStatus());
    }

    @Test
    void resolvesProcessingExceptionTaskWithResult() {
        ExceptionTask task = task(11L, "processing");
        when(mapper.selectById(11L)).thenReturn(task);

        ExceptionTaskResponse response = service.resolve(11L, "已核对退款流水并补偿用户", 2002L, "platform_super_admin");

        assertEquals("resolved", response.getStatus());
        assertEquals("已核对退款流水并补偿用户", response.getResult());
    }

    @Test
    void closesPendingExceptionTaskWithResult() {
        ExceptionTask task = task(12L, "pending");
        when(mapper.selectById(12L)).thenReturn(task);

        ExceptionTaskResponse response = service.close(12L, "重复任务，已合并到主任务", 2002L, "platform_super_admin");

        assertEquals("closed", response.getStatus());
        assertEquals("重复任务，已合并到主任务", response.getResult());
    }

    @Test
    void rejectsClaimingResolvedExceptionTask() {
        ExceptionTask task = task(13L, "resolved");
        when(mapper.selectById(13L)).thenReturn(task);

        assertThrows(BusinessException.class, () -> service.claim(13L, 2002L, "platform_super_admin"));
    }

    private ExceptionTask task(Long id, String status) {
        ExceptionTask task = new ExceptionTask();
        task.setId(id);
        task.setTaskType("refund_failed");
        task.setBusinessNo("RF202606080001");
        task.setOrderNo("OM202606080001");
        task.setSeverity("high");
        task.setStatus(status);
        task.setReason("退款结果未知");
        task.setTraceId("trace-" + id);
        return task;
    }
}
