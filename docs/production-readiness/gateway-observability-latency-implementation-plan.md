# Gateway 可观测与链路提速 Implementation Plan

> **给执行代理：** REQUIRED SUB-SKILL: Use `executing-plans` 按任务逐项实施；涉及生产代码改动时先用 `test-driven-development`。步骤使用 checkbox（`- [ ]`）跟踪。本项目规则要求不要自动提交和推送，因此本计划不包含 commit step。

**Goal:** 把当前轻量级 Gateway 升级为可观测、可诊断、可限流的统一入口，并用直连与经 Gateway 的延迟对比定位“服务联动慢”的真实原因。

**Architecture:** 第一轮只在 `java-gateway` 增加链路诊断能力，不引入新的外部依赖。Gateway 使用 WebFlux `GlobalFilter` 生成或透传 `X-Request-Id`，记录 route 级耗时、状态码和目标服务；再用脚本对比直连业务服务与 Gateway 入口的延迟基线。后续再基于数据调整超时、限流、鉴权和熔断策略。

**Tech Stack:** Spring Cloud Gateway、Spring WebFlux、Nacos、Sentinel、Redis（后续限流）、PowerShell 验证脚本。

---

## 非目标

- 不把 Gateway 改成业务编排层。
- 不在同步请求链路里引入 MQ。
- 不直接假设慢链路全部由 Gateway 造成，必须先有直连与 Gateway 对比数据。
- 第一轮不引入 Prometheus、Grafana、Sentry 或额外 APM 依赖。
- 第一轮不改数据库结构。

## 当前现状

- `java-gateway` 当前使用 Spring Cloud Gateway + Nacos + Sentinel。
- `application.yml` 已有 user、ticket、order、payment、notification、grab、waitlist 等 route。
- `GatewaySentinelConfig` 已有热点 API QPS 基线和中文 429 响应。
- `java-common` 有 servlet 版 `TraceIdFilter`，但 Gateway 是 reactive 应用，不能直接复用 servlet filter。
- 当前缺少 Gateway route 级耗时日志、统一 trace header 响应、直连与 Gateway 延迟对比脚本。

## 文件结构

### java-gateway

- Create: `java/java-gateway/src/main/java/com/omni/gateway/filter/GatewayDiagnosticsFilter.java`
- Create: `java/java-gateway/src/test/java/com/omni/gateway/filter/GatewayDiagnosticsFilterTest.java`
- Modify: `java/java-gateway/src/main/resources/application.yml`

### scripts

- Create: `scripts/measure-gateway-latency.ps1`

### docs

- Modify: `docs/production-readiness/gateway-observability-latency-implementation-plan.md`

---

## Task 1: Gateway traceId 与 route 耗时日志

**Files:**
- Create: `java/java-gateway/src/main/java/com/omni/gateway/filter/GatewayDiagnosticsFilter.java`
- Create: `java/java-gateway/src/test/java/com/omni/gateway/filter/GatewayDiagnosticsFilterTest.java`
- Modify: `java/java-gateway/src/main/resources/application.yml`

- [x] **Step 1: 写 traceId 红灯测试**

验证 Gateway 请求没有 `X-Request-Id` 时会生成 traceId，并同时写入下游请求和响应头。

Run: `cd java; mvn -pl java-gateway -Dtest=GatewayDiagnosticsFilterTest test`

Result: 实现前按预期失败，错误为缺少 `GatewayDiagnosticsFilter`。

- [x] **Step 2: 实现 WebFlux GlobalFilter**

新增 `GatewayDiagnosticsFilter`：
- 缺少 `X-Request-Id` 时生成 32 位无横线 UUID。
- 已有 `X-Request-Id` 时原样透传。
- 响应头始终返回 `X-Request-Id`。
- 请求完成后记录 `traceId`、`method`、`path`、`routeId`、`targetUri`、`status`、`durationMs`。
- 超过 `omni.gateway.diagnostics.slow-threshold-ms` 时使用 warn 日志，否则使用 info 日志。

- [x] **Step 3: 配置慢请求阈值**

在 `application.yml` 增加：

```yaml
omni:
  gateway:
    diagnostics:
      slow-threshold-ms: ${GATEWAY_SLOW_THRESHOLD_MS:800}
```

- [x] **Step 4: 运行 Gateway 单元测试**

Run: `cd java; mvn -pl java-gateway test`

Result: 2026-06-07 运行通过，`Tests run: 29, Failures: 0, Errors: 0, Skipped: 0`。

---

## Task 2: 直连与 Gateway 延迟对比脚本

**Files:**
- Create: `scripts/measure-gateway-latency.ps1`
- Create: `scripts/test-measure-gateway-latency.ps1`

- [x] **Step 1: 写本地测量脚本**

脚本输入：
- `-Iterations`：每个接口请求次数，默认 5。
- `-TimeoutSec`：单次请求超时，默认 8。
- `-GatewayBaseUrl`：默认 `http://localhost:8088`。
- `-UserBaseUrl`：默认 `http://localhost:8081`。
- `-TicketBaseUrl`：默认 `http://localhost:8082`。
- `-OrderBaseUrl`：默认 `http://localhost:8083`。
- `-PaymentBaseUrl`：默认 `http://localhost:8084`。
- `-NotificationBaseUrl`：默认 `http://localhost:8085`。

测量接口：
- `GET /api/ticket/activities`
- `POST /api/user/login`
- `GET /api/notification/list`，脚本会优先用测试账号登录获取 JWT；获取失败时仍输出失败行，不让脚本崩溃。

输出字段：
- `scenario`：`gateway-vs-direct` 或 `local-model`
- `route`
- `mode`：`gateway` 或 `direct`
- `url`
- `success`
- `status`
- `p50Ms`
- `p95Ms`
- `maxMs`
- `error`

- [x] **Step 2: 运行脚本记录基线**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\measure-gateway-latency.ps1 -Iterations 5
```

Result: 2026-06-07 运行通过，能输出 Gateway 与直连延迟对比；`scripts\test-measure-gateway-latency.ps1` 验证服务未启动时输出中文错误而不是脚本崩溃。

本机 5 轮基线：

| route | gateway p50/p95/max | direct p50/p95/max | 判断 |
|:---|:---|:---|:---|
| `ticket.activities` | 28.26 / 84.20 / 84.20 ms | 24.99 / 35.25 / 35.25 ms | Gateway 有额外耗时，但不是秒级慢点 |
| `user.login` | 97.78 / 102.43 / 102.43 ms | 90.97 / 93.02 / 93.02 ms | Gateway 额外耗时较小 |
| `notification.list` | 17.69 / 23.34 / 23.34 ms | 18.70 / 46.28 / 46.28 ms | Gateway 未表现为瓶颈 |

补充：2026-06-11 已给脚本增加 `-OutputFormat Object|Csv|Json` 和 `-OutputPath`，用于把关闭端口、Gateway/direct 和 local-model 样本归档为 CSV 或 JSON。默认仍为 `Object` 输出，不影响交互式查看。

---

## Task 3: route 超时与长链路分类基线

**Files:**
- Modify: `java/java-gateway/src/main/resources/application.yml`
- Test: `java/java-gateway/src/test/java/com/omni/gateway/config/GatewayRouteTimeoutConfigTest.java`
- Test: `java/java-gateway/src/test/java/com/omni/gateway/filter/GatewayDiagnosticsFilterTest.java`

- [x] **Step 1: 为短请求和长请求分组**

短请求：
- 登录、活动列表、订单列表、通知列表。

长请求：
- 支付同步。
- 抢票、候补、客服 SSE 或后续长轮询入口。

- [x] **Step 2: 增加可配置响应超时**

第一轮只配置全局 `response-timeout` 和必要 route metadata，不改变业务接口语义。

- [x] **Step 3: 运行 Gateway 测试和延迟脚本**

Run:

```powershell
cd java
mvn -pl java-gateway test
cd ..
powershell -ExecutionPolicy Bypass -File scripts\measure-gateway-latency.ps1 -Iterations 5
```

Result: 2026-06-08 运行通过，`mvn -pl java-gateway test` 结果为 `Tests run: 33, Failures: 0, Errors: 0, Skipped: 0`。启动 `java-gateway` 后运行延迟脚本，Gateway 与直连均可返回 200。

本轮配置：
- 全局 `connect-timeout` 默认 `1000ms`。
- 全局 `response-timeout` 默认 `5s`。
- 短链路默认 `3000ms`：`user-auth-service`、`ticket-hot-read-service`、`order-read-service`、`notification-service`。
- 常规链路默认 `5000ms`：`user-service`、`ticket-service`、`order-service`、`payment-service`。
- 上传链路默认 `10000ms`：`ticket-uploads`、`user-uploads`。
- 长链路默认 `15000ms`：`payment-sync-service`、`grab-service`、`waitlist-service`。
- 客服流式入口 `support-stream-service` 使用 `response-timeout=-1`，避免 SSE 被普通短超时截断。

本机 5 轮基线：

| route | gateway p50/p95/max | direct p50/p95/max | 判断 |
|:---|:---|:---|:---|
| `ticket.activities` | 30.31 / 62.50 / 62.50 ms | 22.61 / 24.99 / 24.99 ms | Gateway 额外耗时可见，但仍为毫秒级 |
| `user.login` | 94.72 / 101.95 / 101.95 ms | 92.74 / 93.24 / 93.24 ms | Gateway 额外耗时较小 |
| `notification.list` | 25.95 / 50.90 / 50.90 ms | 16.67 / 19.11 / 19.11 ms | Gateway 有额外耗时，但不是当前主要瓶颈 |

补充修复：
- 启动 Gateway 时发现 `GatewayDiagnosticsFilter` 因存在两个构造器且生产构造器未标注 `@Autowired` 导致 Spring 创建失败。
- 已新增 Spring context 创建测试并修复构造器注入，避免单元测试通过但真实 Gateway 启动失败。

---

## Task 4: Redis 限流与热点接口保护

**Files:**
- Modify: `java/java-gateway/src/main/resources/application.yml`
- Modify: `java/java-gateway/src/main/java/com/omni/gateway/config/GatewaySentinelConfig.java`
- Test: `java/java-gateway/src/test/java/com/omni/gateway/config/GatewaySentinelConfigTest.java`

- [x] **Step 1: 保留 Sentinel 热点 API 规则**

继续使用 Sentinel 保护抢票、候补、下单、支付同步、登录、热门票务查询。

已补齐支付关键入口保护：`/api/payment/alipay/page-pay`、`/api/payment/alipay/qr-pay`、`/api/payment/alipay/sync`、`/api/payment/alipay/notify` 统一归入 `PAYMENT_CRITICAL_API`。暂不扩大为 `/api/payment/**`，避免普通支付查询和后台路径被同一热点规则误伤。

- [x] **Step 2: 评估 Redis 限流是否必要**

只有当 Gateway route 耗时日志和脚本基线证明热点入口需要跨实例共享限流时，再接入 Redis 限流。

本轮 5 次样本仍显示 Gateway 额外耗时为毫秒级：`ticket.activities` Gateway p95 `53.78ms` / direct p95 `27.09ms`，`user.login` Gateway p95 `96.79ms` / direct p95 `90.57ms`，`notification.list` Gateway p95 `24.85ms` / direct p95 `19.37ms`。当前瓶颈证据不足，不接 Redis 跨实例限流；后续只有在多 Gateway 实例、高峰 QPS 或 Sentinel 单实例规则无法满足时再引入 Redis 令牌桶/滑动窗口。

- [x] **Step 3: 验证 429 中文响应**

Run: `cd java; mvn -pl java-gateway -Dtest=GatewaySentinelConfigTest test`

Expected: 429 响应仍为中文 JSON：`系统繁忙，请稍后重试`。

Verified 2026-06-08：
- `cd java; mvn -pl java-gateway "-Dtest=GatewaySentinelConfigTest#gatewayApiDefinitionsOnlyIncludeHotspotResources" test`：1 test passed。
- `cd java; mvn -pl java-gateway test`：33 tests passed。
- `powershell -ExecutionPolicy Bypass -File scripts\measure-gateway-latency.ps1 -Iterations 5`：Gateway/Direct 样本均返回 200。
- `powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1`：All microservice boundary checks passed。
- `git diff --check`：无空白错误，仅 CRLF warning。

---

## 验收命令

```powershell
cd java
mvn -pl java-gateway test
cd ..
powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1
powershell -ExecutionPolicy Bypass -File scripts\measure-gateway-latency.ps1 -Iterations 5
powershell -ExecutionPolicy Bypass -File scripts\measure-gateway-latency.ps1 -Iterations 1 -TimeoutSec 5 -IncludeOllama
```

## 2026-06-11 补充：本地模型耗时拆分

`scripts\measure-gateway-latency.ps1` 已支持 `-IncludeOllama`。默认不启用时仍只输出 Gateway/direct 6 行基线；启用后额外输出：

- `ollama.tags`：本地模型服务标签探测。
- `ollama.chat`：本地模型短 prompt 推理探测。

这两行统一标记为 `mode=local-model`，用于把 AI 客服 FAQ 未命中后的模型回落耗时，从 Gateway、前端代理和业务服务直连耗时里拆开。脚本只读调用本机 HTTP 接口，不修改数据库或业务状态。

本机单轮样本：

| route | mode | p50/max | 判断 |
|:---|:---|:---|:---|
| `ticket.activities` | gateway/direct | `45.51ms` / `40.27ms` | 网关差值为毫秒级 |
| `user.login` | gateway/direct | `99.48ms` / `100.26ms` | 网关不是慢点 |
| `notification.list` | gateway/direct | `33.83ms` / `24.82ms` | 网关有额外耗时但不构成秒级瓶颈 |
| `ollama.tags` | local-model | `17.3ms` | 本地模型服务可快速响应标签探测 |
| `ollama.chat` | local-model | `3152.92ms` | AI 客服慢响应更可能来自模型推理或模型回落 |

| 验证 | 结果 |
|:---|:---|
| `powershell -ExecutionPolicy Bypass -File scripts\test-measure-gateway-latency.ps1` | 通过 |
| `powershell -ExecutionPolicy Bypass -File scripts\measure-gateway-latency.ps1 -Iterations 1 -TimeoutSec 5 -IncludeOllama` | 返回 Gateway/direct/local-model 8 行样本 |

## 2026-06-11 补充：耗时样本可归档

`scripts\measure-gateway-latency.ps1` 已补充：

- `scenario=gateway-vs-direct`：Gateway 与直连服务对比样本。
- `scenario=local-model`：Ollama 本地模型探测样本。
- `-OutputFormat Csv -OutputPath <path>`：生成可被 Excel 或后续报表工具读取的 CSV。
- `-OutputFormat Json -OutputPath <path>`：生成可被 CI、脚本或趋势汇总任务读取的 JSON。

关闭端口测试会同时覆盖默认对象输出、CSV 6 行样本和包含 Ollama 的 JSON 8 行样本，确保服务不可用时仍能产出结构化失败证据。

## 2026-06-11 补充：小队抢票链路分段日志

`TeamGrabProcessorService` 已补充“小队抢票链路耗时”日志，成功和可恢复失败路径都会输出：

- `teamGrabRequestId`、`grabRequestId`、`teamId`、`sessionId`、`ticketTypeId`、`outcome`
- `lockMs`：调用 ticket 锁小队座位耗时。
- `priceMs`：读取可见票档价格耗时。
- `orderMs`：调用 order 创建小队订单耗时。
- `confirmMs`：落库确认小队订单和 grab 订单结果耗时。
- `notificationMs`：通知小队成员耗时。
- `totalMs`：本次小队处理总耗时。

该日志用于区分“锁座慢”“订单服务慢”“确认落库慢”和“通知慢”，避免把小队抢票慢响应统一归因到 Gateway 或 Redis 队列。

## 2026-06-11 补充：支付确认到订单履约分段日志

`PaymentConfirmationService` 已补充“支付确认链路耗时”日志，覆盖支付宝同步/回调进入本地确认后的事务链路：

- `paymentId`、`orderId`、`outcome`
- `orderMarkPaidMs`：调用 `java-order` internal `markPaid` 的耗时，包含订单状态变更和后续出票履约链路。
- `paymentUpdateMs`：本地支付流水更新为成功的耗时。
- `totalMs`：本次本地支付确认总耗时。

该日志不直接调用支付宝，也不改变 `@GlobalTransactional` 边界；用于区分“支付宝查询慢”“订单服务确认/出票慢”和“payment 本地流水更新慢”。

## 2026-06-11 补充：支付同步外层分段日志

`AlipayService.syncByOrderId()` 已补充“支付同步链路耗时”日志，覆盖从同步入口进入本地订单、支付流水、支付宝查询、本地确认和订单回查的外层链路：

- `orderId`、`orderNo`、`outcome`
- `orderLoadMs`：调用 `java-order` internal 读取订单的耗时。
- `paymentLoadMs`：读取本地支付流水的耗时。
- `alipayQueryMs`：调用支付宝查询接口的耗时；测试通过 mock `AlipayClient` 验证，不访问真实支付宝。
- `confirmPaymentMs`：进入 `PaymentConfirmationService.confirmPayment()` 的耗时，内部再由“支付确认链路耗时”拆分订单履约和 payment 更新。
- `orderReloadMs`：支付确认后回查订单状态的耗时。
- `totalMs`：本次支付同步总耗时。

该日志用于把“支付宝查询慢”和“本地确认/出票履约慢”分开；没有真实 DSN、token 或支付宝沙箱凭据时，仍不声明外部支付宝链路已完成 enabled 验收。

## 2026-06-11 补充：订单支付履约分段日志

`OrderService.markPaid()` 已补充“订单支付履约链路耗时”日志，覆盖支付确认进入 `java-order` 后的订单状态更新和出票履约链路：

- `orderId`、`orderNo`、`outcome`
- `orderLoadMs`：读取订单当前状态的耗时。
- `statusUpdateMs`：把订单从待支付原子更新为已支付的耗时。
- `ticketConfirmMs`：调用 ticket 侧确认库存/座位售出的耗时。
- `ticketIssueMs`：调用电子票出票服务的耗时。
- `waitlistNotifyMs`：发布候补支付成功事件的耗时。
- `totalMs`：本次订单履约总耗时。

该日志用于和 payment 侧的 `orderMarkPaidMs` 下钻联动，区分“订单状态更新慢”“ticket 确认售出慢”“电子票出票慢”和“候补通知慢”；不改变 `@Transactional` 边界、订单状态机或异常语义。

## 2026-06-11 补充：电子票出票分段日志

`TicketWalletService.issueForPaidOrder()` 已补充“电子票出票链路耗时”日志，覆盖 `OrderService.markPaid()` 进入电子票出票后的内部链路：

- `orderId`、`orderNo`、`outcome`
- `existingCheckMs`：按订单检查是否已出票的耗时。
- `attendeeLoadMs`：读取订单观演人信息的耗时。
- `seatLoadMs`：读取订单已锁定/已售座位信息的耗时。
- `ticketInsertMs`：写入电子票记录的累计耗时。
- `ticketCount`：本次完成插入调用的电子票张数。
- `totalMs`：本次出票处理总耗时。

该日志用于和订单侧 `ticketIssueMs` 下钻联动，区分“幂等检查慢”“观演人读取慢”“座位读取慢”和“电子票写入慢”；不改变 `@Transactional` 边界、已有电子票幂等跳过逻辑或异常传播语义。

## 2026-06-11 补充：AI 客服回复分段日志

`SupportAiService.answerStreamingWithDiagnostics()` 已补充“AI客服回复链路耗时”日志，覆盖客服流式回复的 FAQ、local-model 和 default fallback 三类来源：

- `source`：`faq`、`local-model` 或 `default`。
- `modelAttempted`：是否尝试调用本地模型。
- `fallbackReason`：进入默认兜底时的模型回落原因，例如“本地模型未返回可用回答”。
- `firstChunkMs`：第一个有效回复分片发出的耗时。
- `totalMs`：本次回复生成总耗时。

该日志用于和 `CustomerSupportService` 会话层 `conversationId` 日志、`measure-gateway-latency.ps1 -IncludeOllama` 本地模型探针联动，区分“FAQ 命中快”“本地模型推理慢”和“模型无可用回答后默认兜底”；不改变 FAQ 优先、本地模型调用、默认兜底或 SSE 分片语义。

## 回滚思路

- Gateway 诊断过滤器是独立 `GlobalFilter`，如出现异常，可临时移除该 bean 或恢复对应文件。
- `application.yml` 新增诊断阈值不影响 route 匹配，回滚只需删除 `omni.gateway.diagnostics` 配置。
- 延迟测量脚本只读调用本地接口，不修改数据库和业务状态。
