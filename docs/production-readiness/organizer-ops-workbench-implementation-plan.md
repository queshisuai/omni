# 平台主办方运营员工作台 Implementation Plan

> **给执行代理：** REQUIRED SUB-SKILL: Use `executing-plans` 按任务逐项实施；涉及生产代码改动时先用 `test-driven-development`。步骤使用 checkbox（`- [ ]`）跟踪。本项目规则要求不要自动提交和推送，因此本计划不包含 commit step。

**Goal:** 把现有 `organizer_admin` 从“容易被误解的主办方管理员账号”收口为平台级主办方运营员，并补齐主办方待办、跟进、分配、复核和审计闭环。

**Architecture:** 第一轮不重命名数据库 role code，继续使用 `organizer_admin` 作为兼容代码值；用户可见文案、菜单、审计展示统一改为“平台主办方运营员”。后续通过 `java-user` 拥有运营跟进、分配和审计数据；票务活动、场馆、风控仍由 `java-ticket` 拥有，前端工作台按权限聚合已有服务接口，禁止跨服务 Mapper 或跨库 join。

**Tech Stack:** Spring Boot 2.7.18、MyBatis-Plus、PostgreSQL、RBAC、Operation Audit、Next.js 16、React 19、TypeScript。

---

## 非目标

- 第一轮不把 `organizer_admin` 数据库值直接改成 `organizer_ops_agent`，避免 JWT、RBAC、种子数据和前端类型一次性震荡。
- 不让平台主办方运营员拥有平台超管能力；`rbac.manage`、系统配置、对账补偿等仍由平台超管或明确权限控制。
- 不在 `java-user` 直接查询 ticket/order/payment 表；跨服务上下文通过已有 API 或前端聚合。
- 不把普通主办方租户管理员和平台运营员混为一类。
- 不一次性实现所有高危动作双人复核；先从可审计、可分配、可跟进做起。

## 当前现状

- `java-user` 已有 RBAC：`RbacService` 会把 `admin` 解析为 `platform_super_admin`，`organizer_admin` 的 `scopeType` 是 `platform`。
- `sql/production-split/user/20260604_organizer_admin_permissions.sql` 已给 `organizer_admin` 配置活动、巡演、场次、艺人、订单、退款、场馆、主办方审核、账号管理、场馆审核和审计权限。
- `java-user` 已有 `OrganizerAdminAccountService` 和 `/api/user/console/organizer-admins`，可创建、更新、停用、删除该岗位账号，并写 `operation_audit_log`。
- 前端已有 `/console/organizer-admins`、`console-auth.ts`、`console-paths.ts`、`operation-display.ts`，但用户可见文案仍大量写“主办方管理员”。
- 现有能力缺少“运营工作台”视角：没有待办聚合、主办方跟进记录、运营员分配、风险等级、下次跟进时间和高危动作复核队列。

## 设计口径

### 角色命名

短期兼容口径：

- 内部 role code：继续使用 `organizer_admin`。
- 用户可见名称：统一显示为“平台主办方运营员”。
- 账号管理页：改为“平台主办方运营员账号管理”。
- 审计动作：`organizer_admin.create/update/deactivate/delete` 暂不改 action code，展示文案改为“平台主办方运营员账号”。

后续可选迁移：

- 新增 `organizer_ops_agent`、`organizer_ops_manager` role code。
- 迁移 `rbac_role`、`rbac_role_permission`、`user.role`、前端 `UserRole`。
- 保留 `organizer_admin` alias 一段时间，Gateway/JWT/前端兼容旧 token。

### 权限边界

建议拆分权限，而不是给运营员直接平台超管：

- `organizer.review`：处理主办方入驻审核。
- `organizer.account.manage`：维护平台主办方运营员账号。
- `organizer.follow.manage`：新增，维护主办方跟进记录、风险等级、下次跟进时间。
- `organizer.assign.manage`：新增，分配主办方给运营员。
- `organizer.risk.review`：后续可新增，高风险操作复核。
- `audit.view`：可看与自身职责相关审计，平台超管可看全部。

### 数据归属

`java-user` 拥有：

- 平台主办方运营员账号。
- 主办方入驻申请。
- 主办方跟进记录。
- 主办方分配关系。
- 操作审计。

`java-ticket` 拥有：

- 活动、巡演、场次、票档、场馆资料审核、风险案例、恢复售票审核。

前端工作台：

- `/console/organizer-ops` 作为平台主办方运营员首页。
- 通过 `frontend/src/lib/api.ts` 调用 user console API 和 ticket admin API 聚合展示。
- 权限不足时隐藏入口，不显示空按钮。

## 数据库规划

后续涉及新增结构时必须放到：

- `sql/production-split/user/20260608_organizer_ops_follow_up.sql`
- 如需保留共享库归档，同时补 `sql/migrations/shared/20260608_organizer_ops_follow_up.sql`

建议表：

```sql
CREATE TABLE IF NOT EXISTS organizer_ops_assignment (
    organizer_user_id BIGINT PRIMARY KEY,
    assigned_operator_id BIGINT,
    risk_level VARCHAR(16) NOT NULL DEFAULT 'normal',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    next_follow_at TIMESTAMP,
    last_follow_at TIMESTAMP,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS organizer_ops_follow_up (
    id BIGSERIAL PRIMARY KEY,
    organizer_user_id BIGINT NOT NULL,
    operator_id BIGINT NOT NULL,
    follow_type VARCHAR(32) NOT NULL,
    content TEXT NOT NULL,
    next_follow_at TIMESTAMP,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

说明：

- 不加跨 owner FK；`organizer_user_id` 和 `operator_id` 是 copied id。
- `risk_level` 第一轮建议取值：`normal`、`watch`、`high`。
- `status` 第一轮建议取值：`active`、`pending_material`、`restricted`、`inactive`。
- 本地库 `omni_user` 必须执行迁移后再改 Entity/Mapper。

---

## Task 1: 文案与角色边界收口

**Files:**
- Modify: `frontend/src/lib/console-auth.ts`
- Modify: `frontend/src/lib/console-paths.ts`
- Modify: `frontend/src/lib/console-orders.ts`
- Modify: `frontend/src/lib/operation-display.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/app/console/layout.tsx`
- Modify: `frontend/src/app/console/organizer-admins/page.tsx`
- Modify: `frontend/src/app/console/profile/page.tsx`
- Modify: `frontend/src/app/merchant/page.tsx`
- Modify: `java/java-user/src/main/java/com/omni/user/service/OrganizerAdminAccountService.java`
- Modify: `java/java-user/src/main/java/com/omni/user/controller/InternalWorkbenchController.java`
- Test: `java/java-user/src/test/java/com/omni/user/service/OrganizerAdminAccountServiceTest.java`
- Test: `frontend/src/lib/api.test.ts`
- Test: `frontend/src/lib/console-auth.test.ts`
- Test: `frontend/src/lib/console-paths.test.ts`
- Test: `frontend/src/lib/console-orders.test.ts`
- Test: `frontend/src/lib/operation-display.test.ts`

- [x] **Step 1: 写前端文案红灯测试**

验证 `organizer_admin` 展示为“平台主办方运营员”，账号管理展示为“平台主办方运营员账号管理”，订单范围说明和后端错误文案不再写“主办方管理员”。

Run: `cd frontend; node --test src\lib\console-auth.test.ts src\lib\console-paths.test.ts src\lib\console-orders.test.ts src\lib\operation-display.test.ts`

Result: 2026-06-08 新断言按预期失败，失败点为旧“主办方管理员”文案；后端新增错误文案断言也按预期失败。

- [x] **Step 2: 修改用户可见文案**

只改展示文案、接口错误文案和审计 reason 文案，不改 `UserRole`、接口字段、接口路径、审计 action code 和 role code。

- [x] **Step 3: 运行前端测试和类型检查**

Run:

```powershell
cd frontend
node --test src\lib\console-auth.test.ts src\lib\console-paths.test.ts src\lib\console-orders.test.ts src\lib\operation-display.test.ts src\lib\api.test.ts
pnpm typecheck
cd ..\java
mvn -pl java-user -Dtest=OrganizerAdminAccountServiceTest test
```

Result: 2026-06-08 运行通过，`node --test` 44 tests passed，`pnpm typecheck` 通过，`mvn -pl java-user test` 219 tests passed。`rg -n "主办方管理员|主办方管理后台" java/java-user/src/main java/java-user/src/test frontend/src` 无匹配。`organizer_admin` 内部 role code 保持不变，前后端用户可见文案统一为“平台主办方运营员”。

## Task 2: 平台主办方运营员首页入口

**Files:**
- Create: `frontend/src/app/console/organizer-ops/page.tsx`
- Modify: `frontend/src/lib/console-auth.ts`
- Modify: `frontend/src/lib/console-paths.ts`
- Modify: `frontend/src/lib/operation-display.ts`
- Modify: `frontend/src/lib/support-tools.test.ts`
- Modify: `frontend/src/app/console/layout.tsx`
- Test: `frontend/src/lib/console-auth.test.ts`
- Test: `frontend/src/lib/console-paths.test.ts`
- Test: `frontend/src/lib/operation-display.test.ts`

- [x] **Step 1: 写入口权限红灯测试**

`organizer_admin` 有 `organizer.review` 或 `organizer.account.manage` 时默认进入 `/console/organizer-ops`；无相关权限时回落到第一个可用权限页。

Result: 2026-06-08 新断言按预期失败，失败点为默认入口仍指向 `/console/organizer-admins` 或 `/console/organizer-applications`，快捷操作缺少 `/console/organizer-ops`。

- [x] **Step 2: 新增工作台页面**

页面展示：

- 待审核主办方申请数量。
- 当前平台主办方运营员账号数量。
- 最近操作审计。
- 快捷入口：主办方审核、运营员账号、操作审计。

第一轮优先复用已有 API，不新增后端聚合接口。

Result: 已新增 `/console/organizer-ops`，复用 `listOrganizerApplications(0)`、`listOrganizerAdminAccounts()`、`listOperationAuditLogs({ limit: 5 })`。同时补齐 `EXCEPTION_RESOLVE`、`STATION_CONFIG_REVIEW`、`VENUE_REVIEW`、`RISK_CASE_UPDATE` 等审计动作中文映射，避免页面裸露英文 action code。

- [x] **Step 3: 浏览器验证入口**

使用 `13800000001 / 123456` 登录，确认菜单、跳转、空状态和错误态为中文。

Result: 2026-06-08 使用 `http://localhost:3002/console/organizer-ops` 验证通过；未登录会跳转 `/login`，登录后菜单出现“运营工作台”，页面展示待审核主办方申请、平台主办方运营员、最近操作审计、待办入口和最近操作。浏览器 console：Errors 0，Warnings 0。

Verified 2026-06-08：
- `cd frontend; node --test src\lib\console-auth.test.ts src\lib\console-paths.test.ts src\lib\support-tools.test.ts src\lib\operation-display.test.ts src\lib\api.test.ts`：58 tests passed。
- `cd frontend; pnpm typecheck`：通过。
- `rg -n "主办方管理员|主办方管理后台" frontend/src java/java-user/src/main java/java-user/src/test`：无匹配。
- `git diff --check`：无空白错误，仅 CRLF warning。

## Task 3: 主办方跟进与分配数据模型

**Files:**
- Create: `sql/production-split/user/20260608_organizer_ops_follow_up.sql`
- Create: `sql/migrations/shared/20260608_organizer_ops_follow_up.sql`
- Create: `java/java-user/src/main/java/com/omni/user/entity/OrganizerOpsAssignment.java`
- Create: `java/java-user/src/main/java/com/omni/user/entity/OrganizerOpsFollowUp.java`
- Create: `java/java-user/src/main/java/com/omni/user/mapper/OrganizerOpsAssignmentMapper.java`
- Create: `java/java-user/src/main/java/com/omni/user/mapper/OrganizerOpsFollowUpMapper.java`
- Create: `java/java-user/src/main/java/com/omni/user/service/OrganizerOpsService.java`
- Test: `java/java-user/src/test/java/com/omni/user/service/OrganizerOpsServiceTest.java`

- [x] **Step 1: 写迁移 SQL**

创建 `organizer_ops_assignment`、`organizer_ops_follow_up`，不加跨 owner FK，补索引：

- `idx_organizer_ops_assignment_operator`
- `idx_organizer_ops_assignment_next_follow`
- `idx_organizer_ops_follow_up_organizer_time`

Result: 2026-06-08 已新增 production-split 与 shared 两份迁移 SQL；同时补充 `organizer.follow.manage`、`organizer.assign.manage` 权限，并把新表登记到 production split manifest 和 SQL 边界检查脚本。

- [x] **Step 2: 执行本地迁移**

Run:

```powershell
$env:PGPASSWORD='123456'
psql -h localhost -p 5432 -U postgres -d omni_user -f sql/production-split/user/20260608_organizer_ops_follow_up.sql
```

Expected: `CREATE TABLE` / `CREATE INDEX` 成功或已存在。

Result: 2026-06-08 已执行到本地 `omni_user`，输出 `CREATE TABLE`、`CREATE INDEX`、`INSERT 0 2`。

- [x] **Step 3: 写 Service 红灯测试**

覆盖：

- 运营员可创建跟进记录。
- 运营员可设置 `nextFollowAt`。
- 无 `organizer.follow.manage` 权限时返回 403。
- 分配关系更新会写 `operation_audit_log`。

Result: 2026-06-08 红灯阶段 `mvn -pl java-user "-Dtest=OrganizerOpsServiceTest" test` 按预期失败，失败点为 `OrganizerOpsService`、`OrganizerOpsAssignment`、`OrganizerOpsFollowUp` 和 Mapper 尚不存在；实现后定向测试 4 tests passed。

## Task 4: 主办方运营 API

**Files:**
- Modify: `java/java-user/src/main/java/com/omni/user/service/OrganizerOpsService.java`
- Create: `java/java-user/src/main/java/com/omni/user/dto/OrganizerOpsAssignmentRequest.java`
- Create: `java/java-user/src/main/java/com/omni/user/dto/OrganizerOpsAssignmentResponse.java`
- Create: `java/java-user/src/main/java/com/omni/user/dto/OrganizerOpsFollowUpRequest.java`
- Create: `java/java-user/src/main/java/com/omni/user/dto/OrganizerOpsFollowUpResponse.java`
- Modify: `java/java-user/src/main/java/com/omni/user/controller/InternalWorkbenchController.java`
- Test: `java/java-user/src/test/java/com/omni/user/controller/InternalWorkbenchControllerOrganizerOpsTest.java`

- [x] **Step 1: 写 Controller 红灯测试**

接口：

- `GET /api/user/console/organizer-ops/assignments`
- `PUT /api/user/console/organizer-ops/assignments/{organizerUserId}`
- `GET /api/user/console/organizer-ops/assignments/{organizerUserId}/follow-ups`
- `POST /api/user/console/organizer-ops/assignments/{organizerUserId}/follow-ups`

Result: 2026-06-08 红灯阶段 `mvn -pl java-user "-Dtest=InternalWorkbenchControllerOrganizerOpsTest" test` 按预期失败，失败点为 DTO、Controller 构造器、Controller 路由方法和 Service DTO 方法尚不存在。

- [x] **Step 2: 实现权限校验**

- 查看：`organizer.review` 或 `organizer.follow.manage`。
- 写跟进：`organizer.follow.manage`。
- 分配：`organizer.assign.manage`。

Result: 2026-06-08 已新增 4 个 console API；Controller 先校验 JWT 和权限，Service 保留业务层权限兜底，并提供 assignment / follow-up DTO 转换。

- [x] **Step 3: 运行后端测试**

Run:

```powershell
cd java
mvn -pl java-user -Dtest=OrganizerOpsServiceTest,InternalWorkbenchControllerOrganizerOpsTest test
```

Expected: 通过。

Result: 2026-06-08 `mvn -pl java-user "-Dtest=OrganizerOpsServiceTest,InternalWorkbenchControllerOrganizerOpsTest" test` 通过，11 tests passed。

## Task 5: 前端跟进工作台闭环

**Files:**
- Modify: `frontend/src/app/console/organizer-ops/page.tsx`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/types/api.ts`
- Test: `frontend/src/lib/api.test.ts`

- [x] **Step 1: 接 API 客户端**

新增：

- `listOrganizerOpsAssignments()`
- `updateOrganizerOpsAssignment()`
- `listOrganizerOpsFollowUps()`
- `createOrganizerOpsFollowUp()`

Result: 2026-06-08 已新增前端类型 `OrganizerOpsAssignmentVO`、`OrganizerOpsAssignmentPayload`、`OrganizerOpsFollowUpVO`、`OrganizerOpsFollowUpPayload` 和 4 个 API wrapper。红灯阶段 `node --test src\lib\api.test.ts` 因新增导出不存在失败；实现后 `api.test.ts` 25 tests passed。

- [x] **Step 2: 页面展示跟进队列**

展示字段：

- 主办方 ID / 名称。
- 风险等级。
- 当前状态。
- 负责人。
- 下次跟进时间。
- 最近跟进内容。

Result: 2026-06-08 `/console/organizer-ops` 已接入主办方跟进队列，展示风险等级、跟进状态、负责人、下次跟进时间、最近跟进内容，并保留主办方审核、运营员账号和操作审计入口。页面权限已对齐 `organizer.review`、`organizer.follow.manage`、`organizer.assign.manage` 和 `organizer.account.manage`。

- [x] **Step 3: 页面操作闭环**

支持：

- 添加跟进记录。
- 设置下次跟进时间。
- 调整风险等级。
- 分配运营员。

所有失败态、空状态和按钮反馈必须是中文。

Result: 2026-06-08 已实现分配/风险/状态/下次跟进保存和添加跟进记录；运营员账号下拉使用中文显示并清洗本地旧种子昵称“主办方管理员”。新增 `organizer_ops.assignment.update`、`organizer_ops.follow_up.create` 审计中文映射，避免页面裸露英文 action code。

Verified 2026-06-08：
- `cd frontend; node --test src\lib\api.test.ts src\lib\console-auth.test.ts src\lib\console-paths.test.ts src\lib\operation-display.test.ts`：40 tests passed。
- `cd frontend; pnpm typecheck`：通过。
- 由于本机 `8081` 旧 `java-user` 进程无法由当前会话终止，浏览器验证临时启动最新 `java-user` 于 `18081`，并重启前端 `3002` 指向 `NEXT_PUBLIC_API_URL=http://localhost:18081`。
- 浏览器验证 `http://localhost:3002/console/organizer-ops`：跟进队列、分配表单、添加跟进表单、跟进记录、最近审计均可见；通过页面提交“浏览器表单验证跟进记录”后出现“跟进记录已添加”；控制台 Errors 0、Warnings 0；页面不再出现“主办方管理员”、`organizer_ops.follow_up.create`、`organizer_ops.assignment.update` 等裸露旧文案或英文 action code。

## Task 6: 验收与总路线更新

**Files:**
- Modify: `2026-06-06-platform-improvement-roadmap.md`
- Modify: `docs/production-readiness/frontend-entry-audit.md`
- Modify: `docs/production-readiness/seed-data-audit.md`
- Modify: `docs/production-readiness/replacement-audit.md`

- [x] **Step 1: 运行后端验证**

Run:

```powershell
cd java
mvn -pl java-user test
cd ..
powershell -ExecutionPolicy Bypass -File scripts\verify-microservice-boundaries.ps1
```

Result: 2026-06-08 `mvn -pl java-user test` 通过，BUILD SUCCESS，230 tests，0 failures/errors。`scripts\verify-microservice-boundaries.ps1` 通过，微服务边界检查 PASS，Java 边界 reactor BUILD SUCCESS；日志里出现的 `es down`、退款超时等为测试内模拟异常，不影响验收结果。

- [x] **Step 2: 运行前端验证**

Run:

```powershell
cd frontend
pnpm typecheck
```

Result: 2026-06-08 `pnpm typecheck` 通过；补充运行 `node --test src\lib\api.test.ts src\lib\console-auth.test.ts src\lib\console-paths.test.ts src\lib\operation-display.test.ts`，40 tests passed。

- [x] **Step 3: 浏览器手工验证**

验证：

- 平台主办方运营员账号登录默认进入工作台。
- 没权限的入口不显示。
- 添加跟进记录后页面刷新仍可见。
- 审计日志能看到分配和跟进动作。

Result: 2026-06-08 复核 `http://localhost:3002/console/organizer-ops`，页面刷新后仍可见“浏览器表单验证跟进记录”；最近审计显示“更新主办方运营分配”和“新增主办方跟进记录”；页面不再出现旧“主办方管理员”文案，也不裸露 `organizer_ops.assignment.update`、`organizer_ops.follow_up.create`；浏览器 console error/warn 为 0。当前 `8081` 仍是旧 `java-user` 进程，完整 Gateway 链路验收前需要手动重启真实 `8081`。

- [x] **Step 4: 更新路线文档**

记录已完成任务、数据库迁移、种子数据缺口和下一阶段建议。

Result: 2026-06-08 已更新总路线、前端入口审计、种子数据审计和替换审计，记录阶段 4 第一轮完成状态、迁移/API/前端闭环、剩余 seed 命名与演示数据缺口，以及下一阶段建议。

## 回滚思路

- Task 1/2 只是前端文案和入口，可直接恢复对应前端文件。
- Task 3/4 新增表不影响现有登录、购票和主办方发布链路；如需回滚，先停用入口，再保留表数据等待清理。
- 新增权限可通过删除 `rbac_role_permission` 授权临时关闭，不需要删除账号。
- 所有新增高危动作必须写 `operation_audit_log`，排障时按 `operator_id` 和 `trace_id` 回溯。
