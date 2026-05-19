# 后台管理修复与场馆座位编辑器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复后台管理缺失闭环，补齐商户资格取消状态、后台真实统计、活动基础编辑、场馆座位模板可视化编辑与安全同步。

**Architecture:** 保持现有微服务边界：`java-ticket` 负责后台权限、活动、场馆、座位模板和统一统计入口；`java-order` 只补内部已支付订单统计；前端统一通过 `frontend/src/lib/api.ts` 调用。场馆模板变更后只自动同步无锁座、无售座、无订单关联的场次，已有交易数据的场次跳过。

**Tech Stack:** Java Spring Boot 2.7、Spring Cloud OpenFeign、MyBatis-Plus、PostgreSQL、Next.js 16、React 19、TypeScript、pnpm、Maven、JUnit 5、Mockito。

---

## File Structure

- Modify: `frontend/src/app/merchant/page.tsx`：取消资格状态展示。
- Modify: `frontend/src/types/api.ts`：新增统计、场馆座位、同步结果类型。
- Modify: `frontend/src/lib/api.ts`：新增后台统计、活动编辑、座位模板 API。
- Modify: `frontend/src/app/console/page.tsx`：后台首页真实统计。
- Create: `frontend/src/app/console/activities/[id]/edit/page.tsx`：活动基础编辑页。
- Modify: `frontend/src/app/console/sessions/page.tsx`：支持 `activityId` 查询参数筛选。
- Modify: `frontend/src/app/console/venue/page.tsx`：配置区域跳转座位模板编辑页。
- Create: `frontend/src/app/console/venue/[id]/seats/page.tsx`：场馆座位模板可视化编辑器。
- Create: `java/java-order/src/main/java/com/omni/order/dto/PaidOrderCountRequest.java`：内部订单统计请求。
- Create: `java/java-order/src/main/java/com/omni/order/dto/PaidOrderCountResponse.java`：内部订单统计响应。
- Modify: `java/java-order/src/main/java/com/omni/order/mapper/OrderMapper.java`：按场次统计已支付订单。
- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java`：订单统计 service 方法。
- Modify: `java/java-order/src/main/java/com/omni/order/controller/OrderController.java`：内部统计接口。
- Create: `java/java-order/src/test/java/com/omni/order/service/OrderAdminStatsServiceTest.java`：订单统计测试。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/AdminSummaryResponse.java`：后台首页统计响应。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/PaidOrderCountRequest.java`：调用订单服务统计请求。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/PaidOrderCountResponse.java`：订单统计响应镜像。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/VenueSeatRequest.java`：座位新增/更新请求。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/SeatTemplateSyncResponse.java`：模板同步结果。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/client/OrderInternalClient.java`：新增内部统计 Feign 方法。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/AdminSummaryService.java`：聚合后台统计。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SeatTemplateService.java`：座位模板编辑能力。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SessionSeatService.java`：安全同步能力。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/mapper/SessionSeatMapper.java`：交易检测和重建 SQL。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`：新增统计、活动详情、座位模板接口。
- Create: `java/java-ticket/src/test/java/com/omni/ticket/service/AdminSummaryServiceTest.java`：统计测试。
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/SeatTemplateServiceTest.java`：座位编辑测试。
- Create: `java/java-ticket/src/test/java/com/omni/ticket/service/SessionSeatSyncServiceTest.java`：安全同步测试。

---

## Task 1: 修复商户资格取消状态展示

**Files:**
- Modify: `frontend/src/app/merchant/page.tsx`

- [ ] **Step 1: 保留现有取消资格判断**

确认并复用：

```tsx
const isCancelledOrganizer = userInfo?.organizerStatus === 3 && userInfo?.role === 'user'
const canEditForm = isCancelledOrganizer || !application || application.status === 0 || application.status === 2
const isApproved = !isCancelledOrganizer && application?.status === 1
```

- [ ] **Step 2: 增加当前资格状态 meta**

在 `statusMeta` 后增加：

```tsx
function currentQualificationMeta(isCancelled: boolean, application?: OrganizerApplicationVO | null) {
  if (isCancelled) return { text: '主办方资格已取消', color: '#7c3aed', bg: '#f5f3ff' }
  if (!application) return null
  return statusMeta(application.status)
}
```

把 `statusInfo` 改成：

```tsx
const statusInfo = useMemo(() => currentQualificationMeta(isCancelledOrganizer, application), [application, isCancelledOrganizer])
```

- [ ] **Step 3: 修改状态说明文字**

当前状态说明优先判断 `isCancelledOrganizer`：

```tsx
{isCancelledOrganizer
  ? '主办方资格已取消，可重新提交入驻申请。'
  : application.status === 1
    ? '已通过，可进入后台。'
    : application.status === 2
      ? '驳回后可修改后重新提交。'
      : '资料正在审核中。'}
```

- [ ] **Step 4: 右侧状态说明新增取消资格**

追加：

```tsx
<StateItem label="3 已取消资格" desc="账号已降级为普通用户，可重新提交入驻申请。" color="#7c3aed" />
```

- [ ] **Step 5: 验证**

Run: `pnpm run typecheck`

Workdir: `frontend`

Expected: PASS。

---

## Task 2: 订单服务增加已支付订单统计

**Files:**
- Create: `java/java-order/src/main/java/com/omni/order/dto/PaidOrderCountRequest.java`
- Create: `java/java-order/src/main/java/com/omni/order/dto/PaidOrderCountResponse.java`
- Modify: `java/java-order/src/main/java/com/omni/order/mapper/OrderMapper.java`
- Modify: `java/java-order/src/main/java/com/omni/order/service/OrderService.java`
- Modify: `java/java-order/src/main/java/com/omni/order/controller/OrderController.java`
- Create: `java/java-order/src/test/java/com/omni/order/service/OrderAdminStatsServiceTest.java`

- [ ] **Step 1: 写失败测试**

创建 `OrderAdminStatsServiceTest`，验证非空 sessionIds 委托 mapper，空列表返回 0。

关键断言：

```java
assertEquals(3L, orderService.countPaidOrdersBySessions(List.of(10L, 11L)));
assertEquals(0L, orderService.countPaidOrdersBySessions(List.of()));
```

- [ ] **Step 2: 运行失败测试**

Run: `mvn test -pl java-order -Dtest=OrderAdminStatsServiceTest`

Workdir: `java`

Expected: FAIL，`countPaidOrdersBySessions` 不存在。

- [ ] **Step 3: 新增订单统计 DTO**

`PaidOrderCountRequest` 字段：

```java
private List<Long> sessionIds;
```

`PaidOrderCountResponse` 字段：

```java
private Long paidOrderCount;
```

- [ ] **Step 4: 增加 mapper SQL**

在 `OrderMapper` 增加：

```java
@Select({"<script>",
        "SELECT COUNT(*) FROM \"order\" WHERE status = 2",
        "<if test='sessionIds != null and sessionIds.size() > 0'>",
        "AND session_id IN",
        "<foreach collection='sessionIds' item='id' open='(' separator=',' close=')'>#{id}</foreach>",
        "</if>",
        "</script>"})
Long countPaidOrdersBySessions(@Param("sessionIds") List<Long> sessionIds);
```

- [ ] **Step 5: 增加 service 方法**

```java
public Long countPaidOrdersBySessions(List<Long> sessionIds) {
    if (sessionIds == null || sessionIds.isEmpty()) return 0L;
    Long count = orderMapper.countPaidOrdersBySessions(sessionIds);
    return count != null ? count : 0L;
}
```

- [ ] **Step 6: 增加内部接口**

在 `OrderController` 增加 `POST /api/order/internal/paid-count-by-sessions`，复用 `isValidInternalToken`，返回 `PaidOrderCountResponse`。

- [ ] **Step 7: 验证**

Run: `mvn test -pl java-order -Dtest=OrderAdminStatsServiceTest`

Workdir: `java`

Expected: PASS。

---

## Task 3: 票务服务增加后台统计汇总

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/AdminSummaryResponse.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/PaidOrderCountRequest.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/PaidOrderCountResponse.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/client/OrderInternalClient.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/AdminSummaryService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Create: `java/java-ticket/src/test/java/com/omni/ticket/service/AdminSummaryServiceTest.java`

- [ ] **Step 1: 写失败测试**

测试 admin 汇总返回全平台数量，organizer 汇总只过滤自己活动。核心断言：

```java
assertEquals(30L, service.getSummary(2002L).getActivityCount());
assertEquals(90L, service.getSummary(2002L).getTicketTypeCount());
assertEquals(12L, service.getSummary(2002L).getPaidOrderCount());
```

- [ ] **Step 2: 运行失败测试**

Run: `mvn test -pl java-ticket -Dtest=AdminSummaryServiceTest`

Workdir: `java`

Expected: FAIL，`AdminSummaryService` 不存在。

- [ ] **Step 3: 新增 DTO 与 Feign 方法**

`AdminSummaryResponse` 包含：

```java
private Long activityCount;
private Long ticketTypeCount;
private Long paidOrderCount;
```

`OrderInternalClient` 增加：

```java
@PostMapping("/api/order/internal/paid-count-by-sessions")
Result<PaidOrderCountResponse> countPaidBySessions(@RequestBody PaidOrderCountRequest request,
                                                   @RequestHeader("X-Internal-Token") String internalToken);
```

- [ ] **Step 4: 实现 AdminSummaryService**

逻辑：查用户角色；admin 不过滤活动，organizer 按 `organizerId=userId` 过滤；根据活动查场次；根据场次统计票档；调用订单内部接口统计已支付订单。

- [ ] **Step 5: AdminController 暴露接口**

增加：

```java
@GetMapping("/summary")
public Result<AdminSummaryResponse> getAdminSummary(@RequestParam Long userId) {
    return Result.success(adminSummaryService.getSummary(userId));
}
```

- [ ] **Step 6: 验证**

Run: `mvn test -pl java-ticket -Dtest=AdminSummaryServiceTest`

Workdir: `java`

Expected: PASS。

---

## Task 4: 后台首页接入真实统计

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/app/console/page.tsx`

- [ ] **Step 1: 增加类型**

```ts
export interface AdminSummaryVO {
  activityCount: number
  ticketTypeCount: number
  paidOrderCount: number
}
```

- [ ] **Step 2: 增加 API**

```ts
export async function getAdminSummary(userId: number) {
  return request<import('@/types/api').AdminSummaryVO>(`/api/ticket/admin/summary?userId=${userId}`)
}
```

- [ ] **Step 3: 修改首页卡片**

`stats` 改为三字段，调用 `getAdminSummary`，票档卡展示 `stats.ticketTypeCount`，订单卡展示 `stats.paidOrderCount`，订单文案改为“已支付订单数”。

- [ ] **Step 4: 验证**

Run: `pnpm run typecheck`

Workdir: `frontend`

Expected: PASS。

---

## Task 5: 活动基础编辑页

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/app/console/activities/[id]/edit/page.tsx`
- Modify: `frontend/src/app/console/sessions/page.tsx`

- [ ] **Step 1: 后端增加活动详情接口**

在 `AdminController` 增加 `GET /api/ticket/admin/activities/{id}?userId=`，权限规则与更新活动一致。

- [ ] **Step 2: 前端增加 API**

新增 `getAdminActivity(id, userId)` 和 `updateAdminActivity(id, params)`。

- [ ] **Step 3: 创建编辑页**

页面字段：活动名称、分类、艺人 ID、海报 URL、描述。保存后提示“活动基础信息已保存”。页面提供两个入口：返回活动列表、跳转 `/console/sessions?activityId=<id>`。

- [ ] **Step 4: 场次页读取 activityId 查询参数**

使用 `useSearchParams()` 初始化活动筛选值，使从编辑页跳转后默认筛选对应活动。

- [ ] **Step 5: 验证**

Run: `mvn test -pl java-ticket -Dtest=AdminSummaryServiceTest`

Workdir: `java`

Expected: PASS。

Run: `pnpm run typecheck`

Workdir: `frontend`

Expected: PASS。

---

## Task 6: 座位模板后端编辑与安全同步

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/VenueSeatRequest.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/SeatTemplateSyncResponse.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SeatTemplateService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SessionSeatService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/mapper/SessionSeatMapper.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/SeatTemplateServiceTest.java`
- Create: `java/java-ticket/src/test/java/com/omni/ticket/service/SessionSeatSyncServiceTest.java`

- [ ] **Step 1: 写失败测试**

扩展 `SeatTemplateServiceTest`：`updateSeat` 能修改 `rowNo`、`seatNo`、`seatLabel`、`x`、`y`、`status` 并调用 `venueSeatMapper.updateById`。

创建 `SessionSeatSyncServiceTest`：当 `countTradingSeats(sessionId)=0` 时可重建；当大于 0 时跳过同步。

- [ ] **Step 2: 运行失败测试**

Run: `mvn test -pl java-ticket -Dtest=SeatTemplateServiceTest,SessionSeatSyncServiceTest`

Workdir: `java`

Expected: FAIL，座位请求 DTO 和同步方法不存在。

- [ ] **Step 3: 新增 DTO**

`VenueSeatRequest` 字段：`userId`、`venueId`、`areaId`、`rowNo`、`seatNo`、`seatLabel`、`x`、`y`、`status`。

`SeatTemplateSyncResponse` 字段：`syncedSessionCount`、`skippedSessionCount`、`skippedSessionIds`。

- [ ] **Step 4: SeatTemplateService 增加座位编辑**

新增方法：`createSeat`、`updateSeat`、`deleteSeat`。全部要求 `requireAdmin(userId)`。新增座位默认 `status=1`、`x=0`、`y=0`，`seatLabel` 为空时按“排号+座号”生成。

- [ ] **Step 5: SessionSeatMapper 增加交易检测**

增加：

```java
@Select("SELECT COUNT(*) FROM session_seat WHERE session_id = #{sessionId} AND (status IN (2, 3) OR order_id IS NOT NULL)")
Long countTradingSeats(Long sessionId);

@Delete("DELETE FROM session_seat WHERE session_id = #{sessionId}")
int deleteBySessionId(Long sessionId);
```

- [ ] **Step 6: SessionSeatService 增加安全重建**

新增 `canSyncSession(sessionId)` 和 `rebuildForSession(sessionId)`。重建时先删除该场次快照，再按当前 `venue_seat.status=1` 重新生成 `session_seat`。

- [ ] **Step 7: AdminController 增加座位接口**

新增：

- `GET /api/ticket/admin/venues/{id}/seats?userId=`
- `POST /api/ticket/admin/venues/{id}/seats`
- `PUT /api/ticket/admin/venue-seats/{seatId}`
- `DELETE /api/ticket/admin/venue-seats/{seatId}?userId=`

- [ ] **Step 8: 验证**

Run: `mvn test -pl java-ticket -Dtest=SeatTemplateServiceTest,SessionSeatSyncServiceTest`

Workdir: `java`

Expected: PASS。

---

## Task 7: 场馆座位模板编辑器前端

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/app/console/venue/page.tsx`
- Create: `frontend/src/app/console/venue/[id]/seats/page.tsx`

- [ ] **Step 1: 增加类型**

新增 `VenueSeatVO`、`VenueSeatRequest`、`SeatTemplateSyncResponseVO`。

- [ ] **Step 2: 增加 API**

新增 `listVenueSeats`、`createVenueSeat`、`updateVenueSeat`、`deleteVenueSeat`。复用已有 `listVenueAreas`、`createVenueArea`。

- [ ] **Step 3: 场馆列表改跳转**

`配置区域` 按钮跳转 `/console/venue/${v.id}/seats`。

- [ ] **Step 4: 创建座位编辑页**

页面布局：顶部返回场馆管理；左侧区域列表与批量生成表单；中间按区域颜色渲染座位点阵；右侧展示选中座位表单，可编辑排号、座号、显示名、坐标、状态。提供新增座位、保存座位、删除座位按钮。

- [ ] **Step 5: 验证**

Run: `pnpm run typecheck`

Workdir: `frontend`

Expected: PASS。

---

## Task 8: 全量验证与提交检查点

**Files:**
- All files changed above.

- [ ] **Step 1: 运行后端测试**

Run: `mvn test -pl java-user,java-ticket,java-order -am`

Workdir: `java`

Expected: PASS。

- [ ] **Step 2: 运行前端类型检查**

Run: `pnpm run typecheck`

Workdir: `frontend`

Expected: PASS。

- [ ] **Step 3: 检查差异**

Run: `git status --short`

Expected: 只包含本计划涉及文件。

Run: `git diff --stat`

Expected: 变更集中在后台统计、活动编辑、座位模板、商户状态展示。

- [ ] **Step 4: 手工 API 验证**

验证接口：

- `GET /api/ticket/admin/summary?userId=2002`
- `GET /api/ticket/admin/activities/1?userId=2002`
- `GET /api/ticket/admin/venues/1/seats?userId=2002`
- `POST /api/order/internal/paid-count-by-sessions` 带正确 `X-Internal-Token`

- [ ] **Step 5: 等待用户确认是否提交**

不要自动提交。向用户报告测试结果和变更摘要，等待明确提交指令。

---

## Self-Review

- Spec coverage: 商户状态、统计、活动编辑、座位模板编辑、安全同步、验证步骤均有任务覆盖。
- Placeholder scan: 没有 `TBD` 或未定义范围；座位编辑与同步均给出明确接口和验证。
- Type consistency: 统计字段统一为 `activityCount`、`ticketTypeCount`、`paidOrderCount`；座位类型统一为 `VenueSeat` / `VenueSeatVO`；同步响应统一为 `SeatTemplateSyncResponse`。
