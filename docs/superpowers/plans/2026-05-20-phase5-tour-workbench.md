# Phase 5 Tour Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Tour/Station 模型补齐前端入口：主办方工作台菜单、Tour 草稿创建页、Tour 列表页和 C 端 Tour 详情页骨架。

**Architecture:** 先做可用的轻量前端闭环，不替换旧活动管理。复用 Phase 2 已有 `POST /admin/tours/draft` 和 `POST /admin/tours/{id}/stations/draft`，新增最小查询接口支撑列表和详情页。

**Tech Stack:** Next.js 16, React 19, TypeScript, Spring Boot, MyBatis-Plus, Maven, pnpm.

---

## File Structure

- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TourStationService.java`，新增可管理 Tour 列表和 Tour 详情查询。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`，新增 B 端 Tour 列表接口。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/ActivityController.java`，新增 C 端 Tour 详情接口。
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/TourStationServiceTest.java`。
- Test: `java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java`。
- Modify: `frontend/src/types/api.ts`，新增 `TourEntity`、`StationEntity`、`TourDetailVO` 类型。
- Modify: `frontend/src/lib/api.ts`，新增 Tour API。
- Modify: `frontend/src/app/console/layout.tsx`，organizer 菜单新增我的演出/创建演出。
- Create: `frontend/src/app/console/tours/page.tsx`。
- Create: `frontend/src/app/console/tours/new/page.tsx`。
- Create: `frontend/src/app/tour/[id]/page.tsx`。

## Task 1: Backend Tour Queries

- [ ] **Step 1: Write failing tests**

Add tests for:
- organizer only sees own tours.
- admin can list all tours.
- C side tour detail returns tour plus stations.

- [ ] **Step 2: Implement minimal service API**

Add to `TourStationService`:

```java
public Page<Tour> listManageableTours(Long userId, int page, int size)
public Map<String, Object> getTourDetail(Long tourId)
```

Rules:
- `listManageableTours`: admin sees all active tours, organizer sees `organizer_id=userId` active tours.
- `getTourDetail`: public detail only returns active tour and active stations ordered by id.

- [ ] **Step 3: Add controller endpoints**

Admin:

```http
GET /api/ticket/admin/tours?userId=2003&page=1&size=10
```

Public:

```http
GET /api/ticket/tours/{tourId}
```

## Task 2: Frontend Types And API

- [ ] **Step 1: Add types**

Add `TourEntity`、`StationEntity`、`TourDetailVO` to `frontend/src/types/api.ts` with fields matching Java entities.

- [ ] **Step 2: Add API functions**

Add to `frontend/src/lib/api.ts`:

```ts
export async function listAdminTours(userId: number, params: { page?: number; size?: number } = {})
export async function createTourDraft(body: Record<string, unknown>)
export async function createStationDraft(tourId: number, body: Record<string, unknown>)
export async function getTourDetail(id: number)
```

## Task 3: Organizer Navigation

- [ ] **Step 1: Update sidebar**

`organizer` role menu should include:
- `/console/tours` 我的演出
- `/console/tours/new` 创建演出
- `/console/venue/apply` 场地申请记录
- `/console/orders` 订单
- `/console/profile` 个人中心

Admin keeps existing global entries and also can access Tour pages.

## Task 4: Tour List And Draft Wizard Skeleton

- [ ] **Step 1: Create Tour list page**

`/console/tours` loads `listAdminTours` and renders title, reviewStatus, status, createTime, station link placeholder.

- [ ] **Step 2: Create minimal new Tour wizard**

`/console/tours/new` implements two working steps first:
- Tour 基本信息: title, poster, description.
- Station 草稿: city, stationName.

Submit flow:
1. `createTourDraft({ userId, title, poster, description })`
2. `createStationDraft(tour.id, { userId, city, stationName })`
3. redirect `/console/tours`

Show remaining future steps as disabled progress labels: 场地申请、SeatCraft、票档价格、场次排期、发布确认。

## Task 5: Public Tour Detail Skeleton

- [ ] **Step 1: Create `/tour/[id]` page**

Load `getTourDetail(id)` and render:
- tour poster/title/description.
- horizontal station tabs.
- selected station city/stationName/publishStatus.
- empty-state message when no stations.

## Task 6: Verification

- [ ] **Step 1: Run backend tests**

```powershell
mvn test -pl java-ticket -am
```

- [ ] **Step 2: Run frontend typecheck**

```powershell
pnpm run typecheck
```

## Self-Review

- Scope is intentionally a skeleton: it creates usable Tour/Station entry points without replacing old activity creation.
- No dependency on venue approval or SeatCraft wizard completion in this phase.
- Public C detail shows station tabs but does not yet replace `/activity/[id]` purchase flow.
