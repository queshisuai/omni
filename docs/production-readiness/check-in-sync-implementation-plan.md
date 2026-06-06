# 入场核验同步 Implementation Plan

> **给执行代理：** REQUIRED SUB-SKILL: Use `subagent-driven-development`（推荐）或 `executing-plans` 按任务逐项实施。步骤使用 checkbox（`- [ ]`）跟踪。

**Goal:** 建立“线下核验同步 + 核验记录查询 + 主办方入场概览”的第一阶段闭环，不把 Web 验票工作台作为主流程。

**Architecture:** `java-order` 继续拥有电子票状态和核验记录；`java-ticket` 作为主办方/平台控制台 facade，负责活动、场次和权限边界后调用 order internal API；前端先做只读入场概览和核验记录，备用扫码页延后评估。Gateway 后续统一承接设备/工作人员鉴权、限流和 trace。

**Tech Stack:** Spring Boot、MyBatis-Plus、PostgreSQL、OpenFeign、Next.js、TypeScript、Redis/MQ 作为后续增强点。

---

## 范围

本计划只做第一阶段：

- 做核验同步 API，不做离线大场馆模式。
- 做核验记录和入场概览，不做复杂设备运维平台。
- 做主办方/平台只读控制台入口，不做常规 Web 扫码核验主流程。
- 保留现有 `POST /api/order/internal/tickets/check-in`，避免破坏已有测试。
- 后续如果要接工作人员 App 或闸机，不直接暴露 `X-Internal-Token`，由 Gateway 或核验接入层换取内部调用。

## 文件结构

### SQL

- Create: `sql/production-split/order/20260606_ticket_check_in_record.sql`
- Modify: `sql/production-split/manifest.json`
- Modify later: `sql/seeds/prod-split-real-demo/02-order.sql`
- Modify later: `sql/seeds/prod-split-real-demo/README.md`

### java-order

- Create: `java/java-order/src/main/java/com/omni/order/entity/TicketCheckInRecord.java`
- Create: `java/java-order/src/main/java/com/omni/order/entity/CheckInDevice.java`
- Create: `java/java-order/src/main/java/com/omni/order/mapper/TicketCheckInRecordMapper.java`
- Create: `java/java-order/src/main/java/com/omni/order/mapper/CheckInDeviceMapper.java`
- Create: `java/java-order/src/main/java/com/omni/order/dto/TicketCheckInSyncRequest.java`
- Create: `java/java-order/src/main/java/com/omni/order/dto/TicketCheckInRecordQueryRequest.java`
- Create: `java/java-order/src/main/java/com/omni/order/dto/TicketCheckInRecordResponse.java`
- Create: `java/java-order/src/main/java/com/omni/order/dto/TicketCheckInOverviewRequest.java`
- Create: `java/java-order/src/main/java/com/omni/order/dto/TicketCheckInOverviewResponse.java`
- Create: `java/java-order/src/main/java/com/omni/order/service/TicketEntryCodeCodec.java`
- Create: `java/java-order/src/main/java/com/omni/order/service/TicketCheckInService.java`
- Modify: `java/java-order/src/main/java/com/omni/order/service/TicketWalletService.java`
- Modify: `java/java-order/src/main/java/com/omni/order/controller/OrderController.java`
- Test: `java/java-order/src/test/java/com/omni/order/service/TicketEntryCodeCodecTest.java`
- Test: `java/java-order/src/test/java/com/omni/order/service/TicketCheckInServiceTest.java`
- Test: `java/java-order/src/test/java/com/omni/order/controller/OrderControllerInternalCheckInTest.java`

### java-ticket facade

- Modify: `java/java-ticket/src/main/java/com/omni/ticket/client/OrderInternalClient.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/CheckInOverviewResponse.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/CheckInRecordResponse.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/CheckInAdminQueryService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/CheckInAdminQueryServiceTest.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerCheckInTest.java`

### RBAC 与前端

- Create: `sql/production-split/user/20260606_checkin_permissions.sql`
- Modify: `sql/production-split/manifest.json`
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/api.test.ts`
- Modify: `frontend/src/lib/console-auth.ts`
- Modify: `frontend/src/lib/console-auth.test.ts`
- Modify: `frontend/src/lib/console-paths.ts`
- Modify: `frontend/src/lib/console-paths.test.ts`
- Create: `frontend/src/app/console/check-in/page.tsx`

---

## Task 1: order 库核验记录迁移

**Files:**
- Create: `sql/production-split/order/20260606_ticket_check_in_record.sql`
- Modify: `sql/production-split/manifest.json`

- [x] **Step 1: 写迁移 SQL**

创建 `check_in_device` 和 `ticket_check_in_record`。`check_in_device` 先做轻量设备身份；`ticket_check_in_record` 是核心审计表。

```sql
-- owner: java-order

CREATE SEQUENCE IF NOT EXISTS check_in_device_id_seq;
CREATE SEQUENCE IF NOT EXISTS ticket_check_in_record_id_seq;

CREATE TABLE IF NOT EXISTS check_in_device (
    id BIGSERIAL PRIMARY KEY,
    device_code VARCHAR(64) NOT NULL UNIQUE,
    device_name VARCHAR(128) NOT NULL,
    organizer_id BIGINT,
    session_id BIGINT,
    status SMALLINT NOT NULL DEFAULT 1,
    secret_hash VARCHAR(128),
    last_seen_at TIMESTAMP,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_check_in_device_status CHECK (status IN (0, 1))
);

CREATE TABLE IF NOT EXISTS ticket_check_in_record (
    id BIGSERIAL PRIMARY KEY,
    request_id VARCHAR(96) NOT NULL UNIQUE,
    ticket_id BIGINT,
    ticket_no VARCHAR(64),
    order_id BIGINT,
    user_id BIGINT,
    session_id BIGINT,
    ticket_type_id BIGINT,
    device_code VARCHAR(64),
    operator_user_id BIGINT,
    channel VARCHAR(32) NOT NULL,
    result VARCHAR(32) NOT NULL,
    failure_reason VARCHAR(255),
    checked_in_at TIMESTAMP,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_ticket_check_in_channel CHECK (channel IN ('GATE', 'STAFF_APP', 'WEB_BACKUP', 'INTERNAL_SYNC')),
    CONSTRAINT chk_ticket_check_in_result CHECK (result IN ('SUCCESS', 'DUPLICATE', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_ticket_check_in_record_session_time
    ON ticket_check_in_record(session_id, create_time DESC);

CREATE INDEX IF NOT EXISTS idx_ticket_check_in_record_ticket
    ON ticket_check_in_record(ticket_id, create_time DESC);

CREATE INDEX IF NOT EXISTS idx_ticket_check_in_record_result
    ON ticket_check_in_record(result, create_time DESC);
```

- [x] **Step 2: 更新 manifest**

在 `java-order` 的 `tables` 里追加：

```json
"check_in_device",
"ticket_check_in_record"
```

在 `java-order` 的 `migrations` 里追加：

```json
"order/20260606_ticket_check_in_record.sql"
```

- [x] **Step 3: 本地迁移验证**

Run:

```powershell
$env:PGPASSWORD='123456'
psql -h localhost -p 5432 -U postgres -d omni_order -f sql/production-split/order/20260606_ticket_check_in_record.sql
psql -h localhost -p 5432 -U postgres -d omni_order -c "\d ticket_check_in_record"
psql -h localhost -p 5432 -U postgres -d omni_order -c "\d check_in_device"
```

Expected:

- 两张表存在。
- `request_id` 唯一。
- `channel`、`result` check constraint 存在。

---

## Task 2: 抽出动态入场码编解码器

**Files:**
- Create: `java/java-order/src/main/java/com/omni/order/service/TicketEntryCodeCodec.java`
- Modify: `java/java-order/src/main/java/com/omni/order/service/TicketWalletService.java`
- Test: `java/java-order/src/test/java/com/omni/order/service/TicketEntryCodeCodecTest.java`
- Test: `java/java-order/src/test/java/com/omni/order/service/TicketWalletServiceTest.java`

- [x] **Step 1: 写 codec 红灯测试**

`TicketEntryCodeCodecTest` 覆盖生成、验签、过期、篡改。

```java
@Test
void parsesSignedEntryCode() {
    TicketEntryCodeCodec codec = new TicketEntryCodeCodec("test-secret");
    TicketEntryCodeCodec.CodePayload payload = codec.parseAndVerify(codec.create(3001L, 2004L, 60).getEntryCode());

    assertEquals(3001L, payload.getTicketId());
    assertEquals(2004L, payload.getUserId());
}

@Test
void rejectsTamperedEntryCode() {
    TicketEntryCodeCodec codec = new TicketEntryCodeCodec("test-secret");
    String code = codec.create(3001L, 2004L, 60).getEntryCode() + "x";

    BusinessException error = assertThrows(BusinessException.class, () -> codec.parseAndVerify(code));

    assertEquals("入场码无效", error.getMessage());
}
```

- [x] **Step 2: 运行红灯**

Run:

```powershell
cd java
mvn -pl java-order test -Dtest=TicketEntryCodeCodecTest
```

Expected:

- 编译失败或测试失败，原因是 `TicketEntryCodeCodec` 不存在。

- [x] **Step 3: 实现 codec**

实现逻辑从 `TicketWalletService` 当前私有 `parseAndVerify`、`sign`、`CodePayload` 迁出，保留错误文案：

- `入场码无效`
- `入场码已过期`
- `入场码生成失败`

构造函数使用：

```java
public TicketEntryCodeCodec(@Value("${omni.ticket.entry-code-secret:${OMNI_TICKET_ENTRY_CODE_SECRET:omni-ticket-entry-code-secret}}") String entryCodeSecret)
```

- [x] **Step 4: 改造 TicketWalletService**

`createEntryCode()` 改为调用 `codec.create(ticketId, userId, ENTRY_CODE_TTL_SECONDS)`；`checkIn()` 改为调用 `codec.parseAndVerify(entryCode)`。

保留现有 `TicketWalletServiceTest.checkInRejectsAlreadyCheckedTicket()` 行为，不把旧 internal check-in 改成重复扫码成功。

- [x] **Step 5: 运行测试**

Run:

```powershell
cd java
mvn -pl java-order test -Dtest=TicketEntryCodeCodecTest,TicketWalletServiceTest
```

Expected:

- 两个测试类通过。

---

## Task 3: java-order 核验同步服务

**Files:**
- Create: `TicketCheckInRecord.java`
- Create: `CheckInDevice.java`
- Create: `TicketCheckInRecordMapper.java`
- Create: `CheckInDeviceMapper.java`
- Create: `TicketCheckInSyncRequest.java`
- Create: `TicketCheckInRecordQueryRequest.java`
- Create: `TicketCheckInRecordResponse.java`
- Create: `TicketCheckInOverviewRequest.java`
- Create: `TicketCheckInOverviewResponse.java`
- Create: `TicketCheckInService.java`
- Test: `TicketCheckInServiceTest.java`

- [x] **Step 1: 写服务红灯测试**

覆盖四个行为：

- 成功核验插入 `SUCCESS` 记录。
- 重复 `requestId` 返回已有记录，不二次更新电子票。
- 已验票电子票返回 `DUPLICATE` 记录，不抛给设备端。
- 停用设备返回 `FAILED`，不更新电子票。

测试断言示例：

```java
@Test
void syncCheckInRecordsSuccess() {
    TicketCheckInSyncRequest request = request("REQ-1", "DEVICE-1", "INTERNAL_SYNC", entryCode);
    when(deviceMapper.selectByDeviceCode("DEVICE-1")).thenReturn(activeDevice("DEVICE-1"));
    when(recordMapper.selectByRequestId("REQ-1")).thenReturn(null);
    when(electronicTicketMapper.selectByIdForUpdate(3001L)).thenReturn(ticket(3001L, 2004L, 9001L, 1));
    when(electronicTicketMapper.updateStatusIfCurrent(3001L, 1, 2)).thenReturn(1);

    TicketCheckInRecordResponse response = service.syncCheckIn(request);

    assertEquals("SUCCESS", response.getResult());
    verify(recordMapper).insert(argThat(record -> "SUCCESS".equals(record.getResult())));
}
```

- [x] **Step 2: 运行红灯**

Run:

```powershell
cd java
mvn -pl java-order test -Dtest=TicketCheckInServiceTest
```

Expected:

- 编译失败或测试失败，原因是新 service / mapper / DTO 不存在。

- [x] **Step 3: 实现实体和 mapper**

实体用 MyBatis-Plus `@TableName`、`@KeySequence`，字段与 SQL 一致。

Mapper 必须提供：

```java
TicketCheckInRecord selectByRequestId(@Param("requestId") String requestId);
List<TicketCheckInRecordResponse> selectRecords(@Param("sessionId") Long sessionId,
                                                @Param("result") String result,
                                                @Param("offset") int offset,
                                                @Param("size") int size);
TicketCheckInOverviewResponse selectOverview(@Param("sessionId") Long sessionId);
```

`selectOverview` 至少返回：

- `sessionId`
- `totalTickets`
- `checkedInCount`
- `unusedCount`
- `failedCount`
- `duplicateCount`

- [x] **Step 4: 实现 TicketCheckInService**

核心规则：

- `requestId` 必填；用于幂等。
- `channel` 为空时默认 `INTERNAL_SYNC`。
- 设备存在且 `status=0` 时拒绝。
- 入场码无效/过期要记录 `FAILED`。
- 票状态为 `2` 时记录 `DUPLICATE`，返回已验票状态。
- 票状态为 `3` 或 `4` 时记录 `FAILED`。
- 未入场票更新为 `2` 并记录 `SUCCESS`。

重复请求返回已有记录，不能再次调用 `updateStatusIfCurrent`。

- [x] **Step 5: 运行服务测试**

Run:

```powershell
cd java
mvn -pl java-order test -Dtest=TicketCheckInServiceTest
```

Expected:

- `TicketCheckInServiceTest` 通过。

---

## Task 4: java-order internal API

**Files:**
- Modify: `java/java-order/src/main/java/com/omni/order/controller/OrderController.java`
- Test: `java/java-order/src/test/java/com/omni/order/controller/OrderControllerInternalCheckInTest.java`

- [x] **Step 1: 写 Controller 红灯测试**

新增测试覆盖：

- `POST /internal/tickets/check-in/sync` 无 token 返回 403。
- 有 token 调用 `TicketCheckInService.syncCheckIn()`。
- `POST /internal/tickets/check-in/records` 有 token 返回记录。
- `POST /internal/tickets/check-in/overview` 有 token 返回概览。

- [x] **Step 2: 修改构造函数**

给 `OrderController` 注入 `TicketCheckInService`。为了不破坏已有测试，保留兼容构造函数，并在测试里显式传 mock。

- [x] **Step 3: 添加 internal endpoints**

```java
@PostMapping("/internal/tickets/check-in/sync")
public Result<TicketCheckInRecordResponse> syncCheckInTicket(
        @RequestBody(required = false) TicketCheckInSyncRequest request,
        @RequestHeader(value = "X-Internal-Token", required = false) String token) {
    if (!isValidInternalToken(token)) {
        return Result.fail(403, "无权限");
    }
    return Result.success(ticketCheckInService.syncCheckIn(request));
}
```

记录和概览接口也只接受 internal token。

- [x] **Step 4: 运行 Controller 测试**

Run:

```powershell
cd java
mvn -pl java-order test -Dtest=OrderControllerInternalCheckInTest,OrderControllerInternalSeatUsageTest
```

Expected:

- 新旧 internal controller 测试都通过。

---

## Task 5: java-ticket 控制台 facade

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/client/OrderInternalClient.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/CheckInAdminQueryService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Test: `CheckInAdminQueryServiceTest.java`
- Test: `AdminControllerCheckInTest.java`

- [x] **Step 1: 写 facade 红灯测试**

测试规则：

- 主办方只能查询自己拥有的活动/场次。
- 平台管理员或拥有 `checkin.view` 权限的运营角色可以查询授权范围。
- 无 `checkin.view` / `order.view` / 主办方身份时返回 403。
- order internal 不可用时返回中文错误“入场核验记录暂不可用”。

- [x] **Step 2: 扩展 OrderInternalClient**

新增：

```java
@PostMapping("/api/order/internal/tickets/check-in/records")
Result<List<CheckInRecordResponse>> listCheckInRecords(@RequestBody CheckInRecordQueryRequest request,
                                                       @RequestHeader("X-Internal-Token") String internalToken);

@PostMapping("/api/order/internal/tickets/check-in/overview")
Result<CheckInOverviewResponse> getCheckInOverview(@RequestBody CheckInOverviewRequest request,
                                                   @RequestHeader("X-Internal-Token") String internalToken);
```

- [x] **Step 3: 实现 CheckInAdminQueryService**

沿用 `OrderAdminQueryService` 风格：

- 先用 `UserAccessService.requireAdminOrOrganizerOrAnyPermission(userId, "checkin.view", "order.view")` 校验。
- 如果角色是 `organizer`，先查 `session` 和 `activity`，必须 `activity.organizerId == userId`。
- 如果是平台主办方运营员或平台管理员，允许按权限查询。
- 再调用 `OrderInternalClient`。

- [x] **Step 4: AdminController 增加接口**

```java
@GetMapping("/check-in/overview")
public Result<CheckInOverviewResponse> getCheckInOverview(@RequestHeader(value = "Authorization", required = false) String authorization,
                                                          @RequestParam Long sessionId) {
    Long operatorId = parseOperatorId(authorization);
    if (operatorId == null) return Result.fail(ResultCode.UNAUTHORIZED);
    return Result.success(checkInAdminQueryService.getOverview(operatorId, sessionId));
}
```

记录列表接口路径：

```text
GET /api/ticket/admin/check-in/records?sessionId=910002&result=SUCCESS&page=1&size=20
```

- [x] **Step 5: 运行 java-ticket 测试**

Run:

```powershell
cd java
mvn -pl java-ticket test -Dtest=CheckInAdminQueryServiceTest,AdminControllerCheckInTest
```

Expected:

- facade 权限和 internal 调用测试通过。

---

## Task 6: RBAC permission 与前端路由权限

**Files:**
- Create: `sql/production-split/user/20260606_checkin_permissions.sql`
- Modify: `sql/production-split/manifest.json`
- Modify: `frontend/src/lib/console-auth.ts`
- Modify: `frontend/src/lib/console-auth.test.ts`
- Modify: `frontend/src/lib/console-paths.ts`
- Modify: `frontend/src/lib/console-paths.test.ts`

- [x] **Step 1: 写前端权限红灯测试**

`console-auth.test.ts` 增加：

```ts
assert.equal(canAccessConsolePath('/console/check-in', ['checkin.view']), true)
assert.equal(canAccessConsolePath('/console/check-in', ['order.view']), false)
assert.equal(getDefaultConsolePath('organizer_admin', ['checkin.view']), '/console/check-in')
```

`console-paths.test.ts` 增加：

```ts
assert.equal(isConsolePathAllowedForRole('organizer', '/console/check-in'), true)
assert.ok(getConsoleQuickActions('organizer').some(action => action.href === '/console/check-in'))
```

- [x] **Step 2: 运行红灯**

Run:

```powershell
cd frontend
node --test src/lib/console-auth.test.ts src/lib/console-paths.test.ts
```

Expected:

- 测试失败，原因是 `/console/check-in` 权限和快捷入口未配置。

- [x] **Step 3: 添加 RBAC SQL**

```sql
-- owner: java-user

INSERT INTO rbac_permission (code, name, description) VALUES
    ('checkin.view', '入场核验查看', '查看入场概览和核验记录'),
    ('checkin.sync', '备用核验执行', '执行备用 Web 扫码核验和异常补录'),
    ('checkin.device.manage', '核验设备管理', '管理线下核验设备')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, update_time = CURRENT_TIMESTAMP;

INSERT INTO rbac_role_permission (role_code, permission_code) VALUES
    ('organizer', 'checkin.view'),
    ('organizer_admin', 'checkin.view'),
    ('organizer_admin', 'checkin.device.manage')
ON CONFLICT DO NOTHING;

INSERT INTO rbac_role_permission (role_code, permission_code)
SELECT 'platform_super_admin', code FROM rbac_permission
WHERE code IN ('checkin.view', 'checkin.sync', 'checkin.device.manage')
ON CONFLICT DO NOTHING;
```

- [x] **Step 4: 更新前端权限映射**

`PATH_PERMISSION_MAP` 增加：

```ts
'/console/check-in': ['checkin.view'],
```

`DEFAULT_PATH_BY_PERMISSION` 增加：

```ts
['checkin.view', '/console/check-in'],
```

`ORGANIZER_BUSINESS_PERMISSIONS` 增加：

```ts
'checkin.view',
```

`PERMISSION_QUICK_ACTIONS` 增加：

```ts
{ permission: 'checkin.view', label: '入场核验', href: '/console/check-in' },
```

`ORGANIZER_ALLOWED_PREFIXES` 增加：

```ts
'/console/check-in',
```

主办方固定快捷入口增加：

```ts
{ label: '入场核验', href: '/console/check-in' },
```

- [x] **Step 5: 运行前端权限测试**

Run:

```powershell
cd frontend
node --test src/lib/console-auth.test.ts src/lib/console-paths.test.ts
```

Expected:

- 测试通过。

---

## Task 7: 前端 API 与类型

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/api.test.ts`

- [x] **Step 1: 写 API 红灯测试**

`api.test.ts` 增加：

```ts
test('loads check-in overview and records through ticket admin endpoint', async () => {
  const requested: Array<{ url: string; options?: RequestInit }> = []
  mockFetch(requested, [
    { code: 200, data: { sessionId: 910002, totalTickets: 10, checkedInCount: 6, unusedCount: 4, failedCount: 1, duplicateCount: 2 } },
    { code: 200, data: [{ id: 1, requestId: 'REQ-1', result: 'SUCCESS', ticketNo: 'ET1' }] },
  ])

  await getCheckInOverview(910002)
  await listCheckInRecords({ sessionId: 910002, result: 'SUCCESS', page: 1, size: 20 })

  assert.equal(requested[0].url, '/api/ticket/admin/check-in/overview?sessionId=910002')
  assert.equal(requested[1].url, '/api/ticket/admin/check-in/records?sessionId=910002&result=SUCCESS&page=1&size=20')
})
```

- [x] **Step 2: 添加类型**

`api.ts` 类型中新增：

```ts
export interface CheckInOverviewVO {
  sessionId: number
  totalTickets: number
  checkedInCount: number
  unusedCount: number
  failedCount: number
  duplicateCount: number
}

export interface CheckInRecordVO {
  id: number
  requestId: string
  ticketId?: number | null
  ticketNo?: string | null
  orderId?: number | null
  userId?: number | null
  sessionId?: number | null
  deviceCode?: string | null
  operatorUserId?: number | null
  channel: string
  result: 'SUCCESS' | 'DUPLICATE' | 'FAILED'
  failureReason?: string | null
  checkedInAt?: string | null
  createTime?: string | null
}
```

- [x] **Step 3: 添加 API 函数**

```ts
export async function getCheckInOverview(sessionId: number) {
  return request<import('@/types/api').CheckInOverviewVO>(`/api/ticket/admin/check-in/overview?sessionId=${encodeURIComponent(String(sessionId))}`)
}

export async function listCheckInRecords(params: { sessionId: number; result?: string; page?: number; size?: number }) {
  const searchParams = new URLSearchParams()
  searchParams.set('sessionId', String(params.sessionId))
  if (params.result) searchParams.set('result', params.result)
  if (params.page) searchParams.set('page', String(params.page))
  if (params.size) searchParams.set('size', String(params.size))
  return request<import('@/types/api').CheckInRecordVO[]>(`/api/ticket/admin/check-in/records?${searchParams.toString()}`)
}
```

- [x] **Step 4: 运行 API 测试**

Run:

```powershell
cd frontend
node --test src/lib/api.test.ts
```

Expected:

- 新 API 测试通过。

---

## Task 8: 控制台入场核验页面

**Files:**
- Create: `frontend/src/app/console/check-in/page.tsx`
- Modify if needed: `frontend/src/lib/console-paths.ts`

- [x] **Step 1: 实现页面状态**

页面只做只读查询，不提供扫码核验按钮。必须包含：

- 场次 ID 输入框。
- 查询按钮。
- 概览卡片：总票数、已验票、未入场、失败、重复扫码。
- 记录表格：请求号、票号、设备、渠道、结果、失败原因、时间。
- 空状态：`暂无核验记录`。
- 失败态：展示后端中文错误。

- [x] **Step 2: 权限动作**

如果当前用户没有 `checkin.view`，页面显示：

```text
暂无入场核验查看权限
```

不要显示查询表单。

- [x] **Step 3: 前端类型检查**

Run:

```powershell
cd frontend
pnpm typecheck
```

Expected:

- TypeScript 无错误。

---

## Task 9: real-demo seed 补齐

**Files:**
- Modify: `sql/seeds/prod-split-real-demo/02-order.sql`
- Modify: `sql/seeds/prod-split-real-demo/README.md`

- [x] **Step 1: 增加设备和核验记录 seed**

在 `02-order.sql` 里增加：

- `check_in_device` 一台启用设备：`GATE-SH-001`
- `check_in_device` 一台停用设备：`GATE-SH-DISABLED`
- `ticket_check_in_record` 成功记录。
- `ticket_check_in_record` 重复扫码记录。
- `ticket_check_in_record` 失败记录。

示例数据需要使用现有电子票 ID，例如 `983001`、`983002`、`983003`。

- [x] **Step 2: 更新电子票状态**

把一部分 seed 电子票改成：

- `status=2`，有 `checked_in_at`
- `status=3`，有 `invalid_reason`
- `status=4`，模拟转赠后原票

不要让所有 seed 都停留在 `status=1`，否则入场概览没有演示意义。

- [x] **Step 3: 本地 seed 验证**

Run:

```powershell
$env:PGPASSWORD='123456'
psql -h localhost -p 5432 -U postgres -d omni_order -f sql/seeds/prod-split-real-demo/02-order.sql
psql -h localhost -p 5432 -U postgres -d omni_order -c "SELECT status, COUNT(*) FROM electronic_ticket GROUP BY status ORDER BY status;"
psql -h localhost -p 5432 -U postgres -d omni_order -c "SELECT result, COUNT(*) FROM ticket_check_in_record GROUP BY result ORDER BY result;"
```

Expected:

- `electronic_ticket` 至少有 `1`、`2`、`3`、`4` 四种状态。
- `ticket_check_in_record` 至少有 `SUCCESS`、`DUPLICATE`、`FAILED` 三种结果。

---

## Task 10: 全链路验证

**Files:**
- No code changes.

- [x] **Step 1: 后端单测**

Run:

```powershell
cd java
mvn -pl java-order test -Dtest=TicketEntryCodeCodecTest,TicketCheckInServiceTest,OrderControllerInternalCheckInTest,TicketWalletServiceTest
mvn -pl java-ticket test -Dtest=CheckInAdminQueryServiceTest,AdminControllerCheckInTest
```

Expected:

- 指定测试全部通过。

- [x] **Step 2: 微服务边界检查**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
```

Expected:

- 不新增跨服务 Mapper、Entity、XML mapper 或 SQL join。

- [x] **Step 3: 前端检查**

Run:

```powershell
cd frontend
node --test src/lib/api.test.ts src/lib/console-auth.test.ts src/lib/console-paths.test.ts
pnpm typecheck
```

Expected:

- 前端 API、权限和类型检查通过。

- [x] **Step 4: 手工验证**

当前记录：已在 `http://localhost:3006/console/check-in` 完成手工验证。主办方账号 `13800000002` 查询 `sessionId=910011` 可看到总票数 `1`、已验票 `1`、未入场 `0`、失败 `1`、重复扫码 `1`，表格包含 `REAL-CHECKIN-SUCCESS-983013`、`REAL-CHECKIN-DUPLICATE-983013`、`REAL-CHECKIN-FAILED-983013` 三条记录。平台管理员账号 `13800000001` 查询同一场次也能看到相同概览和记录。普通用户账号 `13900000001` 访问 `/console/check-in` 被重定向回首页，且 `/tickets` 中 `ETREAL983013` 显示“已验票”。

启动项目后走：

```text
主办方登录 -> /console/check-in -> 输入有 seed 的 sessionId -> 查看入场概览和核验记录
平台管理员登录 -> /console/check-in -> 查询同一场次 -> 能看到记录
普通用户登录 -> /tickets -> 已验票票据显示“已验票”
```

Expected:

- 主办方只能查自己场次。
- 平台角色能查授权场次。
- 普通用户不能进入 `/console/check-in`。

---

## 后续阶段，不在本计划内

- Gateway 设备签名校验、限流、traceId 透传。
- 工作人员 App 或扫码设备对接。
- 备用 Web 扫码核验页。
- 离线核验包、离线同步冲突处理。
- MQ 投递 `TICKET_CHECKED_IN` / `CHECK_IN_FAILED` / `CHECK_IN_DUPLICATED` 事件。
- Redis nonce 去重、设备在线状态和短期结果缓存。

## 自检清单

- [x] 第一阶段没有把 Web 验票页当主流程。
- [x] 核验状态和记录归 `java-order`。
- [x] 控制台 facade 归 `java-ticket`，避免前端绕过主办方/场次权限。
- [x] 所有新增表在 `sql/production-split` 有迁移。
- [x] 本地数据库迁移命令已列出。
- [x] 前端入口、权限、类型、API 测试都有计划。
