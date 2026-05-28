# Feign API Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract all service-to-service OpenFeign clients and their direct contract DTOs into a shared Maven module named `feign-api`.

**Architecture:** `feign-api` becomes the single Java contract module for synchronous internal HTTP APIs. It owns only Feign interfaces and DTOs that appear directly in those Feign method signatures, including nested item DTOs used by those responses. Business entities, public frontend request/response DTOs, Mapper types, and service implementation models stay in their owning service modules.

**Tech Stack:** Java 11, Maven multi-module build, Spring Boot 2.7.18, Spring Cloud OpenFeign 2021.0.8, Spring Cloud LoadBalancer, existing `java-common` `Result<T>`.

---

## Executive Decision

This project should do the `feign-api` refactor.

The Java services already use OpenFeign; the useful change is not replacing `RestTemplate`, because no active Java `RestTemplate` usage was found. The useful change is centralizing Feign contracts to stop duplicated client definitions and duplicated contract DTOs from drifting.

Do not create one broad `@EnableFeignClients(basePackages = "com.omni.feign")` scan in every service. Each application must register only the clients it consumes via `@EnableFeignClients(clients = {...})`.

---

## Contract Package Layout

Create:

```text
java/feign-api/
  pom.xml
  src/main/java/com/omni/feign/user/
    UserInternalClient.java
  src/main/java/com/omni/feign/user/dto/
    InternalUserRefResponse.java

  src/main/java/com/omni/feign/ticket/
    TicketSalesInternalClient.java
    TicketRefundReviewInternalClient.java
  src/main/java/com/omni/feign/ticket/dto/
    TicketSalesQuoteRequest.java
    TicketSalesQuoteResponse.java
    TicketSalesLockRequest.java
    TicketSalesOrderRequest.java
    TicketSalesSeatLockResponse.java
    TicketRefundReviewPermissionResponse.java

  src/main/java/com/omni/feign/order/
    OrderInternalClient.java
  src/main/java/com/omni/feign/order/dto/
    OrderInfoResponse.java
    OrderRefundOptionsResponse.java
    RefundSeatOptionResponse.java
    MarkPartialRefundedRequest.java
    PaidOrdersBySessionsRequest.java
    PaidOrderCountRequest.java
    PaidOrderCountResponse.java
    SessionSeatUsageRequest.java
    SessionSeatUsageResponse.java
    SessionSeatUsageItemResponse.java

  src/main/java/com/omni/feign/payment/
    PaymentInternalClient.java
  src/main/java/com/omni/feign/payment/dto/
    DirectRefundRequest.java
    DirectRefundResponse.java
    PaymentSyncDecisionResponse.java

  src/main/java/com/omni/feign/notification/
    NotificationInternalClient.java
  src/main/java/com/omni/feign/notification/dto/
    NotificationMessageRequest.java
    NotificationMessageResponse.java
```

Naming rule: the first package segment after `com.omni.feign` is the provider service domain, not the consumer. For example, `PaymentInternalClient` contains all internal endpoints exposed by `java-payment`, even if both order and ticket consume it.

---

## Service Registration Matrix

| Service | Depends on `feign-api` | Feign clients to register |
|---|---:|---|
| `java-user` | yes | none |
| `java-ticket` | yes | `UserInternalClient`, `OrderInternalClient`, `PaymentInternalClient`, `NotificationInternalClient` |
| `java-order` | yes | `UserInternalClient`, `TicketSalesInternalClient`, `PaymentInternalClient` |
| `java-payment` | yes | `UserInternalClient`, `OrderInternalClient`, `TicketRefundReviewInternalClient` |
| `java-notification` | yes | none |
| `java-gateway` | no | none |

`java-user` and `java-notification` need `feign-api` because they provide internal endpoints using shared DTOs, but they should not enable Feign clients unless they later become consumers.

---

## Important Compatibility Fixes

The migration should fix these contract inconsistencies instead of copying them forward:

1. `java-order` internal paid-by-sessions currently returns `Result<List<Order>>`, while consumers deserialize as `List<OrderInfoResponse>`. Change the internal endpoint to return `Result<List<OrderInfoResponse>>`.
2. `java-order` mark-paid/refunded endpoints currently return `Result<Order>`, while consumers deserialize as `OrderInfoResponse`. Change the internal endpoints to return `Result<OrderInfoResponse>`.
3. `java-order` internal order detail currently returns `OrderListItemResponse`, while payment consumes `OrderInfoResponse`. Add an adapter from `OrderListItemResponse` to `feign-api` `OrderInfoResponse`.
4. `java-notification` internal endpoint currently accepts `InternalNotificationRequest`, while ticket sends `NotificationMessageRequest`, and the client returns `Result<Object>`. Replace both with `NotificationMessageRequest` and `NotificationMessageResponse`.

These are JSON-compatible refactors, but they make the Java contract honest and easier to test.

---

## Task 1: Establish A Failing Boundary Check

**Files:**
- Create: `scripts/check-feign-api-boundaries.ps1`
- Modify: `scripts/verify-microservice-boundaries.ps1`

- [ ] **Step 1: Write the boundary script**

Create `scripts/check-feign-api-boundaries.ps1`:

```powershell
param(
    [string]$Root = (Resolve-Path "$PSScriptRoot/..").Path
)

$ErrorActionPreference = "Stop"

$javaRoot = Join-Path $Root "java"
$feignApiRoot = Join-Path $javaRoot "feign-api"

$violations = @()

Get-ChildItem -Path $javaRoot -Recurse -Filter "*.java" | ForEach-Object {
    $path = $_.FullName
    $relative = $path.Substring($Root.Length + 1)
    $content = Get-Content -Raw -LiteralPath $path

    if ($content -match "@FeignClient" -and -not $path.StartsWith($feignApiRoot)) {
        $violations += "Feign client outside feign-api: $relative"
    }
}

if ($violations.Count -gt 0) {
    $violations | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Host "Feign API boundary check passed."
```

- [ ] **Step 2: Run it and confirm it fails before the refactor**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-feign-api-boundaries.ps1
```

Expected: FAIL, listing current clients under `java-order`, `java-ticket`, and `java-payment`.

- [ ] **Step 3: Wire it into the aggregate verification script**

Modify `scripts/verify-microservice-boundaries.ps1` to invoke:

```powershell
& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "check-feign-api-boundaries.ps1")
```

Place it near the existing service-boundary checks so future PRs cannot add local Feign clients again.

---

## Task 2: Add The `feign-api` Maven Module

**Files:**
- Modify: `java/pom.xml`
- Create: `java/feign-api/pom.xml`

- [ ] **Step 1: Add module to parent POM**

Modify `java/pom.xml`:

```xml
<modules>
    <module>java-common</module>
    <module>feign-api</module>
    <module>java-gateway</module>
    <module>java-user</module>
    <module>java-ticket</module>
    <module>java-order</module>
    <module>java-payment</module>
    <module>java-notification</module>
</modules>
```

- [ ] **Step 2: Create `java/feign-api/pom.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>com.omni</groupId>
        <artifactId>omni-ticket-parent</artifactId>
        <version>1.0.0-SNAPSHOT</version>
    </parent>

    <artifactId>feign-api</artifactId>
    <packaging>jar</packaging>

    <name>feign-api</name>
    <description>Shared OpenFeign internal API contracts</description>

    <dependencies>
        <dependency>
            <groupId>com.omni</groupId>
            <artifactId>java-common</artifactId>
            <version>${project.version}</version>
        </dependency>
        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-starter-openfeign</artifactId>
        </dependency>
    </dependencies>
</project>
```

- [ ] **Step 3: Verify module compiles empty**

Run from `java/`:

```powershell
mvn test -pl feign-api -am
```

Expected: PASS.

---

## Task 3: Move Contract DTOs Into `feign-api`

**Files:**
- Create DTO files under `java/feign-api/src/main/java/com/omni/feign/**/dto/`

- [ ] **Step 1: Create user DTO**

Move the field-compatible shape from existing `InternalUserRefResponse` into:

```java
package com.omni.feign.user.dto;

public class InternalUserRefResponse {
    private Long id;
    private String phone;
    private String role;
    private Integer status;
    private Integer organizerStatus;
    private String organizerName;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public Integer getOrganizerStatus() { return organizerStatus; }
    public void setOrganizerStatus(Integer organizerStatus) { this.organizerStatus = organizerStatus; }
    public String getOrganizerName() { return organizerName; }
    public void setOrganizerName(String organizerName) { this.organizerName = organizerName; }
}
```

- [ ] **Step 2: Create ticket sales DTOs**

Copy these existing field-compatible classes into `com.omni.feign.ticket.dto`:

```text
TicketSalesQuoteRequest
TicketSalesQuoteResponse
TicketSalesLockRequest
TicketSalesOrderRequest
TicketSalesSeatLockResponse
TicketRefundReviewPermissionResponse
```

Use the current `java-order` copies for sales DTOs because they include the current consumer fields. Use the current `java-payment` or `java-ticket` copy for `TicketRefundReviewPermissionResponse`; they are equivalent.

- [ ] **Step 3: Create order DTOs**

Create `com.omni.feign.order.dto.OrderInfoResponse` as the superset needed by ticket and payment:

```java
package com.omni.feign.order.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class OrderInfoResponse {
    private Long id;
    private String orderNo;
    private Long userId;
    private Long sessionId;
    private Long ticketTypeId;
    private Integer quantity;
    private BigDecimal amount;
    private Integer status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
    private Long activityId;
    private String activityName;
    private String activityPoster;
    private String venueName;
    private LocalDateTime sessionTime;
    private String ticketName;
    private BigDecimal unitPrice;
    private String seatLabels;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getOrderNo() { return orderNo; }
    public void setOrderNo(String orderNo) { this.orderNo = orderNo; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public Long getTicketTypeId() { return ticketTypeId; }
    public void setTicketTypeId(Long ticketTypeId) { this.ticketTypeId = ticketTypeId; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
    public Long getActivityId() { return activityId; }
    public void setActivityId(Long activityId) { this.activityId = activityId; }
    public String getActivityName() { return activityName; }
    public void setActivityName(String activityName) { this.activityName = activityName; }
    public String getActivityPoster() { return activityPoster; }
    public void setActivityPoster(String activityPoster) { this.activityPoster = activityPoster; }
    public String getVenueName() { return venueName; }
    public void setVenueName(String venueName) { this.venueName = venueName; }
    public LocalDateTime getSessionTime() { return sessionTime; }
    public void setSessionTime(LocalDateTime sessionTime) { this.sessionTime = sessionTime; }
    public String getTicketName() { return ticketName; }
    public void setTicketName(String ticketName) { this.ticketName = ticketName; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public void setUnitPrice(BigDecimal unitPrice) { this.unitPrice = unitPrice; }
    public String getSeatLabels() { return seatLabels; }
    public void setSeatLabels(String seatLabels) { this.seatLabels = seatLabels; }
}
```

Copy or create these additional order contract DTOs under `com.omni.feign.order.dto`:

```text
OrderRefundOptionsResponse
RefundSeatOptionResponse
MarkPartialRefundedRequest
PaidOrdersBySessionsRequest
PaidOrderCountRequest
PaidOrderCountResponse
SessionSeatUsageRequest
SessionSeatUsageResponse
SessionSeatUsageItemResponse
```

`OrderRefundOptionsResponse` should use `List<RefundSeatOptionResponse>`.

- [ ] **Step 4: Create payment DTOs**

Copy into `com.omni.feign.payment.dto`:

```text
DirectRefundRequest
DirectRefundResponse
PaymentSyncDecisionResponse
```

- [ ] **Step 5: Create notification DTOs**

Create:

```java
package com.omni.feign.notification.dto;

public class NotificationMessageRequest {
    private Long userId;
    private Long orderId;
    private String type;
    private String content;

    public NotificationMessageRequest() {}

    public NotificationMessageRequest(Long userId, Long orderId, String type, String content) {
        this.userId = userId;
        this.orderId = orderId;
        this.type = type;
        this.content = content;
    }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
}
```

Create:

```java
package com.omni.feign.notification.dto;

import java.time.LocalDateTime;

public class NotificationMessageResponse {
    private Long id;
    private Long userId;
    private Long orderId;
    private String type;
    private String content;
    private Integer status;
    private LocalDateTime createTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
}
```

- [ ] **Step 6: Compile `feign-api`**

Run:

```powershell
cd java
mvn test -pl feign-api -am
```

Expected: PASS.

---

## Task 4: Add Shared Feign Interfaces

**Files:**
- Create client interfaces under `java/feign-api/src/main/java/com/omni/feign/**/`

- [ ] **Step 1: Create `UserInternalClient`**

```java
package com.omni.feign.user;

import com.omni.common.result.Result;
import com.omni.feign.user.dto.InternalUserRefResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;

@FeignClient(name = "java-user", contextId = "userInternalClient")
public interface UserInternalClient {
    @GetMapping("/api/user/internal/{id}")
    Result<InternalUserRefResponse> getUserRef(@PathVariable("id") Long id,
                                               @RequestHeader("X-Internal-Token") String internalToken);
}
```

- [ ] **Step 2: Create provider-oriented clients**

Create one client per provider/context:

```text
com.omni.feign.ticket.TicketSalesInternalClient
com.omni.feign.ticket.TicketRefundReviewInternalClient
com.omni.feign.order.OrderInternalClient
com.omni.feign.payment.PaymentInternalClient
com.omni.feign.notification.NotificationInternalClient
```

Every `@FeignClient` must include a unique `contextId`, for example:

```java
@FeignClient(name = "java-payment", contextId = "paymentInternalClient")
```

`PaymentInternalClient` should combine both current payment internal endpoints:

```java
@PostMapping("/api/payment/alipay/internal/sync-order/{orderId}")
Result<PaymentSyncDecisionResponse> syncOrderForCancel(
        @PathVariable("orderId") Long orderId,
        @RequestHeader("X-Internal-Token") String internalToken);

@PostMapping("/api/payment/refunds/internal/direct")
Result<DirectRefundResponse> directRefund(
        @RequestBody DirectRefundRequest request,
        @RequestHeader("X-Internal-Token") String internalToken);
```

`OrderInternalClient` should combine current order endpoints:

```text
GET  /api/order/internal/{id}
GET  /api/order/internal/{id}/refund-options
POST /api/order/internal/{id}/paid
POST /api/order/internal/{id}/refunded
POST /api/order/internal/{id}/partial-refunded
POST /api/order/internal/paid-by-sessions
POST /api/order/internal/paid-count-by-sessions
POST /api/order/internal/session-seats/usage
```

- [ ] **Step 3: Compile**

Run:

```powershell
cd java
mvn test -pl feign-api -am
```

Expected: PASS.

---

## Task 5: Add `feign-api` Dependencies To Services

**Files:**
- Modify: `java/java-user/pom.xml`
- Modify: `java/java-ticket/pom.xml`
- Modify: `java/java-order/pom.xml`
- Modify: `java/java-payment/pom.xml`
- Modify: `java/java-notification/pom.xml`

- [ ] **Step 1: Add dependency to each provider/consumer**

Add:

```xml
<dependency>
    <groupId>com.omni</groupId>
    <artifactId>feign-api</artifactId>
    <version>${project.version}</version>
</dependency>
```

Add this to `java-user`, `java-ticket`, `java-order`, `java-payment`, and `java-notification`.

- [ ] **Step 2: Keep direct OpenFeign starter only where needed**

Keep OpenFeign starter in:

```text
java-ticket
java-order
java-payment
```

Remove direct OpenFeign starter from `java-notification` if it has no Feign consumers after this refactor. Do not add OpenFeign starter to `java-user`.

- [ ] **Step 3: Compile dependency graph**

Run:

```powershell
cd java
mvn test -pl java-user,java-ticket,java-order,java-payment,java-notification -am -DskipTests
```

Expected: PASS compile.

---

## Task 6: Update Feign Client Registration

**Files:**
- Modify: `java/java-order/src/main/java/com/omni/order/OrderApplication.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/TicketApplication.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/PaymentApplication.java`
- Modify: `java/java-notification/src/main/java/com/omni/notification/NotificationApplication.java`
- Delete later: `java/java-order/src/main/java/com/omni/order/client/PaymentInternalClient.java`

- [ ] **Step 1: Update `OrderApplication`**

Add:

```java
import com.omni.feign.payment.PaymentInternalClient;
import com.omni.feign.ticket.TicketSalesInternalClient;
import com.omni.feign.user.UserInternalClient;
import org.springframework.cloud.openfeign.EnableFeignClients;
```

Annotate:

```java
@EnableFeignClients(clients = {
        UserInternalClient.class,
        TicketSalesInternalClient.class,
        PaymentInternalClient.class
})
```

- [ ] **Step 2: Update `TicketApplication`**

Replace broad `@EnableFeignClients` with:

```java
@EnableFeignClients(clients = {
        UserInternalClient.class,
        OrderInternalClient.class,
        PaymentInternalClient.class,
        NotificationInternalClient.class
})
```

using imports from `com.omni.feign.*`.

- [ ] **Step 3: Update `PaymentApplication`**

Replace broad `@EnableFeignClients` with:

```java
@EnableFeignClients(clients = {
        UserInternalClient.class,
        OrderInternalClient.class,
        TicketRefundReviewInternalClient.class
})
```

- [ ] **Step 4: Update `NotificationApplication`**

Remove `@EnableFeignClients` and its import unless notification starts consuming another service.

---

## Task 7: Migrate Provider Endpoints To Shared DTOs

**Files:**
- Modify: `java/java-user/src/main/java/com/omni/user/controller/UserController.java`
- Modify: `java/java-user/src/main/java/com/omni/user/service/UserService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/TicketSalesInternalController.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TicketSalesInternalService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/TicketRefundReviewInternalController.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TicketRefundReviewInternalService.java`
- Modify: `java/java-order/src/main/java/com/omni/order/controller/OrderController.java`
- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/controller/AlipayController.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/controller/RefundController.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/service/AlipayService.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/service/RefundService.java`
- Modify: `java/java-notification/src/main/java/com/omni/notification/controller/NotificationController.java`
- Modify: `java/java-notification/src/main/java/com/omni/notification/service/NotificationService.java`

- [ ] **Step 1: Replace provider-side imports**

For internal endpoints, replace local DTO imports with `com.omni.feign.*.dto.*`.

Do not replace public frontend DTOs such as:

```text
CreateOrderRequest
LockSeatsRequest
OrderListItemResponse
ActivityVO
LoginRequest
UserInfoResponse
ApplyRefundRequest
PagePayRequest
```

- [ ] **Step 2: Add order response adapters**

In `OrderService`, add mapping methods or a small private mapper block so internal endpoints can return `com.omni.feign.order.dto.OrderInfoResponse` instead of `Order` or `OrderListItemResponse`.

Required adapter behavior:

```text
Order -> OrderInfoResponse:
  id, orderNo, userId, sessionId, ticketTypeId, quantity, amount, status, createTime, updateTime

OrderListItemResponse -> OrderInfoResponse:
  all common identity/status fields plus activityId, activityName, poster, venue, sessionTime, ticketName, unitPrice, seatLabels
```

Update internal controller return types:

```text
getInternalOrderDetail: Result<OrderInfoResponse>
listInternalPaidOrdersBySessions: Result<List<OrderInfoResponse>>
markInternalPaid: Result<OrderInfoResponse>
markInternalRefunded: Result<OrderInfoResponse>
markInternalPartialRefunded: Result<OrderInfoResponse>
getInternalRefundOptions: Result<OrderRefundOptionsResponse>
```

The public user-facing endpoints should keep their current response types.

- [ ] **Step 3: Add notification response adapter**

Change `NotificationService.createInternalMessage` to return `NotificationMessageResponse` by mapping from the saved `Notification` entity.

Required mapping:

```text
id, userId, orderId, type, content, status, createTime
```

- [ ] **Step 4: Run targeted provider tests**

Run:

```powershell
cd java
mvn test -pl java-user,java-ticket,java-order,java-payment,java-notification -am --% -Dsurefire.failIfNoSpecifiedTests=false
```

Expected: provider modules compile and existing tests pass.

---

## Task 8: Migrate Consumers To Shared Clients And DTOs

**Files:**
- Modify all files currently importing `com.omni.order.client.*`
- Modify all files currently importing `com.omni.ticket.client.*`
- Modify all files currently importing `com.omni.payment.client.*`
- Modify files importing local copies of Feign contract DTOs

- [ ] **Step 1: Replace client imports**

Replace:

```text
com.omni.order.client.UserInternalClient -> com.omni.feign.user.UserInternalClient
com.omni.order.client.TicketSalesInternalClient -> com.omni.feign.ticket.TicketSalesInternalClient
com.omni.order.client.PaymentInternalClient -> com.omni.feign.payment.PaymentInternalClient

com.omni.ticket.client.UserInternalClient -> com.omni.feign.user.UserInternalClient
com.omni.ticket.client.OrderInternalClient -> com.omni.feign.order.OrderInternalClient
com.omni.ticket.client.PaymentInternalClient -> com.omni.feign.payment.PaymentInternalClient
com.omni.ticket.client.NotificationInternalClient -> com.omni.feign.notification.NotificationInternalClient

com.omni.payment.client.UserInternalClient -> com.omni.feign.user.UserInternalClient
com.omni.payment.client.OrderClient -> com.omni.feign.order.OrderInternalClient
com.omni.payment.client.TicketRefundReviewInternalClient -> com.omni.feign.ticket.TicketRefundReviewInternalClient
```

For `java-payment`, rename the injected field from `OrderClient` to `OrderInternalClient` only if it improves clarity. If keeping `orderClient` as the field name, only the type changes.

- [ ] **Step 2: Replace DTO imports**

Replace local Feign contract DTO imports with:

```text
com.omni.feign.user.dto.*
com.omni.feign.ticket.dto.*
com.omni.feign.order.dto.*
com.omni.feign.payment.dto.*
com.omni.feign.notification.dto.*
```

Do not update public DTO imports unless the type is directly part of an internal Feign contract.

- [ ] **Step 3: Compile all consumers**

Run:

```powershell
cd java
mvn test -pl java-ticket,java-order,java-payment -am -DskipTests
```

Expected: PASS compile.

---

## Task 9: Remove Local Feign Client Classes And Duplicated Contract DTOs

**Files to delete after imports are migrated:**

```text
java/java-order/src/main/java/com/omni/order/client/UserInternalClient.java
java/java-order/src/main/java/com/omni/order/client/TicketSalesInternalClient.java
java/java-order/src/main/java/com/omni/order/client/PaymentInternalClient.java

java/java-ticket/src/main/java/com/omni/ticket/client/UserInternalClient.java
java/java-ticket/src/main/java/com/omni/ticket/client/OrderInternalClient.java
java/java-ticket/src/main/java/com/omni/ticket/client/PaymentInternalClient.java
java/java-ticket/src/main/java/com/omni/ticket/client/NotificationInternalClient.java

java/java-payment/src/main/java/com/omni/payment/client/UserInternalClient.java
java/java-payment/src/main/java/com/omni/payment/client/OrderClient.java
java/java-payment/src/main/java/com/omni/payment/client/TicketRefundReviewInternalClient.java
```

**DTO deletion candidates after confirming zero references:**

```text
java/java-user/src/main/java/com/omni/user/dto/InternalUserRefResponse.java

java/java-order/src/main/java/com/omni/order/dto/InternalUserRefResponse.java
java/java-order/src/main/java/com/omni/order/dto/PaymentSyncDecisionResponse.java
java/java-order/src/main/java/com/omni/order/dto/TicketSalesQuoteRequest.java
java/java-order/src/main/java/com/omni/order/dto/TicketSalesQuoteResponse.java
java/java-order/src/main/java/com/omni/order/dto/TicketSalesLockRequest.java
java/java-order/src/main/java/com/omni/order/dto/TicketSalesOrderRequest.java
java/java-order/src/main/java/com/omni/order/dto/TicketSalesSeatLockResponse.java
java/java-order/src/main/java/com/omni/order/dto/MarkPartialRefundedRequest.java
java/java-order/src/main/java/com/omni/order/dto/PaidOrderCountRequest.java
java/java-order/src/main/java/com/omni/order/dto/PaidOrderCountResponse.java
java/java-order/src/main/java/com/omni/order/dto/PaidOrdersBySessionsRequest.java
java/java-order/src/main/java/com/omni/order/dto/SessionSeatUsageRequest.java
java/java-order/src/main/java/com/omni/order/dto/SessionSeatUsageResponse.java
java/java-order/src/main/java/com/omni/order/dto/SessionSeatUsageItemResponse.java

java/java-ticket/src/main/java/com/omni/ticket/dto/InternalUserRefResponse.java
java/java-ticket/src/main/java/com/omni/ticket/dto/DirectRefundRequest.java
java/java-ticket/src/main/java/com/omni/ticket/dto/DirectRefundResponse.java
java/java-ticket/src/main/java/com/omni/ticket/dto/NotificationMessageRequest.java
java/java-ticket/src/main/java/com/omni/ticket/dto/OrderInfoResponse.java
java/java-ticket/src/main/java/com/omni/ticket/dto/PaidOrderCountRequest.java
java/java-ticket/src/main/java/com/omni/ticket/dto/PaidOrderCountResponse.java
java/java-ticket/src/main/java/com/omni/ticket/dto/PaidOrdersBySessionsRequest.java
java/java-ticket/src/main/java/com/omni/ticket/dto/SessionSeatUsageRequest.java
java/java-ticket/src/main/java/com/omni/ticket/dto/SessionSeatUsageResponse.java
java/java-ticket/src/main/java/com/omni/ticket/dto/SessionSeatUsageItemResponse.java
java/java-ticket/src/main/java/com/omni/ticket/dto/TicketRefundReviewPermissionResponse.java
java/java-ticket/src/main/java/com/omni/ticket/dto/TicketSalesQuoteRequest.java
java/java-ticket/src/main/java/com/omni/ticket/dto/TicketSalesQuoteResponse.java
java/java-ticket/src/main/java/com/omni/ticket/dto/TicketSalesLockRequest.java
java/java-ticket/src/main/java/com/omni/ticket/dto/TicketSalesOrderRequest.java
java/java-ticket/src/main/java/com/omni/ticket/dto/TicketSalesSeatLockResponse.java

java/java-payment/src/main/java/com/omni/payment/dto/InternalUserRefResponse.java
java/java-payment/src/main/java/com/omni/payment/dto/DirectRefundRequest.java
java/java-payment/src/main/java/com/omni/payment/dto/DirectRefundResponse.java
java/java-payment/src/main/java/com/omni/payment/dto/PaymentSyncDecisionResponse.java
java/java-payment/src/main/java/com/omni/payment/dto/OrderInfoResponse.java
java/java-payment/src/main/java/com/omni/payment/dto/OrderRefundOptionsResponse.java
java/java-payment/src/main/java/com/omni/payment/dto/RefundSeatOptionResponse.java
java/java-payment/src/main/java/com/omni/payment/dto/MarkPartialRefundedRequest.java
java/java-payment/src/main/java/com/omni/payment/dto/TicketRefundReviewPermissionResponse.java

java/java-notification/src/main/java/com/omni/notification/dto/InternalNotificationRequest.java
```

Before deleting DTOs, run this reference check and delete only classes whose remaining references have already been migrated:

```powershell
rg -n "InternalUserRefResponse|PaymentSyncDecisionResponse|TicketSalesQuoteRequest|TicketSalesQuoteResponse|TicketSalesLockRequest|TicketSalesOrderRequest|TicketSalesSeatLockResponse|MarkPartialRefundedRequest|PaidOrderCountRequest|PaidOrderCountResponse|PaidOrdersBySessionsRequest|SessionSeatUsageRequest|SessionSeatUsageResponse|SessionSeatUsageItemResponse|DirectRefundRequest|DirectRefundResponse|NotificationMessageRequest|OrderInfoResponse|OrderRefundOptionsResponse|RefundSeatOptionResponse|TicketRefundReviewPermissionResponse|InternalNotificationRequest" java/java-*/src/main/java
```

Delete only when all remaining references point to `feign-api` or no references remain.

---

## Task 10: Update Tests And Add Contract Coverage

**Files:**
- Modify existing tests that import local Feign DTOs.
- Create: `java/feign-api/src/test/java/com/omni/feign/FeignApiContractCompileTest.java`

- [ ] **Step 1: Add a lightweight compile contract test**

Create a test that imports every shared client and DTO, proving the module exposes the expected types:

```java
package com.omni.feign;

import com.omni.feign.notification.NotificationInternalClient;
import com.omni.feign.order.OrderInternalClient;
import com.omni.feign.payment.PaymentInternalClient;
import com.omni.feign.ticket.TicketRefundReviewInternalClient;
import com.omni.feign.ticket.TicketSalesInternalClient;
import com.omni.feign.user.UserInternalClient;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class FeignApiContractCompileTest {
    @Test
    void exposesSharedFeignContracts() {
        assertThat(UserInternalClient.class).isNotNull();
        assertThat(TicketSalesInternalClient.class).isNotNull();
        assertThat(TicketRefundReviewInternalClient.class).isNotNull();
        assertThat(OrderInternalClient.class).isNotNull();
        assertThat(PaymentInternalClient.class).isNotNull();
        assertThat(NotificationInternalClient.class).isNotNull();
    }
}
```

If AssertJ is unavailable through the current test dependencies, use JUnit assertions:

```java
assertNotNull(UserInternalClient.class);
```

- [ ] **Step 2: Run targeted Java tests**

Run:

```powershell
cd java
mvn test -pl feign-api,java-user,java-ticket,java-order,java-payment,java-notification -am --% -Dsurefire.failIfNoSpecifiedTests=false
```

Expected: PASS.

---

## Task 11: Update Documentation

**Files:**
- Modify: `docs/microservices/service-boundaries.md`
- Modify: `README.md` if it documents Java module layout
- Modify: `CLAUDE.md` if it documents Java module layout or service-call rules

- [ ] **Step 1: Document the new boundary rule**

Add:

```markdown
- Service-to-service synchronous HTTP contracts live in `java/feign-api`.
- Service modules must not define local `@FeignClient` interfaces.
- `feign-api` may contain Feign method DTOs and nested item DTOs only. It must not contain entities, mappers, service implementations, or frontend-only DTOs.
- Services must explicitly register consumed Feign clients with `@EnableFeignClients(clients = {...})`.
```

- [ ] **Step 2: Document module layout**

Update the Java module tree to include:

```text
java/feign-api/  # shared OpenFeign internal API contracts
```

---

## Task 12: Final Verification

Run from repository root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-feign-api-boundaries.ps1
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
```

Run from `java/`:

```powershell
mvn test -pl feign-api,java-user,java-ticket,java-order,java-payment,java-notification -am --% -Dsurefire.failIfNoSpecifiedTests=false
```

Expected:

```text
check-feign-api-boundaries.ps1: PASS
verify-microservice-boundaries.ps1: PASS
Maven tests: BUILD SUCCESS
```

Also run:

```powershell
rg -n "@FeignClient" java
```

Expected: all matches are under `java/feign-api/src/main/java`.

---

## Risk Checklist

- `@EnableFeignClients` broad scanning can register unused clients. Use explicit `clients = {...}`.
- `java-order` currently returns entity/local DTO types from internal endpoints. Add adapters instead of leaking entities into `feign-api`.
- Do not delete public DTOs used by frontend APIs.
- Do not move persistence entities, MyBatis mappers, service classes, or SQL-facing objects into `feign-api`.
- Notification should not expose `Notification` entity through Feign; use `NotificationMessageResponse`.
- Because the workspace currently has unrelated modified files, implementation should avoid sweeping formatting or unrelated docs/code changes.

---

## Recommended Commit Slices

1. `test: add feign api boundary check`
2. `feat: add feign-api module and contracts`
3. `refactor: register shared feign clients explicitly`
4. `refactor: migrate internal providers to feign api dto`
5. `refactor: migrate feign consumers to shared contracts`
6. `refactor: remove local feign clients and duplicate dto`
7. `docs: document feign api contract boundary`

Do not commit if the worktree includes unrelated user changes unless staging is carefully limited to this refactor.
