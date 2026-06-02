package com.omni.user.service;

import com.omni.common.dto.ReconciliationBatchCreateRequest;
import com.omni.common.dto.ReconciliationBatchResponse;
import com.omni.user.entity.ReconciliationBatch;
import com.omni.user.mapper.ReconciliationBatchMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class ReconciliationService {

    private final ReconciliationBatchMapper batchMapper;

    public ReconciliationService(ReconciliationBatchMapper batchMapper) {
        this.batchMapper = batchMapper;
    }

    @Transactional
    public ReconciliationBatchResponse createBatch(ReconciliationBatchCreateRequest request) {
        ReconciliationBatch batch = new ReconciliationBatch();
        String batchNo = "REC" + request.getBizDate().toString().replace("-", "")
                + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        batch.setBatchNo(batchNo);
        batch.setBizDate(request.getBizDate());
        batch.setSourceType("local");
        batch.setStatus("generated");
        batch.setCreateTime(LocalDateTime.now());
        batch.setUpdateTime(LocalDateTime.now());
        batchMapper.insert(batch);
        return toResponse(batch);
    }

    private ReconciliationBatchResponse toResponse(ReconciliationBatch batch) {
        ReconciliationBatchResponse resp = new ReconciliationBatchResponse();
        resp.setId(batch.getId());
        resp.setBatchNo(batch.getBatchNo());
        resp.setBizDate(batch.getBizDate());
        resp.setSourceType(batch.getSourceType());
        resp.setStatus(batch.getStatus());
        resp.setSummaryJson(batch.getSummaryJson());
        resp.setCreateTime(batch.getCreateTime());
        return resp;
    }
}
