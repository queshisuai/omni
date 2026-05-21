# Hidden Seat Map Random Allocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 支持不公布座位图但后端仍基于真实座位随机分配，并修正库存和订单快照只来自真实持久化数据。

**Architecture:** `java-ticket` 拥有座位表、票档库存和随机锁座能力；`java-order` 只通过 ticket internal API 请求随机锁座、指定锁座、确认、释放和退款。前端只根据后端字段展示公开选座或随机分配，不自行把设计容量当库存。

**Tech Stack:** Java Spring Cloud + MyBatis-Plus + PostgreSQL；Next.js 16 + React 19 + TypeScript；Maven；pnpm。

---

## 文件结构

- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/TicketSalesLockRequest.java`
  - 增加 `allocateRandom` 标志。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/TicketSalesSeatLockResponse.java`
  - 返回随机锁定的 `lockedSeatIds` 和 `seatLabels`。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/mapper/SessionSeatMapper.java`
  - 增加按票档随机查询可售座位的 SQL。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TicketSalesInternalService.java`
  - 实现随机锁座，低耦合返回锁定结果。
- Modify: `java/java-order/src/main/java/com/omni/order/dto/TicketSalesLockRequest.java`
  - 增加 `allocateRandom` 标志。
- Modify: `java/java-order/src/main/java/com/omni/order/dto/TicketSalesSeatLockResponse.java`
  - 接收 `seatLabels`。
- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java`
  - 无 `seatIds` 时调用随机锁座而不是简单扣库存，并写 `order_seat` 与真实 seat labels 快照。
- Modify: `frontend/src/app/activity/[id]/page.tsx`
  - 根据座位图公开策略展示选座或随机分配。
- Modify: `frontend/src/app/console/sessions/page.tsx`
  - 不再把设计容量称为库存；未生成库存显示“待生成库存”。
- Modify: `frontend/src/app/orders/page.tsx`
  - 确保展示真实票档和座位快照。

---

### Task 1: ticket internal 随机锁定真实座位

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/TicketSalesLockRequest.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/TicketSalesSeatLockResponse.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/mapper/SessionSeatMapper.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TicketSalesInternalService.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/TicketSalesInternalServiceTest.java`

- [ ] **Step 1: 写失败测试**

在 `TicketSalesInternalServiceTest` 增加测试：无 seatIds 且 `allocateRandom=true` 时，从 mapper 查询随机可售座位，逐个锁定，并返回真实 seatIds 和 labels。

- [ ] **Step 2: 运行失败测试**

Run: `mvn test -pl java-ticket -Dtest=TicketSalesInternalServiceTest -am`

Expected: 因 `allocateRandom` 或 mapper 方法不存在失败。

- [ ] **Step 3: 增加 DTO 字段**

`TicketSalesLockRequest` 增加：

```java
private Boolean allocateRandom;
public Boolean getAllocateRandom() { return allocateRandom; }
public void setAllocateRandom(Boolean allocateRandom) { this.allocateRandom = allocateRandom; }
```

`TicketSalesSeatLockResponse` 增加：

```java
private List<String> seatLabels;
public List<String> getSeatLabels() { return seatLabels; }
public void setSeatLabels(List<String> seatLabels) { this.seatLabels = seatLabels; }
```

- [ ] **Step 4: 增加 mapper 查询**

`SessionSeatMapper` 增加：

```java
@Select("SELECT id FROM session_seat WHERE session_id = #{sessionId} AND ticket_type_id = #{ticketTypeId} AND status = 1 AND order_id IS NULL ORDER BY random() LIMIT #{quantity}")
List<Long> selectRandomAvailableSeatIds(@Param("sessionId") Long sessionId, @Param("ticketTypeId") Long ticketTypeId, @Param("quantity") Integer quantity);
```

- [ ] **Step 5: 实现随机锁座**

`TicketSalesInternalService.lockSeats()`：

- `seatIds` 非空时保持指定锁座。
- `seatIds` 为空且 `allocateRandom=true` 时按 `ticketTypeId + quantity` 随机选座。
- 如果选不到足量座位，返回 `票档库存不足`。
- 锁定成功后返回 `lockedSeatIds` 和 `seatLabels`。

- [ ] **Step 6: 验证测试通过**

Run: `mvn test -pl java-ticket -Dtest=TicketSalesInternalServiceTest -am`

Expected: `BUILD SUCCESS`。

---

### Task 2: order 无 seatIds 时随机锁座并写真实快照

**Files:**
- Modify: `java/java-order/src/main/java/com/omni/order/dto/TicketSalesLockRequest.java`
- Modify: `java/java-order/src/main/java/com/omni/order/dto/TicketSalesSeatLockResponse.java`
- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java`
- Test: `java/java-order/src/test/java/com/omni/order/service/OrderSeatServiceTest.java`

- [ ] **Step 1: 写失败测试**

在 `OrderSeatServiceTest` 增加测试：`createOrderWithSeats()` 无 `seatIds` 时调用 ticket internal `lockSeats`，请求包含 `allocateRandom=true`，返回 locked seatIds 后写入 `order_seat`。

- [ ] **Step 2: 运行失败测试**

Run: `mvn test -pl java-order -Dtest=OrderSeatServiceTest -am`

Expected: 因字段或行为缺失失败。

- [ ] **Step 3: 同步 DTO 字段**

order 侧 `TicketSalesLockRequest` 增加 `allocateRandom`。

order 侧 `TicketSalesSeatLockResponse` 增加 `seatLabels`。

- [ ] **Step 4: 修改 `OrderService.createOrderWithSeats()`**

要求：

- 有 `seatIds`：保持指定锁座。
- 无 `seatIds`：调用 `lockSeats`，设置 `allocateRandom=true` 和 `quantity`。
- 使用返回的 `lockedSeatIds` 写 `order_seat`。
- 写 snapshot 时使用真实 `seatLabels`，不能再空着或写模拟值。
- 不再调用简单 `lockStockForTicketType()` 作为隐藏座位图购买路径。

- [ ] **Step 5: 验证测试通过**

Run: `mvn test -pl java-order -Dtest=OrderSeatServiceTest -am`

Expected: `BUILD SUCCESS`。

---

### Task 3: 前端隐藏座位图购买与库存展示修正

**Files:**
- Modify: `frontend/src/app/activity/[id]/page.tsx`
- Modify: `frontend/src/app/console/sessions/page.tsx`
- Modify: `frontend/src/app/orders/page.tsx`

- [ ] **Step 1: 活动详情隐藏座位图购买**

当后端标记不公布座位图时：

- 不渲染 `SeatCraftSelector`。
- 显示 `座位将在下单后由系统自动分配`。
- 下单传 `quantity`，不传 `seatIds`。
- 购买按钮只校验 `quantity`。

- [ ] **Step 2: 库存展示只用真实字段**

票档卡片只展示 `ticketType.remainStock`。如果后端未生成库存或 `remainStock == null`，显示 `待生成库存`，不是模拟余票。

- [ ] **Step 3: 订单页展示真实快照**

订单页继续展示 `ticketName` 和 `seatLabels`。没有 `seatLabels` 时显示 `座位信息生成中`，不写模拟座位。

- [ ] **Step 4: 类型检查**

Run: `pnpm typecheck`

Expected: `tsc --noEmit` 无错误。

---

### Task 4: 退款模拟订单并重新生成真实订单数据

**Files:**
- No source changes unless tests reveal missing API.

- [ ] **Step 1: 查询当前已支付模拟订单**

使用 `omni_order` 查询 status=2 且快照缺失或座位为空的订单。

- [ ] **Step 2: 走退款流程**

对这些订单调用现有退款 API 或内部退款闭环，使订单状态变为 `4 已退款`。

- [ ] **Step 3: 验证订单页**

订单页应展示 `已退款`，并保留已有历史快照。

---

### Task 5: 全量验证

**Files:**
- No code changes.

- [ ] **Step 1: 前端类型检查**

Run: `pnpm typecheck` in `frontend`

Expected: `tsc --noEmit` 无错误。

- [ ] **Step 2: ticket 测试**

Run: `mvn test -pl java-ticket -am` in `java`

Expected: `BUILD SUCCESS`。

- [ ] **Step 3: order 测试**

Run: `mvn test -pl java-order -am` in `java`

Expected: `BUILD SUCCESS`。

- [ ] **Step 4: 微服务边界检查**

Run: `powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1`

Expected: `All microservice boundary checks passed.`

- [ ] **Step 5: 差异检查**

Run: `git diff --check`

Expected: 只有 LF/CRLF warning，没有 whitespace error。

---

## 自检

- 低耦合：order 不直接查 ticket 表。
- 后端始终有真实座位表。
- 不公布座位图只是前端展示策略。
- 随机分配也锁定真实座位并写真实订单快照。
- 前端不使用模拟库存。
- 已购模拟订单通过退款闭环处理，不硬删。
