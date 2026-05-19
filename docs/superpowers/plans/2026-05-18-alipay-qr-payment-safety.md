# 支付宝二维码支付与取消前查账保护 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将支付改为站内支付宝二维码弹窗，并在后端取消订单前强制查账，避免支付宝已支付但本地待支付时被取消。

**Architecture:** `java-payment` 负责生成支付宝扫码二维码、查询支付宝状态、补偿本地支付流水和订单状态；`java-order` 在取消待支付订单前调用支付服务内部查账接口；前端复用一个二维码支付弹窗，在活动详情页和订单页展示二维码、轮询支付状态并支持手动刷新。

**Tech Stack:** Java 11、Spring Boot 2.7、Spring Cloud OpenFeign、MyBatis-Plus、支付宝 Java SDK、Next.js 16、React 19、TypeScript。

---

## 文件结构

### 后端 java-payment

- Create: `java/java-payment/src/main/java/com/omni/payment/dto/QrPayResponse.java`
- Create: `java/java-payment/src/main/java/com/omni/payment/dto/PaymentSyncDecisionResponse.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/service/AlipayService.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/controller/AlipayController.java`
- Create: `java/java-payment/src/test/java/com/omni/payment/service/AlipayServiceTest.java`

### 后端 java-order

- Create: `java/java-order/src/main/java/com/omni/order/client/PaymentInternalClient.java`
- Create: `java/java-order/src/main/java/com/omni/order/dto/PaymentSyncDecisionResponse.java`
- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java`
- Modify: `java/java-order/pom.xml`
- Modify: `java/java-order/src/test/java/com/omni/order/service/OrderSeatServiceTest.java`

### 前端

- Modify: `frontend/package.json`
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/components/AlipayQrPayModal.tsx`
- Modify: `frontend/src/app/activity/[id]/page.tsx`
- Modify: `frontend/src/app/orders/page.tsx`

---

### Task 1: 支付服务新增二维码支付 DTO 与接口测试

**Files:**
- Create: `java/java-payment/src/main/java/com/omni/payment/dto/QrPayResponse.java`
- Create: `java/java-payment/src/main/java/com/omni/payment/dto/PaymentSyncDecisionResponse.java`
- Create: `java/java-payment/src/test/java/com/omni/payment/service/AlipayServiceTest.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/service/AlipayService.java`

- [ ] **Step 1: 写失败测试，覆盖二维码支付响应与已支付拒绝**

Create `java/java-payment/src/test/java/com/omni/payment/service/AlipayServiceTest.java` with:

```java
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
import static org.mockito.ArgumentMatchers.eq;
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
    void createQrPayRejectsPaidOrder() {
        OrderInfoResponse order = order(11L, "DM1002", new BigDecimal("380.00"), 2);
        when(orderClient.getOrder(11L, "internal-token")).thenReturn(Result.success(order));

        BusinessException error = assertThrows(BusinessException.class, () -> service.createQrPay(11L));

        assertEquals("订单已支付", error.getMessage());
        verify(paymentMapper, never()).insert(any());
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
```

- [ ] **Step 2: 运行测试确认失败**

Run from `java`:

```bash
mvn test -pl java-payment -Dtest=AlipayServiceTest
```

Expected: FAIL，原因包括 `QrPayResponse` 不存在、`AlipayService` 没有带 `AlipayClientFactory` 的测试构造器、没有 `createQrPay`。

- [ ] **Step 3: 新增 `QrPayResponse`**

Create `java/java-payment/src/main/java/com/omni/payment/dto/QrPayResponse.java`:

```java
package com.omni.payment.dto;

import java.math.BigDecimal;

public class QrPayResponse {

    private Long orderId;
    private String orderNo;
    private BigDecimal amount;
    private String subject;
    private String qrCode;

    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public String getOrderNo() { return orderNo; }
    public void setOrderNo(String orderNo) { this.orderNo = orderNo; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getQrCode() { return qrCode; }
    public void setQrCode(String qrCode) { this.qrCode = qrCode; }
}
```

- [ ] **Step 4: 新增内部同步决策 DTO**

Create `java/java-payment/src/main/java/com/omni/payment/dto/PaymentSyncDecisionResponse.java`:

```java
package com.omni.payment.dto;

public class PaymentSyncDecisionResponse {

    private Long orderId;
    private String orderNo;
    private Integer orderStatus;
    private Integer paymentStatus;
    private Boolean paid;
    private Boolean safeToCancel;
    private String tradeNo;
    private String message;

    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public String getOrderNo() { return orderNo; }
    public void setOrderNo(String orderNo) { this.orderNo = orderNo; }
    public Integer getOrderStatus() { return orderStatus; }
    public void setOrderStatus(Integer orderStatus) { this.orderStatus = orderStatus; }
    public Integer getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(Integer paymentStatus) { this.paymentStatus = paymentStatus; }
    public Boolean getPaid() { return paid; }
    public void setPaid(Boolean paid) { this.paid = paid; }
    public Boolean getSafeToCancel() { return safeToCancel; }
    public void setSafeToCancel(Boolean safeToCancel) { this.safeToCancel = safeToCancel; }
    public String getTradeNo() { return tradeNo; }
    public void setTradeNo(String tradeNo) { this.tradeNo = tradeNo; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
}
```

- [ ] **Step 5: 给 `AlipayService` 增加可测试客户端工厂和扫码支付实现**

Modify `java/java-payment/src/main/java/com/omni/payment/service/AlipayService.java`:

Add imports:

```java
import com.alipay.api.request.AlipayTradePrecreateRequest;
import com.alipay.api.response.AlipayTradePrecreateResponse;
import com.omni.payment.dto.PaymentSyncDecisionResponse;
import com.omni.payment.dto.QrPayResponse;
import java.util.function.Supplier;
```

Add field:

```java
    private final Supplier<AlipayClient> alipayClientFactory;
```

Replace constructor with:

```java
    public AlipayService(AlipayProperties alipayProperties,
                          OrderClient orderClient,
                          PaymentMapper paymentMapper,
                          @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this(alipayProperties, orderClient, paymentMapper, internalApiToken, null);
    }

    public AlipayService(AlipayProperties alipayProperties,
                          OrderClient orderClient,
                          PaymentMapper paymentMapper,
                          String internalApiToken,
                          Supplier<AlipayClient> alipayClientFactory) {
        this.alipayProperties = alipayProperties;
        this.orderClient = orderClient;
        this.paymentMapper = paymentMapper;
        this.internalApiToken = internalApiToken;
        this.alipayClientFactory = alipayClientFactory;
    }
```

Add method after `createPagePay`:

```java
    public QrPayResponse createQrPay(Long orderId) {
        validateConfig();
        OrderInfoResponse order = getOrderOrThrow(orderId);
        if (ORDER_STATUS_PAID.equals(order.getStatus())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "订单已支付");
        }
        if (!ORDER_STATUS_PENDING.equals(order.getStatus())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "当前订单状态不允许支付");
        }

        String orderNo = requireText(order.getOrderNo(), "订单号不能为空");
        BigDecimal amount = normalizeAmount(order.getAmount());
        Payment payment = getLatestPaymentByOutTradeNo(orderNo);
        if (payment != null) {
            if (PaymentService.STATUS_SUCCESS == payment.getStatus()) {
                throw new BusinessException(ResultCode.BAD_REQUEST, "订单已支付");
            }
            if (PaymentService.STATUS_PENDING != payment.getStatus()) {
                payment = null;
            }
        }
        if (payment == null) {
            payment = createPendingPayment(order);
        }

        String subject = "万象票务订单 " + orderNo;
        AlipayTradePrecreateRequest request = new AlipayTradePrecreateRequest();
        if (StringUtils.hasText(alipayProperties.getNotifyUrl())) {
            request.setNotifyUrl(alipayProperties.getNotifyUrl());
        }
        Map<String, String> bizContent = new LinkedHashMap<>();
        bizContent.put("out_trade_no", orderNo);
        bizContent.put("total_amount", amount.toPlainString());
        bizContent.put("subject", subject);
        request.setBizContent(buildJson(bizContent));

        try {
            AlipayTradePrecreateResponse alipayResponse = createClient().execute(request);
            if (alipayResponse == null || !alipayResponse.isSuccess() || !StringUtils.hasText(alipayResponse.getQrCode())) {
                markPaymentFailed(payment, "支付宝二维码响应为空或失败");
                throw new BusinessException(ResultCode.INTERNAL_ERROR, "生成支付宝支付二维码失败");
            }
            QrPayResponse response = new QrPayResponse();
            response.setOrderId(orderId);
            response.setOrderNo(orderNo);
            response.setAmount(amount);
            response.setSubject(subject);
            response.setQrCode(alipayResponse.getQrCode());
            return response;
        } catch (AlipayApiException e) {
            markPaymentFailed(payment, "生成支付宝支付二维码异常");
            log.error("生成支付宝支付二维码失败: orderId={}", orderId, e);
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "生成支付宝支付二维码失败");
        }
    }
```

Replace `createClient()` method with:

```java
    private AlipayClient createClient() {
        if (alipayClientFactory != null) {
            return alipayClientFactory.get();
        }
        return new DefaultAlipayClient(
                alipayProperties.getGatewayUrl(),
                alipayProperties.getAppId(),
                alipayProperties.getMerchantPrivateKey(),
                format(),
                charset(),
                alipayProperties.getAlipayPublicKey(),
                signType()
        );
    }
```

- [ ] **Step 6: 运行测试确认通过**

Run from `java`:

```bash
mvn test -pl java-payment -Dtest=AlipayServiceTest
```

Expected: PASS。

---

### Task 2: 支付服务暴露二维码接口与内部同步决策接口

**Files:**
- Modify: `java/java-payment/src/main/java/com/omni/payment/controller/AlipayController.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/service/AlipayService.java`
- Modify: `java/java-payment/src/test/java/com/omni/payment/service/AlipayServiceTest.java`

- [ ] **Step 1: 写失败测试，覆盖内部同步决策**

Append to `AlipayServiceTest`:

```java
    @Test
    void syncDecisionAllowsCancelWhenPaymentIsStillPending() throws Exception {
        OrderInfoResponse order = order(12L, "DM1003", new BigDecimal("180.00"), 1);
        when(orderClient.getOrder(12L, "internal-token")).thenReturn(Result.success(order));
        when(paymentMapper.selectOne(any())).thenReturn(null);

        com.alipay.api.response.AlipayTradeQueryResponse response = mock(com.alipay.api.response.AlipayTradeQueryResponse.class);
        when(response.isSuccess()).thenReturn(false);
        when(alipayClient.execute(any(com.alipay.api.request.AlipayTradeQueryRequest.class))).thenReturn(response);

        var result = service.syncDecisionForCancel(12L);

        assertEquals(false, result.getPaid());
        assertEquals(true, result.getSafeToCancel());
        assertEquals("支付结果确认中", result.getMessage());
    }
```

- [ ] **Step 2: 运行测试确认失败**

Run from `java`:

```bash
mvn test -pl java-payment -Dtest=AlipayServiceTest
```

Expected: FAIL，原因是 `syncDecisionForCancel` 不存在。

- [ ] **Step 3: 实现内部同步决策方法**

Add to `AlipayService.java` after `syncByOrderId`:

```java
    public PaymentSyncDecisionResponse syncDecisionForCancel(Long orderId) {
        PaymentStatusResponse status = syncByOrderId(orderId);
        PaymentSyncDecisionResponse response = new PaymentSyncDecisionResponse();
        response.setOrderId(status.getOrderId());
        response.setOrderNo(status.getOrderNo());
        response.setOrderStatus(status.getOrderStatus());
        response.setPaymentStatus(status.getPaymentStatus());
        response.setTradeNo(status.getTradeNo());
        response.setMessage(status.getMessage());
        boolean paid = PaymentService.STATUS_SUCCESS == status.getPaymentStatus()
                || ORDER_STATUS_PAID.equals(status.getOrderStatus());
        response.setPaid(paid);
        response.setSafeToCancel(!paid);
        return response;
    }
```

- [ ] **Step 4: 暴露公开二维码接口和内部同步接口**

Modify `AlipayController.java` imports:

```java
import com.omni.payment.dto.PaymentSyncDecisionResponse;
import com.omni.payment.dto.QrPayResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.RequestHeader;
```

Add field and constructor parameter:

```java
    private final String internalApiToken;

    public AlipayController(AlipayService alipayService,
                            @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.alipayService = alipayService;
        this.internalApiToken = internalApiToken;
    }
```

Replace existing constructor with the above.

Add endpoints:

```java
    @PostMapping("/qr-pay")
    public Result<QrPayResponse> qrPay(@RequestBody PagePayRequest request) {
        return Result.success(alipayService.createQrPay(request.getOrderId()));
    }

    @PostMapping("/internal/sync-order/{orderId}")
    public Result<PaymentSyncDecisionResponse> syncOrderForCancel(
            @PathVariable Long orderId,
            @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        return Result.success(alipayService.syncDecisionForCancel(orderId));
    }

    private boolean isValidInternalToken(String token) {
        return StringUtils.hasText(internalApiToken) && internalApiToken.equals(token);
    }
```

- [ ] **Step 5: 运行测试确认通过**

Run from `java`:

```bash
mvn test -pl java-payment -Dtest=AlipayServiceTest
```

Expected: PASS。

---

### Task 3: 订单服务取消前调用支付服务查账

**Files:**
- Modify: `java/java-order/pom.xml`
- Create: `java/java-order/src/main/java/com/omni/order/client/PaymentInternalClient.java`
- Create: `java/java-order/src/main/java/com/omni/order/dto/PaymentSyncDecisionResponse.java`
- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java`
- Modify: `java/java-order/src/test/java/com/omni/order/service/OrderSeatServiceTest.java`

- [ ] **Step 1: 给 java-order 添加 OpenFeign 依赖**

Modify `java/java-order/pom.xml`, add before test dependency:

```xml
        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-starter-openfeign</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-starter-loadbalancer</artifactId>
        </dependency>
```

- [ ] **Step 2: 新增支付内部客户端和 DTO**

Create `java/java-order/src/main/java/com/omni/order/dto/PaymentSyncDecisionResponse.java`:

```java
package com.omni.order.dto;

public class PaymentSyncDecisionResponse {

    private Long orderId;
    private String orderNo;
    private Integer orderStatus;
    private Integer paymentStatus;
    private Boolean paid;
    private Boolean safeToCancel;
    private String tradeNo;
    private String message;

    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public String getOrderNo() { return orderNo; }
    public void setOrderNo(String orderNo) { this.orderNo = orderNo; }
    public Integer getOrderStatus() { return orderStatus; }
    public void setOrderStatus(Integer orderStatus) { this.orderStatus = orderStatus; }
    public Integer getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(Integer paymentStatus) { this.paymentStatus = paymentStatus; }
    public Boolean getPaid() { return paid; }
    public void setPaid(Boolean paid) { this.paid = paid; }
    public Boolean getSafeToCancel() { return safeToCancel; }
    public void setSafeToCancel(Boolean safeToCancel) { this.safeToCancel = safeToCancel; }
    public String getTradeNo() { return tradeNo; }
    public void setTradeNo(String tradeNo) { this.tradeNo = tradeNo; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
}
```

Create `java/java-order/src/main/java/com/omni/order/client/PaymentInternalClient.java`:

```java
package com.omni.order.client;

import com.omni.common.result.Result;
import com.omni.order.dto.PaymentSyncDecisionResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;

@FeignClient(name = "java-payment")
public interface PaymentInternalClient {

    @PostMapping("/api/payment/alipay/internal/sync-order/{orderId}")
    Result<PaymentSyncDecisionResponse> syncOrderForCancel(
            @PathVariable("orderId") Long orderId,
            @RequestHeader("X-Internal-Token") String internalToken);
}
```

- [ ] **Step 3: 写失败测试，覆盖已支付时拒绝取消**

Append to `OrderSeatServiceTest`:

```java
    @Test
    void cancelOrderRejectsWhenPaymentServiceSaysPaid() {
        PaymentInternalClient paymentClient = mock(PaymentInternalClient.class);
        OrderService service = new OrderService(orderMapper, orderSeatMapper, sessionSeatMapper, ticketTypeMapper, paymentClient, "internal-token");
        Order order = new Order();
        order.setId(88L);
        order.setOrderNo("DM88");
        order.setStatus(OrderService.STATUS_PENDING);
        when(orderMapper.selectById(88L)).thenReturn(order);
        PaymentSyncDecisionResponse decision = new PaymentSyncDecisionResponse();
        decision.setPaid(true);
        decision.setSafeToCancel(false);
        decision.setMessage("支付成功");
        when(paymentClient.syncOrderForCancel(88L, "internal-token")).thenReturn(Result.success(decision));

        BusinessException error = assertThrows(BusinessException.class, () -> service.cancelOrder(88L));

        assertEquals("订单已支付，不能取消", error.getMessage());
        verify(orderMapper, never()).updateById(any());
    }
```

Also ensure imports exist in `OrderSeatServiceTest`:

```java
import com.omni.common.result.Result;
import com.omni.exception.BusinessException;
import com.omni.order.client.PaymentInternalClient;
import com.omni.order.dto.PaymentSyncDecisionResponse;
```

- [ ] **Step 4: 运行测试确认失败**

Run from `java`:

```bash
mvn test -pl java-order -Dtest=OrderSeatServiceTest
```

Expected: FAIL，原因是 `OrderService` 没有 6 参数构造器或取消前查账逻辑。

- [ ] **Step 5: 修改 `OrderService` 构造器并实现取消前查账**

Modify imports in `OrderService.java`:

```java
import com.omni.common.result.Result;
import com.omni.order.client.PaymentInternalClient;
import com.omni.order.dto.PaymentSyncDecisionResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.util.StringUtils;
```

Add fields:

```java
    private final PaymentInternalClient paymentInternalClient;
    private final String internalApiToken;
```

Replace constructors with:

```java
    public OrderService(OrderMapper orderMapper) {
        this(orderMapper, null);
    }

    public OrderService(OrderMapper orderMapper, OrderSeatMapper orderSeatMapper) {
        this(orderMapper, orderSeatMapper, null, null, null, null);
    }

    public OrderService(OrderMapper orderMapper,
                        OrderSeatMapper orderSeatMapper,
                        SessionSeatMapper sessionSeatMapper,
                        TicketTypeMapper ticketTypeMapper) {
        this(orderMapper, orderSeatMapper, sessionSeatMapper, ticketTypeMapper, null, null);
    }

    @Autowired
    public OrderService(OrderMapper orderMapper,
                        OrderSeatMapper orderSeatMapper,
                        SessionSeatMapper sessionSeatMapper,
                        TicketTypeMapper ticketTypeMapper,
                        PaymentInternalClient paymentInternalClient,
                        @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.orderMapper = orderMapper;
        this.orderSeatMapper = orderSeatMapper;
        this.sessionSeatMapper = sessionSeatMapper;
        this.ticketTypeMapper = ticketTypeMapper;
        this.paymentInternalClient = paymentInternalClient;
        this.internalApiToken = internalApiToken;
    }
```

Add helper before `cancelOrder`:

```java
    private void assertPendingOrderSafeToCancel(Order order) {
        if (paymentInternalClient == null) {
            return;
        }
        if (!StringUtils.hasText(internalApiToken)) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR, "内部接口令牌未配置，无法确认支付状态");
        }
        Result<PaymentSyncDecisionResponse> result;
        try {
            result = paymentInternalClient.syncOrderForCancel(order.getId(), internalApiToken);
        } catch (RuntimeException e) {
            log.warn("取消订单前确认支付状态失败: orderId={}, orderNo={}", order.getId(), order.getOrderNo(), e);
            throw new BusinessException(ResultCode.CONFLICT, "支付状态确认中，请稍后刷新后再操作");
        }
        if (result == null || result.getCode() != 200 || result.getData() == null) {
            throw new BusinessException(ResultCode.CONFLICT, "支付状态确认中，请稍后刷新后再操作");
        }
        PaymentSyncDecisionResponse decision = result.getData();
        if (Boolean.TRUE.equals(decision.getPaid())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "订单已支付，不能取消");
        }
        if (!Boolean.TRUE.equals(decision.getSafeToCancel())) {
            throw new BusinessException(ResultCode.CONFLICT, "支付状态确认中，请稍后刷新后再操作");
        }
    }
```

Modify `cancelOrder` before setting `STATUS_CANCELLED`:

```java
        assertPendingOrderSafeToCancel(order);
```

- [ ] **Step 6: 运行订单测试确认通过**

Run from `java`:

```bash
mvn test -pl java-order -Dtest=OrderSeatServiceTest
```

Expected: PASS。

---

### Task 4: 前端 API 类型与二维码组件

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/components/AlipayQrPayModal.tsx`

- [ ] **Step 1: 安装二维码渲染依赖**

Run from `frontend`:

```bash
pnpm add qrcode.react
```

Expected: `package.json` and lockfile updated with `qrcode.react`.

- [ ] **Step 2: 新增 API 类型**

Modify `frontend/src/types/api.ts` after `PagePayResponse`:

```ts
export interface QrPayResponse {
  orderId: number
  orderNo: string
  amount: number
  subject: string
  qrCode: string
}
```

- [ ] **Step 3: 新增二维码支付 API**

Modify `frontend/src/lib/api.ts` after `createAlipayPagePay`:

```ts
export async function createAlipayQrPay(orderId: number) {
  return request<import('@/types/api').QrPayResponse>('/api/payment/alipay/qr-pay', {
    method: 'POST',
    body: JSON.stringify({ orderId }),
  })
}
```

- [ ] **Step 4: 创建可复用支付弹窗组件**

Create `frontend/src/components/AlipayQrPayModal.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { syncAlipayPayment } from '@/lib/api'
import type { PaymentStatusResponse, QrPayResponse } from '@/types/api'

type PayState = 'pending' | 'checking' | 'success' | 'error'

interface AlipayQrPayModalProps {
  pay: QrPayResponse
  productName: string
  onClose: () => void
  onPaid: (result: PaymentStatusResponse) => void
}

export function AlipayQrPayModal({ pay, productName, onClose, onPaid }: AlipayQrPayModalProps) {
  const [state, setState] = useState<PayState>('pending')
  const [message, setMessage] = useState('待支付')
  const [checking, setChecking] = useState(false)

  const refreshStatus = async () => {
    if (checking || state === 'success') return
    setChecking(true)
    setState('checking')
    setMessage('正在刷新支付状态...')
    try {
      const result = await syncAlipayPayment(pay.orderId)
      if (result.paymentStatus === 1 || result.orderStatus === 2) {
        setState('success')
        setMessage(result.message || '支付成功')
        onPaid(result)
      } else {
        setState('pending')
        setMessage(result.message || '待支付')
      }
    } catch (err: unknown) {
      setState('error')
      setMessage(err instanceof Error ? err.message : '支付状态刷新失败')
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshStatus()
    }, 3000)
    return () => window.clearInterval(timer)
  })

  const statusText = state === 'success' ? '支付成功' : state === 'checking' ? '确认中' : state === 'error' ? '确认失败' : '待支付'
  const statusColor = state === 'success' ? '#52c41a' : state === 'error' ? '#ff4d4f' : '#ff1268'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="w-full max-w-[460px] rounded-2xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[20px] font-medium text-[#111]">支付宝扫码支付</h3>
            <p className="mt-1 text-[13px] text-[#999]">请使用支付宝扫码完成付款</p>
          </div>
          <button onClick={onClose} className="border-none bg-transparent text-[24px] leading-none text-[#999] cursor-pointer">×</button>
        </div>

        <div className="mb-5 rounded-xl bg-[#fafafa] p-4 text-[14px] text-[#666] space-y-2">
          <div className="flex justify-between gap-4"><span>产品</span><span className="text-right text-[#111]">{productName}</span></div>
          <div className="flex justify-between gap-4"><span>金额</span><span className="text-[#ff1268] text-[18px] font-medium">¥{Number(pay.amount).toFixed(2)}</span></div>
          <div className="flex justify-between gap-4"><span>状态</span><span style={{ color: statusColor }}>{statusText}</span></div>
          <div className="flex justify-between gap-4"><span>订单号</span><span className="text-right text-[#111]">{pay.orderNo}</span></div>
        </div>

        <div className="mb-5 flex flex-col items-center rounded-xl border border-[#f0f0f0] p-5">
          {state === 'success' ? (
            <div className="flex h-[220px] flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#52c41a] bg-[#f6ffed] text-[34px] text-[#52c41a]">✓</div>
              <div className="text-[18px] font-medium text-[#111]">支付成功</div>
            </div>
          ) : (
            <QRCodeSVG value={pay.qrCode} size={220} includeMargin />
          )}
          <p className="mt-3 text-center text-[13px] text-[#999]">{message}</p>
        </div>

        <div className="flex gap-3">
          <button onClick={refreshStatus} disabled={checking || state === 'success'} className="flex-1 rounded-lg border border-[#ff1268] bg-white py-2.5 text-[14px] text-[#ff1268] disabled:opacity-50 cursor-pointer">
            {checking ? '刷新中...' : '刷新状态'}
          </button>
          <button onClick={onClose} className="flex-1 rounded-lg border-none bg-[#ff1268] py-2.5 text-[14px] text-white cursor-pointer">
            {state === 'success' ? '完成' : '关闭'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: 前端类型检查确认组件可编译**

Run from `frontend`:

```bash
pnpm run typecheck
```

Expected: PASS。如果 `qrcode.react` 导出名不匹配，改为该包实际导出的 `QRCodeSVG` 或 `QRCodeCanvas`。

---

### Task 5: 活动详情页改为站内二维码支付弹窗

**Files:**
- Modify: `frontend/src/app/activity/[id]/page.tsx`

- [ ] **Step 1: 替换导入**

Modify imports in `frontend/src/app/activity/[id]/page.tsx`:

```ts
import { getActivityDetail, createOrder, createOrderWithSeats, createAlipayQrPay, getSeatMap } from '@/lib/api'
import { AlipayQrPayModal } from '@/components/AlipayQrPayModal'
import type { QrPayResponse } from '@/types/api'
```

Remove `submitPayForm` and `createAlipayPagePay` from the import.

- [ ] **Step 2: 新增支付弹窗状态**

Add near existing state declarations:

```ts
  const [qrPay, setQrPay] = useState<QrPayResponse | null>(null)
```

- [ ] **Step 3: 修改确认支付逻辑**

Replace:

```ts
      const pay = await createAlipayPagePay(order.id)
      submitPayForm(pay.payForm)
      setShowConfirm(false)
```

with:

```ts
      const pay = await createAlipayQrPay(order.id)
      setQrPay(pay)
      setShowConfirm(false)
```

- [ ] **Step 4: 渲染二维码支付弹窗**

Add before closing fragment:

```tsx
      {qrPay && (
        <AlipayQrPayModal
          pay={qrPay}
          productName={activity.name}
          onClose={() => setQrPay(null)}
          onPaid={(result) => {
            setSuccessOrderNo(result.orderNo || qrPay.orderNo)
            setQrPay(null)
            setShowSuccess(true)
          }}
        />
      )}
```

- [ ] **Step 5: 前端类型检查**

Run from `frontend`:

```bash
pnpm run typecheck
```

Expected: PASS。

---

### Task 6: 订单页接入二维码弹窗和刷新状态

**Files:**
- Modify: `frontend/src/app/orders/page.tsx`

- [ ] **Step 1: 替换导入并新增类型**

Modify imports:

```ts
import { listOrders, cancelOrder, createAlipayQrPay, syncAlipayPayment, listMyRefunds, applyRefund } from '@/lib/api'
import { AlipayQrPayModal } from '@/components/AlipayQrPayModal'
import type { QrPayResponse } from '@/types/api'
```

Remove `createAlipayPagePay` and `submitPayForm`.

- [ ] **Step 2: 新增状态**

Add near existing state declarations:

```ts
  const [qrPay, setQrPay] = useState<QrPayResponse | null>(null)
  const [refreshing, setRefreshing] = useState<number | null>(null)
```

- [ ] **Step 3: 修改去支付逻辑**

Replace `handlePay` body with:

```ts
  const handlePay = async (orderId: number) => {
    setPaying(orderId)
    try {
      const pay = await createAlipayQrPay(orderId)
      setQrPay(pay)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '支付失败')
    } finally {
      setPaying(null)
    }
  }
```

- [ ] **Step 4: 新增刷新状态逻辑**

Add after `handlePay`:

```ts
  const handleRefreshPayment = async (orderId: number) => {
    setRefreshing(orderId)
    try {
      const result = await syncAlipayPayment(orderId)
      if (result.orderStatus === 2 || result.paymentStatus === 1) {
        setOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, status: 2 } : order)))
      } else {
        alert(result.message || '支付结果确认中')
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '刷新支付状态失败')
    } finally {
      setRefreshing(null)
    }
  }
```

- [ ] **Step 5: 待支付订单增加刷新按钮**

Inside pending order button block after “去支付” button, add:

```tsx
                          <button
                            onClick={() => handleRefreshPayment(order.id)}
                            disabled={refreshing === order.id}
                            className="cursor-pointer border border-[#ff1268] bg-white text-[#ff1268] text-[14px] px-6 py-2 rounded outline-none"
                            style={{ opacity: refreshing === order.id ? 0.7 : 1 }}
                          >
                            {refreshing === order.id ? '刷新中...' : '刷新状态'}
                          </button>
```

- [ ] **Step 6: 渲染二维码弹窗**

Add near bottom before refund dialog:

```tsx
      {qrPay && (
        <AlipayQrPayModal
          pay={qrPay}
          productName={orders.find((order) => order.id === qrPay.orderId)?.activityName || '万象票务订单'}
          onClose={() => setQrPay(null)}
          onPaid={(result) => {
            setOrders((prev) => prev.map((order) => (order.id === result.orderId ? { ...order, status: 2 } : order)))
          }}
        />
      )}
```

- [ ] **Step 7: 前端类型检查**

Run from `frontend`:

```bash
pnpm run typecheck
```

Expected: PASS。

---

### Task 7: 全量验证与回归检查

**Files:**
- No source edits expected unless tests expose issues.

- [ ] **Step 1: 后端支付和订单测试**

Run from `java`:

```bash
mvn test -pl java-payment,java-order -am
```

Expected: `BUILD SUCCESS`。

- [ ] **Step 2: 前端类型检查**

Run from `frontend`:

```bash
pnpm run typecheck
```

Expected: `tsc --noEmit` exits 0。

- [ ] **Step 3: 空白检查**

Run from repo root:

```bash
git diff --check
```

Expected: no whitespace errors. Windows LF/CRLF warnings are acceptable if no whitespace error is reported.

- [ ] **Step 4: 检查敏感信息**

Run from repo root:

```bash
git diff -- java/java-payment/src/main/resources/application.yml
```

Expected: no private key or secret changes in diff. Do not print or commit secret values.

- [ ] **Step 5: 查看最终变更**

Run from repo root:

```bash
git status --short
```

Expected: only intended files changed; note that earlier未提交后台管理/座位编辑器变更仍会显示在工作区。

---

## Self-Review

Spec coverage:

1. 站内二维码支付：Task 1、Task 2、Task 4、Task 5、Task 6 覆盖。
2. 前端轮询和手动刷新：Task 4、Task 6 覆盖。
3. 取消前查账保护：Task 2、Task 3 覆盖。
4. 支付金额以后端订单金额为准：Task 1 使用 `getOrderOrThrow` 的订单金额生成二维码。
5. 保留异步通知和同步查询：未删除现有 `notify` 和 `sync`，二维码弹窗复用 `sync`。
6. 内部接口令牌：Task 2、Task 3 覆盖。
7. 不输出私钥：Task 7 明确检查。

Placeholder scan: 未使用 TBD/TODO/稍后实现类占位步骤。

Type consistency: `QrPayResponse`、`PaymentSyncDecisionResponse`、`createAlipayQrPay`、`syncDecisionForCancel` 名称在任务间一致。
