package com.omni.user.service;

import com.omni.common.dto.ExceptionTaskResponse;
import com.omni.common.dto.ReconciliationBatchResponse;
import com.omni.common.result.Result;
import com.omni.user.client.GrabOpsSummaryClient;
import com.omni.user.client.PaymentOpsSummaryClient;
import com.omni.user.client.TicketOpsSummaryClient;
import com.omni.user.dto.OperationAuditLogResponse;
import com.omni.user.dto.PlatformOpsSummaryResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PlatformOpsSummaryServiceTest {

    private TicketOpsSummaryClient ticketClient;
    private PaymentOpsSummaryClient paymentClient;
    private GrabOpsSummaryClient grabClient;
    private ExceptionWorkbenchService exceptionWorkbenchService;
    private ReconciliationService reconciliationService;
    private OperationAuditService operationAuditService;
    private PlatformOpsSummaryService service;

    @BeforeEach
    void setUp() {
        ticketClient = mock(TicketOpsSummaryClient.class);
        paymentClient = mock(PaymentOpsSummaryClient.class);
        grabClient = mock(GrabOpsSummaryClient.class);
        exceptionWorkbenchService = mock(ExceptionWorkbenchService.class);
        reconciliationService = mock(ReconciliationService.class);
        operationAuditService = mock(OperationAuditService.class);
        service = new PlatformOpsSummaryService(
                ticketClient,
                paymentClient,
                grabClient,
                exceptionWorkbenchService,
                reconciliationService,
                operationAuditService
        );
    }

    @Test
    void aggregatesPlatformOperationsSummaryFromDownstreamAndLocalSources() {
        String authorization = "Bearer admin-token";
        PlatformOpsSummaryResponse.TicketSummary ticket = new PlatformOpsSummaryResponse.TicketSummary();
        ticket.setOrderCount(10L);
        ticket.setPaidOrderCount(7L);
        ticket.setPaymentTimeoutCount(2L);
        ticket.setInterestCount(5L);
        ticket.setReminderCount(3L);
        ticket.setRiskCheckCount(4L);
        ticket.setRiskHitCount(1L);
        ticket.setHotActivities(List.of(new PlatformOpsSummaryResponse.HotActivity(900001L, "热门活动", 8L, 7L)));
        when(ticketClient.getAdminSummary(eq(authorization))).thenReturn(Result.success(ticket));

        PlatformOpsSummaryResponse.RefundRequestItem refundOk = refund(1);
        PlatformOpsSummaryResponse.RefundRequestItem refundAbnormal = refund(4);
        when(paymentClient.listAdminRefunds(eq(authorization), eq(null))).thenReturn(Result.success(List.of(refundOk, refundAbnormal)));

        PlatformOpsSummaryResponse.GrabSummary grab = new PlatformOpsSummaryResponse.GrabSummary();
        grab.setFailureReasons(List.of(new PlatformOpsSummaryResponse.CountItem("票档售罄", 6L)));
        PlatformOpsSummaryResponse.WaitlistSummary waitlist = new PlatformOpsSummaryResponse.WaitlistSummary();
        waitlist.setTotalCount(10L);
        waitlist.setPaidCount(4L);
        waitlist.setConversionRate(0.4);
        grab.setWaitlist(waitlist);
        when(grabClient.getGrabOpsSummary(eq(authorization))).thenReturn(Result.success(grab));

        when(exceptionWorkbenchService.listByStatus(null)).thenReturn(List.of(exceptionTask("pending"), exceptionTask("resolved")));
        ReconciliationBatchResponse batch = new ReconciliationBatchResponse();
        batch.setBatchNo("REAL-DEMO-20260603");
        batch.setBizDate(LocalDate.of(2026, 6, 3));
        batch.setStatus("generated");
        when(reconciliationService.listBatches()).thenReturn(List.of(batch));
        OperationAuditLogResponse audit = new OperationAuditLogResponse();
        audit.setId(9L);
        audit.setAction("exception_task.claim");
        audit.setCreateTime(LocalDateTime.of(2026, 6, 9, 9, 0));
        when(operationAuditService.list(null, null, null, null, null, 5)).thenReturn(List.of(audit));

        PlatformOpsSummaryResponse response = service.load(authorization);

        assertNotNull(response.getGeneratedAt());
        assertEquals(0, response.getErrors().size());
        assertEquals(5L, response.funnelCount("interest"));
        assertEquals(10L, response.funnelCount("order"));
        assertEquals(7L, response.funnelCount("paid"));
        assertEquals(2L, response.funnelCount("payment_timeout"));
        assertEquals(2L, response.funnelCount("refund"));
        assertEquals(1L, response.funnelCount("refund_abnormal"));
        assertEquals(6L, response.funnelCount("grab_failed"));
        assertEquals(4L, response.funnelCount("waitlist_paid"));
        assertEquals(1, response.getWorkbench().getPendingExceptionCount());
        assertEquals("REAL-DEMO-20260603", response.getWorkbench().getLatestBatch().getBatchNo());
        assertEquals("exception_task.claim", response.getWorkbench().getLatestAudit().getAction());
    }

    @Test
    void keepsDashboardUsableWhenGrabSummaryFails() {
        String authorization = "Bearer admin-token";
        PlatformOpsSummaryResponse.TicketSummary ticket = new PlatformOpsSummaryResponse.TicketSummary();
        ticket.setOrderCount(2L);
        ticket.setPaidOrderCount(1L);
        when(ticketClient.getAdminSummary(eq(authorization))).thenReturn(Result.success(ticket));
        when(paymentClient.listAdminRefunds(eq(authorization), eq(null))).thenReturn(Result.success(List.of()));
        when(grabClient.getGrabOpsSummary(eq(authorization))).thenThrow(new RuntimeException("grab down"));
        when(exceptionWorkbenchService.listByStatus(null)).thenReturn(List.of());
        when(reconciliationService.listBatches()).thenReturn(List.of());
        when(operationAuditService.list(null, null, null, null, null, 5)).thenReturn(List.of());

        PlatformOpsSummaryResponse response = service.load(authorization);

        assertEquals(2L, response.funnelCount("order"));
        assertEquals(1L, response.funnelCount("paid"));
        assertEquals(1, response.getErrors().size());
        assertEquals("grab", response.getErrors().get(0).getSource());
        assertEquals("抢票运营摘要暂不可用", response.getErrors().get(0).getMessage());
    }

    private PlatformOpsSummaryResponse.RefundRequestItem refund(Integer status) {
        PlatformOpsSummaryResponse.RefundRequestItem refund = new PlatformOpsSummaryResponse.RefundRequestItem();
        refund.setStatus(status);
        return refund;
    }

    private ExceptionTaskResponse exceptionTask(String status) {
        ExceptionTaskResponse task = new ExceptionTaskResponse();
        task.setStatus(status);
        return task;
    }
}
