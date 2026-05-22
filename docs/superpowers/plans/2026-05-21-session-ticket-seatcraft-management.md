# Session Ticket SeatCraft Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the confirmed方案 B: manage ticket types inside the session SeatCraft page, support activity seat-map visibility, keep real seat inventory in sync, and protect purchased/locked seats from destructive edits.

**Architecture:** Keep ticket-owned seat data in `java-ticket`, order-owned seat usage in `java-order`, and communicate only through authenticated internal APIs. The session SeatCraft save path becomes a guarded reconciliation flow: validate protected seats, apply allowed changes to unsold seats, then recalculate `ticket_type` stock from `session_seat`.

**Tech Stack:** Java Spring Cloud Alibaba, Spring MVC, MyBatis-Plus, OpenFeign, PostgreSQL, Next.js 16, React 19, TypeScript, pnpm, Maven.

---

## File Structure

### SQL
- Create: `sql/migrations/shared/20260521_activity_seat_map_visibility.sql` - shared migration adding `activity.seat_map_visibility`.
- Create: `sql/production-split/ticket/20260521_activity_seat_map_visibility.sql` - prod-split ticket DB migration.
- Modify: `sql/seed.sql` - set demo activities to explicit `hidden` or `published` visibility.

### java-order
- Create: `java/java-order/src/main/java/com/omni/order/dto/SessionSeatUsageRequest.java` - request DTO for order-owned seat usage lookup.
- Create: `java/java-order/src/main/java/com/omni/order/dto/SessionSeatUsageItemResponse.java` - per-seat usage result.
- Create: `java/java-order/src/main/java/com/omni/order/dto/SessionSeatUsageResponse.java` - aggregate response.
- Modify: `java/java-order/src/main/java/com/omni/order/controller/OrderController.java` - add `POST /api/order/internal/session-seats/usage` with `X-Internal-Token` validation.
- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java` - add `inspectSessionSeatUsage(...)`.
- Test: `java/java-order/src/test/java/com/omni/order/controller/OrderControllerInternalSeatUsageTest.java` - controller token and response tests.
- Test: `java/java-order/src/test/java/com/omni/order/service/OrderServiceSeatUsageTest.java` - service maps `order_seat` status to editability.

### java-ticket
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/entity/Activity.java` - add `seatMapVisibility`.
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java` - create/update activity visibility and publish validation.
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityAdminService.java` - enforce sellable ticket and real seat pool when publishing.
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/ActivityController.java` or current public activity controller file - include visibility in activity detail response through entity serialization.
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/client/OrderInternalClient.java` - add order seat usage endpoint.
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/SessionSeatUsageRequest.java` - ticket-side request DTO for Feign.
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/SessionSeatUsageItemResponse.java` - ticket-side response item.
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/SessionSeatUsageResponse.java` - ticket-side aggregate response.
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/SessionSeatProtectionService.java` - identifies protected seats using ticket fields plus order internal API.
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/TicketTypeStockRecalculationService.java` - recalculates `ticket_type.total_stock/remain_stock` from `session_seat`.
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SessionSeatLayoutService.java` - guarded SeatCraft save, ticket binding, and unsold seat reconciliation.
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java` - add `PUT /api/ticket/admin/sessions/{sessionId}/ticket-bindings`; protect ticket type delete.
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/SessionSeatProtectionServiceTest.java`.
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/TicketTypeStockRecalculationServiceTest.java`.
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/SessionSeatLayoutServiceTest.java` - extend for guarded save.
- Test: `java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java` - activity visibility and ticket binding/delete errors.

### frontend
- Modify: `frontend/src/types/api.ts` - add `seatMapVisibility`, ticket binding request types, protected seat fields if needed.
- Modify: `frontend/src/lib/api.ts` - add `updateSessionTicketBindings(...)`; include visibility in activity create/update.
- Modify: `frontend/src/app/console/sessions/page.tsx` - change “票档” button to `Link` to `/console/sessions/{id}/seat-layout?mode=tickets`.
- Modify: `frontend/src/app/console/sessions/[id]/seat-layout/page.tsx` - parse `mode=tickets`; show ticket management panel.
- Create: `frontend/src/components/seatcraft-unified/SeatCraftTicketManagementPanel.tsx` - focused right-side ticket management UI.
- Modify: `frontend/src/components/seatcraft-unified/SeatCraftCanvas.tsx` - render protected seats as gray locked and prevent interactions.
- Modify: `frontend/src/components/seatcraft-unified/SeatCraftSelector.tsx` - keep C端 selection behavior for published mode.
- Modify: `frontend/src/app/console/activities/new/page.tsx` and relevant edit/publish pages - add visibility radio choices.
- Modify: `frontend/src/app/activity/[id]/page.tsx` - use `activity.seatMapVisibility` to select free-seat or random-allocation purchase flow.

---

### Task 1: Add Activity Seat Map Visibility

**Files:**
- Create: `sql/migrations/shared/20260521_activity_seat_map_visibility.sql`
- Create: `sql/production-split/ticket/20260521_activity_seat_map_visibility.sql`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/entity/Activity.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/app/console/activities/new/page.tsx`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java`

- [ ] **Step 1: Write failing admin create activity test**

Add to `AdminControllerTest`:

```java
@Test
void createActivityStoresSeatMapVisibility() {
    when(userMapper.selectById(2003L)).thenReturn(user(2003L, "organizer"));
    doAnswer(invocation -> {
        Activity activity = invocation.getArgument(0);
        activity.setId(88L);
        return 1;
    }).when(activityMapper).insert(any(Activity.class));

    Map<String, Object> body = new HashMap<>();
    body.put("userId", 2003L);
    body.put("categoryId", 1L);
    body.put("artistId", 1L);
    body.put("name", "测试活动");
    body.put("seatMapVisibility", "published");

    Result<Activity> result = controller.createActivity(body);

    assertEquals(200, result.getCode());
    ArgumentCaptor<Activity> captor = ArgumentCaptor.forClass(Activity.class);
    verify(activityMapper).insert(captor.capture());
    assertEquals("published", captor.getValue().getSeatMapVisibility());
}
```

- [ ] **Step 2: Run test and verify failure**

Run: `mvn -pl java-ticket "-Dtest=AdminControllerTest#createActivityStoresSeatMapVisibility" test`

Expected: FAIL because `Activity.getSeatMapVisibility()` does not exist.

- [ ] **Step 3: Add SQL migrations**

Create both SQL files with identical content:

```sql
ALTER TABLE activity
    ADD COLUMN IF NOT EXISTS seat_map_visibility VARCHAR(20) NOT NULL DEFAULT 'hidden';

ALTER TABLE activity
    ADD CONSTRAINT chk_activity_seat_map_visibility
    CHECK (seat_map_visibility IN ('published', 'hidden'));
```

If the shared database may already have a constraint with the same name, wrap the constraint in a `DO $$ BEGIN ... END $$;` block consistent with existing migration style.

- [ ] **Step 4: Add entity field and controller parsing**

In `Activity.java` add:

```java
private String seatMapVisibility;

public String getSeatMapVisibility() { return seatMapVisibility; }
public void setSeatMapVisibility(String seatMapVisibility) { this.seatMapVisibility = seatMapVisibility; }
```

In `AdminController.createActivity(...)`, set:

```java
activity.setSeatMapVisibility(parseSeatMapVisibility(body.get("seatMapVisibility")));
```

Add helper in `AdminController`:

```java
private String parseSeatMapVisibility(Object value) {
    if (value == null) return "hidden";
    String visibility = value.toString().trim();
    if ("published".equals(visibility) || "hidden".equals(visibility)) {
        return visibility;
    }
    throw new BusinessException(400, "座位图展示策略不正确");
}
```

Also in `updateActivity(...)`, if `body.containsKey("seatMapVisibility")`, update the field.

- [ ] **Step 5: Run backend test**

Run: `mvn -pl java-ticket "-Dtest=AdminControllerTest#createActivityStoresSeatMapVisibility" test`

Expected: PASS.

- [ ] **Step 6: Add frontend types and create activity field**

In `frontend/src/types/api.ts`, add to `ActivityEntity`:

```ts
seatMapVisibility?: 'published' | 'hidden' | null
```

In `frontend/src/app/console/activities/new/page.tsx`, add state:

```ts
const [seatMapVisibility, setSeatMapVisibility] = useState<'published' | 'hidden'>('hidden')
```

Include in create request body:

```ts
seatMapVisibility,
```

Add radio UI near publish/status options:

```tsx
<div className="rounded-xl border border-[#e5e5e5] bg-white p-4">
  <div className="text-[14px] font-medium text-[#333]">座位图展示策略</div>
  <label className="mt-3 flex items-start gap-2 text-[13px] text-[#666]">
    <input type="radio" checked={seatMapVisibility === 'published'} onChange={() => setSeatMapVisibility('published')} />
    <span>公布座位图：用户可在前台自由选择座位。</span>
  </label>
  <label className="mt-2 flex items-start gap-2 text-[13px] text-[#666]">
    <input type="radio" checked={seatMapVisibility === 'hidden'} onChange={() => setSeatMapVisibility('hidden')} />
    <span>座位图暂不公布：用户只选择票档和数量，座位将在下单后由系统自动分配。</span>
  </label>
</div>
```

- [ ] **Step 7: Verify frontend typecheck**

Run: `pnpm typecheck` in `frontend`.

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add sql/migrations/shared/20260521_activity_seat_map_visibility.sql sql/production-split/ticket/20260521_activity_seat_map_visibility.sql java/java-ticket/src/main/java/com/omni/ticket/entity/Activity.java java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java frontend/src/types/api.ts frontend/src/app/console/activities/new/page.tsx
git commit -m "feat: add activity seat map visibility"
```

---

### Task 2: Add Order Internal Seat Usage API

**Files:**
- Create: `java/java-order/src/main/java/com/omni/order/dto/SessionSeatUsageRequest.java`
- Create: `java/java-order/src/main/java/com/omni/order/dto/SessionSeatUsageItemResponse.java`
- Create: `java/java-order/src/main/java/com/omni/order/dto/SessionSeatUsageResponse.java`
- Modify: `java/java-order/src/main/java/com/omni/order/controller/OrderController.java`
- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java`
- Test: `java/java-order/src/test/java/com/omni/order/service/OrderServiceSeatUsageTest.java`
- Test: `java/java-order/src/test/java/com/omni/order/controller/OrderControllerInternalSeatUsageTest.java`

- [ ] **Step 1: Write failing service test**

Create `OrderServiceSeatUsageTest.java`:

```java
package com.omni.order.service;

import com.omni.order.dto.SessionSeatUsageResponse;
import com.omni.order.entity.OrderSeat;
import com.omni.order.mapper.OrderMapper;
import com.omni.order.mapper.OrderSeatMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OrderServiceSeatUsageTest {
    @Test
    void inspectSessionSeatUsageMarksLockedOrSoldSeatsNotEditable() {
        OrderMapper orderMapper = mock(OrderMapper.class);
        OrderSeatMapper orderSeatMapper = mock(OrderSeatMapper.class);
        OrderService service = new OrderService(orderMapper, orderSeatMapper);

        OrderSeat locked = new OrderSeat();
        locked.setSessionSeatId(11L);
        locked.setOrderId(101L);
        locked.setStatus(1);

        OrderSeat sold = new OrderSeat();
        sold.setSessionSeatId(12L);
        sold.setOrderId(102L);
        sold.setStatus(2);

        when(orderSeatMapper.selectList(any())).thenReturn(List.of(locked, sold));

        SessionSeatUsageResponse response = service.inspectSessionSeatUsage(List.of(11L, 12L, 13L));

        assertEquals(3, response.getSeats().size());
        assertTrue(response.getSeats().stream().filter(item -> item.getSessionSeatId().equals(11L)).findFirst().get().getUsedByOrder());
        assertFalse(response.getSeats().stream().filter(item -> item.getSessionSeatId().equals(11L)).findFirst().get().getEditable());
        assertTrue(response.getSeats().stream().filter(item -> item.getSessionSeatId().equals(12L)).findFirst().get().getUsedByOrder());
        assertTrue(response.getSeats().stream().filter(item -> item.getSessionSeatId().equals(13L)).findFirst().get().getEditable());
    }
}
```

- [ ] **Step 2: Run test and verify failure**

Run: `mvn -pl java-order "-Dtest=OrderServiceSeatUsageTest" test`

Expected: FAIL because DTOs and `inspectSessionSeatUsage` do not exist.

- [ ] **Step 3: Create DTOs**

`SessionSeatUsageRequest.java`:

```java
package com.omni.order.dto;

import java.util.List;

public class SessionSeatUsageRequest {
    private List<Long> sessionSeatIds;

    public List<Long> getSessionSeatIds() { return sessionSeatIds; }
    public void setSessionSeatIds(List<Long> sessionSeatIds) { this.sessionSeatIds = sessionSeatIds; }
}
```

`SessionSeatUsageItemResponse.java`:

```java
package com.omni.order.dto;

public class SessionSeatUsageItemResponse {
    private Long sessionSeatId;
    private Boolean usedByOrder;
    private Boolean editable;
    private Long orderId;
    private Integer orderSeatStatus;

    public Long getSessionSeatId() { return sessionSeatId; }
    public void setSessionSeatId(Long sessionSeatId) { this.sessionSeatId = sessionSeatId; }
    public Boolean getUsedByOrder() { return usedByOrder; }
    public void setUsedByOrder(Boolean usedByOrder) { this.usedByOrder = usedByOrder; }
    public Boolean getEditable() { return editable; }
    public void setEditable(Boolean editable) { this.editable = editable; }
    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public Integer getOrderSeatStatus() { return orderSeatStatus; }
    public void setOrderSeatStatus(Integer orderSeatStatus) { this.orderSeatStatus = orderSeatStatus; }
}
```

`SessionSeatUsageResponse.java`:

```java
package com.omni.order.dto;

import java.util.ArrayList;
import java.util.List;

public class SessionSeatUsageResponse {
    private List<SessionSeatUsageItemResponse> seats = new ArrayList<>();

    public List<SessionSeatUsageItemResponse> getSeats() { return seats; }
    public void setSeats(List<SessionSeatUsageItemResponse> seats) { this.seats = seats == null ? new ArrayList<>() : seats; }
}
```

- [ ] **Step 4: Implement service method**

In `OrderService.java`, add imports and method:

```java
public SessionSeatUsageResponse inspectSessionSeatUsage(List<Long> sessionSeatIds) {
    List<Long> ids = sessionSeatIds == null ? java.util.Collections.emptyList() : sessionSeatIds.stream()
            .filter(java.util.Objects::nonNull)
            .distinct()
            .collect(java.util.stream.Collectors.toList());
    SessionSeatUsageResponse response = new SessionSeatUsageResponse();
    if (ids.isEmpty()) {
        return response;
    }
    List<OrderSeat> orderSeats = orderSeatMapper.selectList(new LambdaQueryWrapper<OrderSeat>()
            .in(OrderSeat::getSessionSeatId, ids));
    Map<Long, OrderSeat> usageBySeat = orderSeats.stream()
            .filter(item -> item.getSessionSeatId() != null)
            .collect(Collectors.toMap(OrderSeat::getSessionSeatId, item -> item, (left, right) -> right));
    List<SessionSeatUsageItemResponse> items = new ArrayList<>();
    for (Long id : ids) {
        OrderSeat orderSeat = usageBySeat.get(id);
        SessionSeatUsageItemResponse item = new SessionSeatUsageItemResponse();
        item.setSessionSeatId(id);
        item.setUsedByOrder(orderSeat != null);
        item.setEditable(orderSeat == null);
        if (orderSeat != null) {
            item.setOrderId(orderSeat.getOrderId());
            item.setOrderSeatStatus(orderSeat.getStatus());
        }
        items.add(item);
    }
    response.setSeats(items);
    return response;
}
```

- [ ] **Step 5: Add controller endpoint and token test**

Add to `OrderController.java`:

```java
@PostMapping("/internal/session-seats/usage")
public Result<SessionSeatUsageResponse> inspectSessionSeatUsage(
        @RequestBody(required = false) SessionSeatUsageRequest request,
        @RequestHeader(value = "X-Internal-Token", required = false) String token) {
    if (!isValidInternalToken(token)) {
        return Result.fail(403, "无权限");
    }
    List<Long> ids = request == null ? java.util.Collections.emptyList() : request.getSessionSeatIds();
    return Result.success(orderService.inspectSessionSeatUsage(ids));
}
```

Create `OrderControllerInternalSeatUsageTest.java` verifying bad token returns `403` and good token delegates. Use current controller test style; instantiate `OrderController(service, "token")` and mock `OrderService`.

- [ ] **Step 6: Run order tests**

Run: `mvn -pl java-order "-Dtest=OrderServiceSeatUsageTest,OrderControllerInternalSeatUsageTest" test`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add java/java-order/src/main/java/com/omni/order/dto/SessionSeatUsageRequest.java java/java-order/src/main/java/com/omni/order/dto/SessionSeatUsageItemResponse.java java/java-order/src/main/java/com/omni/order/dto/SessionSeatUsageResponse.java java/java-order/src/main/java/com/omni/order/controller/OrderController.java java/java-order/src/main/java/com/omni/order/service/OrderService.java java/java-order/src/test/java/com/omni/order/service/OrderServiceSeatUsageTest.java java/java-order/src/test/java/com/omni/order/controller/OrderControllerInternalSeatUsageTest.java
git commit -m "feat: expose order seat usage internal API"
```

---

### Task 3: Add Ticket Seat Protection and Stock Recalculation Services

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/client/OrderInternalClient.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/SessionSeatUsageRequest.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/SessionSeatUsageItemResponse.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/SessionSeatUsageResponse.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/SessionSeatProtectionService.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/TicketTypeStockRecalculationService.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/SessionSeatProtectionServiceTest.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/TicketTypeStockRecalculationServiceTest.java`

- [ ] **Step 1: Write failing protection service test**

Create `SessionSeatProtectionServiceTest.java` with mocked `OrderInternalClient` and `SessionSeatMapper`. Test that local locked/sold seats and order-used seats are protected.

```java
@Test
void protectedSeatIdsIncludeTicketStateAndOrderUsage() {
    SessionSeatMapper sessionSeatMapper = mock(SessionSeatMapper.class);
    OrderInternalClient orderClient = mock(OrderInternalClient.class);
    SessionSeatProtectionService service = new SessionSeatProtectionService(sessionSeatMapper, orderClient, "token");

    SessionSeat available = seat(1L, 1, null);
    SessionSeat locked = seat(2L, 2, null);
    SessionSeat sold = seat(3L, 3, 88L);
    when(sessionSeatMapper.selectList(any())).thenReturn(List.of(available, locked, sold));

    SessionSeatUsageItemResponse used = new SessionSeatUsageItemResponse();
    used.setSessionSeatId(1L);
    used.setUsedByOrder(true);
    used.setEditable(false);
    SessionSeatUsageResponse usage = new SessionSeatUsageResponse();
    usage.setSeats(List.of(used));
    when(orderClient.inspectSessionSeatUsage(any(), eq("token"))).thenReturn(Result.success(usage));

    Set<Long> protectedIds = service.findProtectedSeatIds(10L);

    assertEquals(Set.of(1L, 2L, 3L), protectedIds);
}
```

- [ ] **Step 2: Run test and verify failure**

Run: `mvn -pl java-ticket "-Dtest=SessionSeatProtectionServiceTest" test`

Expected: FAIL because service and DTOs do not exist.

- [ ] **Step 3: Add ticket DTOs and Feign method**

Mirror the order DTO shapes in `java-ticket/src/main/java/com/omni/ticket/dto`.

Add to `OrderInternalClient.java`:

```java
@PostMapping("/api/order/internal/session-seats/usage")
Result<SessionSeatUsageResponse> inspectSessionSeatUsage(@RequestBody SessionSeatUsageRequest request,
                                                         @RequestHeader("X-Internal-Token") String internalToken);
```

- [ ] **Step 4: Implement protection service**

Create `SessionSeatProtectionService.java`:

```java
@Service
public class SessionSeatProtectionService {
    private final SessionSeatMapper sessionSeatMapper;
    private final OrderInternalClient orderInternalClient;
    private final String internalApiToken;

    public SessionSeatProtectionService(SessionSeatMapper sessionSeatMapper,
                                        OrderInternalClient orderInternalClient,
                                        @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.sessionSeatMapper = sessionSeatMapper;
        this.orderInternalClient = orderInternalClient;
        this.internalApiToken = internalApiToken;
    }

    public Set<Long> findProtectedSeatIds(Long sessionId) {
        List<SessionSeat> seats = sessionSeatMapper.selectList(new LambdaQueryWrapper<SessionSeat>()
                .eq(SessionSeat::getSessionId, sessionId));
        Set<Long> protectedIds = seats.stream()
                .filter(seat -> Integer.valueOf(2).equals(seat.getStatus())
                        || Integer.valueOf(3).equals(seat.getStatus())
                        || seat.getOrderId() != null)
                .map(SessionSeat::getId)
                .collect(Collectors.toSet());
        List<Long> ids = seats.stream().map(SessionSeat::getId).filter(Objects::nonNull).collect(Collectors.toList());
        if (!ids.isEmpty() && orderInternalClient != null && StringUtils.hasText(internalApiToken)) {
            SessionSeatUsageRequest request = new SessionSeatUsageRequest();
            request.setSessionSeatIds(ids);
            Result<SessionSeatUsageResponse> result = orderInternalClient.inspectSessionSeatUsage(request, internalApiToken);
            if (result != null && result.getCode() == 200 && result.getData() != null) {
                for (SessionSeatUsageItemResponse item : result.getData().getSeats()) {
                    if (Boolean.TRUE.equals(item.getUsedByOrder()) || Boolean.FALSE.equals(item.getEditable())) {
                        protectedIds.add(item.getSessionSeatId());
                    }
                }
            }
        }
        return protectedIds;
    }
}
```

- [ ] **Step 5: Write and implement stock recalculation service**

Create failing `TicketTypeStockRecalculationServiceTest` that mocks `SessionSeatMapper.selectList(...)` returning two available seats and one sold seat for a ticket type, then verifies `TicketTypeMapper.updateById(...)` receives `totalStock=3` and `remainStock=2`.

Implement `TicketTypeStockRecalculationService.recalculateForSession(Long sessionId)`:

```java
public void recalculateForSession(Long sessionId) {
    List<TicketType> ticketTypes = ticketTypeMapper.selectList(new LambdaQueryWrapper<TicketType>()
            .eq(TicketType::getSessionId, sessionId));
    List<SessionSeat> seats = sessionSeatMapper.selectList(new LambdaQueryWrapper<SessionSeat>()
            .eq(SessionSeat::getSessionId, sessionId));
    for (TicketType ticketType : ticketTypes) {
        List<SessionSeat> owned = seats.stream()
                .filter(seat -> ticketType.getId().equals(seat.getTicketTypeId()))
                .filter(seat -> !Integer.valueOf(4).equals(seat.getStatus()))
                .collect(Collectors.toList());
        int total = (int) owned.stream().filter(seat -> seat.getStatus() != null && seat.getStatus() >= 1 && seat.getStatus() <= 3).count();
        int remain = (int) owned.stream().filter(seat -> Integer.valueOf(1).equals(seat.getStatus())
                && seat.getOrderId() == null
                && seat.getLockExpireTime() == null).count();
        ticketType.setTotalStock(total);
        ticketType.setRemainStock(remain);
        ticketTypeMapper.updateById(ticketType);
    }
}
```

- [ ] **Step 6: Run ticket service tests**

Run: `mvn -pl java-ticket "-Dtest=SessionSeatProtectionServiceTest,TicketTypeStockRecalculationServiceTest" test`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add java/java-ticket/src/main/java/com/omni/ticket/client/OrderInternalClient.java java/java-ticket/src/main/java/com/omni/ticket/dto/SessionSeatUsageRequest.java java/java-ticket/src/main/java/com/omni/ticket/dto/SessionSeatUsageItemResponse.java java/java-ticket/src/main/java/com/omni/ticket/dto/SessionSeatUsageResponse.java java/java-ticket/src/main/java/com/omni/ticket/service/SessionSeatProtectionService.java java/java-ticket/src/main/java/com/omni/ticket/service/TicketTypeStockRecalculationService.java java/java-ticket/src/test/java/com/omni/ticket/service/SessionSeatProtectionServiceTest.java java/java-ticket/src/test/java/com/omni/ticket/service/TicketTypeStockRecalculationServiceTest.java
git commit -m "feat: protect ticket seats with order usage"
```

---

### Task 4: Guard Ticket Type Delete and Binding Changes

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SessionSeatLayoutService.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/SessionSeatLayoutServiceTest.java`

- [ ] **Step 1: Write failing delete protected ticket type test**

In `AdminControllerTest`, add test that `deleteTicketType(...)` returns 400 when `SessionSeatProtectionService` reports protected seats for that ticket type. If controller injection becomes too large, move ticket type operations to a new `TicketTypeAdminService` in this task and test that service instead.

Expected assertion:

```java
assertEquals(400, result.getCode());
assertEquals("该票档已有购票订单，请先完成退款后再删除。", result.getMessage());
verify(ticketTypeMapper, never()).deleteById(any());
```

- [ ] **Step 2: Run test and verify failure**

Run: `mvn -pl java-ticket "-Dtest=AdminControllerTest#deleteTicketTypeRejectsProtectedSeats" test`

Expected: FAIL because delete currently calls `ticketTypeMapper.deleteById(id)` directly.

- [ ] **Step 3: Implement delete guard**

Before deleting ticket type:

```java
boolean hasProtectedSeat = sessionSeatMapper.selectList(new LambdaQueryWrapper<SessionSeat>()
        .eq(SessionSeat::getSessionId, tt.getSessionId())
        .eq(SessionSeat::getTicketTypeId, tt.getId()))
        .stream()
        .anyMatch(seat -> protectedSeatIds.contains(seat.getId()));
if (hasProtectedSeat) {
    return Result.fail(400, "该票档已有购票订单，请先完成退款后再删除。");
}
```

For unprotected seats, delete or detach unsold seats for that ticket type, then delete ticket type and call `stockRecalculationService.recalculateForSession(session.getId())`.

- [ ] **Step 4: Add ticket binding endpoint**

Add to `AdminController`:

```java
@PutMapping("/sessions/{sessionId}/ticket-bindings")
public Result<Void> updateTicketBindings(@PathVariable Long sessionId,
                                         @RequestBody TicketBindingUpdateRequest request) {
    sessionSeatLayoutService.updateTicketBindings(request.getUserId(), sessionId, request.getBindings());
    return Result.success();
}
```

Create DTOs if needed:

```java
public class TicketBindingUpdateRequest {
    private Long userId;
    private List<TicketBlockBinding> bindings;
}
public class TicketBlockBinding {
    private Long ticketTypeId;
    private List<String> blockKeys;
}
```

- [ ] **Step 5: Write binding protected-seat test**

In `SessionSeatLayoutServiceTest`, create test where block `area-1` contains protected seat and request tries to bind it to another ticket type. Expected: `BusinessException` with message `该座位区域已有购票订单，请先完成退款后再调整或删除。`

- [ ] **Step 6: Implement binding guard**

In `SessionSeatLayoutService.updateTicketBindings(...)`:

- Resolve block keys to `seat_block` for owner `session`.
- Resolve seats under those blocks.
- For any seat whose id is protected and whose `ticketTypeId` would change, throw BusinessException.
- For unprotected seats, update `ticket_type_id` to target ticket type.
- Recalculate stock for session.

- [ ] **Step 7: Run tests**

Run: `mvn -pl java-ticket "-Dtest=AdminControllerTest,SessionSeatLayoutServiceTest" test`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java java/java-ticket/src/main/java/com/omni/ticket/service/SessionSeatLayoutService.java java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java java/java-ticket/src/test/java/com/omni/ticket/service/SessionSeatLayoutServiceTest.java
git commit -m "feat: guard ticket bindings with protected seats"
```

---

### Task 5: Reconcile Session SeatCraft Saves Safely

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SessionSeatLayoutService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SessionBlockTicketStockService.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/SessionSeatLayoutServiceTest.java`

- [ ] **Step 1: Write failing test for deleting unsold block updates stock**

Add test in `SessionSeatLayoutServiceTest`:

- Existing layout has two blocks for one ticket type.
- Existing `session_seat` has 2 seats in block A and 2 seats in block B, all `status=1`.
- Save request removes block B.
- Expected: seats in block B are disabled or deleted; stock recalculation is called; no exception.

- [ ] **Step 2: Write failing test for deleting protected block rejects**

Add test:

- Existing block B has one seat id `99`, `status=3`.
- Save request removes block B.
- Expected `BusinessException` message `该座位区域已有购票订单，请先完成退款后再调整或删除。`

- [ ] **Step 3: Run tests and verify failure**

Run: `mvn -pl java-ticket "-Dtest=SessionSeatLayoutServiceTest" test`

Expected: FAIL because current `updateLayout(...)` disables sections and replaces block layout without protected-seat reconciliation.

- [ ] **Step 4: Implement safe reconciliation**

In `SessionSeatLayoutService.updateLayout(...)`, before disabling old sections/block layout:

```java
Set<Long> protectedIds = seatProtectionService.findProtectedSeatIds(sessionId);
List<SessionSeat> existingSeats = sessionSeatMapper.selectList(new LambdaQueryWrapper<SessionSeat>()
        .eq(SessionSeat::getSessionId, sessionId));
Set<String> targetBlockKeys = request.getBlockLayout() == null ? Collections.emptySet() : request.getBlockLayout().getBlocks().stream()
        .map(SeatCraftBlockDtos.BlockRequest::getBlockKey)
        .collect(Collectors.toSet());
for (SessionSeat seat : existingSeats) {
    if (protectedIds.contains(seat.getId()) && seat.getTicketGroupKey() != null && !targetBlockKeys.contains(seat.getTicketGroupKey())) {
        throw new BusinessException(400, "该座位区域已有购票订单，请先完成退款后再调整或删除。");
    }
}
```

After `blockLayoutService.replaceLayout(...)`, generate missing unsold seats for new blocks through `SessionBlockTicketStockService` and remove/disable only unprotected seats whose block no longer exists.

- [ ] **Step 5: Recalculate stock after save**

Call:

```java
ticketTypeStockRecalculationService.recalculateForSession(sessionId);
```

after successful layout save and seat reconciliation.

- [ ] **Step 6: Run tests**

Run: `mvn -pl java-ticket "-Dtest=SessionSeatLayoutServiceTest,TicketTypeStockRecalculationServiceTest,SessionSeatProtectionServiceTest" test`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add java/java-ticket/src/main/java/com/omni/ticket/service/SessionSeatLayoutService.java java/java-ticket/src/main/java/com/omni/ticket/service/SessionBlockTicketStockService.java java/java-ticket/src/test/java/com/omni/ticket/service/SessionSeatLayoutServiceTest.java
git commit -m "feat: reconcile session SeatCraft inventory safely"
```

---

### Task 6: Frontend Session Ticket Entry and Ticket Mode

**Files:**
- Modify: `frontend/src/app/console/sessions/page.tsx`
- Modify: `frontend/src/app/console/sessions/[id]/seat-layout/page.tsx`
- Create: `frontend/src/components/seatcraft-unified/SeatCraftTicketManagementPanel.tsx`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/types/api.ts`

- [ ] **Step 1: Change sessions ticket button to link**

In `sessions/page.tsx`, replace button:

```tsx
<button onClick={() => openTicketForm(session)} ...>票档</button>
```

with:

```tsx
<Link href={`/console/sessions/${session.id}/seat-layout?mode=tickets`} className="rounded-lg border border-[#ff1268] px-2 py-1 text-[12px] text-[#ff1268] hover:bg-[#fff0f3]">
  票档
</Link>
```

Remove obsolete inline ticket form state and handlers from the page after ticket mode is implemented.

- [ ] **Step 2: Add ticket binding API helper**

In `frontend/src/lib/api.ts`:

```ts
export async function updateSessionTicketBindings(sessionId: number, body: { userId: number; bindings: Array<{ ticketTypeId: number; blockKeys: string[] }> }) {
  return request<void>(`/api/ticket/admin/sessions/${sessionId}/ticket-bindings`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}
```

- [ ] **Step 3: Add ticket mode parsing**

In `seat-layout/page.tsx`, import `useSearchParams` and compute:

```ts
const searchParams = useSearchParams()
const mode = searchParams.get('mode')
const ticketMode = mode === 'tickets'
```

Change title text when `ticketMode` is true.

- [ ] **Step 4: Create ticket management panel component**

Create `SeatCraftTicketManagementPanel.tsx` with props:

```ts
type Props = {
  layout: SeatCraftLayoutDraft
  selectedBlockKeys: string[]
  onSelectedBlockKeysChange: (keys: string[]) => void
  onSaveBindings: (bindings: Array<{ ticketTypeId: number; blockKeys: string[] }>) => Promise<void>
}
```

Initial minimal UI:

```tsx
export function SeatCraftTicketManagementPanel({ layout, selectedBlockKeys, onSelectedBlockKeysChange, onSaveBindings }: Props) {
  return (
    <aside className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-100">
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff1268]">票档管理模式</div>
      <h3 className="mt-2 text-xl font-semibold">在座位图中管理票档</h3>
      <p className="mt-2 text-sm text-zinc-500">选择方阵、扇形或站区后创建或调整票档。已售座位会灰色锁定，不能删除或改绑。</p>
      <div className="mt-4 text-sm text-zinc-400">已选座位块：{selectedBlockKeys.length}</div>
      <button type="button" className="mt-6 w-full rounded-xl bg-[#ff1268] px-4 py-3 text-sm font-semibold text-white" onClick={() => onSaveBindings([])}>
        保存票档绑定
      </button>
    </aside>
  )
}
```

- [ ] **Step 5: Wire panel into seat layout page**

When `ticketMode`, render grid with designer/canvas and right panel. Preserve the normal save button.

- [ ] **Step 6: Run frontend typecheck**

Run: `pnpm typecheck`.

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/console/sessions/page.tsx frontend/src/app/console/sessions/[id]/seat-layout/page.tsx frontend/src/components/seatcraft-unified/SeatCraftTicketManagementPanel.tsx frontend/src/lib/api.ts frontend/src/types/api.ts
git commit -m "feat: route ticket management to SeatCraft page"
```

---

### Task 7: C端 Seat Map Visibility Behavior

**Files:**
- Modify: `frontend/src/app/activity/[id]/page.tsx`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/SeatController.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/controller/SeatControllerTest.java`

- [ ] **Step 1: Write failing SeatController hidden visibility test**

In `SeatControllerTest`, set activity visibility `hidden` for the session’s activity and assert the seat map response has no public block layout while seats remain available to backend random allocation.

Expected behavior: `response.getLayout()` may include metadata only if needed, but C端 should not receive blocks for selection in hidden mode.

- [ ] **Step 2: Run test and verify failure**

Run: `mvn -pl java-ticket "-Dtest=SeatControllerTest" test`

Expected: FAIL until controller checks activity visibility.

- [ ] **Step 3: Implement backend visibility check**

In `SeatController`, inject `SessionMapper` and `ActivityMapper`. In `getSeatMap(...)`, resolve session and activity. If `activity.seatMapVisibility` is `hidden`, return `SeatMapResponse` with ticket type and empty public selectable layout/seats, or a response with layout omitted. Keep order random allocation unchanged because it uses internal lockSeats, not this public endpoint.

- [ ] **Step 4: Update frontend activity page**

In `activity/[id]/page.tsx`, compute:

```ts
const seatMapPublished = activity.seatMapVisibility === 'published'
```

Only call `getSeatMap(...)` when `seatMapPublished` is true. If hidden, set `seatMap(null)` and allow quantity purchase with empty `seatIds`.

- [ ] **Step 5: Run tests**

Run: `mvn -pl java-ticket "-Dtest=SeatControllerTest" test`

Run: `pnpm typecheck`.

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add java/java-ticket/src/main/java/com/omni/ticket/controller/SeatController.java java/java-ticket/src/test/java/com/omni/ticket/controller/SeatControllerTest.java frontend/src/app/activity/[id]/page.tsx
git commit -m "feat: respect activity seat map visibility"
```

---

### Task 8: Seed and Migration Verification

**Files:**
- Modify: `sql/seed.sql`
- Possibly modify: `sql/production-split/manifest.json` if this repo requires listing new prod-split migrations.

- [ ] **Step 1: Update seed activities**

Set explicit visibility in `sql/seed.sql` inserts or updates:

```sql
UPDATE activity SET seat_map_visibility = 'hidden' WHERE id IN (1, 2, 3);
UPDATE activity SET seat_map_visibility = 'published' WHERE id IN (4, 5);
```

Use IDs aligned with current demo story. Keep at least one hidden and one published demo activity.

- [ ] **Step 2: Run production split SQL check**

Run: `powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1`

Expected: PASS.

- [ ] **Step 3: Verify no ticket SQL references order-owned tables**

Run: `mvn -pl java-ticket "-Dtest=SessionSeatMapperSqlTest" test`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add sql/seed.sql sql/production-split/manifest.json
git commit -m "fix: seed seat map visibility demos"
```

If `manifest.json` is unchanged, omit it from `git add`.

---

### Task 9: Full Verification

**Files:**
- No source edits expected.

- [ ] **Step 1: Run java-ticket tests**

Run: `mvn test -pl java-ticket -am` from `java`.

Expected: BUILD SUCCESS, zero failures.

- [ ] **Step 2: Run java-order tests**

Run: `mvn test -pl java-order -am` from `java`.

Expected: BUILD SUCCESS, zero failures.

- [ ] **Step 3: Run frontend typecheck**

Run: `pnpm typecheck` from `frontend`.

Expected: `tsc --noEmit` exits 0.

- [ ] **Step 4: Run boundary verification**

Run: `powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1` from repo root.

Expected: `All microservice boundary checks passed.`

- [ ] **Step 5: Run production split SQL check**

Run: `powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1` from repo root.

Expected: `PASS production split SQL safety check`.

- [ ] **Step 6: Run diff whitespace check**

Run: `git diff --check`.

Expected: no whitespace errors. LF/CRLF warnings are acceptable in this workspace.

- [ ] **Step 7: Manual runtime smoke after user restarts services**

After the user restarts services, verify:

```powershell
curl.exe -s -m 10 http://localhost:8088/api/ticket/activities/1
curl.exe -s -m 10 http://localhost:8088/api/ticket/sessions/1/ticket-types/1/seats
curl.exe --% -s -m 10 -X POST http://localhost:8088/api/order/create-with-seats -H "Content-Type: application/json" -d "{\"userId\":2004,\"sessionId\":1,\"ticketTypeId\":1,\"seatIds\":[],\"quantity\":1,\"unitPrice\":950}"
```

Expected: activity detail includes `seatMapVisibility`; hidden-mode order creation returns `code=200`.

- [ ] **Step 8: Final commit if verification-only changes occurred**

Only commit if files changed during verification:

```bash
git status --short
git add <intended-files>
git commit -m "test: verify SeatCraft ticket management"
```

---

## Self-Review Notes

- Spec coverage: activity visibility, C端 free/random purchase, order internal usage API, ticket protection, stock recalculation, route to SeatCraft ticket mode, and boundary checks are all mapped to tasks.
- Scope note: full visual ticket management panel is intentionally staged. Task 6 creates the unified route and minimal panel; Task 4/5 provide backend safety first so later UI can call safe APIs.
- Boundary note: ticket never queries `order_seat`; all order usage information goes through `OrderInternalClient`.
- Verification note: run both java-ticket and java-order tests because the change crosses service APIs.
