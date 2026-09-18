# Implementation Notes

## 2026-09-18 Phase ⑥-1 P2/P3 遗留问题清理收尾

- P2 手机号日志：RESOLVED。除 `UserService.register()` / `login()` 外，继续检查并修复 `UserController.sendCode()` 的 mock 验证码日志；完整手机号不再进入登录、注册或验证码日志，统一保留前 3 位、后 4 位，中间使用 `****`。新增 `UserAuthRegistrationCoverageTest.ua020a` 覆盖验证码日志脱敏。
- P2 Windows JVM 参数：RESOLVED AS LOCAL TEST SCRIPT COMPATIBILITY。问题根因为 Windows/JDK/Netty 本地 loopback 与 Unix domain socket 兼容性，不是业务代码缺陷；`scripts/verify-microservice-boundaries.ps1` 在 Windows 边界测试中自动创建 `runtime` 目录并注入 `-Djdk.net.unixdomain.tmpdir=D:/Project/omni/runtime`，生产 JVM、Docker 和 Linux 运行配置不受污染。
- P3 ESLint：RESOLVED。已按错误归属做最小修复，全量 ESLint 最新结果为 `0 errors / 218 warnings`；未关闭规则，warning 保留为非阻断项。涉及既有错误文件：`frontend/src/app/activity/[id]/page.tsx`、`frontend/src/app/console/refunds/page.tsx`、`frontend/src/components/GlobalDialog.tsx`、`frontend/src/components/Header.tsx`。
- P3 Playwright wrapper：RESOLVED AS GLOBAL CLI ENTRY。仓库原 bash wrapper 不是 Windows 原生入口；未安装系统级 bash、未修改全局 PATH，使用已安装的全局 `playwright-cli` 完成真实浏览器验收。Finder 和 Copilot 均已通过真实页面/API 联调。
- Java 最新回归：`java-common 30/30`、`java-ai-core 34/34`、`java-user 336/336`，合计 `400/400`，0 failures，0 errors。历史 `2026-09-17` 记录中的 `397/397` 保留为当日真实结果，不改写。
- Frontend 最新定向回归：`62/62`；`pnpm typecheck` 通过；`pnpm build` 通过，静态页面 `54/54`。
- Finder 真实验收：输入“帮我找广州的天鹅湖演出，预算700元以内”，`interpret` 返回 HTTP 200，解析 `keyword=天鹅湖`、`city=广州`、`maxPrice=700`；`search` 返回 HTTP 200 和 3 个可售票档。
- Copilot 真实验收：平台管理员账号 Generate 成功；Accept 后状态为 `ACCEPTED`，Edit 后为 `ACCEPTED_EDITED`，Reject 后为 `REJECTED`；`support_ai_suggestion` 新增 `29/30` 两条记录，`conversation=988102` 的 `support_message` 数量保持 `1`，Accept 未自动发送客服消息。
- 安全回归：`UserService` 日志仅保留脱敏手机号；AI 日志未发现 prompt、完整客服上下文、Authorization、JWT、API key、supplier key 或模型凭证。此前各章节中的历史问题描述保留为历史验收记录，当前状态以本节为准。
- 边界与生产拆库回归：`verify-microservice-boundaries.ps1`、`check-production-split-sql.ps1`、`check-cross-owner-fks.ps1`、`check-production-runtime-defaults.ps1`、`verify-production-split-runtime.ps1`、`verify-prod-split-real-demo-seed.ps1` 均通过。
- `git diff --check` 通过；未执行 commit、push、merge、reset、restore、checkout、clean 或 rebase。

## 2026-09-17 Phase ⑥-1 P2/P3 遗留问题清理

- P2 UserService 完整手机号日志：RESOLVED。根因是 `UserService.register()` 与 `UserService.login()` 成功日志直接输出 `request.getPhone()` / `user.getPhone()`；已改为仅输出 `138****5678` 形式的脱敏手机号，接口响应、JWT 生成、验证码和用户查询链路未改。
- 验证：新增 `UserServiceTest.registerLogsMaskedPhoneOnly`、`UserServiceTest.loginLogsMaskedPhoneOnly` 先红后绿；`mvn -pl java-user "-Dtest=UserServiceTest" test` 通过 `29/29`，日志中未出现 `13812345678`，仅出现 `138****5678`。
- P2 Windows `jdk.net.unixdomain.tmpdir`：RESOLVED AS LOCAL TEST SCRIPT COMPATIBILITY。`mvn -pl java-user -am test` 在不带参数时复现 `java-ai-core` 的 `AiHttpLifecycleTest` 5 个 error，根因为 Windows/JDK 本地 `HttpServer` selector loopback 初始化触发 `Unable to establish loopback connection` / `UnixDomainSockets ... Invalid argument`，不是 Java 业务代码缺陷。
- 修改：`scripts/verify-microservice-boundaries.ps1` 仅在 Windows 主机执行 Java boundary tests 时自动追加 Surefire `-DargLine=-Djdk.net.unixdomain.tmpdir=D:/Project/omni/runtime`，并确保 `runtime` 目录存在；README 和 AGENTS 增加同一说明，未把该参数写入 Maven 父 POM、Docker 或生产 runtime。
- 验证：`mvn -pl java-user -am "-DargLine=-Djdk.net.unixdomain.tmpdir=D:/Project/omni/runtime" test` 通过；`powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1` 无需手工 JVM 参数即通过，并打印 Windows test JVM option。

## 2026-09-17 Phase ⑥ production split manifest consistency

- 本阶段重新执行 `scripts/verify-production-split-runtime.ps1` 时发现 `omni_ticket_split.activity_artist` 已真实存在且包含同 owner 外键，但 `sql/production-split/manifest.json` 未登记该表，导致 runtime verifier 将 `activity_artist_activity_id_fkey` 判定为未知 child table。
- 已按最小范围补齐 `java-ticket` manifest：登记 `activity_artist`，并登记其既有来源迁移 `ticket/20260522_activity_multi_artist_phase1.sql`、`ticket/20260522_activity_artist_governance_phase2.sql`；未新增 migration、未修改数据库和业务规则。
- 同步将 `activity_artist` 的实际列集合加入 `scripts/check-production-split-sql.ps1` 白名单，使 manifest、生产迁移和 runtime FK 校验口径一致。
- 偏离说明：该问题属于生产拆库资产登记遗漏，不是 `ActivityArtist` 业务实现或数据库缺表；此前通过的静态检查未覆盖“运行库已有外键表必须全部出现在 manifest”这一运行态条件。

## 2026-09-17 Phase ⑥ production split manifest completeness follow-up

- 修复 `activity_artist` 后重新运行 runtime verifier，继续发现 `activity_risk_resolution` 以及 `seat_layout_version`、`seat_layout_version_block`、`seat_layout_version_override`、`seat_layout_version_ticket_group`、`seat_layout_version_group_binding` 已存在于 `omni_ticket_split`，但未完整登记在 ticket manifest。
- 已核对这些表分别由既有 `20260522_activity_risk_response_phase3.sql` 和 `20260524_seatcraft_layout_versioning.sql` 创建，源码也存在对应实体；已一次性补齐 manifest、owner 清单和静态列白名单。
- `undo_log` 为 Seata 基础设施表，不纳入业务表 manifest；未修改其结构或迁移口径。

## 2026-09-15 Gateway AI Finder timeout

- 在 `java-gateway` 的基础配置和 `prod-split` profile 中新增 `ai-ticket-finder` 专用路由，放在通用 `ticket-service` 路由之前。
- 路由只匹配 `/api/ticket/ai/finder/**`，目标仍为 `lb://java-ticket`；沿用现有 `GATEWAY_CONNECT_TIMEOUT_MS`，响应超时默认由 `GATEWAY_AI_FINDER_RESPONSE_TIMEOUT_MS` 配置为 `35000ms`。
- 普通 `/api/ticket/**` 继续使用 `GATEWAY_DEFAULT_ROUTE_RESPONSE_TIMEOUT_MS` 默认 `5000ms`；未修改其他 Gateway route、认证或业务服务。
- 验证：完整 Java reactor `compile`、Gateway 全量测试（`java-common 30`、`java-gateway 35`）和 `git diff --check` 通过；重启后的 Gateway 以 `prod-split` 运行并完成 Nacos 注册。
- 运行态诊断确认 `POST /api/ticket/ai/finder/interpret` 命中 `routeId=ai-ticket-finder`、目标 `lb://java-ticket`；`GET /api/ticket/categories` 命中通用 `routeId=ticket-service`，活动列表仍命中原有 `ticket-hot-read-service`。
- Actuator 未引入，`/actuator/gateway/routes`、`/actuator/routes` 和 `/actuator/health` 均为 `404`，因此使用既有 Gateway diagnostics 日志和真实请求进行验证。带有效 JWT 的真实 Finder 请求耗时 `8721ms` 后返回 java-ticket 的 `502 AI 找票解析结果格式不正确`，未出现 Gateway `5000ms` 截断；该模型输出格式问题属于本轮明确不处理的剩余联调阻塞。
- 首次重启曾因本机 JDK 17/Windows Netty selector 的 Unix domain socket `Invalid argument` 失败；未改源码或配置，按既有本地运行记录仅为 Gateway 进程增加 `-Djdk.net.unixdomain.tmpdir=D:/Project/omni/runtime` 后启动成功。

## 2026-09-15 AI 功能详细技术设计文档化

- 按用户明确要求，将第二阶段设计保存为根目录 `Omni AI 功能详细技术设计 V1.md`，包含 14 个主题、找票与 Copilot 调用链、DTO/Schema、API、表设计、Prompt、前端、权限和测试计划。
- 文档区分现有源码与拟新增能力；保留场次级核验、连座未知状态、Copilot 草稿隔离和微服务数据边界。
- 文档整理说明：将首轮幂等字段 `initial_request_id` 合并进建表定义，并明确 SSE 终态互斥及事件 JSON 编码规则；SQL 仅作设计展示，未执行。
- 范围：本次只新增设计文档并同步本说明，未修改业务代码或配置，未创建功能文件，未执行数据库迁移、构建、业务测试、下载、提交或推送；既有审计文档保持原状。

## 2026-09-14 AI 改造前审计报告文档化

- 按用户后续明确要求，将只读审计整理为根目录 `Omni AI 改造前项目审计报告.md`，参考既有架构文档格式，保留 26 个主题、调用链、源码索引及风险边界。
- 报告区分源码已实现、配置能力、未动态验证和建议新增内容；保留现有 LLM/SSE、搜索聚合限制、客服上下文、RBAC 及拆库约束。
- 范围：仅文档变更，未修改业务代码、配置或数据库，未实现 AI 功能，未执行构建/业务测试、下载、迁移、提交或推送。
- 偏离说明：原审计阶段禁止创建文件；本次用户已明确授权保存根目录 Markdown，因此只新增报告，并按项目规则同步本说明。

## 2026-09-13 平台账号管理合并

- 前端新增 `/console/accounts`，合并客服主管、普通客服、平台主办方运营员三类账号管理；客服列表复用 `/api/user/support/admin/accounts` 并按 `supportRole` 拆 Tab，运营员列表继续走 `/api/user/console/organizer-admins`。
- 侧边栏“系统、安全与财务”移除 `/console/support-accounts` 与 `/console/organizer-admins`，新增“平台账号管理”；权限表新增 `/console/accounts`，具备 `support.account.manage` 或 `organizer.account.manage` 任一权限即可进入。
- 旧账号路由保留为兼容跳转：客服账号页跳 `/console/accounts?type=support`，运营员账号页跳 `/console/accounts?type=organizer`；个人中心、运营工作台和快捷入口同步改到新路由；`/console/support-conversations` 继续作为“查看会话记录”的兼容入口并在布局守卫中放行。
- 页面采用三级并列 Tab、高密度 `ConsoleTable`、`ConsoleTableSkeleton` 加载态、中文表单标签和 11 位手机号校验；提交按钮带保存态，行操作继续使用编辑、启用/停用、删除。
- 偏离说明：运行较宽的前端静态测试时命中既有非账号页面断言失败，涉及艺人审核、风险审核、站点变更审核和客服会话旧断言；本轮未修改这些页面。
- 验证：新增账号路由与页面静态测试先红后绿；`node --test src\lib\console-auth.test.ts src\lib\console-layout-menu.test.ts src\lib\console-paths.test.ts src\lib\console-accounts-page.test.ts` 通过 `24/24`；`pnpm typecheck` 通过。未提交或推送 Git，未调用真实账号写操作接口。

## 2026-09-13 客服技能组树与三栏工作台实现

- 已按批准的兼容式增量方案完成设计与实现：复用 `support_conversation`、`support_message`、`support_conversation_note`、`support_conversation_audit`，不新建平行 `cs_session` 数据域。
- 新增生产迁移 `sql/production-split/user/20260913_customer_service_tree_and_audit.sql`，作用于 `omni_user`；新增 `cs_skill_group`、`cs_agent_member`、`cs_session_audit`，并扩展 `support_conversation.skill_group_id`、`sla_timeout_flag`。本地 `omni_user` 已执行迁移，`omni_ticket_split` 未创建客服表。
- `java-user` 新增 `/api/user/cs/*` Façade，覆盖组织树、会话分页、消息流、认领、转接、升级、质检和内部备注；状态映射为 `ACTIVE/CLOSED/NEED_AUDIT`，转接、升级、质检均写 `operation_audit_log`。
- 权限口径：普通客服只能查看本人会话和公共待认领池；`cs.manage`可管理、转接、升级和写入质检；`cs.review`仅可查看待质检队列；平台超管沿用全量权限。
- `java-ticket` 新增订单画像接口，通过 `java-order` internal API 获取最近两笔订单摘要，接口最终返回数组；票务异常或超时返回空数组，不阻断客服主流程，未新增跨库 Mapper/Entity/SQL。
- 前端新增 `/console/customer-service/sessions` 三栏工作台，旧 `/console/support-conversations` 兼容跳转；侧边栏、登录默认入口、快捷入口和个人中心均已切换到规范路由。质检查看与质检写入控件已分权。
- 设计与实施文档：`docs/superpowers/specs/2026-09-13-customer-service-workbench-design.md`、`docs/superpowers/plans/2026-09-13-customer-service-workbench.md`。
- 验证：前端客服工作台测试 `6/6`、相关路由测试 `42/42`、`pnpm typecheck` 通过；`java-user` 客服定向测试 `8/8`、`java-ticket` 订单画像与控制器测试 `142/142` 通过；生产拆库 SQL、跨 owner FK、微服务边界检查通过。未提交或推送 Git，未调用真实客服写操作接口。
- 2026-09-13 负载树整改：`CsOrgTreeResponse` 的根、技能组和坐席节点新增 `totalCount`；`activeCount` 仅统计可见未结单会话，`totalCount` 仅统计可见已结单会话。平台超管或 `cs.manage` 统计全平台含未归组数据，`support_manager` 按 `cs_skill_group.leader_user_id` 限定管辖组，普通坐席沿用本人会话与公共池可见范围。
- 中间流水线保持 `session_id` 单条服务端分页，不再使用前端 `selectCustomerServiceSessions` 二次过滤；树节点筛选通过 `groupId`、`agentId`、`unassignedOnly`、`sourceType` 下推到 `java-user`。
- 新增 `GET /api/user/cs/users/{userId}/sessions-history`，按当前登录人可见范围返回用户历史会话摘要，服务端按用户条件查询并在服务层二次校验，右侧仅在“用户全历史轨迹”Tab 激活时异步加载。
- 前端右侧画像拆为“订单与质检 / 用户全历史轨迹”双 Tab；聊天区仍只展示当前选中的单次会话。新增回归测试后 `java-user` 客服及既有支持链路 `53/53`、前端客服工作台测试 `8/8` 通过；本轮未新增数据库迁移、未调用真实客服写操作接口。
- 2026-09-13 紧急中栏整改：按最新指令将当前服务端分页页内的 `CsSessionVO[]` 按 `userId` 聚合为用户主卡片；同一页同一用户只渲染一张卡片，默认折叠，展开后显示会话子目录，点击子会话仍只加载该 `sessionId` 的聊天流。跨页用户不在客户端合并，完整历史继续由右侧“用户全历史轨迹”按需加载。新增前端回归后客服工作台测试 `10/10` 通过。

## 2026-09-12 主办方入驻审核和管理重构

- 已确认采用“材料关联表 + 复用 `user_asset`”方案；申请历史按申请单保留，驳回后重新提交生成新申请，材料不跨申请复用。
- 已确认 `PENDING` 申请才允许维护材料，`APPROVED` / `REJECTED` 申请只读；正式主办方名录的在售活动数通过 `java-ticket` 批量接口异步补充，3 秒超时降级为 `-`。
- 本轮先创建用户库生产迁移 `sql/production-split/user/20260912_organizer_application_material.sql`，新增 `organizer_application_material`，移除申请人唯一索引并改为普通索引；已登记到生产拆库 manifest。
- 本地数据库迁移已在 `localhost:5432/omni_user` 执行：`organizer_application_material` 已创建，`idx_organizer_application_user_id` 已由唯一索引调整为普通索引；未调用真实冻结、材料上传等有副作用业务接口。
- 申请材料边界补齐：`BUSINESS_LICENSE`、`ID_CARD_FRONT`、`ID_CARD_BACK` 重复上传会替换旧材料关联并清理旧资产，`OTHER_QUALIFICATION` 保留多材料能力；正式名录的 `followUpOperator` 已在用户域分页前解析运营员和 assignment，避免分页后过滤造成总数与结果错位。
- java-user 启动失败根因：`OrganizerApplicationService` 同时存在两个 `@Autowired` 构造器，Spring 启动时报 `Invalid autowire-marked constructor`；已保留完整依赖构造器注入，移除 4 参数兼容构造器上的 `@Autowired`，并新增单构造器回归测试。
- 验证：新增构造器回归测试先按 `2 != 1` 红灯复现，再修复为绿灯；用户域定向测试 `24/24` 通过。使用 `prod-split`、临时端口、固定 `D:\Project\omni\runtime\java-tmp` 启动 `java-user`，已看到 `Started UserApplication`，随后停止临时进程。票务域定向测试 `142/142`、前端主办方/API/抽屉测试 `57/57`、`pnpm typecheck`、`verify-microservice-boundaries.ps1`、`check-production-split-sql.ps1`、`check-cross-owner-fks.ps1` 均已通过。

## 2026-09-09 退款真实交易链路修复

- 根因校正：用户已接入支付宝沙箱并完成真实支付；本地 `payment.id=984058 / order_id=980058` 有真实 `trade_no=2026061122001424640509936851`、`buyer_id=2088722102024642` 和支付宝回执。前一轮把问题归结为“未配置支付宝”不准确。
- 真实退款不可达原因：报错入口审核的是 `refund_request.id=985009 / REFREAL985009`，它绑定 `payment.id=984006 / DMREAL980006 / ALI-REAL-980006`，该流水来自 `sql/seeds/prod-split-real-demo/03-payment.sql` seed，`raw_notify/callback_data` 为空，不是支付宝真实支付回传交易；真实沙箱支付 `984058 / order 980058` 当前没有对应退款申请。
- 修复：`RefundService` 新增支付宝可退流水校验，要求 `payment_method=ALIPAY` 且 `raw_notify` 或 `callback_data` 中包含支付宝 `trade_no` 回执；C 端申请退款和内部直接退款会拒绝 seed/伪成功流水，后台审核遇到此类申请会落为 `REFUND_STATUS_FAILED(status=3)` 并返回原因，不再调用 Alipay 真实退款接口。
- 保留修复：`RefundService.approve()` 对真实 Alipay 调用仍捕获 `AlipayApiException` 与渠道 `RuntimeException`，统一落到“退款结果未知，请稍后重试/查询”，避免渠道异常冒泡为 HTTP 500；成功后订单回写失败仍进入人工补偿分支。
- 偏离说明：没有重新 POST `POST /api/payment/refunds/985009/approve` 或调用支付宝退款接口，因为审核同意会产生真实退款副作用；当前只做只读 DB 取证和自动化测试。
- 验证：只读 DB 确认 `985009` 绑定的 `984006` 没有支付宝回执，`984058` 有真实回执但无退款申请；新增 `RefundServiceBoundaryTest.approveRefundRejectsUnconfirmedAlipayPaymentBeforeCallingChannel` 并按红绿验证通过，随后 `mvn -pl java-payment "-Dtest=RefundServiceBoundaryTest,RefundControllerTest" test` 通过 30 项，`mvn -pl java-payment test` 通过 99 项。

## 2026-09-08 退款审核表格 7 列瘦身

- 根因：`frontend/src/app/console/refunds/page.tsx` 仍按 10 列渲染退款编号、订单与活动、用户编号、状态、申请时间、审核备注/时间等独立列，固定表格在 1080P 宽度下压缩到最右侧操作列不可见。
- 处理：表格收敛为 7 列：单号与用户、演出活动、退款金额、申请原因、状态与批注、时间记录、操作。批量选择框并入首列；订单号和用户 ID 作为首列副文本；审核备注进入状态 Badge 的 hover 气泡；申请时间和审核时间上下两行展示。
- 交互：申请原因改为单行截断并通过黑色 Tooltip 展示完整内容；活动名称、退款单号和订单/用户副文本均使用 `truncate`/`title`；待审核操作按钮缩短为“同意 / 拒绝”，处理中为“重试”，完结记录显示“已完结”。
- 验证：新增退款页结构断言，先确认旧 10 列测试失败，再改为 7 列通过；当前工作区前端在 `localhost:3001` 浏览器实测，表头 7 列，`documentWidth=1920` 等于视口宽度，首行“同意/拒绝”按钮右边界 `1673.33 < 1920`。

## 2026-09-07 艺人头像缺失补齐

- 根因：`omni_ticket_split.artist` 仍有 58 条空 `avatar`，截图中的 `周杰伦(id=1)` 只是其中一条；`SafeImage` 的首字 fallback 属于容错表现，不是数据治理结果。
- 处理：新增 `sql/production-split/ticket/20260612_artist_avatar_completion.sql` 并加入生产拆库 manifest，回填 58 条空头像。周杰伦、中国儿童艺术剧院、中国摄影家协会、上海交响乐团使用公开 Wikimedia 素材归档；其余基础/演示档案复用仓库已有对应演出宣传图，并在 `sql/seeds/prod-split-real-demo/artist-avatars.json` 记录来源或本地资源关系。
- 种子同步：`sql/seed.sql` 与 `sql/seeds/prod-split-real-demo/01-ticket.sql` 均不再为这批档案写入空头像；同名演示档案复用同一素材或对应活动图。
- 偏离说明：Wikimedia 个别缩略图接口返回尺寸错误，未将错误响应保存为图片；中央芭蕾舞团使用仓库已有对应演出宣传图。当前已有 `id=31` 的上传头像仍由运行时 `/uploads/...` 路径提供，不属于本次空值回填。
- 数据库执行：2026-09-07 已在本地 `omni_ticket_split` 执行回填，`UPDATE 58`；当前 `artist` 共 77 条，空头像数量为 0。
- 验证：`node --test src/lib/image-rendering-production-entry.test.ts` 通过 6/6；新归档 JPG 已检查为有效 JPEG，所有本次回填路径对应静态资源存在。

## 2026-09-06 后台三大模块治理与侧边栏折叠修复

- 侧边栏折叠：`frontend/src/app/console/layout.tsx` 原实现把 `groupActive` 与展开状态绑定，当前路由命中分组时会强制 `expanded=true`，导致“运营、客服与审核”等分组点击后无法收回；现改为路由变化时仅把命中分组并入 `openGroups`，渲染时完全以 `openGroups.includes(group.id)` 控制展开，高亮仍由 `groupActive` 独立控制。
- 订单与履约：订单状态筛选补齐 `待支付(status=1)`；订单页增加订单号/脱敏手机号精确检索、活动海报与场次信息展示；现场核验页增加“手动应急核验”票码输入、设备编号和右下角状态 Toast；退款批量审核改为单次调用 `POST /api/payment/refunds/admin/batch-review`。
- 退款后端：`java-payment` 新增 `BatchReviewRefundRequest` 与 `RefundService.batchReview()`，在本地事务内对批量审核请求做去重、参数校验和同意/拒绝分派；偏离说明：外部支付渠道与跨服务订单状态副作用不属于单库事务，不能被本地事务完全回滚，生产侧仍建议补偿任务与对账兜底。
- 运营、客服与审核：客服会话详情顶部挂载认领、转接、升级和结束操作；场馆审核、站点配置审核等页面收敛为独立 Modal 审核意见，不再复用页面级 textarea；风险案例页改为紧凑表格与弹窗化“去审核处置/查看恢复记录”；评价问答管理首屏通过 `Promise.allSettled` 预加载角标数量。
- 系统、安全与财务：主办方运营员账号删除改为 `status=0` 软删除，保留历史审计引用；日结批次生成入口改为标准 Modal；异常任务新建/处理/关闭延续 Drawer/Modal 工单化交互。
- 验证：`node --test src/lib/console-layout-menu.test.ts src/lib/console-orders.test.ts src/lib/api.test.ts src/lib/console-modal-drawer-layout.test.ts`、`node --test src/lib/api.test.ts src/lib/check-in-production-entry.test.ts`、`pnpm typecheck`、`mvn -pl java-payment -Dtest=RefundControllerTest test`、`mvn -pl java-user -Dtest=OrganizerAdminAccountServiceTest test`、`mvn -pl java-ticket -Dtest=AdminControllerTest test`、`mvn -pl java-order -Dtest=TicketCheckInServiceTest test` 均通过。

## 2026-09-06 Seata 自动刷新计划任务弹窗

- 根因：`OmniRefreshSeataEvery5Min` 仍处于 Enabled，按 5 分钟触发；`OmniRefreshSeataOnNetwork` 仍指向旧动作 `powershell.exe -NoProfile -ExecutionPolicy Bypass -File D:\Project\omni\scripts\start-seata-docker.ps1`，没有隐藏窗口参数。
- 当前处理：已成功终止一次正在运行的 `OmniRefreshSeataEvery5Min`，但当前会话执行 `schtasks /Change ... /DISABLE` 返回 `Access is denied`，无法代替用户禁用/删除计划任务。
- 后续口径：需要管理员 PowerShell 删除或禁用 `OmniRefreshSeataEvery5Min`、`OmniRefreshSeataOnNetwork`、`OmniRefreshSeataOnLogon`；IDEA 模式下需要刷新 Seata 时手动运行 `scripts\refresh-seata-advertise-host.ps1 -Force` 即可。

## 2026-09-06 删除 Java Compose overlay

- 用户确认继续使用 IDEA 启动 Java 服务，不再保留 Java 服务容器化 overlay。
- 已删除本轮新增的 `docker-compose.java.yml`，避免后续误用 overlay 把 Seata 切换为 Docker 内部服务名。
- 当前 IDEA 模式仍使用 `scripts/refresh-seata-advertise-host.ps1` / `scripts/start-seata-docker.ps1` 将 Seata 注册为宿主机可达 IPv4。

## 2026-09-06 评价问答管理首屏角标预加载

- 根因：`frontend/src/app/console/activity-engagement/page.tsx` 只在当前 Tab 的 `refreshActive()` 中加载列表，Tab 角标直接取三个列表数组的 `length`，未访问的 Tab 首次进入时仍为空数组。
- 修复：新增独立 `badgeCounts` 状态，挂载时通过 `Promise.allSettled` 并行请求评价 `status=0`、举报 `PENDING`、问答 `PENDING` 三个待处理列表作为角标数据源；当前 Tab 列表仍按原筛选条件加载。
- 联动：评价审核、评价举报、问答回复/隐藏/恢复成功后，先刷新当前列表，再重新加载全部角标，避免处理后角标残留。
- 口径偏离：当前前端 API 没有专用 count/badge 聚合接口，因此复用三个后台列表接口统计待处理数量；角标请求单个维度失败时保留该维度已有值并记录中文错误日志。
- 验证：`node --test src\lib\activity-engagement-production-entry.test.ts` 通过 7/7；`pnpm typecheck` 通过。

## 2026-09-06 Java 服务 Docker Compose 网络 overlay

- 目标：解决宿主机 WLAN IP 变化导致 Seata Server 注册到旧地址、Java 服务继续连接旧 `SEATA_IP` 的问题。
- 方案：新增 `docker-compose.java.yml` overlay，保留现有 `docker-compose.yml` 作为本地中间件/前端/grab 基础；Java 六个服务进入同一个 Compose 网络。
- 服务通信：Java 容器使用 `nacos:8848`、`seata-server:8091`、`rabbitmq:5672`、`elasticsearch:9200`、`grab-service:3001`；PostgreSQL 仍按当前本机拆库口径走 `host.docker.internal:5432`。
- Seata 口径：overlay 中 `seata-config-init` 发布 `service.default.grouplist=seata-server:8091`，`seata-server` 也用服务名注册，避免依赖宿主机动态 IPv4。
- 网关修复：`java-gateway` 基础配置里的 `/api/waitlist/**` 和 `/api/grab/**` URI 改为环境变量可覆盖，本地默认仍保持 `http://localhost:3001`。
- 运行偏离：首次使用 Java overlay 会拉取 `maven:3.9.9-eclipse-temurin-11` 并在 `java-maven-repo` 卷内下载 Maven 依赖；容器 Maven 全局 settings 使用阿里云 public 镜像；未把 PostgreSQL 容器化，继续复用本机 `localhost:5432` 数据库。
- 启动修复：Java overlay 原命令 `mvn -pl <module> -am spring-boot:run` 会先在父 POM `omni-ticket-parent` 执行 Spring Boot 插件并报 `Unable to find a suitable main class`；已改为 `java-common-build` 一次性安装 `java-common`，各服务再用 `mvn -f <module>/pom.xml spring-boot:run` 启动自身模块。

## 2026-09-06 IDEA 模式 Seata 地址自动刷新

- 回退口径：用户放弃 Java 服务容器化，继续用 IDEA 启动 Java 服务；Seata 需要恢复为宿主机可达 IPv4，而不是 Docker 内部服务名 `seata-server`。
- 运行态修复：执行 `scripts/start-seata-docker.ps1` 后，Nacos `SEATA_GROUP@@seata-server`、`service.default.grouplist` 和 `omni-seata` 容器 `SEATA_IP` 均恢复为当前 WLAN IP `10.150.195.38:8091`。
- 自动任务根因：原计划任务只在登录/网络事件触发，且直接运行 `start-seata-docker.ps1`；登录时 Docker Desktop 未就绪会直接失败，后续不会自动重试。
- 修复方案：新增 `scripts/refresh-seata-advertise-host.ps1`，先检测当前主 IPv4、Nacos grouplist 和容器 `SEATA_IP`，只有不一致时才调用 `start-seata-docker.ps1`；Docker 未就绪时记录日志并等待下次计划任务重试。
- 日志位置：自动刷新日志写入 `runtime/logs/seata-auto-refresh.log`，该目录仍属于本地运行态，不提交。

## 2026-09-06 后台表格防挤压与 Modal/Drawer 收敛

- 基础组件：新增 `frontend/src/components/ui/Modal.tsx` 和 `Drawer.tsx`，支持 ESC/遮罩关闭、中文关闭按钮、默认/自定义 footer、危险操作红色主按钮和右侧抽屉滑入布局。
- 表格排版：`/console/tours`、`/console/artists`、`/console/sessions`、`/console/venue` 及本轮触达的活动/异常任务表格补齐 `whitespace-nowrap`、功能列最小宽度、长文本 `truncate` 和横向滚动兜底，避免状态、进度和操作按钮被挤压成竖排。
- Modal 收敛：场次编辑、场馆新增/编辑、主办方入驻审核、待审核艺人、退款审核、风险恢复审核、平台主办方运营员账号、客服账号、巡演城市站发布、活动删除/通知/风险停售、异常任务处理均从 inline 表单或共享 textarea 改为专属弹窗。
- Drawer 收敛：场次票档配置、SeatCraft 票档与座区绑定、活动场地临时变更、主办方运营跟进和异常任务新建均改为右侧 Drawer，主列表和画布不再被表单下推。
- 测试覆盖：新增 `frontend/src/lib/console-modal-drawer-layout.test.ts`，并更新 `console-production-entry.test.ts` 中旧手写抽屉断言，覆盖通用组件、关键表格列和本轮 Modal/Drawer 化入口。
- 验证：`node --test src\lib\console-modal-drawer-layout.test.ts src\lib\console-production-entry.test.ts src\lib\console-sessions.test.ts src\lib\console-refunds.test.ts src\lib\console-artists.test.ts` 通过 81/81；`pnpm typecheck` 通过；`pnpm build` 通过。

## 2026-09-05 活动发布管理页排版与类目联合过滤

- 页面排版：`/console/activities` 移除顶部两个说明型草稿卡片，右上角仅保留「巡演草稿箱」和「+ 新建演出活动」；搜索、类目、状态、查询和重置整合为紧凑筛选栏。
- 类目筛选：前端类目选择器直接透传 `categoryId` 给普通活动与巡演管理查询；后端后台活动列表按 `activity.category_id` 过滤，巡演列表按 `tour.category_id` 过滤，保证混合分页列表中两类主体使用同一类目口径。
- 批量操作：批量条从表格底部移到表头正上方，选中活动后展示浅蓝提示条；按钮文案按单选/多选自适应，提供「取消选择」清空选中项。
- 行与操作列：演出活动列补充海报、类目、实名制和可转赠标签；操作列常驻「继续配置」「座位票档」，删除、风险停售、营销配置等低频或高危动作收纳进更多菜单，并用红色警示高危项。
- 分页复原：表格底部仅保留 `GlobalPagination`，不再夹带批量操作块。
- 验证：`node --test src\lib\console-production-entry.test.ts` 通过 55/55；`pnpm typecheck` 通过；`pnpm build` 通过；`mvn -pl java-ticket "-Dtest=AdminControllerTest,TourStationServiceTest" test` 通过 177/177。

## 2026-09-04 项目架构上下文文档

- 文档生成：新增根目录 `精准地掌握整个项目架构.md`，用于后续 AI 助手快速理解 Omni 项目架构、前端/B 端路由、RBAC、公共组件、核心实体与主要 API 数据流。
- 范围口径：基于当前源码静态解析，覆盖 `frontend/`、`java/`、`nestjs/grab-service/`、`sql/production-split/` 和 Gateway 路由配置；未修改业务代码。
- 文件名偏离：用户给出的名称末尾含空格，Windows 文件名对尾随空格不可靠；实际创建为 `精准地掌握整个项目架构.md`。

## 2026-09-03 顶栏搜索输入联想与模糊搜索

- 根因：后端 ES 搜索已支持 `keyword=孙` 返回「孙燕姿」相关巡演，但顶栏搜索 Popover 只展示历史搜索和热门榜单，用户输入过程中没有把实时搜索结果展示出来。
- 修复：`Header` 在用户输入关键词时通过 260ms 防抖调用既有 `/api/ticket/activities` 搜索接口，展示「相关推荐」联想区，最多返回 6 条活动/巡演；点击联想项直接进入 `/activity/:id` 或 `/tour/:id`，点击「搜索 "关键词" 相关结果」进入搜索结果页。
- 保留：空输入状态仍展示历史搜索和动态热门榜单；placeholder 恢复为中立短文案「搜索演出、艺人、场馆...」，`Enter ↵` 继续使用 `shrink-0 whitespace-nowrap` 防遮挡。
- 视觉优化：移除右上角红色「模糊搜索」药丸和首行重粉色底；输入框与直达行统一使用 `Search` 单色线框图标，直达行和联想结果仅在 hover 时显示浅灰底，命中的用户输入词用品牌主色局部高亮。
- 验证：`keyword=孙` 通过 Gateway 返回「2026就在日落以后 / 孙燕姿」巡演；Docker 前端首页 HTTP 输出包含新 placeholder 与 `shrink-0 whitespace-nowrap`；`node --test src\lib\header-search-popover-production-entry.test.ts` 和 `pnpm typecheck` 均通过。

## 2026-09-03 搜索框提示词与 Enter 标识布局修复

- 根因：顶栏搜索框固定宽度为 `320px`，长 placeholder 与右侧 `Enter ↵` 快捷提示争用横向空间，快捷提示未设置 `shrink-0`，窄视口下容易出现视觉遮挡。
- 修复：将 placeholder 缩短为「搜索演出、艺人、场馆...」；搜索框在中等桌面宽度使用 `340px`、大屏使用 `380px`；输入框启用 `truncate`，`Enter ↵` 标识启用 `shrink-0 whitespace-nowrap`，避免互相覆盖。
- 验证：更新 `header-search-popover-production-entry.test.ts`，并执行前端类型检查与该入口测试。

## 2026-09-03 全局搜索热搜与详情返回优化

- 全局搜索：`Header` 搜索框升级为聚焦弹出的历史搜索 + 动态热门榜单 Popover；占位文案当前为「搜索演出、艺人、场馆...」，未登录历史使用 `search_history_records` localStorage，登录态调用 `/api/v1/search/history`。
- 动态热榜：新增 `/api/v1/search/trending`，后端优先从 `search_history` 聚合 Top 10，再通过 `ElasticsearchActivitySearchProvider` 按 `relevance` 解析活动/巡演目标；无历史数据时从 ES 推荐搜索生成榜单，不保留前端硬编码热榜词条。
- 搜索链路：新增 `SearchController`、`SearchHistoryService`、`SearchHistoryMapper` 和 `search_history` 表；Gateway 新增 `/api/v1/search/** -> java-ticket` 短读路由。搜索仍由 ES provider 执行，ES 不可用时返回搜索服务异常，不回退 DB 搜索。
- 详情返回：新增共享 `FloatingBackButton`，活动详情和巡演详情页均展示左侧悬浮「返回上一页」；优先恢复搜索页缓存 URL 与滚动位置，其次站内 `router.back()`，外链直达回退首页，并上报 `omni_activity_detail_back_clicked` / `omni_tour_detail_back_clicked`。
- 搜索页缓存：搜索结果卡片和右侧推荐点击前保存 `/search` 当前 URL 与滚动位置，返回时通过 `restoreSearchScrollIfPending()` 恢复，不强制重置第一页。
- 本地迁移：已对 `omni_ticket_split` 执行 `sql/production-split/ticket/20260609_search_history.sql`，创建 `search_history` 及用户历史、关键词热度索引。
- 本轮联调：前端已按用户口径运行在 `omni-frontend` Docker 容器；`java-ticket`、`java-gateway` 已重启加载新接口；`/api/v1/search/trending` 通过 Gateway、`java-ticket` 直连和前端代理均返回 `code=200`。
- 索引重建：通过后台管理员 token 执行 `scripts/rebuild-activity-search-index.ps1`，返回 `code=200`，新索引 `omni_activity_v1_20260903121556938_924ed371` 原子切换到 `omni_activity_current`，`_count=145`。
- 断开验证：短暂停止 `omni-elasticsearch` 后，搜索接口返回 `code=503` 与「搜索服务暂时不可用，请稍后重试」，未返回 DB 搜索结果；恢复 ES 后同一关键词搜索重新返回 `code=200`。
- 启动偏离：手动单独启动 `java-ticket` 时，`application-prod-split.yml` 要求显式 RabbitMQ 环境；本轮临时启动通过命令行传入 `spring.rabbitmq.*` 参数。推荐继续使用 `start-project.ps1`，脚本已内置本地 RabbitMQ 与强制 ES 默认值。
- 验证：前端目标 Node 测试 18/18 通过，`pnpm typecheck` 通过；Java 搜索/ES 配置/MQ/网关路由测试共 57 项通过；`check-production-runtime-defaults.ps1`、production-split SQL 安全检查与 cross-owner FK 检查通过。

## 2026-09-03 活动推荐海报回传修复

- 根因：活动详情页主图来自详情接口，可以正常显示；底部推荐活动来自 Elasticsearch 搜索结果，但 `ActivitySearchDocument`、mapping、文档构建和搜索结果转换均未携带 `poster`，前端因此按 `SafeImage` 规则回退到 `/background.png`。
- 修复：为 `ActivitySearchDocument` 增加 `poster` 字段；`ActivitySearchDocumentBuilder` 写入活动海报；`ElasticsearchActivitySearchProvider` 回传 `ActivityVO.poster`；索引 mapping 增加不可搜索的 `poster` 字段。
- 回填：重启 `java-ticket` 后执行 `scripts/rebuild-activity-search-index.ps1`，成功回填 145 条，通过新版本索引原子切换 `omni_activity_current` alias；活动 `27` 文档已包含 `/seed-posters/activity-27.jpg`。
- 验证：`ActivitySearchDocumentBuilderTest` 与 `ElasticsearchActivitySearchProviderTest` 共 10 项通过；直连 `java-ticket`、Gateway、前端代理的 `/api/ticket/activities?page=1&size=20` 均返回 200，20/20 条记录带 `poster`；浏览器刷新 `/activity/27` 后主图和推荐区 3 张海报均加载成功，图片有效尺寸，浏览器错误日志为 0。

## 2026-08-13 开题报告第1稿

- 输入模板：`C:\Users\Administrator\Desktop\开题报告\广州工商学院本科毕业论文（设计）开题报告 .docx`。
- 学校规范：`C:\Users\Administrator\Desktop\开题报告\广州工商学院本科毕业论文（设计）规范（修订）.pdf`。
- 交付文件暂定：`C:\Users\Administrator\Desktop\开题报告\202316510149-余凯欣-开题报告-第1稿.docx`。
- 已确认：题目、姓名、学号、学院、专业、指导教师及“硕士”学位。
- 已确认：论文起止日期和各阶段安排写“待学校通知”，不编造日期。
- 已确认：选题来源按“自选课题”处理。
- 格式要求：参考文献不少于 12 篇，全部为近 3 年文献，中文多于外文，外文 2 至 3 篇；正文上标引用；文后不出现 DOI；表格允许跨页断行。
- 源码核验偏离：Graphify 首次查询时仓库没有 `graphify-out/graph.json`，已按本地无联网流程生成图谱；报告仍将用源码和配置抽查，避免知识图谱误收录设计文档。
- 文献核验偏离：公开搜索引擎连接不稳定，文献将优先用 Crossref/OpenAlex 等公开元数据和期刊/出版社页面交叉核验，不使用无法确认作者、题名、年份和来源的条目。
- 源码证据：Java 父项目声明 Spring Boot 2.7.18、Spring Cloud 2021.0.8、Spring Cloud Alibaba 2021.0.5.0、Seata 1.6.1；各服务存在 Nacos、Sentinel、OpenFeign、PostgreSQL 等依赖。NestJS 抢票服务实现幂等排队、自动降档、候补排位和内部服务调用；Next.js 前端存在活动、订单、支付、电子票、抢票、候补和后台管理入口。
- 文献结果：共 13 篇，中文 10 篇、外文 3 篇；出版年份为 2024 至 2026 年。题名中出现“2023”的《2023全国演出市场简报》发布于 2024 年，属于近三年文献。
- 结构验收：正文上标覆盖 `[1]` 至 `[13]`，文后 13 条参考文献；未检出 DOI；表格 XML 中 `cantSplit=0`、固定行高 `trHeight=0`。
- 视觉验收：使用本机 Word/WPS COM 导出为 4 页 A4 PDF，并用 Poppler 渲染为 PNG；第二轮逐页检查未发现裁切、重叠、异常空页或表格跨页失败。
- 模板修正：清除了“职称或学位”中的红色示例格式、教师示例勾选、红色签字提示和示例日期；签字及开题时间保留给学校后续填写。

## 2026-08-14 开题报告第2稿

- 用户确认采用“学术与工程平衡型”表达，只改写“三、研究的目标与研究内容”和“四、研究方法及可行性分析”，其他章节、参考文献和模板格式保持不变。
- 第三部分调整为“研究目标、研究内容、拟解决的关键问题”，研究对象围绕服务边界、票务交易状态、高并发幂等、库存一致性、安全治理及前后端业务闭环。
- 第四部分将文献研究、源码证据分析、领域建模、实验测试和对照分析与实际项目文件对应；评价指标使用吞吐量、P95/P99 响应时间、错误率、超卖数、重复订单数和最终状态一致性，仅作为待测指标，不填写未经执行的结果。
- 可行性从源码基础、技术条件、实验条件和风险控制四方面论证；保留外部支付或部署环境受限时的验证边界说明，避免把框架接入等同于功能验证完成。
- 分页边缘情况：改写内容增长后允许表格自然跨页，继续保留“允许跨页断行”，以实际渲染结果决定是否调整段落密度，不通过缩小字号强行压页。
- 历史内容偏离：结构对比发现第1稿第五部分残留“大语言模型工作流、RAG、视觉智能”等与本课题无关的阶段安排。第2稿未继承该错误内容，依据用户最初要求统一写为“论文起止日期和各阶段安排：待学校通知”；第一、二、六部分继续与第1稿逐字一致。
- 结构验收：第2稿第一、二、六部分与第1稿逐字一致；正文上标继续覆盖 `[1]` 至 `[13]`，文后保留 13 条参考文献，无 DOI；表格未设置 `cantSplit` 或固定行高，页面规格为 A4。
- 渲染偏离：文档技能自带渲染器因本机未安装 LibreOffice 而无法启动，改用已安装的 Office COM 只读打开 DOCX 并导出 PDF，再调用本地 Poppler 渲染 PNG。Office 在 PDF 成功写出后退出 COM 时返回 `0x800706BE`，未影响 PDF 与页面图像，且没有新增遗留 Office 进程。
- 视觉验收：第2稿共 5 页，已逐页检查；第三、四部分跨页续排正常，未发现异常空页、大块非模板留白、文字裁切、重叠或表格断裂。末页保留的审核、签字区域及其后留白属于学校模板结构。

## 2026-08-15 开题报告第3稿

- 用户要求功能模块覆盖实际源码已有的全部业务模块，并保持开题阶段口吻；功能清单按 C 端账户身份、C 端内容互动、C 端购票票券、B 端活动资源、B 端运营治理和平台支撑六组归纳，未恢复已禁止的动态系统。
- 源码核对范围：Next.js `frontend/src/app` 页面路由，Java 用户、票务、订单、支付、通知服务 Controller，以及 NestJS `grab`、`team-grab`、`waitlist` Controller。报告使用“拟实现、拟设计、拟验证”等表述，前期源码只作为可行性证据。
- 段落格式：正文叙述段落和编号条目统一首行缩进 2 字符（12 磅正文对应 24 磅）；一级、二级标题不缩进；参考文献继续使用 2 字符悬挂缩进。
- 文献结构调整为 13 篇：行业报告 1 篇、中文期刊论文 9 篇、外文期刊论文 1 篇、外文会议论文 1 篇、外文专著章节 1 篇；期刊论文共 10 篇，中文 10 篇、外文 3 篇。
- 新增期刊论文经百度学术与万方公开页面核验：何锋等《微服务架构的一体化性能监控SaaS云设计与实现》，2024，41(8)：28-35；李淑霞等《基于Spring Cloud微服务架构的能源互联网营销服务系统设计》，2025(10)：138-145；庞长才《基于云原生技术的管理信息系统微服务架构设计与实现》，2026，28(3)：16-18，24；张健《基于Spring Cloud微服务架构的工业软件多层级组件平台设计》，2026(1)：131-134，139。
- 文后条目不写 DOI；正文研究背景和国内研究综述按新序号重排上标引用，确保 `[1]` 至 `[13]` 均在正文出现。
- 渲染偏离：本机未安装 LibreOffice，沿用 Office COM 只读导出 PDF，再用 Poppler 渲染页面 PNG；该过程未修改最终 DOCX。
- 视觉验收：第3稿共 6 页，已逐页检查。功能模块在第3至第4页自然跨页，参考文献在第5至第6页自然跨页；未发现文字裁切、重叠、乱码、表格断裂或异常大块空白。第6页底部留白属于学校审核与签字区域。

## 2026-09-01 本地 Docker 中间件启动

- 用户计划在 IDEA 中启动 Java 微服务，本次只启动本地基础设施容器，不启动 Java、前端或 NestJS 服务。
- 本机 PostgreSQL `localhost:5432` 可连接，继续按 `prod-split` 本机数据库口径使用。
- 已启动并验证健康的 Docker 容器：`omni-nacos`、`omni-rabbitmq`、`omni-seata`；`omni-seata-config-init` 已完成一次性 Seata 配置发布。
- 运行态偏离：`localhost:6379` 已被本机 `memurai` 进程占用，因此未启动 `omni-redis` 容器；当前 Redis 端口仍可连接，Java 默认 Redis 地址可继续指向 `localhost:6379`。
- IDEA 启动偏离：五个 Java 业务服务使用 `prod-split` 时必须显式传入环境变量；当前失败日志的直接根因为 `java-user` 缺少 `GRAB_SERVICE_URL`，同类必填变量还包括数据库、Nacos、RabbitMQ、internal token、JWT、Seata，以及 `java-payment` 的支付宝占位符。

## 2026-09-01 前后端与本地大模型联调

- 启动前端、Java 后端和本地 Ollama 客服 AI 链路前，确认 `omni-nacos`、`omni-rabbitmq`、`omni-seata` 已运行；`localhost:6379` 仍由本机 `memurai` 提供 Redis。
- 大模型根因：`Qwen2.5:7b` 默认 32768 上下文加载时 Ollama 日志报 `failed to allocate compute pp buffers`，`/api/chat` 返回 500；同一请求显式 `options.num_ctx=2048` 后返回 `模型连通`。
- 代码修复：`java-user` 的 `OllamaSupportLocalModelClient` 默认在请求 payload 写入 `options.num_ctx=2048`，并通过 `OMNI_SUPPORT_AI_CONTEXT_WINDOW` / `OMNI_SUPPORT_AI_LOCAL_CONTEXT_WINDOW` 可调。
- 运行态修复：`OllamaSupportLocalModelClient` 不再在 Spring bean 构造期创建 `java.net.http.HttpClient`，避免本机 JDK 抛出 `Unable to establish loopback connection` 导致 `java-user` 启动失败；实际请求改用 `HttpURLConnection`。
- 启动脚本修复：`start-project.ps1` 为本地 `prod-split` 注入 RabbitMQ、Grab、Seata、本地 Alipay 占位、AI context-window 和前端 `API_PROXY_TARGET` 默认值；搜索默认已在 2026-09-02 调整为强制 Elasticsearch，见下方记录。
- 运行态修复补充：本机 `TEMP` 为 `C:\Users\ADMINI~1\AppData\Local\Temp` 短路径时，JDK 17+ 自动 Unix domain socket pipe 会触发 `Invalid argument: connect`，导致 Netty/Spring Cloud Gateway `Selector.open()` 失败；`start-project.ps1` 现在将本次启动进程及子进程的 `TEMP/TMP` 指向 `runtime\java-tmp`。
- 中间件脚本修复：`scripts/start-infra.ps1` 在 `localhost:6379` 已被非 `omni-redis` 容器占用时，先用 RESP `PING` 校验是否为可用 Redis/Memurai；可用则跳过 Docker Redis，只启动/确认 Docker Nacos。
- 启动脚本修复补充：`start-project.ps1` 将子 PowerShell 的 Maven `-Dspring-boot.run.*` 参数整体单引号传入，避免 PowerShell 将 `spring-boot.run.arguments` 拆坏为 Maven 插件前缀；`-UseDockerInfra` 分支提前初始化 `NACOS_PORT=8848`，Seata 配置发布可访问 `localhost:8848`。
- 前端依赖偏离：`frontend/pnpm-workspace.yaml` 缺少 `packages` 导致 `pnpm dev` 报 `packages field missing or empty`，已补 `packages: ['.']`；前端和 grab-service 的 `node_modules` 仍为旧路径/不完整依赖，离线恢复失败，需要联网安装 npm/pnpm 依赖后继续 3000/3001 联调。
- 用户已授权下载依赖；`frontend` 使用 `pnpm install --frozen-lockfile --registry=https://registry.npmmirror.com` 安装成功，`pnpm typecheck` 通过，Node 版本为 `v24.15.0`，满足前端 Node `>=24` 要求。
- `grab-service` 全局 npm cache 指向 `C:\Program Files\nodejs\node_cache` 且不可写，改用 `D:\Project\omni\runtime\npm-cache` 后安装成功；运行期发现 `node_modules/jsonwebtoken` 残缺缺少 `index.js`，确认镜像 tarball 正常后只清理该可重建依赖目录并重装，`npm run build` 通过。
- 最终启动状态：前端 `http://localhost:3000`、`grab-service` `http://127.0.0.1:3001`、Java 服务端口 `8081/8082/8083/8084/8085/8088` 均处于监听状态；`grab-service` 已连接 RabbitMQ。
- 联调验收结果：前端首页 `GET /` 返回 200，前端代理登录 `POST /api/user/login` 返回 `code=200`，gateway 票务列表返回 `code=200`，gateway 到 `grab-service` 的 `/api/grab/internal/users/1/requests` 返回 200，客服 AI SSE 返回 200 且包含流式增量数据。
- 运行边界：不要在 `npm run start:dev` 的 Nest watch 进程运行时并行执行 `npm run build`，因为 `nest-cli.json` 配置了 `compilerOptions.deleteOutDir=true`，构建会临时删除 `dist` 并导致 watch 子进程短暂报 `Cannot find module 'dist\main'`；验收时应先 build，再启动 watch。

## 2026-09-01 上传图片恢复与前端公共渲染修复

- 历史文件恢复：已将旧 worktree 的 `runtime/uploads` 合并回 `D:\Project\omni\runtime\uploads`，来源包括 `.worktrees\team-grab`、`.worktrees\waitlist-queue`、`.claude\worktrees\grab-low-risk-sentinel`；只复制缺失文件，不删除来源文件。
- 稳定目录口径：`start-project.ps1` 本地 Java 启动参数已经注入 `--omni.upload.root=D:\Project\omni\runtime\uploads`，用户头像和票务素材统一落在项目根的 `runtime\uploads`，不再依赖旧 worktree 目录。
- 前端修复：新增 `frontend/src/lib/image-url.ts` 与 `frontend/src/components/SafeImage.tsx`，统一处理 `/uploads/...`、站内图片路径、完整 `http/https` URL、空值/非法 scheme fallback，以及浏览器加载 404 后切换 fallback。
- 页面替换：上传预览、活动卡片、首页/搜索映射、活动详情、巡演详情、订单、电子票、订阅、C 端头像、B 端头像和艺人列表已改用共享图片逻辑；静态登录背景和 logo 保持原状。
- 数据清理结论：`ticket_asset` 共 9 条素材，本地文件全部存在；`artist.avatar` 已引用 1 条，`tour.poster` 已引用 3 条，当前 `activity.poster` 无 `/uploads/%` 引用，只有 2 条 smoke 测试活动 poster 为空。
- 回填偏离说明：`ticket_asset` 没有 `biz_id` 或其他可证明的活动关联字段，历史 `activity-poster` 素材无法可靠匹配具体 `activity`；本次不自动回填 `activity.poster`，避免错配活动海报。已引用的 `tour.poster` 和 `artist.avatar` 保持不变。
- 验证结果：`node --test src\lib\image-url.test.ts`、`node --test src\lib\image-rendering-production-entry.test.ts`、`pnpm typecheck` 通过；gateway 与前端代理访问上传头像/海报 URL 均返回 200。
- 联调补充：前端 dev 服务运行在 `http://localhost:3000`；`grab-service` 已用项目默认 JWT_SECRET 运行在 `http://127.0.0.1:3001`，登录测试用户后 `/api/waitlist/my` 返回 200，直连 internal grab/waitlist 接口返回 200。

## 2026-09-01 前端容器化启动

- 运行方式调整：停止本机 `pnpm dev` 前端进程，改用 `docker compose up -d frontend` 启动 `omni-frontend` 容器，占用 `localhost:3000`。
- Compose 修正：`docker-compose.yml` 的 `frontend` 命令改为 `pnpm install --frozen-lockfile --registry=https://registry.npmmirror.com`，避免容器启动时漂移 lockfile，并优先使用镜像源安装前端依赖。
- 容器配置：前端容器使用 `node:24-alpine`，`API_PROXY_TARGET=http://host.docker.internal:8088`，通过宿主机 gateway 访问 Java 后端。
- 验证结果：`docker ps --filter name=omni-frontend` 显示 `omni-frontend` 正在运行；`GET /`、`GET /api/ticket/activities`、上传头像 URL、登录后 `GET /api/waitlist/my` 均返回 200。
- 运行边界：当前本次只按用户要求将前端放入 Docker；Java 服务仍沿用宿主机端口 `8081/8082/8083/8084/8085/8088`，`grab-service` 仍以本机 Node 进程供 gateway 调用。

## 2026-09-01 个人中心与账号设置合并

- 页面合并：`frontend/src/app/profile/page.tsx` 已整合原「个人中心」概览和「账号设置」表单，保留 Header/Footer、快捷操作胶囊、用户横幅、三列信息卡、个人资料表单、修改密码表单和账户提示。
- 接口复用：合并页继续使用 `getUserInfo`、`updateProfile`、`uploadUserAvatar`、`changePassword`、`sendSmsCode`，头像上传继续走 `LocalFileUpload` 与 `SafeImage`，不引入 mock/offline 降级。
- 入口收敛：`frontend/src/components/Header.tsx` 的登录用户下拉菜单由「个人信息」+「账号设置」合并为单一「个人中心」入口；后台个人中心快捷入口也改为 `/profile`。
- 兼容旧路径：`frontend/src/app/profile/account/page.tsx` 改为客户端重定向，登录用户跳 `/profile`，未登录用户跳 `/login?ru=/profile`。
- 验证结果：宿主机与 `omni-frontend` 容器内均通过 `node --test src/lib/profile-merged-page-production-entry.test.ts`、`node --test src/lib/header-user-menu-production-entry.test.ts src/lib/sms-production-copy.test.ts` 和 `pnpm typecheck`；`GET /profile` 与 `GET /profile/account` 均返回 200。

## 2026-09-01 个人中心安全与认证弹窗重构

- 右侧卡片调整：`frontend/src/app/profile/page.tsx` 将原内联「修改密码」表单替换为「安全与认证」中心，展示「登录密码」和「安全手机」两个浅灰操作项，并保留安全防护等级与最近安全操作说明。
- 修改密码弹窗：新增两步流程「身份验证 → 设置新密码」，第 1 步调用后端 `verifyPasswordIdentity` 校验旧密码和短信验证码，第 2 步调用 `changePassword` 完成修改；关闭弹窗会清空表单并重置倒计时。
- 更换手机号弹窗：新增两步流程「验证原手机 → 绑定新手机」，第 1 步调用后端 `verifyCurrentPhone`，第 2 步校验 11 位手机号并调用 `changePhone`；成功后同步更新页面手机号展示和本地登录态 `omni_user`。
- 后端接口：`java-user` 新增 `POST /api/user/password/verify`、`POST /api/user/phone/verify-current`、`PUT /api/user/phone`，并新增 `ChangePhoneRequest`、`VerifyCurrentPhoneRequest` DTO；验证码校验走后端服务，当前本地短信仍沿用项目既有 `mockSmsEnabled` / `MOCK_SMS_CODE` 口径。
- 验证记录：宿主机通过 `node --test src\lib\profile-security-step-modal-production-entry.test.ts src\lib\profile-merged-page-production-entry.test.ts src\lib\header-user-menu-production-entry.test.ts src\lib\sms-production-copy.test.ts`、`pnpm typecheck`、`mvn -pl java-user -Dtest=UserServiceTest test`；`omni-frontend` 容器内通过同一组前端测试与 `pnpm typecheck`，`GET /profile` 返回 200。

## 2026-09-01 个人中心 Docker 缓存与认证态修复

- 运行态根因：`docker-compose.yml` 曾把 `frontend-next-cache` 挂载到 `/app/.next`，Next dev 复用旧编译缓存，导致容器源码已是新版但应用面板仍渲染旧版「账号设置」页面。
- 容器修复：前端服务移除持久化 `.next` volume，改为 `tmpfs: /app/.next`；已 `docker compose up -d --force-recreate frontend` 重建 `omni-frontend`，当前容器不再挂载 `frontend-next-cache`。
- 认证态修复：`removeToken()` 现在会派发 `AUTH_UPDATED_EVENT`，`/profile` 在 `getUserInfo()` 返回「未认证 / 登录状态失效」时清理本地登录态并跳转 `/login?ru=/profile`，避免 Header 显示已登录但页面显示未认证。
- 验证记录：新增 `frontend-docker-cache-production-entry.test.ts`，宿主机前端 9 项入口测试通过；容器内前端入口测试 8 通过、1 项因根 compose 未挂载显式跳过；宿主机与容器 `pnpm typecheck` 均通过；Playwright 使用本机 Chrome 登录后访问 `/profile`，确认「安全与认证」「个人资料」可见、旧文案计数 0、「未认证」计数 0、`/api/user/info` 返回 200。

## 2026-09-02 活动详情页交互与内容重构

- 页面重构：`frontend/src/app/activity/[id]/page.tsx` 已按玫红品牌色统一活动详情页主卡片、顶部操作按钮、座位区、详情 Tab 和观众热评模块，整体背景改为 `#F8F9FA`，核心卡片使用 16px 圆角与轻投影。
- 顶部操作：`想看`、`关注艺人` 继续走真实订阅接口并增加防重复点击锁，成功/取消/失败反馈改为居中轻量 Toast；`加入日历` 不再调用 `/api/ticket/subscriptions/calendar`，不生成或下载 `.ics`，仅按登录用户写入本地日程提醒状态。
- 座位展示：选座项目继续复用 `SeatCraftSelector`；不可选座或座位图未公布项目在票档下方显示紧凑提示 `座位暂不公布，座位将在下单后由系统自动分配。`，避免旧的大块空状态。
- Tab 详情：`项目详情 / 购票须知 / 观演须知` 改为分段式胶囊控制器；项目详情使用 2 列信息网格和白底正文，购票须知使用 4 个规则胶囊与分割线清单，观演须知使用入场时间轴和禁带/文明观演提示卡。
- 评论模块：原 `评价与问答` 更名为 `观众热评`，移除活动详情页内 `写评价/去订单页评价` 入口和 `createActivityReview` 调用；评价入口保持由已完成订单业务路径触发。问答区继续调用真实 `createActivityQuestion` 接口。
- 运行偏离：本次容器验证前发现 8088 网关未监听，已先启动 Docker Seata，再通过 `start-project.ps1 -SkipFrontend -SkipInstall -UseDockerInfra` 只拉起 Java 后端，前端继续由 Docker 容器 `omni-frontend` 提供。
- 验证记录：宿主机通过 `node --test src\lib\activity-detail-production-entry.test.ts` 与 `pnpm typecheck`；容器内通过同一入口测试与 `pnpm typecheck`；浏览器自动化登录测试用户后访问 `/activity/900120`，确认核心文案、Tab 切换、日历 Toast、无 `.ics` 下载链接且无旧评价入口。

## 2026-09-02 个人设置中心三合一重构

- 页面重构：`frontend/src/app/profile/page.tsx` 将顶部概览、基础资料和安全认证合并为单个「个人设置中心」主卡片，保留页面 Header 快捷入口与底部账户提示横幅。
- 头像管理：移除下方重复头像上传区，改为主卡片顶部 80x80 圆角头像就地管理；「更换头像」触发隐藏文件选择并继续调用 `uploadUserAvatar`，仅允许 JPG、PNG、WebP；「清除」先更新表单，保存资料时统一提交。
- 信息去重：移除三列概览中的独立「角色身份」小卡片，只在用户条右侧保留唯一粉色权限徽章；注册时间和当前账号/手机号收敛为头像右侧单行元信息。
- 安全逻辑：保留 `verifyPasswordIdentity`、`verifyCurrentPhone`、`changePassword`、`changePhone`、`sendSmsCode` 两步弹窗流程，页面安全列表文案更新为「用于验证码校验」。
- 测试记录：新增页面源码结构断言，覆盖「个人设置中心」、就地头像操作、移除 `LocalFileUpload` / `CardHeader` / `InfoItem` / `profile-avatar-upload` / `scrollToAvatarUpload` 和重复角色文案。
- 头像排版微调：头像下方「更换头像 / 清除」操作容器增加 `whitespace-nowrap`，避免窄容器下文字纵向折行。

## 2026-09-02 活动详情页巡演/单场分流重构

- 巡演兼容：`frontend/src/app/activity/[id]/page.tsx` 通过 `isTour`、`eventType`、`tour` 和 `stationDetails` 识别巡演项目；单场活动继续走原 `detail.sessions` 购买链路。
- 站点联动：新增 `selectedStationId`、`selectedStationDetail`、`stationPurchaseState`、`activePurchaseSessions`，城市切换会清空旧座位、票档、实名观演人选择和抢票幂等键。
- 巡演 UI：顶部主卡片展示「巡演项目」标签、当前选站与分类角标；巡演模式下新增横向 `Tour Stations Selector`，支持售票中、预约中、待公布、缺货登记与「+ 求加场」。
- 待公布分支：`PENDING` 站点隐藏场次、票档、数量和座位提示，改为居中空态卡片，提供「开启开售提醒」和「登记想看意向」并复用真实订阅接口。
- 交互文案：`加入日历` 只更新前端日程提醒状态，Toast 改为「已加入日程提醒」；开售提醒空态成功文案为「已成功订阅，开票前将短信提醒！」。
- 验证偏离：相邻推荐测试在 Node ESM 下暴露 `activity-recommendations.ts` 对 `image-url` 的扩展名解析问题，已改为显式 `.ts` 导入以兼容现有测试运行方式。
- 验证偏离：`subscription.test.ts` 的目标时间未带时区，宿主机与 Docker UTC 环境结果不一致；已给测试输入补 `+08:00`，不改倒计时业务函数。

## 2026-09-02 活动搜索 Elasticsearch 强制切换

- 切换原因：活动搜索必须使用 Elasticsearch 全文检索、filter、分页与排序；PostgreSQL 继续作为活动详情、订单、库存、座位等业务数据真实源，不再承担搜索接口或内存过滤 fallback。
- 搜索 Provider：`ActivitySearchProperties` 默认 `provider=elasticsearch`、`requireElasticsearch=true`；`ActivityService.searchActivities()` 只调用注入的 `ActivitySearchProvider`，未注入时返回 503「搜索服务暂时不可用，请稍后重试」，不再实例化 `DbActivitySearchProvider`。
- 启动配置：`java-ticket` base 与 `prod-split` profile 固定 `omni.search.provider=elasticsearch`、`omni.search.require-elasticsearch=true`；`start-project.ps1` 注入 `ELASTICSEARCH_URIS` / `SPRING_ELASTICSEARCH_URIS`，并在 Java 启动前等待 ES yellow/green。
- Docker 基础设施：`docker-compose.yml` 和 `docker-compose.production.example.yml` 均声明 `omni-elasticsearch`、健康检查和持久化卷；`scripts/start-infra.ps1` 会同时确保 RabbitMQ 与 ES 就绪；生产示例要求 `ELASTICSEARCH_IMAGE_TAG`、`ELASTICSEARCH_SECURITY_ENABLED`、`ELASTICSEARCH_PASSWORD`、`ELASTICSEARCH_JAVA_OPTS` 显式注入。
- 索引结构：沿用 `ActivitySearchDocument` 与 `search/omni_activity_v1_mapping.json`，字段覆盖活动名称、艺人名称、分类、场馆、城市、演出时间、价格区间、售卖状态、实名要求和选座可见性；查询使用 `omni_activity_current` alias，不依赖固定版本索引。
- 索引字段补齐：`ActivityVO`、全量列表装配、单条 upsert 装配和 ES provider 返回映射均补齐 `categoryId`、`organizerId`、`venueName`、`maxPrice`，避免全量回填与实时同步字段不一致。
- 历史回填：继续使用 `scripts/rebuild-activity-search-index.ps1` 调用 `POST /api/ticket/admin/search-index/rebuild`；重建服务从 PostgreSQL 业务数据分页读取，写入新索引 `omni_activity_v1_<timestamp>_<suffix>` 后原子切换 alias，失败不会切走当前查询索引。
- 实时同步：活动新增/修改、发布/下架/删除、场次增删改、票档增删改、艺人阵容变更和场馆名称/城市变更都会发布活动搜索索引事件；艺人基础资料更新会批量刷新直接关联与阵容关联活动。
- MQ 处理：搜索索引事件继续走 RabbitMQ `omni.search-index`，消费者幂等执行 ES upsert/delete；处理失败进入 retry queue，超过 3 次转入 `search.activity.changed.dlq`；Rabbit JSON converter 已注册 `JavaTimeModule`，确保 `ActivitySearchIndexMessage.occurredAt` 可序列化；发布端不再吞掉 RabbitMQ 发送异常。
- 本机回填验证：`POST /api/ticket/admin/search-index/rebuild` 成功回填 145 条，alias 切换到 `omni_activity_v1_20260902200446642_9024a7ec`；ES 样本文档确认活动名称、艺人、分类 ID/名称、主办方、场馆、城市、票价区间、售卖状态、实名要求和座位图状态均可读取。
- 本机联调验证：临时活动 `ES-sync-smoke-20260902202953` 通过后台 API 新增、加场次、加票档、改名、改票价、下架、删除；ES 文档新增、字段更新、下架删除、删除后无遗留均通过，临时活动已逻辑删除且 ES 无 `ES*` 临时文档。
- 失败场景验证：停止 `omni-elasticsearch` 后搜索接口返回 503「搜索服务暂时不可用，请稍后重试」，未返回 PostgreSQL 搜索结果；恢复 ES 后网关和前端容器代理搜索恢复 200。
- 收尾命令验证：2026-09-02 20:35 重新执行搜索相关 Java 测试、RabbitMQ 消息测试、前端 `pnpm typecheck`、容器内前端 `pnpm typecheck`、`docker compose config --quiet`、`scripts/check-production-runtime-defaults.ps1` 和 `scripts/verify-microservice-boundaries.ps1`，均通过。
- 收尾运行态验证：`omni_activity_current` alias 指向 `omni_activity_v1_20260902200446642_9024a7ec`，当前 ES 文档数 145；前端容器代理搜索返回 200，短暂停止 ES 时搜索接口返回业务 `code=503`，恢复 ES 后搜索重新返回 200。

## 2026-09-02 巡演求加场联调闭环

- 前端状态：`frontend/src/app/tour/[id]/page.tsx` 已完成巡演城市栏细节修复，横向容器使用 `overflow-y-visible` 与 `py-2`，角标定位为卡片内右上角，卡片使用 `pt-5` 避免「待公布 / 售票中」文字被裁切。
- 城市弹窗：`+ 求加场` 已唤起「我想看的城市」弹窗，复用项目城市数据 `HOT_CITIES`、`OTHER_CITIES`、`filterCityOptions` 和 `CITY_KEY`，包含当前定位城市、热门城市、搜索、按字母分组和右侧字母导航。
- 提交流程：点击城市会通过前端代理调用 `POST /api/ticket/subscriptions`，提交 `targetType=TOUR_CITY_REMINDER`、`targetId=tourId`、`targetValue/city=城市名`，成功后关闭弹窗并显示居中 Toast「已提交【城市】加场心愿，主办方会收到您的期待！」。
- 后端补齐：新增 `NotificationInternalClient`，`PerformanceSubscriptionService` 在创建 `TOUR_CITY_REMINDER` 后直接调用 `java-notification` 的 `/api/notification/internal/events`，同时保留 RabbitMQ 通知事件；`NotificationService` 依据 `aggregateKey` 去重，避免 direct + MQ 重复消息。
- 启动修复：`start-project.ps1` 将 `TEMP/TMP` 固定到项目 `runtime/tmp`，规避本机 Windows Java `Selector.open()` 在 `ADMINI~1` 临时目录下报 `Unable to establish loopback connection` 导致 `java-ticket` 无法重启的问题。
- 联调验证：登录测试用户 `13900000001` 后经前端容器代理提交巡演 `5` 的「厦门」加场心愿，接口返回 200，`performance_subscription` 写入 `id=29`，`notification_delivery` 写入 `tour-city-wish:5:厦门:29` 且状态 `SENT`，主办方 `user_id=2002` 的 `notification` 写入 `TOUR_CITY_WISH`，入口 `/console/tours/5`。随后将 `java-ticket` 恢复为 `--seata.enabled=true` 正常口径，再提交「宁波」加场心愿，`performance_subscription` 写入 `id=30`，主办方通知写入 `notification.id=988011`，`notification_delivery.id=4` 状态 `SENT`。
- 测试记录：`mvn -pl java-ticket "-Dtest=ElasticsearchClientConfigTest,PerformanceSubscriptionServiceTest" test` 通过 5 项；`node --test src\lib\tour-detail-production-entry.test.ts src\lib\subscription.test.ts` 通过 3 项；`pnpm typecheck` 通过。

## 2026-09-03 分类页搜索体验与分页修复

- 分类页历史条：`frontend/src/app/search/page.tsx` 仍作为分类页入口 `/search?category=...` 使用，但搜索联想/历史标签条改为仅在 `/search` 且存在 `keyword` 时显示；分类浏览不再展示「搜索历史」横条。
- 可选座筛选：前端 `listActivities()` 增加公开查询参数 `isSupportSeat=true`，并保留旧入参 `seatMapOnly` 的调用兼容；后端 `/api/ticket/activities` 同时接收 `seatMapOnly` 与 `isSupportSeat`，统一归一后传入 ES provider 的 `seatMapVisibility=published` filter。
- 分页交互：`frontend/src/lib/pagination.ts` 新增 `buildPaginationItems()`，搜索页分页与通用 `Pagination` 组件都接入可点击省略号；点击 `...` 后原地输入页码，非法/越界页码按 `normalizePageRequest()` 归一，当前页高亮改为 `#ff2d55`。
- 运行偏离：手动重启 `java-ticket` 时首次漏传 `RABBITMQ_PORT` 等 prod-split 环境变量导致启动失败；补齐 RabbitMQ、ES、Nacos、Seata 和数据库环境变量后服务恢复并重新注册到 Nacos。
- 验证记录：新增/更新前端 `search-experience.test.ts`、`pagination.test.ts`、`api.test.ts` 和后端 `ActivityControllerCEndTest` 覆盖上述行为；宿主机与 `omni-frontend` 容器内前端目标 Node 测试均 51/51 通过，宿主机与容器 `pnpm typecheck` 通过，Java 搜索/控制器目标测试 39/39 通过；前端代理与网关直连 `isSupportSeat=true` 均返回 20 条样本且 `badSeatMapVisibility=0`。

## 2026-09-03 后台全局分页组件统一

- 公共组件：`frontend/src/components/Pagination.tsx` 正式导出 `GlobalPagination`，保留 `Pagination` 兼容别名；统一页码和省略号原地输入跳转的品牌玫红样式，并按最新 UI 要求移除尾部 `跳至 [X] 页 跳转` Quick Jumper 模块，分页器最右侧停在「下一页」。
- 活动/场次/艺人管理：`frontend/src/app/console/activities/page.tsx`、`frontend/src/app/console/sessions/page.tsx`、`frontend/src/app/console/artists/page.tsx` 移除本地「上一页 / 下一页」分页块，改用 `GlobalPagination`，原服务端/本地切片数据逻辑保持不变。
- 草稿箱：`frontend/src/app/console/tours/page.tsx` 新增 `DEFAULT_PAGE_SIZE` 本地分页切片与分页容器，避免草稿列表无分页导致页面过长。
- 已有后台分页入口：订单、退款、风险事件、风险工单、风险恢复申请、场馆记录、场馆资料审核统一改为 `<GlobalPagination />` 调用，保持各自原有数据筛选和分页切片。
- 其他后台表格页：操作审计、异常任务、入场核验、日结对账、站点变更审核、平台主办方运营工作台补齐本地分页切片和 `GlobalPagination` 容器；导出、详情、跟进等原业务动作保持原完整数据或当前业务状态。
- 验证记录：新增 `frontend/src/lib/console-pagination-production-entry.test.ts` 覆盖标准组件导出、Quick Jumper 移除、后台页面统一入口、活动/场次/艺人本地分页块移除、草稿箱分页补齐和主要后台表格页统一入口。

## 2026-09-03 想看与提醒通知收拢

- 页面精简：`frontend/src/app/subscriptions/page.tsx` 右上角移除「导出日历」按钮，仅保留「刷新」；同时删除前端 `Blob` / `URL.createObjectURL` / `.ics` 下载逻辑，避免用户误以为需要同步第三方日历。
- API 收口：前端 `createSubscriptionCalendar()` 与 `SubscriptionCalendarVO` 已移除；后端 `GET /api/ticket/subscriptions/calendar`、`PerformanceSubscriptionService.createCalendar()` 和 `SubscriptionCalendarResponse` 已移除，生产链路不再生成本地日历文件。
- 通知口径：开售提醒、想看状态、候补释放、支付提醒、艺人/城市上新与巡演加场心愿统一进入站内消息中心/顶部通知图标；后续短信、App Push 或浏览器 Push 也应通过消息服务下发，不恢复本地日历方案。
- 后端机制：订阅仍写入 `performance_subscription`；需要触达用户或主办方的场景继续通过 MQ/延迟任务投递通知事件，由通知服务写入站内信通知列表。

## 2026-09-04 IDEA 与 Docker 本地启动修复

- Docker 根因：Docker Desktop 直接启动 `seata-server` 会先触发一次性容器 `seata-config-init`，但不会注入 `SEATA_ADVERTISE_HOST`，导致报错「必须是宿主机可达的非回环 IPv4」。本机应使用 `powershell -ExecutionPolicy Bypass -File scripts\start-seata-docker.ps1`，脚本会自动探测宿主机 IP、发布 Nacos 配置并启动 `omni-seata`。
- 中间件状态：已恢复并验证 `omni-redis`、`omni-nacos`、`omni-rabbitmq`、`omni-elasticsearch`、`omni-seata` 健康运行；前端 Docker 容器 `omni-frontend` 继续监听 `localhost:3000`。
- IDEA 根因：Windows 本机 `TEMP/TMP` 指向短路径 `C:\Users\ADMINI~1\AppData\Local\Temp` 时，JDK 17/Netty 在 `Selector.open()` 触发 `Unable to establish loopback connection` / `Invalid argument: connect`，导致 Java 微服务启动失败。
- 本地配置修复：已在忽略文件 `.idea/workspace.xml` 的六个 Spring Boot Run Config 中写入 `TEMP=D:\Project\omni\runtime\java-tmp`、`TMP=D:\Project\omni\runtime\java-tmp` 和 `-Djava.io.tmpdir=D:\Project\omni\runtime\java-tmp`；`TicketApplication` 同时保持 ES 强制搜索配置，避免回退 DB 搜索。
- IDEA 状态修复：`.idea/workspace.xml` 的 `RunDashboard` 残留了六个 Spring Boot 配置的 `FAILED` 历史状态，导致服务面板继续显示红色感叹号；已清理该本地失败缓存，重启或刷新 IDEA 后应恢复为可启动状态。
- 启动验证：命令行按 IDEA 同等参数已验证 `GatewayApplication`、`PaymentApplication`、`TicketApplication`、`UserApplication`、`OrderApplication`、`NotificationApplication` 均可启动并注册 Nacos；其中 ticket/order/payment 的 Seata 连接正常，notification 的 RabbitMQ 连接正常。临时启动进程已全部停止，8081/8082/8083/8084/8085/8088 已释放给 IDEA 使用。
- 二次修复：IDEA 实际启动时仍未向非网关服务传入部分环境变量，`application-prod-split.yml` 中的 `${RABBITMQ_PORT}`、`${SEATA_ENABLED}`、`${GRAB_SERVICE_URL}` 等裸占位符被原样绑定并启动失败。已为 `java-user`、`java-ticket`、`java-order`、`java-payment`、`java-notification` 的 `prod-split` 配置补齐本地默认值，环境变量仍可覆盖；同时补齐 `java-user` 的 `omni.privacy.id-no-key` 本地默认，避免实名观演人加密服务因本地密钥缺失启动失败。
- 二次验证：在显式移除 `RABBITMQ_PORT`、`SEATA_ENABLED`、`GRAB_SERVICE_URL`、`OMNI_ID_NO_KEY`、`ELASTICSEARCH_URIS`、`ALIPAY_*` 等环境变量后，分别启动 `java-user`、`java-ticket`、`java-order`、`java-payment`、`java-notification`，均可使用 `prod-split` 成功启动并注册 Nacos；临时验证进程已停止，除 IDEA 当前运行的 `GatewayApplication` 占用 8088 外，其余 Java 端口均已释放。

## 2026-09-04 客户端断连异常降噪

- 根因：`java-ticket` 请求处理完成写响应时，浏览器或前端代理主动关闭连接，Tomcat 抛出 `ClientAbortException: 你的主机中的软件中止了一个已建立的连接`。这类异常表示客户端已取消接收响应，不是业务处理失败，也不是服务启动失败。
- 修复：`java-common` 的 `GlobalExceptionHandler` 新增 `ClientAbortException` 专用处理器，返回 `204 NO_CONTENT` 且仅打 debug 日志，避免进入通用 `handleException(Exception)` 后被误报为「系统异常」并再次尝试写 500 JSON 响应。
- 验证：新增 `GlobalExceptionHandlerTest.clientAbortUsesDedicatedNoContentHandlerInsteadOfInternalError` 回归测试；`mvn -pl java-common -Dtest=GlobalExceptionHandlerTest test` 通过 3/3；`mvn -pl java-ticket -am -DskipTests compile` 通过。

## 2026-09-04 后台侧边栏分组导航重构

- 范围：按需求重构 `frontend/src/app/console/layout.tsx` 后台侧边栏，将平铺菜单改为「概览与看板、演出与票务管理、订单与履约中心、运营、客服与审核、系统、安全与财务」五个折叠分组，并把 `/console/profile` 固定保留在底部个人区。
- 权限：分组渲染先按 `role` 过滤，再按子项 `roles`、`canAccessConsolePath(child.href, permissionCodes)` 过滤；`organizer` 角色继续使用 `isConsolePathAllowedForRole(role, child.href)` 白名单，并对活动、巡演、场次、场馆、艺人、订单、退款文案做主办方视角调整。
- 入口对齐：`console-auth.ts` 将 `organizer_admin`、`support` 的默认后台入口限制在新分组实际可见的订单、履约、运营和客服路径；`console-paths.ts` 同步收紧两类角色的快捷操作，隐藏客服账号、审计等不应暴露的系统入口。
- 交互：新增 `openGroups: string[]` 状态、当前路径命中分组自动展开、分组按钮手动展开/收起；子菜单选中态统一使用 `bg-[var(--omni-brand)]/10` 和 `text-[var(--omni-brand)]`。
- 验证：新增 `frontend/src/lib/console-layout-menu.test.ts` 并更新 `console-production-entry.test.ts` 覆盖分组结构、主办方白名单、空分组隐藏和自动展开；`node --test` 目标测试 92/92 通过，`pnpm typecheck` 通过，`pnpm build` 通过。`pnpm lint` 仍被既有全仓 React Compiler/unused-vars 问题拦截，本次改动文件仅剩原布局已有的 `setRedirecting(false)` effect 警告。

## 2026-09-06 演出与票务全流程页面重构与数据闭环修复

- 巡演城市入参：新增 `TourStationCityDTO` / `TourDraftCreateDTO`，`TourStationService.createTourDraftFromRequest()` 按 `{ city, stationName }` 对象数组创建初始 `Station`，保留 `station_name`，并继续兼容旧 Map 调用。
- 巡演风控闭环：巡演站点发布生成或复用 `Activity` 后调用 `ActivityArtistService.ensurePrimaryArtist(activityId, artistId)`，同步写入 `activity_artist` 主艺人记录，确保艺人列入风险后巡演生成活动可被风险联动停售扫描命中。
- 票档批量事务：新增 `POST /api/ticket/admin/ticket-types/batch-update` 和 `TicketTypeBatchUpdateRequest`，支持 `UPDATE_PRICE`、`SET_STATUS`、`ADJUST_STOCK`，后端先整体校验再写入，任一非法价格、库存低于已售或权限失败都会整批回滚。
- 场次页重构：`/console/sessions` 将票档列表移入右侧 Drawer，主表仅保留库存摘要；批量改价、启停、滚库存改为调用原子批量接口，批量导入仍沿用既有单条创建接口。
- SeatCraft 绑定闭环：`/console/sessions/[id]/seat-layout` 消费 `mode=tickets`，自动展开 `SeatCraftTicketEditor`，选中 SeatBlock 后调用 `updateSessionTicketBindings()` 物化 `SessionSeat.ticketGroupId/ticketTypeId`。
- 场馆模板入口：`/console/venue` 增加默认座位图状态和「座位模板配置」入口；`/console/venue/[id]/seats` 明确该页为场馆 Default Layout 模板，不影响已关联历史售票场次。
- 巡演草稿页：`/console/tours` 改为巡演草稿管理专页，新增「+ 新建巡演草稿」入口，操作列收敛为「配置站点」「官宣城市」「删除草稿」。
- 艺人页重构：`/console/artists` 从卡片列表改为表格，增加待审核艺人数量角标；列入风险必须弹出危险确认并填写 `reason` 后调用 `POST /api/ticket/admin/artists/{id}/risk`。
- 验证：`mvn -pl java-ticket "-Dtest=TourStationServiceTest,ActivityArtistServiceTest,AdminControllerTest" test` 通过 186/186；`node --test src/lib/console-production-entry.test.ts` 通过 60/60；`node --test src/lib/console-ticket-types.test.ts src/lib/console-artists.test.ts` 通过 10/10；`pnpm typecheck` 通过；`pnpm build` 通过。

## 2026-09-07 后台场馆、艺人、订单快照与退款排版修复

- 场馆排序：`java-ticket` 后台场馆查询明确使用 `ORDER BY id ASC`，前端继续把实体 `id` 作为场馆编号展示，避免历史大号 ID 按物理存储顺序插队。
- 艺人头像：新增 `frontend/public/avatars/artists/*.webp` 本地素材，覆盖旧 seed 的 10 个目标艺人及 prod-split demo 的 8 个对应 ID；`sql/production-split/ticket/20260610_artist_avatar_backfill.sql` 负责更新 `artist.avatar`，并已加入 `sql/production-split/manifest.json`。`sql/seed.sql` 与 `sql/seeds/prod-split-real-demo/01-ticket.sql` 同步指向本地路径，来源和文件大小记录在 `sql/seeds/prod-split-real-demo/artist-avatars.json`。
- 头像素材偏离：个人艺人使用公开人物图；开心麻花、故宫博物院、德云社、广州长隆和科学队长等团体/机构优先使用公开官网标识、场景图或品牌素材，目的是保证本地可部署且不再显示灰色文字占位，不代表生产授权素材。
- 订单快照：根因确认是 `java-ticket` 的 `OrderInfoResponse` 缺失 `activityPoster`、`sessionTime`、`ticketName` 等快照字段，导致 Feign 反序列化丢失；已补齐 DTO。`java-order` 实际在 `OrderService.writeSnapshot()` 已写入活动海报、场次时间、票档名称，前端按真实值展示并仅在 null 时兜底。
- 退款排版：`/console/refunds` 使用固定列宽、申请原因两行截断 Tooltip、审核备注/处理时间上下分行和右对齐水平操作按钮；拒绝审核使用必填理由 Modal。
- 验证：`mvn -pl java-ticket "-Dtest=AdminControllerTest" test` 通过 138 项；`mvn -pl java-ticket "-Dtest=AdminOrderManagementTest" test` 通过 20 项；`mvn -pl java-order "-Dtest=OrderSnapshotServiceTest,AdminOrderManagementTest" test` 中实际匹配 `OrderSnapshotServiceTest` 通过 2 项；前端目标测试通过 90 项；`pnpm typecheck` 通过；`scripts/check-production-split-sql.ps1` 通过。

- Seed 偏离补齐：`sql/seeds/prod-split-real-demo/01-ticket.sql` 已移除 `930001~930012` 场馆插入块；苏州、天津场馆改为省略主键并通过 `venue_id_seq` 生成，再由临时映射表供区域和场次引用。座位生成条件收窄到本 seed 自有区域 `940001~940036`，避免重复扫基础场馆模板。

- 数据库执行：2026-09-07 已在本地 `omni_ticket_split` 执行 `20260611_venue_id_cleanup.sql` 与 `20260610_artist_avatar_backfill.sql`。12 条高位场馆及其 `session`、`session_seat`、`venue_area`、`venue_seat`、`venue_default_layout`、`station_config_version`、`venue_application` 引用均已迁移或清理；`venue_id_seq=15`。18 个目标艺人头像字段已回填为 `/avatars/artists/*.webp`，对应 18 个静态文件存在，空头像数量为 0。

## 2026-09-09 Seed 伪交易退款审核单清理

- 根因与范围：`refund_request.id=985009 / REFREAL985009` 绑定 `payment.id=984006 / PAYREAL984006 / DMREAL980006 / ALI-REAL-980006`，该支付流水没有 `raw_notify` / `callback_data` 渠道回执；关联假订单为 `order.id=980006 / DMREAL980006`。
- 关联排查：`omni_order` 命中 `order_snapshot=1`、`order_seat=1`、`electronic_ticket=1`，未命中 `ticket_transfer`、`order_attendee`、`ticket_check_in_record`；`omni_grab` 命中 `waitlist_entry=1`、`waitlist_offer=1`；`omni_user` 命中 `support_conversation=1`、`support_message=1`、`support_conversation_audit=1`；`omni_ticket_split` 和 `omni_notification` 未命中目标占用或通知。
- 保护对象：真实沙箱 `payment.id=984058 / order_id=980058 / trade_no=2026061122001424640509936851` 与 `order.id=980058` 在 dry-run 中均为 1，清理脚本不以这些 ID 为删除条件。
- 脚本：新增并执行 `scripts/cleanup-seed-refund-985009.ps1 -Execute`；脚本默认 dry-run，内置本机库保护、目标主键/单号 guard、每库事务和执行后复核。
- 执行结果：目标 `refund_request/payment/order/order_snapshot/order_seat/electronic_ticket/waitlist_entry/waitlist_offer/support_conversation/support_message/support_conversation_audit` 均清理为 0；真实沙箱 `payment=984058` 与 `order=980058` 仍为 1。
- 页面/API 验证：`GET /api/payment/refunds/admin` 返回 200 且目标命中 0；`GET /api/ticket/admin/orders?paidOnly=false` 返回 200 且目标命中 0、真实订单 `DM202606110047432ACEBE` 命中 1；浏览器 `/console/refunds` 无 `REFREAL985009/DMREAL980006`，`/console/orders` 搜 `DMREAL980006` 为 0，搜真实订单为 1。

## 2026-09-09 Seed 伪交易全面清理

- 范围口径：新增 `scripts/cleanup-seed-transactions.ps1`，默认 dry-run，只在显式 `-Execute` 时删除；候选覆盖 `PAYSEED/DMSEED/ALI-SEED`、`PAYREAL/DMREAL/ALI-REAL`、`SEED-`、`MOCK-` 前缀，以及成功但缺失有效支付宝回执的 Alipay 支付。
- 保护对象：脚本启动时强制确认真实沙箱 `payment.id=984058 / order_id=980058` 存在真实支付宝回执、`order.id=980058 / DM202606110047432ACEBE` 存在，且候选集不得包含这些 ID。
- dry-run 候选：`payment=56`、`refund_request=9`、`order=56`、`order_snapshot=56`、`order_seat=50`、`electronic_ticket=26`、`ticket_check_in_record=3`，候选中不含已清理的 `984006/980006/985009`，也不含真实沙箱 `984058/980058`。
- 跨库关联：`omni_ticket_split` 命中 `session_seat.order_id=1`、`activity_review=3`、`stock_log=0`；`omni_grab` 命中 `waitlist_entry=13`、`waitlist_offer=13`、`waitlist_allocation_log=14`；`omni_notification` 命中 `notification=2`；`omni_user` 命中 `exception_task=3`、`reconciliation_detail=2`、`reconciliation_difference=1`、`support_conversation=1`、`support_message=5`、`support_conversation_note=1`、`support_conversation_audit=3`、`support_conversation_tag=3`。
- 偏离说明：物理拆库下 PostgreSQL 不能在五个独立 database 之间提供单个 ACID 事务；脚本采用每库独立事务、统一候选集、先外围后核心删除、幂等可重跑策略。库存侧只释放实际命中的 `session_seat.order_id`，不盲目调整 `ticket_type.remain_stock`。
- 执行偏离：首次 `-Execute` 在 `omni_ticket_split` 删除 `activity_review` 时被 `activity_review_report.review_id` 外键拦截；此时 `omni_user`、`omni_notification`、`omni_grab` 外围库已清理提交，核心 `omni_payment` 和 `omni_order` 尚未执行。已补齐脚本先删 `activity_review_report` 再删 `activity_review`，随后幂等重跑成功。
- 执行结果：`payment=0`、`refund_request=0`、`order=0`、`order_snapshot=0`、`order_seat=0`、`electronic_ticket=0`、`ticket_check_in_record=0`、`session_seat.order_id=0`、`activity_review=0`、`activity_review_report=0`、`waitlist/grab/notification/user` 关联残留均为 0；真实沙箱 `payment=984058` 与 `order=980058` 均仍为 1。
- API 验证：`GET /api/payment/refunds/admin` 返回 `code=200` 且 seed 退款命中 0；`GET /api/ticket/admin/orders?paidOnly=false` 返回 `code=200` 且 seed 订单命中 0、真实订单 `DM202606110047432ACEBE` 命中 1。
- 全局残留扫描：`omni_payment`、`omni_order`、`omni_ticket_split`、`omni_grab`、`omni_notification`、`omni_user` 对 `DMREAL9800/DMSEED/PAYREAL9840/PAYSEED/REFREAL9850/REFSEED/ETREAL9830/ETSEED/ALI-REAL-/ALI-SEED-/MOCK-` 和 seed 订单 ID 区间的运行库扫描均为 0。

## 2026-09-09 孤立退款订单 625 清理

- 根因：`订单综合查询` 的“已退款 2”来自 `omni_order."order".status=4` 计数；`退款审核` 只展示 `omni_payment.refund_request`。其中 `order.id=625 / DM20260531180231071182` 为 `status=4`，但 `omni_payment.payment` 与 `refund_request` 均无对应记录，不是可追溯的真实支付退款链路。
- 处理口径：不补造支付或退款单；按脏数据清理 `order.id=625`，并一并清理其由 `refund:625:session:3:ticket-type:8:quantity:1` 派生的候补过期订单 `order.id=629 / DM20260531192147184F55`，避免保留 source_order 引用。
- 脚本：新增并执行 `scripts/cleanup-isolated-order-625.ps1 -Execute`；脚本默认 dry-run，执行前强制确认 `625/629` 无支付、无退款，且真实沙箱 `payment=984058 / order=980058` 仍存在。
- 执行结果：删除 `omni_order` 中 `order=2`、`order_snapshot=2`、`order_seat=2`、`order_attendee=2`；删除 `omni_grab` 中 `waitlist_entry=3`、`waitlist_offer=2`、`waitlist_allocation_log=6`；删除 `omni_notification.notification=4`；`omni_payment` 无需删除，`omni_ticket_split` 仅防御性释放目标座位。
- 验证：脚本重跑 dry-run 显示目标关联均为 0；DB 状态分布为 `已支付(status=2)=5`、`已退款(status=4)=1`、`已取消(status=3)=623`；后台 API `GET /api/payment/refunds/admin` 返回 1 条，`GET /api/ticket/admin/orders?paidOnly=false` 返回 `paid=5/refunded=1/cancelled=623`，且 `625/629` 命中 0、真实订单 `980058` 命中 1。

## 2026-09-11 PostHog Web Vitals INP 空 entries 报错

- 根因：`reportAllChanges` / `entryGroupId` / `name: "INP"` 未在项目源码中出现；构建产物和本地依赖定位到 `posthog-js@1.383.2` 的 `web-vitals-with-attribution` bundle。该 bundle 在 INP attribution 上报路径中直接访问 `t.entries[0].startTime` / `interactionId`，当首屏或路由切换尚无真实交互条目时会抛出 `Cannot read properties of undefined (reading 'startTime')`。
- 修复：`frontend/src/lib/posthog-client.ts` 初始化 PostHog 时显式传入 `capture_performance: false`，覆盖 PostHog 远端 `capturePerformance.web_vitals` 配置，避免加载 Web Vitals / attribution 性能探针；保留手动业务埋点、关闭 `autocapture`、关闭 pageview 和 session recording 的既有策略。
- 回归测试：`frontend/src/lib/posthog-client.test.ts` 增加初始化参数断言，确保即使环境变量开启 PostHog 相关能力，客户端仍不会启用自动性能采集。

## 2026-09-11 后台评价问答方案 A 抽屉重构

- 前端范围：`/console/activity-engagement` 从全局平铺三 Tab 改为活动/巡演聚合主表 + 右侧 Drawer 详情；主表接入 `GlobalPagination`，支持活动关键字、普通活动/大型巡演、仅看待办筛选；抽屉内保留购前问答、评价管理（先审后发）、违规举报三类工作台。
- 管理闭环：问答回复新增 `OFFICIAL_SUPPORT` / `ORGANIZER_PROXY` 回复主体；改写回复、下架问答、驳回/隐藏评价、确认违规隐藏内容均通过操作留痕弹窗强制填写“操作原因/备注”后提交。
- 后端范围：`java-ticket` 新增活动维度互动概览和 activity-scoped 管理接口，所有后台入口统一走 `UserAccessService.requirePermission(userId, "activity.review.manage")`；审计通过 `java-user` internal API 写入 `operation_audit_log`，不新增跨库 mapper 或 join。
- ES 联动：评价状态变为公开/隐藏，以及举报确认违规隐藏评价后，均触发 `ActivitySearchIndexEventPublisher.publishUpsert(activityId)`；ES 文档和 mapping 新增 `averageRating`、`reviewCount`，由公开评价实时重算。
- 数据库资产：新增 `activity_question.reply_identity` 幂等迁移，生产拆库迁移位于 `sql/production-split/ticket/20260613_activity_engagement_drawer.sql`，本地共享迁移位于 `sql/migrations/shared/20260613_activity_engagement_drawer.sql`。已在本地 `omni_ticket_split` 执行迁移，`activity_question.reply_identity` 存在，已回复但未回填身份的记录数为 0。
- 验收偏离：`verify-microservice-boundaries.ps1` 首次被既有 prod-split 本地 fallback 拦截；已将 `java-user`、`java-ticket`、`java-order`、`java-payment`、`java-notification` 的生产占位符调整为显式环境变量，保留 `start-project.ps1` 注入本地默认值的运行方式。

## 2026-09-11 评价问答管理 404 启动态排障

- 根因：`:3000/api/ticket/admin/activity-engagements` 的 404 不是前端代理丢路由；3000 前端代理、8088 Gateway、8082 `java-ticket` 均返回同一路径 404。旧路径 `/api/ticket/admin/activity-engagement/reviews` 能返回业务 JSON，说明运行中的 `java-ticket` 仍是未暴露新聚合接口的旧/失败启动状态。
- 启动失败证据：IDEA 粘贴日志显示 `TicketApplication` 在加载 `prod-split` 时因 `Could not resolve placeholder 'SEATA_ENABLED' in value "${SEATA_ENABLED}"` 失败；截图中除 Gateway 外多个 Spring Boot 服务处于失败态。
- 本地修复：不回退 `application-prod-split.yml` 的显式环境变量要求；改为在本机 `.idea/workspace.xml` 的 Spring Boot 配置补充 `PROGRAM_PARAMETERS`，显式传入本地拆库、Nacos、RabbitMQ、Seata、ES、Alipay 占位参数，并清理 RunDashboard 的失败状态展示。
- 验证：用显式本地参数临时启动 `java-ticket` 后，`GET /api/ticket/admin/activity-engagements?page=1&size=10&todoOnly=false` 直连 8082、经 8088 Gateway、经 3000 前端代理均从 HTTP 404 变为业务层 `401 未认证`；再用本地 admin 登录态经 3000 调用该接口返回 `code=200`、`total=154`、`records=10`。

## 2026-09-12 IDEA prod-split 直接启动缺环境变量

- 根因：`prod-split` 已按生产安全要求移除本地 fallback；IDEA 从 main 方法或新生成 Run Configuration 直接启动时不会经过 `start-project.ps1`，因此 `java-user` 在创建 `GrabOpsSummaryClient` 时解析不到 `GRAB_SERVICE_URL`，其他业务服务也会陆续缺 Nacos、RabbitMQ、Seata、ES、Alipay 或 JWT 变量。
- 修复：新增 `LocalProdSplitDefaults`，仅在 `prod-split` 且本地 `target/classes` 启动时向 `SpringApplication` 注入本地默认值；六个 Java 入口统一先应用该本地兜底再启动。jar/生产启动不注入，本地脚本和显式环境变量仍保持最高优先级。
- 验证：新增 `LocalProdSplitDefaultsTest` 覆盖 user/ticket/payment 本地默认值、非 `prod-split` 跳过、jar 启动跳过和显式变量不覆盖；`java-common` 定向测试通过，六个 Java 模块编译通过，生产默认值守护脚本通过。额外清空 `GRAB_SERVICE_URL` 等变量后用 `prod-split` 启动 `java-user`，已越过原 Feign 占位符解析阶段，当前 shell 验证止于本机 Tomcat loopback 异常。

## 2026-09-12 场馆资料审核高密度表格与资质核验闭环

- 数据模型：在 `omni_ticket_split` 增加 `venue_application_material` 关联表，复用 `private_asset`，仅允许 `FIRE_SAFETY_PERMIT` 与 `VENUE_LEASE_AGREEMENT`；`venue_application` 和 `venue` 增加可空的 `venue_name_en`、`venue_type`、`province`、`district` 字段。生产迁移位于 `sql/production-split/ticket/20260912_venue_application_material.sql`，共享 schema 镜像迁移同步维护，并已登记生产 manifest。
- 历史兼容：保留 `proofAssetId`、`proofFileUrl`、`proofNote` 原字段。VO 组装层把旧单附件映射为 `LEGACY_GENERAL_PROOF`，后台展示“通用审批综合证明材料（历史凭证）”及“包含通用证明（历史数据）”，不会误判为缺少消防或租赁材料；省份、区县、英文名和场馆类型为空时按既定中文回退展示。
- 后端闭环：`java-ticket` 负责材料绑定、资产元数据组装、城市/关键字/容量梯队/材料完整度服务端分页筛选；审核通过在同一票务库内关联或创建正式 `venue` 快照；驳回强制要求非空 `reviewNote`，并通过 `UserAccessService.writeOperationAudit()` 写入 `VENUE_REVIEW_APPROVE` / `VENUE_REVIEW_REJECT`，未新增跨库 Mapper、Entity 或 SQL Join。
- 前端闭环：`/console/venue/apply` 支持结构化字段和两类材料上传；`/console/venue/applications` 改为高密度表格，提供状态 Tab、城市快捷切片、容量规模和资质完整度筛选，详情集中到右侧 Drawer；材料图片通过带 `Authorization` 的受保护下载后交给 `SafeImage` 预览，驳回前执行 `reviewNote.trim()` 校验。
- 兼容修复：扩展 `PrivateAssetService` 的材料类型集合时，针对历史资产缺少 `bizType` 的情况增加 null-safe 判断，避免 `Set.of(...).contains(null)` 抛出 `NullPointerException`，继续返回预期的无权限业务异常。
- 最终验证：已在本地 `omni_ticket_split` 执行场馆材料迁移；前端场馆相关组合测试 `74/74`、`pnpm typecheck`、场馆 Java 定向测试 `36/36`、私有资产回归测试 `44/44`、`verify-microservice-boundaries.ps1`（含 Java boundary tests）和 `git diff --check` 均通过，未提交或推送 Git。

## 2026-09-12 场馆材料提报与受保护预览 400 修复

- 根因：结构化材料上传后，`/console/venue/apply` 的前端必填校验仍只认可旧 `proofNote` / `proofAsset`，未把 `FIRE_SAFETY_PERMIT` 和 `VENUE_LEASE_AGREEMENT` 资产计入“已提供凭证”，导致只上传新材料的提报仍可能被前端阻断或进入后端 400 排查路径。
- 修复：提报校验改为同时认可旧通用凭证、消防证明和租赁协议；提交前“附件上传中”阻断与按钮禁用同步覆盖三类上传状态，避免结构化材料未完成上传时提交。
- 预览兼容：Drawer 受保护材料通过授权下载生成 `blob:` URL 后再交给 `SafeImage`，因此 `resolveImageSrc()` 显式允许 `blob:` 图片地址，同时继续拒绝 `javascript:` 等不安全 scheme，不放开 `data:`。
- 验证：新增/更新前端回归覆盖结构化材料校验和 `blob:` 预览；`node --test src/lib/venue-application-review.test.ts src/lib/console-modal-drawer-layout.test.ts src/lib/console-production-entry.test.ts src/lib/image-url.test.ts` 通过 79/79，`pnpm typecheck` 通过，`scripts/verify-microservice-boundaries.ps1` 通过。

## 2026-09-12 三类审核高密度表格与抽屉重构

- 范围：`/console/artists/pending`、`/console/risk-resolutions`、`/console/station-config-reviews` 统一下线卡片式平铺，目标为高密度表格、服务端分页和右侧 Drawer 工作台。
- 后端约束：三类 java-ticket 审核动作继续只操作票务归属数据；驳回、标记风险、恢复售票和站点变更生效必须通过 `UserAccessService.writeOperationAudit()` 写入 java-user 审计表。
- 测试先行：已新增前端静态结构/API 测试，并在 `ArtistGovernanceServiceTest`、`ActivityRiskResponseServiceTest`、`StationConfigVersionServiceTest` 补充 reason 非空、审计日志与 ES 刷新 RED 用例。
- 当前偏离：艺人授权公函、恢复售票复批附件等结构化材料字段在现有实体中未独立建模；本轮先使用既有头像/海报/说明和可选附件字段兼容展示，不新增数据库迁移。

- 2026-09-12：艺人资质完整度筛选当前只能基于 artist.source_note/sourceNote 做前端兼容展示，后端实体暂无结构化附件字段；未新增数据库迁移，避免扩大数据模型边界。

## 2026-09-13 控制台表格全局满宽与统一外壳

- 布局：`ConsoleLayout` 主内容区移除全局 `max-w-[1200px]`，改为 `flex-1 min-w-0` 与 `w-full min-w-0`；个人中心、纯表单页面仍可在页面内部按需使用 `max-w-2xl` / `max-w-3xl`。
- 组件：新增 `frontend/src/components/ConsoleTable.tsx`，统一表格容器、边框圆角、横向滚动兜底、表头样式和分页 footer；`ConsoleTableSkeleton` 增加 `bare` 模式供表格外壳复用。
- 页面：场馆资料审核、艺人档案审核、恢复售票审核、站点变更审核改为复用 `ConsoleTable`，移除固定 `min-w-[...]` 表宽，改用 `w-full table-fixed` 与百分比列宽，减少常规宽屏下无意义的横向滚动。
- 验证：新增全局布局、共享表格外壳和四页复用结构测试；结构测试 `6/6`、`pnpm typecheck`、`git diff --check` 通过。

## 2026-09-13 后台表格短列固定与工作台宽度保护

- 工作台：保留全局横向自适应，在 `ConsoleLayout` 普通内容区增加 `max-w-[1680px] mx-auto`，客服会话页原有全屏特殊布局不变。
- 列宽：四个审核列表继续使用 `table-fixed w-full`；状态、操作、城市/版本、类目/变更类型、资质和经办人等短列改为明确 Tailwind 固定宽度，操作列统一右对齐并使用 `pr-4`。
- 弹性列：艺人基本信息/代表作品、活动与停售原因/整改摘要、站点项目/申请事由、场馆信息/地址/资质说明不再设置固定列宽，由表格布局吸收剩余空间；外层 `overflow-x-auto` 仅作为窄屏兜底。
- 验证：扩展结构测试覆盖 `1680px` 工作台上限和短列固定规则；结构测试 `6/6`、`pnpm typecheck`、`git diff --check` 通过。

## 2026-09-13 RBAC 角色权限工作台深度重构

- 前端范围：`/console/rbac/roles` 接入 `按职位角色` / `按指定账号` 双模式；旧 `/console/roles` 保留实现并由规范路径复用。职位角色强制按 `platform_super_admin`、`organizer`、`organizer_admin`、`support_manager`、`support_agent` 展示，平台超管默认首位。
- 权限分类：新增四大业务域映射，27 个 `permission_code` 全部归入演出与票务、订单与履约、运营客服审核、系统治理财务四类；移除“其他”分类口径，场次、巡演、场馆、核验、客服、审计等权限均回到对应业务域。
- 交互与视觉：权限项改为紧凑 Check-Chip 和四域 Accordion；权限变更预览收敛为单行 Alert；平台超管及超管账号的 `rbac.manage` 保持勾选禁用，展示锁图标、`[系统自保]` 和中文死锁防护说明，其余业务权限可正常勾选或取消。
- 后端范围：`java-user` 新增 `user_permission_override` 实体、Mapper、DTO、管理接口和权限计算逻辑；生效权限按 `(继承角色权限 ∪ ALLOW) \ DENY` 计算，超管账号服务层强制保留 `rbac.manage`，防止后端接口层误锁死。
- 审计与迁移：角色权限保存同事务写入 `RBAC_ROLE_PERMS_UPDATE`，账号覆盖保存同事务写入 `USER_PERMISSION_OVERRIDE_UPDATE`；生产拆库和 shared 本地迁移均只新增 `omni_user.user_permission_override`，未访问或 join `omni_ticket_split`。
- 迁移执行：已在获得授权后对本机 `omni_user` 执行 `sql/production-split/user/20260913_user_permission_override.sql`；验证到 `user_permission_override` 表、`uk_user_perm` 唯一约束、`override_type` CHECK 约束和 `idx_user_perm_uid` 索引存在，且 `omni_ticket_split` 未创建该表。
- 验证：前端 RBAC/API 定向测试 `54/54` 通过，`pnpm typecheck` 通过；Java RBAC 定向测试 `16/16` 通过；`check-production-split-sql.ps1`、`verify-microservice-boundaries.ps1` 和 `git diff --check` 通过。新增 `user_permission_override` 已同步登记生产 SQL 静态表清单与跨库 FK owner map。

## 2026-09-15 java-ai-core 第一阶段

- 范围：依照已批准 V1 抽取共享模型基础层；不实现找票、Copilot、前端、RAG、Agent、工具调用或交易动作，不修改数据库。
- 结构：父 POM 位于 java/pom.xml，新增 java/java-ai-core 普通 JAR；java-user 依赖 core，core 仅依赖 Jackson、SLF4J 和 JDK，不依赖 java-common 或业务模块。
- 实施计划：先运行客服基线并添加 DTO、协议、异常、取消和 Prompt 测试；再将旧客户端的 HTTP/NDJSON/SSE/think 过滤迁入 core；旧类保留为兼容适配层；复用原配置键、默认值和回退语义；最后执行离线 compile、相关 test、边界检查和 diff 审查。
- Prompt：原客服 system prompt 原文移入业务资源目录，由共享模板加载并计算版本 hash，FAQ 不变。
- 验证边缘情况：首次 Maven 参数在 PowerShell 被拆分，改为完整引号；原始客服基线 21 项中 5 项因 JDK loopback 连接错误失败、13 项规则层测试通过，继续检查仅进程 IPv4 参数，不将环境失败报告为通过。
- 状态：第一阶段完成。保留本文件原有用户改动；不提交、推送或合并 Git。
- 实施完成：新增 AiModelClient.generate/stream、不可变 DTO、AiCancellationToken、安全中文异常和元数据日志；旧客服类仅保留适配与 HTTP 非 2xx 回退，配置表达式及默认值原样迁入 SupportAiModelConfig。
- 协议：支持 Ollama NDJSON、SSE 多行 data/元数据/[DONE]、既有 OpenAI choices；对 Chat Completions 的新增可选 temperature/maxTokens 做顶层映射，其余沿用原 num_ctx 请求。缺失 token 统计返回 null。
- 必要偏离：真实 chunked HTTP 测试证明 HttpURLConnection.disconnect 会等待读取锁。将唯一传输升级到 JDK HttpClient.sendAsync + 原始 body.close，保留已抽取 payload、解析和 think 过滤；取消覆盖响应头前、正文阻塞和交付竞态，不保留第二份 Ollama HTTP 实现。
- 异常边界：沿用 timeout-ms 最小 1000ms，并作为单次总预算；严格拒绝尾随 JSON 和缺失完成标记的截断流；部分输出后不自动模型重试。这些收紧用于防止无限流和部分响应误报成功，旧客服仍通过 Optional.empty 进入原规则兜底。
- Prompt 原文 UTF-8 SHA-256 为 4c51245bbd1f5cf30a3d4cd9124b3280a18c3ab049bb732790a862cb7275bee5，迁移前后逐字节一致；资源目录以 .gitattributes 固定 LF，避免 Windows autocrlf 改变摘要。
- 启动兼容补充：start-project.ps1 原先仅后台安装 java-common，现从父 POM 顺序安装 java-common/java-ai-core 并检查退出码，避免单模块启动缺新 JAR；未执行启动脚本、未重启服务。
- 环境排障：IPv4 参数无效；根因位于本机 Windows JDK17 UnixDomainSockets。测试进程加入 -Djdk.net.unixdomain.tmpdir=D:/Project/omni/runtime 后旧 HTTP stub 恢复。未修改系统配置或下载依赖。
- 最终验收：mvn -o -f java/pom.xml compile 的 9 个 reactor 项目通过；核心 32 项 + 客服相关 110 项测试全部通过，无失败或跳过；verify-microservice-boundaries.ps1 通过；启动脚本语法检查与 git diff --check 通过。相关命令见 java/java-ai-core/README.md。
- 验证范围：使用内存协议 stub 与真实本地 HttpServer 验证，未连接真实 Ollama，不声称完成模型联调。独立代码复核发现的取消阻塞、日志 Unicode、null role 与尾随 JSON 问题均修复并补测。
- 本阶段停止于共享 AI 基础能力；order、payment、grab-service、ticket 搜索及前端源码均无修改；未改数据库、提交、推送或合并 Git。
# 2026-09-15 AI 智能找票 Backend 第二阶段

## 实际实现内容

- 仅在 `java-ticket` 实现无状态 AI Finder Backend。
- 使用共享 `java-ai-core` 的 `AiModelClient` 做意图解析和事实包解释；未修改 `java-ai-core`。
- Elasticsearch 通过现有 `ActivitySearchProvider` 做活动候选召回；ES 故障直接返回错误，不使用 `DbActivitySearchProvider` 静默降级。
- 通过 `java-ticket` 当前 Mapper 查询真实活动、场次、场馆、票档、实时库存和可售座位。
- 最终价格、库存、销售状态、座位连座判断和排序均由 Java/数据库确定，不由 LLM 决定。
- 连座判断使用只读 `SeatAdjacencyEvaluator` 与只读座位查询，没有调用锁座或购买链路。
- 未新增数据库表、Migration、跨服务 API、internal token API、购买/支付/退款/锁库存/锁座逻辑。

## 实际修改文件

- `java/java-ticket/pom.xml`
- `java/java-ticket/src/main/resources/application.yml`
- `java/java-ticket/src/main/java/com/omni/ticket/config/TicketAiModelConfig.java`
- `java/java-ticket/src/main/java/com/omni/ticket/mapper/SessionSeatMapper.java`
- `java/java-ticket/src/main/java/com/omni/ticket/ai/*`
- `java/java-ticket/src/main/java/com/omni/ticket/service/AiTicketFinderService.java`
- `java/java-ticket/src/main/java/com/omni/ticket/service/SeatAdjacencyEvaluator.java`
- `java/java-ticket/src/main/java/com/omni/ticket/service/TicketAvailabilityQueryService.java`
- `java/java-ticket/src/main/java/com/omni/ticket/service/TicketFinderResult.java`
- `java/java-ticket/src/main/java/com/omni/ticket/service/TicketResultFormatter.java`
- `java/java-ticket/src/main/java/com/omni/ticket/controller/AiTicketFinderController.java`
- `java/java-ticket/src/main/resources/prompts/ticket-finder-intent-v1.txt`
- `java/java-ticket/src/main/resources/prompts/ticket-finder-explanation-v1.txt`

## API

- `POST /api/ticket/ai/finder/interpret`
- `POST /api/ticket/ai/finder/search`
- 本阶段未实现 `/search/stream`。

## DTO

- `TicketIntent`
- `FinderQueryRequest`
- `FinderResponse`
- `FinderClarification`
- `TicketFinderResult`
- `TicketIntentModelOutput`
- `TicketIntentParseResult`

未提供的意图字段保持 `null`；`peopleCount` 不默认 `1`；未提供日期不设置默认日期；模糊价格不生成具体金额。

## 核心调用链

`FinderController -> AiTicketFinderService -> TicketIntentParser -> AiModelClient -> ActivitySearchProvider -> TicketAvailabilityQueryService -> SeatAdjacencyEvaluator -> Java 确定性排序 -> TicketResultFormatter`

## 关键架构决策

- Finder API 要求当前用户携带有效 Bearer JWT；未登录返回 `401`。
- 条件不足通过 `clarification` 返回，不通过异常表达。
- LLM 输出使用严格 JSON、未知字段拒绝、字段类型和业务边界校验；模型输出中的 URL/SQL 片段拒绝或回退为确定性中文说明。
- ES 结果只作为候选，不作为最终业务事实；只处理真实活动候选，不把巡演聚合项直接伪装为活动场次。
- 找票结果只返回真实购买链路需要的活动、场次和票档 ID，不触发任何购买动作。

## 测试结果

- AI Finder 定向测试：已通过 25 项。
- 全量 `java-ticket` 测试：`1097` 项通过。
- 同一 Maven reactor 中 `java-ai-core` 测试：`32` 项通过。
- Maven 全 reactor `compile`：9 个模块通过。
- 边界静态检查：service boundary、cross-owner FK、production split SQL 均通过。

## 已知限制

- ES 当前为活动聚合索引，候选召回可能受索引覆盖范围影响；最终仍以 `java-ticket` 实时数据为准。
- V1 无状态，不保存 query、解析结果、结果快照或会话历史。
- 解释模型未联调真实 Ollama；模型失败时使用基于真实结果的确定性中文说明。

## 未实现内容

- AI Finder 前端、Copilot、Copilot 前端。
- `/search/stream`。
- RAG、Embedding、Vector DB、Agent、Tool Calling。
- 自动下单、支付、库存锁定、锁座、退款。
- 新独立 AI 微服务及 AI 搜索会话数据库表。

## 2026-09-15 第二阶段收尾校正

- 意图解析先校验模型输出的原始边界，再清除用户输入中没有明确表达的价格、人数和日期字段，避免模型擅自补全条件；原有未提供字段保持 `null` 的规则不变。
- 解释结果增加事实数字白名单和库存数量语境校验；模型输出疑似编造库存数量、价格或其他事实数字时，统一回退到 Java 根据真实结果生成的中文说明。
- 解释 Prompt 将业务事实包标记为不可信数据而非指令，降低活动名称、场馆名称等业务文本造成 Prompt Injection 的风险。
- 新增回归覆盖：模型擅自补全字段、解释编造库存数量、事实数字解释，以及 Finder 相关定向测试。
- 本次收尾实际修改文件：`java/java-ticket/src/main/java/com/omni/ticket/ai/TicketIntentParser.java`、`java/java-ticket/src/main/java/com/omni/ticket/service/TicketResultFormatter.java`、`java/java-ticket/src/main/resources/prompts/ticket-finder-explanation-v1.txt`、`java/java-ticket/src/test/java/com/omni/ticket/ai/TicketIntentParserTest.java`、`java/java-ticket/src/test/java/com/omni/ticket/service/TicketResultFormatterTest.java`。
- 本阶段仍无数据库 Migration、无会话表、无跨服务数据库访问、无购买链路改动；工作区中第一阶段 `java-ai-core` 和客服共享客户端改动属于此前工作，不作为本阶段新增实现。
- 收尾定向测试：Finder 相关测试 `25/25` 通过。

## 2026-09-15 第二阶段 P1 修复

### 实际实现内容

- `TicketIntentParser` 只在用户原文包含明确数值价格约束时保留模型价格；“价格便宜一点”“预算有限”“价位实惠”等模糊表达会确定性清除 `minPrice/maxPrice`。
- 相对日期由 Java 使用 `Asia/Shanghai` 时区的注入 `Clock` 计算；支持周末、周次和上下月范围，不接受模型擅自生成的具体相对日期。
- 明确日期会校验模型输出与用户原文一致；不一致时清空日期并返回澄清问题。
- `needAdjacentSeats=true` 且 `peopleCount=null` 时返回澄清问题；Availability 层也会保守短路，不返回未确认连座条件的结果。
- `SeatAdjacencyEvaluator` 按 `seatBlockId`、`layoutSectionId`、`rowNo` 和连续 `seatNo` 分组；缺少布局证明、已锁或已售座位均不能判定为连座。
- `TicketResultFormatter` 使用 Java 组装的结构化事实 DTO 作为 explanation facts，并对模型输出执行数字、事实文本和业务动作闭包校验；失败时回退到 Java 确定性说明。

### 实际修改文件

- `java/java-ticket/src/main/java/com/omni/ticket/ai/TicketIntentParser.java`
- `java/java-ticket/src/main/java/com/omni/ticket/service/TicketAvailabilityQueryService.java`
- `java/java-ticket/src/main/java/com/omni/ticket/service/SeatAdjacencyEvaluator.java`
- `java/java-ticket/src/main/java/com/omni/ticket/service/TicketResultFormatter.java`
- `java/java-ticket/src/main/resources/prompts/ticket-finder-intent-v1.txt`
- `java/java-ticket/src/test/java/com/omni/ticket/ai/TicketIntentParserTest.java`
- `java/java-ticket/src/test/java/com/omni/ticket/service/SeatAdjacencyEvaluatorTest.java`
- `java/java-ticket/src/test/java/com/omni/ticket/service/TicketAvailabilityQueryServiceTest.java`
- `java/java-ticket/src/test/java/com/omni/ticket/service/TicketResultFormatterTest.java`
- `implementation-notes.md`

### 测试结果

- P1 定向测试：`36/36` 通过。
- 覆盖模糊/明确价格、相对/明确日期、连座缺少人数、Block/Section 边界、缺失布局、锁座/售出座位和 explanation 编造事实/业务动作回退。

### 已知限制与未实现内容

- ES 仍使用 Activity 聚合索引和固定候选窗口，可能造成候选漏召回；本轮未重构 ES。
- 未处理 trailing tokens、Prompt Injection 的全面治理、`RECOMMENDED` 独立算法和座位快照一致性重构。
- 未修改购买、库存锁定、锁座、订单、支付、退款、数据库和跨微服务边界；未新增 `/search/stream`、前端或其他 AI 能力。

## 2026-09-15 AI 智能找票 Frontend V1

### 实际实现内容

- 仅新增 C 端页面 `/ai/ticket-finder`，复用现有 `Header`、`Footer`、`Button`、`router`、`request<T>()` 和认证机制。
- 接入 `POST /api/ticket/ai/finder/interpret` 与 `POST /api/ticket/ai/finder/search`，请求体均为 `{ query }`，不新增 HTTP client、axios、SSE 或全局状态。
- 页面覆盖自然语言输入、空输入校验、interpret loading、澄清问题补充、找票条件展示、search loading、防重复提交、结果列表、后端 explanation、无结果和中文错误态。
- 结果只展示后端返回的活动、场馆、城市、场次、票档、价格、库存、销售状态及可选连座字段；前端不计算库存、不判断可售、不重新排序。
- “去购票”仅跳转现有活动详情路由，并携带真实 `activityId`、`sessionId`、`ticketTypeId`，未调用订单、支付、锁库存或锁座接口。
- 实际 `TicketFinderResult` 没有独立连座状态字段，因此未在前端伪造该字段。

### 实际修改文件

- `frontend/src/app/ai/ticket-finder/page.tsx`
- `frontend/src/lib/ai-ticket-finder.ts`
- `frontend/src/lib/ai-ticket-finder.test.ts`
- `frontend/src/lib/ai-ticket-finder-api.test.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/types/api.ts`
- `implementation-notes.md`

### 验证结果

- Finder/API 定向测试命令：`4/4` 通过；断言覆盖 API 请求体、条件缺失不展示、真实购票参数跳转和 401/403/超时/服务不可用/网络错误中文提示。
- `pnpm typecheck`：通过。
- `pnpm build`：通过，产物包含 `○ /ai/ticket-finder`。
- 本轮新增文件 ESLint：`0 errors`；全量 `pnpm lint` 仍受仓库既有页面和 React Compiler 规则影响，结果为 `5 errors / 216 warnings`，未归因于本轮新增 Finder 文件。
- 页面开发服务器曾以 `http://localhost:3003` 启动并返回 `/ai/ticket-finder` HTTP `200`，收尾时已停止。
- `git diff --check`：通过。

### 偏离说明与已知限制

- 现有 `frontend/src/app/activity/[id]/page.tsx` 当前只按路径 `id` 加载详情，未读取 `sessionId` / `ticketTypeId` 查询参数，因此 Finder 已正确携带真实参数，但详情页不会自动预选对应场次和票档；本阶段未修改现有购买流程。
- 未修改 Java、数据库、后端 API、订单/支付/库存/座位链路，也未实现 Copilot、RAG、Agent、Tool Calling 或 SSE。

## 2026-09-15 AI Intent Structured Output + Semantic Hardening

### 实现范围

- `java-ai-core` 的 `AiRequest` 新增可选 `responseFormat`，仅在调用方显式提供时使用；旧客服调用不提供该字段，因此保持原有 Ollama 请求行为。
- native Ollama `/api/chat` 请求在 Finder 场景传递 `format` JSON Schema；OpenAI-compatible 分支不发送 native `format`，避免把 Ollama 专有字段发送到兼容端点。
- `TicketIntentParser` 请求 Finder Intent Schema，并继续使用严格 Jackson 解析：未知字段拒绝、类型强校验、日期/数值/枚举校验；不使用正则截取、Markdown 裁剪或失败后强行恢复。
- 解析失败按安全分类记录 `model_response_empty`、`json_parse` 或 `semantic_validation`，日志不记录完整模型响应、JWT、Authorization 或其他凭证。

### 语义约束

- 原始 query 是语义约束来源；模型不能通过自由推断扩大日期、价格、人数或购票条件。
- 未明确销售状态时清除 `saleStatus`；只有明确“已开售/还没开售/卖完”等表达时才保留对应状态。
- “最近”只映射为 `TIME_ASC`，不生成具体日期；“便宜/最便宜”只映射为 `PRICE_ASC`，不生成价格。
- 显式价格上限或范围由 Java 侧确定性解析并覆盖模型猜测；模糊价格表达不生成 `minPrice/maxPrice`。
- 人数、连座、选座和实名要求不接受模型擅自补全；连座缺少人数时返回澄清。
- 未明确排序时清除 `sortPreference`；模型提出但与真实缺失条件不匹配的澄清问题会被忽略。

### 兼容性

- 旧客服仍通过不带 `responseFormat` 的共享请求调用，不改变原有协议、Prompt 或回退路径。
- 结构化输出能力只在 `java-ticket` Finder parser 使用，不修改 Gateway、Frontend、订单、支付、库存、座位锁定、数据库或 ES。
- 运行时曾发现 `java-ticket` 从本地 Maven 仓库加载旧版 `java-ai-core`，导致 `NoSuchMethodError: AiRequest(..., JsonNode)`；已执行 `mvn -pl java-ai-core -am install "-DskipTests"` 安装当前版本后重启 `java-ticket`，错误消失。
- 运行日志仅保留于 `runtime/logs/java-ticket-stage-a-20260915-retry.out.log`，属于本地运行产物，不纳入源码交付。

### 真实模型验证

- 当前 Ollama 模型为 `Qwen2.5:7b`，Ollama 地址为本机 `localhost:11434`；java-ticket 使用 `localhost:8082`，Gateway 使用 `localhost:8088`。
- 认证后的直连和 Gateway Finder 请求均返回 HTTP `200`；未认证请求返回 `401 未认证`。
- `帮我找上海最近的演唱会`：`city=上海`、日期为空、`saleStatus=null`、`sortPreference=TIME_ASC`。
- `帮我找上海已开售的演唱会`：`saleStatus=on_sale`。
- `帮我找上海还没开售的演唱会`：`saleStatus=coming_soon`。
- `上海周末两个人看演唱会，500元以内`：日期为 `2026-09-19` 至 `2026-09-20`、`peopleCount=2`、`maxPrice=500`。
- `上海演唱会，便宜一点`：不生成价格，`sortPreference=PRICE_ASC`。
- Gateway `search` 返回 HTTP `200`、业务码 `200`；当前样例结果为空，explanation 为后端确定性中文说明，属于真实数据/条件结果，不是链路错误。

### 验证与剩余风险

- 已完成：Finder parser 定向测试 `23/23`、`java-ai-core` 全量测试 `34/34`、`java-ticket` 定向 parser 测试 `23/23`、完整 `java-ticket` 测试 `1120/1120`、`java-ticket` package、`java-ai-core` install、结构化 Ollama Schema 直连 HTTP `200`。
- 完整 `java-ai-core` 测试首次在未设置本机 JDK17 loopback 参数时有 5 个 `AiHttpLifecycleTest` 因 Windows Unix domain socket `Invalid argument` 报错；使用既有 `-Djdk.net.unixdomain.tmpdir=D:/Project/omni/runtime` 测试 JVM 参数重跑后 `34/34` 通过。未修改源码、配置或系统设置。
- 完整 Maven reactor `compile` 已通过，9 个模块均为 `SUCCESS`；`git diff --check` 已通过。
- 本轮不处理 ES top 100 漏召回、trailing JSON、Prompt Injection 全面治理、`RECOMMENDED` 独立排序算法和 seat snapshot consistency。

## 2026-09-15 AI Ticket Finder 非空结果真实 E2E

### Guaranteed Match Fixture

- Activity：`900028`，中央芭蕾舞团《天鹅湖》广州站，已发布且状态正常。
- Venue：广州珠江体育馆，城市为广州，场馆状态正常。
- Session：`910028`，`2026-09-16 19:30:00`，状态正常且晚于当前日期 `2026-09-15`。
- TicketType：`920084` 普通票 `¥240`、`920083` A区票 `¥360`、`920082` VIP票 `¥600`，均为可售状态且价格大于零。
- 数据库实时可用座位分别为 `84`、`60`、`40`；锁定和售出座位均为 `0`。

### ES 与真实 API

- ES alias `omni_activity_current` 指向当前索引，直接使用 Finder 同等的关键词、城市、日期和价格条件可召回 `activityId=900028`。
- 实际查询：`帮我找广州的天鹅湖演出，预算700元以内`。
- 通过 Frontend server proxy `localhost:3000/api/ticket/ai/finder/*` 携带临时本地 JWT 调用：
  - interpret：业务码 `200`，`keyword=天鹅湖`、`city=广州`、日期未指定、`maxPrice=700`。
  - search：业务码 `200`，`results.length=3`。
- 三个结果均为 `activityId=900028`、`sessionId=910028`，票档 ID、价格和实时库存分别为 `920084/240/84`、`920083/360/60`、`920082/600/40`，销售状态均为 `on_sale`。
- explanation 为“已根据实时票务数据找到 3 个符合条件的可售票档。”，未出现编造价格、库存、场馆或自动交易指令。

### 前端与副作用核对

- `/ai/ticket-finder` 页面 HTTP `200`；Frontend proxy 已实际完成 interpret/search，结果 DTO 可供页面结果卡片直接展示。
- 现有前端购票链接构造为 `/activity/900028?sessionId=910028&ticketTypeId=920084`；活动详情页 HTTP `200`。
- 当前活动详情页源码没有读取 `sessionId` / `ticketTypeId` 查询参数，因此自动预选仍是既有限制，未修改详情页。
- Fixture 对应订单数量为 `0`，最近 30 分钟新增订单为 `0`；对应座位无锁定、无售出、无订单关联。Finder 只读调用未创建订单、支付或锁座。

### 阻塞结论

- 浏览器自动化通道当前不可用：桌面 CUA 返回 `unsupported Codex auth method: apikey`；仓库 Playwright wrapper 依赖的 `bash` 在本机不可用，PowerShell 入口下载 `@playwright/cli` 又受 npm cache `EPERM` 阻塞。
- 因此本阶段已完成真实 Frontend proxy → Gateway → java-ticket → Ollama → ES → PostgreSQL 的非空结果取证，但尚未能在真实浏览器中确认结果卡片可见并点击“去购票”。
- 阶段 B 状态：`BLOCKED`，不是 `PASS`。待浏览器自动化可用后，只需复验结果卡片和最终跳转 URL，不应修改业务代码或数据。

## 2026-09-15 Finder → Activity Detail 自动预选

### 实现范围

- 活动详情页首次加载完成后读取 URL 的 `sessionId` 和 `ticketTypeId`，通过纯函数计算初始 Session / TicketType。
- 合法 `sessionId` 优先；无效时回退现有第一场次。
- `ticketTypeId` 只在最终选中的 Session 的 `ticketTypes` 内匹配；无效或跨 Session 时回退该 Session 的第一票档。
- 没有新增 API 请求，没有修改订单、支付、库存或锁座链路。

### 初始化与兼容性

- URL 参数只在当前活动首次成功初始化时生效；同页后续刷新使用现有默认选择逻辑。
- 用户手动切换 Session 或 TicketType 仍直接更新现有 state，不会被持续 URL effect 覆盖。
- 无 query 参数的 `/activity/{id}` 继续使用原有第一 Session / 第一 TicketType 默认行为。

### 测试与已知限制

- 新增纯函数测试，覆盖合法参数、非法 Session、非法 TicketType、跨 Session 票档、空 sessions 和无票档。
- 增加详情页源码级接入测试，确认只在初始化路径读取 Finder query params，且纯函数不发请求。
- 真实浏览器点击链路仍依赖本机浏览器自动化环境；本次未创建订单、支付、库存锁定或座位锁定。

## 2026-09-16 ⑤-1 Copilot Backend Core

### 实现范围

- 仅修改 `java-user`、`sql/production-split/user/20260916_support_ai_copilot.sql` 和本说明；未修改 Gateway、Frontend、`java-ticket`、`java-order`、`java-payment`、`grab-service`、Seata、Finder、`manifest.json` 或 verifier。
- 新增客服 Copilot 建议生成、accept、edit、reject API；建议全程独立于 `support_message`，不调用 `sendMessage()`，`ACCEPTED` 不代表已发送。
- `messageCutoff` 使用生成时会话最后一条 `support_message.id`；accept/edit 重新读取并通过数据库条件更新同时校验 `message_cutoff` 与 `context_digest`。
- 生成失败或并发条件失效时，状态分别落为 `FAILED` 或 `EXPIRED`；对外不返回模型原始异常或旧草稿。

### 安全与事实边界

- 模型 `sourceEvidence` 只允许返回白名单 `factKey`；证据文本由服务端 `SupportCopilotFactCatalog` 生成。
- 只向模型提供最近最多 50 条脱敏消息和最小事实快照，不持久化完整 `SupportContext`、完整订单快照、完整会话历史、token、密码、支付敏感信息、身份证或完整手机号。
- 高风险订单号、票券 ID、金额和状态由 Java 确定性校验；当前上下文不存在 `paymentStatus` 时不创建该事实。
- 所有接口继续经过 `RbacService` 与 `CsSessionService` 可见范围校验。当前 `support_agent` 的 `support.ai.review` 仍受现有本人会话/公共池可见范围限制，没有扩大为查看其他坐席会话。

### 数据库与验证

- 已只读核对本机 `omni_user`：真实表名为 `support_conversation`、`support_message` 和 `"user"`；相关 ID 为 `BIGINT`，时间字段为 `TIMESTAMP WITHOUT TIME ZONE`，JSON 字段使用 `JSONB`，FK 方向与现有用户库一致。
- 本阶段按要求未修改 `sql/production-split/manifest.json` 和 verifier；因此 `check-cross-owner-fks.ps1` 会将新增 `support_ai_suggestion` 标记为 owner map 未分类并报告两条 FK，属于待生产 SQL 接入 checklist，不代表 Java 代码跨库访问。
- `check-production-split-sql.ps1` 已通过；生产 SQL 尚未加入 manifest、导入链路和 verifier 的生产接入 checklist，未执行数据库迁移。
- 未提交、未推送、未合并 Git；未修改本地数据库实例。

### 测试

- Copilot 定向测试：25/25 通过，覆盖认证、RBAC、严格 JSON、unknown field、标量类型、factKey、事实校验、上下文摘要、null Mapper 防御、状态迁移、stale、并发 accept、超时、模型失败和无 support message 副作用。
- 最终完整命令 `mvn -pl java-user -am -DargLine=-Djdk.net.unixdomain.tmpdir=D:/Project/omni/runtime test` 通过：`java-common 30`、`java-ai-core 34`、`java-user 332`，共 396 项，0 failures、0 errors。
- `git diff --check` 与 `check-production-split-sql.ps1` 通过；`verify-microservice-boundaries.ps1` 的 service boundary 通过，但 cross-owner FK 阶段因本阶段禁止更新 `manifest/verifier` 而报告未登记的 `support_ai_suggestion`，该风险已保留。

## 2026-09-16 ⑤-1.1 Copilot Production Split Asset Registration

### 登记范围

- 已将 `support_ai_suggestion` 正式登记到 `sql/production-split/manifest.json` 的 `java-user` owner。
- 已登记 migration `user/20260916_support_ai_copilot.sql`。
- 已将 `support_ai_suggestion` 的完整生产 SQL 字段白名单加入 `check-production-split-sql.ps1`。
- 已将 `support_ai_suggestion` 加入 `check-cross-owner-fks.ps1` 的 `java-user` owner map；`conversation_id -> support_conversation(id)` 与 `agent_id -> "user"(id)` 均识别为同 owner FK。

### 验证

- `check-production-split-sql.ps1`、`check-cross-owner-fks.ps1` 与 `git diff --check` 均通过；`support_ai_suggestion` 的两个 FK 被识别为 `java-user` 同 owner。
- `verify-microservice-boundaries.ps1` 已完成到 cross-owner FK、production split SQL 等阶段，但在既有的 `java-gateway` route index guard 处失败；该失败与本阶段 manifest/verifier 资产登记无关。当前 Gateway 实际 route index 为 `waitlist-service=14`、`grab-service=15`，而 guard 仍要求 `waitlist-service=13`、`grab-service=14`。
- 未修改 Java 业务、Gateway、数据库现有数据、Seata、Finder；未执行数据库迁移，未提交、推送或合并 Git。

## 2026-09-16 Repository Infrastructure：Gateway Route ID Guard

### 修复范围

- 修复 `scripts/check-production-runtime-defaults.ps1` 的 Gateway route guard。
- `waitlist-service` 与 `grab-service` 不再依赖固定 index，改为按 route ID 定位，并严格校验唯一性、Path、URI 与生产环境变量约束。
- 保留现有其他 route guard、生产 `.properties` 覆盖检查、localhost fallback 检查和所有非 Gateway 检查。
- 支持临时 base/prod 配置路径参数，仅用于脚本级 fixture 验证；默认执行仍检查仓库正式 Gateway 配置。

### 根因与边界

- 根因是 `2026-09-15` 合法加入 `ai-ticket-finder` 后，后续 route index 整体后移一位；旧 verifier 未同步，属于 Repository verifier baseline drift。
- 未修改 Gateway route 顺序、Gateway Java、Copilot、Finder、数据库、Seata、Nacos 或任何业务服务；与 Copilot 修改无关。

### 验证

- 当前 route 顺序：`waitlist-service=14`、`grab-service=15`，通过。
- 插入未来 route 导致 index 改变后，route-id guard 仍通过。
- 缺失 route、重复 route、错误 Path、错误生产 URI、生产 localhost fallback 均按预期失败。
- `check-production-split-sql.ps1`、`check-cross-owner-fks.ps1`、`git diff --check` 均通过。
- `verify-microservice-boundaries.ps1` 在设置临时 `JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=D:/Project/omni/runtime` 后完整通过；未设置该 JVM 参数时，当前 Windows/JDK 环境仍会在 `java-ai-core` 的 `AiHttpLifecycleTest` 触发既有 loopback 初始化失败。

## 2026-09-16 ⑤-2 Copilot Backend Real Ollama E2E

### 接管与旧进程处理

- 8081 原占用 PID 为 `28868`，进程名 `java.exe`，父进程 PID `13588` 为 IDEA `idea64.exe`，窗口标题 `omni`。
- WMI 未返回旧进程 CommandLine，`jcmd` attach 返回 `拒绝访问`；通过 `http://localhost:8081/api/user/cs/sessions` 返回 java-user 客服接口未认证响应交叉确认该端口为 java-user 服务。
- 已按要求只停止旧 java 子进程 `28868`，未停止 IDEA 主进程、PostgreSQL、Nacos、Ollama、Seata、Gateway 或其他 Java 业务服务。
- 停止后 `netstat -ano | findstr ":8081"` 无输出，确认 8081 已释放。
- 因当前 IDEA RunManager 配置缺少本次要求的 `SEATA_ENABLED` 与 `-Djdk.net.unixdomain.tmpdir`，且 IDE UI 未提供可用的自动操作入口，使用同一 `com.omni.user.UserApplication` 的最新 clean package jar 启动等价运行配置；未修改 IDEA 或项目配置文件。
- `mvn -pl java-user -am -DskipTests clean compile` 与 `mvn -pl java-user -am -DskipTests package` 均通过；7 个 Copilot 目标 class 时间戳为 `2026-09-16 18:53:28/29`。
- 新 java-user PID 为 `32872`，启动日志显示 `UserApplication`、`prod-split`、Tomcat `8081`、Nacos `java-user 10.150.195.38:8081 register finished` 和 `Started UserApplication`。
- 基础无副作用 API `GET /api/user/cs/org-tree` 使用真实 JWT（userId `2019`）返回 HTTP 200 / business code 200；PostgreSQL、JWT、Spring Boot、Nacos 链路正常。
- 真实 RBAC 核对：`"user".id=2019` 启用、`role=support`；`support_account.support_role=support_manager`；`support_manager` 的 `support.ai.use`、`support.ai.review`、`support.conversation.view` 均启用并已关联。
- 源码 mapping 已确认：`/sessions/{sessionId}` 的 `sessionId` 实际是 `support_conversation.id`，不是独立 session 表，也不是自动等于任意 conversation ID；当前准备会话为 `support_conversation.id=988111`。
- 当前真实阻塞：`support_conversation.id=988111` 为 `ASSIGNED`、`assigned_agent_id=2019`、`skill_group_id=1`，但 `cs_skill_group.id=1..3` 的 `leader_user_id` 全部为 NULL，且 2019 不在 `cs_agent_member`。`CsSessionService.requireView()` 对 `support_manager` 仅按 leader 技能组授权，因此 2019 的会话列表为空，直接访问 988111 会被可见范围拒绝。
- 尚未执行真实 Copilot Generate；需要用户确认是否允许仅在本地 `omni_user` 为 E2E fixture 设置 `cs_skill_group.id=1.leader_user_id=2019`，不得修改 RBAC 表结构或 Java 代码。

### 用户授权后的本地测试夹具

- 用户明确允许仅对本地 `omni_user` 测试数据设置 `cs_skill_group.id=1.leader_user_id=2019`，用于本轮 E2E；该关系不是生产权限设计。
- 已临时设置该字段，并在 E2E 完成后立即恢复为 `NULL`。
- `support_conversation.id=988111` 的 stale context 字段已恢复原值；java-user 已停止，8081 已释放，Nacos 中的 `java-user` 实例已注销。

### 真实链路与结果

- 真实链路为 `java-user -> java-ai-core -> Ollama -> Qwen2.5:7b`，没有 mock/offline 降级。
- `2019` 通过真实 RBAC、`support_manager` 角色、`support.ai.use` / `support.ai.review` / `support.conversation.view` 权限及 skill group leader 范围访问 `support_conversation.id=988111`。
- Generate：创建 `support_ai_suggestion.id=12`，状态 `READY`；`model=Qwen2.5:7b`、`prompt_version=v1`、`sourceEvidence` 使用合法 `factKey`，evidence 文本由服务端生成。
- Accept：`READY -> ACCEPTED`。
- Edit：`ACCEPTED -> ACCEPTED_EDITED`；AI 原文保留，人工编辑文本单独保存。
- Reject：`support_ai_suggestion.id=13`，`READY -> REJECTED`。
- stale message：`support_ai_suggestion.id=14` 生成后，使用原客服发送链路新增普通 `support_message.id=988244`；Accept 返回 HTTP `409`，旧草稿变为 `EXPIRED`。
- stale context：`support_ai_suggestion.id=15` 生成后改变会话升级事实；Accept 返回 HTTP `409`，旧草稿变为 `EXPIRED`。
- stale message 测试中新增的 1 条普通客服消息是显式测试动作；Copilot 本身没有新增 `support_message`，也没有调用客服发送方法。
- AI 只写入 `support_ai_suggestion`；Accept 仅接受草稿，最终发送仍走原客服发送链路。

### 失败路径与副作用

- 已验证非法 `factKey`、事实冲突、LLM 超时/不可用分别进入预期失败路径；失败不暴露模型原始异常或旧草稿内容。
- 测试期间未触发订单、支付、退款、票务、座位锁定、库存修改、抢票或候补业务；相关表无新增或更新。
- 本轮真实 Generate 耗时约 `11.0s`、`8.6s`、`2.7s`、`3.5s`、`4.0s`；当前代码没有独立持久化 context preparation time。

### 本轮最小修复

- `support_ai_suggestion.missing_information` 与 `source_evidence` 为 `NOT NULL`，首次插入传入 `NULL` 会导致 HTTP 500；已在 `SupportAiSuggestion` 中提供可持久化默认值。
- `AiResponse.model` 原先未写入 `support_ai_suggestion.model`，导致 READY 记录模型为空；已补齐 DTO 字段并在 `SupportCopilotService` 持久化。
- 未修改生产权限设计；未提交、未推送、未合并 Git。

### 本轮验证记录

- `SupportCopilotServiceTest`：`10/10` 通过。
- Copilot 定向测试：`SupportCopilotContextServiceTest`、`SupportCopilotFactValidatorTest`、`SupportCopilotSchemaTest`、`SupportCopilotServiceTest` 共 `18/18` 通过。

## 2026-09-16 ⑤-3 Copilot B 端客服工作台前端接入

### 实现范围

- 复用现有 `frontend/src/app/console/customer-service/sessions/page.tsx`，未新建平行客服工作台；`/console/support-conversations` 兼容跳转保持不变。
- 新增 `SupportCopilotPanel`，负责 Generate、Accept、READY 编辑快捷入口、Edit 保存、Reject、409 过期、502 事实校验失败、503 AI 不可用和事实依据展示。
- `frontend/src/lib/api.ts` 仅在现有 `request<T>()` 基础设施上新增四个 Copilot API 方法，未修改底层请求封装。
- `frontend/src/types/api.ts` 按 `CsCopilotSuggestionResponse` Controller Response DTO JSON 增加状态、建议、编辑请求、拒绝请求和事实依据类型；未根据 Entity 猜测字段。
- 工作台新增人工回复编辑区和发送按钮；内部经办备注区保持独立。

### 真实接口与数据流

- Generate：`POST /api/user/cs/sessions/{sessionId}/copilot/suggestions`
- Accept：`POST /api/user/cs/copilot/suggestions/{suggestionId}/accept`
- Edit：`POST /api/user/cs/copilot/suggestions/{suggestionId}/edit`
- Reject：`POST /api/user/cs/copilot/suggestions/{suggestionId}/reject`
- 当前真实 ID 映射沿用已核对实现：`selectedSession.id -> sendSupportMessage(conversationId, content)`；最终发送调用 `/api/user/support/conversations/{id}/messages`。
- Accept/Edit/Reject 和 Copilot 面板均不调用 `/messages`；只有人工点击“发送”才创建普通 `support_message`。
- `READY` 的“编辑”按钮因后端 Edit 只接受 `ACCEPTED`，先执行 Accept 进入人工编辑态；保存修改时才执行 `/edit`，不自动发送。

### 权限、隔离与过期处理

- 前端只有 `permissionCodes` 包含 `support.ai.use` 时显示 Generate；角色名不会自行扩大 Copilot 权限，后端仍是最终边界。
- `selectedSession.id` 变化时清理回复草稿、Copilot suggestion、loading、error 和消息快照；Copilot 异步响应校验请求对应的 session，旧会话响应会丢弃。
- 消息列表 ID 发生变化时提示“会话内容已更新，已有 AI 建议可能已失效”，不清空或覆盖 `replyDraft`，不自动重新生成或发送。
- 409 将当前 suggestion 标记为 `EXPIRED`，禁用旧操作并提供重新生成；重新生成使用当前 session 创建新 suggestion。
- `sourceEvidence` 直接展示后端返回的 `text`，前端不查询数据库、ES 或自行拼接业务事实。

### 验证

- `node --test src/lib/customer-service-workbench.test.ts src/lib/customer-service-copilot.test.ts src/lib/api.test.ts`：`61/61` 通过。
- `node --test src/lib/customer-service-workbench.test.ts src/lib/customer-service-copilot.test.ts`：`17/17` 通过。
- `pnpm typecheck`：通过。
- `pnpm build`：通过，Next.js 16.2.1 生产构建完成。
- `git diff --check`：退出码 `0`；仅显示工作区既有 CRLF 转换提示，无 whitespace error。
- 本轮修改文件定向 ESLint：`0 errors`，仅有 React Hooks 和未使用变量 warning；全量 ESLint 仍有 5 个未涉及本轮文件的既有 error，位于 `src/app/activity/[id]/page.tsx`、`src/app/console/refunds/page.tsx`、`src/components/GlobalDialog.tsx` 和 `src/components/Header.tsx`。
- 本阶段未执行真实浏览器交互或再次调用真实 Copilot 写接口；后端真实 Ollama E2E 已在 ⑤-2 完成。
- 未修改数据库结构、C 端 `/api/user/support/conversations/{id}/messages/stream`、Java Copilot 核心或其他业务链路。
- 未提交、未推送、未合并 Git。

## 2026-09-17 Copilot Phase ⑤-4 完整联调、回归验证与生产前验收

### 验收口径与环境

- 验收日期：`2026-09-17`。
- 验收范围：AI Customer Service Copilot 与 AI Ticket Finder 的本地 / 开发环境真实联调验证；未声明为生产环境验证。
- 运行环境：Windows 本机，`prod-split` 微服务拓扑；Nacos `localhost:8848`，Ollama `localhost:11434`，Gateway `8088`，Frontend `3000`，`java-user` 使用 `-Djdk.net.unixdomain.tmpdir=D:/Project/omni/runtime`。
- 数据库拓扑仍为拆库：`java-user -> omni_user`，`java-ticket -> omni_ticket_split`；未创建新的 migration，未修改 Copilot DB schema。
- 本轮为 E2E 临时将本地 `cs_skill_group.id=1.leader_user_id` 设置为 `2019`，验收收尾恢复为 `NULL`。

### 代码审计

- Copilot 后端调用链确认：`CsCopilotController -> SupportCopilotService -> SupportCopilotContextService -> SupportCopilotFactCatalog / SupportCopilotFactValidator -> AiModelClient -> SupportAiSuggestionMapper`。
- Copilot 后端未直接注入或调用 ticket/order/payment/refund/seat/inventory Mapper，未直接使用 Elasticsearch client；跨服务事实仍来自已有客服上下文聚合。
- Copilot 前端确认：Accept/Edit/Reject 分别只走 `/copilot/suggestions/{id}/accept|edit|reject`；真正发送仍由 `sendSupportMessage(selectedSession.id, replyDraft)` 走原 `/api/user/support/conversations/{id}/messages`。
- AI Ticket Finder 调用链确认：LLM 只负责 intent 与 explanation；ES 负责 candidate recall；PostgreSQL availability 层负责真实可售性；Java 服务负责确定性过滤、排序和 DTO 格式化。

### 构建与测试

- `mvn -pl java-user -am "-DargLine=-Djdk.net.unixdomain.tmpdir=D:/Project/omni/runtime" test`：`java-common 30/30`、`java-ai-core 34/34`、`java-user 333/333`，合计 `397/397`，0 failures，0 errors。
- `powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1`：通过，包含 service boundary、cross-owner FK、production split SQL/runtime guard 与 Java boundary tests。
- `check-production-split-sql.ps1`、`check-cross-owner-fks.ps1`、`check-production-runtime-defaults.ps1`：均通过。
- `node --test src/lib/customer-service-workbench.test.ts src/lib/customer-service-copilot.test.ts src/lib/api.test.ts`：`61/61` 通过。
- `pnpm typecheck`：通过。
- `pnpm build`：通过，Next.js 16.2.1 生产构建完成。
- `git diff --check`：通过；仅有既有 CRLF 转换提示，无 whitespace error。

### Copilot 真实 Ollama E2E

- 测试账号：`2019`；测试客服会话：`988111`；使用真实 JWT、真实 RBAC、真实 `java-user -> java-ai-core -> Ollama` 链路。
- C1 Generate：`support_ai_suggestion.id=16`，`GENERATING -> READY`；DTO 字段包含 `suggestionText`、`summary`、`issueType`、`recommendedAction`、`missingInformation`、`sourceEvidence`、`model`、`promptVersion`。
- C2 Accept：`id=16`，`READY -> ACCEPTED`；未新增 `support_message`，未触发订单、支付、退款、票务、座位或库存写操作。
- C3 人工发送：通过原客服发送链路显式调用 `/messages` 产生 `support_message`；确认不是 Copilot Accept 直接发送。
- C4 Edit：`id=17`，`READY -> ACCEPTED -> ACCEPTED_EDITED`；`suggestionText` 保留原文，`editedText` 保存人工编辑内容，未自动发送。
- C5 Reject：`id=18`，`READY -> REJECTED`；未新增 `support_message`。
- C6 stale message：`id=19`，生成 READY 后新增普通客服消息；Accept 返回 HTTP `409`，状态 `EXPIRED`，重复 Accept 仍失败。
- C7 stale context：`id=20`，生成 READY 后改变 suggestion-relevant context；Accept/Edit 返回 HTTP `409`，状态 `EXPIRED`。
- C8 AI unavailable：临时将 `java-user` 指向不可用 endpoint，Generate 返回 HTTP `503`；最新失败记录为 `FAILED/UNAVAILABLE`，前端映射为“AI 服务暂时不可用，请稍后重试。”，未暴露 stack trace、prompt、token、API key 或模型凭证。
- C9 fact validation：本阶段未重新诱导真实错误模型输出；代码路径与单测覆盖 unknown `factKey` / 事实冲突 -> `502` + `FAILED/INVALID_OUTPUT`，错误事实不会进入 `sourceEvidence`。

### 前端真实 UI 验收

- `/console/customer-service/sessions` 真实页面可见三栏客服工作台：组织树、会话列表、消息展示、内部经办备注、人工回复编辑器、发送按钮和 Copilot Panel。
- 已结束会话切片可见 `988111`；Copilot Panel 可见“AI 智能助手”和“生成 AI 回复建议”。
- 前端会话切换保护已通过源码与定向测试验证：异步 Generate 响应按 session 校验，旧会话响应不写入新会话 UI；切换会话会清理当前 suggestion 与 `replyDraft`。
- 新消息提示逻辑已验证：消息 ID 序列变化时仅提示“会话内容已更新，已有 AI 建议可能已失效”，不自动清空 `replyDraft`、不自动重新生成、不自动发送、不调用 Accept。
- 真实页面点击 Generate 经 Gateway/Frontend proxy 出现 `504`，同一时刻 `java-user` 日志显示 Ollama 调用成功耗时约 `9927ms`；根因为 Gateway 当前 `/api/user/**` route `response-timeout=5000ms`，按本阶段纪律仅记录，不调整 timeout。

### RBAC 与 Skill Group

- `support_manager` 用户 `2019`：具备 `support.ai.use`，skill group leader 临时 fixture 生效，Generate 通过。
- `support_agent` 用户 `2020`：工作台可进入，但对 `988111` 直接 Generate 返回 `403 无权查看该客服会话`。
- `platform_super_admin` 用户 `2002`：Generate 通过。
- 普通用户 `2004`：直接调用 Copilot API 返回 `403 无权限使用客服 AI 助手`。
- 前端仅在 `permissionCodes` 包含 `support.ai.use` 或平台管理员时显示 Generate；最终权限仍以后端为准。

### 微服务边界与生产 SQL

- `verify-microservice-boundaries.ps1` 本轮完整通过；Copilot 与 Finder 未突破现有服务边界。
- `support_ai_suggestion` 已登记在 `sql/production-split/manifest.json` 的 `java-user` owner；`user/20260916_support_ai_copilot.sql` 已包含表、FK、状态 check、JSON check 与索引。
- `check-production-split-sql.ps1` 已登记 `support_ai_suggestion` 字段白名单；`check-cross-owner-fks.ps1` 将其两个 FK 识别为 `java-user` 同 owner。

### 日志安全

- Copilot / AI Core 日志未打印 prompt、完整上下文、Authorization、JWT、API key、supplier key 或敏感凭证；允许字段为 requestId、model、latency、success、stream、result。
- 本轮审计发现既有 `UserService` 登录/注册日志打印完整手机号；这不是 Copilot 新代码引入，但属于日志安全既有风险，记录为 P2/P3。

### AI Ticket Finder 回归

- 查询“帮我找广州的天鹅湖演出，预算700元以内”的 interpret 真实请求返回 HTTP 200 / 业务码 200，解析为 `keyword=天鹅湖`、`city=广州`、`maxPrice=700`。
- search 真实请求返回 HTTP 200 / 业务码 200，但 `results=[]`。
- 根因：fixture `Activity=900028`、`Session=910028` 的开始时间为 `2026-09-16 19:30:00`，验收日期 `2026-09-17` 已过期；ES 仍可召回 `900028`，PostgreSQL availability 层正确过滤已过期场次。
- 结论：Finder 链路无业务边界回归，但指定非空 fixture 已过期，需要后续刷新验收数据。

### 性能观察

- Copilot Generate 在真实 Ollama 下观察到约 `2.7s`、`3.5s`、`4.0s`、`9.9s`、`11.0s` 等波动；首次或长回复可能超过 Gateway 5s route timeout。
- Accept/Edit/Reject 为普通数据库状态迁移，真实观察为亚秒级到低百毫秒级。
- 本阶段未修改 timeout、模型参数或架构。

### 已知问题分类

- P0：无。
- P1：无。未发现越权、AI 直接执行关键业务、Accept 自动发送、stale 绕过或错误事实进入用户回复。
- P2：前端经 Gateway/Next proxy 调用 Copilot Generate 可能因 `/api/user/**` route `response-timeout=5000ms` 返回 `504`，后端真实 Ollama 调用仍成功；本阶段按要求仅记录。
- P2：日志安全既有问题：`UserService` 登录/注册日志打印完整手机号，非 Copilot 新增。
- P3：AI Ticket Finder 指定非空 fixture 已过期，导致 search 结果为空；业务逻辑正确过滤，但验收 fixture 需要更新。
- P3：本机 Playwright wrapper 依赖的 bash 入口不可用；已改用 `npx --package @playwright/cli` 完成真实页面检查。
- P3：全量 ESLint 仍有 5 个未涉及本轮文件的既有 error，沿用 ⑤-3 记录。

### Git 与清理

- 未 commit、未 push、未 merge。
- 本轮收尾恢复本地 E2E fixture：`cs_skill_group.id=1.leader_user_id` 恢复为 `NULL`。
- 本轮启动的 `java-user` 验收进程在完成后停止并释放 `8081`。

## 2026-09-17 AI Phase ⑤-5：AI 网关超时治理 + Finder fixture 刷新 + 最终回归

### Finder fixture 生命周期修复

- 按本地 `prod-split-real-demo` 数据生命周期修复 `sql/seeds/prod-split-real-demo/01-ticket.sql`：`Session=910028` 改为 `CURRENT_DATE + INTERVAL '365 days ...'`，避免验收日期推进后自然过期。
- 未修改 Finder 日期过滤、可售性过滤、ES 查询或 `TicketAvailabilityQueryService` 业务逻辑。
- 执行前确认目标文件属于 `sql/seeds/prod-split-real-demo/`，目标数据库为本机 `omni_ticket_split` / `localhost:5432`。
- 已将 `01-ticket.sql` 应用到 `omni_ticket_split`；抽查 `910028` 为 `2027-09-17 19:30:00`，距离当前日期 365 天。
- 同步修复本地 seed 可执行性问题：`01-ticket.sql` 的 `artist 901010` 缺少 `update_time` 值；`04-user-ops.sql` 删除客服会话前补充清理 `support_ai_suggestion`，避免 Copilot 新表 FK 阻断本地验收 seed 重放。

### Gateway / Frontend Copilot timeout 修复

- Gateway 新增 `support-copilot-service` route，覆盖：
  - `/api/user/cs/sessions/{sessionId}/copilot/suggestions`
  - `/api/user/cs/copilot/suggestions/{suggestionId}/**`
- Copilot route timeout 为 `GATEWAY_SUPPORT_COPILOT_RESPONSE_TIMEOUT_MS:35000`；普通 `/api/user/**` 仍保持 `GATEWAY_DEFAULT_ROUTE_RESPONSE_TIMEOUT_MS:5000`。
- 前端 `generateCsCopilotSuggestion()` 使用专用 `COPILOT_GENERATE_REQUEST_TIMEOUT_MS=35000`；Accept/Edit/Reject 不扩大为长超时。
- 未修改 C 端客服 stream，也未修改普通客服消息发送 timeout。

### 真实 Copilot Generate latency

- Gateway 直连链路：`POST http://localhost:8088/api/user/cs/sessions/988101/copilot/suggestions`，普通客服 `2020`，真实 Ollama，HTTP 200 / 业务码 200，`READY`，耗时 `15063ms`，未出现 504。
- Frontend Next proxy 链路：`POST http://localhost:3000/api/user/cs/sessions/988101/copilot/suggestions`，HTTP 200 / 业务码 200，`READY`，耗时 `6388ms`，未出现前端代理超时。
- Copilot 状态流补充验收：Accept `READY -> ACCEPTED`，Edit `ACCEPTED -> ACCEPTED_EDITED`，Reject `READY -> REJECTED`。

### Finder 非空 search 验收

- 登录用户 `2004` 后调用 Finder：
  - interpret：HTTP 200 / 业务码 200，耗时 `5598ms`，解析为 `keyword=天鹅湖`、`city=广州`、`maxPrice=700`。
  - search：HTTP 200 / 业务码 200，耗时 `9066ms`，返回 `3` 条非空结果。
- 返回结果均为 `activityId=900028`、`sessionId=910028`、`city=广州`、`saleStatus=on_sale`。
- 与 PostgreSQL 真值核对：
  - `920084` 普通票 `240.00`，`session_seat` 可用量 `84`。
  - `920083` A区票 `360.00`，`session_seat` 可用量 `60`。
  - `920082` VIP票 `600.00`，`session_seat` 可用量 `40`。

### 最终回归结果

- `git diff --check`：通过；仅 CRLF 转换提示，无 whitespace error。
- `powershell -ExecutionPolicy Bypass -File scripts/verify-prod-split-real-demo-seed.ps1`：通过。
- `powershell -ExecutionPolicy Bypass -File scripts/check-production-runtime-defaults.ps1`：通过。
- `powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1`：通过。
- `powershell -ExecutionPolicy Bypass -File scripts/check-cross-owner-fks.ps1`：通过。
- `mvn -pl java-gateway -Dtest=GatewayRouteTimeoutConfigTest test`：通过，`6/6`。
- `mvn -pl java-user -am "-DargLine=-Djdk.net.unixdomain.tmpdir=D:/Project/omni/runtime" test`：通过，`397/397`。
- `node --test src/lib/customer-service-workbench.test.ts src/lib/customer-service-copilot.test.ts src/lib/api.test.ts`：通过，`62/62`。
- `pnpm typecheck`：通过。
- `pnpm build`：通过。
- `powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1`：首次在 Windows 本机因 `java-ai-core` 测试 JVM 缺少 loopback 临时目录参数失败；使用 `$env:JAVA_TOOL_OPTIONS='-Djdk.net.unixdomain.tmpdir=D:/Project/omni/runtime'` 后重跑通过，包含 Java boundary tests。

### 已知问题分类

- P0：无。
- P1：无。
- P2：`verify-microservice-boundaries.ps1` 在 Windows 环境需要给测试 JVM 注入 `-Djdk.net.unixdomain.tmpdir=D:/Project/omni/runtime`，否则 `AiHttpLifecycleTest` 可能出现 `Unable to establish loopback connection`。
- P2：日志安全既有问题仍存在：`UserService` 登录/注册日志打印完整手机号，非本阶段新增。
- P3：本地 `prod-split-real-demo` seed 需要覆盖 Copilot 新表后的清理顺序，本阶段已修复 `04-user-ops.sql`。

### Git 与运行态

- 未 commit、未 push、未 merge。
- 本阶段为本地真实验收启动/重启了 `java-user:8081` 与 `java-gateway:8088`；前端 `3000` 保持可访问。

## 2026-09-17 Phase ⑥：最终系统验收与论文证据

### 1. 系统最终架构

Omni 当前采用 B 端主导、C 端参与的在线票务平台架构。前端使用 Next.js，统一通过 `request<T>()` 调用 Next.js proxy；proxy 将 `/api/**` 转发到 `java-gateway:8088`。Gateway 通过 Nacos 发现 Java 服务，Java 服务按数据归属访问各自 PostgreSQL 数据库，跨服务业务协作通过带 `X-Internal-Token` 的 internal API 完成。

当前 `prod-split` 拓扑如下：

| 服务 | 运行职责 | 数据库或基础设施 |
|:---|:---|:---|
| `java-user` | 用户、认证、RBAC、主办方、客服工作台、Copilot | `omni_user` |
| `java-ticket` | 活动、场馆、场次、票档、座位、库存、搜索、Finder | `omni_ticket_split`、Elasticsearch |
| `java-order` | 订单、订单快照、座位、电子票、转赠、核验 | `omni_order` |
| `java-payment` | 支付、支付宝同步、退款、对账 | `omni_payment` |
| `java-notification` | 站内通知和投递记录 | `omni_notification` |
| `grab-service` | 抢票、团队抢票、候补、幂等、补偿 | `omni_grab`、Redis、RabbitMQ |
| `java-gateway` | 路由、服务发现入口、超时和诊断日志 | 不连接业务数据库 |
| `frontend` | C 端、B 端、客服工作台、AI Finder 页面 | Next.js proxy |

`omni_ticket` 只保留为历史共享库、迁移源或 local-schema disposable 实验库。当前票务运行库为 `omni_ticket_split`。Production Split manifest 的迁移源仍为 `omni_ticket`，ticket 服务目标库已改为 `omni_ticket_split`。

### 2. 主要模块

- 用户与权限模块负责登录、注册、用户资料、主办方账号、客服账号、角色权限、技能组范围和操作审计。
- 票务模块负责活动、艺人、巡演、场馆、场次、票种、座位图、库存、活动搜索和票务管理。
- 订单模块负责创建订单、订单快照、座位锁定、确认售出、电子票、转赠和现场核验。
- 支付模块负责支付发起、支付宝同步、退款审核和对账；真实支付或退款的外部副作用不在本阶段重复触发。
- 抢票模块负责 Redis hold、Lua 原子操作、排队、团队策略、候补和补偿任务。
- 客服工作台复用 `support_conversation`、`support_message`、`support_conversation_note` 等客服域数据，并通过 `SupportCopilotPanel` 提供 AI 草稿审核入口。

### 3. AI Ticket Finder

Finder 的实际调用链为：

`自然语言 -> TicketIntentParser -> Elasticsearch candidate recall -> PostgreSQL availability truth -> Java 确定性筛选/排序 -> TicketResultFormatter -> 前端`

AI 只负责自然语言意图解析和结果解释。Elasticsearch 负责候选召回；Java 票务服务从 PostgreSQL 读取场次、票档、价格、库存和售卖状态，并执行日期、城市、预算、可售性和排序规则。Finder 不创建订单、不锁座、不支付、不退款，也不修改库存。

前序真实本地联调记录：

- 查询：`帮我找广州的天鹅湖演出，预算700元以内`。
- `interpret` 返回 HTTP 200，解析为 `keyword=天鹅湖`、`city=广州`、`maxPrice=700`，观察耗时 `5598ms`。
- `search` 返回 HTTP 200 和 3 条非空结果，观察耗时 `9066ms`。
- 结果均对应 `activityId=900028`、`sessionId=910028`、城市 `广州`、`saleStatus=on_sale`。
- PostgreSQL 可售性真值为：`920084` 普通票 `240.00`、可用 `84`；`920083` A 区票 `360.00`、可用 `60`；`920082` VIP 票 `600.00`、可用 `40`。

本阶段重新执行 `verify-prod-split-real-demo-seed.ps1`，确认 `910028` 仍为未来场次，活动数量为 `120`，海报数量不少于 `120`。未修改 Finder 的日期过滤、ES 查询或库存真值逻辑。

### 4. AI Customer Service Copilot

Copilot 后端调用链为：

`CsCopilotController -> SupportCopilotService -> SupportCopilotContextService -> SupportCopilotFactCatalog/SupportCopilotFactValidator -> AiModelClient -> SupportAiSuggestionMapper`

核心接口为：

- `POST /api/user/cs/sessions/{sessionId}/copilot/suggestions`
- `POST /api/user/cs/copilot/suggestions/{suggestionId}/accept`
- `POST /api/user/cs/copilot/suggestions/{suggestionId}/edit`
- `POST /api/user/cs/copilot/suggestions/{suggestionId}/reject`

Copilot 状态机为：

`GENERATING -> READY -> ACCEPTED -> ACCEPTED_EDITED`

失败或终止状态包括 `REJECTED`、`EXPIRED` 和 `FAILED`。真实本地 Ollama 联调已验证：

- Generate 创建 `support_ai_suggestion`，由 `GENERATING` 进入 `READY`。
- Accept 将 `READY` 变为 `ACCEPTED`，不创建 `support_message`。
- Edit 保存人工修改内容，将 `ACCEPTED` 变为 `ACCEPTED_EDITED`，保留原始 AI 文本。
- Reject 将新的 `READY` 建议变为 `REJECTED`。
- 新消息或上下文事实变化后，旧建议 Accept/Edit 返回 HTTP `409`，状态变为 `EXPIRED`。
- AI 不可用时返回 HTTP `503`，失败记录为 `FAILED/UNAVAILABLE`，前端显示中文错误提示。
- 非法 `factKey` 或事实冲突进入事实校验失败路径，返回 HTTP `502` 并记录 `FAILED/INVALID_OUTPUT`；错误事实不会进入 `sourceEvidence`。

Copilot 只写入 `support_ai_suggestion`。人工点击 Accept 只接受草稿，人工编辑只保存修改；最终消息仍由工作台调用 `sendSupportMessage(selectedSession.id, replyDraft)` 写入 `support_message`。因此 `Accept != Send`。

当前实现使用客服上下文、服务端事实目录和事实校验。仓库中的知识库或 RAG 基础能力不被本阶段描述为 Copilot 每次回答的强制依赖，不能据此声称所有 Copilot 回复均经过 RAG。

### 5. AI 与业务边界

| AI 模块 | AI 负责内容 | Java/业务服务负责内容 | 是否允许业务写操作 |
|:---|:---|:---|:---|
| AI Ticket Finder | 意图解析、自然语言条件提取、结果解释 | ES 候选召回、PostgreSQL 可售性、价格、日期、库存、确定性排序和 DTO | 不允许创建订单、锁座、支付、退款或改库存 |
| Customer Service Copilot | 回复草稿、摘要、问题类型、推荐动作、事实引用建议 | 会话可见性、事实目录、事实校验、状态机、人工审核和消息发送 | 只允许写 `support_ai_suggestion`，不直接写 `support_message` |

源码审计未发现 Finder 或 Copilot 直接注入 ticket/order/payment/refund/seat/inventory Mapper，也未发现 AI 直接调用订单、支付、退款、座位锁定或库存修改方法。

### 6. RBAC

Copilot 使用 `support.ai.use` 控制 Generate，使用 `support.ai.review` 控制 Accept/Edit/Reject；会话访问仍由 `CsSessionService.requireVisibleConversation` 按角色、技能组和会话归属判断。平台管理员沿用平台级权限，但普通用户不能通过前端隐藏或直接调用 API 绕过后端检查。

真实本地权限验收记录：

| 身份 | 验收结果 |
|:---|:---|
| `support_manager` 测试账号 `2019` | 在临时本地技能组 leader 夹具下可 Generate、Review；夹具已恢复 |
| `support_agent` 测试账号 `2020` | 可进入工作台，但访问不在其技能组范围的会话返回 `403` |
| `platform_super_admin` 测试账号 `2002` | Copilot Generate 通过 |
| 普通用户测试账号 `2004` | Copilot API 返回 `403` |

本地 E2E 曾临时设置 `cs_skill_group.id=1.leader_user_id=2019` 以覆盖主管技能组范围，测试结束后恢复为 `NULL`。没有为测试永久改变权限模型。

### 7. Skill Group

技能组树由 `cs_skill_group`、`cs_agent_member` 和会话的 `skill_group_id` 组成。树节点统计、会话分页、公共待认领池、坐席本人范围、主管技能组范围和平台管理员全局范围由服务端计算。前端将组织树筛选转换为服务端过滤参数，不在客户端自行扩大可见范围。

### 8. Elasticsearch

普通活动搜索和 Finder 候选召回都使用 `ElasticsearchActivitySearchProvider`。`ActivitySearchProperties` 要求 Elasticsearch，搜索服务没有恢复 PostgreSQL 或内存过滤 fallback。搜索索引变更通过 RabbitMQ 事件传递，消费者执行幂等 upsert/delete，失败进入 retry queue 和 DLQ。PostgreSQL 不承担搜索接口，但承担活动详情、票档、库存和座位等业务真值。

### 9. PostgreSQL 与 Production Split

当前目标数据库为：

| 服务 | 数据库 |
|:---|:---|
| `java-user` | `omni_user` |
| `java-ticket` | `omni_ticket_split` |
| `java-order` | `omni_order` |
| `java-payment` | `omni_payment` |
| `java-notification` | `omni_notification` |
| `grab-service` | `omni_grab` |

`support_ai_suggestion` 归属 `java-user`，迁移文件为 `sql/production-split/user/20260916_support_ai_copilot.sql`，已登记到 manifest。新增的 `sql/production-split/grab/001_same_owner_constraints.sql` 补回 grab 服务内部外键和索引。此前运行 verifier 发现的 `activity_artist`、SeatCraft 版本表和风险恢复表 manifest 遗漏也已补齐。

本阶段最终验证结果：

- `check-production-split-sql.ps1`：通过。
- `check-cross-owner-fks.ps1`：7 个历史 cross-owner FK、131 个 same-owner FK、1 个 legacy FK，清单通过。
- `verify-production-split-runtime.ps1`：`user/ticket/order/payment/notification/grab` 分别通过 `25/51/8/1/0/4` 个 FK 检查；目标库包括 `omni_ticket_split`。
- `check-production-runtime-defaults.ps1`：通过，生产 profile 的 token、密码、Nacos、Seata、ES、RabbitMQ、Alipay、Gateway 和前端 proxy 配置均通过守护检查。
- `verify-prod-split-real-demo-seed.ps1`：通过，活动 `120` 条，海报不少于 `120` 张。

本阶段没有执行生产数据库 cutover，没有删除生产 FK，没有执行新的数据库 migration，也没有把 `sql/local/*` 纳入生产链路。

### 10. Redis / MQ

- Redis 由 `grab-service` 用于库存 hold、幂等键、用户 hold、座位 hold 和抢票状态。
- RabbitMQ 用于搜索索引事件、支付/业务通知和抢票异步队列；消费者使用幂等处理和失败队列。
- Seata 用于订单、票务、支付核心跨服务写链路；各服务通过自己的数据源注册 RM，不通过跨库 Mapper 实现业务协作。

本阶段以既有实现记录、配置守护、边界测试和 Java 单测作为证据，未进行压测或大规模并发吞吐实验。

### 11. Gateway

Gateway 不连接业务数据库。当前保留专用长超时路由：

- `ai-ticket-finder` 匹配 `/api/ticket/ai/finder/**`，默认响应超时 `35000ms`。
- `support-copilot-service` 匹配 Copilot 四类接口，默认响应超时 `35000ms`。
- 普通 `/api/user/**` 和 `/api/ticket/**` 仍使用默认 `5000ms`，避免把所有业务请求无差别延长。
- 客服消息流使用独立 stream route，普通人工发送链路没有改为 Copilot 长超时。

`GatewayRouteTimeoutConfigTest` 最终为 `6/6`，覆盖 route 顺序、路径、URI 和 timeout 配置。

### 12. Ollama

客服 Copilot 的本地真实链路为 `java-user -> java-ai-core -> Ollama -> Qwen2.5:7b`。AI Core 对请求取消、超时、HTTP 错误、空结果、JSON 错误、SSE 错误和不可用状态进行统一映射。日志只保留 `requestId`、模型名、耗时、成功标记、stream 标记和结果分类，不记录 prompt、完整客服上下文、JWT、Authorization、API key 或供应商密钥。

### 13. 测试环境

- 操作系统：Windows 本机。
- 运行 profile：`prod-split`。
- PostgreSQL：本机 `localhost:5432`，使用六个服务数据库。
- Gateway：`8088`；前端：`3000`；Nacos：`8848`；Ollama：`11434`；Redis：`6379`；RabbitMQ：`5672`。
- 前端 Node 版本满足项目 `>=24` 要求。
- Windows 测试 JVM 需要设置 `-Djdk.net.unixdomain.tmpdir=D:/Project/omni/runtime`，以避免部分 AI Core boundary test 的 loopback 初始化问题。

测试证据来自源码审计、PowerShell 守护脚本、Maven 单元测试、Node 测试、前端 typecheck/build 和前序本地真实 API 联调。支付、退款、座位锁定、库存修改等不可逆动作没有在本阶段主动触发。

### 14. 测试方法

1. 使用源码搜索核对 Finder、Copilot、Mapper、Repository、Entity、internal API 和业务写操作边界。
2. 使用生产拆库、cross-owner FK、运行时默认值和 demo seed 脚本检查配置、资产和数据库现状。
3. 使用 Maven 和 Node 测试覆盖状态机、异常映射、权限、事实校验、前端 API 路径和工作台交互状态。
4. 使用本地真实 Ollama、Gateway、Frontend proxy 和 PostgreSQL 记录 Finder/Copilot 的实际请求结果和耗时。
5. 对支付、退款、库存和座位等有外部副作用的动作只采用已有测试和只读数据证据，不重复触发真实写操作。

### 15. 测试结果

| 测试项 | 结果 |
|:---|:---|
| Java `mvn -pl java-user -am ... test` | `397/397`，0 failures，0 errors |
| Frontend 定向 Node tests | `62/62`，0 failures |
| `GatewayRouteTimeoutConfigTest` | `6/6` |
| `pnpm exec tsc --noEmit` | PASS |
| `pnpm build` | PASS，Next.js `16.2.1`，静态页面 `54/54` |
| `verify-microservice-boundaries.ps1` | PASS |
| `check-production-split-sql.ps1` | PASS |
| `check-cross-owner-fks.ps1` | PASS |
| `verify-production-split-runtime.ps1` | PASS，六个服务均完成 runtime FK 检查 |
| `check-production-runtime-defaults.ps1` | PASS |
| `verify-prod-split-real-demo-seed.ps1` | PASS |
| `git diff --check` | PASS，无 whitespace error；仅有 CRLF 转换提示 |
| 全量 `pnpm lint` | FAIL，5 个既有 error、218 个 warning，未涉及本阶段新增 Copilot 文件 |

全量 lint 的 5 个 error 位于 `src/app/activity/[id]/page.tsx`、`src/app/console/refunds/page.tsx`、`src/components/GlobalDialog.tsx` 和 `src/components/Header.tsx`，规则类型为 React purity、`prefer-const` 和 `react/no-unescaped-entities`。本阶段没有扩大到无关页面修复。

### 16. 异常测试

| HTTP 或状态 | 验证内容 | 结果 |
|:---|:---|:---|
| `400` | 参数校验、非法请求和业务前置条件 | 既有 Java/Frontend 测试通过 |
| `403` | 普通用户 Copilot、技能组范围和会话隔离 | 真实权限联调和测试通过 |
| `409` | 新消息或上下文变化后的 stale Accept/Edit | 真实联调返回 `409`，状态为 `EXPIRED` |
| `502` | Copilot 事实字段非法或事实冲突 | FactCatalog/FactValidator 测试和服务失败路径通过 |
| `503` | Ollama/AI 服务不可用 | 真实不可用 endpoint 联调通过，状态为 `FAILED/UNAVAILABLE` |
| `504` | AI 请求超出普通 Gateway 路由超时 | 已通过 Finder/Copilot 专用 `35000ms` route 治理；⑤-5 真实请求未再出现该问题 |

事实校验的非法模型输出本阶段没有再次诱导真实模型产生；当前结论来自源码路径和定向单测，不把未重新测量的场景写成新的真实采样。

### 17. 权限测试

- `support.ai.use` 控制 Generate，`support.ai.review` 控制审核动作。
- `support_manager` 需要同时满足角色权限和技能组 leader 可见范围。
- `support_agent` 不能访问不属于本人或其技能组范围的会话。
- `platform_super_admin` 可按平台权限访问 Copilot。
- 普通用户直接调用 Copilot API 返回 `403`。
- 前端只根据后端返回的 `permissionCodes` 显示 Generate，后端仍是最终授权边界。

### 18. 安全测试

- 新增 internal API 继续要求 `X-Internal-Token`；生产运行默认值检查要求通过环境变量注入 token、数据库密码、JWT secret、Nacos、Seata、RabbitMQ、Elasticsearch 和 Alipay 配置。
- AI 日志不记录 prompt、完整客服上下文、Authorization、JWT、API key、supplier key 或模型凭证。
- Finder/Copilot 不直接越过订单、支付、退款、票务和库存服务执行关键动作。
- `support_ai_suggestion` 的事实引用经过白名单 FactCatalog 和 FactValidator 校验。
- 已发现既有 `UserService` 登录/注册日志打印完整手机号；该问题不是 Copilot 本阶段引入，列为 P2。

### 19. 性能观察

本项目当前只有本地开发环境采样，没有形成 P95、P99、QPS、吞吐量或长期成功率结论。

已记录的真实观察值：

| 链路 | 观察值 |
|:---|:---|
| Finder interpret | `5598ms` |
| Finder search | `9066ms` |
| Copilot Gateway Generate | `15063ms` |
| Copilot Frontend proxy Generate | `6388ms` |
| Copilot Generate 其他 Ollama 样本 | 约 `2.7s`、`3.5s`、`4.0s`、`9.9s`、`11.0s`，存在模型和回复长度波动 |
| Copilot Accept/Edit/Reject | 本地观察为亚秒级到低百毫秒级，未形成统计样本 |

### 20. 已知问题

- P0：无。
- P1：无。未发现越权、AI 直接执行关键业务、Accept 自动发送、stale 绕过或错误事实进入用户回复。
- P2：`UserService` 登录/注册日志仍打印完整手机号，属于既有日志安全问题。
- P2：Windows 环境执行包含 AI Core boundary test 的完整边界脚本时，需要注入 `-Djdk.net.unixdomain.tmpdir=D:/Project/omni/runtime`。
- P3：全量 ESLint 仍有 5 个未涉及本阶段文件的既有 error 和 218 个 warning。
- P3：本机 Playwright wrapper 的 bash 入口不可用，真实页面检查使用 `npx --package @playwright/cli` 完成。

Finder fixture 生命周期、Gateway/Copilot timeout 和 Production Split `grab` runtime 覆盖缺口已在本阶段或前序阶段修复，不列为当前未解决问题。

### 材料 A：系统模块表

| 模块 | 职责 | 核心技术 | 主要服务 |
|:---|:---|:---|:---|
| 用户与认证 | 登录、注册、资料、用户资产 | Spring Boot、PostgreSQL、JWT | `java-user` |
| RBAC 与客服 | 角色、权限、技能组、会话、审计 | RBAC、Skill Group、PostgreSQL | `java-user` |
| 票务管理 | 活动、场馆、场次、票档、座位、库存 | Spring Boot、PostgreSQL、Seata | `java-ticket` |
| 活动搜索 | 关键词搜索、筛选、排序、索引 | Elasticsearch、RabbitMQ | `java-ticket` |
| 订单与电子票 | 下单、订单快照、出票、转赠、核验 | Spring Boot、PostgreSQL、Seata | `java-order` |
| 支付与退款 | 支付、同步、退款审核、对账 | Alipay、PostgreSQL、RabbitMQ | `java-payment` |
| 通知 | 站内通知和投递 | RabbitMQ、PostgreSQL | `java-notification` |
| 抢票与候补 | 排队、hold、幂等、候补、补偿 | NestJS、Redis Lua、RabbitMQ、PostgreSQL | `grab-service` |
| AI Ticket Finder | 意图解析、候选召回、可售性筛选、解释 | Ollama、Elasticsearch、PostgreSQL | `java-ticket`、Gateway、Frontend |
| Customer Service Copilot | 客服建议、事实引用、人工审核 | Ollama、FactCatalog、RBAC | `java-user`、Gateway、Frontend |

### 材料 B：AI 能力对比表

| AI 模块 | 输入 | AI 负责内容 | Java 负责内容 | 输出 | 是否允许业务写操作 |
|:---|:---|:---|:---|:---|:---|
| Ticket Finder | 用户自然语言找票条件 | Intent、条件提取、解释 | ES candidate recall、数据库真值、筛选排序 | 票务结果 DTO 和解释 | 否 |
| Customer Service Copilot | 当前客服会话和服务端事实 | 草稿、摘要、问题类型、推荐动作 | 上下文权限、事实校验、建议状态、人工发送 | `support_ai_suggestion` 和人工最终消息 | 仅写建议，不直接写 `support_message` |

### 材料 C：Copilot 状态机

```text
GENERATING
  -> READY
  -> FAILED

READY
  -> ACCEPTED
  -> REJECTED
  -> EXPIRED
  -> FAILED

ACCEPTED
  -> ACCEPTED_EDITED
  -> EXPIRED

ACCEPTED_EDITED
  -> EXPIRED
```

`EXPIRED` 由 stale message 或 stale context 触发；`FAILED` 记录不可用模型、超时或结构化输出/事实校验失败。

### 材料 D：AI Ticket Finder 流程

```text
自然语言
  -> TicketIntentParser
  -> Elasticsearch 候选召回
  -> PostgreSQL availability truth
  -> Java 确定性筛选与排序
  -> TicketResultFormatter
  -> Frontend
```

### 材料 E：Copilot 流程

```text
客服会话
  -> Context
  -> Fact Catalog
  -> Ollama
  -> Structured Output
  -> Fact Validation
  -> Suggestion
  -> Human Review
  -> 人工 Send
  -> support_message
```

### 材料 F：最终测试结果

| 证据 | 结果 |
|:---|:---|
| Java 用户域及依赖模块 | `397/397` |
| Frontend 客服工作台、Copilot、API 定向测试 | `62/62` |
| Gateway route timeout | `6/6` |
| Frontend typecheck | PASS |
| Frontend production build | PASS，静态页面 `54/54` |
| Microservice boundary verifier | PASS |
| Production Split SQL/FK/runtime/defaults/seed | PASS |
| `git diff --check` | PASS |
| Full ESLint | FAIL，5 个既有 error，218 个 warning |

### Phase ⑥ 结论

在 Windows 本地 `prod-split` 环境中，Omni 已形成可运行的在线票务平台和两条边界清晰的 AI 辅助链路。Finder 将 AI 限制在意图和解释层，将可售性和业务真值交给 Elasticsearch、PostgreSQL 与 Java；Copilot 将 AI 输出限制为客服建议，经过事实校验和人工审核后才由原客服发送链路写入 `support_message`。本阶段结论为 PASS，但不等同于生产 cutover 完成，也不代表已完成性能压测或消除所有历史工程质量问题。

### 2026-09-18 前端 AI 功能产品化完善（工程记录）

- C 端入口：首页轻量入口、Header 顶部导航、Header 搜索旁入口、搜索无结果辅助入口、活动详情辅助入口，统一跳转 `/ai/ticket-finder`。
- Finder：增加快捷示例、Enter 提交与 Shift+Enter 换行、用户可见的理解/查找阶段文案、无结果调整建议，以及 404/429/500/502/503/504 错误映射。
- 购票跳转：继续使用既有 `activityId + sessionId + ticketTypeId` 详情链接；详情页既有合法 session 优先、跨 session ticket 回退逻辑未修改。
- Copilot：面板标题改为“AI 客服 Copilot”，明确“AI 草稿，人工确认后发送”，采用建议仍只填充人工回复编辑区，人工 `sendSupportMessage()` 链路未改变。
- 验证：Finder/Copilot/详情预选/搜索相关 Node 测试 `42/42` 通过；`pnpm typecheck` 通过；`pnpm build` 通过，静态页面 `54/54`；`pnpm lint` 无 error，保留仓库既有 warning。
- 浏览器：桌面和 390x844 移动视口已验证首页入口、Header 菜单、Finder 初始状态、快捷示例填充和空输入提示。因本地后端未启动，真实 Finder 三条结果、活动详情预选和登录后的 Copilot 会话闭环未在本次运行中复现。
- 本记录仅记录工程实现与验收偏离，不涉及毕业论文或开题报告整理。

### 2026-09-18 Seata 本地注册地址治理

- 根因证据：四个目标 Java `application-prod-split.yml` 只配置 Nacos Registry/Config、`SEATA_GROUP`、`omni_tx_group` 和 `default` cluster，没有写入 `10.150.195.38`；旧地址同时出现在运行中 `omni-seata` 的 `SEATA_IP`、Nacos `SEATA_GROUP@@seata-server` 实例和 `seataServer.properties` 的 `service.default.grouplist`。
- 当前网络：宿主机有效 IPv4 为 `10.150.206.83`；`127.0.0.1:8091` 虽通过 `Test-NetConnection`，但 Seata 1.6.1 Docker 实测向 Nacos 注册为容器地址 `172.18.0.7:8091`，宿主机 Java 通过 Nacos 发现后不可用，因此不能把回环地址作为最终注册方案。
- 修复：保留并强化宿主机非回环 IPv4 自动探测；`start-seata-docker.ps1` 增加 Nacos 注册收敛校验，并将一次性 `seata-config-init` 改为 `docker compose run --rm`，避免脚本挂在 attached one-shot 容器；`refresh-seata-advertise-host.ps1` 继续在网络变化后按当前主 IPv4 触发重建。
- 防漂移：Seata 重建后脚本会同步 Nacos 配置中心、校验 `SEATA_GROUP@@seata-server` 仅保留当前有效实例，并输出 Docker/Nacos/注册地址/端口/健康/注册表/连通性结果；不需要修改四个 Java 服务的 `application.yml`。
- 偏离说明：本轮先验证了 `127.0.0.1`，随后因 Nacos 实例证据回退到非回环自动探测方案；未修改订单、支付、票务、库存、AI 或 Seata 事务业务逻辑。
- 最终验收：`omni-seata` 为 `running/healthy`；Nacos `SEATA_GROUP@@seata-server` 仅保留 `10.150.206.83:8091` 且 `healthy=true/enabled=true`；`seataServer.properties` 的 `service.vgroupMapping.omni_tx_group=default` 与 `service.default.grouplist=10.150.206.83:8091` 已生效。Seata 日志确认 `java-order`、`java-payment`、`java-ticket` 的 TM/RM 注册成功，RM 资源分别为 `omni_order`、`omni_payment`、`omni_ticket_split`；Java 回归测试和微服务边界验收均通过。
