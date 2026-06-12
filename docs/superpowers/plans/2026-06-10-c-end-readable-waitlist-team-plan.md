# C 端候补与小队可读上下文 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让候补列表和小队房间优先展示活动名、场次时间、票档名、场馆等业务上下文，避免把 `sessionId` / `ticketTypeId` 作为主信息。

**Architecture:** `java-ticket` 新增只读 internal purchase context 接口，不复用会校验可售状态的 `quote()`。`grab-service` 通过 `TicketClientService` 拉取上下文并透传到 waitlist/team 响应，失败时保留原记录不阻塞列表。前端类型与展示 helper 优先使用业务字段，缺失时用中文 ID 兜底。

**Tech Stack:** Spring Boot / MyBatis-Plus / NestJS / Next.js / Node test / Jest / Maven

---

### Task 1: Java ticket internal purchase context

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/TicketPurchaseContextRequest.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/TicketPurchaseContextResponse.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TicketSalesInternalService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/TicketSalesInternalController.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/TicketSalesInternalServiceTest.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/controller/TicketSalesInternalControllerTest.java`

- [ ] Write failing service/controller tests for a read-only context endpoint that returns snapshot fields for an unsellable ticket type.
- [ ] Run `cd java; mvn -pl java-ticket "-Dtest=TicketSalesInternalServiceTest,TicketSalesInternalControllerTest" "-Dsurefire.failIfNoSpecifiedTests=false" test` and confirm the new tests fail because DTO/methods are missing.
- [ ] Add DTOs, service method, and controller `POST /api/ticket/internal/sales/purchase-context` with `X-Internal-Token` validation.
- [ ] Re-run the same Maven command and confirm it passes.

### Task 2: Nest grab-service context enrichment

**Files:**
- Modify: `nestjs/grab-service/src/grab/ticket-client.service.ts`
- Modify: `nestjs/grab-service/src/grab/ticket-client.service.spec.ts`
- Modify: `nestjs/grab-service/src/waitlist/waitlist.types.ts`
- Modify: `nestjs/grab-service/src/waitlist/waitlist.service.ts`
- Modify: `nestjs/grab-service/src/waitlist/waitlist.module.ts`
- Modify: `nestjs/grab-service/src/waitlist/waitlist.service.spec.ts`
- Modify: `nestjs/grab-service/src/team-grab/team-grab.types.ts`
- Modify: `nestjs/grab-service/src/team-grab/team-grab.service.ts`
- Modify: `nestjs/grab-service/src/team-grab/team-grab.service.spec.ts`

- [ ] Write failing Jest tests for `getPurchaseContext()`, waitlist response enrichment, enrichment failure fallback, and team detail enrichment.
- [ ] Run `cd nestjs/grab-service; npm test -- ticket-client.service.spec.ts waitlist.service.spec.ts team-grab.service.spec.ts` and confirm the new tests fail for missing behavior.
- [ ] Implement `TicketClientService.getPurchaseContext()` and optional context enrichment in waitlist/team services.
- [ ] Re-run the same Jest command and confirm it passes.

### Task 3: Frontend readable display

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/waitlist.ts`
- Modify: `frontend/src/lib/waitlist.test.ts`
- Modify: `frontend/src/app/waitlist/page.tsx`
- Modify: `frontend/src/lib/team-grab.ts`
- Modify: `frontend/src/lib/team-grab.test.ts`
- Modify: `frontend/src/app/teams/[id]/page.tsx`

- [ ] Write failing Node tests for waitlist and team display helpers that prefer activity/session/ticket/venue context over raw IDs.
- [ ] Run `cd frontend; node --test --experimental-strip-types src/lib/waitlist.test.ts src/lib/team-grab.test.ts` and confirm the new tests fail for missing helpers.
- [ ] Add frontend optional fields, helper functions, and page rendering changes.
- [ ] Re-run the same Node test command and confirm it passes.

### Task 4: Focused verification and progress sync

**Files:**
- Modify: `progress.md`
- Optionally modify: `2026-06-06-platform-improvement-roadmap.md`

- [ ] Run Java, Nest, and frontend targeted tests from Tasks 1-3.
- [ ] Run `cd frontend; pnpm typecheck`.
- [ ] Run `git diff --check -- java/java-ticket/src/main/java/com/omni/ticket java/java-ticket/src/test/java/com/omni/ticket nestjs/grab-service/src frontend/src/app/waitlist/page.tsx frontend/src/app/teams/[id]/page.tsx frontend/src/lib/waitlist.ts frontend/src/lib/waitlist.test.ts frontend/src/lib/team-grab.ts frontend/src/lib/team-grab.test.ts frontend/src/types/api.ts docs/superpowers/plans/2026-06-10-c-end-readable-waitlist-team-plan.md`.
- [ ] Update `progress.md` with tests run, failures encountered, and final status. Do not commit or push.
