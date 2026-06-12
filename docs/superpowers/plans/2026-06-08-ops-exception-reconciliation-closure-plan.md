# 运营异常对账闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐阶段 7 第一轮运营闭环，让平台管理员能处理异常任务和日结对账差异。

**Architecture:** 复用现有 `java-user` 控制台接口、`exception_task` 与 `reconciliation_difference` 表，不新增中间件。后端新增状态动作接口并写操作审计，前端在现有 `/console/exception-tasks` 和 `/console/reconciliation` 页面增加操作按钮和中文反馈。

**Tech Stack:** Spring Boot, MyBatis-Plus, Java DTO, Next.js 16, React 19, existing `request<T>()` API wrapper.

---

### Task 1: 异常任务状态流转

**Files:**
- Modify: `java/java-user/src/test/java/com/omni/user/service/ExceptionWorkbenchServiceTest.java`
- Modify: `java/java-user/src/main/java/com/omni/user/service/ExceptionWorkbenchService.java`
- Modify: `java/java-user/src/main/java/com/omni/user/controller/InternalWorkbenchController.java`
- Create: `java/java-common/src/main/java/com/omni/common/dto/ExceptionTaskActionRequest.java`

- [ ] Write failing tests for claiming, resolving, and closing exception tasks.
- [ ] Run `mvn -pl java-user "-Dtest=ExceptionWorkbenchServiceTest" test` and verify the new tests fail because methods are missing.
- [ ] Add `claim`, `resolve`, and `close` service methods with legal transitions.
- [ ] Expose `POST /api/user/console/exception-tasks/{id}/claim`, `/resolve`, and `/close`.
- [ ] Run the same Maven test and verify it passes.

### Task 2: 对账差异处理闭环

**Files:**
- Modify: `java/java-user/src/test/java/com/omni/user/service/ReconciliationServiceTest.java`
- Modify: `java/java-user/src/main/java/com/omni/user/service/ReconciliationService.java`
- Modify: `java/java-user/src/main/java/com/omni/user/controller/InternalWorkbenchController.java`
- Create: `java/java-common/src/main/java/com/omni/common/dto/ReconciliationDifferenceActionRequest.java`

- [ ] Write failing tests for resolving and ignoring a difference.
- [ ] Run `mvn -pl java-user "-Dtest=ReconciliationServiceTest" test` and verify the new tests fail because methods are missing.
- [ ] Add service methods that update difference status to `resolved` or `ignored`.
- [ ] Recompute the owning batch status to `completed` when no `open` differences remain.
- [ ] Expose `POST /api/user/console/reconciliation/batches/{batchNo}/differences/{differenceId}/resolve` and `/ignore`.
- [ ] Run the same Maven test and verify it passes.

### Task 3: 前端操作入口

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/api.test.ts`
- Modify: `frontend/src/app/console/exception-tasks/page.tsx`
- Modify: `frontend/src/app/console/reconciliation/page.tsx`

- [ ] Add API wrappers and tests for exception task action endpoints.
- [ ] Add API wrappers and tests for reconciliation difference action endpoints.
- [ ] Add visible Chinese operation controls on both console pages.
- [ ] Use existing `globalAlert` where confirmation or result feedback is needed.
- [ ] Run `node --test --experimental-strip-types frontend/src/lib/api.test.ts`.

### Task 4: Verification

**Commands:**
- `mvn -pl java-user "-Dtest=ExceptionWorkbenchServiceTest,ReconciliationServiceTest" test`
- `cd frontend; pnpm typecheck`
- `cd frontend; node --test --experimental-strip-types src/lib/api.test.ts src/lib/operation-display.test.ts`
- `powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1`
- `git diff --check`

- [ ] Run all commands and record exact results in `progress.md`.
- [ ] Probe standard `8088` and `3000/api` endpoints after service restart if the running Java service has been refreshed.
- [ ] Update `task_plan.md`, `findings.md`, and `progress.md`.
- [ ] Do not commit or push.
