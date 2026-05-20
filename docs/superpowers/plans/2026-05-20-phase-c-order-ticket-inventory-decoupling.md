# Phase C Order Ticket Inventory Decoupling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `java-order` 不再直接读写 `ticket_type`、`session_seat`、`session`、`activity` 等票务表，改为通过 `java-ticket` internal sales API 完成票价、库存、座位锁定、售出确认和释放。

**Architecture:** 本阶段只处理订单服务到票务服务的库存/票价解耦，不做订单快照、不改前端、不拆库。`java-ticket` 新增 internal sales controller/service，继续拥有票务库存数据；`java-order` 新增 Feign client，订单创建/支付/取消/退款只调用 ticket internal API，不再注入票务 Mapper。

**Tech Stack:** Java 17, Spring Boot, Spring Cloud OpenFeign, MyBatis-Plus, JUnit 5, Mockito, Maven, PostgreSQL.

---

## Scope

本计划覆盖 Phase C：

- `java-ticket` 新增 sales internal DTO、service、controller。
- `java-ticket` 负责 quote、无座位库存锁定、选座锁定、确认售出、释放、退款恢复。
- `java-order` 新增 `TicketSalesInternalClient` 和对应 DTO。
- `java-order` 创建订单时使用 ticket quote 返回的后端可信价格。
- `java-order` 不再注入或调用 `TicketTypeMapper`、`SessionSeatMapper`。
- `java-order` 仍保留 `OrderSeat` 表作为订单拥有的座位购买明细。

本计划不覆盖：

- 订单列表快照化，仍留到 Phase D。
- 删除 `java-order` 的票务 Mapper/entity 文件，留到最终边界检查任务处理。
- 物理拆库或 schema 拆分。
- 支付服务重构。
- 前端修改。

## DeepSeek 分工建议

如果使用 DeepSeek-V4-Flash 辅助，可以按以下任务切换模型执行：

- DeepSeek Task C1：只做 `java-ticket` DTO + service 单元测试。
- DeepSeek Task C2：只做 `java-ticket` internal controller + token 测试。
- DeepSeek Task C3：只做 `java-order` Feign client + DTO + service 构造器改造测试。
- DeepSeek Task C4：只做 `createOrder/createOrderWithSeats` 改造。
- DeepSeek Task C5：只做 `markPaid/cancel/refund/expired lock release` 改造。
- DeepSeek Task C6：只做边界清理和验证。

每次切换模型前，先确认上一任务测试通过，不要让两个模型同时改同一批文件。

## Current Coupling To Remove

`java-order/src/main/java/com/omni/order/service/OrderService.java` 当前直接依赖：

- `com.omni.order.mapper.TicketTypeMapper`
- `com.omni.order.mapper.SessionSeatMapper`
- `com.omni.order.entity.TicketType`
- `com.omni.order.entity.SessionSeat`

耦合行为包括：

- `createOrder()` 直接查 `ticket_type` 获取价格并扣库存。
- `createOrderWithSeats()` 直接查 `ticket_type` 获取价格。
- `validateAndLockSeats()` 直接查/改 `session_seat`。
- `markSeatsSold()` 直接改 `session_seat` 和 `ticket_type.remain_stock`。
- `releaseLockedSeat()` 直接改 `session_seat`。
- `restoreStockForStockOnlyOrder()` 直接回补 `ticket_type.remain_stock`。
- `restoreSeatsAfterRefund()` 直接改 `session_seat` 和 `ticket_type`。
- `canResellRefundedSeats()` 直接查 `session`、`activity`、`ticket_type` 可售状态。

## Target Internal API Contract

所有接口都在 `java-ticket`：

```http
POST /api/ticket/internal/sales/quote
POST /api/ticket/internal/sales/lock-stock
POST /api/ticket/internal/sales/lock-seats
POST /api/ticket/internal/sales/confirm-sold
POST /api/ticket/internal/sales/release
POST /api/ticket/internal/sales/refund
```

所有接口必须校验 header：

```http
X-Internal-Token: <configured-token>
```

空 token 配置必须拒绝调用，不能提供默认 fallback。

## Shared DTO Shape

`java-ticket` 和 `java-order` 各自定义同名 DTO，不跨模块复用类。

### TicketSalesQuoteRequest

```java
public class TicketSalesQuoteRequest {
    private Long sessionId;
    private Long ticketTypeId;
    private List<Long> seatIds;
    private Integer quantity;
    // getters/setters
}
```

### TicketSalesQuoteResponse

```java
public class TicketSalesQuoteResponse {
    private Long sessionId;
    private Long ticketTypeId;
    private BigDecimal unitPrice;
    private String ticketName;
    private Integer quantity;
    private Boolean seatBased;
    // Phase D snapshot fields; fill when available but order does not use them yet
    private Long activityId;
    private String activityName;
    private String activityPoster;
    private String venueName;
    private LocalDateTime sessionTime;
    // getters/setters
}
```

### TicketSalesLockRequest

```java
public class TicketSalesLockRequest {
    private Long orderId;
    private Long sessionId;
    private Long ticketTypeId;
    private List<Long> seatIds;
    private Integer quantity;
    private LocalDateTime lockExpireTime;
    // getters/setters
}
```

### TicketSalesSeatLockResponse

```java
public class TicketSalesSeatLockResponse {
    private List<Long> lockedSeatIds;
    // getters/setters
}
```

### TicketSalesOrderRequest

```java
public class TicketSalesOrderRequest {
    private Long orderId;
    private Long sessionId;
    private Long ticketTypeId;
    private List<Long> seatIds;
    private Integer quantity;
    // getters/setters
}
```

## Task 1: Ticket Sales DTOs And Service Skeleton

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/TicketSalesQuoteRequest.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/TicketSalesQuoteResponse.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/TicketSalesLockRequest.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/TicketSalesSeatLockResponse.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/TicketSalesOrderRequest.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/TicketSalesInternalService.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/TicketSalesInternalServiceTest.java`

- [ ] **Step 1: Write failing quote tests**

Create `TicketSalesInternalServiceTest.java` with tests for:

```java
@Test
void quoteUsesTicketTypePriceAndRejectsUnknownTicketType() {
    TicketTypeMapper ticketTypeMapper = mock(TicketTypeMapper.class);
    SessionMapper sessionMapper = mock(SessionMapper.class);
    ActivityMapper activityMapper = mock(ActivityMapper.class);
    VenueMapper venueMapper = mock(VenueMapper.class);
    SessionSeatMapper sessionSeatMapper = mock(SessionSeatMapper.class);
    TicketSalesInternalService service = new TicketSalesInternalService(ticketTypeMapper, sessionMapper, activityMapper, venueMapper, sessionSeatMapper);

    TicketSalesQuoteRequest request = new TicketSalesQuoteRequest();
    request.setSessionId(3001L);
    request.setTicketTypeId(4001L);
    request.setQuantity(2);

    BusinessException exception = assertThrows(BusinessException.class, () -> service.quote(request));

    assertEquals("票档不存在", exception.getMessage());
}

@Test
void quoteReturnsBackendPriceAndQuantity() {
    TicketTypeMapper ticketTypeMapper = mock(TicketTypeMapper.class);
    SessionMapper sessionMapper = mock(SessionMapper.class);
    ActivityMapper activityMapper = mock(ActivityMapper.class);
    VenueMapper venueMapper = mock(VenueMapper.class);
    SessionSeatMapper sessionSeatMapper = mock(SessionSeatMapper.class);
    TicketSalesInternalService service = new TicketSalesInternalService(ticketTypeMapper, sessionMapper, activityMapper, venueMapper, sessionSeatMapper);

    TicketType ticketType = new TicketType();
    ticketType.setId(4001L);
    ticketType.setSessionId(3001L);
    ticketType.setName("看台A");
    ticketType.setPrice(new BigDecimal("380.00"));
    ticketType.setStatus(1);
    when(ticketTypeMapper.selectById(4001L)).thenReturn(ticketType);

    TicketSalesQuoteRequest request = new TicketSalesQuoteRequest();
    request.setSessionId(3001L);
    request.setTicketTypeId(4001L);
    request.setQuantity(2);

    TicketSalesQuoteResponse response = service.quote(request);

    assertEquals(new BigDecimal("380.00"), response.getUnitPrice());
    assertEquals("看台A", response.getTicketName());
    assertEquals(2, response.getQuantity());
    assertEquals(false, response.getSeatBased());
}
```

Add imports used by the tests.

- [ ] **Step 2: Run failing test**

Run from `java/`:

```powershell
mvn test -pl java-ticket -am -Dtest=TicketSalesInternalServiceTest
```

Expected: compilation fails because DTOs and service do not exist.

- [ ] **Step 3: Create DTO files**

Create the five DTO classes exactly matching the Shared DTO Shape section.

- [ ] **Step 4: Implement minimal service skeleton and quote**

Create `TicketSalesInternalService.java`:

```java
package com.omni.ticket.service;

import com.omni.common.result.ResultCode;
import com.omni.exception.BusinessException;
import com.omni.ticket.dto.TicketSalesLockRequest;
import com.omni.ticket.dto.TicketSalesOrderRequest;
import com.omni.ticket.dto.TicketSalesQuoteRequest;
import com.omni.ticket.dto.TicketSalesQuoteResponse;
import com.omni.ticket.dto.TicketSalesSeatLockResponse;
import com.omni.ticket.entity.Activity;
import com.omni.ticket.entity.Session;
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.entity.Venue;
import com.omni.ticket.mapper.ActivityMapper;
import com.omni.ticket.mapper.SessionMapper;
import com.omni.ticket.mapper.SessionSeatMapper;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.mapper.VenueMapper;
import org.springframework.stereotype.Service;

import java.util.Collections;

@Service
public class TicketSalesInternalService {
    private final TicketTypeMapper ticketTypeMapper;
    private final SessionMapper sessionMapper;
    private final ActivityMapper activityMapper;
    private final VenueMapper venueMapper;
    private final SessionSeatMapper sessionSeatMapper;

    public TicketSalesInternalService(TicketTypeMapper ticketTypeMapper,
                                      SessionMapper sessionMapper,
                                      ActivityMapper activityMapper,
                                      VenueMapper venueMapper,
                                      SessionSeatMapper sessionSeatMapper) {
        this.ticketTypeMapper = ticketTypeMapper;
        this.sessionMapper = sessionMapper;
        this.activityMapper = activityMapper;
        this.venueMapper = venueMapper;
        this.sessionSeatMapper = sessionSeatMapper;
    }

    public TicketSalesQuoteResponse quote(TicketSalesQuoteRequest request) {
        if (request == null || request.getTicketTypeId() == null || request.getSessionId() == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "票务报价参数不能为空");
        }
        int quantity = request.getSeatIds() != null && !request.getSeatIds().isEmpty()
                ? request.getSeatIds().size()
                : requirePositiveQuantity(request.getQuantity());
        TicketType ticketType = ticketTypeMapper.selectById(request.getTicketTypeId());
        if (ticketType == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "票档不存在");
        }
        if (!request.getSessionId().equals(ticketType.getSessionId())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "票档不属于当前场次");
        }
        if (!Integer.valueOf(1).equals(ticketType.getStatus())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "票档不可售");
        }

        TicketSalesQuoteResponse response = new TicketSalesQuoteResponse();
        response.setSessionId(request.getSessionId());
        response.setTicketTypeId(request.getTicketTypeId());
        response.setUnitPrice(ticketType.getPrice());
        response.setTicketName(ticketType.getName());
        response.setQuantity(quantity);
        response.setSeatBased(request.getSeatIds() != null && !request.getSeatIds().isEmpty());
        fillSnapshotFields(response, request.getSessionId());
        return response;
    }

    public void lockStock(TicketSalesLockRequest request) {
        throw new UnsupportedOperationException("lockStock not implemented yet");
    }

    public TicketSalesSeatLockResponse lockSeats(TicketSalesLockRequest request) {
        throw new UnsupportedOperationException("lockSeats not implemented yet");
    }

    public void confirmSold(TicketSalesOrderRequest request) {
        throw new UnsupportedOperationException("confirmSold not implemented yet");
    }

    public void release(TicketSalesOrderRequest request) {
        throw new UnsupportedOperationException("release not implemented yet");
    }

    public void refund(TicketSalesOrderRequest request) {
        throw new UnsupportedOperationException("refund not implemented yet");
    }

    private int requirePositiveQuantity(Integer quantity) {
        if (quantity == null || quantity <= 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "购买数量不正确");
        }
        return quantity;
    }

    private void fillSnapshotFields(TicketSalesQuoteResponse response, Long sessionId) {
        Session session = sessionMapper.selectById(sessionId);
        if (session == null) {
            return;
        }
        response.setSessionTime(session.getStartTime());
        response.setActivityId(session.getActivityId());
        Activity activity = activityMapper.selectById(session.getActivityId());
        if (activity != null) {
            response.setActivityName(activity.getName());
            response.setActivityPoster(activity.getPoster());
        }
        Venue venue = venueMapper.selectById(session.getVenueId());
        if (venue != null) {
            response.setVenueName(venue.getName());
        }
    }
}
```

- [ ] **Step 5: Run test**

Run:

```powershell
mvn test -pl java-ticket -am -Dtest=TicketSalesInternalServiceTest
```

Expected: tests pass.

## Task 2: Ticket Sales Lock And State Transitions

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/mapper/TicketTypeMapper.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/mapper/SessionSeatMapper.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TicketSalesInternalService.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/TicketSalesInternalServiceTest.java`

- [ ] **Step 1: Add mapper methods**

Modify `TicketTypeMapper.java`:

```java
@org.apache.ibatis.annotations.Update("UPDATE ticket_type SET remain_stock = remain_stock - #{quantity} " +
        "WHERE id = #{ticketTypeId} AND status = 1 AND remain_stock >= #{quantity}")
int decreaseRemainStockIfEnough(@org.apache.ibatis.annotations.Param("ticketTypeId") Long ticketTypeId,
                                @org.apache.ibatis.annotations.Param("quantity") int quantity);

@org.apache.ibatis.annotations.Update("UPDATE ticket_type SET remain_stock = remain_stock + #{quantity} WHERE id = #{ticketTypeId}")
int increaseRemainStock(@org.apache.ibatis.annotations.Param("ticketTypeId") Long ticketTypeId,
                        @org.apache.ibatis.annotations.Param("quantity") int quantity);

@org.apache.ibatis.annotations.Select("SELECT EXISTS(SELECT 1 FROM ticket_type WHERE id = #{ticketTypeId} AND status = 1)")
Boolean selectTicketTypeSellable(@org.apache.ibatis.annotations.Param("ticketTypeId") Long ticketTypeId);
```

Modify `SessionSeatMapper.java`:

```java
@org.apache.ibatis.annotations.Update("UPDATE session_seat SET status = 2, ticket_type_id = #{ticketTypeId}, " +
        "lock_expire_time = #{lockExpireTime}, update_time = CURRENT_TIMESTAMP " +
        "WHERE id = #{seatId} AND session_id = #{sessionId} AND status = 1")
int lockSeat(@org.apache.ibatis.annotations.Param("seatId") Long seatId,
             @org.apache.ibatis.annotations.Param("sessionId") Long sessionId,
             @org.apache.ibatis.annotations.Param("ticketTypeId") Long ticketTypeId,
             @org.apache.ibatis.annotations.Param("lockExpireTime") java.time.LocalDateTime lockExpireTime);

@org.apache.ibatis.annotations.Update("UPDATE session_seat SET status = 3, order_id = #{orderId}, update_time = CURRENT_TIMESTAMP " +
        "WHERE id = #{seatId} AND session_id = #{sessionId} AND status = 2")
int markSeatSold(@org.apache.ibatis.annotations.Param("seatId") Long seatId,
                 @org.apache.ibatis.annotations.Param("sessionId") Long sessionId,
                 @org.apache.ibatis.annotations.Param("orderId") Long orderId);

@org.apache.ibatis.annotations.Update("UPDATE session_seat SET status = 1, order_id = NULL, ticket_type_id = NULL, lock_expire_time = NULL, update_time = CURRENT_TIMESTAMP " +
        "WHERE id = #{seatId} AND session_id = #{sessionId} AND status = 2")
int releaseLockedSeat(@org.apache.ibatis.annotations.Param("seatId") Long seatId,
                      @org.apache.ibatis.annotations.Param("sessionId") Long sessionId);

@org.apache.ibatis.annotations.Update("UPDATE session_seat SET status = 1, order_id = NULL, ticket_type_id = NULL, lock_expire_time = NULL, update_time = CURRENT_TIMESTAMP " +
        "WHERE id = #{seatId} AND session_id = #{sessionId} AND status = 3")
int restoreSoldSeat(@org.apache.ibatis.annotations.Param("seatId") Long seatId,
                    @org.apache.ibatis.annotations.Param("sessionId") Long sessionId);

@org.apache.ibatis.annotations.Update("UPDATE session_seat SET status = 4, update_time = CURRENT_TIMESTAMP " +
        "WHERE id = #{seatId} AND session_id = #{sessionId} AND status = 3")
int markRefundedSeatUnavailable(@org.apache.ibatis.annotations.Param("seatId") Long seatId,
                                @org.apache.ibatis.annotations.Param("sessionId") Long sessionId);

@org.apache.ibatis.annotations.Select("SELECT start_time FROM session WHERE id = #{sessionId}")
java.time.LocalDateTime selectSessionStartTime(@org.apache.ibatis.annotations.Param("sessionId") Long sessionId);

@org.apache.ibatis.annotations.Select("SELECT EXISTS(" +
        "SELECT 1 FROM session s JOIN activity a ON a.id = s.activity_id " +
        "WHERE s.id = #{sessionId} AND s.status = 1 AND a.status = 1)")
Boolean selectSessionSellable(@org.apache.ibatis.annotations.Param("sessionId") Long sessionId);
```

- [ ] **Step 2: Write lock and release tests**

Add tests to `TicketSalesInternalServiceTest`:

```java
@Test
void lockStockDecreasesTicketTypeStock() {
    TicketTypeMapper ticketTypeMapper = mock(TicketTypeMapper.class);
    TicketSalesInternalService service = service(ticketTypeMapper, mock(SessionSeatMapper.class));
    when(ticketTypeMapper.decreaseRemainStockIfEnough(4001L, 2)).thenReturn(1);

    TicketSalesLockRequest request = lockRequest(null, 2);

    service.lockStock(request);

    verify(ticketTypeMapper).decreaseRemainStockIfEnough(4001L, 2);
}

@Test
void lockSeatsLocksEachSeat() {
    SessionSeatMapper sessionSeatMapper = mock(SessionSeatMapper.class);
    TicketSalesInternalService service = service(mock(TicketTypeMapper.class), sessionSeatMapper);
    when(sessionSeatMapper.lockSeat(eq(501L), eq(3001L), eq(4001L), any())).thenReturn(1);
    when(sessionSeatMapper.lockSeat(eq(502L), eq(3001L), eq(4001L), any())).thenReturn(1);

    TicketSalesSeatLockResponse response = service.lockSeats(lockRequest(List.of(501L, 502L), 2));

    assertEquals(List.of(501L, 502L), response.getLockedSeatIds());
}
```

Add helper methods:

```java
private TicketSalesInternalService service(TicketTypeMapper ticketTypeMapper, SessionSeatMapper sessionSeatMapper) {
    return new TicketSalesInternalService(ticketTypeMapper, mock(SessionMapper.class), mock(ActivityMapper.class), mock(VenueMapper.class), sessionSeatMapper);
}

private TicketSalesLockRequest lockRequest(List<Long> seatIds, Integer quantity) {
    TicketSalesLockRequest request = new TicketSalesLockRequest();
    request.setOrderId(88L);
    request.setSessionId(3001L);
    request.setTicketTypeId(4001L);
    request.setSeatIds(seatIds);
    request.setQuantity(quantity);
    request.setLockExpireTime(LocalDateTime.now().plusMinutes(15));
    return request;
}
```

- [ ] **Step 3: Implement service transitions**

Implement:

```java
public void lockStock(TicketSalesLockRequest request) {
    int quantity = requirePositiveQuantity(request.getQuantity());
    int updated = ticketTypeMapper.decreaseRemainStockIfEnough(request.getTicketTypeId(), quantity);
    if (updated != 1) {
        throw new BusinessException(ResultCode.BAD_REQUEST, "票档库存不足");
    }
}

public TicketSalesSeatLockResponse lockSeats(TicketSalesLockRequest request) {
    if (request.getSeatIds() == null || request.getSeatIds().isEmpty()) {
        throw new BusinessException(ResultCode.BAD_REQUEST, "座位不能为空");
    }
    for (Long seatId : request.getSeatIds()) {
        int updated = sessionSeatMapper.lockSeat(seatId, request.getSessionId(), request.getTicketTypeId(), request.getLockExpireTime());
        if (updated != 1) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "座位已锁定或不可售");
        }
    }
    TicketSalesSeatLockResponse response = new TicketSalesSeatLockResponse();
    response.setLockedSeatIds(request.getSeatIds());
    return response;
}

public void confirmSold(TicketSalesOrderRequest request) {
    if (request.getSeatIds() != null && !request.getSeatIds().isEmpty()) {
        for (Long seatId : request.getSeatIds()) {
            sessionSeatMapper.markSeatSold(seatId, request.getSessionId(), request.getOrderId());
        }
    }
}

public void release(TicketSalesOrderRequest request) {
    if (request.getSeatIds() != null && !request.getSeatIds().isEmpty()) {
        for (Long seatId : request.getSeatIds()) {
            sessionSeatMapper.releaseLockedSeat(seatId, request.getSessionId());
        }
    } else {
        ticketTypeMapper.increaseRemainStock(request.getTicketTypeId(), requirePositiveQuantity(request.getQuantity()));
    }
}
```

For `refund`, use the same 24-hour resale rule as old order service:

```java
public void refund(TicketSalesOrderRequest request) {
    if (request.getSeatIds() != null && !request.getSeatIds().isEmpty()) {
        boolean canResell = canResellRefundedSeats(request.getSessionId(), request.getTicketTypeId());
        int restored = 0;
        for (Long seatId : request.getSeatIds()) {
            if (canResell) {
                restored += sessionSeatMapper.restoreSoldSeat(seatId, request.getSessionId());
            } else {
                sessionSeatMapper.markRefundedSeatUnavailable(seatId, request.getSessionId());
            }
        }
        if (restored > 0) {
            ticketTypeMapper.increaseRemainStock(request.getTicketTypeId(), restored);
        }
    } else {
        ticketTypeMapper.increaseRemainStock(request.getTicketTypeId(), requirePositiveQuantity(request.getQuantity()));
    }
}

private boolean canResellRefundedSeats(Long sessionId, Long ticketTypeId) {
    LocalDateTime startTime = sessionSeatMapper.selectSessionStartTime(sessionId);
    if (startTime == null || !startTime.isAfter(LocalDateTime.now().plusHours(24))) {
        return false;
    }
    return Boolean.TRUE.equals(sessionSeatMapper.selectSessionSellable(sessionId))
            && Boolean.TRUE.equals(ticketTypeMapper.selectTicketTypeSellable(ticketTypeId));
}
```

- [ ] **Step 4: Run ticket sales tests**

Run:

```powershell
mvn test -pl java-ticket -am -Dtest=TicketSalesInternalServiceTest
```

Expected: tests pass.

## Task 3: Ticket Sales Internal Controller

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/controller/TicketSalesInternalController.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/controller/TicketSalesInternalControllerTest.java`

- [ ] **Step 1: Write controller tests**

Create controller tests for missing token and quote success:

```java
class TicketSalesInternalControllerTest {
    private final TicketSalesInternalService service = mock(TicketSalesInternalService.class);
    private final TicketSalesInternalController controller = new TicketSalesInternalController(service, "internal-token");

    @Test
    void quoteRejectsMissingToken() {
        Result<TicketSalesQuoteResponse> result = controller.quote(new TicketSalesQuoteRequest(), null);

        assertEquals(403, result.getCode());
        verifyNoInteractions(service);
    }

    @Test
    void quoteDelegatesWhenTokenMatches() {
        TicketSalesQuoteRequest request = new TicketSalesQuoteRequest();
        TicketSalesQuoteResponse response = new TicketSalesQuoteResponse();
        response.setTicketTypeId(4001L);
        when(service.quote(request)).thenReturn(response);

        Result<TicketSalesQuoteResponse> result = controller.quote(request, "internal-token");

        assertEquals(200, result.getCode());
        assertEquals(4001L, result.getData().getTicketTypeId());
    }
}
```

- [ ] **Step 2: Implement controller**

Create `TicketSalesInternalController.java`:

```java
package com.omni.ticket.controller;

import com.omni.common.result.Result;
import com.omni.ticket.dto.TicketSalesLockRequest;
import com.omni.ticket.dto.TicketSalesOrderRequest;
import com.omni.ticket.dto.TicketSalesQuoteRequest;
import com.omni.ticket.dto.TicketSalesQuoteResponse;
import com.omni.ticket.dto.TicketSalesSeatLockResponse;
import com.omni.ticket.service.TicketSalesInternalService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ticket/internal/sales")
public class TicketSalesInternalController {
    private final TicketSalesInternalService service;
    private final String internalApiToken;

    public TicketSalesInternalController(TicketSalesInternalService service,
                                         @Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken) {
        this.service = service;
        this.internalApiToken = internalApiToken;
    }

    @PostMapping("/quote")
    public Result<TicketSalesQuoteResponse> quote(@RequestBody TicketSalesQuoteRequest request,
                                                  @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        return Result.success(service.quote(request));
    }

    @PostMapping("/lock-stock")
    public Result<Void> lockStock(@RequestBody TicketSalesLockRequest request,
                                  @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        service.lockStock(request);
        return Result.success();
    }

    @PostMapping("/lock-seats")
    public Result<TicketSalesSeatLockResponse> lockSeats(@RequestBody TicketSalesLockRequest request,
                                                         @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        return Result.success(service.lockSeats(request));
    }

    @PostMapping("/confirm-sold")
    public Result<Void> confirmSold(@RequestBody TicketSalesOrderRequest request,
                                    @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        service.confirmSold(request);
        return Result.success();
    }

    @PostMapping("/release")
    public Result<Void> release(@RequestBody TicketSalesOrderRequest request,
                                @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        service.release(request);
        return Result.success();
    }

    @PostMapping("/refund")
    public Result<Void> refund(@RequestBody TicketSalesOrderRequest request,
                               @RequestHeader(value = "X-Internal-Token", required = false) String token) {
        if (!isValidInternalToken(token)) {
            return Result.fail(403, "无权限");
        }
        service.refund(request);
        return Result.success();
    }

    private boolean isValidInternalToken(String token) {
        return StringUtils.hasText(internalApiToken) && internalApiToken.equals(token);
    }
}
```

- [ ] **Step 3: Run controller tests**

Run:

```powershell
mvn test -pl java-ticket -am -Dtest=TicketSalesInternalControllerTest
```

Expected: tests pass.

## Task 4: Order Ticket Sales Client And DTOs

**Files:**
- Create same five DTOs under `java/java-order/src/main/java/com/omni/order/dto/`
- Create: `java/java-order/src/main/java/com/omni/order/client/TicketSalesInternalClient.java`
- Test: `java/java-order/src/test/java/com/omni/order/service/OrderSeatServiceTest.java`

- [ ] **Step 1: Create order-side DTOs**

Create the same five DTO classes from Shared DTO Shape under `com.omni.order.dto`.

- [ ] **Step 2: Create Feign client**

Create `TicketSalesInternalClient.java`:

```java
package com.omni.order.client;

import com.omni.common.result.Result;
import com.omni.order.dto.TicketSalesLockRequest;
import com.omni.order.dto.TicketSalesOrderRequest;
import com.omni.order.dto.TicketSalesQuoteRequest;
import com.omni.order.dto.TicketSalesQuoteResponse;
import com.omni.order.dto.TicketSalesSeatLockResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

@FeignClient(name = "java-ticket")
public interface TicketSalesInternalClient {
    @PostMapping("/api/ticket/internal/sales/quote")
    Result<TicketSalesQuoteResponse> quote(@RequestBody TicketSalesQuoteRequest request,
                                           @RequestHeader("X-Internal-Token") String internalToken);

    @PostMapping("/api/ticket/internal/sales/lock-stock")
    Result<Void> lockStock(@RequestBody TicketSalesLockRequest request,
                           @RequestHeader("X-Internal-Token") String internalToken);

    @PostMapping("/api/ticket/internal/sales/lock-seats")
    Result<TicketSalesSeatLockResponse> lockSeats(@RequestBody TicketSalesLockRequest request,
                                                  @RequestHeader("X-Internal-Token") String internalToken);

    @PostMapping("/api/ticket/internal/sales/confirm-sold")
    Result<Void> confirmSold(@RequestBody TicketSalesOrderRequest request,
                             @RequestHeader("X-Internal-Token") String internalToken);

    @PostMapping("/api/ticket/internal/sales/release")
    Result<Void> release(@RequestBody TicketSalesOrderRequest request,
                         @RequestHeader("X-Internal-Token") String internalToken);

    @PostMapping("/api/ticket/internal/sales/refund")
    Result<Void> refund(@RequestBody TicketSalesOrderRequest request,
                        @RequestHeader("X-Internal-Token") String internalToken);
}

@Configuration
@EnableFeignClients(clients = TicketSalesInternalClient.class)
class TicketSalesInternalClientConfiguration {
}
```

- [ ] **Step 3: Add failing constructor test**

Update `OrderSeatServiceTest` to instantiate `OrderService` with `TicketSalesInternalClient` instead of `SessionSeatMapper` and `TicketTypeMapper` in new tests. Existing tests will fail until service constructor is updated.

- [ ] **Step 4: Run order test and expect compile failure**

Run:

```powershell
mvn test -pl java-order -am -Dtest=OrderSeatServiceTest
```

Expected: compile failure until Task 5 updates `OrderService`.

## Task 5: Order Creation Uses Ticket Sales API

**Files:**
- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java`
- Test: `java/java-order/src/test/java/com/omni/order/service/OrderSeatServiceTest.java`

- [ ] **Step 1: Replace OrderService dependencies**

Remove imports and fields:

```java
import com.omni.order.entity.SessionSeat;
import com.omni.order.entity.TicketType;
import com.omni.order.mapper.SessionSeatMapper;
import com.omni.order.mapper.TicketTypeMapper;
```

Remove fields:

```java
private final SessionSeatMapper sessionSeatMapper;
private final TicketTypeMapper ticketTypeMapper;
```

Add field:

```java
private final TicketSalesInternalClient ticketSalesInternalClient;
```

Update constructors so Spring constructor accepts:

```java
OrderMapper orderMapper,
OrderSeatMapper orderSeatMapper,
PaymentInternalClient paymentInternalClient,
TicketSalesInternalClient ticketSalesInternalClient,
@Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken
```

- [ ] **Step 2: Add quote helper**

Add helper methods:

```java
private TicketSalesQuoteResponse quoteTickets(Long sessionId, Long ticketTypeId, List<Long> seatIds, int quantity) {
    if (ticketSalesInternalClient == null) {
        throw new BusinessException(ResultCode.INTERNAL_ERROR, "票务库存客户端未配置");
    }
    String token = requireInternalApiToken("票务库存接口令牌未配置");
    TicketSalesQuoteRequest request = new TicketSalesQuoteRequest();
    request.setSessionId(sessionId);
    request.setTicketTypeId(ticketTypeId);
    request.setSeatIds(seatIds);
    request.setQuantity(quantity);
    Result<TicketSalesQuoteResponse> result = ticketSalesInternalClient.quote(request, token);
    if (result == null || result.getCode() != ResultCode.SUCCESS.getCode() || result.getData() == null) {
        throw new BusinessException(ResultCode.BAD_REQUEST, result != null ? result.getMessage() : "票务服务无响应");
    }
    return result.getData();
}

private String requireInternalApiToken(String message) {
    if (!StringUtils.hasText(internalApiToken)) {
        throw new BusinessException(ResultCode.INTERNAL_ERROR, message);
    }
    return internalApiToken;
}
```

- [ ] **Step 3: Update `createOrder`**

Replace ticket mapper lookup and stock deduction with:

```java
TicketSalesQuoteResponse quote = quoteTickets(request.getSessionId(), request.getTicketTypeId(), null, quantity);
Order order = buildPendingOrder(request.getUserId(), request.getSessionId(), request.getTicketTypeId(), quantity, quote.getUnitPrice());
orderMapper.insert(order);
lockStock(order);
```

Add helper:

```java
private void lockStock(Order order) {
    TicketSalesLockRequest request = new TicketSalesLockRequest();
    request.setOrderId(order.getId());
    request.setSessionId(order.getSessionId());
    request.setTicketTypeId(order.getTicketTypeId());
    request.setQuantity(order.getQuantity());
    Result<Void> result = ticketSalesInternalClient.lockStock(request, requireInternalApiToken("票务库存接口令牌未配置"));
    if (result == null || result.getCode() != ResultCode.SUCCESS.getCode()) {
        throw new BusinessException(ResultCode.BAD_REQUEST, result != null ? result.getMessage() : "票务服务无响应");
    }
}
```

- [ ] **Step 4: Update `createOrderWithSeats`**

For seat-based orders:

1. Call quote.
2. Insert order.
3. Call ticket `lockSeats` with `orderId`, sessionId, ticketTypeId, seatIds, lockExpireTime.
4. Insert order_seat rows only after lockSeats succeeds.

For non-seat orders:

1. Call quote.
2. Insert order.
3. Call ticket `lockStock`.

- [ ] **Step 5: Run order tests**

Run:

```powershell
mvn test -pl java-order -am -Dtest=OrderSeatServiceTest
```

Expected: tests pass after updating mocks.

## Task 6: Order State Changes Call Ticket Sales API

**Files:**
- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java`
- Test: `java/java-order/src/test/java/com/omni/order/service/OrderSeatServiceTest.java`

- [ ] **Step 1: Replace `markSeatsSold`**

`markPaid()` should call ticket `confirmSold` after order status changes. Build `TicketSalesOrderRequest` from order and `OrderSeat` records.

```java
private void confirmTicketsSold(Order order) {
    TicketSalesOrderRequest request = buildTicketSalesOrderRequest(order);
    Result<Void> result = ticketSalesInternalClient.confirmSold(request, requireInternalApiToken("票务库存接口令牌未配置"));
    if (result == null || result.getCode() != ResultCode.SUCCESS.getCode()) {
        throw new BusinessException(ResultCode.INTERNAL_ERROR, result != null ? result.getMessage() : "票务服务无响应");
    }
}
```

- [ ] **Step 2: Replace cancel release logic**

`cancelOrder()` should call ticket `release` and update local `order_seat` statuses from LOCKED to RELEASED. It must not call `SessionSeatMapper` or `TicketTypeMapper`.

- [ ] **Step 3: Replace refund logic**

`markRefunded()` should call ticket `refund` and update local `order_seat` statuses from SOLD to REFUNDED.

- [ ] **Step 4: Replace expired lock release**

`releaseExpiredSeatLocks()` should call ticket `release` for each pending order it cancels and then mark local order seats released. It must not call `SessionSeatMapper`.

- [ ] **Step 5: Run order tests**

Run:

```powershell
mvn test -pl java-order -am
```

Expected: tests pass.

## Task 7: Remove Order Ticket Mapper Boundary Violation

**Files:**
- Delete: `java/java-order/src/main/java/com/omni/order/mapper/TicketTypeMapper.java`
- Delete: `java/java-order/src/main/java/com/omni/order/mapper/SessionSeatMapper.java`
- Delete: `java/java-order/src/main/java/com/omni/order/entity/TicketType.java`
- Delete: `java/java-order/src/main/java/com/omni/order/entity/SessionSeat.java`

- [ ] **Step 1: Boundary check**

Run from repo root:

```powershell
Select-String -Path "java/java-order/src/main/java/**/*.java" -Pattern "TicketTypeMapper|SessionSeatMapper|entity.TicketType|entity.SessionSeat|ticket_type|session_seat" -SimpleMatch
```

Expected before deletion: no production code references except files to delete.

- [ ] **Step 2: Delete obsolete order-side ticket files**

Delete the four files listed above.

- [ ] **Step 3: Compile order**

Run:

```powershell
mvn test -pl java-order -am
```

Expected: `BUILD SUCCESS`.

## Task 8: Full Verification

**Files:**
- No edits.

- [ ] **Step 1: Run ticket tests**

```powershell
mvn test -pl java-ticket -am
```

Expected: `BUILD SUCCESS`.

- [ ] **Step 2: Run order tests**

```powershell
mvn test -pl java-order -am
```

Expected: `BUILD SUCCESS`.

- [ ] **Step 3: Boundary grep**

Run from repo root:

```powershell
Select-String -Path "java/java-order/src/main/java/**/*.java" -Pattern "TicketTypeMapper|SessionSeatMapper|entity.TicketType|entity.SessionSeat" -SimpleMatch
```

Expected: no output.

- [ ] **Step 4: Confirm no frontend changes**

Run:

```powershell
git diff --stat -- frontend
```

Expected: no output.

## Self-Review

- Spec coverage: Phase C order-ticket inventory decoupling is covered.
- Scope excludes Phase D order snapshot, so order list SQL joins remain for now.
- The plan removes order service direct inventory table access while preserving order-owned `order_seat` rows.
- Internal token behavior stays explicit and rejects empty config.
- Tasks are separable enough for DeepSeek-V4-Flash: ticket DTO/service, ticket controller, order client, order creation, order state changes, boundary cleanup.
