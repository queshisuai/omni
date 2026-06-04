package com.omni.user.service;

import com.omni.common.dto.ReconciliationBatchCreateRequest;
import com.omni.common.dto.ReconciliationBatchDetailResponse;
import com.omni.common.dto.ReconciliationBatchResponse;
import com.omni.common.dto.ReconciliationDetailResponse;
import com.omni.common.dto.ReconciliationDifferenceResponse;
import com.omni.common.dto.ReconciliationSourceResponse;
import com.omni.common.result.Result;
import com.omni.user.client.PaymentReconciliationInternalClient;
import com.omni.user.entity.ReconciliationBatch;
import com.omni.user.entity.ReconciliationDetail;
import com.omni.user.entity.ReconciliationDifference;
import com.omni.user.mapper.ReconciliationBatchMapper;
import com.omni.user.mapper.ReconciliationDetailMapper;
import com.omni.user.mapper.ReconciliationDifferenceMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReconciliationServiceTest {

    private ReconciliationBatchMapper batchMapper;
    private ReconciliationDetailMapper detailMapper;
    private ReconciliationDifferenceMapper differenceMapper;
    private PaymentReconciliationInternalClient paymentReconciliationInternalClient;
    private ReconciliationService service;

    @BeforeEach
    void setUp() {
        batchMapper = mock(ReconciliationBatchMapper.class);
        detailMapper = mock(ReconciliationDetailMapper.class);
        differenceMapper = mock(ReconciliationDifferenceMapper.class);
        paymentReconciliationInternalClient = mock(PaymentReconciliationInternalClient.class);
        service = new ReconciliationService(batchMapper, detailMapper, differenceMapper,
                paymentReconciliationInternalClient, "omni-local-internal-token");
    }

    @Test
    void createsReconciliationBatchFromLocalPaymentsAndRefunds() {
        when(batchMapper.insert(any(ReconciliationBatch.class))).thenAnswer(invocation -> {
            ReconciliationBatch batch = invocation.getArgument(0);
            batch.setId(1L);
            return 1;
        });

        ReconciliationBatchCreateRequest request = new ReconciliationBatchCreateRequest();
        request.setBizDate(LocalDate.of(2026, 6, 2));
        ReconciliationDetailResponse detail = new ReconciliationDetailResponse();
        detail.setBusinessNo("PAY20260602001");
        detail.setBusinessType("payment");
        detail.setExpectedAmount(new BigDecimal("128.00"));
        detail.setActualAmount(new BigDecimal("128.00"));
        detail.setStatus("matched");
        ReconciliationDifferenceResponse difference = new ReconciliationDifferenceResponse();
        difference.setDiffType("amount_mismatch");
        difference.setBusinessNo("RF20260602001");
        difference.setExpectedAmount(new BigDecimal("66.00"));
        difference.setActualAmount(new BigDecimal("60.00"));
        difference.setDiffAmount(new BigDecimal("6.00"));
        difference.setReason("退款金额不一致");
        difference.setStatus("open");
        ReconciliationSourceResponse source = new ReconciliationSourceResponse();
        source.setSummaryJson("{\"支付笔数\":1,\"退款笔数\":0,\"差异数\":1}");
        source.setDetails(List.of(detail));
        source.setDifferences(List.of(difference));
        when(paymentReconciliationInternalClient.getLocalReconciliation(
                eq(LocalDate.of(2026, 6, 2)), eq("omni-local-internal-token")))
                .thenReturn(Result.success(source));

        ReconciliationBatchResponse response = service.createBatch(request);

        assertEquals(LocalDate.of(2026, 6, 2), response.getBizDate());
        assertNotNull(response.getBatchNo());
        assertEquals("{\"支付笔数\":1,\"退款笔数\":0,\"差异数\":1}", response.getSummaryJson());
        ArgumentCaptor<ReconciliationDetail> detailCaptor = ArgumentCaptor.forClass(ReconciliationDetail.class);
        ArgumentCaptor<ReconciliationDifference> differenceCaptor = ArgumentCaptor.forClass(ReconciliationDifference.class);
        verify(batchMapper).insert(any(ReconciliationBatch.class));
        verify(detailMapper).insert(detailCaptor.capture());
        verify(differenceMapper).insert(differenceCaptor.capture());
        assertEquals(response.getBatchNo(), detailCaptor.getValue().getBatchNo());
        assertEquals("PAY20260602001", detailCaptor.getValue().getBusinessNo());
        assertEquals(response.getBatchNo(), differenceCaptor.getValue().getBatchNo());
        assertEquals("RF20260602001", differenceCaptor.getValue().getBusinessNo());
    }

    @Test
    void createsZeroSummaryDetailWhenLocalReconciliationHasNoTransactions() {
        when(batchMapper.insert(any(ReconciliationBatch.class))).thenAnswer(invocation -> {
            ReconciliationBatch batch = invocation.getArgument(0);
            batch.setId(2L);
            return 1;
        });
        ReconciliationSourceResponse source = new ReconciliationSourceResponse();
        source.setSummaryJson("{\"支付笔数\":0,\"退款笔数\":0,\"差异数\":0}");
        source.setDetails(List.of());
        source.setDifferences(List.of());
        when(paymentReconciliationInternalClient.getLocalReconciliation(
                eq(LocalDate.of(2026, 6, 3)), eq("omni-local-internal-token")))
                .thenReturn(Result.success(source));

        ReconciliationBatchCreateRequest request = new ReconciliationBatchCreateRequest();
        request.setBizDate(LocalDate.of(2026, 6, 3));
        ReconciliationBatchResponse response = service.createBatch(request);

        ArgumentCaptor<ReconciliationDetail> detailCaptor = ArgumentCaptor.forClass(ReconciliationDetail.class);
        verify(detailMapper).insert(detailCaptor.capture());
        verify(differenceMapper, never()).insert(any(ReconciliationDifference.class));
        assertEquals(response.getBatchNo(), detailCaptor.getValue().getBatchNo());
        assertEquals(response.getBatchNo(), detailCaptor.getValue().getBusinessNo());
        assertEquals("summary", detailCaptor.getValue().getBusinessType());
        assertEquals(new BigDecimal("0.00"), detailCaptor.getValue().getExpectedAmount());
        assertEquals(new BigDecimal("0.00"), detailCaptor.getValue().getActualAmount());
        assertEquals("matched", detailCaptor.getValue().getStatus());
    }

    @Test
    void listsExistingBatchesForConsoleWorkbench() {
        ReconciliationBatch batch = new ReconciliationBatch();
        batch.setId(5L);
        batch.setBatchNo("REC20260602-00000001");
        batch.setBizDate(LocalDate.of(2026, 6, 2));
        batch.setSourceType("local");
        batch.setStatus("generated");
        when(batchMapper.selectList(any())).thenReturn(List.of(batch));

        List<ReconciliationBatchResponse> batches = service.listBatches();

        assertEquals(1, batches.size());
        assertEquals("REC20260602-00000001", batches.get(0).getBatchNo());
    }

    @Test
    void getsBatchDetailWithRecordsAndDifferences() {
        ReconciliationBatch batch = new ReconciliationBatch();
        batch.setId(8L);
        batch.setBatchNo("REC20260603-363F0A8A");
        batch.setBizDate(LocalDate.of(2026, 6, 3));
        batch.setSourceType("local");
        batch.setStatus("generated");

        ReconciliationDetail detail = new ReconciliationDetail();
        detail.setId(3L);
        detail.setBatchNo("REC20260603-363F0A8A");
        detail.setBusinessNo("PAY20260603001");
        detail.setBusinessType("payment");
        detail.setExpectedAmount(new BigDecimal("128.00"));
        detail.setActualAmount(new BigDecimal("128.00"));
        detail.setStatus("matched");

        ReconciliationDifference difference = new ReconciliationDifference();
        difference.setId(4L);
        difference.setBatchNo("REC20260603-363F0A8A");
        difference.setDiffType("amount_mismatch");
        difference.setBusinessNo("RF20260603001");
        difference.setExpectedAmount(new BigDecimal("66.00"));
        difference.setActualAmount(new BigDecimal("60.00"));
        difference.setDiffAmount(new BigDecimal("6.00"));
        difference.setReason("退款金额不一致");
        difference.setStatus("open");

        when(batchMapper.selectOne(any())).thenReturn(batch);
        when(detailMapper.selectList(any())).thenReturn(List.of(detail));
        when(differenceMapper.selectList(any())).thenReturn(List.of(difference));

        ReconciliationBatchDetailResponse response = service.getBatchDetail("REC20260603-363F0A8A");

        assertEquals("REC20260603-363F0A8A", response.getBatch().getBatchNo());
        assertEquals("PAY20260603001", response.getDetails().get(0).getBusinessNo());
        assertEquals("amount_mismatch", response.getDifferences().get(0).getDiffType());
    }
}
