# 退款审核流程 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增用户申请退款、管理员或对应主办方审核、支付宝沙盒退款、订单改为已退款的闭环。

**Architecture:** `java-payment` 负责退款申请、审核、支付宝退款调用和退款记录；`java-order` 只提供内部订单退款状态变更；前端 C 端订单页申请退款，B 端新增 `/console/refunds` 审核页。退款审核状态存入 `refund_request`，订单主状态只在退款成功后改为 `4`。

**Tech Stack:** Spring Boot 2.7.18、OpenFeign、MyBatis-Plus、PostgreSQL、Alipay Java SDK、Next.js 16、React 19、TypeScript。

---

## Confirmed Scope

- 使用“退款申请表 + 订单状态最小变更”。
- 新增后台页 `/console/refunds`。
- 审核权限：`admin` 可审核全部；对应活动 `organizer` 只可审核自己活动订单的退款。
- 被拒绝后允许用户再次申请。
- 本期只做全额退款。

## Task 1: 数据库和实体

**Files:**
- Modify: `sql/init.sql`
- Create: `java/java-payment/src/main/java/com/omni/payment/entity/RefundRequest.java`
- Create: `java/java-payment/src/main/java/com/omni/payment/mapper/RefundRequestMapper.java`

- [ ] **Step 1: 修改 SQL**

在 `payment` 表后新增：

```sql
CREATE TABLE refund_request (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES "order"(id),
    user_id BIGINT NOT NULL REFERENCES "user"(id),
    payment_id BIGINT REFERENCES payment(id),
    refund_no VARCHAR(64) NOT NULL UNIQUE,
    amount DECIMAL(10, 2) NOT NULL,
    reason TEXT,
    status SMALLINT DEFAULT 0,
    reviewer_id BIGINT REFERENCES "user"(id),
    review_note TEXT,
    alipay_refund_no VARCHAR(64),
    raw_response TEXT,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    review_time TIMESTAMP,
    refund_time TIMESTAMP
);
-- refund_request.status: 0=待审核, 1=已退款, 2=已拒绝, 3=退款失败
```

在索引区域新增：

```sql
CREATE INDEX idx_refund_order ON refund_request(order_id);
CREATE INDEX idx_refund_user ON refund_request(user_id);
CREATE INDEX idx_refund_status ON refund_request(status);
CREATE INDEX idx_refund_no ON refund_request(refund_no);
```

- [ ] **Step 2: 创建实体**

Create `RefundRequest.java` with fields: `id, orderId, userId, paymentId, refundNo, amount, reason, status, reviewerId, reviewNote, alipayRefundNo, rawResponse, createTime, reviewTime, refundTime` and JavaBean getters/setters.

- [ ] **Step 3: 创建 Mapper**

Create `RefundRequestMapper extends BaseMapper<RefundRequest>` with `@Mapper`.

- [ ] **Step 4: 编译**

Run: `mvn clean package -pl java-payment -am -DskipTests` in `java`.

Expected: `BUILD SUCCESS`.

## Task 2: 订单退款内部接口

**Files:**
- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java`
- Modify: `java/java-order/src/main/java/com/omni/order/controller/OrderController.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/client/OrderClient.java`

- [ ] **Step 1: 新增订单服务方法**

Add to `OrderService`:

```java
public Order markRefunded(Long id) {
    Order order = orderMapper.selectById(id);
    if (order == null) throw new BusinessException(ResultCode.NOT_FOUND, "订单不存在");
    if (order.getStatus() == STATUS_REFUNDED) return order;
    if (order.getStatus() != STATUS_PAID) throw new BusinessException(ResultCode.BAD_REQUEST, "订单状态不允许退款");
    order.setStatus(STATUS_REFUNDED);
    order.setUpdateTime(LocalDateTime.now());
    orderMapper.updateById(order);
    return order;
}
```

- [ ] **Step 2: 新增内部 Controller 接口**

Add to `OrderController`:

```java
@PostMapping("/internal/{id}/refunded")
public Result<Order> markInternalRefunded(@PathVariable Long id,
        @RequestHeader(value = "X-Internal-Token", required = false) String token) {
    if (!isValidInternalToken(token)) return Result.fail(403, "无权限");
    return Result.success(orderService.markRefunded(id));
}
```

- [ ] **Step 3: 扩展 Feign**

Add to `OrderClient`:

```java
@PostMapping("/api/order/internal/{id}/refunded")
Result<OrderInfoResponse> markRefunded(@PathVariable("id") Long id,
        @RequestHeader("X-Internal-Token") String internalToken);
```

- [ ] **Step 4: 编译**

Run `mvn clean package -pl java-order -am -DskipTests` and `mvn clean package -pl java-payment -am -DskipTests`.

## Task 3: 退款 DTO 和只读归属实体

**Files:**
- Create payment DTOs: `ApplyRefundRequest.java`, `ReviewRefundRequest.java`, `RefundRequestVO.java`
- Create refs/mappers: `UserRef.java`, `SessionRef.java`, `ActivityRef.java`, `UserRefMapper.java`, `SessionRefMapper.java`, `ActivityRefMapper.java`

- [ ] **Step 1: 创建 DTO**

`ApplyRefundRequest`: `orderId, userId, reason`.

`ReviewRefundRequest`: `reviewerId, reviewNote`.

`RefundRequestVO`: `id, orderId, orderNo, userId, paymentId, refundNo, amount, reason, status, reviewerId, reviewNote, alipayRefundNo, createTime, reviewTime, refundTime`.

- [ ] **Step 2: 创建只读实体和 Mapper**

`UserRef` maps `"user"`: `id, role`.

`SessionRef` maps `session`: `id, activityId`.

`ActivityRef` maps `activity`: `id, organizerId, name`.

Create corresponding `BaseMapper` interfaces with `@Mapper`.

- [ ] **Step 3: 编译**

Run: `mvn clean package -pl java-payment -am -DskipTests`.

## Task 4: 退款服务

**Files:**
- Create: `java/java-payment/src/main/java/com/omni/payment/service/RefundService.java`

- [ ] **Step 1: 实现申请退款**

`applyRefund(orderId,userId,reason)` must: load order by `OrderClient`; require order status `2`; require `order.userId == userId`; reject if latest refund for order has status `0` or `1`; find successful `Payment` by `outTradeNo=orderNo`; require `tradeNo`; create `RefundRequest` with full amount and status `0`.

- [ ] **Step 2: 实现用户退款列表**

`listUserRefunds(userId)` returns refund VOs ordered by create time desc.

- [ ] **Step 3: 实现审核列表权限**

`listAdminRefunds(reviewerId,status)` must allow admin all; organizer only own activities. Determine ownership by order.sessionId -> session.activityId -> activity.organizerId.

- [ ] **Step 4: 实现拒绝**

`reject(refundId, reviewerId, reviewNote)` requires pending status and reviewer permission; set status `2`, reviewer, note, reviewTime.

- [ ] **Step 5: 实现同意并支付宝退款**

`approve(refundId, reviewerId, reviewNote)` requires permission and pending; use `AlipayTradeRefundRequest` with `out_trade_no`, `trade_no`, `refund_amount`, `out_request_no`, `refund_reason`; on success set refund status `1`, store response/refundTime/review fields, then `OrderClient.markRefunded`; on failure set status `3`, store response and note, order remains paid.

- [ ] **Step 6: 编译**

Run: `mvn clean package -pl java-payment -am -DskipTests`.

## Task 5: 退款 Controller

**Files:**
- Create: `java/java-payment/src/main/java/com/omni/payment/controller/RefundController.java`

- [ ] **Step 1: 创建接口**

Expose:

```text
POST /api/payment/refunds/apply
GET  /api/payment/refunds/user/{userId}
GET  /api/payment/admin/refunds?userId=&status=
POST /api/payment/admin/refunds/{id}/approve
POST /api/payment/admin/refunds/{id}/reject
```

Use `Result<RefundRequestVO>` or `Result<List<RefundRequestVO>>`.

- [ ] **Step 2: 编译**

Run: `mvn clean package -pl java-payment -am -DskipTests`.

## Task 6: 前端类型和 API

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: 添加类型**

Add `RefundRequestVO`, `ApplyRefundRequest`, `ReviewRefundRequest`.

- [ ] **Step 2: 添加 API**

Add `applyRefund`, `listUserRefunds`, `listAdminRefunds`, `approveRefund`, `rejectRefund`.

- [ ] **Step 3: 类型检查**

Run `npm run typecheck` in `frontend`. Existing `VenueEntity.capacity` may still fail; record result.

## Task 7: C 端订单页申请退款

**Files:**
- Modify: `frontend/src/app/orders/page.tsx`

- [ ] **Step 1: 加载用户退款申请**

After loading orders, call `listUserRefunds(user.userId)`, keep a map by orderId.

- [ ] **Step 2: 添加申请退款 UI**

For paid orders: if pending refund exists show `退款审核中`; if rejected show `退款被拒绝` and allow new application; otherwise show `申请退款`.

- [ ] **Step 3: 提交申请**

Use `prompt('请输入退款原因')` for minimal UI. Call `applyRefund({ orderId, userId, reason })`, refresh refund map.

## Task 8: B 端退款审核页

**Files:**
- Modify: `frontend/src/app/console/layout.tsx`
- Create: `frontend/src/app/console/refunds/page.tsx`

- [ ] **Step 1: 菜单新增退款审核**

Add `/console/refunds` with an appropriate icon.

- [ ] **Step 2: 创建审核页**

Load current user; call `listAdminRefunds(user.userId)`; render table. Pending rows show approve/reject buttons. Reject uses `prompt('请输入拒绝原因')`; approve uses `confirm`.

- [ ] **Step 3: 类型检查**

Run `npm run typecheck` and record result.

## Task 9: 最终验证

**Files:**
- No code changes unless verification reveals issues.

- [ ] **Step 1: 后端构建**

Run:

```powershell
mvn clean package -pl java-order -am -DskipTests
mvn clean package -pl java-payment -am -DskipTests
```

- [ ] **Step 2: 前端检查**

Run `npm run typecheck` in `frontend` and report known or new errors.

- [ ] **Step 3: 手动联调路径**

Paid order -> apply refund -> admin/organizer approve -> Alipay sandbox refund -> order status 4 -> C order page shows refunded.

---

## Self-Review

- Scope coverage: database, order internal state, payment refund service, user application UI, admin/organizer review UI, and verification are covered.
- Placeholder scan: no implementation placeholders are left; tasks specify exact files and behavior.
- Type consistency: refund status uses `0/1/2/3`; order status uses existing `1/2/3/4`; DTO names are consistent across backend and frontend.
