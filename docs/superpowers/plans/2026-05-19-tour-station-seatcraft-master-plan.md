# Tour/Station SeatCraft Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有活动/场馆/场次/票档流程重构为 Tour/Station + 场地申请审核 + SeatCraft 自由座位块 + 自动票档 + 订单用户侧隐藏。

**Architecture:** 该 spec 涉及多个独立子系统，必须分阶段落地。先做数据基础和兼容层，再做场地申请与 Tour/Station，再做 SeatCraft block，再做自动票档/库存，最后做前端工作台和订单可见性。每阶段都必须可编译、可测试、可回滚。

**Tech Stack:** PostgreSQL, Spring Boot, MyBatis-Plus, Next.js, React, TypeScript, Maven, pnpm.

---

## Scope Check

该 spec 不是一个单次可安全完成的小改动，覆盖以下独立子系统：

- 数据模型重构：Tour / Station / VenueApplication / SeatBlock / TicketGroup。
- 后端业务流：申请审核、草稿状态、自动推进、场次冲突、自动票档、库存生成。
- SeatCraft 前端编辑器：自由 block、arc、standing、override、复制、镜像、吸附、预览缩放。
- B 端工作台：主办方聚合式创建演出向导，admin 审核入口。
- C 端详情页：Tour 站点横向切换。
- 订单权限：admin/organizer 查询范围，用户侧回收站。
- 测试数据清理。

因此本文件是总实施计划。执行时必须拆成 6 个子计划，每个子计划独立验收。

## Phase Overview

1. Phase 0：清理验证测试数据与修复 kill-ports。
2. Phase 1：数据库基础模型与兼容字段。
3. Phase 2：Tour / Station / VenueApplication 后端闭环。
4. Phase 3：SeatCraft 自由 block 数据模型与编辑器。
5. Phase 4：自动票档、场次库存、下单锁座。
6. Phase 5：B 端主办方工作台与 C 端站点切换。
7. Phase 6：订单可见性、回收站、admin/organizer 订单查询。

---

## Phase 0: 清理测试数据与环境脚本

**Files:**
- Modify: `kill-ports.bat`
- Create: `sql/20260519_cleanup_test_data.sql`

### Task 0.1: 清理本次验证产生的数据

- [ ] **Step 1: 创建清理 SQL**

Create `sql/20260519_cleanup_test_data.sql`:

```sql
-- Cleanup manual API verification data created during SeatCraft redesign.
DELETE FROM venue_default_layout_section
WHERE layout_id IN (
    SELECT id FROM venue_default_layout WHERE venue_id IN (
        SELECT id FROM venue WHERE name IN ('测试场馆', '__TEST__测试场馆')
    )
);

DELETE FROM venue_default_layout
WHERE venue_id IN (
    SELECT id FROM venue WHERE name IN ('测试场馆', '__TEST__测试场馆')
);

DELETE FROM venue
WHERE name IN ('测试场馆', '__TEST__测试场馆');
```

- [ ] **Step 2: 执行清理 SQL**

Run:

```powershell
$env:PGPASSWORD="123456"
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -h localhost -U postgres -d omni_ticket -f sql/20260519_cleanup_test_data.sql
```

Expected:

```text
DELETE 1
```

实际删除数量可为 0，表示数据已被清理。

### Task 0.2: 修复 kill-ports 不杀 Nacos

- [ ] **Step 1: 更新 `kill-ports.bat`**

Use this content:

```bat
@echo off
echo ========================================
echo  Omni - Close Application Services
echo ========================================
echo.

set PORTS=8088 8081 8082 8083 8084 8085 3000 3001

for %%p in (%PORTS%) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%p" ^| findstr /C:"LISTENING"') do (
        if not "%%a"=="0" (
            echo [port %%p] kill PID %%a
            taskkill /F /PID %%a >nul 2>&1
        )
    )
)

echo.
echo Nacos 8848 is not stopped by this script.
echo Start Nacos manually if needed:
echo   C:\nacos\bin\startup.cmd -m standalone
echo.
echo Done.
pause
```

- [ ] **Step 2: 验证 8082 可释放但 8848 保留**

Run:

```powershell
C:\Users\Administrator\Desktop\omni\kill-ports.bat
```

Expected:

```text
Nacos 8848 is not stopped by this script.
```

---

## Phase 1: 数据库基础模型

**Files:**
- Create: `sql/20260519_tour_station_foundation.sql`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/entity/Activity.java`
- Create Java entities/mappers for Tour, Station, Venue usage, SeatBlock, SeatOverride, TicketGroup.
- Modify tests under `java/java-ticket/src/test/java/com/omni/ticket`.

### Task 1.1: 新增 Tour / Station / VenueApplication 字段

- [ ] **Step 1: 创建迁移 SQL**

Create `sql/20260519_tour_station_foundation.sql`:

```sql
CREATE TABLE tour (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(160) NOT NULL,
    artist_id BIGINT,
    category_id BIGINT,
    poster VARCHAR(500),
    description TEXT,
    organizer_id BIGINT NOT NULL,
    review_status VARCHAR(30) NOT NULL DEFAULT 'draft',
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE station (
    id BIGSERIAL PRIMARY KEY,
    tour_id BIGINT NOT NULL REFERENCES tour(id),
    city VARCHAR(80) NOT NULL,
    station_name VARCHAR(120) NOT NULL,
    poster VARCHAR(500),
    description TEXT,
    venue_application_id BIGINT,
    publish_status VARCHAR(30) NOT NULL DEFAULT 'draft',
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE activity ADD COLUMN IF NOT EXISTS tour_id BIGINT;
ALTER TABLE activity ADD COLUMN IF NOT EXISTS station_id BIGINT;
ALTER TABLE activity ADD COLUMN IF NOT EXISTS venue_application_id BIGINT;
ALTER TABLE activity ADD COLUMN IF NOT EXISTS publish_status VARCHAR(30) NOT NULL DEFAULT 'published';

ALTER TABLE venue_application ADD COLUMN IF NOT EXISTS venue_id BIGINT;
ALTER TABLE venue_application ADD COLUMN IF NOT EXISTS valid_from TIMESTAMP;
ALTER TABLE venue_application ADD COLUMN IF NOT EXISTS valid_to TIMESTAMP;
ALTER TABLE venue_application ADD COLUMN IF NOT EXISTS proof_note TEXT;
ALTER TABLE venue_application ADD COLUMN IF NOT EXISTS proof_file_url VARCHAR(500);
ALTER TABLE venue_application ADD COLUMN IF NOT EXISTS layout_snapshot JSONB;
ALTER TABLE venue_application ADD COLUMN IF NOT EXISTS set_as_recommended_layout BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_station_tour ON station(tour_id);
CREATE INDEX idx_activity_tour ON activity(tour_id);
CREATE INDEX idx_activity_station ON activity(station_id);
CREATE INDEX idx_activity_publish_status ON activity(publish_status);
```

- [ ] **Step 2: 执行迁移 SQL**

Run:

```powershell
$env:PGPASSWORD="123456"
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -h localhost -U postgres -d omni_ticket -f sql/20260519_tour_station_foundation.sql
```

Expected: `CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX` succeed.

### Task 1.2: 新增 SeatCraft block 表

- [ ] **Step 1: 扩展迁移 SQL**

Append to `sql/20260519_tour_station_foundation.sql`:

```sql
CREATE TABLE seat_block (
    id BIGSERIAL PRIMARY KEY,
    owner_type VARCHAR(30) NOT NULL,
    owner_id BIGINT NOT NULL,
    block_key VARCHAR(80) NOT NULL,
    name VARCHAR(120) NOT NULL,
    block_type VARCHAR(30) NOT NULL,
    ticket_group_key VARCHAR(80) NOT NULL,
    x NUMERIC(10,2) NOT NULL DEFAULT 0,
    y NUMERIC(10,2) NOT NULL DEFAULT 0,
    rotation NUMERIC(8,2) NOT NULL DEFAULT 0,
    scale NUMERIC(8,3) NOT NULL DEFAULT 1,
    rows INTEGER,
    cols INTEGER,
    seats_per_row INTEGER,
    row_spacing NUMERIC(10,2),
    seat_spacing NUMERIC(10,2),
    inner_radius NUMERIC(10,2),
    arc_start_angle NUMERIC(8,2),
    arc_end_angle NUMERIC(8,2),
    width NUMERIC(10,2),
    height NUMERIC(10,2),
    capacity INTEGER,
    color VARCHAR(20) NOT NULL DEFAULT '#ff1268',
    sort INTEGER NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_seat_block_owner CHECK (owner_type IN ('venue', 'venue_application', 'station', 'activity', 'session')),
    CONSTRAINT chk_seat_block_type CHECK (block_type IN ('gridBlock', 'arcBlock', 'standingBlock')),
    CONSTRAINT uq_seat_block_key UNIQUE (owner_type, owner_id, block_key)
);

CREATE TABLE seat_override (
    id BIGSERIAL PRIMARY KEY,
    block_id BIGINT NOT NULL REFERENCES seat_block(id) ON DELETE CASCADE,
    row_no INTEGER NOT NULL,
    seat_no INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'visible',
    dx NUMERIC(10,2) NOT NULL DEFAULT 0,
    dy NUMERIC(10,2) NOT NULL DEFAULT 0,
    custom_label VARCHAR(80),
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_seat_override_status CHECK (status IN ('visible', 'hidden', 'deleted')),
    CONSTRAINT uq_seat_override_position UNIQUE (block_id, row_no, seat_no)
);

CREATE TABLE ticket_group (
    id BIGSERIAL PRIMARY KEY,
    owner_type VARCHAR(30) NOT NULL,
    owner_id BIGINT NOT NULL,
    group_key VARCHAR(80) NOT NULL,
    name VARCHAR(120) NOT NULL,
    default_price NUMERIC(10,2),
    activity_price NUMERIC(10,2),
    source_block_ids TEXT,
    sort INTEGER NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_ticket_group_owner CHECK (owner_type IN ('venue', 'venue_application', 'station', 'activity', 'session')),
    CONSTRAINT uq_ticket_group_key UNIQUE (owner_type, owner_id, group_key)
);

ALTER TABLE session_seat ADD COLUMN IF NOT EXISTS seat_block_id BIGINT;
ALTER TABLE session_seat ADD COLUMN IF NOT EXISTS ticket_group_key VARCHAR(80);
ALTER TABLE session_seat ADD COLUMN IF NOT EXISTS generated_row_no INTEGER;
ALTER TABLE session_seat ADD COLUMN IF NOT EXISTS generated_seat_no INTEGER;

CREATE INDEX idx_seat_block_owner ON seat_block(owner_type, owner_id);
CREATE INDEX idx_ticket_group_owner ON ticket_group(owner_type, owner_id);
CREATE INDEX idx_session_seat_block ON session_seat(seat_block_id);
```

- [ ] **Step 2: 编译后端**

Run:

```powershell
cd C:\Users\Administrator\Desktop\omni\java
mvn compile -pl java-ticket -am -DskipTests
```

Expected: `BUILD SUCCESS`.

---

## Phase 2: Tour / Station / VenueApplication 后端闭环

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/entity/Tour.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/entity/Station.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/mapper/TourMapper.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/mapper/StationMapper.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/TourStationService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/VenueApplicationService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`

### Task 2.1: 新增 Tour/Station 实体和 Mapper

- [ ] **Step 1: 创建实体字段**

`Tour.java` must map to `tour` and contain getters/setters for all SQL columns.

`Station.java` must map to `station` and contain getters/setters for all SQL columns.

- [ ] **Step 2: 创建 Mapper**

Create `TourMapper extends BaseMapper<Tour>` and `StationMapper extends BaseMapper<Station>`.

- [ ] **Step 3: 编译验证**

Run:

```powershell
cd C:\Users\Administrator\Desktop\omni\java
mvn compile -pl java-ticket -am -DskipTests
```

Expected: `BUILD SUCCESS`.

### Task 2.2: 创建演出草稿 API

- [ ] **Step 1: 添加 `TourStationService.createTourDraft()`**

Method signature:

```java
@Transactional
public Tour createTourDraft(Long userId, Map<String, Object> body)
```

Behavior:

- user must be `admin` or `organizer`.
- require non-empty `title`.
- optional `artistId`, `categoryId`, `poster`, `description`.
- set `organizerId = userId` for organizer; for admin accept `organizerId` if present, otherwise admin id.
- set `reviewStatus = draft`, `status = 1`.

- [ ] **Step 2: 添加 Controller endpoint**

`POST /api/ticket/admin/tours/draft`

Request body:

```json
{
  "userId": 2003,
  "title": "伍佰 ROCK STAR 2 巡回演唱会",
  "artistId": 1,
  "categoryId": 1,
  "poster": "https://example.com/poster.jpg",
  "description": "巡演介绍"
}
```

Expected response: `Result<Tour>`.

### Task 2.3: Station 绑定场地申请

- [ ] **Step 1: 添加 `createStationDraft()`**

Method signature:

```java
@Transactional
public Station createStationDraft(Long userId, Long tourId, Map<String, Object> body)
```

Behavior:

- user can manage tour.
- require `city` and `stationName`.
- optional poster/description overrides.
- set `publishStatus = draft`.

- [ ] **Step 2: 添加 endpoint**

`POST /api/ticket/admin/tours/{tourId}/stations/draft`

Expected response: `Result<Station>`.

### Task 2.4: VenueApplication 加有效期和证明字段

- [ ] **Step 1: 修改 DTO**

Modify `VenueApplicationRequest` to include:

```java
private LocalDateTime validFrom;
private LocalDateTime validTo;
private String proofNote;
private String proofFileUrl;
private SeatCraftBlockDtos.LayoutRequest layout;
```

- [ ] **Step 2: 修改服务校验**

Validation:

- `validFrom` required.
- `validTo` required and after `validFrom`.
- `proofNote` or `proofFileUrl` must be present.
- layout must contain at least one block and at least one ticket group.

---

## Phase 3: SeatCraft 自由 block

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/SeatCraftBlockDtos.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/entity/SeatBlock.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/entity/SeatOverride.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/entity/TicketGroup.java`
- Create corresponding mappers and services.
- Modify: `frontend/src/components/seatcraft/*`

### Task 3.1: 定义 SeatCraftBlockDtos

- [ ] **Step 1: 创建 DTO**

`SeatCraftBlockDtos.LayoutRequest`:

```java
public static class LayoutRequest {
    private String name;
    private Integer canvasWidth;
    private Integer canvasHeight;
    private List<BlockRequest> blocks;
    private List<OverrideRequest> overrides;
    private List<TicketGroupRequest> ticketGroups;
}
```

`BlockRequest` must contain fields from `seat_block` except db metadata.

`OverrideRequest` must contain `blockKey`, `rowNo`, `seatNo`, `status`, `dx`, `dy`, `customLabel`.

`TicketGroupRequest` must contain `groupKey`, `name`, `defaultPrice`, `activityPrice`, `sourceBlockKeys`, `sort`.

### Task 3.2: 座位生成算法

- [ ] **Step 1: 创建 `SeatBlockGeometryService`**

Methods:

```java
public List<GeneratedSeat> generateSeats(SeatBlock block, List<SeatOverride> overrides)
public int countSellableSeats(SeatBlock block, List<SeatOverride> overrides)
```

Rules:

- `gridBlock`: rows * cols minus deleted/hidden overrides.
- `arcBlock`: rows * seatsPerRow minus deleted/hidden overrides.
- `standingBlock`: no generated seats, count uses `capacity`.

Generated seat must include rowNo, seatNo, label, x, y, blockId, ticketGroupKey.

### Task 3.3: 前端 SeatCraft block 编辑器

- [ ] **Step 1: 修改前端类型**

Modify `frontend/src/components/seatcraft/types.ts`:

- Replace `SeatCraftSection` with `SeatBlockDraft`.
- Add `SeatOverrideDraft`.
- Add `TicketGroupDraft`.
- Add block type union: `'gridBlock' | 'arcBlock' | 'standingBlock'`.

- [ ] **Step 2: 修改渲染**

`SeatLayoutDesigner` must render:

- grid seats from block parameters.
- arc seats by angle interpolation.
- standing block as filled labeled area.

- [ ] **Step 3: 添加复制/镜像/吸附基础能力**

Minimum scope for first pass:

- duplicate block.
- mirror horizontally by negating relative angle or position around canvas center.
- snap block x/y to canvas center and nearby block x/y within 8 px.

---

## Phase 4: 自动票档与库存

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SessionAdminService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SessionSeatLayoutService.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/AutoTicketGroupService.java`
- Modify tests for session creation and ticket generation.

### Task 4.1: 场次创建自动复制 Station/Activity block

- [ ] **Step 1: 新建自动票档服务**

`AutoTicketGroupService.generateForSession(Long userId, Long sessionId)`:

- Load session.
- Load station/activity block snapshot.
- Group blocks by `ticketGroupKey`.
- Validate each group has exactly one price.
- Create one `ticket_type` per group.
- For seat blocks, expand generated seats into `session_seat`.
- For standing blocks, only create ticket_type stock, no session_seat rows.

### Task 4.2: 移除场次页新增票档依赖

- [ ] **Step 1: 后端保留旧 createTicketType 但不作为主流程**

`POST /ticket-types` remains for admin/debug only.

- [ ] **Step 2: 前端场次管理删除新增票档按钮**

Modify `frontend/src/app/console/sessions/page.tsx`:

- remove `openTicketForm` UI entry.
- replace ticket button with read-only ticket summary.

---

## Phase 5: 前端工作台与 Tour 详情页

**Files:**
- Modify: `frontend/src/app/console/layout.tsx`
- Create: `frontend/src/app/console/tours/page.tsx`
- Create: `frontend/src/app/console/tours/new/page.tsx`
- Create: `frontend/src/app/tour/[id]/page.tsx`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/types/api.ts`

### Task 5.1: Organizer 侧边栏重组

- [ ] **Step 1: organizer 显示新菜单**

Organizer menu:

- 我的演出 `/console/tours`
- 创建演出 `/console/tours/new`
- 场地申请记录 `/console/venue/apply`
- 订单 `/console/orders`

Admin menu may keep global management entries.

### Task 5.2: 创建演出分步向导

- [ ] **Step 1: 创建页面骨架**

`frontend/src/app/console/tours/new/page.tsx` steps:

1. Tour 基本信息。
2. Station 城市站点。
3. 场地申请和证明。
4. SeatCraft block。
5. 票档组价格。
6. 场次排期。
7. 发布确认。

### Task 5.3: C 端 Tour 站点切换

- [ ] **Step 1: 创建 Tour 详情页**

`frontend/src/app/tour/[id]/page.tsx`:

- top horizontal station tabs.
- selected station controls time, venue, price range, sale status.
- if only one station, still use same structure.

---

## Phase 6: 订单可见性与权限查询

**Files:**
- Create: `sql/20260519_order_visibility.sql`
- Modify: `java/java-order/src/main/java/...` order entities/services/controllers.
- Modify: `frontend/src/app/orders/page.tsx`
- Modify: `frontend/src/app/console/orders/page.tsx`

### Task 6.1: 用户侧订单可见性表

- [ ] **Step 1: 创建 SQL**

Create `sql/20260519_order_visibility.sql`:

```sql
CREATE TABLE order_user_visibility (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    order_id BIGINT NOT NULL,
    visibility_status VARCHAR(20) NOT NULL DEFAULT 'visible',
    trashed_at TIMESTAMP,
    expire_at TIMESTAMP,
    restored_at TIMESTAMP,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_order_visibility_status CHECK (visibility_status IN ('visible', 'trashed', 'expired')),
    CONSTRAINT uq_order_user_visibility UNIQUE (user_id, order_id)
);

CREATE INDEX idx_order_user_visibility_user ON order_user_visibility(user_id, visibility_status);
CREATE INDEX idx_order_user_visibility_order ON order_user_visibility(order_id);
```

### Task 6.2: 用户删除订单进入 7 天回收站

- [ ] **Step 1: 添加后端接口**

`POST /api/order/{orderId}/trash`

Body:

```json
{ "userId": 2004 }
```

Behavior:

- Only order owner can trash.
- Do not physical delete.
- If paid and session is not ended and not refunded, reject with `400`.
- If refunding or after-sale status exists, reject with `400`.
- Set visibility_status `trashed`, `trashed_at = now`, `expire_at = now + 7 days`.

### Task 6.3: 恢复订单

- [ ] **Step 1: 添加接口**

`POST /api/order/{orderId}/restore`

Rules:

- Only owner can restore.
- Only restore before `expire_at`.
- Set `visibility_status = visible`, `restored_at = now`.

### Task 6.4: admin/organizer 订单查询

- [ ] **Step 1: admin 查询用户订单**

Add query params:

- `userId`
- `phone`
- `orderNo`
- `tourId`
- `stationId`
- `status`

Admin ignores `order_user_visibility`.

- [ ] **Step 2: organizer 查询自己活动订单**

Organizer can only query orders where linked Tour/Station/activity belongs to organizer.

Organizer ignores user-side trash state.

---

## Verification Commands

Run after each phase:

```powershell
cd C:\Users\Administrator\Desktop\omni\java
mvn test -pl java-ticket -am
```

For order phase:

```powershell
cd C:\Users\Administrator\Desktop\omni\java
mvn test -pl java-order -am
```

Frontend:

```powershell
cd C:\Users\Administrator\Desktop\omni\frontend
pnpm run typecheck
```

Package before restart:

```powershell
cd C:\Users\Administrator\Desktop\omni\java
mvn clean package -pl java-ticket -am -DskipTests
```

## Self-Review

Spec coverage:

- Tour/Station covered by Phase 1, Phase 2, Phase 5.
- VenueApplication and no public venue library covered by Phase 2.
- SeatCraft block model covered by Phase 1 and Phase 3.
- TicketGroup and automatic ticket generation covered by Phase 4.
- Organizer workbench and Tour detail station switch covered by Phase 5.
- Order visibility, recycle bin, admin/organizer query covered by Phase 6.
- Test data cleanup covered by Phase 0.

Known deliberate split:

- This master plan must not be executed as one giant change. Each phase should get its own detailed implementation sub-plan before coding.
