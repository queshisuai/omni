# 大麦迁移体验改进进度

## 2026-06-02 客服工作台队列与 SLA 优化
- 按推荐优先级完成第一轮客服优化：客服工作台改为待处理、处理中、超时、已申请结束、已关闭五组；客服账号只展示公共池未接入会话和自己名下会话，管理员记录页保留全量查看。
- 后端 `support_conversation` 新增首次响应截止、首次人工回复、最后用户消息、最后人工回复 SLA 字段；响应对象返回用户等待秒数和超时标记。
- 前端补充 SLA 工具函数和类型：队列计数、超时优先排序、首次响应/用户等待/最后回复中文文案。
- SQL 分库 manifest 登记 `user/20260602_support_workbench_sla.sql`，并补齐生产 SQL 校验脚本的 `support_account` 与客服 SLA 字段白名单；修正校验脚本对 `ON CONFLICT ... DO UPDATE SET` 的误判。
- 验证：`node --test frontend/src/lib/support-tools.test.ts` 16 个测试通过；`cd frontend && npm run typecheck` 通过；`cd java && mvn -pl java-user "-Dtest=CustomerSupportServiceTest" test` 24 个测试通过；`powershell -ExecutionPolicy Bypass -File scripts\check-production-split-sql.ps1` 通过；`git diff --check` 退出 0，仅提示 CRLF 换行转换警告。

## 2026-06-01 消息铃 / 消息中心业务入口补强
- 消息铃与消息中心统一使用通知类型元数据和业务动作映射：候补、小队抢票、订单、客服、风控/待办消息可直接跳转到对应订单、候补、客服会话或后台处理页。
- 按产品反馈去掉“来自哪个服务/服务来源”展示，前端动作对象只保留跳转地址和按钮文案，避免用户看到技术服务归属。
- `java-user` 接入 `java-notification` 内部通知接口，人工客服回复用户时写入 `SUPPORT_REPLY` 消息；通知发送失败不会阻断客服回复落库。
- `java-user` 补齐 OpenFeign 与内部接口令牌配置，支持 IDEA 启动 user 服务时通过 Nacos 调用通知服务。

## 2026-06-01 消息铃 / 消息中心验证记录
- `node --test frontend/src/lib/activity-actions.test.ts frontend/src/components/notification-state.test.ts frontend/src/lib/personalized-recommendations.test.ts frontend/src/lib/console-paths.test.ts frontend/src/lib/subscription.test.ts frontend/src/lib/support-tools.test.ts frontend/src/lib/console-orders.test.ts frontend/src/lib/marketing-tools.test.ts frontend/src/lib/search-experience.test.ts`：37 个测试通过。
- `cd frontend && npm run typecheck`：通过。
- `cd java && mvn -pl java-user,java-order test`：`java-user` 63 个测试通过，`java-order` 193 个测试通过。
- `git diff --check`：通过，仅有工作区换行符将按 Git 配置转换为 CRLF 的提示。

## 2026-06-01 候补通知 / 客服记录 / 浏览记录二次修正
- 修正活动详情顶部动作：已开售活动不再展示“开售提醒”，顶部移除“候补提醒”；候补只在用户选中无票票档时于购票区展示“加入候补”。
- 将 `WAITLIST_OFFERED`、`WAITLIST_EXPIRED`、`WAITLIST_PAID` 统一归类为消息中心里的“候补通知”，消息铃和消息通知页共用同一套通知类型元数据。
- 补浏览记录闭环：活动详情写入标题、海报、艺人、城市和浏览时间；新增 `/history` 页面；Header 用户菜单新增“浏览记录”入口。
- 补平台管理员客服会话记录：`SupportConversationResponse` 新增用户昵称和脱敏手机号；新增 `/console/support-conversations` 只读会话记录页；后台侧边栏和快捷入口加入“客服会话记录”。
- 人工客服工作台会话列表和详情头部展示用户昵称或脱敏手机号，便于区分不同用户。
- 修正按钮对齐：票夹“领取转赠”区域改为图标、输入框、按钮三列对齐；活动详情购买/候补操作区改为稳定高度和移动端换行布局。
- 搜索空结果和订阅兼容文案去掉“候补提醒”误导，旧 `WAITLIST_REMINDER` 兼容显示为“候补通知”。

## 2026-06-01 候补通知 / 客服记录 / 浏览记录验证记录
- `node --test frontend/src/lib/activity-actions.test.ts frontend/src/components/notification-state.test.ts frontend/src/lib/personalized-recommendations.test.ts frontend/src/lib/console-paths.test.ts frontend/src/lib/subscription.test.ts frontend/src/lib/support-tools.test.ts`：21 个测试通过。
- `cd java && mvn -pl java-user "-Dtest=CustomerSupportServiceTest" test`：5 个测试通过。
- `cd frontend && npm run typecheck`：通过。
- `cd java && mvn -pl java-user test`：62 个测试通过。
- `git diff --check`：通过，仅提示工作区换行符将按 Git 配置转换为 CRLF。

## 2026-06-01

- 恢复上下文并读取 `task_plan.md`、`progress.md`、`findings.md`、`git status` 和 `git diff --stat`。
- 确认当前主工作区已有未提交改动：实名证件号加密相关代码、既有文档草稿和规划文件。
- 用户要求按 P0/P1/P2 完成大麦迁移体验计划；已将根目录 `task_plan.md` 重写为新的执行计划。
- 当前执行切片：P0-A 票夹后端闭环，先做电子票建模、支付后出票、我的票夹、动态入场码和核销接口。
- 接续完成 P2：新增 `activity_marketing_rule` 营销规则表、Java 营销配置 API、前端 `/console/activities/[id]/marketing` 页面和活动列表“营销”入口。
- 扩展平台运营驾驶舱：`AdminSummaryResponse` 新增热门活动、订单/支付超时、退款/风控指标；grab-service 新增 `/api/grab/admin/ops-summary` 返回抢票失败原因和候补转化。
- 启动 P3 大麦对比增量体验：先补帮助中心/在线客服、搜索历史与移动端底部导航。
- 新增用户服务客服闭环：FAQ、可选本地大模型 AI 客服、项目规则兜底回复、客服会话/消息记录、人工客服接入/关闭、平台管理员客服账号创建与注销。
- 新增前端客服入口：`/help` 帮助中心与在线客服、`/support` 人工客服工作台、`/console/support-accounts` 平台客服账号管理、登录后 `support` 角色直达客服工作台。
- 新增搜索体验：搜索历史、热门搜索、联想组合；Header 城市选择写入本地状态并联动首页/搜索筛选。
- 新增移动端底部 Tab： 首页 / 分类 / 票夹 / 我的。
- 新增评价/评分/问答闭环：`java-ticket` 提供活动评价列表、评分统计、提交评价、问答列表和提问接口；活动详情页展示评分概览、评价和问答入口。
- 新增个性化推荐：活动详情写入浏览信号，首页按最近浏览的品类、艺人、城市生成“猜你喜欢”。
- 新增订单详情页：`/orders/[id]` 展示订单状态、履约时间线、活动/票档/实名观演人、电子票入口和退款时间线。
- 修复新增客服与评价问答生产 SQL 校验：补齐 owner 注释，并把 `support_conversation`、`support_message`、`activity_review`、`activity_question` 加入分库 SQL 安全检查白名单。
- 补齐本地大模型客服适配层：新增 Ollama 兼容 HTTP 客户端，默认关闭；启用后会把 Omni 项目规则作为系统提示词传给本地模型，失败时自动回落到规则回复。
- 修复 `java-user` 启动失败：`OllamaSupportLocalModelClient` 有生产构造器和测试构造器，Spring 未明确构造器时会尝试无参构造；现已给生产构造器标记 `@Autowired` 并增加 Spring 容器回归测试。
- 修复本地启动配置问题：`java-user` 在 `prod-split` 下启动需要 `OMNI_ID_NO_KEY`，而 PowerShell/Maven 不会自动读取 `.env`；`start-project.ps1` 现在会静默加载根目录 `.env`，并在本地开发缺省时设置 `OMNI_ID_NO_KEY`。

## 验证记录

- `mvn -pl java-ticket test`：589 个测试通过。
- `node --test frontend/src/lib/marketing-tools.test.ts frontend/src/lib/api.test.ts`：16 个测试通过。
- `cd frontend && npm run typecheck`：通过。
- `cd nestjs/grab-service && .\node_modules\.bin\jest.cmd --runInBand src/grab/grab-ops.service.spec.ts src/grab/grab.service.spec.ts src/waitlist/waitlist.service.spec.ts`：29 个测试通过。
- `cd nestjs/grab-service && npm run build`：通过。
- `powershell -ExecutionPolicy Bypass -File scripts\check-production-split-sql.ps1`：通过。
- `cd java && mvn -pl java-user "-Dtest=SupportAiServiceTest,SupportAccountServiceTest,CustomerSupportServiceTest" test`：10 个测试通过。
- `node --test frontend/src/lib/support-tools.test.ts frontend/src/lib/search-experience.test.ts`：6 个测试通过。
- `cd frontend && npm run typecheck`：通过。
- `powershell -ExecutionPolicy Bypass -File scripts\check-production-split-sql.ps1`：通过。
- `node --test frontend/src/lib/orders-experience.test.ts frontend/src/lib/personalized-recommendations.test.ts frontend/src/lib/support-tools.test.ts frontend/src/lib/search-experience.test.ts frontend/src/lib/api.test.ts`：22 个测试通过。
- `cd frontend && npm run typecheck`：通过。
- `cd java && mvn -pl java-user,java-ticket test`：`java-user` 54 个测试通过，`java-ticket` 594 个测试通过。
- `cd java && mvn -pl java-order test`：187 个测试通过。
- `cd nestjs/grab-service && .\node_modules\.bin\jest.cmd --runInBand src/grab/grab-ops.service.spec.ts src/grab/grab.service.spec.ts src/waitlist/waitlist.service.spec.ts`：29 个测试通过。
- `cd nestjs/grab-service && npm run build`：通过。
- `cd java && mvn -pl java-user "-Dtest=SupportAiServiceTest,CustomerSupportServiceTest,OllamaSupportLocalModelClientTest" test`：10 个测试通过。
- `cd java && mvn -pl java-user test`：58 个测试通过。
- `powershell -ExecutionPolicy Bypass -File scripts\check-production-split-sql.ps1`：通过。
- `cd java && mvn -pl java-user "-Dtest=OllamaSupportLocalModelClientTest#springCanCreateClientBeanWithoutDefaultConstructor" test`：先复现无参构造失败，修复后 1 个测试通过。
- `cd java && mvn -pl java-user test`：59 个测试通过。
- `powershell` 解析 `start-project.ps1`：语法通过。
- `cd java && mvn -pl java-user "-Dtest=LocalSchemaRuntimeConfigTest,UserAttendeeServiceTest" test`：7 个测试通过。

## 2026-06-01 新增功能二次检查

- 读取现有计划、发现和进度文件，确认此前 P0/P1/P2/P3 均标记完成，但本地运行环境仍需要按真实用户路径复核。
- 复查 Windows PostgreSQL：`privacy_audit_log`、`support_conversation`、`support_message`、`electronic_ticket`、`ticket_transfer`、`performance_subscription`、`activity_marketing_rule`、`activity_review`、`activity_question` 已存在。
- 接口烟测通过：`/api/user/attendees`、`/api/order/tickets`、`/api/ticket/subscriptions`、`/api/ticket/subscriptions/calendar`、`/api/user/help/faqs`、`/api/user/support/conversations/my`、`/api/ticket/admin/activities/1/marketing`、`/api/ticket/admin/summary`、`/api/grab/admin/ops-summary`、`/api/user/support/admin/accounts`、`/api/user/support/agent/conversations` 均返回 HTTP 200。
- 发现并修复客服账号注销缺口：`UserService.login(...)` 现在会拒绝 `status=0` 的停用账号，避免已注销人工客服继续登录。
- 发现并修复票夹历史数据缺口：新增 `sql/production-split/order/20260601_electronic_ticket_backfill.sql`，对已有已支付订单幂等回填电子票；本地执行后 `electronic_ticket` 从 0 条回填到 5 条，普通用户票夹可看到 3 张电子票。
- 复测票夹核心操作：`/api/order/tickets` 返回电子票；入场码生成、转赠发起、转赠撤回均返回 HTTP 200。
- 发现并修复退款履约缺口：全额退款/部分退款会把未使用电子票标记为已失效，防止退款后仍可入场。
- 继续补前端体验层：新增通用骨架屏组件，替换票夹、搜索结果、营销工具和后台主要页面的关键加载态。
- 补搜索空结果推荐：接口返回空结果时追加一次放宽筛选的真实活动查询，在空结果页展示相关演出和相邻城市入口。
- 补 B 端订单批量能力：后台订单页新增勾选、选择本页、导出所选、导出当前筛选 CSV，导出内容只包含脱敏观演人信息。
- 补平台驾驶舱图表化：热门活动和抢票失败原因改为 CSS 条形图，保留候补转化率、支付超时率、退款异常率、风控命中率。
- 补人工客服工作台筛选：按处理中、已结束、全部分组会话，避免历史会话干扰待处理队列。

## 2026-06-01 新增功能二次检查验证记录

- `cd java && mvn -pl java-user "-Dtest=UserServiceTest#loginRejectsDeactivatedUserBeforeCheckingCredential" test`：先失败复现停用账号仍可登录；修复后 1 个测试通过。
- `cd java && mvn -pl java-order "-Dtest=TicketWalletServiceTest#invalidateRefundedOrderMarksUnusedTicketsInvalid+invalidateRefundedSeatsMarksSelectedSeatTicketsInvalid+invalidateRefundedQuantityMarksFirstUnusedTicketsInvalid" test`：3 个测试通过。
- `cd java && mvn -pl java-order "-Dtest=OrderPartialRefundServiceTest#markPartialRefundedRefundsSelectedSeatAndKeepsOrderPaid+markRefundedInvalidatesElectronicTicketsForOrder+quantityOnlyRefundPersistsProgressAndReducesRefundOptions" test`：3 个测试通过。
- `node --test frontend/src/lib/console-orders.test.ts frontend/src/lib/marketing-tools.test.ts frontend/src/lib/search-experience.test.ts frontend/src/lib/support-tools.test.ts`：先失败复现缺少新增工具函数；实现后 17 个测试通过。
- `cd frontend && npm run typecheck`：通过。
- `git diff --check`：通过，仅提示工作区换行符将按 Git 配置转换为 CRLF。
- `powershell -ExecutionPolicy Bypass -File scripts\check-production-split-sql.ps1`：通过。
- `cd java && mvn -pl java-user,java-order test`：`java-user` 61 个测试通过，`java-order` 193 个测试通过。

## 2026-06-01 主办方 / 平台管理员路径复核

- 读取当前计划、发现和工作区状态，确认本轮只补主办方/管理员路径一致性和前端角色入口，不回滚既有未提交功能改动。
- 使用平台管理员 `13800000001 / 123456` 和主办方 `13800000002 / 123456` 分别登录，确认 `/api/user/login` 返回角色为 `admin`、`organizer`。
- 角色化接口烟测：管理员概览、活动、巡演草稿、场次、订单、退款、场馆、审核、客服账号、运营驾驶舱均返回业务 `code=200`；主办方概览、活动、巡演草稿、场次、订单、退款、场馆记录、我的场馆资料、风险待办均返回业务 `code=200`。
- 权限拒绝烟测：主办方访问入驻审核、客服账号管理、风险案例、站点变更审核、场馆审核均返回业务 `403`；访问 `grab-service` 管理员驾驶舱返回 HTTP 403，符合预期。
- 修正前端路径入口：管理员侧边栏新增“巡演草稿管理”，主办方侧边栏新增“巡演草稿”和“场馆记录”；后台首页快捷操作改为按 `admin` / `organizer` 输出不同入口。
- 新增 `frontend/src/lib/console-paths.ts`，集中维护后台角色路径允许规则和快捷操作；`console/layout.tsx` 接入统一路径拦截，主办方直达管理员专属页时回到 `/console`。
- 新增 `frontend/src/lib/console-paths.test.ts` 覆盖主办方允许路径、管理员专属路径拒绝、管理员路径放行和角色化快捷入口。

## 2026-06-01 主办方 / 平台管理员路径复核验证记录

- `node --test frontend/src/lib/console-paths.test.ts`：3 个测试通过。
- `cd frontend && npm run typecheck`：通过。
- 角色化 API 烟测复跑：管理员 9 条主路径均返回 `code=200`；主办方 9 条主路径均返回 `code=200`；主办方访问 6 条管理员专属路径返回业务 `403` 或 HTTP 403。
- `node --test frontend/src/lib/console-paths.test.ts frontend/src/lib/console-orders.test.ts frontend/src/lib/marketing-tools.test.ts frontend/src/lib/search-experience.test.ts frontend/src/lib/support-tools.test.ts`：20 个测试通过。
- `cd frontend && npm run typecheck`：通过。
- `git diff --check`：通过，仅提示工作区换行符将按 Git 配置转换为 CRLF。
