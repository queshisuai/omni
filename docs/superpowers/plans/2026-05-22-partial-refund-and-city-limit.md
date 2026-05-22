# 部分退款与城市站限购实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 支持用户对多张票订单选择部分退款，并支持 admin/organizer 在活动或巡演城市站发布时配置每人限购张数或不限购。

**Architecture:** 限购落在 `activity.per_user_limit`，普通活动按活动限购，巡演每个城市站对应独立 `Activity`，因此天然按城市站限购。部分退款采用方案 A，在 `refund_request` 增加 `quantity`、`order_seat_ids`、`refund_type`，退款申请仍归 `java-payment`，可退款明细和订单座位状态归 `java-order`，库存/座位释放归 `java-ticket` internal API。

**Tech Stack:** Java Spring Cloud Alibaba、MyBatis-Plus、PostgreSQL、Feign、Next.js 16、React 19、TypeScript。

---

## 文件结构

- `sql/migrations/shared/20260522_partial_refund_and_purchase_limit.sql`：共享库历史迁移，新增 `activity.per_user_limit` 和 `refund_request` 部分退款字段。
- `sql/production-split/ticket/20260522_activity_purchase_limit.sql`：ticket 拆库迁移，只改 `activity`。
- `sql/production-split/payment/20260522_partial_refund.sql`：payment 拆库迁移，只改 `refund_request`。
- `sql/production-split/manifest.json`：登记新增迁移。
- `scripts/check-production-split-sql.ps1`：允许新增字段进入生产拆库安全检查。
- `java/java-ticket/src/main/java/com/omni/ticket/entity/Activity.java`：新增 `perUserLimit`。
- `java/java-ticket/src/main/java/com/omni/ticket/dto/TicketSalesQuoteResponse.java`：新增 `perUserLimit`，随报价返回给 order。
- `java/java-ticket/src/main/java/com/omni/ticket/service/TicketSalesInternalService.java`：报价读取并返回 `activity.perUserLimit`。
- `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`：创建/编辑活动、发布城市站时解析限购。
- `java/java-ticket/src/test/java/com/omni/ticket/service/TicketSalesInternalServiceTest.java`：覆盖报价返回限购。
- `java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java`：覆盖限购参数校验。
- `java/java-order/src/main/java/com/omni/order/dto/TicketSalesQuoteResponse.java`：接收 `perUserLimit`。
- `java/java-order/src/main/java/com/omni/order/dto/RefundOptionsResponse.java`：新增 order internal 可退款明细响应。
- `java/java-order/src/main/java/com/omni/order/dto/RefundSeatOptionResponse.java`：新增可退座位项。
- `java/java-order/src/main/java/com/omni/order/dto/MarkPartialRefundedRequest.java`：新增 payment -> order 标记部分退款请求。
- `java/java-order/src/main/java/com/omni/order/mapper/OrderMapper.java`：新增按 activity 统计有效持票数的方法。
- `java/java-order/src/main/java/com/omni/order/mapper/OrderSeatMapper.java`：新增查询/批量更新可退座位。
- `java/java-order/src/main/java/com/omni/order/service/OrderService.java`：下单限购校验、可退款明细、部分退款成功后释放库存。
- `java/java-order/src/main/java/com/omni/order/controller/OrderController.java`：新增 internal `refund-options` 和 `mark-partial-refunded`。
- `java/java-order/src/test/java/com/omni/order/service/OrderServiceTest.java`：覆盖限购。
- `java/java-order/src/test/java/com/omni/order/service/OrderPartialRefundServiceTest.java`：覆盖可退款明细和部分退款成功。
- `java/java-payment/src/main/java/com/omni/payment/entity/RefundRequest.java`：新增部分退款字段。
- `java/java-payment/src/main/java/com/omni/payment/dto/ApplyRefundRequest.java`：新增 `quantity`、`orderSeatIds`。
- `java/java-payment/src/main/java/com/omni/payment/dto/RefundRequestVO.java`：返回部分退款字段。
- `java/java-payment/src/main/java/com/omni/payment/dto/OrderRefundOptionsResponse.java`：新增 payment 侧 order internal 响应 DTO。
- `java/java-payment/src/main/java/com/omni/payment/dto/MarkPartialRefundedRequest.java`：新增 payment 侧请求 DTO。
- `java/java-payment/src/main/java/com/omni/payment/client/OrderClient.java`：新增 refund-options 和 mark-partial-refunded Feign 方法。
- `java/java-payment/src/main/java/com/omni/payment/service/RefundService.java`：申请时计算部分退款金额，审核成功后按 full/partial 调 order。
- `java/java-payment/src/test/java/com/omni/payment/service/RefundServiceBoundaryTest.java`：覆盖部分退款申请、重复申请、审核成功。
- `frontend/src/types/api.ts`：新增限购字段、退款字段、可退款明细类型。
- `frontend/src/lib/api.ts`：新增 `getRefundOptions(orderId)`，扩展 `applyRefund` 入参。
- `frontend/src/app/console/activities/new/page.tsx`、`frontend/src/app/console/activities/[id]/edit/page.tsx`、`frontend/src/app/console/tours/[id]/stations/new/page.tsx`：增加限购输入。
- `frontend/src/app/orders/page.tsx`：退款弹窗支持选择数量/座位并展示预计金额。

---

### Task 1: 数据库迁移

**Files:**
- Create: `sql/migrations/shared/20260522_partial_refund_and_purchase_limit.sql`
- Create: `sql/production-split/ticket/20260522_activity_purchase_limit.sql`
- Create: `sql/production-split/payment/20260522_partial_refund.sql`
- Modify: `sql/production-split/manifest.json`
- Modify: `scripts/check-production-split-sql.ps1`

- [ ] **Step 1: 写迁移 SQL**

`sql/migrations/shared/20260522_partial_refund_and_purchase_limit.sql` 内容：

```sql
ALTER TABLE activity
    ADD COLUMN IF NOT EXISTS per_user_limit INTEGER;

ALTER TABLE activity
    DROP CONSTRAINT IF EXISTS ck_activity_per_user_limit_positive;

ALTER TABLE activity
    ADD CONSTRAINT ck_activity_per_user_limit_positive
    CHECK (per_user_limit IS NULL OR per_user_limit > 0);

ALTER TABLE refund_request
    ADD COLUMN IF NOT EXISTS quantity INTEGER;

ALTER TABLE refund_request
    ADD COLUMN IF NOT EXISTS order_seat_ids VARCHAR(500);

ALTER TABLE refund_request
    ADD COLUMN IF NOT EXISTS refund_type VARCHAR(32) DEFAULT 'full';

UPDATE refund_request
SET refund_type = 'full'
WHERE refund_type IS NULL;

ALTER TABLE refund_request
    DROP CONSTRAINT IF EXISTS ck_refund_request_quantity_positive;

ALTER TABLE refund_request
    ADD CONSTRAINT ck_refund_request_quantity_positive
    CHECK (quantity IS NULL OR quantity > 0);

ALTER TABLE refund_request
    DROP CONSTRAINT IF EXISTS ck_refund_request_refund_type;

ALTER TABLE refund_request
    ADD CONSTRAINT ck_refund_request_refund_type
    CHECK (refund_type IN ('full', 'partial'));
```

`sql/production-split/ticket/20260522_activity_purchase_limit.sql` 内容：

```sql
ALTER TABLE activity
    ADD COLUMN IF NOT EXISTS per_user_limit INTEGER;

ALTER TABLE activity
    DROP CONSTRAINT IF EXISTS ck_activity_per_user_limit_positive;

ALTER TABLE activity
    ADD CONSTRAINT ck_activity_per_user_limit_positive
    CHECK (per_user_limit IS NULL OR per_user_limit > 0);
```

`sql/production-split/payment/20260522_partial_refund.sql` 内容：

```sql
ALTER TABLE refund_request
    ADD COLUMN IF NOT EXISTS quantity INTEGER;

ALTER TABLE refund_request
    ADD COLUMN IF NOT EXISTS order_seat_ids VARCHAR(500);

ALTER TABLE refund_request
    ADD COLUMN IF NOT EXISTS refund_type VARCHAR(32) DEFAULT 'full';

UPDATE refund_request
SET refund_type = 'full'
WHERE refund_type IS NULL;

ALTER TABLE refund_request
    DROP CONSTRAINT IF EXISTS ck_refund_request_quantity_positive;

ALTER TABLE refund_request
    ADD CONSTRAINT ck_refund_request_quantity_positive
    CHECK (quantity IS NULL OR quantity > 0);

ALTER TABLE refund_request
    DROP CONSTRAINT IF EXISTS ck_refund_request_refund_type;

ALTER TABLE refund_request
    ADD CONSTRAINT ck_refund_request_refund_type
    CHECK (refund_type IN ('full', 'partial'));
```

- [ ] **Step 2: 登记 manifest 和 SQL 检查白名单**

在 `sql/production-split/manifest.json` 的 ticket 迁移列表加入：

```json
"ticket/20260522_activity_purchase_limit.sql"
```

在 payment 迁移列表加入：

```json
"payment/20260522_partial_refund.sql"
```

在 `scripts/check-production-split-sql.ps1` 的 `$schemaColumns` 中允许：

```powershell
'activity.per_user_limit',
'refund_request.quantity',
'refund_request.order_seat_ids',
'refund_request.refund_type'
```

- [ ] **Step 3: 验证 SQL 安全检查**

Run: `powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1`

Expected: `PASS production split SQL safety check`

- [ ] **Step 4: 提交**

```powershell
git add sql/migrations/shared/20260522_partial_refund_and_purchase_limit.sql sql/production-split/ticket/20260522_activity_purchase_limit.sql sql/production-split/payment/20260522_partial_refund.sql sql/production-split/manifest.json scripts/check-production-split-sql.ps1
git commit -m "feat: add refund and purchase limit schema"
```

---

### Task 2: ticket 报价返回城市站限购

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/entity/Activity.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/TicketSalesQuoteResponse.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TicketSalesInternalService.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/TicketSalesInternalServiceTest.java`

- [ ] **Step 1: 写失败测试**

在 `TicketSalesInternalServiceTest` 增加测试：

```java
@Test
void quoteReturnsPerUserLimitFromActivity() {
    Activity activity = new Activity();
    activity.setId(1001L);
    activity.setName("南京站");
    activity.setPerUserLimit(2);

    Session session = new Session();
    session.setId(2001L);
    session.setActivityId(1001L);

    TicketType ticketType = new TicketType();
    ticketType.setId(3001L);
    ticketType.setSessionId(2001L);
    ticketType.setName("看台");
    ticketType.setPrice(new BigDecimal("380.00"));
    ticketType.setTotalStock(10);
    ticketType.setRemainStock(10);

    when(sessionMapper.selectById(2001L)).thenReturn(session);
    when(activityMapper.selectById(1001L)).thenReturn(activity);
    when(ticketTypeMapper.selectById(3001L)).thenReturn(ticketType);

    TicketSalesQuoteRequest request = new TicketSalesQuoteRequest();
    request.setSessionId(2001L);
    request.setTicketTypeId(3001L);
    request.setQuantity(1);

    TicketSalesQuoteResponse response = service.quote(request);

    assertEquals(1001L, response.getActivityId());
    assertEquals(2, response.getPerUserLimit());
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `mvn test -pl java-ticket -Dtest=TicketSalesInternalServiceTest#quoteReturnsPerUserLimitFromActivity`

Workdir: `java`

Expected: FAIL，提示 `getPerUserLimit` 或 `setPerUserLimit` 不存在。

- [ ] **Step 3: 实现字段和报价赋值**

在 `Activity` 增加字段和 getter/setter：

```java
private Integer perUserLimit;

public Integer getPerUserLimit() { return perUserLimit; }
public void setPerUserLimit(Integer perUserLimit) { this.perUserLimit = perUserLimit; }
```

在 ticket 侧 `TicketSalesQuoteResponse` 增加：

```java
private Integer perUserLimit;

public Integer getPerUserLimit() { return perUserLimit; }
public void setPerUserLimit(Integer perUserLimit) { this.perUserLimit = perUserLimit; }
```

在 `TicketSalesInternalService.quote()` 构建 response 时加入：

```java
response.setPerUserLimit(activity.getPerUserLimit());
```

- [ ] **Step 4: 运行测试确认通过**

Run: `mvn test -pl java-ticket -Dtest=TicketSalesInternalServiceTest#quoteReturnsPerUserLimitFromActivity`

Workdir: `java`

Expected: PASS。

- [ ] **Step 5: 提交**

```powershell
git add java/java-ticket/src/main/java/com/omni/ticket/entity/Activity.java java/java-ticket/src/main/java/com/omni/ticket/dto/TicketSalesQuoteResponse.java java/java-ticket/src/main/java/com/omni/ticket/service/TicketSalesInternalService.java java/java-ticket/src/test/java/com/omni/ticket/service/TicketSalesInternalServiceTest.java
git commit -m "feat: expose activity purchase limit in quote"
```

---

### Task 3: 后台创建/编辑/城市站发布保存限购

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/app/console/activities/new/page.tsx`
- Modify: `frontend/src/app/console/activities/[id]/edit/page.tsx`
- Modify: `frontend/src/app/console/tours/[id]/stations/new/page.tsx`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java`

- [ ] **Step 1: 写失败测试**

在 `AdminControllerTest` 增加：

```java
@Test
void createActivityRejectsNonPositivePerUserLimit() {
    Map<String, Object> body = new HashMap<>();
    body.put("name", "测试活动");
    body.put("perUserLimit", 0);

    Result<Activity> result = controller.createActivity(body);

    assertEquals(400, result.getCode());
    assertEquals("个人限购张数必须大于0", result.getMessage());
}
```

再增加保存正整数的测试：

```java
@Test
void createActivitySavesPerUserLimit() {
    Map<String, Object> body = validCreateActivityBody();
    body.put("perUserLimit", 3);

    when(activityMapper.insert(any(Activity.class))).thenAnswer(invocation -> {
        Activity activity = invocation.getArgument(0);
        activity.setId(100L);
        return 1;
    });

    Result<Activity> result = controller.createActivity(body);

    assertEquals(200, result.getCode());
    assertEquals(3, result.getData().getPerUserLimit());
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `mvn test -pl java-ticket -Dtest=AdminControllerTest#createActivityRejectsNonPositivePerUserLimit,AdminControllerTest#createActivitySavesPerUserLimit`

Workdir: `java`

Expected: FAIL，限购字段未解析或测试 helper 需按现有测试结构补齐。

- [ ] **Step 3: 后端解析限购**

在 `AdminController` 增加解析方法：

```java
private Integer parsePerUserLimit(Object value) {
    if (value == null || "".equals(String.valueOf(value).trim())) {
        return null;
    }
    try {
        int parsed = Integer.parseInt(String.valueOf(value));
        if (parsed <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "个人限购张数必须大于0");
        }
        return parsed;
    } catch (NumberFormatException e) {
        throw new BusinessException(ResultCode.BAD_REQUEST, "个人限购张数必须为数字");
    }
}
```

在创建、编辑 Activity 和发布 Station 创建/更新 Activity 的位置加入：

```java
activity.setPerUserLimit(parsePerUserLimit(body.get("perUserLimit")));
```

- [ ] **Step 4: 前端表单加入不限购/限购 N 张**

在相关页面的表单 state 增加：

```ts
perUserLimit: ''
```

提交 payload 增加：

```ts
perUserLimit: form.perUserLimit.trim() ? Number(form.perUserLimit) : null,
```

表单 UI 增加：

```tsx
<label className="block text-sm font-medium text-gray-700">个人限购</label>
<input
  type="number"
  min={1}
  value={form.perUserLimit}
  onChange={(event) => setForm((prev) => ({ ...prev, perUserLimit: event.target.value }))}
  placeholder="留空表示不限购，例如 2"
  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#ff1268]"
/>
<p className="mt-1 text-xs text-gray-500">巡演城市站按每个城市站单独限购，不按整轮巡演累计。</p>
```

- [ ] **Step 5: 验证**

Run: `mvn test -pl java-ticket -Dtest=AdminControllerTest`

Workdir: `java`

Expected: PASS。

Run: `pnpm typecheck`

Workdir: `frontend`

Expected: `tsc --noEmit` 成功。

- [ ] **Step 6: 提交**

```powershell
git add java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java frontend/src/types/api.ts frontend/src/lib/api.ts frontend/src/app/console/activities/new/page.tsx frontend/src/app/console/activities/[id]/edit/page.tsx frontend/src/app/console/tours/[id]/stations/new/page.tsx
git commit -m "feat: configure per-user purchase limits"
```

---

### Task 4: order 下单限购校验

**Files:**
- Modify: `java/java-order/src/main/java/com/omni/order/dto/TicketSalesQuoteResponse.java`
- Modify: `java/java-order/src/main/java/com/omni/order/mapper/OrderMapper.java`
- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java`
- Test: `java/java-order/src/test/java/com/omni/order/service/OrderServiceTest.java`

- [ ] **Step 1: 写失败测试**

在 `OrderServiceTest` 增加：

```java
@Test
void createOrderRejectsWhenActivityLimitExceeded() {
    CreateOrderRequest request = new CreateOrderRequest();
    request.setUserId(2004L);
    request.setSessionId(10L);
    request.setTicketTypeId(20L);
    request.setQuantity(2);

    TicketSalesQuoteResponse quote = new TicketSalesQuoteResponse();
    quote.setActivityId(100L);
    quote.setPerUserLimit(3);
    quote.setUnitPrice(new BigDecimal("100.00"));
    quote.setQuantity(2);

    when(userInternalClient.getUserRef(eq(2004L), anyString())).thenReturn(Result.success(new InternalUserRefResponse(2004L, "13900000001", "user", 1)));
    when(ticketSalesInternalClient.quote(any(), anyString())).thenReturn(Result.success(quote));
    when(orderMapper.sumEffectiveQuantityByUserAndActivity(2004L, 100L)).thenReturn(2);

    BusinessException ex = assertThrows(BusinessException.class, () -> service.createOrder(request));

    assertEquals("超过本活动个人限购数量", ex.getMessage());
    verify(orderMapper, never()).insert(any(Order.class));
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `mvn test -pl java-order -Dtest=OrderServiceTest#createOrderRejectsWhenActivityLimitExceeded`

Workdir: `java`

Expected: FAIL，`perUserLimit` 或 mapper 方法不存在。

- [ ] **Step 3: DTO 和 mapper 增加字段/查询**

在 order 侧 `TicketSalesQuoteResponse` 增加：

```java
private Integer perUserLimit;

public Integer getPerUserLimit() { return perUserLimit; }
public void setPerUserLimit(Integer perUserLimit) { this.perUserLimit = perUserLimit; }
```

在 `OrderMapper` 增加：

```java
@Select("SELECT COALESCE(SUM(o.quantity), 0) " +
        "FROM \"order\" o " +
        "JOIN order_snapshot os ON os.order_id = o.id " +
        "WHERE o.user_id = #{userId} " +
        "AND os.activity_id = #{activityId} " +
        "AND o.status = 2")
Integer sumEffectiveQuantityByUserAndActivity(@Param("userId") Long userId, @Param("activityId") Long activityId);
```

后续 Task 6 会把这个统计改成减去已退款 `order_seat` 数量；本任务先拦截未退款有效持票。

- [ ] **Step 4: OrderService 加校验**

在 `createOrder()` 和 `createOrderWithSeats()` 取得 quote 后调用：

```java
validatePerUserLimit(request.getUserId(), quote, quantity);
```

新增方法：

```java
private void validatePerUserLimit(Long userId, TicketSalesQuoteResponse quote, int quantity) {
    Integer limit = quote.getPerUserLimit();
    if (limit == null) {
        return;
    }
    Integer existing = orderMapper.sumEffectiveQuantityByUserAndActivity(userId, quote.getActivityId());
    int effective = existing == null ? 0 : existing;
    if (effective + quantity > limit) {
        throw new BusinessException(ResultCode.BAD_REQUEST, "超过本活动个人限购数量");
    }
}
```

- [ ] **Step 5: 验证**

Run: `mvn test -pl java-order -Dtest=OrderServiceTest#createOrderRejectsWhenActivityLimitExceeded`

Workdir: `java`

Expected: PASS。

- [ ] **Step 6: 提交**

```powershell
git add java/java-order/src/main/java/com/omni/order/dto/TicketSalesQuoteResponse.java java/java-order/src/main/java/com/omni/order/mapper/OrderMapper.java java/java-order/src/main/java/com/omni/order/service/OrderService.java java/java-order/src/test/java/com/omni/order/service/OrderServiceTest.java
git commit -m "feat: enforce activity purchase limits"
```

---

### Task 5: order 可退款明细和部分退款成功处理

**Files:**
- Create: `java/java-order/src/main/java/com/omni/order/dto/RefundOptionsResponse.java`
- Create: `java/java-order/src/main/java/com/omni/order/dto/RefundSeatOptionResponse.java`
- Create: `java/java-order/src/main/java/com/omni/order/dto/MarkPartialRefundedRequest.java`
- Modify: `java/java-order/src/main/java/com/omni/order/mapper/OrderSeatMapper.java`
- Modify: `java/java-order/src/main/java/com/omni/order/controller/OrderController.java`
- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java`
- Test: `java/java-order/src/test/java/com/omni/order/service/OrderPartialRefundServiceTest.java`

- [ ] **Step 1: 写失败测试**

创建 `OrderPartialRefundServiceTest`，核心测试：

```java
@Test
void markPartialRefundedRefundsSelectedSeatAndKeepsOrderPaid() {
    Order order = new Order();
    order.setId(10L);
    order.setUserId(2004L);
    order.setSessionId(300L);
    order.setTicketTypeId(400L);
    order.setQuantity(2);
    order.setStatus(OrderService.STATUS_PAID);

    OrderSeat seat = new OrderSeat();
    seat.setId(900L);
    seat.setOrderId(10L);
    seat.setSessionSeatId(800L);
    seat.setSessionId(300L);
    seat.setTicketTypeId(400L);
    seat.setStatus(2);

    when(orderMapper.selectById(10L)).thenReturn(order);
    when(orderSeatMapper.selectRefundableSeatsByOrderId(10L)).thenReturn(List.of(seat));
    when(ticketSalesInternalClient.refund(any(), anyString())).thenReturn(Result.success());

    MarkPartialRefundedRequest request = new MarkPartialRefundedRequest();
    request.setQuantity(1);
    request.setOrderSeatIds(List.of(900L));

    Order result = service.markPartialRefunded(10L, request);

    assertEquals(OrderService.STATUS_PAID, result.getStatus());
    verify(orderSeatMapper).updateStatusByIds(List.of(900L), 3);
    verify(ticketSalesInternalClient).refund(any(), anyString());
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `mvn test -pl java-order -Dtest=OrderPartialRefundServiceTest#markPartialRefundedRefundsSelectedSeatAndKeepsOrderPaid`

Workdir: `java`

Expected: FAIL，DTO 和 service 方法不存在。

- [ ] **Step 3: 新增 DTO**

`RefundSeatOptionResponse`：

```java
public class RefundSeatOptionResponse {
    private Long orderSeatId;
    private Long sessionSeatId;
    private Long sessionId;
    private Long ticketTypeId;
    private String seatLabel;
    public Long getOrderSeatId() { return orderSeatId; }
    public void setOrderSeatId(Long orderSeatId) { this.orderSeatId = orderSeatId; }
    public Long getSessionSeatId() { return sessionSeatId; }
    public void setSessionSeatId(Long sessionSeatId) { this.sessionSeatId = sessionSeatId; }
    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public Long getTicketTypeId() { return ticketTypeId; }
    public void setTicketTypeId(Long ticketTypeId) { this.ticketTypeId = ticketTypeId; }
    public String getSeatLabel() { return seatLabel; }
    public void setSeatLabel(String seatLabel) { this.seatLabel = seatLabel; }
}
```

`RefundOptionsResponse`：

```java
public class RefundOptionsResponse {
    private Long orderId;
    private Integer totalQuantity;
    private Integer refundedQuantity;
    private Integer refundableQuantity;
    private BigDecimal unitPrice;
    private List<RefundSeatOptionResponse> seats;
    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public Integer getTotalQuantity() { return totalQuantity; }
    public void setTotalQuantity(Integer totalQuantity) { this.totalQuantity = totalQuantity; }
    public Integer getRefundedQuantity() { return refundedQuantity; }
    public void setRefundedQuantity(Integer refundedQuantity) { this.refundedQuantity = refundedQuantity; }
    public Integer getRefundableQuantity() { return refundableQuantity; }
    public void setRefundableQuantity(Integer refundableQuantity) { this.refundableQuantity = refundableQuantity; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public void setUnitPrice(BigDecimal unitPrice) { this.unitPrice = unitPrice; }
    public List<RefundSeatOptionResponse> getSeats() { return seats; }
    public void setSeats(List<RefundSeatOptionResponse> seats) { this.seats = seats; }
}
```

`MarkPartialRefundedRequest`：

```java
public class MarkPartialRefundedRequest {
    private Integer quantity;
    private List<Long> orderSeatIds;
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public List<Long> getOrderSeatIds() { return orderSeatIds; }
    public void setOrderSeatIds(List<Long> orderSeatIds) { this.orderSeatIds = orderSeatIds; }
}
```

- [ ] **Step 4: mapper 和 service 实现**

在 `OrderSeatMapper` 增加：

```java
@Select("SELECT * FROM order_seat WHERE order_id = #{orderId} AND status = 2 ORDER BY id")
List<OrderSeat> selectRefundableSeatsByOrderId(@Param("orderId") Long orderId);

@Select("SELECT COUNT(*) FROM order_seat WHERE order_id = #{orderId} AND status = 3")
Integer countRefundedSeatsByOrderId(@Param("orderId") Long orderId);

@Update({"<script>",
        "UPDATE order_seat SET status = #{status}, update_time = CURRENT_TIMESTAMP WHERE id IN",
        "<foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach>",
        "</script>"})
int updateStatusByIds(@Param("ids") List<Long> ids, @Param("status") Integer status);
```

在 `OrderService` 新增 `getRefundOptions()` 和 `markPartialRefunded()`，核心逻辑：

```java
public RefundOptionsResponse getRefundOptions(Long orderId) {
    Order order = getOrderDetail(orderId);
    if (order.getStatus() != STATUS_PAID) {
        throw new BusinessException(ResultCode.BAD_REQUEST, "仅已支付订单可退款");
    }
    List<OrderSeat> seats = orderSeatMapper.selectRefundableSeatsByOrderId(orderId);
    int refunded = orderSeatMapper.countRefundedSeatsByOrderId(orderId);
    int refundable = seats.isEmpty() ? order.getQuantity() - refunded : seats.size();
    RefundOptionsResponse response = new RefundOptionsResponse();
    response.setOrderId(orderId);
    response.setTotalQuantity(order.getQuantity());
    response.setRefundedQuantity(refunded);
    response.setRefundableQuantity(refundable);
    response.setUnitPrice(order.getAmount().divide(BigDecimal.valueOf(order.getQuantity()), 2, RoundingMode.HALF_UP));
    response.setSeats(seats.stream().map(this::toRefundSeatOption).collect(Collectors.toList()));
    return response;
}
```

`markPartialRefunded()` 必须校验数量不能超过可退数量；有 `orderSeatIds` 时只退这些座位；退完全部票时订单状态更新为 `STATUS_REFUNDED`；否则保持 `STATUS_PAID`。

- [ ] **Step 5: controller internal API**

在 `OrderController` 增加：

```java
@GetMapping("/internal/{id}/refund-options")
public Result<RefundOptionsResponse> getInternalRefundOptions(@PathVariable Long id,
        @RequestHeader(value = "X-Internal-Token", required = false) String token) {
    if (!isValidInternalToken(token)) return Result.fail(403, "无权限");
    return Result.success(orderService.getRefundOptions(id));
}

@PostMapping("/internal/{id}/partial-refunded")
public Result<Order> markInternalPartialRefunded(@PathVariable Long id,
        @RequestBody MarkPartialRefundedRequest request,
        @RequestHeader(value = "X-Internal-Token", required = false) String token) {
    if (!isValidInternalToken(token)) return Result.fail(403, "无权限");
    return Result.success(orderService.markPartialRefunded(id, request));
}
```

- [ ] **Step 6: 验证**

Run: `mvn test -pl java-order -Dtest=OrderPartialRefundServiceTest`

Workdir: `java`

Expected: PASS。

- [ ] **Step 7: 提交**

```powershell
git add java/java-order/src/main/java/com/omni/order/dto/RefundOptionsResponse.java java/java-order/src/main/java/com/omni/order/dto/RefundSeatOptionResponse.java java/java-order/src/main/java/com/omni/order/dto/MarkPartialRefundedRequest.java java/java-order/src/main/java/com/omni/order/mapper/OrderSeatMapper.java java/java-order/src/main/java/com/omni/order/controller/OrderController.java java/java-order/src/main/java/com/omni/order/service/OrderService.java java/java-order/src/test/java/com/omni/order/service/OrderPartialRefundServiceTest.java
git commit -m "feat: support partial refund order updates"
```

---

### Task 6: payment 部分退款申请与审核

**Files:**
- Modify: `java/java-payment/src/main/java/com/omni/payment/entity/RefundRequest.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/dto/ApplyRefundRequest.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/dto/RefundRequestVO.java`
- Create: `java/java-payment/src/main/java/com/omni/payment/dto/OrderRefundOptionsResponse.java`
- Create: `java/java-payment/src/main/java/com/omni/payment/dto/MarkPartialRefundedRequest.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/client/OrderClient.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/controller/RefundController.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/service/RefundService.java`
- Test: `java/java-payment/src/test/java/com/omni/payment/service/RefundServiceBoundaryTest.java`

- [ ] **Step 1: 写失败测试**

在 `RefundServiceBoundaryTest` 增加：

```java
@Test
void applyPartialRefundCalculatesAmountFromOrderOptions() {
    OrderInfoResponse order = paidOrder(10L, 2004L, "DM10", new BigDecimal("760.00"));
    OrderRefundOptionsResponse options = new OrderRefundOptionsResponse();
    options.setOrderId(10L);
    options.setTotalQuantity(2);
    options.setRefundedQuantity(0);
    options.setRefundableQuantity(2);
    options.setUnitPrice(new BigDecimal("380.00"));

    when(orderClient.getOrder(10L, "test-token")).thenReturn(Result.success(order));
    when(orderClient.getRefundOptions(10L, "test-token")).thenReturn(Result.success(options));
    when(paymentMapper.selectList(any())).thenReturn(List.of(successPayment(order)));
    when(refundRequestMapper.insert(any(RefundRequest.class))).thenAnswer(invocation -> {
        RefundRequest refund = invocation.getArgument(0);
        refund.setId(1L);
        return 1;
    });

    RefundRequestVO result = service.applyRefund(10L, 2004L, "只退一张", null, 1, List.of());

    assertEquals(new BigDecimal("380.00"), result.getAmount());
    assertEquals("partial", result.getRefundType());
    assertEquals(1, result.getQuantity());
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `mvn test -pl java-payment -Dtest=RefundServiceBoundaryTest#applyPartialRefundCalculatesAmountFromOrderOptions`

Workdir: `java`

Expected: FAIL，方法签名和 DTO 不存在。

- [ ] **Step 3: 扩展 DTO/entity**

`RefundRequest` 增加：

```java
private Integer quantity;
private String orderSeatIds;
private String refundType;
```

并补齐 getter/setter。

`ApplyRefundRequest` 增加：

```java
private Integer quantity;
private List<Long> orderSeatIds;
```

`RefundRequestVO` 增加同名展示字段。

- [ ] **Step 4: Feign client 增加 order internal 调用**

在 `OrderClient` 增加：

```java
@GetMapping("/api/order/internal/{id}/refund-options")
Result<OrderRefundOptionsResponse> getRefundOptions(@PathVariable("id") Long id,
        @RequestHeader("X-Internal-Token") String token);

@PostMapping("/api/order/internal/{id}/partial-refunded")
Result<OrderInfoResponse> markPartialRefunded(@PathVariable("id") Long id,
        @RequestBody MarkPartialRefundedRequest request,
        @RequestHeader("X-Internal-Token") String token);
```

- [ ] **Step 5: RefundService 申请逻辑**

新增重载：

```java
public RefundRequestVO applyRefund(Long orderId, Long userId, String reason, String reasonType, Integer quantity, List<Long> orderSeatIds)
```

逻辑：

```java
OrderRefundOptionsResponse options = getRefundOptionsOrThrow(orderId);
int refundQuantity = quantity == null ? options.getRefundableQuantity() : quantity;
if (refundQuantity <= 0 || refundQuantity > options.getRefundableQuantity()) {
    throw new BusinessException(ResultCode.BAD_REQUEST, "可退款票数不足");
}
String refundType = refundQuantity >= options.getRefundableQuantity() && options.getRefundedQuantity() == 0 ? "full" : "partial";
BigDecimal amount = options.getUnitPrice().multiply(BigDecimal.valueOf(refundQuantity)).setScale(2, RoundingMode.HALF_UP);
refund.setAmount(amount);
refund.setQuantity(refundQuantity);
refund.setOrderSeatIds(joinIds(orderSeatIds));
refund.setRefundType(refundType);
```

保留旧 `applyRefund(orderId, userId, reason, reasonType)`，内部调用新方法并传 `null`，用于整单退款兼容。

- [ ] **Step 6: approve 成功后按类型更新 order**

在支付宝退款成功后：

```java
if ("partial".equals(refund.getRefundType())) {
    MarkPartialRefundedRequest markRequest = new MarkPartialRefundedRequest();
    markRequest.setQuantity(refund.getQuantity());
    markRequest.setOrderSeatIds(parseIds(refund.getOrderSeatIds()));
    orderClient.markPartialRefunded(order.getId(), markRequest, internalApiToken);
} else {
    markOrderRefunded(order.getId());
}
```

- [ ] **Step 7: Controller 传递数量和座位**

修改 `RefundController.apply()`：

```java
return Result.success(refundService.applyRefund(
        request.getOrderId(),
        authUser.userId,
        request.getReason(),
        request.getReasonType(),
        request.getQuantity(),
        request.getOrderSeatIds()));
```

- [ ] **Step 8: 验证**

Run: `mvn test -pl java-payment -Dtest=RefundServiceBoundaryTest`

Workdir: `java`

Expected: PASS。

- [ ] **Step 9: 提交**

```powershell
git add java/java-payment/src/main/java/com/omni/payment/entity/RefundRequest.java java/java-payment/src/main/java/com/omni/payment/dto/ApplyRefundRequest.java java/java-payment/src/main/java/com/omni/payment/dto/RefundRequestVO.java java/java-payment/src/main/java/com/omni/payment/dto/OrderRefundOptionsResponse.java java/java-payment/src/main/java/com/omni/payment/dto/MarkPartialRefundedRequest.java java/java-payment/src/main/java/com/omni/payment/client/OrderClient.java java/java-payment/src/main/java/com/omni/payment/controller/RefundController.java java/java-payment/src/main/java/com/omni/payment/service/RefundService.java java/java-payment/src/test/java/com/omni/payment/service/RefundServiceBoundaryTest.java
git commit -m "feat: support partial refund requests"
```

---

### Task 7: 前端退款弹窗支持选择张数

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/app/orders/page.tsx`

- [ ] **Step 1: 类型和 API**

在 `types/api.ts` 增加：

```ts
export interface RefundSeatOptionVO {
  orderSeatId: number
  sessionSeatId: number
  sessionId: number
  ticketTypeId: number
  seatLabel?: string | null
}

export interface RefundOptionsVO {
  orderId: number
  totalQuantity: number
  refundedQuantity: number
  refundableQuantity: number
  unitPrice: number
  seats: RefundSeatOptionVO[]
}
```

扩展 `RefundRequestVO`：

```ts
quantity?: number | null
orderSeatIds?: string | null
refundType?: 'full' | 'partial' | string | null
```

在 `lib/api.ts` 增加：

```ts
export async function getRefundOptions(orderId: number) {
  return request<RefundOptionsVO>(`/api/order/internal/${orderId}/refund-options`)
}
```

注意：这个 endpoint 是 internal，不能暴露给浏览器直接调用。实际前端应调用新增 public order endpoint：`GET /api/order/{id}/refund-options?userId=...`。如果 Task 5 未提供 public endpoint，需要在 Task 5 同步补充并校验订单归属。

- [ ] **Step 2: 修正 public endpoint**

在 `OrderController` 同步新增 public endpoint：

```java
@GetMapping("/{id}/refund-options")
public Result<RefundOptionsResponse> getRefundOptions(@PathVariable Long id, @RequestParam Long userId) {
    return Result.success(orderService.getUserRefundOptions(id, userId));
}
```

`getUserRefundOptions` 必须校验 `order.userId == userId`。

前端 API 使用：

```ts
export async function getRefundOptions(orderId: number, userId: number) {
  return request<RefundOptionsVO>(`/api/order/${orderId}/refund-options?userId=${userId}`)
}
```

- [ ] **Step 3: 退款弹窗状态**

在 `orders/page.tsx` 增加 state：

```ts
const [refundOptions, setRefundOptions] = useState<RefundOptionsVO | null>(null)
const [refundQuantity, setRefundQuantity] = useState(1)
const [selectedOrderSeatIds, setSelectedOrderSeatIds] = useState<number[]>([])
```

打开弹窗时加载：

```ts
const options = await getRefundOptions(order.id, user.userId)
setRefundOptions(options)
setRefundQuantity(Math.min(1, options.refundableQuantity))
setSelectedOrderSeatIds([])
```

- [ ] **Step 4: 提交退款携带数量/座位**

调用 `applyRefund` 时传：

```ts
quantity: refundOptions?.seats?.length ? selectedOrderSeatIds.length : refundQuantity,
orderSeatIds: selectedOrderSeatIds,
```

预计金额展示：

```tsx
退款金额：¥{((refundOptions?.unitPrice || refundTarget.unitPrice || 0) * (refundOptions?.seats?.length ? selectedOrderSeatIds.length : refundQuantity)).toFixed(2)}
```

- [ ] **Step 5: 验证**

Run: `pnpm typecheck`

Workdir: `frontend`

Expected: `tsc --noEmit` 成功。

- [ ] **Step 6: 提交**

```powershell
git add frontend/src/types/api.ts frontend/src/lib/api.ts frontend/src/app/orders/page.tsx java/java-order/src/main/java/com/omni/order/controller/OrderController.java java/java-order/src/main/java/com/omni/order/service/OrderService.java
git commit -m "feat: choose tickets for refund"
```

---

### Task 8: 最终验证与本机迁移

**Files:**
- No new files.

- [ ] **Step 1: 应用本机迁移**

Run:

```powershell
$env:PGPASSWORD='123456'; $env:PGCLIENTENCODING='UTF8'; psql -v ON_ERROR_STOP=1 -h localhost -p 5432 -U postgres -d omni_ticket_split -f sql/production-split/ticket/20260522_activity_purchase_limit.sql
$env:PGPASSWORD='123456'; $env:PGCLIENTENCODING='UTF8'; psql -v ON_ERROR_STOP=1 -h localhost -p 5432 -U postgres -d omni_payment -f sql/production-split/payment/20260522_partial_refund.sql
```

Expected: `ALTER TABLE` / `UPDATE` 成功，无 error。

- [ ] **Step 2: 后端测试**

Run: `mvn test -pl java-ticket,java-order,java-payment -am`

Workdir: `java`

Expected: `BUILD SUCCESS`。

- [ ] **Step 3: 前端类型检查**

Run: `pnpm typecheck`

Workdir: `frontend`

Expected: `tsc --noEmit` 成功。

- [ ] **Step 4: 微服务边界检查**

Run: `powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1`

Expected: `All microservice boundary checks passed.`

- [ ] **Step 5: SQL 安全检查**

Run: `powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1`

Expected: `PASS production split SQL safety check`

- [ ] **Step 6: 空白和状态检查**

Run: `git diff --check`

Expected: 无空白错误。

Run: `git status --short`

Expected: 只包含本功能相关文件，以及既有未提交文件 `.claude/settings.local.json`、`sql/migrations/shared/20260519_tour_station_foundation.sql`（如果仍存在）。

- [ ] **Step 7: 提交验证相关修正**

如果 Step 1-6 发现并修复了遗漏，提交：

```powershell
git add <fixed-files>
git commit -m "fix: verify partial refunds and purchase limits"
```

---

## 自检结果

- 规格覆盖：包含每城市站限购、普通活动限购、不限购、部分退款、退款后释放座位/库存回补、微服务边界。
- 无占位：所有任务均有具体文件、关键代码片段、命令和期望输出。
- 类型一致：`perUserLimit`、`quantity`、`orderSeatIds`、`refundType` 在后端与前端命名保持一致；数据库字段使用 snake_case。
