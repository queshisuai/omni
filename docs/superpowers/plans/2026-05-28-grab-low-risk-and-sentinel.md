# 抢票低风险固化与 Sentinel 最小启用 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 固化 grab-service 已满足的低风险行为，并在订单内部创建入口最小启用 Sentinel 限流降级。

**Architecture:** 先只补测试锁定现有行为，不改变 grab-service 状态机或数据库结构。Sentinel 只接入 `java-order` 的内部订单创建入口，使用本地规则初始化和 `@SentinelResource` block handler 返回统一 `Result` 失败响应。

**Tech Stack:** NestJS 10 + Jest；Java 11 + Spring Boot 2.7 + Spring Cloud Alibaba Sentinel + JUnit 5 + Mockito。

---

## File Structure

- Modify: `nestjs/grab-service/src/grab/grab.controller.spec.ts`
  - 负责控制器层身份入口回归测试，证明 body 中的 `userId` 不会覆盖认证态 userId。
- Modify: `nestjs/grab-service/src/grab/grab.service.spec.ts`
  - 负责服务层查询越权、取消状态约束的回归测试。
- Modify: `nestjs/grab-service/src/grab/grab-compensation.service.spec.ts`
  - 负责补偿任务对已有订单请求不释放 Redis hold 的回归测试。
- Create: `java/java-order/src/main/java/com/omni/order/config/OrderSentinelConfig.java`
  - 负责在订单服务启动时加载内部创建订单资源的本地 Sentinel 流控规则。
- Modify: `java/java-order/src/main/java/com/omni/order/controller/OrderController.java`
  - 负责给内部创建订单接口标注 Sentinel 资源，并提供稳定 block handler。
- Modify: `java/java-order/src/test/java/com/omni/order/controller/OrderControllerInternalCreateTest.java`
  - 负责验证 Sentinel block handler 返回业务失败响应，且不会调用 `OrderService`。

---

### Task 1: 固化 grab controller 身份入口

**Files:**
- Modify: `nestjs/grab-service/src/grab/grab.controller.spec.ts`

- [ ] **Step 1: Add failing test for ignoring body userId**

Append this test inside the existing `describe('GrabController', () => { ... })` block in `nestjs/grab-service/src/grab/grab.controller.spec.ts`:

```ts
  it('ignores body userId and always uses authenticated user id', async () => {
    const service: any = {
      submitRequest: jest.fn().mockResolvedValue({ requestId: 'GRAB2', status: GRAB_STATUS.ORDER_CREATED, orderId: 9002, failReason: null }),
    };
    const controller = new GrabController(service);

    const result = await controller.submit({ user: { userId: 2004 } } as any, {
      userId: 9999,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 1,
      idempotencyKey: 'idem-body-user',
    } as any);

    expect(service.submitRequest).toHaveBeenCalledWith(2004, {
      userId: 9999,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 1,
      idempotencyKey: 'idem-body-user',
    });
    expect(service.submitRequest).not.toHaveBeenCalledWith(9999, expect.anything());
    expect(result).toEqual({ code: 200, message: 'success', data: { requestId: 'GRAB2', status: GRAB_STATUS.ORDER_CREATED, orderId: 9002, failReason: null } });
  });
```

- [ ] **Step 2: Run the targeted test**

Run:

```bash
cd nestjs/grab-service && pnpm test -- grab.controller.spec.ts
```

Expected: PASS. This is a characterization test for existing behavior; if it fails, inspect `GrabController.submit` before changing implementation.

- [ ] **Step 3: Commit**

```bash
git add nestjs/grab-service/src/grab/grab.controller.spec.ts
git commit -m "test: lock grab authenticated user identity"
```

---

### Task 2: 固化 grab service 查询和取消边界

**Files:**
- Modify: `nestjs/grab-service/src/grab/grab.service.spec.ts`

- [ ] **Step 1: Import ForbiddenException**

At the top of `nestjs/grab-service/src/grab/grab.service.spec.ts`, add:

```ts
import { ForbiddenException } from '@nestjs/common';
```

The top of the file should become:

```ts
import { ForbiddenException } from '@nestjs/common';
import { GRAB_STATUS } from './grab-status';
```

- [ ] **Step 2: Add failing tests for ownership and cancel terminal behavior**

Append these tests inside the existing `describe('GrabService', () => { ... })` block:

```ts
  it('rejects reading another user grab request', async () => {
    const repository: any = {
      findByRequestId: jest.fn().mockResolvedValue({
        requestId: 'GRAB-OTHER',
        userId: 2005,
        status: GRAB_STATUS.ORDER_CREATED,
        orderId: 9001,
        failReason: null,
      }),
    };
    const admission: any = { release: jest.fn() };
    const orderClient: any = { createOrder: jest.fn() };
    const service = new GrabService(repository, admission, orderClient);

    await expect(service.getRequest(2004, 'GRAB-OTHER')).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.findByRequestId).toHaveBeenCalledWith('GRAB-OTHER');
  });

  it('rejects cancelling another user grab request', async () => {
    const repository: any = {
      findByRequestId: jest.fn().mockResolvedValue({
        requestId: 'GRAB-OTHER',
        userId: 2005,
        sessionId: 101,
        ticketTypeId: 202,
        quantity: 1,
        seatIds: [],
        allocateRandom: false,
        idempotencyKey: 'idem-other',
        status: GRAB_STATUS.ACCEPTED,
        orderId: null,
        failReason: null,
      }),
      updateStatus: jest.fn(),
    };
    const admission: any = { release: jest.fn() };
    const orderClient: any = { createOrder: jest.fn() };
    const service = new GrabService(repository, admission, orderClient);

    await expect(service.cancelRequest(2004, 'GRAB-OTHER')).rejects.toBeInstanceOf(ForbiddenException);
    expect(admission.release).not.toHaveBeenCalled();
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });

  it('returns existing order-created request when cancelling after order creation', async () => {
    const record = {
      requestId: 'GRAB-ORDERED',
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 1,
      seatIds: [],
      allocateRandom: false,
      idempotencyKey: 'idem-ordered',
      status: GRAB_STATUS.ORDER_CREATED,
      orderId: 9001,
      failReason: null,
    };
    const repository: any = {
      findByRequestId: jest.fn().mockResolvedValue(record),
      updateStatus: jest.fn(),
    };
    const admission: any = { release: jest.fn() };
    const orderClient: any = { createOrder: jest.fn() };
    const service = new GrabService(repository, admission, orderClient);

    const result = await service.cancelRequest(2004, 'GRAB-ORDERED');

    expect(admission.release).not.toHaveBeenCalled();
    expect(repository.updateStatus).not.toHaveBeenCalled();
    expect(result).toEqual({ requestId: 'GRAB-ORDERED', status: GRAB_STATUS.ORDER_CREATED, orderId: 9001, failReason: null });
  });

  it('expires accepted request and releases redis hold when cancelling an in-flight request', async () => {
    const record = {
      requestId: 'GRAB-ACCEPTED',
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 1,
      seatIds: [],
      allocateRandom: false,
      idempotencyKey: 'idem-accepted',
      status: GRAB_STATUS.ACCEPTED,
      orderId: null,
      failReason: null,
    };
    const repository: any = {
      findByRequestId: jest.fn().mockResolvedValue(record),
      updateStatus: jest.fn().mockResolvedValue({
        ...record,
        status: GRAB_STATUS.EXPIRED,
        failReason: '抢票请求已取消',
      }),
    };
    const admission: any = { release: jest.fn() };
    const orderClient: any = { createOrder: jest.fn() };
    const service = new GrabService(repository, admission, orderClient);

    const result = await service.cancelRequest(2004, 'GRAB-ACCEPTED');

    expect(admission.release).toHaveBeenCalledWith(record);
    expect(repository.updateStatus).toHaveBeenCalledWith('GRAB-ACCEPTED', GRAB_STATUS.EXPIRED, '抢票请求已取消');
    expect(result).toEqual({ requestId: 'GRAB-ACCEPTED', status: GRAB_STATUS.EXPIRED, orderId: null, failReason: '抢票请求已取消' });
  });
```

- [ ] **Step 3: Run the targeted test**

Run:

```bash
cd nestjs/grab-service && pnpm test -- grab.service.spec.ts
```

Expected: PASS. These are characterization tests for existing service behavior.

- [ ] **Step 4: Commit**

```bash
git add nestjs/grab-service/src/grab/grab.service.spec.ts
git commit -m "test: lock grab request access and cancellation rules"
```

---

### Task 3: 固化补偿任务不释放已有订单请求

**Files:**
- Modify: `nestjs/grab-service/src/grab/grab-compensation.service.spec.ts`

- [ ] **Step 1: Add failing test for order-created expired request**

Append this test inside `describe('GrabCompensationService', () => { ... })`:

```ts
  it('expires request with existing order without releasing redis hold', async () => {
    const expiredWithOrder = {
      requestId: 'GRAB2',
      userId: 2004,
      sessionId: 101,
      ticketTypeId: 202,
      quantity: 1,
      seatIds: [],
      idempotencyKey: 'idem-2',
      orderId: 9001,
    };
    const repository: any = {
      findExpiredInFlight: jest.fn().mockResolvedValue([expiredWithOrder]),
      updateStatus: jest.fn().mockResolvedValue({ ...expiredWithOrder, status: GRAB_STATUS.EXPIRED, failReason: '抢票请求已超时' }),
    };
    const admission: any = { release: jest.fn() };
    const service = new GrabCompensationService(repository, admission);

    await service.sweepExpiredRequests();

    expect(admission.release).not.toHaveBeenCalled();
    expect(repository.updateStatus).toHaveBeenCalledWith('GRAB2', GRAB_STATUS.EXPIRED, '抢票请求已超时');
  });
```

- [ ] **Step 2: Run the targeted test**

Run:

```bash
cd nestjs/grab-service && pnpm test -- grab-compensation.service.spec.ts
```

Expected: PASS. This is a characterization test for existing compensation behavior.

- [ ] **Step 3: Commit**

```bash
git add nestjs/grab-service/src/grab/grab-compensation.service.spec.ts
git commit -m "test: lock grab compensation release rules"
```

---

### Task 4: 给订单内部创建入口添加 Sentinel block handler 测试

**Files:**
- Modify: `java/java-order/src/test/java/com/omni/order/controller/OrderControllerInternalCreateTest.java`

- [ ] **Step 1: Add Sentinel imports**

Add these imports to `OrderControllerInternalCreateTest.java`:

```java
import com.alibaba.csp.sentinel.slots.block.flow.FlowException;
import com.alibaba.csp.sentinel.slots.block.BlockException;
```

- [ ] **Step 2: Add failing tests for block handlers**

Append these tests inside `class OrderControllerInternalCreateTest`:

```java
    @Test
    void internalCreateBlockHandlerReturnsBusyResponse() {
        CreateOrderRequest request = new CreateOrderRequest();
        request.setUserId(2004L);
        request.setSessionId(7L);
        request.setTicketTypeId(21L);
        request.setQuantity(1);
        BlockException exception = new FlowException("order-internal-create");

        Result<Order> result = controller.createInternalOrderBlocked(request, "test-internal-token", exception);

        assertEquals(429, result.getCode());
        assertEquals("系统繁忙，请稍后重试", result.getMessage());
        assertNull(result.getData());
        verify(orderService, never()).createOrder(any());
    }

    @Test
    void internalCreateWithSeatsBlockHandlerReturnsBusyResponse() {
        LockSeatsRequest request = new LockSeatsRequest();
        request.setUserId(2004L);
        request.setSessionId(7L);
        request.setTicketTypeId(21L);
        request.setQuantity(1);
        request.setSeatIds(List.of(301L));
        BlockException exception = new FlowException("order-internal-create-with-seats");

        Result<Order> result = controller.createInternalOrderWithSeatsBlocked(request, "test-internal-token", exception);

        assertEquals(429, result.getCode());
        assertEquals("系统繁忙，请稍后重试", result.getMessage());
        assertNull(result.getData());
        verify(orderService, never()).createOrderWithSeats(any());
    }
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```bash
cd java && mvn -pl java-order -Dtest=OrderControllerInternalCreateTest test
```

Expected: FAIL with missing methods `createInternalOrderBlocked` and `createInternalOrderWithSeatsBlocked`.

- [ ] **Step 4: Commit failing test**

Do not commit the failing test by itself unless the execution workflow explicitly wants red commits. If committing only green checkpoints, skip this step and commit after Task 6 passes.

---

### Task 5: 初始化订单 Sentinel 本地规则

**Files:**
- Create: `java/java-order/src/main/java/com/omni/order/config/OrderSentinelConfig.java`

- [ ] **Step 1: Create Sentinel config class**

Create `java/java-order/src/main/java/com/omni/order/config/OrderSentinelConfig.java` with this content:

```java
package com.omni.order.config;

import com.alibaba.csp.sentinel.slots.block.RuleConstant;
import com.alibaba.csp.sentinel.slots.block.flow.FlowRule;
import com.alibaba.csp.sentinel.slots.block.flow.FlowRuleManager;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import java.util.ArrayList;
import java.util.List;

@Configuration
public class OrderSentinelConfig implements InitializingBean {

    public static final String INTERNAL_CREATE_ORDER_RESOURCE = "order-internal-create";
    public static final String INTERNAL_CREATE_ORDER_WITH_SEATS_RESOURCE = "order-internal-create-with-seats";

    private final double createOrderQps;
    private final double createOrderWithSeatsQps;

    public OrderSentinelConfig(
            @Value("${omni.sentinel.order.internal-create.qps:80}") double createOrderQps,
            @Value("${omni.sentinel.order.internal-create-with-seats.qps:80}") double createOrderWithSeatsQps) {
        this.createOrderQps = createOrderQps;
        this.createOrderWithSeatsQps = createOrderWithSeatsQps;
    }

    @Override
    public void afterPropertiesSet() {
        List<FlowRule> rules = new ArrayList<>();
        rules.add(flowRule(INTERNAL_CREATE_ORDER_RESOURCE, createOrderQps));
        rules.add(flowRule(INTERNAL_CREATE_ORDER_WITH_SEATS_RESOURCE, createOrderWithSeatsQps));
        FlowRuleManager.loadRules(rules);
    }

    private FlowRule flowRule(String resource, double qps) {
        FlowRule rule = new FlowRule();
        rule.setResource(resource);
        rule.setGrade(RuleConstant.FLOW_GRADE_QPS);
        rule.setCount(qps);
        return rule;
    }
}
```

- [ ] **Step 2: Run compile for the new config**

Run:

```bash
cd java && mvn -pl java-order -DskipTests compile
```

Expected: PASS. If it fails because Sentinel classes are unresolved, verify `java/java-order/pom.xml` still contains `spring-cloud-starter-alibaba-sentinel`.

---

### Task 6: 给内部创建接口接入 SentinelResource

**Files:**
- Modify: `java/java-order/src/main/java/com/omni/order/controller/OrderController.java`

- [ ] **Step 1: Add imports**

Add these imports to `OrderController.java`:

```java
import com.alibaba.csp.sentinel.annotation.SentinelResource;
import com.alibaba.csp.sentinel.slots.block.BlockException;
import com.omni.order.config.OrderSentinelConfig;
```

- [ ] **Step 2: Annotate internal create endpoints and add block handlers**

Replace the existing internal create methods in `OrderController.java` lines around `/internal/create` and `/internal/create-with-seats` with this code:

```java
    @PostMapping("/internal/create")
    @SentinelResource(value = OrderSentinelConfig.INTERNAL_CREATE_ORDER_RESOURCE, blockHandler = "createInternalOrderBlocked")
    public Result<Order> createInternalOrder(@RequestBody CreateOrderRequest request,
                                             @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        return Result.success(orderService.createOrder(request));
    }

    public Result<Order> createInternalOrderBlocked(CreateOrderRequest request, String token, BlockException exception) {
        return Result.fail(429, "系统繁忙，请稍后重试");
    }

    @PostMapping("/internal/create-with-seats")
    @SentinelResource(value = OrderSentinelConfig.INTERNAL_CREATE_ORDER_WITH_SEATS_RESOURCE, blockHandler = "createInternalOrderWithSeatsBlocked")
    public Result<Order> createInternalOrderWithSeats(@RequestBody LockSeatsRequest request,
                                                      @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        return Result.success(orderService.createOrderWithSeats(request));
    }

    public Result<Order> createInternalOrderWithSeatsBlocked(LockSeatsRequest request, String token, BlockException exception) {
        return Result.fail(429, "系统繁忙，请稍后重试");
    }
```

- [ ] **Step 3: Run the controller test**

Run:

```bash
cd java && mvn -pl java-order -Dtest=OrderControllerInternalCreateTest test
```

Expected: PASS. The two new block handler tests should now pass, and the existing token checks should still pass.

- [ ] **Step 4: Commit**

```bash
git add java/java-order/src/main/java/com/omni/order/config/OrderSentinelConfig.java java/java-order/src/main/java/com/omni/order/controller/OrderController.java java/java-order/src/test/java/com/omni/order/controller/OrderControllerInternalCreateTest.java
git commit -m "feat: protect internal order creation with sentinel"
```

---

### Task 7: Full verification

**Files:**
- No source changes expected.

- [ ] **Step 1: Run all grab-service tests**

Run:

```bash
cd nestjs/grab-service && pnpm test
```

Expected: PASS.

- [ ] **Step 2: Run order service tests**

Run:

```bash
cd java && mvn -pl java-order test
```

Expected: PASS.

- [ ] **Step 3: Run boundary verification if Java controller changes pass**

Run:

```bash
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
```

Expected: PASS. This confirms the Sentinel work did not introduce forbidden cross-service data access.

- [ ] **Step 4: Review git diff**

Run:

```bash
git diff --stat HEAD~4..HEAD
```

Expected: Changes are limited to grab-service tests, order Sentinel config, order controller, and order controller test.

---

## Self-Review

- Spec coverage:
  - grab-service 登录态身份：Task 1。
  - 状态查询越权：Task 2。
  - 取消接口可取消/不可取消状态：Task 2。
  - 补偿任务已有订单不释放：Task 3。
  - Sentinel 最小启用：Tasks 4-6。
  - 验收命令：Task 7。
- Placeholder scan: no TBD/TODO/fill-in placeholders remain.
- Type consistency:
  - NestJS tests use existing `GrabController`, `GrabService`, `GrabCompensationService`, and `GRAB_STATUS` names.
  - Java block handlers match Sentinel `blockHandler` signature: original parameters plus `BlockException`.
  - Sentinel resource names are centralized in `OrderSentinelConfig` and referenced by `OrderController`.
