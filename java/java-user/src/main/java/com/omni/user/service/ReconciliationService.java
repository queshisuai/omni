package com.omni.user.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.omni.common.dto.ReconciliationBatchCreateRequest;
import com.omni.common.dto.ReconciliationBatchDetailResponse;
import com.omni.common.dto.ReconciliationBatchResponse;
import com.omni.common.dto.ReconciliationDetailResponse;
import com.omni.common.dto.ReconciliationDifferenceResponse;
import com.omni.common.dto.ReconciliationSourceResponse;
import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.user.client.PaymentReconciliationInternalClient;
import com.omni.user.entity.ReconciliationBatch;
import com.omni.user.entity.ReconciliationDetail;
import com.omni.user.entity.ReconciliationDifference;
import com.omni.user.mapper.ReconciliationBatchMapper;
import com.omni.user.mapper.ReconciliationDetailMapper;
import com.omni.user.mapper.ReconciliationDifferenceMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ReconciliationService {

    private static final BigDecimal ZERO_AMOUNT = new BigDecimal("0.00");
    private static final String DIFFERENCE_STATUS_OPEN = "open";
    private static final String DIFFERENCE_STATUS_RESOLVED = "resolved";
    private static final String DIFFERENCE_STATUS_IGNORED = "ignored";
    private static final String BATCH_STATUS_PROCESSING = "processing";
    private static final String BATCH_STATUS_COMPLETED = "completed";

    private final ReconciliationBatchMapper batchMapper;
    private final ReconciliationDetailMapper detailMapper;
    private final ReconciliationDifferenceMapper differenceMapper;
    private final PaymentReconciliationInternalClient paymentReconciliationInternalClient;
    private final String internalApiToken;

    public ReconciliationService(ReconciliationBatchMapper batchMapper,
                                 ReconciliationDetailMapper detailMapper,
                                 ReconciliationDifferenceMapper differenceMapper,
                                 PaymentReconciliationInternalClient paymentReconciliationInternalClient,
                                 @Value("${internal.api.token:${INTERNAL_API_TOKEN:omni-local-internal-token}}") String internalApiToken) {
        this.batchMapper = batchMapper;
        this.detailMapper = detailMapper;
        this.differenceMapper = differenceMapper;
        this.paymentReconciliationInternalClient = paymentReconciliationInternalClient;
        this.internalApiToken = internalApiToken;
    }

    @Transactional
    public ReconciliationBatchResponse createBatch(ReconciliationBatchCreateRequest request) {
        if (request == null || request.getBizDate() == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "对账日期不能为空");
        }
        ReconciliationSourceResponse source = fetchLocalSource(request);
        LocalDateTime now = LocalDateTime.now();
        String batchNo = "REC" + request.getBizDate().toString().replace("-", "")
                + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        ReconciliationBatch batch = new ReconciliationBatch();
        batch.setBatchNo(batchNo);
        batch.setBizDate(request.getBizDate());
        batch.setSourceType("local");
        batch.setStatus("generated");
        batch.setSummaryJson(resolveSummaryJson(source, request.getBizDate().toString()));
        batch.setCreateTime(now);
        batch.setUpdateTime(now);
        batchMapper.insert(batch);
        persistDetails(batchNo, source.getDetails(), now);
        persistDifferences(batchNo, source.getDifferences(), now);
        return toResponse(batch);
    }

    public List<ReconciliationBatchResponse> listBatches() {
        List<ReconciliationBatch> batches = batchMapper.selectList(new LambdaQueryWrapper<ReconciliationBatch>()
                .orderByDesc(ReconciliationBatch::getBizDate)
                .orderByDesc(ReconciliationBatch::getId));
        return batches.stream().map(this::toResponse).collect(Collectors.toList());
    }

    public ReconciliationBatchDetailResponse getBatchDetail(String batchNo) {
        if (!StringUtils.hasText(batchNo)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "对账批次号不能为空");
        }
        String normalizedBatchNo = batchNo.trim();
        ReconciliationBatch batch = batchMapper.selectOne(new LambdaQueryWrapper<ReconciliationBatch>()
                .eq(ReconciliationBatch::getBatchNo, normalizedBatchNo));
        if (batch == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "对账批次不存在");
        }

        List<ReconciliationDetailResponse> details = detailMapper.selectList(new LambdaQueryWrapper<ReconciliationDetail>()
                        .eq(ReconciliationDetail::getBatchNo, normalizedBatchNo)
                        .orderByAsc(ReconciliationDetail::getCreateTime)
                        .orderByAsc(ReconciliationDetail::getId))
                .stream()
                .map(this::toDetailResponse)
                .collect(Collectors.toList());
        List<ReconciliationDifferenceResponse> differences = differenceMapper.selectList(new LambdaQueryWrapper<ReconciliationDifference>()
                        .eq(ReconciliationDifference::getBatchNo, normalizedBatchNo)
                        .orderByAsc(ReconciliationDifference::getCreateTime)
                        .orderByAsc(ReconciliationDifference::getId))
                .stream()
                .map(this::toDifferenceResponse)
                .collect(Collectors.toList());

        ReconciliationBatchDetailResponse response = new ReconciliationBatchDetailResponse();
        response.setBatch(toResponse(batch));
        response.setDetails(details);
        response.setDifferences(differences);
        return response;
    }

    @Transactional
    public ReconciliationDifferenceResponse resolveDifference(String batchNo, Long differenceId) {
        return updateDifferenceStatus(batchNo, differenceId, DIFFERENCE_STATUS_RESOLVED);
    }

    @Transactional
    public ReconciliationDifferenceResponse ignoreDifference(String batchNo, Long differenceId) {
        return updateDifferenceStatus(batchNo, differenceId, DIFFERENCE_STATUS_IGNORED);
    }

    private ReconciliationDifferenceResponse updateDifferenceStatus(String batchNo, Long differenceId, String status) {
        ReconciliationBatch batch = loadBatch(batchNo);
        ReconciliationDifference difference = loadDifference(batch.getBatchNo(), differenceId);
        if (!DIFFERENCE_STATUS_OPEN.equals(difference.getStatus())) {
            throw new BusinessException(ResultCode.CONFLICT, "只有待处理差异可以操作");
        }
        difference.setStatus(status);
        differenceMapper.updateById(difference);
        refreshBatchStatus(batch);
        return toDifferenceResponse(difference);
    }

    private ReconciliationBatch loadBatch(String batchNo) {
        if (!StringUtils.hasText(batchNo)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "对账批次号不能为空");
        }
        ReconciliationBatch batch = batchMapper.selectOne(new LambdaQueryWrapper<ReconciliationBatch>()
                .eq(ReconciliationBatch::getBatchNo, batchNo.trim()));
        if (batch == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "对账批次不存在");
        }
        return batch;
    }

    private ReconciliationDifference loadDifference(String batchNo, Long differenceId) {
        if (differenceId == null || differenceId <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "对账差异ID不能为空");
        }
        ReconciliationDifference difference = differenceMapper.selectOne(new LambdaQueryWrapper<ReconciliationDifference>()
                .eq(ReconciliationDifference::getBatchNo, batchNo)
                .eq(ReconciliationDifference::getId, differenceId));
        if (difference == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "对账差异不存在");
        }
        return difference;
    }

    private void refreshBatchStatus(ReconciliationBatch batch) {
        Long openCount = differenceMapper.selectCount(new LambdaQueryWrapper<ReconciliationDifference>()
                .eq(ReconciliationDifference::getBatchNo, batch.getBatchNo())
                .eq(ReconciliationDifference::getStatus, DIFFERENCE_STATUS_OPEN));
        batch.setStatus(openCount != null && openCount > 0 ? BATCH_STATUS_PROCESSING : BATCH_STATUS_COMPLETED);
        batch.setUpdateTime(LocalDateTime.now());
        batchMapper.updateById(batch);
    }

    private ReconciliationSourceResponse fetchLocalSource(ReconciliationBatchCreateRequest request) {
        try {
            Result<ReconciliationSourceResponse> result = paymentReconciliationInternalClient
                    .getLocalReconciliation(request.getBizDate(), internalApiToken);
            if (result == null || result.getCode() != ResultCode.SUCCESS.getCode() || result.getData() == null) {
                String message = result != null && StringUtils.hasText(result.getMessage())
                        ? result.getMessage()
                        : "支付对账数据为空";
                throw new BusinessException(ResultCode.INTERNAL_ERROR, "生成对账明细失败：" + message);
            }
            return result.getData();
        } catch (BusinessException e) {
            throw e;
        } catch (RuntimeException e) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "生成对账明细失败，请稍后重试");
        }
    }

    private void persistDetails(String batchNo, List<ReconciliationDetailResponse> sourceDetails, LocalDateTime now) {
        if (sourceDetails == null || sourceDetails.isEmpty()) {
            detailMapper.insert(createZeroSummaryDetail(batchNo, now));
            return;
        }
        for (ReconciliationDetailResponse sourceDetail : sourceDetails) {
            ReconciliationDetail detail = new ReconciliationDetail();
            detail.setBatchNo(batchNo);
            detail.setBusinessNo(StringUtils.hasText(sourceDetail.getBusinessNo()) ? sourceDetail.getBusinessNo() : batchNo);
            detail.setBusinessType(StringUtils.hasText(sourceDetail.getBusinessType()) ? sourceDetail.getBusinessType() : "summary");
            detail.setExpectedAmount(amountOrZero(sourceDetail.getExpectedAmount()));
            detail.setActualAmount(amountOrZero(sourceDetail.getActualAmount()));
            detail.setStatus(StringUtils.hasText(sourceDetail.getStatus()) ? sourceDetail.getStatus() : "matched");
            detail.setCreateTime(now);
            detailMapper.insert(detail);
        }
    }

    private void persistDifferences(String batchNo, List<ReconciliationDifferenceResponse> sourceDifferences, LocalDateTime now) {
        if (sourceDifferences == null || sourceDifferences.isEmpty()) {
            return;
        }
        for (ReconciliationDifferenceResponse sourceDifference : sourceDifferences) {
            ReconciliationDifference difference = new ReconciliationDifference();
            difference.setBatchNo(batchNo);
            difference.setDiffType(StringUtils.hasText(sourceDifference.getDiffType()) ? sourceDifference.getDiffType() : "unknown");
            difference.setBusinessNo(sourceDifference.getBusinessNo());
            difference.setExpectedAmount(sourceDifference.getExpectedAmount());
            difference.setActualAmount(sourceDifference.getActualAmount());
            difference.setDiffAmount(sourceDifference.getDiffAmount());
            difference.setReason(sourceDifference.getReason());
            difference.setStatus(StringUtils.hasText(sourceDifference.getStatus()) ? sourceDifference.getStatus() : "open");
            difference.setCreateTime(now);
            differenceMapper.insert(difference);
        }
    }

    private ReconciliationDetail createZeroSummaryDetail(String batchNo, LocalDateTime now) {
        ReconciliationDetail detail = new ReconciliationDetail();
        detail.setBatchNo(batchNo);
        detail.setBusinessNo(batchNo);
        detail.setBusinessType("summary");
        detail.setExpectedAmount(ZERO_AMOUNT);
        detail.setActualAmount(ZERO_AMOUNT);
        detail.setStatus("matched");
        detail.setCreateTime(now);
        return detail;
    }

    private String resolveSummaryJson(ReconciliationSourceResponse source, String bizDate) {
        if (source != null && StringUtils.hasText(source.getSummaryJson())) {
            return source.getSummaryJson();
        }
        return "{\"业务日期\":\"" + bizDate + "\",\"支付笔数\":0,\"支付金额\":\"0.00\","
                + "\"退款笔数\":0,\"退款金额\":\"0.00\",\"净额\":\"0.00\",\"差异数\":0}";
    }

    private BigDecimal amountOrZero(BigDecimal amount) {
        return amount == null ? ZERO_AMOUNT : amount;
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

    private ReconciliationDetailResponse toDetailResponse(ReconciliationDetail detail) {
        ReconciliationDetailResponse response = new ReconciliationDetailResponse();
        response.setId(detail.getId());
        response.setBatchNo(detail.getBatchNo());
        response.setBusinessNo(detail.getBusinessNo());
        response.setBusinessType(detail.getBusinessType());
        response.setExpectedAmount(detail.getExpectedAmount());
        response.setActualAmount(detail.getActualAmount());
        response.setStatus(detail.getStatus());
        response.setCreateTime(detail.getCreateTime());
        return response;
    }

    private ReconciliationDifferenceResponse toDifferenceResponse(ReconciliationDifference difference) {
        ReconciliationDifferenceResponse response = new ReconciliationDifferenceResponse();
        response.setId(difference.getId());
        response.setBatchNo(difference.getBatchNo());
        response.setDiffType(difference.getDiffType());
        response.setBusinessNo(difference.getBusinessNo());
        response.setExpectedAmount(difference.getExpectedAmount());
        response.setActualAmount(difference.getActualAmount());
        response.setDiffAmount(difference.getDiffAmount());
        response.setReason(difference.getReason());
        response.setStatus(difference.getStatus());
        response.setCreateTime(difference.getCreateTime());
        return response;
    }
}
