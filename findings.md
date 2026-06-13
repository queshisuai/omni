# 大麦迁移体验改进发现

## 2026-06-01 消息铃 / 消息中心发现
- 候补、小队抢票、客服、风控待办等通知已经由不同后端链路产生，但前端原本只把消息当列表看，缺少“一点即处理”的业务入口。
- 对 C 端用户来说“来自哪个服务”属于平台内部实现，不应在消息卡片里展示；保留通知类型和明确按钮更符合使用预期。
- 人工客服回复此前只进入客服会话记录，不会同步进消息中心；用户离开客服页后容易错过人工回复，需要由 `java-user` 通过内部通知接口写入 `SUPPORT_REPLY`。

## 2026-06-01 交互语义和记录补强发现

- 活动详情顶部原先把“候补提醒”做成订阅按钮，和真实候补场景不一致；真实入口应该依赖选中票档无票状态，在购票区域展示“加入候补”。
- 已开售活动继续展示“开售提醒”会产生错误反馈；顶部动作需要根据 `activity.status === 1` 隐藏开售提醒。
- 候补释放、过期、支付成功已经由 grab-service 发送 `WAITLIST_OFFERED` / `WAITLIST_EXPIRED` / `WAITLIST_PAID`，前端缺的是消息中心统一分类展示。
- 客服会话响应只有 `userId`，人工客服和平台管理员难以区分不同用户；补充昵称和脱敏手机号即可不暴露完整隐私。
- 现有个性化推荐已有本地浏览信号，但缺少标题、海报和时间，无法形成可用的“浏览记录”页面。
- 活动详情页加入已有小队时，“小队 ID”对普通用户仍是技术口吻；可以保留数字编号用于加入和排查，但弹窗、占位和校验提示应统一使用“小队编号”。
- 客服工作台里会话头部和抢票上下文也应保留中文编号语境；可以继续展示用户编号和请求号，但不应直接把 `ID` 或 `requestId` 当作主文案。
- 商户入驻说明也属于用户可见文案；即使系统自动使用当前登录账号，不需要用户传入技术字段，也应说明为“用户编号”而不是“用户 ID”。
- C 端票档名缺失时不应退回 `ticketTypeId` 拼“票档 203”；订单、票夹、抢票尝试和自动降档提示应统一显示“票档信息待同步”，把内部编号留在接口和排查层。

## 当前工作区

- 当前分支：`master`，领先远端较多提交。
- 当前存在未提交改动；其中实名证件号加密相关代码属于上一轮实现，文档草稿属于既有工作区状态。
- `frontend/src/app/orders/page.tsx` 是订单页，不是票夹闭环。

## 票夹相关现状

- `java-order` 已有 `order_attendee` 实名快照表，可提供脱敏观演人信息。
- `java-order` 已有 `order_seat`，可提供座位和票状态基础。
- 当前没有一票一条的电子票表，也没有动态入场码、核销和转赠接口。
- 支付成功入口在 `OrderService.markPaid(...)`；这是生成电子票的合适位置。
- 用户订单列表接口在 `OrderController.listOrders(...)`，但它返回订单聚合，不适合作为票夹数据源。

## 设计约束

- 电子票应归 `java-order` 所有，因为它与订单、实名快照、退款/取消状态强相关。
- 入场码不落明文，使用短期签名码即可。
- 核销接口应使用内部令牌或后续验票端令牌，不应暴露为普通用户可写接口。
- 强实名转赠规则需要由活动规则下发并在订单快照固化；P0-A 先打通票夹/核销，P0-B 再补规则和转赠状态机。

## P2 发现

- 主办方营销工具归 `java-ticket` 更合适，因为规则绑定活动和票档配置；本次先完成优惠券/满减配置落库，不直接改变支付实收金额。
- 活动漏斗可从 ticket 侧订阅/想看、order 侧订单状态聚合出基础闭环；曝光和详情页埋点后续可继续补真实采集。
- 平台驾驶舱需要跨服务数据：ticket 提供活动/风控/订单热度，payment 前端现有退款列表可计算退款异常率，grab-service 提供抢票失败分布和候补转化。

## 2026-06-01 二次检查发现

- 新功能表已补齐后，接口层整体可用；票夹、订阅、客服、营销、驾驶舱核心接口均返回 HTTP 200。
- `electronic_ticket` 新表上线后没有对历史已支付订单回填，导致已有已支付订单用户打开票夹仍为空；需要保留幂等回填迁移并在本地/生产分库执行。
- 客服账号注销只更新 `user.status=0`，登录服务此前未校验停用状态；这会让已注销客服继续登录客服工作台。
- 退款后电子票此前没有失效联动；全额退款和部分退款都应把对应未使用电子票标记为已失效，否则会出现退款后仍有有效入场凭证的履约风险。
- 搜索、城市联动、移动端底部 Tab、订单详情页、帮助中心、人工客服工作台已有基础实现；体验层仍可继续补骨架屏、空结果相似推荐、B 端导出/批量操作和驾驶舱图表化。
- 前端体验层本轮补强可以不引入新依赖完成：骨架屏用 Tailwind 样式组件，驾驶舱图表用 CSS 条形图，订单导出用浏览器 `Blob` 生成 CSV，避免增加运行和构建复杂度。
- 后台订单导出只能使用已有脱敏观演人数据，不能导出完整证件号；CSV 里保留 `idNoMask`，符合实名最小暴露原则。
- 搜索空结果推荐不应只靠硬编码热词；在接口返回空结果时追加一次放宽筛选的真实活动查询，作为“相关演出”来源。
- 人工客服工作台已有会话接入/关闭能力，但缺少筛选会让已结束会话与待处理会话混在一起；按处理中、已结束、全部分组更符合客服高频处理路径。

## 2026-06-01 主办方 / 平台管理员路径复核发现

- 平台管理员账号 `13800000001` 和主办方账号 `13800000002` 均可通过 `/api/user/login` 登录；返回角色分别为 `admin`、`organizer`。
- 管理员主路径接口可用：概览、活动、巡演草稿、场次、订单、退款、场馆、场馆审核、入驻审核、风险案例、恢复售票审核、站点变更审核、客服账号管理、运营驾驶舱均返回业务 `code=200`。
- 主办方主路径接口可用：概览、我的活动、巡演草稿、我的场次、订单、退款、场馆记录、我的场馆资料、风险待办均返回业务 `code=200`。
- 主办方访问管理员专属接口会被拒绝：入驻审核、客服账号管理、风险案例、站点变更审核、场馆审核均返回业务 `403`；`grab-service` 管理员驾驶舱对主办方返回 HTTP 403，属于预期拒绝。
- 前端路径发现两个入口不一致：`/console/tours` 和 `/console/venue` 已支持主办方业务，但主办方侧边栏原先没有入口；管理员也缺少巡演草稿管理的侧边栏入口。
- 部分管理员专属页主要依赖后端 403 防护；前端 layout 应补统一角色路径拦截，避免主办方直接输入管理员路径后短暂进入错误页面。

## 2026-06-08 评价系统正式化发现

- 新增生产分库表后，除了 SQL 和 manifest，还必须同步 `scripts/check-production-split-sql.ps1` 的 `$schemaColumns` 白名单；否则 manifest 会被误判为引用未知生产表。
- 新增带 FK 的表后，必须同步 `scripts/check-cross-owner-fks.ps1` 的 owner map；否则同服务内 FK 会被误判为未知跨 owner FK。
- 标准端口运行态可能仍是旧 Java/Next 进程：本轮 `8082 java-ticket` 对新增后台接口直连返回 HTTP 404，`3000` 对新增 `/console/activity-engagement` 返回 Next 404；临时 `18082` / `3002` 验证当前代码可用后，应重启真实服务再做最终标准 Gateway 复测。
- Docker 前端即使 bind mount 已能看到新页面，也可能因为 `/app/.next/dev` Turbopack 开发缓存/路由树不一致继续返回 Next 404；可先将 `/app/.next/dev` 挪到备份目录再重启 `omni-frontend`，本轮恢复后 `/console/activity-engagement` 返回 HTTP 200。
- `8082` 若由高权限/IDE Java 进程占用，Codex 侧 `Stop-Process` 和 `taskkill` 可能都会返回 `Access is denied`；这种情况下需要在原启动端手动重启 `java-ticket`。
- 活动详情评价内容出现问号字符来自当前 seed 文本显示问题，不是本轮评价入口逻辑；后续如要做演示观感，需要单独检查 seed 编码。

## 2026-06-08 阶段 7 运营分析与异常闭环发现

- 阶段 7 不应从新建 MQ/ES 埋点开始；当前系统已有 `/console` 运营驾驶舱、`/console/exception-tasks` 异常任务、`/console/reconciliation` 日结对账、退款列表、抢票 ops summary 和操作审计。
- `ExceptionWorkbenchService` 已能创建异常任务，表 `exception_task` 有 `status`、`result`、`operator_id`、`operator_role` 字段，但 `listByStatus` 当前没有按 `status` 过滤；控制台页面也只展示和新建，缺少认领、处理、关闭动作。
- `ReconciliationService` 已能生成批次、落 details/differences、查看批次详情；`reconciliation_difference` 当前只有 `status` 和 `reason`，没有处理说明、处理人、更新时间字段。第一轮可先用现有 `status` 做处理/忽略闭环，后续再补审计化字段。
- 本地 `omni_user` 运行库状态：`exception_task` 当前有 `pending=5`、`resolved=1`；`reconciliation_difference` 当前有 `open=1`，可作为阶段 7 第一轮处理动作验收样本。
- `/console` 已能从运营驾驶舱进入异常任务和日结对账，所以第一轮应优先补处理页动作和批次状态收敛，而不是新增孤立运营页面。
- 新增 `java-common` DTO 后，如果只重启 `java-user` 但未先 `mvn -pl java-common install -DskipTests`，运行态可能拿不到新增 DTO；本轮已先安装 common，再由用户重启 `java-user`。
- Docker 前端仍会出现源码已更新但页面旧渲染的问题；本轮容器内源码可见新按钮，但浏览器无按钮，移动 `/app/.next/dev` 到备份并重启 `omni-frontend` 后恢复。

## 2026-06-09 阶段 7 二轮数据源发现

- `/console` 当前已在前端分散调用 `getAdminSummary`、`getGrabOpsSummary`、`listAdminRefunds`、`listExceptionTasks`、`listReconciliationBatches` 和 `listOperationAuditLogs` 拼出运营驾驶舱；二轮更适合抽出只读运营摘要接口，减少前端多接口拼装。
- `java-ticket` 的 `AdminSummaryService` 已通过合法 internal API 聚合活动、场次、票档、订单、支付超时、风控命中和热门活动；`ActivityMarketingService` 已有单活动 `funnelSteps`，其中曝光和详情页当前为 0，想看/候补、下单、支付、取消可由现有数据计算。
- `grab-service` 已有 `/api/grab/admin/ops-summary`，包含抢票失败原因分布和候补转化率；本地 `omni_grab` 有 `grab_request`、`waitlist_entry`、`waitlist_offer` 表，当前样本包括 SOLD_OUT、ORDER_CREATED、LIMITED、FAILED、EXPIRED、PENDING_RECOVERY 等状态。
- 本地 `omni_ticket_split.performance_subscription` 当前样本：`ACTIVITY_WANT=4`、`ARTIST_FOLLOW=7`、`SALE_REMINDER=1`、`WAITLIST_REMINDER=1`，可作为阶段 7 二轮“兴趣/提醒”摘要来源。
- 本地 `omni_order."order"` 当前样本：`status=2` 31 笔、`status=3` 643 笔、`status=4` 11 笔；本地 `omni_payment.refund_request` 当前样本：`status=1` 6 笔、`status=4` 4 笔。状态含义需要沿用现有前后端常量，不在文案中裸露数字。
- 二轮实现边界：不在 `java-user` 新增跨库 Mapper，不直接跨库 join；平台聚合应通过现有或新增 internal API 拉取各服务摘要，`X-Internal-Token` 必须校验。
- 标准端口运行态复测时，`8081 java-user` 和 `8082 java-ticket` 进程启动时间早于本轮 class 编译时间；`GET /api/user/console/ops-summary` 在 `8081` 和 Gateway `8088` 均返回 HTTP 404，根因是旧 Java 进程未加载新增 mapping。
- 当前 Codex 进程无法停止标准端口 Java 进程，`Stop-Process` 对 `8081` 返回 `Access is denied`；需要在原启动终端或 IDEA 中手动重启真实 `java-user` 和 `java-ticket` 后做标准端口最终验收。
- 非侵入隔离验证可用：`java-ticket:18082` 使用当前代码、`omni_ticket_split`，并通过 Nacos 只发现不注册来调用标准 user/order/payment；`java-user:18081` 使用当前代码、`omni_user`，显式调用 `java-ticket:18082`、标准 payment/grab。该链路验证聚合接口业务 `code=200`，且 ticket 新字段已进入 funnel。
- 标准 Java 服务重启后，Gateway 和前端代理均可访问 `/api/user/console/ops-summary`；前端容器源码已有新页面但旧 `.next/dev` 编译产物未包含“运营漏斗摘要”，将 `/app/.next/dev` 备份为 stale 目录并重启 `omni-frontend` 后，`/console` 浏览器页面恢复新驾驶舱区块。

## 2026-06-09 阶段 8 第一轮 SaaS 评估发现

- 阶段 8 不应直接安装 `@sentry/nextjs` 或 `posthog-js`；当前最小闭环是先形成独立评估文档，明确用途、数据边界、环境变量、免费额度风险和关闭方案。
- Sentry 第一轮更适合只做前端错误监控和 release 标识；`tracesSampleRate`、Session Replay、source map 上传和 Java APM 都应后置，避免隐私面、token 管理和额度消耗一次性扩大。
- Sentry Developer 免费额度当前适合小流量试点，但 5k errors 和 50 replays 容易被异常风暴或 replay 默认开启消耗；第一轮必须默认关闭 replay 和 tracing。
- PostHog 第一轮更适合做 allowlist 自定义事件设计，补 Phase 7 运营漏斗缺失的真实前端行为信号；不能替代后端 ticket/order/payment/grab 权威数据。
- PostHog 免费额度虽然包含 1M analytics events，但 autocapture、Session Replay 和列表曝光类埋点会快速放大事件量；第一轮必须禁用 autocapture 和 Session Replay。
- 两个 SaaS 都必须以环境变量总开关控制，本地和测试环境默认 disabled；禁用态应无外部网络请求，且不能影响登录、购票、支付、退款、客服和控制台。

## 2026-06-09 阶段 8 第二轮顺序确认

- 用户明确确认阶段 8 顺序应为“先接 Sentry 保证线上问题可追，再按产品分析需求接 PostHog”。
- Sentry 第二轮试点应先做前端错误追踪、release 标识、route 归一和敏感字段脱敏；PostHog 只保留在后续产品分析阶段，不和 Sentry 同批接入。
- 安装 `@sentry/nextjs` 属于依赖下载和 lockfile 改动，必须先获得明确授权；未授权前只能完成实施计划和不依赖 SDK 的本地脱敏设计。
- `@sentry/nextjs` 10.56.0 安装后会带入 `@sentry/cli` build script；本轮不上传 source map，因此已用 `pnpm approve-builds "!@sentry/cli"` 将该 build script 明确设为不允许运行。
- Sentry disabled 态已在临时前端 `3002` 验证：平台管理员访问 `/console` 可见“运营漏斗摘要”，浏览器 warning/error 为 0，resource entries 中没有 `sentry` / `ingest` 请求。
- 启用态事件验收仍需要真实 Sentry DSN；没有 DSN 时不应伪造外部上报，也不应在聊天输出真实 DSN。
- 即使第一轮只计划前端错误监控，`sentry.server.config.ts` 和 `sentry.edge.config.ts` 一旦存在启用开关，也必须复用同一套脱敏策略；否则后续误开 `SENTRY_SERVER_ENABLED` / `SENTRY_EDGE_ENABLED` 时可能上报请求上下文。当前已通过公共 `getSentryServerConfig`、`scrubSentryEvent` 和 `scrubSentryBreadcrumb` 统一 browser/server/edge 防护。

## 2026-06-09 阶段 8 第三轮 PostHog 本地外壳发现

- PostHog 可以先落地不依赖 SDK 的本地 wrapper：事件 allowlist、属性过滤、环境开关和可注入 transport 都能用 `node --test` 验证，避免在没有真实产品分析 token 前产生外部写入。
- `NEXT_PUBLIC_POSTHOG_ENABLED=true` 不能单独代表可发送；必须同时具备 project token、host 和 transport。当前 `createAnalyticsTracker()` 在缺少任一条件时返回 no-op，不影响页面操作。
- 事件属性过滤必须同时按事件 allowlist 和敏感 key/value 双层过滤；仅允许 `order_created` 这类事件并不意味着可以发送 `orderId`、`userId`、`conversationId` 或带 query 的 URL。
- 当前实现不调用 `identify()`，并固定 `personProfiles='never'`；第一轮只保留匿名产品行为信号，不能替代后端 ticket/order/payment/grab 权威业务数据。
- 后续安装 `posthog-js` 时，页面仍不应直接调用 SDK；应只把 SDK `capture()` 作为 `AnalyticsTransport` 接入 `frontend/src/lib/analytics.ts`。
## 2026-06-09 阶段 8 第四轮 PostHog 页面接入发现

- 页面级接入应只调用 `captureAnalyticsEvent()`，继续由 `analytics.ts` 统一做 enabled/token/host/transport gating、事件 allowlist 和属性脱敏。
- 搜索页只发送 `keyword_present`，不发送搜索原词；订单页只发送支付渠道、同步结果和入口来源，不发送订单号。
- 活动详情页的 `omni_order_created` 只在 grab 返回 `orderId` 或 `ORDER_CREATED` 时发送，避免把排队成功误记为已成单。
- 控制台运营摘要事件只发送角色和漏斗步数桶；异常任务和对账入口点击事件不发送具体任务、批次或审计 ID。
- 当前页面接入仍然没有 `posthog-js` 依赖，也没有 SDK transport；即使环境变量设置为 enabled，未注入 transport 时默认返回 `false`，不会外部写入。
- 标准 `3000` 浏览器验收需要等待 React 数据落屏后再取证；`/activity/900002` 和 `/console` 首次快照可能停在加载/校验文案，但对应 API 已返回 200，等待后关键内容可见且无 PostHog 类请求。

## 2026-06-09 阶段 9 入场核验同步发现

- 入场核验第一阶段已经从“只有内部核验状态更新”推进到“order 记录归档 + ticket 控制台 facade + 前端只读入口”：电子票最终状态和每次核验请求记录都归 `java-order`，主办方和平台管理员通过 `java-ticket` admin API 查询。
- `sessionId=910011` 是当前 real-demo 标准验收样本：概览总票数 1、已验票 1、未入场 0、失败 1、重复扫码 1，记录覆盖成功、重复扫码和停用设备失败。
- 普通用户不能查询控制台核验接口；Gateway 返回业务 `403 无权限`，符合普通用户只能生成自己的入场码、不能调用核验写/查后台能力的边界。
- `frontend/src/app/console/check-in/page.tsx` 当前定位正确：只读入场概览和核验记录，不提供扫码核验按钮，避免把备用 Web 验票页误当主流程。
- 阶段 9 后续应继续做“角色旅程总审计”，而不是重复实现入场核验第一阶段；未完成的仍是全角色入口清单、按钮有效性、种子数据演示覆盖和生产前 mock/默认密钥清理。

## 2026-06-09 阶段 9 全角色旅程审计发现

- 6 类角色默认落点和 RBAC 基本一致：平台管理员、主办方、普通用户、客服主管、普通客服、平台主办方运营员均能通过标准 Gateway 登录，并在标准前端进入对应首页或工作台，关键页面 console error 为 0。
- 普通用户 real-demo seed 覆盖较完整：订单、票夹、退款、候补、通知、客服会话均有只读数据，能支撑 C 端从浏览到履约后的主要演示。
- 平台管理员当前主路径覆盖度最高：运营摘要、异常任务、日结对账、评价审核、入场核验、客服账号和主办方运营分配均有业务 `code=200` 证据。
- 主办方退款处理 P1 缺口已关闭：已补 `REFREAL985009`，关联 `980006`、`910006`、`900006` 和主办方 `2003`；主办方访问 `GET /api/payment/refunds/admin` 返回 1 条，浏览器 `/console/refunds` 可见待审核退款和同意/拒绝按钮。
- 普通客服默认工作台 P1 缺口已关闭：已补 `988102`，状态 `WAITING_AGENT`、未分配且 `slaOverdue=false`；普通客服访问 `GET /api/user/support/agent/conversations?queue=pending` 返回 1 条，浏览器 `/support` 默认显示“待处理 1”并展示订单、退款、票夹、候补、抢票和通知上下文。
- `support_conversation_audit.action` 受 `chk_support_conversation_audit_action` 约束限制，允许值不包含 `REQUEST_HUMAN`；seed 审计记录应使用已有业务动作如 `TRANSFERRED`，不要为演示数据放宽 schema 约束。
- 平台主办方运营员用户可见文案已收口，但内部 role code 仍沿用 `organizer_admin`；本轮只确认兼容可用，不建议在未设计兼容迁移前直接改 role code。
- 本轮审计边界是只读入口和数据可见性；审核、退款处理、对账处理、评价处理、客服回复等写动作仍需要后续用可回滚样本逐项验收。
- `/notifications/settings` 路由存在，但本轮只验证了通知列表 API 计数；下一轮应补普通用户浏览器访问通知偏好页，确认中文状态和保存入口。

## 2026-06-09 阶段 9 可回滚写动作发现

- 退款审核的“同意退款”不是本地纯写路径：当前 `RefundService.approve()` 会进入 Alipay refund 调用链，未获得明确外部写授权前不应作为常规演示验收动作。
- `REFREAL985009` 适合作为主办方退款审核的本地写动作样本：使用“拒绝退款”可验证权限、审核状态、审核人和通知链路入口，同时通过重新导入 real-demo seed 恢复待审核基线。
- `988102` 适合作为普通客服工作台的本地写动作样本：认领动作可验证 pending 队列到 `ASSIGNED` 的状态变化，同时通过重新导入 real-demo seed 恢复未分配待处理基线。
- `REAL-DEMO-20260603` 的开放对账差异适合作为平台管理员处理动作样本，但差异 ID 在 seed 重新导入后会变化；后续脚本和手工验收都应按 `batch_no` 和 `status='open'` 动态查找。
- 写动作验收后应立即恢复 seed 基线并复查 API 可见性，避免演示环境被留在已拒绝、已认领或已处理状态。

## 2026-06-09 阶段 9 通知偏好页发现

- `/notifications/settings` 当前适合作为只读偏好说明页：站内通知保持开启，短信通道未接入前不可启用，两个状态按钮均为 disabled。
- 普通用户浏览器路径已闭环：标准 `3000` 前端登录态下可直接访问通知偏好页，中文状态文案清晰，且 console warning/error 为 0。
- 本轮没有保存按钮写动作，也没有修改用户通知偏好；如果后续接入短信或邮件通道，需要先补后端偏好持久化、禁用态测试和真实保存回滚样本。

## 2026-06-09 阶段 9 支付与退款发现

- 主办方“同意退款”已经确认不是本地可稳定闭环动作：`RefundService.approve()` 会真实进入 Alipay sandbox refund 调用链，本轮授权实测出现 `status=3` 失败和 Gateway 504 两类结果；后续只能作为外部 sandbox 授权实测项，不能作为常规演示稳定通过项。
- `REFREAL985009` 仍适合作为退款审核演示基线，但完成同意/拒绝任一写动作后都应立即 re-seed，并用 verifier 确认 `status=0`，避免把演示环境留在失败、处理中或已审核状态。
- 支付弹窗如果继续依赖 `/api/payment/alipay/qr-pay`，会在 QR precreate 慢或失败时连弹窗都无法及时出现；更稳的前端交互是先调用 `/api/payment/alipay/page-pay`，在弹窗二维码区域提供“打开支付宝沙盒支付页面”链接。
- page-pay 弹窗应继续保留本地订单支付状态轮询：用户在支付宝沙盒新窗口完成支付后，仍通过“我已完成付款”触发 `/api/payment/alipay/sync/{orderId}`，不在前端假设支付已成功。
- 浏览器验收发现 Gateway 取消临时订单曾返回 HTTP 504，但直连 `java-order:8083` 可取消成功；这更像 Gateway/链路超时问题，不影响本轮 page-pay 弹窗结论，但后续支付/取消链路压测时应纳入观察。

## 2026-06-09 阶段 10 默认配置与演示降级风险发现

- `grab-service` 原先在 `JWT_SECRET` 缺失时使用硬编码 `DEFAULT_JWT_SECRET='omni-jwt-secretomni-jwt-secretomni-jwt-secret'` 验签，这会让缺少配置的环境接受可猜默认 token；已改为缺少 `JWT_SECRET` 时拒绝请求并返回 `JWT 未配置`。
- `start-project.ps1` 和 `docker-compose.yml` 会为本地开发注入 `JWT_SECRET`，所以移除 grab-service 运行时代码 fallback 不会破坏正常本地启动；如果服务单独启动且未设置密钥，应显式失败。
- 固定短信验证码 P0 已关闭默认风险：`java-user` 的 `UserController.sendCode()` 和 `UserService` 短信登录/重置/改密都受 `omni.sms.mock.enabled=false` 默认开关控制；缺省生产态不返回验证码，也不接受固定 `666666`。
- 本地演示仍需显式打开 mock 短信：`start-project.ps1` 仅对 `java-user` 注入 `--omni.sms.mock.enabled=true`；如果用户用 IDEA 或手工命令启动 `java-user` 且希望演示短信验证码，需要同样显式带上该参数。
- 前端不能静态暗示固定验证码永远可用；登录、找回密码和账号设置页不应展示本地演示验证码，未返回 code 或误返回 code 时都应只提示按短信提示输入。
- Java 基础 `application.yml` 的 `${INTERNAL_API_TOKEN:omni-local-internal-token}` 可以保留给默认本地 profile，但 `prod-split` 必须显式覆盖为 `${INTERNAL_API_TOKEN}`；否则 staging/production 缺少环境变量时会静默继承本地默认 token。
- `scripts/check-production-runtime-defaults.ps1` 是当前生产默认值守护入口：它检查四个需要 internal token 的服务在 prod-split 中无 fallback，并检查五个连接数据库的服务都要求 `${SPRING_DATASOURCE_PASSWORD}`。
- 基础 `application.yml` 的 `${POSTGRES_PASSWORD:123456}` 仍用于默认本地兼容；当前生产态依赖 `prod-split` 覆盖和静态检查阻断，不建议把默认 profile 改成生产专用配置。
- Docker Compose 生产边界已收口：root `docker-compose.yml` 明确声明 `x-omni-compose-scope: local-development-only`，允许保留本地演示 fallback；`docker-compose.production.example.yml` 对 `JWT_SECRET`、`INTERNAL_API_TOKEN`、`GRAB_DB_PASSWORD`、`RABBITMQ_PASSWORD` 使用必填环境变量且不提供 fallback，避免本地默认值被误用到生产部署。
- `scripts/check-production-runtime-defaults.ps1` 现在同时检查 Java `prod-split` 默认值和 Compose 生产模板边界；后续如果新增生产 Compose 敏感变量，应同步加入该脚本的必填清单。
- `java-payment` 默认 profile 可保留 Alipay sandbox fallback 作为本地演示兼容，但 `prod-split` 必须显式覆盖 Alipay 配置为环境变量；否则生产环境缺少变量时会继承 sandbox appId、密钥、公钥和 localhost return-url。
- `ALIPAY_NOTIFY_URL` 在生产态应作为必填项处理，不能默认空字符串；否则真实支付/退款链路可能只能依赖同步查询，回调不可追踪。
- `mock-qr-fallback-enabled` 和 `mock-qr-auto-confirm-enabled` 在 `prod-split` 中应固定为 `false`，不允许通过生产 profile 继承或打开二维码 mock/自动确认降级。
- `java-order` 和 `java-notification` 的控制器也曾存在与 grab-service 同源的硬编码 JWT fallback：缺少 `jwt.secret` / `JWT_SECRET` 时仍会使用 `omni-jwt-secretomni-jwt-secretomni-jwt-secret` 验签；该风险已通过移除运行时代码 fallback 和 prod-split 强制 `JWT_SECRET` 关闭。
- 默认本地 profile 可以允许 JWT 缺失后公共接口鉴权失败，但生产 profile 必须失败在配置注入阶段；因此 `java-order` / `java-notification` 的 `application-prod-split.yml` 需要保留 `jwt.secret: ${JWT_SECRET}`，不能改回空默认值。
- `scripts/check-production-runtime-defaults.ps1` 后续应继续扫描生产 Java 源码中的硬编码 JWT fallback；测试代码中可保留测试密钥常量，但生产 `src/main/java` 不应出现可猜默认 JWT 密钥。
- `java-notification` 不只是用户 JWT 公共接口服务，也有 `X-Internal-Token` 保护的 internal 通知消息、通知事件和按用户通知查询接口；因此它的 `prod-split` 也必须显式要求 `internal.api.token: ${INTERNAL_API_TOKEN}`，不能只要求 datasource 和 JWT。
- 生产环境变量清单应作为守护对象存在，而不只是口头约定；当前 `docs/production-readiness/production-env-vars.md` 已纳入 `scripts/check-production-runtime-defaults.ps1`，后续新增生产必填变量时要同步文档和脚本清单。
- `docker-compose.production.example.yml` 当前覆盖基础设施、`grab-service` 和 `frontend`，不覆盖 Java 五服务镜像编排；Java 服务真实生产部署需要由进程管理器或容器平台按 `production-env-vars.md` 注入各自 `prod-split` 环境变量。
- Windows PowerShell 下复杂 `rg` 正则和 `docker-compose*.yml` 这类 glob 容易因引号或文件名通配失败；后续扫描生产变量时优先用单引号 pattern 和明确文件路径。
- Java 业务服务的 RabbitMQ 配置不能只在生产环境变量清单中写“应该注入”；如果 `prod-split` 不覆盖，Spring 会继承基础 `application.yml` 的 `localhost/admin/123456` fallback 或框架默认值。当前五个 Java 业务服务已统一要求 `RABBITMQ_HOST`、`RABBITMQ_PORT`、`RABBITMQ_USER`、`RABBITMQ_PASSWORD`。
- `java-payment` 虽然基础 `application.yml` 没有 `spring.rabbitmq` 段，但它通过 `java-common` 传入 AMQP starter，并有 `NotificationMqProducer(RabbitTemplate)` 用于退款通知事件；生产 RabbitMQ 注入清单必须把它列入。
- 后续新增任一 `RabbitTemplate` 生产者或 `@RabbitListener` 消费者时，都应确认所属服务在 `application-prod-split.yml` 中已有 RabbitMQ 显式环境变量覆盖，并同步 `scripts/check-production-runtime-defaults.ps1`。
- Java 业务服务的 `spring.cloud.nacos.discovery/config.server-addr` 也会从基础 `application.yml` 继承本地 `localhost:8848` fallback；生产 profile 需要显式写入 `${NACOS_HOST}:${NACOS_PORT}`，不能只在部署文档里口头要求。
- `java-ticket`、`java-order`、`java-payment` 的 Seata 配置需要和 Nacos 一起收口：`SEATA_ENABLED` 不应在 `prod-split` 默认 `true`，Seata registry/config 的 Nacos 地址也不能保留 localhost fallback。
- Gateway 虽然不连接业务数据库，但生产仍需要 `application-prod-split.yml` 覆盖 Nacos discovery/config；否则生产网关会继续使用基础 profile 的本地注册中心默认值。
- Gateway 抢票相关路由不能用 `application-prod-split.properties` 只覆盖 `routes[12].uri` / `routes[13].uri`；Spring Boot 对 list 是整体覆盖，稀疏覆盖会导致 Gateway route binder 认为 route 不完整并启动失败。当前应在 `application-prod-split.yml` 中提供完整 route list，并让 `waitlist-service` / `grab-service` 使用 `GATEWAY_WAITLIST_SERVICE_URI` / `GATEWAY_GRAB_SERVICE_URI` 必填变量。
- PowerShell 脚本检查 `${VAR:default}` 这类 Spring 占位符时不要用双引号字符串；双引号会触发变量插值，可能把检查退化成弱匹配。优先使用单引号字面量或明确正则。
- `grab-service` 运行时代码也不能保留服务 URL 或基础设施本地 fallback：订单、票务、通知、数据库、Redis、RabbitMQ 缺变量时应启动失败并给中文错误，而不是静默打到 `localhost` 或使用 `postgres/admin/123456`。
- `TICKET_SERVICE_URL` 和 `NOTIFICATION_SERVICE_URL` 现在是 `grab-service` 生产必填项，不再回退 `ORDER_SERVICE_URL` 或 `API_GATEWAY_URL`；本地脚本和 compose 必须显式设置为 `http://localhost:8088` / `http://host.docker.internal:8088`。
- 生产 Compose 示例即使内含 Redis/RabbitMQ 服务，也应通过 `${REDIS_HOST:?}`、`${RABBITMQ_HOST:?}` 等变量显式注入到 `grab-service`，避免示例拓扑被误当成真实生产默认值。
- `grab-service` bootstrap 的现有测试要求底层 HTTP server 使用显式 backlog；保持该能力需要先 `app.init()`，再调用 `getHttpServer().listen(port, host, 2048, cb)`，不要退回 `app.listen(port, host)`。
- `frontend/src/lib/server-proxy.ts` 也属于生产运行时入口：如果缺少 `API_PROXY_TARGET` 仍回退 `http://localhost:8088`，生产前端容器会静默打到容器自身或错误主机。当前已改为缺变量直接返回业务 `503 后端代理目标未配置`，且不调用 `fetch`。
- 本地开发代理目标应只由 `docker-compose.yml`、`start-project.ps1` 或开发终端显式注入；生产 Compose 示例和 `docs/production-readiness/production-env-vars.md` 必须继续把 `API_PROXY_TARGET` 作为必填变量。
- 首页 API 失败时不能回退 `mockCategories`、`mockSections` 或 mock banner；这些数据会把后端不可用伪装成仍有演出，且 banner 会指向不存在的 `/activity/c1` 等假 ID。当前首页已改为真实失败态，banner 来自真实活动列表。
- `Footer` 使用静态站点链接可以保留，但不应从 `mock-data` 模块导入；否则首页组件链仍会触达包含假活动和假 banner 的模块。当前已迁移到 `frontend/src/lib/site-links.ts`。
- `/api/payment/mock/pay` 不能在默认态可用；即使 `MockPaymentService` 保留给本地演示或定向测试，控制器入口也必须先受 `omni.payment.mock.enabled=false` 默认 gate 保护，且 `prod-split` 明确固定为 false。
- 生产默认值守护脚本应避免新增中文字面量；Windows PowerShell 嵌套 `-File` 读取无 BOM UTF-8 脚本时可能把中文字符串解析坏。脚本用 ASCII 标识做静态守护，中文用户文案交给 Java/前端测试覆盖。
- `java-notification` 的新事件链路可以用 `DisabledSmsSender` 明确记录短信渠道未配置，但旧 `/api/notification/send-sms` 和 `/api/notification/send-email` 不应默认落库并打印“模拟发送”日志；这些直发入口必须受 `omni.notification.direct-channel.enabled=false` gate 保护。
- 旧短信/邮件直发入口的禁用检查应发生在 body 解析前；这样生产默认态不会因为缺少 `content` 暴露 NPE，也不会把“未真实发送”的 SMS/EMAIL 记录写入通知表。
- `/api/payment/pay` 这种旧入口即使已经返回失败，也不能在错误文案里继续引导“演示模拟支付接口”；mock 支付默认关闭后，失败态应只指向支付宝 page-pay 链路，避免前端或排障误用模拟支付。
- 前端短信验证码默认文案不能出现“本地演示环境”或“本地演示返回提示”；即使后端显式返回本地验证码 `code`，页面也不应动态展示“本地演示验证码为 ...”，生产默认态应是“请按短信提示输入”。
- 登录页只应展示真实接通的认证方式；扫码登录和第三方 OAuth 未实现前，不应显示 tab、按钮或外部图标资源，否则会形成空点击入口并误导用户认为平台已支持这些登录能力。
- 控制台活动列表这类运营页面也应避免保留“暂不支持”式未闭环提示；即使分支正常不可达，运行代码里也应给出明确处理路径，例如进入巡演详情查看城市站点状态并按流程重新发布。
- 生产 `prod-split` 去掉本地 fallback 后，IDEA 运行配置需要同步本地变量；否则会先在 `SEATA_ENABLED`、`NACOS_HOST`、`RABBITMQ_HOST`、`SPRING_DATASOURCE_PASSWORD` 等占位符处失败。IDEA 本地配置可以注入本地值，但不能把生产 profile 改回带默认值。
- 控制台生产页面不应直接调用浏览器原生 `alert()`；失败反馈应复用 `GlobalDialog` 的 `globalAlert()`，保持中文弹窗样式、遮罩层和交互行为一致。
- C 端按钮不能只弹出“已记录/已提交”假成功；如果语义是客服介入、人工处理或待办创建，必须调用真实后端链路或跳转到已有真实流程。本轮订单退款客服介入已改为创建人工客服会话并携带订单/退款上下文。
- 页脚、登录页页脚这类静态区域也属于生产入口面：备案号、应用下载、站点名、顶部辅助项或共享链接数据源如果没有真实目标，不应使用 `href="#"` / `href: '#'` 或手型指针伪装成可点击入口；当前已改为真实链接才渲染 `<a>`，无目标项渲染普通文本。
- 登录、注册、找回密码等认证入口不能借用 Damai / Taobao / Alibaba 的帮助页、客服页、协议页或投诉邮箱；这些会把万象用户导向外部平台。已有真实入口应使用内部 `/help`、`/merchant`，未接通的协议/品牌/招聘/防骗类内容先渲染为普通文本。
- 活动详情页推荐不能用硬编码明星、固定演出或外部借用海报伪装真实推荐；推荐区属于生产导购入口，应从真实活动候选召回，排除当前活动和不可推荐状态，再按类目、城市、艺人、时间、价格、浏览信号和多样性排序。接口失败或候选不足时应隐藏模块，不回退到 mock、外部热图或固定数组。
- 真实演示 seed 中艺人头像不能长期复用活动海报；至少重点艺人应有独立本地头像归档、来源页和 verifier 检查。BY2 / 胡夏 已拆到 `seed-artist-avatars-real`，后续扩展更多真实艺人时沿用 `artist-avatars.json`。
- 后端新增业务通知不应继续使用 `TODO` 作为投递类型；`TODO` 可以作为前端历史待办通知兼容，但 `java-ticket` 新增风险通知应投递正式 `IN_APP`，由前端内容识别为 `RISK_*` 后进入风险工作台。
- 活动详情页不应展示没有真实业务闭环的静态二维码图片；如果没有活动专属二维码、应用下载页或可验证跳转链路，应退回真实购票前提醒，而不是使用 `/1.png` 这类占位图片和“手机扫一扫”文案。
- 前端运行态技术命名也属于生产痕迹：localStorage key、浏览器事件、通用类型模块和 CSS token 不应继续使用借用品牌命名。迁移时应保留旧浏览器 key 的一次性读取迁移，避免用户现有登录态直接失效。
- 阶段 10 继续清理生产前端体验时，统一弹窗组件本身也不能保留原生浏览器弹窗 fallback。即使 `GlobalDialog` 已挂在根布局，挂载前调用仍可能触发 `window.alert` / `window.confirm` / `window.prompt`，造成样式不一致和浏览器阻塞。更稳妥的做法是模块级排队，等根弹窗注册后串行展示；如果根弹窗未挂载，测试应直接暴露入口缺失，而不是静默退回原生弹窗。
- 已从生产入口移除的 public 占位资源也应同步删除，而不是只清理引用；否则后续代码仍可能重新引用旧二维码、旧海报或旧站点图标。站点 favicon 应直接来自万象项目标识；用户指定源图时不要重绘或调色，应按原色图标生成多尺寸 ICO，并用静态测试固定文件不存在、ICO 格式、颜色采样和细线结构。
- `frontend/public` 中无生产引用的大图也属于生产风险面：即使当前页面不再导入，公开可访问的 `carousel.png` 这类旧轮播图仍可能被误用为 banner 或推荐占位。清理策略应先用 `rg` 排除生产引用，再删除文件并用静态测试固定不存在，避免误删真实 seed 海报和艺人头像。
- 品牌资源清理要区分“当前入口资源”和“旧宣传图”：`logo.svg` 仍被 Header / LoginHeader 使用，`background.png` 仍是多页面兜底背景，不能因为文件大就删；`logo.png` 是未引用的旧宣传横幅，适合删除并用测试固定不存在，避免后续被误当作站点单图标或首页背景。
- 生产入口不导入 mock 数据后，空的 `mock-data.ts` 模块也不应继续留在 `frontend/src/lib`；空数组导出虽然当前无害，但会给后续页面提供一个看似可用的 mock fallback 入口。删除模块并更新索引，比只靠“不导入”守护更彻底。
- 小程序目录也属于仓库生产入口风险面，不能因为当前主流程在 Web 端就保留本地 mock 活动和 `/api/payment/mock/pay` 支付旁路。未接入真实小程序支付时，应明确展示“小程序支付未接入”，引导用户到网页端订单页走正式支付宝链路，而不是伪造支付成功。
## 2026-06-10 阶段 10 第三十三轮发现：小程序订单页演示交易残留

- 小程序支付入口已从 mock pay 改为支付说明后，订单确认页仍保留“毕设演示用户”和“毕业设计演示流程，不产生真实交易，不调用微信支付”。这些是运行时用户可见文案，不应被 README 的“演示项目”定位掩盖。
- 订单确认页应优先展示当前登录缓存中的用户信息，手机号只做脱敏展示；未登录时可提示“请先登录后确认”，真正提交仍由现有 token 校验拦截。
- 未接入微信支付不等于可以宣称“不产生真实交易”。更准确的口径是：小程序支付通道未接入，订单创建后到网页端订单页完成支付宝支付，订单状态以后端为准。
- 样式类名里的 `mock-button` 也属于可复用的生产痕迹。虽然不直接展示给用户，但会误导后续维护者把支付说明按钮继续当作 mock 入口。

## 2026-06-10 阶段 10 第三十四轮发现：小程序个人页测试账号快捷入口

- 用户可见个人页不应提供“一键登录测试账号”，也不应在运行代码中硬编码测试手机号和密码；这会绕过真实认证输入路径，并把测试账号当成正式入口。
- `apiBaseUrl` 可以作为开发配置存在于小程序运行配置中，但不应直接展示给用户。生产入口展示本地网关地址会泄露实现细节，也会误导用户把接口环境当作业务状态。
- 退出登录不能只清本地 storage；如果 `app.globalData.user` 不同步恢复未登录态，个人页重新渲染时仍可能短暂显示旧用户信息。
- 订单错误空态同样属于生产文案面，“登录测试账号后”应改为“登录后”，避免从其它页面继续把测试账号引导回来。

## 2026-06-10 阶段 10 第三十五轮发现：小程序本地网关默认值

- 小程序默认配置中的 `http://localhost:8088` 和前端 server proxy 的 `http://localhost:8088` 风险性质一致：生产打包后会静默指向错误主机，因此不能作为仓库默认 fallback。
- 小程序可以继续通过 `app.globalData.apiBaseUrl` 接收本地或正式网关地址，但默认值应为空；缺配置时应失败并提示“小程序接口地址未配置”，而不是自动打本地服务。
- 用户可见错误文案不应要求“确认后端已启动”。这属于开发排障语言，运行入口应展示“服务暂不可用，请稍后重试”这类业务口径。
- README 也需要和运行代码同步：移除一键测试账号说明，明确本地联调需要自行配置网关地址。

## 2026-06-10 阶段 10 第三十六轮发现：小程序模块已移除

- 用户已明确小程序部分删除，不需要继续修改；因此后续不要再新增小程序页面、测试或文档维护项。
- 已删除的 `miniprogram/` 不应再被路线文件当作生产入口；阶段 10 后续清理应继续聚焦 Web 前端、Java 微服务、Nest 抢票服务和运行配置默认值。
- 第三十二到三十五轮的小程序记录保留为历史收口证据，但不再作为当前待维护模块的验收依据。

## 2026-06-10 阶段 10 第三十七轮发现：支付/通知通用模块不应自称模拟服务

- `MockPaymentService` 和 `/api/payment/mock/pay` 可以保留在显式本地开关后，但通用 `PaymentService`、`java-payment` 模块描述和通知核心服务不应继续写“沙盒版 / 模拟支付 / 模拟短信通知”。否则生产模块会被维护者误读为仍是模拟实现。
- 这类命名残留不是功能 bug，但属于生产前可维护性风险：排障、审计或交付说明容易把真实支付宝 page-pay、回调、通知直发 gate 与本地模拟能力混在一起。
- 更准确的口径是：显式本地能力可以叫“本地支付确认记录”或“直发记录”，生产默认入口仍由 gate 禁用，真实支付和通知链路按正式服务说明表达。

## 2026-06-10 阶段 10 第三十八到四十一轮发现：支付和 grab-service 默认值继续收口

- 本地支付确认能力保留在 `omni.payment.mock.enabled=false` 默认 gate 后时，用户可见文案也不能继续写“模拟支付”。禁用态应表达“当前环境未启用本地支付确认”，成功态应表达“本地支付确认成功”，避免排障时把本地确认旁路当作正式支付链路的一部分。
- `java-payment` 基础 `application.yml` 不能携带 Alipay sandbox gateway、appId、密钥或 localhost return-url fallback。即使 `prod-split` 已强制生产环境变量覆盖，基础 profile 中的沙盒凭据也会扩大误启动和误部署风险；更稳妥的本地兼容方式是空默认占位，由本地运行配置显式注入。
- 生产默认值守护应同时检查 `prod-split` 和基础 profile：`prod-split` 负责阻断生产缺变量启动，基础 profile 检查负责防止仓库默认配置携带真实或沙盒凭据。
- `grab-service` 的监听地址属于容器可达性边界，不应在缺少 `GRAB_SERVICE_HOST` 时回退 `127.0.0.1`。本地开发脚本可以显式注入 `127.0.0.1`，生产容器应显式注入 `0.0.0.0`。
- `PaymentConfirmationService` 是共用支付确认服务，不应暴露 `confirmMockPayment` 方法名。mock 命名应只留在显式本地入口或测试边界内，共用服务方法应表达“本地支付确认”或正式确认职责。

## 2026-06-10 阶段 10 第四十二轮发现：Feign 注解层 localhost fallback 也需要守护

- `prod-split` profile 收紧后，不能只检查 YAML；Feign 注解里的 `${property:default}` 同样会在缺配置时生效。`java-user` 到 `grab-service` 的运营摘要和客服上下文客户端如果保留 `http://localhost:3001` fallback，生产缺少 `GRAB_SERVICE_URL` 时不会快速失败。
- 更稳妥的边界是：Feign 注解只引用 `${omni.grab-service.url}`，本地基础 profile 提供开发默认值，`prod-split` 用 `${GRAB_SERVICE_URL}` 强制显式注入；本地脚本和 IDEA 再单独注入本机地址。
- 短信 mock 返回验证码属于后端本地调试能力；前端生产入口不应展示“本地演示验证码”这类环境文案。即使后端误返回 code，界面也应保持“验证码已发送，请按短信提示输入。”的生产中性提示。

## 2026-06-10 阶段 10 第四十三轮发现：通知偏好页不应暴露短信供应商接入状态

- 通知偏好页属于普通用户可见入口，`暂未接入短信供应商` 和“短信通道接入前”会把外部供应商进度当成产品状态暴露出来；这类实现细节不应出现在用户运行页面。
- 当前更合适的口径是保留事实但改成产品语言：站内消息已开启，短信通知暂不可用，开放后可在偏好页开启。这样不伪装短信已发送，也不暴露供应商接入细节。
- 这不等同于新增“必须接入真实短信供应商”的路线门禁；当前生产默认边界仍是短信验证码和通知直发默认禁用，前端不展示本地验证码，真实短信供应商接入可作为后续外部账号/资费工作单独推进。

## 2026-06-10 阶段 10 第四十四轮发现：SeatCraft 扇形区不能前后端各算一套

- 扇形座位布局属于可售库存生成前置能力，前端预览和后端落库规则必须一致；否则主办方在 SeatCraft 中看到的座位数会和后端实际生成座位数不一致。
- 当前后端权威规则是 `seatsPerRow` 固定每排座数，前端不应按弧长自动估算座位数。`seatSpacing` 可以继续影响网格和多边形布局，但扇形容量应由 `rows * seatsPerRow` 决定。
- 新建扇形区不能默认 `seatsPerRow: null`；后端会把缺少 `seatsPerRow` 视为几何参数错误。前端控制面板必须让主办方显式看到并调整“每排座数”。

## 2026-06-10 阶段 10 第四十五轮发现：外部观测门禁不能用本地结果替代

- 当前本地可验证项已经有 fresh 证据覆盖：前端全量静态测试、类型检查、生产默认值守护、微服务边界、真实 demo seed verifier、grab-service Jest 和 diff 检查均通过。
- Sentry disabled 态和脱敏逻辑可以本地验证；但“真实 DSN 启用态事件可见且无敏感字段泄露”必须依赖外部 Sentry 项目侧确认，当前环境没有 DSN，不能模拟为通过。
- PostHog allowlist wrapper 和页面级 no-op 接入可以本地验证；但 `posthog-js` transport、真实 token/host、浏览器 Network disabled/enabled 行为必须在用户授权依赖安装并提供真实项目配置后验收。
- 因此外部门禁应继续留在路线文件中，不应为了“总路线完成”而勾选；当前可交付口径只能是“本地生产前收口完成，外部观测/产品分析启用验收待凭据和授权”。

## 2026-06-10 阶段 10 第四十六轮发现：当前已经是严格外部门禁阻塞

- Sentry 的剩余验收不是“再写一个本地测试”能解决的问题；真正要求是事件到达 Sentry 项目侧，并确认上报内容脱敏。没有真实 DSN 时，只能验证 gated config 和 sanitizer，不能验证线上可追。
- PostHog 的剩余验收也不是 wrapper 逻辑缺口；当前 wrapper 已经支持注入 transport，页面也只调用统一 `captureAnalyticsEvent()`。真正剩余是用户授权安装 `posthog-js`、提供真实 token/host，并用浏览器 Network 验证 disabled/enabled 行为。
- 在这个状态下继续新增 mock、占位 token、伪 DSN、假 transport 或本地日志 transport 都会降低验收质量，因为它们不能证明外部 SaaS 实际可见，也不能证明生产网络行为正确。

## 2026-06-10 阶段 10 第四十七轮发现：SDK 接入不能绕过 wrapper

- `posthog-js` 安装后，页面层仍不应直接 import SDK；统一在 `instrumentation-client.ts` 初始化 transport，再让页面继续调用 `captureAnalyticsEvent()`，这样 allowlist、脱敏和 disabled gate 都保持单一出口。
- 安装 SDK 后的 disabled 态 Network 验收口径要区分“本地打包 chunk”和“外部上报请求”。出现 `posthog-js_dist_module...js` 本地 chunk 是依赖进入客户端 bundle 的结果，不等于外部写入；外部请求应看 `https://...posthog...`、`/capture`、`/decide`、`/ingest` 等非本机资源。
- 即使环境变量误把 autocapture、pageview 或 Session Replay 设为 `true`，第一轮 SDK 初始化仍应强制关闭这些能力；需要打开时必须另起隐私评估和用户告知流程。

## 2026-06-10 阶段 10 第四十八轮发现：安装后本地回归不能替代外部项目侧确认

- `posthog-js` 已经按授权安装并接入现有 wrapper，当前本地可证明的是：缺少真实 token/host 时不会产生外部 PostHog 请求，且页面层仍受 allowlist 和脱敏保护。
- 真实 enabled 态验收仍必须依赖 `NEXT_PUBLIC_POSTHOG_ENABLED=true`、真实 `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` 和真实 `NEXT_PUBLIC_POSTHOG_HOST`；浏览器 Network 要看到预期外部请求，PostHog 项目侧也要能看到 allowlist 事件和脱敏属性。
- Sentry 同理：没有真实 `NEXT_PUBLIC_SENTRY_DSN`、`SENTRY_ENVIRONMENT`、`SENTRY_RELEASE` 时，只能证明本地 gated config 和 sanitizer，不能证明线上事件可追。
- 因此总路线当前状态应保持为“本地生产前收口完成，外部观测/产品分析 enabled 验收待真实凭据”。第四十九轮已按用户确认把凭据缺失项改为生产运维后置，不再阻塞当前总路线，但仍不能声明外部项目侧验收已通过。

## 2026-06-10 阶段 10 第四十九轮发现：外部 SaaS 可以作为生产运维上线前补充

- 将 Sentry/PostHog 真实 enabled 态项目侧验收后置到生产运维阶段是合理的：这类验收依赖真实外部项目、真实 DSN/token/host、环境变量注入和外部平台可见性，属于上线前运维准备，而不是本地代码继续修改能补齐的证据。
- 当前总路线可以按“本地生产前收口完成”结束，但表述必须严格：已完成的是默认关闭、脱敏、allowlist、SDK transport、无配置不外发、关闭方案和本地回归；未完成且后置的是 Sentry/PostHog 真实项目侧 enabled 验收。
- 生产运维阶段补充时，应使用真实试点环境触发少量事件并核对外部平台，不应在仓库写入真实凭据，也不应用 mock DSN、占位 token、假 transport 或本地日志替代外部验收。

## 2026-06-11 阶段 13 待办发现：后台枚举和技术字段仍有裸露

- 用户截图显示平台后台仍有多处中英掺杂：站点变更审核展示 `change_schedule`，日志对象展示 `station_config_version` / `venue_application`，异常任务展示 `PAYMENT_TIMEOUT` / `REFUND_UNKNOWN` / `TICKET_ISSUE` / `STOCK_SYNC` / `RISK_REVIEW` / `RECONCILE_DIFF`，对账批次摘要展示 `paidOrderCount` / `refundAbnormalCount` / `diffCount`。
- 这些字段属于后端枚举、对象类型或统计字段名，不应作为用户主要阅读信息直接出现；需要在前端或返回 DTO 层建立统一中文映射，保留 TraceId、批次号、订单号等技术标识时也要配中文列名和业务说明。

## 2026-06-11 支付 page-pay 500 发现

- `POST /api/payment/alipay/page-pay` 在 `3000` 前端代理、`8088` 网关和 `8084` 支付服务直连均返回同一个 `{"code":500,"message":"服务内部错误"}`，根因不在前端代理或 Gateway。
- 本地订单库证据：`omni_order."order"` 中订单 `980057` 为 `status=1` 待支付；支付库证据：`omni_payment.payment` 已生成订单 `980057` 的 `ALIPAY` 待支付流水，说明调用链已经走过订单校验和本地支付流水创建，失败点在支付宝页面支付表单生成阶段。
- 代码根因：`AlipayService.createPagePay()` 只捕获 `AlipayApiException`，未捕获支付宝 SDK 或配置异常可能抛出的 `RuntimeException`；同时 `${ALIPAY_APP_ID}` 这类未解析占位符会通过 `StringUtils.hasText()`，导致缺 IDEA 环境变量时继续向后调用，最终表现为通用 500。

## 2026-06-11 订单座位与链路耗时发现

- 订单 `DM202606110047432ACEBE` 已支付且已出票；`order_snapshot.seat_selection_mode = NONE`，`order_seat` 无记录，`electronic_ticket.seat_label` 为空。这不是座位仍在生成，而是该票档无固定座位，前端把空 `seatLabels` 兜底为“座位信息生成中”导致误导。
- `java-order` 的订单列表 DTO 已返回 `seatSelectionMode`，但前端 `OrderEntity` 未声明该字段，订单列表和订单详情也没有使用该字段区分无座票、待支付订单和真正的座位待确认。
- AI 客服慢不应先归因到 Gateway。网关对客服流式接口 `support-stream-service` 已配置 `response-timeout=-1`；本机 `http://localhost:11434/api/tags` 能看到 `Qwen2.5:7b`，直接调用一次 Ollama `/api/chat` 约 `10435ms`，说明慢点主要在本地模型推理或 FAQ 未命中后的模型回落。
- 抢票出票慢也不是单纯 Gateway 问题。最近两笔 `omni_grab.grab_request` 从创建到 `ORDER_CREATED` 分别约 `0.520s` 和 `1.716s`；订单 `980058` 支付确认后电子票写入只比订单更新时间晚约 `0.087s`。用户感知的慢更可能出现在支付同步、抢票进度轮询、下游订单接口调用失败重试或页面状态文案。
- `omni-grab-service` 日志仍出现 `GrabCompensationService` 的 `订单查询失败` / `fetch failed`，说明抢票服务到订单服务的内部调用链存在运行态不稳定。容器内探针显示通过 Gateway 调 `http://host.docker.internal:8088/api/order/internal/980058` 约 `111ms`，直连 `http://host.docker.internal:8083/api/order/internal/980058` 约 `12ms`；票务 internal 通过 Gateway 约 `29ms`，直连 `8082` 约 `14ms`。后续耗时治理应把 grab-service 的内部 `ORDER_SERVICE_URL` / `TICKET_SERVICE_URL` 从 Gateway 路径改为直连服务，并单独保留 Gateway 作为外部入口。

## 2026-06-11 阶段 14 链路耗时治理发现：内部调用不应绕 Gateway

- `grab-service` 的订单和票务调用属于服务间 internal API，不是浏览器入口；本地默认经 Gateway 访问 order/ticket 会增加一次路由、鉴权和网络跳转，且会把下游服务失败误表现为“网关慢”。
- 本轮把本地 `docker-compose.yml` 中 `ORDER_SERVICE_URL` 调整为 `http://host.docker.internal:8083`，`TICKET_SERVICE_URL` 调整为 `http://host.docker.internal:8082`；`start-project.ps1` 中对应改为 `http://localhost:8083` 和 `http://localhost:8082`。
- `NOTIFICATION_SERVICE_URL` 暂时保留 Gateway 路径，因为本轮证据只覆盖订单和票务 internal 链路；通知链路后续应单独测量投递耗时、重试和失败告警。
- 已用生产默认值守护脚本固化本地启动口径，防止后续把 `grab-service` 的 order/ticket internal URL 又改回 `8088`。当前正在运行的 `omni-grab-service` 容器如果仍是旧环境变量，需要重新创建或用 `start-project.ps1` 重启对应进程后才会加载新 URL。

## 2026-06-11 阶段 14 链路耗时治理发现：本地模型耗时需要单独留证

- `scripts/measure-gateway-latency.ps1` 已支持 `-IncludeOllama`，默认仍只输出 Gateway/direct 6 行基线；开启后额外输出 `ollama.tags` 和 `ollama.chat`，并标记为 `mode=local-model`。这样能把本地模型可用性和推理耗时从 Gateway、前端代理、业务服务直连耗时里拆出来。
- 本轮脚本测试覆盖两类场景：默认关闭 Ollama 探测时不输出模型行；开启 Ollama 且端口不可用时输出中文错误，不让诊断脚本崩溃。
- 本机实测样本显示 Gateway/direct 业务接口仍是几十到一百毫秒量级，而 `ollama.chat` 约 `3152.92ms`。如果 AI 客服 FAQ 未命中后进入本地模型回落，用户感知慢点更可能在模型推理，不应继续只归因于 Gateway。
- 脚本源码不要直接把中文默认 prompt 写进 PowerShell 参数默认值；当前用 Unicode 码点生成默认中文 prompt，避免 Windows PowerShell 编码视图把中文字符串读坏并造成解析错误。

## 2026-06-11 阶段 11 订单详情时间线发现：退款状态不能只藏在售后卡片

- 订单详情顶部原本只按订单状态渲染三步流程。对已支付且存在退款单的订单，顶部第三步仍会显示“出票入场”，用户必须继续阅读下方“退款与售后”模块才知道退款审核、处理中、失败或完成状态。
- 更符合普通用户路径的做法是：顶部时间线保留“提交订单 / 支付或取消 / 后续履约”三段结构，但第三段优先吸收最新退款单状态；下方退款卡片继续展示完整退款单号、金额、审核备注和三步退款流程。
- 最新退款单映射应保持中文业务语义：`status=0` 显示“退款审核中”，`status=4` 显示“退款处理中”，`status=2` 显示“退款已拒绝”，`status=3` 显示“退款失败”，`status=1` 显示“退款完成”。未知状态显示“退款状态同步中”，不要暴露数字状态码。

## 2026-06-11 阶段 11 通知动作闭环发现：退款通知需要专属语义

- 通知中心已有订单、候补、小队、客服和风险类动作映射，但 `REFUND_*` 类型此前会落入泛化站内消息或泛化订单入口，用户只能看到“查看相关订单”，不能直接理解这是退款进度提醒。
- 退款通知应统一显示为“退款通知”，并在有 `orderId` 时跳转 `/orders/{orderId}`，让订单详情顶部时间线和退款售后卡片承接后续解释；无 `orderId` 时降级到 `/orders`，但按钮文案仍应保持“查看退款订单”。
- 当前前端只补类型映射和动作路由，不改变后端投递结构；后续如果后端新增 `actionHref/actionLabel`，仍由后端动作元数据优先覆盖本地兜底映射。

## 2026-06-11 阶段 11 搜索推荐发现：右栏推荐不应只取当前结果前四条

- 搜索页右侧“您可能还喜欢”此前直接渲染当前搜索结果前 4 条，用户刚看过某类演出或某个艺人后，搜索页不会吸收近期浏览偏好；如果当前结果顺序较宽泛，右栏推荐也只是重复列表头部。
- 当前前端已有 `omni_activity_view_signals`，活动详情页和首页已使用该本地信号；搜索页可以在不引入新依赖、不伪造后端推荐 API 的前提下复用该信号，对真实搜索候选按类目、艺人、城市做轻量排序。
- 搜索页推荐仍应坚持真实候选边界：过滤已浏览活动，去重后用接口返回的真实活动补满；如果没有候选则隐藏右栏，不使用 mock 活动、硬编码演出或离线降级来伪装推荐能力。
- 后续如果进入 ES/后端推荐 API 阶段，前端右栏应优先使用后端返回的推荐理由和排序，但仍可保留本地浏览信号作为无后端推荐时的轻量兜底。

## 2026-06-11 阶段 11 搜索空结果发现：近期浏览可以作为真实召回而不是假推荐

- 当前空结果态已有“相关演出”和“相邻城市”，但相关演出依赖 fallback 活动查询；当关键词本身很冷门或筛选过严时，fallback 也可能为空，用户只能清空筛选或离开。
- `omni_activity_view_signals` 里保存的活动标题、类目、城市来自用户真实浏览过的活动，可以作为“最近浏览”召回入口；这不同于 mock 推荐，因为它不生成不存在的活动，也不绕过后端搜索接口。
- 最近浏览召回应单独标为“最近浏览”，不要混入“相关演出”，否则会让用户误以为冷门关键词真的匹配到了这些活动。点击最近浏览标题后仍走搜索页真实查询，由后端返回当前可见结果。

## 2026-06-11 阶段 11 搜索联想发现：近期浏览信号应参与建议但不替代真实搜索

- 搜索联想此前只从搜索历史、热门词和当前结果标题/场馆生成；当用户刚浏览了某个艺人或活动后，搜索页输入同一艺人关键字不会主动召回该浏览信号。
- 近期浏览里的活动标题和艺人名适合参与联想，因为它们来自真实活动详情页，不会引入假活动；但它们只能作为搜索词建议，点击后仍应走真实搜索接口返回当前结果。
- 联想应继续使用原有去重和关键词包含规则，避免把无关浏览历史全部铺出来，造成搜索建议噪声。

## 2026-06-11 阶段 11 订阅入口发现：空态应承接真实浏览历史而不伪造订阅

- `/subscriptions` 已经具备真实订阅列表、城市关注、日历导出、取消订阅和活动详情页订阅动作，但空态此前只提示“可在活动详情页添加”，用户没有可点击的下一步。
- 近期浏览信号适合作为空态导流来源，因为它来自真实活动详情页；但订阅页不应直接伪造“开启成功”，也不应绕过活动详情页的售卖状态、艺人 ID 和登录态校验。
- 更稳妥的闭环是：订阅页空态只展示最近浏览活动并跳回 `/activity/{activityId}`；未开售或未知状态提示“开启开售提醒”，已开售提示“去添加想看”，有艺人名时补“也可关注某艺人”。真正创建/取消订阅仍由活动详情页已有后端接口完成。
- 浏览信号需要保存活动 `status`，否则空态无法区分已开售活动和未开售活动，容易在已开售活动上误导用户寻找不存在的开售提醒按钮。

## 2026-06-11 阶段 11 候补/小队去 ID 化发现：兜底也不能把技术 ID 当主信息

- 候补页正常情况下已经使用 `activityName`、`sessionTime`、`ticketTypeName` 和 `venueName`，但后端上下文缺失时旧兜底会显示“场次 {sessionId} / 票档 {ticketTypeId}”。这类信息对用户不可解释，应改为“活动信息同步中 / 票档信息同步中”。
- 小队房间也有同类问题：活动上下文缺失时旧 helper 显示“活动 {activityId} / 场次 {sessionId} / 票档 {ticketTypeId}”，页面还直接展示“小队房间 #{team.id}”“小队 ID”“requestId {requestId}”“用户 {userId}”和座位 fallback `seatId/orderSeatId`。
- 用户需要的是房间状态、成员确认、策略、锁票订单是否已生成、进度是否同步和可操作按钮；`team.id`、`requestId`、`userId`、`seatId/orderSeatId` 应留在接口、URL 或调试日志中，不应作为 C 端主视觉信息。
- 仍然保留邀请链接和邀请码，因为这是小队协作的真实操作入口；链接中包含路由 ID 属于导航目标，不再额外把“小队 ID”作为文案展示或复制。

## 2026-06-11 阶段 13 后台中文化发现：查询参数要转成业务编号文案

- 控制台入场核验页的后端契约仍然使用 `sessionId`，但面向主办方和平台管理员的查询入口不应展示“场次 ID”作为表单标签或错误提示。
- “场次编号”比“场次 ID”更贴近业务语境，同时不改变实际传参、接口和数据库字段；`requestId` 这类追踪字段可以继续展示具体值，但列名必须是“请求号”等中文业务说明。
- 这一类治理适合用静态入口测试守护，防止后续页面改动重新把后端字段名或英文枚举裸露到控制台主界面。

## 2026-06-11 阶段 13 后台中文化发现：审计引用值要带业务对象语境

- 操作审计页可以保留可追踪编号，但筛选框和目标引用不应直接写“操作人ID”“ID：88”这类数据库字段口吻。
- 同一个数字在审计里含义不同：`support_account` 应是“客服账号编号”，`organizer_ops_assignment` 应是“负责人编号”，未知目标才使用“对象编号”兜底。
- 这类改动不应重命名 `operatorId`、`targetId`、`targetRef` 等接口字段；前端显示层统一转换即可降低后端契约变更风险。

## 2026-06-11 阶段 13 后台中文化发现：对账未知枚举不能原样回显

- 对账页原本对未知 `status`、`sourceType`、`businessType`、`diffType` 使用 `return value || '-'`，新增后端码值时会把英文/下划线枚举直接暴露给平台管理员。
- 已知枚举应继续精确映射，例如 `generated` 显示“已生成”、`amount_mismatch` 显示“金额不一致”；未知枚举则显示“未知状态 / 未知来源 / 未知业务类型 / 未知差异类型”，避免把内部码值当业务解释。
- 对账页和操作审计页都依赖这些展示规则，后续新增对账字段时应优先扩展 `operation-display.ts`，不要在页面里散落本地 formatter。

## 2026-06-11 阶段 13 后台中文化发现：站点变更类型也要防未来码值泄露

- 站点变更审核页已经使用 `formatStationConfigChangeType()` 映射 `change_schedule` 等已知类型，但 formatter 旧逻辑对未知值会返回原始码值。
- 即使后端当前校验了允许的 `changeType`，前端展示层也应对未来新增类型防御性兜底，显示“未知变更类型”比裸露 `future_change_type` 更符合后台中文化要求。
- 后续新增站点变更类型时，只需要扩展 `STATION_CONFIG_CHANGE_TYPE_LABELS`，页面不应复制一份本地映射。

## 2026-06-11 阶段 13 后台中文化发现：异常任务展示也要防未来码值泄露

- 异常任务页已使用 `formatExceptionTaskType()`、`formatExceptionSeverity()` 和 `formatExceptionStatus()`，但旧 formatter 对未知值会返回原始后端码值。
- 异常任务类型、等级、状态都属于业务解释字段；新增类型尚未映射时，页面应显示“未知异常类型 / 未知等级 / 未知状态”，避免 `FUTURE_TASK` 这类码值直接进入后台主表格。
- 后续新增异常任务类型时，应先补 `EXCEPTION_TASK_TYPE_LABELS` 和测试，再接页面或后端投递。

## 2026-06-11 阶段 13 后台中文化发现：审计枚举未知值也要有中文解释

- 操作审计日志的角色、动作和对象类型是后台追责入口的核心解释字段，旧 formatter 对未知值会直接显示 `future_role`、`future.action` 或 `future_target`。
- 未知审计枚举应显示“未知角色 / 未知操作 / 未知对象”，避免平台管理员把内部码值当成业务含义；具体原始码值仍可保留在后端日志和 trace 链路中。
- 后续新增审计 action 或 target type 时，应先扩展 `OPERATION_ACTION_LABELS` / `OPERATION_TARGET_TYPE_LABELS` 和测试，再让页面展示新业务语义。

## 2026-06-11 阶段 13 后台中文化发现：对账摘要未知字段不能裸露字段名

- 对账摘要 JSON 已覆盖 `paidOrderCount`、`refundAbnormalCount`、`diffCount` 等当前字段，但旧 formatter 对未来新增字段会直接返回 `futureMetricCount`。
- 摘要字段名属于后端统计字段，不适合作为用户可读标签；未知字段统一显示“其他指标”，已知字段继续通过 `RECONCILIATION_SUMMARY_KEY_LABELS` 精确映射。
- 如果未来需要展示新增指标的准确业务含义，应先扩展映射表和测试，而不是依赖字段名自动展示。

## 2026-06-11 阶段 13 后台中文化发现：退款审核表格编号要带业务语境

- 退款审核页原本表头写“用户ID”，订单补充信息写 `ID: {refund.orderId}`，虽然值可用于追踪，但缺少中文业务语境。
- “用户编号”和“订单编号”可以保留追踪能力，同时避免把后端字段口吻直接放到主办方/平台管理员主表格。
- 这类改动只属于展示层治理，不应重命名 `refund.userId`、`refund.orderId` 或改变退款审核接口。

## 2026-06-11 阶段 12 报表导出发现：退款明细导出要少给内部字段

- 订单页已有 CSV 导出，退款审核页此前只有列表和审核动作，没有退款明细导出入口。
- 退款明细报表可以用前端 `Blob` 生成 CSV，不需要新增依赖；导出字段应限定为退款号、订单号、活动、金额、状态、原因和时间线。
- `RefundRequestVO` 里的 `userId`、`paymentId`、`reviewerId`、`alipayRefundNo`、内部 `orderId` 适合留在接口和服务端追踪里，不应进入主办方可下载报表。

## 2026-06-11 阶段 12 报表导出发现：退款 Excel 导出应复用同一套脱敏字段

- Excel 明细导出不需要引入新依赖；对当前退款审核页来说，带 UTF-8 BOM 的 HTML table `.xls` 已能满足 Excel 打开和中文显示需求。
- `.xls` 版本必须和 CSV 使用同一套业务字段：退款号、订单号、活动、金额、状态、原因、申请时间、审核时间、到账时间；不要因为表格可读性更强而额外加入内部追踪字段。
- HTML 表格单元格必须转义 `<`、`>`、`&`、`"`、`'`，避免活动名或原因里的特殊字符破坏导出文件结构；退款状态继续复用中文展示层，不直接导出后端状态码。

## 2026-06-11 阶段 12 报表导出发现：核验记录导出只给业务排查所需字段

- 入场核验页已有请求号、票号、设备、渠道、结果和失败原因，足够支持主办方做现场复盘和异常核对；此前缺少可下载报表入口，现场人员只能在页面里查当前列表。
- 核验记录 CSV 可以继续用前端 `Blob` 生成，不需要新增依赖；导出字段应限定为请求号、票号、设备、渠道、结果、失败原因和核验时间。
- `CheckInRecordVO` 里的 `ticketId`、`orderId`、`userId`、`sessionId`、`ticketTypeId`、`operatorUserId` 属于服务端关联和追踪字段，适合留在接口、日志或后台问题定位里，不应进入主办方下载报表。

## 2026-06-11 阶段 12 报表导出发现：核验 Excel 导出也不能扩散内部关联编号

- 入场核验 Excel 明细应和 CSV 使用同一套字段，不应因为 Excel 更适合人工筛选就额外加入 `ticketId`、`orderId`、`userId`、`sessionId`、`ticketTypeId` 或 `operatorUserId`。
- 核验结果应导出中文状态“成功 / 重复 / 失败 / 未知结果”，不要把 `SUCCESS`、`DUPLICATE`、`FAILED` 直接暴露给主办方现场人员。
- 设备、渠道和失败原因来自现场输入或设备上报，HTML 表格必须转义特殊字符，避免 `<`、`>`、`&` 等字符破坏 `.xls` 文件结构。

## 2026-06-11 阶段 12 报表导出发现：日结对账单应复用中文显示层

- 日结对账页已有批次列表、批次详情、对账明细和差异记录，但此前只能在线查看，缺少可下载的对账单。
- 对账单导出应复用 `operation-display.ts` 里已有的对账来源、业务类型、差异类型和状态 formatter；否则 CSV 会重新暴露 `local`、`matched`、`amount_mismatch`、`open` 这类后端码值。
- `ReconciliationBatchVO`、`ReconciliationDetailVO` 和 `ReconciliationDifferenceVO` 的行级 `id` 适合留在接口和调试定位里；主办方/平台下载报表只需要批次号、业务日期、业务号、金额、状态、原因和生成时间。

## 2026-06-11 阶段 12 报表导出发现：对账 Excel 必须和 CSV 共用 formatter

- 日结对账 Excel 明细应复用 CSV 的同一套表头和行构建逻辑，避免后续只改 CSV 或只改 Excel 时字段漂移。
- Excel 导出必须继续通过 `formatReconciliationSource()`、`formatReconciliationBusinessType()`、`formatReconciliationDiffType()`、`formatReconciliationDetailStatus()` 和 `formatReconciliationDifferenceStatus()` 输出中文业务标签，不应把 `local`、`payment`、`amount_mismatch`、`matched`、`open` 等码值写入下载文件。
- 差异原因可能包含人工输入内容，HTML 表格同样需要转义特殊字符；导出文件只用于运营核对，不应加入行级数据库 `id`。

## 2026-06-11 阶段 12 报表导出发现：场次报表应聚焦经营维度而不是数据库字段

- 场次列表当前已经具备活动、场馆、城市、时间、状态、票档数和库存统计，足够形成第一版场次维度经营报表，不需要新增后端接口或数据库字段。
- 下载报表应导出“活动 / 场馆 / 城市 / 开始时间 / 结束时间 / 状态 / 票档数 / 总库存 / 已售 / 余票”，而不是 `id`、`activityId`、`venueId` 等接口字段名。
- 当前实现导出的是页面已加载的当前页场次；如果后续需要“全量筛选结果导出”，应通过后端分页汇总或专用导出接口补齐，避免前端一次性拉取过大数据量。

## 2026-06-11 阶段 13 后台中文化发现：API 参数校验错误也要避免 ID 口吻

- `assertPositiveInteger()` 抛出的错误会直接进入前端失败提示链路；即使 API 字段仍叫 `activityId`、`sessionId`、`userId`，用户可见错误也不应显示“活动ID不正确 / 场次ID不正确 / 用户ID不正确”。
- 统一在 `formatParameterLabel()` 层把中文标签里的 `ID` 替换为“编号”，可以覆盖 `PARAMETER_LABELS` 映射和显式中文标签两类调用点，同时不改变接口字段名、URL 参数或请求体。
- 后续如果新增参数校验标签，应继续使用“对象编号”口径；技术字段名仍留在代码和接口层，不作为页面错误文案。

## 2026-06-11 阶段 13 后台中文化发现：控制台首页也要复用共享对账状态映射

- `/console` 首页“最近对账批次”此前有本地 `formatBatchStatus()`，未知批次状态会走 `return status || '-'` 原样展示后端码值。
- 该卡片虽然不是对账详情页，但同样面向平台管理员，是后台主入口；新增批次状态时应显示“未知状态”而不是英文/下划线内部枚举。
- 对账状态展示应统一走 `formatReconciliationBatchStatus()`，后续新增状态只扩展共享映射和测试，不在页面里复制本地 formatter。

## 2026-06-11 阶段 13 后台中文化发现：平台主办方运营页编号也要带业务语境

- `/console/organizer-ops` 同时面向平台管理员、客服主管和平台主办方运营角色，页面里原本存在“主办方 #”“运营员 #”“负责人ID”“主办方 ID”“ID：”和“操作人 {id}”这类数据库字段口吻。
- 这些数字仍有追踪价值，但应显示为“主办方编号”“负责人编号”“运营员编号”“操作人编号”，让后台用户知道编号指向的业务对象。
- 该治理只属于展示层，不应重命名 `organizerUserId`、`assignedOperatorId`、`operatorId` 等接口字段；后续新增运营审计行时应继续通过中文列名和对象编号说明保留可追踪性。

## 2026-06-11 阶段 13 后台中文化发现：审计日志列表不能只在筛选框中文化

- `/console/audit-logs` 的筛选框此前已使用“操作人编号”，但日志列表表头仍是“操作人”，单元格主值直接显示 `operatorId`，读起来像一个没有语境的数据库值。
- 审计日志可保留操作人编号用于追责和排查，但表头和单元格都应明确“操作人编号”，角色信息继续通过 `formatOperatorRole()` 展示中文角色。
- 这类改动仍属于展示层；`operatorId` 作为查询参数和 DTO 字段继续保留，不需要后端契约变更。

## 2026-06-11 阶段 13 后台中文化发现：场次列表兜底不能使用井号 ID

- `/console/sessions` 正常情况下展示活动名和场馆名，但当后端上下文缺失时旧兜底会显示“活动 #id / 场馆 #id”，这对主办方和平台管理员都不如“活动编号 / 场馆编号”清楚。
- 编辑场次时的场馆校验错误也应使用“场馆编号不正确”，避免在同一页面里混用“编号”和 `ID` 口吻。
- 该改动不改变 `activityId`、`venueId` 查询和提交字段；只是让缺失上下文时的展示仍然有中文业务语境。

## 2026-06-11 阶段 13 后台中文化发现：恢复售票和座位图默认标题也要去井号化

- 恢复售票审核页旧兜底展示“活动 #id”，并在下一行写“活动ID：{id}”；这和同类后台页面的“活动编号”口径不一致。
- 场馆座位图没有现成布局时会创建默认 SeatCraft 标题，旧标题“场馆 #id SeatCraft 座位图”也会进入后续可见配置名称，应改为“场馆编号：{id} SeatCraft 座位图”。
- 控制台保留编号本身没有问题，问题在于用 `#` 或 `ID` 当用户解释；后续新增兜底标题应统一使用“对象编号：值”。

## 2026-06-11 阶段 13 后台中文化发现：评价问答审核编号要标明对象

- `/console/activity-engagement` 是后台审核页，保留活动、订单、用户和评价编号有助于排查，但旧文案直接写“活动 {id} / 订单 {id} / 用户 {id} / 评价 {id}”，缺少明确的编号标签。
- 评价、举报和问答三类卡片应分别使用“活动编号”“订单编号”“用户编号”“评价编号”“举报用户编号”，让平台管理员知道数字指向哪个业务对象。
- 这类治理只改展示，不改变 `activityId`、`orderId`、`userId`、`reviewId` 等接口字段和审核动作接口。

## 2026-06-11 阶段 13 后台中文化发现：路由参数错误也属于用户可见文案

- 控制台多个详情页使用动态路由参数，但错误提示旧文案写“活动ID不正确”“场馆ID不正确”“巡演ID不正确”等；这些提示会在用户输入异常 URL、复制错误链接或路由参数损坏时直接显示。
- 与列表和表单口径一致，错误提示应使用“编号不正确”，既保留可追踪对象，又避免把后端字段名作为用户文案。
- 该改动不影响路由参数名和 API 字段，只调整错误提示字符串。

## 2026-06-11 阶段 13 后台中文化发现：风控和客服头部编号也要统一

- 风控案例页旧文案写“活动 ID：{activityId} · 主办 {organizerId}”，客服会话页旧文案写“用户 ID：{userId}”；这些都是后台用户可见的追踪信息。
- 与审计、对账、退款等页面一致，风控和客服页应显示“活动编号 / 主办方编号 / 用户编号”，避免不同后台模块使用不同的编号口径。
- 该改动只调整展示层；`activityId`、`organizerId`、`userId` 字段仍用于跳转和接口请求。

## 2026-06-11 阶段 13 后台中文化发现：场馆列表和艺人编辑也要避免裸 ID

- `/console/venue` 的场馆列表表头此前直接显示 `ID`，虽然单元格编号仍有追踪价值，但表头应说明这是“场馆编号”，否则后台用户看到的是数据库字段口吻。
- 艺人编辑页动态路由参数错误属于用户可见提示，异常链接或参数损坏时不应显示“艺人 ID 不正确”，应与其他控制台详情页统一为“艺人编号不正确”。
- 该治理只改展示层；`id`、`artistId`、`venue.id` 等字段继续用于路由、接口和排查，不需要后端契约或数据库变更。

## 2026-06-11 阶段 14 链路耗时发现：测量结果要能结构化留证

- `scripts/measure-gateway-latency.ps1` 原本能交互式展示 Gateway/direct/local-model 耗时，但缺少明确的场景字段和文件输出；不利于后续把多次样本按日期、环境、链路类型做趋势对比。
- 新增 `scenario=gateway-vs-direct/local-model` 后，`mode` 继续表示访问方式，`scenario` 表示诊断类别，避免把本地模型探测误混进网关直连差值。
- CSV/JSON 归档只记录测量结果，不写数据库、不触发支付/退款等业务写动作；关闭端口测试仍会输出结构化失败行，便于区分“服务不可用”和“脚本崩溃”。

## 2026-06-11 阶段 14 链路耗时发现：小队抢票需要独立于普通抢票记录

- `GrabWorkerService` 已有普通抢票 `claim/lock/order/confirm/ack` 分段日志，但 `TEAM_GRAB` 会委托给 `TeamGrabProcessorService`，如果只看 worker 的 `TEAM_GRAB_PROCESSED` 总耗时，无法判断慢点在小队锁座、票价读取、建单、确认落库还是通知成员。
- 小队抢票处理器应输出独立的“小队抢票链路耗时”日志，并保留 `teamGrabRequestId` 与 `grabRequestId`，方便把队伍域请求和通用抢票请求串起来。
- 通知成员耗时应单独记录为 `notificationMs`；通知慢或失败不应被误判为订单服务慢，也不应掩盖锁座/建单路径的真实耗时。

## 2026-06-11 阶段 14 链路耗时发现：支付确认慢点要和支付宝查询分开

- `AlipayService.syncByOrderId()` 既可能慢在支付宝查询，也可能慢在本地 `PaymentConfirmationService.confirmPayment()` 事务链路；如果只看 Gateway 或 sync 总耗时，无法判断是否卡在订单确认和出票履约。
- `PaymentConfirmationService.confirmPayment()` 的关键本地阶段是 `orderClient.markPaid()` 和 `paymentMapper.updateById()`；其中 `markPaid` 会进入 `java-order` 订单已支付和后续出票履约链路，应单独记录为 `orderMarkPaidMs`。
- 这类日志只记录本地确认阶段，不替代真实 Alipay sandbox enabled 验收；没有真实凭据时不能声称支付宝外部链路已验证。

## 2026-06-11 阶段 14 链路耗时发现：支付同步要有外层和确认层两级视角

- `/api/payment/alipay/sync/{orderId}` 的慢点至少分为订单读取、本地支付流水读取、支付宝查询、本地确认和确认后订单回查；只看 `PaymentConfirmationService` 仍无法判断是否慢在外部支付宝查询或订单回查。
- `AlipayService` 外层日志应输出 `orderLoadMs`、`paymentLoadMs`、`alipayQueryMs`、`confirmPaymentMs` 和 `orderReloadMs`；其中 `confirmPaymentMs` 可继续结合 `PaymentConfirmationService` 的 `orderMarkPaidMs` / `paymentUpdateMs` 下钻。
- 本地测试必须 mock `AlipayClient`，避免调用真实支付宝；该日志只增强本地可观测性，不替代真实支付宝沙箱 enabled 验收。

## 2026-06-11 阶段 14 链路耗时发现：订单履约要拆开状态更新、票务确认和出票

- payment 侧 `PaymentConfirmationService` 只能看到 `orderMarkPaidMs`，如果该阶段变慢，仍需要进入 `java-order` 判断慢点在订单状态更新、ticket 确认售出、电子票出票还是候补通知。
- `OrderService.markPaid()` 应输出 `orderLoadMs`、`statusUpdateMs`、`ticketConfirmMs`、`ticketIssueMs` 和 `waitlistNotifyMs`，其中 `ticketConfirmMs` 对应 ticket 内部确认库存/座位售出，`ticketIssueMs` 对应 `TicketWalletService.issueForPaidOrder()`。
- 该日志只能说明本地订单履约链路可下钻；如果真实支付同步仍慢，还需要结合 `AlipayService` 的 `alipayQueryMs`、`PaymentConfirmationService` 的 `orderMarkPaidMs` 和真实运行日志一起判断。
- 单模块 Maven 测试如果出现 `Type InternalAuthContextResponse not present`，不一定是依赖缺失；应先用 `javap` 检查 `java-order/target/classes` 里的 Feign client class 是否含 `Unresolved compilation problems`，必要时执行 `mvn -pl java-order clean compile -DskipTests` 清理旧坏 class。

## 2026-06-11 阶段 14 链路耗时发现：出票链路还要拆开幂等检查、观演人、座位和写票

- `OrderService.markPaid()` 的 `ticketIssueMs` 只能说明电子票出票服务整体耗时；如果该阶段变慢，还需要进入 `TicketWalletService.issueForPaidOrder()` 判断慢点在已出票幂等检查、观演人读取、座位读取还是电子票插入。
- `TicketWalletService.issueForPaidOrder()` 应输出 `existingCheckMs`、`attendeeLoadMs`、`seatLoadMs`、`ticketInsertMs`、`ticketCount` 和 `totalMs`；`ticketCount` 记录本次尝试完成的出票张数，便于区分单票慢和批量出票慢。
- 该日志不能改变幂等逻辑：无效订单仍直接跳过，已有电子票仍不重复插入，异常仍按原事务边界向外传播；日志只用于定位出票阶段慢点。

## 2026-06-11 阶段 14 链路耗时发现：AI 客服要同时记录来源、首字和回落原因

- `CustomerSupportService` 已在会话层记录 `conversationId`、`source`、`modelAttempted`、`fallbackReason`、`firstChunkMs` 和 `totalMs`；但 `SupportAiService` 本身也可能被直接调用，服务层应统一输出“AI客服回复链路耗时”，避免绕过会话层时丢失来源与回落原因。
- `source=faq` 表示常见问题命中，不应等待本地模型；`source=local-model` 表示进入本地模型并返回有效回答；`source=default` 且 `fallbackReason=本地模型未返回可用回答` 表示 FAQ 未命中后模型没有给出可用内容，最终用默认人工客服兜底。
- 该日志和 `scripts\measure-gateway-latency.ps1 -IncludeOllama` 的本地模型探针互补：探针证明 Ollama 标签/短 prompt 耗时，服务日志证明真实客服问题是否命中 FAQ、是否进入模型、首字响应和回落原因。

## 2026-06-11 阶段 13 后台中文化发现：控制台订单导出也不能用票档编号兜底

- 后台订单页和 CSV 导出原本各自拼 `ticketName || 票档 ${ticketTypeId}`，票档上下文缺失时会把内部票档编号直接作为业务名称展示或下载。
- 票档名缺失应统一显示“票档信息待同步”；如果未来需要展示“原票档 -> 实际票档”的降档路径，也应优先使用业务票档名或明确的中文编号语境，不应重新分散到页面本地 formatter。
- 订单列表和导出应共用 `getConsoleOrderTicketLabel()`，避免页面已经中文化但下载文件仍暴露 `ticketTypeId`。

## 2026-06-11 阶段 11 C 端评价展示发现：评论者身份不应回退到用户编号

- 活动详情“评价与问答”是 C 端公开页面，评价作者缺少昵称时不应显示“用户 {userId}”，这会把内部用户编号当作评论者身份暴露给普通用户。
- 当前 `ActivityReviewVO` 没有昵称字段，最小展示兜底应为“匿名用户”；后续如果后端补充脱敏昵称或头像，再由展示层优先使用脱敏昵称。
- `userId` 仍可留在接口、React key 组合和举报处理链路中；治理重点是用户可见文案，不是重命名 DTO 字段。

## 2026-06-11 阶段 11 近期浏览发现：标题缺失不能用活动编号当演出名

- `/history` 浏览记录页会同时使用本地近期浏览信号和后端浏览历史；当标题缺失时，旧兜底 `演出 ${activityId}` 会把内部活动编号当成演出名称。
- 最近浏览是搜索召回、订阅空态和用户继续浏览的入口，标题缺失应提示“演出信息待同步”，而不是制造一个看似真实的演出名。
- `activityId` 仍然必须保留用于跳转真实活动详情；展示层去编号化不影响召回和导航。

## 2026-06-11 阶段 13 客服会话发现：用户 fallback 要保留对象语境

- 客服工作台和控制台客服会话都优先展示昵称或脱敏手机号，但这些字段缺失时旧 fallback 会显示“用户 123”，数字含义不清晰且像数据库值。
- 后台客服场景可以保留 `userId` 追踪能力，但必须写成“用户编号：123”，和会话头部、风控、审计等后台编号口径一致。
- 该治理只属于显示层；会话筛选、客服接待、转交、上下文加载和审计链路仍继续使用原来的 `userId` 字段。

## 2026-06-11 阶段 13 客服上下文发现：排查卡片也要避免裸编号和原始状态

- `/support` 右侧用户上下文用于客服排查，可以保留订单、退款、票券、候补和通知编号，但不能用“订单 123 / 票券 456”这类裸数字当卡片标题。
- 业务号或标题缺失时应显示“对象编号：值”，让客服知道数字指向的对象类型；通知缺标题时不应回退 `type`，避免把后端通知类型码当标题。
- 抢票和候补上下文缺少中文进度解释时，应显示“状态待同步 / 等待释放票”这类中文待同步文案，不应直接回显 `request.status` 或 `item.status`。

## 2026-06-11 阶段 13 后台中文化发现：未知状态码不能原样回显

- `/console/activity-engagement` 的问答和举报状态属于后台审核工作流，未知码值如果直接 `return status`，会把 `PENDING_REVIEW` 这类后端枚举暴露成用户可见文案。
- `/console/tours/[id]` 的城市发布状态和配置状态同样需要固定中文兜底；未映射的新状态应显示“未知发布状态 / 未知配置状态”，而不是原始发布或审核码值。
- 这类治理只调整展示层 formatter；后续新增正式状态时仍应扩展映射和测试，但默认 fallback 必须保持中文业务文案。

## 2026-06-11 阶段 13 后台中文化发现：恢复售票审核状态也不能原样回显

- `/console/risk-resolutions` 的状态徽标面向平台管理员审核恢复售票申请，旧逻辑对未知值使用 `STATUS_LABEL[item.status] || item.status`，会把后端审核状态码直接展示到记录卡片。
- 未知状态应显示“未知审核状态”；具体原始码值应留在接口、日志和排查链路中，不应作为用户可见业务解释。
- 后续新增恢复售票审核状态时，应同步扩展 `STATUS_LABEL` 和 production-entry 测试，避免再次分散出现原样码值兜底。

## 2026-06-11 阶段 13 后台中文化发现：未知状态不能被静默隐藏

- `/console/risk-events` 原先对最新恢复申请状态只在 `STATUS_META` 命中时展示徽标；如果后端新增状态但前端未映射，页面不会显示任何恢复申请状态，后台用户会误以为没有最新审核进度。
- 对未知但存在的状态，应显示“未知审核状态”而不是隐藏徽标；隐藏只适用于没有最新恢复申请的活动。
- 这类问题和原样回显不同，但同属枚举展示治理：新增码值时前端必须保持可见、中文、可排查。

## 2026-06-11 阶段 13 后台中文化发现：降档路径编号必须标明原始对象和目标对象

- `/console/orders` 的自动降档路径原先显示 `#123 -> #456`，虽然数字对后台排查有价值，但裸井号缺少业务语境，用户无法确认它指向原票档还是实际票档。
- 降档路径应写成“原票档编号：123 → 实际票档编号：456”，既保留排查所需编号，又避免把内部 `ticketTypeId` 当成主要业务文案。
- 该治理只调整显示层；`requestedTicketTypeId` 和 `matchedTicketTypeId` 仍保留在接口、导出和调试链路中，不需要数据库或 DTO 变更。

## 2026-06-11 阶段 13 后台中文化发现：场馆审核未知状态不能显示为空

- `/console/venue/apply` 和 `/console/venue/applications` 原先直接渲染 `statusText[item.status]`；如果后端新增场馆审核状态但前端未映射，状态徽标会变成空白。
- 场馆资料审核属于后台工作流，未知状态应显示“未知场馆审核状态”，让主办方和平台管理员知道记录仍有状态但前端需要补映射。
- 该治理只调整展示层 formatter；`status` 数值仍由接口和审核动作继续使用，不需要数据库结构或 DTO 变更。

## 2026-06-11 阶段 13 后台中文化发现：风险案例页也要展示未知恢复状态

- `/console/risk-cases` 原先只在 `STATUS_META` 命中时展示恢复状态徽标；如果后端新增恢复状态，风险案例卡片会只剩“风险停票”，看不到最新恢复审核进度。
- 风险案例页和风险事件页应保持一致：有最新恢复状态但未映射时显示“未知审核状态”，而不是静默隐藏。
- 该治理只影响展示层；`latestResolutionStatus` 仍用于筛选、跳转和审核记录查询，不需要接口或数据库变更。

## 2026-06-11 阶段 11 C 端票夹发现：未知票券状态不能误导为已失效

- `/tickets` 的状态说明 helper 已把未知电子票状态解释为“状态同步中”，但状态徽标原先使用 `STATUS_META[status] || STATUS_META[3]`，会把未知状态显示成“已失效”。
- “已失效”意味着订单取消、退款或票券不可用；未知状态不能套用这个结论，应显示“状态同步中”，让用户知道需要刷新或查看订单详情。
- 该治理只调整前端展示；`status` 数值仍用于票夹筛选和入场/转赠动作判断，不需要后端或数据库变更。

## 2026-06-11 阶段 13 后台中文化发现：核验结果码也不能原样回显

- `/console/check-in` 的 CSV/Excel 导出层已经把未知核验结果映射为“未知结果”，但页面表格原先使用 `RESULT_LABELS[record.result] || record.result`，新结果码会直接暴露给后台用户。
- 入场核验结果是现场业务判断字段，未知结果应显示“未知结果”并保留中性样式，具体原始码值留在接口、日志或排查链路中，不应作为主表格文案。
- 该治理只调整页面展示层；`record.result` 仍用于筛选、导出和排查，不需要后端接口或数据库变更。

## 2026-06-11 阶段 11 C 端订单发现：未知订单状态不能误导为已取消

- `/orders` 的订单详情说明已把未知订单状态解释为“订单状态更新中”，但订单列表徽标原先使用 `STATUS_MAP[order.status] || STATUS_MAP[3]`，会把未知状态显示成“已取消”。
- “已取消”意味着用户订单已终止，未知状态不能套用这个结论；列表徽标应显示“订单状态更新中”，让用户知道需要刷新或进入详情确认。
- 该治理只调整前端展示；`order.status` 数值仍用于筛选、支付、退款、删除等动作判断，不需要后端或数据库变更。

## 2026-06-11 阶段 13 消息中心发现：未知通知类型不能误标为站内消息

- `getNotificationTypeMeta()` 原先对未知 `type` 使用 `TYPE_META[key] || TYPE_META.IN_APP`，新通知类型会被显示成“站内消息”，用户无法区分是普通站内消息还是前端尚未映射的新业务通知。
- 未知通知类型应显示“未知消息”，同时保留原始 key 供动作路由按 `REFUND_`、`GRAB_`、`WAITLIST_` 等前缀继续落到合适入口；用户可见标签和内部路由判断不应混为一谈。
- 该治理只调整前端展示和本地路由判断输入，不改通知服务 payload、数据库或消息投递链路。

## 2026-06-11 阶段 13 后台中文化发现：控制台订单状态不能用空横杠兜底

- `/console/orders` 页面和 CSV 导出原先都使用 `CONSOLE_ORDER_STATUS_LABELS[status] || '-'`，当后端新增状态而前端未映射时，后台用户只能看到空横杠，无法判断这是缺数据还是未知状态。
- 订单状态属于核心业务解释字段，应统一显示“未知订单状态”，并由页面和导出共用同一个 formatter，避免在线视图和下载文件显示规则漂移。
- 该治理只调整前端展示和导出文案；`status` 数值仍用于筛选、统计和后端排查，不需要接口或数据库变更。

## 2026-06-11 阶段 11 小队房间发现：成员状态未知时不能空白

- `TeamMemberList` 原先在移动端摘要和桌面端状态列都直接渲染 `MEMBER_STATUS_LABELS[member.status]`，如果后端新增成员状态但前端未映射，状态文本会变成空白。
- 小队房间里成员状态决定是否可继续确认、锁票或移除成员；未知状态应显示“状态同步中”，让用户知道需要刷新或等待后端同步，而不是把状态列留空。
- 该治理只调整前端展示；`member.status` 仍用于移除按钮判断和后端状态流转，不需要接口或数据库变更。

## 2026-06-11 阶段 11 小队房间发现：策略和房间状态 helper 也要防 undefined

- `strategyLabel()` 和 `teamStatusLabel()` 原先直接从映射表取值，遇到后端新增策略或小队状态时会返回 `undefined`，页面主策略、保底策略或房间状态就可能空白。
- 未知策略应显示“未知策略”，未知房间状态应显示“状态同步中”；这两个文案比空白更能提示用户当前数据仍在同步或前端需要补映射。
- 该治理只调整前端展示 helper；策略排序、默认保底策略和小队状态流转仍沿用原逻辑，不需要接口或数据库变更。

## 2026-06-11 阶段 13 后台中文化发现：艺人审核和风险状态不能直接回显后端码值

- `/console/artists/[id]/edit` 的艺人资料卡片原先直接展示 `artist.reviewStatus || '未知'` 和 `artist.riskStatus || '未知'`，会把 `pending`、`approved`、`rejected`、`normal`、`risky` 或未来新增状态码暴露给后台用户。
- 审核状态和风险状态都属于业务解释字段，应分别映射为“待审核 / 已通过 / 已驳回”和“风险正常 / 风险艺人”；未知值应显示“未知审核状态 / 未知风险状态”，让用户知道前端需要补映射，而不是看到原始枚举。
- 该治理只调整前端展示层；`reviewStatus` 仍用于主办方编辑权限判断，`riskStatus` 仍保留给接口和后续风控链路，不需要数据库结构或 DTO 变更。

## 2026-06-11 阶段 13 后台中文化发现：未知客服角色不能误标为普通客服

- `/console/support-accounts` 的客服账号列表原先用 `supportRoleOptions.find(...role)?.label || '普通客服'` 做兜底，后端新增 `supportRole` 或数据缺失时会把未知角色显示成“普通客服”。
- 客服角色决定账号权限和工作台定位，未知角色不应套用已有普通客服含义；更稳妥的文案是“未知客服角色”，提示后台用户需要补映射或核对账号配置。
- 该治理只调整列表展示层 formatter；`supportRole` 字段仍按原样用于创建、编辑和启停请求，不涉及数据库或权限模型变更。

## 2026-06-11 阶段 13 后台中文化发现：未知入驻状态不能误标为已驳回

- `/console/organizer-applications` 和 `/console/profile` 原先把入驻申请状态 `0/1` 之外的值默认显示为“已驳回”；如果后端新增审核中间态或迁移态，后台用户会误以为该申请已经被平台驳回。
- “已驳回”是明确审核结论，必须只对应 `status=2`；未知值应显示“未知入驻状态”，提示需要刷新映射或排查数据，而不是套用失败结论。
- 该治理只调整前端状态 formatter；入驻申请筛选、通过、驳回、取消主办方等动作仍沿用原有 `status` 字段和接口。

## 2026-06-11 阶段 13 后台中文化发现：未知账号状态不能误标为正常

- `/console/profile` 的账号状态原先把 `user.status` 的未知值默认显示为“正常”，同时把 `status=1` 显示成“已通过”、`status=2` 显示成“已禁用”，与后端登录和客服账号逻辑中 `1=启用`、`0=停用` 的语义不一致。
- 账号状态属于后台安全解释字段，未知值不能套用“正常”；更稳妥的映射是 `1=正常`、`0=已禁用`、其他值“未知账号状态”。
- 该治理只调整个人中心展示层；登录拦截、RBAC、账号启停和后端 `user.status` 字段语义保持不变。

## 2026-06-11 阶段 13 后台中文化发现：客服账号未知状态不能误标为已停用

- `/console/support-accounts` 的客服账号列表原先使用 `account.status === 1 ? '启用中' : '已停用'`，后端新增账号状态或迁移状态时会被后台用户误读为账号已停用。
- 同一行的启停按钮也原先用 `account.status === 1 ? '停用' : '启用'`，未知状态会被当成停用账号提供“启用”动作，容易把未识别状态直接写回 `1`。
- 客服账号状态属于后台账号安全字段，应显式区分 `1=启用中`、`0=已停用`、未知值“未知账号状态”；未知状态下启停动作应显示“状态待核对”并禁用，避免误操作。该治理只调整展示与按钮保护，不改账号接口、权限模型或数据库字段。

## 2026-06-11 阶段 13 后台中文化发现：SeatCraft 座位属性不能直接显示状态码

- `SeatLayoutControls` 的座位属性面板原先直接渲染 `{seat.status}`，会把 `available`、`reserved`、`selected`、`occupied`、`deleted` 或未来新增状态码显示给后台用户。
- 座位状态属于业务解释字段，面板应显示“可售 / 已锁定 / 已选中 / 已占用 / 已删除”；未知状态应显示“未知座位状态”，避免让运营人员看到英文枚举或误判座位是否可编辑。
- 该治理只调整座位属性面板的展示文案；画布颜色、座位可点击/可移动判断、删除座位渲染和后端状态字段保持不变。

## 2026-06-11 阶段 13 后台中文化发现：场次未知状态不能误标为停用

- `/console/sessions` 页面原先使用 `session.status === 1 ? '启用' : '停用'`，导出工具 `console-sessions.ts` 也使用相同二分判断，后端新增场次状态时会在页面和下载文件里同时误标为“停用”。
- 场次状态属于活动运营配置字段，未知值不能套用“停用”这种明确运营结论；更稳妥的显示是“未知场次状态”，提示后台用户需要核对数据或补映射。
- 页面、CSV 和 Excel 应复用同一个 `formatConsoleSessionStatus()`，避免在线表格和导出文件显示规则漂移；该治理只调整展示和导出文案，不改筛选参数、保存表单或后端状态字段。

## 2026-06-11 阶段 13 后台中文化发现：主办方账号状态未知时不能隐藏

- `/console/organizer-applications` 原先在 `organizerStatus` 不属于 `0/1/2/3` 或为空时让 `organizerStatusMeta()` 返回 `null`，并用条件渲染跳过徽标，后台用户会看不到账号状态缺口。
- 主办方账号状态关系到是否仍具备主办方权限、是否已取消或是否认证异常；未知值应显示“未知主办方状态”，让运营人员知道需要核对数据或补映射，而不是让状态消失。
- 该治理只调整主办方管理页展示层；`organizerStatus` 仍用于取消主办方按钮的禁用判断，审核、通过、驳回和取消接口保持不变。

## 2026-06-11 阶段 11 小队房间发现：抢票进度未知状态不能空白

- `/teams/[id]` 抢票进度卡片原先直接渲染 `GRAB_STATUS_LABELS[progress.status]`，如果 grab-service 新增进度状态但前端未映射，C 端用户会看到空白状态。
- 抢票进度是用户判断是否排队、锁票、生成订单或失败的核心解释字段；未知值应显示“状态同步中”，提示用户刷新或等待服务同步，而不是让状态列消失。
- 该治理只调整小队房间展示层；`progress.status` 仍用于终态轮询停止判断和后续支付入口，不改变抢票流程、请求号处理或后端状态字段。

## 2026-06-11 阶段 13 后台中文化发现：客服审计和上下文不能原样显示未知码

- `formatSupportAuditAction()` 原先对未知动作返回原始 `action`，客服工作台和控制台客服会话的操作记录会直接显示 `FUTURE_ACTION` 这类后端码值。
- `formatSupportContextSectionCount()` 原先对未知上下文分区返回原始 `section`，右侧用户上下文摘要会直接显示 `unknown 1` 这类技术文案。
- 客服排查界面可以保留业务对象和数量，但未知映射必须使用“未知操作 / 未知上下文”这类中文兜底；具体原始码值应留给接口、日志和后续映射补充，不应作为用户可见说明。

## 2026-06-11 阶段 13 后台中文化发现：客服标签未知码不能原样显示

- `formatSupportTagLabel()` 原先对未知客服标签返回原始 `code`，如果后端新增标签但前端未映射，客服工作台和会话查询会直接显示 `FUTURE_TAG` 这类码值。
- 客服标签用于快速识别退款、票务、入场、账号和支付异常等业务分类；未知标签应显示“未知标签”，提示需要补映射或核对数据，而不是把技术码当分类名称。
- 该治理只调整展示层 formatter；标签筛选、已知标签值、接口 payload 和后端分类逻辑保持不变。

## 2026-06-11 阶段 13 后台编号语境发现：活动艺人缺名不能拼内部编号

- `ActivityArtistSelector` 原先在已选艺人缺少 `name` 时显示 ``艺人 ${item.artistId}``，会把内部艺人编号当成艺人名称展示在活动发布/编辑表单中。
- 艺人名称缺失应提示“艺人信息待同步”，避免制造一个看似真实的艺人名；`artistId` 仍可保留在 key、排序、设置主艺人和提交 payload 中。
- 该治理只调整活动表单展示层；搜索、提交缺失艺人审核、阵容排序和角色配置逻辑保持不变。

## 2026-06-11 阶段 11 C 端抢票发现：活动详情主状态未知时应提示同步中

- `/activity/[id]` 抢票进度弹窗主状态原先使用 `GRAB_STATUS_LABELS[grabProgress.status] || '未知状态'`，当后端新增抢票状态时用户只能看到泛化未知，无法判断是否需要等待同步。
- 抢票主状态比尝试明细更醒目，应统一显示“状态同步中”，和小队房间、成员状态等 C 端同步口径一致。
- 该治理只调整活动详情展示层；`grabProgress.status` 仍用于终态轮询、候补入口、支付入口和后续状态判断，不改变抢票流程。

## 2026-06-11 阶段 13 后台中文化发现：退款未知状态需要业务化兜底

- `/console/refunds` 页面和 `console-refunds.ts` 导出工具原先都对未知退款状态显示“未知状态”，虽然没有暴露后端码值，但缺少退款业务语境。
- 退款状态关系到审核、到账、失败重试和用户资金预期；未知值应显示“未知退款状态”，让后台用户知道这是退款状态映射缺口，而不是泛化数据异常。
- 该治理只调整页面徽标和 CSV/Excel 导出文案；`refund.status` 仍用于筛选、同意退款、拒绝退款和重试退款判断，不需要接口或数据库变更。

## 2026-06-11 阶段 13 后台中文化发现：平台主办方运营员账号未知状态不能当作停用

- `/console/organizer-admins` 原先使用 `account.status === 1 ? '启用中' : '已停用'` 和 `account.status === 1 ? '停用' : '启用'`，后端新增账号状态或迁移中状态会被误判为已停用账号。
- 平台主办方运营员账号属于平台侧权限账号，未知状态不能直接提供“启用”写动作；更稳妥的口径是显示“未知账号状态”，并把启停按钮改为“状态待核对”且禁用。
- 该治理只调整页面展示和启停按钮保护；账号创建、编辑、删除、权限判断和后端 `status` 字段保持不变。

## 2026-06-11 阶段 13 后台中文化发现：活动未知上下架状态不能当作下架

- `/console/activities` 原先用 `activity.status === 1 ? '上架' : '下架'` 展示活动状态，后端新增销售状态或迁移中状态会被后台用户误读为已下架。
- 同一行上下架操作也原先用二分逻辑计算下一状态，未知状态会落到“上架”路径，存在把未识别活动状态直接写回 `1` 的误操作风险。
- 活动销售状态应显式映射 `1=上架`、`0=下架`，未知值显示“未知活动状态”，上下架入口显示“状态待核对”并禁用；该治理只调整列表展示和写动作保护，不改变活动发布、风险停售、删除或退款流程。

## 2026-06-11 阶段 13 后台中文化发现：评价审核未知状态也需要业务语境

- `/console/activity-engagement` 的问答和举报状态已经分别使用“未知问答状态”“未知举报状态”，但评价审核状态原先仍返回泛化“未知状态”。
- 评价审核状态决定评价是否展示、隐藏或待审核；未知值应显示“未知评价状态”，让后台用户知道缺口来自评价审核枚举，而不是页面通用状态。
- 该治理只调整评价状态展示文案；评价通过、隐藏、恢复展示、举报处理和问答回复流程保持不变。

## 2026-06-11 阶段 13 后台中文化发现：异常任务未知状态需要业务兜底

- 异常任务状态原先对未知值返回“未知状态”，在异常任务队列里会和对账批次、差异或别的状态页混淆。
- 异常任务属于后台待办处理队列，未知值应显示“未知异常状态”，让操作人员知道这是异常任务状态映射缺口，而不是通用状态问题。
- 该治理只调整状态展示文案；异常任务的认领、处理、关闭和筛选逻辑保持不变。

## 2026-06-11 阶段 13 后台中文化发现：对账未知状态需要区分批次、明细和差异

- 对账批次、明细和差异原先共享“未知状态”兜底，后台页面和导出文件都无法区分到底是批次状态、明细匹配状态还是差异处理状态缺映射。
- 对账链路用于财务核查和差异闭环，未知状态应分别显示“未知对账批次状态”“未知对账明细状态”“未知对账差异状态”，让运营人员知道需要核对哪一层数据。
- 该治理只调整共享 formatter 的中文兜底；批次生成、差异处理/忽略、页面筛选和导出字段范围保持不变。

## 2026-06-11 阶段 11 C 端候补发现：未知候补状态应提示同步中

- `getWaitlistStatusLabel()` 原先对未知候补状态返回“未知状态”，候补页会缺少业务语境，用户无法判断这是候补链路状态同步问题还是通用异常。
- 候补状态关系到等待、分配、待支付、已支付、取消、过期和失败等用户动作预期；未知值应显示“候补状态同步中”，和 C 端其他同步型状态保持一致。
- 该治理只调整展示层文案；候补可取消判断、支付入口、抢票失败后加入候补判断和后端状态字段保持不变。

## 2026-06-11 阶段 11 C 端活动发现：未知销售状态不能误标售罄

- 首页和搜索页原先把 `vo.status` 非 `1/2` 的活动全部映射为 `sold_out`，活动详情分析事件也把未知销售状态归到 `sold_out`，后端新增状态或迁移中状态会被用户误读为“售罄”。
- 已知 `0=售罄/下架态`、`1=售票中`、`2=待开票` 需要保持不变；除此之外的未知销售状态应显示“状态同步中”，避免错误制造售罄结论。
- 该治理只调整 C 端展示和分析事件的状态映射；搜索筛选值、活动详情购票判断、后端活动状态字段和接口参数保持不变。

## 2026-06-11 阶段 13 后台中文化发现：私有文件类型缺失不能只显示未知类型

- `PrivateFileUpload` 原先在 `contentType` 缺失时显示“未知类型”，用于场馆资质、证明文件等后台上传场景时缺少文件业务语境。
- 文件类型缺失更适合提示“文件类型待同步”，表明是上传资产元数据未同步或后端未返回类型，而不是泛化未知枚举。
- 该治理只调整文件卡片展示文案；上传、更换、移除、文件大小展示和 `PrivateAssetVO` 数据结构保持不变。

## 2026-06-11 阶段 13 后台中文化发现：场次未知状态需要独立待核对样式

- `/console/sessions` 文案层已能显示“未知场次状态”，但页面 badge class 原先仍用 `session.status === 1 ? 启用样式 : 停用灰色样式`，未知状态在视觉上会和“停用”混在一起。
- 场次状态属于运营配置字段，未知状态应当通过独立的待核对颜色提示运营人员补映射或核对数据，而不是沿用停用状态的灰色结论。
- 该治理只调整状态徽标样式 helper；CSV/Excel 导出文案、筛选参数、编辑表单和后端状态字段保持不变。

## 2026-06-12 阶段 11 C 端退款发现：订单列表未知退款状态不能直取映射

- `/orders` 退款进度区原先直接读取 `REFUND_STATUS_MAP[latestRefund.status].color` 和 `.label`；如果后端新增退款状态或迁移中返回未知枚举，前端会读到 `undefined` 并可能导致订单列表渲染失败。
- 同一页的 active refund 判断只覆盖 `0/1/4`，未知退款状态不会阻止“申请退款”入口，用户可能在状态同步未完成时重复发起退款申请。
- 更稳妥的口径是把退款状态文案、颜色、人工客服介入文案和是否阻塞重复退款申请集中到共享 helper：已知 `0/1/2/3/4` 保持原语义，未知状态统一显示“退款状态同步中”，时间线第二步保持 active，不把“平台审核”标成已完成。

## 2026-06-12 阶段 13 后台治理发现：未知评价状态不应开放审核写动作

- `/console/activity-engagement` 的评价状态文案已经能把未知值显示为“未知评价状态”，但原先按钮条件仍是 `review.status !== 1` 和 `review.status !== 2`，未知状态会同时暴露“通过”和“隐藏”动作。
- 评价审核状态决定评价是否展示、隐藏或恢复；未知枚举代表前端映射缺口或数据同步中，不应直接允许运营人员写回审核结论。
- 更稳妥的做法是按已知状态枚举显式开放动作：待审核可通过/隐藏，已展示可隐藏，已隐藏可通过/恢复展示；未知状态仅显示“状态待核对”，等待补映射或核对数据。

## 2026-06-12 阶段 13 后台治理发现：未知问答状态不应开放回复或显隐写动作

- `/console/activity-engagement` 的问答状态文案已经能把未知值显示为“未知问答状态”，但原先按钮条件仍是 `question.status !== 'HIDDEN'` 和 `question.status === 'HIDDEN'`，未知状态会暴露“隐藏”，同时“保存回复”始终可点。
- 购前问答状态决定问题是否待回复、已回复或已隐藏；未知枚举代表前端映射缺口或数据同步中，不应直接允许运营人员写回回复或显隐结论。
- 更稳妥的做法是按已知状态枚举显式开放动作：已知问答状态保留保存回复，待回复/已回复可隐藏，已隐藏可恢复；未知状态仅显示“状态待核对”，等待补映射或核对数据。

## 2026-06-12 阶段 13 后台中文化发现：控制台订单未知状态需要独立待核对样式

- `/console/orders` 文案层已能显示“未知订单状态”，但页面 badge class 原先仍用 `o.status === 1 ? 待支付样式 : o.status === 2 ? 已支付样式 : 灰色样式`，未知状态在视觉上会和“已取消/已退款”混在一起。
- 订单状态关系到支付、取消、退款和履约判断；未知状态应当通过独立的待核对颜色提示运营人员补映射或核对数据，而不是沿用取消/退款状态的灰色结论。
- 该治理只调整状态徽标样式 helper；状态文案、筛选、导出字段和后端订单状态字段保持不变。

## 2026-06-12 阶段 13 后台中文化发现：私有文件大小缺失不能只显示未知大小

- `PrivateFileUpload` 原先在 `fileSize` 缺失或无效时显示“未知大小”，用于场馆资质、证明文件等后台上传场景时缺少同步语境。
- 文件大小缺失更适合提示“文件大小待同步”，表明是上传资产元数据未同步或后端未返回大小，而不是泛化未知状态。
- 该治理只调整文件卡片展示文案；上传、更换、移除、文件类型展示和 `PrivateAssetVO` 数据结构保持不变。

## 2026-06-12 阶段 11 C 端订单发现：订单列表票档缺名不能保留旧兜底

- `/orders` 的 `enrichOrders()` 已经把缺失票档名称统一成“票档信息待同步”，但列表渲染层仍保留 `order.ticketName || '未知票档'`，导致后续改动或异常数据绕过 enrichment 时会回到旧文案。
- 票档名称缺失属于订单快照或票务信息同步问题，不应显示泛化“未知票档”；应继续使用“票档信息待同步”，和订单详情、票夹、抢票尝试、自动降档提示保持一致。
- 该治理只清理展示层冗余兜底；订单数据 enrichment、订单详情、票夹和后端字段保持不变。

## 2026-06-12 阶段 13 后台中文化发现：退款未知状态需要独立待核对样式

- `/console/refunds` 文案层已能显示“未知退款状态”，但页面 badge class 原先仍把未知状态放进 `UNKNOWN_STATUS_META` 的 `bg-[#f5f5f5] text-[#777]`，视觉上会和“已拒绝”混在一起。
- 退款状态关系到审核、到账、失败重试和用户资金预期；未知状态应当通过独立的待核对颜色提示后台人员补映射或核对数据，而不是沿用拒绝状态的灰色结论。
- 该治理只调整状态徽标样式 helper；状态文案、筛选、同意退款、拒绝退款、重试退款、CSV/Excel 导出字段和后端退款状态字段保持不变。

## 2026-06-12 阶段 13 后台中文化发现：入场核验未知结果需要共享待核对样式

- `/console/check-in` 页面原先本地维护 `RESULT_LABELS` 和 `RESULT_STYLES`，导出层另有一套 `CHECK_IN_RESULT_LABELS`；未知核验结果虽然显示“未知结果”，但页面样式通过 `RESULT_STYLES[record.result] || 'bg-[#f5f5f5] text-[#666]'` 分散兜底。
- 入场核验结果关系到成功入场、重复扫码和失败复核；未知结果应当使用独立的待核对颜色提示运营人员补映射或核对设备回传，而不是依赖页面内联灰色兜底。
- 该治理只收敛结果文案和徽标样式 helper；场次查询、结果筛选、CSV/Excel 导出字段、失败原因和后端核验结果字段保持不变。

## 2026-06-12 阶段 13 后台治理发现：艺人列表未知风险状态不应开放风险写动作

- `/console/artists` 列表原先把 `reviewStatus` 的非 approved/rejected 值都显示为“待审核”，后端新增审核状态或迁移态会被误读成可审核的待办。
- 同页风险状态原先用 `item.riskStatus === 'risky' ? '风险艺人' : '风险正常'` 展示，并用相同二分逻辑决定“解除风险 / 列入风险”；未知风险状态会被误标为“风险正常”，还会直接开放“列入风险”写动作。
- 艺人风险状态会影响包含该艺人的活动售票拦截，未知状态必须显示“未知风险状态”并把写动作降级为“状态待核对”；只有已知 `normal/risky` 才允许切换风险状态。

## 2026-06-12 阶段 13 后台治理发现：风险事件未知恢复状态不应重复提交

- `/console/risk-events` 已经能把最新恢复申请未知状态显示为“未知审核状态”，但按钮逻辑原先只判断 `latest?.status === 'pending'`，未知状态会落到“提交恢复申请”并允许再次提交。
- 恢复售票申请是风险停票后的高风险运营动作；未知状态代表审核链路或映射未同步，不应允许主办方重复提交新的恢复申请覆盖现场判断。
- 更稳妥的口径是：无最新申请或已知非 `pending` 状态保持可提交，`pending` 显示“审核中”禁用，未知状态显示“状态待核对”禁用，等待补映射或平台核对。

## 2026-06-12 阶段 13 后台治理发现：风险案例未知恢复状态不能显示为等待主办方处理

- `/console/risk-cases` 已经能把未知恢复状态的徽标显示为“未知审核状态”，但操作区原先把非 `pending/approved/rejected` 状态都落到“等待主办方处理”。
- “等待主办方处理”是明确业务阶段，只应对应已知 `awaiting_response`；未知状态如果也显示该文案，会让平台管理员误以为问题还在主办方侧，而不是前端映射或审核链路状态未同步。
- 操作区应区分已知待主办方处理和未知待核对：已知 `awaiting_response` 保持“等待主办方处理”，未知状态显示“状态待核对”并使用独立待核对样式。

## 2026-06-12 阶段 13 后台中文化发现：客服会话未知状态不能显示为处理中

- `formatSupportConversationStatus()` 原先对未知会话状态返回“处理中”，导致 `/support` 和 `/console/support-conversations` 遇到后端新增状态或迁移态时会误导客服以为会话处于正常人工处理中。
- 客服会话状态会影响接入、回复、转接、升级、关闭和 SLA 判断；未知状态应优先提示“未知会话状态”，让客服主管或平台管理员核对映射，而不是套用普通处理中语义。
- 该治理只调整展示 formatter；现有队列筛选、轮询和客服写动作仍按已有状态判断执行，后续如需保护未知状态写动作应单独补测试和策略。

## 2026-06-12 阶段 11 C 端客服发现：未知会话状态不能把转人工按钮显示为可转人工

- `/help` 页顶部状态已经复用 `formatSupportConversationStatus()`，未知会话状态会显示“未知会话状态”，但转人工按钮文案原先内联三段判断，未知状态会落到“转人工客服”。
- 该按钮是否可点击仍由 `canRequestSupportHandoff()` 控制，未知状态实际不可点击；但文案显示“转人工客服”会让用户误以为可以升级人工，只是按钮失效。
- 更稳妥的口径是把转人工按钮文案集中到 `formatSupportHandoffActionLabel()`：`OPEN` 或无会话仍显示“转人工客服”，等待人工/人工处理中/等待结束确认显示对应状态，未知状态显示“状态待核对”。

## 2026-06-12 阶段 11 C 端商户入驻发现：未知入驻状态不能误标为已驳回

- `/merchant` 的 `statusMeta()` 原先只显式处理 `0=待审核` 和 `1=已通过`，其余状态全部返回“已驳回”；后端新增状态或迁移态会被用户误读为平台已经驳回申请。
- 同一状态说明区域原先在非通过、非驳回时显示“资料正在审核中”，未知状态会被进一步误读为正常审核中。
- 更稳妥的口径是显式映射 `0/1/2`，未知状态显示“未知入驻状态”，说明文案提示“入驻状态待核对，请稍后刷新或联系平台客服。”；该治理只调整 C 端展示文案，不改变表单可编辑条件、提交接口或审核流程。

## 2026-06-12 阶段 11 C 端活动详情发现：未知问答状态不能显示为暂无回复

- `/activity/[id]` 问答列表原先在 `item.answer` 缺失时只判断 `item.status === 'PENDING'`，其他状态全部显示“暂无回复”；后端新增问答状态或迁移态会被普通用户误读为问题没有回复。
- 问答状态影响用户对主办方是否已回复、是否等待回复和内容是否同步的判断；未知状态更应提示“问答状态同步中”，而不是落到普通空回复语义。
- 更稳妥的口径是集中到 `formatActivityQuestionAnswerFallback()`：已知 `PENDING` 显示“已提交，等待回复”，已知 `ANSWERED/HIDDEN` 缺少回答时继续显示“暂无回复”，未知状态显示“问答状态同步中”；该治理只调整 C 端展示文案，不改变提问、评价、举报或后台问答审核流程。

## 2026-06-12 阶段 13 后台治理发现：客服工作台未知会话状态不应开放写动作

- `/support` 已经通过 `formatSupportConversationStatus()` 把未知会话状态显示为“未知会话状态”，但页面多处写动作原先仍只判断 `active.status === 'CLOSED'`，未知状态会继续开放标签、备注、转接、升级和申请结束。
- 客服会话状态直接决定接入、回复、转接、升级、关闭和 SLA 处理路径；未知状态代表前端映射缺口或数据同步中，不应允许客服写回会话处理结论或修改用户标签。
- 更稳妥的口径是把状态判断集中到共享 helper：已知状态保持原有可操作语义，未知状态统一禁用写动作，并在函数入口返回“会话状态待核对，请刷新后再操作”；该治理只调整前端状态保护，不改变客服会话接口、队列筛选或后端状态字段。

## 2026-06-12 阶段 13 后台中文化发现：退款未知状态操作区不能显示为无需操作

- `/console/refunds` 已经能把未知退款状态显示为“未知退款状态”并使用待核对样式，且不会开放同意、拒绝或重试按钮；但操作列原先用 `refund.status !== 0 && refund.status !== 4` 统一显示“无需操作”。
- “无需操作”是明确处理结论，适用于已退款、已拒绝、退款失败等已知终态；未知状态代表前端映射缺口或退款链路同步中，后台人员仍需要核对状态来源。
- 更稳妥的口径是把操作区文案集中到 `formatConsoleRefundActionLabel()`：已知不可审核状态显示“无需操作”，未知状态显示“状态待核对”；该治理只调整页面操作区文案，不改变退款审核、拒绝、重试接口或后端状态字段。

## 2026-06-12 阶段 11 C 端订单发现：活动和场馆缺名不应显示为未知对象

- `/orders` 和 `/orders/[id]` 的订单 enrichment 原先把缺失活动名显示为“未知活动”、缺失场馆名显示为“未知场馆”；退款人工客服消息里活动 fallback 也保留“未知活动”。
- 对用户来说，活动名或场馆名缺失通常是订单快照、票务聚合或历史数据同步问题，不是一个可解释的“未知对象”；“未知活动 / 未知场馆”会削弱排查语境。
- 更稳妥的口径是显示“活动信息待同步 / 场馆信息待同步”，并在退款人工客服消息里沿用“活动信息待同步”；该治理只调整 C 端展示文案，不改变订单列表、订单详情、退款申请或客服会话接口。

## 2026-06-12 阶段 13 后台订单发现：活动缺名不应显示为未知活动

- `/console/orders` 页面和后台订单 CSV 导出原先在活动名缺失时回退到“未知活动”，与 C 端订单已调整的“活动信息待同步”口径不一致。
- 后台人员看到活动名缺失时更需要判断是订单快照、活动聚合或历史数据同步问题；“未知活动”过于泛化，容易被误读成业务对象本身不可识别。
- 更稳妥的口径是集中到 `getConsoleOrderActivityLabel()`：活动名存在时原样展示，缺失时显示“活动信息待同步”；该治理只调整控制台订单页面和 CSV 展示文案，不改变订单状态、票档兜底、筛选、导出字段或后端订单字段。

## 2026-06-12 阶段 13 后台退款发现：退款关联活动缺名不应显示为未知活动

- `/console/refunds` 页面、退款 CSV 和 Excel 导出原先在 `orderName` 与 `activityName` 同时缺失时回退到“未知活动”，与订单页和控制台订单页的同步口径不一致。
- 退款记录的活动名缺失通常意味着订单快照、支付退款聚合或活动信息同步问题；后台人员需要看到“待同步”的业务语境，而不是泛化未知对象。
- 更稳妥的口径是集中到 `getConsoleRefundActivityLabel()`：优先显示 `orderName`，其次显示 `activityName`，两者都缺失时显示“活动信息待同步”；该治理只调整退款审核页面和导出展示文案，不改变退款状态、审核动作、筛选、导出字段或后端退款字段。

## 2026-06-12 阶段 12 入场核验发现：异常报表应从全量记录中筛出而不是扩散字段

- `/console/check-in` 已经具备全量核验记录 CSV/Excel 导出，但现场复核更常用的是失败、重复和未知待核对结果；让运营人员下载全量记录后手动筛选，会增加处理设备故障、重复扫码和未映射结果的成本。
- 异常核验报表不应因为“排查”就扩散内部关联编号；业务排查所需字段仍是请求号、票号、设备、渠道、结果、失败原因和核验时间，`ticketId`、`orderId`、`userId`、`sessionId`、`ticketTypeId`、`operatorUserId` 继续留在接口和后端日志里。
- 更稳妥的口径是复用全量导出的同一套行构造和中文 formatter，只在导出前过滤非 `SUCCESS` 记录；未知核验结果也进入异常报表并显示“未知结果”，便于后续补映射或核对设备回传。

## 2026-06-12 阶段 12 批量运营发现：活动批量下架应复用已验证的单条退款链路

- `/console/activities` 已经有普通活动和巡演的单条“下架并退款”能力，后端会返回下架活动数、已支付订单数、退款成功/失败/未知/需人工处理等影响汇总；批量入口第一轮不需要新增后端批量 API，可以在前端当前页逐条复用既有 `deactivateActivity()` / `deactivateTour()`，降低跨服务回归面。
- 批量选择不能只按复选框状态执行写动作；草稿、风险停票、已下架巡演和未知销售状态都应排除，避免把未确认状态误下架或误触发退款。
- 批量确认文案必须显式包含“同意退款”，并在结果中汇总成功/失败数量和退款影响，让主办方或平台人员知道是否需要进入退款审核页继续处理异常。
- 操作审计不能在 `java-ticket` 里直接写 `java-user` 拥有的全局 `operation_audit_log`；如果后续要完整满足批量动作审计，应单独设计带 `X-Internal-Token` 校验的 internal audit API，而不是跨库 Mapper 或跨库 SQL 写入。

## 2026-06-12 阶段 12 操作审计发现：跨服务高风险动作应通过 user internal audit API 写入

- 全局 `operation_audit_log` 属于 `java-user`，`java-ticket` 不应新增跨库 Mapper、Entity 或 SQL 去写审计表；票务侧的高风险运营动作应通过带 `X-Internal-Token` 校验的 internal API 把审计请求交给 `java-user`。
- 活动/巡演“下架并退款”审计应记录业务结果摘要，而不是只记录动作名；至少包含下架活动数、已支付订单数、退款成功/失败/未知/需人工处理数量，便于后台审计列表直接判断是否需要继续跟进退款异常。
- 审计写入失败不应回滚已经完成的下架和退款主链路；更稳妥的处理是 ticket 侧记录 warn，让后续运维按日志或补偿任务追补审计，而不是让用户重复触发高风险退款动作。
- 前端审计列表必须同步补动作和目标类型中文映射；否则后端审计已写入，后台人员仍会看到 `activity.deactivate.refund`、`tour.deactivate.refund` 或 `tour` 这类技术码值。

## 2026-06-12 阶段 12 批量通知发现：购票用户通知第一轮应限定为站内信和普通活动

- 批量通知购票用户可以复用 ticket 侧活动场次、order internal 已支付订单查询和 notification MQ，不需要让 `java-ticket` 跨库读取用户、订单或通知表；用户、订单和审计数据仍通过 internal API / MQ 边界传递。
- 第一轮不应接真实 SMS/Email；手动运营通知内容由后台人员填写，渠道限定为 `IN_APP`，并通过通知中心 action 跳到 `/orders/{orderId}`，避免短信/邮件模板、退订、投递失败和外部额度问题扩大当前切片。
- 通知事件的 `eventId` / `aggregateKey` 不能只用 activityId + orderId；同一订单可能因为入场时间、场馆入口、观演须知多次发送不同通知，幂等键需要包含内容 hash，避免后续不同内容被旧幂等记录吞掉。
- `/console/activities` 同时存在普通活动和巡演行；当前后端只新增单活动通知接口，前端批量入口必须过滤 `itemType === 'tour'`，否则会把巡演 id 当普通 activity id 调用，造成通知范围不确定。
- 批量通知也属于运营写动作，应写 `activity.buyers.notify` 操作审计；审计结果应包含已支付订单数、通知用户数、站内通知数和跳过订单数，便于后台判断是否存在缺少用户或订单信息的异常记录。

## 2026-06-12 阶段 12 批量退款发现：退款批量处理应编排单条审核链路而不是另开后端批量 API

- `/console/refunds` 已有单条同意、拒绝和处理中重试能力；第一轮批量处理更稳妥的做法是在前端当前页逐条复用 `approveRefund()` / `rejectRefund()`，这样继续沿用后端已有退款状态机、通知事件和审计链路，避免新增批量 API 扩大支付/退款回归面。
- 批量候选不能只看复选框；待审核和处理中可以进入批量同意/重试，但处理中退款不能批量拒绝，已退款、已拒绝、退款失败和未知退款状态都不应进入批量写动作，避免把同步中或未映射状态误处理。
- 批量动作必须有二次确认和结果反馈；结果反馈至少要包含成功/失败数量，失败不应中断后续记录处理，便于后台人员刷新后核对剩余退款状态。
- Docker 前端开发服务仍可能因为 `.next/dev` 缓存继续渲染旧页面；如果容器内源码已同步但浏览器看不到新入口，可先挪走 `/app/.next/dev` 再重启 `omni-frontend`。在 PowerShell 中执行容器内 `$(date ...)` 这类 shell 语法时应使用单引号，避免被 PowerShell 本地展开。

## 2026-06-12 阶段 12 批量改价发现：票档批量改价应限制状态并复用单条更新链路

- `/console/sessions` 已经通过场次列表返回当前页 `ticketTypes`，第一轮批量改价不需要新增后端批量 API；前端可以在当前页逐条复用 `updateAdminTicketType(ticket.id, { price })`，继续沿用既有票档更新权限、校验、搜索索引刷新和错误返回。
- 批量改价不能只看复选框；只有已知可编辑状态的票档才能进入目标集合，未知票档状态应显示“未知票档状态”并禁止勾选，避免把后端新增状态或同步态误改价。
- 票价输入必须在前端先做基础校验并归一化到两位小数；空值、非数字、零或负数都应以中文提示阻断，避免批量调用接口后才得到分散失败结果。
- 票档改价会影响后续未支付订单或新下单报价，但已支付订单展示仍应以订单快照为准；二次确认文案需要明确“已支付订单仍以订单快照为准”，减少后台人员误以为会追改历史订单价格。
- 当前单条 `updateAdminTicketType()` 后端链路未显式写 `operation_audit_log`；如果后续把批量改价纳入高风险动作审计标准，应复用或扩展 `java-user` internal audit API，而不是在 `java-ticket` 跨库写审计表。

## 2026-06-12 阶段 12 批量启停发现：票档状态批量调整应只处理已知状态且跳过无变化项

- 票档启停已经由单条 `updateAdminTicketType(id, { status })` 支持；第一轮批量入口不需要新增后端批量 API，可以在 `/console/sessions` 当前页逐条复用既有权限、状态更新和搜索索引刷新链路。
- 批量状态目标不能只看选中集合；未知票档状态必须排除，目标状态与当前状态相同的票档也应跳过，避免把同步态误写或对无变化记录制造无意义更新。
- 批量启停按钮应根据目标状态分别计数：选中已启用票档时只启用“批量停用”，选中已停用票档时只启用“批量启用”，让后台人员在执行前就能看到实际会变更的票档数量。
- 批量库存调整不应和批量启停混在同一切片里；现有后端 `totalStock` 更新会按差值调整 `remainStock`，如果新总库存低于已售数量，前端/后端都需要明确保护和中文错误，否则批量入口可能放大库存异常。
- 与批量改价一样，当前单条票档状态更新未显式写 `operation_audit_log`；如果后续把票档批量启停纳入高风险动作审计标准，应复用或扩展 `java-user` internal audit API，而不是跨库写审计表。

## 2026-06-12 阶段 12 批量库存发现：库存调整必须以后端已售下限为准

- `/console/sessions` 已经能拿到当前页票档的 `totalStock` 和 `remainStock`，前端可以先计算“已售 = 总库存 - 余票”并阻断目标总库存低于已售数量的批量操作，减少分散失败和误操作。
- 前端校验只能作为体验保护，不能替代后端约束；单条 `updateTicketType()` 必须在 `java-ticket` 侧重新计算已售数量并拒绝低于已售的新总库存，否则直接调用 API 或未来其他入口仍可能制造负余票。
- 更新总库存时应保持已售数量不变，新的 `remainStock` 应为 `nextTotalStock - soldStock`；继续用差值叠加余票会在当前余票异常或总库存被调低时扩大偏差。
- 批量库存第一轮仍应复用现有单条更新链路，不新增后端批量 API；这样可以沿用权限、搜索索引刷新和统一错误返回。后续如要把票档批量库存纳入高风险动作审计，应复用或扩展 `java-user` internal audit API，而不是在 `java-ticket` 跨库写审计表。

## 2026-06-12 阶段 12 批量导入发现：普通票档导入应先做文本解析和单条链路编排

- `/console/sessions` 已经返回当前页场次与票档统计，普通非座位绑定票档的批量导入第一轮不需要新增后端批量 API；前端可以解析粘贴文本后逐条复用 `createAdminTicketType()`，继续沿用既有权限、创建校验和错误返回。
- 导入格式应保持运营人员可直接从表格复制：第一行表头可选，字段顺序固定为“场次编号,票档名称,票价,总库存”，同时支持英文逗号、中文逗号和 Tab 分隔，空行跳过。
- 批量导入不能把 SeatCraft 区域/座位绑定混入同一入口；座位绑定涉及区域、座位快照、票档分组和库存口径，应该后置为单独切片，避免普通票档导入把绑定语义做成半成品。
- 前端应在发请求前集中校验场次编号、票档名称、票价和总库存，并以中文列出前几条错误；导入执行阶段失败不应中断后续记录，应汇总成功/失败数量，方便后台人员刷新后核对剩余票档。
- 本机 Docker 前端开发服务仍可能继续渲染旧 `.next/dev` 编译产物；源码已更新但浏览器看不到“批量导入票档”时，可挪走 `omni-frontend` 容器内 `/app/.next/dev` 并重启容器后再验证。

## 2026-06-12 阶段 12 批量审计发现：票档批量动作应落在单条创建/更新审计上

- `/console/sessions` 的批量导入、改价、启停和库存都刻意不新增后端批量 API，而是逐条复用单条 `createAdminTicketType()` / `updateAdminTicketType()`；因此审计最小闭环应落在单条票档创建/更新链路上，避免每个前端批量按钮各自补一套重复审计。
- 全局 `operation_audit_log` 仍属于 `java-user`；`java-ticket` 不应跨库写审计表，应该继续通过带 `X-Internal-Token` 的 `java-user` internal audit API 写入。
- 票档审计的目标类型应使用稳定业务码 `ticket_type`，后台展示层同步映射为“票档”；动作 `ticket_type.create` / `ticket_type.update` 分别展示为“创建票档 / 更新票档”，避免操作审计列表重新出现英文码值。
- 审计失败不应阻断票档创建/更新主链路。更稳妥的处理是 ticket 侧记录 warn，后续通过日志或补偿任务追补审计；直接让用户重试批量导入或批量库存，可能造成重复创建或重复写入。

## 2026-06-12 阶段 13 RBAC 发现：权限变更应在保存前给出差异和敏感标记

- `/console/roles` 已有角色权限保存接口和 `rbac.role_permission.update` 审计，但仅在保存弹窗里临时展示新增/移除权限，管理员在勾选过程中缺少稳定的页面内差异预览。
- 权限差异计算不应长期写在页面事件处理里；抽成 `rbac-permission-diff` 后，页面、弹窗和后续审计摘要如果要复用同一套新增/移除口径，就不会各自实现一遍。
- `rbac.manage` 是权限边界的高风险点，`platform_super_admin` 是平台最高权限角色；这两类变更应统一标记为“敏感权限变更”，并使用更明确的“确认更新角色权限”二次确认，而不是泛化“保存授权”。
- 本轮只做前端预览和二次确认文案，不新增后端 API、不改数据库结构；后续如果要把审计结果从“权限数量”升级为“新增/移除明细”，更稳妥的方式是让 `java-user` 的 RBAC 更新服务返回实际变更差异，再写入同服务拥有的 `operation_audit_log`，不要让前端或其他服务伪造审计明细。

## 2026-06-12 阶段 13 RBAC 审计发现：权限变更明细应由后端基于旧值和新值生成

- `rbac.role_permission.update` 审计原先只写“权限数量：N”，数量来自请求体，既无法说明新增/移除了哪些权限，也不能反映 `platform_super_admin` 强制保存全部权限后的真实结果。
- 权限变更审计不能信任前端提交的差异摘要；更稳妥的口径是在 `java-user` 的 `RbacAdminService` 内部读取更新前 `rbac_role_permission`，再基于规范化后的新权限集合计算新增/移除，并由后端权限表补中文权限名。
- `platform_super_admin` 的保存语义要继续以权限表全量为准，而不是以请求体为准；审计摘要也应展示强制归一后的更新后权限数，避免最高权限角色被部分请求体误导。
- 最后一个 `rbac.manage` 角色保护仍必须发生在写入前；新增审计明细不能绕过既有权限边界保护，也不需要新增数据库字段或跨服务审计写入链路。

## 2026-06-12 阶段 13 RBAC 模板发现：角色模板只能辅助选择，不能替代保存审计

- 角色模板适合作为 `/console/roles` 的前端选择辅助，第一轮不需要新增模板表或后端模板 API；否则会把一个低频运营便利项扩大成新的权限配置持久化边界。
- 模板权限必须按当前 `rbac_permission` 返回结果取交集，不能把迁移未启用、已下线或未来才存在的权限码写进保存请求。
- `platform_super_admin` 不应套用模板；该角色由后端强制保存全部权限，前端模板如果允许部分套用，会制造“看似降权但后端归一”的误解。
- 套用模板只能改变页面勾选状态，不能直接触发保存；管理员仍需要通过权限变更预览、敏感权限二次确认和后端真实差异审计完成最终授权。

## 2026-06-12 阶段 13 操作审计发现：筛选入口应显示中文但保留后端码值

- `/console/audit-logs` 的列表展示已经能把审计动作和对象类型映射为中文，但筛选区如果仍要求输入 `action` / `targetType` 自由文本，后台人员仍需要记住后端码值，中文化只完成了一半。
- 更稳妥的做法是复用同一套 `operation-display` 映射生成筛选选项：下拉框显示“更新角色权限 / 创建票档 / 角色权限 / 票档”等中文业务标签，选中后仍把 `rbac.role_permission.update`、`ticket_type` 等原值传给后端，避免改变接口契约。
- 审计筛选选项不应伪造未知动作；后端新增审计动作后，如果前端还没有中文映射，应先在展示层显示“未知操作 / 未知对象”，并在映射补齐后进入筛选下拉，避免把未解释码值重新暴露给后台人员。
- 本机 Docker 前端开发服务可能继续渲染旧 `.next/dev` 产物；源码已包含下拉框但浏览器仍显示“动作”文本框时，可挪走 `omni-frontend` 容器内 `/app/.next/dev` 并重启容器后复测。

## 2026-06-12 阶段 13 操作审计发现：同一 targetRef 字段可能承载不同业务语义

- `organizer_ops_assignment` 的审计 `targetRef` 在当前主链路中可以是负责人编号，但历史/种子记录里也可能保存风险等级，例如 `high`、`watch`；前端如果只按“非数字就是跟进类型”处理，就会把风险等级误显示为“跟进类型：high / watch”。
- 展示层应按业务语义从强到弱识别：纯数字显示“负责人编号”，已知风险等级显示“风险等级：高风险 / 关注 / 正常”，最后才把已知跟进类型显示为“跟进类型：内部备注 / 电话沟通”等。
- 这种治理不应该反向修改历史审计数据，也不需要改后端写入链路；审计记录是事实留痕，前端负责把已知历史码值解释成稳定中文语境。

## 2026-06-12 阶段 13 操作审计发现：对象类型映射要覆盖实际审核场景

- 审计动作有中文映射不代表整行展示已经完成中文化；例如 `ARTIST_REVIEW` 已显示“审核艺人档案”，但 targetType `artist` 如果缺少映射，列表仍会显示“未知对象”。
- 对象类型映射应覆盖实际审计数据里的 targetType，并同步进入筛选下拉；下拉 label 使用中文业务语境，value 仍保留后端原始码值，避免改变查询契约。
- 历史或种子审计里的 `targetRef` 如果已经是“艺人档案审核”这类业务文本，可继续原样展示；本轮治理点是补齐 targetType label，而不是反向修改审计数据。

## 2026-06-12 阶段 13 异常任务发现：新建入口应复用列表类型映射

- 异常任务列表已经通过 `formatExceptionTaskType()` 能把 `PAYMENT_TIMEOUT`、`REFUND_UNKNOWN`、`TICKET_ISSUE` 等历史类型显示为中文，但新建任务下拉如果单独硬编码一组小写类型，就会和本地真实队列语义脱节。
- 任务类型选项应从同一套 `EXCEPTION_TASK_TYPE_LABELS` 生成，既覆盖历史大写类型，也保留当前小写类型；展示中文标签，提交时仍使用后端码值，避免改动接口契约。
- 这种入口治理不需要迁移历史异常任务数据；它解决的是后台人员创建任务时可选择的业务语义范围，而不是改变已有任务的事实记录。

## 2026-06-12 阶段 13 对账发现：历史批次码值需要展示层兼容

- 当前 `ReconciliationService` 新生成批次更多使用小写码值，例如 `payment/refund/matched/amount_mismatch`；但本地真实 seed 批次 `REAL-DEMO-20260603` 仍包含历史大写和旧状态码：`ORDER`、`REFUND`、`different`、`REFUND_AMOUNT_MISMATCH`。
- 后台中文化不能只覆盖新生成码值；对账页详情和导出需要解释历史批次，否则真实演示数据会显示“未知业务类型 / 未知对账明细状态 / 未知差异类型”，影响运营复核。
- 更稳妥的做法是在共享 `operation-display` formatter 里兼容大小写并补历史别名，页面和 CSV/Excel 导出继续复用同一套映射；不需要迁移历史对账数据，也不应反向修改审计或对账事实记录。
- Docker 前端开发服务仍可能在 helper 修改后继续使用旧 `.next/dev` 产物；对账页详情如果源码已更新但页面仍显示未知文案，应挪走容器内 `/app/.next/dev` 并重启 `omni-frontend` 后复测。

## 2026-06-12 阶段 13 对账发现：summary key 已存在中英文两套来源

- `java-payment` 的对账 source summary 使用中文 key：`业务日期`、`支付笔数`、`支付金额`、`退款笔数`、`退款金额`、`净额`、`差异数`；`java-user` 在空数据 fallback 时也会生成同类中文 key。
- 历史 real-demo seed 仍使用英文 key：`paidOrderCount`、`refundAbnormalCount`、`diffCount`。因此展示层必须同时兼容中英文 key，不能只把英文 camelCase 当作唯一来源。
- 已经是中文的后端 summary key 不应被替换成“其他指标”；“其他指标”只适合未识别的新字段，真实已知字段应保留明确业务含义，方便后台人员快速判断支付、退款、净额和差异数量。

## 2026-06-12 阶段 13 站点配置发现：审核页需要展示状态并保护非待审核记录

- `station_config_version.status` 本地真实值包含 `draft`、`submitted`、`approved`、`rejected`、`applied` 等；审核页虽然当前只查询 `submitted`，但展示层此前没有共享状态 formatter，也没有对未来或非待审核状态的操作区保护。
- 站点配置状态应和变更类型一样收口到 `operation-display`，已知值显示“草稿 / 待审核 / 已通过 / 已应用 / 已驳回 / 已撤回”，未知值显示“未知配置状态”，避免直接回显后端码值。
- 审核写动作只应对 `submitted` 开放；非待审核或未来状态应显示“状态待核对”，事件入口也要阻断通过/驳回，避免后端新增状态时前端误开放高风险审核动作。

## 2026-06-12 阶段 13 异常任务发现：操作区应显式处理未知状态

- 异常任务列表已经能通过 `formatExceptionStatus()` 把已知状态显示为中文，但操作列如果只按 `pending/processing/resolved/closed` 写 JSX 分支，未来状态会落成空白操作区，后台人员无法判断是已结束、无权限还是状态异常。
- 待处理和高优先级统计不应简单使用“不是 `resolved/closed`”作为未结束口径；未知状态应先进入“状态待核对”，不能被计入可处理任务数量，避免运营人员误判待办压力。
- 认领、标记已处理和关闭入口都应复用共享状态 guard：`pending` 才可认领和关闭，`processing` 才可标记已处理和关闭，未知或未来状态在事件入口直接返回“任务状态待核对，请刷新后再操作”。这样后端新增状态时，前端默认不开放写动作。
- 当前本地真实样本没有未知异常任务状态，浏览器页只能验证已知状态渲染与 console；未知状态保护应主要由单元测试和构建产物文案检查留证，不应为了演示去写入临时异常任务数据。

## 2026-06-12 阶段 13 评价举报发现：中文状态映射不等于操作保护完成

- `/console/activity-engagement` 的举报列表已有 `reportStatusLabel()`，未知状态会显示“未知举报状态”；但如果操作区仍只写 `report.status === 'PENDING'`，未知状态会静默没有操作说明，后台人员无法区分“已结束”和“状态异常”。
- 举报处理和驳回属于写动作，不能只靠按钮显隐保护。事件入口应接收完整 report 并再次检查状态；只有 `PENDING` 可处理或驳回，未知或未来状态应弹出“举报状态待核对，请刷新后再操作”。
- 评价、举报、问答三个 moderation 区块应保持一致：已知可操作状态显示对应按钮，未知状态显示“状态待核对”；不要只在部分 tab 做未知状态提示，避免同一管理页出现不一致治理口径。
- 当前本地举报样本是 `PENDING`，浏览器可验证已知状态渲染、裸码隐藏和 console；未知状态保护仍以源代码测试和 `.next/dev` chunk 文案检查作为留证，不应为了验证去写入临时举报状态。

## 2026-06-12 阶段 13 场馆资料审核发现：中文状态兜底不等于审核写动作保护

- `/console/venue/applications` 已能对未知 `status` 显示“未知场馆审核状态”，但操作区此前仍直接用 `item.status === 0` 决定是否打开审核，`openReview()` 只收 `id`，`handleApprove()` 和 `handleReject()` 只检查 `reviewingId`。
- 场馆资料审核会创建或关联场馆记录，属于平台写动作；未知或未来状态不应静默空操作区，也不应在状态变化后继续提交通过/驳回。
- 更稳妥的口径是集中到 `isKnownVenueApplicationStatus()` 和 `isReviewableVenueApplicationStatus()`：只有 `status=0` 开放审核，未知状态显示“状态待核对”，事件入口和提交入口统一返回“场馆审核状态待核对，请刷新后再操作”。
- 当前本地场馆审核样本只有已知 `待审核` 状态，浏览器只验证真实样本渲染和 console；未知状态保护用源代码测试和 `.next/dev` chunk 检查留证，不为演示写临时审核状态数据。

## 2026-06-12 阶段 13 主办方入驻发现：按钮禁用不等于未知状态审核保护

- `/console/organizer-applications` 已能对未知入驻申请 `status` 显示“未知入驻状态”，但通过/驳回按钮此前仍靠 `item.status !== 0` 禁用，事件入口只接收申请 `id`，没有在写动作入口复核状态。
- 入驻审核会改变用户角色和主办方资格，属于高影响写动作；未知或未来状态不应只表现为按钮禁用，后台人员需要看到“状态待核对”，事件入口也要返回明确中文拦截文案。
- 更稳妥的口径是集中到 `isKnownOrganizerApplicationStatus()` 和 `isReviewableOrganizerApplicationStatus()`：只有 `status=0` 开放通过/驳回，未知状态显示“状态待核对”，事件入口统一返回“入驻审核状态待核对，请刷新后再操作”。
- 当前本地主办方入驻样本是已知状态组合，浏览器只验证真实列表渲染和 console；未知状态保护用源代码测试和 `.next/dev` chunk 检查留证，不为演示写临时入驻状态数据。

## 2026-06-12 阶段 13 恢复售票审核发现：未知状态不能只靠待审核分支排除

- `/console/risk-resolutions` 已能对未知恢复售票审核 `status` 显示“未知审核状态”，但操作区此前仍用 `item.status === 'pending'` 判断是否展示通过/拒绝入口，事件入口只接收申请 `id`。
- 恢复售票审核会解除风险停售，属于高影响平台写动作；未知或未来状态应显示“状态待核对”，并在事件入口基于完整申请记录再次校验，不能只依赖 JSX 分支隐藏按钮。
- 更稳妥的口径是集中到 `isKnownRiskResolutionStatus()` 和 `isReviewableRiskResolutionStatus()`：只有 `pending` 开放通过/拒绝，未知状态显示“状态待核对”，事件入口统一返回“恢复售票审核状态待核对，请刷新后再操作”。
- 当前本地恢复售票审核样本是已知状态，浏览器只验证真实列表渲染和 console；未知状态保护用源代码测试和 `.next/dev` chunk 检查留证，不为演示写临时恢复申请状态数据。

## 2026-06-12 阶段 13 主办方取消发现：入驻审核通过不等于主办方状态可取消

- `/console/organizer-applications` 的“取消主办方”此前只检查入驻申请 `status === 1` 和是否已经降级为 `role=user`，但主办方账号自身 `organizerStatus` 已经有“未知主办方状态”兜底展示。
- 取消主办方会下架活动、触发真实退款链路并降级角色，属于高影响写动作；如果 `organizerStatus` 是未来值或数据待同步，不能仅因为入驻申请已通过就开放取消入口。
- 更稳妥的口径是集中到 `isKnownOrganizerStatus()` 和 `canDeactivateOrganizerAccount()`：只有入驻已通过且 `organizerStatus=1` 的有效主办方可取消，未知状态显示“状态待核对”，事件入口返回“主办方状态待核对，请刷新后再操作”。
- 当前本地主办方入驻样本为已知主办方状态，浏览器只验证真实列表渲染和 console；未知状态保护用源代码测试和 `.next/dev` chunk 检查留证，不为演示写临时主办方状态数据。

## 2026-06-12 阶段 13 对账差异发现：未知差异状态不能显示为已结束

- `/console/reconciliation` 的差异状态已能通过 `formatReconciliationDifferenceStatus()` 显示“未知对账差异状态”，但操作列此前把非 `open` 的状态统一落到“已结束”，会把未来状态或数据待同步误解释为已完成处理。
- 对账差异的“标记已处理 / 忽略”属于对账复核写动作；事件入口不应只收差异编号，应基于完整差异记录复核状态，只有 `open` 可写。
- 更稳妥的口径是集中到 `isKnownReconciliationDifferenceStatus()` 和 `isOpenReconciliationDifferenceStatus()`：`open` 显示处理/忽略，`resolved/ignored` 显示“已结束”，未知或未来状态显示“状态待核对”，事件入口返回“对账差异状态待核对，请刷新后再操作”。
- 当前本地对账差异样本为已知状态，浏览器只验证真实详情渲染和 console；未知状态保护用源代码测试和 `.next/dev` chunk 检查留证，不为演示写临时对账差异状态数据。

## 2026-06-12 阶段 13 艺人档案审核发现：待审核接口不等于写动作状态保护

- `/console/artists/pending` 虽然调用的是待审核艺人接口，但页面此前没有展示 `reviewStatus`，通过/拒绝/标记风险事件入口也只接收 `artistId`，默认信任列表来源永远只返回待审核记录。
- 艺人审核和标记风险会影响活动上架与售票拦截，属于后台治理写动作；如果后端未来返回迁移中、已处理或未知审核状态，前端不能只靠接口名称假设可写。
- 更稳妥的口径是复用 `console-artists` 中的 `isKnownArtistReviewStatus()` 和 `isReviewableArtistReviewStatus()`：只有 `pending` 开放通过、拒绝和标记风险；未知或未来状态显示“状态待核对”，事件入口返回“艺人审核状态待核对，请刷新后再操作”。
- 当前本地艺人审核样本为已知 `待审核` 状态，浏览器只验证真实列表渲染、中文状态和 console；未知状态保护用源代码测试和 `.next/dev` chunk 检查留证，不为演示写临时艺人审核状态数据。

## 2026-06-12 阶段 13 评价问答发现：按钮显隐不等于事件入口状态保护

- `/console/activity-engagement` 的评价审核和购前问答已经通过 `canApproveReview()`、`canHideReview()`、`canRestoreReview()`、`canAnswerQuestion()`、`canHideQuestion()`、`canRestoreQuestion()` 控制按钮显隐，但事件入口此前仍只接收 `review.id` 或 `question.id`。
- moderation 写动作不能只依赖 JSX 当前渲染分支；如果列表状态在渲染后被刷新、后端返回未来状态，或后续代码复用处理函数，按编号直接调用会绕过状态语义检查。
- 更稳妥的口径是让评价和问答处理函数接收完整记录，在调用 `moderateAdminActivityReview()` / `moderateAdminActivityQuestion()` 前再次按 action 复核状态；未知或不可操作状态分别返回“评价状态待核对，请刷新后再操作”和“问答状态待核对，请刷新后再操作”。
- 当前本地真实样本为已知 `待审核` 评价，浏览器验证真实渲染、tab、操作入口和 console；未知状态保护用源代码测试和 `.next/dev` chunk 文案检查留证，不为演示写临时评价或问答异常状态数据。

## 2026-06-12 阶段 13 平台主办方运营员发现：未知账号状态不能进入编辑或启停

- `/console/organizer-admins` 已能把未知账号状态显示为“未知账号状态”，启停按钮文案也会显示“状态待核对”，但编辑入口此前仍会把未知 `status` 放进编辑表单，启停入口的旧拦截文案也不是统一待核对口径。
- 平台主办方运营员账号影响主办方管理权限边界；当账号状态是未来值或数据待同步时，不应允许编辑表单携带未知 status 保存，也不应把未知状态的启停按钮图标落到“启用”勾选图标。
- 更稳妥的口径是集中到 `isKnownOrganizerAdminAccountStatus()`、`isEnabledOrganizerAdminAccountStatus()` 和 `canToggleOrganizerAdminAccountStatus()`：只有 `status=0/1` 可进入编辑和启停，未知状态返回“账号状态待核对，请刷新后再操作”。
- 当前本地平台主办方运营员账号样本为已知 `启用中` 状态，浏览器验证真实列表和 console；未知状态保护用源代码测试和 `.next/dev` chunk 检查留证，不为演示写临时账号状态数据。

## 2026-06-13 阶段 13 客服账号发现：未知账号状态不应进入编辑或启停

- `/console/support-accounts` 已经能把未知客服账号 `status` 显示为“未知账号状态”，启停按钮文案也会显示“状态待核对”，但此前编辑入口仍可能把未知 `status` 带入编辑表单，启停入口的旧拦截文案也不是统一的待核对刷新口径。
- 客服账号状态影响客服主管对账号启用、停用和资料维护的权限边界；当后端新增未来状态或数据正在同步时，不应允许编辑表单携带未知状态保存，也不应把未知状态按钮图标落到“启用”勾选图标。
- 更稳妥的口径是集中到 `isKnownSupportAccountStatus()`、`isEnabledSupportAccountStatus()` 和 `canToggleSupportAccountStatus()`：只有 `status=0/1` 可进入编辑和启停，未知状态返回“账号状态待核对，请刷新后再操作”。
- 当前本地客服账号样本均为已知状态，真实页面验证只覆盖已知状态渲染和登录态访问；未知状态保护用源代码测试和 `.next/dev` chunk 检查留证，不为演示写临时客服账号状态数据。

## 2026-06-13 本地前端发现：127.0.0.1 访问会触发 Next dev HMR origin 拦截

- 使用 `http://127.0.0.1:3000` 访问前端时，浏览器 console 会出现 `WebSocket connection to 'ws://127.0.0.1:3000/_next/webpack-hmr...' failed: Error during WebSocket handshake: net::ERR_INVALID_HTTP_RESPONSE`。
- 根因不是业务接口失败，也不是 Docker 端口未转发：`curl`、容器内请求和 Node 原生 WebSocket 均能到达 `/_next/webpack-hmr`；`omni-frontend` 日志明确给出 `Blocked cross-origin request to Next.js dev resource /_next/webpack-hmr from "127.0.0.1"`。
- 本地浏览器验收如果使用 `127.0.0.1`，`next.config.ts` 需要设置 `allowedDevOrigins: ['127.0.0.1']` 并重启 dev server；否则 HMR WebSocket 错误会污染 console，并可能让页面验收状态判断失真。

## 2026-06-13 阶段 13 退款审核发现：单条审核弹窗也需要提交前状态复核

- `/console/refunds` 已经能显示未知退款状态、使用待核对样式，并且批量处理会过滤未知或不可处理状态；但单条审核此前的 draft 只保存 `id/action/note`，打开备注弹窗后如果列表状态变化，提交时仍可能按旧动作调用 `approveRefund()` 或 `rejectRefund()`。
- 退款审核属于资金相关写动作，按钮显隐和打开弹窗时的状态判断不足以覆盖“打开后状态刷新 / 后端返回未来状态 / 代码复用 submitReview”这类路径。
- 更稳妥的口径是集中到 `canApplyConsoleRefundReviewAction(status, action)`：待审核 `status=0` 可同意或拒绝，处理中 `status=4` 只可同意/重试，已退款、已拒绝、退款失败、未知或未来状态都不能进入对应单条审核动作。
- 提交备注前应通过 `refunds.find(refund => refund.id === draft.id)` 找到当前记录再复核；记录不存在或状态不匹配时返回“退款状态待核对，请刷新后再操作”，并关闭 draft，不调用退款写接口。

## 2026-06-13 阶段 13 帮助中心发现：C 端发送入口也需要未知会话状态保护

- `/support` 客服工作台已经通过 `canEditSupportConversation()`、`canReplySupportConversation()` 和 `formatSupportConversationWriteBlockedMessage()` 保护未知会话状态，但 `/help` 此前仍直接用 `conversation?.status === 'CLOSED'` 控制输入框和发送按钮。
- C 端在线客服发送会创建或追加客服消息，属于用户可见写动作；当后端新增未来会话状态或当前会话状态待同步时，不能只把非 `CLOSED` 都当作可发送。
- 更稳妥的口径是 `/help` 没有会话时允许创建新会话；已有会话时复用 `canEditSupportConversation(status)`，仅允许已知且未结束状态继续发送，未知状态通过 `formatSupportConversationWriteBlockedMessage(status)` 返回“会话状态待核对，请刷新后再操作”。
- 当前真实 `/help` 页面样本只适合做只读加载和 console 验证；未知会话状态保护用源码入口测试和共享 helper 测试留证，不为演示写入临时客服会话状态。

## 2026-06-13 阶段 13 帮助中心发现：确认结束也不能只靠按钮显示条件保护

- `/help` 的确认结束会话按钮此前只在 `conversation?.status === 'CLOSE_REQUESTED'` 时渲染，但 `confirmClose()` 事件入口只检查 `conversation` 和 `loading`，没有在调用 `confirmCloseSupportConversation()` 前复核当前会话状态。
- 确认结束会改变客服会话状态，属于用户可见写动作；如果页面渲染后状态被轮询刷新、后端返回未来状态，或后续代码复用 `confirmClose()`，只靠 JSX 显隐不足以保护写接口。
- 更稳妥的口径是新增 `canConfirmSupportConversationClose(status)`：只有 `CLOSE_REQUESTED` 可确认结束；未知状态复用“会话状态待核对，请刷新后再操作”，已知但不可确认状态显示“当前会话暂不能结束，请刷新后再操作”。
- 当前真实 `/help` 页面验证只覆盖加载和 console；确认结束状态二次保护用 helper 单测与页面入口静态测试留证，验证过程中不点击确认结束写动作。

## 2026-06-13 阶段 13 帮助中心发现：转人工入口也不能静默跳过不可写状态

- `/help` 的转人工按钮已经通过 `formatSupportHandoffActionLabel()` 对未知状态显示“状态待核对”，按钮禁用条件也复用 `canRequestSupportHandoff()`；但 `handoff()` 事件入口此前在 `!conversation || !canRequestSupportHandoff(conversation)` 时直接静默返回。
- 转人工会把会话从 AI 服务推进到人工介入，属于用户可见写动作；如果页面状态被轮询刷新、后端返回未来状态，或后续代码复用 `handoff()`，只靠按钮 disabled 不足以给用户明确反馈。
- 更稳妥的口径是保留无会话时不处理；已有会话但不可转人工时，先复核 `canRequestSupportHandoff(conversation)`，未知状态复用“会话状态待核对，请刷新后再操作”，已知但不可转人工状态显示“当前会话暂不能转人工，请刷新后再操作”。
- 当前真实 `/help` 页面验证只覆盖加载、HMR 和 console；转人工状态二次保护用页面入口静态测试留证，验证过程中不点击转人工写动作。

## 2026-06-13 阶段 13 客服工作台发现：已知但不可执行状态也需要明确反馈

- `/support` 已经通过 `canProceedWithActiveWrite()` 统一复核接入、回复、备注、标签、转接、升级和申请结束等写动作，但该守卫此前只在 `formatSupportConversationWriteBlockedMessage(active?.status)` 返回未知状态文案时设置错误提示。
- 对 `WAITING_AGENT` 执行回复、对 `ASSIGNED` 执行接入、对 `CLOSE_REQUESTED` 执行申请结束等已知但当前动作不可执行的组合，事件入口会返回 false，但没有用户可见反馈。
- 更稳妥的口径是保留未知状态专用“会话状态待核对，请刷新后再操作”，已知但不可执行状态统一返回“当前会话暂不能执行该操作，请刷新后再操作”，避免客服误以为按钮或接口无响应。
- 当前真实 `/support` 页面验证只覆盖加载和 console；已知不可执行状态反馈用页面入口静态测试留证，验证过程中不点击客服工作台写动作。

## 2026-06-13 阶段 13 风险事件发现：恢复申请阻断不能静默，主办方路径守卫不能被权限码模式吞掉

- `/console/risk-events` 此前在最新恢复申请未知状态或审核中时会禁用提交按钮，但点击事件可能静默返回，用户只能看到按钮不可用，无法知道是“状态待核对”还是“正在审核中”。
- 恢复售票申请会推动风险停售活动进入人工复核，属于主办方可见写动作；按钮显隐不足以覆盖页面刷新、列表状态变化或事件函数复用，提交前仍应按当前 `latestResolutionByActivity` 记录二次复核。
- 更稳妥的口径是集中到 `formatRiskResolutionSubmitBlockedMessage(status)`：未知或未来状态返回“恢复售票审核状态待核对，请刷新后再操作”，`pending` 返回“当前恢复售票申请正在审核中，请刷新后再操作”，阻断后不调用提交接口。
- 主办方账号可能同时带 `role=organizer` 和 `permissionCodes`；控制台 layout 必须先按主办方业务路径判断 `/console/risk-events` 等 organizer 路由，再进入权限码过滤，否则会被平台 RBAC 权限码表误重定向到 `/console`。
- Next dev 运行态可能在源码更新后仍使用旧 layout 客户端 bundle；遇到页面守卫行为和源码不一致时，应确认容器内源码和 `.next/dev` 产物，必要时重启 `omni-frontend` 后再做浏览器验收。

## 2026-06-13 阶段 13 平台健康看板发现：摘要链路健康不能替代真实基础设施探针

- 控制台首页已有 `getPlatformOpsSummary()` 聚合平台运营摘要，后端异常会进入 `PlatformOpsSummaryVO.errors`，适合先展示 ticket/payment/grab/workbench 摘要链路的“正常 / 状态待核对”。
- 这些错误来源是聚合摘要链路语义，不应把 `ticket`、`payment`、`grab`、`workbench` 等 source 原码直接暴露给平台管理员；页面应映射为“票务摘要链路 / 退款摘要链路 / 抢票摘要链路 / 工作台摘要链路”等中文标签，未知来源统一归入“其他摘要链路”。
- Nacos、Redis、RabbitMQ、Seata、Gateway 5xx/超时等属于真实基础设施或网关探针，需要独立指标、日志或健康检查来源；不能因为运营摘要接口本身可用，就把这些基础设施状态伪装成“正常”。
- 因此平台健康看板第一步只能声明“摘要聚合链路健康”，后续接入真实探针时再扩展指标项和验收命令。

## 2026-06-13 阶段 13 平台健康看板发现：基础设施探针要覆盖 Spring 构造路径

- Nacos、Redis、RabbitMQ、Seata 的健康状态已从摘要链路健康中拆出，后端通过 `PlatformOpsSummaryResponse.infrastructureHealth` 返回独立探针项；前端缺少该字段时必须显示“未配置 / 基础设施探针未配置”，不能默认显示正常。
- `PlatformInfrastructureHealthProbe` 同时有生产构造函数和包内测试构造函数时，Spring 5 在未标注注入构造函数的情况下可能退回尝试无参构造，IDEA 启动会失败为 `No default constructor found`。
- 后续新增带测试辅助构造函数的 `@Service` 时，应补 Spring 容器创建测试，或显式给生产构造函数加 `@Autowired`，避免普通单元测试只覆盖 `new` 路径而漏掉真实启动路径。
- 后端代码变更后，IDEA 中运行的 Java 服务不会自动加载新 class；涉及 `java-user`、`java-ticket`、`java-order`、`java-payment`、`java-notification` 的运行态验收，需要用户在 IDEA 重启对应服务后再做接口和浏览器验证。
