# Implementation Notes

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
