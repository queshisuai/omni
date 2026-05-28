# Remaining Grab Risk Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining high-risk gaps: repeated user clicks return the same grab result, and public order creation no longer trusts body `userId`.

**Architecture:** Keep grab-service backend intent deduplication as the primary safety net, add frontend intent-scoped idempotency reuse, and harden java-order public create endpoints by deriving `userId` from the JWT `Authorization` header. Internal order endpoints remain token-protected for grab-service.

**Tech Stack:** Next.js 16 / React 19 / TypeScript frontend, Java Spring Boot order service, JJWT, Jest, Maven.

---

## File Structure

- Modify `frontend/src/app/activity/[id]/page.tsx`
  - Reuse one grab idempotency key for the same purchase intent and reset it when the intent changes.
- Modify `java/java-order/src/main/java/com/omni/order/controller/OrderController.java`
  - Public create endpoints override request `userId` from JWT claims instead of trusting body `userId`.
- Create or modify `java/java-order/src/test/java/com/omni/order/controller/OrderControllerPublicAuthTest.java`
  - Cover public create and create-with-seats user override behavior.
- Existing `nestjs/grab-service/src/grab/grab.service.spec.ts`
  - Already covers same-intent backend dedupe; run as regression.

---

### Task 1: Harden public order create endpoints

**Files:**
- Modify: `java/java-order/src/main/java/com/omni/order/controller/OrderController.java`
- Test: `java/java-order/src/test/java/com/omni/order/controller/OrderControllerPublicAuthTest.java`

- [ ] **Step 1: Write failing controller tests**

Create `java/java-order/src/test/java/com/omni/order/controller/OrderControllerPublicAuthTest.java`:

```java
package com.omni.order.controller;

import com.omni.common.result.Result;
import com.omni.order.dto.CreateOrderRequest;
import com.omni.order.dto.LockSeatsRequest;
import com.omni.order.entity.Order;
import com.omni.order.service.OrderService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class OrderControllerPublicAuthTest {
    private static final String SECRET = "omni-jwt-secretomni-jwt-secretomni-jwt-secret";

    @Test
    void publicCreateOrderUsesJwtUserIdInsteadOfBodyUserId() {
        OrderService orderService = mock(OrderService.class);
        when(orderService.createOrder(any(CreateOrderRequest.class))).thenAnswer(invocation -> {
            CreateOrderRequest request = invocation.getArgument(0);
            Order order = new Order();
            order.setId(9001L);
            order.setUserId(request.getUserId());
            return order;
        });
        OrderController controller = new OrderController(orderService, "internal-token", SECRET);
        CreateOrderRequest request = new CreateOrderRequest();
        request.setUserId(9999L);
        request.setSessionId(3L);
        request.setTicketTypeId(91L);
        request.setQuantity(1);

        Result<Order> result = controller.createOrder(request, bearer(2004L));

        assertEquals(200, result.getCode());
        assertEquals(2004L, result.getData().getUserId());
        verify(orderService).createOrder(argThat(argument -> argument.getUserId().equals(2004L)));
    }

    @Test
    void publicCreateOrderRejectsMissingJwt() {
        OrderService orderService = mock(OrderService.class);
        OrderController controller = new OrderController(orderService, "internal-token", SECRET);

        Result<Order> result = controller.createOrder(new CreateOrderRequest(), null);

        assertEquals(401, result.getCode());
        verify(orderService, never()).createOrder(any());
    }

    @Test
    void publicCreateOrderWithSeatsUsesJwtUserIdInsteadOfBodyUserId() {
        OrderService orderService = mock(OrderService.class);
        when(orderService.createOrderWithSeats(any(LockSeatsRequest.class))).thenAnswer(invocation -> {
            LockSeatsRequest request = invocation.getArgument(0);
            Order order = new Order();
            order.setId(9002L);
            order.setUserId(request.getUserId());
            return order;
        });
        OrderController controller = new OrderController(orderService, "internal-token", SECRET);
        LockSeatsRequest request = new LockSeatsRequest();
        request.setUserId(9999L);
        request.setSessionId(3L);
        request.setTicketTypeId(91L);
        request.setSeatIds(List.of(1L));
        request.setQuantity(1);

        Result<Order> result = controller.createOrderWithSeats(request, bearer(2004L));

        assertEquals(200, result.getCode());
        assertEquals(2004L, result.getData().getUserId());
        verify(orderService).createOrderWithSeats(argThat(argument -> argument.getUserId().equals(2004L)));
    }

    private static String bearer(Long userId) {
        Key key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        String token = Jwts.builder()
                .claim("userId", userId)
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
        return "Bearer " + token;
    }
}
```

- [ ] **Step 2: Run failing controller tests**

Run from `java/java-order`:

```bash
mvn test -Dtest=OrderControllerPublicAuthTest
```

Expected before implementation: compilation fails because public controller methods do not accept `Authorization`, or tests fail because body `userId` is used.

- [ ] **Step 3: Implement JWT user extraction in `OrderController`**

Modify constructor to accept JWT secret:

```java
private final String jwtSecret;

public OrderController(OrderService orderService,
                       @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken,
                       @Value("${jwt.secret:${JWT_SECRET:omni-jwt-secretomni-jwt-secretomni-jwt-secret}}") String jwtSecret) {
    this.orderService = orderService;
    this.internalApiToken = internalApiToken;
    this.jwtSecret = jwtSecret;
}
```

Change public methods:

```java
@PostMapping("/create")
public Result<Order> createOrder(@RequestBody CreateOrderRequest request,
                                 @RequestHeader(value = "Authorization", required = false) String authorization) {
    Long userId = requireAuthenticatedUserId(authorization);
    if (userId == null) {
        return Result.fail(401, "未登录");
    }
    request.setUserId(userId);
    Order order = orderService.createOrder(request);
    return Result.success(order);
}

@PostMapping("/create-with-seats")
public Result<Order> createOrderWithSeats(@RequestBody LockSeatsRequest request,
                                          @RequestHeader(value = "Authorization", required = false) String authorization) {
    Long userId = requireAuthenticatedUserId(authorization);
    if (userId == null) {
        return Result.fail(401, "未登录");
    }
    request.setUserId(userId);
    return Result.success(orderService.createOrderWithSeats(request));
}
```

Add helper methods and imports:

```java
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
```

```java
private Long requireAuthenticatedUserId(String authorization) {
    if (!StringUtils.hasText(authorization) || !authorization.startsWith("Bearer ")) {
        return null;
    }
    try {
        Claims claims = Jwts.parserBuilder()
                .setSigningKey(Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8)))
                .build()
                .parseClaimsJws(authorization.substring("Bearer ".length()))
                .getBody();
        Object userId = claims.get("userId");
        if (userId == null) {
            userId = claims.getSubject();
        }
        if (userId == null) {
            return null;
        }
        return Long.valueOf(String.valueOf(userId));
    } catch (RuntimeException e) {
        return null;
    }
}
```

- [ ] **Step 4: Run controller tests green**

Run from `java/java-order`:

```bash
mvn test -Dtest=OrderControllerPublicAuthTest
```

Expected: all tests pass.

---

### Task 2: Frontend purchase-intent idempotency reuse

**Files:**
- Modify: `frontend/src/app/activity/[id]/page.tsx`

- [ ] **Step 1: Inspect current idempotency state**

Confirm `page.tsx` has `grabIdempotencyKey` state and `getOrCreateGrabIdempotencyKey()` currently includes `Date.now()` and random text.

- [ ] **Step 2: Implement intent-scoped key reuse**

Replace the current string state:

```ts
const [grabIdempotencyKey, setGrabIdempotencyKey] = useState('')
```

with:

```ts
const [grabIdempotency, setGrabIdempotency] = useState<{ intent: string; key: string } | null>(null)
```

Add helper functions near the existing purchase helpers:

```ts
const buildGrabIntent = (userId: number) => {
  const seatPart = selectedSeats.map((seat) => seat.id).sort((a, b) => a - b).join(',')
  return [
    userId,
    selectedSession?.session.id ?? 0,
    selectedTicket?.id ?? 0,
    quantity,
    seatPart,
    Boolean(selectedTicket?.seatBlockId && selectedSeats.length === 0),
  ].join(':')
}

const getOrCreateGrabIdempotencyKey = (userId: number) => {
  const intent = buildGrabIntent(userId)
  if (grabIdempotency?.intent === intent) return grabIdempotency.key
  const key = `${intent}:${Date.now()}:${Math.random().toString(36).slice(2)}`
  setGrabIdempotency({ intent, key })
  return key
}
```

Update any `setGrabIdempotencyKey('')` calls to:

```ts
setGrabIdempotency(null)
```

- [ ] **Step 3: Run frontend typecheck**

Run from `frontend`:

```bash
pnpm typecheck
```

Expected: typecheck passes.

---

### Task 3: Verification and merge readiness

**Files:**
- No implementation files modified in this task.

- [ ] **Step 1: Run grab-service regression tests**

Run from `nestjs/grab-service`:

```bash
npm test -- --runTestsByPath src/grab/grab.service.spec.ts src/main.spec.ts --runInBand
```

Expected: all tests pass.

- [ ] **Step 2: Run java-order focused tests**

Run from `java/java-order`:

```bash
mvn test -Dtest=OrderControllerPublicAuthTest,OrderControllerInternalCreateTest,OrderControllerInternalSeatUsageTest
```

Expected: all tests pass.

- [ ] **Step 3: Runtime verify repeated grab intent returns same result**

Use running grab-service and order-service. Submit the same body twice with different `idempotencyKey` but same `userId/sessionId/ticketTypeId/quantity/seatIds`. Expected: same `requestId` and same `orderId`.

- [ ] **Step 4: Runtime verify forged body userId is ignored**

Call `/api/order/create` with JWT `userId=2004` and body `userId=9999`. Expected order row has `user_id=2004`.

- [ ] **Step 5: Re-run JMeter 1000-for-100**

Run the current JMeter plan from `nestjs/grab-service/jmeter` using `C:\tools\apache-jmeter-5.6.3\bin\jmeter.bat`. Expected: 1000 successful HTTP samples, DB `ORDER_CREATED=100`, `SOLD_OUT=900`, Redis stock `0`.

- [ ] **Step 6: Merge readiness**

After verification evidence is fresh and successful, use `finishing-a-development-branch` before merging to master.

---

## Self-Review

- Spec coverage: repeated click behavior is covered by Task 2 and runtime Step 3; public body `userId` trust is covered by Task 1 and runtime Step 4; existing JMeter high-risk proof is covered by Task 3 Step 5.
- Placeholder scan: no TBD/TODO placeholders remain.
- Type consistency: Java controller helper returns `Long`; frontend idempotency state uses `{ intent, key }`; existing internal order endpoints are unchanged.
