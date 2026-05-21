# 后台活动生命周期与 SeatCraft 票档 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 admin/商户活动生命周期、下架退款闭环、删除原因审计、SeatCraft 票档创建入口，以及旧点阵座位数据到 SeatCraft layout 的迁移。

**Architecture:** 保持微服务边界不变：`java-ticket` 管活动/场次/票档/座位布局，`java-order` 管订单状态，`java-payment` 管支付退款流水。活动删除改为状态流转和逻辑删除，有已支付订单时通过 internal API 触发退款；前端 B/C 端统一使用 SeatCraft，不再把旧点阵图作为主流程。

**Tech Stack:** Java Spring Boot + MyBatis-Plus + PostgreSQL + Feign internal API；Next.js 16 + React 19 + TypeScript；Maven / pnpm。

---

## 文件结构

- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
  - 收敛活动删除入口，委托服务处理，不在 Controller 中硬删。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityAdminService.java`
  - 承载活动下架、退款触发、删除原因、逻辑删除、权限校验。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/DeleteActivityRequest.java`
  - 删除活动请求体，包含 `userId`、`reason`。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/DeleteActivityResponse.java`
  - 删除结果，返回活动状态、是否逻辑删除、是否仍有退款异常。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/entity/Activity.java`
  - 按最小方式补充删除/下架审计字段，或在迁移任务中映射新增字段。
- Add SQL migration: `sql/migrations/shared/20260521_activity_lifecycle_audit.sql`
  - 给历史共享库资产补充审计字段，作为拆库迁移源。
- Add SQL migration: `sql/production-split/ticket/20260521_activity_lifecycle_audit.sql`
  - 给 `omni_ticket_split` / 生产 ticket 库补充审计字段。
- Modify: `sql/production-split/manifest.json`
  - 纳入新增 ticket 库迁移脚本。
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/ActivityAdminServiceTest.java`
  - 覆盖删除原因、已支付订单退款闭环、退款异常阻止最终删除。
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java`
  - 覆盖 Controller 委托和请求体校验。
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/SeatCraftLegacyLayoutMigrationService.java`
  - 将历史点阵 `session_seat` 数据转换为 SeatCraft layout。
- Create: `java/java-ticket/src/test/java/com/omni/ticket/service/SeatCraftLegacyLayoutMigrationServiceTest.java`
  - 覆盖点阵到 SeatCraft layout 的区域、座位、票档绑定迁移。
- Modify: `frontend/src/app/console/activities/page.tsx`
  - 活动列表动作按生命周期展示，下架、删除原因、退款异常提示。
- Modify: `frontend/src/lib/api.ts`
  - 新增删除活动请求体 API，替换 query 参数硬删 API。
- Modify: `frontend/src/app/console/sessions/page.tsx`
  - “新增票档”入口改为进入 SeatCraft 票档编辑器。
- Modify: `frontend/src/components/seatcraft-unified/SeatCraftTicketEditor.tsx`
  - 强化区域/座位选择创建票档流程。
- Modify: `frontend/src/app/activity/[id]/page.tsx`
  - C 端只使用 SeatCraft 选座；缺 layout 时提示配置缺失，不再回退旧点阵主流程。
- Modify/Delete: `frontend/src/components/SeatMap.tsx`、`frontend/src/components/SeatSelectionMap.tsx` 或实际旧点阵组件路径
  - 迁移完成后从主流程断开；若保留文件，仅作为未引用历史组件。

---

### Task 1: 后端活动删除请求与原因校验

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/DeleteActivityRequest.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/DeleteActivityResponse.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java`

- [ ] **Step 1: 写失败测试：删除活动必须提供原因**

在 `AdminControllerTest` 增加：

```java
@Test
void deleteActivityRejectsBlankReason() {
    AdminController controller = controller();
    com.omni.ticket.dto.DeleteActivityRequest request = new com.omni.ticket.dto.DeleteActivityRequest();
    request.setUserId(2003L);
    request.setReason(" ");

    Result<?> result = controller.deleteActivity(10L, request);

    assertEquals(400, result.getCode());
    assertEquals("删除原因不能为空", result.getMessage());
    verify(activityAdminService, never()).deleteActivity(any(), any());
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `mvn test -pl java-ticket -am '-Dtest=AdminControllerTest#deleteActivityRejectsBlankReason' '-Dsurefire.failIfNoSpecifiedTests=false'`

Expected: 编译失败或测试失败，因为 `DeleteActivityRequest` / `deleteActivity(Long, DeleteActivityRequest)` 尚未实现。

- [ ] **Step 3: 创建请求和响应 DTO**

`DeleteActivityRequest.java`：

```java
package com.omni.ticket.dto;

public class DeleteActivityRequest {
    private Long userId;
    private String reason;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
```

`DeleteActivityResponse.java`：

```java
package com.omni.ticket.dto;

public class DeleteActivityResponse {
    private Long activityId;
    private String publishStatus;
    private Integer status;
    private Boolean deleted;
    private Boolean refundBlocked;
    private String message;

    public Long getActivityId() { return activityId; }
    public void setActivityId(Long activityId) { this.activityId = activityId; }
    public String getPublishStatus() { return publishStatus; }
    public void setPublishStatus(String publishStatus) { this.publishStatus = publishStatus; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public Boolean getDeleted() { return deleted; }
    public void setDeleted(Boolean deleted) { this.deleted = deleted; }
    public Boolean getRefundBlocked() { return refundBlocked; }
    public void setRefundBlocked(Boolean refundBlocked) { this.refundBlocked = refundBlocked; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
}
```

- [ ] **Step 4: 修改 Controller 删除签名并做空原因校验**

在 `AdminController.java` 替换 `@DeleteMapping("/activities/{id}")` 方法为：

```java
@DeleteMapping("/activities/{id}")
public Result<DeleteActivityResponse> deleteActivity(@PathVariable Long id,
                                                     @RequestBody DeleteActivityRequest request) {
    if (request == null || request.getUserId() == null || request.getUserId() <= 0) {
        return Result.fail(400, "用户ID不正确");
    }
    if (!StringUtils.hasText(request.getReason())) {
        return Result.fail(400, "删除原因不能为空");
    }
    return Result.success(activityAdminService.deleteActivity(id, request));
}
```

并添加 imports：

```java
import com.omni.ticket.dto.DeleteActivityRequest;
import com.omni.ticket.dto.DeleteActivityResponse;
```

- [ ] **Step 5: 运行测试确认通过**

Run: `mvn test -pl java-ticket -am '-Dtest=AdminControllerTest#deleteActivityRejectsBlankReason' '-Dsurefire.failIfNoSpecifiedTests=false'`

Expected: `Tests run: 1, Failures: 0, Errors: 0`。

---

### Task 2: 活动删除逻辑删除与退款阻断

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/ActivityAdminService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/entity/Activity.java`
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/ActivityAdminServiceTest.java`

- [ ] **Step 1: 写失败测试：有关联活动删除改为逻辑删除**

在 `ActivityAdminServiceTest` 增加：

```java
@Test
void deleteActivityWithSessionsMarksDeletedAndStoresReason() {
    Activity activity = activity(10L, 2003L);
    activity.setPublishStatus("deactivated");
    Session session = session(101L, 10L);
    when(activityMapper.selectById(10L)).thenReturn(activity);
    when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
    when(sessionMapper.selectList(any())).thenReturn(Collections.singletonList(session));
    when(orderInternalClient.listPaidBySessions(any(), eq("test-token"))).thenReturn(Result.success(Collections.emptyList()));

    com.omni.ticket.dto.DeleteActivityRequest request = new com.omni.ticket.dto.DeleteActivityRequest();
    request.setUserId(2003L);
    request.setReason("演出计划取消");

    com.omni.ticket.dto.DeleteActivityResponse response = service.deleteActivity(10L, request);

    assertEquals(Boolean.TRUE, response.getDeleted());
    assertEquals("deleted", activity.getPublishStatus());
    assertEquals(0, activity.getStatus());
    assertEquals("演出计划取消", activity.getDeleteReason());
    verify(activityMapper).updateById(activity);
    verify(activityMapper, never()).deleteById(10L);
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `mvn test -pl java-ticket -am '-Dtest=ActivityAdminServiceTest#deleteActivityWithSessionsMarksDeletedAndStoresReason' '-Dsurefire.failIfNoSpecifiedTests=false'`

Expected: 编译失败或测试失败，因为 `Activity.deleteReason` / `ActivityAdminService.deleteActivity` 未实现。

- [ ] **Step 3: 扩展 Activity 实体审计字段**

在 `Activity.java` 添加字段和 getter/setter：

```java
private String deleteReason;
private LocalDateTime deletedAt;
private Long deletedBy;

public String getDeleteReason() { return deleteReason; }
public void setDeleteReason(String deleteReason) { this.deleteReason = deleteReason; }
public LocalDateTime getDeletedAt() { return deletedAt; }
public void setDeletedAt(LocalDateTime deletedAt) { this.deletedAt = deletedAt; }
public Long getDeletedBy() { return deletedBy; }
public void setDeletedBy(Long deletedBy) { this.deletedBy = deletedBy; }
```

- [ ] **Step 4: 实现 ActivityAdminService.deleteActivity**

在 `ActivityAdminService.java` 添加公开方法：

```java
public DeleteActivityResponse deleteActivity(Long activityId, DeleteActivityRequest request) {
    if (activityId == null || activityId <= 0) {
        throw new BusinessException(ResultCode.BAD_REQUEST, "活动ID不正确");
    }
    if (request == null || request.getUserId() == null) {
        throw new BusinessException(ResultCode.BAD_REQUEST, "删除参数不能为空");
    }
    if (!StringUtils.hasText(request.getReason())) {
        throw new BusinessException(ResultCode.BAD_REQUEST, "删除原因不能为空");
    }
    Activity activity = activityMapper.selectById(activityId);
    if (activity == null) {
        throw new BusinessException(ResultCode.NOT_FOUND, "活动不存在");
    }
    InternalUserRefResponse user = userAccessService.requireAdminOrOrganizer(request.getUserId());
    if ("organizer".equals(user.getRole()) && !request.getUserId().equals(activity.getOrganizerId())) {
        throw new BusinessException(ResultCode.FORBIDDEN, "只能管理自己主办的活动");
    }

    List<Session> sessions = sessionMapper.selectList(new LambdaQueryWrapper<Session>()
            .eq(Session::getActivityId, activityId));
    List<Long> sessionIds = sessions == null ? Collections.emptyList()
            : sessions.stream().map(Session::getId).collect(Collectors.toList());
    List<OrderInfoResponse> paidOrders = sessionIds.isEmpty()
            ? Collections.emptyList()
            : unwrapOrders(orderInternalClient.listPaidBySessions(new PaidOrdersBySessionsRequest(sessionIds), requireInternalApiToken()));
    if (paidOrders != null && !paidOrders.isEmpty() && !"deactivated".equals(activity.getPublishStatus())) {
        throw new BusinessException(ResultCode.BAD_REQUEST, "活动存在已支付订单，请先下架并完成退款");
    }

    activity.setStatus(0);
    activity.setPublishStatus("deleted");
    activity.setDeleteReason(request.getReason().trim());
    activity.setDeletedBy(request.getUserId());
    activity.setDeletedAt(java.time.LocalDateTime.now());
    activityMapper.updateById(activity);

    DeleteActivityResponse response = new DeleteActivityResponse();
    response.setActivityId(activityId);
    response.setStatus(activity.getStatus());
    response.setPublishStatus(activity.getPublishStatus());
    response.setDeleted(true);
    response.setRefundBlocked(false);
    response.setMessage("活动已删除");
    return response;
}
```

添加 imports：

```java
import com.omni.ticket.dto.DeleteActivityRequest;
import com.omni.ticket.dto.DeleteActivityResponse;
```

- [ ] **Step 5: 运行测试确认通过**

Run: `mvn test -pl java-ticket -am '-Dtest=ActivityAdminServiceTest#deleteActivityWithSessionsMarksDeletedAndStoresReason' '-Dsurefire.failIfNoSpecifiedTests=false'`

Expected: `Tests run: 1, Failures: 0, Errors: 0`。

---

### Task 3: 数据库迁移活动删除审计字段

**Files:**
- Create: `sql/migrations/shared/20260521_activity_lifecycle_audit.sql`
- Create: `sql/production-split/ticket/20260521_activity_lifecycle_audit.sql`
- Modify: `sql/production-split/manifest.json`

- [ ] **Step 1: 添加 shared 迁移 SQL**

`sql/migrations/shared/20260521_activity_lifecycle_audit.sql`：

```sql
ALTER TABLE activity
    ADD COLUMN IF NOT EXISTS delete_reason TEXT,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS deleted_by BIGINT;

CREATE INDEX IF NOT EXISTS idx_activity_deleted_at ON activity(deleted_at);
```

- [ ] **Step 2: 添加 production-split ticket 迁移 SQL**

`sql/production-split/ticket/20260521_activity_lifecycle_audit.sql`：

```sql
ALTER TABLE activity
    ADD COLUMN IF NOT EXISTS delete_reason TEXT,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS deleted_by BIGINT;

CREATE INDEX IF NOT EXISTS idx_activity_deleted_at ON activity(deleted_at);
```

- [ ] **Step 3: 更新 manifest**

在 `sql/production-split/manifest.json` 的 ticket 迁移列表加入：

```json
"sql/production-split/ticket/20260521_activity_lifecycle_audit.sql"
```

保持 JSON 格式有效。

- [ ] **Step 4: 运行 SQL 检查**

Run: `powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1`

Expected: 检查通过，无 local-schema 或跨库违规。

---

### Task 4: 活动列表过滤 deleted 并展示生命周期动作

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/app/console/activities/page.tsx`

- [ ] **Step 1: 后端列表过滤 deleted**

确保 `listAdminActivities` 查询包含：

```java
wrapper.ne(Activity::getPublishStatus, "deleted");
```

- [ ] **Step 2: 前端删除 API 改为请求体**

在 `frontend/src/lib/api.ts` 替换 `deleteAdminActivity`：

```ts
export async function deleteAdminActivity(id: number, body: { userId: number; reason: string }) {
  return request<import('@/types/api').DeleteActivityResponse>(`/api/ticket/admin/activities/${id}`, {
    method: 'DELETE',
    body: JSON.stringify(body),
  })
}
```

在 `frontend/src/types/api.ts` 增加：

```ts
export interface DeleteActivityResponse {
  activityId: number
  publishStatus: string
  status: number
  deleted: boolean
  refundBlocked: boolean
  message?: string
}
```

- [ ] **Step 3: 前端删除时要求原因**

在 `frontend/src/app/console/activities/page.tsx` 替换 `handleDelete`：

```tsx
const handleDelete = async (activity: ActivityEntity) => {
  const reason = window.prompt('删除活动前请填写原因。已发布且有订单的活动需先完成下架退款。')
  if (reason === null) return
  if (!reason.trim()) {
    alert('删除原因不能为空')
    return
  }
  const result = await deleteAdminActivity(activity.id, { userId, reason: reason.trim() })
  alert(result.message || '活动已删除')
  loadData(page)
}
```

并把按钮调用从：

```tsx
onClick={() => handleDelete(a.id)}
```

改为：

```tsx
onClick={() => handleDelete(a)}
```

- [ ] **Step 4: 运行前端类型检查**

Run: `pnpm typecheck` in `frontend`

Expected: `tsc --noEmit` 无错误。

---

### Task 5: 旧点阵数据迁移为 SeatCraft layout

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/SeatCraftLegacyLayoutMigrationService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Create: `java/java-ticket/src/test/java/com/omni/ticket/service/SeatCraftLegacyLayoutMigrationServiceTest.java`

- [ ] **Step 1: 写失败测试：点阵座位生成默认 SeatCraft 区域**

`SeatCraftLegacyLayoutMigrationServiceTest.java`：

```java
package com.omni.ticket.service;

import com.omni.ticket.dto.SeatCraftLayoutDtos;
import com.omni.ticket.entity.SessionSeat;
import com.omni.ticket.mapper.SessionSeatMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SeatCraftLegacyLayoutMigrationServiceTest {
    @Mock
    private SessionSeatMapper sessionSeatMapper;

    @Test
    void buildsDefaultSeatCraftLayoutFromLegacySeats() {
        SessionSeat first = seat(1L, 10L, 100L, "A", 1);
        SessionSeat second = seat(2L, 10L, 100L, "A", 2);
        when(sessionSeatMapper.selectList(any())).thenReturn(Arrays.asList(first, second));

        SeatCraftLegacyLayoutMigrationService service = new SeatCraftLegacyLayoutMigrationService(sessionSeatMapper);
        SeatCraftLayoutDtos.LayoutDraft layout = service.buildFromLegacySeats(10L);

        assertFalse(layout.getSections().isEmpty());
        assertEquals("默认区域", layout.getSections().get(0).getName());
        assertEquals(2, layout.getSections().get(0).getSeats().size());
        assertEquals(100L, layout.getSections().get(0).getSeats().get(0).getTicketTypeId());
    }

    private SessionSeat seat(Long id, Long sessionId, Long ticketTypeId, String rowName, Integer seatNo) {
        SessionSeat seat = new SessionSeat();
        seat.setId(id);
        seat.setSessionId(sessionId);
        seat.setTicketTypeId(ticketTypeId);
        seat.setRowName(rowName);
        seat.setSeatNo(seatNo);
        seat.setPrice(new BigDecimal("280.00"));
        seat.setStatus(1);
        return seat;
    }
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `mvn test -pl java-ticket -am '-Dtest=SeatCraftLegacyLayoutMigrationServiceTest' '-Dsurefire.failIfNoSpecifiedTests=false'`

Expected: 编译失败，因为服务尚未存在或 DTO 字段需按现有 `SeatCraftLayoutDtos` 调整。

- [ ] **Step 3: 实现最小迁移服务**

在 `SeatCraftLegacyLayoutMigrationService.java` 实现：按 `sessionId` 查询 `SessionSeat`，生成一个“默认区域”，按行列给座位分配坐标，保留 `sessionSeat.id` 与 `ticketTypeId` 映射。

如果现有 `SeatCraftLayoutDtos` 字段名与测试不同，以 DTO 实际字段为准，保持语义：`sections -> seats -> ticketTypeId/sessionSeatId/x/y/row/number`。

- [ ] **Step 4: 挂接到缺 layout 场次**

在读取场次 SeatCraft layout 时：

```java
if (layout == null || layout.isEmpty()) {
    return legacyLayoutMigrationService.buildFromLegacySeats(sessionId);
}
```

只用于迁移期生成并保存/返回 SeatCraft layout，不再返回点阵组件数据。

- [ ] **Step 5: 运行迁移测试**

Run: `mvn test -pl java-ticket -am '-Dtest=SeatCraftLegacyLayoutMigrationServiceTest' '-Dsurefire.failIfNoSpecifiedTests=false'`

Expected: `Tests run: 1, Failures: 0, Errors: 0`。

---

### Task 6: B 端场次新增票档进入 SeatCraft

**Files:**
- Modify: `frontend/src/app/console/sessions/page.tsx`
- Modify: `frontend/src/components/seatcraft-unified/SeatCraftTicketEditor.tsx`

- [ ] **Step 1: 移除简单票档表单主入口**

在场次管理页面中，原“新增票档”按钮不再打开纯表单 modal。改为设置当前场次并展示 SeatCraft 票档编辑器：

```tsx
const [ticketEditorSessionId, setTicketEditorSessionId] = useState<number | null>(null)
```

按钮：

```tsx
<button onClick={() => setTicketEditorSessionId(session.id)}>
  进入座位图创建票档
</button>
```

- [ ] **Step 2: 渲染 SeatCraftTicketEditor**

```tsx
{ticketEditorSessionId && (
  <SeatCraftTicketEditor
    sessionId={ticketEditorSessionId}
    userId={userId}
    onClose={() => setTicketEditorSessionId(null)}
    onSaved={() => {
      setTicketEditorSessionId(null)
      loadData(page)
    }}
  />
)}
```

- [ ] **Step 3: 确保 SeatCraftTicketEditor 禁止空选择保存**

保存前校验：

```tsx
if (selectedSectionIds.length === 0 && selectedSeatIds.length === 0) {
  setError('请先在座位图中选择区域或座位')
  return
}
```

- [ ] **Step 4: 运行前端类型检查**

Run: `pnpm typecheck` in `frontend`

Expected: `tsc --noEmit` 无错误。

---

### Task 7: C 端移除点阵主流程并只用 SeatCraft

**Files:**
- Modify: `frontend/src/app/activity/[id]/page.tsx`
- Modify/Delete references to old `SeatMap` / `SeatSelectionMap`

- [ ] **Step 1: 查找旧点阵引用**

Run: `rg "SeatMap|SeatSelectionMap|点阵|legacy" frontend/src`

Expected: 列出旧点阵组件在活动详情或座位页的引用。

- [ ] **Step 2: 活动详情缺 SeatCraft layout 时显示配置缺失**

在 `frontend/src/app/activity/[id]/page.tsx` 中，替换旧点阵 fallback：

```tsx
if (!seatCraftLayout) {
  return (
    <div className="rounded-2xl border border-[#ffd9e6] bg-white p-6 text-[14px] text-[#666]">
      当前场次尚未配置 SeatCraft 座位图，请稍后再试。
    </div>
  )
}
```

- [ ] **Step 3: SeatCraftSelector 只提交真实座位 ID**

下单前过滤：

```tsx
const validSeatIds = selectedSeatIds.filter(id => availableSeatIds.includes(id))
if (validSeatIds.length !== selectedSeatIds.length) {
  setError('存在不可售座位，请重新选择')
  return
}
```

- [ ] **Step 4: 运行前端类型检查**

Run: `pnpm typecheck` in `frontend`

Expected: `tsc --noEmit` 无错误。

---

### Task 8: 全量验证与服务重启交接

**Files:**
- No code changes.

- [ ] **Step 1: 运行 ticket 相关测试**

Run: `mvn test -pl java-ticket -am`

Expected: `BUILD SUCCESS`。

- [ ] **Step 2: 运行 payment 相关测试**

Run: `mvn test -pl java-payment -am`

Expected: `BUILD SUCCESS`。

- [ ] **Step 3: 运行前端类型检查**

Run: `pnpm typecheck` in `frontend`

Expected: `tsc --noEmit` 无错误。

- [ ] **Step 4: 运行微服务边界检查**

Run: `powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1`

Expected: `All microservice boundary checks passed.`。

- [ ] **Step 5: 告知用户重启服务，不代重启**

输出：

```text
需要你重启 java-ticket、java-order、java-payment 和 frontend 后验证。此次我不代重启服务。
```

- [ ] **Step 6: 人工冒烟清单**

由用户重启后验证：

```text
1. 商户创建活动草稿并提交审核。
2. admin 审核活动发布。
3. 商户下架已发布活动。
4. 有已支付订单时触发自动退款，用户订单显示已退款。
5. 退款异常时活动不能最终删除。
6. 商户删除活动必须填写原因。
7. 场次新增票档进入 SeatCraft，不出现旧点阵主流程。
8. C 端活动详情使用 SeatCraft 选座，票档切换自动聚焦。
```

---

## 自检

- Spec 覆盖：计划覆盖活动生命周期、删除原因、admin 下架、商户权限、退款闭环、SeatCraft 票档入口、旧点阵迁移和 C 端 SeatCraft 主流程。
- 占位符扫描：计划不使用 TBD/TODO；SeatCraft DTO 字段需按现有 `SeatCraftLayoutDtos` 实际命名落地，这是实施时的代码对齐点，不改变任务目标。
- 类型一致性：后端新增 `DeleteActivityRequest` / `DeleteActivityResponse`，前端新增同名响应类型；删除 API 从 query 参数改为 DELETE body。
- 服务操作纪律：实施和验证期间不由代理重启服务，最终只提示用户需要重启哪些服务。
