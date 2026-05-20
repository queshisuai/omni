# Phase E-F Payment Boundary And Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove remaining runtime cross-service table reads from `java-payment`, then add repeatable boundary checks so completed microservice decoupling does not regress.

**Architecture:** `java-payment` keeps owning payment/refund records, but obtains reviewer role from `java-user` internal API and organizer-session ownership from `java-ticket` internal API. `java-order` remains the owner of order state and snapshots. Boundary checks verify that services do not reintroduce direct Mapper/table dependencies across service ownership lines.

**Tech Stack:** Java 17, Spring Boot, Spring Cloud OpenFeign, MyBatis-Plus, JUnit 5, Mockito, Maven, PowerShell boundary checks.

---

## Scope

This plan continues after Phase C and Phase D.

In scope:

- Replace `java-payment` direct reads of user/ticket tables in refund review permission checks.
- Add `java-payment -> java-user` internal client for reviewer role/status.
- Add `java-payment -> java-ticket` internal client for organizer ownership of a refund order session.
- Add `java-ticket` internal endpoint to answer whether a reviewer owns a session's activity.
- Remove `UserRefMapper`, `SessionRefMapper`, `ActivityRefMapper` and corresponding ref entities from `java-payment` production code.
- Add boundary checks for `java-payment`, `java-order`, and `java-ticket`.
- Update service boundary documentation after checks pass.

Out of scope:

- Physical database split.
- Message queue/outbox.
- Frontend changes.
- Redesigning refund workflow.
- Committing code. Do not commit unless the user explicitly asks.

## Current State

- Phase A/B: `java-ticket -> java-user` direct user-table coupling removed.
- Phase C: `java-order -> java-ticket` inventory/seat coupling removed through ticket internal sales API.
- Phase D: order display joins moved to `order_snapshot`; `java-order` no longer joins ticket display tables at runtime.
- `java-payment` already calls `java-order` internal API for order detail, paid, and refunded state changes.
- Remaining high-value coupling: `RefundService` directly injects:
  - `UserRefMapper` for reviewer role.
  - `SessionRefMapper` for session -> activity.
  - `ActivityRefMapper` for activity -> organizer.

## Target Boundary

After this plan:

- `java-payment` may use only payment-owned mappers: `PaymentMapper` and `RefundRequestMapper`.
- `java-payment` must not inject or import `UserRefMapper`, `SessionRefMapper`, or `ActivityRefMapper`.
- `java-payment` must not read user/ticket tables through ref entities.
- Refund review permission flow:
  - `RefundService` loads order through `OrderClient`.
  - `RefundService` loads reviewer through `UserInternalClient`.
  - Admin reviewer can review all refunds.
  - Organizer reviewer calls `TicketRefundReviewInternalClient` to verify the order session belongs to that organizer.
- All new internal endpoints require `X-Internal-Token` and reject empty/mismatched tokens.

## DeepSeek Task Split

- DeepSeek E1: `java-payment` user internal client DTO + reviewer role replacement tests.
- DeepSeek E2: `java-ticket` refund review permission internal endpoint + token tests.
- DeepSeek E3: `java-payment` ticket review-permission client + replace session/activity mapper logic.
- DeepSeek E4: remove payment ref mappers/entities and run payment tests.
- DeepSeek F1: boundary guard checks and documentation update.

Each task must be run and reviewed before the next task. Do not run E1-E4 in parallel because they touch `RefundService` constructor and permission logic.

## File Structure

Create:

- `java/java-payment/src/main/java/com/omni/payment/client/UserInternalClient.java`
  Feign client for `java-user` internal user lookup.
- `java/java-payment/src/main/java/com/omni/payment/client/TicketRefundReviewInternalClient.java`
  Feign client for ticket-owned refund review permission checks.
- `java/java-payment/src/main/java/com/omni/payment/dto/InternalUserRefResponse.java`
  Payment-side DTO copy for user internal response.
- `java/java-payment/src/main/java/com/omni/payment/dto/RefundReviewPermissionRequest.java`
  Payment-side DTO sent to ticket service.
- `java/java-payment/src/main/java/com/omni/payment/dto/RefundReviewPermissionResponse.java`
  Payment-side DTO returned by ticket service.
- `java/java-ticket/src/main/java/com/omni/ticket/dto/RefundReviewPermissionRequest.java`
  Ticket-side DTO copy.
- `java/java-ticket/src/main/java/com/omni/ticket/dto/RefundReviewPermissionResponse.java`
  Ticket-side DTO copy.
- `java/java-ticket/src/main/java/com/omni/ticket/service/TicketRefundReviewInternalService.java`
  Ticket-owned service that checks session/activity ownership.
- `java/java-ticket/src/main/java/com/omni/ticket/controller/TicketRefundReviewInternalController.java`
  Internal controller with token validation.
- `java/java-payment/src/test/java/com/omni/payment/service/RefundServiceBoundaryTest.java`
  Focused tests for refund reviewer permission without payment ref mappers.
- `java/java-ticket/src/test/java/com/omni/ticket/controller/TicketRefundReviewInternalControllerTest.java`
  Token and permission endpoint tests.
- `java/java-ticket/src/test/java/com/omni/ticket/service/TicketRefundReviewInternalServiceTest.java`
  Ownership logic tests.
- `docs/superpowers/plans/2026-05-20-phase-e-f-payment-boundary-and-guardrails.md`
  This plan.

Modify:

- `java/java-payment/src/main/java/com/omni/payment/service/RefundService.java`
  Replace direct user/ticket ref mapper permission checks with internal clients.
- `java/java-payment/src/main/java/com/omni/payment/PaymentApplication.java`
  Ensure Feign scans the new payment clients if explicit clients are configured.
- `java/java-ticket/src/main/java/com/omni/ticket/TicketApplication.java`
  No change expected unless Feign/controller scanning requires it.
- `docs/microservices/service-boundaries.md`
  Update ownership rules and remove stale Phase C/D exceptions.

Delete after replacement:

- `java/java-payment/src/main/java/com/omni/payment/mapper/UserRefMapper.java`
- `java/java-payment/src/main/java/com/omni/payment/mapper/SessionRefMapper.java`
- `java/java-payment/src/main/java/com/omni/payment/mapper/ActivityRefMapper.java`
- `java/java-payment/src/main/java/com/omni/payment/entity/UserRef.java`
- `java/java-payment/src/main/java/com/omni/payment/entity/SessionRef.java`
- `java/java-payment/src/main/java/com/omni/payment/entity/ActivityRef.java`

## Task E1: Payment User Internal Client

**Files:**
- Create: `java/java-payment/src/main/java/com/omni/payment/client/UserInternalClient.java`
- Create: `java/java-payment/src/main/java/com/omni/payment/dto/InternalUserRefResponse.java`
- Create: `java/java-payment/src/test/java/com/omni/payment/service/RefundServiceBoundaryTest.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/service/RefundService.java`

- [ ] **Step 1: Write failing reviewer role test**

Create `RefundServiceBoundaryTest` with a focused test proving admin reviewer role is loaded through `UserInternalClient`, not `UserRefMapper`.

Use mocks for:

- `AlipayProperties`
- `OrderClient`
- `RefundRequestMapper`
- `PaymentMapper`
- `UserInternalClient`
- `TicketRefundReviewInternalClient` can be `null` for the admin test.

Expected behavior:

- `reject(refundId, adminUserId, reviewNote)` calls `userInternalClient.getUser(adminUserId, "test-internal-token")`.
- Admin reviewer can reject a pending refund.
- Test currently fails to compile because `UserInternalClient` and the new constructor do not exist.

- [ ] **Step 2: Run failing payment boundary test**

Run from `java/`:

```powershell
mvn test -pl java-payment -am --% -Dtest=RefundServiceBoundaryTest -Dsurefire.failIfNoSpecifiedTests=false
```

Expected: compilation fails because new client/DTO/constructor do not exist.

- [ ] **Step 3: Add payment-side internal user DTO**

Create `InternalUserRefResponse`:

```java
package com.omni.payment.dto;

public class InternalUserRefResponse {
    private Long id;
    private String phone;
    private String role;
    private Integer status;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
}
```

- [ ] **Step 4: Add `UserInternalClient`**

Create `UserInternalClient`:

```java
package com.omni.payment.client;

import com.omni.common.result.Result;
import com.omni.payment.dto.InternalUserRefResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;

@FeignClient(name = "java-user")
public interface UserInternalClient {
    @GetMapping("/api/user/internal/{id}")
    Result<InternalUserRefResponse> getUser(@PathVariable("id") Long id,
                                            @RequestHeader("X-Internal-Token") String internalToken);
}
```

- [ ] **Step 5: Inject user internal client in `RefundService`**

Update constructor shape while preserving a test constructor if existing tests need one.

Replace `UserRefMapper userRefMapper` field with:

```java
private final UserInternalClient userInternalClient;
```

Update `requireReviewer` to:

```java
private InternalUserRefResponse requireReviewer(Long reviewerId) {
    if (reviewerId == null) {
        throw new BusinessException(ResultCode.BAD_REQUEST, "审核人ID不能为空");
    }
    String token = requireInternalApiToken();
    Result<InternalUserRefResponse> result = userInternalClient.getUser(reviewerId, token);
    if (result == null || result.getCode() != ResultCode.SUCCESS.getCode() || result.getData() == null) {
        throw new BusinessException(ResultCode.NOT_FOUND, "审核人不存在");
    }
    InternalUserRefResponse reviewer = result.getData();
    if (!ROLE_ADMIN.equals(reviewer.getRole()) && !ROLE_ORGANIZER.equals(reviewer.getRole())) {
        throw new BusinessException(ResultCode.FORBIDDEN, "无退款审核权限");
    }
    return reviewer;
}
```

- [ ] **Step 6: Run E1 test**

Run:

```powershell
mvn test -pl java-payment -am --% -Dtest=RefundServiceBoundaryTest -Dsurefire.failIfNoSpecifiedTests=false
```

Expected: `BUILD SUCCESS` for admin reviewer role path.

## Task E2: Ticket Refund Review Permission Internal API

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/RefundReviewPermissionRequest.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/RefundReviewPermissionResponse.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/TicketRefundReviewInternalService.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/controller/TicketRefundReviewInternalController.java`
- Create: `java/java-ticket/src/test/java/com/omni/ticket/service/TicketRefundReviewInternalServiceTest.java`
- Create: `java/java-ticket/src/test/java/com/omni/ticket/controller/TicketRefundReviewInternalControllerTest.java`

- [ ] **Step 1: Write failing ownership service tests**

Tests:

- `organizerCanReviewSessionOwnedActivity()` returns allowed true when session activity organizer matches reviewer.
- `organizerCannotReviewOtherOrganizerSession()` returns allowed false.
- Missing session or activity returns false.

- [ ] **Step 2: Add DTOs**

`RefundReviewPermissionRequest`:

```java
package com.omni.ticket.dto;

public class RefundReviewPermissionRequest {
    private Long reviewerId;
    private Long sessionId;

    public Long getReviewerId() { return reviewerId; }
    public void setReviewerId(Long reviewerId) { this.reviewerId = reviewerId; }
    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
}
```

`RefundReviewPermissionResponse`:

```java
package com.omni.ticket.dto;

public class RefundReviewPermissionResponse {
    private Boolean allowed;

    public RefundReviewPermissionResponse() {}

    public RefundReviewPermissionResponse(Boolean allowed) {
        this.allowed = allowed;
    }

    public Boolean getAllowed() { return allowed; }
    public void setAllowed(Boolean allowed) { this.allowed = allowed; }
}
```

- [ ] **Step 3: Implement service**

`TicketRefundReviewInternalService` uses `SessionMapper` and `ActivityMapper` because ticket owns those tables.

Behavior:

- Reject null reviewer/session by returning `allowed=false`.
- Load session by `sessionId`.
- Load activity by `session.activityId`.
- Return true only when `activity.organizerId.equals(reviewerId)`.

- [ ] **Step 4: Add internal controller with token check**

Endpoint:

```http
POST /api/ticket/internal/refund-review/permission
X-Internal-Token: <token>
```

Controller returns 403 when token is blank or mismatched.

- [ ] **Step 5: Run ticket tests**

Run:

```powershell
mvn test -pl java-ticket -am --% -Dtest=TicketRefundReviewInternalServiceTest,TicketRefundReviewInternalControllerTest -Dsurefire.failIfNoSpecifiedTests=false
```

Expected: `BUILD SUCCESS`.

## Task E3: Payment Ticket Permission Client And RefundService Replacement

**Files:**
- Create: `java/java-payment/src/main/java/com/omni/payment/client/TicketRefundReviewInternalClient.java`
- Create: `java/java-payment/src/main/java/com/omni/payment/dto/RefundReviewPermissionRequest.java`
- Create: `java/java-payment/src/main/java/com/omni/payment/dto/RefundReviewPermissionResponse.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/service/RefundService.java`
- Modify: `java/java-payment/src/test/java/com/omni/payment/service/RefundServiceBoundaryTest.java`

- [ ] **Step 1: Add failing organizer permission test**

Extend `RefundServiceBoundaryTest`:

- Organizer reviewer is loaded from `UserInternalClient` with role `organizer`.
- Order has `sessionId`.
- `TicketRefundReviewInternalClient.checkPermission()` returns allowed true.
- `reject()` succeeds.

Add negative test:

- Ticket permission returns allowed false.
- `reject()` throws `BusinessException` with `无权审核该活动退款`.

- [ ] **Step 2: Add payment-side permission DTOs and client**

Client:

```java
package com.omni.payment.client;

import com.omni.common.result.Result;
import com.omni.payment.dto.RefundReviewPermissionRequest;
import com.omni.payment.dto.RefundReviewPermissionResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

@FeignClient(name = "java-ticket")
public interface TicketRefundReviewInternalClient {
    @PostMapping("/api/ticket/internal/refund-review/permission")
    Result<RefundReviewPermissionResponse> checkPermission(@RequestBody RefundReviewPermissionRequest request,
                                                           @RequestHeader("X-Internal-Token") String internalToken);
}
```

- [ ] **Step 3: Replace `canOrganizerReview`**

Replace direct `SessionRefMapper`/`ActivityRefMapper` reads with ticket internal client call.

Behavior:

- If order or `order.sessionId` is null, return false.
- Build `RefundReviewPermissionRequest(reviewerId, order.sessionId)`.
- Call ticket client with `requireInternalApiToken()`.
- Return true only when result success and data.allowed is true.
- Throw `BusinessException(ResultCode.INTERNAL_ERROR, "票务权限服务未配置")` if client is null outside tests.

- [ ] **Step 4: Run payment boundary tests**

Run:

```powershell
mvn test -pl java-payment -am --% -Dtest=RefundServiceBoundaryTest -Dsurefire.failIfNoSpecifiedTests=false
```

Expected: `BUILD SUCCESS`.

## Task E4: Remove Payment Ref Mappers And Full Payment Verification

**Files:**
- Delete: `java/java-payment/src/main/java/com/omni/payment/mapper/UserRefMapper.java`
- Delete: `java/java-payment/src/main/java/com/omni/payment/mapper/SessionRefMapper.java`
- Delete: `java/java-payment/src/main/java/com/omni/payment/mapper/ActivityRefMapper.java`
- Delete: `java/java-payment/src/main/java/com/omni/payment/entity/UserRef.java`
- Delete: `java/java-payment/src/main/java/com/omni/payment/entity/SessionRef.java`
- Delete: `java/java-payment/src/main/java/com/omni/payment/entity/ActivityRef.java`
- Modify if needed: `java/java-payment/src/main/java/com/omni/payment/PaymentApplication.java`

- [ ] **Step 1: Delete ref mappers/entities**

Remove the six files listed above only after E1-E3 tests pass.

- [ ] **Step 2: Compile payment module**

Run:

```powershell
mvn test -pl java-payment -am
```

Expected: `BUILD SUCCESS`.

- [ ] **Step 3: Boundary grep**

Run from repo root:

```powershell
Select-String -Path "java/java-payment/src/main/java/**/*.java" -Pattern "UserRefMapper|SessionRefMapper|ActivityRefMapper|UserRef|SessionRef|ActivityRef|FROM \"user\"|FROM session|FROM activity|JOIN session|JOIN activity" -SimpleMatch
```

Expected: no output except DTO/client names that are explicitly allowed by this plan. If output includes deleted mapper/entity imports or SQL table reads, fix before continuing.

## Task F1: Boundary Docs And Regression Checks

**Files:**
- Modify: `docs/microservices/service-boundaries.md`

- [ ] **Step 1: Update ownership docs**

Update current exceptions:

- Remove stale exceptions for order ticket inventory/display joins.
- Add payment rule: `java-payment` must call `java-user` for reviewer role and `java-ticket` for organizer ownership checks.
- Add verification commands for payment boundary.

- [ ] **Step 2: Run full verification**

Run from `java/`:

```powershell
mvn test -pl java-user -am
mvn test -pl java-ticket -am
mvn test -pl java-order -am
mvn test -pl java-payment -am
```

Run from repo root:

```powershell
Select-String -Path "java/java-ticket/src/main/java/**/*.java" -Pattern "UserRefMapper" -SimpleMatch
Select-String -Path "java/java-order/src/main/java/**/*.java" -Pattern "TicketTypeMapper|SessionSeatMapper|JOIN activity|JOIN session|JOIN venue|JOIN ticket_type|session_seat" -SimpleMatch
Select-String -Path "java/java-payment/src/main/java/**/*.java" -Pattern "UserRefMapper|SessionRefMapper|ActivityRefMapper|FROM \"user\"|FROM session|FROM activity|JOIN session|JOIN activity" -SimpleMatch
git diff --stat -- frontend
git status --short
git diff --stat
```

Expected:

- All Maven commands show `BUILD SUCCESS`.
- Boundary greps show no forbidden runtime dependency.
- `git diff --stat -- frontend` has no output.

## Post-Phase Roadmap

After Phase E-F, the code-level service boundaries are suitable for the next larger moves:

1. **Phase G: Schema Isolation Readiness**
   - Add owner comments to all migrations.
   - Inventory cross-service foreign keys.
   - Remove or replace cross-service database constraints that would block schema/database split.
   - Configure each service with service-owned schema/search path in local dev first.

2. **Phase H: Runtime Resilience**
   - Add compensation/retry for order-created-after-stock-lock failures.
   - Add idempotency keys for paid/refunded internal callbacks.
   - Add outbox-like table per service only when retry requirements become concrete.

3. **Phase I: Physical Split Trial**
   - Run services against separate PostgreSQL schemas or databases in a staging profile.
   - Prove user/ticket/order/payment flows work without shared table access.

## GPT / DeepSeek Operating Rule

For each task:

1. GPT gives exactly one DeepSeek prompt with allowed files, forbidden files, steps, and verification commands.
2. DeepSeek implements only that task and reports changed files plus command results.
3. GPT independently checks `git diff`, runs verification, and decides whether to proceed.
4. No commit is created unless the user explicitly asks.

## Self-Review

- Spec coverage: covers remaining payment direct user/ticket table reads and adds guardrails.
- Placeholder scan: no TBD/TODO placeholders.
- Scope control: does not include physical DB split, MQ/outbox, or frontend changes.
- Type consistency: payment and ticket DTO names are duplicated per service boundary rule.
