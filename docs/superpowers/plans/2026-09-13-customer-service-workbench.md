# 客服技能组树与三栏工作台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不破坏现有 C 端客服链路的前提下，完成客服技能组树、服务端分页队列、质检审计、订单画像和三栏式后台工作台的全栈落地。

**Architecture:** 继续以 `support_conversation` 为会话事实源，在 `omni_user` 增加技能组、坐席关联和质检表；`java-user` 新增 `/api/user/cs/*` 控制台 Façade，负责权限、状态映射、聚合和审计。`java-ticket` 仅新增受权限保护的最近订单摘要接口，前端在右侧画像中异步弱依赖加载。

**Tech Stack:** PostgreSQL migration, Spring Boot, MyBatis-Plus, JUnit 5/Mockito, Next.js App Router, React, TypeScript, Tailwind CSS, Node test runner.

---

## 文件地图

### 新增

- `sql/production-split/user/20260913_customer_service_tree_and_audit.sql`：`omni_user` 增量迁移、索引、基础技能组和权限定义。
- `java/java-user/src/main/java/com/omni/user/entity/CsSkillGroup.java`：技能组实体。
- `java/java-user/src/main/java/com/omni/user/entity/CsAgentMember.java`：坐席关联实体。
- `java/java-user/src/main/java/com/omni/user/entity/CsSessionAudit.java`：质检实体。
- `java/java-user/src/main/java/com/omni/user/mapper/CsSkillGroupMapper.java`、`CsAgentMemberMapper.java`、`CsSessionAuditMapper.java`：MyBatis-Plus Mapper。
- `java/java-user/src/main/java/com/omni/user/dto/Cs*.java`：组织树、分页会话、消息、转接、质检、备注请求/响应 DTO。
- `java/java-user/src/main/java/com/omni/user/service/CsSessionService.java`：控制台客服 Façade 和权限边界。
- `java/java-user/src/main/java/com/omni/user/controller/CsController.java`：`/api/user/cs/*` 控制器。
- `java/java-user/src/test/java/com/omni/user/service/CsSessionServiceTest.java`：客服树、可见性、认领、转接、质检和审计测试。
- `java/java-ticket/src/main/java/com/omni/ticket/dto/AdminRecentOrderContextResponse.java`：订单摘要响应。
- `java/java-ticket/src/main/java/com/omni/ticket/service/AdminOrderContextService.java`：订单上下文查询和后台权限校验。
- `java/java-ticket/src/test/java/com/omni/ticket/service/AdminOrderContextServiceTest.java`：订单上下文接口测试。
- `frontend/src/app/console/customer-service/sessions/page.tsx`：新的三栏客服工作台。
- `frontend/src/lib/customer-service-workbench.ts`：状态映射、SLA 标签、树筛选和权限纯函数。
- `frontend/src/lib/customer-service-workbench.test.ts`：前端工作台纯函数测试。

### 修改

- `java/java-user/src/main/java/com/omni/user/entity/SupportConversation.java`：增加 `skillGroupId`、`slaTimeoutFlag`。
- `java/java-user/src/main/java/com/omni/user/dto/SupportConversationResponse.java`：增加技能组和 SLA 字段，供 Façade 转换。
- `java/java-user/src/main/java/com/omni/user/controller/SupportController.java`：不改变旧接口；如需复用公共解析方法，仅做私有方法提取。
- `java/java-user/src/main/java/com/omni/user/service/CustomerSupportService.java`：只补充必要的可复用状态/事件方法，不改变 C 端行为。
- `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`：增加最近订单上下文 GET 接口。
- `frontend/src/types/api.ts`：新增 `Cs*VO`、`Cs*Request`、订单摘要类型。
- `frontend/src/lib/api.ts`：新增 `/api/user/cs/*` 和 `/api/ticket/admin/orders/user-recent-context` 请求函数，全部走 `request<T>()`。
- `frontend/src/lib/console-auth.ts`：新旧客服路由权限映射。
- `frontend/src/app/console/layout.tsx`：侧边栏客服菜单切换到新规范路由。
- `frontend/src/app/console/support-conversations/page.tsx`：兼容别名，复用新页面实现。
- `implementation-notes.md`：记录实现偏离和验证结果。

## Task 1: 新增 `omni_user` 迁移和 Java 持久化模型

**Files:**

- Create: `sql/production-split/user/20260913_customer_service_tree_and_audit.sql`
- Create: `java/java-user/src/main/java/com/omni/user/entity/CsSkillGroup.java`
- Create: `java/java-user/src/main/java/com/omni/user/entity/CsAgentMember.java`
- Create: `java/java-user/src/main/java/com/omni/user/entity/CsSessionAudit.java`
- Create: `java/java-user/src/main/java/com/omni/user/mapper/CsSkillGroupMapper.java`
- Create: `java/java-user/src/main/java/com/omni/user/mapper/CsAgentMemberMapper.java`
- Create: `java/java-user/src/main/java/com/omni/user/mapper/CsSessionAuditMapper.java`
- Modify: `java/java-user/src/main/java/com/omni/user/entity/SupportConversation.java`
- Test: `scripts/check-production-split-sql.ps1`, `scripts/check-cross-owner-fks.ps1`

- [ ] **Step 1: 写迁移边界测试/静态断言**

在迁移检查前执行以下断言，确保新文件只属于 user 库：

```powershell
$path = 'sql/production-split/user/20260913_customer_service_tree_and_audit.sql'
$sql = Get-Content -Raw $path
if ($sql -match 'omni_ticket_split|java-ticket|REFERENCES .*\.') {
  throw '客服迁移不得包含票务库或跨库引用'
}
if ($sql -notmatch 'cs_skill_group' -or $sql -notmatch 'cs_agent_member' -or $sql -notmatch 'cs_session_audit') {
  throw '客服迁移缺少目标表'
}
```

预期：当前文件不存在，断言失败，证明测试先于实现。

- [ ] **Step 2: 创建幂等迁移**

迁移必须包含：

```sql
ALTER TABLE support_conversation
    ADD COLUMN IF NOT EXISTS skill_group_id BIGINT,
    ADD COLUMN IF NOT EXISTS sla_timeout_flag BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS cs_skill_group (...);
CREATE TABLE IF NOT EXISTS cs_agent_member (...);
CREATE TABLE IF NOT EXISTS cs_session_audit (...);
CREATE UNIQUE INDEX IF NOT EXISTS uk_cs_agent_member_group_user
    ON cs_agent_member(group_id, user_id);
CREATE INDEX IF NOT EXISTS idx_support_conversation_skill_group_status
    ON support_conversation(skill_group_id, status, update_time DESC);
CREATE INDEX IF NOT EXISTS idx_cs_session_audit_session_time
    ON cs_session_audit(session_id, create_time DESC);
```

使用 `INSERT ... ON CONFLICT (group_code) DO UPDATE` 幂等插入 `AI_DISPATCH`、`TICKET_REFUND`、`DISPUTE_COMPLAINT`；权限定义也使用现有 RBAC 表的唯一键口径幂等插入。

- [ ] **Step 3: 运行迁移静态检查并确认失败转为通过**

运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-cross-owner-fks.ps1
```

预期：两个脚本退出码为 `0`，且迁移只被识别为 `java-user` 资产。

- [ ] **Step 4: 添加实体和 Mapper**

三个实体分别使用 `@TableName`、`@TableId(type = IdType.AUTO)` 和 `LocalDateTime` 字段；Mapper 只继承 `BaseMapper<T>`，不写跨服务 SQL。

- [ ] **Step 5: 扩展 `SupportConversation` 并编译 user 模块**

增加：

```java
private Long skillGroupId;
private Boolean slaTimeoutFlag;
```

补齐 getter/setter 后运行：

```powershell
mvn -pl java-user -DskipTests compile
```

预期：编译成功，无新增 Mapper/XML 跨 owner 引用。

## Task 2: `java-user` DTO、权限边界和客服 Façade 测试

**Files:**

- Create: `java/java-user/src/main/java/com/omni/user/dto/CsOrgTreeResponse.java`
- Create: `java/java-user/src/main/java/com/omni/user/dto/CsSessionResponse.java`
- Create: `java/java-user/src/main/java/com/omni/user/dto/CsSessionMessageResponse.java`
- Create: `java/java-user/src/main/java/com/omni/user/dto/CsSessionQuery.java`
- Create: `java/java-user/src/main/java/com/omni/user/dto/CsTransferRequest.java`
- Create: `java/java-user/src/main/java/com/omni/user/dto/CsAuditRequest.java`
- Create: `java/java-user/src/main/java/com/omni/user/dto/CsInternalNoteRequest.java`
- Create: `java/java-user/src/main/java/com/omni/user/service/CsSessionService.java`
- Test: `java/java-user/src/test/java/com/omni/user/service/CsSessionServiceTest.java`

- [ ] **Step 1: 写组织树聚合失败测试**

测试使用 Mockito 注入 `SupportConversationMapper`、`SupportMessageMapper`、`SupportAccountMapper`、`UserMapper`、技能组和坐席 Mapper、`CsSessionAuditMapper`、`RbacService`、`OperationAuditService`，准备：

```java
when(conversationMapper.selectList(any())).thenReturn(List.of(
    conversation(1L, 101L, "WAITING_AGENT", null, 10L, true),
    conversation(2L, 102L, "ASSIGNED", 201L, 10L, false),
    conversation(3L, 103L, "CLOSED", 202L, 20L, false)
));
```

断言根节点未结束数、公共池数、公共池超时数、技能组 10 的坐席接待数均准确。

- [ ] **Step 2: 运行目标测试确认 RED**

```powershell
mvn -pl java-user "-Dtest=CsSessionServiceTest" test
```

预期：编译或测试失败，原因是 `CsSessionService` 和 DTO 尚未存在。

- [ ] **Step 3: 写普通客服可见性和状态映射失败测试**

覆盖：

```java
assertEquals("ACTIVE", service.toConsoleStatus("OPEN", false));
assertEquals("ACTIVE", service.toConsoleStatus("ASSIGNED", false));
assertEquals("CLOSED", service.toConsoleStatus("CLOSED", false));
assertEquals("NEED_AUDIT", service.toConsoleStatus("CLOSED", true));
```

普通客服查询结果只能包含 `assignedAgentId == actorUserId` 或无坐席 `WAITING_AGENT`。

- [ ] **Step 4: 写认领、转接、质检和权限失败测试**

至少包含：

```java
assertThrows(BusinessException.class,
    () -> service.audit(ordinaryAgentId, sessionId, auditRequest(6)));
assertThrows(BusinessException.class,
    () -> service.audit(ordinaryAgentId, sessionId, auditRequest(5)));
assertThrows(BusinessException.class,
    () -> service.transfer(managerId, sessionId, transferRequest("", 20L, 30L)));
```

成功路径验证：

```java
verify(sessionAuditMapper).insert(any(CsSessionAudit.class));
verify(operationAuditService).write(argThat(request ->
    "CS_SESSION_QUALITY_AUDIT".equals(request.getAction())
));
verify(messageMapper).insert(argThat(message ->
    "SYSTEM".equals(message.getSenderType())
));
```

- [ ] **Step 5: 运行测试确认所有新行为 RED**

```powershell
mvn -pl java-user "-Dtest=CsSessionServiceTest" test
```

预期：失败原因集中在缺少服务实现或 DTO，不允许用修改断言的方式消除失败。

## Task 3: 实现 `java-user` 客服 Façade 和控制器

**Files:**

- Modify: `java/java-user/src/main/java/com/omni/user/entity/SupportConversation.java`
- Modify: `java/java-user/src/main/java/com/omni/user/dto/SupportConversationResponse.java`
- Create: `java/java-user/src/main/java/com/omni/user/service/CsSessionService.java`
- Create: `java/java-user/src/main/java/com/omni/user/controller/CsController.java`
- Modify: `java/java-user/src/main/java/com/omni/user/service/CustomerSupportService.java` only when a shared event/helper is necessary
- Test: `java/java-user/src/test/java/com/omni/user/service/CsSessionServiceTest.java`

- [ ] **Step 1: 实现安全的 actor 权限解析**

按以下顺序判定：

1. `RbacService.getInternalAuthContext(actorId)` 返回平台超管：全部管理权限。
2. `permissionCodes` 包含 `cs.manage`：管理范围。
3. `permissionCodes` 包含 `cs.review`：可读质检队列。
4. 角色为 `support` 且 `SupportAccount.supportRole=support_manager`：兼容现有主管范围。
5. 仅有 `support.conversation.view`：普通客服范围。

任何非客服角色直接抛 `BusinessException(ResultCode.FORBIDDEN, "无权限查看客服会话")`。

- [ ] **Step 2: 实现组织树聚合**

从 `cs_skill_group`、`cs_agent_member`、`support_conversation` 批量读取后在 Java 内组装树；坐席会话数按 `ASSIGNED` 且 `assigned_agent_id` 匹配统计；公共池只统计 `WAITING_AGENT` 且坐席为空；超时数使用同一 SLA helper。

- [ ] **Step 3: 实现分页会话查询**

构造 `Page<SupportConversation>` 和白名单 `LambdaQueryWrapper`：

- 角色范围条件先写入 wrapper。
- `groupId`、`agentId`、`keyword`、基础状态条件使用参数绑定。
- `NEED_AUDIT` 通过已关闭会话批量查找 `cs_session_audit` 后排除已质检项。
- 返回 `PageResult<CsSessionResponse>`，不做全量查询后前端分页。

- [ ] **Step 4: 实现消息、认领、转接、升级、质检和备注**

所有写方法使用 `@Transactional`：

- 认领只允许公共池会话，写 `assignedAgentId`、`sourceType=HUMAN`、`status=ASSIGNED`。
- 转接校验目标组启用、目标坐席属于目标组且状态可接待；更新会话并插入 `SYSTEM` 消息、`support_conversation_audit` 和 `operation_audit_log`。
- 升级复用 `escalatedToAdmin`、`escalationReason`，写系统消息和 `CS_SESSION_ESCALATE`。
- 质检校验 `cs.manage`、`score 1..5`，写 `cs_session_audit` 和 `CS_SESSION_QUALITY_AUDIT`。
- 内部备注调用既有 `support_conversation_note`，非空且最长 500 字。

- [ ] **Step 5: 暴露 `/api/user/cs/*`**

控制器端点：

```text
GET  /api/user/cs/org-tree
GET  /api/user/cs/sessions
GET  /api/user/cs/sessions/{id}/messages
POST /api/user/cs/sessions/{id}/claim
POST /api/user/cs/sessions/{id}/transfer
POST /api/user/cs/sessions/{id}/escalate
POST /api/user/cs/sessions/{id}/audit
POST /api/user/cs/sessions/{id}/internal-note
```

控制器只负责解析 Bearer、参数绑定和调用服务；所有权限和可见性规则留在 `CsSessionService`。

- [ ] **Step 6: 运行 user 定向测试和边界检查**

```powershell
mvn -pl java-user "-Dtest=CsSessionServiceTest,CustomerSupportServiceTest,SupportContextServiceTest" test
powershell -ExecutionPolicy Bypass -File scripts/check-service-boundaries.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-cross-owner-fks.ps1
```

预期：新测试和已有客服测试全部通过，未出现跨 owner Mapper/SQL。

## Task 4: `java-ticket` 最近订单上下文只读接口

**Files:**

- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/AdminRecentOrderContextResponse.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/AdminOrderContextService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/AdminOrderContextServiceTest.java`

- [ ] **Step 1: 写订单上下文失败测试**

准备两个订单快照，断言结果只保留最近两笔，并包含订单号、活动名、场次、票档/座位和履约状态；普通用户调用时断言 `403`。

```powershell
mvn -pl java-ticket "-Dtest=AdminOrderContextServiceTest" test
```

预期：测试因服务类不存在而 RED。

- [ ] **Step 2: 实现服务和 DTO**

服务只调用 `java-ticket` 已有订单 Mapper/服务，按 `userId`、状态白名单和创建时间倒序查询，映射到专用摘要 DTO，不返回内部支付或数据库字段。

- [ ] **Step 3: 增加控制器接口和权限**

新增：

```java
@GetMapping("/admin/orders/user-recent-context")
public Result<List<AdminRecentOrderContextResponse>> listUserRecentContext(
    @RequestHeader(value = "Authorization", required = false) String authorization,
    @RequestParam Long userId
)
```

控制器使用票务服务现有后台权限解析；支持平台超管和客服后台查看权限，拒绝普通前台用户。

- [ ] **Step 4: 运行票务定向测试和边界检查**

```powershell
mvn -pl java-ticket "-Dtest=AdminOrderContextServiceTest,AdminControllerTest" test
powershell -ExecutionPolicy Bypass -File scripts/check-service-boundaries.ps1
```

预期：票务服务只访问 `omni_ticket_split` 自有表，无新增跨服务 Mapper。

## Task 5: 前端 API 类型、权限和兼容路由

**Files:**

- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/console-auth.ts`
- Modify: `frontend/src/app/console/layout.tsx`
- Create: `frontend/src/lib/customer-service-workbench.ts`
- Create: `frontend/src/lib/customer-service-workbench.test.ts`
- Modify: `frontend/src/app/console/support-conversations/page.tsx`

- [ ] **Step 1: 写前端纯函数/API 失败测试**

覆盖：

```ts
assert.equal(mapCsStatusToApi('active'), 'ACTIVE')
assert.equal(mapCsStatusToApi('audit'), 'NEED_AUDIT')
assert.equal(getSlaTone({ slaTimeoutFlag: false, userWaitingSeconds: 0 }), 'normal')
assert.equal(getSlaTone({ slaTimeoutFlag: true, userWaitingSeconds: 240 }), 'warning')
assert.equal(canManageCsActions(['cs.manage']), true)
assert.equal(canManageCsActions(['support.conversation.view']), false)
```

运行：

```powershell
cd frontend
node --test src/lib/customer-service-workbench.test.ts
```

预期：因 helper 文件不存在而 RED。

- [ ] **Step 2: 实现类型、API 函数和纯函数**

新增 API 函数：

```ts
listCsOrgTree()
listCsSessions(params)
listCsSessionMessages(sessionId)
claimCsSession(sessionId)
transferCsSession(sessionId, payload)
escalateCsSession(sessionId, reason)
auditCsSession(sessionId, payload)
addCsInternalNote(sessionId, content)
listRecentOrderContext(userId)
```

所有函数调用现有 `request<T>()`；订单上下文函数使用独立较短超时或捕获失败后返回空数组，不改变主会话请求状态。

- [ ] **Step 3: 更新路由权限和菜单**

新增 `/console/customer-service/sessions` 权限映射，旧路径保留相同权限；侧边栏菜单只展示新路径。旧页面改为导出新页面默认组件，避免维护两份工作台。

- [ ] **Step 4: 运行前端纯函数测试和类型检查**

```powershell
cd frontend
node --test src/lib/customer-service-workbench.test.ts
pnpm typecheck
```

预期：测试全绿，类型检查零报错。

## Task 6: 实现三栏式工作台

**Files:**

- Create: `frontend/src/app/console/customer-service/sessions/page.tsx`
- Modify: `frontend/src/lib/customer-service-workbench.ts`
- Modify: `frontend/src/lib/api.ts`
- Test: `frontend/src/lib/customer-service-workbench.test.ts`

- [ ] **Step 1: 先写页面结构断言**

新增静态入口测试，读取页面源码并断言存在：

```ts
assert.match(source, /h-full/)
assert.match(source, /org-tree/)
assert.match(source, /NEED_AUDIT/)
assert.match(source, /max-w-lg/)
assert.match(source, /暂无近期订单/)
assert.match(source, /CS_SESSION_QUALITY_AUDIT|auditCsSession/)
```

预期：页面尚不存在，测试 RED。

- [ ] **Step 2: 实现页面数据状态**

页面状态至少包含：

```ts
const [tree, setTree] = useState<CsOrgTreeVO | null>(null)
const [query, setQuery] = useState<CsSessionQuery>({ status: 'ACTIVE', page: 1, size: 30 })
const [sessions, setSessions] = useState<PageResult<CsSessionVO>>(...)
const [activeSession, setActiveSession] = useState<CsSessionVO | null>(null)
const [messages, setMessages] = useState<CsSessionMessageVO[]>([])
const [orderContext, setOrderContext] = useState<CsRecentOrderContextVO[]>([])
const [orderContextLoading, setOrderContextLoading] = useState(false)
const [orderContextError, setOrderContextError] = useState(false)
```

挂载时并行加载组织树和首屏会话；选中会话时并行加载消息和订单上下文，订单请求失败只更新右侧占位状态。

- [ ] **Step 3: 实现左栏组织树**

渲染根节点、公共池、AI 节点、技能组和坐席；技能组支持展开/收起，搜索框按姓名/工号过滤节点；点击节点只更新 `groupId` 或 `agentId` 并触发服务端列表刷新。

- [ ] **Step 4: 实现中栏队列**

顶部提供“进行中 / 已结束 / 待主管质检”切片和排序下拉；会话卡片展示用户、接待标签、最后摘要、等待时长和 SLA 绿/黄/红徽标；底部使用服务端分页，不把全量数据复制到客户端。

- [ ] **Step 5: 实现右栏聊天和画像**

右栏拆成可伸缩聊天主区与 `w-[300px]` 画像区：

- 顶部显示 UID、脱敏电话、来源和路由。
- 事件和 `SYSTEM` 消息居中展示，用户/AI/人工消息按发送方样式区分。
- 消息气泡使用 `max-w-lg`。
- 内部备注在底部常驻，保存调用 `addCsInternalNote`。
- 订单卡片显示摘要或“暂无近期订单”。
- 质检卡片只对 `cs.manage` 展示可编辑星级、评语和是否解决。
- 时间线展示创建、路由、转接、升级、超时和关闭节点。

- [ ] **Step 6: 实现认领、转接和升级弹窗**

转接弹窗必须在提交前校验 `targetGroupId`、`targetAgentId`、`transferNote.trim()`；接口失败时保留弹窗内容并显示中文错误。成功后刷新树、列表、当前会话和消息。

- [ ] **Step 7: 运行页面结构测试和类型检查**

```powershell
cd frontend
node --test src/lib/customer-service-workbench.test.ts
pnpm typecheck
```

预期：结构断言和类型检查均通过。

## Task 7: 集成验证、迁移检查和实现记录

**Files:**

- Modify: `implementation-notes.md`
- Verify: all files changed in Tasks 1-6

- [ ] **Step 1: 执行 Java 定向测试**

```powershell
mvn -pl java-user "-Dtest=CsSessionServiceTest,CustomerSupportServiceTest,SupportContextServiceTest" test
mvn -pl java-ticket "-Dtest=AdminOrderContextServiceTest,AdminControllerTest" test
```

预期：两条命令退出码为 `0`，输出中无失败测试。

- [ ] **Step 2: 执行前端类型和目标测试**

```powershell
cd frontend
node --test src/lib/customer-service-workbench.test.ts src/lib/console-layout-menu.test.ts src/lib/api.test.ts
pnpm typecheck
```

预期：所有目标测试通过，`pnpm typecheck` 零报错。

- [ ] **Step 3: 执行边界和 SQL 检查**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-cross-owner-fks.ps1
git diff --check
```

预期：所有命令退出码为 `0`；边界检查确认 `java-user` 没有访问 `omni_ticket_split`。

- [ ] **Step 4: 只读验证审计闭环**

使用本地测试数据库只读查询确认：

```sql
SELECT action, target_type, target_id, success
FROM operation_audit_log
WHERE action IN ('CS_SESSION_TRANSFER', 'CS_SESSION_QUALITY_AUDIT')
ORDER BY create_time DESC;
```

不调用真实转接、升级或质检写接口作为验证手段；审计写入通过单元测试和本地已授权测试请求验证。

- [ ] **Step 5: 更新实现记录**

在 `implementation-notes.md` 的 2026-09-13 条目下补充实际改动、测试数量、数据库迁移是否执行、任何与设计文档不同的偏离，以及未执行的副作用操作。

不执行 `git commit`、`git push`、分支合并或删除性清理。

## Task 8: 负载树双计数与用户历史轨迹整改

**Files:**

- Modify: `java/java-user/src/main/java/com/omni/user/dto/CsOrgTreeResponse.java`
- Create: `java/java-user/src/main/java/com/omni/user/dto/CsUserSessionHistoryResponse.java`
- Modify: `java/java-user/src/main/java/com/omni/user/service/CsSessionService.java`
- Modify: `java/java-user/src/main/java/com/omni/user/controller/CsController.java`
- Modify: `java/java-user/src/test/java/com/omni/user/service/CsSessionServiceTest.java`
- Modify: `java/java-user/src/test/java/com/omni/user/controller/CsControllerTest.java`
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/customer-service-workbench.ts`
- Modify: `frontend/src/lib/customer-service-workbench.test.ts`
- Modify: `frontend/src/app/console/customer-service/sessions/page.tsx`
- Modify: `implementation-notes.md`

- [ ] **Step 1: Write failing Java tests**

Add assertions that:

```java
assertEquals(2L, tree.getActiveCount());
assertEquals(3L, tree.getTotalCount());
assertEquals(1L, tree.getGroups().get(0).getActiveCount());
assertEquals(2L, tree.getGroups().get(0).getTotalCount());
assertEquals("CLOSED", service.listUserSessionHistory(1L, 1001L).get(0).getStatus());
```

The test fixture must include both open and closed conversations for the same user, and verify that a non-manager cannot see a closed conversation assigned to another agent in the history endpoint.

- [ ] **Step 2: Run the Java tests and confirm the expected RED state**

Run:

```powershell
mvn -pl java-user "-Dtest=CsSessionServiceTest,CsControllerTest" test
```

Expected failure: missing `totalCount`, history response type, service method, or controller route. Do not change assertions to make the test pass.

- [ ] **Step 3: Implement the minimal Java behavior**

Use the existing `visibleConversations(access, ...)` scope for all tree counts. Set root and group `totalCount` from `CLOSED` records; set each agent `totalCount` from `CLOSED` records assigned to that agent. Add a history response DTO and a service method that filters by `userId`, sorts `createTime DESC` then `id DESC`, and exposes only status/agent/category/close reason fields. Add the controller route:

```text
GET /api/user/cs/users/{userId}/sessions-history
```

The method must call `requireView(actorUserId)` and apply the same visibility rules before mapping results.

- [ ] **Step 4: Run Java tests GREEN**

Run the same Maven command and verify zero failures/errors. Then run the existing客服 service tests to catch permission regressions.

- [ ] **Step 5: Write failing frontend structure and helper tests**

Assert that the page contains separate `ACTIVE` and `CLOSED` tab requests, does not contain user accordion/grouping logic, exposes `订单与质检` and `用户全历史轨迹`, and calls `listCsUserSessionHistory` only when the history tab is active.

- [ ] **Step 6: Implement the frontend dual-tab workflow**

Keep `sessionResult.records` as one-session-per-row server-page data. Remove the client-side `selectCustomerServiceSessions` filtering for AI/pool/group nodes by mapping tree selections into request parameters instead. Add `groupCustomerServiceSessionsByUser()` to aggregate only the current page by `userId`; render one collapsed user card per user, expand it into session child entries, and keep `selectedSessionId`/`messages` bound to the clicked child session. Add the history API type/request, load it on demand for the selected user, and render the full history list in the right panel without changing the current chat scope.

- [ ] **Step 7: Run frontend and repository verification**

Run:

```powershell
cd frontend
node --test src/lib/customer-service-workbench.test.ts
pnpm typecheck
cd ..
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
git diff --check
```

Record actual test counts, migration status, and any deviations in `implementation-notes.md`. Do not commit or push.

## 计划自检

- 设计文档的数据库表、会话字段、接口契约、权限范围、订单弱依赖、三栏布局和验收命令均已映射到 Task 1-7。
- `NEED_AUDIT` 的判定和 `cs.manage` 质检写入权限在 Task 2、Task 3、Task 5、Task 6 中保持一致。
- 订单画像只通过 `java-ticket` 专用摘要接口加载，Task 4 没有给 `java-user` 增加票务 Mapper。
- 没有使用 `TBD`、`TODO`、`implement later` 等未决占位；所有验证步骤包含具体命令和预期结果。
- 项目规则覆盖了计划模板中的提交步骤：不自动提交 Git，仅执行测试、边界检查和 `git diff --check`。
