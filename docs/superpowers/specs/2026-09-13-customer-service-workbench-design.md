# 客服技能组树与三栏工作台设计

**日期：** 2026-09-13  
**状态：** 方案 A 已实现；2026-09-13 负载树与用户历史轨迹整改已获批准  
**范围：** `omni_user` 迁移、`java-user` 客服 Façade、`java-ticket` 只读订单上下文接口、Next.js 三栏工作台

## 1. 目标与边界

将现有后台客服会话记录从扁平列表重构为客服技能组树、会话队列、聊天流和业务画像组成的三栏工作台，同时保留现有 C 端在线客服链路。

数据归属保持不变：

- `java-user / omni_user`：客服会话、消息、技能组、坐席关联、内部备注、客服质检和操作审计。
- `java-ticket / omni_ticket_split`：订单及票务数据，只通过只读后台接口返回最近订单摘要。
- `frontend`：只通过 `src/lib/api.ts` 的 `request<T>()` 请求服务，不缓存或复制订单明细。

本轮不新建平行的 `cs_session`、`cs_message` 数据域，不恢复动态/Moment 相关代码，不在任何 `java-user` Mapper 或 SQL 中访问 `omni_ticket_split`。

## 2. 现状复用

当前客服模型已经具备：

- `support_conversation`：用户、状态、来源、当前坐席、最后消息和 SLA 时间字段。
- `support_message`：`USER`、`AI`、`AGENT`、`SYSTEM` 消息。
- `support_conversation_note`：内部备注。
- `support_conversation_audit`：转接、升级、关闭等会话事件。
- `support_account`：客服账号和 `support_agent` / `support_manager` 业务角色。
- `operation_audit_log`：跨后台操作审计。

实现以新增 `CsSessionService` 为控制台 Façade 的领域编排层，底层仍复用已有实体 Mapper 和 `CustomerSupportService` 可复用的校验/消息转换逻辑。旧 `/api/user/support/*` 接口继续服务 C 端和现有客服入口，不改其请求结构。

当前页面实际路由为 `/console/support-conversations`。新规范路由为 `/console/customer-service/sessions`，新页面作为唯一实现；旧路由保留兼容别名，侧边栏切换到新路由。

## 3. 数据模型与迁移

新增迁移：

`sql/production-split/user/20260913_customer_service_tree_and_audit.sql`

迁移只连接 `omni_user`，不包含 `omni_ticket_split`、跨库外键或票务 SQL。

### 3.1 技能组

`cs_skill_group`：

- `id BIGSERIAL PRIMARY KEY`
- `group_code VARCHAR(64) UNIQUE NOT NULL`
- `group_name VARCHAR(128) NOT NULL`
- `leader_user_id BIGINT`
- `status SMALLINT NOT NULL DEFAULT 1`
- `create_time`、`update_time`，默认 `CURRENT_TIMESTAMP`

插入幂等基础组：

- `AI_DISPATCH`：AI 分流中心
- `TICKET_REFUND`：票务退改与咨询组
- `DISPUTE_COMPLAINT`：演出纠纷与客诉二线组

### 3.2 坐席关联

`cs_agent_member`：

- `id BIGSERIAL PRIMARY KEY`
- `group_id BIGINT NOT NULL REFERENCES cs_skill_group(id)`
- `user_id BIGINT NOT NULL`
- `agent_name VARCHAR(64) NOT NULL`
- `agent_status SMALLINT NOT NULL DEFAULT 1`
- `UNIQUE (group_id, user_id)`

`user_id` 不建立跨服务外键；用户实体仍由 `omni_user.user` 负责，服务层校验用户是否为有效客服账号。

### 3.3 会话增量字段

在 `support_conversation` 增加：

- `skill_group_id BIGINT`
- `sla_timeout_flag BOOLEAN NOT NULL DEFAULT FALSE`

`skill_group_id` 不建跨表外键，避免历史会话导入和技能组软停用时增加不必要的删除约束。应用层校验技能组启用状态。

历史数据不强制猜测业务技能组。查询时：

- `source_type=AI` 且 `skill_group_id IS NULL` 归入逻辑节点 `AI_DISPATCH`。
- `WAITING_AGENT` 且无坐席的会话归入公共待认领池。
- 其他未归组历史会话归入“未归组会话”兜底节点，避免数据消失。

### 3.4 质检记录

`cs_session_audit`：

- `id BIGSERIAL PRIMARY KEY`
- `session_id BIGINT NOT NULL`
- `auditor_user_id BIGINT NOT NULL`
- `score INT NOT NULL CHECK (score BETWEEN 1 AND 5)`
- `comments TEXT`
- `is_resolved BOOLEAN NOT NULL DEFAULT TRUE`
- `create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`

建立 `session_id, create_time DESC` 索引。该表保存主管质检结果；转接、升级和认领等操作仍写入既有 `operation_audit_log`，并继续保留 `support_conversation_audit` 的会话时间线记录。

### 3.5 权限种子

迁移增加幂等权限定义 `cs.manage` 和 `cs.review`，不擅自修改现有角色授权：

- `cs.manage`：组织树全量查看、强制转接、升级工单、质检写入。
- `cs.review`：查看待质检队列和质检历史。
- `support.conversation.view`：普通客服进入工作台，服务端仍按“本人会话 + 公共待认领池”限制数据范围。

为兼容现有数据，`support_manager` 和平台超管的既有有效角色仍视为管理范围；新权限配置由 RBAC 管理页后续授予。

## 4. 后端接口设计

### 4.0 负载树统计与用户历史轨迹整改

组织树所有计数严格基于当前登录人的 RBAC 可见会话集合，避免树与中间流水线使用不同口径：

- `activeCount`：可见且状态不是 `CLOSED` 的会话数。
- `totalCount`：可见且状态为 `CLOSED` 的历史会话数。
- 普通客服的可见集合只包含本人已分配会话和公共待认领池，因此其 `totalCount` 只统计 `assigned_agent_id = 当前用户 ID` 的已办结会话；公共池仅影响待办计数，不扩大历史归档权限。
- 客服主管的可见集合限定在其管辖技能组；平台超管或 `cs.manage` 全局管理权限可查看全平台，包括历史未归组会话。
- 根节点、技能组节点和坐席节点均返回 `activeCount` 与 `totalCount`；前端统一展示为“待办 / 结单”，不再以单一计数代表两种状态。

中间栏数据源仍按 `support_conversation.id` 单条记录进行服务端分页，避免改变既有查询协议；页面拿到当前页后按 `userId` 做一次轻量聚合。每个用户在当前页只渲染一张主卡片，主卡片默认折叠，展开后列出该用户在当前页的会话子条目；点击子条目才切换右侧聊天会话。`ACTIVE` 只查询未结单，`CLOSED` 只查询已结单流水；跨页用户可能在不同页分别出现，完整历史通过右侧用户历史轨迹接口查看。

新增 `GET /api/user/cs/users/{userId}/sessions-history`，按 `created_at DESC, id DESC` 返回该用户在当前登录人 RBAC 范围内的历次会话摘要：

- `sessionId`
- `createdAt`
- `agentName`
- `category`
- `status`
- `closedAt`
- `closeReason`

该接口仅用于右侧用户全历史轨迹按需加载，不参与主列表 SQL、不改变选中会话的聊天消息范围。

### 4.1 认证与权限

`CsController` 仍位于 `java-user`，从 Bearer JWT 解析当前用户 ID，通过 `RbacService` 读取有效权限。

权限规则：

- 普通客服：只能查询分配给自己的会话，以及 `WAITING_AGENT` 且 `assigned_agent_id IS NULL` 的公共池。
- `support_manager`、平台超管或具备 `cs.manage`：查询授权范围内的技能组和会话，可认领、转接、升级和质检。
- `cs.review`：可查看 `NEED_AUDIT` 队列和质检历史；质检保存按规格书严格要求 `cs.manage`。
- 非客服用户直接返回 `403`。

所有写操作在服务层再次校验会话可见性、目标技能组/坐席状态和当前状态，不能只依赖前端按钮隐藏。

### 4.2 组织树

`GET /api/user/cs/org-tree`

返回 `CsOrgTreeVO`：

- 根节点：全平台未结束数、公共池数、公共池超时数。
- AI 分流中心：AI 独立解决数、AI 转人工数。
- 技能组节点：组 ID、编码、名称、主管、会话计数。
- 坐席节点：坐席 ID、姓名、在线状态、当前接待数量。

聚合全部在 `omni_user` 内完成。在线状态读取 `cs_agent_member.agent_status`，不把内存中的帮助页 presence 当作持久在线状态。

### 4.3 会话分页

`GET /api/user/cs/sessions`

参数：

`groupId`, `agentId`, `status`, `slaTimeoutOnly`, `keyword`, `page`, `size`

服务层将外部状态转换为旧状态：

- `ACTIVE`：`OPEN`、`WAITING_AGENT`、`ASSIGNED`、`CLOSE_REQUESTED`
- `CLOSED`：`CLOSED`
- `NEED_AUDIT`：已关闭且没有对应 `cs_session_audit` 记录

查询使用 MyBatis-Plus `Page` 分页，关键字限制为用户昵称、用户 ID、主题和最后消息。普通客服的可见性条件在 SQL 条件中组合，不通过全量查询后再过滤。

`CsSessionVO` 至少包含：

- 会话 ID、用户 ID、昵称、脱敏手机号
- 当前状态和来源
- 技能组、主管、坐席摘要
- 最后消息、更新时间、创建时间
- `slaTimeoutFlag`、等待秒数、最后用户消息时间
- 质检待办标识、最新评分、是否已升级工单

排序支持 `latest`、`sla_waiting`、`audit_score` 三种白名单值，禁止把前端任意字段拼进 SQL。

### 4.4 消息、备注和操作

- `GET /api/user/cs/sessions/{sessionId}/messages`：复用 `support_message`，按 `id ASC` 返回。
- `POST /api/user/cs/sessions/{sessionId}/claim`：公共池认领，写入坐席、状态 `ASSIGNED`、系统事件和 `operation_audit_log`。
- `POST /api/user/cs/sessions/{sessionId}/transfer`：要求 `targetGroupId`、`targetAgentId`、非空 `transferNote`；事务内更新技能组/坐席/来源状态，插入 `SYSTEM` 消息和会话审计，并写 `CS_SESSION_TRANSFER`。
- `POST /api/user/cs/sessions/{sessionId}/escalate`：标记疑难工单，复用现有升级字段，写系统事件和 `CS_SESSION_ESCALATE`。
- `POST /api/user/cs/sessions/{sessionId}/audit`：要求 `cs.manage`；校验 `score 1..5`，写 `cs_session_audit` 和 `CS_SESSION_QUALITY_AUDIT`。
- `POST /api/user/cs/sessions/{sessionId}/internal-note`：复用 `support_conversation_note`，内容非空且不超过 500 字。

审计字段：

- `target_type=cs_session`
- `target_id=sessionId`
- `target_ref=会话编号`
- `operator_role=RbacService` 返回的有效角色
- `reason=转接附言/升级原因/质检评语`
- `result=操作结果`

审计写入与业务变更处于同一 `omni_user` 事务；审计写入失败时事务回滚，不允许返回“操作成功但无审计”。

### 4.5 SLA

服务层按现有 `first_response_due_at`、`last_user_message_at`、`last_agent_message_at` 计算当前等待时长：

- 3 分钟内：正常。
- 超过 3 分钟且仍未响应：预警。
- 超过 10 分钟：超时。
- `CLOSED`：不再显示待响应超时。

列表查询和会话动作都会刷新 `sla_timeout_flag`。已有自动闭单逻辑继续以 30 分钟无交互为准，并通过 `SYSTEM` 消息展示关闭原因。

## 5. 票务订单上下文

当前代码库没有 `GET /api/ticket/admin/orders/user-recent-context`，现有后台订单接口不接受任意用户 ID。因此在 `java-ticket` 增加只读接口：

`GET /api/ticket/admin/orders/user-recent-context?userId={userId}`

约束：

- 只查询 `omni_ticket_split` 自有表和既有订单快照。
- 仅允许平台超管、客服主管或具备客服查看权限的后台用户。
- 返回最近 1~2 笔待观演/已出票订单摘要：活动名、场次、票档/座位、订单号、履约状态。
- 不把订单实体复制到 `omni_user`。
- 不新增 `java-user` 到 `java-ticket` 的跨库 Mapper 或 SQL join。

前端在会话详情加载成功后，以 `userId` 异步加载该接口。请求失败、超时或返回空数据时只显示“暂无近期订单”，不会清空会话、消息或组织树状态。

## 6. 前端工作台

### 6.1 路由和权限

- 新页面：`frontend/src/app/console/customer-service/sessions/page.tsx`
- 旧页面：`frontend/src/app/console/support-conversations/page.tsx` 保留兼容入口，复用新页面实现。
- `console/layout.tsx` 菜单改为新路由。
- `console-auth.ts` 同时识别新旧路径，新路由至少要求 `support.conversation.view`，页面内根据 `permissionCodes` 控制管理动作。

### 6.2 三栏布局

页面根节点使用 `h-full min-h-0 flex overflow-hidden`，并通过 ConsoleLayout 的主区域让工作台占满可用高度：

- 左栏 `w-[252px] shrink-0`：组织树、客服搜索、公共池红黄超时数字。
- 中栏 `w-[320px] shrink-0`：状态切片、排序下拉、服务端分页列表。
- 右栏 `min-w-0 flex-1`：会话元数据、聊天流和 300px 业务画像侧栏。

在窄视口下三栏改为纵向可滚动区，保证内容不被压缩到不可读宽度；常规 1080P/2K 保持固定左中栏和自适应右栏。

### 6.3 数据流

1. 页面挂载：并行请求 `org-tree` 和第一页 `sessions`。
2. 点击树节点：更新筛选状态并重置页码，服务端重新请求会话列表。
3. 点击会话：请求消息、备注/质检摘要和订单上下文；订单上下文使用独立错误边界。
4. 认领/转接/升级/备注/质检成功：刷新当前会话、当前列表和必要的组织树计数。
5. 刷新按钮和轻量轮询只更新左中栏与当前消息，不覆盖正在编辑的备注或弹窗草稿。

### 6.4 交互与文案

- 所有用户可见提示、错误和按钮文案使用中文。
- 未选择会话时展示明确 Empty State，不渲染空白聊天区。
- 用户消息左对齐白底；AI 消息使用浅紫；人工消息使用品牌色；系统消息居中小标签。
- 聊天气泡内容限制为 `max-w-lg`，不允许宽屏无限拉伸。
- 转接弹窗必须选择目标技能组、目标坐席并填写非空转接附言。
- 质检面板提供 1~5 星、是否解决和质检评语，保存按钮只对主管可用。
- 订单接口失败时只显示占位，不把失败提示冒泡成整页错误。

## 7. 测试设计

### 7.1 `java-user`

新增 `CsSessionServiceTest`，先写失败测试再实现，至少覆盖：

1. 组织树根节点、公共池超时计数、技能组和坐席会话数聚合。
2. 普通客服只能看到本人会话和公共待认领会话。
3. 管理权限可以按技能组、坐席、状态和 SLA 查询。
4. 普通客服认领公共会话后写入坐席和状态。
5. 转接要求附言，成功后写目标技能组、坐席、系统消息和 `CS_SESSION_TRANSFER`。
6. `cs.manage` 才能质检；普通客服返回 `403` 且不写 `cs_session_audit`。
7. 质检分数范围校验和 `CS_SESSION_QUALITY_AUDIT` 审计。
8. 内部备注非空校验和消息可见性。

保留并运行现有 `CustomerSupportServiceTest`、`SupportContextServiceTest` 和客服控制器相关测试。

### 7.2 `java-ticket`

新增订单上下文控制器/服务测试：

- 支持客服后台权限按 `userId` 查询最近摘要。
- 非后台用户拒绝访问。
- 只返回 1~2 笔摘要，不暴露跨库字段。

### 7.3 前端

新增纯函数/API 结构测试，覆盖：

- 新旧路由权限映射。
- 树节点筛选参数和 `ACTIVE/CLOSED/NEED_AUDIT` 请求映射。
- SLA 标签的绿/黄/红状态。
- 订单上下文失败降级不影响消息状态。
- 转接、质检和内部备注请求体字段。

最终执行：

```powershell
cd frontend
pnpm typecheck
```

以及：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-cross-owner-fks.ps1
```

## 8. 实施顺序与回滚边界

1. 先新增并验证 `omni_user` 迁移脚本和实体/Mapper。
2. 以 TDD 实现 `CsSessionService`、DTO 和控制器 Façade。
3. 补齐 `java-ticket` 订单摘要只读接口和测试。
4. 扩展前端 API 类型和请求函数，先替换路由和权限入口。
5. 实现三栏工作台和操作弹窗，再补端到端静态结构检查。
6. 运行 Java 定向测试、前端类型检查和边界脚本。

迁移脚本必须幂等。由于本轮不删除旧表、不改 `support_*` 既有字段语义、不触碰票务库，失败时可以停止新路由并保留旧客服页面；已执行的新增表和字段不通过回滚脚本删除。

## 9. 明确偏离与风险

- 规格书给出的目标页面路径当前不存在，采用新路由实现、旧路由兼容别名。
- 规格书指定的票务订单上下文接口当前不存在，必须在 `java-ticket` 增加只读后台接口；这是满足订单画像验收的必要补充。
- 既有 SLA 首次响应默认是 5 分钟，本轮工作台按需求显示 3 分钟预警、10 分钟超时，并保留 30 分钟自动闭单逻辑。
- 质检写入按详细规格要求严格使用 `cs.manage`；`cs.review`用于查看待质检数据和历史，平台超管继续具备全部权限。
- 不自动给现有角色分配新权限，避免迁移改变生产 RBAC 行为；需要启用新管理动作时由权限配置完成授权。
