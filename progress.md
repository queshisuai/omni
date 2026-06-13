# 进度记录

## 2026-06-08 阶段 6：评价系统正式化第一轮收口

- 恢复上下文：阶段 6 范围是 `activity_review` / `activity_question` 正式化，不恢复动态系统、`SocialController`、moment API 或旧 social/moment 持久化代码。
- 前端验证：`pnpm typecheck` 通过；`node --test --experimental-strip-types frontend/src/lib/api.test.ts frontend/src/lib/console-auth.test.ts frontend/src/lib/console-paths.test.ts` 通过，43 tests passed。
- 后端验证：`mvn -pl java-ticket "-Dtest=ActivityEngagementServiceTest,ActivityEngagementControllerTest,ActivityEngagementAdminControllerTest" test` 通过，11 tests passed。
- SQL/边界验证：`scripts\check-production-split-sql.ps1` 初次失败，原因是新增 `activity_review`、`activity_question`、`activity_review_report` 未加入脚本 `$schemaColumns` 白名单；已补脚本并重跑通过。
- 边界验证：`scripts\verify-microservice-boundaries.ps1` 初次失败，原因是新增三张评价表未加入 `scripts\check-cross-owner-fks.ps1` owner map；已补 owner map，完整边界验收通过。
- 本地数据库核验：`omni_ticket_split` 已存在 `activity_review`、`activity_question`、`activity_review_report`，关键索引 `uk_activity_review_order_active`、`uk_activity_review_report_pending_user` 存在。
- real-demo seed：`scripts\verify-prod-split-real-demo-seed.ps1` 通过；评价、问答、举报样本已同步本地 `omni_ticket_split`。
- 运行态探针：标准 Gateway `8088` 登录平台管理员成功，但 `/api/ticket/admin/activity-engagement/reviews?status=0` 返回 HTTP 404；直连 `8082` 同样 404，结论是标准 `java-ticket` 仍是旧进程。
- 非侵入式运行态：临时启动 `java-ticket` 到 `18082` 后，后台评价/举报/问答列表均返回业务 `code=200`；普通用户提交评价返回 `id=909004,status=0,orderId=980005`，提交举报返回 `id=909203,status=PENDING,reviewId=2`。
- 浏览器复测：标准 `3000` 前端仍是旧进程，`/console/activity-engagement` 返回 Next 404；临时 `3002` 当前代码前端验证通过，控制台菜单/快捷操作出现“评价问答管理”，新增管理页可渲染，订单页出现“评价演出”并能打开“提交审核”弹窗，活动详情显示“去订单页评价”和“举报”，浏览器 console 无 warn/error。
- 收尾：临时 `18082` 和 `3002` 服务已停止；完整标准端口复测前需要重启真实 `java-ticket` 和前端。

## 2026-06-08 阶段 6：标准端口复测推进
- 重新探测标准端口：`8082` 仍由 PID `20484` 的旧 `java.exe` 占用，直连 `GET /api/ticket/admin/activity-engagement/reviews?status=0` 返回 HTTP 404。
- 尝试用 `Stop-Process -Id 20484 -Force` 和 `taskkill /PID 20484 /F` 停止旧 `java-ticket`，均被系统返回 `Access is denied`；当前 Codex 进程无法替换该高权限/IDE 持有的 Java 服务。
- `3000` 为 Docker `omni-frontend`；容器 bind mount 能看到 `frontend/src/app/console/activity-engagement/page.tsx`，但初次重启后仍返回 HTTP 404。
- 根因定位到 Docker 前端 `.next/dev` 开发缓存/路由树不一致：Next 已编译 `app/console/activity-engagement/page.js`，但 RSC 响应仍落到 `/_not-found`。
- 已将容器内 `/app/.next/dev` 挪到 `/app/.next/dev-stale-20260608115952` 并重启 `omni-frontend`；随后 `http://localhost:3000/console/activity-engagement` 返回 HTTP 200。
- 当前剩余阻塞：需要在 IDEA/原启动终端中重启真实 `java-ticket`，让标准 `8082` 加载当前代码后再做 Gateway/API/browser 最终验收。

## 2026-06-08 阶段 6：标准端口最终验收
- 真实 `java-ticket` 已换到新 PID `12592`，直连 `GET http://localhost:8082/api/ticket/admin/activity-engagement/reviews?status=0` 返回 HTTP 200。
- 经 Gateway `8088` 使用平台管理员测试账号登录后，后台评价、举报、问答三条接口均返回业务 `code=200`，列表数量分别为 reviews=2、reports=2、questions=4。
- 经标准前端代理 `3000/api` 复测同三条后台接口，均返回业务 `code=200`，列表数量同样为 reviews=2、reports=2、questions=4。
- 标准前端页面路由 `http://localhost:3000/console/activity-engagement`、`/orders`、`/activity/900002` 均返回 HTTP 200。
- 浏览器验收：`/activity/900002` 可见评价、问答、举报和“去订单页评价”，console 无 warn/error；`/console/activity-engagement` 可见“评价问答管理”菜单与评价/举报/问答 tab，console 无 warn/error。
- 独立 Playwright 验收：普通用户登录态下 `/orders` 可见“评价演出”入口 4 个，点击后出现评价弹窗、存在 textarea，且未提交任何新评价数据。
- 收尾 fresh 验证：`pnpm typecheck` 通过；`mvn -pl java-ticket "-Dtest=ActivityEngagementServiceTest,ActivityEngagementControllerTest,ActivityEngagementAdminControllerTest" test` 通过，11 tests passed；`scripts\check-production-split-sql.ps1` 通过；`scripts\verify-microservice-boundaries.ps1` 通过；标准端口 API/page 探针通过；`git diff --check` 退出码 0，仅 LF/CRLF 提示。

## 2026-06-08 阶段 7：运营分析与异常闭环摸底
- 已恢复阶段 7 路线：目标是运营分析与异常闭环，优先闭合搜索/详情/想看/候补/下单/支付/退款漏斗、抢票失败原因、支付超时率、退款异常率、风控命中率、异常任务和对账差异处理链路。
- 已读取前端入口：`/console` 已展示待处理异常、最近对账批次、最新人工操作、热门活动、抢票失败原因、候补转化率、支付超时率、退款异常率、风控命中率，并可跳转 `/console/exception-tasks` 和 `/console/reconciliation`。
- 已读取后端实现：`ExceptionWorkbenchService` 当前支持创建和 resolve，但控制器没有暴露处理动作；`ReconciliationService` 当前支持生成批次、列表和详情，但没有处理/忽略差异动作，也没有批次完成收敛。
- 已读取本地库状态：`exception_task` 当前 `pending=5`、`resolved=1`；`reconciliation_difference` 当前 `open=1`。第一轮可直接用现有样本做处理闭环验收。
- 已更新 `task_plan.md` 与 `findings.md`，阶段 7 仍处于设计/实施口径确认中，尚未改业务代码。

## 2026-06-08 阶段 7：运营异常与对账闭环第一轮落地
- 已新增实施计划：`docs/superpowers/plans/2026-06-08-ops-exception-reconciliation-closure-plan.md`。
- 后端异常任务：新增 `ExceptionTaskActionRequest`，`ExceptionWorkbenchService` 支持 `claim`、`resolve`、`close`，状态机为 `pending -> processing -> resolved`，并允许 `pending/processing -> closed`；控制器暴露 `/api/user/console/exception-tasks/{id}/claim|resolve|close` 并写操作审计。
- 后端对账差异：`ReconciliationService` 支持 `resolveDifference`、`ignoreDifference`；差异从 `open` 进入 `resolved/ignored` 后，批次根据开放差异数收敛到 `processing/completed`；控制器暴露 `/api/user/console/reconciliation/batches/{batchNo}/differences/{differenceId}/resolve|ignore` 并写操作审计。
- 前端 API 与页面：`frontend/src/lib/api.ts` 新增异常任务和对账差异动作 wrapper；`/console/exception-tasks` 新增认领、标记已处理、关闭和行内处理结果输入；`/console/reconciliation` 批次详情差异记录新增标记已处理、忽略按钮。
- 展示补齐：`operation-display` 已识别新增操作审计 action、target type 和异常任务 `closed` 状态。
- 红灯验证：新增异常任务测试初次失败于缺 `claim/close` 与 `resolve` 返回值；新增对账测试初次失败于缺 `resolveDifference/ignoreDifference`；新增前端 API 测试初次失败于缺 `claimExceptionTask` 导出。
- 绿灯验证：`mvn -pl java-user -am "-Dtest=ExceptionWorkbenchServiceTest,ReconciliationServiceTest" "-Dsurefire.failIfNoSpecifiedTests=false" test` 通过，13 tests passed；`node --test --experimental-strip-types src/lib/api.test.ts src/lib/operation-display.test.ts` 通过，33 tests passed；`pnpm typecheck` 通过。
- 边界验证：`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过；`git diff --check` 退出码 0，仅 LF/CRLF warning。
- 运行态：先执行 `mvn -pl java-common install -DskipTests` 安装新增 common DTO；`java-user` 由用户重启后，标准 Gateway `8088` 和前端代理 `3000/api` 新增动作路由均不再 404，非法 ID 探针返回业务 `code=400`。
- 浏览器验收：登录平台管理员后，`/console` 可见待处理异常与最近对账入口；`/console/exception-tasks` 可见“认领”“关闭”，创建并认领本地 `STAGE7-VERIFY-*` 验收任务后可见“标记已处理”；验收后已将该任务标记为 `resolved` 并修正中文 reason/result；`/console/reconciliation` 打开 `REAL-DEMO-20260603` 批次详情后可见“标记已处理”“忽略”。
- 前端运行态缓存：容器内源码已更新但页面仍旧渲染，已将 `/app/.next/dev` 备份为 `/app/.next/dev-stale-20260608225257` 并重启 `omni-frontend`，随后页面按钮可见。

## 2026-06-09 阶段 7 后续路线恢复

- 根据当前 `task_plan.md`、`findings.md`、`progress.md` 和路线文档恢复上下文：阶段 7 第一轮异常任务 / 对账差异闭环已完成并标准端口验收。
- 已更新 `2026-06-06-platform-improvement-roadmap.md`：补阶段 7 第一轮状态，并把“建议下一步”从进入阶段 7 改为阶段 7 二轮只读运营漏斗摘要，再进入阶段 8 SaaS 评估。
- 已更新 `task_plan.md`：新增“2026-06-09 阶段 7 二轮：只读运营漏斗摘要”待办，明确不新增 MQ/ES/PostHog 埋点链路，先复用现有本地数据源。
- 已完成阶段 7 二轮轻量摸底：`/console` 当前分散拼装运营指标，`java-ticket` 已有 `AdminSummaryService` 和单活动营销漏斗，`grab-service` 已有 ops summary，本地 ticket/order/payment/grab 数据足够支撑第一版只读摘要。
- 已更新 `findings.md`：记录阶段 7 二轮数据源、当前本地样本和实现边界；后续代码实现不应在 `java-user` 跨库查表，应通过 internal API 聚合。

## 2026-06-09 阶段 7 二轮：只读运营漏斗摘要实现与验证

- 已新增实施计划：`docs/superpowers/plans/2026-06-09-platform-ops-funnel-summary-plan.md`。
- 后端实现：`java-ticket` 的 `AdminSummaryResponse` 增加 `interestCount`、`reminderCount`；`AdminSummaryService` 通过 `performance_subscription` 统计活动兴趣/提醒。`java-user` 新增 `PlatformOpsSummaryResponse`、ticket/payment/grab 聚合 client、`PlatformOpsSummaryService`，并在 `InternalWorkbenchController` 暴露 `GET /api/user/console/ops-summary`。
- 前端实现：`frontend/src/types/api.ts` 增加 `PlatformOpsSummaryVO`，`frontend/src/lib/api.ts` 增加 `getPlatformOpsSummary()`，`/console` 改为展示聚合后的“运营漏斗摘要”、热门活动、抢票失败、候补转化、支付超时、退款异常和风控命中。
- 红灯记录：`AdminSummaryServiceTest` 初次失败于缺少 `interestCount/reminderCount`；`PlatformOpsSummaryServiceTest` 初次失败于聚合 DTO/client/service 不存在；`api.test.ts` 初次失败于 `getPlatformOpsSummary` 未导出。
- 绿灯验证：`mvn -pl java-ticket "-Dtest=AdminSummaryServiceTest" test` 通过，7 tests；`mvn -pl java-user -am "-Dtest=PlatformOpsSummaryServiceTest,ExceptionWorkbenchServiceTest,ReconciliationServiceTest,InternalWorkbenchControllerOrganizerOpsTest" "-Dsurefire.failIfNoSpecifiedTests=false" test` 通过，22 tests。
- 前端验证：`node --test --experimental-strip-types src/lib/api.test.ts src/lib/operation-display.test.ts src/lib/console-ops.test.ts` 通过，35 tests；`pnpm typecheck` 通过。
- 边界与 diff 验证：`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过；`git diff --check` 退出码 0，仅保留既有 LF/CRLF warning。
- 标准端口探测：`POST http://localhost:8088/api/user/login` 返回业务 `code=200`，但 `GET http://localhost:8088/api/user/console/ops-summary` 和直连 `http://localhost:8081/api/user/console/ops-summary` 均返回 HTTP 404。端口诊断显示标准 `8081` / `8082` Java 进程启动时间早于本轮 class 编译时间；Codex 尝试停止 `8081` 进程时被系统返回 `Access is denied`。
- 隔离端口验证：启动 `java-ticket:18082` 和 `java-user:18081` 直连当前代码，`GET http://localhost:18081/api/user/console/ops-summary` 返回业务 `code=200`；直连 `GET http://localhost:18082/api/ticket/admin/summary` 返回业务 `code=200`，其中 `interestCount=1`、`reminderCount=0`，聚合 funnel 中 `interest=1`、`reminder=0`。
- 用户重启真实标准端口 `java-ticket` 和 `java-user` 后，Gateway `GET http://localhost:8088/api/user/console/ops-summary` 返回业务 `code=200`；直连 `8081` 聚合接口和直连 `8082` ticket 摘要均返回业务 `code=200`。结果包含 `funnelSteps=9`、`interest=1`、热门活动 5 个、抢票失败原因 8 个、待处理异常 5 个。
- 标准前端代理 `GET http://localhost:3000/api/user/console/ops-summary` 返回业务 `code=200`，`funnelSteps=9`、`interest=1`、热门活动 5 个、`errors=0`。
- 浏览器验收：登录平台管理员后访问 `http://localhost:3000/console`，可见“运营漏斗摘要”，包含想看/候补、开售提醒、下单、支付、支付超时、退款申请、退款异常、抢票失败、候补支付；同时可见热门活动、抢票失败原因、候补转化率、支付超时率、退款异常率、风控命中率，浏览器 console 无 warn/error。
- 前端运行态修复：`omni-frontend` 容器内源码已有“运营漏斗摘要”，但旧 `/app/.next/dev/server/app/console/page.js` 未包含该文本；已将 `/app/.next/dev` 备份为 `/app/.next/dev-stale-20260609102950` 并重启 `omni-frontend`，重新加载后页面渲染当前代码。

## 2026-06-09 阶段 8 第一轮：Sentry / PostHog 评估文档

- 已基于官方资料核对 Sentry / PostHog 当前免费额度、Next.js / JavaScript 接入方式和关键开关；本轮只浏览公开官方文档，不创建外部账号。
- 已新增 `docs/production-readiness/sentry-evaluation-and-trial-plan.md`：限定第一轮只评估前端错误监控和 release 标识，明确禁止上传 token、手机号、证件号、观演人姓名、动态入场码、支付参数、完整订单上下文和客服正文。
- 已新增 `docs/production-readiness/posthog-evaluation-and-trial-plan.md`：限定第一轮只做 allowlist 自定义事件设计，禁用 autocapture、Session Replay、Feature Flags、Experiments、Surveys、Error Tracking 和服务端采集。
- 已更新 `task_plan.md`、`findings.md` 和 roadmap：标记阶段 8 第一轮评估文档已完成，同时保留后续 SDK 试点接入为待授权事项。
- 本轮未安装 `@sentry/nextjs`、`posthog-js` 或其他外部 SDK；未修改 `package.json` / lockfile；未新增环境变量真实值；未写入任何外部 SaaS。

## 2026-06-09 阶段 8 第二轮：Sentry 优先试点计划

- 已按用户口径确认阶段 8 顺序：先接 Sentry 保证线上问题可追，PostHog 后续按产品分析需求再接。
- 已新增 Sentry 第二轮试点实施计划：`docs/superpowers/plans/2026-06-09-sentry-first-trial-plan.md`。
- 计划拆分为：本地脱敏/开关纯函数、`@sentry/nextjs` 安装授权、Next.js gated 初始化、disabled 态无外部请求验收、授权启用态测试错误验收和收尾计划文件更新。
- 本条记录创建计划时尚未安装 `@sentry/nextjs`；随后用户说“继续”，按授权进入依赖安装和 disabled 态试点。
- 已执行 Sentry 第二轮前半段：新增 `frontend/src/lib/sentry-sanitizer.ts` 和 `frontend/src/lib/sentry-sanitizer.test.ts`，红灯为缺少 `sentry-sanitizer.ts`；补实现后 `node --test --experimental-strip-types src/lib/sentry-sanitizer.test.ts` 通过 3 tests。
- 已安装 `@sentry/nextjs` 10.56.0，修改 `frontend/package.json` 与 `frontend/pnpm-lock.yaml`；安装时 pnpm 因 `@sentry/cli` build script 被忽略返回非 0，本轮不上传 source map，随后执行 `pnpm approve-builds "!@sentry/cli"` 明确拒绝该 build script。
- 已新增 `frontend/instrumentation-client.ts`、`frontend/sentry.server.config.ts`、`frontend/sentry.edge.config.ts`，并用 `withSentryConfig` 包装 `frontend/next.config.ts`；默认 `NEXT_PUBLIC_SENTRY_ENABLED=false` / DSN 空时不初始化发送。
- 类型修复记录：`Sentry` 的事件类型里 `request.query_string` 和 `tags` 比本地测试对象更宽，已放宽 `SentryLikeEvent` 类型以适配官方 SDK；`pnpm typecheck` 随后通过。
- Sentry disabled 态浏览器验收：临时启动 `http://localhost:3002`，以平台管理员 `13800000001` 登录 `/console`，可见“运营漏斗摘要”；浏览器 warning/error 为 0，resource entries 没有 `sentry` / `ingest` 请求；验收后已停止 3002 临时进程。
- 启用态测试错误验收尚未执行：需要用户在本机提供真实 `NEXT_PUBLIC_SENTRY_DSN`，且不要在聊天中输出 DSN。
- 收尾验证：`node --test --experimental-strip-types src/lib/sentry-sanitizer.test.ts src/lib/api.test.ts src/lib/operation-display.test.ts src/lib/console-ops.test.ts` 通过 38 tests；`pnpm typecheck` 通过；`git diff --check` 退出码 0，仅既有 LF/CRLF warning；`netstat` 确认 3002 无残留监听。
- `pnpm exec next build` 编译、TypeScript 和静态页生成已通过，但最后在 Windows 复制 standalone traced files 时因创建 symlink 被系统拒绝，报 `EPERM: operation not permitted, symlink ...`；这是当前 Windows 权限/standalone 输出限制，不是 Sentry 初始化或 TypeScript 编译错误。
- 本轮继续补强：发现 `sentry.server.config.ts` / `sentry.edge.config.ts` 虽然默认 gated disabled，但启用时未复用 browser 端 `beforeSend` / `beforeBreadcrumb` 脱敏；已新增 `getSentryServerConfig` 和 `scrubSentryBreadcrumb`，并接入 browser/server/edge 三处配置。
- 红灯记录：新增 `sentry-sanitizer.test.ts` 中 server/edge gated config 和 breadcrumb 脱敏测试后，首次运行 `node --test --experimental-strip-types src/lib/sentry-sanitizer.test.ts` 因缺少 `getSentryServerConfig` 导出失败，符合预期。
- 绿灯验证：补实现后 `node --test --experimental-strip-types src/lib/sentry-sanitizer.test.ts` 通过 5 tests；回归 `node --test --experimental-strip-types src/lib/sentry-sanitizer.test.ts src/lib/api.test.ts src/lib/operation-display.test.ts src/lib/console-ops.test.ts` 通过 40 tests；`pnpm typecheck` 通过。
- 启用态测试错误验收仍未执行：仍需要真实 `NEXT_PUBLIC_SENTRY_DSN`，且不要在聊天中输出 DSN。

## 2026-06-09 阶段 8 第三轮：PostHog allowlist 本地外壳

- 当前口径：先做 PostHog 产品分析试点的本地安全外壳，不安装 `posthog-js`，不创建外部项目，不写真实 token/host，不产生外部网络写入。
- 已新增执行记录：`docs/superpowers/plans/2026-06-09-posthog-allowlist-wrapper-plan.md`。
- 已新增 `frontend/src/lib/analytics.test.ts`：覆盖禁用态配置、未知事件丢弃、allowlist 属性过滤、敏感标识和 URL query 丢弃、disabled/no transport 不发送、enabled transport 只发送脱敏事件。
- 红灯记录：首次运行 `node --test --experimental-strip-types src/lib/analytics.test.ts` 因缺少 `frontend/src/lib/analytics.ts` 失败，符合预期。
- 已新增 `frontend/src/lib/analytics.ts`：提供 `getAnalyticsClientConfig()`、`sanitizeAnalyticsEvent()`、`createAnalyticsTracker()` 和可注入 `AnalyticsTransport`；默认 `personProfiles='never'`，autocapture/pageview/Session Replay 默认关闭。
- 绿灯验证：`node --test --experimental-strip-types src/lib/analytics.test.ts` 通过 5 tests；回归 `node --test --experimental-strip-types src/lib/analytics.test.ts src/lib/sentry-sanitizer.test.ts src/lib/api.test.ts src/lib/operation-display.test.ts src/lib/console-ops.test.ts` 通过 45 tests；`pnpm typecheck` 通过。
- 本轮未修改 `frontend/package.json` 或 `frontend/pnpm-lock.yaml`，未安装 `posthog-js`；后续 SDK transport 接入和真实 PostHog token/host 验收仍需用户单独授权。
## 2026-06-09 阶段 8 第四轮：PostHog 页面级 no-op 接入

- 当前口径：继续保持无 SDK、无真实 token/host、无外部网络写入，只把页面调用接到本地 wrapper。
- 红灯记录：新增 `frontend/src/lib/analytics-page-integration.test.ts` 并扩展 `analytics.test.ts` 后，首次运行 `node --test --experimental-strip-types src/lib/analytics.test.ts src/lib/analytics-page-integration.test.ts` 失败；失败点为缺少 `captureAnalyticsEvent` 导出和四个页面未接 `@/lib/analytics`，符合预期。
- 已更新 `frontend/src/lib/analytics.ts`：新增 `captureAnalyticsEvent()`、默认 tracker 和 `setAnalyticsTransport()`；未配置 enabled/token/host/transport 时保持 no-op 并返回 `false`。
- 已在 `frontend/src/app/search/page.tsx`、`frontend/src/app/activity/[id]/page.tsx`、`frontend/src/app/orders/page.tsx`、`frontend/src/app/console/page.tsx` 接入 allowlist 事件；页面不传搜索原词、订单号、用户号、conversationId、URL query 或自由文本。
- 绿灯验证：`node --test --experimental-strip-types src/lib/analytics.test.ts src/lib/analytics-page-integration.test.ts` 通过 9 tests。
- 回归验证：`node --test --experimental-strip-types src/lib/analytics.test.ts src/lib/analytics-page-integration.test.ts src/lib/sentry-sanitizer.test.ts src/lib/api.test.ts src/lib/operation-display.test.ts src/lib/console-ops.test.ts` 通过 49 tests；`pnpm typecheck` 通过。
- `rg -n "posthog-js|posthog" frontend/package.json frontend/pnpm-lock.yaml frontend/src frontend/instrumentation-client.ts frontend/next.config.ts` 只命中测试里的 PostHog host 字符串，未新增 `posthog-js` 依赖。
- 标准 `3000` 浏览器验收：本地启动 `pnpm dev` 后访问 `/search`、`/activity/900002`、`/orders`、`/console` 均可渲染关键内容，浏览器 console error 为 0，页面性能资源中未发现 `posthog` / `ingest` / `capture` / `decide` 类请求。
- Fresh 收尾验证：`node --test --experimental-strip-types src/lib/analytics.test.ts src/lib/analytics-page-integration.test.ts` 通过 9 tests；`pnpm typecheck` 通过；`git diff --check` 退出码 0，仅保留既有 LF/CRLF warning；扫描仍未发现 `posthog-js` 依赖。

## 2026-06-09 阶段 9 第一轮：入场核验同步标准端口收口

- 恢复路线：阶段 9 先处理前端入口与种子数据治理中已落地的入场核验同步闭环，不把 Web 扫码验票页作为常规主流程。
- 数据库核验：`omni_order.check_in_device` 和 `omni_order.ticket_check_in_record` 存在；`electronic_ticket` 状态分布为 `1=26`、`2=3`、`3=1`、`4=1`；`ticket_check_in_record` 结果分布为 `DUPLICATE=1`、`FAILED=1`、`SUCCESS=1`。
- 后端验证：`mvn -pl java-order "-Dtest=TicketEntryCodeCodecTest,TicketCheckInServiceTest,OrderControllerInternalCheckInTest,TicketWalletServiceTest" test` 通过，23 tests；`mvn -pl java-ticket "-Dtest=CheckInAdminQueryServiceTest,AdminControllerCheckInTest" test` 通过，8 tests。
- 前端验证：`node --test --experimental-strip-types src/lib/api.test.ts src/lib/console-auth.test.ts src/lib/console-paths.test.ts` 通过，46 tests；`pnpm typecheck` 通过。
- 标准 API 验收：平台管理员 `13800000001` 和主办方 `13800000002` 经 Gateway `8088` 查询 `sessionId=910011` 均返回业务 `code=200`，概览为 `total=1`、`checked=1`、`unused=0`、`failed=1`、`duplicate=1`，记录为 `DUPLICATE`、`FAILED`、`SUCCESS` 三条；普通用户 `13900000001` 被业务 `403 无权限` 拒绝。
- 标准前端代理验收：`http://localhost:3000/api/ticket/admin/check-in/overview?sessionId=910011` 和 records 接口返回同样业务结果。
- 浏览器验收：`http://localhost:3000/console/check-in` 使用平台管理员登录态查询 `910011`，页面可见总票数 1、已验票 1、未入场 0、失败 1、重复扫码 1，并展示 `REAL-CHECKIN-FAILED-983013`、`REAL-CHECKIN-DUPLICATE-983013`、`REAL-CHECKIN-SUCCESS-983013`；浏览器 console error 为 0。
- 边界和 SQL 验证：`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过；`powershell -ExecutionPolicy Bypass -File scripts\check-production-split-sql.ps1` 通过；`git diff --check` 退出码 0，仅保留既有 LF/CRLF warning。
- 注意：`verify-microservice-boundaries.ps1` 的测试日志里包含 ES 不可用、用户服务 timeout 等预期 error log，但 Maven 为 BUILD SUCCESS，脚本最终 PASS。

## 2026-06-09 阶段 9 第二轮：全角色旅程审计

- 本轮只做只读审计，不触发审核、退款、删除、对账处理等写动作；审计目标是确认标准 Gateway、标准前端、RBAC、默认落点和 real-demo seed 是否支撑 6 类角色演示。
- 已新增审计文档：`docs/production-readiness/role-journey-audit.md`，覆盖普通用户、主办方、客服主管、普通客服、平台主办方运营员、平台管理员。
- Gateway 登录探针通过：`13800000001` 返回 `platform_super_admin`；`13800000002` 返回 `organizer`；`13900000001` 返回 `user`；`13910000002` 返回客服主管权限；`13910000003` 返回普通客服权限；`13910000004` 返回 `organizer_admin` 和平台主办方运营权限。
- 标准前端浏览器默认落点通过：平台管理员进入 `/console` 可见“平台后台”“运营漏斗摘要”；主办方进入 `/console` 可见“主办方后台”“快捷操作”；普通用户进入 `/` 可见“猜你喜欢”；客服主管进入 `/console/support-accounts`；普通客服进入 `/support`；平台主办方运营员进入 `/console/organizer-ops`。上述关键页面 console error 均为 0。
- 普通用户只读 API 具备演示数据：订单 45 条、票夹 16 条、退款 4 条、候补 17 条、通知 2 条、客服会话 2 条。
- 平台管理员只读 API 具备演示数据：运营摘要 9 个漏斗步骤、异常任务 7 条、对账批次 3 条、评价待审 2 条、入场核验概览可查、客服账号 4 个、主办方运营分配 4 条。
- 主办方只读 API 部分通过：活动 5 条、场次 5 条、订单 638 条、入场核验概览可查；但 `GET /api/payment/refunds/admin` 返回 0 条，需要补主办方退款 seed 或排查归属链路。
- 客服链路部分通过：客服主管可见客服账号 4 个、关闭会话 11 条和用户上下文；普通客服可见关闭会话 1 条和用户上下文，但 `/support` 默认待处理队列为 0，需要补 `WAITING_AGENT` 或 `ASSIGNED` 会话 seed。
- 平台主办方运营员只读 API 通过：分配 4 条、运营员账号 2 个、主办方 `2003` 跟进记录 3 条、评价管理 2 条、入场核验概览可查。
- 当前缺口已记录为 P1：主办方退款处理入口可达但列表为空；普通客服默认待处理队列无演示数据。P2：写动作旅程尚未回归，`/notifications/settings` 本轮未做浏览器复测。

## 2026-06-09 阶段 9 第二轮：P1 seed 缺口修复与复测

- 根因确认：现有退款 seed `985001-985008` 对应订单归属主办方 `2007`，所以主办方 `2003` 的 `/console/refunds` 为空；现有客服上下文会话 `988101` 已是 `CLOSED`，普通客服 `/support` 默认 pending 队列为空。
- RED 验证：先在 `scripts/verify-prod-split-real-demo-seed.ps1` 增加主办方退款样本和普通客服默认待处理样本的关键字断言，初次运行因缺少 `REFREAL985009` / `988102` 失败。
- seed 修复：`03-payment.sql` 新增 `REFREAL985009`，关联 `order_id=980006`、`payment_id=984006`、`sessionId=910006`、`activityId=900006`、主办方 `2003`；`04-user-ops.sql` 新增 `988102` `WAITING_AGENT` 未分配会话和消息，主题指向 `DMREAL980006` / `REFREAL985009`。
- 导入失败修复：首次本地导入在 `support_conversation_audit` 约束处失败，原因是 `REQUEST_HUMAN` 不在 `chk_support_conversation_audit_action` 允许值中；已改为 `TRANSFERRED`，不放宽 schema 约束。
- SLA 漂移修复：浏览器首轮发现 `988102` 被前端归入“超时”而非默认“待处理”，原因是 seed 的 `last_user_message_at` 会触发 `userWaitingSeconds > 10min`；已清空该演示会话的 SLA 计时字段，API 返回 `slaOverdue=false`。
- 本地导入与 DB 验证：`scripts\apply-prod-split-real-demo-seed.ps1 -ConfirmApply` 完整导入 6 个 seed 文件；`omni_payment.refund_request` 存在 `985009|980006|REFREAL985009|0|440.00`；`omni_user.support_conversation` 存在 `988102|WAITING_AGENT|assigned_agent_id NULL`。
- Gateway API 验证：主办方 `GET /api/payment/refunds/admin` 返回 1 条，包含 `REFREAL985009`；普通客服 `GET /api/user/support/agent/conversations?queue=pending` 返回 1 条，包含 `988102` 且 `slaOverdue=false`；`GET /api/user/support/agent/conversations/988102/context` 返回 `code=200`，上下文含订单、退款、票夹、候补、抢票和通知。
- 浏览器验证：主办方登录 `/console/refunds` 可见 `REFREAL985009` 待审核退款和同意/拒绝按钮；普通客服登录 `/support` 默认显示“待处理 1”，会话 `DMREAL980006` / `REFREAL985009` 可见，右侧上下文分区可见。

## 2026-06-09 阶段 9 第三轮：可回滚写动作验收

- 写动作边界确认：未使用“同意退款”，因为 `RefundService.approve()` 会构造 `AlipayTradeRefundRequest` 并可能调用外部 Alipay 退款接口；本轮使用本地可回滚的“拒绝退款”验证退款审核写路径。
- 主办方 `13800000002` 经 Gateway 调用 `POST /api/payment/refunds/985009/reject`，请求体为 `{"reviewNote":"阶段9写动作验收：拒绝退款路径"}`；接口返回业务 `code=200`，DB 曾确认 `refund_request 985009` 为 `status=2`、`reviewer_id=2003`。
- 普通客服 `13910000003` 经 Gateway 调用 `POST /api/user/support/agent/conversations/988102/claim`；接口返回业务 `code=200`，DB 曾确认 `support_conversation 988102` 为 `ASSIGNED|2020`。
- 平台管理员 `13800000001` 经 Gateway 查询 `REAL-DEMO-20260603` 当前开放差异后调用 `POST /api/user/console/reconciliation/batches/REAL-DEMO-20260603/differences/{id}/resolve`；接口返回业务 `code=200`，DB 曾确认该差异进入 `resolved`。
- 已执行 `powershell -ExecutionPolicy Bypass -File scripts\apply-prod-split-real-demo-seed.ps1 -ConfirmApply` 重新导入 6 个 seed 文件，恢复演示基线。
- 恢复后 DB 基线曾确认：`refund_request 985009` 回到 `status=0` 且 reviewer/review note 为空；`support_conversation 988102` 回到 `WAITING_AGENT` 且未分配；`REAL-DEMO-20260603` 重新生成 1 条 `open` 差异。
- 注意：对账差异 ID 会在重新导入 seed 后变化，后续验收应按 `batch_no='REAL-DEMO-20260603' AND status='open'` 查询当前 ID，不要硬编码旧 ID。
- Fresh 收尾复验：`powershell -ExecutionPolicy Bypass -File scripts\verify-prod-split-real-demo-seed.ps1` 通过，输出 real-demo seed 校验通过；DB 当前基线为 `985009|0|NULL|NULL`、`988102|WAITING_AGENT|NULL`、`10|REAL-DEMO-20260603|open|退款异常，渠道结果未知`。
- Gateway 基线复验：主办方 `GET /api/payment/refunds/admin` 返回业务 `code=200` 且命中 `REFREAL985009,status=0`；普通客服 `GET /api/user/support/agent/conversations?queue=pending` 返回业务 `code=200` 且命中 `988102,status=WAITING_AGENT,slaOverdue=false`；`GET /api/user/support/agent/conversations/988102/context` 返回业务 `code=200`。
- `git diff --check` 退出码 0，仅保留既有 LF/CRLF warning。

## 2026-06-09 阶段 9 第四轮：通知偏好页浏览器复测

- 目标：关闭阶段 9 P2 中 `/notifications/settings` 普通用户浏览器未复测缺口；本轮只读查看，不点击保存或更改通知偏好。
- 内置浏览器登录受工具层虚拟剪贴板和只读 page evaluate 限制阻塞，已切换到独立 Playwright 浏览器完成本地页面验证。
- 普通用户 `13900000001` 登录态写入成功，返回 `userId=2004,role=user`；访问 `http://localhost:3000/notifications/settings` 后页面可见“通知偏好”。
- 页面中文状态通过：可见“站内消息保持开启，短信通道接入前不可启用。”、“站内通知已开启”、“短信通知未开启”和“查看消息”入口。
- 状态按钮验证：`站内通知已开启` 与 `短信通知未开启` 均为 disabled，本轮未触发任何保存写动作。
- 浏览器 console 复验：warning/error 均为 0。

## 2026-06-09 阶段 9 第五轮：授权同意退款实测与支付宝 page-pay 弹窗

- 用户已明确授权真实 Alipay sandbox 退款同意路径；本轮不做 mock/sandbox 隔离。
- 主办方 `13800000002` 经 Gateway 调用 `POST /api/payment/refunds/985009/approve`，首轮返回业务 `code=200`，但退款进入失败态：DB 显示 `985009|status=3|reviewer_id=2003|alipay_refund_no NULL`，说明 Alipay refund 调用被触发但 sandbox 结果失败。
- 为获取 raw response 再次实测同一路径时，Gateway 返回 HTTP 504，临时 DB 状态为 `985009|status=4|reviewer/review_note/alipay_refund_no NULL`；判断 sandbox 链路存在不稳定/超时，不能把同意退款标为业务通过。
- 两次实测后均执行 `powershell -ExecutionPolicy Bypass -File scripts\apply-prod-split-real-demo-seed.ps1 -ConfirmApply` 并运行 `scripts\verify-prod-split-real-demo-seed.ps1`，最终确认 `refund_request 985009` 回到 `status=0` 且 reviewer/review note 为空。
- 针对支付宝沙盒二维码获取不及时，新增 `frontend/src/lib/alipay-modal-integration.test.ts`，RED 失败点确认弹窗仍读取 `pay.qrCode`，且 `/orders`、`/activity/[id]`、`/teams/[id]` 仍调用 `createAlipayQrPay()`。
- 前端实现已切到 page-pay：三个支付入口改为 `createAlipayPagePay()`；`AlipayQrPayModal` 改用 `PagePayResponse.payForm` 生成本地 `blob:` HTML 支付页链接，弹窗仍保留“我已完成付款”轮询确认。
- 前端回归：`node --test --experimental-strip-types src/lib/api.test.ts src/lib/alipay-modal-integration.test.ts src/lib/analytics-page-integration.test.ts` 通过 38 tests；`pnpm typecheck` 通过。
- 浏览器验收：普通用户当前无待支付订单，临时创建本地待支付订单 `980056 / DM2026060915311573D052` 后，在标准 `3000` 的 `/orders` 点击“立即支付”，弹窗可见“打开支付宝沙盒支付页面”；链接 `href` 为 `blob:`，`target="_blank"`，`rel="noreferrer"`，二维码 canvas/QR SVG 数量为 0。
- 临时订单清理：Gateway `DELETE /api/order/980056` 曾返回 HTTP 504；随后直连 `java-order:8083` 同一路径返回业务 `code=200`，复查订单状态为 `status=3` 已取消。

## 2026-06-09 阶段 10 第一轮：默认配置与演示降级风险审计

- 已进入阶段 10 生产前全链路整顿的低风险入口：先扫描默认密钥、固定验证码、mock/offline 降级和 sandbox 依赖，不触发真实外部账号写入。
- P0 修复采用 TDD：先把 `nestjs/grab-service/src/auth/jwt-auth.guard.spec.ts` 改为期望缺少 `JWT_SECRET` 时拒绝；首轮 `npm test -- jwt-auth.guard.spec.ts` 失败，失败点为旧 `DEFAULT_JWT_SECRET` 仍会放行 token。
- 已移除 `nestjs/grab-service/src/auth/jwt-auth.guard.ts` 中的硬编码 `DEFAULT_JWT_SECRET` fallback；缺少 `JWT_SECRET` 时抛出 `JWT 未配置`，正常配置密钥的 token 仍可通过。
- 绿灯验证：`npm test -- jwt-auth.guard.spec.ts` 通过，3 tests passed。
- 已新增 `docs/production-readiness/production-defaults-audit.md`，记录已关闭的 grab-service 默认 JWT 风险，以及仍待处理的固定短信验证码、Java 默认 internal token / 数据库密码、本地 Compose 默认值和 Alipay sandbox 不稳定项。
- 固定短信验证码 P0 采用红绿修复：先新增默认禁用/显式 mock enabled 测试，红灯曾在 Maven 编译阶段暴露生产构造器未补齐；随后 `UserService` 和 `UserController` 均接入 `omni.sms.mock.enabled=false` 默认开关。
- `UserController.sendCode()` 默认返回业务 `400 当前环境未启用短信验证码`，仅显式 mock enabled 时返回 `666666`；`UserService` 的短信登录、重置密码、修改密码也仅在 mock enabled 时接受固定码。
- `start-project.ps1` 仅对本地 `java-user` 启动参数注入 `--omni.sms.mock.enabled=true`，保留本地演示可用性；前端登录、找回密码、账号设置页移除固定 `666666` 静态提示，本轮后即使后端返回 code 也不再展示本地演示验证码。
- 验证：`mvn -pl java-user -am "-Dtest=UserServiceTest,UserAuthRegistrationCoverageTest,UserControllerSentinelTest,UserControllerInternalTest" "-Dsurefire.failIfNoSpecifiedTests=false" test` 通过，51 tests；`pnpm typecheck` 通过；`npm test -- jwt-auth.guard.spec.ts` 通过，3 tests。
- 扫描：`rg` 确认前端源码中不再存在固定验证码提示，剩余 `666666` 命中仅为 CSS 色值 `#666666`；`docs/production-readiness/production-defaults-audit.md` 和 `task_plan.md` 已同步标记短信固定码 P0 关闭。
- Java prod-split 默认值守护采用红绿检查：新增 `scripts/check-production-runtime-defaults.ps1` 后首次运行失败于 `java-user prod-split: internal.api.token must require INTERNAL_API_TOKEN without fallback`，证明基础 `application.yml` 的本地 token fallback 会被继承。
- 已在 `java-user`、`java-ticket`、`java-order`、`java-payment` 的 `application-prod-split.yml` 显式增加 `internal.api.token: ${INTERNAL_API_TOKEN}`；五个业务服务的 prod-split datasource password 均继续要求 `${SPRING_DATASOURCE_PASSWORD}`。
- 新检查已接入 `scripts/verify-microservice-boundaries.ps1`，完整边界验收通过；其中新增的 “Production runtime default guard” 检查确认四个 internal token 服务和五个 datasource 服务都无 prod-split fallback。
- 阶段 10 文档已更新：Java prod-split 默认值守护关闭；Docker Compose 本地默认 `JWT_SECRET` / `INTERNAL_API_TOKEN` 进入生产模板边界收口。
- Compose 生产边界已落地：root `docker-compose.yml` 顶部新增 `x-omni-compose-scope: local-development-only`；新增 `docker-compose.production.example.yml`，敏感变量使用 `${VAR:?VAR is required}`，不提供 `JWT_SECRET`、`INTERNAL_API_TOKEN`、`GRAB_DB_PASSWORD`、`RABBITMQ_PASSWORD` fallback。
- `scripts/check-production-runtime-defaults.ps1` 已扩展检查 Compose 边界：要求 root compose 标记本地用途，要求生产 example 对敏感变量显式必填，并阻断 `omni-local-*`、`123456` 和敏感值 fallback。
- 验证记录：`powershell -ExecutionPolicy Bypass -File scripts\check-production-runtime-defaults.ps1` 通过；`docker compose -f docker-compose.yml config --quiet` 通过；带临时示例环境变量的 `docker compose -f docker-compose.production.example.yml config --quiet` 通过；`scripts\verify-microservice-boundaries.ps1` 已通过，其中 Maven boundary tests 为 `Tests run: 89, Failures: 0, Errors: 0`。

## 2026-06-09 阶段 10 第二轮：Alipay 生产配置默认值边界

- 范围确认：默认 `application.yml` 继续保留本地 Alipay sandbox fallback 供演示使用，但 `java-payment` 的 `prod-split` 不能继承 sandbox appId、商户私钥、公钥、localhost return-url 或 QR mock fallback。
- 红灯验证：先扩展 `scripts/check-production-runtime-defaults.ps1` 检查 Alipay prod-split 配置；首次脚本语法插值错误已修正，随后红灯准确失败于 `java-payment prod-split: alipay.notify-url must require ALIPAY_NOTIFY_URL without fallback`。
- 修复：`java/java-payment/src/main/resources/application-prod-split.yml` 显式要求 `ALIPAY_GATEWAY_URL`、`ALIPAY_APP_ID`、`ALIPAY_MERCHANT_PRIVATE_KEY`、`ALIPAY_PUBLIC_KEY`、`ALIPAY_RETURN_URL`、`ALIPAY_NOTIFY_URL`，并将 `mock-qr-fallback-enabled`、`mock-qr-auto-confirm-enabled` 固定为 `false`。
- 绿灯验证：`powershell -ExecutionPolicy Bypass -File scripts\check-production-runtime-defaults.ps1` 通过，输出包含 `PASS java-payment prod-split Alipay config requires explicit environment`。

## 2026-06-09 阶段 10 第三轮：Java 订单/通知 JWT 默认密钥收口

- 发现：`java-order` 和 `java-notification` 控制器仍通过 `@Value("${jwt.secret:${JWT_SECRET:omni-jwt-secretomni-jwt-secretomni-jwt-secret}}")` 继承硬编码 JWT fallback；这会让缺少 JWT 配置的环境继续接受可猜默认 token。
- RED 验证：扩展 `scripts/check-production-runtime-defaults.ps1`，先扫描生产 Java 源码中的硬编码 JWT fallback，并要求 `java-order` / `java-notification` 的 prod-split 配置显式要求 `JWT_SECRET`；首次运行失败于 `java-order` 源码命中默认密钥。
- 修复：`OrderController` 和 `NotificationController` 的 `@Value` 改为 `${jwt.secret:${JWT_SECRET:}}`，并在解析 JWT 前显式判断 `jwtSecret` 非空；缺少配置时公共接口按未登录处理，不使用默认密钥。
- 配置：`java/java-order/src/main/resources/application-prod-split.yml` 和 `java/java-notification/src/main/resources/application-prod-split.yml` 增加 `jwt.secret: ${JWT_SECRET}`，生产 profile 缺少环境变量时不再继承本地默认。
- 守护脚本：`scripts/check-production-runtime-defaults.ps1` 现在同时检查生产 Java 源码无硬编码 JWT fallback、`java-order` / `java-notification` prod-split 显式要求 `JWT_SECRET`、Alipay prod-split、Compose 生产模板和原有 datasource/internal token 边界。
- 定向验证：`mvn -pl java-order "-Dtest=OrderControllerPublicAuthTest,OrderControllerInternalCreateTest,OrderControllerInternalCheckInTest,OrderControllerInternalSeatUsageTest" test` 通过，41 tests；`mvn -pl java-notification "-Dtest=NotificationControllerAuthTest,NotificationServiceFullTest" test` 通过，32 tests。
- 收口验证：`powershell -ExecutionPolicy Bypass -File scripts\check-production-runtime-defaults.ps1` 通过；`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过，包含 `Production runtime default guard` 和 Java boundary tests `Tests run: 89, Failures: 0, Errors: 0`；`git diff --check` 退出码 0，仅有既有 LF/CRLF warning。

## 2026-06-09 阶段 10 第四轮：生产环境变量注入清单与 notification internal token

- 会话恢复：`session-catchup.py` 检测到上轮 handoff 和 37 条未同步上下文；已按建议运行 `git diff --stat` 并重新读取 `task_plan.md`、`progress.md`、`findings.md`。
- 环境变量扫描发现 `java-notification` 的 `NotificationController` 存在 `/api/notification/internal/messages`、`/api/notification/internal/events`、`/api/notification/internal/users/{userId}/notifications` 三类 internal token 接口，但 `application-prod-split.yml` 此前没有 `internal.api.token` 覆盖。
- RED 验证：先把 `java-notification` 加入 `scripts/check-production-runtime-defaults.ps1` 的 internal token 服务清单，首次运行失败于 `FAIL java-notification prod-split: internal.api.token must require INTERNAL_API_TOKEN without fallback`。
- 修复：`java/java-notification/src/main/resources/application-prod-split.yml` 增加 `internal.api.token: ${INTERNAL_API_TOKEN}`，使生产 profile 缺少 token 时不再继承空值或本地默认。
- RED 验证：继续扩展 `scripts/check-production-runtime-defaults.ps1` 要求 `docs/production-readiness/production-env-vars.md` 存在并覆盖关键生产环境变量；首次运行失败于缺少该清单文件。
- 已新增 `docs/production-readiness/production-env-vars.md`，按 Java 服务、Gateway、Alipay、Seata、RabbitMQ、grab-service、frontend/Sentry/PostHog 分组列出生产注入要求，不包含任何真实密钥或 token 值。
- 脚本修正：首次文档检查使用 PowerShell 正则匹配 Markdown 反引号变量名不稳，已改为直接查找反引号包裹的变量名；随后 `powershell -ExecutionPolicy Bypass -File scripts\check-production-runtime-defaults.ps1` 通过。
- 记录的工具错误：一次 `rg` 因 PowerShell 双引号解析失败；一次 `rg docker-compose*.yml` 因 Windows 文件名通配写法失败。均已换用单引号/明确文件路径继续，不影响代码状态。
- 收口验证：`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过，包含 `Production runtime default guard`，Java boundary tests `Tests run: 89, Failures: 0, Errors: 0`；最终 `git diff --check` 退出码为 0，仅保留既有 LF/CRLF warning。

## 2026-06-09 阶段 10 第五轮：Java RabbitMQ 生产默认值收口

- 风险确认：`java-user`、`java-ticket`、`java-order`、`java-notification` 的基础 `application.yml` 都存在 `RABBITMQ_HOST:localhost`、`RABBITMQ_USER:admin`、`RABBITMQ_PASSWORD:123456` 本地 fallback；`java-payment` 虽然没有显式 RabbitMQ 配置，但 `java-common` 引入 `spring-boot-starter-amqp` 且 `java-payment` 有 `NotificationMqProducer(RabbitTemplate)`。
- RED 验证：扩展 `scripts/check-production-runtime-defaults.ps1` 要求五个 Java 业务服务 `prod-split` 都显式覆盖 `spring.rabbitmq.host/port/username/password`；首次运行失败于 `FAIL java-user prod-split: spring.rabbitmq.port must require RABBITMQ_PORT without fallback`。
- 修复：`java-user`、`java-ticket`、`java-order`、`java-payment`、`java-notification` 的 `application-prod-split.yml` 均增加 `spring.rabbitmq.host: ${RABBITMQ_HOST}`、`port: ${RABBITMQ_PORT}`、`username: ${RABBITMQ_USER}`、`password: ${RABBITMQ_PASSWORD}`。
- 文档 RED：把 `RABBITMQ_HOST` / `RABBITMQ_PORT` 加入生产环境变量文档守护后，脚本失败于 `production environment variable checklist must document RABBITMQ_HOST`。
- 文档修复：`docs/production-readiness/production-env-vars.md` 补齐 `RABBITMQ_HOST`、`RABBITMQ_PORT`，并把 `java-payment` 纳入 RabbitMQ 注入清单，说明退款通知事件使用 RabbitMQ。
- 当前绿灯：`powershell -ExecutionPolicy Bypass -File scripts\check-production-runtime-defaults.ps1` 通过，输出五个 Java 服务的 `prod-split RabbitMQ config requires explicit environment`。
- 收口验证：`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过，包含 `Production runtime default guard`，Java boundary tests `Tests run: 89, Failures: 0, Errors: 0`；`git diff --check` 退出码为 0，仅保留既有 LF/CRLF warning；未跟踪文档/脚本尾随空白扫描无命中。

## 2026-06-09 阶段 10 第六轮：Nacos / Seata / Gateway 生产默认值收口

- 会话恢复：重新读取 `task_plan.md`、`progress.md`、`findings.md` 和 `scripts/check-production-runtime-defaults.ps1`，并运行 `session-catchup.py`；工具报告存在未同步上下文，已按建议运行 `git diff --stat`。
- 风险确认：五个 Java 业务服务基础 `application.yml` 使用 `${NACOS_HOST:localhost}:${NACOS_PORT:8848}`；`java-ticket`、`java-order`、`java-payment` 的 `prod-split` Seata 配置也使用 Nacos localhost fallback，且 `SEATA_ENABLED` 默认 `true`；Gateway 此前没有 `application-prod-split.yml`。
- RED 验证：扩展 `scripts/check-production-runtime-defaults.ps1` 检查业务服务 Nacos、Seata 和 Gateway prod-split；首次运行失败于 `FAIL java-user prod-split: spring.cloud.nacos discovery/config must be declared without fallback`。
- 工具错误记录：首次实现多行正则检查后，`scripts/check-production-runtime-defaults.ps1` 运行超时；已改为确定性的行级匹配，避免 PowerShell 正则在配置文件上过重匹配。
- 修复：五个业务服务 `application-prod-split.yml` 增加 `spring.cloud.nacos.discovery/config.server-addr: ${NACOS_HOST}:${NACOS_PORT}`；三个 Seata 服务改为 `seata.enabled: ${SEATA_ENABLED}`，registry/config Nacos 地址去掉 fallback。
- Gateway 修复：新增 `java/java-gateway/src/main/resources/application-prod-split.yml`，生产 profile 显式要求 `NACOS_HOST` 和 `NACOS_PORT`。
- 本地启动兼容：`start-project.ps1` 在本地 prod-split 启动业务服务时注入 `--NACOS_HOST=localhost --NACOS_PORT=$nacosPort`，保留本地脚本体验。
- 当前绿灯：`powershell -ExecutionPolicy Bypass -File scripts\check-production-runtime-defaults.ps1` 通过，新增输出包含五个业务服务 Nacos、三个 Seata 服务和 Gateway Nacos 的 explicit environment 检查。
- 脚本口径修复：`scripts/check-local-schema-profiles.ps1` 原先仍检查 `SEATA_ENABLED:true` 且使用双引号占位符字符串，存在误报风险；已改为检查 `prod-split` 必须 `enabled: ${SEATA_ENABLED}`，并将 `${...}` 检查改为单引号/明确正则。
- 单项复验：`powershell -ExecutionPolicy Bypass -File scripts\check-local-schema-profiles.ps1` 通过，输出 `prod-split seata enabled requires SEATA_ENABLED`；`scripts\check-production-runtime-defaults.ps1` 通过。
- 收口验证：`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过，包含更新后的 Local schema profiles、Production runtime default guard 和 Java boundary tests `Tests run: 89, Failures: 0, Errors: 0`；`git diff --check` 退出码为 0，仅保留既有 LF/CRLF warning；本轮未跟踪文档/脚本尾随空白扫描无命中。
- 剩余风险：Gateway `/api/grab/**` 和 `/api/waitlist/**` 仍继承 `http://localhost:3001` 本地地址，已写入生产默认值审计待后续收口。

## 2026-06-09 阶段 10 第七轮：Gateway 抢票路由生产地址默认值收口

- 风险确认：`java-gateway/src/main/resources/application.yml` 的 `/api/waitlist/**` 和 `/api/grab/**` 路由仍指向 `http://localhost:3001`；生产 Gateway 如果只使用默认路由会误打本机抢票服务地址。
- RED 验证：扩展 `scripts/check-production-runtime-defaults.ps1` 要求 Gateway prod-split route override profile；首次运行失败于 `FAIL missing Gateway prod-split route override profile`。
- 修复：新增 `java/java-gateway/src/main/resources/application-prod-split.properties`，将 `spring.cloud.gateway.routes[12].uri` 绑定到 `GATEWAY_WAITLIST_SERVICE_URI`，将 `routes[13].uri` 绑定到 `GATEWAY_GRAB_SERVICE_URI`，均无 fallback。
- 守护增强：脚本同时读取基础 Gateway route id 顺序，确认第 12/13 项仍为 `waitlist-service` / `grab-service`；若后续调整路由顺序，守护会要求同步更新 prod-split 覆盖索引。
- 文档：`docs/production-readiness/production-env-vars.md` 增加 `GATEWAY_GRAB_SERVICE_URI`、`GATEWAY_WAITLIST_SERVICE_URI`；`docs/production-readiness/production-defaults-audit.md` 将 Gateway 抢票路由风险从待处理移入已修复。
- 单项验证：`powershell -ExecutionPolicy Bypass -File scripts\check-production-runtime-defaults.ps1` 通过，包含 `PASS java-gateway prod-split grab/waitlist routes require explicit environment`；`mvn -pl java-gateway test` 通过，33 tests。
- 收口验证：`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过，包含 Gateway grab/waitlist route 守卫，Java boundary tests `Tests run: 89, Failures: 0, Errors: 0`。

## 2026-06-09 阶段 10 第八轮：grab-service 运行时本地默认值收口

- 风险确认：`nestjs/grab-service` 不只 `OrderClientService` 有 `http://localhost:8088` fallback；`TicketClientService`、两个通知客户端、`DatabaseService`、`RedisService`、`WaitlistMqConsumer` 也存在服务地址、数据库、Redis、RabbitMQ 的本地默认值。
- RED 守卫：扩展 `scripts/check-production-runtime-defaults.ps1` 后首次运行失败于 `FAIL grab-service runtime source must not contain local fallback 'GRAB_DB_HOST || 'localhost''`，证明旧源码会静默使用本地数据库地址。
- RED 测试：新增缺变量初始化失败用例后，定向 Jest 失败于订单、票务、通知、数据库、Redis、RabbitMQ 仍不抛错；一次 Redis mock 形态错误已修正后重新确认红灯来自旧业务行为。
- 修复：新增 `nestjs/grab-service/src/runtime-env.ts`，通过 `requireEnv` / `requireIntegerEnv` 统一读取必填变量；相关客户端和基础设施连接缺变量时抛出中文错误，不再回退 `localhost`、`postgres`、`admin` 或 `123456`。
- 本地兼容：`docker-compose.yml` 增加 `TICKET_SERVICE_URL`、`NOTIFICATION_SERVICE_URL`；`start-project.ps1` 为本地 grab-service 显式注入 Redis、RabbitMQ、ticket、notification 变量。
- 生产边界：`docker-compose.production.example.yml` 对 `ORDER_SERVICE_URL`、`TICKET_SERVICE_URL`、`NOTIFICATION_SERVICE_URL`、`REDIS_HOST`、`REDIS_PORT`、`RABBITMQ_HOST`、`RABBITMQ_PORT` 使用 `${VAR:?VAR is required}`；生产环境变量清单把 `TICKET_SERVICE_URL` / `NOTIFICATION_SERVICE_URL` 改为必填并新增 Redis 变量。
- 全量 Jest 首跑只剩既有 `main.spec.ts` 与 `main.ts` bootstrap backlog 断言不一致；已按现有测试目标修复为 `app.init()` 后使用底层 HTTP server `listen(port, host, 2048, cb)`，日志文案改为中文。
- 当前验证：定向 `npm test -- order-client.service.spec.ts ticket-client.service.spec.ts notification-client.service.spec.ts waitlist-notification.service.spec.ts database.service.spec.ts redis.service.spec.ts waitlist-mq.consumer.spec.ts` 通过 33 tests；`npm test` 通过，33 个 test suites passed、2 skipped，382 tests passed、7 skipped；`scripts/check-production-runtime-defaults.ps1` 通过。
- 收口验证：`docker compose -f docker-compose.yml config --quiet` 通过；带临时占位环境变量的 `docker-compose.production.example.yml config --quiet` 通过；`git diff --check` 退出码 0，仅保留既有 LF/CRLF warning；本轮触达文件尾随空白扫描无命中；`scripts\verify-microservice-boundaries.ps1` 通过，包含生产默认值守护和 Java boundary tests `Tests run: 89, Failures: 0, Errors: 0`。

## 2026-06-09 阶段 10 第九轮：frontend server proxy 默认值收口

- 风险确认：`frontend/src/lib/server-proxy.ts` 仍有 `DEFAULT_PROXY_TARGET = 'http://localhost:8088'`，且 `backendBaseUrl()` 在缺少 `API_PROXY_TARGET` 时会静默回退本机 Gateway。
- RED 守卫：`scripts/check-production-runtime-defaults.ps1` 已扩展检查 `server-proxy.ts`，首次运行失败于 `FAIL frontend server proxy must not contain local API_PROXY_TARGET fallback`。
- RED 测试：新增 `frontend/src/lib/server-proxy.test.ts`，缺少 `API_PROXY_TARGET` 的用例首次失败，因为旧代码仍调用 `fetch` 并返回 200；显式配置 `http://gateway.local/` 的代理用例已能通过。
- 修复：`server-proxy.ts` 移除 `DEFAULT_PROXY_TARGET`，`backendBaseUrl()` 改为只读取显式 `API_PROXY_TARGET`；变量缺失或空白时直接返回业务 `503 后端代理目标未配置`，不读取上游、不调用 `fetch`。
- 绿灯验证：`node --test --experimental-strip-types src/lib/server-proxy.test.ts` 通过 2 tests；`powershell -ExecutionPolicy Bypass -File scripts\check-production-runtime-defaults.ps1` 通过，包含 `PASS frontend server proxy requires explicit API_PROXY_TARGET`；`pnpm typecheck` 通过。

## 2026-06-09 阶段 10 第十轮：首页 mock fallback 收口

- 路线确认：当前仍在 `2026-06-06-platform-improvement-roadmap.md` 的阶段 10“生产前全链路整顿验收”，本轮对应“清理或替换所有 mock/offline 降级”。
- 风险确认：`frontend/src/app/page.tsx` 在 `listCategories()` / `listActivities()` 失败时会从 `@/lib/mock-data` 回退 `mockCategories` 和 `mockSections`；`banners` 也来自 fake activity id，如 `/activity/c1`。
- RED 测试：新增 `frontend/src/lib/homepage-production-fallback.test.ts` 后首次运行失败于首页仍匹配 `@/lib/mock-data`，随后补充 Footer 测试并确认 `Footer` 仍从 mock 模块取 `footerLinks`。
- 修复：首页移除 mock 分类、mock 分区和 mock banner；接口失败时展示 `活动加载失败，请稍后重试`，分类、banner、分区均为空；首页 banner 改为从真实活动列表生成真实链接。
- 修复：新增 `frontend/src/lib/site-links.ts`，`Footer` 改从正式静态链接常量读取，首页组件链不再触达 `mock-data`。
- 守护：`scripts/check-production-runtime-defaults.ps1` 已新增首页和 Footer mock-data 检查；期间两次 PowerShell 双引号正则扫描失败，已换为单引号字面量扫描继续。
- 当前绿灯：`node --test --experimental-strip-types src/lib/homepage-production-fallback.test.ts` 通过 2 tests；`rg -n 'mock-data' frontend\src` 仅命中新测试断言。
- 收口验证：`node --test --experimental-strip-types src/lib/homepage-production-fallback.test.ts src/lib/server-proxy.test.ts` 通过 4 tests；`pnpm typecheck` 通过；`scripts\check-production-runtime-defaults.ps1` 通过并包含 `PASS frontend homepage does not use mock categories or sections fallback`；`scripts\verify-microservice-boundaries.ps1` 通过，Java boundary tests `Tests run: 89, Failures: 0, Errors: 0`；`git diff --check` 退出码 0，仅有既有 LF/CRLF warning。
- 标准端口运行态：初次浏览器打开 `http://localhost:3000/` 显示 `活动加载失败，请稍后重试`，无 fake `/activity/c1|d1|s1` 链接，console error/warn 为 0；探针确认 `3000/api/ticket/categories` 返回 `503 后端代理目标未配置`。实际占用 3000 的是本机 `node` 进程，不是 `omni-frontend` 容器；重启该前端进程并显式注入 `API_PROXY_TARGET=http://localhost:8088` 后，`3000/api/ticket/categories` 返回业务 `code=200`，浏览器首页可见真实分类和周杰伦/五月天等真实活动，仍无 fake 活动链接，console error/warn 为 0。

## 2026-06-09 阶段 10 第十一轮：mock 支付入口生产收口

- 风险确认：`PaymentController.mockPayForDemo()` 暴露 `POST /api/payment/mock/pay`，旧行为在默认态只校验请求和用户认证，然后调用 `MockPaymentService.pay()`；没有环境开关阻断默认/生产访问。
- RED 测试：新增 `PaymentControllerTest` 后运行 `mvn -pl java-payment "-Dtest=PaymentControllerTest" test` 失败；失败点为默认态实际返回 `支付参数不能为空`，且显式 enabled 测试找不到 `mockPaymentEnabled` 字段。
- 修复：`PaymentController` 增加 `@Value("${omni.payment.mock.enabled:false}")`，在 mock pay 入口最前面判断；默认未启用时抛出 `当前环境未启用模拟支付`，不触发参数校验、用户鉴权或 `MockPaymentService`。
- 兼容：测试通过 `ReflectionTestUtils` 显式设置 `mockPaymentEnabled=true`，确认启用后仍沿用旧的 `支付参数不能为空` 参数校验路径。
- 生产配置：`java/java-payment/src/main/resources/application-prod-split.yml` 增加 `omni.payment.mock.enabled: false`，生产 profile 不允许打开模拟支付入口。
- 守护：`scripts/check-production-runtime-defaults.ps1` 增加 mock pay gate 检查；期间发现新增中文字面量会让嵌套 Windows PowerShell 按非 UTF-8 读取时解析异常，已改为 ASCII 标识检查，中文返回文案由 Java 测试覆盖。
- 当前绿灯：`mvn -pl java-payment "-Dtest=PaymentControllerTest" test` 通过，2 tests；`powershell -ExecutionPolicy Bypass -File scripts\check-production-runtime-defaults.ps1` 通过，包含 `PASS java-payment mock pay endpoint is disabled by default`。
- 收口验证：`mvn -pl java-payment test` 通过，91 tests；`powershell -ExecutionPolicy Bypass -File scripts\check-production-runtime-defaults.ps1` 通过；`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过，包含生产默认值守护和 Java boundary tests；`git diff --check` 退出码 0，仅保留既有 LF/CRLF warning。

## 2026-06-10 阶段 10 第十二轮：旧短信/邮件直发入口生产收口

- 风险确认：`java-notification` 新通知事件链路已有 `DisabledSmsSender`，但旧 `POST /api/notification/send-sms` 和 `POST /api/notification/send-email` 仍会调用 `NotificationService.sendSms/sendEmail()`，落库为 `SMS`/`EMAIL` 并打印“模拟短信/邮件通知”日志。
- RED 测试：更新 `NotificationControllerAuthTest` 和 `NotificationServiceFullTest` 后运行 `mvn -pl java-notification "-Dtest=NotificationControllerAuthTest,NotificationServiceFullTest" test` 失败；失败点包括默认态返回 200、找不到 `directChannelEnabled` 字段，以及空 body 仍触发 NPE。
- 修复：`NotificationController` 增加 `@Value("${omni.notification.direct-channel.enabled:false}")`，有效 JWT 之后、解析 body 之前检查开关；默认未启用时短信返回 `当前环境未启用短信直发`，邮件返回 `当前环境未启用邮件直发`，且不调用旧模拟发送服务。
- 兼容：测试通过 `ReflectionTestUtils` 显式设置 `directChannelEnabled=true`，确认旧直发路径启用时仍使用 JWT 中的 userId，不接受 body 伪造 userId。
- 生产配置：`java/java-notification/src/main/resources/application-prod-split.yml` 增加 `omni.notification.direct-channel.enabled: false`，生产 profile 不允许打开旧短信/邮件直发入口。
- 守护：`scripts/check-production-runtime-defaults.ps1` 增加 notification direct channel 检查，确认 `prod-split` 固定关闭且 `NotificationController` 受 `omni.notification.direct-channel.enabled` gate 保护。
- 当前绿灯：`mvn -pl java-notification "-Dtest=NotificationControllerAuthTest,NotificationServiceFullTest" test` 通过，34 tests；`powershell -ExecutionPolicy Bypass -File scripts\check-production-runtime-defaults.ps1` 通过，包含 `PASS java-notification direct SMS/email endpoints are disabled by default`。
- 收口验证：`mvn -pl java-notification test` 通过，53 tests；`powershell -ExecutionPolicy Bypass -File scripts\check-production-runtime-defaults.ps1` 通过；`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过，包含生产默认值守护和 Java boundary tests；`git diff --check` 退出码 0，仅保留既有 LF/CRLF warning。

## 2026-06-10 阶段 10 第十三轮：旧支付入口文案收口

- 风险确认：`java-payment` 的旧 `POST /api/payment/pay` 虽然返回失败，但文案仍提示“请使用正式支付或演示模拟支付接口”；在 `/api/payment/mock/pay` 已默认禁用后，这会继续误导前端或排障人员走 mock 支付路径。
- RED 测试：更新 `PaymentControllerTest.legacyPayEndpointGuidesUsersToAlipayPagePayOnly()` 后，首次运行 `mvn -pl java-payment "-Dtest=PaymentControllerTest" test` 失败；失败点为期望 `请使用支付宝支付页面支付`，实际仍返回 `请使用正式支付或演示模拟支付接口`。
- 修复：`PaymentController.mockPay()` 失败文案改为 `请使用支付宝支付页面支付`，只指向当前 page-pay 链路，不再提示演示模拟支付入口。
- 当前绿灯：`mvn -pl java-payment "-Dtest=PaymentControllerTest" test` 通过，3 tests。
- 收口验证：`mvn -pl java-payment test` 通过，92 tests；`powershell -ExecutionPolicy Bypass -File scripts\check-production-runtime-defaults.ps1` 通过；`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过，包含生产默认值守护和 Java boundary tests；`git diff --check` 退出码 0，仅保留既有 LF/CRLF warning。

## 2026-06-10 阶段 10 第十四轮：短信验证码静态演示文案收口

- 风险确认：后端固定验证码和 mock 短信默认关闭后，登录、找回密码、账号设置页仍在默认静态提示或无 code 成功提示中出现“本地演示环境”“本地演示返回提示”；生产 UI 会把本地演示策略暴露给普通用户。
- RED 测试：新增 `frontend/src/lib/sms-production-copy.test.ts` 后首次运行 `node --test --experimental-strip-types src/lib/sms-production-copy.test.ts` 失败，命中 `LoginForm.tsx` 中的 `本地演示环境` 静态文案。
- 修复：`LoginForm.tsx`、`forgot-password/page.tsx` 和 `profile/account/page.tsx` 的默认短信验证码说明统一改为生产中性文案；本轮后已移除后端返回 `code` 时的动态 `本地演示验证码为 ...` 提示。
- 当前绿灯：`node --test --experimental-strip-types src/lib/sms-production-copy.test.ts src/lib/homepage-production-fallback.test.ts src/lib/api.test.ts` 通过，35 tests；`pnpm typecheck` 通过。
- 收口验证：`powershell -ExecutionPolicy Bypass -File scripts\check-production-runtime-defaults.ps1` 通过；`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过，包含生产默认值守护和 Java boundary tests；`git diff --check` 退出码 0，仅保留既有 LF/CRLF warning。

## 2026-06-10 阶段 10 第十五轮：登录页未接通入口收口

- 风险确认：`LoginForm` 默认展示扫码登录 tab 和淘宝/微信/QQ/微博/支付宝第三方登录按钮，但当前没有对应扫码或 OAuth 登录后端实现；生产前这类入口属于空点击/未闭环入口。
- RED 测试：新增 `frontend/src/lib/login-entry-production.test.ts` 后，首次运行 `node --test --experimental-strip-types src/lib/login-entry-production.test.ts` 失败，命中 `qrcode` 和 `扫码登录`。
- 修复：`LoginForm.tsx` 移除 `qrcode` tab、扫码登录面板、`QrCode` 图标依赖、第三方登录按钮组和 `api.iconify.design` 外部图标引用；登录页只保留密码登录、验证码登录、免费注册和忘记密码。
- 当前绿灯：`node --test --experimental-strip-types src/lib/login-entry-production.test.ts src/lib/sms-production-copy.test.ts src/lib/api.test.ts` 通过，34 tests；`pnpm typecheck` 通过。
- 标准端口浏览器验收：初次打开 `http://localhost:3000/login` 仍看到旧“其他登录方式”，确认容器源码已更新但 `/app/.next/dev` 运行缓存未刷新；已将容器内 `/app/.next/dev` 挪到 stale 备份并重启 `omni-frontend`。重新访问后页面只剩“密码登录”“验证码登录”“免费注册”“忘记密码”，无扫码/第三方登录入口，console warning/error 为 0。
- 收口验证：`powershell -ExecutionPolicy Bypass -File scripts\check-production-runtime-defaults.ps1` 通过；`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过，包含生产默认值守护和 Java boundary tests `BUILD SUCCESS`；`git diff --check` 退出码 0，仅保留既有 LF/CRLF warning。

## 2026-06-10 阶段 10 第十六轮：控制台活动列表未闭环文案收口

- 风险确认：控制台活动列表的巡演保护分支仍保留“暂不支持从列表直接重新上架”文案；虽然正常按钮渲染会避开已下架巡演，但生产运行代码不应保留空入口式提示。
- RED 测试：新增 `frontend/src/lib/console-production-entry.test.ts` 后，首次运行 `node --test --experimental-strip-types src/lib/console-production-entry.test.ts` 失败，命中 `暂不支持从列表直接重新上架`。
- 修复：`frontend/src/app/console/activities/page.tsx` 将提示改为 `该巡演/多站点活动已下架，请进入巡演详情查看城市站点状态并按流程重新发布。`
- 当前绿灯：`node --test --experimental-strip-types src/lib/console-production-entry.test.ts src/lib/login-entry-production.test.ts src/lib/sms-production-copy.test.ts src/lib/homepage-production-fallback.test.ts src/lib/api.test.ts` 通过，37 tests；`pnpm typecheck` 通过。

## 2026-06-10 阶段 10 第十七轮：IDEA 本地 Java 运行配置补齐

- 用户反馈：Java 服务在 IDEA 中报错无法启动；贴出的 `TicketApplication` 日志显示 `Could not resolve placeholder 'SEATA_ENABLED' in value "${SEATA_ENABLED}"`，触发点是 `io.seata.spring.boot.autoconfigure.SeataCoreAutoConfiguration` 条件处理。
- 根因：阶段 10 将 `prod-split` 的 Seata、Nacos、RabbitMQ、datasource、internal token 等本地 fallback 收紧为显式变量；`start-project.ps1` 或环境变量能注入时可启动，但 IDEA workspace 运行配置没有同步这些变量。
- 修复：已更新 `.idea/workspace.xml` 的六个 Spring Boot 运行配置。`TicketApplication`、`OrderApplication`、`UserApplication`、`NotificationApplication`、`GatewayApplication` 使用 `prod-split` 并补齐本地五库、Nacos、RabbitMQ、JWT/internal token、Seata/Gateway 路由等变量；`PaymentApplication` 保持默认本地 Alipay sandbox profile，但显式连 `omni_payment`，避免把沙盒私钥复制进 IDEA workspace。
- 验证：`[xml]$xml = Get-Content .idea\workspace.xml` 解析通过；六个 Spring Boot 配置均可读出本地环境变量数量，`TicketApplication` 包含 `SEATA_ENABLED`、`OMNI_SEARCH_PROVIDER=db` 和 `OMNI_SEARCH_REQUIRE_ES=false`。
- 追加 Gateway 根因：旧 `java-gateway/src/main/resources/application-prod-split.properties` 只覆盖 `spring.cloud.gateway.routes[12].uri` 和 `[13].uri`，Spring Boot 对 list 使用高优先级整体覆盖，导致 Gateway route binder 把这两项视为不完整 route 并启动失败。
- 修复：删除旧稀疏 `.properties`，新增/更新 `java-gateway/src/main/resources/application-prod-split.yml`，同时保留 Nacos 无 fallback 配置和完整 14 条 Gateway route list；`waitlist-service` / `grab-service` 仍通过 `GATEWAY_WAITLIST_SERVICE_URI` / `GATEWAY_GRAB_SERVICE_URI` 必填变量注入。
- 守护同步：`scripts/check-production-runtime-defaults.ps1` 改为检查完整 `prod-split` route list，并明确禁止旧稀疏 `.properties` 覆盖文件。
- 验证：`mvn -pl java-gateway clean test -Dtest=GatewayRouteTimeoutConfigTest` 通过；`scripts\check-production-runtime-defaults.ps1` 通过；`target/classes/application-prod-split.properties` 已不存在，`target/classes/application-prod-split.yml` 存在。

## 2026-06-10 阶段 10 第十八轮：控制台原生 alert 入口收口

- 扫描确认：阶段 10 剩余 mock/offline 静态命中主要集中在已 gate 的支付模拟服务、通知短信供应商禁用状态和测试断言；控制台艺人页仍有一个直接 `alert()`。
- RED 测试：扩展 `frontend/src/lib/console-production-entry.test.ts` 后，首次运行 `node --test --experimental-strip-types src/lib/console-production-entry.test.ts` 失败，命中 `frontend/src/app/console/artists/page.tsx` 的 `alert(err instanceof Error ? err.message : \`操作失败\`)`。
- 修复：`frontend/src/app/console/artists/page.tsx` 导入 `globalAlert`，风险状态更新失败时改为 `await globalAlert(err instanceof Error ? err.message : '操作失败')`。
- 当前绿灯：`node --test --experimental-strip-types src/lib/console-production-entry.test.ts` 通过，2 tests。
- 收口验证：`node --test --experimental-strip-types src/lib/console-production-entry.test.ts src/lib/login-entry-production.test.ts src/lib/sms-production-copy.test.ts src/lib/homepage-production-fallback.test.ts src/lib/api.test.ts` 通过，38 tests；`pnpm typecheck` 通过；`scripts\check-production-runtime-defaults.ps1` 通过；直接弹窗扫描只剩 `GlobalDialog.tsx` 的兜底 `window.alert`；`git diff --check` 退出码 0，仅保留既有 LF/CRLF warning。

## 2026-06-10 阶段 10 第十九轮：订单退款客服介入假成功收口

- 风险确认：订单页退款失败/处理中状态下的“联系客服介入”按钮只执行 `globalAlert('已记录客服介入请求...')`，没有创建客服会话、没有发送消息、也没有通知客服工作台，属于假成功。
- RED 测试：新增 `frontend/src/lib/orders-production-entry.test.ts` 后首次运行失败，命中 `已记录客服介入请求`；随后补充 `/help` 读取跳转会话 ID 的断言，确认客服页未读取 `conversationId`。
- 修复：`frontend/src/app/orders/page.tsx` 新增 `handleRefundSupport()`，点击按钮后调用 `startSupportConversation({ preferHuman: true, initialMessage })`，初始消息包含订单号、退款单号、活动、退款状态、退款金额、退款原因和处理备注；成功后跳转 `/help?conversationId={conversation.id}`，失败时才显示 `联系人工客服失败`。
- 修复：`frontend/src/app/help/page.tsx` 通过 `URLSearchParams(window.location.search)` 读取 `conversationId`，并传给 `loadMyConversation(preferredConversationId, uid)`，复用已有会话选择逻辑打开指定会话。
- 当前绿灯：`node --test --experimental-strip-types src/lib/orders-production-entry.test.ts` 通过，2 tests。

## 2026-06-10 阶段 10 第二十轮：页脚空链接入口收口

- 风险确认：`frontend/src/components/Footer.tsx` 的备案号仍是 `href="#"`；`frontend/src/components/LoginFooter.tsx` 的“廉正举报”“招聘信息”“应用下载”和“万象网”也存在空链接；后续固定字符串扫描又发现 `frontend/src/lib/site-links.ts` 的 footerLinks 数据源仍保留 `href: '#'`，占位内容会被用户感知为可点击入口。
- RED 测试：新增 `frontend/src/lib/footer-production-entry.test.ts` 后首次运行失败，命中 `Footer` / `LoginFooter` 中的 `href="#"`；扩展测试读取 `site-links.ts` 后再次失败，命中数据源里的 `href: '#'`。
- 修复：`site-links.ts` 将 `href` 改为可选，仅“商户入驻”保留真实 `/merchant`；`Footer` 仅对有真实目标的项渲染 `<a>`，备案号改为普通文本，并移除无点击处理的版权行 `cursor-pointer`；`LoginFooter` 抽出 `topLinks`，只对有真实 `href` 的项渲染 `<a>`，无目标项渲染普通文本，“应用下载”和站点名不再使用空链接。
- 当前绿灯：`node --test --experimental-strip-types src/lib/footer-production-entry.test.ts src/lib/orders-production-entry.test.ts src/lib/console-production-entry.test.ts src/lib/login-entry-production.test.ts src/lib/sms-production-copy.test.ts src/lib/homepage-production-fallback.test.ts src/lib/api.test.ts` 通过，41 tests；`pnpm typecheck` 通过；`scripts\check-production-runtime-defaults.ps1` 通过；前端入口空链接扫描无命中。
- 工具错误记录：一次 `rg` 对 `href:\s*['"]#` 的 PowerShell 转义写法触发 regex parse error；已改用 `rg -F` 固定字符串扫描继续。

## 2026-06-10 阶段 10 第二十一轮：认证页外部借用链接收口

- 风险确认：`frontend/src/components/LoginFooter.tsx` 仍指向 `help.damai.cn`、`x.damai.cn`、`alimebot.taobao.com`，且显示 `omni_tousu@member.alibaba.com`；`frontend/src/components/RegisterForm.tsx` 的三条协议链接仍指向 Damai H5 帮助页。认证页属于生产入口，不应把万象用户引到借用平台。
- RED 测试：扩展 `frontend/src/lib/login-entry-production.test.ts` 后首次运行失败，命中 `help.damai.cn|x.damai.cn|alimebot.taobao.com|member.alibaba.com`。
- 修复：`LoginFooter` 将“帮助中心”和“在线客服”改为内部 `/help`，“联系合作”改为 `/merchant`；未接通的公司介绍、品牌识别、大事记、协议政策、廉正举报、招聘、防骗等保持普通文本；举报投诉文案改为“请通过在线客服提交”。
- 修复：`RegisterForm` 将《万象会员服务协议》《隐私权政策》《订票服务条款》从 Damai 外链改为普通文本，保留注册必须勾选同意的业务约束。
- 当前绿灯：`node --test --experimental-strip-types src/lib/login-entry-production.test.ts src/lib/footer-production-entry.test.ts src/lib/orders-production-entry.test.ts src/lib/console-production-entry.test.ts src/lib/sms-production-copy.test.ts src/lib/homepage-production-fallback.test.ts src/lib/api.test.ts` 通过，42 tests；`pnpm typecheck` 通过；认证页借用外链扫描无命中；`@/lib/mock-data` 入口扫描无命中。
- 工具错误记录：一次混合引号的 `rg` mock-data 导入扫描被 PowerShell 拆成路径参数，已改用 `rg -F '@/lib/mock-data' frontend/src` 固定字符串扫描继续。
## 2026-06-10 阶段 10 第二十二轮：活动详情页真实推荐收口

- 风险确认：`frontend/src/app/activity/[id]/page.tsx` 的“为你推荐”仍直接写死 `2026 BY2「撇清关系2.0」演唱会`、`2026胡夏【那些年】北京站`、`民谣30年·不如一见演唱会`，并使用 `img.alicdn.com` 海报 URL；这不是未引用的 mock-data，而是真实详情页运行代码。
- 方案确认：按用户要求不做盲目随机，保留推荐区但改成真实候选召回 + 规则粗排/精排 + 多样性；当前前端先复用 `listActivities()` 和已有本地浏览信号，后续 PostHog 稳定后再迁到后端 recommendation API。
- RED 测试：新增 `frontend/src/lib/activity-detail-production-entry.test.ts` 和 `frontend/src/lib/activity-recommendations.test.ts` 后，首次运行 `node --test --experimental-strip-types src/lib/activity-recommendations.test.ts src/lib/activity-detail-production-entry.test.ts` 失败；失败点包括推荐算法模块不存在、详情页命中 BY2/胡夏/民谣30年和 `img.alicdn.com`。
- 实现：新增 `buildActivityDetailRecommendations()`，按同类目、同城市、同艺人、时间接近、价格接近、浏览信号和在售状态打分，排除当前活动和不可推荐状态，并用多样性惩罚避免同一艺人/城市连续占满推荐位。
- 修正：算法测试首次绿化前发现稳定扰动会让等分候选排序不够可解释，已移除扰动，改为分数、时间、标题的确定性排序。
- 页面接入：`/activity/[id]` 详情页通过 `listActivities()` 召回同类目+同城市、同类目、同城市三组真实候选，去重后渲染最多 3 个推荐；接口失败或无候选时清空并隐藏模块，不展示假推荐。
- 当前绿灯：`node --test --experimental-strip-types src/lib/activity-recommendations.test.ts src/lib/activity-detail-production-entry.test.ts` 通过，4 tests；`pnpm typecheck` 通过。

## 2026-06-10 阶段 10 第二十三轮：真实演示 seed 艺人头像收口

- 风险确认：真实推荐已不再硬编码 BY2 / 胡夏 / 民谣30年，但 `sql/seeds/prod-split-real-demo/01-ticket.sql` 中 BY2 和胡夏两个艺人档案仍把 `avatar` 指向对应活动海报，艺人图像和活动海报没有分开。
- RED 测试：扩展 `frontend/src/lib/seed-assets-production-entry.test.ts` 后，首次运行 `node --test --experimental-strip-types frontend/src/lib/seed-assets-production-entry.test.ts` 失败，命中 `901002` / `901003` 复用 `/seed-posters-real/activity-900001.jpg` 和 `/seed-posters-real/activity-900011.jpg`。
- 实现：新增 `frontend/public/seed-artist-avatars-real/artist-901002.jpg` 和 `artist-901003.jpg`，来源页分别记录在 `artist-avatars.json`；`01-ticket.sql` 对应艺人档案改为独立头像路径，并将 `external_links` 指向来源页。
- 守护同步：`scripts/verify-prod-split-real-demo-seed.ps1` 新增头像目录、`artist-avatars.json`、来源链接、本地文件、阿里/大麦远端图禁用和 SQL 引用检查。
- 当前绿灯：`node --test --experimental-strip-types frontend/src/lib/activity-recommendations.test.ts frontend/src/lib/activity-detail-production-entry.test.ts frontend/src/lib/seed-assets-production-entry.test.ts` 通过，6 tests；`scripts\verify-prod-split-real-demo-seed.ps1` 通过，确认活动 120 条、海报不少于 120 张；`pnpm typecheck` 通过；`git diff --check` 退出码 0，仅保留既有 LF/CRLF warning。

## 2026-06-10 阶段 10 第二十四轮：风险通知占位类型收口

- 风险确认：`java-ticket` 的 `ActivityRiskResponseService` 在恢复售票申请待审核和风险停票两条路径里仍投递 `type="TODO"`；这会把新增业务通知继续绑定到占位待办类型，而不是正式站内通知通道。
- RED 测试：扩展 `ActivityRiskResponseServiceTest` 后首次运行 `mvn -pl java-ticket "-Dtest=ActivityRiskResponseServiceTest" test` 失败，实际调用分别为 `sendNotification(..., "TODO", "活动恢复售票申请待审核：...")` 和 `sendNotification(..., "TODO", "活动暂时停止售票，请处理阵容风险：...")`。
- 修复：`ActivityRiskResponseService` 两处风险通知投递类型改为 `IN_APP`，保持原有中文通知文案和 MQ 消息结构不变。
- 前端确认：`notification-state.ts` 仍保留历史 `TODO` 类型兼容；新增 `IN_APP` 风险通知可按“暂停售票/恢复售票”内容识别为 `RISK_*` 并路由到风险工作台。
- 当前绿灯：`mvn -pl java-ticket "-Dtest=ActivityRiskResponseServiceTest,RiskResolutionFlowTest" test` 通过，29 tests；`node --test --experimental-strip-types frontend/src/components/notification-state.test.ts` 通过，14 tests；`rg -n 'TODO'` 扫描确认剩余命中仅为前端历史 `TODO` 兼容映射和测试。

## 2026-06-10 阶段 10 第二十五轮：活动详情静态二维码占位收口

- 风险确认：`frontend/src/app/activity/[id]/page.tsx` 右侧服务说明仍显示“手机扫一扫 / 下单更快捷”，并渲染 `<img src="/1.png" alt="二维码" />`；该二维码没有真实生成链路，也不是当前活动或应用下载的可验证闭环。
- RED 测试：扩展 `frontend/src/lib/activity-detail-production-entry.test.ts` 后首次运行 `node --test --experimental-strip-types frontend/src/lib/activity-detail-production-entry.test.ts` 失败，命中 `/1.png`。
- 修复：活动详情页移除静态二维码图片和扫码占位文案，改为“下单前请确认场次、票档、实名观演人和退款规则，支付结果以订单状态为准。”，不新增假二维码或假下载入口。
- 当前绿灯：`node --test --experimental-strip-types frontend/src/lib/activity-detail-production-entry.test.ts` 通过，3 tests；`node --test --experimental-strip-types frontend/src/lib/activity-detail-production-entry.test.ts frontend/src/lib/activity-recommendations.test.ts frontend/src/lib/alipay-modal-integration.test.ts` 通过，7 tests；`pnpm typecheck` 通过。
- 静态扫描：`rg -n -F '/1.png' frontend\src` 无生产命中；“手机扫一扫 / 下单更快捷”仅保留在测试断言中。

## 2026-06-10 阶段 10 第二十六轮：前端借用品牌技术命名收口

- 风险确认：前端生产源码仍包含 `damai_token`、`damai_user`、`damai-user-updated`、`types/damai` 和 `--damai` CSS token；这些不是用户文案，但会出现在浏览器存储、运行事件和构建源码中，属于生产技术痕迹。
- RED 测试：新增 `frontend/src/lib/frontend-branding-production-entry.test.ts` 后首次运行失败，静态检查命中 `app/globals.css`、`app/page.tsx`、`app/search/page.tsx`、`components/Header.tsx`、`components/NotificationBell.tsx`、`lib/auth.ts` 等文件；认证迁移断言也失败，旧 key 读不到登录态。
- 修复：`auth.ts` 改为 `omni_token`、`omni_user` 和 `AUTH_UPDATED_EVENT='omni-user-updated'`，通过非字面量 legacy key 读取并迁移旧浏览器登录态；写入和退出登录时会清理旧 key。
- 修复：`Header`、`NotificationBell` 改为监听 `AUTH_UPDATED_EVENT`；`frontend/src/types/damai.ts` 移动为 `frontend/src/types/omni.ts` 并同步更新生产导入；`globals.css` 的品牌主题变量改为 `omni-brand`。
- 当前绿灯：`node --test --experimental-strip-types frontend/src/lib/frontend-branding-production-entry.test.ts` 通过，2 tests；`node --test --experimental-strip-types frontend/src/lib/frontend-branding-production-entry.test.ts frontend/src/lib/login-entry-production.test.ts frontend/src/lib/footer-production-entry.test.ts` 通过，5 tests；`pnpm typecheck` 通过。
- 静态扫描：`rg -n "damai|types/damai|damai_token|damai_user|damai-user-updated|--damai|color-damai" frontend\src --glob '!**/*.test.ts' --glob '!**/*.test.tsx'` 无生产命中。
- 工具错误记录：一次混合单双引号的 `rg` 类型导入扫描触发 PowerShell parse error；一次 `rg -F '--damai'` 被解释为 flag；一次把 `--` 放在 `--glob` 前导致 glob 被当成路径。已改用固定字符串扫描，并在扫描以短横线开头的 pattern 时使用 `rg -F --glob ... -- '--damai' frontend\src`。
## 2026-06-10 阶段 10 第二十七轮：统一弹窗 fallback 收口

- 风险确认：`frontend/src/components/GlobalDialog.tsx` 是全局弹窗体系，但在 `dialogFn` 尚未注册时仍会退回 `window.alert`、`window.confirm`、`window.prompt`。根布局已挂载 `<GlobalDialog />`，因此生产路径更适合把挂载前调用排队，而不是交给浏览器原生弹窗。
- RED 测试：新增 `frontend/src/lib/global-dialog-production-entry.test.ts` 后首次运行 `node --test --experimental-strip-types frontend/src/lib/global-dialog-production-entry.test.ts` 失败，命中 `window.alert` / `window.confirm` / `window.prompt` fallback。
- 修复：`GlobalDialog` 新增模块级 `dialogQueue` 和 `isDialogActive`，`globalAlert` / `globalConfirm` / `globalPrompt` 统一调用 `openGlobalDialog()`；挂载前请求排队，挂载后由 `flushDialogQueue()` 串行展示，确认或取消后再处理下一条。
- 当前绿灯：`node --test --experimental-strip-types frontend/src/lib/global-dialog-production-entry.test.ts` 通过，2 tests。
- 回归验证：`node --test --experimental-strip-types frontend/src/lib/global-dialog-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/orders-production-entry.test.ts frontend/src/lib/activity-detail-production-entry.test.ts frontend/src/lib/login-entry-production.test.ts frontend/src/lib/footer-production-entry.test.ts frontend/src/lib/frontend-branding-production-entry.test.ts` 通过，14 tests。
- 静态扫描：`rg -n 'window\.(alert|confirm|prompt)\s*\(' frontend\src --glob '!**/*.test.ts' --glob '!**/*.test.tsx'` 无生产命中。
- 类型和守护：`pnpm typecheck` 通过；`powershell -ExecutionPolicy Bypass -File scripts\check-production-runtime-defaults.ps1` 通过。

## 2026-06-10 阶段 10 第二十八轮：静态资源与站点图标收口

- 风险确认：活动详情页生产引用已移除 `/1.png`，但 `frontend/public/1.png` 文件仍保留在 public 静态目录，后续容易被重新误用；`frontend/src/app/favicon.ico` 仍是旧站点图标，未体现万象项目标识。
- RED 测试：新增 `frontend/src/lib/favicon-assets-production-entry.test.ts` 后首次运行 `node --test --experimental-strip-types frontend/src/lib/favicon-assets-production-entry.test.ts` 失败，分别命中 `frontend/public/1.png` 仍存在和旧 favicon SHA256 `2b8ad2d33455a8f736fc3a8ebf8f0bdea8848ad4c0db48a2833bd0f9cd775932`。
- 修复：删除 `frontend/public/1.png`；按用户指定的 `runtime/favicon-current-256.png` 重新读取原色细线环形图标，生成新的 `frontend/src/app/favicon.ico`，包含 `16x16`、`32x32`、`48x48`、`64x64`、`128x128`、`256x256` 多尺寸图层，不重绘、不调色。
- 当前绿灯：`node --test --experimental-strip-types frontend/src/lib/favicon-assets-production-entry.test.ts` 通过，4 tests；`node --test --experimental-strip-types frontend/src/lib/favicon-assets-production-entry.test.ts frontend/src/lib/activity-detail-production-entry.test.ts frontend/src/lib/frontend-branding-production-entry.test.ts` 通过，9 tests。
- 静态扫描：`rg -n -F '/1.png' frontend --glob '!**/*.test.ts' --glob '!**/*.test.tsx'` 无生产命中。
- 类型和守护：`pnpm typecheck` 通过；`powershell -ExecutionPolicy Bypass -File scripts\check-production-runtime-defaults.ps1` 通过；`git diff --check` 退出码 0，仅保留既有 LF/CRLF warning。

## 2026-06-10 阶段 10 第二十九轮：旧轮播图静态资源收口

- 风险确认：`frontend/public/carousel.png` 约 1.2 MB，当前非测试生产代码无引用；保留在 public 目录会给后续首页 banner、活动推荐或演示图造成可误用的旧占位资源。
- RED 测试：扩展 `frontend/src/lib/favicon-assets-production-entry.test.ts` 后，首次运行 `node --test --experimental-strip-types frontend/src/lib/favicon-assets-production-entry.test.ts` 失败，命中 `frontend/public/carousel.png` 仍存在。
- 修复：删除 `frontend/public/carousel.png`，只处理已确认无生产引用的旧轮播图，不扩大清理其它 seed 海报或艺人头像资源。
- 当前绿灯：`node --test --experimental-strip-types frontend/src/lib/favicon-assets-production-entry.test.ts` 通过，5 tests；`node --test --experimental-strip-types frontend/src/lib/favicon-assets-production-entry.test.ts frontend/src/lib/activity-detail-production-entry.test.ts frontend/src/lib/frontend-branding-production-entry.test.ts` 通过，10 tests。
- 静态扫描：`rg -n -F 'carousel.png' frontend --glob '!**/*.test.ts' --glob '!**/*.test.tsx' --glob '!frontend/.next/**' --glob '!frontend/node_modules/**'` 无生产命中；只剩测试文件守护引用。
- 类型和守护：`pnpm typecheck` 通过；`powershell -ExecutionPolicy Bypass -File scripts\check-production-runtime-defaults.ps1` 通过。

## 2026-06-10 阶段 10 第三十轮：旧宣传 PNG 品牌资源收口

- 风险确认：`frontend/public/logo.png` 是 6.5 MB 左右的旧宣传横幅，内容包含完整背景、万象文字和口号；当前生产入口实际使用 `/logo.svg` 和 `src/app/favicon.ico`，没有生产代码引用 `/logo.png`。
- RED 测试：将 `frontend/src/lib/favicon-assets-production-entry.test.ts` 中旧的 `logo.png` 存在断言改为删除守护后，首次运行 `node --test --experimental-strip-types frontend/src/lib/favicon-assets-production-entry.test.ts` 失败，命中 `frontend/public/logo.png` 仍存在。
- 修复：删除 `frontend/public/logo.png`；保留仍被 `Header` / `LoginHeader` 使用的 `frontend/public/logo.svg`，也保留多页面仍引用的 `background.png`。
- 当前绿灯：`node --test --experimental-strip-types frontend/src/lib/favicon-assets-production-entry.test.ts` 通过，6 tests；`node --test --experimental-strip-types frontend/src/lib/favicon-assets-production-entry.test.ts frontend/src/lib/activity-detail-production-entry.test.ts frontend/src/lib/frontend-branding-production-entry.test.ts` 通过，11 tests。
- 静态扫描：`rg -n -F 'logo.png' frontend --glob '!**/*.test.ts' --glob '!**/*.test.tsx' --glob '!frontend/.next/**' --glob '!frontend/node_modules/**'` 无生产命中；`rg -n -F '/logo.png' frontend ...` 同样无生产命中。
- 类型和守护：`pnpm typecheck` 通过；`powershell -ExecutionPolicy Bypass -File scripts\check-production-runtime-defaults.ps1` 通过。

## 2026-06-10 阶段 10 第三十一轮：前端 mock 数据模块收口

- 风险确认：`frontend/src/lib/mock-data.ts` 已无生产导入，只剩空数组导出；继续留在 `src/lib` 会形成可被新页面误接回的 mock 数据源。
- RED 测试：扩展 `frontend/src/lib/homepage-production-fallback.test.ts` 后，首次运行 `node --test --experimental-strip-types frontend/src/lib/homepage-production-fallback.test.ts` 失败，命中 `frontend/src/lib/mock-data.ts` 仍存在。
- 修复：删除 `frontend/src/lib/mock-data.ts`；`frontend/src/lib/seed-assets-production-entry.test.ts` 不再读取该模块；`PROJECT_INDEX.md` 移除已删除文件索引。
- 当前绿灯：`node --test --experimental-strip-types frontend/src/lib/homepage-production-fallback.test.ts frontend/src/lib/seed-assets-production-entry.test.ts` 通过，5 tests。
- 回归验证：`node --test --experimental-strip-types frontend/src/lib/homepage-production-fallback.test.ts frontend/src/lib/seed-assets-production-entry.test.ts frontend/src/lib/favicon-assets-production-entry.test.ts frontend/src/lib/activity-detail-production-entry.test.ts frontend/src/lib/frontend-branding-production-entry.test.ts` 通过，16 tests。
- 静态扫描：`rg -n -F '@/lib/mock-data' frontend\src --glob '!**/*.test.ts' --glob '!**/*.test.tsx'` 无生产命中；`rg -n -F 'mock-data' frontend\src --glob '!**/*.test.ts' --glob '!**/*.test.tsx'` 无生产命中。
- 类型和守护：`pnpm typecheck` 通过；`powershell -ExecutionPolicy Bypass -File scripts\check-production-runtime-defaults.ps1` 通过。

## 2026-06-10 阶段 10 第三十二轮：小程序 mock 活动与 mock 支付收口

- 风险确认：`miniprogram/pages/home/home.js` 和 `detail.js` 仍导入 `utils/mock-data.js`，错误态可切回演示数据；`utils/api.js` 暴露 `mockPay()` 并调用 `/api/payment/mock/pay`；支付页、成功页和个人页显示“模拟支付/模拟库存”等文案。
- RED 测试：新增 `miniprogram/production-entry.test.js` 后，首次运行 `node --test miniprogram/production-entry.test.js` 失败，分别命中 `utils/mock-data.js` 存在、页面导入 mock-data、mock pay 接口和模拟支付文案。
- 修复：首页移除本地 mock 活动依赖，接口失败时只允许重新加载；详情页非法 ID 显示失败态并返回首页，不再加载演示详情；删除 `miniprogram/utils/mock-data.js`。
- 修复：`miniprogram/utils/api.js` 删除 `mockPay()`；支付页不再调用后端 mock pay，改为提示“小程序支付未接入”，引导用户在网页端订单页完成支付宝支付；成功页和个人页同步去掉模拟支付文案。
- 文档同步：`miniprogram/README.md` 的流程、已接入接口和支付说明不再指向 mock pay。
- 当前绿灯：`node --test miniprogram/production-entry.test.js` 通过，2 tests；`node --check` 检查 `pages/pay/pay.js`、`pages/detail/detail.js`、`pages/home/home.js` 通过。
- 回归验证：前端静态资源 / 首页 fallback / seed 资产回归 `node --test --experimental-strip-types ...` 通过，11 tests；`powershell -ExecutionPolicy Bypass -File scripts\check-production-runtime-defaults.ps1` 通过。
## 2026-06-10 阶段 10 第三十三轮：小程序订单演示交易文案收口

- 风险确认：生产入口扫描发现 `miniprogram/app.js` 默认昵称仍为“毕设演示用户”，`miniprogram/pages/order/order.wxml` 仍展示“毕业设计演示流程，不产生真实交易，不调用微信支付”，支付说明页样式名仍为 `mock-button`。
- RED：扩展 `miniprogram/production-entry.test.js` 后，首次运行 `node --test miniprogram/production-entry.test.js` 失败，命中“毕设演示用户”等演示交易文案。
- 修复：`app.js` 默认用户改为未登录态；订单页从 `omni_user` 登录缓存读取购票人，手机号脱敏展示；订单提示改为网页端支付宝支付说明；支付说明按钮样式名改为 `payment-button`。
- 当前绿灯：`node --test miniprogram/production-entry.test.js` 通过 3 tests；`node --check miniprogram/pages/order/order.js` 和 `node --check miniprogram/app.js` 通过；生产入口扫描仅在 `miniprogram/README.md` 文档中保留演示说明。
- 最终回归：`node --test miniprogram/production-entry.test.js` 通过 3 tests；`node --check miniprogram/app.js`、`order.js`、`pay.js`、`detail.js`、`home.js` 均通过；前端生产入口回归 `homepage-production-fallback` / `seed-assets-production-entry` / `favicon-assets-production-entry` 通过 11 tests；`scripts\check-production-runtime-defaults.ps1` 通过；排除 README 后小程序生产入口残留扫描无命中；`git diff --check` 退出码 0，仅保留既有 LF/CRLF warning。

## 2026-06-10 阶段 10 第三十四轮：小程序个人页测试账号快捷登录收口

- 风险确认：`miniprogram/pages/profile/profile.js` 仍有 `quickLogin()`，硬编码 `13900000001` / `123456`；`profile.wxml` 仍展示 `{{apiBaseUrl}}` 和“一键登录测试账号”；`orders.wxml` 错误空态仍提示“登录测试账号后”。
- RED：扩展 `miniprogram/production-entry.test.js` 后首次运行 `node --test miniprogram/production-entry.test.js` 失败，命中 `quickLogin` / 硬编码测试账号快捷登录残留。
- 修复：个人页改为账号密码输入登录，调用现有 `login({ loginType: 'password', account, password })`；登录失败显示中文错误提示；退出登录时清空 token/user 并恢复未登录全局用户态。
- 修复：个人页移除接口地址展示，改为“网页端支付宝支付”和“订单状态以后端记录为准”；订单列表错误空态改为“登录后，可以查看通过真实下单接口创建的订单。”
- 当前绿灯：`node --test miniprogram/production-entry.test.js` 通过 4 tests；`node --check miniprogram/pages/profile/profile.js` 和 `node --check miniprogram/pages/orders/orders.js` 通过；排除 README 和测试文件后，测试账号快捷登录、硬编码账号密码和 `{{apiBaseUrl}}` 残留扫描无命中。
- 回归验证：前端生产入口回归 `homepage-production-fallback` / `seed-assets-production-entry` / `favicon-assets-production-entry` 通过 11 tests；`powershell -ExecutionPolicy Bypass -File scripts\check-production-runtime-defaults.ps1` 通过。

## 2026-06-10 阶段 10 第三十五轮：小程序本地网关默认值收口

- 风险确认：`miniprogram/app.js` 默认 `apiBaseUrl` 仍为 `http://localhost:8088`，`miniprogram/utils/api.js` 缺配置时仍回退同一本地地址；网络失败文案仍提示“服务暂不可用，请确认后端已启动”。
- RED：扩展 `miniprogram/production-entry.test.js` 后首次运行 `node --test miniprogram/production-entry.test.js` 失败，命中 `http://localhost:8088` 和“后端已启动”开发口径。
- 修复：`app.js` 将 `apiBaseUrl` 默认改为空字符串；`utils/api.js` 缺配置时抛出“小程序接口地址未配置”，并对已配置地址去掉末尾 `/`。
- 修复：`utils/api.js` 网络失败文案改为“服务暂不可用，请稍后重试”；`miniprogram/README.md` 同步说明仓库默认不再内置本地网关地址，并将登录说明改为已有账号手机号和密码。
- 当前绿灯：`node --test miniprogram/production-entry.test.js` 通过 5 tests；`node --check` 检查 `app.js`、`utils/api.js`、`home.js`、`detail.js`、`order.js`、`pay.js`、`profile.js` 均通过；运行入口残留扫描不再命中本地网关默认值和“后端已启动”。
- 最终回归：包含 README 的小程序残留扫描无命中；前端生产入口回归 `homepage-production-fallback` / `seed-assets-production-entry` / `favicon-assets-production-entry` 通过 11 tests；`powershell -ExecutionPolicy Bypass -File scripts\check-production-runtime-defaults.ps1` 通过；`git diff --check` 退出码 0，仅保留既有 LF/CRLF warning。

## 2026-06-10 阶段 10 第三十六轮：小程序模块移除

- 用户最新口径：小程序部分删除，不需要继续改。此前第三十二到三十五轮的小程序生产入口收口保留为历史记录，但后续不再把 `miniprogram` 当作生产入口维护对象。
- 删除范围：安全确认目标为当前仓库内 `miniprogram/` 后，删除整个小程序模块目录，包括页面、组件、工具、配置和小程序专用测试。
- 文档同步：路线计划改为“小程序模块移除”，后续阶段 10 继续聚焦 Web 前端、Java 后端、Nest 抢票服务和生产运行默认值。
- 验证口径：不再运行 `node --test miniprogram/production-entry.test.js` 或小程序 `node --check`；改用目录存在性扫描、生产入口残留扫描、Web 前端回归、生产默认值守护和 `git diff --check`。
- 当前验证：`Test-Path miniprogram` 返回不存在；非文档生产路径 `rg "miniprogram|小程序|微信小程序"` 无命中；前端生产入口回归 11 tests 通过；`scripts\check-production-runtime-defaults.ps1` 通过；`git diff --check` 退出码 0，仅保留既有 LF/CRLF warning。

## 2026-06-10 阶段 10 第三十七轮：支付/通知沙盒模拟命名收口

- 风险确认：生产入口扫描发现 `java-payment/pom.xml` 仍描述“支付服务 - 模拟支付”，`PaymentService` 注释和日志仍写“沙盒版 - 模拟支付 / 沙盒模拟支付 / 模拟支付成功”，`NotificationService` 仍写“沙盒版”和“模拟短信/邮件通知”。
- RED：新增 `frontend/src/lib/payment-notification-production-copy.test.ts` 后，首次运行 `node --test --experimental-strip-types frontend/src/lib/payment-notification-production-copy.test.ts` 失败，命中 `java-payment/pom.xml` 的“支付服务 - 模拟支付”。
- 修复：`java-payment/pom.xml` 改为“支付宝支付、回调处理、支付记录”；`PaymentService` 改为“支付记录服务”，本地支付确认记录不再写沙盒模拟字样；`NotificationService` 改为“通知服务”，短信/邮件日志改为直发记录。
- 当前绿灯：新增 Node 静态测试通过；`mvn -pl java-payment "-Dtest=PaymentControllerTest,MockPaymentServiceTest" "-Dsurefire.failIfNoSpecifiedTests=false" test` 通过 5 tests；`mvn -pl java-notification "-Dtest=NotificationControllerAuthTest,NotificationServiceFullTest" "-Dsurefire.failIfNoSpecifiedTests=false" test` 通过 34 tests。
- 回归验证：`node --test --experimental-strip-types frontend/src/lib/payment-notification-production-copy.test.ts frontend/src/lib/homepage-production-fallback.test.ts frontend/src/lib/seed-assets-production-entry.test.ts frontend/src/lib/favicon-assets-production-entry.test.ts frontend/src/lib/sms-production-copy.test.ts` 通过 13 tests；`scripts\check-production-runtime-defaults.ps1` 通过；`pnpm typecheck` 通过。

## 2026-06-10 阶段 10 第三十八轮：本地支付确认文案收口

- 风险确认：`/api/payment/mock/pay` 默认禁用时的用户可见错误仍写“未启用模拟支付”，`MockPaymentService` 成功响应仍写“模拟支付成功”。显式本地能力保留可以接受，但生产前文案应避免继续把支付确认描述成模拟支付。
- RED：扩展 `frontend/src/lib/payment-notification-production-copy.test.ts` 后，首次运行命中 `PaymentController` 中“未启用模拟支付”。
- 修复：`PaymentController` 默认禁用态文案改为 `当前环境未启用本地支付确认`；`MockPaymentService` 成功文案改为 `本地支付确认成功`。
- 当前绿灯：`node --test --experimental-strip-types frontend/src/lib/payment-notification-production-copy.test.ts` 通过；`mvn -pl java-payment "-Dtest=PaymentControllerTest,MockPaymentServiceTest" "-Dsurefire.failIfNoSpecifiedTests=false" test` 通过。

## 2026-06-10 阶段 10 第三十九轮：支付宝基础配置硬编码收口

- 风险确认：`java-payment/src/main/resources/application.yml` 基础 profile 仍携带 Alipay sandbox gateway、appId、密钥和 localhost return-url fallback；即使生产依赖 `prod-split` 覆盖，仓库默认配置也不应包含这类凭据或外部沙盒默认值。
- RED：扩展 `payment-notification-production-copy.test.ts` 后，首次运行命中基础 `application.yml` 中 Alipay sandbox / 带默认值的敏感占位。
- 修复：基础 `application.yml` 的 `ALIPAY_GATEWAY_URL`、`ALIPAY_APP_ID`、`ALIPAY_MERCHANT_PRIVATE_KEY`、`ALIPAY_PUBLIC_KEY`、`ALIPAY_RETURN_URL`、`ALIPAY_NOTIFY_URL` 均改为空默认占位；不在文档或输出中打印旧密钥内容。
- 守护：`scripts/check-production-runtime-defaults.ps1` 增加基础 profile Alipay 硬编码检查，禁止 sandbox gateway、带默认值的 Alipay 敏感占位和 localhost return-url fallback。
- 当前绿灯：支付静态测试通过；生产默认值守护通过。

## 2026-06-10 阶段 10 第四十轮：grab-service 监听地址显式化

- 风险确认：`grab-service` bootstrap 监听地址如果继续回退 `127.0.0.1`，生产容器缺少 `GRAB_SERVICE_HOST` 时可能静默只监听回环地址。
- RED：扩展 `nestjs/grab-service/src/main.spec.ts`，确认缺少 `GRAB_SERVICE_HOST` 必须抛出 `抢票服务监听地址未配置`。
- 修复：`nestjs/grab-service/src/main.ts` 改为 `requireEnv('GRAB_SERVICE_HOST', '抢票服务监听地址未配置')`；`start-project.ps1` 本地启动显式注入 `GRAB_SERVICE_HOST='127.0.0.1'`。
- 文档/守护：`docs/production-readiness/production-env-vars.md` 将 `GRAB_SERVICE_HOST` 列为必填；生产 Compose 示例要求容器内 `0.0.0.0`；生产默认值守护禁止 `GRAB_SERVICE_HOST || '127.0.0.1'`。
- 当前绿灯：`npm test -- main.spec.ts` 通过；生产默认值守护通过。

## 2026-06-10 阶段 10 第四十一轮：支付确认服务 mock 方法命名收口

- 风险确认：`PaymentConfirmationService` 是支付确认后更新订单状态的共用服务，不应继续暴露 `confirmMockPayment` 方法名；mock 命名应限制在显式本地入口边界内。
- RED：扩展 `payment-notification-production-copy.test.ts` 后，首次运行命中 `PaymentConfirmationService` 中 `confirmMockPayment`。
- 修复：`confirmMockPayment(...)` 重命名为 `confirmLocalPaymentConfirmation(...)`；`MockPaymentService` 和 `MockPaymentServiceTest` 同步调用新方法名。
- 当前绿灯：支付静态测试通过；`mvn -pl java-payment "-Dtest=MockPaymentServiceTest" "-Dsurefire.failIfNoSpecifiedTests=false" test` 通过；生产源码扫描只剩测试断言提及旧方法名。

## 2026-06-10 阶段 10 第四十一轮收尾验证

- 文档同步：已更新 `task_plan.md`、`progress.md`、`findings.md`、`2026-06-06-platform-improvement-roadmap.md` 和 `docs/production-readiness/production-defaults-audit.md`，补齐第三十八到四十一轮收口记录；路线文档旧的“继续阶段 9 全角色旅程审计”建议已改为当前外部凭据门禁和二期增强口径。
- 前端静态回归：`node --test --experimental-strip-types frontend/src/lib/payment-notification-production-copy.test.ts frontend/src/lib/alipay-modal-integration.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/homepage-production-fallback.test.ts frontend/src/lib/seed-assets-production-entry.test.ts frontend/src/lib/favicon-assets-production-entry.test.ts frontend/src/lib/sms-production-copy.test.ts` 通过，18 tests。
- 支付后端回归：`mvn -pl java-payment "-Dtest=PaymentControllerTest,MockPaymentServiceTest,AlipayServiceTest,PaymentAlipayIntegrationTest,PaymentSeataConfirmationTest" "-Dsurefire.failIfNoSpecifiedTests=false" test` 通过，43 tests。`AlipayServiceTest` 中预期异常日志出现，但最终 `Failures: 0, Errors: 0`。
- grab-service 回归：`npm test -- main.spec.ts` 通过，2 tests。
- 生产默认值守护：`powershell -ExecutionPolicy Bypass -File scripts\check-production-runtime-defaults.ps1` 通过，包含基础 Alipay 配置、grab-service runtime fallback、生产环境变量清单等检查。
- 前端类型检查：`pnpm typecheck` 通过。
- diff 检查：`git diff --check` 退出码 0，仅保留既有 LF/CRLF warning。
- 残留扫描：`miniprogram` 运行目录不存在；非文档运行路径无 `miniprogram` 引用；生产运行路径无 Alipay hardcoded sandbox fallback、无 `confirmMockPayment`、无 `GRAB_SERVICE_HOST || '127.0.0.1'`、无旧“未启用模拟支付 / 模拟支付成功”文案。
- 当前未完成项：`task_plan.md` 仅剩 3 个条件项，均依赖外部凭据或用户授权：Sentry 启用态 DSN 验收、PostHog SDK transport 安装/真实 token/host 验收、PostHog enabled/disabled 网络验收。

## 2026-06-10 阶段 10 第四十二轮：java-user grab-service URL 与短信文案残留

- 风险确认：`GrabOpsSummaryClient` 和 `GrabSupportContextInternalClient` 的 Feign 注解仍包含 `${omni.grab-service.url:http://localhost:3001}`，这会让 `java-user prod-split` 在缺少显式抢票服务地址时静默回退本机地址。
- RED：扩展 `scripts/check-production-runtime-defaults.ps1` 后，首次运行失败于 `FAIL java-user prod-split: omni.grab-service.url must require GRAB_SERVICE_URL without fallback`。
- 修复：两个 Feign 客户端改为 `${omni.grab-service.url}`；`application.yml` 保留本地 `GRAB_SERVICE_URL:http://localhost:3001`，`application-prod-split.yml` 要求 `${GRAB_SERVICE_URL}`。
- 本地入口同步：`start-project.ps1` 和 `.idea/workspace.xml` 的 `UserApplication` 显式注入 `http://localhost:3001`，避免生产 profile 收紧后 IDEA 本地启动缺变量。
- 文档/守护：`docs/production-readiness/production-env-vars.md` 新增 `GRAB_SERVICE_URL`，生产默认值守护同时检查 prod-split 配置、Feign 注解和环境变量清单。
- 额外残留：短信守护新增“本地演示验证码”红灯；登录、找回密码和账号设置页改为无论后端是否返回验证码，都只展示“验证码已发送，请按短信提示输入。”。
- 当前绿灯：`node --test --experimental-strip-types frontend/src/lib/sms-production-copy.test.ts` 通过；`mvn -pl java-user "-Dtest=SupportContextInternalClientTest,SupportContextServiceTest,PlatformOpsSummaryServiceTest" "-Dsurefire.failIfNoSpecifiedTests=false" test` 通过 9 tests；`scripts\check-production-runtime-defaults.ps1` 通过；`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过。

## 2026-06-10 阶段 10 第四十三轮：通知偏好短信供应商文案收口

- 风险确认：生产入口扫描发现 `frontend/src/lib/api.ts` 的短信通知偏好仍展示 `暂未接入短信供应商`，`/notifications/settings` 顶部说明仍写“短信通道接入前”。这会把外部供应商接入状态暴露给用户。
- 修复：短信通知偏好状态改为 `暂不可用`，说明改为 `当前仅提供站内消息提醒；短信通知开放后可在这里开启。`；通知设置页顶部说明同步改为用户口径。
- 守护：`frontend/src/lib/sms-production-copy.test.ts` 扩展到 `frontend/src/lib/api.ts` 和 `/notifications/settings`，禁止“暂未接入短信供应商 / 短信通道接入前 / 供应商接入前”回归。
- 当前绿灯：`node --test --experimental-strip-types frontend/src/lib/sms-production-copy.test.ts frontend/src/lib/api.test.ts` 通过 33 tests；短信文案残留扫描无命中。
- 残留判定：`UserAttendeeService` 的“暂不支持该证件类型”是证件类型业务校验；`notification-state.ts` 的 `TODO` 是历史待办通知兼容，已在前序发现中确认保留。

## 2026-06-10 阶段 10 第四十三轮收尾验证

- 前端静态回归：`node --test --experimental-strip-types frontend/src/lib/payment-notification-production-copy.test.ts frontend/src/lib/alipay-modal-integration.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/homepage-production-fallback.test.ts frontend/src/lib/seed-assets-production-entry.test.ts frontend/src/lib/favicon-assets-production-entry.test.ts frontend/src/lib/sms-production-copy.test.ts frontend/src/lib/frontend-branding-production-entry.test.ts frontend/src/lib/global-dialog-production-entry.test.ts frontend/src/lib/api.test.ts` 通过 54 tests。
- 前端类型检查：`pnpm typecheck` 通过。
- 生产默认值守护：`powershell -ExecutionPolicy Bypass -File scripts\check-production-runtime-defaults.ps1` 通过。
- 完整微服务边界验收：`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过；Java 边界测试最终 `BUILD SUCCESS`，中间 timeout stack trace 是 `RefundServiceBoundaryTest` 的预期异常路径。
- 定向补验：`mvn -pl java-user "-Dtest=SupportContextInternalClientTest,SupportContextServiceTest,PlatformOpsSummaryServiceTest" "-Dsurefire.failIfNoSpecifiedTests=false" test` 通过 9 tests；`npm test -- main.spec.ts` 通过 2 tests。
- 残留扫描：运行目录无 `暂未接入短信供应商`、`短信通道接入前`、`供应商接入前`、`本地演示验证码`、`confirmMockPayment`、`GRAB_SERVICE_HOST || '127.0.0.1'`、`omni.grab-service.url:http://localhost:3001`。
- diff 检查：`git diff --check` 退出码 0，仅保留既有 LF/CRLF warning。
- 当时路线判断：本地可验证生产前收口项已完成；`task_plan.md` 仍有 4 个未勾选项，均依赖外部凭据/授权：Sentry 真实 DSN 启用态事件验收、PostHog SDK/真实 token/host 接入与浏览器 Network 验收，以及阶段 8 总括授权项。第四十九轮已按用户确认改为生产运维后置项，不再阻塞当前总路线。

## 2026-06-10 阶段 10 第四十四轮：SeatCraft 扇形几何前后端一致性

- 收尾验证发现：前端全量 `*.test.ts` 首次运行失败 2 个用例，均在 `frontend/src/components/seatcraft/block-layout.test.ts`；扇形区预期 3/6 个座位，实际生成 7/27 个。
- 根因：前端 `buildArcSeats()` 按弧长和座距自动估算每排座位数，而后端 `SeatBlockGeometryService.generateArcSeats()` 按 `seatsPerRow` 固定每排座数生成，并使用 `centerX + radius * cos(angle)` / `centerY + radius * sin(angle)`。
- 修复：前端扇形测试改为对齐后端几何规则；`buildArcSeats()` 使用 `seatsPerRow` 和后端一致坐标公式；新建扇形区默认 `seatsPerRow: 16`；控制面板增加“每排座数”字段。
- 当前绿灯：`node --test --experimental-strip-types src/components/seatcraft/block-layout.test.ts` 通过 36 tests；前端全量 `node --test --experimental-strip-types @files` 通过 265 tests；`pnpm typecheck` 通过。

## 2026-06-10 阶段 10 第四十五轮：总路线本地最终复验与外部门禁确认

- 未完成项复核：`rg -n "\[ \]" task_plan.md` 只剩 4 条，分别是阶段 8 授权 SDK 试点、Sentry 真实 DSN 启用态测试错误验收、PostHog `posthog-js` 安装/transport 接入和 PostHog 浏览器 Network 验收。
- 环境复核：`NEXT_PUBLIC_SENTRY_ENABLED`、`NEXT_PUBLIC_SENTRY_DSN`、`SENTRY_DSN`、`SENTRY_SERVER_ENABLED`、`SENTRY_EDGE_ENABLED`、`NEXT_PUBLIC_POSTHOG_ENABLED`、`NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`、`NEXT_PUBLIC_POSTHOG_HOST` 当前进程均为 missing；`frontend/package.json` 已有 `@sentry/nextjs`，未安装 `posthog-js`。
- Fresh 前端回归：`node --test --experimental-strip-types` 跑完 `frontend/src` 下全量 `*.test.ts/tsx`，结果 265 tests、265 passed、0 failed。
- Fresh 类型检查：`pnpm typecheck` 退出码 0。
- Fresh 生产默认值守护：`powershell -ExecutionPolicy Bypass -File scripts\check-production-runtime-defaults.ps1` 全部 PASS。
- Fresh 微服务边界验收：`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过；服务边界、跨 owner FK、local schema、production split SQL、生产默认值守护和 Java boundary tests 均 PASS，Maven reactor 最终 `BUILD SUCCESS`。
- Fresh seed / Nest 回归：`scripts\verify-prod-split-real-demo-seed.ps1` 通过，活动 120 条、海报不少于 120 张；`npm test -- --runInBand` 在 `nestjs/grab-service` 通过，33 suites passed、2 skipped，383 tests passed、7 skipped、0 failed。
- Fresh diff 检查：`git diff --check` 退出码 0，仅输出既有 LF/CRLF warning。
- 当时结论：本地可验证生产前收口已经完成；外部 Sentry/PostHog 启用态验收缺少真实凭据和 PostHog SDK 安装授权。第四十九轮已按用户确认改为生产运维后置项，不再阻塞当前总路线。

## 2026-06-10 阶段 10 第四十六轮：外部门禁阻塞审计

- 复核 Sentry 试点计划 Task 5：当时下一步明确是等待用户提供真实 `NEXT_PUBLIC_SENTRY_DSN`、`SENTRY_ENVIRONMENT`、`SENTRY_RELEASE`，再临时启用前端并通过浏览器 console 触发 `throw new Error('OMNI_SENTRY_TRIAL_ERROR')`；验收点是 Sentry 项目侧事件可见且敏感字段已脱敏。第四十九轮已改为生产运维上线前补充。
- 复核当前代码扫描：`frontend/instrumentation-client.ts`、`frontend/sentry.server.config.ts`、`frontend/sentry.edge.config.ts` 已有 gated 初始化和脱敏接入；未发现还缺少本地测试错误入口，因为计划本身要求授权环境用浏览器 console 手工触发。
- 复核 PostHog 计划：`docs/superpowers/plans/2026-06-09-posthog-allowlist-wrapper-plan.md` 明确写明安装 `posthog-js` 前必须由用户单独授权，真实 `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` 和 `NEXT_PUBLIC_POSTHOG_HOST` 只能在本机或部署环境设置。
- 复核当前 PostHog wrapper：`frontend/src/lib/analytics.ts` 已有 enabled/token/host/transport gating、allowlist、敏感字段过滤、可注入 `AnalyticsTransport` 和页面级 no-op 调用；缺少的是 SDK transport 安装和真实项目配置，不是本地 wrapper 缺口。
- 阻塞判断：同一个外部门禁已连续多轮复核；在没有真实 DSN/token/host、且没有 PostHog SDK 安装授权前，继续本地改动无法让“完整总路线”更真实，只会把外部验收替换成弱证据。

## 2026-06-10 阶段 10 第四十七轮：PostHog SDK transport 授权接入

- 用户已明确授权安装，按 PostHog allowlist wrapper 计划继续；本轮仍不设置真实 token/host，不写外部项目。
- RED：新增 `frontend/src/lib/posthog-client.test.ts` 后运行 `node --test --experimental-strip-types src/lib/posthog-client.test.ts` 失败，原因是缺少 `frontend/src/lib/posthog-client.ts`，符合预期。
- 安装：执行 `pnpm add posthog-js --registry=https://registry.npmmirror.com`，加入 `posthog-js 1.383.2`；pnpm 因 `core-js` build script 被忽略返回非 0，随后执行 `pnpm approve-builds "!core-js"` 显式拒绝该 build script。
- 实现：`frontend/src/lib/posthog-client.ts` 新增 `initializePostHogAnalytics()` 和 `createPostHogAnalyticsTransport()`；只在 `NEXT_PUBLIC_POSTHOG_ENABLED=true` 且 token/host 齐全时调用 `posthog.init()`，并将 SDK `capture()` 作为 `AnalyticsTransport` 注入现有 wrapper。
- 隐私默认：SDK 初始化固定 `autocapture=false`、`capture_pageview=false`、`disable_session_recording=true`、`person_profiles='never'`；页面仍只调用 `captureAnalyticsEvent()`，不直接导入 `posthog-js`。
- `frontend/src/lib/analytics.ts` 新增 `configureAnalyticsTransport()` 和导出的 `getPublicAnalyticsEnv()`，让 SDK transport 能绑定当前环境配置，不绕过 allowlist 和脱敏。
- 定向绿灯：`node --test --experimental-strip-types src/lib/posthog-client.test.ts src/lib/analytics.test.ts src/lib/analytics-page-integration.test.ts` 通过 12 tests。
- 类型检查：`pnpm typecheck` 退出码 0。
- 浏览器 disabled 态验收：临时前端 `http://127.0.0.1:3011/search`，显式 `NEXT_PUBLIC_POSTHOG_ENABLED=false` 且 token/host 为空；页面 console 0 error / 0 warning；performance resource matching 只包含本地 Next chunk（含本地打包的 `posthog-js`），`external=[]`，未出现外部 PostHog ingest/capture/decide 请求。
- 剩余门禁当时状态：需要真实 `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` 和 `NEXT_PUBLIC_POSTHOG_HOST` 后做 enabled 态浏览器 Network 与 PostHog 项目侧事件验收；Sentry 真实 DSN 启用态验收也未执行。第四十九轮已改为生产运维上线前补充。

## 2026-06-10 阶段 10 第四十八轮：PostHog 安装后 fresh 复验与外部门禁复核

- 清理：上一轮临时前端 `127.0.0.1:3011` 进程 PID `39560` 已停止；复查 `3011` 端口无监听。
- 未完成项复核：`rg -n "\[ \]" task_plan.md` 只剩 3 条，分别是 Sentry 真实 DSN 启用态事件验收、PostHog 真实 token/host enabled 态浏览器 Network / 项目侧事件验收，以及第四十七轮中的同一 PostHog 真实凭据门禁。
- 环境复核：本机 Process/User/Machine 范围内 `NEXT_PUBLIC_SENTRY_DSN`、`SENTRY_ENVIRONMENT`、`SENTRY_RELEASE`、`NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`、`NEXT_PUBLIC_POSTHOG_HOST`、`NEXT_PUBLIC_POSTHOG_ENABLED` 均未配置；`frontend/.env*` 文件不存在。检查只输出存在性和长度，未打印任何凭据值。
- Fresh 前端静态回归：`node --test --experimental-strip-types` 跑完 `frontend/src` 下全量 `*.test.ts/tsx`，结果 268 tests、268 passed、0 failed。
- Fresh 类型检查：`pnpm typecheck` 退出码 0。
- Fresh 生产默认值守护：`powershell -ExecutionPolicy Bypass -File scripts\check-production-runtime-defaults.ps1` 全部 PASS。
- Fresh 微服务边界验收：`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过；服务边界、跨 owner FK、local schema、production split SQL、生产默认值守护和 Java boundary tests 均 PASS，Maven reactor 最终 `BUILD SUCCESS`。中间 `RefundServiceBoundaryTest` timeout stack trace 是预期异常路径，最终 Failures/Errors 为 0。
- Fresh diff 检查：`git diff --check` 退出码 0，仅输出既有 LF/CRLF warning。
- 当前结论：`posthog-js` 已按授权安装并接入 wrapper；本地可验证生产前收口和 disabled 态网络行为通过。真实 Sentry DSN 和 PostHog token/host 尚未注入，项目侧 enabled 验收已在第四十九轮按用户确认后置到生产运维上线前补充。

## 2026-06-10 阶段 10 第四十九轮：外部 SaaS 验收后置到生产运维阶段

- 决策确认：用户确认 Sentry/PostHog 的真实项目、真实凭据注入、enabled 态浏览器 Network 和项目侧事件验收可以等项目进入生产运维阶段再补充，不继续阻塞当前总路线。
- 当前边界：本地生产前路线只声明默认 disabled、脱敏、allowlist、SDK transport、无真实配置时不外发和关闭方案已完成；不声明真实 Sentry/PostHog 项目侧验收已通过。
- 文档同步范围：继续把 `progress.md`、`findings.md`、`docs/production-readiness/production-defaults-audit.md`、Sentry/PostHog 试点文档和总路线文档统一到“生产运维后置项”口径。
- 禁止替代方案：不新增 mock DSN、占位 token、假 transport 或本地日志 transport 来伪装外部 SaaS 验收。
## 2026-06-10 总路线已完成项清理

- 按用户要求清理总路线中已经做完的内容；本次只调整路线视图文档，不删除实现代码、数据库资产或历史证据。
- `task_plan.md` 已从长篇已完成 checklist 压缩为当前状态、生产运维后置项、二期增强候选和后续执行规则。
- `2026-06-06-platform-improvement-roadmap.md` 已从阶段 0-10 完成流水账压缩为当前路线视图、生产运维后置项、二期增强候选、保留原则和参考文档。
- `progress.md` 与 `findings.md` 继续作为历史执行证据和关键发现归档；后续新范围需要重新开明确任务与验收标准。

## 2026-06-10 阶段 11 第一轮：C 端候补与小队业务上下文去 ID 化

- 目标确认：按 `2026-06-06-platform-improvement-roadmap.md` 阶段 11 推进普通用户可解释体验，第一轮聚焦候补列表与小队房间，避免把 `sessionId` / `ticketTypeId` 作为主要展示信息。
- Java ticket：新增只读 purchase context internal 能力，`POST /api/ticket/internal/sales/purchase-context` 通过 `X-Internal-Token` 校验后返回 `activityId`、活动名、海报、场次时间、票档名、场馆名等快照；没有复用会校验可售状态的 `quote()`，避免售罄/下架历史候补无法读取上下文。
- Nest grab-service：`TicketClientService.getPurchaseContext()` 已接入 ticket internal；候补 `create/list/cancel/listByUser` 和小队详情返回会非阻断补充活动、场次、票档、场馆上下文，ticket 服务不可用时保留原记录响应。
- 前端候补页：`frontend/src/lib/waitlist.ts` 新增 `getWaitlistEntryDisplay()`；`/waitlist` 列表主信息改为活动名、场次时间、票档名、场馆和数量，缺上下文时才用中文 `场次 {id}` / `票档 {id}` 兜底。
- 前端小队页：`frontend/src/lib/team-grab.ts` 新增 `teamContextSummary()`；`/teams/[id]` 标题区补活动名、场次时间、票档名、场馆摘要，只保留成员确认数作为主要状态信息，缺上下文时才中文 ID 兜底。
- 测试修正：`waitlist.test.ts` 里“不要显示裸 ID”的断言曾误把日期 `2026` 中的 `202` 当作票档 ID 命中，已收窄为检查 `场次 101` / `票档 202` 标签，避免误报。
- 验证结果：Java 定向测试通过 68 tests；Nest 定向测试通过 3 suites / 42 tests；前端 helper 定向测试通过 19 tests；`pnpm typecheck` 通过；`git diff --check -- ...` 退出码 0，仅有既有 LF/CRLF warning。
- 运行态发现：`/api/waitlist/my` 500 和活动页库存不显示的本地根因是当前运行中的 `omni-grab-service` 容器缺少 `TICKET_SERVICE_URL`，日志报 `票务服务地址未配置`；`docker-compose.yml` 已有该变量，但旧容器需要重建/重启后生效。
- 未执行提交、推送或数据库迁移；本轮没有 schema 变更。

## 2026-06-11 总路线补充：后台中文化与枚举展示治理

- 用户截图反馈：站点变更审核、日志列表、异常任务队列、对账批次列表仍出现英文枚举、对象类型或后端字段名，影响平台后台的中文化和业务可读性。
- 已将“后台中文化与枚举展示治理”加入 `2026-06-06-platform-improvement-roadmap.md` 阶段 13，并在 `task_plan.md` 二期增强候选中补充该专项。
- 已在 `findings.md` 记录具体裸露字段样例：`change_schedule`、`station_config_version`、`venue_application`、`PAYMENT_TIMEOUT`、`REFUND_UNKNOWN`、`TICKET_ISSUE`、`STOCK_SYNC`、`RISK_REVIEW`、`RECONCILE_DIFF`、`paidOrderCount`、`refundAbnormalCount`、`diffCount`。

## 2026-06-11 支付 page-pay 500 修复

- 复现证据：待支付订单 `980057` 通过 `3000`、`8088`、`8084` 调用 `/api/payment/alipay/page-pay` 均返回 `{"code":500,"message":"服务内部错误"}`；`omni_payment.payment` 已有对应 `ALIPAY` 待支付流水，说明失败发生在本地流水创建后。
- RED：新增 `AlipayServiceTest.createPagePayMapsRuntimeExceptionFromAlipayPageExecute` 和 `createPagePayRejectsUnresolvedAlipayPlaceholderBeforePaymentInsert`；首次运行 `mvn -pl java-payment "-Dtest=AlipayServiceTest" "-Dsurefire.failIfNoSpecifiedTests=false" test` 失败，分别证明 `RuntimeException` 会穿透、`${ALIPAY_APP_ID}` 会被误认为有效配置。
- 修复：`AlipayService.createPagePay()` 增加 `BusinessException` 原样抛出、`AlipayApiException | RuntimeException` 统一转为“生成支付宝支付表单失败”并标记支付流水失败；`requireText()` 增加未解析 `${...}` 占位符校验，缺 Alipay 环境变量时提前返回明确中文配置错误。
- 验证：`mvn -pl java-payment "-Dtest=AlipayServiceTest" "-Dsurefire.failIfNoSpecifiedTests=false" test` 通过 18 tests；支付相关回归 `mvn -pl java-payment "-Dtest=AlipayServiceTest,PaymentAlipayIntegrationTest,PaymentControllerTest,MockPaymentServiceTest,PaymentSeataConfirmationTest" "-Dsurefire.failIfNoSpecifiedTests=false" test` 通过 45 tests。
- 运行态注意：IDEA 中正在运行的 `java-payment` 需要重启后才会加载本次代码；若 Alipay 环境变量仍未配置，修复后的表现会从通用 500 变为明确的中文配置错误，不会伪装成已可真实支付。

## 2026-06-11 阶段 13 第一轮：后台中文化与枚举展示治理

- 已按用户截图把“后台中文化与枚举展示治理”列入总路线阶段 13，并补充到 `task_plan.md` 二期增强候选；本轮继续直接落地第一批高频后台表格。
- RED：在 `frontend/src/lib/operation-display.test.ts` 补充站点变更类型、审计对象类型、异常任务类型、对账摘要字段的中文断言；首次运行 `node --test --experimental-strip-types src/lib/operation-display.test.ts` 失败，原因是缺少 `formatReconciliationSummaryKey` 导出。
- 修复：`frontend/src/lib/operation-display.ts` 新增集中映射，覆盖 `change_schedule` / `set_schedule`、`station_config_version` / `venue_application` / `activity`、`PAYMENT_TIMEOUT` / `REFUND_UNKNOWN` / `TICKET_ISSUE` / `STOCK_SYNC` / `RISK_REVIEW` / `RECONCILE_DIFF`、`paidOrderCount` / `refundAbnormalCount` / `diffCount` 等字段。
- 页面接入：站点变更审核使用 `formatStationConfigChangeType()`；日志列表和异常任务队列将 `TraceId` 列名/筛选提示改为“追踪编号”；对账批次摘要渲染时将 JSON key 转为中文业务字段名，并使用中文冒号。
- 验证：`node --test --experimental-strip-types src/lib/operation-display.test.ts` 通过 3 tests；`pnpm typecheck` 退出码 0；相关页面扫描中裸英文值只剩在集中映射和测试断言里；`git diff --check -- ...` 退出码 0，仅有既有 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 11 第二轮：订单座位显示与链路耗时排查

- 用户反馈订单 `DM202606110047432ACEBE` 已购票但订单卡仍显示“座位信息生成中”；按前端显示、订单 API DTO、订单库和电子票库逐层排查。
- 数据库证据：该订单 `status=2` 已支付，`order_snapshot.seat_selection_mode = NONE`，`order_seat` 无记录，`electronic_ticket` 已生成且 `seat_label` 为空；这说明该票档是无固定座位，不是座位仍在生成。
- RED：在 `frontend/src/lib/orders-experience.test.ts` 新增 `formatOrderSeatLabel()` 断言；首次运行 `node --test --experimental-strip-types src/lib/orders-experience.test.ts` 因缺少导出失败，符合预期。
- 修复：`frontend/src/lib/orders-experience.ts` 新增 `formatOrderSeatLabel()`，前端 `OrderEntity` 补 `seatSelectionMode`；订单列表和订单详情用该 helper 展示座位信息。`seatSelectionMode=NONE` 显示“无固定座位，凭电子票入场”，待支付座位订单显示“支付成功后确认座位信息”，保留真实座位标签。
- 票夹体验补充：`frontend/src/lib/ticket-wallet-experience.ts` 与相关测试已接入，票夹卡片补电子票状态解释，并将票夹标题入口指向具体订单详情。
- 链路耗时排查：Gateway 对客服流式接口已是 `response-timeout=-1`，抢票/候补是 15 秒长路由；本机 Ollama `Qwen2.5:7b` `/api/chat` 一次只读探针约 `10435ms`，客服慢主要在模型推理或 FAQ 未命中后的模型回落，不应归因于网关。
- 抢票/出票证据：最近两笔 `grab_request` 到 `ORDER_CREATED` 分别约 `0.520s` 和 `1.716s`；订单 `980058` 支付确认后电子票写入比订单更新时间晚约 `0.087s`。但 `omni-grab-service` 日志仍有 `订单查询失败` / `fetch failed`，且容器内通过 Gateway 调订单 internal 约 `111ms`、直连订单服务约 `12ms`；后续应把链路耗时治理列入总路线，区分 Gateway、内部服务、Redis、数据库和模型耗时。
- 文档同步：`2026-06-06-platform-improvement-roadmap.md` 阶段 14 与 `task_plan.md` 二期候选已补“链路耗时治理”；`findings.md` 记录订单座位和耗时证据。

## 2026-06-11 阶段 14 第一轮：grab-service 内部调用直连 order/ticket

- 根因收敛：AI 客服慢主要受本地 Ollama 推理或 FAQ 未命中后模型回落影响；抢票/出票链路中订单、票务 internal 调用经 Gateway 会增加可观耗时，但出票写库本身已有证据显示很快，因此不能继续把两个问题都归因到“网关需要升级”。
- RED：扩展 `scripts/check-production-runtime-defaults.ps1`，要求本地 `docker-compose.yml` 的 `ORDER_SERVICE_URL` / `TICKET_SERVICE_URL` 分别直连 `host.docker.internal:8083` / `host.docker.internal:8082`，并要求 `start-project.ps1` 分别直连 `localhost:8083` / `localhost:8082`；首次运行失败，命中旧 `8088` Gateway 配置。
- 修复：`docker-compose.yml` 中 `grab-service` 的 order/ticket internal URL 改为直连 `java-order` / `java-ticket`，同时显式补 `NOTIFICATION_SERVICE_URL`；`start-project.ps1` 中 `grab-service` 的 order/ticket URL 改为 `8083` / `8082`，通知链路暂保留 Gateway。
- 文档同步：`docs/operations/2026-06-03-linux-b-side-deployment-supplement.md` 和 `docs/production-readiness/production-env-vars.md` 已改成服务间 internal 调用优先直连 order/ticket，不再推荐这两条链路经 Gateway。
- 运行态注意：Docker Compose 环境变量变更需要重新创建 `omni-grab-service` 容器才会生效；只重启旧容器通常不会刷新 env。如果用 `start-project.ps1` 本地进程方式启动，则需要停止旧 grab-service 进程后重新执行脚本。

## 2026-06-11 首页轮播图海报适配

- 用户反馈首页轮播不应继续使用活动封面；当前 `frontend/src/app/page.tsx` 的旧逻辑确实直接用 `activity.poster` 生成轮播，导致活动竖版封面被放大成首页横幅。
- RED：在 `frontend/src/lib/homepage-production-fallback.test.ts` 增加“首页轮播使用独立宽屏海报，不使用活动封面”的静态守护；首次运行命中 `imageUrl: activity.poster`，符合预期。
- 修复：新增三张本地横幅资源 `frontend/public/images/banners/home-concert.jpg`、`home-festival.jpg`、`home-theatre.jpg`，统一裁切为 `1600x686`；首页改为固定 `HOME_BANNER_SLIDES`，分别跳转演唱会、音乐节和话剧歌剧搜索入口，活动卡片仍使用真实活动封面。
- 验证：`node --test --experimental-strip-types frontend/src/lib/homepage-production-fallback.test.ts` 通过 4 tests；`pnpm typecheck` 通过；`git diff --check -- frontend/src/app/page.tsx frontend/src/lib/homepage-production-fallback.test.ts frontend/public/images/banners/home-concert.jpg frontend/public/images/banners/home-festival.jpg frontend/public/images/banners/home-theatre.jpg` 退出码 0。
- 浏览器验证：当前 `localhost:3000` 是运行 2 小时的 Docker `omni-frontend` 旧容器，不会读取本地新源码；已临时启动 `http://127.0.0.1:3012` 验证新版首页，三张横幅均加载为本地 `/images/banners/...`，自然尺寸 `1600x686`，控制台无 error/warning，并保存截图 `runtime/home-banners-3012.png`。

## 2026-06-11 阶段 14 第二轮：Gateway / 直连 / Ollama 本地模型耗时拆分

- 目标：继续推进“链路耗时治理”，把 AI 客服慢响应从 Gateway/direct 服务耗时中拆出来，避免继续把本地模型推理慢误判为网关问题。
- RED：重写并扩展 `scripts/test-measure-gateway-latency.ps1`，要求默认场景仍输出 6 行 Gateway/direct 测量结果；传入 `-IncludeOllama` 时必须额外输出 `ollama.tags` 和 `ollama.chat` 两行，`mode=local-model`，服务不可用时返回中文错误。首次运行失败于仅输出 6 行，证明主脚本尚未实现本地模型分段。
- 修复：`scripts/measure-gateway-latency.ps1` 新增 `-IncludeOllama`、`-OllamaBaseUrl`、`-OllamaModel`、`-OllamaPrompt` 参数；开启后只读探测 `/api/tags`，并用短中文 prompt 调 `/api/chat`，结果以 `mode=local-model` 输出，不混入 Gateway/direct 对比。
- 编码修复：脚本源码避免直接写入中文默认 prompt，改用 Unicode 码点生成默认中文文本，避免 Windows PowerShell 在不同编码视图下把中文字符串读坏导致脚本解析失败。
- 验证：`powershell -ExecutionPolicy Bypass -File scripts\test-measure-gateway-latency.ps1` 通过；`powershell -ExecutionPolicy Bypass -File scripts\measure-gateway-latency.ps1 -Iterations 1 -TimeoutSec 5 -IncludeOllama` 返回 8 行结果。
- 本机样本：本轮 `ticket.activities` Gateway/direct 分别约 `45.51ms` / `40.27ms`，`user.login` 约 `99.48ms` / `100.26ms`，`notification.list` 约 `33.83ms` / `24.82ms`；`ollama.tags` 约 `17.3ms`，`ollama.chat` 约 `3152.92ms`。这说明本机 AI 客服慢点和模型推理耗时强相关，不能只靠升级 Gateway 解决。

## 2026-06-11 阶段 11 第三轮：订单详情退款状态并入顶部时间线

- 目标：继续补阶段 11“订单/票夹/退款时间线”，让用户打开订单详情顶部就能看到最新退款状态，不必先读完下方退款卡片才知道当前处于审核、处理中、失败或完成。
- RED：在 `frontend/src/lib/orders-experience.test.ts` 新增最新退款单影响订单时间线的断言；首次运行 `node --test --experimental-strip-types frontend/src/lib/orders-experience.test.ts` 失败，实际第三步仍为“出票入场”，没有吸收退款上下文。
- RED：在 `frontend/src/lib/orders-production-entry.test.ts` 新增静态入口守护，要求 `frontend/src/app/orders/[id]/page.tsx` 调用 `buildOrderDetailTimeline(order, latestRefund)`；首次运行失败，说明页面仍只传订单状态。
- 修复：`buildOrderDetailTimeline()` 增加可选 `latestRefund` 参数，第三步优先映射为“退款审核中 / 退款处理中 / 退款已拒绝 / 退款失败 / 退款完成 / 退款状态同步中”，并使用退款创建、审核或退款完成时间作为展示时间。
- 页面接入：订单详情页把 `latestRefund` 传入顶部时间线；下方“退款与售后”卡片继续保留完整三步退款流程和审核备注。
- 验证：`node --test --experimental-strip-types frontend/src/lib/orders-experience.test.ts` 通过 5 tests；`node --test --experimental-strip-types frontend/src/lib/orders-production-entry.test.ts` 通过 3 tests；`node --test --experimental-strip-types frontend/src/lib/refund-flow.test.ts` 通过 3 tests；`npm run typecheck` 通过；`git diff --check -- frontend/src/lib/orders-experience.ts frontend/src/lib/orders-experience.test.ts frontend/src/lib/orders-production-entry.test.ts frontend/src/app/orders/[id]/page.tsx` 退出码 0，仅有既有 LF/CRLF warning。
- 运行态注意：本轮仅改前端展示和静态/类型测试，没有数据库结构变更，不需要迁移；当前全局 `pnpm` shim 损坏，`pnpm typecheck` 报找不到 `C:\Program Files\nodejs\node_modules\pnpm\bin\pnpm.mjs`，已改用不下载依赖的 `npm run typecheck` 调本地 TypeScript 完成验证。

## 2026-06-11 阶段 11 第四轮：退款通知动作闭环

- 目标：继续补阶段 11“通知动作闭环”，让退款相关站内消息显示明确中文业务分类，并一键进入订单详情查看退款进度。
- RED：在 `frontend/src/components/notification-state.test.ts` 新增 `REFUND_APPROVED` / `REFUND_FAILED` 中文分类和跳转断言；首次运行 `node --test --experimental-strip-types frontend/src/components/notification-state.test.ts` 失败，实际分类为“站内消息”，按钮文案为“查看相关订单”。
- 修复：`frontend/src/components/notification-state.ts` 新增 `REFUND_REQUESTED`、`REFUND_APPROVED`、`REFUND_REJECTED`、`REFUND_PROCESSING`、`REFUND_FAILED`、`REFUND_COMPLETED` 的中文分类和颜色；`getNotificationAction()` 对 `REFUND_*` 统一跳转订单详情，有 `orderId` 时按钮为“查看退款进度”，无 `orderId` 时进入订单列表并显示“查看退款订单”。
- 验证：`node --test --experimental-strip-types frontend/src/components/notification-state.test.ts` 通过 15 tests；`npm run typecheck` 通过；`git diff --check -- frontend/src/components/notification-state.ts frontend/src/components/notification-state.test.ts` 退出码 0，仅有既有 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 11 第五轮：搜索页右栏推荐吸收近期浏览信号

- 目标：继续补阶段 11“搜索与推荐体验”，让搜索页右侧“您可能还喜欢”不再只是当前结果前 4 条，而是优先吸收近期浏览的类目、艺人和城市信号；没有真实候选时不展示假推荐。
- RED：在 `frontend/src/lib/search-experience.test.ts` 新增 `buildSearchSidebarRecommendations()` 断言；首次运行 `node --test --experimental-strip-types frontend/src/lib/search-experience.test.ts` 失败，原因是 `search-experience.ts` 未导出该 helper。
- RED：新增 `frontend/src/lib/search-production-entry.test.ts` 静态入口守护，要求搜索页读取 `ACTIVITY_VIEW_SIGNAL_KEY`、调用 `parseActivityViewSignals()` 和 `buildSearchSidebarRecommendations()`，并禁止回退到 `activities.slice(0, 4).map`；首次运行失败，页面仍未接入浏览信号。
- 修复：`frontend/src/lib/search-experience.ts` 新增 `buildSearchSidebarRecommendations()`，按近期浏览信号对真实活动候选打分，过滤已浏览活动，去重后用真实候选补满；空候选返回空数组。
- 页面接入：`frontend/src/app/search/page.tsx` 读取本地 `omni_activity_view_signals`，右栏改为渲染 `sidebarRecommendations`；没有候选时隐藏右栏，不引入 mock/offline 推荐。
- 验证：`node --test --experimental-strip-types frontend/src/lib/search-experience.test.ts` 通过 7 tests；`node --test --experimental-strip-types frontend/src/lib/search-production-entry.test.ts` 通过 1 test；`node --test --experimental-strip-types frontend/src/lib/personalized-recommendations.test.ts` 通过 4 tests；`npm run typecheck` 通过；`git diff --check -- frontend/src/lib/search-experience.ts frontend/src/lib/search-experience.test.ts frontend/src/lib/search-production-entry.test.ts frontend/src/app/search/page.tsx` 退出码 0，仅有既有 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 11 第六轮：搜索空结果最近浏览召回

- 目标：继续补阶段 11“搜索与推荐体验”，让冷门关键词或严格筛选无结果时，用户仍能基于真实近期浏览回到已看过的演出，不只看到“清空筛选”。
- RED：扩展 `frontend/src/lib/search-experience.test.ts`，要求 `buildEmptySearchRecommendations()` 返回 `recentTerms`，并在关键词无匹配时从 `viewSignals` 的真实标题去重生成最近浏览召回；首次运行失败，实际 `recentTerms` 为 `undefined`。
- RED：扩展 `frontend/src/lib/search-production-entry.test.ts`，要求搜索页空结果态包含 `recentTerms` 和“最近浏览”分组；首次运行失败，页面只展示相关演出和相邻城市。
- 修复：`buildEmptySearchRecommendations()` 增加可选 `viewSignals` 输入，返回 `recentTerms`；它只使用本地浏览历史里保存的真实活动标题，去重并排除已作为相关演出的标题。
- 页面接入：搜索空结果卡片新增“最近浏览”分组，点击后按该真实标题重新搜索；没有最近浏览时不显示该分组。
- 验证：`node --test --experimental-strip-types frontend/src/lib/search-experience.test.ts frontend/src/lib/search-production-entry.test.ts frontend/src/lib/personalized-recommendations.test.ts` 通过 14 tests；`npm run typecheck` 通过；`git diff --check -- frontend/src/lib/search-experience.ts frontend/src/lib/search-experience.test.ts frontend/src/lib/search-production-entry.test.ts frontend/src/app/search/page.tsx` 退出码 0，仅有既有 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 11 第七轮：搜索联想吸收近期浏览标题和艺人

- 目标：继续补阶段 11“搜索建议”，让搜索页联想不只来自搜索历史、热门词和当前结果，也能吸收近期浏览活动里的真实标题和艺人名。
- RED：在 `frontend/src/lib/search-experience.test.ts` 新增近期浏览标题/艺人生成联想断言；首次运行失败，返回空数组，说明 `buildSearchSuggestions()` 未读取 `viewSignals`。
- RED：扩展 `frontend/src/lib/search-production-entry.test.ts`，要求搜索页调用 `buildSearchSuggestions()` 时传入 `viewSignals`；首次运行失败，页面联想入参未包含近期浏览信号。
- 修复：`buildSearchSuggestions()` 增加可选 `viewSignals` 输入，并从最近 8 条浏览信号中提取活动标题和艺人名，按已有去重和关键词包含规则参与联想。
- 页面接入：搜索页把本地解析出的 `viewSignals` 传给 `buildSearchSuggestions()`，继续保持原有搜索历史、热门词和当前结果词逻辑。
- 验证：`node --test --experimental-strip-types frontend/src/lib/search-experience.test.ts frontend/src/lib/search-production-entry.test.ts frontend/src/lib/personalized-recommendations.test.ts` 通过 16 tests；`npm run typecheck` 通过；`git diff --check -- frontend/src/lib/search-experience.ts frontend/src/lib/search-experience.test.ts frontend/src/lib/search-production-entry.test.ts frontend/src/app/search/page.tsx` 退出码 0，仅有既有 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 11 第八轮：订阅页空态承接近期浏览提醒入口

- 目标：继续补阶段 11“搜索与推荐体验”里的订阅艺人/开票提醒入口，让用户从“想看与提醒”空态能基于真实近期浏览回到活动详情开启开售提醒、添加想看或关注艺人，而不是只看到一句静态说明。
- RED：新增 `frontend/src/lib/subscription-entry.test.ts`，要求 `buildSubscriptionEmptyGuides()` 从近期浏览信号生成去重后的详情页导流，并按活动售卖状态区分“开启开售提醒”和“去添加想看”；首次运行失败，原因是 `subscription.ts` 未导出该 helper。
- RED：新增 `frontend/src/lib/subscriptions-production-entry.test.ts`，要求订阅页读取 `ACTIVITY_VIEW_SIGNAL_KEY`、调用 `parseActivityViewSignals()` 和 `buildSubscriptionEmptyGuides()`，并渲染“最近浏览”入口；首次运行失败，说明订阅页空态尚未接入浏览信号。
- 修复：`ActivityViewSignal` 补充可选 `status`，活动详情页写入浏览信号时保存当前活动售卖状态；`subscription.ts` 新增 `buildSubscriptionEmptyGuides()`，只使用有真实 `activityId` 和标题的浏览记录，不生成假活动。
- 页面接入：`/subscriptions` 空态新增“最近浏览”卡片，展示海报、标题、城市/艺人摘要、动作标签和艺人关注提示；点击卡片跳转 `/activity/{activityId}`，由活动详情页真实订阅按钮完成开售提醒、想看或关注艺人。
- 验证：`node --test --experimental-strip-types frontend/src/lib/subscription-entry.test.ts frontend/src/lib/subscriptions-production-entry.test.ts frontend/src/lib/activity-actions.test.ts frontend/src/lib/personalized-recommendations.test.ts frontend/src/lib/search-experience.test.ts frontend/src/lib/search-production-entry.test.ts` 通过 25 tests；`npm run typecheck` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 11 第九轮：候补上下文缺失兜底去 ID 化

- 目标：继续补阶段 11“候补页去 ID 化”，避免后端上下文暂未同步时把 `sessionId` / `ticketTypeId` 当作候补卡片主标题或主要说明展示给用户。
- RED：修改 `frontend/src/lib/waitlist.test.ts` 中候补上下文缺失用例，要求兜底为“活动信息同步中 / 票档信息同步中”，并断言不包含 `101` / `202` 这类原始 ID；首次运行失败，实际标题仍为“场次 101”。
- 修复：`getWaitlistEntryDisplay()` 保持真实 `activityName`、`ticketTypeName`、`venueName` 优先；缺失活动上下文时改用中文同步态，不再把场次和票档 ID 放进主展示信息。
- 验证：`node --test --experimental-strip-types frontend/src/lib/waitlist.test.ts` 通过 7 tests。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 11 第十轮：小队房间主要信息去技术 ID 化

- 目标：继续补阶段 11“小队抢票去 ID 化”，让小队房间主要界面展示活动、场次、票档、成员确认、策略、订单和进度语义，而不是 `team.id`、`requestId`、`userId`、`seatId/orderSeatId` 等技术标识。
- RED：扩展 `frontend/src/lib/team-grab.test.ts`，要求小队上下文缺失时显示“活动信息同步中 / 场次信息同步中 / 票档信息同步中”，座位无可读标签时显示“座位确认中”，并新增 `teamMemberDisplayName()` 断言；首次运行失败，原因是 helper 未导出且旧兜底仍展示 ID。
- RED：新增 `frontend/src/lib/team-room-production-entry.test.ts`，静态守护小队房间页面不再展示“小队房间 #id”“小队 ID”“requestId {requestId}”“订单 {latestOrderId}”“用户 {member.userId}”，并要求成员列表使用 `teamMemberDisplayName()`；首次运行失败，命中这些旧文案。
- 修复：`teamContextSummary()` 和 `teamMemberSeatAssignmentLabel()` 改为中文同步态兜底；新增 `teamMemberDisplayName()` 输出“我 / 队长 / 成员 N”；小队页面移除主标题和邀请区的小队 ID、隐藏 requestId、锁票订单改为“锁票订单已生成”，成员和座位分配不再显示用户 ID，支付弹窗商品名改为“小队锁票订单”。
- 验证：`node --test --experimental-strip-types frontend/src/lib/waitlist.test.ts frontend/src/lib/team-grab.test.ts frontend/src/lib/team-room-production-entry.test.ts` 通过 22 tests；`npm run typecheck` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第一轮：入场核验页场次查询文案去技术 ID 化

- 目标：继续补阶段 13“后台中文化与枚举展示治理”，先收口控制台入场核验页场次查询入口，不把 `sessionId` 概念作为用户主要文案。
- RED：新增 `frontend/src/lib/check-in-production-entry.test.ts`，要求 `frontend/src/app/console/check-in/page.tsx` 不再出现“场次 ID”，并保留“请求号”这类带中文语境的技术追踪列名；首次运行失败，命中“场次ID不正确 / 场次 ID / 请输入场次 ID”。
- 修复：页面用户可见文案改为“场次编号不正确 / 场次编号 / 请输入场次编号”；保留 `sessionId`、`sessionIdInput` 和 API 参数不变，避免影响后端契约。
- 验证：`node --test --experimental-strip-types frontend/src/lib/check-in-production-entry.test.ts` 通过 1 test；`node --test --experimental-strip-types frontend/src/lib/operation-display.test.ts frontend/src/lib/check-in-production-entry.test.ts` 通过 4 tests；`npm run typecheck` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第二轮：审计日志筛选与目标引用编号中文化

- 目标：继续补阶段 13“后台中文化与枚举展示治理”，把操作审计页筛选框和目标引用中的裸 `ID` 文案收口为中文业务编号。
- RED：新增 `frontend/src/lib/audit-log-production-entry.test.ts`，要求审计日志页不再出现“操作人ID”，并保留“追踪编号”；首次运行失败，命中旧 placeholder。
- RED：扩展 `frontend/src/lib/operation-display.test.ts`，要求 `formatOperationTargetRef()` 输出“客服账号编号 / 负责人编号 / 对象编号”，`formatOrganizerOpsAccountLabel()` 输出“编号”；首次运行失败，旧实现仍返回 `ID：88`。
- 修复：审计日志筛选 placeholder 改为“操作人编号”；操作目标引用按目标类型输出“客服账号编号”“负责人编号”或通用“对象编号”；平台主办方运营员展示改为“编号”。
- 验证：`node --test --experimental-strip-types frontend/src/lib/operation-display.test.ts` 通过 3 tests；`node --test --experimental-strip-types frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/check-in-production-entry.test.ts frontend/src/lib/operation-display.test.ts` 通过 5 tests；`npm run typecheck` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第三轮：对账页后端码值统一中文兜底

- 目标：继续补阶段 13“后台中文化与枚举展示治理”，避免对账页遇到新增后端状态、来源、业务类型或差异类型时直接显示英文/下划线码值。
- RED：扩展 `frontend/src/lib/operation-display.test.ts`，要求对账批次状态、明细状态、差异状态、来源、业务类型和差异类型都由共享 formatter 输出中文；未知值显示“未知状态 / 未知来源 / 未知业务类型 / 未知差异类型”；首次运行失败于缺少导出。
- RED：新增 `frontend/src/lib/reconciliation-production-entry.test.ts`，要求对账页使用共享 formatter，且不再保留 `return status || '-'`、`return type || '-'`、`return source || '-'` 这类原样兜底；首次运行失败，命中页面本地 formatter。
- 修复：`operation-display.ts` 新增对账状态、来源、业务类型和差异类型映射函数，并用中文未知标签兜底；`/console/reconciliation` 移除本地 formatter，统一调用共享显示层。
- 验证：`node --test --experimental-strip-types frontend/src/lib/operation-display.test.ts` 通过 3 tests；`node --test --experimental-strip-types frontend/src/lib/reconciliation-production-entry.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/check-in-production-entry.test.ts frontend/src/lib/operation-display.test.ts` 通过 6 tests；`npm run typecheck` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第四轮：站点变更类型未知值中文兜底

- 目标：继续补阶段 13“后台中文化与枚举展示治理”，避免站点变更审核遇到新增 `changeType` 时把英文/下划线码值直接展示给平台管理员。
- RED：扩展 `frontend/src/lib/operation-display.test.ts`，要求 `formatStationConfigChangeType('future_change_type')` 返回“未知变更类型”；首次运行失败，旧实现返回原始码值。
- 修复：`formatStationConfigChangeType()` 改为已知值精确映射、未知值显示“未知变更类型”；站点变更审核页已使用该共享 formatter，无需改接口和页面结构。
- 验证：`node --test --experimental-strip-types frontend/src/lib/operation-display.test.ts` 通过 3 tests；`node --test --experimental-strip-types frontend/src/lib/reconciliation-production-entry.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/check-in-production-entry.test.ts frontend/src/lib/operation-display.test.ts` 通过 6 tests；`npm run typecheck` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第五轮：异常任务未知码值中文兜底

- 目标：继续补阶段 13“后台中文化与枚举展示治理”，避免异常任务页遇到新增任务类型、等级或状态时直接显示英文/下划线码值。
- RED：扩展 `frontend/src/lib/operation-display.test.ts`，要求未知异常任务类型显示“未知异常类型”、未知等级显示“未知等级”、未知状态显示“未知状态”；首次运行失败，旧实现返回 `FUTURE_TASK`。
- 修复：`formatExceptionTaskType()`、`formatExceptionSeverity()`、`formatExceptionStatus()` 改为已知值精确映射、未知值中文兜底；异常任务页已使用这些共享 formatter，无需改接口和页面结构。
- 验证：`node --test --experimental-strip-types frontend/src/lib/operation-display.test.ts` 通过 3 tests；`node --test --experimental-strip-types frontend/src/lib/reconciliation-production-entry.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/check-in-production-entry.test.ts frontend/src/lib/operation-display.test.ts` 通过 6 tests；`npm run typecheck` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第六轮：操作审计未知枚举中文兜底

- 目标：继续补阶段 13“后台中文化与枚举展示治理”，避免操作审计日志遇到新增角色、动作或对象类型时直接显示英文/下划线码值。
- RED：扩展 `frontend/src/lib/operation-display.test.ts`，要求未知角色显示“未知角色”、未知操作显示“未知操作”、未知对象类型显示“未知对象”；首次运行失败，旧实现返回 `future_role`。
- 修复：`formatOperatorRole()`、`formatOperationAction()`、`formatOperationTargetType()` 改为已知值精确映射、未知值中文兜底；审计日志页已使用这些共享 formatter，无需改接口和页面结构。
- 验证：`node --test --experimental-strip-types frontend/src/lib/operation-display.test.ts` 通过 3 tests；`node --test --experimental-strip-types frontend/src/lib/reconciliation-production-entry.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/check-in-production-entry.test.ts frontend/src/lib/operation-display.test.ts` 通过 6 tests；`npm run typecheck` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第七轮：对账摘要未知字段中文兜底

- 目标：继续补阶段 13“后台中文化与枚举展示治理”，避免对账批次摘要遇到新增统计字段时直接显示后端字段名。
- RED：扩展 `frontend/src/lib/operation-display.test.ts`，要求 `formatReconciliationSummaryKey('futureMetricCount')` 返回“其他指标”；首次运行失败，旧实现返回原始字段名。
- 修复：`formatReconciliationSummaryKey()` 改为已知字段精确映射、未知字段显示“其他指标”；对账页已通过 `parseSummary()` 使用该共享 formatter，无需改接口和页面结构。
- 验证：`node --test --experimental-strip-types frontend/src/lib/operation-display.test.ts` 通过 3 tests；`node --test --experimental-strip-types frontend/src/lib/reconciliation-production-entry.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/check-in-production-entry.test.ts frontend/src/lib/operation-display.test.ts` 通过 6 tests；`npm run typecheck` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第八轮：退款审核页编号语境中文化

- 目标：继续补阶段 13“后台中文化与枚举展示治理”，避免退款审核表格直接展示“用户ID”或 `ID:` 这类技术字段口吻。
- RED：新增 `frontend/src/lib/refunds-production-entry.test.ts`，要求退款审核页不出现“用户ID”或 `ID:`，并包含“用户编号”“订单编号”；首次运行失败，命中旧表头和订单补充信息。
- 修复：`/console/refunds` 表头改为“用户编号”，订单补充信息改为“订单编号：{refund.orderId}”；保留 `refund.userId`、`refund.orderId` 数据字段和审核接口不变。
- 验证：`node --test --experimental-strip-types frontend/src/lib/refunds-production-entry.test.ts` 通过 1 test；`node --test --experimental-strip-types frontend/src/lib/refunds-production-entry.test.ts frontend/src/lib/reconciliation-production-entry.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/check-in-production-entry.test.ts frontend/src/lib/operation-display.test.ts` 通过 7 tests；`npm run typecheck` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 12 第一轮：退款审核页 CSV 明细导出

- 目标：推进阶段 12“报表导出升级”，在不新增依赖的前提下给退款审核页补可下载退款明细 CSV，并避免导出用户编号、支付流水、支付宝退款号、审核人编号等内部或敏感字段。
- RED：新增 `frontend/src/lib/console-refunds.test.ts`，要求 `buildConsoleRefundExportCsv()` 导出“退款号、订单号、活动、金额、状态、原因、申请时间、审核时间、到账时间”，并断言不包含 `userId`、`paymentId`、`reviewerId`、`alipayRefundNo`、内部 `orderId`；首次运行失败于缺少 helper。
- RED：扩展 `frontend/src/lib/refunds-production-entry.test.ts`，要求退款审核页接入 `buildConsoleRefundExportCsv` 和“导出退款明细”按钮；首次运行失败，页面只有刷新入口。
- 修复：新增 `frontend/src/lib/console-refunds.ts` 生成带 BOM 的退款 CSV；`/console/refunds` 增加“导出退款明细”按钮、空态提示和成功反馈，导出当前筛选加载到页面的退款申请。
- 验证：`node --test --experimental-strip-types frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts` 通过 2 tests；`node --test --experimental-strip-types frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts frontend/src/lib/console-orders.test.ts frontend/src/lib/reconciliation-production-entry.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/check-in-production-entry.test.ts frontend/src/lib/operation-display.test.ts` 通过 13 tests；`npm run typecheck` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 12 第二轮：入场核验记录 CSV 导出

- 目标：继续推进阶段 12“报表导出升级”，给控制台入场核验页补可下载核验记录 CSV，并避免把票据、订单、用户、场次、票档、操作人等内部关联编号导出给主办方。
- RED：新增 `frontend/src/lib/console-check-in.test.ts`，要求 `buildConsoleCheckInExportCsv()` 导出“请求号、票号、设备、渠道、结果、失败原因、核验时间”，并断言不包含 `ticketId`、`orderId`、`userId`、`sessionId`、`ticketTypeId`、`operatorUserId` 的样例值；首次运行失败于缺少 helper。
- RED：扩展 `frontend/src/lib/check-in-production-entry.test.ts`，要求入场核验页接入 `buildConsoleCheckInExportCsv` 和“导出核验记录”按钮；首次运行失败，页面只有查询入口。
- 修复：新增 `frontend/src/lib/console-check-in.ts` 生成带 BOM 的核验 CSV，结果码映射为“成功 / 重复 / 失败 / 未知结果”；`/console/check-in` 增加“导出核验记录”按钮、空态提示和成功反馈，导出当前查询加载到页面的核验记录。
- 验证：`node --test --experimental-strip-types frontend/src/lib/console-check-in.test.ts frontend/src/lib/check-in-production-entry.test.ts` 通过 2 tests；`node --test --experimental-strip-types frontend/src/lib/console-check-in.test.ts frontend/src/lib/check-in-production-entry.test.ts frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts frontend/src/lib/console-orders.test.ts frontend/src/lib/reconciliation-production-entry.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/operation-display.test.ts` 通过 14 tests；`npm run typecheck` 通过；`git diff --check -- frontend/src/app/console/check-in/page.tsx frontend/src/lib/console-check-in.ts frontend/src/lib/console-check-in.test.ts frontend/src/lib/check-in-production-entry.test.ts task_plan.md progress.md findings.md` 退出码 0，仅保留 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 12 第三轮：日结对账单 CSV 导出

- 目标：继续推进阶段 12“报表导出升级”，给日结对账批次详情补可下载 CSV，对账明细和差异记录使用中文业务标签，避免导出行级内部 `id` 或原始后端码值。
- RED：新增 `frontend/src/lib/console-reconciliation.test.ts`，要求 `buildConsoleReconciliationExportCsv()` 导出“记录类型、批次号、业务日期、来源、业务号、业务类型或差异类型、金额、状态、原因、生成时间”，并断言不包含批次/明细/差异行 `id` 以及 `local`、`processing`、`matched`、`amount_mismatch`、`open` 等原始码值；首次运行失败于缺少 helper。
- RED：扩展 `frontend/src/lib/reconciliation-production-entry.test.ts`，要求对账页接入 `buildConsoleReconciliationExportCsv` 和“导出对账单”按钮；首次运行失败，页面只有查看详情入口。
- 修复：新增 `frontend/src/lib/console-reconciliation.ts`，复用 `operation-display.ts` 的对账来源、业务类型、差异类型和状态中文 formatter；`/console/reconciliation` 在已打开的批次详情标题栏增加“导出对账单”按钮，导出当前详情中的明细和差异记录。
- 验证：`node --test --experimental-strip-types frontend/src/lib/console-reconciliation.test.ts frontend/src/lib/reconciliation-production-entry.test.ts` 通过 2 tests；`node --test --experimental-strip-types frontend/src/lib/console-reconciliation.test.ts frontend/src/lib/reconciliation-production-entry.test.ts frontend/src/lib/console-check-in.test.ts frontend/src/lib/check-in-production-entry.test.ts frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts frontend/src/lib/console-orders.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/operation-display.test.ts` 通过 15 tests；`npm run typecheck` 通过；`git diff --check -- frontend/src/app/console/reconciliation/page.tsx frontend/src/lib/console-reconciliation.ts frontend/src/lib/console-reconciliation.test.ts frontend/src/lib/reconciliation-production-entry.test.ts task_plan.md progress.md findings.md` 退出码 0，仅保留 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第九轮：控制台首页最近对账状态中文兜底

- 目标：继续补阶段 13“后台中文化与枚举展示治理”，把 `/console` 首页“最近对账批次”的状态展示从页面本地 formatter 收口到共享对账中文 formatter，避免未来新增批次状态时原样显示后端码值。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，要求控制台首页使用 `formatReconciliationBatchStatus()`，且不再保留本地 `formatBatchStatus()` 或 `return status || '-'`；首次运行失败，页面仍有本地 formatter。
- 修复：`frontend/src/app/console/page.tsx` 改为从 `operation-display.ts` 导入 `formatReconciliationBatchStatus()`，删除本地 `formatBatchStatus()`。
- 验证：`node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts` 通过 4 tests；`node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts frontend/src/lib/console-ops.test.ts frontend/src/lib/reconciliation-production-entry.test.ts frontend/src/lib/operation-display.test.ts frontend/src/lib/console-reconciliation.test.ts` 通过 10 tests；`npm run typecheck` 通过；`git diff --check -- frontend/src/app/console/page.tsx frontend/src/lib/console-production-entry.test.ts task_plan.md progress.md findings.md` 退出码 0，仅保留 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第十轮：平台主办方运营页编号语境中文化

- 目标：继续补阶段 13“后台中文化与枚举展示治理”，把 `/console/organizer-ops` 中主办方、负责人、运营员和操作人编号从裸 `ID` / `#` 口吻改为中文业务编号语境。
- RED：新增 `frontend/src/lib/organizer-ops-production-entry.test.ts`，要求页面不再出现“主办方 #”“运营员 #”“负责人ID”“主办方 ID”“ID：”和无标签的“操作人 {id}”，并保留“主办方编号 / 负责人编号 / 运营员编号 / 操作人编号”；首次运行失败，命中旧页面文案。
- RED：扩展 `frontend/src/lib/operation-display.test.ts`，要求无昵称运营员账号显示“运营员编号：{id}”；首次运行失败，旧 formatter 返回“运营员 #{id}”。
- 修复：`/console/organizer-ops` 的主办方 fallback、负责人输入占位和错误提示、运营员 fallback、主办方跟进表格、详情区和最近操作审计都改为“编号”语境；`formatOrganizerOpsAccountLabel()` 的无昵称 fallback 改为“运营员编号：{id}”。
- 验证：`node --test --experimental-strip-types frontend/src/lib/organizer-ops-production-entry.test.ts frontend/src/lib/operation-display.test.ts` 通过 4 tests。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第十一轮：审计日志列表操作人编号语境中文化

- 目标：继续补阶段 13“后台中文化与枚举展示治理”，把 `/console/audit-logs` 日志列表里的操作人列从裸数字展示改为“操作人编号”语境。
- RED：扩展 `frontend/src/lib/audit-log-production-entry.test.ts`，要求页面不再保留表头“操作人”和裸 `{item.operatorId}` 主值；首次运行失败，命中旧表头和旧单元格。
- 修复：日志列表表头改为“操作人编号”，单元格主值改为“操作人编号：{id}”，下一行继续展示角色中文标签。
- 验证：`node --test --experimental-strip-types frontend/src/lib/audit-log-production-entry.test.ts` 通过 1 test。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第十二轮：场次列表活动/场馆编号语境中文化

- 目标：继续补阶段 13“后台中文化与枚举展示治理”，把 `/console/sessions` 场次列表里活动名、场馆名缺失时的 `活动 #id` / `场馆 #id` 兜底改为中文编号语境。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，要求场次页不再出现“活动 #”“场馆 #”和“场馆ID”，并保留“活动编号 / 场馆编号”；首次运行失败，命中旧兜底文案。
- 修复：场次列表活动和场馆 fallback 改为“活动编号：{id}”“场馆编号：{id}”；编辑校验提示改为“场馆编号不正确”。
- 验证：`node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts` 通过 5 tests。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第十三轮：恢复售票/场馆座位图井号编号语境中文化

- 目标：继续补阶段 13“后台中文化与枚举展示治理”，清理控制台剩余 `#${...}` 形式编号兜底。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，要求恢复售票审核页不出现“活动 #”“活动ID”，场馆座位图默认标题不出现“场馆 #”；首次运行失败，命中旧兜底文案。
- 修复：恢复售票审核页活动名缺失时显示“活动编号：{id}”，活动追踪行显示“活动编号：{id}”；场馆默认 SeatCraft 标题改为“场馆编号：{id} SeatCraft 座位图”。
- 验证：`node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts` 通过 6 tests。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第十四轮：评价问答管理页编号语境中文化

- 目标：继续补阶段 13“后台中文化与枚举展示治理”，把 `/console/activity-engagement` 的评价、举报和问答列表里活动、订单、用户、评价等数字从裸露主信息改为中文编号语境。
- RED：新增 `frontend/src/lib/activity-engagement-production-entry.test.ts`，要求页面不再出现“活动 {review.activityId}”“订单 {review.orderId}”“用户 {review.userId}”“评价 {report.reviewId}”“举报用户 {report.userId}”“活动 {question.activityId}”“用户 {question.userId}”等裸字段口吻；首次运行失败，命中旧文案。
- 修复：评价卡片改为“活动编号 / 订单编号 / 用户编号”，举报卡片改为“评价编号 / 活动编号 / 举报用户编号”，问答卡片改为“活动编号 / 用户编号”。
- 验证：`node --test --experimental-strip-types frontend/src/lib/activity-engagement-production-entry.test.ts` 通过 1 test。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第十五轮：控制台详情路由错误编号语境中文化

- 目标：继续补阶段 13“后台中文化与枚举展示治理”，把控制台详情页路由参数校验错误里的 `ID不正确` 统一改为“编号不正确”。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，覆盖活动座位图、活动营销、活动编辑、场馆座位图、场次座位图、站点 SeatCraft、巡演详情、巡演新增站点和巡演站点场馆页；首次运行失败，命中“活动ID不正确”等旧提示。
- 修复：上述页面错误提示改为“活动编号不正确 / 场馆编号不正确 / 场次编号不正确 / 站点编号不正确 / 巡演编号不正确 / 巡演或站点编号不正确”。
- 验证：`node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts` 通过 7 tests。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第十六轮：风控案例/客服会话编号语境中文化

- 目标：继续补阶段 13“后台中文化与枚举展示治理”，把风控案例和客服会话头部的活动、主办方、用户编号从裸 `ID` 口吻改为中文编号语境。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，要求 `risk-cases` 和 `support-conversations` 不再出现“活动 ID”“用户 ID”“主办 {id}”，并保留“活动编号 / 主办方编号 / 用户编号”；首次运行失败，命中旧文案。
- 修复：风控案例列表改为“活动编号：{id} · 主办方编号：{id}”；客服会话头部改为“用户编号：{id}”。
- 验证：`node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts` 通过 8 tests。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 14 第一轮：链路耗时样本结构化归档

- 目标：继续推进阶段 14“链路耗时治理”，让 Gateway/direct/local-model 耗时测量结果能被长期归档和后续趋势分析复用，而不是只停留在交互式表格输出。
- RED：扩展 `scripts/test-measure-gateway-latency.ps1`，要求测量结果包含 `scenario` 字段，并覆盖默认对象输出、CSV 6 行归档和包含 Ollama 的 JSON 8 行归档；首次运行失败，命中缺少 `scenario` 字段。
- 修复：`scripts/measure-gateway-latency.ps1` 新增 `scenario=gateway-vs-direct/local-model`，并支持 `-OutputFormat Object|Csv|Json` 与 `-OutputPath`；默认仍输出对象，避免影响现有人工查看方式。
- 文档：更新 `docs/production-readiness/gateway-observability-latency-implementation-plan.md`，补充输出字段和 CSV/JSON 归档用法。
- 验证：`powershell -ExecutionPolicy Bypass -File scripts\test-measure-gateway-latency.ps1` 通过；`powershell -ExecutionPolicy Bypass -File scripts\check-production-runtime-defaults.ps1` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 14 第二轮：小队抢票处理器分段耗时日志

- 目标：继续推进阶段 14“链路耗时治理”，把小队抢票成功路径里的锁座、票价读取、建单、确认落库和通知成员耗时拆开记录。
- RED：扩展 `nestjs/grab-service/src/team-grab/team-grab-processor.service.spec.ts`，要求成功处理小队抢票后输出“小队抢票链路耗时”，并包含 `lockMs`、`priceMs`、`orderMs`、`confirmMs`、`notificationMs` 和 `totalMs`；首次运行失败，命中缺少该日志。
- 修复：`TeamGrabProcessorService` 新增内部 `TeamGrabLatencyTrace`，包住 ticket 锁座、票价查询、order 建单、确认落库和通知成员；处理结果通过 `outcome` 标记 `ORDER_CREATED`、`PENDING_RECOVERY`、`FAILED` 或 retry/release pending 类状态。
- 文档：更新 `docs/production-readiness/gateway-observability-latency-implementation-plan.md`，补充“小队抢票链路耗时”字段和诊断用途。
- 验证：`npm test -- team-grab-processor.service.spec.ts` 通过 26 tests；`npm test -- grab-worker.service.spec.ts team-grab-processor.service.spec.ts` 通过 50 tests。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 14 第三轮：支付确认到履约分段耗时日志

- 目标：继续推进阶段 14“链路耗时治理”，把支付宝同步/回调进入本地确认后的订单确认/出票履约调用和 payment 本地流水更新耗时拆开记录。
- RED：扩展 `java/java-payment/src/test/java/com/omni/payment/service/PaymentSeataConfirmationTest.java`，要求 `confirmPayment()` 成功后输出“支付确认链路耗时”，并包含 `paymentId`、`orderId`、`outcome=CONFIRMED`、`orderMarkPaidMs`、`paymentUpdateMs` 和 `totalMs`；首次运行失败，命中缺少日志。
- 修复：`PaymentConfirmationService` 新增内部 `PaymentConfirmationLatencyTrace`，在不改变 `@GlobalTransactional`、调用顺序和异常行为的前提下，分别计量 `orderClient.markPaid()` 和 `paymentMapper.updateById()`。
- 验证：`mvn -pl java-payment -Dtest=PaymentSeataConfirmationTest test` 通过 5 tests；`mvn -pl java-payment "-Dtest=PaymentSeataConfirmationTest,PaymentAlipayIntegrationTest,MockPaymentServiceTest" test` 通过 25 tests。
- 备注：第一次运行多测试类命令时，PowerShell 将未加引号的 `-Dtest=PaymentSeataConfirmationTest,PaymentAlipayIntegrationTest,MockPaymentServiceTest` 逗号解析为参数列表导致 `Missing argument in parameter list`；已改用带引号的 Surefire 参数。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 14 第四轮：支付同步外层分段耗时日志

- 目标：继续推进阶段 14“链路耗时治理”，把 `/api/payment/alipay/sync/{orderId}` 外层同步路径里的订单读取、支付流水读取、支付宝查询、本地确认和订单回查耗时拆开记录。
- RED：扩展 `java/java-payment/src/test/java/com/omni/payment/service/PaymentAlipayIntegrationTest.java`，要求 `syncByOrderId()` 成功确认支付后输出“支付同步链路耗时”，并包含 `orderId`、`orderNo`、`outcome=CONFIRMED`、`orderLoadMs`、`paymentLoadMs`、`alipayQueryMs`、`confirmPaymentMs`、`orderReloadMs` 和 `totalMs`；首次运行 `mvn -pl java-payment "-Dtest=PaymentAlipayIntegrationTest" test` 失败，命中缺少该日志。单独尝试 nested test 方法筛选时 Surefire 未命中，显示 `Tests run: 0`，不作为 RED 证据。
- 修复：`AlipayService` 新增内部 `PaymentSyncLatencyTrace`，在不改变同步返回、支付宝查询 mock 方式和确认事务边界的前提下，分别计量 `getOrderOrThrow()`、`getLatestPaymentByOutTradeNo()`、`AlipayClient.execute()`、`PaymentConfirmationService.confirmPayment()` 和确认后订单回查。
- 文档：更新 `docs/production-readiness/gateway-observability-latency-implementation-plan.md`，补充“支付同步链路耗时”字段、诊断用途和“不替代真实支付宝沙箱验收”的边界。
- 验证：`mvn -pl java-payment "-Dtest=PaymentAlipayIntegrationTest" test` 通过 19 tests。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 14 第五轮：订单支付履约分段耗时日志

- 目标：继续推进阶段 14“链路耗时治理”，把 payment 调用 `java-order` internal `markPaid` 后的订单读取、状态更新、票务确认、电子票出票和候补通知耗时拆开记录。
- RED：扩展 `java/java-order/src/test/java/com/omni/order/service/OrderServiceTest.java`，要求 `markPaid()` 成功路径输出“订单支付履约链路耗时”，并包含 `orderId`、`orderNo`、`outcome=PAID`、`orderLoadMs`、`statusUpdateMs`、`ticketConfirmMs`、`ticketIssueMs`、`waitlistNotifyMs` 和 `totalMs`；首次有效运行 `mvn -pl java-order "-Dtest=OrderServiceTest#markPaidLogsSegmentedLatencyForOrderFulfillment" test` 失败，命中缺少该日志。
- 排障：首次运行 `mvn -pl java-order "-Dtest=OrderServiceTest" test` 先失败于 Mockito 无法 mock `UserInternalClient`，根因是 `java-order/target/classes/com/omni/order/client/UserInternalClient.class` 为旧坏 class，`javap` 显示包含 `Unresolved compilation problems` 且泛型签名误写为 `LInternalAuthContextResponse;`；执行 `mvn -pl java-order clean compile -DskipTests` 后恢复。
- 修复：`OrderService.markPaid()` 新增内部 `OrderFulfillmentLatencyTrace`，在不改变 `@Transactional`、状态机、返回值和异常语义的前提下，分别计量 `orderMapper.selectById()`、`orderMapper.updateStatusIfCurrent()`、`confirmTicketsSold(order)`、`issueElectronicTickets(order)` 和 `notifyWaitlistPaid(order.getId())`。
- 文档：更新 `docs/production-readiness/gateway-observability-latency-implementation-plan.md`，补充“订单支付履约链路耗时”字段和与 payment 侧 `orderMarkPaidMs` 下钻联动的诊断用途。
- 验证：`mvn -pl java-order "-Dtest=OrderServiceTest#markPaidLogsSegmentedLatencyForOrderFulfillment" test` 通过 1 test；`mvn -pl java-order "-Dtest=OrderServiceTest,OrderSeatServiceTest" test` 通过 102 tests；`mvn -pl java-payment "-Dtest=PaymentSeataConfirmationTest,PaymentAlipayIntegrationTest,MockPaymentServiceTest" test` 通过 26 tests；`npm test -- grab-worker.service.spec.ts team-grab-processor.service.spec.ts` 通过 50 tests；`powershell -ExecutionPolicy Bypass -File scripts\test-measure-gateway-latency.ps1` 通过；`powershell -ExecutionPolicy Bypass -File scripts\check-production-runtime-defaults.ps1` 通过。订单测试日志中有现有熔断用例故意触发的 `用户服务调用失败: userId=2004`，但 Surefire 结果为 `Failures: 0, Errors: 0`。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 14 第六轮：电子票出票分段耗时日志

- 目标：继续推进阶段 14“链路耗时治理”，把 `TicketWalletService.issueForPaidOrder()` 内部的已出票幂等检查、观演人读取、座位读取和电子票写入耗时拆开记录，让 `OrderService.markPaid()` 的 `ticketIssueMs` 可以继续下钻。
- RED：扩展 `java/java-order/src/test/java/com/omni/order/service/TicketWalletServiceTest.java`，要求成功出票后输出“电子票出票链路耗时”，并包含 `orderId`、`orderNo`、`outcome=ISSUED`、`existingCheckMs`、`attendeeLoadMs`、`seatLoadMs`、`ticketInsertMs`、`ticketCount=1` 和 `totalMs`；首次运行 `mvn -pl java-order "-Dtest=TicketWalletServiceTest#issueForPaidOrderLogsSegmentedLatencyForTicketIssuing" test` 失败，命中缺少该日志。
- 修复：`TicketWalletService.issueForPaidOrder()` 新增内部 `TicketIssueLatencyTrace`，在不改变 `@Transactional`、幂等 return、出票数量、插入逻辑和异常传播的前提下，分别计量 `countByOrderId()`、`selectByOrderIds()`、`selectLockedAndSoldSeatsByOrderId()` 和 `insertIgnoreTicketNo()`；`outcome` 区分 `SKIPPED`、`ALREADY_ISSUED`、`ISSUED` 和异常默认 `FAILED`。
- 文档：更新 `docs/production-readiness/gateway-observability-latency-implementation-plan.md`，补充“电子票出票链路耗时”字段和与订单侧 `ticketIssueMs` 的下钻关系。
- 验证：`mvn -pl java-order "-Dtest=TicketWalletServiceTest#issueForPaidOrderLogsSegmentedLatencyForTicketIssuing" test` 通过 1 test；`mvn -pl java-order "-Dtest=TicketWalletServiceTest,OrderServiceTest,OrderSeatServiceTest" test` 通过 114 tests。订单测试日志中仍有现有熔断用例故意触发的 `用户服务调用失败: userId=2004`，但 Surefire 结果为 `Failures: 0, Errors: 0`。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 14 第七轮：AI 客服首字响应与模型回落耗时日志

- 目标：继续推进阶段 14“链路耗时治理”，把 AI 客服流式回复的来源、首字响应、模型回落原因和总耗时在 `SupportAiService` 层统一留证，避免只从 Gateway 或 Ollama 探针推断慢点。
- RED：扩展 `java/java-user/src/test/java/com/omni/user/service/SupportAiServiceTest.java`，要求 FAQ 未命中且本地模型空返回时输出“AI客服回复链路耗时”，并包含 `source=default`、`modelAttempted=true`、`fallbackReason=本地模型未返回可用回答`、`firstChunkMs` 和 `totalMs`；首次有效运行 `mvn -pl java-user -am "-Dtest=SupportAiServiceTest#streamingDiagnosticsLogsLatencyAndFallbackReason" "-Dsurefire.failIfNoSpecifiedTests=false" test` 失败，命中缺少该日志。
- 排障：首次运行 `mvn -pl java-user "-Dtest=SupportAiServiceTest#streamingDiagnosticsLogsLatencyAndFallbackReason" test` 先失败于 `java-user/target/classes` 中旧坏 class，`javap` 显示 `RbacService`、`OperationAuditService`、`NotificationMqProducer` 的签名里出现无包名 `InternalAuthContextResponse`、`OperationAuditWriteRequest`、`RabbitTemplate` 等；执行 `mvn -pl java-user -am clean compile -DskipTests` 后恢复。`-am` 下上游 `java-common` 无同名测试，需要附加 `-Dsurefire.failIfNoSpecifiedTests=false`。
- 修复：`SupportAiService.answerStreamingWithDiagnostics()` 复用已有 `AnswerDiagnostics`，在 FAQ、local-model 和 default fallback 三条返回路径前统一输出“AI客服回复链路耗时”；不改变 FAQ 优先、本地模型调用、默认兜底、首字记录或返回值语义。
- 文档：更新 `docs/production-readiness/gateway-observability-latency-implementation-plan.md`，补充“AI客服回复链路耗时”字段和与客服会话层 `conversationId` 日志、本地 Ollama 探针的诊断关系。
- 验证：`mvn -pl java-user -am "-Dtest=SupportAiServiceTest#streamingDiagnosticsLogsLatencyAndFallbackReason" "-Dsurefire.failIfNoSpecifiedTests=false" test` 通过 1 test；`mvn -pl java-user -am "-Dtest=SupportAiServiceTest,CustomerSupportServiceTest" "-Dsurefire.failIfNoSpecifiedTests=false" test` 通过 47 tests。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 12 第四轮：退款审核页 Excel 明细导出

- 目标：继续推进阶段 12“报表导出升级”，在退款审核页既有 CSV 明细导出基础上补 Excel 可打开的明细文件，并继续沿用脱敏字段集。
- RED：扩展 `frontend/src/lib/console-refunds.test.ts`，要求 `buildConsoleRefundExportExcelHtml()` 输出 HTML table、转义 `<` / `&`、使用中文退款状态，且不包含 `userId`、`paymentId`、`reviewerId`、`alipayRefundNo`、内部 `orderId`；扩展 `frontend/src/lib/refunds-production-entry.test.ts`，要求页面包含 `buildConsoleRefundExportExcelHtml` 和“导出 Excel”。首次运行失败，命中 helper 未导出和页面入口缺失。
- 修复：`frontend/src/lib/console-refunds.ts` 新增 `buildConsoleRefundExportExcelHtml(refunds)`，用带 UTF-8 BOM 的 HTML 表格生成 `.xls` 内容，字段复用 CSV 的退款号、订单号、活动、金额、状态、原因、申请时间、审核时间、到账时间；`frontend/src/app/console/refunds/page.tsx` 新增“导出 Excel”按钮，继续使用浏览器 `Blob` 下载，不引入新依赖。
- 验证：`node --test --experimental-strip-types frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts` 通过 3 tests；`node --test --experimental-strip-types frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts` 通过 11 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；`git diff --check -- frontend/src/lib/console-refunds.ts frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts frontend/src/app/console/refunds/page.tsx` 退出码 0，仅保留现有 LF/CRLF warning。
- 排障：`pnpm typecheck` 未能运行，原因是本机全局 `pnpm` 启动器指向缺失的 `C:\Program Files\nodejs\node_modules\pnpm\bin\pnpm.mjs`；本轮未安装依赖，改用项目本地 `node_modules/.bin/tsc` 完成等价类型检查。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 12 第五轮：入场核验记录 Excel 明细导出

- 目标：继续推进阶段 12“报表导出升级”，在入场核验记录既有 CSV 导出基础上补 Excel 可打开的明细文件，并继续沿用业务排查所需的最小字段集。
- RED：扩展 `frontend/src/lib/console-check-in.test.ts`，要求 `buildConsoleCheckInExportExcelHtml()` 输出 HTML table、转义 `<` / `&`、使用中文核验结果，且不包含 `ticketId`、`orderId`、`userId`、`sessionId`、`ticketTypeId`、`operatorUserId`；扩展 `frontend/src/lib/check-in-production-entry.test.ts`，要求页面包含 `buildConsoleCheckInExportExcelHtml` 和“导出 Excel”。首次运行失败，命中 helper 未导出和页面入口缺失。
- 修复：`frontend/src/lib/console-check-in.ts` 新增 `buildConsoleCheckInExportExcelHtml(records)`，用带 UTF-8 BOM 的 HTML 表格生成 `.xls` 内容，字段复用 CSV 的请求号、票号、设备、渠道、结果、失败原因、核验时间；`frontend/src/app/console/check-in/page.tsx` 新增“导出 Excel”按钮，并抽出共用下载函数，不引入新依赖。
- 验证：`node --test --experimental-strip-types frontend/src/lib/console-check-in.test.ts frontend/src/lib/check-in-production-entry.test.ts` 通过 3 tests；`node --test --experimental-strip-types frontend/src/lib/console-check-in.test.ts frontend/src/lib/check-in-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts` 通过 14 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；`git diff --check -- frontend/src/lib/console-check-in.ts frontend/src/lib/console-check-in.test.ts frontend/src/lib/check-in-production-entry.test.ts frontend/src/app/console/check-in/page.tsx` 退出码 0，仅保留现有 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 12 第六轮：日结对账单 Excel 明细导出

- 目标：继续推进阶段 12“报表导出升级”，在日结对账单既有 CSV 导出基础上补 Excel 可打开的明细文件，并复用现有中文展示层，避免下载报表暴露后端码值。
- RED：扩展 `frontend/src/lib/console-reconciliation.test.ts`，要求 `buildConsoleReconciliationExportExcelHtml()` 输出 HTML table、转义 `<` / `&`、使用中文来源/业务类型/差异类型/状态，且不包含行级 `id`、`local`、`processing`、`matched`、`amount_mismatch`、`open`；扩展 `frontend/src/lib/reconciliation-production-entry.test.ts`，要求页面包含 `buildConsoleReconciliationExportExcelHtml` 和“导出 Excel”。首次运行失败，命中 helper 未导出和页面入口缺失。
- 修复：`frontend/src/lib/console-reconciliation.ts` 新增 `buildConsoleReconciliationExportExcelHtml(detail)`，并抽出共享导出表头和行构建逻辑，确保 CSV 与 Excel 字段一致；`frontend/src/app/console/reconciliation/page.tsx` 新增“导出 Excel”按钮，和 CSV 共用浏览器 `Blob` 下载逻辑，不引入新依赖。
- 排障：第一次类型检查失败于 JSX 三元表达式中两个导出按钮缺少共同父节点；已用 fragment 包裹两个按钮，不改变交互。
- 验证：`node --test --experimental-strip-types frontend/src/lib/console-reconciliation.test.ts frontend/src/lib/reconciliation-production-entry.test.ts` 通过 3 tests；`node --test --experimental-strip-types frontend/src/lib/console-reconciliation.test.ts frontend/src/lib/reconciliation-production-entry.test.ts frontend/src/lib/console-check-in.test.ts frontend/src/lib/check-in-production-entry.test.ts frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts` 通过 17 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；`git diff --check -- frontend/src/lib/console-reconciliation.ts frontend/src/lib/console-reconciliation.test.ts frontend/src/lib/reconciliation-production-entry.test.ts frontend/src/app/console/reconciliation/page.tsx frontend/src/lib/console-check-in.ts frontend/src/lib/console-check-in.test.ts frontend/src/lib/check-in-production-entry.test.ts frontend/src/app/console/check-in/page.tsx frontend/src/lib/console-refunds.ts frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts frontend/src/app/console/refunds/page.tsx` 退出码 0，仅保留现有 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 12 第七轮：场次维度报表导出

- 目标：继续推进阶段 12“报表导出升级 / 场次维度报表”，让 `/console/sessions` 可以把当前列表中的活动、场馆、时间、状态和库存统计导出为 CSV / Excel。
- RED：新增 `frontend/src/lib/console-sessions.test.ts`，要求 `buildConsoleSessionReportCsv()` 和 `buildConsoleSessionReportExcelHtml()` 输出中文业务字段、转义 HTML 特殊字符，且不包含场次行级 `id`、`activityId`、`venueId` 等内部字段名；新增 `frontend/src/lib/sessions-production-entry.test.ts`，要求页面包含两个 helper 和“导出场次报表 / 导出 Excel”入口。首次运行失败，命中 helper 文件不存在和页面入口缺失。
- 修复：新增 `frontend/src/lib/console-sessions.ts`，字段限定为活动、场馆、城市、开始时间、结束时间、状态、票档数、总库存、已售和余票；`frontend/src/app/console/sessions/page.tsx` 新增当前页 CSV / Excel 导出按钮、中文空态提示和导出成功提示，不新增依赖、不改后端接口。
- 排障：第一次 `tsc --noEmit` 失败于测试夹具将 `SessionAdminVO.endTime` 写成 `null`，而当前类型定义为 `string`；已改为空字符串保留“未设置”语义。
- 验证：`node --test --experimental-strip-types frontend/src/lib/console-sessions.test.ts frontend/src/lib/sessions-production-entry.test.ts` 通过 3 tests；`node --test --experimental-strip-types frontend/src/lib/console-sessions.test.ts frontend/src/lib/sessions-production-entry.test.ts frontend/src/lib/console-reconciliation.test.ts frontend/src/lib/reconciliation-production-entry.test.ts frontend/src/lib/console-check-in.test.ts frontend/src/lib/check-in-production-entry.test.ts frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts` 通过 20 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；`git diff --check -- frontend/src/lib/console-sessions.ts frontend/src/lib/console-sessions.test.ts frontend/src/lib/sessions-production-entry.test.ts frontend/src/app/console/sessions/page.tsx` 退出码 0，仅保留现有 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第十七轮：前端 API 参数校验错误文案编号化

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，把前端 API 参数校验失败时的 `ID` 口吻统一改成“编号”，让用户可见错误不再直接暴露英文/缩写式字段名。
- RED：在 `frontend/src/lib/api.test.ts` 新增行为测试，要求 `getActivityMarketing(0)`、`getCheckInOverview(0)`、`listCheckInRecords({ sessionId: 0 })`、`getSessionSeatLayout(0, 1)`、`getSessionSeatLayout(1, 0)` 和 `getSeatCraftDraft('session', 0)` 分别抛出“活动编号不正确 / 场次编号不正确 / 用户编号不正确 / SeatCraft 归属编号不正确”；首次运行失败，命中旧文案 `活动ID不正确`、`场次ID不正确`、`用户ID不正确`。
- 修复：`frontend/src/lib/api.ts` 里的 `formatParameterLabel()` 在保留原始参数映射的前提下统一把中文标签中的 `ID` 归一为“编号”；不改 API 路径、不改参数名、不改请求体。
- 验证：`node --test --experimental-strip-types --test-name-pattern "parameter validation errors use Chinese identifier wording" frontend/src/lib/api.test.ts` 通过 1 test；`node --test --experimental-strip-types frontend/src/lib/api.test.ts` 通过 33 tests；`node --test --experimental-strip-types frontend/src/lib/console-sessions.test.ts frontend/src/lib/sessions-production-entry.test.ts frontend/src/lib/console-reconciliation.test.ts frontend/src/lib/reconciliation-production-entry.test.ts frontend/src/lib/console-check-in.test.ts frontend/src/lib/check-in-production-entry.test.ts frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts` 通过 20 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；`git diff --check -- frontend/src/lib/api.ts frontend/src/lib/api.test.ts frontend/src/lib/console-sessions.ts frontend/src/lib/console-sessions.test.ts frontend/src/lib/sessions-production-entry.test.ts frontend/src/app/console/sessions/page.tsx task_plan.md progress.md findings.md` 退出码 0，仅保留现有 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第十八轮：艺人编辑/场馆列表编号语境中文化

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，收口控制台剩余裸 `ID` 文案，把艺人编辑路由错误和场馆列表表头纳入“编号”口径。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，把 `frontend/src/app/console/artists/[id]/edit/page.tsx` 纳入路由错误测试，并新增场馆列表表头测试；首次运行分别命中旧文案“艺人 ID 不正确”和 `<th> ID </th>`。
- 修复：`frontend/src/app/console/artists/[id]/edit/page.tsx` 错误提示改为“艺人编号不正确”；`frontend/src/app/console/venue/page.tsx` 表头改为“场馆编号”，表格单元格继续显示 `v.id` 作为追踪编号。
- 验证：`node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts --test-name-pattern "console venue list labels venue identifier with Chinese context"` 先失败后通过；`node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts` 通过 9 tests；`node --test --experimental-strip-types frontend/src/lib/api.test.ts` 通过 33 tests；`node --test --experimental-strip-types frontend/src/lib/console-sessions.test.ts frontend/src/lib/sessions-production-entry.test.ts frontend/src/lib/console-reconciliation.test.ts frontend/src/lib/reconciliation-production-entry.test.ts frontend/src/lib/console-check-in.test.ts frontend/src/lib/check-in-production-entry.test.ts frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts` 通过 21 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；`git diff --check -- frontend/src/app/console/venue/page.tsx 'frontend/src/app/console/artists/[id]/edit/page.tsx' frontend/src/lib/console-production-entry.test.ts` 退出码 0，仅保留现有 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 11 第十一轮：活动详情加入小队编号文案中文化

- 目标：继续推进阶段 11“C 端可解释体验补强 / 小队抢票去 ID 化”，把活动详情页加入已有小队时的“小队 ID”提示改成普通用户更容易理解的“小队编号”。
- RED：扩展 `frontend/src/lib/activity-detail-production-entry.test.ts`，要求 `frontend/src/app/activity/[id]/page.tsx` 不再出现“小队 ID”，并保留“小队编号”；首次运行失败，命中加入小队弹窗和校验提示旧文案。
- 修复：`frontend/src/app/activity/[id]/page.tsx` 的加入已有小队弹窗提示、输入占位和非法输入提示统一改为“小队编号”；不改 `teamId`、邀请码、登录跳转或 `joinTeamGrab()` 调用。
- 验证：`node --test --experimental-strip-types frontend/src/lib/activity-detail-production-entry.test.ts --test-name-pattern "activity detail uses Chinese team number wording for join prompt"` 先失败后通过；`node --test --experimental-strip-types frontend/src/lib/activity-detail-production-entry.test.ts frontend/src/lib/team-room-production-entry.test.ts` 通过 6 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；`rg -n "小队 ID" frontend/src/app frontend/src/components -g "*.tsx"` 无匹配。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第十九轮：客服工作台编号语境中文化

- 目标：继续推进阶段 13“后台中文化与枚举展示治理 / 客服主管能力”，把客服工作台会话头部和用户上下文中的编号从裸 `ID` 或请求号口吻改为中文业务语境。
- RED：新增 `frontend/src/lib/support-workbench-production-entry.test.ts`，要求 `frontend/src/app/support/page.tsx` 不再出现 `ID：{active.userId}` 和 `抢票 {request.requestId}`，并保留“用户编号：{active.userId}”与“抢票请求号：{request.requestId}”；首次运行失败，命中旧文案。
- 修复：`/support` 会话头部改为“用户编号：{active.userId}”；抢票上下文卡片标题改为“抢票请求号：{request.requestId}”。本轮不改 `userId`、`requestId` 字段和上下文加载接口。
- 验证：`node --test --experimental-strip-types frontend/src/lib/support-workbench-production-entry.test.ts` 先失败后通过；`node --test --experimental-strip-types frontend/src/lib/support-workbench-production-entry.test.ts frontend/src/lib/support-tools.test.ts` 通过 22 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；`rg -n "ID：\\{active\\.userId\\}|抢票 \\{request\\.requestId\\}" frontend/src/app/support/page.tsx` 无匹配。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第二十轮：商户入驻页用户编号文案中文化

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，清理全前端页面里剩余的可见 `ID` 口吻，把商户入驻页提交说明统一到“编号”语境。
- RED：新增 `frontend/src/lib/merchant-production-entry.test.ts`，要求 `frontend/src/app/merchant/page.tsx` 不再出现“用户 ID”，并保留“用户编号”；首次运行失败，命中旧说明。
- 修复：`/merchant` 申请表下方说明改为“提交时不需要传入用户编号，系统会自动使用当前登录账号。”，不改提交接口、认证逻辑或用户识别方式。
- 验证：`node --test --experimental-strip-types frontend/src/lib/merchant-production-entry.test.ts` 先失败后通过；`node --test --experimental-strip-types frontend/src/lib/merchant-production-entry.test.ts frontend/src/lib/activity-detail-production-entry.test.ts frontend/src/lib/support-workbench-production-entry.test.ts` 通过 6 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；`rg -n "用户 ID|小队 ID|活动 ID|场馆 ID|场次 ID|订单 ID|ID：|\\sID\\b" frontend/src/app frontend/src/components -g "*.tsx"` 无匹配。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 11 第十二轮：C 端票档缺名兜底去内部编号

- 目标：继续推进阶段 11“C 端可解释体验补强”，清理订单、票夹和抢票进度里票档名缺失时的内部 `ticketTypeId` 兜底，避免普通用户看到“票档 203”这类不可解释编号。
- RED：扩展 `frontend/src/lib/orders-production-entry.test.ts`、`frontend/src/lib/ticket-wallet-production-entry.test.ts`、`frontend/src/lib/activity-detail-production-entry.test.ts` 和 `frontend/src/lib/grab-progress.test.ts`；首次运行失败，命中订单列表/详情、票夹、活动抢票尝试列表和自动降档 helper 的旧兜底。
- 修复：`frontend/src/app/orders/page.tsx`、`frontend/src/app/orders/[id]/page.tsx`、`frontend/src/app/tickets/page.tsx`、`frontend/src/app/activity/[id]/page.tsx` 和 `frontend/src/lib/grab-progress.ts` 在票档名缺失时统一显示“票档信息待同步”；不改 `ticketTypeId` 字段、抢票参数、订单数据或票夹接口。
- 验证：`node --test --experimental-strip-types frontend/src/lib/orders-production-entry.test.ts frontend/src/lib/ticket-wallet-production-entry.test.ts frontend/src/lib/activity-detail-production-entry.test.ts frontend/src/lib/grab-progress.test.ts` 先失败后通过；`node --test --experimental-strip-types frontend/src/lib/orders-production-entry.test.ts frontend/src/lib/orders-experience.test.ts frontend/src/lib/ticket-wallet-production-entry.test.ts frontend/src/lib/ticket-wallet-experience.test.ts frontend/src/lib/activity-detail-production-entry.test.ts frontend/src/lib/grab-progress.test.ts` 通过 27 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；`rg -n "票档 \\$\\{.*ticketTypeId|票档 \\$\\{fallbackTicketTypeId|票档 \\$\\{attempt\\.ticketTypeId|票档 \\$\\{ticket\\.ticketTypeId" frontend/src/app frontend/src/lib/grab-progress.ts -g "*.tsx" -g "*.ts" -g "!frontend/src/app/console/**"` 无匹配。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第二十一轮：控制台订单票档缺名兜底去内部编号

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，清理后台订单列表和 CSV 导出里票档名缺失时的内部 `ticketTypeId` 兜底。
- RED：`frontend/src/lib/console-orders.test.ts` 已要求导出 `getConsoleOrderTicketLabel()` 并让 CSV 使用“票档信息待同步”；`frontend/src/lib/console-orders-production-entry.test.ts` 要求订单页接入该 helper 且不再保留 `票档 ${order.matchedTicketTypeId ?? order.ticketTypeId}`。首次运行失败，命中 helper 未导出和页面本地 `getTicketTypeLabel()`。
- 修复：`frontend/src/lib/console-orders.ts` 新增 `getConsoleOrderTicketLabel()`，`buildConsoleOrderExportCsv()` 改用该 helper；`frontend/src/app/console/orders/page.tsx` 删除本地票档 formatter，列表展示复用共享 helper。
- 验证：`node --test --experimental-strip-types frontend/src/lib/console-orders.test.ts frontend/src/lib/console-orders-production-entry.test.ts` 通过 7 tests；`node --test --experimental-strip-types frontend/src/lib/console-orders.test.ts frontend/src/lib/console-orders-production-entry.test.ts frontend/src/lib/orders-production-entry.test.ts frontend/src/lib/ticket-wallet-production-entry.test.ts frontend/src/lib/activity-detail-production-entry.test.ts frontend/src/lib/grab-progress.test.ts` 通过 26 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；`rg -n "票档 \\$\\{.*ticketTypeId|票档 \\$\\{fallbackTicketTypeId|票档 \\$\\{attempt\\.ticketTypeId|票档 \\$\\{ticket\\.ticketTypeId|票档 \\$\\{order\\.matchedTicketTypeId" frontend/src/app frontend/src/lib -g "*.tsx" -g "*.ts"` 无匹配；`git diff --check -- frontend/src/lib/console-orders.ts frontend/src/app/console/orders/page.tsx frontend/src/lib/console-orders.test.ts frontend/src/lib/console-orders-production-entry.test.ts task_plan.md progress.md findings.md` 退出码 0，仅保留现有 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 11 第十三轮：活动详情评价作者去用户编号化

- 目标：继续推进阶段 11“C 端可解释体验补强”，避免活动详情观演评价在缺少昵称时把 `userId` 当作评论者身份展示给普通用户。
- RED：扩展 `frontend/src/lib/activity-detail-production-entry.test.ts`，要求活动详情页不再出现 `用户 {item.userId}`，并保留“匿名用户”；首次运行失败，命中旧评价卡片作者文案。
- 修复：`frontend/src/app/activity/[id]/page.tsx` 的评价作者展示改为“匿名用户”；保留 `item.userId` 作为 React key 组成部分和举报接口链路，不改变评价列表、问答或举报 API。
- 验证：`node --test --experimental-strip-types frontend/src/lib/activity-detail-production-entry.test.ts` 先失败后通过；`node --test --experimental-strip-types frontend/src/lib/activity-detail-production-entry.test.ts frontend/src/lib/orders-production-entry.test.ts frontend/src/lib/ticket-wallet-production-entry.test.ts frontend/src/lib/grab-progress.test.ts` 通过 20 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；`rg -n "用户 \\{item\\.userId\\}|用户 \\$\\{.*userId\\}|用户 \\{.*userId\\}" frontend/src/app/activity/[id]/page.tsx frontend/src/app frontend/src/components -g "*.tsx"` 仅剩客服工作台会话 fallback，C 端活动详情已无命中；`git diff --check -- frontend/src/app/activity/[id]/page.tsx frontend/src/lib/activity-detail-production-entry.test.ts task_plan.md progress.md findings.md` 退出码 0，仅保留现有 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 11 第十四轮：浏览记录标题兜底去活动编号化

- 目标：继续推进阶段 11“搜索与推荐体验 / 近期浏览召回”，避免浏览记录标题缺失时把 `activityId` 当作演出标题展示。
- RED：新增 `frontend/src/lib/history-production-entry.test.ts`，要求 `/history` 不再出现 `演出 ${item.activityId}`，并保留“演出信息待同步”；首次运行失败，命中旧标题兜底。
- 修复：`frontend/src/app/history/page.tsx` 在浏览记录标题缺失时显示“演出信息待同步”；保留 `activityId` 用于跳转 `/activity/{id}` 和列表 key，不改变浏览历史接口或本地信号结构。
- 验证：`node --test --experimental-strip-types frontend/src/lib/history-production-entry.test.ts` 先失败后通过；`node --test --experimental-strip-types frontend/src/lib/history-production-entry.test.ts frontend/src/lib/search-production-entry.test.ts frontend/src/lib/personalized-recommendations.test.ts frontend/src/lib/subscriptions-production-entry.test.ts` 通过 9 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；`rg -n "演出 \\$\\{item\\.activityId\\}|演出 \\$\\{.*activityId\\}" frontend/src/app frontend/src/components frontend/src/lib -g "*.tsx" -g "*.ts"` 无匹配；`git diff --check -- frontend/src/app/history/page.tsx frontend/src/lib/history-production-entry.test.ts task_plan.md progress.md findings.md` 退出码 0，仅保留现有 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第二十二轮：客服会话用户 fallback 编号语境中文化

- 目标：继续推进阶段 13“后台中文化与枚举展示治理 / 客服主管能力”，避免客服会话在昵称和手机号都缺失时把 `userId` 作为裸用户名称展示。
- RED：扩展 `frontend/src/lib/support-workbench-production-entry.test.ts` 和 `frontend/src/lib/console-production-entry.test.ts`，要求 `/support` 与 `/console/support-conversations` 不再出现 `用户 ${conversation.userId}`，并保留“用户编号：${conversation.userId}”；首次运行失败，命中两处旧 fallback。
- 修复：`frontend/src/app/support/page.tsx` 的 `getConversationUserDisplay()` 和 `frontend/src/app/console/support-conversations/page.tsx` 的 `getUserDisplay()` 统一改为 `用户编号：${conversation.userId}`；不改会话查询、筛选、上下文加载或权限逻辑。
- 验证：`node --test --experimental-strip-types frontend/src/lib/support-workbench-production-entry.test.ts` 和 `node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts --test-name-pattern "console risk and support headers label user and organizer identifiers"` 先失败；修复后 `node --test --experimental-strip-types frontend/src/lib/support-workbench-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/support-tools.test.ts` 通过 31 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；`rg -n "用户 \\$\\{.*userId\\}|用户 \\{.*userId\\}" frontend/src/app frontend/src/components -g "*.tsx"` 无匹配；`git diff --check -- frontend/src/app/support/page.tsx frontend/src/app/console/support-conversations/page.tsx frontend/src/lib/support-workbench-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts task_plan.md progress.md findings.md` 退出码 0，仅保留现有 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第二十三轮：客服用户上下文卡片兜底中文化

- 目标：继续推进阶段 13“客服主管能力 / 后台中文化与枚举展示治理”，清理 `/support` 用户上下文卡片中的裸内部编号和原始状态码兜底。
- RED：扩展 `frontend/src/lib/support-workbench-production-entry.test.ts`，要求订单、退款、票券、候补、通知不再用 `订单 ${order.id}`、`退款 ${refund.id}`、`票券 ${ticket.ticketId}`、`候补 {item.id}`、`通知 ${item.id}` 这类裸文案，并要求抢票/候补不再用 `request.status`、`item.status` 作为兜底；首次运行失败，命中旧上下文卡片。
- 修复：`frontend/src/app/support/page.tsx` 的用户上下文卡片改为“订单编号 / 退款编号 / 票券编号 / 候补编号 / 通知编号”兜底；通知缺标题时不再回退 `item.type`；抢票缺进度文案时显示“状态待同步”，候补缺等待文案时显示“等待释放票”。
- 验证：`node --test --experimental-strip-types frontend/src/lib/support-workbench-production-entry.test.ts` 先失败后通过；`node --test --experimental-strip-types frontend/src/lib/support-workbench-production-entry.test.ts frontend/src/lib/support-tools.test.ts` 通过 22 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；`rg -n "订单 \\$\\{order\\.id\\}|退款 \\$\\{refund\\.id\\}|票券 \\$\\{ticket\\.ticketId\\}|候补 \\{item\\.id\\}|通知 \\$\\{item\\.id\\}|request\\.progressMessage \\|\\| request\\.status|item\\.estimatedWaitText \\|\\| item\\.status|item\\.title \\|\\| item\\.type" frontend/src/app/support/page.tsx frontend/src/lib/support-workbench-production-entry.test.ts` 无匹配；`git diff --check -- frontend/src/app/support/page.tsx frontend/src/lib/support-workbench-production-entry.test.ts task_plan.md progress.md findings.md` 退出码 0，仅保留现有 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第二十四轮：巡演与评价问答未知状态中文兜底

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，清理巡演详情和评价问答管理页未知状态码原样回显问题，避免后台用户看到未映射后端枚举。
- RED：扩展 `frontend/src/lib/activity-engagement-production-entry.test.ts` 和 `frontend/src/lib/console-production-entry.test.ts`，要求 `questionStatusLabel()`、`reportStatusLabel()`、`formatPublishStatus()`、`formatConfigStatus()` 对未知码值返回固定中文兜底；首次运行失败，命中 `return status` 和 `statusText[status] || status`。
- 修复：`frontend/src/app/console/activity-engagement/page.tsx` 的未知问答状态返回“未知问答状态”、未知举报状态返回“未知举报状态”；`frontend/src/app/console/tours/[id]/page.tsx` 的未知发布状态返回“未知发布状态”、未知配置状态返回“未知配置状态”。
- 验证：`node --test --experimental-strip-types frontend/src/lib/activity-engagement-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts` 先失败后通过，最终 12 tests 全部通过；`& .\node_modules\.bin\tsc --noEmit` 通过；`rg -n "return status\\b|statusText\\[status\\] \\|\\| status\\b|status \\? statusText\\[status\\] \\|\\| status\\b" frontend/src/app/console/activity-engagement/page.tsx frontend/src/app/console/tours/[id]/page.tsx` 只命中新中文兜底表达式，未命中原样码值回显。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第二十五轮：恢复售票审核未知状态中文兜底

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，清理恢复售票审核记录中未知 `status` 原样回显的问题。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，要求 `frontend/src/app/console/risk-resolutions/page.tsx` 不再保留 `STATUS_LABEL[item.status] || item.status`，并出现“未知审核状态”；首次运行失败，命中旧状态徽标。
- 修复：`frontend/src/app/console/risk-resolutions/page.tsx` 新增 `formatResolutionStatus()`，列表状态徽标统一通过该 formatter 返回已知中文状态或“未知审核状态”。
- 验证：`node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts --test-name-pattern "console risk resolution status uses Chinese fallback for unknown codes"` 先失败后通过；`node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts` 通过 11 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；`rg -n "STATUS_LABEL\\[item\\.status\\] \\|\\| item\\.status|\\|\\| item\\.status\\b" frontend/src/app/console/risk-resolutions/page.tsx frontend/src/lib/console-production-entry.test.ts` 无匹配。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第二十六轮：风险事件待办未知恢复状态可见兜底

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免 `/console/risk-events` 在有最新恢复申请但状态未映射时把状态徽标隐藏，导致后台用户看不到审核进度。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，要求 `frontend/src/app/console/risk-events/page.tsx` 不再使用 `STATUS_META[latest.status] : null`，并保留“未知审核状态”；首次运行失败，命中旧状态 meta 读取逻辑。
- 修复：`frontend/src/app/console/risk-events/page.tsx` 新增 `getResolutionStatusMeta()`；无最新状态时继续不展示徽标，有未知状态时显示“未知审核状态”并使用中性样式。
- 验证：`node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts --test-name-pattern "console risk events keeps unknown resolution status visible in Chinese"` 先失败后通过；`node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts` 通过 12 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；`rg -n "STATUS_META\\[latest\\.status\\] : null|STATUS_LABEL\\[item\\.status\\] \\|\\| item\\.status|\\|\\| item\\.status\\b" frontend/src/app/console/risk-events/page.tsx frontend/src/app/console/risk-resolutions/page.tsx frontend/src/lib/console-production-entry.test.ts` 无匹配。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第二十七轮：控制台订单降档路径编号语境中文化

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，清理 `/console/orders` 自动降档路径中的裸井号票档编号，避免主办方或平台管理员看到 `#123 -> #456` 这类缺少对象语境的文案。
- RED：扩展 `frontend/src/lib/console-orders-production-entry.test.ts`，要求控制台订单页不再出现 `#{requestedTicketTypeId}` / `#{matchedTicketTypeId}` 形式，并保留“原票档编号”“实际票档编号”；首次运行失败，命中旧降档路径文案。
- 修复：`frontend/src/app/console/orders/page.tsx` 的自动降档路径改为“原票档编号：{requestedTicketTypeId} → 实际票档编号：{matchedTicketTypeId}”；不改 `requestedTicketTypeId`、`matchedTicketTypeId` 字段、筛选、导出或订单接口。
- 验证：`node --test --experimental-strip-types frontend/src/lib/console-orders-production-entry.test.ts frontend/src/lib/console-orders.test.ts` 通过 8 tests；`node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts` 通过 12 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；`rg -n "#\\{requestedTicketTypeId\\}|#\\{matchedTicketTypeId\\}|#\\$\\{.*TicketTypeId|票档 #|#\\{.*ticketType" frontend/src/app/console/orders/page.tsx frontend/src/lib/console-orders-production-entry.test.ts` 无匹配。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第二十八轮：场馆资料审核未知状态中文兜底

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免主办方我的场馆审核资料和平台场馆资料审核页在遇到未知 `status` 时显示空白。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，要求 `frontend/src/app/console/venue/apply/page.tsx` 和 `frontend/src/app/console/venue/applications/page.tsx` 不再直接渲染 `statusText[item.status]`，并保留“未知场馆审核状态”；首次运行失败，命中两处旧状态直取。
- 修复：两个页面分别新增 `formatVenueApplicationStatus()`，已知状态继续显示“待审核 / 已通过 / 已驳回”，未知状态统一显示“未知场馆审核状态”。
- 验证：`node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts --test-name-pattern "console venue application status uses Chinese fallback for unknown codes"` 先失败后通过；`node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts` 通过 13 tests。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第二十九轮：风险案例未知恢复状态可见兜底

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免 `/console/risk-cases` 在最新恢复状态未映射时隐藏状态徽标，导致平台管理员看不到恢复审核进度。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，要求风险案例页不再保留 `const meta = STATUS_META[status]` 直取，并出现“未知审核状态”；首次运行失败，命中旧状态 meta 读取逻辑。
- 修复：`frontend/src/app/console/risk-cases/page.tsx` 新增 `getRiskCaseStatusMeta()`，已知状态继续显示原有中文标签，未知状态显示“未知审核状态”并保持徽标可见。
- 验证：`node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts --test-name-pattern "console risk cases keeps unknown resolution status visible in Chinese"` 先失败后通过；`node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts` 通过 14 tests。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 11 第十五轮：票夹未知状态不误标已失效

- 目标：继续推进阶段 11“C 端可解释体验补强”，避免 `/tickets` 在遇到未知电子票状态时把状态徽标误显示为“已失效”。
- RED：扩展 `frontend/src/lib/ticket-wallet-production-entry.test.ts`，要求票夹页不再使用 `STATUS_META[status] || STATUS_META[3]`，并保留“状态同步中”；首次运行失败，命中旧状态徽标兜底。
- 修复：`frontend/src/app/tickets/page.tsx` 新增 `UNKNOWN_STATUS_META`，未知状态徽标显示“状态同步中”，与 `getTicketWalletStatusCopy()` 的未知状态说明保持一致。
- 验证：`node --test --experimental-strip-types frontend/src/lib/ticket-wallet-production-entry.test.ts` 先失败后通过，最终 3 tests 通过；`node --test --experimental-strip-types frontend/src/lib/ticket-wallet-experience.test.ts` 通过 3 tests。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第三十轮：入场核验未知结果中文兜底

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免 `/console/check-in` 在遇到未知核验结果码时把后端原始码值直接显示给后台用户。
- RED：扩展 `frontend/src/lib/check-in-production-entry.test.ts`，要求页面不再保留 `RESULT_LABELS[record.result] || record.result`，并保留“未知结果”；首次运行失败，命中旧表格结果兜底。
- 修复：`frontend/src/app/console/check-in/page.tsx` 新增 `formatCheckInResult()`，列表结果徽标对未知结果统一显示“未知结果”，样式继续使用原有中性兜底；不改 `record.result` 字段、筛选参数、导出 helper 或接口。
- 验证：`node --test --experimental-strip-types frontend/src/lib/check-in-production-entry.test.ts` 先失败后通过，最终 2 tests 通过；`node --test --experimental-strip-types frontend/src/lib/check-in-production-entry.test.ts frontend/src/lib/console-check-in.test.ts frontend/src/lib/console-production-entry.test.ts` 通过 18 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；残留扫描仅命中新 formatter、测试和导出层中文兜底；`git diff --check -- frontend/src/app/console/check-in/page.tsx frontend/src/lib/check-in-production-entry.test.ts task_plan.md progress.md findings.md` 退出码 0，仅保留 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 11 第十六轮：订单列表未知状态不误标已取消

- 目标：继续推进阶段 11“C 端可解释体验补强”，避免 `/orders` 在遇到未知订单状态时把状态徽标误显示为“已取消”。
- RED：扩展 `frontend/src/lib/orders-production-entry.test.ts`，要求订单页不再使用 `STATUS_MAP[order.status] || STATUS_MAP[3]`，并保留“订单状态更新中”；首次运行失败，命中旧状态徽标兜底。
- 修复：`frontend/src/app/orders/page.tsx` 新增 `UNKNOWN_ORDER_STATUS_META` 和 `getOrderStatusMeta()`，订单列表徽标对未知状态显示“订单状态更新中”，与订单详情 `getOrderDetailStatusCopy()` 的未知状态说明保持一致。
- 验证：`node --test --experimental-strip-types frontend/src/lib/orders-production-entry.test.ts` 先失败后通过，最终 5 tests 通过；`node --test --experimental-strip-types frontend/src/lib/orders-production-entry.test.ts frontend/src/lib/orders-experience.test.ts frontend/src/lib/ticket-wallet-production-entry.test.ts frontend/src/lib/ticket-wallet-experience.test.ts` 通过 16 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；残留扫描仅命中新 helper、测试和订单详情既有未知状态说明；`git diff --check -- frontend/src/app/orders/page.tsx frontend/src/lib/orders-production-entry.test.ts task_plan.md progress.md findings.md` 退出码 0，仅保留 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第三十一轮：通知中心未知类型中文兜底

- 目标：继续推进阶段 13“后台/消息中心中文化与枚举展示治理”，避免通知徽标在遇到未知 `type` 时误显示为“站内消息”。
- RED：扩展 `frontend/src/components/notification-state.test.ts`，要求 `getNotificationTypeMeta()` 对 `FUTURE_EVENT` 返回 key 原值和“未知消息”；首次运行失败，旧实现返回 `IN_APP / 站内消息`。
- 修复：`frontend/src/components/notification-state.ts` 将未知通知类型兜底改为 `{ key, label: '未知消息', color: '#64748b', bg: '#f8fafc' }`，既避免误导用户，又保留原始 key 供 `REFUND_`、`GRAB_` 等前缀动作路由继续判断。
- 验证：`node --test --experimental-strip-types frontend/src/components/notification-state.test.ts` 先失败后通过，最终 16 tests 通过；`node --test --experimental-strip-types frontend/src/components/notification-state.test.ts frontend/src/lib/api.test.ts frontend/src/lib/sms-production-copy.test.ts` 通过 50 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；残留扫描不再命中 `TYPE_META[key] || TYPE_META.IN_APP`；`git diff --check -- frontend/src/components/notification-state.ts frontend/src/components/notification-state.test.ts task_plan.md progress.md findings.md` 退出码 0，仅保留 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第三十二轮：控制台订单未知状态中文兜底

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免 `/console/orders` 页面和 CSV 导出在遇到未知订单状态时显示空横杠。
- RED：扩展 `frontend/src/lib/console-orders.test.ts` 和 `frontend/src/lib/console-orders-production-entry.test.ts`，要求未知订单状态显示“未知订单状态”，页面不再保留 `CONSOLE_ORDER_STATUS_LABELS[o.status] || '-'`；首次运行失败，命中缺失 formatter 和旧页面兜底。
- 修复：`frontend/src/lib/console-orders.ts` 新增 `formatConsoleOrderStatusLabel()`，页面状态徽标和 `buildConsoleOrderExportCsv()` 统一复用该 formatter；未知状态使用“未知订单状态”，不改订单状态筛选、计数或接口字段。
- 验证：`node --test --experimental-strip-types frontend/src/lib/console-orders.test.ts frontend/src/lib/console-orders-production-entry.test.ts` 先失败后通过，最终 10 tests 通过；`node --test --experimental-strip-types frontend/src/lib/console-orders.test.ts frontend/src/lib/console-orders-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts` 通过 24 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；残留扫描不再命中订单状态空横杠兜底；`git diff --check -- frontend/src/app/console/orders/page.tsx frontend/src/lib/console-orders.ts frontend/src/lib/console-orders.test.ts frontend/src/lib/console-orders-production-entry.test.ts task_plan.md progress.md findings.md` 退出码 0，仅保留 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 11 第十七轮：小队成员未知状态中文兜底

- 目标：继续推进阶段 11“C 端可解释体验补强 / 小队抢票去 ID 化”，避免后端新增小队成员状态时，房间成员列表状态列显示空白。
- RED：扩展 `frontend/src/lib/team-room-production-entry.test.ts`，要求 `TeamMemberList` 不再直接渲染 `MEMBER_STATUS_LABELS[member.status]`，并保留“状态同步中”；首次运行失败，命中移动端和桌面端两个旧状态直取。
- 修复：`frontend/src/components/team-grab/TeamMemberList.tsx` 新增 `formatTeamMemberStatus()`，未知成员状态显示“状态同步中”，两个展示位置统一复用 `statusLabel`；不改成员移除、排序或后端状态字段。
- 验证：`node --test --experimental-strip-types frontend/src/lib/team-room-production-entry.test.ts` 先失败后通过，最终 3 tests 通过；`node --test --experimental-strip-types frontend/src/lib/team-room-production-entry.test.ts frontend/src/lib/team-grab.test.ts frontend/src/lib/waitlist.test.ts` 通过 23 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；残留扫描不再命中 `MEMBER_STATUS_LABELS[member.status]`；`git diff --check -- frontend/src/components/team-grab/TeamMemberList.tsx frontend/src/lib/team-room-production-entry.test.ts task_plan.md progress.md findings.md` 退出码 0，仅保留 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 11 第十八轮：小队策略和房间状态未知兜底

- 目标：继续推进阶段 11“C 端可解释体验补强 / 小队抢票去 ID 化”，避免小队策略或房间状态遇到后端新增枚举时显示空白。
- RED：扩展 `frontend/src/lib/team-grab.test.ts`，要求 `strategyLabel('FUTURE_STRATEGY')` 返回“未知策略”，`teamStatusLabel('FUTURE_STATUS')` 返回“状态同步中”；首次运行失败，旧 helper 返回 `undefined`。
- 修复：`frontend/src/lib/team-grab.ts` 将 `strategyLabel()` 和 `teamStatusLabel()` 入参放宽为 string，并分别补“未知策略”和“状态同步中”兜底；不改策略排序、保底策略归一化或小队状态流转。
- 验证：`node --test --experimental-strip-types frontend/src/lib/team-grab.test.ts` 先失败后通过，最终 14 tests 通过；`node --test --experimental-strip-types frontend/src/lib/team-grab.test.ts frontend/src/lib/team-room-production-entry.test.ts frontend/src/lib/waitlist.test.ts` 通过 24 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；残留扫描确认页面和选择器都经由共享 helper；`git diff --check -- frontend/src/lib/team-grab.ts frontend/src/lib/team-grab.test.ts task_plan.md progress.md findings.md` 退出码 0，仅保留 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第三十三轮：艺人编辑页审核与风险状态中文兜底

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免 `/console/artists/[id]/edit` 在审核状态和风险状态上直接展示 `pending`、`approved`、`normal`、`risky` 或未来后端码值。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，要求艺人编辑页不再保留 `artist.reviewStatus ||` / `artist.riskStatus ||`，并出现审核状态、风险状态的中文 formatter 与未知兜底；首次运行 `node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts --test-name-pattern "artist edit"` 失败，命中旧的原样回显逻辑。
- 修复：`frontend/src/app/console/artists/[id]/edit/page.tsx` 新增 `formatArtistReviewStatus()` 和 `formatArtistRiskStatus()`；已知审核状态映射为“待审核 / 已通过 / 已驳回”，已知风险状态映射为“风险正常 / 风险艺人”，未知值分别显示“未知审核状态 / 未知风险状态”。
- 验证：目标测试先失败后通过，最终 `console-production-entry.test.ts` 15 tests 通过；`console-production-entry.test.ts`、`activity-engagement-production-entry.test.ts`、`console-orders-production-entry.test.ts`、`console-orders.test.ts` 组合 27 tests 通过；`& .\node_modules\.bin\tsc --noEmit` 通过；残留扫描不再命中审核/风险状态 `||` 兜底；`git diff --check -- frontend/src/app/console/artists/[id]/edit/page.tsx frontend/src/lib/console-production-entry.test.ts task_plan.md progress.md findings.md` 退出码 0，仅保留 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第三十四轮：客服账号未知角色中文兜底

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免 `/console/support-accounts` 在后端新增客服角色或角色字段缺失时，把未知 `supportRole` 误显示为“普通客服”。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，要求客服账号页不再保留 `supportRoleOptions.find(...role)?.label || '普通客服'`，并出现“未知客服角色”；首次运行 `node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts --test-name-pattern "support account roles"` 失败，命中旧 fallback。
- 修复：`frontend/src/app/console/support-accounts/page.tsx` 的 `formatSupportRole()` 对未映射角色返回“未知客服角色”；已知 `support_agent` 和 `support_manager` 仍显示“普通客服 / 客服主管”，不改创建、编辑、启停接口字段。
- 验证：目标测试先失败后通过，最终 `console-production-entry.test.ts` 16 tests 通过；`console-production-entry.test.ts`、`console-auth.test.ts`、`support-tools.test.ts` 组合 48 tests 通过；`& .\node_modules\.bin\tsc --noEmit` 通过；残留扫描不再命中旧“普通客服” fallback；`git diff --check -- frontend/src/app/console/support-accounts/page.tsx frontend/src/lib/console-production-entry.test.ts task_plan.md progress.md findings.md` 退出码 0，仅保留 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第三十五轮：主办方入驻未知状态中文兜底

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免 `/console/organizer-applications` 和 `/console/profile` 遇到后端新增入驻申请状态时默认显示为“已驳回”。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，要求主办方管理页和个人中心商户入驻状态都显式处理 `status === 2`，并保留“未知入驻状态”；首次运行 `node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts --test-name-pattern "organizer application status"` 失败，命中旧默认“已驳回”逻辑。
- 修复：`frontend/src/app/console/organizer-applications/page.tsx` 的 `statusMeta()` 和 `frontend/src/app/console/profile/page.tsx` 的 `applicationStatusText()` 都改为 `0=待审核`、`1=已通过`、`2=已驳回`、未知值“未知入驻状态”；不改审核筛选、通过/驳回动作或接口字段。
- 验证：目标测试先失败后通过，最终 `console-production-entry.test.ts` 17 tests 通过；`console-production-entry.test.ts`、`console-auth.test.ts`、`api.test.ts` 组合 61 tests 通过；`& .\node_modules\.bin\tsc --noEmit` 通过；残留扫描只命中显式 `status === 2` 和“未知入驻状态”；`git diff --check -- frontend/src/app/console/organizer-applications/page.tsx frontend/src/app/console/profile/page.tsx frontend/src/lib/console-production-entry.test.ts task_plan.md progress.md findings.md` 退出码 0，仅保留 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第三十六轮：控制台个人中心账号状态中文兜底

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免 `/console/profile` 把未知账号状态默认显示为“正常”，同时按后端 `user.status` 语义对齐启用和停用状态。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，要求个人中心账号状态显示 `1=正常`、`0=已禁用`，并保留“未知账号状态”；首次运行 `node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts --test-name-pattern "profile account status"` 失败，命中旧的 `1=已通过 / 2=已禁用 / default=正常` 展示。
- 修复：`frontend/src/app/console/profile/page.tsx` 的 `statusText()` 改为 `status=1` 显示“正常”、`status=0` 显示“已禁用”、其他值显示“未知账号状态”；不改登录、权限判断、角色入口或后端字段。
- 验证：目标测试先失败后通过，最终 `console-production-entry.test.ts` 18 tests 通过；`console-production-entry.test.ts`、`console-auth.test.ts`、`api.test.ts` 组合 62 tests 通过；`& .\node_modules\.bin\tsc --noEmit` 通过；残留扫描只命中新账号状态映射；`git diff --check -- frontend/src/app/console/profile/page.tsx frontend/src/lib/console-production-entry.test.ts task_plan.md progress.md findings.md` 退出码 0，仅保留 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第三十七轮：客服账号启停状态中文兜底

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免 `/console/support-accounts` 把未知客服账号状态误显示为“已停用”，并避免启停按钮把未知状态当停用账号处理。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，要求客服账号页不再保留 `account.status === 1 ? '启用中' : '已停用'` 和 `account.status === 1 ? '停用' : '启用'`，并保留“未知账号状态”和“状态待核对”；首次运行 `node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts --test-name-pattern "support account status"` 失败，命中旧二分状态文案。
- 修复：`frontend/src/app/console/support-accounts/page.tsx` 新增 `formatSupportAccountStatus()` 和 `formatSupportAccountStatusAction()`，显式映射 `1=启用中`、`0=已停用`、未知值“未知账号状态”；未知状态下启停按钮显示“状态待核对”并禁用，`toggleStatus()` 同步拦截未知状态并提示“账号状态未知，请先核对后再操作”。
- 验证：目标测试先失败后通过，最终 `console-production-entry.test.ts` 19 tests 通过；`console-production-entry.test.ts`、`console-auth.test.ts`、`support-tools.test.ts` 组合 51 tests 通过；`& .\node_modules\.bin\tsc --noEmit` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第三十八轮：SeatCraft 座位属性状态中文兜底

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免 SeatCraft 座位图编辑控件在选中座位时直接展示 `available`、`reserved`、`selected`、`occupied`、`deleted` 等状态码。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，要求 `SeatLayoutControls` 不再直接渲染 `{seat.status}`，并保留 `formatSeatStatus()` 与“未知座位状态”；首次运行 `node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts --test-name-pattern "selected seat status"` 失败，命中旧座位属性状态直显。
- 修复：`frontend/src/components/seatcraft/SeatLayoutControls.tsx` 新增 `formatSeatStatus()`，已知状态显示“可售 / 已锁定 / 已选中 / 已占用 / 已删除”，未知值显示“未知座位状态”；不改 `seat.status` 的业务判断、画布颜色、可移动规则或座位状态流转。
- 验证：目标测试先失败后通过，最终 `console-production-entry.test.ts` 20 tests 通过；`seat-selection.test.ts`、`block-layout.test.ts`、`console-production-entry.test.ts` 组合 60 tests 通过；`& .\node_modules\.bin\tsc --noEmit` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第三十九轮：场次列表与导出状态中文兜底

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免 `/console/sessions` 页面、CSV 和 Excel 导出把未知场次状态误显示为“停用”。
- RED：扩展 `frontend/src/lib/console-sessions.test.ts` 和 `frontend/src/lib/console-production-entry.test.ts`，要求导出 helper 暴露 `formatConsoleSessionStatus()`、未知值显示“未知场次状态”，页面不再保留 `session.status === 1 ? '启用' : '停用'`；首次运行分别因缺少导出和旧页面二分文案失败。
- 修复：`frontend/src/lib/console-sessions.ts` 新增 `formatConsoleSessionStatus()` 并用于 CSV/Excel 行构建；`frontend/src/app/console/sessions/page.tsx` 导入同一 formatter 渲染状态徽标；不改状态筛选、编辑表单、保存请求或后端字段。
- 验证：目标测试先失败后通过，最终 `console-sessions.test.ts` 与 `console-production-entry.test.ts` 组合 24 tests 通过；`console-sessions.test.ts`、`console-production-entry.test.ts`、`console-check-in.test.ts` 组合 26 tests 通过；`& .\node_modules\.bin\tsc --noEmit` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第四十轮：主办方管理账号状态未知可见兜底

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免 `/console/organizer-applications` 在 `organizerStatus` 缺失或后端新增值时把主办方账号状态徽标静默隐藏。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，要求主办方管理页不再保留 `return null` 和 `userStatusMeta ? (...)` 条件渲染，并出现“未知主办方状态”；首次运行 `node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts --test-name-pattern "organizer account status"` 失败，命中旧隐藏逻辑。
- 修复：`frontend/src/app/console/organizer-applications/page.tsx` 的 `organizerStatusMeta()` 对未知或空状态返回“未知主办方状态”，账号状态徽标改为始终渲染；不改入驻申请状态、取消主办方动作、接口字段或审核筛选。
- 验证：目标测试先失败后通过，最终 `console-production-entry.test.ts` 22 tests 通过；`node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts frontend/src/lib/console-auth.test.ts frontend/src/lib/api.test.ts` 通过 66 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；`git diff --check -- frontend/src/app/console/organizer-applications/page.tsx frontend/src/lib/console-production-entry.test.ts task_plan.md progress.md findings.md` 退出码 0，仅保留 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 11 第十九轮：小队抢票进度未知状态中文兜底

- 目标：继续推进阶段 11“C 端可解释体验补强 / 小队抢票去 ID 化”，避免 `/teams/[id]` 在后端新增抢票进度状态时，进度卡片状态文本显示空白。
- RED：扩展 `frontend/src/lib/team-room-production-entry.test.ts`，要求页面不再直接渲染 `GRAB_STATUS_LABELS[progress.status]`，并保留 `formatGrabProgressStatus()` 与“状态同步中”；首次运行 `node --test --experimental-strip-types frontend/src/lib/team-room-production-entry.test.ts --test-name-pattern "grab progress status"` 失败，命中旧直取映射逻辑。
- 修复：`frontend/src/app/teams/[id]/page.tsx` 新增 `formatGrabProgressStatus()`，抢票进度状态未知时显示“状态同步中”；不改轮询、终态判断、请求号处理、支付同步或小队接口字段。
- 验证：目标测试先失败后通过，最终 `team-room-production-entry.test.ts` 4 tests 通过；`node --test --experimental-strip-types frontend/src/lib/team-room-production-entry.test.ts frontend/src/lib/team-grab.test.ts frontend/src/lib/waitlist.test.ts` 通过 25 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；`git diff --check -- frontend/src/app/teams/[id]/page.tsx frontend/src/lib/team-room-production-entry.test.ts task_plan.md progress.md findings.md` 退出码 0，仅保留 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第四十一轮：客服审计与上下文未知码中文兜底

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免客服工作台和客服会话查询遇到未知审计动作或上下文分区时原样显示后端码值。
- RED：扩展 `frontend/src/lib/support-tools.test.ts`，要求 `formatSupportContextSectionCount('unknown', 1)` 返回“未知上下文 1”，`formatSupportAuditAction('FUTURE_ACTION')` 返回“未知操作”；首次运行目标测试失败，旧实现分别返回 `unknown 1` 和 `FUTURE_ACTION`。
- 修复：`frontend/src/lib/support-tools.ts` 将未知客服审计动作固定兜底为“未知操作”，未知上下文分区固定兜底为“未知上下文”；不改已知标签、会话筛选、SLA、转接、结束会话或上下文数据结构。
- 验证：目标测试先失败后通过，最终 `support-tools.test.ts` 21 tests 通过；`node --test --experimental-strip-types frontend/src/lib/support-tools.test.ts frontend/src/lib/console-auth.test.ts frontend/src/lib/console-production-entry.test.ts` 通过 54 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；`git diff --check -- frontend/src/lib/support-tools.ts frontend/src/lib/support-tools.test.ts task_plan.md progress.md findings.md` 退出码 0，仅保留 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第四十二轮：客服标签未知码中文兜底

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免客服工作台或客服会话查询遇到后端新增客服标签时直接显示标签码。
- RED：扩展 `frontend/src/lib/support-tools.test.ts`，要求 `formatSupportTagLabel('FUTURE_TAG')` 返回“未知标签”；首次运行目标测试失败，旧实现返回 `FUTURE_TAG`。
- 修复：`frontend/src/lib/support-tools.ts` 的 `formatSupportTagLabel()` 对未知标签固定返回“未知标签”；不改已知 `REFUND/TICKET/ADMISSION/ACCOUNT/PAYMENT_EXCEPTION` 标签、标签筛选值或后端 payload。
- 验证：目标测试先失败后通过，最终 `support-tools.test.ts` 21 tests 通过；`node --test --experimental-strip-types frontend/src/lib/support-tools.test.ts frontend/src/lib/console-auth.test.ts frontend/src/lib/console-production-entry.test.ts` 通过 54 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；`git diff --check -- frontend/src/lib/support-tools.ts frontend/src/lib/support-tools.test.ts task_plan.md progress.md findings.md` 退出码 0，仅保留 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第四十三轮：活动艺人选择器缺名去编号化

- 目标：继续推进阶段 13“后台中文化与编号语境治理”，避免活动表单已选艺人缺少名称时把内部 `artistId` 拼成“艺人 123”作为展示名。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，要求 `ActivityArtistSelector` 不再包含 `艺人 ${item.artistId}`，并保留“艺人信息待同步”；首次运行目标测试失败，命中旧缺名兜底。
- 修复：`frontend/src/components/activity-artist/ActivityArtistSelector.tsx` 将缺名展示兜底改为“艺人信息待同步”；不改 `artistId` 作为 React key、设为主艺人、排序、移除或表单提交字段。
- 验证：目标测试先失败后通过，最终 `console-production-entry.test.ts` 23 tests 通过；`node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts frontend/src/lib/activity-engagement-production-entry.test.ts frontend/src/lib/console-auth.test.ts` 通过 36 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；`git diff --check -- frontend/src/components/activity-artist/ActivityArtistSelector.tsx frontend/src/lib/console-production-entry.test.ts task_plan.md progress.md findings.md` 退出码 0，仅保留 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 11 第二十轮：活动详情抢票主状态未知兜底

- 目标：继续推进阶段 11“C 端可解释体验补强”，避免 `/activity/[id]` 抢票进度弹窗主状态遇到后端新增状态时显示泛化“未知状态”。
- RED：扩展 `frontend/src/lib/activity-detail-production-entry.test.ts`，要求活动详情不再保留 `GRAB_STATUS_LABELS[grabProgress.status] || '未知状态'`，并出现 `formatGrabStatusLabel()` 与“状态同步中”；首次运行目标测试失败，命中旧主状态兜底。
- 修复：`frontend/src/app/activity/[id]/page.tsx` 新增 `formatGrabStatusLabel()`，抢票进度主状态未知时显示“状态同步中”；不改抢票轮询、终态判断、降档尝试、支付入口或 waitlist 入口。
- 验证：目标测试先失败后通过，最终 `activity-detail-production-entry.test.ts` 7 tests 通过；`node --test --experimental-strip-types frontend/src/lib/activity-detail-production-entry.test.ts frontend/src/lib/activity-detail-content.test.ts frontend/src/lib/grab-progress.test.ts frontend/src/lib/waitlist.test.ts` 通过 24 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；`git diff --check -- frontend/src/app/activity/[id]/page.tsx frontend/src/lib/activity-detail-production-entry.test.ts task_plan.md progress.md findings.md` 退出码 0，仅保留 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第四十四轮：退款审核未知状态中文业务兜底

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免 `/console/refunds` 页面和退款明细导出在后端新增退款状态时只显示泛化“未知状态”。
- RED：扩展 `frontend/src/lib/console-refunds.test.ts` 和 `frontend/src/lib/refunds-production-entry.test.ts`，要求 CSV/Excel 导出与页面源码都包含“未知退款状态”，并不再保留 `label: '未知状态'`；首次运行 `node --test --experimental-strip-types frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts` 失败，命中旧兜底。
- 修复：`frontend/src/lib/console-refunds.ts` 新增 `formatConsoleRefundStatus()` 并用于 CSV/Excel 行构建；`frontend/src/app/console/refunds/page.tsx` 将未知状态徽标文案改为“未知退款状态”；不改状态筛选、同意/拒绝/重试退款动作、接口字段或导出字段范围。
- 验证：目标测试先失败后通过，最终 `console-refunds.test.ts` 与 `refunds-production-entry.test.ts` 4 tests 通过；`node --test --experimental-strip-types frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts` 通过 27 tests；`& .\node_modules\.bin\tsc --noEmit` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第四十五轮：平台主办方运营员账号状态中文兜底

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免 `/console/organizer-admins` 把未知平台主办方运营员账号状态误标为“已停用”，并提供可直接“启用”的写动作。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，要求平台主办方运营员账号页不再保留 `account.status === 1 ? '启用中' : '已停用'` 和 `account.status === 1 ? '停用' : '启用'`，并出现“未知账号状态”和“状态待核对”；首次运行目标测试失败，命中旧二分状态逻辑。
- 修复：`frontend/src/app/console/organizer-admins/page.tsx` 新增账号状态展示、操作文案和可切换状态判定 helper；未知状态显示“未知账号状态”，启停按钮显示“状态待核对”并禁用，`toggleStatus()` 对未知状态提示“账号状态未知，请先核对后再操作”；不改权限模型、账号创建/编辑/删除接口或状态字段。
- 验证：目标测试先失败后通过，最终 `console-production-entry.test.ts` 24 tests 通过；`node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts frontend/src/lib/console-auth.test.ts frontend/src/lib/operation-display.test.ts` 通过 38 tests；`& .\node_modules\.bin\tsc --noEmit` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第四十六轮：活动管理列表未知上下架状态保护

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免 `/console/activities` 把未知活动销售状态误标为“下架”，并在未知状态下提供“上架”写动作。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，要求活动列表不再保留 `return activity.status === 1 ? '上架' : '下架'` 和 `const newStatus = activity.status === 1 ? 0 : 1`，并出现“未知活动状态”和“状态待核对”；首次运行目标测试失败，命中旧二分上下架逻辑。
- 修复：`frontend/src/app/console/activities/page.tsx` 新增活动销售状态、操作标题、下一状态和控件可见性 helper；已知状态显示 `1=上架`、`0=下架`，未知状态显示“未知活动状态”，上下架按钮标题显示“状态待核对”并禁用，`handleToggleStatus()` 对未知状态提示“活动状态未知，请先核对后再操作。”；不改筛选参数、发布草稿、风险停售、删除或退款链路。
- 验证：目标测试先失败后通过，最终 `console-production-entry.test.ts` 25 tests 通过；`node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts frontend/src/lib/console-auth.test.ts frontend/src/lib/console-paths.test.ts` 通过 39 tests；`& .\node_modules\.bin\tsc --noEmit` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第四十七轮：评价审核未知状态业务兜底

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免 `/console/activity-engagement` 评价审核列表在后端新增评价状态时只显示泛化“未知状态”。
- RED：扩展 `frontend/src/lib/activity-engagement-production-entry.test.ts`，要求页面源码不再保留 `return '未知状态'`，并包含“未知评价状态”“未知问答状态”“未知举报状态”；首次运行目标测试失败，命中 `reviewStatusLabel()` 的旧兜底。
- 修复：`frontend/src/app/console/activity-engagement/page.tsx` 将评价审核未知状态兜底改为“未知评价状态”；不改评价审核动作、问答/举报状态、筛选参数或接口字段。
- 验证：目标测试先失败后通过，最终 `activity-engagement-production-entry.test.ts` 2 tests 通过；`node --test --experimental-strip-types frontend/src/lib/activity-engagement-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts` 通过 60 tests；`& .\node_modules\.bin\tsc --noEmit` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第四十八轮：异常任务未知状态业务兜底

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免异常任务队列遇到后端新增任务状态时只显示泛化“未知状态”。
- RED：修改 `frontend/src/lib/operation-display.test.ts`，要求 `formatExceptionStatus('queued')` 返回“未知异常状态”；首次运行目标测试失败，当前 formatter 仍返回“未知状态”。
- 修复：`frontend/src/lib/operation-display.ts` 将 `formatExceptionStatus()` 的未知兜底改为“未知异常状态”；不改异常任务类型、等级、认领/处理/关闭动作或接口字段。
- 验证：目标测试先失败后通过，最终 `operation-display.test.ts` 3 tests 通过；`node --test --experimental-strip-types frontend/src/lib/operation-display.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts` 通过 61 tests；`& .\node_modules\.bin\tsc --noEmit` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第四十九轮：对账未知状态业务兜底

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免对账批次、明细和差异状态遇到后端新增枚举时都显示泛化“未知状态”。
- RED：扩展 `frontend/src/lib/operation-display.test.ts`，要求 `formatReconciliationBatchStatus()`、`formatReconciliationDetailStatus()`、`formatReconciliationDifferenceStatus()` 的未知值分别返回“未知对账批次状态”“未知对账明细状态”“未知对账差异状态”；首次运行目标测试失败，命中旧统一兜底。
- 修复：`frontend/src/lib/operation-display.ts` 分别替换三个对账状态 formatter 的未知兜底；页面、CSV 和 Excel 导出继续复用同一套 formatter，不改对账筛选、差异处理/忽略动作或接口字段。
- 验证：目标测试先失败后通过，最终 `operation-display.test.ts` 3 tests 通过；`node --test --experimental-strip-types frontend/src/lib/operation-display.test.ts frontend/src/lib/console-reconciliation.test.ts frontend/src/lib/reconciliation-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts` 通过 31 tests；`& .\node_modules\.bin\tsc --noEmit` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 11 第二十一轮：候补未知状态业务兜底

- 目标：继续推进阶段 11“C 端可解释体验补强”，避免候补列表遇到后端新增候补状态时显示泛化“未知状态”。
- RED：修改 `frontend/src/lib/waitlist.test.ts`，要求 `getWaitlistStatusLabel('UNKNOWN')` 返回“候补状态同步中”；首次运行 `node --test --experimental-strip-types frontend/src/lib/waitlist.test.ts --test-name-pattern "returns readable waitlist status labels"` 失败，旧实现仍返回“未知状态”。
- 修复：`frontend/src/lib/waitlist.ts` 将候补状态未知兜底改为“候补状态同步中”；不改候补可取消判断、支付主动作、抢票终态加入候补判断或接口字段。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/waitlist.test.ts frontend/src/lib/team-grab.test.ts frontend/src/lib/grab-progress.test.ts frontend/src/lib/activity-detail-production-entry.test.ts` 通过 36 tests。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 11 第二十二轮：C 端活动销售状态未知兜底

- 目标：继续推进阶段 11“C 端可解释体验补强”，避免首页、搜索页和活动详情把后端新增或迁移中的活动销售状态误标为“售罄”。
- RED：新增 `frontend/src/lib/activity-sale-status-production-entry.test.ts`，要求首页、搜索和活动详情不再保留未知状态落到 `sold_out` 的旧映射，并要求卡片出现 `status_syncing` 与“状态同步中”；首次运行目标测试失败，命中首页旧三分映射。
- 修复：新增 `frontend/src/lib/activity-sale-status.ts` 的 `toActivitySaleStatus()`，保留 `0=售罄`、`1=售票中`、`2=待开票`，其他值映射为 `status_syncing`；`TicketCard` 对该状态显示“状态同步中”；首页、搜索页和活动详情分析事件复用同一映射。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/activity-sale-status-production-entry.test.ts frontend/src/lib/homepage-production-fallback.test.ts frontend/src/lib/search-production-entry.test.ts frontend/src/lib/activity-detail-production-entry.test.ts frontend/src/lib/waitlist.test.ts` 通过 22 tests。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第五十轮：私有文件上传类型缺省文案中文化

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免资质/证明文件上传组件在文件类型缺失时显示泛化“未知类型”。
- RED：新增 `frontend/src/lib/private-file-upload-production-entry.test.ts`，要求 `PrivateFileUpload` 不再包含“未知类型”，并出现“文件类型待同步”；首次运行目标测试失败，命中旧文案。
- 修复：`frontend/src/components/PrivateFileUpload.tsx` 将缺失 `contentType` 的展示兜底改为“文件类型待同步”；不改上传、移除、更换文件或 `PrivateAssetVO` 字段。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/private-file-upload-production-entry.test.ts frontend/src/lib/activity-sale-status-production-entry.test.ts frontend/src/lib/waitlist.test.ts frontend/src/lib/console-production-entry.test.ts` 通过 34 tests。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-11 阶段 13 第五十一轮：场次未知状态待核对样式

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免 `/console/sessions` 在未知场次状态下虽然显示中文文案，但视觉上仍和“停用”共用灰色徽标。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，要求场次页不再保留 `session.status === 1 ? ... : ...` 的二分样式，并出现 `getConsoleSessionStatusClassName()` 与未知状态待核对样式；首次运行目标测试失败，命中旧页面样式逻辑。
- 修复：`frontend/src/lib/console-sessions.ts` 新增 `getConsoleSessionStatusClassName()`，已知启用/停用保留原样式，未知状态使用 `bg-[#fff7e6] text-[#ad6800]`；`/console/sessions` 页面改为复用该 helper。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/console-sessions.test.ts frontend/src/lib/console-production-entry.test.ts` 通过 28 tests。
- 最终回归：`node --test --experimental-strip-types frontend/src/lib/waitlist.test.ts frontend/src/lib/activity-sale-status-production-entry.test.ts frontend/src/lib/homepage-production-fallback.test.ts frontend/src/lib/search-production-entry.test.ts frontend/src/lib/activity-detail-production-entry.test.ts frontend/src/lib/private-file-upload-production-entry.test.ts frontend/src/lib/console-sessions.test.ts frontend/src/lib/console-production-entry.test.ts` 通过 51 tests；`& .\node_modules\.bin\tsc --noEmit` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-12 阶段 11 第二十三轮：订单列表退款未知状态同步兜底

- 目标：继续推进阶段 11“C 端可解释体验补强”，避免 `/orders` 在退款状态遇到后端新增枚举时直取 `REFUND_STATUS_MAP[latestRefund.status]` 导致页面崩溃、退款进度误导或继续开放重复退款申请。
- RED：扩展 `frontend/src/lib/refund-flow.test.ts` 和 `frontend/src/lib/orders-production-entry.test.ts`，要求未知退款状态显示“退款状态同步中”、时间线不把平台审核标成已完成、人工客服介入使用同步中文状态，并要求订单页不再直取 `REFUND_STATUS_MAP[latestRefund.status]` / `REFUND_STATUS_MAP[activeRefund.status]`；首次运行目标测试失败，分别命中缺少新导出和旧页面直取映射。
- 修复：`frontend/src/lib/refund-flow.ts` 新增 `getRefundStatusMeta()` 与 `isRefundActionBlockingStatus()`，已知退款状态文案和颜色保持不变，未知状态显示“退款状态同步中”并视为阻塞重复退款申请；`buildRefundTimeline()` 未知状态第二步显示同步中且保持 active；`/orders` 改为复用共享 helper。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/refund-flow.test.ts frontend/src/lib/orders-experience.test.ts frontend/src/lib/orders-production-entry.test.ts frontend/src/lib/console-orders.test.ts` 通过 22 tests；`& .\node_modules\.bin\tsc --noEmit` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-12 阶段 13 第五十二轮：评价审核未知状态写动作保护

- 目标：继续推进阶段 13“平台治理与运营中台 / 后台中文化与枚举展示治理”，避免 `/console/activity-engagement` 评价审核列表在后端新增评价状态时仍按 `review.status !== 1/2` 暴露“通过/隐藏”写动作。
- RED：扩展 `frontend/src/lib/activity-engagement-production-entry.test.ts`，要求评价审核页不再保留 `review.status !== 1` / `review.status !== 2` 的二分写动作，并出现 `canApproveReview()`、`canHideReview()`、`canRestoreReview()` 和“状态待核对”；首次运行目标测试失败，命中旧按钮逻辑。
- 修复：`frontend/src/app/console/activity-engagement/page.tsx` 新增已知评价状态与可操作状态 helper，`0` 允许通过/隐藏，`1` 允许隐藏，`2` 允许通过/恢复展示；未知评价状态只显示“状态待核对”，不再触发审核写动作。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/activity-engagement-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts` 通过 61 tests；`& .\node_modules\.bin\tsc --noEmit` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-12 阶段 13 第五十三轮：问答未知状态写动作保护

- 目标：继续推进阶段 13“平台治理与运营中台 / 后台中文化与枚举展示治理”，避免 `/console/activity-engagement` 购前问答列表在后端新增问答状态时仍按 `question.status !== 'HIDDEN'` / `=== 'HIDDEN'` 暴露“隐藏/恢复”，并继续开放“保存回复”写动作。
- RED：扩展 `frontend/src/lib/activity-engagement-production-entry.test.ts`，要求问答列表不再保留 `question.status !== 'HIDDEN'` / `question.status === 'HIDDEN'` 的二分写动作，并出现 `isKnownQuestionStatus()`、`canAnswerQuestion()`、`canHideQuestion()`、`canRestoreQuestion()` 和“状态待核对”；首次运行目标测试失败，命中旧问答按钮逻辑。
- 修复：`frontend/src/app/console/activity-engagement/page.tsx` 新增已知问答状态与可操作状态 helper，`PENDING/ANSWERED/HIDDEN` 保持原有保存回复能力，`PENDING/ANSWERED` 允许隐藏，`HIDDEN` 允许恢复；未知问答状态只显示“状态待核对”，不再触发保存回复、隐藏或恢复写动作。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/activity-engagement-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts` 通过 62 tests；`& .\node_modules\.bin\tsc --noEmit` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-12 阶段 13 第五十四轮：控制台订单未知状态待核对样式

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免 `/console/orders` 在未知订单状态下虽然显示“未知订单状态”，但视觉上仍和“已取消/已退款”共用灰色徽标。
- RED：扩展 `frontend/src/lib/console-orders.test.ts` 和 `frontend/src/lib/console-orders-production-entry.test.ts`，要求未知订单状态使用独立待核对样式，并要求页面不再保留 `o.status === 1/2/其他` 的内联三分样式；首次运行目标测试失败，分别命中缺少 `getConsoleOrderStatusClassName()` 导出和页面旧样式逻辑。
- 修复：`frontend/src/lib/console-orders.ts` 新增 `getConsoleOrderStatusClassName()`，已知待支付/已支付/已取消/已退款保留原样式，未知订单状态使用 `bg-[#fff7e6] text-[#ad6800]`；`/console/orders` 页面改为复用该 helper。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/console-orders.test.ts frontend/src/lib/console-orders-production-entry.test.ts` 通过 12 tests。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-12 阶段 13 第五十五轮：私有文件上传大小缺省文案中文化

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免资质/证明文件上传组件在文件大小缺失或无效时显示泛化“未知大小”。
- RED：扩展 `frontend/src/lib/private-file-upload-production-entry.test.ts`，要求 `PrivateFileUpload` 不再包含“未知大小”，并出现“文件大小待同步”；首次运行目标测试失败，命中旧文案。
- 修复：`frontend/src/components/PrivateFileUpload.tsx` 将缺失或无效 `fileSize` 的展示兜底改为“文件大小待同步”；不改上传、移除、更换文件、文件类型展示或 `PrivateAssetVO` 字段。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/private-file-upload-production-entry.test.ts` 通过 2 tests。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-12 阶段 11 第二十四轮：订单列表票档旧兜底清理

- 目标：继续推进阶段 11“C 端可解释体验补强”，避免 `/orders` 列表在票档名称缺失时继续显示旧文案“未知票档”，与已统一的“票档信息待同步”口径不一致。
- RED：扩展 `frontend/src/lib/orders-production-entry.test.ts`，要求订单页和订单详情不再包含“未知票档”，并继续包含“票档信息待同步”；首次运行目标测试失败，命中订单列表渲染中的旧兜底。
- 修复：`frontend/src/app/orders/page.tsx` 将订单列表票档展示兜底改为“票档信息待同步”；不改 `enrichOrders()`、订单详情、票夹、抢票上下文或接口字段。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/orders-production-entry.test.ts` 通过 6 tests。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-12 阶段 13 第五十六轮：退款未知状态待核对样式

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免 `/console/refunds` 在未知退款状态下虽然显示“未知退款状态”，但视觉上仍和“已拒绝”共用灰色徽标。
- RED：扩展 `frontend/src/lib/console-refunds.test.ts` 和 `frontend/src/lib/refunds-production-entry.test.ts`，要求未知退款状态使用独立待核对样式，并要求页面接入 `getConsoleRefundStatusClassName()`；首次运行目标测试失败，分别命中缺少 helper 导出和页面仍未复用共享样式。
- 修复：`frontend/src/lib/console-refunds.ts` 新增 `getConsoleRefundStatusClassName()`，已知待审核/已退款/已拒绝/退款失败/处理中保留原样式，未知退款状态使用 `bg-[#fff7e6] text-[#ad6800]`；`/console/refunds` 页面改为复用 `formatConsoleRefundStatus()` 和该样式 helper。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts` 通过 5 tests；回归 `node --test --experimental-strip-types frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts frontend/src/lib/refund-flow.test.ts frontend/src/lib/orders-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts` 通过 73 tests；`& .\node_modules\.bin\tsc --noEmit` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-12 阶段 13 第五十七轮：入场核验未知结果待核对样式

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免 `/console/check-in` 在未知核验结果下虽然显示“未知结果”，但样式兜底散落在页面且缺少独立待核对视觉提示。
- RED：扩展 `frontend/src/lib/console-check-in.test.ts` 和 `frontend/src/lib/check-in-production-entry.test.ts`，要求核验结果文案/样式通过共享 helper 提供，未知结果使用 `bg-[#fff7e6] text-[#ad6800]`；首次运行目标测试失败，分别命中缺少 `formatConsoleCheckInResult()` 导出和页面旧 `RESULT_STYLES[record.result] || ...` 兜底。
- 修复：`frontend/src/lib/console-check-in.ts` 新增 `formatConsoleCheckInResult()` 与 `getConsoleCheckInResultClassName()`，CSV/Excel 导出和 `/console/check-in` 页面统一复用；已知成功/重复/失败样式保持不变，未知结果使用独立待核对样式。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/console-check-in.test.ts frontend/src/lib/check-in-production-entry.test.ts` 通过 5 tests；回归 `node --test --experimental-strip-types frontend/src/lib/console-check-in.test.ts frontend/src/lib/check-in-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts` 通过 68 tests；`& .\node_modules\.bin\tsc --noEmit` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-12 阶段 13 第五十八轮：艺人列表未知审核/风险状态展示与写动作保护

- 目标：继续推进阶段 13“平台治理与运营中台 / 后台中文化与枚举展示治理”，避免 `/console/artists` 在后端新增艺人审核或风险状态时把未知审核状态误标为“待审核”，把未知风险状态误标为“风险正常”并开放“列入风险”写动作。
- RED：新增 `frontend/src/lib/console-artists.test.ts` 并扩展 `frontend/src/lib/console-production-entry.test.ts`，要求艺人列表审核/风险状态有中文未知兜底，并要求未知风险状态下风险写动作显示“状态待核对”且不可切换；首次运行目标测试失败，分别命中新 helper 不存在和页面旧二分展示/写动作逻辑。
- 修复：新增 `frontend/src/lib/console-artists.ts`，提供 `formatArtistListReviewStatus()`、`formatArtistListRiskStatus()`、`getArtistListReviewTone()`、`getArtistListRiskTone()`、`canToggleArtistRiskStatus()`、`getNextArtistRiskStatus()` 和 `formatArtistRiskToggleAction()`；`/console/artists` 页面改为复用这些 helper，未知风险状态按钮禁用并不再打开风险弹窗。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/console-artists.test.ts frontend/src/lib/console-production-entry.test.ts` 通过 28 tests；回归 `node --test --experimental-strip-types frontend/src/lib/console-artists.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-auth.test.ts frontend/src/lib/console-paths.test.ts` 通过 75 tests；`& .\node_modules\.bin\tsc --noEmit` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-12 阶段 13 第五十九轮：风险事件未知恢复状态写动作保护

- 目标：继续推进阶段 13“平台治理与运营中台 / 后台中文化与枚举展示治理”，避免 `/console/risk-events` 在最新恢复申请状态未知时仍把按钮显示为“提交恢复申请”并开放重复提交。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，要求风险事件页不再保留 `disabled={latest?.status === 'pending'}` 和 `latest?.status === 'pending' ? '审核中' : '提交恢复申请'` 的二分按钮逻辑，并出现 `canSubmitRiskResolution()`、`formatRiskResolutionSubmitLabel()` 与“状态待核对”；首次运行目标测试失败，命中旧按钮逻辑。
- 修复：`frontend/src/app/console/risk-events/page.tsx` 新增恢复申请状态可提交判断和按钮文案 helper；未知恢复申请状态显示“状态待核对”并禁用按钮，`pending` 继续显示“审核中”并禁用，无最新申请或已知非审核中状态保持可提交。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts` 通过 27 tests。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-12 阶段 13 第六十轮：风险案例未知恢复状态操作区兜底

- 目标：继续推进阶段 13“平台治理与运营中台 / 后台中文化与枚举展示治理”，避免 `/console/risk-cases` 在最新恢复状态未知时虽然徽标显示“未知审核状态”，但操作区仍落到“等待主办方处理”。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，要求风险案例页不再保留直接渲染“等待主办方处理”的兜底 span，并出现 `formatRiskCaseActionLabel()` 与“状态待核对”；首次运行目标测试失败，命中旧操作区兜底。
- 修复：`frontend/src/app/console/risk-cases/page.tsx` 新增 `isKnownRiskCaseStatus()`、`formatRiskCaseActionLabel()` 和 `getRiskCaseActionClassName()`；已知 `awaiting_response` 继续显示“等待主办方处理”，未知状态显示“状态待核对”并使用待核对样式。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts` 通过 28 tests。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-12 阶段 13 第六十一轮：客服会话未知状态业务兜底

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免客服工作台和客服会话查询在后端新增会话状态时把未知状态误显示为“处理中”。
- RED：扩展 `frontend/src/lib/support-tools.test.ts`，要求 `formatSupportConversationStatus('FUTURE_STATUS')` 返回“未知会话状态”；首次运行目标测试失败，旧 formatter 返回“处理中”。
- 修复：`frontend/src/lib/support-tools.ts` 将客服会话状态 formatter 的默认兜底改为“未知会话状态”；不改会话筛选、队列分组、轮询判断、接入/转接/升级/关闭等写动作。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/support-tools.test.ts` 通过 21 tests。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-12 阶段 11 第二十五轮：帮助中心转人工未知会话状态兜底

- 目标：继续推进阶段 11“C 端可解释体验补强”，避免 `/help` 在会话状态未知时虽然状态说明显示“未知会话状态”，但转人工按钮仍落到“转人工客服”。
- RED：扩展 `frontend/src/lib/support-tools.test.ts` 和 `frontend/src/lib/orders-production-entry.test.ts`，要求新增 `formatSupportHandoffActionLabel()`，并要求帮助页不再保留内联 `WAITING_AGENT/ASSIGNED/CLOSE_REQUESTED` 三段按钮文案；首次运行目标测试失败，分别命中 helper 不存在和页面旧内联文案。
- 修复：`frontend/src/lib/support-tools.ts` 新增 `formatSupportHandoffActionLabel()`，已知等待人工/人工处理中/等待结束确认保持原文案，未知状态显示“状态待核对”；`/help` 页面改为复用该 helper，转人工可点击条件仍由 `canRequestSupportHandoff()` 控制。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/support-tools.test.ts frontend/src/lib/orders-production-entry.test.ts` 通过 29 tests。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-12 阶段 11 第二十六轮：商户入驻页未知入驻状态兜底

- 目标：继续推进阶段 11“C 端可解释体验补强”，避免 `/merchant` 在后端新增或迁移中的入驻申请状态下把未知状态误标为“已驳回”或“资料正在审核中”。
- RED：扩展 `frontend/src/lib/merchant-production-entry.test.ts`，要求 `status=2` 才显示“已驳回”，未知状态显示“未知入驻状态”，并要求说明文案包含“入驻状态待核对”；首次运行目标测试失败，命中 `statusMeta()` 默认返回“已驳回”。
- 修复：`frontend/src/app/merchant/page.tsx` 将 `statusMeta()` 改为显式处理 `0/1/2`，其他值返回“未知入驻状态”；新增 `statusDescription()`，未知入驻状态说明改为“入驻状态待核对，请稍后刷新或联系平台客服。”。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/merchant-production-entry.test.ts` 通过 2 tests；回归 `node --test --experimental-strip-types frontend/src/lib/merchant-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/support-tools.test.ts frontend/src/lib/orders-production-entry.test.ts` 通过 59 tests；`& .\node_modules\.bin\tsc --noEmit` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-12 阶段 11 第二十七轮：活动详情问答未知状态回复兜底

- 目标：继续推进阶段 11“C 端可解释体验补强”，避免 `/activity/[id]` 问答列表在后端新增或迁移中的问答状态下，把无回答问题误显示为普通“暂无回复”。
- RED：扩展 `frontend/src/lib/activity-detail-production-entry.test.ts`，要求旧的 `item.status === 'PENDING' ? '已提交，等待回复' : '暂无回复'` 二分兜底消失，并出现 `formatActivityQuestionAnswerFallback()` 与“问答状态同步中”；首次运行目标测试失败，命中旧问答兜底。
- 修复：`frontend/src/app/activity/[id]/page.tsx` 新增 `formatActivityQuestionAnswerFallback()`，已知 `PENDING` 继续显示“已提交，等待回复”，已知 `ANSWERED/HIDDEN` 缺少回答时继续显示“暂无回复”，未知状态显示“问答状态同步中”。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/activity-detail-production-entry.test.ts` 通过 8 tests；回归 `node --test --experimental-strip-types frontend/src/lib/activity-detail-production-entry.test.ts frontend/src/lib/activity-engagement-production-entry.test.ts frontend/src/lib/activity-sale-status-production-entry.test.ts frontend/src/lib/team-room-production-entry.test.ts frontend/src/lib/orders-production-entry.test.ts` 通过 24 tests。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-12 阶段 13 第六十二轮：客服工作台未知会话状态写动作保护

- 目标：继续推进阶段 13“平台治理与运营中台 / 客服主管能力 / 后台中文化与枚举展示治理”，避免 `/support` 在后端新增或迁移中的会话状态下，虽然显示“未知会话状态”，但标签、备注、转接、升级、申请结束等写动作仍按“非 CLOSED”开放。
- RED：扩展 `frontend/src/lib/support-tools.test.ts` 和 `frontend/src/lib/support-workbench-production-entry.test.ts`，要求新增客服会话状态写动作 helper，并要求页面不再保留多个 `disabled={active.status === 'CLOSED'}` 的写动作条件；首次运行目标测试失败，分别命中 helper 未导出和页面旧禁用逻辑。
- 修复：`frontend/src/lib/support-tools.ts` 新增 `isKnownSupportConversationStatus()`、`canClaimSupportConversation()`、`canReplySupportConversation()`、`canEditSupportConversation()`、`canRequestSupportClose()` 和 `formatSupportConversationWriteBlockedMessage()`；`frontend/src/app/support/page.tsx` 改为复用这些 helper，并在接入、发送、备注、标签、转接、升级、申请结束函数入口加同一套状态保护。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/support-tools.test.ts frontend/src/lib/support-workbench-production-entry.test.ts` 通过 25 tests；回归 `node --test --experimental-strip-types frontend/src/lib/support-workbench-production-entry.test.ts frontend/src/lib/support-tools.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/orders-production-entry.test.ts` 通过 60 tests；`& .\node_modules\.bin\tsc --noEmit` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-12 阶段 13 第六十三轮：退款未知状态操作区兜底

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免 `/console/refunds` 在未知退款状态下虽然不开放同意/拒绝/重试按钮，但操作列仍显示“无需操作”，让后台人员误以为该记录无需核对。
- RED：扩展 `frontend/src/lib/console-refunds.test.ts` 和 `frontend/src/lib/refunds-production-entry.test.ts`，要求新增 `canReviewConsoleRefund()`、`formatConsoleRefundActionLabel()`，未知退款状态操作区显示“状态待核对”，页面不再使用 `refund.status !== 0 && refund.status !== 4` 的内联“无需操作”兜底；首次运行目标测试失败，分别命中 helper 未导出和页面未接入 helper。
- 修复：`frontend/src/lib/console-refunds.ts` 新增退款状态可审核判断和操作区文案 helper；`frontend/src/app/console/refunds/page.tsx` 改为复用 helper，已知待审核和处理中继续显示同意/拒绝/重试动作，未知状态显示“状态待核对”。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts` 通过 6 tests；回归 `node --test --experimental-strip-types frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts frontend/src/lib/refund-flow.test.ts frontend/src/lib/orders-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts` 通过 78 tests；`& .\node_modules\.bin\tsc --noEmit` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-12 阶段 11 第二十八轮：订单活动/场馆缺名同步兜底

- 目标：继续推进阶段 11“C 端可解释体验补强”，避免 `/orders` 和 `/orders/[id]` 在活动名或场馆名缺失时显示“未知活动 / 未知场馆”，让用户误以为是普通未知对象而不是订单快照或票务信息同步中。
- RED：扩展 `frontend/src/lib/orders-production-entry.test.ts`，要求订单列表和详情不再包含“未知活动 / 未知场馆”，并继续包含“活动信息待同步 / 场馆信息待同步”；首次运行目标测试失败，命中订单列表、订单详情和退款人工客服消息中的旧兜底。
- 修复：`frontend/src/app/orders/page.tsx` 和 `frontend/src/app/orders/[id]/page.tsx` 将活动名缺失兜底改为“活动信息待同步”，场馆名缺失兜底改为“场馆信息待同步”；退款人工客服消息中的活动 fallback 同步改为“活动信息待同步”。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/orders-production-entry.test.ts` 通过 8 tests；回归 `node --test --experimental-strip-types frontend/src/lib/orders-production-entry.test.ts frontend/src/lib/refund-flow.test.ts frontend/src/lib/activity-detail-production-entry.test.ts frontend/src/lib/support-tools.test.ts frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts` 通过 49 tests；`& .\node_modules\.bin\tsc --noEmit` 通过。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-12 阶段 13 第六十四轮：控制台订单活动缺名同步兜底

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免 `/console/orders` 和后台订单 CSV 导出在活动名缺失时显示“未知活动”，让后台人员误以为是普通未知对象而不是订单快照或活动信息同步中。
- RED：扩展 `frontend/src/lib/console-orders.test.ts` 和 `frontend/src/lib/console-orders-production-entry.test.ts`，要求新增 `getConsoleOrderActivityLabel()`，CSV 导出和页面不再包含“未知活动”；首次运行目标测试失败，分别命中 helper 未导出和页面旧兜底。
- 修复：`frontend/src/lib/console-orders.ts` 新增 `getConsoleOrderActivityLabel()` 并让 `buildConsoleOrderExportCsv()` 复用；`frontend/src/app/console/orders/page.tsx` 改为复用该 helper，缺少活动名时显示“活动信息待同步”。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/console-orders.test.ts frontend/src/lib/console-orders-production-entry.test.ts` 通过 14 tests；回归 `node --test --experimental-strip-types frontend/src/lib/console-orders.test.ts frontend/src/lib/console-orders-production-entry.test.ts frontend/src/lib/orders-production-entry.test.ts frontend/src/lib/refund-flow.test.ts frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts` 通过 93 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；`git diff --check -- frontend/src/lib/console-orders.ts frontend/src/app/console/orders/page.tsx frontend/src/lib/console-orders.test.ts frontend/src/lib/console-orders-production-entry.test.ts` 退出码 0，仅 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-12 阶段 13 第六十五轮：退款审核活动缺名同步兜底

- 目标：继续推进阶段 13“后台中文化与枚举展示治理”，避免 `/console/refunds`、退款 CSV 和 Excel 导出在退款关联订单/活动名缺失时显示“未知活动”，让后台人员误以为是普通未知对象而不是退款关联活动信息同步中。
- RED：扩展 `frontend/src/lib/console-refunds.test.ts` 和 `frontend/src/lib/refunds-production-entry.test.ts`，要求新增 `getConsoleRefundActivityLabel()`，页面和导出不再包含“未知活动”；首次运行目标测试失败，分别命中 helper 未导出和页面旧兜底。
- 修复：`frontend/src/lib/console-refunds.ts` 新增 `getConsoleRefundActivityLabel()`，并让 CSV/Excel 导出复用；`frontend/src/app/console/refunds/page.tsx` 改为复用该 helper，缺少订单/活动名时显示“活动信息待同步”。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts` 通过 7 tests；回归 `node --test --experimental-strip-types frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts frontend/src/lib/refund-flow.test.ts frontend/src/lib/orders-production-entry.test.ts frontend/src/lib/console-orders.test.ts frontend/src/lib/console-orders-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts` 通过 94 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；`git diff --check -- frontend/src/lib/console-refunds.ts frontend/src/app/console/refunds/page.tsx frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts` 退出码 0，仅 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

## 2026-06-12 阶段 12 第八轮：入场核验异常报表导出

- 目标：继续推进阶段 12“主办方经营闭环 / 报表导出升级”，在既有全量核验记录 CSV/Excel 基础上补异常核验报表，让主办方或平台人员快速下载失败、重复和未知待核对核验记录。
- RED：扩展 `frontend/src/lib/console-check-in.test.ts` 和 `frontend/src/lib/check-in-production-entry.test.ts`，要求新增异常 CSV/Excel helper，异常报表不包含成功记录，不导出 `ticketId`、`orderId`、`userId`、`sessionId`、`ticketTypeId`、`operatorUserId` 等内部关联编号，并要求页面出现“导出异常报表 / 导出异常 Excel”；首次运行目标测试失败，命中 helper 未导出。
- 修复：`frontend/src/lib/console-check-in.ts` 抽出共享导出行构造，新增 `getConsoleCheckInExceptionRecords()`、`buildConsoleCheckInExceptionExportCsv()` 和 `buildConsoleCheckInExceptionExportExcelHtml()`，异常范围为非 `SUCCESS` 结果，包含 `FAILED`、`DUPLICATE` 和未来未知结果；`frontend/src/app/console/check-in/page.tsx` 新增异常 CSV/Excel 下载入口和空异常记录中文反馈。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/console-check-in.test.ts frontend/src/lib/check-in-production-entry.test.ts` 通过 6 tests；相邻回归 `node --test --experimental-strip-types frontend/src/lib/console-check-in.test.ts frontend/src/lib/check-in-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts frontend/src/lib/console-orders.test.ts frontend/src/lib/console-orders-production-entry.test.ts` 通过 55 tests；`& .\node_modules\.bin\tsc --noEmit` 通过；`git diff --check -- frontend/src/lib/console-check-in.ts frontend/src/lib/console-check-in.test.ts frontend/src/lib/check-in-production-entry.test.ts frontend/src/app/console/check-in/page.tsx` 退出码 0，仅 LF/CRLF warning。
- 本轮没有数据库结构变更，不需要迁移；未提交、未推送。

### 2026-06-12 补充验证：异常核验报表文件名前缀

- 补充目标：收口生产入口断言，确保异常核验 CSV/Excel 下载文件名使用“异常核验记录-日期”前缀，而不是复用全量“核验记录-日期”前缀。
- RED：`node --test --experimental-strip-types frontend/src/lib/check-in-production-entry.test.ts` 失败，命中 `downloadRecords(buildConsoleCheckInExceptionExportCsv(records), '异常核验记录'...)` 断言缺失。
- 修复：`frontend/src/app/console/check-in/page.tsx` 的 `downloadRecords()` 增加 `filenamePrefix` 参数；全量导出继续使用“核验记录”，异常导出使用“异常核验记录”。
- 验证：`node --test --experimental-strip-types frontend/src/lib/console-check-in.test.ts frontend/src/lib/check-in-production-entry.test.ts` 通过 6 tests；相邻回归 `node --test --experimental-strip-types frontend/src/lib/console-check-in.test.ts frontend/src/lib/check-in-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts frontend/src/lib/console-orders.test.ts frontend/src/lib/console-orders-production-entry.test.ts` 通过 55 tests；`frontend` 下 `& .\node_modules\.bin\tsc --noEmit` 通过；`git diff --check -- frontend/src/lib/console-check-in.ts frontend/src/lib/console-check-in.test.ts frontend/src/lib/check-in-production-entry.test.ts frontend/src/app/console/check-in/page.tsx task_plan.md progress.md findings.md` 退出码 0，仅 LF/CRLF warning。

## 2026-06-12 阶段 12 第九轮：活动列表批量下架并退款入口

- 目标：继续推进阶段 12“主办方经营闭环 / 批量运营”，在 `/console/activities` 当前页补批量选择和“批量下架并退款”入口，减少主办方逐条下架活动或巡演的重复操作。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，要求活动列表出现 `selectedActivityKeys`、`getBatchDeactivatableActivities()`、`handleBatchDeactivate()`、“批量下架并退款”、“已选择”和“同意退款”，并复用 `deactivateActivity()` / `deactivateTour()`；首次运行 `node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts --test-name-pattern "batch deactivate"` 失败，命中缺少 `selectedActivityKeys`。
- 修复：`frontend/src/app/console/activities/page.tsx` 新增当前页可下架活动/巡演多选、全选、二次确认、逐条复用既有下架退款接口和批量结果汇总；未知状态、草稿、风险停票、已下架巡演不进入批量写动作；单条上下架也补未知状态保护和更明确的巡演重新上架提示。
- 验证：目标测试先失败后通过；回归 `node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/refunds-production-entry.test.ts frontend/src/lib/console-refunds.test.ts` 通过 69 tests；`frontend` 下 `& .\node_modules\.bin\tsc --noEmit` 通过；`git diff --check -- frontend/src/app/console/activities/page.tsx frontend/src/lib/console-production-entry.test.ts` 退出码 0，仅 LF/CRLF warning。
- 浏览器验证：重启 `omni-frontend` 后访问 `http://localhost:3000/console/activities`，可见“已选择 0 个，可批量下架 10 个”和“批量下架并退款”；勾选一行后按钮启用并显示“已选择 1 个”，随后已取消勾选，未触发批量下架写动作。
- 工具备注：`pnpm --dir frontend typecheck` 因本机全局 pnpm 入口缺失失败，错误为 `Cannot find module 'C:\Program Files\nodejs\node_modules\pnpm\bin\pnpm.mjs'`；本轮用项目本地 `node_modules\.bin\tsc --noEmit` 完成类型检查。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端批量 API，未跨库写审计；未提交、未推送。

## 2026-06-12 阶段 12 第十轮：批量下架操作审计 internal API

- 目标：补齐阶段 12 硬标准“批量动作必须有操作审计”，让普通活动和巡演“下架并退款”进入全局 `operation_audit_log`，同时保持微服务边界，不让 `java-ticket` 跨库写 `java-user` 表。
- RED：新增 `java-user` internal 审计控制器测试后，首次运行目标 Maven 测试失败，命中 `InternalOperationAuditController` 不存在；扩展 `ActivityAdminServiceTest`、`TourStationServiceTest` 和 `operation-display.test.ts`，要求下架退款后写审计并能在前端显示“下架活动并退款 / 下架巡演并退款”。
- 修复：`java-user` 新增 `POST /api/user/internal/operation-audits`，校验 `X-Internal-Token` 后调用 `OperationAuditService.write()`；`java-ticket` 的 `UserInternalClient` / `UserAccessService` 新增 internal 审计写入封装；`ActivityAdminService` 和 `TourStationService` 在下架退款成功后写入 `activity.deactivate.refund` / `tour.deactivate.refund` 审计，审计失败仅 warn，不阻断下架退款主链路；`operation-display` 补齐动作和 `tour` 目标类型中文映射。
- 验证：`mvn -pl java-user,java-ticket -am "-Dtest=InternalOperationAuditControllerTest,ActivityAdminServiceTest,TourStationServiceTest" "-Dsurefire.failIfNoSpecifiedTests=false" test` 通过 60 tests；`node --test --experimental-strip-types frontend/src/lib/operation-display.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/refunds-production-entry.test.ts frontend/src/lib/console-refunds.test.ts` 通过 72 tests；`frontend` 下 `& .\node_modules\.bin\tsc --noEmit` 通过；`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过；`git diff --check --` 当前切片文件退出码 0，仅 LF/CRLF warning。
- 边界备注：本轮没有数据库结构变更，不需要迁移；审计写入归属 `java-user`，`java-ticket` 只通过 internal API 调用；未提交、未推送。

## 2026-06-12 阶段 12 第十一轮：批量通知购票用户

- 目标：继续推进阶段 12“主办方经营闭环 / 批量运营”，在 `/console/activities` 增加手动批量通知购票用户能力；第一轮只发送站内通知，不接真实 SMS/Email，不新增跨库查询。
- RED：扩展 `ActivityAdminServiceTest`、`AdminControllerTest`、`frontend/src/lib/api.test.ts` 和 `frontend/src/lib/console-production-entry.test.ts`；首次运行目标测试失败，后端命中 `ActivityBuyerNotificationRequest/Response` 不存在，前端命中 `notifyActivityBuyers` 未导出和活动页缺批量通知入口。
- 修复：`java-ticket` 新增 `ActivityBuyerNotificationRequest/Response`，`AdminController` 暴露 `POST /api/ticket/admin/activities/{id}/buyer-notifications` 并用 JWT subject 覆盖 body `userId`；`ActivityAdminService.notifyActivityBuyers()` 复用活动管理权限、已支付订单 internal 查询和 `NotificationMqProducer`，对有效订单发送 `ACTIVITY_BUYER_NOTICE`，`channels` 限定为 `IN_APP`，action 指向 `/orders/{orderId}`，并通过 `java-user` internal audit API 写入 `activity.buyers.notify` 审计。
- 前端：`frontend/src/lib/api.ts` 新增 `notifyActivityBuyers()` 并移除请求体中的 `userId`；`frontend/src/types/api.ts` 新增 `ActivityBuyerNotificationResponse`；`/console/activities` 复用当前页勾选状态，普通活动进入批量通知，巡演不误调单活动接口，通知前要求填写“通知内容”并确认“仅发送站内通知”；通知中心把 `ACTIVITY_BUYER_NOTICE` 显示为“活动通知”。
- 验证：目标测试先失败后通过；`mvn -pl java-ticket "-Dtest=ActivityAdminServiceTest,AdminControllerTest" "-Dsurefire.failIfNoSpecifiedTests=false" test` 通过 155 tests；`node --test --experimental-strip-types frontend/src/lib/api.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/components/notification-state.test.ts` 通过 80 tests；`frontend` 下 `& .\node_modules\.bin\tsc --noEmit` 通过；`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过。
- 边界备注：本轮没有数据库结构变更，不需要迁移；批量通知不发送 SMS/Email；审计写入归属 `java-user`，`java-ticket` 只通过 internal API 调用；未提交、未推送。

## 2026-06-12 阶段 12 第十二轮：退款审核页批量处理退款

- 目标：继续推进阶段 12“主办方经营闭环 / 批量运营”，在 `/console/refunds` 补批量选择和批量同意/拒绝退款入口，减少后台人员逐条审核退款申请的重复操作，同时不绕开既有单条退款审核、通知和审计链路。
- RED：扩展 `frontend/src/lib/console-refunds.test.ts` 和 `frontend/src/lib/refunds-production-entry.test.ts`，要求新增批量退款目标筛选 helper，并要求页面出现 `selectedRefundIds`、`handleBatchRefundReview()`、二次确认、批量同意/拒绝按钮、中文批量结果和逐条复用 `approveRefund()` / `rejectRefund()`；首次运行目标测试失败，命中 helper 未导出和页面缺少批量入口。
- 修复：`frontend/src/lib/console-refunds.ts` 新增 `getBatchRefundApproveTargets()` 和 `getBatchRefundRejectTargets()`；`frontend/src/app/console/refunds/page.tsx` 新增当前页可处理退款勾选、全选、批量同意/重试、批量拒绝、成功/失败计数和中文反馈。待审核与处理中记录可批量同意/重试，只有待审核记录可批量拒绝，未知退款状态不能被勾选。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts` 通过 9 tests；相邻回归 `node --test --experimental-strip-types frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts frontend/src/lib/refund-flow.test.ts frontend/src/lib/orders-production-entry.test.ts frontend/src/lib/console-orders.test.ts frontend/src/lib/console-orders-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts` 通过 99 tests；`frontend` 下 `& .\node_modules\.bin\tsc --noEmit` 通过；`git diff --check -- frontend/src/lib/console-refunds.ts frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts frontend/src/app/console/refunds/page.tsx` 退出码 0，仅 LF/CRLF warning。
- 浏览器验证：`http://localhost:3000/console/refunds` 初次仍显示旧页面，根因是 `omni-frontend` 容器内 `.next/dev` 缓存未重编译；第一次 `docker exec` 命令因 PowerShell 抢先展开 `$(date ...)` 失败，改用单引号后将 `/app/.next/dev` 挪到时间戳备份目录并 `docker restart omni-frontend`。重载后浏览器验证批量栏、全选复选框均可见，console 无 warn/error；未点击批量同意或拒绝，未触发退款写动作。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端批量 API，批量动作逐条复用已审计的单条退款接口；未提交、未推送。

## 2026-06-12 阶段 12 第十三轮：场次页票档批量改价

- 目标：继续推进阶段 12“主办方经营闭环 / 批量运营”，在 `/console/sessions` 补当前页票档多选和批量改价入口，减少主办方或平台人员逐条修改票档价格的重复操作，同时不新增后端批量 API。
- RED：新增 `frontend/src/lib/console-ticket-types.test.ts`，扩展 `frontend/src/lib/console-production-entry.test.ts`，要求新增批量改价候选 helper，并要求页面出现 `selectedTicketTypeKeys`、`getBatchTicketPriceUpdateTargets()`、`handleBatchTicketPriceUpdate()`、“批量改价”、“目标票价”、“确认批量改价”、“批量改价处理完成”和逐条调用 `updateAdminTicketType(ticket.id...)`；首次运行目标测试失败，命中 helper 文件不存在和页面缺少批量入口。
- 修复：新增 `frontend/src/lib/console-ticket-types.ts`，集中处理票档批量改价候选、目标筛选、票价输入校验和票档状态中文兜底；`frontend/src/app/console/sessions/page.tsx` 新增当前页票档多选、可改价票档全选、批量改价按钮、目标票价输入、二次确认、逐条复用 `updateAdminTicketType(ticket.id, { price })` 和中文结果汇总。仅 `status=0/1` 票档可批量改价，未知票档状态不能被勾选。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/console-ticket-types.test.ts frontend/src/lib/console-production-entry.test.ts` 通过 33 tests；相邻回归 `node --test --experimental-strip-types frontend/src/lib/console-ticket-types.test.ts frontend/src/lib/console-sessions.test.ts frontend/src/lib/sessions-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts` 通过 80 tests；`frontend` 下 `& .\node_modules\.bin\tsc --noEmit` 通过；`git diff --check -- frontend/src/lib/console-ticket-types.ts frontend/src/lib/console-ticket-types.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/app/console/sessions/page.tsx` 退出码 0，仅 LF/CRLF warning。
- 运行态与浏览器验证：通过 Gateway 登录 admin 测试账号后请求 `GET http://localhost:8088/api/ticket/admin/sessions?page=1&size=10` 返回业务 `code=200`，当前页 10 条场次均包含 `ticketTypes`。`http://localhost:3000/console/sessions` 初次未显示批量入口，根因是 `omni-frontend` 容器 `.next/dev` 旧缓存；确认容器内源码已有 `selectedTicketTypeKeys` 后，将 `/app/.next/dev` 挪到时间戳备份目录并重启 `omni-frontend`。重载后页面可见“批量改价”、选择统计和当前页票档复选框，浏览器 console 无 warn/error；未点击确认批量改价，未触发票价写动作。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端批量 API，批量改价逐条复用既有单条票档更新链路；当前后端单条票档更新未显式写 `operation_audit_log`，如后续严格要求批量改价独立审计，应复用或扩展 `java-user` internal audit API；未提交、未推送。

### 2026-06-12 补充验证：IDEA 服务可启动后的场次页只读复测

- 标准端口 API：通过 Gateway 登录 admin 测试账号返回业务 `code=200`，随后 `GET http://localhost:8088/api/ticket/admin/sessions?page=1&size=10` 返回业务 `code=200`；当前页 `sessionCount=10`，各场次 `ticketTypes` 数量为 `3,3,4,3,3,3,3,3,3,3`。
- 浏览器验证：`http://localhost:3000/console/sessions` 可见“批量改价”“已选择 0 个，可批量改价 0 个；未知票档状态不会进入批量改价。”和 32 个复选框；勾选第一个票档后显示“已选择 1 个，可批量改价 1 个”，批量改价按钮启用，随后已取消勾选恢复 0；未点击确认批量改价，未触发票价写动作，浏览器 console warn/error 为空。
- fresh 验证：`node --test --experimental-strip-types frontend/src/lib/console-ticket-types.test.ts frontend/src/lib/console-sessions.test.ts frontend/src/lib/sessions-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts` 通过 80 tests；`frontend` 下 `& .\node_modules\.bin\tsc --noEmit` 退出码 0；`git diff --check -- frontend/src/lib/console-ticket-types.ts frontend/src/lib/console-ticket-types.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/app/console/sessions/page.tsx task_plan.md progress.md findings.md` 退出码 0，仅 LF/CRLF warning。

## 2026-06-12 阶段 12 第十四轮：场次页票档批量启停

- 目标：继续推进阶段 12“主办方经营闭环 / 批量运营”，在 `/console/sessions` 复用当前页票档多选，新增“批量启用 / 批量停用”入口，减少主办方或平台人员逐条启停票档的重复操作。
- 范围决策：后端单条 `updateTicketType()` 同时支持 `status` 和 `totalStock`，但 `totalStock` 通过差值直接调整 `remainStock`，当前缺少“不能低于已售数量”的明确保护；本轮只做批量启停，批量库存调整后置为单独切片。
- RED：扩展 `frontend/src/lib/console-ticket-types.test.ts` 和 `frontend/src/lib/console-production-entry.test.ts`，要求新增 `getBatchTicketStatusUpdateTargets()`，并要求页面出现 `handleBatchTicketStatusUpdate()`、“批量启用”、“批量停用”、“确认批量调整票档状态”、“批量调整票档状态处理完成”和逐条调用 `updateAdminTicketType(ticket.id, { status: targetStatus })`；首次运行目标测试失败，命中 helper 未导出和页面缺少批量启停入口。
- 修复：`frontend/src/lib/console-ticket-types.ts` 新增已知票档状态判断和批量状态目标筛选，仅允许 `status=0/1` 且目标状态不同的选中票档进入写动作；`frontend/src/app/console/sessions/page.tsx` 新增批量启用/停用按钮、状态目标计数、二次确认、逐条复用 `updateAdminTicketType(ticket.id, { status: targetStatus })`、本地状态回写和中文结果汇总。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/console-ticket-types.test.ts frontend/src/lib/console-production-entry.test.ts` 通过 35 tests；相邻回归 `node --test --experimental-strip-types frontend/src/lib/console-ticket-types.test.ts frontend/src/lib/console-sessions.test.ts frontend/src/lib/sessions-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts` 通过 82 tests；`frontend` 下 `& .\node_modules\.bin\tsc --noEmit` 退出码 0；`git diff --check -- frontend/src/lib/console-ticket-types.ts frontend/src/lib/console-ticket-types.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/app/console/sessions/page.tsx` 退出码 0，仅 LF/CRLF warning。
- 浏览器验证：`http://localhost:3000/console/sessions` 初次仍显示旧编译产物，确认 `omni-frontend` 容器源码已包含“批量启用”后，将 `/app/.next/dev` 挪到 `/app/.next/dev-stale-20260612065951` 并重启 `omni-frontend`。重载后页面可见“批量改价 / 批量启用 / 批量停用”和“已选择 0 个，可批量改价 0 个，可批量启用 0 个，可批量停用 0 个；未知票档状态不会进入批量操作。”；勾选一个已启用票档后显示“已选择 1 个，可批量改价 1 个，可批量启用 0 个，可批量停用 1 个”，批量停用启用、批量启用保持禁用，随后已取消勾选恢复 0；未点击批量启用/停用确认，未触发票档状态写动作，浏览器 console warn/error 为空。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端批量 API；批量启停逐条复用既有单条票档更新链路；当前单条票档更新未显式写 `operation_audit_log`，如后续要求票档批量启停独立审计，应复用或扩展 `java-user` internal audit API；未提交、未推送。

## 2026-06-12 阶段 12 第十五轮：场次页票档批量库存调整

- 目标：继续推进阶段 12“主办方经营闭环 / 批量运营”，在 `/console/sessions` 复用当前页票档多选，新增“批量库存”入口，减少主办方或平台人员逐条调整票档库存的重复操作，同时补齐后端单条 `totalStock` 更新的已售下限保护。
- RED：扩展 `TicketTypeManagementTest`、`frontend/src/lib/console-ticket-types.test.ts` 和 `frontend/src/lib/console-production-entry.test.ts`；首次运行目标测试失败，后端命中 `updateTicketType()` 允许把 `totalStock` 调到低于已售数量，前端命中库存 helper 未导出和页面缺少批量库存入口。
- 修复：`java-ticket` 的 `AdminController.updateTicketType()` 对 `totalStock` 增加非负与已售下限保护，按“已售 = 当前总库存 - 当前余票”重算余票；`frontend/src/lib/console-ticket-types.ts` 新增库存目标筛选、已售计算、低于已售拦截和非负整数输入校验；`frontend/src/app/console/sessions/page.tsx` 新增“批量库存”按钮、目标总库存输入、二次确认、逐条复用 `updateAdminTicketType(ticket.id, { totalStock })`、本地库存回写和中文结果汇总。
- 验证：目标测试先失败后通过；`mvn -pl java-ticket "-Dtest=TicketTypeManagementTest" test` 通过 22 tests；`node --test --experimental-strip-types frontend/src/lib/console-ticket-types.test.ts frontend/src/lib/console-production-entry.test.ts` 通过 38 tests；相邻回归 `node --test --experimental-strip-types frontend/src/lib/console-ticket-types.test.ts frontend/src/lib/console-sessions.test.ts frontend/src/lib/sessions-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts` 通过 85 tests；`frontend` 下 `& .\node_modules\.bin\tsc --noEmit` 退出码 0；`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过。
- 浏览器验证：`http://localhost:3000/console/sessions` 初次仍显示旧编译产物，确认源码已包含“批量库存”后，将 `omni-frontend` 容器内 `/app/.next/dev` 挪到 `/app/.next/dev-stale-20260612071231` 并重启容器。重载后页面可见“批量库存”和“可批量库存”；勾选第一个票档后显示“已选择 1 个，可批量改价 1 个，可批量启用 0 个，可批量停用 1 个，可批量库存 1 个”，批量库存按钮启用；随后已取消勾选恢复 0；未点击批量库存确认，未触发库存写动作，浏览器 console warn/error 为空。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端批量 API；批量库存逐条复用既有单条票档更新链路；当前单条票档库存更新未显式写 `operation_audit_log`，如后续要求票档批量库存独立审计，应复用或扩展 `java-user` internal audit API；未提交、未推送。

## 2026-06-12 阶段 12 第十六轮：场次页票档批量导入

- 目标：继续推进阶段 12“主办方经营闭环 / 批量运营”，在 `/console/sessions` 增加普通非座位绑定票档的批量粘贴导入入口，减少主办方或平台人员逐条新建票档的重复操作。
- 范围决策：本轮只支持普通票档文本/CSV/Tab 粘贴导入，字段为“场次编号,票档名称,票价,总库存”；允许第一行表头，支持英文逗号、中文逗号和 Tab 分隔，空行跳过。SeatCraft 区域/座位绑定批量导入后置为独立切片。
- RED：扩展 `frontend/src/lib/console-ticket-types.test.ts` 和 `frontend/src/lib/console-production-entry.test.ts`，要求新增 `parseBatchTicketImportInput()`，并要求页面出现 `createAdminTicketType()`、`handleBatchTicketImport()`、“批量导入票档”、“场次编号,票档名称,票价,总库存”、“确认批量导入票档”、“批量导入票档处理完成”和逐条调用 `createAdminTicketType({ userId, sessionId: row.sessionId, name: row.name, price: row.price, totalStock: row.totalStock })`；首次运行目标测试失败，命中 helper 未导出和页面未接创建入口。
- 修复：`frontend/src/lib/console-ticket-types.ts` 新增 `BatchTicketImportRow` 和 `parseBatchTicketImportInput()`，统一校验场次编号正整数、票档名称非空、票价大于 0 且归一到两位小数、总库存非负整数；`frontend/src/app/console/sessions/page.tsx` 新增“批量导入票档”按钮、textarea 粘贴弹窗、校验失败中文反馈、二次确认、逐条复用 `createAdminTicketType()`、当前页场次统计本地回写和成功/失败计数。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/console-ticket-types.test.ts frontend/src/lib/console-production-entry.test.ts` 通过 41 tests；相邻回归 `node --test --experimental-strip-types frontend/src/lib/console-ticket-types.test.ts frontend/src/lib/console-sessions.test.ts frontend/src/lib/sessions-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts` 通过 88 tests；`frontend` 下 `& .\node_modules\.bin\tsc --noEmit` 退出码 0；`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过。
- 浏览器验证：通过后台测试账号访问 `http://localhost:3000/console/sessions`；初次仍显示旧编译产物，确认 `omni-frontend` 容器存在后，将容器内 `/app/.next/dev` 挪到 `/app/.next/dev-stale-20260612072839` 并重启容器。重载后页面可见“批量导入票档”；点击后弹窗包含“场次编号,票档名称,票价,总库存”和“解析导入”，随后点击“取消”，未触发导入写动作，浏览器 console warn/error 为空。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端批量 API；批量导入逐条复用既有单条票档创建链路；当前单条票档创建未显式写 `operation_audit_log`，如后续要求票档批量导入独立审计，应复用或扩展 `java-user` internal audit API；未提交、未推送。

## 2026-06-12 阶段 12 第十七轮：票档创建/更新操作审计

- 目标：继续收口阶段 12“批量动作必须有二次确认、结果反馈和操作审计”的硬标准；由于 `/console/sessions` 的批量导入、改价、启停和库存都逐条复用单条票档创建/更新链路，本轮在单条链路补审计来覆盖这些批量入口。
- RED：扩展 `TicketTypeManagementTest`，要求普通票档创建、区域绑定票档创建和票档更新成功后调用 `UserAccessService.writeOperationAudit()`，动作分别为 `ticket_type.create` / `ticket_type.update`，目标类型为 `ticket_type`，并要求审计失败不阻断票档更新；首次运行 `mvn -pl java-ticket "-Dtest=TicketTypeManagementTest" test` 失败，命中创建/更新均未写审计。扩展 `frontend/src/lib/operation-display.test.ts`，首次运行失败，命中 `ticket_type.create` 显示为“未知操作”。
- 修复：`java-ticket` 的 `AdminController.createTicketType()` 在创建成功并刷新搜索索引后写 `ticket_type.create` 审计；`updateTicketType()` 在更新成功后写 `ticket_type.update` 审计，结果摘要包含变更字段、场次编号、票价、总库存和状态；审计写入继续通过 `java-user` internal API，失败仅记录 warn，不影响票档创建/更新主链路。`frontend/src/lib/operation-display.ts` 新增“创建票档 / 更新票档 / 票档”中文映射。
- 验证：目标测试先失败后通过；`mvn -pl java-ticket "-Dtest=TicketTypeManagementTest" test` 通过 26 tests；相邻后端回归 `mvn -pl java-ticket "-Dtest=TicketTypeManagementTest,AdminControllerTest,ActivityAdminServiceTest" "-Dsurefire.failIfNoSpecifiedTests=false" test` 通过 181 tests；前端目标/相邻回归 `node --test --experimental-strip-types frontend/src/lib/operation-display.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts` 通过 71 tests；`frontend` 下 `& .\node_modules\.bin\tsc --noEmit` 退出码 0；`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过。
- 边界备注：本轮没有数据库结构变更，不需要迁移；审计写入归属 `java-user`，`java-ticket` 只通过 existing internal API 调用；审计失败不回滚票档主操作，避免用户重复触发批量写动作；未提交、未推送。

## 2026-06-12 阶段 13 第六十六轮：RBAC 权限变更差异预览

- 目标：继续推进阶段 13“RBAC 增强”，在 `/console/roles` 保存前展示权限变更差异，让平台管理员在提交前能看到新增/移除权限，并对敏感权限变更进行更明确的二次确认。
- RED：新增 `frontend/src/lib/rbac-permission-diff.test.ts`，要求输出新增/移除权限中文名称和敏感变更判断；扩展 `frontend/src/lib/console-production-entry.test.ts`，要求角色权限页出现 `buildRbacPermissionDiff`、“权限变更预览”、“新增权限”、“移除权限”、“敏感权限变更”和“确认更新角色权限”，并不再使用“确认保存角色授权”。首次运行目标测试失败，命中 helper 文件不存在和页面缺少预览入口。
- 修复：新增 `frontend/src/lib/rbac-permission-diff.ts`，集中处理权限差异、权限名称解析、去重和 `rbac.manage` / `platform_super_admin` 敏感变更判断；`frontend/src/app/console/roles/page.tsx` 改为复用该 helper，在权限列表上方展示“权限变更预览”，按新增/移除列出权限名与权限码；保存确认弹窗统一为“确认更新角色权限”，敏感变更使用 danger 类型并显示“本次包含敏感权限变更”说明。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/rbac-permission-diff.test.ts frontend/src/lib/console-production-entry.test.ts` 通过 37 tests；相邻回归 `node --test --experimental-strip-types frontend/src/lib/rbac-permission-diff.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/operation-display.test.ts frontend/src/lib/console-auth.test.ts` 通过 85 tests；`frontend` 下 `& .\node_modules\.bin\tsc --noEmit` 退出码 0。
- 浏览器验证：访问 `http://localhost:3000/console/roles` 时初次仍渲染旧编译产物；已将 `omni-frontend` 容器内 `/app/.next/dev` 挪到 `/app/.next/dev-stale-20260612075355` 并重启容器。重载后页面可见“权限变更预览”和“当前没有待保存的权限变更。”；勾选“审计查看”后出现待保存提示，点击“保存授权”弹出“确认更新角色权限”，随后点击“取消”并取消勾选恢复初始状态；未触发权限保存写动作，浏览器 console warn/error 为空。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端 API；继续沿用已有 `rbac.role_permission.update` 后端审计链路；未提交、未推送。

## 2026-06-12 阶段 13 第六十七轮：RBAC 权限变更审计明细

- 目标：继续推进阶段 13“RBAC 增强”，把 `rbac.role_permission.update` 审计结果从“权限数量：N”升级为后端真实计算的新增/移除权限明细，避免审计内容只反映请求体数量。
- RED：扩展 `RbacAdminServiceTest`，要求 `updateRolePermissions()` 返回 `RolePermissionUpdateResult`，并输出“新增权限：客服账号管理（support.account.manage）；移除权限：操作审计（audit.view）；更新后权限数：2”；新增 `InternalWorkbenchControllerRbacAuditTest`，要求控制器把该摘要写入 `OperationAuditWriteRequest.result`。首次运行 `mvn -pl java-user "-Dtest=RbacAdminServiceTest,InternalWorkbenchControllerRbacAuditTest" test` 失败，命中 `RolePermissionUpdateResult` / `PermissionChangeItem` 不存在和 `updateRolePermissions()` 返回 `void`。
- 修复：`RbacAdminService.updateRolePermissions()` 改为返回 `RolePermissionUpdateResult`，在删除重插前读取旧权限，规范化新权限后计算新增/移除差异；权限名称由后端查询到的 `RbacPermission` 映射提供，缺名时回退权限码；`platform_super_admin` 继续强制保存全部权限，最后一个 `rbac.manage` 角色保护保持不变。`InternalWorkbenchController.updateRolePermissions()` 改为使用 `updateResult.toAuditSummary()` 写入 `rbac.role_permission.update` 审计。
- 验证：目标测试先失败后通过；`mvn -pl java-user "-Dtest=RbacAdminServiceTest,InternalWorkbenchControllerRbacAuditTest" test` 通过 6 tests；相邻回归 `mvn -pl java-user "-Dtest=RbacAdminServiceTest,InternalWorkbenchControllerRbacAuditTest,OperationAuditServiceTest,InternalWorkbenchControllerOrganizerOpsTest" "-Dsurefire.failIfNoSpecifiedTests=false" test` 通过 15 tests；`powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1` 通过。
- 边界备注：本轮没有数据库结构变更，不需要迁移；审计写入仍归属 `java-user` 同服务；未新增跨服务 Mapper、Entity 或 SQL；未提交、未推送。

## 2026-06-12 阶段 13 第六十八轮：RBAC 角色模板套用入口

- 目标：继续收口阶段 13“RBAC 增强”，在 `/console/roles` 为常见岗位补“套用角色模板”入口，让平台管理员能先套用标准权限组合，再通过已有“权限变更预览”和“确认更新角色权限”保存。
- 方案边界：本轮模板只作为前端选择辅助，不新增数据库表、不新增后端 API、不绕过后端 `rbac.role_permission.update` 保存和审计；模板权限会按当前权限表存在的权限码过滤，`platform_super_admin` 不提供模板，避免和后端强制全权限语义冲突。
- RED：新增 `frontend/src/lib/rbac-role-templates.test.ts`，要求客服主管模板只使用当前权限表存在的权限码并记录缺失权限，且平台超管不返回模板；扩展 `frontend/src/lib/console-production-entry.test.ts`，要求角色权限页接入 `getRbacRoleTemplatesForRole`、“套用角色模板”、“套用模板”和“请核对权限变更预览后保存”。首次运行目标测试失败，命中新 helper 文件不存在和页面未接入模板入口。
- 修复：新增 `frontend/src/lib/rbac-role-templates.ts`，定义客服主管、普通客服、主办方和平台主办方运营员标准模板，并按当前 `listRbacPermissions()` 返回的权限码过滤可套用权限；`frontend/src/app/console/roles/page.tsx` 在权限变更预览前展示模板区，点击“套用模板”仅更新当前页勾选状态并提示核对预览，保存仍走原有确认弹窗和后端更新链路。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/rbac-role-templates.test.ts frontend/src/lib/console-production-entry.test.ts` 通过 38 tests；相邻回归 `node --test --experimental-strip-types frontend/src/lib/rbac-role-templates.test.ts frontend/src/lib/rbac-permission-diff.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/operation-display.test.ts frontend/src/lib/console-auth.test.ts` 通过 88 tests；`frontend` 下 `& .\node_modules\.bin\tsc --noEmit` 退出码 0。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端 API；模板套用不触发保存写动作，最终保存后仍由 `java-user` 基于真实旧值和新值写入权限变更审计；未提交、未推送。

## 2026-06-12 阶段 13 第六十九轮：操作审计筛选中文化入口

- 目标：继续推进阶段 13“异常与对账二期 / 后台中文化”，让 `/console/audit-logs` 的动作和对象类型筛选不再要求后台人员输入 `rbac.role_permission.update`、`ticket_type` 这类后端码值。
- 范围决策：本轮只改前端筛选入口和显示映射 helper，不新增后端 API、不改数据库结构；下拉框显示中文业务标签，提交查询时仍传后端原始 `action` / `targetType` 值，保持接口契约不变。
- RED：扩展 `frontend/src/lib/operation-display.test.ts`，要求导出操作审计筛选选项并保留后端 value；扩展 `frontend/src/lib/audit-log-production-entry.test.ts`，要求审计页接入 `getOperationActionFilterOptions()` / `getOperationTargetTypeFilterOptions()`、“全部操作类型 / 全部对象类型”，并移除“动作 / 对象类型”自由文本 placeholder。首次运行 `node --test --experimental-strip-types frontend/src/lib/operation-display.test.ts frontend/src/lib/audit-log-production-entry.test.ts` 失败，命中 helper 未导出和页面仍是文本框。
- 修复：`frontend/src/lib/operation-display.ts` 新增 `OperationAuditFilterOption`、`getOperationActionFilterOptions()` 和 `getOperationTargetTypeFilterOptions()`；`frontend/src/app/console/audit-logs/page.tsx` 将动作和对象类型筛选改成中文下拉框，日志表头同步改为“操作类型 / 对象类型”，列表展示继续复用原中文 formatter。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/operation-display.test.ts frontend/src/lib/audit-log-production-entry.test.ts` 通过 6 tests；相邻回归 `node --test --experimental-strip-types frontend/src/lib/operation-display.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-auth.test.ts` 通过 87 tests；`frontend` 下 `& .\node_modules\.bin\tsc --noEmit` 退出码 0；`git diff --check -- frontend/src/app/console/audit-logs/page.tsx frontend/src/lib/operation-display.ts frontend/src/lib/operation-display.test.ts frontend/src/lib/audit-log-production-entry.test.ts` 退出码 0，仅 LF/CRLF warning。
- 浏览器验证：`http://localhost:3000/console/audit-logs` 初次仍显示旧编译产物，确认源码已更新后将 `omni-frontend` 容器内 `/app/.next/dev` 挪到时间戳备份目录并重启容器；重载后可见“全部操作类型 / 全部对象类型”下拉框，选项显示“发布活动 / 更新巡演草稿 / 活动 / 巡演”等中文标签且 value 保留后端码值，浏览器 console warn/error 为空；未执行任何写动作。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端 API；筛选查询仍走只读 `listOperationAuditLogs()`；未提交、未推送。

## 2026-06-12 阶段 13 第七十轮：主办方运营审计风险等级引用中文化

- 目标：继续推进阶段 13“后台中文化与日志列表治理”，清理 `/console/audit-logs` 和 `/console/organizer-ops` 最近操作中历史主办方运营审计显示的 `跟进类型：high / watch` 裸码。
- 范围决策：后端当前主办方分配审计主链路的 `targetRef` 多数是负责人编号，但历史/种子审计里存在 `high/watch` 风险等级值；本轮只在前端 `formatOperationTargetRef()` 识别这些已知风险等级，不改审计写入、不改接口、不改数据库结构。
- RED：扩展 `frontend/src/lib/operation-display.test.ts`，要求 `formatOperationTargetRef('organizer_ops_assignment', 'high', ...)` 返回“风险等级：高风险”，`watch` 返回“风险等级：关注”，负责人编号和 `NOTE` 跟进类型保持原语义。首次运行 `node --test --experimental-strip-types frontend/src/lib/operation-display.test.ts` 失败，命中旧逻辑返回“跟进类型：high”。
- 修复：`frontend/src/lib/operation-display.ts` 新增 `ORGANIZER_OPS_RISK_LEVEL_LABELS` 和 `formatOrganizerOpsRiskLevel()`，`organizer_ops_assignment` 目标引用先识别负责人编号，再识别风险等级，最后才回落到跟进类型。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/operation-display.test.ts` 通过 4 tests；相邻回归 `node --test --experimental-strip-types frontend/src/lib/operation-display.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-auth.test.ts` 通过 87 tests；`frontend` 下 `& .\node_modules\.bin\tsc --noEmit` 退出码 0；`git diff --check -- frontend/src/lib/operation-display.ts frontend/src/lib/operation-display.test.ts` 退出码 0，仅 LF/CRLF warning。
- 浏览器验证：`http://localhost:3000/console/audit-logs` 初次仍显示旧 helper 产物；挪走 `omni-frontend` 容器内 `/app/.next/dev` 并重启容器后重载页面，可见“风险等级：高风险 / 风险等级：关注”，不再出现“跟进类型：high / watch”，浏览器 console warn/error 为空。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端 API；未触发任何写动作；未提交、未推送。

## 2026-06-12 阶段 13 第七十一轮：艺人档案审计对象类型中文化

- 目标：继续推进阶段 13“后台中文化与日志列表治理”，补齐 `/console/audit-logs` 中 `ARTIST_REVIEW` 审计的对象类型显示，避免动作已是“审核艺人档案”但对象类型仍显示“未知对象”。
- 范围决策：本轮只补前端 `operation-display` 对 `artist` targetType 的中文映射，并让对象类型筛选下拉复用该映射；不改后端审计写入、不改接口、不改数据库结构。
- RED：扩展 `frontend/src/lib/operation-display.test.ts`，要求 `formatOperationTargetType('artist')` 返回“艺人档案”，且 `getOperationTargetTypeFilterOptions()` 包含 `{ value: 'artist', label: '艺人档案' }`。首次运行 `node --test --experimental-strip-types frontend/src/lib/operation-display.test.ts` 失败，命中旧逻辑返回“未知对象”且筛选选项缺失。
- 修复：`frontend/src/lib/operation-display.ts` 在 `OPERATION_TARGET_TYPE_LABELS` 中新增 `artist: '艺人档案'`，列表展示和筛选下拉同步复用同一映射。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/operation-display.test.ts` 通过 4 tests；相邻回归 `node --test --experimental-strip-types frontend/src/lib/operation-display.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-auth.test.ts` 通过 87 tests；`frontend` 下 `& .\node_modules\.bin\tsc --noEmit` 退出码 0。
- 浏览器验证：`http://localhost:3000/console/audit-logs` 初次仍渲染旧对象类型下拉，确认 `omni-frontend` 容器内源码已有 `artist: '艺人档案'` 后挪走 `/app/.next/dev` 并重启容器；重载后对象类型下拉可见“艺人档案”，页面不再包含“未知对象”，浏览器 console warn/error 为空。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端 API；未触发任何写动作；未提交、未推送。

## 2026-06-12 阶段 13 第七十二轮：异常任务新建类型下拉中文化覆盖

- 目标：继续推进阶段 13“后台中文化与异常任务队列治理”，让 `/console/exception-tasks` 的“新建异常任务”类型下拉和列表展示共用同一套中文映射，覆盖本地已有历史任务类型。
- 范围决策：本轮只改前端异常任务类型选项来源，不新增后端 API、不改异常任务表结构；下拉显示中文标签，提交给 `createExceptionTask()` 的 `taskType` 仍保留后端码值。
- 本地样本：`omni_user.exception_task` 当前包含 `PAYMENT_TIMEOUT`、`REFUND_UNKNOWN`、`TICKET_ISSUE`、`STOCK_SYNC`、`RISK_REVIEW`、`RECONCILE_DIFF` 等类型，列表 formatter 已能展示中文，但新建下拉此前只列出部分小写类型。
- RED：扩展 `frontend/src/lib/operation-display.test.ts`，要求导出 `getExceptionTaskTypeOptions()`，并包含 `{ value: 'PAYMENT_TIMEOUT', label: '支付超时' }` 和 `{ value: 'refund_failed', label: '退款失败' }`；扩展 `frontend/src/lib/console-production-entry.test.ts`，要求异常任务页接入 `getExceptionTaskTypeOptions()` 并移除硬编码 `taskTypeOptions`。首次运行目标测试失败，命中 helper 未导出且页面仍维护硬编码列表。
- 修复：`frontend/src/lib/operation-display.ts` 新增 `getExceptionTaskTypeOptions()`，复用 `EXCEPTION_TASK_TYPE_LABELS` 构造选项；`frontend/src/app/console/exception-tasks/page.tsx` 的新建任务类型下拉改为使用共享选项。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/operation-display.test.ts frontend/src/lib/console-production-entry.test.ts` 通过 42 tests；相邻回归 `node --test --experimental-strip-types frontend/src/lib/operation-display.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-auth.test.ts` 通过 89 tests；`frontend` 下 `& .\node_modules\.bin\tsc --noEmit` 退出码 0。
- 浏览器验证：`http://localhost:3000/console/exception-tasks` 初次仍渲染旧下拉，确认容器内源码已有 `getExceptionTaskTypeOptions()` 后挪走 `/app/.next/dev` 并重启 `omni-frontend`；重载后新建任务下拉可见“支付超时 / 退款结果未知 / 出票异常”，页面不包含裸 `PAYMENT_TIMEOUT`，浏览器 console warn/error 为空。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端 API；未触发任何写动作；未提交、未推送。

## 2026-06-12 阶段 13 第七十三轮：对账历史码值中文化兼容

- 目标：继续推进阶段 13“后台中文化与对账批次治理”，补齐本地真实对账批次详情里的历史/seed 码值，避免 `/console/reconciliation` 明细和差异区显示“未知业务类型 / 未知对账明细状态 / 未知差异类型”。
- 本地样本：`omni_user` 的 `REAL-DEMO-20260603` 批次包含 `business_type=ORDER/REFUND`、`detail.status=different`、`diff_type=REFUND_AMOUNT_MISMATCH`；这些值此前不在前端共享 formatter 映射内。
- RED：扩展 `frontend/src/lib/operation-display.test.ts`，要求 `formatReconciliationBusinessType('ORDER')` 显示“订单”、`REFUND` 显示“退款”、`formatReconciliationDetailStatus('different')` 显示“存在差异”、`formatReconciliationDiffType('REFUND_AMOUNT_MISMATCH')` 显示“退款金额不一致”。首次运行 `node --test --experimental-strip-types frontend/src/lib/operation-display.test.ts` 失败，命中 `different` 返回“未知对账明细状态”。
- 修复：`frontend/src/lib/operation-display.ts` 新增对账历史码值映射，并让对账批次状态、明细状态、差异状态、来源、业务类型和差异类型 formatter 兼容大小写码值；页面和 CSV/Excel 导出继续复用同一套 formatter。
- 验证：目标测试先失败后通过；相邻回归 `node --test --experimental-strip-types frontend/src/lib/operation-display.test.ts frontend/src/lib/console-reconciliation.test.ts frontend/src/lib/reconciliation-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-auth.test.ts` 通过 92 tests；`frontend` 下 `& .\node_modules\.bin\tsc --noEmit` 退出码 0。`pnpm --dir frontend typecheck` 本轮未进入项目类型检查，失败于本机全局 pnpm shim 缺失 `C:\Program Files\nodejs\node_modules\pnpm\bin\pnpm.mjs`，已改用项目本地 `tsc` 验证。
- 浏览器验证：`http://localhost:3000/console/reconciliation` 打开 `REAL-DEMO-20260603` 批次详情，初次仍显示旧 bundle 的未知文案；挪走 `omni-frontend` 容器内 `/app/.next/dev` 并重启容器后重载，页面不再包含 `ORDER`、`REFUND`、`different`、`REFUND_AMOUNT_MISMATCH`，也不再包含“未知业务类型 / 未知对账明细状态 / 未知差异类型”，可见“订单 / 存在差异 / 退款金额不一致”，浏览器 console warn/error 为空。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端 API；未触发任何写动作；未提交、未推送。

## 2026-06-12 阶段 13 第七十四轮：对账摘要中文字段展示

- 目标：继续推进阶段 13“后台中文化与对账批次治理”，修正 `/console/reconciliation` 批次列表把新生成对账摘要里的中文 key 误显示成“其他指标”的问题。
- 本地样本：`omni_user.reconciliation_batch` 中 `REC20260605-927F34BA` 的 `summary_json` 为 `业务日期`、`支付笔数`、`支付金额`、`退款笔数`、`退款金额`、`净额`、`差异数` 等中文 key；历史 seed `REAL-DEMO-20260603` 仍使用 `paidOrderCount/refundAbnormalCount/diffCount` 英文 key。
- RED：扩展 `frontend/src/lib/operation-display.test.ts`，要求 `formatReconciliationSummaryKey('业务日期')`、`支付笔数`、`支付金额`、`退款笔数`、`退款金额`、`净额`、`差异数` 分别返回对应中文标签。首次运行 `node --test --experimental-strip-types frontend/src/lib/operation-display.test.ts` 失败，命中 `业务日期` 返回“其他指标”。
- 修复：`frontend/src/lib/operation-display.ts` 在 `RECONCILIATION_SUMMARY_KEY_LABELS` 中补齐中文 summary key；英文历史 key 继续保持已有映射，未知 key 仍显示“其他指标”。
- 浏览器验证：`http://localhost:3000/console/reconciliation` 初次重载仍显示旧 bundle 的“其他指标”；挪走 `omni-frontend` 容器内 `/app/.next/dev` 并重启容器后重载，`REC20260605-927F34BA` 摘要显示“业务日期：2026-06-05，支付笔数：2，支付金额：900.00，退款笔数：0，退款金额：0.00，净额：900.00”，浏览器 console warn/error 为空。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端 API；未触发任何写动作；未提交、未推送。

## 2026-06-12 阶段 13 第七十五轮：站点配置审核状态中文化与操作保护

- 目标：继续推进阶段 13“后台中文化与站点变更审核治理”，让 `/console/station-config-reviews` 不只展示中文变更类型，也展示中文配置状态，并避免未来或非待审核状态误开放通过/驳回写动作。
- 本地样本：`omni_ticket_split.station_config_version` 当前状态包含 `draft`、`submitted`、`approved`、`rejected`、`applied`；审核页当前列表只拉取 `submitted`，但此前没有共享状态 formatter，也没有非待审核状态保护。
- RED：扩展 `frontend/src/lib/operation-display.test.ts`，要求 `formatStationConfigStatus()` 映射 `draft/submitted/approved/applied/rejected/withdrawn` 并让 `isReviewableStationConfigStatus('submitted')` 返回 true；扩展 `frontend/src/lib/console-production-entry.test.ts`，要求站点审核页接入状态 formatter、可审核状态判断和“状态待核对”。首次运行目标测试失败，命中 `formatStationConfigStatus` 未导出且页面未接入状态列。
- 修复：`frontend/src/lib/operation-display.ts` 新增 `STATION_CONFIG_STATUS_LABELS`、`formatStationConfigStatus()` 和 `isReviewableStationConfigStatus()`；`frontend/src/app/console/station-config-reviews/page.tsx` 增加“状态”列，`submitted` 显示“待审核”，非待审核状态显示“状态待核对”，事件入口也会阻断通过/驳回。
- 验证：目标测试先失败后通过；相邻回归 `node --test --experimental-strip-types frontend/src/lib/operation-display.test.ts frontend/src/lib/console-reconciliation.test.ts frontend/src/lib/reconciliation-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-auth.test.ts` 通过 93 tests；`frontend` 下 `& .\node_modules\.bin\tsc --noEmit` 退出码 0；`git diff --check -- frontend/src/lib/operation-display.ts frontend/src/lib/operation-display.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/app/console/station-config-reviews/page.tsx` 退出码 0，仅 LF/CRLF warning。
- 浏览器验证：`http://localhost:3000/console/station-config-reviews` 初次仍显示旧 bundle 且表头缺少“状态”；挪走 `omni-frontend` 容器内 `/app/.next/dev` 并重启容器后重载，表头显示“状态”，行内显示“待审核”，页面主区域不包含裸 `draft/submitted/approved/rejected/applied/withdrawn`，浏览器 console warn/error 为空。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端 API；浏览器验证未触发通过/驳回写动作；未提交、未推送。

## 2026-06-12 阶段 13 第七十六轮：异常任务队列状态操作区兜底

- 目标：继续推进阶段 13“后台中文化与异常任务队列治理”，避免 `/console/exception-tasks` 对未来或未知异常任务状态静默显示空操作区，或把未知状态计入待处理/高优先级任务。
- 本地样本：当前异常任务页真实样本包含 `pending` 和 `resolved`，列表已有中文状态 formatter；缺口在于操作区此前直接用 `item.status === 'pending' / 'processing' / 'resolved' / 'closed'` 分支，未知状态会没有任何中文提示，统计也会把非 `resolved/closed` 的未知状态算作待处理。
- RED：扩展 `frontend/src/lib/operation-display.test.ts`，要求导出 `isOpenExceptionStatus()`、`isClaimableExceptionStatus()`、`isResolvableExceptionStatus()` 和 `isClosableExceptionStatus()`；扩展 `frontend/src/lib/console-production-entry.test.ts`，要求异常任务页接入这些共享 guard、显示“状态待核对”，并移除散落的原始状态比较。首次运行目标测试失败，命中 helper 未导出且页面仍使用原始状态分支。
- 修复：`frontend/src/lib/operation-display.ts` 新增异常任务状态 guard；`frontend/src/app/console/exception-tasks/page.tsx` 的待处理/高优先级统计改为只统计 `pending/processing`，认领、标记已处理、关闭按钮和事件入口统一复用共享 guard，未知状态显示“状态待核对”并返回“任务状态待核对，请刷新后再操作”。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/operation-display.test.ts frontend/src/lib/console-production-entry.test.ts` 通过 44 tests；相邻回归 `node --test --experimental-strip-types frontend/src/lib/operation-display.test.ts frontend/src/lib/console-reconciliation.test.ts frontend/src/lib/reconciliation-production-entry.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-auth.test.ts` 通过 94 tests；`frontend` 下 `& .\node_modules\.bin\tsc --noEmit` 退出码 0；`git diff --check -- frontend/src/app/console/exception-tasks/page.tsx frontend/src/lib/operation-display.ts frontend/src/lib/operation-display.test.ts frontend/src/lib/console-production-entry.test.ts` 退出码 0，仅 LF/CRLF warning。
- 浏览器验证：`http://localhost:3000/console/exception-tasks` 现有样本正常显示待处理任务 5、高优先级 3、任务队列 6 条，`pending` 行可见“认领 / 关闭”，`resolved` 行可见“已结束”，浏览器 console warn/error 为空；当前本地样本没有未知状态，另通过 `.next/dev` 当前 chunk 确认已包含“状态待核对”保护文案。验证过程中未点击认领、关闭或处理写动作。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端 API；未触发任何异常任务写动作；未提交、未推送。

## 2026-06-12 阶段 13 第七十七轮：评价举报未知状态操作保护

- 目标：继续推进阶段 13“后台中文化与评价问答治理”，补齐 `/console/activity-engagement` 中评价举报 tab 的未知状态操作区，避免未来举报状态只显示中文“未知举报状态”但操作区静默为空。
- 本地样本：当前真实页面的举报样本为 `PENDING`，可显示“确认并隐藏评价 / 驳回举报”；此前评价和问答未知状态已有“状态待核对”，但举报仍直接使用 `report.status === 'PENDING'` 分支，事件入口也只接收 `reportId`，没有状态 guard。
- RED：扩展 `frontend/src/lib/activity-engagement-production-entry.test.ts`，要求举报 moderation 接入 `isKnownReportStatus()`、`canResolveReport()`、`canRejectReport()`，显示“状态待核对”，并包含“举报状态待核对，请刷新后再操作”入口拦截文案。首次运行目标测试失败，命中页面仍存在 `report.status === 'PENDING'`。
- 修复：`frontend/src/app/console/activity-engagement/page.tsx` 新增举报状态 known/action helper；举报处理和驳回按钮改为走 `canResolveReport()` / `canRejectReport()`；未知举报状态显示“状态待核对”；`handleReportAction()` 改为接收完整 report，在状态不可操作时直接弹出“举报状态待核对，请刷新后再操作”。
- 验证：目标测试先失败后通过；`node --test --experimental-strip-types frontend/src/lib/activity-engagement-production-entry.test.ts` 通过 5 tests；相邻回归 `node --test --experimental-strip-types frontend/src/lib/activity-engagement-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-auth.test.ts frontend/src/lib/operation-display.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/console-reconciliation.test.ts frontend/src/lib/reconciliation-production-entry.test.ts` 通过 99 tests；`frontend` 下 `& .\node_modules\.bin\tsc --noEmit` 退出码 0；`git diff --check -- frontend/src/app/console/activity-engagement/page.tsx frontend/src/lib/activity-engagement-production-entry.test.ts frontend/src/app/console/exception-tasks/page.tsx frontend/src/lib/operation-display.ts frontend/src/lib/operation-display.test.ts frontend/src/lib/console-production-entry.test.ts` 退出码 0，仅 LF/CRLF warning。
- 浏览器验证：`http://localhost:3000/console/activity-engagement` 初次因旧 `.next/dev` 产物未包含新拦截文案，挪走 `omni-frontend` 容器内 `/app/.next/dev` 并重启容器；重载后切到“评价举报”tab，可见真实 `PENDING` 举报显示中文状态、评价编号/活动编号/举报用户编号和“确认并隐藏评价 / 驳回举报”，页面不包含裸 `PENDING/RESOLVED/REJECTED`，浏览器 console warn/error 为空；当前 chunk 已包含“举报状态待核对”文案。验证过程中未点击处理/驳回写动作。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端 API；未触发任何评价举报写动作；未提交、未推送。

## 2026-06-12 阶段 13 第七十八轮：场馆资料审核未知状态操作保护
- 目标：继续推进阶段 13“后台中文化与场馆审核治理”，补齐 `/console/venue/applications` 中场馆资料审核未知状态的操作区保护，避免未来状态只显示“未知场馆审核状态”但审核入口和提交入口缺少 guard。
- 本地样本：当前场馆资料审核页真实样本包含 `待审核` 记录，已能显示中文状态；缺口在于操作区此前直接使用 `item.status === 0` 暴露审核按钮，`openReview()` 只接收 `id`，通过/驳回提交前没有基于当前记录状态二次检查。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，要求页面移除旧的 `item.status === 0 && <button onClick={() => openReview(item.id)}` 分支，接入 `isKnownVenueApplicationStatus()`、`isReviewableVenueApplicationStatus()`，显示“状态待核对”，并包含“场馆审核状态待核对，请刷新后再操作”拦截文案。首次运行目标测试失败，命中旧的审核按钮分支。
- 修复：`frontend/src/app/console/venue/applications/page.tsx` 新增场馆审核状态 known/reviewable helper；`openReview()` 改为接收完整申请记录，非可审核状态直接提示“场馆审核状态待核对，请刷新后再操作”；`handleApprove()` 和 `handleReject()` 提交前通过 `confirmReviewableStatus()` 再次校验当前记录状态；未知状态操作区显示“状态待核对”。
- 验证：目标测试先失败后通过，最终 `node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts` 通过 40 tests；相邻回归 `node --test --experimental-strip-types frontend/src/lib/activity-engagement-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-auth.test.ts frontend/src/lib/operation-display.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/console-reconciliation.test.ts frontend/src/lib/reconciliation-production-entry.test.ts` 通过 100 tests；`frontend` 中 `& .\node_modules\.bin\tsc --noEmit` 退出码 0。
- 浏览器验证：`http://localhost:3000/console/venue/applications` 初次因旧 `.next/dev` 产物未包含新拦截文案，挪走 `omni-frontend` 容器内 `/app/.next/dev` 并重启容器；重载后可见真实 `待审核` 场馆资料显示中文状态和“审核”入口，浏览器 console warn/error 为空；当前客户端与 SSR chunk 均包含 `isKnownVenueApplicationStatus`、`isReviewableVenueApplicationStatus` 和“场馆审核状态待核对”文案。验证过程中未点击审核、通过或驳回写动作。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端 API；未触发任何场馆审核写动作；未提交、未推送。

## 2026-06-12 阶段 13 第七十九轮：主办方入驻审核未知状态操作保护
- 目标：继续推进阶段 13“后台中文化与主办方入驻治理”，补齐 `/console/organizer-applications` 中入驻申请未知状态的审核操作保护，避免未来状态虽然显示“未知入驻状态”，但通过/驳回入口仍只靠按钮禁用表达。
- 本地样本：当前主办方管理页真实样本包含 `待审核`、`已通过` 和 `已驳回` 记录；缺口在于通过/驳回按钮此前直接用 `item.status !== 0` 禁用，事件入口只接收 `id`，没有基于完整申请记录的状态 guard。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，要求主办方入驻审核页移除 `handleApprove(item.id)` / `handleReject(item.id)` 和 `item.status !== 0` 按钮分支，接入 `isKnownOrganizerApplicationStatus()`、`isReviewableOrganizerApplicationStatus()`，显示“状态待核对”，并包含“入驻审核状态待核对，请刷新后再操作”。首次运行目标测试失败，命中旧的按钮事件入口。
- 修复：`frontend/src/app/console/organizer-applications/page.tsx` 新增入驻申请状态 known/reviewable helper；通过/驳回事件改为接收完整 `OrganizerApplicationVO`，非 `status=0` 状态直接提示“入驻审核状态待核对，请刷新后再操作”；未知状态操作区显示“状态待核对”，已知待审核记录继续保留通过/驳回语义。
- 验证：目标测试先失败后通过，最终 `node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts` 通过 41 tests；相邻回归 `node --test --experimental-strip-types frontend/src/lib/activity-engagement-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-auth.test.ts frontend/src/lib/operation-display.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/console-reconciliation.test.ts frontend/src/lib/reconciliation-production-entry.test.ts` 通过 101 tests；`frontend` 中 `& .\node_modules\.bin\tsc --noEmit` 退出码 0。
- 浏览器验证：`http://localhost:3000/console/organizer-applications` 初次因旧 `.next/dev` 产物未包含新拦截文案，挪走 `omni-frontend` 容器内 `/app/.next/dev` 并重启容器；重载后可见真实入驻申请列表、中文状态、通过/驳回/取消主办方入口，浏览器页面 console warn/error 为空；当前客户端与 SSR chunk 均包含 `isKnownOrganizerApplicationStatus`、`isReviewableOrganizerApplicationStatus` 和“入驻审核状态待核对”文案。验证过程中未点击通过、驳回或取消主办方写动作。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端 API；未触发任何主办方入驻审核写动作；未提交、未推送。

## 2026-06-12 阶段 13 第八十轮：恢复售票审核未知状态操作保护
- 目标：继续推进阶段 13“后台中文化与恢复售票审核治理”，补齐 `/console/risk-resolutions` 中恢复售票审核未知状态的写动作保护，避免未来状态虽然显示“未知审核状态”，但通过/拒绝入口仍只靠 `pending` 分支排除。
- 本地样本：当前恢复售票审核页真实样本包含 `待审核` 记录，可显示“通过恢复 / 拒绝”；缺口在于操作区此前直接用 `item.status === 'pending'` 暴露写动作，`review()` 只接收申请 `id`，没有基于完整申请记录的状态 guard。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，要求恢复售票审核页移除 `const editable = item.status === 'pending'` 和 `review(item.id, ...)` 旧入口，接入 `isKnownRiskResolutionStatus()`、`isReviewableRiskResolutionStatus()`，显示“状态待核对”，并包含“恢复售票审核状态待核对，请刷新后再操作”。首次运行目标测试失败，命中旧 `editable` 分支。
- 修复：`frontend/src/app/console/risk-resolutions/page.tsx` 新增恢复售票审核状态 known/reviewable helper；`review()` 改为接收完整 `ActivityRiskResolutionVO`，非 `pending` 状态直接提示“恢复售票审核状态待核对，请刷新后再操作”；未知状态操作区显示“状态待核对”，已知 `approved/rejected` 继续显示“历史记录仅供查看。”。
- 验证：目标测试先失败后通过，最终 `node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts` 通过 42 tests；相邻回归 `node --test --experimental-strip-types frontend/src/lib/activity-engagement-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-auth.test.ts frontend/src/lib/operation-display.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/console-reconciliation.test.ts frontend/src/lib/reconciliation-production-entry.test.ts` 通过 102 tests；`frontend` 中 `& .\node_modules\.bin\tsc --noEmit` 退出码 0。
- 浏览器验证：`http://localhost:3000/console/risk-resolutions` 真实列表正常渲染，当前样本为已知 `待审核` 状态并显示“通过恢复 / 拒绝”，浏览器 console warn/error 为空；初次容器 chunk 未命中新 helper，挪走 `omni-frontend` 容器内 `/app/.next/dev` 并重启容器后复测，当前 chunk 已包含 `isKnownRiskResolutionStatus`、`isReviewableRiskResolutionStatus` 和“恢复售票审核状态待核对”文案。验证过程中未点击通过恢复或拒绝写动作。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端 API；未触发任何恢复售票审核写动作；未提交、未推送。

## 2026-06-12 阶段 13 第八十一轮：取消主办方未知主办方状态操作保护
- 目标：继续推进阶段 13“后台中文化与主办方状态治理”，补齐 `/console/organizer-applications` 中“取消主办方”的主办方账号状态保护，避免未来 `organizerStatus` 虽然显示“未知主办方状态”，但仍因入驻申请已通过而开放取消入口。
- 本地样本：当前主办方管理页真实样本包含 `认证待审核`、`认证已拒绝`、`主办方有效`、`已取消主办方` 等已知主办方状态；缺口在于取消入口此前只用 `item.status !== 1 || isCancelled` 禁用，`isCancelled` 只判断 `organizerStatus=3` 或 `role=user`。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，要求页面移除旧 `isCancelled` 和旧 disabled 条件，接入 `isKnownOrganizerStatus()`、`canDeactivateOrganizerAccount()`，并包含“主办方状态待核对，请刷新后再操作”。首次运行目标测试失败，命中旧 `const isCancelled = item.organizerStatus === 3 || item.role === 'user'`。
- 修复：`frontend/src/app/console/organizer-applications/page.tsx` 新增主办方账号状态 known/cancel helper；`handleDeactivate()` 在确认弹窗前二次检查，只有入驻已通过且 `organizerStatus=1` 且未降级为普通用户时才允许取消；未知主办方状态返回“主办方状态待核对，请刷新后再操作”，已知但不可取消状态返回“当前主办方状态不能取消”；未知状态操作区显示“状态待核对”。
- 验证：目标测试先失败后通过，最终 `node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts` 通过 43 tests；相邻回归 `node --test --experimental-strip-types frontend/src/lib/activity-engagement-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-auth.test.ts frontend/src/lib/operation-display.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/console-reconciliation.test.ts frontend/src/lib/reconciliation-production-entry.test.ts` 通过 103 tests；`frontend` 中 `& .\node_modules\.bin\tsc --noEmit` 退出码 0。
- 浏览器验证：`http://localhost:3000/console/organizer-applications` 真实列表正常渲染，当前样本展示已知主办方状态和取消入口，浏览器 console warn/error 为空；初次容器 chunk 未命中新 helper，挪走 `omni-frontend` 容器内 `/app/.next/dev` 并重启容器后复测，当前 chunk 已包含 `isKnownOrganizerStatus`、`canDeactivateOrganizerAccount` 和“主办方状态待核对”文案。验证过程中未点击取消主办方、通过或驳回写动作。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端 API；未触发任何取消主办方、入驻审核或退款写动作；未提交、未推送。

## 2026-06-12 阶段 13 第八十二轮：对账差异未知状态操作保护
- 目标：继续推进阶段 13“后台中文化与对账差异治理”，补齐 `/console/reconciliation` 中对账差异未知状态的操作区与事件入口保护，避免未来状态虽然显示“未知对账差异状态”，但操作列仍落到“已结束”或只靠 `diff.status === 'open'` 判断。
- 本地样本：当前对账详情页真实差异样本为已知状态；缺口在于差异操作列此前把非 `open` 状态统一显示为“已结束”，`handleDifferenceAction()` 只接收差异编号，没有基于完整 `ReconciliationDifferenceVO` 复核状态。
- RED：扩展 `frontend/src/lib/operation-display.test.ts` 和 `frontend/src/lib/console-production-entry.test.ts`，要求导出并覆盖 `isKnownReconciliationDifferenceStatus()`、`isOpenReconciliationDifferenceStatus()`，页面移除旧 `diff.status === 'open'` 分支，显示“状态待核对”，并包含“对账差异状态待核对，请刷新后再操作”。首次运行目标测试失败，命中 helper 未导出和旧页面分支。
- 修复：`frontend/src/lib/operation-display.ts` 新增对账差异状态 known/open helper；`frontend/src/app/console/reconciliation/page.tsx` 将 `handleDifferenceAction()` 改为接收完整差异记录，只有 `open` 可标记已处理或忽略，未知或未来状态直接提示“对账差异状态待核对，请刷新后再操作”；操作列对未知状态显示“状态待核对”，已知 `resolved/ignored` 继续显示“已结束”。
- 验证：目标测试先失败后通过，最终 `node --test --experimental-strip-types frontend/src/lib/operation-display.test.ts frontend/src/lib/console-production-entry.test.ts` 通过 49 tests；相邻回归 `node --test --experimental-strip-types frontend/src/lib/activity-engagement-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-auth.test.ts frontend/src/lib/operation-display.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/console-reconciliation.test.ts frontend/src/lib/reconciliation-production-entry.test.ts` 通过 104 tests；`frontend` 中 `& .\node_modules\.bin\tsc --noEmit` 退出码 0；`git diff --check` 退出码 0，仅 LF/CRLF warning。
- 浏览器验证：`http://localhost:3000/console/reconciliation` 打开真实对账详情正常，差异列表可渲染，浏览器 console warn/error 为空；初次容器 chunk 未命中新 helper，挪走 `omni-frontend` 容器内 `/app/.next/dev` 并重启容器后复测，当前 chunk 已包含 `isKnownReconciliationDifferenceStatus`、`isOpenReconciliationDifferenceStatus` 和“对账差异状态待核对”文案。验证过程中未点击标记已处理或忽略写动作。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端 API；未触发任何对账差异写动作；未提交、未推送。

## 2026-06-12 阶段 13 第八十三轮：艺人档案审核未知状态操作保护
- 目标：继续推进阶段 13“后台中文化与艺人档案治理”，补齐 `/console/artists/pending` 中艺人审核未知状态的操作保护，避免待审核接口返回未来状态时仍直接开放通过、拒绝或标记风险写动作。
- 本地样本：当前艺人档案审核页真实样本为已知 `待审核` 状态，并展示通过/拒绝/标记风险入口；缺口在于页面此前不展示 `reviewStatus`，`review()` 和 `markRisk()` 只接收 `artistId`，没有在事件入口基于完整 `ArtistEntity` 复核审核状态。
- RED：扩展 `frontend/src/lib/console-artists.test.ts` 和 `frontend/src/lib/console-production-entry.test.ts`，要求 `console-artists` 导出 `isKnownArtistReviewStatus()`、`isReviewableArtistReviewStatus()`，页面移除 `review(item.id, ...)` 和 `markRisk(item.id)` 旧入口，显示“状态待核对”，并包含“艺人审核状态待核对，请刷新后再操作”。首次运行目标测试失败，命中 helper 未导出和旧事件入口。
- 修复：`frontend/src/lib/console-artists.ts` 新增艺人审核状态 known/reviewable helper；`frontend/src/app/console/artists/pending/page.tsx` 将通过、拒绝和标记风险入口改为接收完整 `ArtistEntity`，只有 `reviewStatus='pending'` 可写，未知或未来状态直接提示“艺人审核状态待核对，请刷新后再操作”；列表增加“审核状态：待审核”中文展示，未知状态操作区显示“状态待核对”，已知非待审核状态显示“已结束”。
- 验证：目标测试先失败后通过，最终 `node --test --experimental-strip-types frontend/src/lib/console-artists.test.ts frontend/src/lib/console-production-entry.test.ts` 通过 48 tests；相邻回归 `node --test --experimental-strip-types frontend/src/lib/console-artists.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-auth.test.ts frontend/src/lib/operation-display.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/activity-engagement-production-entry.test.ts frontend/src/lib/reconciliation-production-entry.test.ts frontend/src/lib/console-reconciliation.test.ts` 通过 108 tests；`frontend` 中 `& .\node_modules\.bin\tsc --noEmit` 退出码 0；范围内 `git diff --check` 退出码 0，仅 LF/CRLF warning。
- 浏览器验证：`http://localhost:3000/console/artists/pending` 真实列表正常渲染，当前样本显示“审核状态：待审核”和通过/拒绝/标记风险入口，浏览器 console warn/error 为空；初次页面渲染仍使用旧 `.next/dev` 产物，确认容器源码包含新代码后挪走 `/app/.next/dev` 并重启 `omni-frontend`，复测后实际加载 chunk 包含 `isKnownArtistReviewStatus`、`isReviewableArtistReviewStatus` 和“艺人审核状态待核对”文案。验证过程中未点击通过、拒绝或标记风险写动作。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端 API；未触发任何艺人审核或风险写动作；未提交、未推送。

## 2026-06-12 阶段 13 第八十四轮：评价问答审核事件入口状态保护
- 目标：继续推进阶段 13“后台中文化与评价问答治理”，补齐 `/console/activity-engagement` 中评价审核和购前问答事件入口的状态二次保护，避免只靠按钮显隐保护 moderation 写动作。
- 本地样本：当前评价问答页真实样本为已知 `待审核` 评价，可显示“通过 / 隐藏”；缺口在于 `handleReviewAction()` 和 `handleQuestionAction()` 此前只接收编号，`handleQuestionAnswer()` 也没有在入口先复核 `canAnswerQuestion(question.status)`。
- RED：扩展 `frontend/src/lib/activity-engagement-production-entry.test.ts`，要求页面移除 `handleReviewAction(review.id, ...)`、`handleQuestionAction(question.id, ...)` 旧入口，并包含“评价状态待核对，请刷新后再操作”和“问答状态待核对，请刷新后再操作”。首次运行目标测试失败，命中旧的评价和问答事件入口。
- 修复：`frontend/src/app/console/activity-engagement/page.tsx` 将 `handleReviewAction()` 改为接收完整 `ActivityReviewVO`，按 `APPROVE/HIDE/RESTORE` 分别复用 `canApproveReview()`、`canHideReview()`、`canRestoreReview()`；`handleQuestionAnswer()` 和 `handleQuestionAction()` 在调用写接口前复用问答状态 guard，未知或未来状态直接返回中文待核对提示；按钮事件改为传完整 review/question。
- 验证：目标测试先失败后通过，最终 `node --test --experimental-strip-types frontend/src/lib/activity-engagement-production-entry.test.ts` 通过 5 tests；相邻回归 `node --test --experimental-strip-types frontend/src/lib/activity-engagement-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-auth.test.ts frontend/src/lib/operation-display.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/console-reconciliation.test.ts frontend/src/lib/reconciliation-production-entry.test.ts` 通过 105 tests；`frontend` 中 `& .\node_modules\.bin\tsc --noEmit` 退出码 0；`git diff --check` 退出码 0，仅 LF/CRLF warning。
- 浏览器验证：`http://localhost:3000/console/activity-engagement` 真实页面正常渲染，可见“评价问答管理”、评价审核/评价举报/购前问答 tab、待审核评价和“通过 / 隐藏”入口，浏览器 console warn/error 为空；重启 `omni-frontend` 后复测，当前客户端 chunk 已包含 `handleReviewAction(review, ...)`、`handleQuestionAction(question, ...)`、“评价状态待核对”和“问答状态待核对”文案。验证过程中未点击通过、隐藏、恢复或保存回复写动作。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端 API；未触发任何评价或问答 moderation 写动作；未提交、未推送。

## 2026-06-12 阶段 13 第八十五轮：平台主办方运营员账号未知状态编辑/启停保护
- 目标：继续推进阶段 13“后台中文化与平台主办方运营账号治理”，补齐 `/console/organizer-admins` 中未知账号状态的编辑和启停入口保护，避免未来状态携带进编辑保存或被 UI 图标误解释为可启用。
- 本地样本：当前平台主办方运营员账号页真实样本为已知 `启用中` 状态，可显示“编辑 / 停用 / 删除”；缺口在于 `startEdit()` 此前不校验账号状态，`toggleStatus()` 旧拦截文案为“账号状态未知，请先核对后再操作”，未知状态按钮图标会落到 `<Check />`。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，要求页面接入 `isKnownOrganizerAdminAccountStatus()`，未知状态入口包含“账号状态待核对，请刷新后再操作”，移除旧“账号状态未知，请先核对后再操作”，并不再使用 `account.status === 1 ? <ShieldOff ... : <Check ...` 图标分支。首次运行目标测试失败，命中 helper 缺失和旧入口。
- 修复：`frontend/src/app/console/organizer-admins/page.tsx` 新增 `isKnownOrganizerAdminAccountStatus()`、`isEnabledOrganizerAdminAccountStatus()`，`canToggleOrganizerAdminAccountStatus()` 复用 known helper；`startEdit()` 在未知状态下直接返回“账号状态待核对，请刷新后再操作”，`toggleStatus()` 使用同一待核对文案，未知状态图标改为 `<X />`，已知启用/停用继续保留原动作语义。
- 验证：目标测试先失败后通过，最终 `node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts` 通过 46 tests；相邻回归 `node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-auth.test.ts frontend/src/lib/operation-display.test.ts frontend/src/lib/activity-engagement-production-entry.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/console-reconciliation.test.ts frontend/src/lib/reconciliation-production-entry.test.ts` 通过 106 tests；`frontend` 中 `& .\node_modules\.bin\tsc --noEmit` 退出码 0；`git diff --check` 退出码 0，仅 LF/CRLF warning。
- 浏览器验证：`http://localhost:3000/console/organizer-admins` 真实页面正常渲染，可见“平台主办方运营员账号管理”、新建账号、账号列表、已知 `启用中` 状态和“编辑 / 停用 / 删除”入口，浏览器页面 console warn/error 为空；重启 `omni-frontend` 后复测，当前客户端 chunk 已包含 `isKnownOrganizerAdminAccountStatus` 和“账号状态待核对”文案。验证过程中未点击编辑、停用、删除或创建写动作。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端 API；未触发任何平台主办方运营员账号写动作；未提交、未推送。

## 2026-06-13 阶段 13 第八十六轮：客服账号未知状态编辑/启停保护
- 目标：继续推进阶段 13“后台中文化与客服账号治理”，补齐 `/console/support-accounts` 中未知账号状态的编辑和启停入口保护，避免未来状态携带进编辑保存或被 UI 图标误解释为可启用。
- 本地样本：当前客服账号页真实样本为已知状态，可显示“编辑 / 停用 / 删除”；缺口在于 `startEdit()` 此前不校验客服账号状态，`toggleStatus()` 旧拦截文案为“账号状态未知，请先核对后再操作”，未知状态按钮图标会落到 `<Check />`。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，要求页面接入 `isKnownSupportAccountStatus()`，未知状态入口包含“账号状态待核对，请刷新后再操作”，移除旧“账号状态未知，请先核对后再操作”，并不再使用 `account.status === 1 ? <ShieldOff ... : <Check ...` 和旧 disabled 分支。首次运行目标测试失败，命中 helper 缺失和旧入口。
- 修复：`frontend/src/app/console/support-accounts/page.tsx` 新增 `isKnownSupportAccountStatus()`、`isEnabledSupportAccountStatus()`，`canToggleSupportAccountStatus()` 复用 known helper；`startEdit()` 在未知状态下直接返回“账号状态待核对，请刷新后再操作”，`toggleStatus()` 使用同一待核对文案，未知状态图标改为 `<X />`，已知启用/停用继续保留原动作语义。
- 验证：目标测试先失败后通过，最终 `node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts` 通过 48 tests；相邻回归 `node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-auth.test.ts frontend/src/lib/operation-display.test.ts frontend/src/lib/activity-engagement-production-entry.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/console-reconciliation.test.ts frontend/src/lib/reconciliation-production-entry.test.ts` 通过 108 tests；`frontend` 中 `& .\node_modules\.bin\tsc --noEmit` 退出码 0；`git diff --check` 退出码 0，仅 LF/CRLF warning。
- 运行产物验证：`curl.exe -s -m 30 -o NUL -w "%{http_code}" http://127.0.0.1:3000/console/support-accounts` 返回 200；容器内请求同一路径返回 200；当前页面引用的 support chunk 包含 `isKnownSupportAccountStatus` 和“账号状态待核对”，且不包含旧“账号状态未知，请先核对”文案。初次浏览器验收发现 Next dev 对 `127.0.0.1` 的 HMR origin 拦截，日志给出 `Blocked cross-origin request to Next.js dev resource /_next/webpack-hmr from "127.0.0.1"`；已在 `next.config.ts` 补 `allowedDevOrigins: ['127.0.0.1']` 并新增静态回归测试，重启 `omni-frontend` 后复测 WebSocket 可连接。
- 浏览器验证：使用客服主管账号 `13910000002` 本地登录态打开 `http://127.0.0.1:3000/console/support-accounts`，页面正常渲染，可见“客服管理后台”“客服账号管理”“新建人工客服”“人工客服列表”，API `GET /api/user/support/admin/accounts` 返回 200，浏览器 console error/warning 为 0。验证过程中未点击编辑、停用、删除或创建写动作。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端 API；除 Next dev 本地 HMR origin 配置外，只改前端页面和测试；未触发任何客服账号写动作；未提交、未推送。

## 2026-06-13 阶段 13 第八十七轮：退款审核单条审核状态二次保护
- 目标：继续推进阶段 13“后台中文化与退款审核治理”，补齐 `/console/refunds` 单条同意/重试和拒绝入口的当前状态二次保护，避免只靠按钮显示和弹窗打开时状态判断保护资金相关写动作。
- 本地样本：当前退款审核页已有未知状态展示、独立待核对样式和批量处理状态过滤；缺口在于单条审核 draft 只保存 `id/action/note`，提交备注前没有基于当前 `refunds` 列表记录复核状态。
- RED：扩展 `frontend/src/lib/console-refunds.test.ts` 和 `frontend/src/lib/refunds-production-entry.test.ts`，要求导出 `canApplyConsoleRefundReviewAction()`，页面接入该 helper，提交前通过 `refunds.find(refund => refund.id === draft.id)` 复核，并包含“退款状态待核对，请刷新后再操作”。首次运行目标测试失败，命中 helper 未导出和旧 `startReview(refund.id, ...)` 入口。
- 修复：`frontend/src/lib/console-refunds.ts` 新增动作级退款审核状态 helper；`frontend/src/app/console/refunds/page.tsx` 将 `startReview()` 改为接收完整 `RefundRequestVO`，打开弹窗前复核状态；`submitReview()` 提交前按当前记录和 action 再次复核，状态不匹配或记录不存在时关闭 draft 并阻断写接口。
- 验证：目标测试先失败后通过，最终 `node --test --experimental-strip-types frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts` 通过 11 tests；相邻回归 `node --test --experimental-strip-types frontend/src/lib/console-refunds.test.ts frontend/src/lib/refunds-production-entry.test.ts frontend/src/lib/refund-flow.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-auth.test.ts frontend/src/lib/operation-display.test.ts frontend/src/lib/activity-engagement-production-entry.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/console-reconciliation.test.ts frontend/src/lib/reconciliation-production-entry.test.ts` 通过 123 tests；`frontend` 下 `& .\node_modules\.bin\tsc --noEmit` 退出码 0；`git diff --check` 退出码 0，仅 LF/CRLF warning。
- HMR 验证：用户再次看到 `ws://127.0.0.1:3000/_next/webpack-hmr` 握手错误后，复查 `omni-frontend` 日志确认历史根因为 `Blocked cross-origin request to Next.js dev resource /_next/webpack-hmr from "127.0.0.1"`；当前 `next.config.ts` 已含 `allowedDevOrigins: ['127.0.0.1']`，带 WebSocket upgrade 头请求 `/_next/webpack-hmr?id=probe` 返回 `101 Switching Protocols`，浏览器重新打开退款页 2 秒内 console error/warn 为 0。
- 浏览器验证：`curl.exe -s -m 10 -o NUL -w "%{http_code}" http://127.0.0.1:3000/console/refunds` 和 `http://localhost:3000/console/refunds` 均返回 200；使用平台管理员测试账号登录后打开 `http://127.0.0.1:3000/console/refunds`，页面正常渲染，可见“退款审核”、导出按钮、筛选按钮、批量同意/拒绝按钮、真实退款列表、待审核“同意退款/拒绝退款”、处理中“重试退款”和已退款“无需操作”，浏览器 console error/warning 为 0。验证过程中未点击同意退款、拒绝退款、批量处理或任何退款写动作。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端 API；未触发任何退款审核、拒绝、重试或批量退款写动作；未提交、未推送。

## 2026-06-13 阶段 13 第八十八轮：帮助中心未知会话状态发送保护
- 目标：继续推进阶段 13“客服会话状态治理”，补齐 C 端 `/help` 在线客服输入框和发送入口的未知会话状态保护，避免未来状态或数据待同步时仍按非 `CLOSED` 会话发送消息。
- 本地样本：`/support` 工作台已有未知会话状态写动作保护；`/help` 缺口在于输入框和发送按钮此前直接判断 `conversation?.status === 'CLOSED'`，`send()` 入口也没有在发送前复用共享状态 helper。
- RED：新增 `frontend/src/lib/help-production-entry.test.ts`，要求帮助页接入 `canEditSupportConversation()` 和 `formatSupportConversationWriteBlockedMessage()`，并移除旧 `conversation?.status === 'CLOSED'` disabled 分支；首次运行失败，命中页面未导入 helper 和旧 `CLOSED` 直判。
- 修复：`frontend/src/app/help/page.tsx` 新增 `conversationWriteBlockedMessage`、`canSendSupportMessage` 和 `supportInputPlaceholder`，没有会话时仍允许创建新会话；已有会话时只有已知且未结束状态可发送，未知状态通过共享 helper 显示“会话状态待核对，请刷新后再操作”并阻断写接口，已结束会话返回“当前会话已结束，不能继续发送消息”。
- 验证：目标测试先失败后通过，最终 `node --test --experimental-strip-types frontend/src/lib/help-production-entry.test.ts` 通过 1 test；客服相邻测试 `node --test --experimental-strip-types frontend/src/lib/support-tools.test.ts frontend/src/lib/support-workbench-production-entry.test.ts` 通过 25 tests；综合前端回归 `node --test --experimental-strip-types frontend/src/lib/help-production-entry.test.ts frontend/src/lib/support-tools.test.ts frontend/src/lib/support-workbench-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-auth.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/activity-engagement-production-entry.test.ts frontend/src/lib/refunds-production-entry.test.ts frontend/src/lib/console-refunds.test.ts frontend/src/lib/reconciliation-production-entry.test.ts frontend/src/lib/console-reconciliation.test.ts` 通过 140 tests；`frontend` 下 `& .\node_modules\.bin\tsc --noEmit` 退出码 0；`git diff --check` 退出码 0，仅 LF/CRLF warning。
- 浏览器验证：`http://127.0.0.1:3000/help` 返回 HTTP 200；带 WebSocket upgrade 头请求 `/_next/webpack-hmr?id=codex-help-probe` 返回 `101 Switching Protocols`；浏览器打开 `http://127.0.0.1:3000/help` 可见“帮助中心”和“在线客服”，console error/warning 为 0。验证过程中未发送客服消息、未点击转人工或确认结束等写动作。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端 API；只改前端帮助页和测试；未触发任何客服会话写动作；未提交、未推送。

## 2026-06-13 阶段 13 第八十九轮：帮助中心确认结束会话状态二次保护
- 目标：继续推进阶段 13“客服会话状态治理”，补齐 C 端 `/help` 确认结束会话入口的当前状态二次保护，避免只靠按钮渲染条件保护会话结束写动作。
- 本地样本：`/help` 只有 `conversation?.status === 'CLOSE_REQUESTED'` 时渲染确认结束按钮，但 `confirmClose()` 事件入口此前没有在调用 `confirmCloseSupportConversation()` 前复核当前状态。
- RED：扩展 `frontend/src/lib/support-tools.test.ts` 和 `frontend/src/lib/help-production-entry.test.ts`，要求导出 `canConfirmSupportConversationClose()`，页面接入该 helper，事件入口包含状态复核和“当前会话暂不能结束，请刷新后再操作”；首次运行失败，命中 helper 未导出和页面未接入。
- 修复：`frontend/src/lib/support-tools.ts` 新增 `canConfirmSupportConversationClose(status)`，仅允许 `CLOSE_REQUESTED`；`frontend/src/app/help/page.tsx` 新增 `canConfirmCloseConversation`，确认结束按钮渲染和 `confirmClose()` 事件入口均复用该 helper，未知状态复用会话待核对文案，已知但不可确认状态显示“当前会话暂不能结束，请刷新后再操作”。
- 验证：目标测试先失败后通过，最终 `node --test --experimental-strip-types frontend/src/lib/support-tools.test.ts` 通过 23 tests，`frontend/src/lib/help-production-entry.test.ts` 通过 2 tests，`frontend/src/lib/support-workbench-production-entry.test.ts` 通过 2 tests；综合前端回归 `node --test --experimental-strip-types frontend/src/lib/help-production-entry.test.ts frontend/src/lib/support-tools.test.ts frontend/src/lib/support-workbench-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-auth.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/activity-engagement-production-entry.test.ts frontend/src/lib/refunds-production-entry.test.ts frontend/src/lib/console-refunds.test.ts frontend/src/lib/reconciliation-production-entry.test.ts frontend/src/lib/console-reconciliation.test.ts` 通过 141 tests；`frontend` 下 `& .\node_modules\.bin\tsc --noEmit` 退出码 0；`git diff --check` 退出码 0，仅 LF/CRLF warning。
- 浏览器验证：`http://127.0.0.1:3000/help` 返回 HTTP 200；带 WebSocket upgrade 头请求 `/_next/webpack-hmr?id=codex-help-close-probe` 返回 `101 Switching Protocols`；浏览器打开 `http://127.0.0.1:3000/help` 可见“帮助中心”和“在线客服”，console error/warning 为 0。验证过程中未发送客服消息、未点击转人工或确认结束等写动作。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端 API；只改前端帮助页、客服状态 helper 和测试；未触发任何客服会话写动作；未提交、未推送。

## 2026-06-13 阶段 13 第九十轮：帮助中心转人工会话状态二次保护
- 目标：继续推进阶段 13“客服会话状态治理”，补齐 C 端 `/help` 转人工入口的当前状态二次保护，避免只靠按钮禁用条件保护会话转人工写动作。
- 本地样本：`/help` 的转人工按钮文案和 disabled 条件已经复用 `canRequestSupportHandoff()` 与 `formatSupportHandoffActionLabel()`，但 `handoff()` 事件入口此前在不可转人工状态下直接静默 return，没有给用户中文阻断反馈。
- RED：扩展 `frontend/src/lib/help-production-entry.test.ts`，要求 `handoff()` 在调用 `handoffSupportConversation()` 前包含 `formatSupportConversationWriteBlockedMessage(conversation.status) || '当前会话暂不能转人工，请刷新后再操作'`，并移除旧的 `if (!conversation || !canRequestSupportHandoff(conversation)) return` 静默分支；首次运行失败，命中页面未接入阻断文案。
- 修复：`frontend/src/app/help/page.tsx` 的 `handoff()` 入口改为先处理无会话，再对已有会话复核 `canRequestSupportHandoff(conversation)`；未知状态复用“会话状态待核对，请刷新后再操作”，已知但不可转人工状态显示“当前会话暂不能转人工，请刷新后再操作”，阻断后不调用转人工写接口。
- 验证：目标测试先失败后通过，最终 `node --test --experimental-strip-types frontend/src/lib/help-production-entry.test.ts` 通过 3 tests；客服相邻回归 `node --test --experimental-strip-types frontend/src/lib/help-production-entry.test.ts frontend/src/lib/support-tools.test.ts frontend/src/lib/support-workbench-production-entry.test.ts` 通过 28 tests；综合前端回归 `node --test --experimental-strip-types frontend/src/lib/help-production-entry.test.ts frontend/src/lib/support-tools.test.ts frontend/src/lib/support-workbench-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-auth.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/activity-engagement-production-entry.test.ts frontend/src/lib/refunds-production-entry.test.ts frontend/src/lib/console-refunds.test.ts frontend/src/lib/reconciliation-production-entry.test.ts frontend/src/lib/console-reconciliation.test.ts` 通过 142 tests；`frontend` 下 `& .\node_modules\.bin\tsc --noEmit` 退出码 0。
- HMR 和浏览器验证：`http://127.0.0.1:3000/help` 返回 HTTP 200；带 WebSocket upgrade 头请求 `/_next/webpack-hmr?id=codex-current-probe` 返回 `101 Switching Protocols`；浏览器打开 `http://127.0.0.1:3000/help` 可见“帮助中心”和“在线客服”，console warn/error 为 0。验证过程中未发送客服消息、未点击转人工或确认结束等写动作。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端 API；只改前端帮助页和测试；未触发任何客服会话写动作；未提交、未推送。

## 2026-06-13 阶段 13 第九十一轮：客服工作台已知但不可执行状态写动作反馈
- 目标：继续推进阶段 13“客服会话状态治理”，补齐 `/support` 工作台写动作守卫对已知但当前动作不可执行状态的中文阻断反馈，避免客服点击后静默无响应。
- 本地样本：`/support` 的接入、回复、内部备注、保存标签、转接、升级和申请结束已经统一通过 `canProceedWithActiveWrite()` 复核状态；但此前该守卫只在未知或未来状态返回“会话状态待核对，请刷新后再操作”，对已知但不可执行组合只返回 false。
- RED：扩展 `frontend/src/lib/support-workbench-production-entry.test.ts`，要求 `canProceedWithActiveWrite()` 包含 `formatSupportConversationWriteBlockedMessage(active?.status) || '当前会话暂不能执行该操作，请刷新后再操作'`，并移除只在 message 存在时才 `setError(message)` 的静默分支；首次运行失败，命中工作台守卫缺少已知状态兜底文案。
- 修复：`frontend/src/app/support/page.tsx` 的 `canProceedWithActiveWrite()` 在不允许写动作时统一 `setError(...)`；未知状态继续显示“会话状态待核对，请刷新后再操作”，已知但不可执行状态显示“当前会话暂不能执行该操作，请刷新后再操作”。
- 验证：目标测试先失败后通过，最终 `node --test --experimental-strip-types frontend/src/lib/support-workbench-production-entry.test.ts` 通过 3 tests；客服相邻回归 `node --test --experimental-strip-types frontend/src/lib/help-production-entry.test.ts frontend/src/lib/support-tools.test.ts frontend/src/lib/support-workbench-production-entry.test.ts` 通过 29 tests；综合前端回归 `node --test --experimental-strip-types frontend/src/lib/help-production-entry.test.ts frontend/src/lib/support-tools.test.ts frontend/src/lib/support-workbench-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-auth.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/activity-engagement-production-entry.test.ts frontend/src/lib/refunds-production-entry.test.ts frontend/src/lib/console-refunds.test.ts frontend/src/lib/reconciliation-production-entry.test.ts frontend/src/lib/console-reconciliation.test.ts` 通过 143 tests；`frontend` 下 `& .\node_modules\.bin\tsc --noEmit` 退出码 0。
- HMR 和浏览器验证：`http://127.0.0.1:3000/support` 和 `http://127.0.0.1:3000/help` 均返回 HTTP 200；带 WebSocket upgrade 头请求 `/_next/webpack-hmr?id=codex-support-workbench-probe` 返回 `101 Switching Protocols`；浏览器新标签打开 `http://127.0.0.1:3000/support` 可见客服工作台，console warn/error 为 0。验证过程中未点击接入、发送、保存标签、转接、升级或申请结束等写动作。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端 API；只改前端客服工作台和测试；未触发任何客服会话写动作；未提交、未推送。

## 2026-06-13 阶段 13 第九十二轮：风险事件恢复申请状态阻断反馈与主办方入口守卫修正
- 目标：继续推进阶段 13“平台治理与运营中台 / 后台中文化与写动作保护”，补齐 `/console/risk-events` 恢复售票申请被未知或审核中状态阻断时的中文反馈，并修正带权限码主办方访问风险事件页被误重定向的问题。
- 根因：主办方登录返回 `role=organizer` 且携带 `permissionCodes`，旧 `ConsoleLayout` 先按权限码模式调用 `canAccessConsolePath()`，导致主办方业务路径 `/console/risk-events` 被平台权限码表误拦截并重定向到 `/console`。
- RED：扩展 `frontend/src/lib/console-production-entry.test.ts`，要求 `ConsoleLayout` 在权限码过滤前优先处理 `role === 'organizer'`，并要求风险事件页接入 `formatRiskResolutionSubmitBlockedMessage()`、`onBlocked()` 和提交前当前列表状态二次复核。首次运行目标测试失败，命中旧 layout 守卫顺序和旧静默阻断入口。
- 修复：`frontend/src/app/console/layout.tsx` 将 `organizer` 菜单和路径守卫提前到权限码分支之前；`frontend/src/app/console/risk-events/page.tsx` 新增恢复售票申请阻断文案，未知状态返回“恢复售票审核状态待核对，请刷新后再操作”，审核中返回“当前恢复售票申请正在审核中，请刷新后再操作”，按钮点击和 `submit()` 都会先按最新恢复申请状态复核，阻断后不调用写接口。
- 验证：目标测试先失败后通过，最终 `node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts` 通过 50 tests；综合前端回归 `node --test --experimental-strip-types frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-auth.test.ts frontend/src/lib/operation-display.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/activity-engagement-production-entry.test.ts frontend/src/lib/refunds-production-entry.test.ts frontend/src/lib/console-refunds.test.ts frontend/src/lib/reconciliation-production-entry.test.ts frontend/src/lib/console-reconciliation.test.ts frontend/src/lib/help-production-entry.test.ts frontend/src/lib/support-tools.test.ts frontend/src/lib/support-workbench-production-entry.test.ts` 通过 150 tests；本机全局 `pnpm` shim 缺少 `C:\Program Files\nodejs\node_modules\pnpm\bin\pnpm.mjs`，因此改用 `frontend` 下 `& .\node_modules\.bin\tsc --noEmit` 验证 TypeScript，退出码 0；`git diff --check` 退出码 0，仅 LF/CRLF warning。
- HMR 和浏览器验证：当前 `frontend/next.config.ts` 已含 `allowedDevOrigins: ['127.0.0.1']`；Node 原生 WebSocket 连接 `ws://127.0.0.1:3000/_next/webpack-hmr` 可 `open` 后正常关闭。初次访问 `/console/risk-events` 仍跳转到 `/console`，确认容器源码已更新但运行态 dev bundle 未刷新；执行 `docker restart omni-frontend` 后，`http://127.0.0.1:3000/console/risk-events` 返回 HTTP 200，浏览器登录主办方账号打开该页后 URL 保持 `/console/risk-events`，可见“风险事件待办”和“提交恢复申请”，console warn/error 为 0。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端 API；只改前端风险事件页、控制台 layout 和测试；浏览器验证未点击提交恢复申请或任何写动作；未提交、未推送。

## 2026-06-13 阶段 13 第九十三轮：平台运营摘要链路健康卡片
- 目标：继续推进阶段 13“平台健康看板”，在不伪造基础设施探针的前提下，让平台管理员能在控制台首页看到平台运营摘要聚合链路是否正常。
- 本地样本：`/console` 已经加载 `getPlatformOpsSummary()` 并在聚合异常时返回 `platformOps.errors`，但页面此前只把错误 message 合并成单行提示，没有按 ticket/payment/grab/workbench 摘要链路给出稳定中文健康项。
- RED：扩展 `frontend/src/lib/console-ops.test.ts` 和 `frontend/src/lib/console-production-entry.test.ts`，要求导出 `buildPlatformOpsHealthItems()`，并要求 `/console/page.tsx` 展示“摘要链路健康”“摘要链路正常”“状态待核对”，且不暴露 `error.source` 原始来源码。首次运行目标测试失败，命中 helper 未导出和页面未接入。
- 修复：`frontend/src/lib/console-ops.ts` 新增 `buildPlatformOpsHealthItems(errors)`，固定输出“票务摘要链路 / 退款摘要链路 / 抢票摘要链路 / 工作台摘要链路”，正常显示“摘要链路正常”，降级显示聚合错误 message，未知 source 归入“其他摘要链路”；`frontend/src/app/console/page.tsx` 在运营驾驶舱新增“摘要链路健康”卡片，显示“正常 / 状态待核对”。
- 验证：目标测试先失败后通过，最终 `node --test --experimental-strip-types frontend/src/lib/console-ops.test.ts frontend/src/lib/console-production-entry.test.ts` 通过 53 tests；综合前端回归 `node --test --experimental-strip-types frontend/src/lib/console-ops.test.ts frontend/src/lib/console-production-entry.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-auth.test.ts frontend/src/lib/operation-display.test.ts frontend/src/lib/audit-log-production-entry.test.ts frontend/src/lib/activity-engagement-production-entry.test.ts frontend/src/lib/refunds-production-entry.test.ts frontend/src/lib/console-refunds.test.ts frontend/src/lib/reconciliation-production-entry.test.ts frontend/src/lib/console-reconciliation.test.ts frontend/src/lib/help-production-entry.test.ts frontend/src/lib/support-tools.test.ts frontend/src/lib/support-workbench-production-entry.test.ts` 通过 153 tests；`frontend` 下 `& .\node_modules\.bin\tsc --noEmit` 退出码 0；`git diff --check` 退出码 0，仅 LF/CRLF warning。
- HMR 和浏览器验证：当前 `frontend/next.config.ts` 已含 `allowedDevOrigins: ['127.0.0.1']`；Node 原生 WebSocket 探针连接 `ws://127.0.0.1:3000/_next/webpack-hmr` 返回 `open` 后正常关闭；浏览器打开 `http://localhost:3000/console` 可见“运营驾驶舱”“摘要链路健康”“票务摘要链路”“退款摘要链路”“抢票摘要链路”“工作台摘要链路”“摘要链路正常”，console warn/error 为 0。
- 边界备注：本轮没有数据库结构变更，不需要迁移；未新增后端 API；只改前端控制台首页、摘要链路 helper 和测试；健康卡片只表达 `PlatformOpsSummaryVO.errors` 对应的摘要聚合链路，不代表 Nacos/Seata/Redis/RabbitMQ 等真实基础设施探针；浏览器验证未触发写动作；未提交、未推送。

## 2026-06-13 阶段 13 第九十四轮：平台基础设施健康探针
- 目标：继续推进阶段 13“平台健康看板”，把 Nacos、Redis、RabbitMQ、Seata 的真实可达性从摘要链路健康中拆出，避免用运营摘要接口状态伪装基础设施状态。
- RED：新增 `frontend/src/lib/console-ops.test.ts`、`frontend/src/lib/api.test.ts`、`frontend/src/lib/console-production-entry.test.ts` 断言，要求 `/console` 展示“基础设施健康”，缺少后端探针时显示“未配置 / 基础设施探针未配置”，且不把缺失探针当作正常；后端新增 `PlatformInfrastructureHealthProbeTest`，先复现 Spring 创建 `PlatformInfrastructureHealthProbe` 时的 `No default constructor found` 启动失败。
- 修复：`java-user` 新增 `PlatformInfrastructureHealthProbe`，基于本机配置探测 Nacos HTTP、Redis TCP、RabbitMQ TCP、Seata TCP，并通过 `PlatformOpsSummaryResponse.infrastructureHealth` 返回 `ok / degraded / not_configured`；`PlatformOpsSummaryService` 接入探针，探针异常时返回中文降级项；`/console` 新增“基础设施健康”卡片，分别展示 Nacos 注册中心、Redis 缓存、RabbitMQ 消息队列、Seata 事务协调器。
- 启动失败修复：用户在 IDEA 启动 `java-user` 时遇到 `PlatformInfrastructureHealthProbe.<init>()` 无参构造缺失；根因是该类存在生产构造函数和包内测试构造函数，Spring 未显式选择 `Environment` 构造函数。已给生产构造函数加 `@Autowired`，并用 Spring 容器测试覆盖该路径。
- 验证：`mvn -pl java-user "-Dtest=PlatformInfrastructureHealthProbeTest,PlatformOpsSummaryServiceTest" test` 通过 5 tests；`mvn -pl java-user test` 通过 262 tests；`node --test --experimental-strip-types frontend/src/lib/console-ops.test.ts frontend/src/lib/api.test.ts frontend/src/lib/console-production-entry.test.ts` 通过 90 tests；`frontend` 下 `.\node_modules\.bin\tsc --noEmit` 退出码 0；`git diff --check` 退出码 0，仅 LF/CRLF warning。
- 运行态验收：用户在 IDEA 重启 `java-user` 后，Node 直连网关登录并调用 `GET http://localhost:8088/api/user/console/ops-summary` 返回 `code=200`，`infrastructureHealth.items` 为 4 项，Nacos 注册中心、Redis 缓存、RabbitMQ 消息队列、Seata 事务协调器均返回 `status=ok` 和中文可达消息。
- 浏览器验收：重新打开 `http://localhost:3000/console`，页面可见“基础设施健康”，并显示 Nacos 注册中心、Redis 缓存、RabbitMQ 消息队列、Seata 事务协调器四项“正常”；浏览器 console warn/error 为 0；Node WebSocket 探针连接 `ws://127.0.0.1:3000/_next/webpack-hmr?id=codex-post-java-user-restart-probe` 返回 `open`。
- 边界备注：本轮没有数据库结构变更，不需要迁移；不新增依赖；探针只报告可达性和配置状态，不外发真实凭据，不触发任何写动作；未提交、未推送。
