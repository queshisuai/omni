# 支付宝沙盒支付 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前自动成功的模拟支付升级为 `java-payment` 专职负责的支付宝沙盒电脑网站支付，并支持本地无公网回调时通过主动查单同步订单状态。

**Architecture:** `java-order` 只管理订单和内部状态变更，`java-payment` 负责支付宝 SDK、支付流水、异步通知、主动查单和通过 OpenFeign 同步订单状态。前端创建订单后跳转支付宝沙盒，支付完成返回 `/payment/result`，结果页查询支付状态并引导用户进入订单页。

**Tech Stack:** Spring Boot 2.7.18、Spring Cloud Alibaba、OpenFeign、MyBatis-Plus、PostgreSQL、Alipay Java SDK、Next.js 16、React 19、TypeScript。

---

## 已确认约束

- 支付路线：采用 `java-payment` 专职支付服务。
- 支付方式：支付宝沙盒电脑网站支付。
- `APPID`：`9021000163677324`。
- 第二段公钥确认为支付宝公钥。
- 支付宝密钥通过环境变量配置，禁止提交仓库。
- 当前没有内网穿透，支付宝异步通知无法访问本机 `localhost`。
- 本地联调必须支持 `/payment/result` 主动调用后端查单接口，由后端向支付宝查询并同步订单状态。

## 文件结构

- Modify: `sql/init.sql`，扩展 `payment` 表支付宝字段和索引。
- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java`，增加幂等标记已支付逻辑。
- Modify: `java/java-order/src/main/java/com/omni/order/controller/OrderController.java`，增加内部查询和内部标记已支付接口。
- Modify: `java/java-payment/pom.xml`，增加支付宝 SDK。
- Modify: `java/java-payment/src/main/resources/application.yml`，增加支付宝配置。
- Modify: `java/java-payment/src/main/java/com/omni/payment/entity/Payment.java`，映射支付宝字段。
- Create: `java/java-payment/src/main/java/com/omni/payment/config/AlipayProperties.java`，读取支付宝配置。
- Create: `java/java-payment/src/main/java/com/omni/payment/dto/OrderInfoResponse.java`，订单服务响应 DTO。
- Create: `java/java-payment/src/main/java/com/omni/payment/dto/PagePayRequest.java`，支付请求 DTO。
- Create: `java/java-payment/src/main/java/com/omni/payment/dto/PagePayResponse.java`，支付表单响应 DTO。
- Create: `java/java-payment/src/main/java/com/omni/payment/dto/PaymentStatusResponse.java`，支付状态响应 DTO。
- Create: `java/java-payment/src/main/java/com/omni/payment/client/OrderClient.java`，OpenFeign 订单客户端。
- Create: `java/java-payment/src/main/java/com/omni/payment/service/AlipayService.java`，支付宝支付核心逻辑。
- Create: `java/java-payment/src/main/java/com/omni/payment/controller/AlipayController.java`，支付宝接口。
- Modify: `frontend/src/lib/api.ts`，新增支付宝支付 API。
- Modify: `frontend/src/types/api.ts`，新增支付类型。
- Modify: `frontend/src/app/activity/[id]/page.tsx`，下单后跳转支付宝。
- Modify: `frontend/src/app/orders/page.tsx`，订单页去支付跳转支付宝。
- Create: `frontend/src/app/payment/result/page.tsx`，支付结果页。

---

## Task 1: 扩展支付表和实体

**Files:**
- Modify: `sql/init.sql`
- Modify: `java/java-payment/src/main/java/com/omni/payment/entity/Payment.java`

- [ ] **Step 1: 修改建表 SQL**

将 `sql/init.sql` 中 `payment` 表替换为：

```sql
CREATE TABLE payment (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES "order"(id),
    payment_no VARCHAR(64) NOT NULL UNIQUE,
    payment_method VARCHAR(30) DEFAULT 'MOCK',
    out_trade_no VARCHAR(64),
    trade_no VARCHAR(64),
    amount DECIMAL(10, 2) NOT NULL,
    status SMALLINT DEFAULT 0,
    buyer_id VARCHAR(64),
    notify_time TIMESTAMP,
    raw_notify TEXT,
    callback_data TEXT,
    pay_time TIMESTAMP,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

在索引区域追加：

```sql
CREATE INDEX idx_payment_out_trade_no ON payment(out_trade_no);
CREATE INDEX idx_payment_trade_no ON payment(trade_no);
```

- [ ] **Step 2: 迁移已有数据库**

在 PostgreSQL 执行：

```sql
ALTER TABLE payment ADD COLUMN IF NOT EXISTS out_trade_no VARCHAR(64);
ALTER TABLE payment ADD COLUMN IF NOT EXISTS trade_no VARCHAR(64);
ALTER TABLE payment ADD COLUMN IF NOT EXISTS buyer_id VARCHAR(64);
ALTER TABLE payment ADD COLUMN IF NOT EXISTS notify_time TIMESTAMP;
ALTER TABLE payment ADD COLUMN IF NOT EXISTS raw_notify TEXT;
ALTER TABLE payment ALTER COLUMN payment_no TYPE VARCHAR(64);
ALTER TABLE payment ALTER COLUMN payment_method TYPE VARCHAR(30);
CREATE INDEX IF NOT EXISTS idx_payment_out_trade_no ON payment(out_trade_no);
CREATE INDEX IF NOT EXISTS idx_payment_trade_no ON payment(trade_no);
```

- [ ] **Step 3: 修改 `Payment` 实体**

在 `Payment` 中增加字段和 getter/setter：

```java
private String outTradeNo;
private String tradeNo;
private String buyerId;
private LocalDateTime notifyTime;
private String rawNotify;

public String getOutTradeNo() { return outTradeNo; }
public void setOutTradeNo(String outTradeNo) { this.outTradeNo = outTradeNo; }
public String getTradeNo() { return tradeNo; }
public void setTradeNo(String tradeNo) { this.tradeNo = tradeNo; }
public String getBuyerId() { return buyerId; }
public void setBuyerId(String buyerId) { this.buyerId = buyerId; }
public LocalDateTime getNotifyTime() { return notifyTime; }
public void setNotifyTime(LocalDateTime notifyTime) { this.notifyTime = notifyTime; }
public String getRawNotify() { return rawNotify; }
public void setRawNotify(String rawNotify) { this.rawNotify = rawNotify; }
```

- [ ] **Step 4: 编译验证**

Run: `mvn clean package -pl java-payment -am -DskipTests`

Expected: `BUILD SUCCESS`

---

## Task 2: 增加订单服务内部接口

**Files:**
- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java`
- Modify: `java/java-order/src/main/java/com/omni/order/controller/OrderController.java`

- [ ] **Step 1: 替换 `markPaid` 为幂等版本**

```java
public Order markPaid(Long id) {
    Order order = orderMapper.selectById(id);
    if (order == null) {
        throw new BusinessException(ResultCode.NOT_FOUND, "订单不存在");
    }
    if (order.getStatus() == STATUS_PAID) {
        return order;
    }
    if (order.getStatus() == STATUS_CANCELLED || order.getStatus() == STATUS_REFUNDED) {
        throw new BusinessException(ResultCode.BAD_REQUEST, "订单状态不允许支付");
    }
    order.setStatus(STATUS_PAID);
    order.setUpdateTime(LocalDateTime.now());
    orderMapper.updateById(order);
    log.info("订单已标记为已支付: id={}, orderNo={}", id, order.getOrderNo());
    return order;
}
```

- [ ] **Step 2: 兼容旧沙盒支付接口**

将 `OrderController.initiatePay` 调整为接收 `Order markPaid` 返回值，仍返回旧结构。

```java
Order paidOrder = orderService.markPaid(id);
payInfo.put("orderNo", paidOrder.getOrderNo());
payInfo.put("amount", paidOrder.getAmount());
```

- [ ] **Step 3: 增加内部查询接口**

```java
@GetMapping("/internal/{id}")
public Result<Order> getInternalOrder(@PathVariable Long id) {
    return Result.success(orderService.getOrderDetail(id));
}
```

- [ ] **Step 4: 增加内部标记已支付接口**

```java
@PostMapping("/internal/{id}/paid")
public Result<Order> markInternalPaid(@PathVariable Long id) {
    return Result.success(orderService.markPaid(id));
}
```

- [ ] **Step 5: 编译验证**

Run: `mvn clean package -pl java-order -am -DskipTests`

Expected: `BUILD SUCCESS`

---

## Task 3: 增加支付宝 SDK、配置和 DTO

**Files:**
- Modify: `java/java-payment/pom.xml`
- Modify: `java/java-payment/src/main/resources/application.yml`
- Create DTO/config files listed above

- [ ] **Step 1: 增加支付宝 SDK**

```xml
<dependency>
    <groupId>com.alipay.sdk</groupId>
    <artifactId>alipay-sdk-java</artifactId>
    <version>4.39.225.ALL</version>
</dependency>
```

- [ ] **Step 2: 增加配置**

```yaml
alipay:
  gateway-url: ${ALIPAY_GATEWAY_URL:https://openapi-sandbox.dl.alipaydev.com/gateway.do}
  app-id: ${ALIPAY_APP_ID:9021000163677324}
  merchant-private-key: ${ALIPAY_MERCHANT_PRIVATE_KEY:}
  alipay-public-key: ${ALIPAY_PUBLIC_KEY:}
  return-url: ${ALIPAY_RETURN_URL:http://localhost:3000/payment/result}
  notify-url: ${ALIPAY_NOTIFY_URL:}
  sign-type: RSA2
  charset: utf-8
  format: json
```

- [ ] **Step 3: 创建 `AlipayProperties`**

使用 `@Component` 和 `@ConfigurationProperties(prefix = "alipay")`，字段包括 `gatewayUrl`、`appId`、`merchantPrivateKey`、`alipayPublicKey`、`returnUrl`、`notifyUrl`、`signType`、`charset`、`format`，并提供完整 getter/setter。

- [ ] **Step 4: 创建 DTO**

创建以下 DTO，全部使用 JavaBean getter/setter：

```java
// PagePayRequest
private Long orderId;

// PagePayResponse
private Long orderId;
private String orderNo;
private String payForm;

// PaymentStatusResponse
private Long orderId;
private String orderNo;
private Integer orderStatus;
private Integer paymentStatus;
private String tradeNo;
private String message;

// OrderInfoResponse
private Long id;
private String orderNo;
private Long userId;
private Long sessionId;
private Long ticketTypeId;
private Integer quantity;
private BigDecimal amount;
private Integer status;
private LocalDateTime createTime;
private LocalDateTime updateTime;
```

- [ ] **Step 5: 编译验证**

Run: `mvn clean package -pl java-payment -am -DskipTests`

Expected: Maven 下载支付宝 SDK，最终 `BUILD SUCCESS`

---

## Task 4: 实现支付服务到订单服务的 Feign 客户端

**Files:**
- Create: `java/java-payment/src/main/java/com/omni/payment/client/OrderClient.java`

- [ ] **Step 1: 创建 Feign 接口**

```java
package com.omni.payment.client;

import com.omni.common.result.Result;
import com.omni.payment.dto.OrderInfoResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;

@FeignClient(name = "java-order")
public interface OrderClient {
    @GetMapping("/api/order/internal/{id}")
    Result<OrderInfoResponse> getOrder(@PathVariable("id") Long id);

    @PostMapping("/api/order/internal/{id}/paid")
    Result<OrderInfoResponse> markPaid(@PathVariable("id") Long id);
}
```

- [ ] **Step 2: 编译验证**

Run: `mvn clean package -pl java-payment -am -DskipTests`

Expected: `BUILD SUCCESS`

---

## Task 5: 实现支付宝核心服务

**Files:**
- Create: `java/java-payment/src/main/java/com/omni/payment/service/AlipayService.java`

- [ ] **Step 1: 实现 `createPagePay(Long orderId)`**

实现要点：校验支付宝配置，调用 `OrderClient.getOrder`，只允许待支付/已支付订单，使用 `DefaultAlipayClient` 和 `AlipayTradePagePayRequest` 生成表单。`bizContent` 必须包含：

```json
{
  "out_trade_no": "订单号",
  "total_amount": "订单金额，两位小数",
  "subject": "万象票务订单 订单号",
  "product_code": "FAST_INSTANT_TRADE_PAY"
}
```

生成表单后插入一条 `payment_method='ALIPAY_SANDBOX'`、`status=0` 的待支付流水。

- [ ] **Step 2: 实现 `handleNotify(Map<String,String> params)`**

实现要点：使用 `AlipaySignature.rsaCheckV1` 验签；只处理 `TRADE_SUCCESS` 和 `TRADE_FINISHED`；校验 `total_amount` 等于本地支付流水金额；更新 `tradeNo`、`buyerId`、`notifyTime`、`rawNotify`、`payTime`、`status=1`；调用 `OrderClient.markPaid`。

- [ ] **Step 3: 实现 `syncByOrderId(Long orderId)`**

实现要点：用于无公网回调的本地联调。先查订单，若已支付直接返回成功；否则使用 `AlipayTradeQueryRequest` 按 `out_trade_no` 主动查单，若支付宝返回成功则复用支付成功同步逻辑，否则返回“支付结果确认中”。

- [ ] **Step 4: 编译验证**

Run: `mvn clean package -pl java-payment -am -DskipTests`

Expected: `BUILD SUCCESS`

---

## Task 6: 暴露支付宝控制器

**Files:**
- Create: `java/java-payment/src/main/java/com/omni/payment/controller/AlipayController.java`

- [ ] **Step 1: 创建控制器**

```java
package com.omni.payment.controller;

import com.omni.common.result.Result;
import com.omni.payment.dto.PagePayRequest;
import com.omni.payment.dto.PagePayResponse;
import com.omni.payment.dto.PaymentStatusResponse;
import com.omni.payment.service.AlipayService;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/payment/alipay")
public class AlipayController {
    private final AlipayService alipayService;

    public AlipayController(AlipayService alipayService) {
        this.alipayService = alipayService;
    }

    @PostMapping("/page-pay")
    public Result<PagePayResponse> pagePay(@RequestBody PagePayRequest request) {
        return Result.success(alipayService.createPagePay(request.getOrderId()));
    }

    @PostMapping("/notify")
    public String notify(HttpServletRequest request) {
        Map<String, String> params = new HashMap<>();
        request.getParameterMap().forEach((key, values) -> {
            if (values != null && values.length > 0) params.put(key, values[0]);
        });
        return alipayService.handleNotify(params) ? "success" : "failure";
    }

    @GetMapping("/sync/{orderId}")
    public Result<PaymentStatusResponse> sync(@PathVariable Long orderId) {
        return Result.success(alipayService.syncByOrderId(orderId));
    }
}
```

- [ ] **Step 2: 编译验证**

Run: `mvn clean package -pl java-payment -am -DskipTests`

Expected: `BUILD SUCCESS`

---

## Task 7: 增加前端 API 和类型

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: 增加类型**

在 `api.ts` 类型文件末尾追加：

```ts
export interface PagePayResponse {
  orderId: number
  orderNo: string
  payForm: string
}

export interface PaymentStatusResponse {
  orderId: number
  orderNo: string
  orderStatus: number
  paymentStatus: number
  tradeNo: string | null
  message: string
}
```

- [ ] **Step 2: 增加 API 函数**

在 `frontend/src/lib/api.ts` 中追加：

```ts
export async function createAlipayPagePay(orderId: number) {
  return request<import('@/types/api').PagePayResponse>('/api/payment/alipay/page-pay', {
    method: 'POST',
    body: JSON.stringify({ orderId }),
  })
}

export async function syncAlipayPayment(orderId: number) {
  return request<import('@/types/api').PaymentStatusResponse>(`/api/payment/alipay/sync/${orderId}`)
}

export function submitPayForm(payForm: string) {
  const container = document.createElement('div')
  container.style.display = 'none'
  container.innerHTML = payForm
  document.body.appendChild(container)
  const form = container.querySelector('form')
  if (!form) {
    document.body.removeChild(container)
    throw new Error('支付宝支付表单无效')
  }
  form.submit()
}
```

- [ ] **Step 3: 类型检查**

Run: `pnpm typecheck`

Workdir: `frontend`

Expected: 无新增 TypeScript 错误。

---

## Task 8: 修改活动详情页支付流程

**Files:**
- Modify: `frontend/src/app/activity/[id]/page.tsx`

- [ ] **Step 1: 修改导入**

```ts
import { getActivityDetail, createOrder, createAlipayPagePay, submitPayForm } from '@/lib/api'
```

- [ ] **Step 2: 替换确认订单后的支付逻辑**

```ts
const pay = await createAlipayPagePay(order.id)
setShowConfirm(false)
submitPayForm(pay.payForm)
```

- [ ] **Step 3: 类型检查**

Run: `pnpm typecheck`

Workdir: `frontend`

Expected: 无新增 TypeScript 错误。

---

## Task 9: 修改订单页去支付流程

**Files:**
- Modify: `frontend/src/app/orders/page.tsx`

- [ ] **Step 1: 修改导入**

```ts
import { listOrders, cancelOrder, createAlipayPagePay, submitPayForm } from '@/lib/api'
```

- [ ] **Step 2: 替换 `handlePay`**

```ts
const handlePay = async (orderId: number) => {
  setPaying(orderId)
  try {
    const pay = await createAlipayPagePay(orderId)
    submitPayForm(pay.payForm)
  } catch (err: unknown) {
    alert(err instanceof Error ? err.message : '支付失败')
    setPaying(null)
  }
}
```

- [ ] **Step 3: 类型检查**

Run: `pnpm typecheck`

Workdir: `frontend`

Expected: 无新增 TypeScript 错误。

---

## Task 10: 新增支付结果页

**Files:**
- Create: `frontend/src/app/payment/result/page.tsx`

- [ ] **Step 1: 创建结果页**

结果页必须读取 `orderId`，调用 `syncAlipayPayment(orderId)`，当 `orderStatus === 2` 或 `paymentStatus === 1` 时展示支付成功，否则展示支付结果确认中，并提供“查看订单”和“继续浏览”按钮。

核心逻辑：

```tsx
const orderId = Number(searchParams.get('orderId'))
const result = await syncAlipayPayment(orderId)
if (result.orderStatus === 2 || result.paymentStatus === 1) {
  setStatus('success')
  setMessage('支付成功')
} else {
  setStatus('pending')
  setMessage(result.message || '支付结果确认中，请稍后查看订单')
}
```

- [ ] **Step 2: 类型检查**

Run: `pnpm typecheck`

Workdir: `frontend`

Expected: 无新增 TypeScript 错误。

---

## Task 11: 本地配置和联调

**Files:**
- No repository file changes required for secrets.

- [ ] **Step 1: 配置环境变量**

在启动 `java-payment` 的 PowerShell 会话中设置，支付宝密钥通过环境变量配置，禁止提交仓库：

```powershell
$env:ALIPAY_APP_ID="9021000163677324"
$env:ALIPAY_MERCHANT_PRIVATE_KEY="通过环境变量配置"
$env:ALIPAY_PUBLIC_KEY="通过环境变量配置"
$env:ALIPAY_RETURN_URL="http://localhost:3000/payment/result"
$env:ALIPAY_NOTIFY_URL=""
```

- [ ] **Step 2: 编译后端**

Run: `mvn clean package -pl java-order -am -DskipTests`

Run: `mvn clean package -pl java-payment -am -DskipTests`

Expected: 两个命令均 `BUILD SUCCESS`

- [ ] **Step 3: 检查前端**

Run: `pnpm typecheck`

Workdir: `frontend`

Expected: 无新增 TypeScript 错误。

- [ ] **Step 4: 联调流程**

启动 PostgreSQL、Nacos、gateway、user、ticket、order、payment、frontend。登录普通用户，进入活动详情，创建订单，跳转支付宝沙盒，使用沙盒买家账号付款，返回 `/payment/result`，确认订单页显示已支付。

- [ ] **Step 5: 数据库验证**

```sql
SELECT id, order_id, payment_method, out_trade_no, trade_no, amount, status, buyer_id, pay_time
FROM payment
ORDER BY id DESC
LIMIT 5;

SELECT id, order_no, amount, status, update_time
FROM "order"
ORDER BY id DESC
LIMIT 5;
```

Expected: `payment.status = 1`，`payment.payment_method = 'ALIPAY_SANDBOX'`，`order.status = 2`。

---

## Self-Review

- Spec coverage: 覆盖了数据库、订单内部接口、支付服务、前端支付入口、结果页、本地无公网回调查单同步。
- Placeholder scan: 没有遗留 `TBD` 或未定义任务；私钥和公网通知地址明确要求走本地环境变量。
- Type consistency: 前后端字段统一为 `orderId`、`orderNo`、`payForm`、`paymentStatus`、`tradeNo`；后端订单状态继续沿用 `1/2/3/4`。
