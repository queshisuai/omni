package com.omni.payment.service;

import com.alipay.api.AlipayClient;
import com.alipay.api.request.AlipayTradePrecreateRequest;
import com.alipay.api.response.AlipayTradePrecreateResponse;
import com.omni.common.result.Result;
import com.omni.exception.BusinessException;
import com.omni.payment.client.OrderClient;
import com.omni.payment.config.AlipayProperties;
import com.omni.payment.dto.OrderInfoResponse;
import com.omni.payment.dto.QrPayResponse;
import com.omni.payment.entity.Payment;
import com.omni.payment.mapper.PaymentMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AlipayServiceTest {

    private AlipayProperties properties;
    private OrderClient orderClient;
    private PaymentMapper paymentMapper;
    private AlipayClient alipayClient;
    private AlipayService service;

    @BeforeEach
    void setUp() {
        properties = new AlipayProperties();
        properties.setGatewayUrl("https://openapi-sandbox.dl.alipaydev.com/gateway.do");
        properties.setAppId("app-id");
        properties.setMerchantPrivateKey("merchant-private-key");
        properties.setAlipayPublicKey("alipay-public-key");
        orderClient = mock(OrderClient.class);
        paymentMapper = mock(PaymentMapper.class);
        alipayClient = mock(AlipayClient.class);
        service = new AlipayService(properties, orderClient, paymentMapper, "internal-token", () -> alipayClient);
    }

    @Test
    void createQrPayCreatesPendingPaymentAndReturnsQrCode() throws Exception {
        OrderInfoResponse order = order(10L, "DM1001", new BigDecimal("280.00"), 1);
        when(orderClient.getOrder(10L, "internal-token")).thenReturn(Result.success(order));
        when(paymentMapper.selectOne(any())).thenReturn(null);

        AlipayTradePrecreateResponse response = mock(AlipayTradePrecreateResponse.class);
        when(response.isSuccess()).thenReturn(true);
        when(response.getQrCode()).thenReturn("https://qr.alipay.com/test");
        when(alipayClient.execute(any(AlipayTradePrecreateRequest.class))).thenReturn(response);

        QrPayResponse result = service.createQrPay(10L);

        assertEquals(10L, result.getOrderId());
        assertEquals("DM1001", result.getOrderNo());
        assertEquals(new BigDecimal("280.00"), result.getAmount());
        assertEquals("万象票务订单 DM1001", result.getSubject());
        assertEquals("https://qr.alipay.com/test", result.getQrCode());

        ArgumentCaptor<Payment> paymentCaptor = ArgumentCaptor.forClass(Payment.class);
        verify(paymentMapper).insert(paymentCaptor.capture());
        Payment payment = paymentCaptor.getValue();
        assertEquals(10L, payment.getOrderId());
        assertEquals("DM1001", payment.getOutTradeNo());
        assertEquals(new BigDecimal("280.00"), payment.getAmount());
        assertEquals(PaymentService.STATUS_PENDING, payment.getStatus());
        assertNotNull(payment.getPaymentNo());
    }

    @Test
    void createQrPayWaitsUntilPrecreatedTradeIsQueryable() throws Exception {
        OrderInfoResponse order = order(14L, "DM1005", new BigDecimal("280.00"), 1);
        when(orderClient.getOrder(14L, "internal-token")).thenReturn(Result.success(order));
        when(paymentMapper.selectOne(any())).thenReturn(null);

        AlipayTradePrecreateResponse precreate = mock(AlipayTradePrecreateResponse.class);
        when(precreate.isSuccess()).thenReturn(true);
        when(precreate.getQrCode()).thenReturn("https://qr.alipay.com/wait-test");
        com.alipay.api.response.AlipayTradeQueryResponse notVisible = mock(com.alipay.api.response.AlipayTradeQueryResponse.class);
        when(notVisible.isSuccess()).thenReturn(false);
        when(notVisible.getSubCode()).thenReturn("ACQ.TRADE_NOT_EXIST");
        com.alipay.api.response.AlipayTradeQueryResponse visible = mock(com.alipay.api.response.AlipayTradeQueryResponse.class);
        when(visible.isSuccess()).thenReturn(true);
        when(alipayClient.execute(any(AlipayTradePrecreateRequest.class))).thenReturn(precreate);
        when(alipayClient.execute(any(com.alipay.api.request.AlipayTradeQueryRequest.class)))
                .thenReturn(notVisible)
                .thenReturn(visible);

        QrPayResponse result = service.createQrPay(14L);

        assertEquals("https://qr.alipay.com/wait-test", result.getQrCode());
        verify(alipayClient, org.mockito.Mockito.times(2)).execute(any(com.alipay.api.request.AlipayTradeQueryRequest.class));
    }

    @Test
    void createQrPayRejectsPaidOrder() {
        OrderInfoResponse order = order(11L, "DM1002", new BigDecimal("380.00"), 2);
        when(orderClient.getOrder(11L, "internal-token")).thenReturn(Result.success(order));

        BusinessException error = assertThrows(BusinessException.class, () -> service.createQrPay(11L));

        assertEquals("订单已支付", error.getMessage());
        verify(paymentMapper, never()).insert(any());
    }

    @Test
    void syncDecisionBlocksCancelWhenPaymentStatusIsUnknown() throws Exception {
        OrderInfoResponse order = order(12L, "DM1003", new BigDecimal("180.00"), 1);
        when(orderClient.getOrder(12L, "internal-token")).thenReturn(Result.success(order));
        when(paymentMapper.selectOne(any())).thenReturn(null);

        com.alipay.api.response.AlipayTradeQueryResponse response = mock(com.alipay.api.response.AlipayTradeQueryResponse.class);
        when(response.isSuccess()).thenReturn(false);
        when(alipayClient.execute(any(com.alipay.api.request.AlipayTradeQueryRequest.class))).thenReturn(response);

        var result = service.syncDecisionForCancel(12L);

        assertEquals(false, result.getPaid());
        assertEquals(false, result.getSafeToCancel());
        assertEquals("支付结果确认中", result.getMessage());
    }

    @Test
    void syncDecisionAllowsCancelWhenTradeDoesNotExist() throws Exception {
        OrderInfoResponse order = order(13L, "DM1004", new BigDecimal("180.00"), 1);
        when(orderClient.getOrder(13L, "internal-token")).thenReturn(Result.success(order));
        when(paymentMapper.selectOne(any())).thenReturn(null);

        com.alipay.api.response.AlipayTradeQueryResponse response = mock(com.alipay.api.response.AlipayTradeQueryResponse.class);
        when(response.isSuccess()).thenReturn(false);
        when(response.getSubCode()).thenReturn("ACQ.TRADE_NOT_EXIST");
        when(alipayClient.execute(any(com.alipay.api.request.AlipayTradeQueryRequest.class))).thenReturn(response);

        var result = service.syncDecisionForCancel(13L);

        assertEquals(false, result.getPaid());
        assertEquals(true, result.getSafeToCancel());
        assertEquals("支付宝未查询到支付交易", result.getMessage());
    }

    private OrderInfoResponse order(Long id, String orderNo, BigDecimal amount, Integer status) {
        OrderInfoResponse order = new OrderInfoResponse();
        order.setId(id);
        order.setOrderNo(orderNo);
        order.setAmount(amount);
        order.setStatus(status);
        return order;
    }
}
