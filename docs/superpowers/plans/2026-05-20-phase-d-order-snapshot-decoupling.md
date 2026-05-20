# Phase D Order Snapshot Decoupling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an order-owned `order_snapshot` table and move order display reads away from ticket-owned tables.

**Architecture:** `java-ticket` remains the owner of ticket display context and returns snapshot fields through the existing internal sales quote API. `java-order` stores those fields in `order_snapshot` when creating orders, then reads order lists from `"order" + order_snapshot` only. Historical snapshots are backfilled by an idempotent migration SQL.

**Tech Stack:** Java 17, Spring Boot, Spring Cloud OpenFeign, MyBatis-Plus, PostgreSQL, JUnit 5, Mockito, Maven.

---

## Scope

This plan implements Phase D from `docs/superpowers/specs/2026-05-20-order-snapshot-decoupling-design.md`.

In scope:

- New `order_snapshot` table owned by `java-order`.
- New `OrderSnapshot` entity and `OrderSnapshotMapper`.
- Ticket quote response fields for `tourId`, `stationId`, and `seatLabels`.
- `OrderService` writes one snapshot per new order.
- `OrderMapper` list queries use `order_snapshot` instead of ticket tables.
- Boundary grep proving `java-order/src/main/java` no longer performs runtime ticket display joins.

Out of scope:

- Physical database split.
- Message queue or compensation worker.
- Frontend redesign.
- Changing order response field names.
- Committing code. Do not commit unless the user explicitly asks.

## Current Context

- Phase C changes are currently in the working tree and not committed.
- `java-order` currently has `TicketSalesInternalClient` and `TicketSalesQuoteResponse` from Phase C.
- `OrderMapper` still defines ticket-table joins in `ORDER_LIST_JOINS` and `selectOrderListItems`.
- `OrderListItemResponse` already has the display fields needed by the frontend.
- Existing verification commands that passed before Phase D:
  - `mvn test -pl java-ticket -am` -> 118 tests.
  - `mvn test -pl java-order -am` -> 22 tests.

## File Structure

Create:

- `sql/20260520_order_snapshot.sql`  
  Owns table creation and idempotent historical backfill.
- `java/java-order/src/main/java/com/omni/order/entity/OrderSnapshot.java`  
  MyBatis-Plus entity for `order_snapshot`.
- `java/java-order/src/main/java/com/omni/order/mapper/OrderSnapshotMapper.java`  
  Mapper for snapshot inserts and lookups.
- `java/java-order/src/test/java/com/omni/order/service/OrderSnapshotServiceTest.java`  
  Focused tests for snapshot writes during order creation.

Modify:

- `java/java-ticket/src/main/java/com/omni/ticket/dto/TicketSalesQuoteResponse.java`  
  Add `tourId`, `stationId`, `seatLabels`.
- `java/java-order/src/main/java/com/omni/order/dto/TicketSalesQuoteResponse.java`  
  Add matching order-side DTO fields.
- `java/java-ticket/src/main/java/com/omni/ticket/mapper/SessionSeatMapper.java`  
  Add method to fetch seat labels by IDs.
- `java/java-ticket/src/main/java/com/omni/ticket/service/TicketSalesInternalService.java`  
  Fill `tourId`, `stationId`, `seatLabels` in quote response.
- `java/java-ticket/src/test/java/com/omni/ticket/service/TicketSalesInternalServiceTest.java`  
  Add quote snapshot field tests.
- `java/java-order/src/main/java/com/omni/order/service/OrderService.java`  
  Inject snapshot mapper and write snapshots after local order insert.
- `java/java-order/src/test/java/com/omni/order/service/OrderSeatServiceTest.java`  
  Update constructors and verify snapshots do not break order creation behavior.
- `java/java-order/src/main/java/com/omni/order/mapper/OrderMapper.java`  
  Change list SQL to join `order_snapshot` instead of ticket tables.
- `java/java-order/src/test/java/com/omni/order/service/OrderListServiceTest.java`  
  Rename intent from real ticket data to snapshot data where needed.

## DeepSeek Task Split

- DeepSeek D1: SQL + `OrderSnapshot` entity + mapper.
- DeepSeek D2: Ticket quote snapshot fields and quote tests.
- DeepSeek D3: Order snapshot writes and order creation tests.
- DeepSeek D4: Order list SQL switch and tests.
- DeepSeek D5: Boundary checks and full verification.

Each task should be run and reviewed before starting the next task. Do not run two tasks in parallel because D2-D4 touch shared DTOs and `OrderService`.

## Task D1: SQL, Entity And Mapper

**Files:**
- Create: `sql/20260520_order_snapshot.sql`
- Create: `java/java-order/src/main/java/com/omni/order/entity/OrderSnapshot.java`
- Create: `java/java-order/src/main/java/com/omni/order/mapper/OrderSnapshotMapper.java`

- [ ] **Step 1: Create migration SQL**

Create `sql/20260520_order_snapshot.sql` with this complete content:

```sql
-- owner: java-order
-- Phase D: order-owned display snapshots for microservice decoupling.

CREATE TABLE IF NOT EXISTS order_snapshot (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE,
    activity_id BIGINT,
    activity_name VARCHAR(255),
    activity_poster VARCHAR(500),
    tour_id BIGINT,
    station_id BIGINT,
    session_id BIGINT,
    session_time TIMESTAMP,
    venue_name VARCHAR(255),
    ticket_type_id BIGINT,
    ticket_name VARCHAR(255),
    unit_price NUMERIC(10, 2),
    quantity INTEGER,
    seat_labels TEXT,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_snapshot_order FOREIGN KEY (order_id) REFERENCES "order"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_order_snapshot_order_id ON order_snapshot(order_id);
CREATE INDEX IF NOT EXISTS idx_order_snapshot_activity_id ON order_snapshot(activity_id);
CREATE INDEX IF NOT EXISTS idx_order_snapshot_session_id ON order_snapshot(session_id);

INSERT INTO order_snapshot (
    order_id,
    activity_id,
    activity_name,
    activity_poster,
    tour_id,
    station_id,
    session_id,
    session_time,
    venue_name,
    ticket_type_id,
    ticket_name,
    unit_price,
    quantity,
    seat_labels,
    create_time,
    update_time
)
SELECT
    o.id AS order_id,
    a.id AS activity_id,
    a.name AS activity_name,
    a.poster AS activity_poster,
    a.tour_id AS tour_id,
    a.station_id AS station_id,
    o.session_id AS session_id,
    s.start_time AS session_time,
    v.name AS venue_name,
    o.ticket_type_id AS ticket_type_id,
    tt.name AS ticket_name,
    COALESCE(tt.price, CASE WHEN o.quantity IS NOT NULL AND o.quantity > 0 THEN o.amount / o.quantity ELSE NULL END) AS unit_price,
    o.quantity AS quantity,
    seat_snapshot.seat_labels AS seat_labels,
    CURRENT_TIMESTAMP AS create_time,
    CURRENT_TIMESTAMP AS update_time
FROM "order" o
LEFT JOIN session s ON s.id = o.session_id
LEFT JOIN activity a ON a.id = s.activity_id
LEFT JOIN venue v ON v.id = s.venue_id
LEFT JOIN ticket_type tt ON tt.id = o.ticket_type_id
LEFT JOIN (
    SELECT
        os.order_id,
        STRING_AGG(COALESCE(ss.seat_label, ss.row_no::TEXT || '-' || ss.seat_no::TEXT), ', ' ORDER BY os.id) AS seat_labels
    FROM order_seat os
    LEFT JOIN session_seat ss ON ss.id = os.session_seat_id
    GROUP BY os.order_id
) seat_snapshot ON seat_snapshot.order_id = o.id
ON CONFLICT (order_id) DO UPDATE SET
    activity_id = EXCLUDED.activity_id,
    activity_name = EXCLUDED.activity_name,
    activity_poster = EXCLUDED.activity_poster,
    tour_id = EXCLUDED.tour_id,
    station_id = EXCLUDED.station_id,
    session_id = EXCLUDED.session_id,
    session_time = EXCLUDED.session_time,
    venue_name = EXCLUDED.venue_name,
    ticket_type_id = EXCLUDED.ticket_type_id,
    ticket_name = EXCLUDED.ticket_name,
    unit_price = EXCLUDED.unit_price,
    quantity = EXCLUDED.quantity,
    seat_labels = EXCLUDED.seat_labels,
    update_time = CURRENT_TIMESTAMP;
```

- [ ] **Step 2: Create `OrderSnapshot` entity**

Create `java/java-order/src/main/java/com/omni/order/entity/OrderSnapshot.java`:

```java
package com.omni.order.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@TableName("order_snapshot")
public class OrderSnapshot {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long orderId;
    private Long activityId;
    private String activityName;
    private String activityPoster;
    private Long tourId;
    private Long stationId;
    private Long sessionId;
    private LocalDateTime sessionTime;
    private String venueName;
    private Long ticketTypeId;
    private String ticketName;
    private BigDecimal unitPrice;
    private Integer quantity;
    private String seatLabels;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public Long getActivityId() { return activityId; }
    public void setActivityId(Long activityId) { this.activityId = activityId; }
    public String getActivityName() { return activityName; }
    public void setActivityName(String activityName) { this.activityName = activityName; }
    public String getActivityPoster() { return activityPoster; }
    public void setActivityPoster(String activityPoster) { this.activityPoster = activityPoster; }
    public Long getTourId() { return tourId; }
    public void setTourId(Long tourId) { this.tourId = tourId; }
    public Long getStationId() { return stationId; }
    public void setStationId(Long stationId) { this.stationId = stationId; }
    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public LocalDateTime getSessionTime() { return sessionTime; }
    public void setSessionTime(LocalDateTime sessionTime) { this.sessionTime = sessionTime; }
    public String getVenueName() { return venueName; }
    public void setVenueName(String venueName) { this.venueName = venueName; }
    public Long getTicketTypeId() { return ticketTypeId; }
    public void setTicketTypeId(Long ticketTypeId) { this.ticketTypeId = ticketTypeId; }
    public String getTicketName() { return ticketName; }
    public void setTicketName(String ticketName) { this.ticketName = ticketName; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public void setUnitPrice(BigDecimal unitPrice) { this.unitPrice = unitPrice; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public String getSeatLabels() { return seatLabels; }
    public void setSeatLabels(String seatLabels) { this.seatLabels = seatLabels; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
}
```

- [ ] **Step 3: Create `OrderSnapshotMapper`**

Create `java/java-order/src/main/java/com/omni/order/mapper/OrderSnapshotMapper.java`:

```java
package com.omni.order.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.omni.order.entity.OrderSnapshot;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface OrderSnapshotMapper extends BaseMapper<OrderSnapshot> {
}
```

- [ ] **Step 4: Compile order module**

Run from `java/`:

```powershell
mvn compile -pl java-order -am
```

Expected: `BUILD SUCCESS`.

## Task D2: Ticket Quote Snapshot Fields

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/TicketSalesQuoteResponse.java`
- Modify: `java/java-order/src/main/java/com/omni/order/dto/TicketSalesQuoteResponse.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/mapper/SessionSeatMapper.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TicketSalesInternalService.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/TicketSalesInternalServiceTest.java`

- [ ] **Step 1: Add failing quote snapshot test**

Append this test to `TicketSalesInternalServiceTest` before helper methods:

```java
@Test
void quoteReturnsTourStationAndSeatLabels() {
    TicketTypeMapper ticketTypeMapper = mock(TicketTypeMapper.class);
    SessionMapper sessionMapper = mock(SessionMapper.class);
    ActivityMapper activityMapper = mock(ActivityMapper.class);
    VenueMapper venueMapper = mock(VenueMapper.class);
    SessionSeatMapper sessionSeatMapper = mock(SessionSeatMapper.class);
    TicketSalesInternalService service = new TicketSalesInternalService(
            ticketTypeMapper, sessionMapper, activityMapper, venueMapper, sessionSeatMapper);

    TicketType ticketType = new TicketType();
    ticketType.setId(4001L);
    ticketType.setSessionId(3001L);
    ticketType.setName("看台A");
    ticketType.setPrice(new BigDecimal("380.00"));
    ticketType.setStatus(1);
    when(ticketTypeMapper.selectById(4001L)).thenReturn(ticketType);

    com.omni.ticket.entity.Session session = new com.omni.ticket.entity.Session();
    session.setId(3001L);
    session.setActivityId(2001L);
    session.setVenueId(1001L);
    session.setStartTime(LocalDateTime.of(2026, 6, 22, 19, 30));
    when(sessionMapper.selectById(3001L)).thenReturn(session);

    com.omni.ticket.entity.Activity activity = new com.omni.ticket.entity.Activity();
    activity.setId(2001L);
    activity.setName("巡演北京站");
    activity.setPoster("poster.jpg");
    activity.setTourId(9001L);
    activity.setStationId(9101L);
    when(activityMapper.selectById(2001L)).thenReturn(activity);

    com.omni.ticket.entity.Venue venue = new com.omni.ticket.entity.Venue();
    venue.setId(1001L);
    venue.setName("国家体育馆");
    when(venueMapper.selectById(1001L)).thenReturn(venue);
    when(sessionSeatMapper.selectSeatLabelsByIds(List.of(501L, 502L))).thenReturn(List.of("A-1", "A-2"));

    TicketSalesQuoteRequest request = new TicketSalesQuoteRequest();
    request.setSessionId(3001L);
    request.setTicketTypeId(4001L);
    request.setSeatIds(List.of(501L, 502L));

    TicketSalesQuoteResponse response = service.quote(request);

    assertEquals(9001L, response.getTourId());
    assertEquals(9101L, response.getStationId());
    assertEquals("A-1, A-2", response.getSeatLabels());
    assertEquals("国家体育馆", response.getVenueName());
}
```

- [ ] **Step 2: Run failing ticket test**

Run from `java/`:

```powershell
mvn test -pl java-ticket -am --% -Dtest=TicketSalesInternalServiceTest -Dsurefire.failIfNoSpecifiedTests=false
```

Expected: compilation fails because `tourId`、`stationId`、`seatLabels` and `selectSeatLabelsByIds` do not exist yet.

- [ ] **Step 3: Extend ticket quote DTO**

Add fields and accessors to `java/java-ticket/src/main/java/com/omni/ticket/dto/TicketSalesQuoteResponse.java`:

```java
private Long tourId;
private Long stationId;
private String seatLabels;

public Long getTourId() { return tourId; }
public void setTourId(Long tourId) { this.tourId = tourId; }
public Long getStationId() { return stationId; }
public void setStationId(Long stationId) { this.stationId = stationId; }
public String getSeatLabels() { return seatLabels; }
public void setSeatLabels(String seatLabels) { this.seatLabels = seatLabels; }
```

- [ ] **Step 4: Extend order-side quote DTO**

Add the same fields and accessors to `java/java-order/src/main/java/com/omni/order/dto/TicketSalesQuoteResponse.java`:

```java
private Long tourId;
private Long stationId;
private String seatLabels;

public Long getTourId() { return tourId; }
public void setTourId(Long tourId) { this.tourId = tourId; }
public Long getStationId() { return stationId; }
public void setStationId(Long stationId) { this.stationId = stationId; }
public String getSeatLabels() { return seatLabels; }
public void setSeatLabels(String seatLabels) { this.seatLabels = seatLabels; }
```

- [ ] **Step 5: Add seat-label mapper method**

Add to `java/java-ticket/src/main/java/com/omni/ticket/mapper/SessionSeatMapper.java`:

```java
@Select({"<script>",
        "SELECT COALESCE(seat_label, row_no::TEXT || '-' || seat_no::TEXT) FROM session_seat WHERE id IN",
        "<foreach collection='seatIds' item='id' open='(' separator=',' close=')'>#{id}</foreach>",
        "ORDER BY id",
        "</script>"})
List<String> selectSeatLabelsByIds(@Param("seatIds") List<Long> seatIds);
```

Also add import:

```java
import java.util.List;
```

- [ ] **Step 6: Fill quote fields in service**

Modify `fillSnapshotFields` in `TicketSalesInternalService` so the activity block includes tour/station:

```java
if (activity != null) {
    response.setActivityName(activity.getName());
    response.setActivityPoster(activity.getPoster());
    response.setTourId(activity.getTourId());
    response.setStationId(activity.getStationId());
}
```

After `fillSnapshotFields(response, request.getSessionId());` in `quote`, add:

```java
if (request.getSeatIds() != null && !request.getSeatIds().isEmpty()) {
    response.setSeatLabels(String.join(", ", sessionSeatMapper.selectSeatLabelsByIds(request.getSeatIds())));
}
```

- [ ] **Step 7: Run ticket test**

Run:

```powershell
mvn test -pl java-ticket -am --% -Dtest=TicketSalesInternalServiceTest -Dsurefire.failIfNoSpecifiedTests=false
```

Expected: `BUILD SUCCESS`.

## Task D3: New Order Snapshot Writes

**Files:**
- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java`
- Test: `java/java-order/src/test/java/com/omni/order/service/OrderSnapshotServiceTest.java`
- Modify if needed: `java/java-order/src/test/java/com/omni/order/service/OrderSeatServiceTest.java`

- [ ] **Step 1: Write snapshot creation tests**

Create `java/java-order/src/test/java/com/omni/order/service/OrderSnapshotServiceTest.java`:

```java
package com.omni.order.service;

import com.omni.common.result.Result;
import com.omni.order.client.TicketSalesInternalClient;
import com.omni.order.dto.CreateOrderRequest;
import com.omni.order.dto.LockSeatsRequest;
import com.omni.order.dto.TicketSalesLockRequest;
import com.omni.order.dto.TicketSalesQuoteRequest;
import com.omni.order.dto.TicketSalesQuoteResponse;
import com.omni.order.dto.TicketSalesSeatLockResponse;
import com.omni.order.entity.Order;
import com.omni.order.entity.OrderSnapshot;
import com.omni.order.mapper.OrderMapper;
import com.omni.order.mapper.OrderSeatMapper;
import com.omni.order.mapper.OrderSnapshotMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrderSnapshotServiceTest {

    @Test
    void createOrderWritesSnapshotFromTicketQuote() {
        OrderMapper orderMapper = mock(OrderMapper.class);
        OrderSeatMapper orderSeatMapper = mock(OrderSeatMapper.class);
        OrderSnapshotMapper snapshotMapper = mock(OrderSnapshotMapper.class);
        TicketSalesInternalClient ticketClient = mock(TicketSalesInternalClient.class);
        OrderService service = new OrderService(orderMapper, orderSeatMapper, snapshotMapper, null, ticketClient);
        when(ticketClient.quote(any(TicketSalesQuoteRequest.class), eq("test-internal-token"))).thenReturn(Result.success(quote(false)));
        when(ticketClient.lockStock(any(TicketSalesLockRequest.class), eq("test-internal-token"))).thenReturn(Result.success());

        CreateOrderRequest request = new CreateOrderRequest();
        request.setUserId(2004L);
        request.setSessionId(3001L);
        request.setTicketTypeId(4001L);
        request.setQuantity(2);

        Order order = service.createOrder(request);

        ArgumentCaptor<OrderSnapshot> captor = ArgumentCaptor.forClass(OrderSnapshot.class);
        verify(snapshotMapper).insert(captor.capture());
        OrderSnapshot snapshot = captor.getValue();
        assertEquals(order.getId(), snapshot.getOrderId());
        assertEquals(2001L, snapshot.getActivityId());
        assertEquals("巡演北京站", snapshot.getActivityName());
        assertEquals("国家体育馆", snapshot.getVenueName());
        assertEquals("看台A", snapshot.getTicketName());
        assertEquals(new BigDecimal("380.00"), snapshot.getUnitPrice());
        assertEquals(2, snapshot.getQuantity());
    }

    @Test
    void createOrderWithSeatsWritesSeatLabelsSnapshot() {
        OrderMapper orderMapper = mock(OrderMapper.class);
        OrderSeatMapper orderSeatMapper = mock(OrderSeatMapper.class);
        OrderSnapshotMapper snapshotMapper = mock(OrderSnapshotMapper.class);
        TicketSalesInternalClient ticketClient = mock(TicketSalesInternalClient.class);
        OrderService service = new OrderService(orderMapper, orderSeatMapper, snapshotMapper, null, ticketClient);
        when(ticketClient.quote(any(TicketSalesQuoteRequest.class), eq("test-internal-token"))).thenReturn(Result.success(quote(true)));
        TicketSalesSeatLockResponse lockResponse = new TicketSalesSeatLockResponse();
        lockResponse.setLockedSeatIds(List.of(501L, 502L));
        when(ticketClient.lockSeats(any(TicketSalesLockRequest.class), eq("test-internal-token"))).thenReturn(Result.success(lockResponse));

        LockSeatsRequest request = new LockSeatsRequest();
        request.setUserId(2004L);
        request.setSessionId(3001L);
        request.setTicketTypeId(4001L);
        request.setSeatIds(List.of(501L, 502L));

        service.createOrderWithSeats(request);

        ArgumentCaptor<OrderSnapshot> captor = ArgumentCaptor.forClass(OrderSnapshot.class);
        verify(snapshotMapper).insert(captor.capture());
        assertEquals("A-1, A-2", captor.getValue().getSeatLabels());
        assertEquals(2, captor.getValue().getQuantity());
    }

    private TicketSalesQuoteResponse quote(boolean withSeats) {
        TicketSalesQuoteResponse quote = new TicketSalesQuoteResponse();
        quote.setActivityId(2001L);
        quote.setActivityName("巡演北京站");
        quote.setActivityPoster("poster.jpg");
        quote.setTourId(9001L);
        quote.setStationId(9101L);
        quote.setSessionId(3001L);
        quote.setSessionTime(LocalDateTime.of(2026, 6, 22, 19, 30));
        quote.setVenueName("国家体育馆");
        quote.setTicketTypeId(4001L);
        quote.setTicketName("看台A");
        quote.setUnitPrice(new BigDecimal("380.00"));
        quote.setQuantity(withSeats ? 2 : 2);
        quote.setSeatBased(withSeats);
        quote.setSeatLabels(withSeats ? "A-1, A-2" : null);
        return quote;
    }
}
```

- [ ] **Step 2: Run failing snapshot tests**

Run from `java/`:

```powershell
mvn test -pl java-order -am --% -Dtest=OrderSnapshotServiceTest -Dsurefire.failIfNoSpecifiedTests=false
```

Expected: compilation fails because `OrderService` does not accept `OrderSnapshotMapper` and does not write snapshots yet.

- [ ] **Step 3: Inject `OrderSnapshotMapper`**

Modify `OrderService` fields and constructors.

Add import:

```java
import com.omni.order.entity.OrderSnapshot;
import com.omni.order.mapper.OrderSnapshotMapper;
```

Add field:

```java
private final OrderSnapshotMapper orderSnapshotMapper;
```

Update constructors to this shape while preserving existing compatibility constructors:

```java
public OrderService(OrderMapper orderMapper) {
    this(orderMapper, null, null, null, null, null);
}

public OrderService(OrderMapper orderMapper, OrderSeatMapper orderSeatMapper) {
    this(orderMapper, orderSeatMapper, null, null, null, null);
}

@Autowired
public OrderService(OrderMapper orderMapper,
                    OrderSeatMapper orderSeatMapper,
                    OrderSnapshotMapper orderSnapshotMapper,
                    PaymentInternalClient paymentInternalClient,
                    TicketSalesInternalClient ticketSalesInternalClient,
                    @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
    this.orderMapper = orderMapper;
    this.orderSeatMapper = orderSeatMapper;
    this.orderSnapshotMapper = orderSnapshotMapper;
    this.paymentInternalClient = paymentInternalClient;
    this.ticketSalesInternalClient = ticketSalesInternalClient;
    this.internalApiToken = internalApiToken;
}

public OrderService(OrderMapper orderMapper,
                    OrderSeatMapper orderSeatMapper,
                    OrderSnapshotMapper orderSnapshotMapper,
                    PaymentInternalClient paymentInternalClient,
                    TicketSalesInternalClient ticketSalesInternalClient) {
    this(orderMapper, orderSeatMapper, orderSnapshotMapper, paymentInternalClient, ticketSalesInternalClient, "test-internal-token");
}

public OrderService(OrderMapper orderMapper,
                    OrderSeatMapper orderSeatMapper,
                    PaymentInternalClient paymentInternalClient,
                    TicketSalesInternalClient ticketSalesInternalClient) {
    this(orderMapper, orderSeatMapper, null, paymentInternalClient, ticketSalesInternalClient, "test-internal-token");
}
```

- [ ] **Step 4: Add snapshot writer helper**

Add to `OrderService`:

```java
private void writeSnapshot(Order order, TicketSalesQuoteResponse quote) {
    if (orderSnapshotMapper == null || order == null || quote == null) {
        return;
    }
    OrderSnapshot snapshot = new OrderSnapshot();
    snapshot.setOrderId(order.getId());
    snapshot.setActivityId(quote.getActivityId());
    snapshot.setActivityName(quote.getActivityName());
    snapshot.setActivityPoster(quote.getActivityPoster());
    snapshot.setTourId(quote.getTourId());
    snapshot.setStationId(quote.getStationId());
    snapshot.setSessionId(order.getSessionId());
    snapshot.setSessionTime(quote.getSessionTime());
    snapshot.setVenueName(quote.getVenueName());
    snapshot.setTicketTypeId(order.getTicketTypeId());
    snapshot.setTicketName(quote.getTicketName());
    snapshot.setUnitPrice(quote.getUnitPrice());
    snapshot.setQuantity(order.getQuantity());
    snapshot.setSeatLabels(quote.getSeatLabels());
    LocalDateTime now = LocalDateTime.now();
    snapshot.setCreateTime(now);
    snapshot.setUpdateTime(now);
    orderSnapshotMapper.insert(snapshot);
}
```

- [ ] **Step 5: Call snapshot writer after order insert**

In `createOrder`, after `orderMapper.insert(order);`, add:

```java
writeSnapshot(order, quote);
```

In `createOrderWithSeats`, after `orderMapper.insert(order);`, add:

```java
writeSnapshot(order, quote);
```

- [ ] **Step 6: Run snapshot tests**

Run:

```powershell
mvn test -pl java-order -am --% -Dtest=OrderSnapshotServiceTest -Dsurefire.failIfNoSpecifiedTests=false
```

Expected: `BUILD SUCCESS`.

- [ ] **Step 7: Run existing order seat tests**

Run:

```powershell
mvn test -pl java-order -am --% -Dtest=OrderSeatServiceTest -Dsurefire.failIfNoSpecifiedTests=false
```

Expected: `BUILD SUCCESS`.

## Task D4: Order List SQL Switch

**Files:**
- Modify: `java/java-order/src/main/java/com/omni/order/mapper/OrderMapper.java`
- Modify: `java/java-order/src/test/java/com/omni/order/service/OrderListServiceTest.java`

- [ ] **Step 1: Replace order list constants**

Modify `OrderMapper.ORDER_LIST_COLUMNS` to:

```java
String ORDER_LIST_COLUMNS = "o.id, o.order_no AS orderNo, o.user_id AS userId, o.session_id AS sessionId, " +
        "o.ticket_type_id AS ticketTypeId, o.quantity, o.amount, o.status, o.user_hidden AS userHidden, " +
        "o.user_deleted_at AS userDeletedAt, o.user_delete_expires_at AS userDeleteExpiresAt, " +
        "o.create_time AS createTime, o.update_time AS updateTime, os.activity_id AS activityId, " +
        "os.activity_name AS activityName, os.activity_poster AS activityPoster, os.venue_name AS venueName, " +
        "os.session_time AS sessionTime, os.ticket_name AS ticketName, os.unit_price AS unitPrice ";
```

Modify `ORDER_LIST_JOINS` to:

```java
String ORDER_LIST_JOINS = "FROM \"order\" o " +
        "LEFT JOIN order_snapshot os ON os.order_id = o.id ";
```

- [ ] **Step 2: Replace legacy `selectOrderListItems` SQL**

Modify `selectOrderListItems` annotation to:

```java
@Select("SELECT " + ORDER_LIST_COLUMNS + ORDER_LIST_JOINS +
        "WHERE o.user_id = #{userId} " +
        "ORDER BY o.create_time DESC")
List<OrderListItemResponse> selectOrderListItems(Long userId);
```

- [ ] **Step 3: Update test naming**

In `OrderListServiceTest`, rename test method:

```java
void listOrderItemsReturnsSnapshotActivityTicketAndVenueData()
```

Keep the test body as-is because it already mocks `selectVisibleOrderListItems` and asserts response fields.

- [ ] **Step 4: Run order list tests**

Run:

```powershell
mvn test -pl java-order -am --% -Dtest=OrderListServiceTest -Dsurefire.failIfNoSpecifiedTests=false
```

Expected: `BUILD SUCCESS`.

## Task D5: Boundary Guard And Full Verification

**Files:**
- No production edits expected unless checks fail.

- [ ] **Step 1: Runtime boundary grep**

Run from repo root:

```powershell
Select-String -Path "java/java-order/src/main/java/**/*.java" -Pattern "JOIN activity|JOIN session|JOIN venue|JOIN ticket_type|session_seat" -SimpleMatch
```

Expected: no output.

- [ ] **Step 2: Mapper-specific grep**

Run from repo root:

```powershell
Select-String -Path "java/java-order/src/main/java/com/omni/order/mapper/*.java" -Pattern "activity|session s|venue|ticket_type|session_seat" -SimpleMatch
```

Expected: no output except allowed column names such as `sessionId` if PowerShell matches partial text. If any SQL join/table reference appears, fix it before continuing.

- [ ] **Step 3: Run java-order tests**

Run from `java/`:

```powershell
mvn test -pl java-order -am
```

Expected: `BUILD SUCCESS` and order tests pass.

- [ ] **Step 4: Run java-ticket tests**

Run from `java/`:

```powershell
mvn test -pl java-ticket -am
```

Expected: `BUILD SUCCESS` and ticket tests pass.

- [ ] **Step 5: Confirm no frontend changes**

Run from repo root:

```powershell
git diff --stat -- frontend
```

Expected: no output.

- [ ] **Step 6: Review changed files**

Run from repo root:

```powershell
git status --short
git diff --stat
```

Expected: Phase C and Phase D backend/docs/sql changes only. Do not stage or commit unless the user explicitly asks.

## Self-Review

- Spec coverage: tasks create `order_snapshot`, write new snapshots, switch order list reads, backfill historical data, and verify boundaries.
- Placeholder scan: no `TBD`, `TODO`, or missing implementation details remain.
- Type consistency: `tourId`, `stationId`, `seatLabels`, `OrderSnapshot`, and `OrderSnapshotMapper` are introduced before use.
- Scope control: no physical database split, no frontend redesign, no message queue.
