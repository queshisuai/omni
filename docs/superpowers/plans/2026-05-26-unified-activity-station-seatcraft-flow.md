# Unified Activity Station SeatCraft Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make normal activity and tour creation use one station-centric flow: create visible drafts, submit per-station venue approval materials when a venue is used, and expose clear SeatCraft seat/ticket editor entry points.

**Architecture:** Reuse `venue_application` for approval materials and `station_config_version` for station lifecycle. Keep normal activities on existing SeatCraft `activity` owner in the first pass, add SeatCraft `station` owner for tour station drafts, and add explicit front-end navigation so users always land on a configuration center after creation.

**Tech Stack:** Java Spring Boot, MyBatis-Plus, PostgreSQL, Next.js 16, React 19, TypeScript, pnpm.

---

## File Structure

- Modify `java/java-ticket/src/main/java/com/omni/ticket/dto/VenueApplicationRequest.java`: add `venueId` to allow approval material submission for existing platform venues.
- Modify `java/java-ticket/src/main/java/com/omni/ticket/service/VenueApplicationService.java`: persist optional `venueId`, validate existing venue when provided, and keep status pending.
- Modify `java/java-ticket/src/test/java/com/omni/ticket/service/VenueApplicationServiceTest.java`: cover existing venue approval material submission.
- Modify `java/java-ticket/src/main/java/com/omni/ticket/service/SeatCraftLayoutVersionService.java`: add station owner access checks and allow station materialization.
- Modify `java/java-ticket/src/test/java/com/omni/ticket/service/SeatCraftLayoutVersionServiceTest.java`: cover station owner permissions.
- Modify `frontend/src/lib/api.ts`: add typed helpers for creating venue applications from station forms and allow `SeatCraftOwnerType='station'`.
- Modify `frontend/src/types/api.ts`: add optional `venueId` to `VenueApplicationVO` payload shape already present in VO, add `station` SeatCraft owner type consumers.
- Create `frontend/src/components/station-config/StationVenueApprovalForm.tsx`: shared station venue/material form used by normal activity and tour station flows.
- Modify `frontend/src/app/console/activities/new/page.tsx`: use shared station form for normal activity and multiple tour stations, submit venue applications before station config versions, and route to config pages.
- Modify `frontend/src/app/console/activities/[id]/edit/page.tsx`: show activity configuration center links for station configuration and SeatCraft.
- Modify `frontend/src/app/console/tours/[id]/page.tsx`: add clear per-station links for station configuration and SeatCraft.
- Create `frontend/src/app/console/stations/[id]/seatcraft/page.tsx`: SeatCraft station owner editor wrapper for tour stations.
- Modify `frontend/src/app/console/activities/page.tsx`: show draft state and text actions `继续配置` / `座位票档`.

## Task 1: Venue Application Existing Venue Support

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/VenueApplicationRequest.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/VenueApplicationService.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/VenueApplicationServiceTest.java`

- [ ] **Step 1: Write failing test for existing venue material submission**

Add this test to `VenueApplicationServiceTest` near existing submit tests:

```java
@Test
void submitCanAttachApprovalMaterialToExistingVenue() {
    when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
    Venue venue = new Venue();
    venue.setId(66L);
    venue.setName("国家体育馆");
    venue.setCity("北京");
    venue.setAddress("天辰东路9号");
    venue.setStatus(1);
    when(venueMapper.selectById(66L)).thenReturn(venue);
    doAnswer(invocation -> {
        VenueApplication application = invocation.getArgument(0);
        application.setId(88L);
        return 1;
    }).when(venueApplicationMapper).insert(any(VenueApplication.class));

    VenueApplicationRequest request = validRequest();
    request.setVenueId(66L);
    request.setVenueName("国家体育馆");
    request.setCity("北京");
    request.setAddress("天辰东路9号");

    VenueApplication result = service.submit(request);

    assertEquals(88L, result.getId());
    verify(venueApplicationMapper).insert(argThat(application ->
            Long.valueOf(66L).equals(application.getVenueId())
                    && Integer.valueOf(0).equals(application.getStatus())
                    && Long.valueOf(2003L).equals(application.getApplicantId())));
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `mvn test -pl java-ticket "-Dtest=VenueApplicationServiceTest#submitCanAttachApprovalMaterialToExistingVenue"`

Expected: compile failure because `VenueApplicationRequest#getVenueId` does not exist, or assertion failure because `venueId` is not persisted.

- [ ] **Step 3: Add `venueId` to request DTO**

In `VenueApplicationRequest.java`, add field and accessors after `userId`:

```java
private Long venueId;

public Long getVenueId() { return venueId; }
public void setVenueId(Long venueId) { this.venueId = venueId; }
```

- [ ] **Step 4: Persist and validate existing venue**

In `VenueApplicationService.submit`, before constructing `VenueApplication`, add:

```java
Venue selectedVenue = null;
if (request.getVenueId() != null) {
    selectedVenue = venueMapper.selectById(request.getVenueId());
    if (selectedVenue == null || !Integer.valueOf(1).equals(selectedVenue.getStatus())) {
        throw new BusinessException(400, "关联场馆不存在或已停用");
    }
}
```

Then after `application.setApplicantId(request.getUserId());`, add:

```java
application.setVenueId(request.getVenueId());
```

Keep `status=0`; selecting an existing venue does not auto-approve this event usage.

- [ ] **Step 5: Run test to verify pass**

Run: `mvn test -pl java-ticket "-Dtest=VenueApplicationServiceTest#submitCanAttachApprovalMaterialToExistingVenue"`

Expected: PASS.

## Task 2: Station Owner Support For SeatCraft Versioned Layouts

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SeatCraftLayoutVersionService.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/SeatCraftLayoutVersionServiceTest.java`

- [ ] **Step 1: Write failing tests for station owner access**

Add tests to `SeatCraftLayoutVersionServiceTest`:

```java
@Test
void organizerCanSaveStationSeatCraftForOwnTourStation() {
    when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
    Station station = station(10L, 20L, null);
    when(stationMapper.selectById(10L)).thenReturn(station);
    when(tourMapper.selectById(20L)).thenReturn(tour(20L, 2003L));
    when(versionMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());
    doAnswer(invocation -> {
        SeatLayoutVersion version = invocation.getArgument(0);
        version.setId(100L);
        return 1;
    }).when(versionMapper).insert(any(SeatLayoutVersion.class));

    service.saveDraft("station", 10L, validLayout(), 2003L);

    verify(versionMapper).insert(argThat(version -> "station".equals(version.getOwnerType())
            && Long.valueOf(10L).equals(version.getOwnerId())));
}

@Test
void organizerCannotSaveStationSeatCraftForOtherTourStation() {
    when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
    when(stationMapper.selectById(10L)).thenReturn(station(10L, 20L, null));
    when(tourMapper.selectById(20L)).thenReturn(tour(20L, 9999L));

    BusinessException error = assertThrows(BusinessException.class,
            () -> service.saveDraft("station", 10L, validLayout(), 2003L));

    assertEquals(403, error.getCode());
    verify(versionMapper, never()).insert(any());
}
```

If helper methods do not exist, add:

```java
private Station station(Long id, Long tourId, Long activityId) {
    Station station = new Station();
    station.setId(id);
    station.setTourId(tourId);
    station.setActivityId(activityId);
    station.setStatus(1);
    return station;
}

private Tour tour(Long id, Long organizerId) {
    Tour tour = new Tour();
    tour.setId(id);
    tour.setOrganizerId(organizerId);
    return tour;
}
```

- [ ] **Step 2: Run tests to verify failure**

Run: `mvn test -pl java-ticket "-Dtest=SeatCraftLayoutVersionServiceTest#organizerCanSaveStationSeatCraftForOwnTourStation,SeatCraftLayoutVersionServiceTest#organizerCannotSaveStationSeatCraftForOtherTourStation"`

Expected: FAIL with `布局归属无效` or missing mapper dependencies.

- [ ] **Step 3: Add Station/Tour mapper dependencies**

In `SeatCraftLayoutVersionService.java`, add imports:

```java
import com.omni.ticket.entity.Station;
import com.omni.ticket.entity.Tour;
import com.omni.ticket.mapper.StationMapper;
import com.omni.ticket.mapper.TourMapper;
```

Add fields:

```java
private final StationMapper stationMapper;
private final TourMapper tourMapper;
```

Extend the `@Autowired` constructor parameters with `StationMapper stationMapper, TourMapper tourMapper`, and assign fields. Keep the legacy constructor passing `null` for both.

- [ ] **Step 4: Implement station access branch**

In `requireOwnerAccess`, before the final throw, add:

```java
if ("station".equals(normalizedOwnerType)) {
    if (stationMapper == null || tourMapper == null || activityMapper == null || userAccessService == null) {
        throw new BusinessException(500, "站点权限服务未初始化");
    }
    InternalUserRefResponse user = userAccessService.requireAdminOrOrganizer(operatorId);
    Station station = stationMapper.selectById(ownerId);
    if (station == null || !Integer.valueOf(1).equals(station.getStatus())) {
        throw new BusinessException(404, "站点不存在");
    }
    if ("admin".equals(user.getRole())) {
        return;
    }
    if (station.getTourId() != null) {
        Tour tour = tourMapper.selectById(station.getTourId());
        if (tour == null || !operatorId.equals(tour.getOrganizerId())) {
            throw new BusinessException(403, "只能管理自己的巡演站点");
        }
        return;
    }
    if (station.getActivityId() != null) {
        Activity activity = activityMapper.selectById(station.getActivityId());
        if (activity == null || !operatorId.equals(activity.getOrganizerId())) {
            throw new BusinessException(403, "只能管理自己的活动站点");
        }
        return;
    }
    throw new BusinessException(400, "站点缺少归属信息");
}
```

In `saveDraft`, `getDraft`, `listVersions`, `publishDraft`, and `rollbackToDraft`, call `requireOwnerAccess(ownerType, ownerId, operatorId)` where `operatorId` is available. For `getDraft` and `listVersions`, keep current behavior for now because controller read endpoints do not pass token subject.

- [ ] **Step 5: Run tests to verify pass**

Run: `mvn test -pl java-ticket "-Dtest=SeatCraftLayoutVersionServiceTest#organizerCanSaveStationSeatCraftForOwnTourStation,SeatCraftLayoutVersionServiceTest#organizerCannotSaveStationSeatCraftForOtherTourStation"`

Expected: PASS.

## Task 3: Shared Station Venue Approval Form

**Files:**
- Create: `frontend/src/components/station-config/StationVenueApprovalForm.tsx`
- Modify: `frontend/src/types/api.ts`

- [ ] **Step 1: Create the shared form component**

Create `StationVenueApprovalForm.tsx` with this API:

```tsx
'use client'

import { useMemo, useState } from 'react'
import { PrivateFileUpload } from '@/components/PrivateFileUpload'
import type { PrivateAssetVO, VenueApplicationVO, VenueEntity } from '@/types/api'

export type StationVenueMode = 'tba' | 'existing' | 'new'

export type StationVenueApprovalValue = {
  city: string
  stationName: string
  mode: StationVenueMode
  venueId: number | null
  venueName: string
  venueAddress: string
  capacity: string
  contactName: string
  contactPhone: string
  qualificationNo: string
  businessScope: string
  description: string
  validFrom: string
  validTo: string
  proofNote: string
  proofAsset: PrivateAssetVO | null
  startTime: string
  endTime: string
}

type Props = {
  value: StationVenueApprovalValue
  venues: VenueEntity[]
  approvedApplications?: VenueApplicationVO[]
  submitting?: boolean
  uploading?: boolean
  onUploadProof: (file: File) => Promise<PrivateAssetVO>
  onChange: (value: StationVenueApprovalValue) => void
}

export function createEmptyStationVenueApprovalValue(city = ''): StationVenueApprovalValue {
  return {
    city,
    stationName: '',
    mode: 'tba',
    venueId: null,
    venueName: '',
    venueAddress: '',
    capacity: '',
    contactName: '',
    contactPhone: '',
    qualificationNo: '',
    businessScope: '',
    description: '',
    validFrom: '',
    validTo: '',
    proofNote: '',
    proofAsset: null,
    startTime: '',
    endTime: '',
  }
}

export function validateStationVenueApproval(value: StationVenueApprovalValue) {
  if (!value.city.trim()) return '请填写城市'
  if (value.mode === 'tba') return ''
  if (value.mode === 'existing' && !value.venueId) return '请选择平台场馆'
  if (!value.venueName.trim()) return '请填写场馆名称'
  if (!value.venueAddress.trim()) return '请填写场馆地址'
  if (!value.contactName.trim()) return '请填写审批资料联系人'
  if (!value.contactPhone.trim()) return '请填写审批资料联系电话'
  if (!value.validFrom) return '请选择场地使用开始时间'
  if (!value.validTo) return '请选择场地使用结束时间'
  if (value.validTo <= value.validFrom) return '场地使用结束时间必须晚于开始时间'
  if (!value.proofNote.trim() && !value.proofAsset) return '请填写审批凭证说明或上传审批附件'
  return ''
}

export function StationVenueApprovalForm({ value, venues, submitting, uploading, onUploadProof, onChange }: Props) {
  const selectedVenue = useMemo(() => venues.find(venue => venue.id === value.venueId), [venues, value.venueId])

  const patch = (updates: Partial<StationVenueApprovalValue>) => onChange({ ...value, ...updates })

  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-4">
      <div className="mb-3 text-[14px] font-semibold text-[#1a1a2e]">站点配置</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[12px] text-[#666]">城市 *
          <input value={value.city} onChange={event => patch({ city: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" />
        </label>
        <label className="block text-[12px] text-[#666]">站点名
          <input value={value.stationName} onChange={event => patch({ stationName: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="留空默认城市 + 站" />
        </label>
      </div>
      <div className="mt-4 grid gap-2 text-[13px] text-[#333] sm:grid-cols-3">
        {(['tba', 'existing', 'new'] as const).map(mode => (
          <label key={mode} className="flex cursor-pointer items-start gap-2 rounded-lg border border-[#e5e5e5] bg-white p-3">
            <input type="radio" checked={value.mode === mode} onChange={() => patch({ mode })} className="mt-0.5 accent-[#ff1268]" />
            <span>{mode === 'tba' ? '场馆待定' : mode === 'existing' ? '选择平台场馆' : '填写新场馆'}</span>
          </label>
        ))}
      </div>
      {value.mode === 'existing' && (
        <label className="mt-3 block text-[12px] text-[#666]">平台场馆 *
          <select value={value.venueId ?? ''} onChange={event => {
            const venueId = event.target.value ? Number(event.target.value) : null
            const venue = venues.find(item => item.id === venueId)
            patch({ venueId, venueName: venue?.name || '', venueAddress: venue?.address || '', city: venue?.city || value.city })
          }} className="mt-1 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]">
            <option value="">请选择平台场馆</option>
            {venues.map(venue => <option key={venue.id} value={venue.id}>{venue.name} ({venue.city})</option>)}
          </select>
          {selectedVenue && <span className="mt-1 block text-[12px] text-[#999]">使用平台已有场馆仍需提交本次活动审批资料。</span>}
        </label>
      )}
      {value.mode !== 'tba' && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input value={value.venueName} onChange={event => patch({ venueName: event.target.value })} className="h-10 rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="场馆名称 *" />
          <input value={value.venueAddress} onChange={event => patch({ venueAddress: event.target.value })} className="h-10 rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="场馆地址 *" />
          <input type="number" value={value.capacity} onChange={event => patch({ capacity: event.target.value })} className="h-10 rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="容量" />
          <input value={value.qualificationNo} onChange={event => patch({ qualificationNo: event.target.value })} className="h-10 rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="资质编号" />
          <input value={value.contactName} onChange={event => patch({ contactName: event.target.value })} className="h-10 rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="联系人 *" />
          <input value={value.contactPhone} onChange={event => patch({ contactPhone: event.target.value })} className="h-10 rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="联系电话 *" />
          <label className="text-[12px] text-[#666]">使用开始时间 *
            <input type="datetime-local" value={value.validFrom} onChange={event => patch({ validFrom: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" />
          </label>
          <label className="text-[12px] text-[#666]">使用结束时间 *
            <input type="datetime-local" value={value.validTo} onChange={event => patch({ validTo: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" />
          </label>
          <textarea value={value.businessScope} onChange={event => patch({ businessScope: event.target.value })} rows={2} className="rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268] sm:col-span-2" placeholder="经营范围" />
          <textarea value={value.description} onChange={event => patch({ description: event.target.value })} rows={2} className="rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268] sm:col-span-2" placeholder="资料说明/备注" />
          <textarea value={value.proofNote} onChange={event => patch({ proofNote: event.target.value })} rows={3} className="rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268] sm:col-span-2" placeholder="审批凭证说明（与附件至少填一项）" />
          <div className="sm:col-span-2">
            <PrivateFileUpload label="场馆审批资料附件" value={value.proofAsset} accept="application/pdf,image/jpeg,image/png,image/webp" uploading={Boolean(uploading || submitting)} onUpload={onUploadProof} onChange={asset => patch({ proofAsset: asset })} hint="选择平台场馆也必须上传或填写本次活动审批资料。" />
          </div>
        </div>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-[12px] text-[#666]">开始时间
          <input type="datetime-local" value={value.startTime} onChange={event => patch({ startTime: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" />
        </label>
        <label className="block text-[12px] text-[#666]">结束时间
          <input type="datetime-local" value={value.endTime} onChange={event => patch({ endTime: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" />
        </label>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`

Expected: PASS or fail only on missing imports when integrating in later tasks.

## Task 4: Normal Activity Creation Uses Shared Station Form

**Files:**
- Modify: `frontend/src/app/console/activities/new/page.tsx`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Load platform venues and add proof upload helper**

In `api.ts`, ensure `submitVenueApplication` does not drop `venueId`; keep dropping only spoofed `userId` if token-based endpoint requires it. In `activities/new/page.tsx`, import `listAdminVenues`, `submitVenueApplication`, `uploadPrivateAsset`, and `StationVenueApprovalForm` helpers.

- [ ] **Step 2: Replace single `session` state with shared station value**

Use:

```tsx
const [stationConfig, setStationConfig] = useState(() => createEmptyStationVenueApprovalValue())
```

Validation before submit:

```tsx
const stationError = validateStationVenueApproval(stationConfig)
if (stationError) {
  await globalAlert(stationError)
  return
}
```

- [ ] **Step 3: Submit venue application only when venue is not TBA**

Inside normal activity submit, before `createStationConfigVersion`, add:

```tsx
let venueApplicationId: number | null = null
if (stationConfig.mode !== 'tba') {
  const application = await submitVenueApplication({
    venueId: stationConfig.mode === 'existing' ? stationConfig.venueId : null,
    venueName: stationConfig.venueName.trim(),
    city: stationConfig.city.trim(),
    address: stationConfig.venueAddress.trim(),
    capacity: stationConfig.capacity ? Number(stationConfig.capacity) : null,
    contactName: stationConfig.contactName.trim(),
    contactPhone: stationConfig.contactPhone.trim(),
    qualificationNo: stationConfig.qualificationNo.trim() || null,
    businessScope: stationConfig.businessScope.trim() || null,
    description: stationConfig.description.trim() || null,
    validFrom: stationConfig.validFrom,
    validTo: stationConfig.validTo,
    proofNote: stationConfig.proofNote.trim() || null,
    proofAssetId: stationConfig.proofAsset?.id ?? null,
    layoutSnapshot: '{}',
  })
  venueApplicationId = application.id
}
```

Then create config version with `venueApplicationId`, `venueId` from existing venue, city/station name/time. Do not auto-delete activity when station config fails.

- [ ] **Step 4: Route normal activity to configuration center**

After success:

```tsx
router.push(`/console/activities/${draft.activity.id}/edit`)
```

- [ ] **Step 5: Run typecheck**

Run: `pnpm typecheck`

Expected: PASS.

## Task 5: Tour Creation Uses Multiple Shared Station Forms

**Files:**
- Modify: `frontend/src/app/console/activities/new/page.tsx`

- [ ] **Step 1: Change tour city state to station config array**

Use:

```tsx
const [tourStations, setTourStations] = useState([{ key: 'tc1', value: createEmptyStationVenueApprovalValue() }])
```

Each rendered station uses `StationVenueApprovalForm`.

- [ ] **Step 2: Submit tour draft first, then submit per-station materials/config**

After `createTourDraft`, for each configured station with `mode !== 'tba'`, submit `venue_application`, then create a station config version for the corresponding station. If the API does not return station ids from `createTourDraft`, fetch `getAdminTourDetail` after creation and match by city order.

- [ ] **Step 3: Route tour creation to detail**

Keep:

```tsx
router.push(`/console/tours/${tour.id}`)
```

Show alert: `巡演草稿已创建。已填写的站点审批资料已提交待审核，座位票档请在巡演详情进入 SeatCraft 配置。`

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`

Expected: PASS.

## Task 6: Configuration Entry Points

**Files:**
- Modify: `frontend/src/app/console/activities/page.tsx`
- Modify: `frontend/src/app/console/activities/[id]/edit/page.tsx`
- Modify: `frontend/src/app/console/tours/[id]/page.tsx`

- [ ] **Step 1: Activity list draft/status and text actions**

In `activities/page.tsx`, status label should prefer `publishStatus === 'draft' ? '草稿' : ...`. Add links:

```tsx
<Link href={`/console/activities/${a.id}/edit`} className="rounded px-2 py-1 text-[12px] text-[#3b82f6] hover:bg-[#eff6ff]">继续配置</Link>
<Link href={`/console/activities/${a.id}/seat-layout`} className="rounded px-2 py-1 text-[12px] text-[#ff1268] hover:bg-[#fff0f3]">座位票档</Link>
```

- [ ] **Step 2: Activity edit page configuration center buttons**

In `activities/[id]/edit/page.tsx`, add prominent cards above form:

```tsx
<div className="mb-5 grid gap-3 md:grid-cols-2">
  <Link href={`/console/activities/${activityId}/seat-layout`} className="rounded-xl border border-[#ffd0df] bg-white p-4 text-[#ff1268]">进入 SeatCraft 座位/票档编辑器</Link>
  <Link href="/console/station-config-reviews" className="rounded-xl border border-[#e5e5e5] bg-white p-4 text-[#666]">查看站点配置审核</Link>
</div>
```

- [ ] **Step 3: Tour detail station buttons**

In `tours/[id]/page.tsx`, replace “配置历史入口待接入” with:

```tsx
<Link href={`/console/stations/${item.station.id}/seatcraft`} className="rounded-lg border border-[#ffd0df] px-3 py-1.5 text-[12px] font-medium text-[#ff1268] hover:bg-[#fff0f5]">座位票档</Link>
<Link href={`/console/tours/${tourId}/stations/new`} className="rounded-lg border border-[#e5e5e5] px-3 py-1.5 text-[12px] text-[#666] hover:bg-[#fafafa]">新增/补齐站点</Link>
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`

Expected: PASS.

## Task 7: Station SeatCraft Editor Page

**Files:**
- Create: `frontend/src/app/console/stations/[id]/seatcraft/page.tsx`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Extend owner type**

In `api.ts`:

```ts
export type SeatCraftOwnerType = 'activity' | 'session' | 'station'
```

Update `assertSeatCraftOwner` to accept `station`.

- [ ] **Step 2: Create page using existing versioned SeatCraft APIs**

Create a page that mirrors the activity SeatCraft page pattern but calls:

```ts
getSeatCraftDraft('station', stationId)
saveSeatCraftDraft('station', stationId, payload)
publishSeatCraftDraft('station', stationId)
listSeatCraftVersions('station', stationId)
```

Use existing SeatCraft designer and conversion helpers from the activity seat-layout page. Button labels should say `保存站点座位票档草稿` and `发布站点座位票档`.

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`

Expected: PASS.

## Task 8: Verification

**Files:**
- No code changes unless tests reveal issues.

- [ ] **Step 1: Run focused backend tests**

Run: `mvn test -pl java-ticket "-Dtest=VenueApplicationServiceTest,StationConfigVersionServiceTest,SeatCraftLayoutVersionServiceTest,AdminControllerTest"`

Expected: BUILD SUCCESS.

- [ ] **Step 2: Run frontend typecheck**

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 3: Run boundary checks**

Run: `powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1`

Expected: `All microservice boundary checks passed.`

- [ ] **Step 4: Run diff whitespace check**

Run: `git diff --check`

Expected: no whitespace errors; LF/CRLF warnings are acceptable in this repo.

## Self-Review

- Spec coverage: normal and tour creation, required venue approval materials, draft visibility, SeatCraft station owner, entry points, and validation are covered by Tasks 1-8.
- Placeholder scan: no `TBD`/`TODO` placeholders remain; each task has explicit file paths and commands.
- Type consistency: shared form value names match planned payload fields; backend `venueId` is added to `VenueApplicationRequest`; `SeatCraftOwnerType` includes `station`.
