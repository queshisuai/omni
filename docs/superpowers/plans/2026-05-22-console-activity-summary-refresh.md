# Console Activity Summary Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复主办方后台概览统计口径、活动创建艺人输入语义，以及浏览器返回时页面数据不刷新的问题。

**Architecture:** 后端在 ticket 服务内收紧概览统计条件，并让活动创建支持 `artistName` 自动匹配/创建艺人。前端只提交艺人/团队名称，不暴露艺人 ID，并在关键页面通过 `pageshow` / `visibilitychange` 重新加载数据。

**Tech Stack:** Spring Boot + MyBatis-Plus、Next.js 16 + React 19、pnpm、Maven。

---

### Task 1: 后台概览统计口径

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/AdminSummaryService.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/AdminSummaryServiceTest.java`

- [ ] 写测试：主办方概览只统计 `status=1`、`publishStatus=published`、`deletedAt IS NULL` 的活动，票档数和已支付订单数也只基于这些活动的场次。
- [ ] 运行测试确认失败。
- [ ] 修改 `AdminSummaryService` 的活动查询条件。
- [ ] 运行测试确认通过。

### Task 2: 新建活动支持艺人姓名

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Modify: `frontend/src/app/console/activities/new/page.tsx`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java`

- [ ] 写测试：`createActivity` 接收 `artistName` 时复用已有艺人或创建新艺人。
- [ ] 运行测试确认失败。
- [ ] 后端解析 `artistName` 并设置真实 `artistId`。
- [ ] 前端提交 `artistName`，隐藏/移除艺人 ID 语义。
- [ ] 运行后端测试和前端 typecheck。

### Task 3: 浏览器返回自动刷新

**Files:**
- Modify: `frontend/src/app/console/page.tsx`
- Modify: `frontend/src/app/console/activities/page.tsx`
- Modify: `frontend/src/app/orders/page.tsx`
- Modify: `frontend/src/app/page.tsx` if activity list data is cached there.

- [ ] 为关键页面增加 `pageshow` 和 `visibilitychange` 刷新。
- [ ] 加 200ms 节流，避免重复请求。
- [ ] 运行 `pnpm typecheck`。

### Task 4: 验证

**Files:**
- No direct code changes.

- [ ] 运行 `mvn test -pl java-ticket -am`。
- [ ] 运行 `pnpm typecheck`。
- [ ] 运行 `powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1`。
