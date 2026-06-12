# PostHog 评估与试点接入方案

> 阶段 8 第一轮输出物，后续已在用户授权后进入 SDK transport 试点。当前仍不创建外部账号、不写入真实 PostHog 服务；真实 token/host enabled 态项目侧验收已按用户确认后置到生产运维上线前补充。

## 结论

PostHog 适合作为 Omni 产品分析和运营漏斗候选，但第一轮只能做前端 allowlist 埋点设计，不启用 autocapture、Session Replay、Feature Flags、Experiments、Surveys、Error Tracking 或服务端采集。

当前代码状态（2026-06-10）：
- 已新增 `frontend/src/lib/analytics.ts` 和 `frontend/src/lib/analytics.test.ts`，只提供本地 allowlist、属性脱敏、环境开关和可注入 transport。
- 已新增 `frontend/src/lib/analytics-page-integration.test.ts`，并在 `/search`、`/activity/[id]`、`/orders`、`/console` 接入 `captureAnalyticsEvent()` no-op 调用点。
- 用户授权后已安装 `posthog-js`，并新增 `frontend/src/lib/posthog-client.ts` 作为 SDK transport 适配层；当前未创建外部项目，未设置真实 token/host，未写入外部服务。
- `NEXT_PUBLIC_POSTHOG_ENABLED`、`NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`、`NEXT_PUBLIC_POSTHOG_HOST` 缺一时 wrapper disabled，SDK 不初始化，不发送外部请求。
- `frontend/instrumentation-client.ts` 统一初始化 PostHog transport；页面不得直接导入 `posthog-js`。
- 已验证未知事件、未授权属性、手机号、token、完整 orderId/userId/conversationId 和 URL query 不会进入发送事件。
- 已验证页面接入只发送 allowlist 属性：搜索不发送原词，订单不发送订单号，控制台不发送任务/批次/审计 ID。
- 已验证 disabled 态浏览器 Network：缺少 token/host 时没有外部 PostHog ingest/capture/decide 请求；只会加载本地 Next 打包 chunk。

推荐试点口径：
- `posthog-js` 已在明确授权后安装；后续启用仍需要真实 token/host 和项目侧验收，该验收后置到生产运维阶段。
- 默认 `NEXT_PUBLIC_POSTHOG_ENABLED=false`，本地和测试环境不发送事件。
- 只采集少量自定义事件，禁止自动采集 DOM 文本、表单输入、客服聊天内容和订单详情。
- 不调用 `identify()` 绑定手机号、邮箱或真实 userId；第一轮使用匿名事件或本地不可逆 hash。

## 官方资料快照

截至 2026-06-09 官方页面显示：
- Free 计划不需要信用卡，包含 1 个项目、1 年数据保留、无限团队成员，可选 US 或 EU cloud region。
- 免费月额度包含 1M analytics events、5K session replay recordings、1M feature flag requests、100K exceptions、1500 survey responses、1M data warehouse rows 等。
- 超出免费额度后是 usage-based pricing，并可按产品设置 billing limit。
- Next.js 接入文档使用 `posthog-js`、`instrumentation-client.ts` 和 `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` / `NEXT_PUBLIC_POSTHOG_HOST`。
- JavaScript SDK 支持 `capture()`、`opt_out_capturing()`、`opt_in_capturing()`、`stopSessionRecording()` 等控制方法。

资料来源：
- https://posthog.com/pricing
- https://posthog.com/docs/libraries/js
- https://posthog.com/docs/libraries/next-js
- https://posthog.com/docs/references/posthog-js
- https://trust.posthog.com/

## 适用目标

第一轮只解决平台运营当前缺的真实前端行为信号：
- 搜索提交、搜索结果为空、活动详情访问、想看/提醒/候补点击。
- 下单入口点击、订单创建成功、支付发起、支付同步结果、退款申请入口。
- 控制台运营漏斗区域访问和异常任务/对账入口点击。

这些事件用于补齐 Phase 7 二轮只读运营漏斗里的“曝光、详情访问、搜索转化、按钮点击”缺口。当前 Phase 7 二轮已经通过本地五库和 grab-service 聚合出服务端摘要；PostHog 只能作为后续真实用户行为补充，不能替代后端权威数据。

暂不解决：
- 不接服务端事件。
- 不接 Feature Flags 或 Experiments。
- 不接 Session Replay。
- 不做跨域营销站到应用的连续用户追踪。
- 不把 PostHog 当作订单、支付、风控或客服审计数据源。

## 事件命名规范

统一前缀使用 `omni_`，事件名使用小写 snake_case。

| 事件 | 触发点 | 允许属性 |
|:---|:---|:---|
| `omni_search_submitted` | 搜索提交 | `keyword_present`、`city`、`category_id`、`source` |
| `omni_search_empty_result_seen` | 搜索无结果 | `city`、`category_id`、`result_count_bucket` |
| `omni_activity_detail_viewed` | 活动详情渲染成功 | `activity_id`、`city`、`category_id`、`sale_status` |
| `omni_interest_clicked` | 想看/关注点击 | `activity_id`、`source` |
| `omni_sale_reminder_clicked` | 开售提醒点击 | `activity_id`、`source` |
| `omni_waitlist_clicked` | 候补入口点击 | `activity_id`、`ticket_type_id`、`source` |
| `omni_order_create_clicked` | 下单按钮点击 | `activity_id`、`ticket_type_id`、`source` |
| `omni_order_created` | 前端收到创建订单成功 | `activity_id`、`payment_required`、`source` |
| `omni_payment_started` | 支付发起 | `payment_channel`、`source` |
| `omni_payment_sync_result_seen` | 支付同步结果展示 | `result`、`source` |
| `omni_refund_entry_clicked` | 退款入口点击 | `source` |
| `omni_console_ops_summary_viewed` | 控制台运营摘要渲染成功 | `role`、`funnel_steps_bucket` |
| `omni_console_exception_entry_clicked` | 异常任务入口点击 | `role`、`source` |
| `omni_console_reconciliation_entry_clicked` | 日结对账入口点击 | `role`、`source` |

禁止属性：
- 手机号、证件号、姓名、邮箱、精确地址。
- JWT、Cookie、internal token、支付参数。
- 完整 `orderId`、`userId`、`conversationId`、动态入场码、二维码内容。
- 搜索原词；只发送 `keyword_present=true|false` 或后续经过本地分类后的安全标签。
- 客服会话正文、评价正文、问答正文、举报理由全文。

## 环境变量清单

仅在授权试点后使用：

| 变量 | 作用 | 是否可公开 | 默认值 |
|:---|:---|:---|:---|
| `NEXT_PUBLIC_POSTHOG_ENABLED` | 前端是否初始化 PostHog | 是 | `false` |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` | PostHog project token | 是 | 空 |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog host / region | 是 | 空 |
| `NEXT_PUBLIC_POSTHOG_AUTOCAPTURE` | 是否启用 autocapture | 是 | `false` |
| `NEXT_PUBLIC_POSTHOG_CAPTURE_PAGEVIEW` | 是否自动 pageview | 是 | `false` |
| `NEXT_PUBLIC_POSTHOG_SESSION_REPLAY_ENABLED` | 是否启用 Session Replay | 是 | `false` |
| `NEXT_PUBLIC_POSTHOG_PERSON_PROFILES` | person profile 策略 | 是 | `never` |

第一轮不需要私密 server token，不接 `posthog-node`，不接 data warehouse，不配置 reverse proxy。

## 隐私与数据边界

允许发送：
- 匿名事件名、页面 surface、活动 id、城市、类目、票档 id、支付渠道枚举、结果枚举。
- 粗粒度桶，例如 `result_count_bucket=0|1-10|10+`。
- 角色枚举：`user`、`organizer`、`admin`、`support`。

不允许发送：
- 可直接识别个人或交易的字段。
- 自由文本输入内容。
- 表单输入、DOM 文本、客服聊天内容、评价正文、问答正文。
- 未经脱敏的 URL query。

控制策略：
- 第一轮不启用 autocapture。
- 第一轮不启用 Session Replay；如果后续评估必须启用，只能对非敏感页面配置，并先完成遮罩策略和用户告知。
- 所有埋点从 `frontend/src/lib/analytics.ts` 这类统一 wrapper 发出，页面不得直接调用 SDK。
- wrapper 内置 allowlist，未知事件直接丢弃，不在日志里输出事件属性或敏感内容。

## 免费额度风险

主要风险：
- 自动采集会把点击、pageview、元素信息放大成高事件量，快速消耗 1M events。
- Session Replay 既有隐私风险，也会消耗 5K recordings。
- Feature flag 请求虽然有 1M 免费额度，但当前 Omni 不需要用 PostHog 做开关。
- 识别用户后，数据治理复杂度明显增加；第一轮避免 person profile。

控制策略：
- 只发 allowlist 自定义事件。
- 搜索、详情、按钮类事件做去抖或同一页面 session 内去重。
- 不在列表每个卡片曝光时发事件；如需曝光，后续用采样和批量聚合。
- 设置 billing limit，超出免费额度自动停止对应产品。

## 本地与离线行为

- 本地默认不初始化，`NEXT_PUBLIC_POSTHOG_ENABLED` 不为 `true` 或 token/host 为空时不调用 `posthog.init()`、不发送外部请求。
- 测试环境必须验证禁用态不会产生外部网络请求。
- 网络不可用时不能阻塞页面渲染或按钮操作。
- 失败时不显示用户可见报错，不影响登录、购票、支付、退款、客服和控制台。

## 试点步骤

1. 用户确认是否允许创建 PostHog 项目，并选择 US 或 EU region。
2. 用户已授权安装 `posthog-js`；依赖已通过镜像源安装，并显式拒绝 `core-js` build script。
3. 已新增统一 analytics wrapper，默认 disabled。
4. 已写事件 allowlist、属性过滤和页面接入测试。
5. 已在 `/search`、`/activity/[id]`、`/orders`、`/console` 少量接入自定义事件 no-op 调用。
6. 已用禁用态跑 `pnpm typecheck`、前端测试和浏览器 Network 验收；缺少 token/host 时不会访问外部 PostHog。
7. 生产运维上线前注入真实 token/host 后，在启用试点环境只触发少量手工事件，检查 PostHog 里属性是否脱敏。
8. 记录事件量、保留策略、billing limit、关闭方案和回滚 diff。

## 关闭与回滚方案

快速关闭：
- 将 `NEXT_PUBLIC_POSTHOG_ENABLED=false`。
- 清空 `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` 和 `NEXT_PUBLIC_POSTHOG_HOST`。
- 保持 `NEXT_PUBLIC_POSTHOG_AUTOCAPTURE=false`、`NEXT_PUBLIC_POSTHOG_SESSION_REPLAY_ENABLED=false`。

代码回滚：
- 移除 analytics wrapper 和页面调用点。
- 移除 `posthog-js` 依赖并恢复 lockfile。
- 删除 PostHog 相关测试。

外部侧清理：
- 停用或删除 PostHog 项目 token。
- 清理试点事件或保留脱敏样本用于评估。
- 确认 billing limit 仍为免费额度上限。

## 验收标准

- 禁用态：`pnpm typecheck`、前端测试和浏览器验收通过，Network 中没有外部 PostHog 请求。
- 本地 wrapper：allowlist、敏感属性过滤和 no-transport 不发送测试通过；缺少 token/host 时不得出现外部网络写入。
- 页面接入：关键页面只调用 `frontend/src/lib/analytics.ts`，不得直接调用 SDK，不得发送搜索原词、订单号、用户号、conversationId、URL query 或自由文本。
- 启用态后置验收：生产运维上线前只发送 allowlist 事件和 allowlist 属性。
- 隐私：不出现手机号、证件号、姓名、完整订单号、客服正文、评价正文、支付参数或 token。
- 费用：项目有 billing limit，事件量接近阈值前能通过总开关停止。
- 回滚：只改环境变量即可停止发送；移除代码后现有运营漏斗和核心购票链路不受影响。
