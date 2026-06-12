# Sentry 评估与试点接入方案

> 阶段 8 第一轮输出物。第一轮只做评估和试点边界定义；第二轮已进入 Sentry 优先试点，默认 disabled，不创建外部账号，不写入外部服务。真实 DSN enabled 态项目侧验收已按用户确认后置到生产运维上线前补充。

## 结论

Sentry 适合作为 Omni 第一批外部 SaaS 候选，优先试点前端错误监控和 release 标识。第一轮不接 Session Replay、日志聚合、AI debugging、Java APM 或自动 source map 上传，避免隐私面和费用面一次性扩大。

推荐试点口径：
- 只在明确授权后安装 `@sentry/nextjs`。
- 默认只启用错误监控，`tracesSampleRate=0`，Session Replay 关闭。
- 只在非本地环境且 `NEXT_PUBLIC_SENTRY_ENABLED=true`、`NEXT_PUBLIC_SENTRY_DSN` 非空时初始化。
- 所有事件必须经过脱敏过滤，禁止上传 token、手机号、证件号、观演人姓名、动态入场码、支付跳转参数和完整订单上下文。

## 第二轮状态

截至 2026-06-09：
- 已按授权安装 `@sentry/nextjs` 10.56.0。
- 已新增前端 gated 初始化、server/edge disabled 配置、route 归一和敏感字段脱敏纯函数；browser/server/edge 均复用 `beforeSend` 和 `beforeBreadcrumb` 脱敏。
- 默认 `NEXT_PUBLIC_SENTRY_ENABLED=false` 且 DSN 为空；disabled 态浏览器验收未出现 Sentry/ingest 外部请求。
- 已明确拒绝 `@sentry/cli` build script，本轮不上传 source map。
- 启用态测试错误验收已后置到生产运维阶段；上线前由运维环境注入真实 Sentry DSN 后再验收，不要在聊天中输出 DSN。

## 官方资料快照

截至 2026-06-09 官方页面显示：
- Developer 计划免费且限制 1 个用户。
- Developer 基础额度包含 5k errors、5GB logs、5M spans、50 replays、1 个 uptime monitor、1 个 cron monitor、1GB attachments 和 30-day lookback。
- Team 计划当前标价为 $26/mo，Business 为 $80/mo；超出基础额度会进入按量计费。
- Next.js 官方手动接入需要 `@sentry/nextjs`、`instrumentation-client.ts`、`sentry.server.config.ts`、`sentry.edge.config.ts` 和 `next.config` 包装。
- Sentry JavaScript 配置支持 `enabled`、`sampleRate`、`beforeSend`、`tracesSampleRate`、`beforeSendTransaction`、`replaysSessionSampleRate`、`replaysOnErrorSampleRate` 等开关。

资料来源：
- https://sentry.io/pricing/
- https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
- https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/environments/
- https://docs.sentry.io/platforms/javascript/guides/nextjs/data-management/data-collected

## 适用目标

第一轮只解决三个问题：
- 用户在浏览器里遇到白屏、运行时异常或前端请求封装异常时，平台能看到错误类型、页面路径、release 和浏览器环境。
- `/console`、`/activity/[id]`、`/orders`、`/support` 等高频路径出现异常时，可以按 release 和 route 聚合。
- 线上问题反馈可以和当前部署版本对应，而不是只依赖用户截图和本地复现。

暂不解决：
- 不替代 Gateway route 耗时日志。
- 不替代 `java-gateway` / `java-user` / `java-ticket` 等服务端日志。
- 不把 Sentry 作为业务审计、风控或订单状态源。
- 不接 Seer / AI debugging。
- 不接用户反馈浮窗，避免引入新的用户可见入口。

## 数据边界

允许发送：
- `environment`、`release`、页面 route 模板、错误类型、脱敏错误消息、堆栈、浏览器和运行时信息。
- `X-Request-Id` 或内部生成的非敏感 trace id。
- 业务域的粗粒度标签，例如 `surface=console`、`surface=activity`、`role=admin|organizer|user`。

禁止发送：
- JWT、`INTERNAL_API_TOKEN`、支付宝沙盒参数、Cookie、Authorization header。
- 手机号、证件号、观演人姓名、客服聊天正文、收货/联系人信息。
- 动态入场码、二维码内容、支付二维码 URL。
- 完整 `orderId`、`userId`、`attendeeId` 等可直接回查个人或交易的标识；需要分析时使用分桶或本地不可逆 hash。
- 请求 body、响应 body、表单内容和未脱敏 query string。

必须脱敏：
- URL path 中的数字 id 统一归一为 route 模板，例如 `/orders/[id]`、`/activity/[id]`。
- query string 默认清空，只保留白名单字段，例如 `source=console`。
- console breadcrumb 需要过滤，避免把前端调试日志里的接口响应内容上传。

## 环境变量清单

仅在授权试点后使用：

| 变量 | 作用 | 是否可公开 | 默认值 |
|:---|:---|:---|:---|
| `NEXT_PUBLIC_SENTRY_ENABLED` | 前端是否初始化 Sentry | 是 | `false` |
| `NEXT_PUBLIC_SENTRY_DSN` | 浏览器端 DSN | 是 | 空 |
| `SENTRY_DSN` | 服务端 DSN，后续服务端接入再使用 | 否 | 空 |
| `SENTRY_ENVIRONMENT` | `local` / `staging` / `production` | 是 | `local` |
| `SENTRY_RELEASE` | release 标识 | 是 | 当前构建版本 |
| `SENTRY_SAMPLE_RATE` | 错误事件采样率 | 是 | `1.0` |
| `SENTRY_TRACES_SAMPLE_RATE` | 性能 tracing 采样率 | 是 | `0` |
| `SENTRY_REPLAYS_SESSION_SAMPLE_RATE` | 普通 Session Replay 采样率 | 是 | `0` |
| `SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE` | 错误触发 replay 采样率 | 是 | `0` |
| `SENTRY_AUTH_TOKEN` | source map 上传 token | 否 | 空 |

`SENTRY_AUTH_TOKEN` 只能放在 CI secret 或本机私有环境变量里，不能写入仓库、日志、`.env.example` 真实值或前端 bundle。

## 免费额度风险

主要风险：
- 前端异常风暴会快速消耗 5k errors。
- 打开 tracing 后 5M spans 虽然看起来高，但 Next 页面、API proxy、fetch 链路会放大采集量。
- Session Replay 额度只有 50 replays，不适合作为第一轮默认能力。
- source map 上传会把构建产物和 release 绑定到外部平台，需要额外 token 管理。

控制策略：
- 第一轮 `tracesSampleRate=0`，只在明确排查慢页面时临时打开小采样。
- Session Replay 默认 0，等隐私策略和额度策略确认后再评估。
- 对第三方脚本、浏览器扩展、健康检查和已知噪声错误做 `ignoreErrors` / `allowUrls` 过滤。
- 设置 Sentry 项目 quota 或告警；接近额度时优先降采样或关闭。

## 本地与离线行为

- 本地默认不初始化，`NEXT_PUBLIC_SENTRY_ENABLED` 不为 `true` 或 DSN 为空时不加载 SDK。
- 测试环境必须验证禁用态不会产生外部网络请求。
- 网络不可用时不能影响页面渲染、登录、购票、支付、退款、客服或控制台操作。
- 禁用态下前端错误仍使用现有页面错误态和 console 输出，不增加用户可见英文文案。

## 试点步骤

1. 用户确认是否允许创建 Sentry 账号/项目、选择 region、生成 DSN。
2. 用户确认是否允许安装 `@sentry/nextjs`，并说明下载来源和镜像源。
3. 新增 gated 初始化文件，所有配置由环境变量控制。
4. 增加 `beforeSend`、`beforeBreadcrumb`、`beforeSendTransaction` 脱敏函数。
5. 增加单元测试：禁用态不初始化、敏感字段会被过滤、route id 会被归一。
6. 用浏览器访问 `/console`、`/activity/[id]`、`/orders`，确认页面无新增 warn/error。
7. 生产运维上线前只在授权环境触发一次测试错误，确认 Sentry 收到脱敏事件。
8. 记录额度、事件样例、关闭方案和回滚 diff。

## 关闭与回滚方案

快速关闭：
- 将 `NEXT_PUBLIC_SENTRY_ENABLED=false`。
- 清空 `NEXT_PUBLIC_SENTRY_DSN` 和 `SENTRY_DSN`。
- 将 `SENTRY_TRACES_SAMPLE_RATE=0`、`SENTRY_REPLAYS_*_SAMPLE_RATE=0`。

代码回滚：
- 删除 Sentry 初始化文件。
- 移除 `withSentryConfig` 包装。
- 移除 `@sentry/nextjs` 依赖并恢复 lockfile。
- 删除 Sentry 相关测试。

外部侧清理：
- 删除或停用 Sentry 项目 DSN。
- 移除 CI secret 中的 `SENTRY_AUTH_TOKEN`。
- 导出或清理试点期间采集到的事件，确保没有敏感字段残留。

## 验收标准

- 禁用态：`pnpm typecheck`、前端测试和浏览器验收通过，Network 中没有 Sentry 请求。
- 配置防护：browser/server/edge 的事件脱敏和 breadcrumb 脱敏单元测试通过，server/edge 只有在显式开关和 DSN 同时存在时才初始化。
- 启用态后置验收：生产运维上线前只上报脱敏错误事件，不上传 token、手机号、证件号、订单详情、客服正文或请求/响应 body。
- 额度：Sentry 项目可见当月用量，超过阈值前能通过采样或总开关关闭。
- 回滚：只改环境变量即可停止发送；移除代码后核心购票链路不受影响。
