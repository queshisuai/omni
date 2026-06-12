# Sentry First Trial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 本项目规则要求不要自动提交和推送，因此本计划不包含 commit step。

**Goal:** 先接入 Sentry，让线上前端问题可追踪；PostHog 延后到产品分析需求明确后再接。

**Architecture:** 第一轮只接前端 Sentry 错误监控和 release 标识。所有初始化都受环境变量总开关控制，默认 disabled；脱敏逻辑先作为本地纯函数测试，再接入 `@sentry/nextjs` 的 `beforeSend` / `beforeBreadcrumb`，不启用 tracing、Session Replay、用户反馈浮窗或服务端 Java APM。

**Tech Stack:** Next.js 16、React 19、TypeScript、Node test、`@sentry/nextjs`（需用户授权后安装）。

---

## 下载授权边界

本计划的 Task 1 不需要下载依赖，可先实施。

从 Task 2 开始需要安装 `@sentry/nextjs`，会修改：
- `frontend/package.json`
- `frontend/pnpm-lock.yaml`
- `frontend/node_modules/`

推荐命令：

```powershell
cd frontend
pnpm add @sentry/nextjs --registry=https://registry.npmmirror.com
```

执行 Task 2 前必须先得到用户明确授权。没有授权时停在 Task 1 和文档更新，不安装 SDK。

## 非目标

- 不接 PostHog。
- 不启用 Session Replay。
- 不启用 tracing，默认 `tracesSampleRate=0`。
- 不上传 source map，除非后续单独授权 `SENTRY_AUTH_TOKEN`。
- 不采集请求 body、响应 body、表单内容、客服聊天正文、评价正文、手机号、证件号、观演人姓名、支付参数或完整订单上下文。
- 不新增用户可见英文文案。

## 文件结构

### frontend

- Create: `frontend/src/lib/sentry-sanitizer.ts`
- Create: `frontend/src/lib/sentry-sanitizer.test.ts`
- Create after SDK authorization: `frontend/instrumentation-client.ts`
- Create after SDK authorization: `frontend/sentry.server.config.ts`
- Create after SDK authorization: `frontend/sentry.edge.config.ts`
- Modify after SDK authorization: `frontend/next.config.ts`
- Modify after SDK authorization: `frontend/package.json`
- Modify after SDK authorization: `frontend/pnpm-lock.yaml`

### docs / planning

- Modify: `docs/production-readiness/sentry-evaluation-and-trial-plan.md`
- Modify: `task_plan.md`
- Modify: `findings.md`
- Modify: `progress.md`
- Modify: `2026-06-06-platform-improvement-roadmap.md`

---

## Task 1: 本地脱敏与开关纯函数

**Files:**
- Create: `frontend/src/lib/sentry-sanitizer.ts`
- Create: `frontend/src/lib/sentry-sanitizer.test.ts`

- [x] **Step 1: 写 disabled 状态和 route 归一红灯测试**

Create `frontend/src/lib/sentry-sanitizer.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getSentryClientConfig,
  normalizeSentryRoute,
  scrubSentryEvent,
} from './sentry-sanitizer.ts'

test('keeps sentry disabled when flag or dsn is missing', () => {
  assert.deepEqual(getSentryClientConfig({}), {
    enabled: false,
    dsn: '',
    environment: 'local',
    release: undefined,
    sampleRate: 1,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  })

  assert.equal(getSentryClientConfig({
    NEXT_PUBLIC_SENTRY_ENABLED: 'true',
  }).enabled, false)

  assert.equal(getSentryClientConfig({
    NEXT_PUBLIC_SENTRY_ENABLED: 'true',
    NEXT_PUBLIC_SENTRY_DSN: 'https://examplePublicKey@o0.ingest.sentry.io/0',
  }).enabled, true)
})

test('normalizes dynamic ids in route paths', () => {
  assert.equal(normalizeSentryRoute('/orders/980057?token=abc'), '/orders/[id]')
  assert.equal(normalizeSentryRoute('/activity/900002'), '/activity/[id]')
  assert.equal(
    normalizeSentryRoute('/console/sessions/13dbf4c9-ae24-4d7f-83ee-8523b8e71774'),
    '/console/sessions/[id]'
  )
})
```

- [x] **Step 2: 写敏感字段脱敏红灯测试**

Append to `frontend/src/lib/sentry-sanitizer.test.ts`:

```ts
test('scrubs sensitive request data from sentry events', () => {
  const result = scrubSentryEvent({
    request: {
      url: 'https://omni.local/orders/980057?token=secret&phone=13800000001',
      query_string: 'token=secret&phone=13800000001',
      cookies: 'SESSION=secret',
      headers: {
        Authorization: 'Bearer secret',
        'X-Internal-Token': 'omni-local-internal-token',
        'Content-Type': 'application/json',
      },
      data: {
        phone: '13800000001',
        idNo: '110101199001011234',
        attendeeName: '张三',
        orderId: 980057,
      },
    },
    user: {
      id: '2004',
      email: 'user@example.com',
      username: '张三',
    },
    tags: {
      role: 'admin',
    },
    extra: {
      token: 'secret',
      qrCode: 'https://qr.example.invalid/abc',
      safe: 'visible',
    },
  })

  assert.equal(result.request.url, '/orders/[id]')
  assert.equal(result.request.query_string, undefined)
  assert.equal(result.request.cookies, undefined)
  assert.equal(result.request.headers.Authorization, undefined)
  assert.equal(result.request.headers['X-Internal-Token'], undefined)
  assert.equal(result.request.headers['Content-Type'], 'application/json')
  assert.equal(result.request.data, undefined)
  assert.equal(result.user, undefined)
  assert.equal(result.extra.token, '[Filtered]')
  assert.equal(result.extra.qrCode, '[Filtered]')
  assert.equal(result.extra.safe, 'visible')
})
```

- [x] **Step 3: 运行测试确认失败**

Run:

```powershell
cd frontend
node --test --experimental-strip-types src/lib/sentry-sanitizer.test.ts
```

Expected: FAIL，提示 `Cannot find module './sentry-sanitizer.ts'`。

- [x] **Step 4: 实现本地纯函数**

Create `frontend/src/lib/sentry-sanitizer.ts`:

```ts
export type SentryClientEnv = Record<string, string | undefined>

export type SentryClientConfig = {
  enabled: boolean
  dsn: string
  environment: string
  release: string | undefined
  sampleRate: number
  tracesSampleRate: number
  replaysSessionSampleRate: number
  replaysOnErrorSampleRate: number
}

export type SentryLikeEvent = {
  request?: {
    url?: string
    query_string?: string
    cookies?: string
    headers?: Record<string, string | undefined>
    data?: unknown
  }
  user?: unknown
  tags?: Record<string, string>
  extra?: Record<string, unknown>
  [key: string]: unknown
}

const SENSITIVE_EXTRA_KEYS = [
  'authorization',
  'cookie',
  'idno',
  'id_no',
  'internal',
  'jwt',
  'phone',
  'qrcode',
  'token',
]

function parseNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return parsed
}

export function getSentryClientConfig(env: SentryClientEnv): SentryClientConfig {
  const dsn = env.NEXT_PUBLIC_SENTRY_DSN ?? ''
  return {
    enabled: env.NEXT_PUBLIC_SENTRY_ENABLED === 'true' && dsn.length > 0,
    dsn,
    environment: env.SENTRY_ENVIRONMENT ?? 'local',
    release: env.SENTRY_RELEASE,
    sampleRate: parseNumber(env.SENTRY_SAMPLE_RATE, 1),
    tracesSampleRate: parseNumber(env.SENTRY_TRACES_SAMPLE_RATE, 0),
    replaysSessionSampleRate: parseNumber(env.SENTRY_REPLAYS_SESSION_SAMPLE_RATE, 0),
    replaysOnErrorSampleRate: parseNumber(env.SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE, 0),
  }
}

export function normalizeSentryRoute(input: string | undefined) {
  if (!input) return undefined
  const url = input.startsWith('http')
    ? new URL(input)
    : new URL(input, 'https://omni.local')

  return url.pathname
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[id]')
    .replace(/\d+/g, '[id]')
}

function isSensitiveExtraKey(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9_]/g, '')
  return SENSITIVE_EXTRA_KEYS.some((item) => normalized.includes(item))
}

export function scrubSentryEvent<T extends SentryLikeEvent>(event: T): T {
  const scrubbed = structuredClone(event)

  if (scrubbed.request) {
    scrubbed.request.url = normalizeSentryRoute(scrubbed.request.url)
    delete scrubbed.request.query_string
    delete scrubbed.request.cookies
    delete scrubbed.request.data

    if (scrubbed.request.headers) {
      delete scrubbed.request.headers.Authorization
      delete scrubbed.request.headers.authorization
      delete scrubbed.request.headers.Cookie
      delete scrubbed.request.headers.cookie
      delete scrubbed.request.headers['X-Internal-Token']
      delete scrubbed.request.headers['x-internal-token']
    }
  }

  delete scrubbed.user

  if (scrubbed.extra) {
    for (const key of Object.keys(scrubbed.extra)) {
      if (isSensitiveExtraKey(key)) {
        scrubbed.extra[key] = '[Filtered]'
      }
    }
  }

  return scrubbed
}
```

- [x] **Step 5: 运行测试确认通过**

Run:

```powershell
cd frontend
node --test --experimental-strip-types src/lib/sentry-sanitizer.test.ts
```

Expected: PASS，3 tests。

---

## Task 2: 授权后安装 Sentry SDK

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/pnpm-lock.yaml`

- [x] **Step 1: 等待用户授权**

需要用户明确同意安装依赖。说明：
- 下载包：`@sentry/nextjs`
- 来源：npm registry，建议使用 `https://registry.npmmirror.com`
- 影响：修改 `frontend/package.json`、`frontend/pnpm-lock.yaml`、`frontend/node_modules`
- 不创建外部账号，不写真实 DSN

- [x] **Step 2: 安装 SDK**

Run only after approval:

```powershell
cd frontend
pnpm add @sentry/nextjs --registry=https://registry.npmmirror.com
```

Expected: `frontend/package.json` 增加 `@sentry/nextjs`，lockfile 更新。若 pnpm 提示 `@sentry/cli` build script 被忽略，本轮不要批准运行；使用 `pnpm approve-builds "!@sentry/cli"` 明确拒绝。

---

## Task 3: 接入 Next.js gated 初始化

**Files:**
- Create: `frontend/instrumentation-client.ts`
- Create: `frontend/sentry.server.config.ts`
- Create: `frontend/sentry.edge.config.ts`
- Modify: `frontend/next.config.ts`

- [x] **Step 1: 创建浏览器端初始化**

Create `frontend/instrumentation-client.ts`:

```ts
import * as Sentry from '@sentry/nextjs'
import {
  getSentryClientConfig,
  scrubSentryEvent,
} from './src/lib/sentry-sanitizer.ts'

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart

const config = getSentryClientConfig({
  NEXT_PUBLIC_SENTRY_ENABLED: process.env.NEXT_PUBLIC_SENTRY_ENABLED,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT,
  SENTRY_RELEASE: process.env.SENTRY_RELEASE,
  SENTRY_SAMPLE_RATE: process.env.SENTRY_SAMPLE_RATE,
  SENTRY_TRACES_SAMPLE_RATE: process.env.SENTRY_TRACES_SAMPLE_RATE,
  SENTRY_REPLAYS_SESSION_SAMPLE_RATE: process.env.SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
  SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: process.env.SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
})

if (config.enabled) {
  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,
    enabled: config.enabled,
    sampleRate: config.sampleRate,
    tracesSampleRate: config.tracesSampleRate,
    replaysSessionSampleRate: config.replaysSessionSampleRate,
    replaysOnErrorSampleRate: config.replaysOnErrorSampleRate,
    sendDefaultPii: false,
    beforeSend(event) {
      return scrubSentryEvent(event)
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'console' || breadcrumb.category === 'fetch') {
        return {
          ...breadcrumb,
          data: undefined,
          message: breadcrumb.message ? '[Filtered]' : breadcrumb.message,
        }
      }
      return breadcrumb
    },
  })
}
```

- [x] **Step 2: 创建 server / edge 空配置**

Create `frontend/sentry.server.config.ts`:

```ts
import * as Sentry from '@sentry/nextjs'

if (process.env.SENTRY_DSN && process.env.SENTRY_SERVER_ENABLED === 'true') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? 'local',
    release: process.env.SENTRY_RELEASE,
    enabled: true,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  })
}
```

Create `frontend/sentry.edge.config.ts`:

```ts
import * as Sentry from '@sentry/nextjs'

if (process.env.SENTRY_DSN && process.env.SENTRY_EDGE_ENABLED === 'true') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? 'local',
    release: process.env.SENTRY_RELEASE,
    enabled: true,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  })
}
```

- [x] **Step 3: 包装 Next config，但不上传 source map**

Modify `frontend/next.config.ts`:

```ts
import { withSentryConfig } from '@sentry/nextjs'
import type { NextConfig } from 'next'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const configDir = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  output: 'standalone',
  devIndicators: false,
  turbopack: {
    root: configDir,
  },
}

export default withSentryConfig(nextConfig, {
  silent: true,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
})
```

- [x] **Step 4: 类型检查**

Run:

```powershell
cd frontend
pnpm typecheck
```

Expected: PASS。

---

## Task 4: 禁用态无外部请求验证

**Files:**
- Modify: `progress.md`

- [x] **Step 1: 清空 Sentry 环境变量启动前端**

Run:

```powershell
cd frontend
$env:NEXT_PUBLIC_SENTRY_ENABLED='false'
$env:NEXT_PUBLIC_SENTRY_DSN=''
pnpm dev
```

Expected: 前端正常启动。

- [x] **Step 2: 浏览器验收**

Use Browser plugin:
- Open `http://localhost:3000/console`
- 登录平台管理员 `13800000001 / 123456`
- 确认可见控制台
- Network 中不应出现 `sentry.io`、`ingest.sentry.io` 或 `sentry` 请求
- Console 无新增 warn/error

- [x] **Step 3: 记录结果**

Append to `progress.md`:

```markdown
- Sentry disabled 态浏览器验收：`NEXT_PUBLIC_SENTRY_ENABLED=false` 且 DSN 为空时，`/console` 可正常打开，Network 未出现 Sentry 请求，console 无新增 warn/error。
```

---

## Task 5: 授权环境启用一次测试错误

**Files:**
- Modify: `progress.md`

- [ ] **Step 1: 等待用户提供 DSN**

当前状态：尚未提供真实 Sentry DSN，启用态测试错误验收未执行；不要使用伪造 DSN，也不要在聊天输出真实 DSN。

2026-06-09 补强记录：已把 browser 端内联 breadcrumb 脱敏提取为公共函数，并接入 server / edge gated 初始化；server / edge 只有在 `SENTRY_DSN` 与对应显式开关同时存在时才初始化。启用态外部事件验证仍等待真实 DSN。

需要用户提供：
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_ENVIRONMENT`
- `SENTRY_RELEASE`

不要在输出中打印 DSN。

- [ ] **Step 2: 临时启用环境变量**

Run:

```powershell
cd frontend
$env:NEXT_PUBLIC_SENTRY_ENABLED='true'
$env:NEXT_PUBLIC_SENTRY_DSN='<由用户在本机终端设置，不在聊天输出>'
$env:SENTRY_ENVIRONMENT='local-trial'
$env:SENTRY_RELEASE='omni-sentry-trial-20260609'
$env:SENTRY_TRACES_SAMPLE_RATE='0'
$env:SENTRY_REPLAYS_SESSION_SAMPLE_RATE='0'
$env:SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE='0'
pnpm dev
```

- [ ] **Step 3: 触发一次脱敏测试错误**

只在授权环境执行。建议临时通过浏览器 console 触发：

```js
throw new Error('OMNI_SENTRY_TRIAL_ERROR')
```

Expected:
- Sentry 收到事件。
- 事件里没有 token、手机号、证件号、订单详情、客服正文、请求 body 或响应 body。
- route 已归一，不包含完整订单号。

- [ ] **Step 4: 关闭启用态**

Run:

```powershell
$env:NEXT_PUBLIC_SENTRY_ENABLED='false'
$env:NEXT_PUBLIC_SENTRY_DSN=''
```

- [ ] **Step 5: 记录结果**

Append to `progress.md`:

```markdown
- Sentry 启用态手工验收：已触发 `OMNI_SENTRY_TRIAL_ERROR`，Sentry 事件可见且敏感字段已脱敏；随后已关闭 `NEXT_PUBLIC_SENTRY_ENABLED` 并清空 DSN。
```

---

## Task 6: 收尾验证

**Files:**
- Modify: `task_plan.md`
- Modify: `findings.md`
- Modify: `progress.md`
- Modify: `2026-06-06-platform-improvement-roadmap.md`

- [x] **Step 1: 本地测试**

Run:

```powershell
cd frontend
node --test --experimental-strip-types src/lib/sentry-sanitizer.test.ts
pnpm typecheck
```

Expected: PASS。

- [x] **Step 2: diff 检查**

Run:

```powershell
git diff --check
```

Expected: exit code 0；允许仓库既有 LF/CRLF warning。

- [x] **Step 3: 更新计划文件**

Update:
- `task_plan.md`：阶段 8 第二轮 Sentry 试点完成项。
- `findings.md`：记录 disabled 态、脱敏边界、是否启用外部项目。
- `progress.md`：记录测试命令和浏览器验收。
- `2026-06-06-platform-improvement-roadmap.md`：Sentry 状态从“评估完成”推进到“试点完成”。

---

## Self-Review

- Spec coverage: 覆盖用户要求的“先接 Sentry 保证线上问题可追，再按产品分析需求接 PostHog”。
- Scope: 第一轮只做前端错误监控，PostHog 明确后置。
- Privacy: 禁止上传 token、手机号、证件号、观演人姓名、客服正文、支付参数、请求/响应 body。
- Download gate: `@sentry/nextjs` 安装被隔离在 Task 2，未授权不得执行。
- Rollback: 环境变量可立即关闭，代码可删除 SDK 初始化和依赖恢复。
