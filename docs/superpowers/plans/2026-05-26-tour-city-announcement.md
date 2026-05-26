# Tour City Announcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 支持巡演先官宣活动和城市站点，C 端可见活动与城市，但场馆、时间、票价和购买入口可后续补齐。

**Architecture:** 复用现有 `Tour.reviewStatus` 和 `Station.publishStatus`，新增后端“巡演城市官宣”服务方法和管理接口。官宣只把巡演从草稿态推进到已官宣态，并把无场馆站点设为 `city_announced`；真正售票发布仍走现有 `publishStation()`，继续要求场馆审批通过。

**Tech Stack:** Java Spring Boot, MyBatis-Plus, PostgreSQL, Next.js 16, React 19, TypeScript, pnpm.

---

## File Structure

- Modify `java/java-ticket/src/main/java/com/omni/ticket/service/TourStationService.java`: 增加 `announceTourCities()`，保持 `publishStation()` 只处理售票发布。
- Modify `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`: 增加 `POST /api/ticket/admin/tours/{tourId}/announce`。
- Modify `java/java-ticket/src/test/java/com/omni/ticket/service/TourStationServiceTest.java`: 覆盖城市官宣、权限、列表排序。
- Modify `frontend/src/lib/api.ts`: 增加 `announceTourCities(userId, tourId)`。
- Modify `frontend/src/app/console/tours/page.tsx`: 列表“发布”改为“官宣活动/城市”，直接调用官宣接口并刷新。
- Modify `frontend/src/app/console/tours/[id]/page.tsx`: 区分“城市官宣”和“售票发布”，未补场馆时显示“城市已公布，场馆待公布”。

## Task 1: 后端巡演城市官宣服务

**Files:**
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/TourStationServiceTest.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TourStationService.java`

- [ ] **Step 1: Write failing test for announcing tour cities**

Add this test after `organizerListsOnlyOwnTours()` in `TourStationServiceTest`:

```java
@Test
void organizerAnnouncesOwnTourCitiesWithoutVenueApplication() {
    when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
    Tour tour = tour(10L, 2003L);
    tour.setReviewStatus("draft");
    when(tourMapper.selectById(10L)).thenReturn(tour);
    Station station = station(20L, 10L, null);
    station.setPublishStatus("draft");
    when(stationMapper.selectList(any())).thenReturn(List.of(station));

    Tour result = service.announceTourCities(2003L, 10L);

    assertSame(tour, result);
    verify(stationMapper).updateById(argThat(updated -> Long.valueOf(20L).equals(updated.getId())
            && "city_announced".equals(updated.getPublishStatus())
            && Integer.valueOf(1).equals(updated.getStatus())
            && updated.getUpdateTime() != null));
    verify(tourMapper).updateById(argThat(updated -> Long.valueOf(10L).equals(updated.getId())
            && "announced".equals(updated.getReviewStatus())
            && Integer.valueOf(1).equals(updated.getStatus())
            && updated.getUpdateTime() != null));
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `mvn test -pl java-ticket "-Dtest=TourStationServiceTest#organizerAnnouncesOwnTourCitiesWithoutVenueApplication"`

Expected: FAIL at compile stage because `announceTourCities(Long, Long)` does not exist.

- [ ] **Step 3: Add minimal service method**

In `TourStationService.java`, add this method after `listManageableTours()`:

```java
@Transactional
public Tour announceTourCities(Long userId, Long tourId) {
    InternalUserRefResponse user = requireAdminOrOrganizer(userId);
    Tour tour = tourMapper.selectById(tourId);
    if (tour == null || !Integer.valueOf(1).equals(tour.getStatus())) {
        throw new BusinessException(404, "演出项目不存在");
    }
    if ("organizer".equals(user.getRole()) && !userId.equals(tour.getOrganizerId())) {
        throw new BusinessException(403, "只能官宣自己的演出项目");
    }
    List<Station> stations = stationMapper.selectList(new LambdaQueryWrapper<Station>()
            .eq(Station::getTourId, tourId)
            .eq(Station::getStatus, 1));
    if (stations == null) {
        stations = Collections.emptyList();
    }
    LocalDateTime now = LocalDateTime.now();
    for (Station station : stations) {
        if (PUBLISH_STATUS_PUBLISHED.equals(station.getPublishStatus())) {
            continue;
        }
        station.setPublishStatus(PUBLISH_STATUS_CITY_ANNOUNCED);
        station.setUpdateTime(now);
        stationMapper.updateById(station);
    }
    tour.setReviewStatus("announced");
    tour.setUpdateTime(now);
    tourMapper.updateById(tour);
    return tour;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `mvn test -pl java-ticket "-Dtest=TourStationServiceTest#organizerAnnouncesOwnTourCitiesWithoutVenueApplication"`

Expected: PASS.

## Task 2: 后端官宣权限测试和控制器接口

**Files:**
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/TourStationServiceTest.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`

- [ ] **Step 1: Write failing permission test**

Add this test after `organizerAnnouncesOwnTourCitiesWithoutVenueApplication()`:

```java
@Test
void organizerCannotAnnounceOtherOrganizerTour() {
    when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
    Tour tour = tour(10L, 9999L);
    tour.setReviewStatus("draft");
    when(tourMapper.selectById(10L)).thenReturn(tour);

    BusinessException error = assertThrows(BusinessException.class,
            () -> service.announceTourCities(2003L, 10L));

    assertEquals(403, error.getCode());
    verify(tourMapper, never()).updateById(any());
    verify(stationMapper, never()).updateById(any());
}
```

- [ ] **Step 2: Run permission test**

Run: `mvn test -pl java-ticket "-Dtest=TourStationServiceTest#organizerCannotAnnounceOtherOrganizerTour"`

Expected: PASS after Task 1 implementation.

- [ ] **Step 3: Add controller endpoint**

In `AdminController.java`, add this method after `deleteTourDraft(...)`:

```java
@PostMapping("/tours/{tourId}/announce")
public Result<Tour> announceTourCities(@PathVariable Long tourId, @RequestBody Map<String, Object> body) {
    Long userId = parsePositiveLong(body == null ? null : body.get("userId"));
    return Result.success(tourStationService.announceTourCities(userId, tourId));
}
```

- [ ] **Step 4: Run focused backend tests**

Run: `mvn test -pl java-ticket "-Dtest=TourStationServiceTest#organizerAnnouncesOwnTourCitiesWithoutVenueApplication,TourStationServiceTest#organizerCannotAnnounceOtherOrganizerTour,TourStationServiceTest#listManageableToursOrdersByIdAsc"`

Expected: PASS.

## Task 3: 前端 API 和列表官宣按钮

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/app/console/tours/page.tsx`

- [ ] **Step 1: Add API helper**

In `frontend/src/lib/api.ts`, add after `deleteTourDraft(...)`:

```ts
export async function announceTourCities(userId: number, tourId: number) {
  assertPositiveInteger(userId, '用户ID')
  assertPositiveInteger(tourId, '巡演ID')
  return request<import('@/types/api').TourEntity>(`/api/ticket/admin/tours/${tourId}/announce`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
}
```

- [ ] **Step 2: Update imports and state**

In `frontend/src/app/console/tours/page.tsx`, change import:

```ts
import { announceTourCities, deleteTourDraft, listAdminTours } from '@/lib/api'
```

Add state after `deletingId`:

```ts
const [announcingId, setAnnouncingId] = useState<number | null>(null)
```

- [ ] **Step 3: Add announce handler**

In `ToursPage`, add after `handleDelete`:

```ts
const handleAnnounce = async (tour: TourEntity) => {
  const user = getUser()
  if (!user) {
    setError('请先登录后再操作')
    return
  }
  if (!(await globalConfirm(`确认先官宣“${tour.title}”及其城市站点？场馆、时间、票价和购票入口可之后补齐。`))) return
  setAnnouncingId(tour.id)
  try {
    await announceTourCities(user.userId, tour.id)
    await globalAlert('活动和城市站点已官宣，场馆信息可之后补齐')
    loadTours()
  } catch (err) {
    await globalAlert(err instanceof Error ? err.message : '官宣失败')
  } finally {
    setAnnouncingId(null)
  }
}
```

- [ ] **Step 4: Replace publish link with action button**

Replace the current `发布` Link in the operation column with:

```tsx
<button disabled={announcingId === tour.id} onClick={() => handleAnnounce(tour)} className="rounded px-2 py-1 text-[12px] text-[#16a34a] hover:bg-[#f0fff4] disabled:text-[#aaa]">
  {announcingId === tour.id ? '官宣中' : '官宣活动/城市'}
</button>
```

- [ ] **Step 5: Run frontend typecheck**

Run: `pnpm typecheck`

Expected: PASS.

## Task 4: 巡演详情页展示官宣状态和后补场馆指引

**Files:**
- Modify: `frontend/src/app/console/tours/[id]/page.tsx`

- [ ] **Step 1: Adjust status text**

In `formatPublishStatus`, keep this mapping:

```ts
city_announced: '城市已公布',
```

If it currently reads `未公布`, replace it with `城市已公布`.

- [ ] **Step 2: Keep售票发布条件 separate**

Ensure the station card computes:

```ts
const canPublish = item.station.publishStatus !== 'published' && item.station.venueApplicationId != null
const needsVenueBeforeSale = item.station.publishStatus !== 'published' && item.station.venueApplicationId == null
```

- [ ] **Step 3: Replace no-venue warning copy**

Replace the current no-venue warning block with:

```tsx
{needsVenueBeforeSale && (
  <div className="mt-4 rounded-xl border border-[#fde68a] bg-[#fffbeb] p-4 text-[13px] text-[#92400e]">
    城市已可先公布：前台会展示该城市站点，场馆、时间、票价和购票入口显示为待公布。后续提交并通过本次场馆审批资料后，可继续发布售票配置。
  </div>
)}
```

- [ ] **Step 4: Run frontend typecheck**

Run: `pnpm typecheck`

Expected: PASS.

## Task 5: Final Verification

**Files:**
- Verify only; no file changes expected.

- [ ] **Step 1: Run backend focused tests**

Run: `mvn test -pl java-ticket "-Dtest=TourStationServiceTest#organizerAnnouncesOwnTourCitiesWithoutVenueApplication,TourStationServiceTest#organizerCannotAnnounceOtherOrganizerTour,TourStationServiceTest#listManageableToursOrdersByIdAsc,TourStationServiceTest#publishStationCreatesActivitySessionCopiesLayoutGeneratesStockAndMarksPublished,TourStationServiceTest#publishStationCanMarkScheduleTbaWithoutCreatingSession"`

Expected: PASS.

- [ ] **Step 2: Run frontend typecheck**

Run in `frontend`: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 3: Run microservice boundary checks**

Run: `powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1`

Expected: `All microservice boundary checks passed.`

- [ ] **Step 4: Check whitespace**

Run: `git diff --check`

Expected: no whitespace errors. LF/CRLF warnings are acceptable in this workspace.

- [ ] **Step 5: Manual runtime check after service restart**

After restarting `java-ticket` and frontend dev server, log in as admin and open `/console/tours`.

Expected behavior:
- List is sorted by ID ascending.
- Clicking `官宣活动/城市` succeeds for a draft tour with only cities.
- Tour detail shows each station as `城市已公布` and explains场馆/时间/票价/购票入口可后补。
- C 端 tour detail can show announced cities with sale state `未公布` and no buy button.
