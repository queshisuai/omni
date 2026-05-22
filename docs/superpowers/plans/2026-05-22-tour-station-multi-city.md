# Tour Station Multi-City Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Tour-first multi-city巡演 flow where organizers create one Tour, add Stations over time, show unannounced cities as “未公布”, and keep Activity as each published Station’s ticketing entity.

**Architecture:** Extend the existing `TourStationService` instead of replacing it. `Tour` remains the巡演 IP, `Station` is the city and venue-approval unit, `Activity` remains the sellable entity generated or reused when a station is published, and C-side Tour detail renders station-level purchase state.

**Tech Stack:** Java Spring Boot, MyBatis-Plus, PostgreSQL, Next.js 16, React 19, TypeScript, pnpm, Maven.

---

## File Map

- Modify `java/java-ticket/src/main/java/com/omni/ticket/service/TourStationService.java`: add station status constants, admin Tour detail aggregation, station status derivation, C-side station purchase detail enrichment, and publish idempotency.
- Modify `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`: add `GET /api/ticket/admin/tours/{tourId}` and keep existing Tour/Station endpoints.
- Modify `java/java-ticket/src/test/java/com/omni/ticket/service/TourStationServiceTest.java`: add unit tests for city-announced stations, admin detail, and activity reuse on publish.
- Modify `frontend/src/types/api.ts`: add `TourAdminDetailVO`, station sale-state fields, and station publish status union.
- Modify `frontend/src/lib/api.ts`: add `getAdminTourDetail()` and keep existing Tour APIs.
- Modify `frontend/src/app/console/tours/new/page.tsx`: reduce the page to Tour-only creation and redirect to Tour detail.
- Create `frontend/src/app/console/tours/[id]/page.tsx`: Tour detail management with station list and “新增城市站点” entry.
- Create `frontend/src/app/console/tours/[id]/stations/new/page.tsx`: add a station to an existing Tour, including “仅公布城市” mode and optional venue application submission.
- Modify `frontend/src/app/console/tours/page.tsx`: link Tour rows to Tour detail.
- Modify `frontend/src/app/tour/[id]/page.tsx`: render horizontal station tabs, unannounced city state, venue/time/price linkage, and buy button rules.
- Modify `sql/seed.sql`: add a small Tour + multi-city Station demo using the downloaded local seed posters and leaving most cities as `city_announced`.

## Task 1: Backend Station Status And Detail Aggregation

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TourStationService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/TourStationServiceTest.java`

- [ ] **Step 1: Write failing tests for station publish status and enriched Tour detail**

Add these imports to `TourStationServiceTest.java`:

```java
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.entity.Venue;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.mapper.VenueMapper;
import java.math.BigDecimal;
```

Add mocks next to the existing mapper mocks:

```java
@Mock
private TicketTypeMapper ticketTypeMapper;
@Mock
private VenueMapper venueMapper;
```

Update `setUp()` to use the expanded constructor that will be added in Step 3:

```java
@BeforeEach
void setUp() {
    service = new TourStationService(tourMapper, stationMapper, userAccessService, venueApplicationMapper,
            activityMapper, sessionMapper, activitySeatLayoutService, sessionSeatLayoutService,
            ticketTypeMapper, venueMapper);
}
```

Add this test after `stationDraftStoresVenueApplicationIdWhenProvided()`:

```java
@Test
void stationDraftCanBeCityAnnouncedWithoutVenueApplication() {
    when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
    when(tourMapper.selectById(10L)).thenReturn(tour(10L, 2003L));

    service.createStationDraft(2003L, 10L, Map.of(
            "city", "西安",
            "stationName", "西安站",
            "announceOnly", true));

    ArgumentCaptor<Station> captor = ArgumentCaptor.forClass(Station.class);
    verify(stationMapper).insert(captor.capture());
    assertEquals("city_announced", captor.getValue().getPublishStatus());
    assertEquals(null, captor.getValue().getVenueApplicationId());
}
```

Add this test after `getTourDetailIncludesPublishedStationPurchaseData()`:

```java
@Test
void getTourDetailMarksCityAnnouncedStationAsUnannounced() {
    Tour tour = tour(10L, 2003L);
    Station station = station(20L, 10L, null);
    station.setPublishStatus("city_announced");
    when(tourMapper.selectById(10L)).thenReturn(tour);
    when(stationMapper.selectList(any())).thenReturn(List.of(station));
    when(activityMapper.selectList(any())).thenReturn(List.of());

    Map<String, Object> detail = service.getTourDetail(10L);

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> stationDetails = (List<Map<String, Object>>) detail.get("stationDetails");
    assertEquals(1, stationDetails.size());
    assertEquals("unannounced", stationDetails.get(0).get("saleStatus"));
    assertEquals("未公布", stationDetails.get(0).get("saleStatusText"));
    assertEquals("none", stationDetails.get(0).get("primaryAction"));
    assertEquals(null, stationDetails.get(0).get("venueName"));
    assertEquals(null, stationDetails.get(0).get("priceMin"));
}
```

Add this test after that:

```java
@Test
void getTourDetailReturnsVenuePriceAndOnSaleStatusForPublishedStation() {
    Tour tour = tour(10L, 2003L);
    Station station = station(20L, 10L, 88L);
    station.setPublishStatus("published");
    Activity activity = new Activity();
    activity.setId(301L);
    activity.setTourId(10L);
    activity.setStationId(20L);
    activity.setPublishStatus("published");
    activity.setStatus(1);
    Session session = new Session();
    session.setId(401L);
    session.setActivityId(301L);
    session.setVenueId(101L);
    session.setStatus(1);
    Venue venue = new Venue();
    venue.setId(101L);
    venue.setName("西安奥体中心体育场");
    venue.setAddress("西安市国际港务区");
    TicketType low = ticketType(501L, 401L, "看台票", "280.00", 10);
    TicketType high = ticketType(502L, 401L, "内场票", "980.00", 5);
    when(tourMapper.selectById(10L)).thenReturn(tour);
    when(stationMapper.selectList(any())).thenReturn(List.of(station));
    when(activityMapper.selectList(any())).thenReturn(List.of(activity));
    when(sessionMapper.selectList(any())).thenReturn(List.of(session));
    when(venueMapper.selectBatchIds(any())).thenReturn(List.of(venue));
    when(ticketTypeMapper.selectList(any())).thenReturn(List.of(low, high));

    Map<String, Object> detail = service.getTourDetail(10L);

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> stationDetails = (List<Map<String, Object>>) detail.get("stationDetails");
    Map<String, Object> item = stationDetails.get(0);
    assertEquals("西安奥体中心体育场", item.get("venueName"));
    assertEquals("西安市国际港务区", item.get("venueAddress"));
    assertEquals(new BigDecimal("280.00"), item.get("priceMin"));
    assertEquals(new BigDecimal("980.00"), item.get("priceMax"));
    assertEquals("on_sale", item.get("saleStatus"));
    assertEquals("售票中", item.get("saleStatusText"));
    assertEquals("buy", item.get("primaryAction"));
}
```

Add this helper near the existing helper methods:

```java
private TicketType ticketType(Long id, Long sessionId, String name, String price, int remainStock) {
    TicketType ticketType = new TicketType();
    ticketType.setId(id);
    ticketType.setSessionId(sessionId);
    ticketType.setName(name);
    ticketType.setPrice(new BigDecimal(price));
    ticketType.setRemainStock(remainStock);
    ticketType.setTotalStock(remainStock);
    ticketType.setStatus(1);
    return ticketType;
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
mvn -pl java-ticket "-Dtest=TourStationServiceTest" test
```

Workdir: `java`

Expected: compilation fails because `TourStationService` does not yet have the constructor with `TicketTypeMapper` and `VenueMapper`, and detail fields are not implemented.

- [ ] **Step 3: Implement backend aggregation and city-announced state**

In `TourStationService.java`, add imports:

```java
import com.omni.ticket.entity.TicketType;
import com.omni.ticket.entity.Venue;
import com.omni.ticket.mapper.TicketTypeMapper;
import com.omni.ticket.mapper.VenueMapper;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
```

Add constants and fields:

```java
private static final String STATION_STATUS_DRAFT = "draft";
private static final String STATION_STATUS_CITY_ANNOUNCED = "city_announced";
private static final String STATION_STATUS_PUBLISHED = "published";
private static final String STATION_STATUS_RISK_SUSPENDED = "risk_suspended";

private final TicketTypeMapper ticketTypeMapper;
private final VenueMapper venueMapper;
```

Update the 3-argument constructor delegation:

```java
public TourStationService(TourMapper tourMapper,
                           StationMapper stationMapper,
                           UserAccessService userAccessService) {
    this(tourMapper, stationMapper, userAccessService, null, null, null, null, null, null, null);
}
```

Update the `@Autowired` constructor signature and assignments:

```java
@Autowired
public TourStationService(TourMapper tourMapper,
                          StationMapper stationMapper,
                          UserAccessService userAccessService,
                          VenueApplicationMapper venueApplicationMapper,
                          ActivityMapper activityMapper,
                          SessionMapper sessionMapper,
                          ActivitySeatLayoutService activitySeatLayoutService,
                          SessionSeatLayoutService sessionSeatLayoutService,
                          TicketTypeMapper ticketTypeMapper,
                          VenueMapper venueMapper) {
    this.tourMapper = tourMapper;
    this.stationMapper = stationMapper;
    this.userAccessService = userAccessService;
    this.venueApplicationMapper = venueApplicationMapper;
    this.activityMapper = activityMapper;
    this.sessionMapper = sessionMapper;
    this.activitySeatLayoutService = activitySeatLayoutService;
    this.sessionSeatLayoutService = sessionSeatLayoutService;
    this.ticketTypeMapper = ticketTypeMapper;
    this.venueMapper = venueMapper;
}
```

In `createStationDraft()`, replace the publish status assignment with:

```java
Long venueApplicationId = parsePositiveLong(body.get("venueApplicationId"));
station.setVenueApplicationId(venueApplicationId);
station.setPoster(optionalText(body.get("poster")));
station.setDescription(optionalText(body.get("description")));
station.setPublishStatus(Boolean.TRUE.equals(body.get("announceOnly")) && venueApplicationId == null
        ? STATION_STATUS_CITY_ANNOUNCED
        : STATION_STATUS_DRAFT);
```

Replace `buildStationDetails()` with this implementation:

```java
private List<Map<String, Object>> buildStationDetails(Long tourId, List<Station> stations) {
    if (stations == null || stations.isEmpty() || activityMapper == null || sessionMapper == null) {
        return Collections.emptyList();
    }
    List<Activity> activities = activityMapper.selectList(new LambdaQueryWrapper<Activity>()
            .eq(Activity::getTourId, tourId)
            .eq(Activity::getStatus, 1));
    Map<Long, Activity> activityByStation = activities == null ? Collections.emptyMap() : activities.stream()
            .filter(activity -> activity.getStationId() != null)
            .collect(Collectors.toMap(Activity::getStationId, activity -> activity, (a, b) -> a));
    Set<Long> activityIds = activityByStation.values().stream().map(Activity::getId).collect(Collectors.toSet());
    List<Session> sessions = activityIds.isEmpty() ? Collections.emptyList()
            : sessionMapper.selectList(new LambdaQueryWrapper<Session>()
                    .in(Session::getActivityId, activityIds)
                    .eq(Session::getStatus, 1)
                    .orderByAsc(Session::getStartTime));
    Map<Long, List<Session>> sessionsByActivity = sessions.stream().collect(Collectors.groupingBy(Session::getActivityId));
    Map<Long, Venue> venueById = loadVenuesById(sessions);
    Map<Long, List<TicketType>> ticketTypesBySession = loadTicketTypesBySession(sessions);
    return stations.stream().map(station -> buildStationDetail(station, activityByStation.get(station.getId()),
            sessionsByActivity, venueById, ticketTypesBySession)).collect(Collectors.toList());
}
```

Add these helper methods:

```java
private Map<Long, Object> getAdminTourDetail(Long userId, Long tourId) {
    return null;
}

private Map<Long, Venue> loadVenuesById(List<Session> sessions) {
    if (venueMapper == null || sessions == null || sessions.isEmpty()) {
        return Collections.emptyMap();
    }
    List<Long> venueIds = sessions.stream()
            .map(Session::getVenueId)
            .filter(id -> id != null)
            .distinct()
            .collect(Collectors.toList());
    if (venueIds.isEmpty()) {
        return Collections.emptyMap();
    }
    List<Venue> venues = venueMapper.selectBatchIds(venueIds);
    return venues == null ? Collections.emptyMap() : venues.stream().collect(Collectors.toMap(Venue::getId, venue -> venue, (a, b) -> a));
}

private Map<Long, List<TicketType>> loadTicketTypesBySession(List<Session> sessions) {
    if (ticketTypeMapper == null || sessions == null || sessions.isEmpty()) {
        return Collections.emptyMap();
    }
    List<Long> sessionIds = sessions.stream().map(Session::getId).filter(id -> id != null).collect(Collectors.toList());
    if (sessionIds.isEmpty()) {
        return Collections.emptyMap();
    }
    List<TicketType> ticketTypes = ticketTypeMapper.selectList(new LambdaQueryWrapper<TicketType>()
            .in(TicketType::getSessionId, sessionIds)
            .eq(TicketType::getStatus, 1));
    return ticketTypes == null ? Collections.emptyMap() : ticketTypes.stream().collect(Collectors.groupingBy(TicketType::getSessionId));
}

private Map<String, Object> buildStationDetail(Station station,
                                               Activity activity,
                                               Map<Long, List<Session>> sessionsByActivity,
                                               Map<Long, Venue> venueById,
                                               Map<Long, List<TicketType>> ticketTypesBySession) {
    List<Session> sessions = activity == null ? Collections.emptyList() : sessionsByActivity.getOrDefault(activity.getId(), Collections.emptyList());
    List<TicketType> ticketTypes = sessions.stream()
            .flatMap(session -> ticketTypesBySession.getOrDefault(session.getId(), Collections.emptyList()).stream())
            .collect(Collectors.toList());
    Venue venue = sessions.stream()
            .map(session -> venueById.get(session.getVenueId()))
            .filter(v -> v != null)
            .findFirst()
            .orElse(null);
    Map<String, Object> item = new HashMap<>();
    item.put("station", station);
    item.put("activity", activity);
    item.put("sessions", sessions);
    item.put("venueName", venue == null ? null : venue.getName());
    item.put("venueAddress", venue == null ? null : venue.getAddress());
    item.put("priceMin", priceMin(ticketTypes));
    item.put("priceMax", priceMax(ticketTypes));
    item.put("remainStock", ticketTypes.stream().map(TicketType::getRemainStock).filter(stock -> stock != null).mapToInt(Integer::intValue).sum());
    applySaleStatus(item, station, activity, sessions, ticketTypes);
    return item;
}

private BigDecimal priceMin(List<TicketType> ticketTypes) {
    return ticketTypes == null || ticketTypes.isEmpty() ? null : ticketTypes.stream()
            .map(TicketType::getPrice)
            .filter(price -> price != null)
            .min(Comparator.naturalOrder())
            .orElse(null);
}

private BigDecimal priceMax(List<TicketType> ticketTypes) {
    return ticketTypes == null || ticketTypes.isEmpty() ? null : ticketTypes.stream()
            .map(TicketType::getPrice)
            .filter(price -> price != null)
            .max(Comparator.naturalOrder())
            .orElse(null);
}

private void applySaleStatus(Map<String, Object> item, Station station, Activity activity, List<Session> sessions, List<TicketType> ticketTypes) {
    String stationStatus = station.getPublishStatus();
    if (STATION_STATUS_CITY_ANNOUNCED.equals(stationStatus)) {
        setSaleStatus(item, "unannounced", "未公布", "none");
        item.put("venueName", null);
        item.put("venueAddress", null);
        item.put("priceMin", null);
        item.put("priceMax", null);
        return;
    }
    if (STATION_STATUS_RISK_SUSPENDED.equals(stationStatus)) {
        setSaleStatus(item, "suspended", "暂时停止售票", "none");
        return;
    }
    if (!STATION_STATUS_PUBLISHED.equals(stationStatus) || activity == null) {
        setSaleStatus(item, "coming_soon", "即将公布", "none");
        return;
    }
    if (sessions == null || sessions.isEmpty()) {
        setSaleStatus(item, "to_be_scheduled", "待定", "none");
        return;
    }
    if (ticketTypes == null || ticketTypes.isEmpty()) {
        setSaleStatus(item, "coming_soon", "即将开抢", "none");
        return;
    }
    int remainStock = ticketTypes.stream().map(TicketType::getRemainStock).filter(stock -> stock != null).mapToInt(Integer::intValue).sum();
    if (remainStock <= 0) {
        setSaleStatus(item, "sold_out", "已售罄", "none");
        return;
    }
    setSaleStatus(item, "on_sale", "售票中", "buy");
}

private void setSaleStatus(Map<String, Object> item, String status, String text, String action) {
    item.put("saleStatus", status);
    item.put("saleStatusText", text);
    item.put("primaryAction", action);
}
```

Do not keep the accidental `private Map<Long, Object> getAdminTourDetail(...) { return null; }` stub if it appears during editing; it is not part of the final code.

- [ ] **Step 4: Add admin Tour detail method and controller endpoint**

In `TourStationService.java`, add this public method after `listManageableTours()`:

```java
public Map<String, Object> getManageableTourDetail(Long userId, Long tourId) {
    InternalUserRefResponse user = requireAdminOrOrganizer(userId);
    Tour tour = tourMapper.selectById(tourId);
    if (tour == null || !Integer.valueOf(1).equals(tour.getStatus())) {
        throw new BusinessException(404, "演出项目不存在");
    }
    if ("organizer".equals(user.getRole()) && !userId.equals(tour.getOrganizerId())) {
        throw new BusinessException(403, "只能查看自己的演出项目");
    }
    return getTourDetail(tourId);
}
```

In `AdminController.java`, add after `listTours()`:

```java
@GetMapping("/tours/{tourId}")
public Result<Map<String, Object>> getTourDetail(@PathVariable Long tourId, @RequestParam Long userId) {
    return Result.success(tourStationService.getManageableTourDetail(userId, tourId));
}
```

- [ ] **Step 5: Run backend tests**

Run:

```powershell
mvn -pl java-ticket "-Dtest=TourStationServiceTest" test
```

Workdir: `java`

Expected: `Tests run` includes the new tests and shows `Failures: 0, Errors: 0`.

- [ ] **Step 6: Commit backend detail aggregation**

Run:

```powershell
git add java/java-ticket/src/main/java/com/omni/ticket/service/TourStationService.java java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java java/java-ticket/src/test/java/com/omni/ticket/service/TourStationServiceTest.java
git commit -m "feat: enrich tour station details"
```

## Task 2: Idempotent Station Publish

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/TourStationService.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/TourStationServiceTest.java`

- [ ] **Step 1: Write failing test for reusing existing Activity**

Add this test after `publishStationCreatesActivitySessionCopiesLayoutGeneratesStockAndMarksPublished()`:

```java
@Test
void publishStationReusesExistingStationActivity() {
    when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
    Tour tour = tour(10L, 2003L);
    tour.setTitle("万象巡演");
    Station station = station(20L, 10L, 88L);
    Activity existing = new Activity();
    existing.setId(301L);
    existing.setTourId(10L);
    existing.setStationId(20L);
    existing.setStatus(1);
    VenueApplication application = approvedApplication(88L, 2003L, 101L,
            LocalDateTime.of(2026, 6, 1, 0, 0), LocalDateTime.of(2026, 6, 30, 23, 59));
    when(tourMapper.selectById(10L)).thenReturn(tour);
    when(stationMapper.selectById(20L)).thenReturn(station);
    when(venueApplicationMapper.selectById(88L)).thenReturn(application);
    when(activityMapper.selectOne(any())).thenReturn(existing);
    doAnswer(invocation -> {
        Session session = invocation.getArgument(0);
        session.setId(401L);
        return 1;
    }).when(sessionMapper).insert(any(Session.class));

    Map<String, Object> result = service.publishStation(2003L, 20L, Map.of(
            "startTime", "2026-06-10T20:00",
            "endTime", "2026-06-10T22:00"));

    assertSame(existing, result.get("activity"));
    verify(activityMapper).selectOne(any());
    verify(activityMapper, org.mockito.Mockito.never()).insert(any(Activity.class));
    verify(activityMapper).updateById(existing);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
mvn -pl java-ticket "-Dtest=TourStationServiceTest#publishStationReusesExistingStationActivity" test
```

Workdir: `java`

Expected: fails because `publishStation()` always inserts a new Activity.

- [ ] **Step 3: Implement Activity reuse in `publishStation()`**

In `TourStationService.publishStation()`, replace the Activity creation block with:

```java
Activity activity = activityMapper.selectOne(new LambdaQueryWrapper<Activity>()
        .eq(Activity::getStationId, station.getId())
        .eq(Activity::getStatus, 1)
        .last("LIMIT 1"));
boolean newActivity = activity == null;
if (newActivity) {
    activity = new Activity();
    activity.setCreateTime(now);
}
activity.setCategoryId(tour.getCategoryId());
activity.setArtistId(tour.getArtistId());
activity.setOrganizerId(tour.getOrganizerId());
activity.setTourId(tour.getId());
activity.setStationId(station.getId());
activity.setVenueApplicationId(application.getId());
activity.setName(tour.getTitle() + " " + station.getStationName());
activity.setDescription(defaultText(station.getDescription(), tour.getDescription()));
activity.setPoster(defaultText(station.getPoster(), tour.getPoster()));
activity.setPublishStatus("publishing");
activity.setStatus(1);
if (newActivity) {
    activityMapper.insert(activity);
} else {
    activityMapper.updateById(activity);
}
```

Keep the existing copy, session creation, seat generation, and final update steps. They should operate on the reused or newly inserted `activity`.

- [ ] **Step 4: Run backend tests**

Run:

```powershell
mvn -pl java-ticket "-Dtest=TourStationServiceTest" test
```

Workdir: `java`

Expected: `Failures: 0, Errors: 0`.

- [ ] **Step 5: Commit idempotent publish**

Run:

```powershell
git add java/java-ticket/src/main/java/com/omni/ticket/service/TourStationService.java java/java-ticket/src/test/java/com/omni/ticket/service/TourStationServiceTest.java
git commit -m "fix: reuse station activity on publish"
```

## Task 3: Frontend Types And API Wrappers

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add frontend types**

In `frontend/src/types/api.ts`, replace the existing `StationEntity` and `StationPurchaseDetail` definitions with:

```ts
export type StationPublishStatus =
  | 'draft'
  | 'city_announced'
  | 'venue_pending'
  | 'venue_rejected'
  | 'venue_approved'
  | 'publishing'
  | 'published'
  | 'risk_suspended'
  | 'cancelled'
  | string

export type StationSaleStatus =
  | 'unannounced'
  | 'coming_soon'
  | 'to_be_scheduled'
  | 'on_sale'
  | 'sold_out'
  | 'suspended'
  | string

export interface StationEntity {
  id: number
  tourId: number
  city: string
  stationName: string
  poster?: string | null
  description?: string | null
  venueApplicationId?: number | null
  publishStatus: StationPublishStatus
  status: number
  createTime?: string | null
  updateTime?: string | null
}
```

Replace `StationPurchaseDetail` with:

```ts
export interface StationPurchaseDetail {
  station: StationEntity
  activity?: ActivityEntity | null
  sessions: SessionEntity[]
  venueName?: string | null
  venueAddress?: string | null
  priceMin?: number | null
  priceMax?: number | null
  remainStock?: number | null
  saleStatus?: StationSaleStatus | null
  saleStatusText?: string | null
  primaryAction?: 'buy' | 'none' | string | null
}

export interface TourAdminDetailVO extends TourDetailVO {
  stationDetails: StationPurchaseDetail[]
}
```

- [ ] **Step 2: Add API wrapper**

In `frontend/src/lib/api.ts`, add after `listAdminTours()`:

```ts
export async function getAdminTourDetail(userId: number, tourId: number) {
  return request<import('@/types/api').TourAdminDetailVO>(`/api/ticket/admin/tours/${tourId}?userId=${userId}`)
}
```

- [ ] **Step 3: Run frontend typecheck**

Run:

```powershell
pnpm typecheck
```

Workdir: `frontend`

Expected: typecheck passes or fails only on files not touched by this task. If it fails on touched files, fix the type errors before continuing.

- [ ] **Step 4: Commit types and API wrapper**

Run:

```powershell
git add frontend/src/types/api.ts frontend/src/lib/api.ts
git commit -m "feat: add tour station detail types"
```

## Task 4: Tour-Only Creation Page

**Files:**
- Modify: `frontend/src/app/console/tours/new/page.tsx`

- [ ] **Step 1: Replace the page with Tour-only creation**

Replace the entire file with:

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { createTourDraft } from '@/lib/api'
import type { UserRole } from '@/types/api'

export default function NewTourPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [poster, setPoster] = useState('')
  const [description, setDescription] = useState('')
  const [role, setRole] = useState<UserRole | ''>('')
  const [checkingRole, setCheckingRole] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const user = getUser()
    if (!user) return
    setRole(user.role || '')
    setCheckingRole(false)
  }, [])

  const handleSubmit = async () => {
    const user = getUser()
    if (!user) return
    if (!title.trim()) {
      setError('请填写巡演名称')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const tour = await createTourDraft({
        userId: user.userId,
        title: title.trim(),
        poster: poster.trim() || null,
        description: description.trim() || null,
      })
      router.push(`/console/tours/${tour.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (checkingRole || !role) {
    return <div className="py-20 text-center text-[14px] text-[#999]">加载中...</div>
  }

  if (role === 'admin') {
    return (
      <div className="max-w-[720px] rounded-xl border border-[#e5e5e5] bg-white p-6">
        <h1 className="mb-2 text-[22px] font-bold text-[#1a1a2e]">创建巡演仅面向主办方</h1>
        <p className="mb-5 text-[14px] text-[#666]">平台管理员可查看平台演出项目，不在此创建主办方巡演草稿。</p>
        <Link href="/console/tours" className="inline-flex rounded-lg bg-[#1a1a2e] px-4 py-2 text-[14px] font-medium text-white">返回平台演出项目</Link>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-2 text-[22px] font-bold text-[#1a1a2e]">创建巡演项目</h1>
      <p className="mb-5 text-[13px] text-[#999]">先创建一个 Tour 巡演 IP，随后在 Tour 详情中持续新增城市站点。</p>
      <div className="max-w-[720px] rounded-xl border border-[#e5e5e5] bg-white p-6">
        <label className="mb-3 block">
          <span className="mb-1 block text-[13px] text-[#666]">巡演名称 *</span>
          <input value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" placeholder="例：伍佰 ROCK STAR 2 巡回演唱会" />
        </label>
        <label className="mb-3 block">
          <span className="mb-1 block text-[13px] text-[#666]">主海报 URL</span>
          <input value={poster} onChange={e => setPoster(e.target.value)} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" placeholder="/seed-posters/activity-01.jpg" />
        </label>
        <label className="mb-4 block">
          <span className="mb-1 block text-[13px] text-[#666]">巡演简介</span>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className="w-full resize-none rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" />
        </label>
        {error && <div className="mb-4 rounded-lg bg-[#fff0f3] px-3 py-2 text-[13px] text-[#ff1268]">{error}</div>}
        <button onClick={handleSubmit} disabled={submitting} className="rounded-lg bg-[#ff1268] px-5 py-2.5 text-[14px] font-medium text-white disabled:opacity-60">
          {submitting ? '创建中...' : '创建 Tour 并进入详情'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run frontend typecheck**

Run:

```powershell
pnpm typecheck
```

Workdir: `frontend`

Expected: no type errors from `frontend/src/app/console/tours/new/page.tsx`.

- [ ] **Step 3: Commit Tour-only creation page**

Run:

```powershell
git add frontend/src/app/console/tours/new/page.tsx
git commit -m "feat: create tours before stations"
```

## Task 5: Console Tour Detail And Add Station Flow

**Files:**
- Create: `frontend/src/app/console/tours/[id]/page.tsx`
- Create: `frontend/src/app/console/tours/[id]/stations/new/page.tsx`
- Modify: `frontend/src/app/console/tours/page.tsx`

- [ ] **Step 1: Create Tour detail page**

Create `frontend/src/app/console/tours/[id]/page.tsx`:

```tsx
'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { getAdminTourDetail } from '@/lib/api'
import type { StationPurchaseDetail, TourAdminDetailVO } from '@/types/api'

function statusText(item: StationPurchaseDetail) {
  if (item.saleStatusText) return item.saleStatusText
  if (item.station.publishStatus === 'city_announced') return '未公布'
  if (item.station.publishStatus === 'published') return '已发布'
  return item.station.publishStatus || '草稿'
}

function priceText(item: StationPurchaseDetail) {
  if (item.priceMin == null || item.priceMax == null) return '未公布'
  if (item.priceMin === item.priceMax) return `¥${item.priceMin}`
  return `¥${item.priceMin} - ¥${item.priceMax}`
}

export default function ConsoleTourDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [detail, setDetail] = useState<TourAdminDetailVO | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const user = getUser()
    if (!user) return
    getAdminTourDetail(user.userId, Number(id))
      .then(setDetail)
      .catch(err => setError(err instanceof Error ? err.message : '加载失败'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="py-20 text-center text-[14px] text-[#999]">加载中...</div>
  if (error || !detail) return <div className="rounded-xl border border-[#ffd9e6] bg-white py-16 text-center text-[14px] text-[#ff4d4f]">{error || '巡演不存在'}</div>

  const stationDetails = detail.stationDetails?.length
    ? detail.stationDetails
    : detail.stations.map(station => ({ station, activity: null, sessions: [] }))
  const publishedCount = stationDetails.filter(item => item.station.publishStatus === 'published').length
  const pendingCount = stationDetails.filter(item => ['venue_pending', 'city_announced', 'draft'].includes(String(item.station.publishStatus))).length

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/console/tours" className="mb-2 inline-block text-[13px] text-[#999]">返回我的演出</Link>
          <h1 className="text-[24px] font-bold text-[#1a1a2e]">{detail.tour.title}</h1>
          {detail.tour.description && <p className="mt-2 max-w-[760px] text-[14px] leading-6 text-[#666]">{detail.tour.description}</p>}
        </div>
        <Link href={`/console/tours/${detail.tour.id}/stations/new`} className="rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white">新增城市站点</Link>
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-4"><div className="text-[12px] text-[#999]">站点总数</div><div className="mt-1 text-[24px] font-bold text-[#1a1a2e]">{stationDetails.length}</div></div>
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-4"><div className="text-[12px] text-[#999]">已发布</div><div className="mt-1 text-[24px] font-bold text-[#1a1a2e]">{publishedCount}</div></div>
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-4"><div className="text-[12px] text-[#999]">待官宣/待审核</div><div className="mt-1 text-[24px] font-bold text-[#1a1a2e]">{pendingCount}</div></div>
      </div>
      {stationDetails.length === 0 ? (
        <div className="rounded-xl border border-[#e5e5e5] bg-white py-16 text-center text-[14px] text-[#999]">还没有城市站点，先新增一个城市。</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {stationDetails.map(item => (
            <div key={item.station.id} className="rounded-xl border border-[#e5e5e5] bg-white p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-[18px] font-semibold text-[#111]">{item.station.city} · {item.station.stationName}</div>
                  <div className="mt-1 text-[13px] text-[#999]">状态：{statusText(item)}</div>
                </div>
                <span className="rounded-full bg-[#fff0f5] px-3 py-1 text-[12px] text-[#ff1268]">{item.station.publishStatus}</span>
              </div>
              <div className="space-y-1 text-[14px] text-[#666]">
                <div>场馆：{item.venueName || '未公布'}</div>
                <div>票价：{priceText(item)}</div>
                <div>场次数：{item.sessions.length}</div>
                <div>剩余库存：{item.remainStock ?? '未公布'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create add-station page**

Create `frontend/src/app/console/tours/[id]/stations/new/page.tsx`:

```tsx
'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { createStationDraft, listMyVenueApplications } from '@/lib/api'
import type { VenueApplicationVO } from '@/types/api'

export default function NewStationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [city, setCity] = useState('')
  const [stationName, setStationName] = useState('')
  const [announceOnly, setAnnounceOnly] = useState(true)
  const [venueApplications, setVenueApplications] = useState<VenueApplicationVO[]>([])
  const [selectedVenueApplicationId, setSelectedVenueApplicationId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const user = getUser()
    if (!user) return
    listMyVenueApplications(user.userId).then(setVenueApplications).catch(() => {})
  }, [])

  const approvedApplications = venueApplications.filter(item => item.status === 1 && item.venueId)

  const handleSubmit = async () => {
    const user = getUser()
    if (!user) return
    if (!city.trim() || !stationName.trim()) {
      setError('请填写城市和站点名称')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await createStationDraft(Number(id), {
        userId: user.userId,
        city: city.trim(),
        stationName: stationName.trim(),
        announceOnly,
        venueApplicationId: announceOnly ? null : selectedVenueApplicationId,
      })
      router.push(`/console/tours/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <Link href={`/console/tours/${id}`} className="mb-2 inline-block text-[13px] text-[#999]">返回 Tour 详情</Link>
      <h1 className="mb-2 text-[22px] font-bold text-[#1a1a2e]">新增城市站点</h1>
      <p className="mb-5 text-[13px] text-[#999]">可以先只公布城市。未公布城市不会显示时间、场馆、票价或购买入口。</p>
      <div className="max-w-[720px] rounded-xl border border-[#e5e5e5] bg-white p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[13px] text-[#666]">城市 *</span>
            <input value={city} onChange={e => setCity(e.target.value)} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" placeholder="西安" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] text-[#666]">站点名称 *</span>
            <input value={stationName} onChange={e => setStationName(e.target.value)} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" placeholder="西安站" />
          </label>
        </div>
        <label className="mt-4 flex items-start gap-2 rounded-lg bg-[#fafafa] p-3 text-[14px] text-[#555]">
          <input type="checkbox" checked={announceOnly} onChange={e => setAnnounceOnly(e.target.checked)} className="mt-1" />
          <span>仅公布该城市在巡演计划中，暂不公布时间、场馆、票价。</span>
        </label>
        {!announceOnly && (
          <label className="mt-4 block">
            <span className="mb-1 block text-[13px] text-[#666]">使用已有已通过场地申请</span>
            <select value={selectedVenueApplicationId ?? ''} onChange={e => setSelectedVenueApplicationId(e.target.value ? Number(e.target.value) : null)} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]">
              <option value="">暂不绑定</option>
              {approvedApplications.map(item => <option key={item.id} value={item.id}>{item.venueName} · {item.city}</option>)}
            </select>
          </label>
        )}
        {error && <div className="mt-4 rounded-lg bg-[#fff0f3] px-3 py-2 text-[13px] text-[#ff1268]">{error}</div>}
        <button onClick={handleSubmit} disabled={submitting} className="mt-5 rounded-lg bg-[#ff1268] px-5 py-2.5 text-[14px] font-medium text-white disabled:opacity-60">
          {submitting ? '保存中...' : '保存站点'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Link Tour rows to detail page**

In `frontend/src/app/console/tours/page.tsx`, change the tour title cell:

```tsx
<td className="p-3 font-medium text-[#333]">
  <Link href={`/console/tours/${tour.id}`} className="text-[#1a1a2e] hover:text-[#ff1268]">{tour.title}</Link>
</td>
```

- [ ] **Step 4: Run frontend typecheck**

Run:

```powershell
pnpm typecheck
```

Workdir: `frontend`

Expected: no type errors from new Tour pages.

- [ ] **Step 5: Commit console Tour detail flow**

Run:

```powershell
git add frontend/src/app/console/tours/page.tsx frontend/src/app/console/tours/[id]/page.tsx frontend/src/app/console/tours/[id]/stations/new/page.tsx
git commit -m "feat: manage stations from tour detail"
```

## Task 6: C-Side Tour Detail Interaction

**Files:**
- Modify: `frontend/src/app/tour/[id]/page.tsx`

- [ ] **Step 1: Replace C-side Tour page with station-aware UI**

Replace `frontend/src/app/tour/[id]/page.tsx` with:

```tsx
'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { getTourDetail } from '@/lib/api'
import type { StationPurchaseDetail, TourDetailVO } from '@/types/api'

function priceText(item: StationPurchaseDetail) {
  if (item.saleStatus === 'unannounced') return '未公布'
  if (item.priceMin == null || item.priceMax == null) return '待定'
  if (item.priceMin === item.priceMax) return `¥${item.priceMin}`
  return `¥${item.priceMin} - ¥${item.priceMax}`
}

function timeText(item: StationPurchaseDetail) {
  const first = item.sessions?.[0]
  if (!first?.startTime) return item.saleStatus === 'unannounced' ? '时间未公布' : '待定'
  return first.startTime.slice(0, 16).replace('T', ' ')
}

export default function TourDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [detail, setDetail] = useState<TourDetailVO | null>(null)
  const [selectedStation, setSelectedStation] = useState<StationPurchaseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getTourDetail(Number(id)).then(data => {
      setDetail(data)
      const details = data.stationDetails?.length
        ? data.stationDetails
        : data.stations.map(station => ({ station, activity: null, sessions: [], saleStatus: station.publishStatus === 'city_announced' ? 'unannounced' : 'coming_soon', saleStatusText: station.publishStatus === 'city_announced' ? '未公布' : '即将公布', primaryAction: 'none' }))
      setSelectedStation(details[0] || null)
    }).catch(err => setError(err instanceof Error ? err.message : '加载失败')).finally(() => setLoading(false))
  }, [id])

  const stationDetails = detail?.stationDetails?.length
    ? detail.stationDetails
    : detail?.stations.map(station => ({ station, activity: null, sessions: [], saleStatus: station.publishStatus === 'city_announced' ? 'unannounced' : 'coming_soon', saleStatusText: station.publishStatus === 'city_announced' ? '未公布' : '即将公布', primaryAction: 'none' })) || []

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[1180px] px-5 py-8">
        {loading ? (
          <div className="py-20 text-center text-[14px] text-[#999]">加载中...</div>
        ) : error || !detail ? (
          <div className="py-20 text-center text-[14px] text-[#ff1268]">{error || '演出不存在'}</div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
            <div className="overflow-hidden rounded-xl border border-[#e5e5e5] bg-white">
              <img src={detail.tour.poster || '/background.png'} alt={detail.tour.title} className="h-[400px] w-full object-cover" />
            </div>
            <div className="rounded-xl border border-[#e5e5e5] bg-white p-6">
              <h1 className="mb-3 text-[26px] font-semibold text-[#111]">{detail.tour.title}</h1>
              {detail.tour.description && <p className="mb-6 text-[14px] leading-7 text-[#666]">{detail.tour.description}</p>}
              <div className="mb-5 flex gap-3 overflow-x-auto pb-2">
                {stationDetails.length === 0 ? (
                  <div className="rounded-lg bg-[#f7f7f7] px-4 py-3 text-[14px] text-[#999]">暂无站点</div>
                ) : stationDetails.map(item => (
                  <button
                    key={item.station.id}
                    onClick={() => setSelectedStation(item)}
                    className="min-w-[128px] rounded-xl border px-4 py-3 text-left text-[14px]"
                    style={{
                      borderColor: selectedStation?.station.id === item.station.id ? '#ff1268' : '#e5e5e5',
                      color: selectedStation?.station.id === item.station.id ? '#ff1268' : '#333',
                      background: selectedStation?.station.id === item.station.id ? '#fff0f5' : '#fff',
                    }}
                  >
                    <div className="font-medium">{item.station.city}</div>
                    <div className="mt-1 text-[12px] text-[#999]">{item.saleStatusText || '即将公布'}</div>
                  </button>
                ))}
              </div>
              {selectedStation && (
                <div className="rounded-xl bg-[#fafafa] p-5 text-[14px] text-[#555]">
                  <div className="mb-2 text-[18px] font-medium text-[#111]">{selectedStation.station.stationName}</div>
                  <div>城市：{selectedStation.station.city}</div>
                  <div className="mt-1">状态：{selectedStation.saleStatusText || '即将公布'}</div>
                  <div className="mt-1">时间：{timeText(selectedStation)}</div>
                  <div className="mt-1">场馆：{selectedStation.saleStatus === 'unannounced' ? '未公布' : selectedStation.venueName || '待定'}</div>
                  <div className="mt-1">地址：{selectedStation.saleStatus === 'unannounced' ? '未公布' : selectedStation.venueAddress || '待定'}</div>
                  <div className="mt-1">票价：{priceText(selectedStation)}</div>
                  {selectedStation.primaryAction === 'buy' && selectedStation.activity ? (
                    <button onClick={() => router.push(`/activity/${selectedStation.activity?.id}`)} className="mt-5 rounded bg-[#ff1268] px-5 py-2.5 text-[14px] font-medium text-white">选择票档并购买</button>
                  ) : (
                    <button disabled className="mt-5 rounded bg-[#ddd] px-5 py-2.5 text-[14px] font-medium text-white">{selectedStation.saleStatus === 'unannounced' ? '时间未公布' : selectedStation.saleStatusText || '即将公布'}</button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  )
}
```

- [ ] **Step 2: Run frontend typecheck**

Run:

```powershell
pnpm typecheck
```

Workdir: `frontend`

Expected: no type errors from `frontend/src/app/tour/[id]/page.tsx`.

- [ ] **Step 3: Commit C-side Tour detail interaction**

Run:

```powershell
git add frontend/src/app/tour/[id]/page.tsx
git commit -m "feat: show multi-city tour stations"
```

## Task 7: Seed Multi-City Tour Demo

**Files:**
- Modify: `sql/seed.sql`

- [ ] **Step 1: Add Tour and Station seed records**

After the `activity` insert and `SELECT setval('activity_id_seq', 30, true);`, add:

```sql
-- ========== 巡演 Tour / Station Demo ==========
INSERT INTO tour (id, title, artist_id, category_id, poster, description, organizer_id, review_status, status, create_time, update_time) VALUES
(1, '伍佰 ROCK STAR 2 巡回演唱会', 1, 1, '/seed-posters/activity-01.jpg', '示例巡演 IP：主办方先公布多城市计划，只有当前官宣城市展示时间、场馆、票价和购买入口。', 2003, 'draft', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    poster = EXCLUDED.poster,
    description = EXCLUDED.description,
    update_time = CURRENT_TIMESTAMP;

INSERT INTO station (id, tour_id, city, station_name, poster, description, venue_application_id, publish_status, status, create_time, update_time) VALUES
(1, 1, '哈尔滨', '哈尔滨站', NULL, NULL, NULL, 'city_announced', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 1, '西安', '西安站', NULL, NULL, NULL, 'city_announced', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 1, '济南', '济南站', NULL, NULL, NULL, 'city_announced', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(4, 1, '佛山', '佛山站', NULL, NULL, NULL, 'city_announced', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(5, 1, '南京', '南京站', NULL, NULL, NULL, 'city_announced', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
    tour_id = EXCLUDED.tour_id,
    city = EXCLUDED.city,
    station_name = EXCLUDED.station_name,
    publish_status = EXCLUDED.publish_status,
    update_time = CURRENT_TIMESTAMP;

SELECT setval('tour_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM tour), 1), 1), true);
SELECT setval('station_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM station), 1), 1), true);
```

Do not link these demo stations to existing activity rows unless the implementation also updates sessions, ticket types, and order snapshots consistently.

- [ ] **Step 2: Validate SQL syntax with psql on local split ticket DB**

Run:

```powershell
$env:PGPASSWORD='123456'; $env:PGCLIENTENCODING='UTF8'; psql -h localhost -p 5432 -U postgres -d omni_ticket_split -f "sql/seed.sql"
```

Expected: SQL completes without errors. If this is too invasive for current local data, instead run the inserted block only from a UTF-8 temp SQL file through `psql -f`; do not pipe Chinese SQL through PowerShell.

- [ ] **Step 3: Verify seed demo rows**

Run:

```powershell
$env:PGPASSWORD='123456'; $env:PGCLIENTENCODING='UTF8'; psql -h localhost -p 5432 -U postgres -d omni_ticket_split -t -A -c "SELECT COUNT(*) FROM station WHERE tour_id = 1 AND publish_status = 'city_announced';"
```

Expected output: `5`.

- [ ] **Step 4: Commit seed demo**

Run:

```powershell
git add sql/seed.sql
git commit -m "chore: seed multi-city tour demo"
```

## Task 8: Final Verification

**Files:**
- No code changes unless verification fails.

- [ ] **Step 1: Run java ticket tests**

Run:

```powershell
mvn test -pl java-ticket -am
```

Workdir: `java`

Expected: `Failures: 0, Errors: 0`.

- [ ] **Step 2: Run microservice boundary verification**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
```

Expected: `All microservice boundary checks passed.`

- [ ] **Step 3: Run frontend typecheck**

Run:

```powershell
pnpm typecheck
```

Workdir: `frontend`

Expected: no TypeScript errors.

- [ ] **Step 4: Run diff whitespace check**

Run:

```powershell
git diff --check
```

Expected: no whitespace errors. Windows LF/CRLF warnings are acceptable.

- [ ] **Step 5: Confirm branch pointers if committing on master**

Run:

```powershell
git status --short
git log --oneline -5
```

Expected: only intended files are modified or committed. If the user still requires `beta6` to match `master`, update `beta6` after final commit without changing the current branch.

## Self-Review

- Spec coverage: Tasks cover backend Tour detail aggregation, city-announced status, Station publish idempotency, frontend Tour-only creation, Tour detail station management, C-side station switching, seed demo, and verification.
- Placeholder scan: No placeholder markers or unspecified implementation steps remain.
- Type consistency: Plan uses existing `TourEntity`, `StationEntity`, `ActivityEntity`, `SessionEntity`, `TicketTypeEntity`, and adds explicit `TourAdminDetailVO` / `StationPurchaseDetail` fields consumed by new pages.
- Scope note: This plan intentionally does not implement full station editing, full SeatCraft/ticket-type configuration inside Tour detail, or production migrations. It establishes the confirmed Tour-first flow while preserving the existing sales lifecycle.
