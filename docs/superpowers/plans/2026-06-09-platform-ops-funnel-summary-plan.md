# Platform Ops Funnel Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only platform operations funnel summary so `/console` loads one aggregated operations payload instead of stitching platform metrics across multiple frontend calls.

**Architecture:** `java-user` remains the platform console aggregation boundary. It validates the current console user has `compensation.execute`, `reconcile.view`, and `audit.view`, forwards the current `Authorization` header to existing ticket/payment/grab admin APIs, combines those results with local exception/reconciliation/audit data, and returns partial errors in `errors[]` without failing the whole dashboard. The frontend replaces the current multi-call platform ops stitching with `getPlatformOpsSummary()`.

**Tech Stack:** Java Spring Boot + OpenFeign + JUnit/Mockito; Next.js/React + TypeScript `node:test`; no new database objects and no new dependencies.

---

## File Structure

- Create `java/java-user/src/main/java/com/omni/user/dto/PlatformOpsSummaryResponse.java`
  - Aggregated response DTO and nested DTOs for funnel steps, downstream errors, ticket summary, refund summary, grab summary, and local console workbench summary.
- Create `java/java-user/src/main/java/com/omni/user/client/TicketOpsSummaryClient.java`
  - Feign client for `GET /api/ticket/admin/summary`, forwarding `Authorization`.
- Create `java/java-user/src/main/java/com/omni/user/client/PaymentOpsSummaryClient.java`
  - Feign client for `GET /api/payment/refunds/admin`, forwarding `Authorization`.
- Create `java/java-user/src/main/java/com/omni/user/client/GrabOpsSummaryClient.java`
  - Feign client for `GET /api/grab/admin/ops-summary`, forwarding `Authorization`.
- Create `java/java-user/src/main/java/com/omni/user/service/PlatformOpsSummaryService.java`
  - Aggregates downstream summaries and local workbench data.
- Modify `java/java-ticket/src/main/java/com/omni/ticket/dto/AdminSummaryResponse.java`
  - Add `interestCount` and `reminderCount` so the platform funnel can show non-zero ticket interest/reminder counts.
- Modify `java/java-ticket/src/main/java/com/omni/ticket/service/AdminSummaryService.java`
  - Count `performance_subscription` records for current visible activities without exposing cross-service data ownership.
- Modify `java/java-ticket/src/test/java/com/omni/ticket/service/AdminSummaryServiceTest.java`
  - Red/green test for interest/reminder summary fields.
- Modify `java/java-user/src/main/java/com/omni/user/controller/InternalWorkbenchController.java`
  - Inject service and expose `GET /api/user/console/ops-summary`.
- Create `java/java-user/src/test/java/com/omni/user/service/PlatformOpsSummaryServiceTest.java`
  - Red/green tests for aggregation and partial downstream failure.
- Modify `java/java-user/src/test/java/com/omni/user/controller/InternalWorkbenchControllerOrganizerOpsTest.java`
  - Constructor update for new controller dependency.
- Modify `frontend/src/types/api.ts`
  - Add `PlatformOpsSummaryVO`.
- Modify `frontend/src/lib/api.ts`
  - Add `getPlatformOpsSummary()`.
- Modify `frontend/src/lib/api.test.ts`
  - Red/green test for endpoint path.
- Modify `frontend/src/app/console/page.tsx`
  - Replace platform ops multi-call block with the aggregate API and render the new funnel summary.
- Modify `task_plan.md`, `progress.md`, `findings.md`
  - Track execution and verification.

## Tasks

### Task 1: Ticket Summary Red Test

**Files:**
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/AdminSummaryServiceTest.java`

- [ ] Add assertion that admin summary includes:
  - `interestCount = ACTIVITY_WANT + WAITLIST_REMINDER`
  - `reminderCount = SALE_REMINDER + WAITLIST_REMINDER`
- [ ] Run:
  - `cd java`
  - `mvn -pl java-ticket "-Dtest=AdminSummaryServiceTest" test`
- [ ] Expected result before implementation:
  - Compile failure or assertion failure because `AdminSummaryResponse` has no `interestCount` / `reminderCount`.

### Task 2: Ticket Summary Green Implementation

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/AdminSummaryResponse.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/AdminSummaryService.java`

- [ ] Inject `PerformanceSubscriptionMapper` into `AdminSummaryService`.
- [ ] Count active activity-related subscriptions for current visible activity IDs:
  - `interestCount`: `ACTIVITY_WANT` and `WAITLIST_REMINDER`
  - `reminderCount`: `SALE_REMINDER` and `WAITLIST_REMINDER`
- [ ] Re-run:
  - `cd java`
  - `mvn -pl java-ticket "-Dtest=AdminSummaryServiceTest" test`
- [ ] Expected result after implementation: test pass.

### Task 3: User Aggregation Red Test

**Files:**
- Create: `java/java-user/src/test/java/com/omni/user/service/PlatformOpsSummaryServiceTest.java`

- [ ] Add tests:
  - `aggregatesPlatformOperationsSummaryFromDownstreamAndLocalSources`
  - `keepsDashboardUsableWhenGrabSummaryFails`
- [ ] Run:
  - `cd java`
  - `mvn -pl java-user -am "-Dtest=PlatformOpsSummaryServiceTest" "-Dsurefire.failIfNoSpecifiedTests=false" test`
- [ ] Expected result before implementation:
  - Compile failure because `PlatformOpsSummaryService` and its clients/DTO do not exist.

### Task 4: User Aggregation Green Implementation

**Files:**
- Create DTO/client/service files listed above.
- Modify `InternalWorkbenchController.java`.
- Modify `InternalWorkbenchControllerOrganizerOpsTest.java`.

- [ ] Implement `PlatformOpsSummaryResponse` with these top-level fields:
  - `generatedAt`
  - `funnelSteps`
  - `ticket`
  - `refund`
  - `grab`
  - `workbench`
  - `errors`
- [ ] Implement `PlatformOpsSummaryService.load(authorization)`:
  - Load `ticket` from `TicketOpsSummaryClient.getAdminSummary(authorization)`.
  - Load `refund` from `PaymentOpsSummaryClient.listAdminRefunds(authorization, null)`.
  - Load `grab` from `GrabOpsSummaryClient.getGrabOpsSummary(authorization)`.
  - Load local workbench data from existing `ExceptionWorkbenchService`, `ReconciliationService`, and `OperationAuditService`.
  - Convert downstream failures into `errors[]` entries with Chinese messages.
  - Build funnel steps: `interest` from ticket subscription/reminder fields when available, `order` and `paid` from ticket summary, `payment_timeout`, `refund`, `refund_abnormal`, `grab_failed`, `waitlist_paid`.
- [ ] Add `GET /api/user/console/ops-summary` in `InternalWorkbenchController`.
  - Parse user id from `Authorization`.
  - Require all three permissions: `compensation.execute`, `reconcile.view`, `audit.view`.
  - Return the aggregated response.
- [ ] Re-run backend test command.
- [ ] Expected result after implementation: test pass.

### Task 5: Frontend Red Test

**Files:**
- Modify: `frontend/src/lib/api.test.ts`

- [ ] Add `loads platform operations summary through user console aggregate endpoint`.
- [ ] Run:
  - `cd frontend`
  - `node --test --experimental-strip-types src/lib/api.test.ts`
- [ ] Expected result before frontend API implementation:
  - Import or function failure for `getPlatformOpsSummary`.

### Task 6: Frontend Green Implementation

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/app/console/page.tsx`

- [ ] Add `PlatformOpsSummaryVO` matching backend response.
- [ ] Add `getPlatformOpsSummary()` returning `/api/user/console/ops-summary`.
- [ ] Update `/console` platform dashboard:
  - Use `getPlatformOpsSummary()` instead of separate platform ops calls.
  - Render “运营漏斗摘要” with the aggregated `funnelSteps`.
  - Keep existing shortcut cards for exception tasks, reconciliation and latest audit using aggregate `workbench`.
  - Show downstream `errors[]` as small Chinese warning text.
- [ ] Re-run frontend API test.
- [ ] Expected result: test pass.

### Task 7: Verification

**Commands:**
- `cd java; mvn -pl java-ticket "-Dtest=AdminSummaryServiceTest" test`
- `cd java; mvn -pl java-user -am "-Dtest=PlatformOpsSummaryServiceTest,ExceptionWorkbenchServiceTest,ReconciliationServiceTest" "-Dsurefire.failIfNoSpecifiedTests=false" test`
- `cd frontend; node --test --experimental-strip-types src/lib/api.test.ts src/lib/operation-display.test.ts`
- `cd frontend; pnpm typecheck`
- `powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1`
- `git diff --check`

**Runtime checks after services are refreshed if needed:**
- Login admin through Gateway `POST http://localhost:8088/api/user/login`.
- `GET http://localhost:8088/api/user/console/ops-summary` returns business `code=200`.
- `http://localhost:3000/console` shows “运营漏斗摘要”.

### Task 8: Progress Files

**Files:**
- Modify: `task_plan.md`
- Modify: `progress.md`
- Modify: `findings.md`

- [ ] Mark completed checklist items.
- [ ] Record commands, failures, and fixes.
- [ ] Do not commit or push.
