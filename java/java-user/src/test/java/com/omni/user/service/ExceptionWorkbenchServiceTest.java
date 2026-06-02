package com.omni.user.service;

import com.omni.common.dto.ExceptionTaskCreateRequest;
import com.omni.common.dto.ExceptionTaskResponse;
import com.omni.user.entity.ExceptionTask;
import com.omni.user.mapper.ExceptionTaskMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
}
