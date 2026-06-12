# PostHog Allowlist Wrapper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 本项目规则要求不要自动提交和推送，因此本计划不包含 commit step。

**Goal:** 在不安装 `posthog-js`、不写外部服务的前提下，先建立 PostHog allowlist / 脱敏 / 默认禁用态 wrapper。

**Architecture:** 第一轮 PostHog 代码只提供本地纯函数和可注入 transport。页面层后续只调用 `frontend/src/lib/analytics.ts`，不得直接调用 SDK；真实 SDK 安装、项目 token 和浏览器外部事件验证必须单独授权。

**Tech Stack:** Next.js 16、React 19、TypeScript、Node test。

---

## 非目标

- 不安装 `posthog-js`。
- 不创建 PostHog 外部项目。
- 不写入真实 PostHog 服务。
- 不启用 autocapture、Session Replay、Feature Flags、Experiments、Surveys 或 Error Tracking。
- 不调用 `identify()` 绑定手机号、邮箱或真实 userId。

## 文件结构

- Create: `frontend/src/lib/analytics.ts`
- Create: `frontend/src/lib/analytics.test.ts`
- Modify: `docs/production-readiness/posthog-evaluation-and-trial-plan.md`
- Modify: `task_plan.md`
- Modify: `findings.md`
- Modify: `progress.md`
- Modify: `2026-06-06-platform-improvement-roadmap.md`

---

## Task 1: 本地 allowlist / 脱敏 wrapper

- [x] **Step 1: 写红灯测试**

覆盖：
- `NEXT_PUBLIC_POSTHOG_ENABLED`、token、host 缺一时 disabled。
- 未知事件丢弃。
- 未授权属性、手机号、token、完整 orderId/userId/conversationId 和 URL query 丢弃。
- disabled 或未注入 transport 时不发送事件。
- enabled 且注入 transport 时只发送过滤后的 allowlist 事件。

Run:

```powershell
cd frontend
node --test --experimental-strip-types src/lib/analytics.test.ts
```

Expected: FAIL，提示缺少 `src/lib/analytics.ts`。

- [x] **Step 2: 实现 `analytics.ts`**

实现：
- `getAnalyticsClientConfig()`
- `sanitizeAnalyticsEvent()`
- `createAnalyticsTracker()`
- `AnalyticsTransport`

约束：
- 默认 `personProfiles='never'`。
- 默认关闭 autocapture、pageview、Session Replay。
- 只允许 `docs/production-readiness/posthog-evaluation-and-trial-plan.md` 中列出的事件和属性。

- [x] **Step 3: 跑定向测试**

Run:

```powershell
cd frontend
node --test --experimental-strip-types src/lib/analytics.test.ts
```

Observed: 5 tests passed.

---

## Task 2: 回归验证和文档同步

- [x] **Step 1: 前端回归**

Run:

```powershell
cd frontend
node --test --experimental-strip-types src/lib/analytics.test.ts src/lib/sentry-sanitizer.test.ts src/lib/api.test.ts src/lib/operation-display.test.ts src/lib/console-ops.test.ts
pnpm typecheck
```

Observed:
- 45 tests passed.
- `pnpm typecheck` passed.

- [x] **Step 2: 同步计划文件**

同步：
- `task_plan.md`
- `progress.md`
- `findings.md`
- `2026-06-06-platform-improvement-roadmap.md`
- `docs/production-readiness/posthog-evaluation-and-trial-plan.md`

---

## Task 3: 页面级 no-op 事件接入

- [x] **Step 1: 写红灯测试**

新增 `frontend/src/lib/analytics-page-integration.test.ts`，静态约束 `/search`、`/activity/[id]`、`/orders`、`/console` 只能通过 `@/lib/analytics` 接入 allowlist 事件。

Run:

```powershell
cd frontend
node --test --experimental-strip-types src/lib/analytics.test.ts src/lib/analytics-page-integration.test.ts
```

Observed: FAIL，缺少 `captureAnalyticsEvent` 导出，四个页面尚未接入 wrapper。

- [x] **Step 2: 实现 no-op capture 和页面调用**

实现：
- `captureAnalyticsEvent()`
- 默认 tracker
- `setAnalyticsTransport()`
- `/search`、`/activity/[id]`、`/orders`、`/console` 页面调用点

约束：
- 页面不直接导入 `posthog-js`。
- 页面不发送搜索原词、订单号、用户号、conversationId、URL query 或自由文本。
- 缺少 transport 时所有页面调用保持 no-op。

- [x] **Step 3: 验证**

Run:

```powershell
cd frontend
node --test --experimental-strip-types src/lib/analytics.test.ts src/lib/analytics-page-integration.test.ts
node --test --experimental-strip-types src/lib/analytics.test.ts src/lib/analytics-page-integration.test.ts src/lib/sentry-sanitizer.test.ts src/lib/api.test.ts src/lib/operation-display.test.ts src/lib/console-ops.test.ts
pnpm typecheck
```

Observed:
- 9 tests passed.
- 49 tests passed.
- `pnpm typecheck` passed.
- `rg -n "posthog-js|posthog" frontend/package.json frontend/pnpm-lock.yaml frontend/src frontend/instrumentation-client.ts frontend/next.config.ts` 未发现 `posthog-js` 依赖。

---

## 后续授权项

- 安装 `posthog-js` 前必须由用户单独授权。
- 真实 `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` 和 `NEXT_PUBLIC_POSTHOG_HOST` 只能在本机/部署环境设置，不写入仓库，不在聊天输出。
- SDK 接入后必须重新做 disabled 态浏览器验收，Network 中不得出现 PostHog 请求。
