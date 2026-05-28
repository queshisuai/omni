# 抢票核心引擎高风险加固 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 加固抢票核心引擎，使 Redis 库存缺失不放行、重复点击返回同一抢票结果、grab-service 通过可信 order internal API 创建订单。

**Architecture:** 继续保持 grab-service 只做高并发准入和请求状态，订单交易仍由 java-order 负责。Redis Lua 改为 fail-closed；grab-service 在创建请求前复用同一用户的活跃抢票意图；java-order 暴露带 `X-Internal-Token` 的 internal 创建订单接口供 grab-service 调用。

**Tech Stack:** NestJS 10 + Jest + PostgreSQL + Redis Lua；Spring Boot + JUnit/MockMvc；Next.js 16 + React 19。

---

## 文件结构与职责

- `nestjs/grab-service/src/grab/grab-admission.service.ts`：Redis Lua 准入脚本，负责库存、幂等、用户 hold、座位 hold 的原子判断。
- `nestjs/grab-service/src/grab/grab-admission.service.spec.ts`：验证 Lua 入参、库存缺失 fail-closed、释放预占。
- `nestjs/grab-service/src/grab/grab.repository.ts`：grab_request 持久化查询，新增按抢票意图查询活跃请求。
- `nestjs/grab-service/src/grab/grab.repository.spec.ts`：验证新增 SQL 查询和 seatIds 归一化。
- `nestjs/grab-service/src/grab/grab.service.ts`：抢票请求编排，新增活跃请求复用、唯一键冲突恢复、库存未初始化失败。
- `nestjs/grab-service/src/grab/grab.service.spec.ts`：验证幂等、重复点击、库存缺失、订单失败释放。
- `nestjs/grab-service/src/grab/order-client.service.ts`：调用 java-order internal API 并携带 `X-Internal-Token`。
- `nestjs/grab-service/src/grab/order-client.service.spec.ts`：验证 internal 路径、token、未配置 token 失败。
- `java/java-order/src/main/java/com/omni/order/controller/OrderController.java`：新增 internal create/create-with-seats endpoint。
- `java/java-order/src/test/java/com/omni/order/controller/OrderControllerTest.java`：验证 internal token 拒绝与成功委托。
- `frontend/src/app/activity/[id]/page.tsx`：同一确认订单流程复用 idempotencyKey，修改购票参数时重置。

---

### Task 1: Redis 库存缺失 fail-closed

**Files:**
- Modify: `nestjs/grab-service/src/grab/grab-admission.service.ts`
- Modify: `nestjs/grab-service/src/grab/grab-admission.service.spec.ts`

- [ ] **Step 1: 写失败测试：库存缺失返回 STOCK_UNINITIALIZED**

在 `nestjs/grab-service/src/grab/grab-admission.service.spec.ts` 中把当前 “passes through requests when redis stock is not initialized” 测试改成：

```ts
it('rejects requests when redis stock is not initialized', async () => {
  const evalMock = jest.fn().mockResolvedValue(['STOCK_UNINITIALIZED', '']);
  const service = new GrabAdmissionService({ eval: evalMock } as any);

  const result = await service.admit({
    requestId: 'GRAB1',
    userId: 2004,
    sessionId: 101,
    ticketTypeId: 202,
    quantity: 1,
    seatIds: [],
    idempotencyKey: 'idem-1',
    ttlSeconds: 900,
  });

  expect(result).toEqual({ outcome: 'STOCK_UNINITIALIZED', existingRequestId: null });
});
```

同时把类型期望写入测试，确保 `AdmissionOutcome` 接受 `STOCK_UNINITIALIZED`。

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
cd nestjs/grab-service && npm test -- grab-admission.service.spec.ts
```

Expected: TypeScript 或 Jest 失败，提示 `STOCK_UNINITIALIZED` 不属于 `AdmissionOutcome`。

- [ ] **Step 3: 修改 AdmissionOutcome 类型和 Lua 脚本**

在 `nestjs/grab-service/src/grab/grab-admission.service.ts` 中将类型改为：

```ts
export type AdmissionOutcome = 'ACCEPTED' | 'IDEMPOTENT' | 'SOLD_OUT' | 'LIMITED' | 'STOCK_UNINITIALIZED';
```

将 Lua 中库存缺失分支替换为：

```lua
    if not stock then
      return {'STOCK_UNINITIALIZED', ''}
    end
```

删除原先库存缺失时写 `idempotencyKey`、`userHoldKey`、`seatKey` 并返回 `BYPASSED` 的逻辑。

- [ ] **Step 4: 删除 BYPASSED 释放语义测试**

在 `grab-admission.service.spec.ts` 中删除或改写 “can release holds without restoring stock when admission bypassed stock”。保留 release 测试，但改成验证默认恢复库存：

```ts
it('restores stock and clears holds when releasing accepted admission', async () => {
  const incrBy = jest.fn().mockResolvedValue(101);
  const del = jest.fn().mockResolvedValue(3);
  const service = new GrabAdmissionService({ incrBy, del } as any);

  await service.release({
    userId: 2004,
    sessionId: 101,
    ticketTypeId: 202,
    quantity: 1,
    seatIds: [301],
    idempotencyKey: 'idem-1',
  });

  expect(incrBy).toHaveBeenCalledWith('grab:stock:101:202', 1);
  expect(del).toHaveBeenCalledWith([
    'grab:idempotency:2004:idem-1',
    'grab:user-hold:2004:101:202',
    'grab:seat-hold:301',
  ]);
});
```

- [ ] **Step 5: 运行测试确认通过**

Run:

```bash
cd nestjs/grab-service && npm test -- grab-admission.service.spec.ts
```

Expected: PASS。

---

### Task 2: grab-service 处理 STOCK_UNINITIALIZED 且不创建订单

**Files:**
- Modify: `nestjs/grab-service/src/grab/grab.service.ts`
- Modify: `nestjs/grab-service/src/grab/grab.service.spec.ts`

- [ ] **Step 1: 写失败测试**

在 `grab.service.spec.ts` 添加：

```ts
it('marks request failed and does not create order when redis stock is uninitialized', async () => {
  const repository: any = {
    findByUserAndIdempotency: jest.fn().mockResolvedValue(null),
    findActiveByIntent: jest.fn().mockResolvedValue(null),
    createPending: jest.fn().mockResolvedValue({
      requestId: 'GRAB202605270003',
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 1,
      seatIds: [],
      allocateRandom: false,
      idempotencyKey: 'idem-3',
      status: GRAB_STATUS.PENDING,
      orderId: null,
      failReason: null,
    }),
    updateStatus: jest.fn().mockImplementation((requestId, status, failReason = null) => Promise.resolve({
      requestId,
      status,
      orderId: null,
      failReason,
    })),
  };
  const admission: any = {
    admit: jest.fn().mockResolvedValue({ outcome: 'STOCK_UNINITIALIZED', existingRequestId: null }),
    release: jest.fn(),
  };
  const orderClient: any = { createOrder: jest.fn() };
  const service = new GrabService(repository, admission, orderClient);

  const result = await service.submitRequest(2004, {
    sessionId: 101,
    ticketTypeId: 202,
    quantity: 1,
    idempotencyKey: 'idem-3',
  });

  expect(orderClient.createOrder).not.toHaveBeenCalled();
  expect(admission.release).not.toHaveBeenCalled();
  expect(repository.updateStatus).toHaveBeenCalledWith('GRAB202605270003', GRAB_STATUS.FAILED, '抢票库存未初始化');
  expect(result).toEqual({ requestId: 'GRAB202605270003', status: GRAB_STATUS.FAILED, orderId: null, failReason: '抢票库存未初始化' });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
cd nestjs/grab-service && npm test -- grab.service.spec.ts
```

Expected: FAIL，因为 service 未处理 `STOCK_UNINITIALIZED`。

- [ ] **Step 3: 实现 STOCK_UNINITIALIZED 分支**

在 `GrabService.submitRequest()` 中 `LIMITED` 分支后、进入 `ACCEPTED` 更新前添加：

```ts
    if (admission.outcome === 'STOCK_UNINITIALIZED') {
      return this.toResponse(await this.repository.updateStatus(created.requestId, GRAB_STATUS.FAILED, '抢票库存未初始化'));
    }
```

删除 `shouldRestoreStock = admission.outcome === 'ACCEPTED'` 的 BYPASSED 兼容意义，保留变量但它现在恒为 true。更直接写为：

```ts
    const shouldRestoreStock = true;
```

或者在 catch 中传 `restoreStock: true`。

- [ ] **Step 4: 运行测试确认通过**

Run:

```bash
cd nestjs/grab-service && npm test -- grab.service.spec.ts
```

Expected: PASS。

---

### Task 3: 后端复用同一抢票意图

**Files:**
- Modify: `nestjs/grab-service/src/grab/grab.types.ts`
- Modify: `nestjs/grab-service/src/grab/grab.repository.ts`
- Modify: `nestjs/grab-service/src/grab/grab.repository.spec.ts`
- Modify: `nestjs/grab-service/src/grab/grab.service.ts`
- Modify: `nestjs/grab-service/src/grab/grab.service.spec.ts`

- [ ] **Step 1: 在类型文件新增查询输入类型**

在 `grab.types.ts` 添加：

```ts
export interface FindActiveGrabIntentInput {
  userId: number;
  sessionId: number;
  ticketTypeId: number;
  quantity: number;
  seatIds: number[];
  allocateRandom: boolean;
}
```

- [ ] **Step 2: 写 repository 失败测试**

在 `grab.repository.spec.ts` 添加：

```ts
it('finds active request by normalized grab intent', async () => {
  const query = jest.fn().mockResolvedValue({
    rows: [{
      id: 1,
      request_id: 'GRAB1',
      idempotency_key: 'idem-1',
      user_id: 2004,
      session_id: 101,
      ticket_type_id: 202,
      quantity: 2,
      seat_ids: '[301,302]',
      allocate_random: false,
      status: GRAB_STATUS.ORDER_CREATED,
      order_id: 9001,
      fail_reason: null,
      expire_time: new Date('2026-05-27T12:15:00.000Z'),
      created_at: new Date('2026-05-27T12:00:00.000Z'),
      updated_at: new Date('2026-05-27T12:01:00.000Z'),
    }],
  });
  const repository = new GrabRepository({ query } as any);

  const result = await repository.findActiveByIntent({
    userId: 2004,
    sessionId: 101,
    ticketTypeId: 202,
    quantity: 2,
    seatIds: [302, 301],
    allocateRandom: false,
  });

  expect(query).toHaveBeenCalledWith(expect.stringContaining('status in'), [
    2004,
    101,
    202,
    2,
    JSON.stringify([301, 302]),
    false,
    [GRAB_STATUS.PENDING, GRAB_STATUS.ACCEPTED, GRAB_STATUS.ORDER_CREATING, GRAB_STATUS.ORDER_CREATED],
  ]);
  expect(result?.requestId).toBe('GRAB1');
  expect(result?.orderId).toBe(9001);
});
```

- [ ] **Step 3: 实现 repository 方法**

在 `grab.repository.ts` import 新类型：

```ts
import type { CreatePendingGrabRequestInput, FindActiveGrabIntentInput, GrabRequestRecord } from './grab.types';
```

添加方法：

```ts
  async findActiveByIntent(input: FindActiveGrabIntentInput): Promise<GrabRequestRecord | null> {
    const normalizedSeatIds = [...input.seatIds].sort((a, b) => a - b);
    const activeStatuses = [GRAB_STATUS.PENDING, GRAB_STATUS.ACCEPTED, GRAB_STATUS.ORDER_CREATING, GRAB_STATUS.ORDER_CREATED];
    const result = await this.database.query<GrabRequestRow>(
      `select * from grab_request
       where user_id = $1
         and session_id = $2
         and ticket_type_id = $3
         and quantity = $4
         and seat_ids = $5::jsonb
         and allocate_random = $6
         and status in ($7)
       order by created_at asc
       limit 1`,
      [
        input.userId,
        input.sessionId,
        input.ticketTypeId,
        input.quantity,
        JSON.stringify(normalizedSeatIds),
        input.allocateRandom,
        activeStatuses,
      ],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }
```

PostgreSQL 的 `status in ($7)` 对数组参数不工作时，改用：

```sql
and status = any($7::varchar[])
```

并同步更新测试 `expect.stringContaining('status = any')`。

- [ ] **Step 4: 归一化 createPending seatIds**

在 `createPending` 写入前归一化：

```ts
const normalizedSeatIds = [...input.seatIds].sort((a, b) => a - b);
```

并把 `JSON.stringify(input.seatIds)` 改为：

```ts
JSON.stringify(normalizedSeatIds)
```

- [ ] **Step 5: 写 service 失败测试：同一意图返回已有请求**

在 `grab.service.spec.ts` 添加：

```ts
it('returns existing active request for the same grab intent', async () => {
  const existing = {
    requestId: 'GRAB-EXISTING',
    status: GRAB_STATUS.ORDER_CREATED,
    orderId: 9001,
    failReason: null,
  };
  const repository: any = {
    findByUserAndIdempotency: jest.fn().mockResolvedValue(null),
    findActiveByIntent: jest.fn().mockResolvedValue(existing),
    createPending: jest.fn(),
  };
  const admission: any = { admit: jest.fn() };
  const orderClient: any = { createOrder: jest.fn() };
  const service = new GrabService(repository, admission, orderClient);

  const result = await service.submitRequest(2004, {
    sessionId: 101,
    ticketTypeId: 202,
    quantity: 2,
    seatIds: [302, 301],
    allocateRandom: false,
    idempotencyKey: 'new-key',
  });

  expect(repository.findActiveByIntent).toHaveBeenCalledWith({
    userId: 2004,
    sessionId: 101,
    ticketTypeId: 202,
    quantity: 2,
    seatIds: [301, 302],
    allocateRandom: false,
  });
  expect(repository.createPending).not.toHaveBeenCalled();
  expect(orderClient.createOrder).not.toHaveBeenCalled();
  expect(result).toEqual(existing);
});
```

- [ ] **Step 6: 实现 service 活跃意图复用**

在 `GrabService.submitRequest()` 中生成 `seatIds` 后、`createPending` 前添加：

```ts
    const seatIds = [...(dto.seatIds ?? [])].sort((a, b) => a - b);
    const allocateRandom = Boolean(dto.allocateRandom);
    const active = await this.repository.findActiveByIntent({
      userId,
      sessionId: dto.sessionId,
      ticketTypeId: dto.ticketTypeId,
      quantity: dto.quantity,
      seatIds,
      allocateRandom,
    });
    if (active) return this.toResponse(active);
```

并删除后面重复的：

```ts
const seatIds = dto.seatIds ?? [];
```

把 `allocateRandom: Boolean(dto.allocateRandom)` 改成 `allocateRandom`。

- [ ] **Step 7: 运行 grab-service 测试**

Run:

```bash
cd nestjs/grab-service && npm test -- grab.repository.spec.ts grab.service.spec.ts
```

Expected: PASS。

---

### Task 4: 数据库唯一键冲突恢复为已有请求

**Files:**
- Modify: `nestjs/grab-service/src/grab/grab.repository.ts`
- Modify: `nestjs/grab-service/src/grab/grab.service.ts`
- Modify: `nestjs/grab-service/src/grab/grab.service.spec.ts`

- [ ] **Step 1: 暴露唯一键错误判断**

在 `grab.repository.ts` 添加：

```ts
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
}
```

- [ ] **Step 2: 写 service 失败测试**

在 `grab.service.spec.ts` 添加：

```ts
it('returns existing request when concurrent insert hits user idempotency unique constraint', async () => {
  const existing = { requestId: 'GRAB-EXISTING', status: GRAB_STATUS.ORDER_CREATED, orderId: 9001, failReason: null };
  const uniqueError: any = new Error('duplicate key');
  uniqueError.code = '23505';
  const repository: any = {
    findByUserAndIdempotency: jest.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing),
    findActiveByIntent: jest.fn().mockResolvedValue(null),
    createPending: jest.fn().mockRejectedValue(uniqueError),
  };
  const admission: any = { admit: jest.fn() };
  const orderClient: any = { createOrder: jest.fn() };
  const service = new GrabService(repository, admission, orderClient);

  const result = await service.submitRequest(2004, {
    sessionId: 101,
    ticketTypeId: 202,
    quantity: 1,
    idempotencyKey: 'idem-1',
  });

  expect(admission.admit).not.toHaveBeenCalled();
  expect(result).toEqual(existing);
});
```

- [ ] **Step 3: 实现 catch 恢复**

在 `grab.service.ts` import：

```ts
import { GrabRepository, isUniqueViolation } from './grab.repository';
```

把 `createPending` 包成：

```ts
    let created: GrabRequestRecord;
    try {
      created = await this.repository.createPending({
        requestId,
        idempotencyKey: dto.idempotencyKey,
        userId,
        sessionId: dto.sessionId,
        ticketTypeId: dto.ticketTypeId,
        quantity: dto.quantity,
        seatIds,
        allocateRandom,
        expireTime: new Date(Date.now() + this.requestTtlSeconds * 1000),
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const record = await this.repository.findByUserAndIdempotency(userId, dto.idempotencyKey);
        if (record) return this.toResponse(record);
      }
      throw error;
    }
```

- [ ] **Step 4: 运行测试**

Run:

```bash
cd nestjs/grab-service && npm test -- grab.service.spec.ts
```

Expected: PASS。

---

### Task 5: java-order 增加 internal 创建订单接口

**Files:**
- Modify: `java/java-order/src/main/java/com/omni/order/controller/OrderController.java`
- Create or Modify: `java/java-order/src/test/java/com/omni/order/controller/OrderControllerTest.java`

- [ ] **Step 1: 写 controller 测试**

如果 `OrderControllerTest.java` 不存在，创建文件：

```java
package com.omni.order.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.omni.order.dto.CreateOrderRequest;
import com.omni.order.dto.LockSeatsRequest;
import com.omni.order.entity.Order;
import com.omni.order.service.OrderService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(OrderController.class)
@TestPropertySource(properties = "internal.api.token=omni-local-internal-token")
class OrderControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private OrderService orderService;

    @Test
    void internalCreateRejectsMissingToken() throws Exception {
        CreateOrderRequest request = new CreateOrderRequest();
        request.setUserId(2004L);
        request.setSessionId(7L);
        request.setTicketTypeId(21L);
        request.setQuantity(1);

        mockMvc.perform(post("/api/order/internal/create")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(403));

        verify(orderService, never()).createOrder(any());
    }

    @Test
    void internalCreateUsesExistingOrderServiceWhenTokenValid() throws Exception {
        CreateOrderRequest request = new CreateOrderRequest();
        request.setUserId(2004L);
        request.setSessionId(7L);
        request.setTicketTypeId(21L);
        request.setQuantity(1);

        Order order = new Order();
        order.setId(14L);
        order.setOrderNo("DM20260527124232BE5091");
        order.setAmount(new BigDecimal("160.00"));
        when(orderService.createOrder(any(CreateOrderRequest.class))).thenReturn(order);

        mockMvc.perform(post("/api/order/internal/create")
                        .header("X-Internal-Token", "omni-local-internal-token")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(14));

        verify(orderService).createOrder(any(CreateOrderRequest.class));
    }

    @Test
    void internalCreateWithSeatsUsesExistingOrderServiceWhenTokenValid() throws Exception {
        LockSeatsRequest request = new LockSeatsRequest();
        request.setUserId(2004L);
        request.setSessionId(7L);
        request.setTicketTypeId(21L);
        request.setQuantity(1);
        request.setSeatIds(List.of(301L));

        Order order = new Order();
        order.setId(15L);
        order.setOrderNo("DM20260527124233BE5092");
        order.setAmount(new BigDecimal("160.00"));
        when(orderService.createOrderWithSeats(any(LockSeatsRequest.class))).thenReturn(order);

        mockMvc.perform(post("/api/order/internal/create-with-seats")
                        .header("X-Internal-Token", "omni-local-internal-token")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(15));

        verify(orderService).createOrderWithSeats(any(LockSeatsRequest.class));
    }
}
```

如果已有测试文件，把这三个测试加入现有类。

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
cd java && mvn -pl java-order -Dtest=OrderControllerTest test
```

Expected: FAIL，`/api/order/internal/create` 不存在或返回 404。

- [ ] **Step 3: 增加 internal endpoint**

在 `OrderController.java` 的公开 `createOrderWithSeats` 后添加：

```java
    @PostMapping("/internal/create")
    public Result<Order> createInternalOrder(@RequestBody CreateOrderRequest request,
                                             @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        return Result.success(orderService.createOrder(request));
    }

    @PostMapping("/internal/create-with-seats")
    public Result<Order> createInternalOrderWithSeats(@RequestBody LockSeatsRequest request,
                                                      @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        return Result.success(orderService.createOrderWithSeats(request));
    }
```

- [ ] **Step 4: 运行 java-order controller 测试**

Run:

```bash
cd java && mvn -pl java-order -Dtest=OrderControllerTest test
```

Expected: PASS。

---

### Task 6: grab-service OrderClientService 改用 internal API

**Files:**
- Modify: `nestjs/grab-service/src/grab/order-client.service.ts`
- Create: `nestjs/grab-service/src/grab/order-client.service.spec.ts`
- Modify: `nestjs/grab-service/src/grab/grab.service.spec.ts`

- [ ] **Step 1: 写 order client 测试**

创建 `order-client.service.spec.ts`：

```ts
import { OrderClientService } from './order-client.service';

describe('OrderClientService', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, ORDER_SERVICE_URL: 'http://order.local', INTERNAL_API_TOKEN: 'internal-token' };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ code: 200, data: { id: 14, orderNo: 'DM1', amount: 160 } }),
    } as any);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });

  it('creates normal orders through internal endpoint with token', async () => {
    const service = new OrderClientService();

    await service.createOrder({ userId: 2004, sessionId: 7, ticketTypeId: 21, quantity: 1, seatIds: [], allocateRandom: false });

    expect(global.fetch).toHaveBeenCalledWith('http://order.local/api/order/internal/create', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': 'internal-token' },
    }));
  });

  it('creates seat orders through internal endpoint with token', async () => {
    const service = new OrderClientService();

    await service.createOrder({ userId: 2004, sessionId: 7, ticketTypeId: 21, quantity: 1, seatIds: [301], allocateRandom: false });

    expect(global.fetch).toHaveBeenCalledWith('http://order.local/api/order/internal/create-with-seats', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': 'internal-token' },
    }));
  });

  it('fails before calling order service when internal token is missing', async () => {
    delete process.env.INTERNAL_API_TOKEN;
    const service = new OrderClientService();

    await expect(service.createOrder({ userId: 2004, sessionId: 7, ticketTypeId: 21, quantity: 1, seatIds: [], allocateRandom: false }))
      .rejects.toThrow('订单内部接口令牌未配置');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
cd nestjs/grab-service && npm test -- order-client.service.spec.ts
```

Expected: FAIL，因为当前仍调公开路径且不带 token。

- [ ] **Step 3: 修改 OrderClientService**

在 `order-client.service.ts` 中添加 token 字段：

```ts
  private readonly internalToken = process.env.INTERNAL_API_TOKEN;
```

将 path 改成：

```ts
    const path = usesSeatEndpoint ? '/api/order/internal/create-with-seats' : '/api/order/internal/create';
```

fetch 前添加：

```ts
    if (!this.internalToken) {
      throw new Error('订单内部接口令牌未配置');
    }
```

headers 改为：

```ts
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': this.internalToken },
```

- [ ] **Step 4: 运行测试**

Run:

```bash
cd nestjs/grab-service && npm test -- order-client.service.spec.ts grab.service.spec.ts
```

Expected: PASS。

---

### Task 7: 前端复用同一确认流程 idempotencyKey

**Files:**
- Modify: `frontend/src/app/activity/[id]/page.tsx`

- [ ] **Step 1: 定位现有状态区**

在 `page.tsx` 中找到 `useState` 区域，新增：

```tsx
  const [grabIdempotencyKey, setGrabIdempotencyKey] = useState('')
```

- [ ] **Step 2: 增加生成函数**

在 `handleConfirmOrder` 前添加：

```tsx
  const getOrCreateGrabIdempotencyKey = (userId: number) => {
    if (grabIdempotencyKey) return grabIdempotencyKey
    const key = `${userId}-${selectedSession?.session.id ?? 0}-${selectedTicket?.id ?? 0}-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setGrabIdempotencyKey(key)
    return key
  }
```

- [ ] **Step 3: 替换每次点击生成 key**

把 `handleConfirmOrder` 中：

```tsx
      const idempotencyKey = `${user.userId}-${selectedSession.session.id}-${selectedTicket.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`
```

替换为：

```tsx
      const idempotencyKey = getOrCreateGrabIdempotencyKey(user.userId)
```

- [ ] **Step 4: 成功或取消时重置 key**

下单成功后 `setShowConfirm(false)` 后添加：

```tsx
      setGrabIdempotencyKey('')
```

确认弹窗取消按钮的 handler 中添加：

```tsx
setGrabIdempotencyKey('')
```

如果取消按钮当前是 inline `setShowConfirm(false)`，改为同时执行：

```tsx
onClick={() => {
  setShowConfirm(false)
  setGrabIdempotencyKey('')
}}
```

- [ ] **Step 5: 购票参数变化时重置 key**

在场次、票档、数量、座位变化的事件处理里添加 `setGrabIdempotencyKey('')`。至少覆盖：

- 切换场次
- 切换票档
- 数量加减
- 座位选择/自动选择改变

- [ ] **Step 6: 运行前端 typecheck**

Run:

```bash
cd frontend && pnpm typecheck
```

Expected: PASS。

---

### Task 8: 集成验证与现有测试保护

**Files:**
- No production file changes unless previous tasks revealed compile errors.

- [ ] **Step 1: 运行 grab-service 全量测试**

Run:

```bash
cd nestjs/grab-service && npm test
```

Expected: PASS。

- [ ] **Step 2: 运行 order 相关测试**

Run:

```bash
cd java && mvn -pl java-order test
```

Expected: PASS。

- [ ] **Step 3: 运行 ticket 相关测试**

Run:

```bash
cd java && mvn -pl java-ticket test
```

Expected: PASS。

- [ ] **Step 4: 运行微服务边界验收**

Run:

```bash
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
```

Expected: PASS；不得新增跨服务 Mapper、Entity、XML mapper 或 SQL join。

- [ ] **Step 5: 运行真实浏览器链路**

使用当前项目启动方式启动服务：

```powershell
powershell -ExecutionPolicy Bypass -File start-project.ps1
```

在浏览器执行：

1. 登录普通用户 `13900000001`。
2. 打开活动详情页。
3. 点击立即购买。
4. 确认支付。
5. 确认网络请求包含 `POST /api/grab/requests`。
6. 确认订单创建后弹出支付宝扫码支付弹窗。
7. 用户支付后点击“我已完成付款”。
8. 订单列表显示已支付并出现申请退款入口。

Expected: 全链路通过。

- [ ] **Step 6: 验证 Redis stock 缺失失败**

清除对应 Redis stock key 后，提交抢票请求。

Expected:

- grab 请求返回失败。
- 不创建 order。
- 前端显示“抢票库存未初始化”或等价明确错误。

- [ ] **Step 7: 压测验证**

准备 100 库存、1000 并发请求。

Expected:

- `ORDER_CREATED <= 100`
- Redis stock 不小于 0
- order-service 对应票档有效订单数不超过 100
- 无同一用户重复有效订单

---

## Self-Review

- Spec coverage: 覆盖库存 fail-closed、重复点击幂等、order internal API、订单失败释放、支付/退款链路验证、现有测试保护。
- Placeholder scan: 无 TBD/TODO/模糊占位。
- Type consistency: `STOCK_UNINITIALIZED` 只作为 admission outcome，数据库状态复用 `FAILED`；`findActiveByIntent` 类型在 `grab.types.ts` 定义并由 repository/service 共用。
- Scope check: 未引入 MQ、异步排队或跨库访问，符合第一版高风险加固范围。
