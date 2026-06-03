# RBAC、审计、异常补偿、对账与后台弹窗 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立后台单主角色 + 权限点底座，先接入高风险后台接口，再补人工审计、异常补偿、日结对账，最后清掉后台原生弹窗。

**Architecture:** `java-user` 作为权限与审计控制面，负责角色、权限点、`support_role`、审计落库和异常/对账工作台的统一入口；`java-ticket`、`java-payment`、`java-order` 只保留各自业务执行能力，通过内部权限查询和审计写入接口接入控制面。前端先消费权限结果做菜单和页面收口，再把 `window.prompt/window.confirm/window.alert` 全部替换成统一 `GlobalDialog`。

**Tech Stack:** Java Spring Boot, MyBatis-Plus, PostgreSQL, Spring Cloud OpenFeign, Next.js, TypeScript, ESLint, Node test runner, Maven/JUnit/Mockito.

---

## File Structure

- Create: `sql/production-split/user/20260602_rbac_permission_base.sql`
  - 建 RBAC 角色、权限点、角色权限映射、用户角色归属回填、`support_role` 扩展。
- Create: `sql/production-split/user/20260602_operation_audit_log.sql`
  - 建 `operation_audit_log`，供所有后台人工写操作落审计。
- Create: `sql/production-split/user/20260602_exception_reconcile_workbench.sql`
  - 建异常任务、证据、对账批次、对账明细、差异记录。
- Create: `java/java-common/src/main/java/com/omni/common/dto/InternalAuthContextResponse.java`
  - 统一内部权限查询返回结构。
- Create: `java/java-common/src/main/java/com/omni/common/dto/OperationAuditWriteRequest.java`
  - 统一审计写入请求。
- Create: `java/java-common/src/main/java/com/omni/common/dto/ExceptionTaskCreateRequest.java`
  - 统一异常任务上报请求。
- Create: `java/java-common/src/main/java/com/omni/common/dto/ReconciliationBatchCreateRequest.java`
  - 统一日结批次生成请求。
- Create: `java/java-common/src/main/java/com/omni/common/web/TraceIdFilter.java`
  - 从 `X-Request-Id` 或请求链路上下文生成/透传 `traceId`。
- Modify: `java/java-user/src/main/java/com/omni/user/entity/User.java`
  - 保留兼容字段，新增后台角色归一化使用的辅助字段/映射逻辑。
- Modify: `java/java-user/src/main/java/com/omni/user/entity/SupportAccount.java`
  - 增加 `supportRole`。
- Create: `java/java-user/src/main/java/com/omni/user/entity/RbacRole.java`
- Create: `java/java-user/src/main/java/com/omni/user/entity/RbacPermission.java`
- Create: `java/java-user/src/main/java/com/omni/user/entity/RbacRolePermission.java`
- Create: `java/java-user/src/main/java/com/omni/user/entity/OperationAuditLog.java`
- Create: `java/java-user/src/main/java/com/omni/user/entity/ExceptionTask.java`
- Create: `java/java-user/src/main/java/com/omni/user/entity/ReconciliationBatch.java`
- Create: `java/java-user/src/main/java/com/omni/user/entity/ReconciliationDifference.java`
- Create: `java/java-user/src/main/java/com/omni/user/mapper/RbacRoleMapper.java`
- Create: `java/java-user/src/main/java/com/omni/user/mapper/RbacPermissionMapper.java`
- Create: `java/java-user/src/main/java/com/omni/user/mapper/RbacRolePermissionMapper.java`
- Create: `java/java-user/src/main/java/com/omni/user/mapper/OperationAuditLogMapper.java`
- Create: `java/java-user/src/main/java/com/omni/user/mapper/ExceptionTaskMapper.java`
- Create: `java/java-user/src/main/java/com/omni/user/mapper/ReconciliationBatchMapper.java`
- Create: `java/java-user/src/main/java/com/omni/user/service/RbacService.java`
- Create: `java/java-user/src/main/java/com/omni/user/service/OperationAuditService.java`
- Create: `java/java-user/src/main/java/com/omni/user/service/ExceptionWorkbenchService.java`
- Create: `java/java-user/src/main/java/com/omni/user/service/ReconciliationService.java`
- Modify: `java/java-user/src/main/java/com/omni/user/service/UserService.java`
- Modify: `java/java-user/src/main/java/com/omni/user/service/SupportAccountService.java`
- Modify: `java/java-user/src/main/java/com/omni/user/controller/UserController.java`
- Modify: `java/java-user/src/main/java/com/omni/user/controller/SupportController.java`
- Create: `java/java-user/src/main/java/com/omni/user/controller/InternalWorkbenchController.java`
- Modify: `java/java-user/src/test/java/com/omni/user/service/UserServiceTest.java`
- Create: `java/java-user/src/test/java/com/omni/user/service/RbacServiceTest.java`
- Modify: `java/java-user/src/test/java/com/omni/user/service/SupportAccountServiceTest.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/StationConfigVersionService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/VenueApplicationService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityAdminService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityRiskResponseService.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/controller/RefundController.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/service/RefundService.java`
- Modify: `java/java-order/src/main/java/com/omni/order/controller/OrderController.java`
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/console-paths.ts`
- Modify: `frontend/src/app/console/layout.tsx`
- Modify: `frontend/src/app/console/page.tsx`
- Modify: `frontend/src/app/console/support-accounts/page.tsx`
- Modify: `frontend/src/app/console/station-config-reviews/page.tsx`
- Modify: `frontend/src/app/console/venue/applications/page.tsx`
- Modify: `frontend/src/app/console/risk-resolutions/page.tsx`
- Modify: `frontend/src/app/console/risk-cases/page.tsx`
- Modify: `frontend/src/app/console/refunds/page.tsx`
- Modify: `frontend/src/app/console/activities/page.tsx`
- Modify: `frontend/src/app/console/tours/page.tsx`
- Modify: `frontend/src/components/GlobalDialog.tsx`
- Modify: `frontend/src/app/layout.tsx`
- Create: `frontend/scripts/check-console-native-dialogs.mjs`
- Modify: `frontend/package.json`
- Create: `frontend/src/lib/console-auth.ts`
- Create: `frontend/src/lib/console-auth.test.ts`
- Create: `frontend/src/app/console/exception-tasks/page.tsx`
- Create: `frontend/src/app/console/reconciliation/page.tsx`

---

### Task 1: RBAC 底座和内部权限上下文

**Files:**
- Create: `sql/production-split/user/20260602_rbac_permission_base.sql`
- Create: `java/java-common/src/main/java/com/omni/common/dto/InternalAuthContextResponse.java`
- Modify: `java/java-user/src/main/java/com/omni/user/entity/User.java`
- Modify: `java/java-user/src/main/java/com/omni/user/entity/SupportAccount.java`
- Create: `java/java-user/src/main/java/com/omni/user/entity/RbacRole.java`
- Create: `java/java-user/src/main/java/com/omni/user/entity/RbacPermission.java`
- Create: `java/java-user/src/main/java/com/omni/user/entity/RbacRolePermission.java`
- Create: `java/java-user/src/main/java/com/omni/user/mapper/RbacRoleMapper.java`
- Create: `java/java-user/src/main/java/com/omni/user/mapper/RbacPermissionMapper.java`
- Create: `java/java-user/src/main/java/com/omni/user/mapper/RbacRolePermissionMapper.java`
- Create: `java/java-user/src/main/java/com/omni/user/service/RbacService.java`
- Modify: `java/java-user/src/main/java/com/omni/user/service/UserService.java`
- Modify: `java/java-user/src/main/java/com/omni/user/controller/UserController.java`
- Create: `java/java-user/src/test/java/com/omni/user/service/RbacServiceTest.java`
- Modify: `java/java-user/src/test/java/com/omni/user/service/UserServiceTest.java`

- [ ] **Step 1: 先写失败测试，锁定权限上下文返回值**

在 `RbacServiceTest.java` 加一个用例，先驱动“角色 + 权限点 + 业务归属”三件事一起返回：

```java
@Test
void internalAuthContextIncludesRolePermissionsAndSupportRole() {
    when(userMapper.selectById(7L)).thenReturn(user(7L, "support_manager", 1));
    when(rbacRolePermissionMapper.selectList(any())).thenReturn(List.of(
            rolePermission("support.conversation.view"),
            rolePermission("support.account.manage"),
            rolePermission("audit.view")
    ));

    InternalAuthContextResponse response = service.getInternalAuthContext(7L);

    assertEquals("support_manager", response.getRole());
    assertEquals("support_manager", response.getEffectiveRole());
    assertEquals(List.of("support.conversation.view", "support.account.manage", "audit.view"), response.getPermissionCodes());
    assertEquals("support_manager", response.getSupportRole());
}
```

在 `SupportAccountServiceTest.java` 再补一个用例，先把“普通客服不能管账号，客服主管可以管”钉死：

```java
@Test
void supportAgentCannotManageSupportAccounts() {
    when(userMapper.selectById(2L)).thenReturn(user(2L, "support_agent", 1));

    BusinessException error = assertThrows(
            BusinessException.class,
            () -> service.create(2L, request("13900000002", "客服一号", "support123"))
    );

    assertEquals("无权限", error.getMessage());
}
```

- [ ] **Step 2: 跑测试确认先失败**

Run:

```powershell
cd java
mvn -pl java-user -Dtest=RbacServiceTest,SupportAccountServiceTest test
```

Expected: 先因 `InternalAuthContextResponse`、`supportRole`、`RbacService` 还不存在而失败。

- [ ] **Step 3: 落表和实现最小 RBAC 读模型**

`20260602_rbac_permission_base.sql` 里直接建四张表并回填：

```sql
-- owner: java-user

CREATE TABLE IF NOT EXISTS rbac_role (
    code VARCHAR(64) PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rbac_permission (
    code VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    description VARCHAR(255),
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rbac_role_permission (
    role_code VARCHAR(64) NOT NULL REFERENCES rbac_role(code),
    permission_code VARCHAR(64) NOT NULL REFERENCES rbac_permission(code),
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_code, permission_code)
);

ALTER TABLE support_account
    ADD COLUMN IF NOT EXISTS support_role VARCHAR(32) NOT NULL DEFAULT 'support_agent';

INSERT INTO rbac_role (code, name) VALUES
    ('platform_super_admin', '平台超管'),
    ('support_manager', '客服主管'),
    ('support_agent', '普通客服'),
    ('organizer_admin', '主办方管理员')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, update_time = CURRENT_TIMESTAMP;
```

`InternalAuthContextResponse.java` 定义成：

```java
public class InternalAuthContextResponse {
    private Long userId;
    private String role;
    private String effectiveRole;
    private String supportRole;
    private List<String> permissionCodes;
    private String scopeType;
    private Long scopeId;
    // getters/setters
}
```

`RbacService` 负责两件事：

```java
public InternalAuthContextResponse getInternalAuthContext(Long userId) {
    User user = userMapper.selectById(userId);
    if (user == null) {
        throw new BusinessException(ResultCode.NOT_FOUND, "用户不存在");
    }
    List<String> permissions = rbacRolePermissionMapper.selectPermissionsByRole(resolveRole(user));
    InternalAuthContextResponse response = new InternalAuthContextResponse();
    response.setUserId(userId);
    response.setRole(user.getRole());
    response.setEffectiveRole(resolveRole(user));
    response.setSupportRole(resolveSupportRole(user));
    response.setPermissionCodes(permissions);
    response.setScopeType(resolveScopeType(user));
    response.setScopeId(resolveScopeId(user));
    return response;
}
```

- [ ] **Step 4: 把内部权限查询接到 `UserController`**

新增内部接口，供其他服务统一拉权限上下文：

```java
@GetMapping("/internal/auth/context/{id}")
public Result<InternalAuthContextResponse> getInternalAuthContext(
        @PathVariable Long id,
        @RequestHeader(value = "X-Internal-Token", required = false) String token) {
    if (!isValidInternalToken(token)) {
        return Result.fail(403, "无权限");
    }
    return Result.success(rbacService.getInternalAuthContext(id));
}
```

同时在 `UserService` 的登录和用户信息返回里补上 `permissionCodes`，让前端能直接做菜单收口，不再只看 `role`。

- [ ] **Step 5: 跑测试确认通过并提交这一步**

Run:

```powershell
cd java
mvn -pl java-user -Dtest=RbacServiceTest,SupportAccountServiceTest test
```

Expected: `RbacServiceTest` 和 `SupportAccountServiceTest` 通过。

Commit:

```powershell
git add sql/production-split/user/20260602_rbac_permission_base.sql java/java-common/src/main/java/com/omni/common/dto/InternalAuthContextResponse.java java/java-user/src/main/java/com/omni/user/entity/User.java java/java-user/src/main/java/com/omni/user/entity/SupportAccount.java java/java-user/src/main/java/com/omni/user/entity/RbacRole.java java/java-user/src/main/java/com/omni/user/entity/RbacPermission.java java/java-user/src/main/java/com/omni/user/entity/RbacRolePermission.java java/java-user/src/main/java/com/omni/user/mapper/RbacRoleMapper.java java/java-user/src/main/java/com/omni/user/mapper/RbacPermissionMapper.java java/java-user/src/main/java/com/omni/user/mapper/RbacRolePermissionMapper.java java/java-user/src/main/java/com/omni/user/service/RbacService.java java/java-user/src/main/java/com/omni/user/service/UserService.java java/java-user/src/main/java/com/omni/user/controller/UserController.java java/java-user/src/test/java/com/omni/user/service/RbacServiceTest.java java/java-user/src/test/java/com/omni/user/service/UserServiceTest.java java/java-user/src/test/java/com/omni/user/service/SupportAccountServiceTest.java
git commit -m "feat: add rbac base"
```

---

### Task 2: 高风险后台接口接入权限和业务归属

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/StationConfigVersionService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/VenueApplicationService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityAdminService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityRiskResponseService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/client/UserInternalClient.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/controller/RefundController.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/service/RefundService.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/client/UserInternalClient.java`
- Modify: `java/java-order/src/main/java/com/omni/order/controller/OrderController.java`
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/console-paths.ts`
- Modify: `frontend/src/app/console/layout.tsx`
- Modify: `frontend/src/app/console/page.tsx`
- Modify: `frontend/src/app/console/support-accounts/page.tsx`
- Modify: `frontend/src/app/console/station-config-reviews/page.tsx`
- Modify: `frontend/src/app/console/venue/applications/page.tsx`
- Modify: `frontend/src/app/console/risk-resolutions/page.tsx`
- Modify: `frontend/src/app/console/risk-cases/page.tsx`
- Modify: `frontend/src/app/console/refunds/page.tsx`
- Modify: `frontend/src/app/console/activities/page.tsx`
- Modify: `frontend/src/app/console/tours/page.tsx`
- Create: `frontend/src/lib/console-auth.ts`
- Create: `frontend/src/lib/console-auth.test.ts`

- [ ] **Step 1: 先写前端权限判断的失败测试**

`console-auth.test.ts` 先锁定“路由是否可见”和“动作是否可用”两类判断：

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { canAccessConsolePath, canUseConsoleAction } from './console-auth'

test('support manager can access support pages but not audit pages', () => {
  const permissions = ['support.conversation.view', 'support.account.manage']
  assert.equal(canAccessConsolePath('/console/support-accounts', permissions), true)
  assert.equal(canAccessConsolePath('/console/audits', permissions), false)
})

test('organizer admin can only access own scope pages', () => {
  const permissions = ['activity.review', 'station.review']
  assert.equal(canUseConsoleAction('station.review', permissions), true)
  assert.equal(canUseConsoleAction('refund.review', permissions), false)
})
```

- [ ] **Step 2: 先跑一遍让它失败**

Run:

```powershell
node --test frontend/src/lib/console-auth.test.ts
```

Expected: 先失败，因为 `console-auth.ts` 还没有实现。

- [ ] **Step 3: 后端服务接入内部权限上下文**

每个高风险服务都加一个本地 `UserInternalClient`，从 `java-user` 拉 `InternalAuthContextResponse`，再统一走本地守卫：

```java
InternalAuthContextResponse auth = userInternalClient.getAuthContext(operatorId);
requirePermission(auth, "refund.review");
requireScope(auth, "organizer_admin", refund.getOrganizerId());
```

`RefundController`、`AdminController`、`StationConfigVersionService`、`VenueApplicationService`、`ActivityRiskResponseService` 这几处都要先做：

1. 解析操作人
2. 拉内部权限上下文
3. 校验权限点
4. 校验业务归属
5. 再调用业务服务

`OrderController` 的 `internal/create` 和 `internal/create-with-seats` 继续保留，但补上仅内部 token 可见的断言，避免外部误打。

- [ ] **Step 4: 把前端菜单和页面判断切到权限点**

`frontend/src/lib/console-paths.ts` 改成按 `permissionCodes` 判定，不再直接依赖 `admin/organizer` 两角色。

`frontend/src/app/console/layout.tsx` 和 `frontend/src/app/console/page.tsx` 改成：

```ts
const canShow = hasPermission(user.permissions, 'support.account.manage')
const roleLabel = user.role === 'platform_super_admin' ? '平台超管' : user.role === 'organizer_admin' ? '主办方管理员' : '后台'
```

`support-accounts`、`station-config-reviews`、`venue/applications`、`risk-resolutions`、`risk-cases`、`refunds`、`activities`、`tours` 这些页面里，原来的 `role === 'admin'` / `role === 'organizer'` 逐步替换成 `hasPermission(...)`。

- [ ] **Step 5: 跑前端和后端针对性测试**

Run:

```powershell
node --test frontend/src/lib/console-auth.test.ts
cd java
mvn -pl java-ticket,java-payment -Dtest=AdminControllerTest,RefundServiceBoundaryTest test
```

Expected: `console-auth` 单测通过，`AdminControllerTest` 和 `RefundServiceBoundaryTest` 至少覆盖权限拒绝和 scope 拒绝路径。

Commit:

```powershell
git add java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java java/java-ticket/src/main/java/com/omni/ticket/service/StationConfigVersionService.java java/java-ticket/src/main/java/com/omni/ticket/service/VenueApplicationService.java java/java-ticket/src/main/java/com/omni/ticket/service/ActivityAdminService.java java/java-ticket/src/main/java/com/omni/ticket/service/ActivityRiskResponseService.java java/java-ticket/src/main/java/com/omni/ticket/client/UserInternalClient.java java/java-payment/src/main/java/com/omni/payment/controller/RefundController.java java/java-payment/src/main/java/com/omni/payment/service/RefundService.java java/java-payment/src/main/java/com/omni/payment/client/UserInternalClient.java java/java-order/src/main/java/com/omni/order/controller/OrderController.java frontend/src/types/api.ts frontend/src/lib/api.ts frontend/src/lib/console-paths.ts frontend/src/app/console/layout.tsx frontend/src/app/console/page.tsx frontend/src/app/console/support-accounts/page.tsx frontend/src/app/console/station-config-reviews/page.tsx frontend/src/app/console/venue/applications/page.tsx frontend/src/app/console/risk-resolutions/page.tsx frontend/src/app/console/risk-cases/page.tsx frontend/src/app/console/refunds/page.tsx frontend/src/app/console/activities/page.tsx frontend/src/app/console/tours/page.tsx frontend/src/lib/console-auth.ts frontend/src/lib/console-auth.test.ts
git commit -m "feat: enforce console permissions"
```

---

### Task 3: 全链路人工操作审计

**Files:**
- Create: `sql/production-split/user/20260602_operation_audit_log.sql`
- Create: `java/java-common/src/main/java/com/omni/common/dto/OperationAuditWriteRequest.java`
- Create: `java/java-common/src/main/java/com/omni/common/dto/OperationAuditResponse.java`
- Create: `java/java-user/src/main/java/com/omni/user/entity/OperationAuditLog.java`
- Create: `java/java-user/src/main/java/com/omni/user/mapper/OperationAuditLogMapper.java`
- Create: `java/java-user/src/main/java/com/omni/user/service/OperationAuditService.java`
- Create: `java/java-user/src/main/java/com/omni/user/controller/InternalWorkbenchController.java`
- Modify: `java/java-user/src/main/java/com/omni/user/service/SupportAccountService.java`
- Modify: `java/java-user/src/main/java/com/omni/user/service/UserService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/StationConfigVersionService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/VenueApplicationService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityAdminService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityRiskResponseService.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/service/RefundService.java`
- Modify: `java/java-order/src/main/java/com/omni/order/controller/OrderController.java`
- Create: `java/java-common/src/main/java/com/omni/common/web/TraceIdFilter.java`
- Create: `java/java-user/src/test/java/com/omni/user/service/OperationAuditServiceTest.java`
- Modify: `java/java-user/src/test/java/com/omni/user/service/SupportAccountServiceTest.java`
- Modify: `java/java-payment/src/test/java/com/omni/payment/service/RefundServiceBoundaryTest.java`
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java`

- [ ] **Step 1: 先写审计服务的失败测试**

`OperationAuditServiceTest.java` 先锁住“成功、失败都要记”和 `traceId` 不可为空：

```java
@Test
void recordsFailedActionWithOperatorRoleAndTraceId() {
    OperationAuditWriteRequest request = new OperationAuditWriteRequest();
    request.setOperatorId(7L);
    request.setOperatorRole("support_manager");
    request.setAction("support.account.create");
    request.setTargetType("support_account");
    request.setTargetId(3L);
    request.setTargetRef("13900000002");
    request.setReason("新开客服账号");
    request.setResult("手机号重复");
    request.setSuccess(false);
    request.setErrorMessage("该手机号已存在");
    request.setTraceId("trace-abc-001");

    service.write(request);

    verify(mapper).insert(argThat(log ->
            Long.valueOf(7L).equals(log.getOperatorId())
                    && "support_manager".equals(log.getOperatorRole())
                    && "support.account.create".equals(log.getAction())
                    && Boolean.FALSE.equals(log.getSuccess())
                    && "trace-abc-001".equals(log.getTraceId())
    ));
}
```

`SupportAccountServiceTest.java` 再补一个“创建失败也要写审计”的用例。

- [ ] **Step 2: 先跑测试，让它失败**

Run:

```powershell
cd java
mvn -pl java-user -Dtest=OperationAuditServiceTest,SupportAccountServiceTest test
```

Expected: 先因审计实体、服务、过滤器还没落地而失败。

- [ ] **Step 3: 落库并把 traceId 串起来**

`20260602_operation_audit_log.sql` 只做一张表，字段按审计最小闭环来：

```sql
-- owner: java-user

CREATE TABLE IF NOT EXISTS operation_audit_log (
    id BIGSERIAL PRIMARY KEY,
    operator_id BIGINT NOT NULL,
    operator_role VARCHAR(64) NOT NULL,
    action VARCHAR(128) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    target_id BIGINT,
    target_ref VARCHAR(128),
    reason TEXT,
    result TEXT,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error_message TEXT,
    trace_id VARCHAR(128),
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operation_audit_operator_time
    ON operation_audit_log(operator_id, create_time DESC);
CREATE INDEX IF NOT EXISTS idx_operation_audit_trace_id
    ON operation_audit_log(trace_id);
```

`TraceIdFilter` 在请求进来时把 `X-Request-Id` 放进 MDC；没有就生成一个，保证审计里始终有值。

`OperationAuditWriteRequest` 至少包含：

```java
private Long operatorId;
private String operatorRole;
private String action;
private String targetType;
private Long targetId;
private String targetRef;
private String reason;
private String result;
private Boolean success;
private String errorMessage;
private String traceId;
```

- [ ] **Step 4: 把后台写操作先接到审计服务**

先接这几条：

1. `SupportAccountService.create/update/deactivate`
2. `StationConfigVersionService.approve/reject`
3. `VenueApplicationService.approve/reject`
4. `RefundService.approve/reject`
5. `ActivityAdminService.publish/deactivate/delete`
6. `ActivityRiskResponseService.approve/reject`
7. `OrderController` 的内部创建、付款、退款回写

统一写法：

```java
auditService.writeSuccess(
        operatorId,
        operatorRole,
        "refund.review.approve",
        "refund_request",
        refund.getId(),
        refund.getRefundNo(),
        reviewNote,
        "退款审批通过",
        traceId
);
```

失败分支同样写：

```java
auditService.writeFailure(
        operatorId,
        operatorRole,
        "station.review.reject",
        "station_config_version",
        versionId,
        String.valueOf(versionId),
        reviewNote,
        "驳回站点变更失败",
        e.getMessage(),
        traceId
);
```

- [ ] **Step 5: 跑测试确认审计命中**

Run:

```powershell
cd java
mvn -pl java-user,java-ticket,java-payment -Dtest=OperationAuditServiceTest,SupportAccountServiceTest,RefundServiceBoundaryTest,AdminControllerTest test
```

Expected: 审计服务单测通过，至少一条后台写操作成功路径和一条失败路径能落到 `operation_audit_log`。

Commit:

```powershell
git add sql/production-split/user/20260602_operation_audit_log.sql java/java-common/src/main/java/com/omni/common/dto/OperationAuditWriteRequest.java java/java-common/src/main/java/com/omni/common/dto/OperationAuditResponse.java java/java-user/src/main/java/com/omni/user/entity/OperationAuditLog.java java/java-user/src/main/java/com/omni/user/mapper/OperationAuditLogMapper.java java/java-user/src/main/java/com/omni/user/service/OperationAuditService.java java/java-user/src/main/java/com/omni/user/controller/InternalWorkbenchController.java java/java-user/src/main/java/com/omni/user/service/SupportAccountService.java java/java-user/src/main/java/com/omni/user/service/UserService.java java/java-ticket/src/main/java/com/omni/ticket/service/StationConfigVersionService.java java/java-ticket/src/main/java/com/omni/ticket/service/VenueApplicationService.java java/java-ticket/src/main/java/com/omni/ticket/service/ActivityAdminService.java java/java-ticket/src/main/java/com/omni/ticket/service/ActivityRiskResponseService.java java/java-payment/src/main/java/com/omni/payment/service/RefundService.java java/java-order/src/main/java/com/omni/order/controller/OrderController.java java/java-common/src/main/java/com/omni/common/web/TraceIdFilter.java java/java-user/src/test/java/com/omni/user/service/OperationAuditServiceTest.java java/java-user/src/test/java/com/omni/user/service/SupportAccountServiceTest.java java/java-payment/src/test/java/com/omni/payment/service/RefundServiceBoundaryTest.java java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java
git commit -m "feat: add operation audit log"
```

---

### Task 4: 异常任务和日结对账工作台

**Files:**
- Create: `sql/production-split/user/20260602_exception_reconcile_workbench.sql`
- Create: `java/java-common/src/main/java/com/omni/common/dto/ExceptionTaskCreateRequest.java`
- Create: `java/java-common/src/main/java/com/omni/common/dto/ExceptionTaskResponse.java`
- Create: `java/java-common/src/main/java/com/omni/common/dto/ReconciliationBatchCreateRequest.java`
- Create: `java/java-common/src/main/java/com/omni/common/dto/ReconciliationBatchResponse.java`
- Create: `java/java-common/src/main/java/com/omni/common/dto/ReconciliationDifferenceResponse.java`
- Create: `java/java-user/src/main/java/com/omni/user/entity/ExceptionTask.java`
- Create: `java/java-user/src/main/java/com/omni/user/entity/ExceptionTaskEvidence.java`
- Create: `java/java-user/src/main/java/com/omni/user/entity/ReconciliationBatch.java`
- Create: `java/java-user/src/main/java/com/omni/user/entity/ReconciliationDetail.java`
- Create: `java/java-user/src/main/java/com/omni/user/entity/ReconciliationDifference.java`
- Create: `java/java-user/src/main/java/com/omni/user/mapper/ExceptionTaskMapper.java`
- Create: `java/java-user/src/main/java/com/omni/user/mapper/ReconciliationBatchMapper.java`
- Create: `java/java-user/src/main/java/com/omni/user/service/ExceptionWorkbenchService.java`
- Create: `java/java-user/src/main/java/com/omni/user/service/ReconciliationService.java`
- Create: `java/java-user/src/main/java/com/omni/user/controller/InternalWorkbenchController.java`
- Modify: `java/java-user/src/main/java/com/omni/user/service/OperationAuditService.java`
- Modify: `java/java-payment/src/main/java/com/omni/payment/service/RefundService.java`
- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TicketSalesInternalService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/CheckInService.java`
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/app/console/exception-tasks/page.tsx`
- Create: `frontend/src/app/console/reconciliation/page.tsx`
- Modify: `frontend/src/app/console/layout.tsx`

- [ ] **Step 1: 先写异常任务和对账的失败测试**

`ExceptionWorkbenchServiceTest` 先锁住两件事：

```java
@Test
void createsExceptionTaskWhenRefundBecomesCompensationRequired() {
    ExceptionTaskCreateRequest request = new ExceptionTaskCreateRequest();
    request.setTaskType("abnormal_refund");
    request.setBusinessNo("RF202606020001");
    request.setOrderNo("OM202606020001");
    request.setReason("支付宝退款结果未知");
    request.setSeverity("high");
    request.setEvidenceUrls(List.of("https://example.com/evidence/1.png"));

    ExceptionTaskResponse response = service.create(request);

    assertEquals("abnormal_refund", response.getTaskType());
    assertEquals("pending", response.getStatus());
}

@Test
void createsReconciliationBatchFromLocalPaymentsAndRefunds() {
    ReconciliationBatchCreateRequest request = new ReconciliationBatchCreateRequest();
    request.setBizDate(LocalDate.of(2026, 6, 2));

    ReconciliationBatchResponse response = service.createBatch(request);

    assertEquals(LocalDate.of(2026, 6, 2), response.getBizDate());
    assertNotNull(response.getBatchNo());
}
```

- [ ] **Step 2: 先跑测试，让它失败**

Run:

```powershell
cd java
mvn -pl java-user -Dtest=ExceptionWorkbenchServiceTest,ReconciliationServiceTest test
```

Expected: 先因表、DTO、服务不存在而失败。

- [ ] **Step 3: 落库并把中央工作台建起来**

`20260602_exception_reconcile_workbench.sql` 建四个核心对象：

```sql
-- owner: java-user

CREATE TABLE IF NOT EXISTS exception_task (
    id BIGSERIAL PRIMARY KEY,
    task_type VARCHAR(64) NOT NULL,
    business_no VARCHAR(128),
    order_no VARCHAR(128),
    payment_no VARCHAR(128),
    refund_no VARCHAR(128),
    ticket_no VARCHAR(128),
    severity VARCHAR(16) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    reason TEXT,
    result TEXT,
    operator_id BIGINT,
    operator_role VARCHAR(64),
    trace_id VARCHAR(128),
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reconciliation_batch (
    id BIGSERIAL PRIMARY KEY,
    batch_no VARCHAR(128) NOT NULL UNIQUE,
    biz_date DATE NOT NULL,
    source_type VARCHAR(32) NOT NULL DEFAULT 'local',
    status VARCHAR(32) NOT NULL DEFAULT 'generated',
    summary_json TEXT,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reconciliation_difference (
    id BIGSERIAL PRIMARY KEY,
    batch_no VARCHAR(128) NOT NULL,
    diff_type VARCHAR(64) NOT NULL,
    business_no VARCHAR(128),
    expected_amount NUMERIC(18,2),
    actual_amount NUMERIC(18,2),
    diff_amount NUMERIC(18,2),
    reason TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'open',
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

`ExceptionWorkbenchService` 负责统一列表、证据查看、标记处理、触发补偿；`ReconciliationService` 负责按自然日从本地 `payment/refund_request` 汇总批次和差异。

- [ ] **Step 4: 把异常事件和日结事件接起来**

业务服务只做两类上报：

1. 退款、重复支付、出票失败、核验冲突 -> `exception_task`
2. 日结汇总 -> `reconciliation_batch`

上报请求统一长这样：

```java
ExceptionTaskCreateRequest request = new ExceptionTaskCreateRequest();
request.setTaskType("duplicate_payment");
request.setBusinessNo(paymentNo);
request.setOrderNo(orderNo);
request.setReason("同一订单出现重复支付");
request.setSeverity("high");
request.setEvidenceUrls(List.of());
```

`java-user` 再提供两个后台接口：

```java
@GetMapping("/console/exception-tasks")
@GetMapping("/console/reconciliation/batches")
```

前端新增两个控制台页面：

1. `frontend/src/app/console/exception-tasks/page.tsx`
2. `frontend/src/app/console/reconciliation/page.tsx`

菜单只给平台超管和审计权限用户展示。

- [ ] **Step 5: 跑测试确认工作台可用**

Run:

```powershell
cd java
mvn -pl java-user -Dtest=ExceptionWorkbenchServiceTest,ReconciliationServiceTest test
cd frontend
npm run typecheck
```

Expected: 异常任务和日结批次单测通过，前端类型检查通过。

Commit:

```powershell
git add sql/production-split/user/20260602_exception_reconcile_workbench.sql java/java-common/src/main/java/com/omni/common/dto/ExceptionTaskCreateRequest.java java/java-common/src/main/java/com/omni/common/dto/ExceptionTaskResponse.java java/java-common/src/main/java/com/omni/common/dto/ReconciliationBatchCreateRequest.java java/java-common/src/main/java/com/omni/common/dto/ReconciliationBatchResponse.java java/java-common/src/main/java/com/omni/common/dto/ReconciliationDifferenceResponse.java java/java-user/src/main/java/com/omni/user/entity/ExceptionTask.java java/java-user/src/main/java/com/omni/user/entity/ExceptionTaskEvidence.java java/java-user/src/main/java/com/omni/user/entity/ReconciliationBatch.java java/java-user/src/main/java/com/omni/user/entity/ReconciliationDetail.java java/java-user/src/main/java/com/omni/user/entity/ReconciliationDifference.java java/java-user/src/main/java/com/omni/user/mapper/ExceptionTaskMapper.java java/java-user/src/main/java/com/omni/user/mapper/ReconciliationBatchMapper.java java/java-user/src/main/java/com/omni/user/service/ExceptionWorkbenchService.java java/java-user/src/main/java/com/omni/user/service/ReconciliationService.java java/java-user/src/main/java/com/omni/user/controller/InternalWorkbenchController.java java/java-user/src/main/java/com/omni/user/service/OperationAuditService.java java/java-payment/src/main/java/com/omni/payment/service/RefundService.java java/java-order/src/main/java/com/omni/order/service/OrderService.java java/java-ticket/src/main/java/com/omni/ticket/service/TicketSalesInternalService.java java/java-ticket/src/main/java/com/omni/ticket/service/CheckInService.java frontend/src/lib/api.ts frontend/src/app/console/exception-tasks/page.tsx frontend/src/app/console/reconciliation/page.tsx frontend/src/app/console/layout.tsx
git commit -m "feat: add exception and reconciliation workbench"
```

---

### Task 5: GlobalDialog 统一和后台原生弹窗清零

**Files:**
- Modify: `frontend/src/components/GlobalDialog.tsx`
- Modify: `frontend/src/app/layout.tsx`
- Modify: `frontend/src/app/console/station-config-reviews/page.tsx`
- Modify: `frontend/src/app/console/activities/[id]/seat-layout/page.tsx`
- Modify: `frontend/src/app/console/sessions/[id]/seat-layout/page.tsx`
- Modify: `frontend/src/app/console/stations/[id]/seatcraft/page.tsx`
- Modify: `frontend/src/app/console/activities/page.tsx`
- Modify: `frontend/src/app/console/artists/page.tsx`
- Modify: `frontend/src/app/console/refunds/page.tsx`
- Create: `frontend/scripts/check-console-native-dialogs.mjs`
- Modify: `frontend/package.json`

- [ ] **Step 1: 先写前端弹窗组件的失败测试或脚本校验**

这里不强行加 React 组件测试，直接把“后台目录不允许出现原生弹窗”做成脚本先锁住：

```js
// frontend/scripts/check-console-native-dialogs.mjs
import { execFileSync } from 'node:child_process'

const output = execFileSync('rg', [
  '-n',
  'window\\.(prompt|confirm|alert)\\(',
  'frontend/src/app/console'
], { encoding: 'utf8' })

if (output.trim()) {
  console.error('后台目录仍然存在原生弹窗调用，请改用 GlobalDialog。')
  process.exit(1)
}
```

在 `package.json` 加：

```json
{
  "scripts": {
    "check:console-dialogs": "node scripts/check-console-native-dialogs.mjs"
  }
}
```

- [ ] **Step 2: 先跑脚本，让它失败**

Run:

```powershell
cd frontend
npm run check:console-dialogs
```

Expected: 现在会失败，因为 `frontend/src/app/console` 里还残留 `window.confirm/window.prompt/alert`。

- [ ] **Step 3: 扩展 `GlobalDialog` 能力**

把 `GlobalDialog.tsx` 改成支持四种模式：确认、危险确认、单行原因输入、多行备注输入。核心 props 变成：

```ts
type DialogType = 'alert' | 'confirm' | 'danger' | 'reason' | 'textarea'

type DialogOptions = {
  title?: string
  content: string
  confirmText?: string
  cancelText?: string
  type: DialogType
  placeholder?: string
  defaultValue?: string
  textareaRows?: number
  onConfirm?: (value?: string) => void
  onCancel?: () => void
}
```

渲染上只做一件事：`danger` 用红色确认按钮，`reason/textarea` 显示输入框或文本域，其他逻辑继续复用现有全局队列。

- [ ] **Step 4: 把残留的原生弹窗逐个替换掉**

先处理这几处：

1. `station-config-reviews/page.tsx` 的 `window.prompt`
2. `activities/[id]/seat-layout/page.tsx` 的 `window.confirm`
3. `sessions/[id]/seat-layout/page.tsx` 的 `window.confirm`
4. `stations/[id]/seatcraft/page.tsx` 的 `window.confirm`
5. `artists/page.tsx` 的 `alert`
6. `activities/page.tsx` 里如果还有回退弹窗，一并换成 `globalAlert/globalConfirm/globalPrompt`

替换后的调用统一长这样：

```ts
const reviewNote = await globalPrompt({
  title: action === 'approve' ? '通过备注' : '驳回原因',
  content: action === 'approve' ? '请输入通过备注（可留空）' : '请输入驳回原因（可留空）',
  type: 'reason'
})
```

```ts
const ok = await globalConfirm({
  title: '危险确认',
  content: '确认删除这条版本记录？删除后不可恢复。',
  type: 'danger',
  confirmText: '确认删除'
})
```

- [ ] **Step 5: 跑脚本和前端检查**

Run:

```powershell
cd frontend
npm run check:console-dialogs
npm run typecheck
npm run lint
```

Expected: `check:console-dialogs` 通过，`typecheck` 和 `lint` 通过。

Commit:

```powershell
git add frontend/src/components/GlobalDialog.tsx frontend/src/app/layout.tsx frontend/src/app/console/station-config-reviews/page.tsx frontend/src/app/console/activities/[id]/seat-layout/page.tsx frontend/src/app/console/sessions/[id]/seat-layout/page.tsx frontend/src/app/console/stations/[id]/seatcraft/page.tsx frontend/src/app/console/activities/page.tsx frontend/src/app/console/artists/page.tsx frontend/src/app/console/refunds/page.tsx frontend/scripts/check-console-native-dialogs.mjs frontend/package.json
git commit -m "feat: unify console dialogs"
```

---

### Task 6: 最终验收和回归

**Files:**
- All files touched above.

- [ ] **Step 1: 跑 `java-user`、`java-ticket`、`java-payment` 的聚合测试**

Run:

```powershell
cd java
mvn -pl java-user,java-ticket,java-payment test
```

Expected: RBAC、权限接入、审计、异常工作台的核心单测都通过。

- [ ] **Step 2: 跑前端完整检查**

Run:

```powershell
cd frontend
npm run check:console-dialogs
npm run typecheck
npm run lint
npm run build
```

Expected: 全部通过。

- [ ] **Step 3: 跑 SQL split 校验**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\check-production-split-sql.ps1
```

Expected: 新增的三份 `sql/production-split/user/*.sql` 都能过检查。

- [ ] **Step 4: 手工烟测关键路径**

只跑本地已经起好的环境，不拉新依赖、不拉镜像：

1. 平台超管打开 `/console/support-accounts`，能看到账号管理和审计入口
2. 普通客服打不开客服账号管理
3. 客服主管能看客服会话并管理客服账号
4. 主办方管理员只能处理自己业务范围内的审核
5. 后台页面不再出现任何原生 `window.prompt/window.confirm/window.alert`
6. 审计列表能看到操作人、对象、原因、结果、`traceId`
7. 异常任务和日结对账页面都能正常加载

- [ ] **Step 5: 收口并提交最终变更**

把所有改动按模块分批提交，避免一次性大提交。

---

## Self-Review

- Spec coverage:
  - RBAC 基础和 `support_role` 覆盖了。
  - 高风险后台接口接入覆盖了客服账号、退款、风控、站点变更、场馆审核。
  - `operation_audit_log` 和失败路径写入覆盖了。
  - 异常任务、补偿、日结对账覆盖了。
  - 后台原生弹窗替换和禁用校验覆盖了。
- Placeholder scan:
  - 没有 `TBD/TODO/implement later` 之类占位。
  - 每个任务都给了明确文件、测试命令和预期结果。
- Type consistency:
  - `InternalAuthContextResponse`、`OperationAuditWriteRequest`、`ExceptionTaskCreateRequest`、`ReconciliationBatchCreateRequest` 的命名在全篇一致。
  - `support_manager/support_agent/platform_super_admin/organizer_admin` 作为角色码在前后文一致。
  - `support.account.manage / refund.review / station.review / venue.review / audit.view / reconcile.view / compensation.execute` 作为权限点在全篇一致。

