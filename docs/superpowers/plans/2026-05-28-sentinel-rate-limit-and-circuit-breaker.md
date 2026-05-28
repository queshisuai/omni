# Sentinel 热点分层限流与熔断 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按风险和流量热点完善 Sentinel：Gateway 先做热点入口粗粒度限流，核心服务方法做细粒度限流，跨服务/外部依赖做熔断，避免全量铺开误伤低频业务。

**Architecture:** Gateway 保护 `/api/grab/**`、订单创建、支付同步/回调、登录/验证码、热门票务查询；业务服务只保护订单创建/支付标记、票务锁库存/锁座/座位图、支付同步/退款申请、登录/验证码。熔断只用于 order/user、order/ticket、payment/order、payment/Alipay 等跨服务或外部依赖；本地规则加载必须合并现有规则，不能清空其它来源规则。

**Tech Stack:** Java 11、Spring Boot 2.7、Spring Cloud Gateway、Spring Cloud Alibaba Sentinel、JUnit 5、Mockito；NestJS grab-service 通过 Gateway Sentinel 保护入口。

---

## File Structure

- Modify: `java/java-gateway/src/main/java/com/omni/gateway/config/GatewaySentinelConfig.java`
  - 收窄 Gateway API definitions 到热点路径，并避免按整个 `/api/order/**`、`/api/payment/**`、`/api/ticket/**` 全量限流。
- Modify: `java/java-gateway/src/test/java/com/omni/gateway/config/GatewaySentinelConfigTest.java`
  - 验证热点 API definitions 和 block response。
- Modify: `java/java-order/src/main/java/com/omni/order/config/OrderSentinelConfig.java`
  - 修复 `loadRules` 覆盖风险；保留订单创建/支付标记限流和跨服务依赖熔断资源。
- Create: `java/java-order/src/test/java/com/omni/order/config/OrderSentinelConfigTest.java`
  - 验证规则合并不清空已有规则。
- Modify: `java/java-order/src/main/java/com/omni/order/controller/OrderController.java`
  - 保留订单创建和支付标记热点资源保护。
- Modify: `java/java-order/src/test/java/com/omni/order/controller/OrderControllerInternalCreateTest.java`
  - 保留 block handler 测试。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/config/TicketSentinelConfig.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/TicketSalesInternalController.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/SeatController.java`
- Create or Modify: `java/java-ticket/src/test/java/com/omni/ticket/controller/TicketSalesInternalControllerTest.java`
- Create or Modify: `java/java-ticket/src/test/java/com/omni/ticket/controller/SeatControllerSentinelTest.java`
  - 只保护锁库存、锁座、确认售出、座位图读取。
- Create: `java/java-payment/src/main/java/com/omni/payment/config/PaymentSentinelConfig.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/controller/AlipayController.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/controller/RefundController.java`
- Create or Modify: `java/java-payment/src/test/java/com/omni/payment/controller/AlipayControllerTest.java`
- Create or Modify: `java/java-payment/src/test/java/com/omni/payment/controller/RefundControllerTest.java`
  - 只保护支付同步、支付回调、退款申请。
- Create: `java/java-user/src/main/java/com/omni/user/config/UserSentinelConfig.java`
- Modify: `java/java-user/src/main/java/com/omni/user/controller/UserController.java`
- Create or Modify: `java/java-user/src/test/java/com/omni/user/controller/UserControllerSentinelTest.java`
  - 只保护登录和短信验证码。

---

### Task 1: 收窄 Gateway 热点入口限流

**Files:**
- Modify: `java/java-gateway/src/main/java/com/omni/gateway/config/GatewaySentinelConfig.java`
- Modify: `java/java-gateway/src/test/java/com/omni/gateway/config/GatewaySentinelConfigTest.java`

- [ ] **Step 1: Update Gateway resource names and paths**

In `GatewaySentinelConfig.java`, replace broad resources with hotspot resources:

```java
    public static final String GRAB_API = "gateway-api-grab";
    public static final String ORDER_CREATE_API = "gateway-api-order-create";
    public static final String PAYMENT_CRITICAL_API = "gateway-api-payment-critical";
    public static final String USER_AUTH_API = "gateway-api-user-auth";
    public static final String TICKET_HOT_READ_API = "gateway-api-ticket-hot-read";
```

Use QPS defaults:

```java
            @Value("${omni.gateway.sentinel.qps.grab:20}") double grabQps,
            @Value("${omni.gateway.sentinel.qps.order-create:50}") double orderCreateQps,
            @Value("${omni.gateway.sentinel.qps.payment-critical:30}") double paymentCriticalQps,
            @Value("${omni.gateway.sentinel.qps.user-auth:40}") double userAuthQps,
            @Value("${omni.gateway.sentinel.qps.ticket-hot-read:120}") double ticketHotReadQps
```

The API definitions must cover:

```java
        definitions.add(apiDefinition(GRAB_API, "/api/grab"));
        definitions.add(apiDefinition(ORDER_CREATE_API, "/api/order/create"));
        definitions.add(apiDefinition(ORDER_CREATE_API, "/api/order/create-with-seats"));
        definitions.add(apiDefinition(PAYMENT_CRITICAL_API, "/api/payment/alipay/sync"));
        definitions.add(apiDefinition(PAYMENT_CRITICAL_API, "/api/payment/alipay/notify"));
        definitions.add(apiDefinition(USER_AUTH_API, "/api/user/login"));
        definitions.add(apiDefinition(USER_AUTH_API, "/api/user/send-code"));
        definitions.add(apiDefinition(TICKET_HOT_READ_API, "/api/ticket/activities"));
        definitions.add(apiDefinition(TICKET_HOT_READ_API, "/api/ticket/sessions"));
        definitions.add(apiDefinition(TICKET_HOT_READ_API, "/api/ticket/sessions/"));
```

Because multiple path prefixes map to the same logical API name, implement a helper that accumulates predicate items by API name rather than adding duplicate `ApiDefinition` objects with the same name.

- [ ] **Step 2: Update Gateway test**

In `GatewaySentinelConfigTest.java`, update constructor to five QPS args:

```java
GatewaySentinelConfig config = new GatewaySentinelConfig(20, 50, 30, 40, 120);
```

Add a test that calls `config.afterPropertiesSet()` and asserts Gateway API definitions include hotspot API names and do not include broad `gateway-api-order`, `gateway-api-payment`, or `gateway-api-ticket` resources.

- [ ] **Step 3: Run gateway tests**

```bash
cd /c/Users/Administrator/Desktop/omni/.claude/worktrees/grab-low-risk-sentinel/java && mvn -pl java-gateway test
```

Expected: PASS.

---

### Task 2: 修复订单 Sentinel 规则加载覆盖风险

**Files:**
- Modify: `java/java-order/src/main/java/com/omni/order/config/OrderSentinelConfig.java`
- Create: `java/java-order/src/test/java/com/omni/order/config/OrderSentinelConfigTest.java`

- [ ] **Step 1: Write config merge tests**

Create `OrderSentinelConfigTest.java` that:

1. Preloads an unrelated `FlowRule` named `unrelated-flow`.
2. Runs `new OrderSentinelConfig(80, 80, 80).afterPropertiesSet()`.
3. Asserts `unrelated-flow` still exists and order flow resources exist.
4. Preloads an unrelated `DegradeRule` named `unrelated-degrade`.
5. Runs config again and asserts unrelated degrade still exists and order-user/order-ticket degrade resources exist.

- [ ] **Step 2: Fix rule loading**

In `OrderSentinelConfig.java`, replace direct `FlowRuleManager.loadRules(rules)` and `DegradeRuleManager.loadRules(degradeRules)` with merge helpers:

```java
    private void loadFlowRules(List<FlowRule> ownedRules) {
        List<String> ownedResources = ownedRules.stream().map(FlowRule::getResource).collect(java.util.stream.Collectors.toList());
        List<FlowRule> merged = new ArrayList<>();
        for (FlowRule existing : FlowRuleManager.getRules()) {
            if (!ownedResources.contains(existing.getResource())) {
                merged.add(existing);
            }
        }
        merged.addAll(ownedRules);
        FlowRuleManager.loadRules(merged);
    }
```

Add the same pattern for `DegradeRule`.

- [ ] **Step 3: Run order Sentinel tests**

```bash
cd /c/Users/Administrator/Desktop/omni/.claude/worktrees/grab-low-risk-sentinel/java && mvn -pl java-order -Dtest=OrderSentinelConfigTest,OrderControllerInternalCreateTest test
```

Expected: PASS.

---

### Task 3: 票务热点资源限流

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/config/TicketSentinelConfig.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/TicketSalesInternalController.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/SeatController.java`
- Create or Modify tests for these controllers.

- [ ] **Step 1: Add TicketSentinelConfig**

Create flow resources only for:

```java
public static final String SALES_LOCK_STOCK = "ticket-sales-lock-stock";
public static final String SALES_LOCK_SEATS = "ticket-sales-lock-seats";
public static final String SALES_CONFIRM_SOLD = "ticket-sales-confirm-sold";
public static final String SEAT_MAP_READ = "ticket-seat-map-read";
```

Use QPS defaults: 80, 80, 80, 120. Use merge loading like Task 2.

- [ ] **Step 2: Protect TicketSalesInternalController hotspots**

Annotate only:

- `lockStock` -> `SALES_LOCK_STOCK`
- `lockSeats` -> `SALES_LOCK_SEATS`
- `confirmSold` -> `SALES_CONFIRM_SOLD`

Do not annotate `quote`, `release`, or `refund` in this task.

Each block handler returns `Result.fail(429, "系统繁忙，请稍后重试")`.

- [ ] **Step 3: Protect SeatController seat map read**

Annotate `getSeatMap(Long sessionId, Long ticketTypeId)` with `SEAT_MAP_READ` and add:

```java
public Result<SeatMapResponse> getSeatMapBlocked(Long sessionId, Long ticketTypeId, BlockException exception) {
    return Result.fail(429, "系统繁忙，请稍后重试");
}
```

- [ ] **Step 4: Add tests and run**

Add direct block handler tests for lock stock, lock seats, confirm sold, and seat map read. Run:

```bash
cd /c/Users/Administrator/Desktop/omni/.claude/worktrees/grab-low-risk-sentinel/java && mvn -pl java-ticket -Dtest=TicketSalesInternalControllerTest,SeatControllerSentinelTest test
```

Expected: PASS.

---

### Task 4: 支付热点资源限流与支付渠道熔断规则

**Files:**
- Create: `java/java-payment/src/main/java/com/omni/payment/config/PaymentSentinelConfig.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/controller/AlipayController.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/controller/RefundController.java`
- Create or Modify tests.

- [ ] **Step 1: Add PaymentSentinelConfig**

Create flow resources:

```java
public static final String ALIPAY_SYNC = "payment-alipay-sync";
public static final String ALIPAY_NOTIFY = "payment-alipay-notify";
public static final String REFUND_APPLY = "payment-refund-apply";
```

Create degrade resources:

```java
public static final String ORDER_CLIENT = "payment-order-client";
public static final String ALIPAY_CHANNEL = "payment-alipay-channel";
```

Use merge loading for FlowRule and DegradeRule.

- [ ] **Step 2: Protect AlipayController**

Annotate:

- `sync(Long orderId)` -> `ALIPAY_SYNC`
- `notify(HttpServletRequest request)` -> `ALIPAY_NOTIFY`

Block handlers:

```java
public Result<PaymentStatusResponse> syncBlocked(Long orderId, BlockException exception) {
    return Result.fail(429, "系统繁忙，请稍后重试");
}

public String notifyBlocked(HttpServletRequest request, BlockException exception) {
    return "failure";
}
```

- [ ] **Step 3: Protect RefundController.apply**

Annotate only `apply` with `REFUND_APPLY`. Do not protect approve/reject in this first pass.

Block handler returns `Result.fail(429, "系统繁忙，请稍后重试")`.

- [ ] **Step 4: Add tests and run**

Add direct block handler tests for `syncBlocked`, `notifyBlocked`, and `applyBlocked`. Run:

```bash
cd /c/Users/Administrator/Desktop/omni/.claude/worktrees/grab-low-risk-sentinel/java && mvn -pl java-payment -Dtest=AlipayControllerTest,RefundControllerTest test
```

Expected: PASS.

---

### Task 5: 用户登录与验证码限流

**Files:**
- Create: `java/java-user/src/main/java/com/omni/user/config/UserSentinelConfig.java`
- Modify: `java/java-user/src/main/java/com/omni/user/controller/UserController.java`
- Create or Modify: `java/java-user/src/test/java/com/omni/user/controller/UserControllerSentinelTest.java`

- [ ] **Step 1: Add UserSentinelConfig**

Resources:

```java
public static final String USER_LOGIN_PASSWORD = "user-login-password";
public static final String USER_SEND_CODE = "user-send-code";
```

Defaults: login QPS 50, send-code QPS 20. Use merge loading.

- [ ] **Step 2: Protect UserController login and sendCode**

Annotate `login` and `sendCode`. Block handlers return `Result.fail(429, "系统繁忙，请稍后重试")`.

- [ ] **Step 3: Add tests and run**

Run:

```bash
cd /c/Users/Administrator/Desktop/omni/.claude/worktrees/grab-low-risk-sentinel/java && mvn -pl java-user -Dtest=UserControllerSentinelTest test
```

Expected: PASS.

---

### Task 6: Final verification

**Files:**
- No source changes expected.

- [ ] **Step 1: Run targeted Java tests**

```bash
cd /c/Users/Administrator/Desktop/omni/.claude/worktrees/grab-low-risk-sentinel/java && mvn -pl java-gateway,java-user,java-ticket,java-order,java-payment test
```

Expected: PASS.

- [ ] **Step 2: Run grab-service tests**

```bash
cd /c/Users/Administrator/Desktop/omni/.claude/worktrees/grab-low-risk-sentinel/nestjs/grab-service && node ./node_modules/jest/bin/jest.js --runInBand
```

Expected: PASS.

- [ ] **Step 3: Run microservice boundary verification**

```bash
powershell -ExecutionPolicy Bypass -File "C:/Users/Administrator/Desktop/omni/.claude/worktrees/grab-low-risk-sentinel/scripts/verify-microservice-boundaries.ps1"
```

Expected: PASS with `All microservice boundary checks passed.`

- [ ] **Step 4: Check artifacts**

```bash
git status --short
```

Expected: no `runtime/`, private upload PDFs, dumps, backups, node/pnpm artifacts, or unrelated settings changes.

## Self-Review

- Spec coverage:
  - Gateway 粗粒度限流：Task 1。
  - 订单核心资源限流和跨服务熔断规则：Task 2。
  - 票务热点资源：Task 3。
  - 支付热点和支付渠道熔断：Task 4。
  - 登录/验证码防刷：Task 5。
  - 最终边界和回归验证：Task 6。
- Scope control:
  - 已移除 notification 全服务保护、退款审核、普通票务 quote/release/refund、全量 order/payment/ticket 路由限流等过度铺开项。
- Type consistency:
  - 所有 block handler 使用原方法参数加 `BlockException`。
  - 所有业务失败响应使用 `Result.fail(429, "系统繁忙，请稍后重试")`，支付宝 notify 仍使用支付宝期望的字符串 `failure`。
