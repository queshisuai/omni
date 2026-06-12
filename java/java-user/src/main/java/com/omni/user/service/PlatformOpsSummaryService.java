package com.omni.user.service;

import com.omni.common.dto.ExceptionTaskResponse;
import com.omni.common.dto.ReconciliationBatchResponse;
import com.omni.common.result.Result;
import com.omni.common.result.ResultCode;
import com.omni.user.client.GrabOpsSummaryClient;
import com.omni.user.client.PaymentOpsSummaryClient;
import com.omni.user.client.TicketOpsSummaryClient;
import com.omni.user.dto.OperationAuditLogResponse;
import com.omni.user.dto.PlatformOpsSummaryResponse;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

@Service
public class PlatformOpsSummaryService {

    private final TicketOpsSummaryClient ticketClient;
    private final PaymentOpsSummaryClient paymentClient;
    private final GrabOpsSummaryClient grabClient;
    private final ExceptionWorkbenchService exceptionWorkbenchService;
    private final ReconciliationService reconciliationService;
    private final OperationAuditService operationAuditService;

    public PlatformOpsSummaryService(TicketOpsSummaryClient ticketClient,
                                     PaymentOpsSummaryClient paymentClient,
                                     GrabOpsSummaryClient grabClient,
                                     ExceptionWorkbenchService exceptionWorkbenchService,
                                     ReconciliationService reconciliationService,
                                     OperationAuditService operationAuditService) {
        this.ticketClient = ticketClient;
        this.paymentClient = paymentClient;
        this.grabClient = grabClient;
        this.exceptionWorkbenchService = exceptionWorkbenchService;
        this.reconciliationService = reconciliationService;
        this.operationAuditService = operationAuditService;
    }

    public PlatformOpsSummaryResponse load(String authorization) {
        PlatformOpsSummaryResponse response = new PlatformOpsSummaryResponse();
        response.setGeneratedAt(LocalDateTime.now());

        PlatformOpsSummaryResponse.TicketSummary ticket = loadTicket(response, authorization);
        PlatformOpsSummaryResponse.RefundSummary refund = loadRefund(response, authorization);
        PlatformOpsSummaryResponse.GrabSummary grab = loadGrab(response, authorization);
        response.setTicket(ticket);
        response.setRefund(refund);
        response.setGrab(grab);
        response.setWorkbench(loadWorkbench(response));
        response.setFunnelSteps(List.of(
                new PlatformOpsSummaryResponse.FunnelStep("interest", "想看/候补", safe(ticket.getInterestCount())),
                new PlatformOpsSummaryResponse.FunnelStep("reminder", "开售提醒", safe(ticket.getReminderCount())),
                new PlatformOpsSummaryResponse.FunnelStep("order", "下单", safe(ticket.getOrderCount())),
                new PlatformOpsSummaryResponse.FunnelStep("paid", "支付", safe(ticket.getPaidOrderCount())),
                new PlatformOpsSummaryResponse.FunnelStep("payment_timeout", "支付超时", safe(ticket.getPaymentTimeoutCount())),
                new PlatformOpsSummaryResponse.FunnelStep("refund", "退款申请", safe(refund.getTotalCount())),
                new PlatformOpsSummaryResponse.FunnelStep("refund_abnormal", "退款异常", safe(refund.getAbnormalCount())),
                new PlatformOpsSummaryResponse.FunnelStep("grab_failed", "抢票失败", grabFailedCount(grab)),
                new PlatformOpsSummaryResponse.FunnelStep("waitlist_paid", "候补支付", safe(grab.getWaitlist().getPaidCount()))
        ));
        return response;
    }

    private PlatformOpsSummaryResponse.TicketSummary loadTicket(PlatformOpsSummaryResponse response, String authorization) {
        try {
            Result<PlatformOpsSummaryResponse.TicketSummary> result = ticketClient.getAdminSummary(authorization);
            if (isSuccess(result) && result.getData() != null) {
                return result.getData();
            }
        } catch (RuntimeException ignored) {
            // fall through to partial error
        }
        response.getErrors().add(new PlatformOpsSummaryResponse.DownstreamError("ticket", "票务运营摘要暂不可用"));
        return new PlatformOpsSummaryResponse.TicketSummary();
    }

    private PlatformOpsSummaryResponse.RefundSummary loadRefund(PlatformOpsSummaryResponse response, String authorization) {
        try {
            Result<List<PlatformOpsSummaryResponse.RefundRequestItem>> result = paymentClient.listAdminRefunds(authorization, null);
            if (isSuccess(result)) {
                return summarizeRefunds(result.getData());
            }
        } catch (RuntimeException ignored) {
            // fall through to partial error
        }
        response.getErrors().add(new PlatformOpsSummaryResponse.DownstreamError("payment", "退款运营摘要暂不可用"));
        return new PlatformOpsSummaryResponse.RefundSummary();
    }

    private PlatformOpsSummaryResponse.GrabSummary loadGrab(PlatformOpsSummaryResponse response, String authorization) {
        try {
            Result<PlatformOpsSummaryResponse.GrabSummary> result = grabClient.getGrabOpsSummary(authorization);
            if (isSuccess(result) && result.getData() != null) {
                return result.getData();
            }
        } catch (RuntimeException ignored) {
            // fall through to partial error
        }
        response.getErrors().add(new PlatformOpsSummaryResponse.DownstreamError("grab", "抢票运营摘要暂不可用"));
        return new PlatformOpsSummaryResponse.GrabSummary();
    }

    private PlatformOpsSummaryResponse.WorkbenchSummary loadWorkbench(PlatformOpsSummaryResponse response) {
        PlatformOpsSummaryResponse.WorkbenchSummary summary = new PlatformOpsSummaryResponse.WorkbenchSummary();
        try {
            long pendingCount = exceptionWorkbenchService.listByStatus(null).stream()
                    .filter(task -> task != null && !"resolved".equals(task.getStatus()) && !"closed".equals(task.getStatus()))
                    .count();
            summary.setPendingExceptionCount((int) pendingCount);
            List<ReconciliationBatchResponse> batches = reconciliationService.listBatches();
            summary.setLatestBatch(batches == null || batches.isEmpty() ? null : batches.get(0));
            List<OperationAuditLogResponse> audits = operationAuditService.list(null, null, null, null, null, 5);
            summary.setLatestAudit(audits == null || audits.isEmpty() ? null : audits.get(0));
        } catch (RuntimeException ignored) {
            response.getErrors().add(new PlatformOpsSummaryResponse.DownstreamError("workbench", "工作台摘要暂不可用"));
        }
        return summary;
    }

    private PlatformOpsSummaryResponse.RefundSummary summarizeRefunds(List<PlatformOpsSummaryResponse.RefundRequestItem> refunds) {
        List<PlatformOpsSummaryResponse.RefundRequestItem> safeRefunds = refunds == null ? Collections.emptyList() : refunds;
        long abnormalCount = safeRefunds.stream()
                .filter(Objects::nonNull)
                .filter(refund -> Integer.valueOf(3).equals(refund.getStatus()) || Integer.valueOf(4).equals(refund.getStatus()))
                .count();
        PlatformOpsSummaryResponse.RefundSummary summary = new PlatformOpsSummaryResponse.RefundSummary();
        summary.setTotalCount((long) safeRefunds.size());
        summary.setAbnormalCount(abnormalCount);
        return summary;
    }

    private boolean isSuccess(Result<?> result) {
        return result != null && result.getCode() == ResultCode.SUCCESS.getCode();
    }

    private Long grabFailedCount(PlatformOpsSummaryResponse.GrabSummary grab) {
        if (grab == null || grab.getFailureReasons() == null) {
            return 0L;
        }
        return grab.getFailureReasons().stream()
                .filter(Objects::nonNull)
                .map(PlatformOpsSummaryResponse.CountItem::getCount)
                .filter(Objects::nonNull)
                .reduce(0L, Long::sum);
    }

    private Long safe(Long value) {
        return value == null ? 0L : value;
    }
}
