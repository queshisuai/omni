# Tour Station TBA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让巡演城市站支持先公布城市/场馆但暂不公布场次时间和票档。

**Architecture:** 复用现有 `station.publishStatus` 和 `TourStationService.publishStation()`，新增请求参数 `scheduleTba`。当 `scheduleTba=true` 时，站点可进入 `published` 且创建活动，但不创建场次、不生成座位、不要求时间；C 端现有 summary 会显示 `to_be_scheduled/待定`。

**Tech Stack:** Java Spring Boot + MyBatis-Plus + JUnit/Mockito，Next.js + React + TypeScript。

---

## File Structure

- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TourStationService.java`，支持 `scheduleTba` 发布。
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/TourStationServiceTest.java`，覆盖待公布发布不创建 session。
- Modify: `frontend/src/app/console/tours/[id]/page.tsx`，发布城市站表单增加“时间待公布”选项。

### Task 1: Backend Schedule TBA Publish

**Files:**
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/TourStationServiceTest.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TourStationService.java`

- [x] **Step 1: Write failing test**

Add test:

```java
@Test
void publishStationCanMarkScheduleTbaWithoutCreatingSession() {
    when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
    Tour tour = tour(10L, 2003L);
    tour.setTitle("万象巡演");
    tour.setCategoryId(2L);
    tour.setArtistId(3L);
    Station station = station(20L, 10L, 88L);
    VenueApplication application = approvedApplication(88L, 2003L, 101L,
            LocalDateTime.of(2026, 6, 1, 0, 0), LocalDateTime.of(2026, 6, 30, 23, 59));
    when(tourMapper.selectById(10L)).thenReturn(tour);
    when(stationMapper.selectById(20L)).thenReturn(station);
    when(venueApplicationMapper.selectById(88L)).thenReturn(application);
    doAnswer(invocation -> {
        Activity activity = invocation.getArgument(0);
        activity.setId(301L);
        return 1;
    }).when(activityMapper).insert(any(Activity.class));

    Map<String, Object> result = service.publishStation(2003L, 20L, Map.of("scheduleTba", true));

    Activity activity = (Activity) result.get("activity");
    assertEquals("published", activity.getPublishStatus());
    assertEquals("published", station.getPublishStatus());
    assertEquals(null, result.get("session"));
    verify(sessionMapper, never()).insert(any(Session.class));
    verify(sessionSeatLayoutService, never()).copyFromActivity(any(), any(), any());
    verify(sessionSeatLayoutService, never()).generateSessionSeats(any());
}
```

- [x] **Step 2: Run failing test**

Run: `mvn test -pl java-ticket "-Dtest=TourStationServiceTest#publishStationCanMarkScheduleTbaWithoutCreatingSession"`

Expected: FAIL because `publishStation` currently requires start/end time.

- [x] **Step 3: Implement scheduleTba branch**

In `publishStation`, parse:

```java
boolean scheduleTba = isTrue(body == null ? null : body.get("scheduleTba"));
LocalDateTime startTime = scheduleTba ? null : parseTime(body == null ? null : body.get("startTime"), "开始时间不能为空");
LocalDateTime endTime = scheduleTba ? null : parseTime(body == null ? null : body.get("endTime"), "结束时间不能为空");
```

Only validate time/conflict and create session when `!scheduleTba`.

- [x] **Step 4: Run full TourStationServiceTest**

Run: `mvn test -pl java-ticket "-Dtest=TourStationServiceTest"`

Expected: PASS.

### Task 2: Frontend Publish Form

**Files:**
- Modify: `frontend/src/app/console/tours/[id]/page.tsx`

- [x] **Step 1: Extend PublishForm**

Add:

```ts
scheduleTba: boolean
```

Default it to `false` in `updatePublishForm` and local fallback.

- [x] **Step 2: Adjust validation**

Change publish validation to only require `startTime/endTime` when `!form.scheduleTba`.

- [x] **Step 3: Send scheduleTba**

Call `publishStation` with:

```ts
scheduleTba: form.scheduleTba,
startTime: form.scheduleTba ? null : form.startTime,
endTime: form.scheduleTba ? null : form.endTime,
```

- [x] **Step 4: Render checkbox**

Add checkbox above time fields:

```tsx
<label className="flex items-start gap-2 rounded-lg bg-white p-3 text-[13px] text-[#333] sm:col-span-3">
  <input type="checkbox" checked={publishForm.scheduleTba} onChange={event => updatePublishForm(item.station.id, 'scheduleTba', event.target.checked)} className="mt-0.5" />
  <span><span className="font-medium">场次时间待公布</span>：先发布城市站和场馆，暂不展示具体时间、票价和购买入口。</span>
</label>
```

Disable time inputs when checked.

### Task 3: Verification

- [x] Run `mvn test -pl java-ticket "-Dtest=TourStationServiceTest"`.
- [x] Run `pnpm typecheck` in `frontend`.
- [x] Run `git diff --check -- java/java-ticket/src/main/java/com/omni/ticket/service/TourStationService.java java/java-ticket/src/test/java/com/omni/ticket/service/TourStationServiceTest.java frontend/src/app/console/tours/[id]/page.tsx docs/superpowers/plans/2026-05-25-tour-station-tba.md`.

## Self Review

- Covers巡演城市站先待公布。
- Does not yet implement票档待公布；that is next sequential task.
- Uses existing C-side `to_be_scheduled` behavior and avoids DB migration.
