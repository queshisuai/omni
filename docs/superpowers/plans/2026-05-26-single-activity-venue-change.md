# Single Activity Venue Change Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 普通单活动支持提交场地临时变更申请，同时锁定城市并在已有已支付订单时拒绝变更。

**Architecture:** 继续复用 `station_config_version` 的 `change_venue` 版本流和 `venue_application` 审批资料流。后端在提交版本时做强约束：普通活动城市不可变、整场活动存在任意已支付订单则拒绝提交；前端在活动配置中心提供城市锁定的场地变更申请入口。

**Tech Stack:** Java Spring Boot、MyBatis-Plus、OpenFeign、Next.js 16、React 19、TypeScript。

---

## Files

- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/StationConfigVersionServiceTest.java`，新增场地变更约束回归测试。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/StationConfigVersionService.java`，注入订单内部客户端并在 `change_venue` 提交时校验。
- Modify: `frontend/src/components/station-config/StationVenueApprovalForm.tsx`，支持城市锁定。
- Modify: `frontend/src/app/console/activities/[id]/edit/page.tsx`，增加单活动场地变更申请入口。

## Tasks

### Task 1: 后端测试覆盖单活动场地变更约束

**Files:**
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/StationConfigVersionServiceTest.java`

- [ ] **Step 1: 写已支付订单拦截失败测试**

在测试类中新增 `OrderInternalClient` mock，并调整 `setUp()` 构造函数参数。新增测试：普通活动 `change_venue` 草稿提交时，如果活动下任意场次存在已支付订单，抛 400 且不更新版本状态。

- [ ] **Step 2: 运行测试确认失败**

Run: `mvn test -pl java-ticket "-Dtest=StationConfigVersionServiceTest#submitActivityVenueChangeFailsWhenActivityHasPaidOrders"`

Expected: 编译失败或测试失败，因为 `StationConfigVersionService` 尚未注入/调用 `OrderInternalClient`。

- [ ] **Step 3: 写城市锁定失败测试**

新增测试：普通活动当前站点城市是 `北京`，`change_venue` 草稿城市传 `上海` 时，提交抛 400，消息为 `场地变更不能修改城市`，且不调用订单服务。

- [ ] **Step 4: 运行测试确认失败**

Run: `mvn test -pl java-ticket "-Dtest=StationConfigVersionServiceTest#submitActivityVenueChangeRejectsCityChange"`

Expected: FAIL，因为现有实现不会校验城市变化。

### Task 2: 后端实现提交校验

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/StationConfigVersionService.java`

- [ ] **Step 1: 注入订单内部客户端**

给服务增加 `OrderInternalClient orderInternalClient` 和 `@Value("${internal.api.token:${INTERNAL_API_TOKEN:}}") String internalApiToken` 构造参数。

- [ ] **Step 2: 校验普通活动场地变更城市锁定**

在 `validateSubmit` 中读取站点；当 `changeType == change_venue` 且 `station.activityId != null` 时，如果版本城市非空且与站点城市不同，抛 `场地变更不能修改城市`。

- [ ] **Step 3: 校验普通活动已支付订单**

查询该活动所有有效场次 ID，调用 `orderInternalClient.countPaidBySessions(new PaidOrderCountRequest(sessionIds), internalApiToken)`。如果返回已支付订单数大于 0，抛 `活动已有已支付订单，请先完成退款/下架清理后再申请场地变更`。

- [ ] **Step 4: 运行后端定向测试**

Run: `mvn test -pl java-ticket "-Dtest=StationConfigVersionServiceTest#submitActivityVenueChangeFailsWhenActivityHasPaidOrders,StationConfigVersionServiceTest#submitActivityVenueChangeRejectsCityChange"`

Expected: PASS。

### Task 3: 前端城市锁定表单

**Files:**
- Modify: `frontend/src/components/station-config/StationVenueApprovalForm.tsx`

- [ ] **Step 1: 增加 `cityLocked?: boolean` prop**

城市输入框在锁定时 disabled，并使用禁用样式。选择平台场馆时如果锁定，不覆盖城市字段。

- [ ] **Step 2: 运行类型检查**

Run: `pnpm typecheck`

Expected: PASS。

### Task 4: 活动配置中心增加场地变更入口

**Files:**
- Modify: `frontend/src/app/console/activities/[id]/edit/page.tsx`

- [ ] **Step 1: 加载活动默认站点与平台场馆列表**

复用 `getActivityStation(activityId)` 和 `listAdminVenues(userId)`。

- [ ] **Step 2: 新增场地变更申请区块**

使用 `StationVenueApprovalForm`，城市传当前站点城市并设置 `cityLocked`。

- [ ] **Step 3: 提交场馆申请和站点配置版本**

先调用 `submitVenueApplication`，再创建 `change_venue` 类型的站点配置版本，最后调用提交接口。成功后提示审核通过前不影响当前场次，且变更后需重新检查 SeatCraft 座位票档。

- [ ] **Step 4: 运行类型检查**

Run: `pnpm typecheck`

Expected: PASS。

### Task 5: 最终验证

- [ ] **Step 1: 后端相关测试**

Run: `mvn test -pl java-ticket "-Dtest=StationConfigVersionServiceTest,VenueApplicationServiceTest"`

Expected: PASS。

- [ ] **Step 2: 前端类型检查**

Run: `pnpm typecheck`

Expected: PASS。

- [ ] **Step 3: 微服务边界检查**

Run: `powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1`

Expected: `All microservice boundary checks passed.`

- [ ] **Step 4: diff whitespace 检查**

Run: `git diff --check`

Expected: 无 whitespace error。
