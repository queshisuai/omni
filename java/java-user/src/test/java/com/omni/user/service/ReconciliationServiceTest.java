package com.omni.user.service;

import com.omni.common.dto.ReconciliationBatchCreateRequest;
import com.omni.common.dto.ReconciliationBatchResponse;
import com.omni.user.entity.ReconciliationBatch;
import com.omni.user.mapper.ReconciliationBatchMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReconciliationServiceTest {

    private ReconciliationBatchMapper mapper;
    private ReconciliationService service;

    @BeforeEach
    void setUp() {
        mapper = mock(ReconciliationBatchMapper.class);
        service = new ReconciliationService(mapper);
    }

    @Test
    void createsReconciliationBatchFromLocalPaymentsAndRefunds() {
        when(mapper.insert(any(ReconciliationBatch.class))).thenAnswer(invocation -> {
            ReconciliationBatch batch = invocation.getArgument(0);
            batch.setId(1L);
            return 1;
        });

        ReconciliationBatchCreateRequest request = new ReconciliationBatchCreateRequest();
        request.setBizDate(LocalDate.of(2026, 6, 2));

        ReconciliationBatchResponse response = service.createBatch(request);

        assertEquals(LocalDate.of(2026, 6, 2), response.getBizDate());
        assertNotNull(response.getBatchNo());
        verify(mapper).insert(any(ReconciliationBatch.class));
    }

    @Test
    void listsExistingBatchesForConsoleWorkbench() {
        ReconciliationBatch batch = new ReconciliationBatch();
        batch.setId(5L);
        batch.setBatchNo("REC20260602-00000001");
        batch.setBizDate(LocalDate.of(2026, 6, 2));
        batch.setSourceType("local");
        batch.setStatus("generated");
        when(mapper.selectList(any())).thenReturn(List.of(batch));

        List<ReconciliationBatchResponse> batches = service.listBatches();

        assertEquals(1, batches.size());
        assertEquals("REC20260602-00000001", batches.get(0).getBatchNo());
    }
}
