package com.omni.payment.service;

import com.omni.common.dto.ReconciliationSourceResponse;
import com.omni.payment.entity.Payment;
import com.omni.payment.entity.RefundRequest;
import com.omni.payment.mapper.PaymentMapper;
import com.omni.payment.mapper.RefundRequestMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PaymentReconciliationServiceTest {

    private PaymentMapper paymentMapper;
    private RefundRequestMapper refundRequestMapper;
    private PaymentReconciliationService service;

    @BeforeEach
    void setUp() {
        paymentMapper = mock(PaymentMapper.class);
        refundRequestMapper = mock(RefundRequestMapper.class);
        service = new PaymentReconciliationService(paymentMapper, refundRequestMapper);
    }

    @Test
    void buildsLocalReconciliationSourceFromSuccessfulPaymentsAndRefunds() {
        Payment payment = new Payment();
        payment.setPaymentNo("PAY20260602001");
        payment.setAmount(new BigDecimal("128.00"));
        payment.setStatus(1);
        payment.setPayTime(LocalDateTime.of(2026, 6, 2, 10, 15));
        RefundRequest refund = new RefundRequest();
        refund.setRefundNo("RF20260602001");
        refund.setAmount(new BigDecimal("32.00"));
        refund.setStatus(1);
        refund.setRefundTime(LocalDateTime.of(2026, 6, 2, 13, 30));
        when(paymentMapper.selectList(any())).thenReturn(List.of(payment));
        when(refundRequestMapper.selectList(any())).thenReturn(List.of(refund));

        ReconciliationSourceResponse response = service.getLocalReconciliation(LocalDate.of(2026, 6, 2));

        assertEquals(2, response.getDetails().size());
        assertEquals("PAY20260602001", response.getDetails().get(0).getBusinessNo());
        assertEquals("payment", response.getDetails().get(0).getBusinessType());
        assertEquals("RF20260602001", response.getDetails().get(1).getBusinessNo());
        assertEquals("refund", response.getDetails().get(1).getBusinessType());
        assertEquals(0, response.getDifferences().size());
        assertTrue(response.getSummaryJson().contains("\"支付笔数\":1"));
        assertTrue(response.getSummaryJson().contains("\"退款笔数\":1"));
        assertTrue(response.getSummaryJson().contains("\"差异数\":0"));
    }

    @Test
    void returnsEmptySourceAndZeroSummaryWhenNoTransactionsExist() {
        when(paymentMapper.selectList(any())).thenReturn(List.of());
        when(refundRequestMapper.selectList(any())).thenReturn(List.of());

        ReconciliationSourceResponse response = service.getLocalReconciliation(LocalDate.of(2026, 6, 3));

        assertEquals(0, response.getDetails().size());
        assertEquals(0, response.getDifferences().size());
        assertTrue(response.getSummaryJson().contains("\"支付笔数\":0"));
        assertTrue(response.getSummaryJson().contains("\"退款笔数\":0"));
        assertTrue(response.getSummaryJson().contains("\"差异数\":0"));
    }
}
