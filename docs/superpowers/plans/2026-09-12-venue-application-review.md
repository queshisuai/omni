# 场馆资料审核页面重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为场馆资料审核建立结构化材料、服务端多维分页筛选、审核入库/驳回审计闭环，并将前端改造成高密度表格与资质核验 Drawer。

**Architecture:** `java-ticket` 在 `omni_ticket_split` 内维护 `venue_application_material`、场馆扩展字段和正式场馆入库事务；VO 由票务服务批量组装材料与历史通用凭证，不跨库 Join。审核审计通过既有 `UserAccessService.writeOperationAudit()` 写入 `java-user`，前端通过统一 `request<T>()` 对接分页查询和独立审核接口。

**Tech Stack:** Next.js/React/TypeScript、Tailwind CSS、`request<T>()`、`Drawer`、`Modal`、`SafeImage`、MyBatis-Plus、Spring Boot、PostgreSQL。

---

## 文件地图

- Create: `sql/production-split/ticket/20260912_venue_application_material.sql`
- Create: `sql/migrations/shared/20260912_venue_application_material.sql`
- Modify: `sql/production-split/manifest.json`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/entity/VenueApplicationMaterial.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/mapper/VenueApplicationMaterialMapper.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/VenueApplicationMaterialRequest.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/VenueApplicationMaterialResponse.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/VenueApplicationMaterialService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/entity/VenueApplication.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/entity/Venue.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/VenueApplicationRequest.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/VenueApplicationResponse.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/PrivateAssetService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/VenueApplicationService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Modify/Create: `java/java-ticket/src/test/java/com/omni/ticket/service/VenueApplicationServiceTest.java`
- Modify/Create: `java/java-ticket/src/test/java/com/omni/ticket/service/VenueApplicationReviewCoverageTest.java`
- Create: `java/java-ticket/src/test/java/com/omni/ticket/service/VenueApplicationMaterialServiceTest.java`
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/app/console/venue/apply/page.tsx`
- Modify: `frontend/src/app/console/venue/applications/page.tsx`
- Modify/Create: `frontend/src/lib/venue-application-review.test.ts`
- Modify: `implementation-notes.md`

## Task 1: Add the ticket-side migration and manifest entry

**Files:**
- Create: `sql/production-split/ticket/20260912_venue_application_material.sql`
- Create: `sql/migrations/shared/20260912_venue_application_material.sql`
- Modify: `sql/production-split/manifest.json`

- [ ] **Step 1: Write the production migration**

Use idempotent SQL with nullable venue fields and same-owner material constraints:

```sql
ALTER TABLE venue_application
    ADD COLUMN IF NOT EXISTS venue_name_en VARCHAR(200),
    ADD COLUMN IF NOT EXISTS venue_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS province VARCHAR(50),
    ADD COLUMN IF NOT EXISTS district VARCHAR(50);

ALTER TABLE venue
    ADD COLUMN IF NOT EXISTS venue_name_en VARCHAR(200),
    ADD COLUMN IF NOT EXISTS venue_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS province VARCHAR(50),
    ADD COLUMN IF NOT EXISTS district VARCHAR(50);

CREATE TABLE IF NOT EXISTS venue_application_material (
    id BIGSERIAL PRIMARY KEY,
    venue_application_id BIGINT NOT NULL,
    material_type VARCHAR(50) NOT NULL,
    asset_id BIGINT NOT NULL,
    note TEXT,
    valid_from TIMESTAMP,
    valid_to TIMESTAMP,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_venue_application_material_type
        CHECK (material_type IN ('FIRE_SAFETY_PERMIT', 'VENUE_LEASE_AGREEMENT')),
    CONSTRAINT fk_venue_application_material_application
        FOREIGN KEY (venue_application_id) REFERENCES venue_application(id),
    CONSTRAINT fk_venue_application_material_asset
        FOREIGN KEY (asset_id) REFERENCES private_asset(id)
);

CREATE INDEX IF NOT EXISTS idx_vam_application_type
    ON venue_application_material(venue_application_id, material_type);
CREATE INDEX IF NOT EXISTS idx_vam_asset
    ON venue_application_material(asset_id);
```

- [ ] **Step 2: Mirror the same owner-local migration for disposable/shared-schema tests**

Create the same table and columns in `sql/migrations/shared/20260912_venue_application_material.sql`. Keep no references to `omni_user`, `omni_ticket`, or cross-database objects.

- [ ] **Step 3: Register the new table in the production manifest**

Add `venue_application_material` to the `java-ticket` table list in `sql/production-split/manifest.json`, preserving existing ordering and JSON formatting.

- [ ] **Step 4: Run migration static checks**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-cross-owner-fks.ps1
```

Expected: both commands exit `0`; no cross-owner foreign key is reported.

## Task 2: Add material entities, request/response types, and private-asset support

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/entity/VenueApplicationMaterial.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/mapper/VenueApplicationMaterialMapper.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/VenueApplicationMaterialRequest.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/VenueApplicationMaterialResponse.java`
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/VenueApplicationMaterialService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/entity/VenueApplication.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/entity/Venue.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/VenueApplicationRequest.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/PrivateAssetService.java`
- Create: `java/java-ticket/src/test/java/com/omni/ticket/service/VenueApplicationMaterialServiceTest.java`

- [ ] **Step 1: Write failing material-service tests**

Cover these exact behaviors:

```java
@Test
void bindsFireAndLeaseMaterialsToApplication() {
    // Given two pending private assets and a newly inserted application,
    // when saveMaterials is called, then two typed rows are inserted.
}

@Test
void rejectsUnknownMaterialType() {
    assertThrows(BusinessException.class,
            () -> service.normalizeMaterialType("OTHER"));
}

@Test
void listsMaterialsWithPrivateAssetMetadata() {
    // The response includes filename, content type, file size and validity.
}
```

Run:

```powershell
mvn -pl java-ticket "-Dtest=VenueApplicationMaterialServiceTest" test
```

Expected: FAIL because the new service and types do not exist.

- [ ] **Step 2: Implement the entity and mapper**

`VenueApplicationMaterial` must use `@TableName("venue_application_material")`, `@TableId(type = IdType.AUTO)`, and fields matching the migration. The mapper extends `BaseMapper<VenueApplicationMaterial>`.

- [ ] **Step 3: Implement normalized material input and response**

`VenueApplicationMaterialRequest` contains:

```java
private String materialType;
private Long assetId;
private String note;
private LocalDateTime validFrom;
private LocalDateTime validTo;
```

`VenueApplicationMaterialResponse` contains the material row fields plus `PrivateAssetResponse asset`, `String label`, and `Boolean legacy`.

- [ ] **Step 4: Generalize `PrivateAssetService` without breaking legacy assets**

Keep `venue-proof` valid. Add:

```java
private static final Set<String> VENUE_MATERIAL_BIZ_TYPES =
        Set.of("venue-proof", "venue-fire-safety", "venue-lease-agreement");
```

Allow those types in upload and download permission checks. Add a generic bind method that validates pending status, uploader ownership, and application id; keep `bindVenueProof()` delegating to it for existing callers.

- [ ] **Step 5: Implement material save/list helpers**

`VenueApplicationMaterialService` must:

- normalize only `FIRE_SAFETY_PERMIT` and `VENUE_LEASE_AGREEMENT`;
- validate asset ownership/status through `PrivateAssetService`;
- replace the existing row for the same application and type;
- preserve the old `proof_*` fields untouched;
- list rows in deterministic `create_time DESC, id DESC` order;
- map `PrivateAsset` metadata without any user-database access.

- [ ] **Step 6: Run the focused tests**

Run the same Maven command again. Expected: PASS with all material-service tests green.

## Task 3: Extend application request/response and implement paged filtered query

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/entity/VenueApplication.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/entity/Venue.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/VenueApplicationRequest.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/VenueApplicationResponse.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/VenueApplicationService.java`
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/VenueApplicationServiceTest.java`

- [ ] **Step 1: Add failing service tests for new fields and legacy material mapping**

Add tests for:

```java
@Test
void submitCopiesVenueExtensionFieldsAndStructuredMaterials() { ... }

@Test
void legacyProofIsMappedAsGeneralHistoricalMaterial() { ... }

@Test
void pagedQueryFiltersByKeywordCityCapacityAndMaterialCompleteness() { ... }
```

The tests must assert `requirePermission(userId, "venue.review")` for admin query/review paths and assert that a legacy proof does not match `MISSING_FIRE` or `MISSING_LEASE`.

Run:

```powershell
mvn -pl java-ticket "-Dtest=VenueApplicationServiceTest" test
```

Expected: FAIL on missing fields/methods.

- [ ] **Step 2: Add extension fields and structured materials to request/entity/response**

Add nullable fields to both entities and copy them in `VenueApplicationRequest`. Add `List<VenueApplicationMaterialRequest> materials` to the request and `List<VenueApplicationMaterialResponse> materials` plus `String capacityScale`, `String materialCompleteness`, and `VenueApplicationMaterialResponse legacyProof` to the response.

Use `"综合演艺场馆"` only in response presentation metadata when `venueType` is blank; do not write that fallback into the database.

- [ ] **Step 3: Make submit persist the structured materials**

After inserting `venue_application`, call the material service with the generated application id. Keep the legacy `proofAssetId` flow unchanged for old clients. New material assets use the new material-specific `bizType` values and are bound to the new application id.

- [ ] **Step 4: Implement capacity and material completeness helpers**

Use exact bands:

```java
capacity >= 30000       -> EXTRA_LARGE
10000 <= capacity < 30000 -> LARGE
3000 <= capacity < 10000  -> MEDIUM
capacity < 3000          -> SMALL
```

If old proof fields are present and no typed material covers the record, set `materialCompleteness` to `LEGACY_GENERAL_PROOF`; otherwise calculate `COMPLETE`, `MISSING_FIRE`, or `MISSING_LEASE`.

- [ ] **Step 5: Implement server-side paging and filters**

Change the admin list service to return `Page<VenueApplicationResponse>` using `venueApplicationMapper.selectPage(new Page<>(safePage, safeSize), wrapper)`.

Build the wrapper with:

- status equality after `PENDING/APPROVED/REJECTED` normalization;
- city equality;
- capacity predicates;
- keyword `LIKE` over venue name, qualification number, address, contact name, and contact phone;
- controlled `EXISTS` subqueries against `venue_application_material` for typed material completeness;
- legacy proof compatibility branch in completeness filtering.

Collect application ids from the page, batch-load material rows and private assets, then assemble responses. Do not query `java-user` or perform cross-service joins.

- [ ] **Step 6: Run focused service tests**

Run:

```powershell
mvn -pl java-ticket "-Dtest=VenueApplicationServiceTest,VenueApplicationMaterialServiceTest" test
```

Expected: PASS.

## Task 4: Split approval endpoints and write audit events

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/VenueApplicationService.java`
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/VenueApplicationServiceTest.java`
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/VenueApplicationReviewCoverageTest.java`

- [ ] **Step 1: Write failing review tests**

Add assertions for:

```java
@Test
void approveUsesPermissionAndWritesAudit() { ... }

@Test
void approveLinksExistingActiveVenueWithoutCreatingDuplicate() { ... }

@Test
void rejectRequiresTrimmedReviewNoteAndWritesAudit() { ... }

@Test
void controllerExposesDedicatedApproveAndRejectRoutes() { ... }
```

The audit assertions must inspect:

- action `VENUE_REVIEW_APPROVE` or `VENUE_REVIEW_REJECT`;
- target type `venue_application`;
- target id equal to the application id;
- reason equal to the trimmed review note;
- success `true`.

Run:

```powershell
mvn -pl java-ticket "-Dtest=VenueApplicationServiceTest,VenueApplicationReviewCoverageTest" test
```

Expected: FAIL because dedicated routes and audit writes are absent.

- [ ] **Step 2: Add dedicated controller request mappings**

Add:

```java
@PostMapping("/venue-applications/{id}/approve")
public Result<VenueApplicationResponse> approveVenueApplication(...)

@PostMapping("/venue-applications/{id}/reject")
public Result<VenueApplicationResponse> rejectVenueApplication(...)
```

Read the operator id only from the bearer token, set it into the request object, and delegate to service methods. Keep `/review` unchanged for existing callers.

- [ ] **Step 3: Update service authorization and approval behavior**

Use `userAccessService.requirePermission(userId, "venue.review")` in admin list, approve, reject, and compatibility review flows.

For approve:

- if `application.venueId` refers to an active venue, update its nullable extension fields from the application where present and reuse it;
- otherwise create an active `Venue` from the application snapshot;
- set application status to `1`, reviewer, note, review time, update time;
- write audit after the state transition.

For reject:

- reject null/blank notes after `trim()`;
- set status `2`, reviewer, note, review time, update time;
- write audit.

- [ ] **Step 4: Run the review tests**

Run the focused Maven command again. Expected: PASS.

## Task 5: Add typed frontend contracts and update the submission page

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/app/console/venue/apply/page.tsx`
- Create/Modify: `frontend/src/lib/venue-application-review.test.ts`

- [ ] **Step 1: Write failing frontend contract tests**

Use source-level assertions consistent with existing frontend tests:

```ts
test('venue application API exposes paged filters and dedicated review actions', () => {
  const api = source('../lib/api.ts')
  assert.match(api, /listVenueApplications/)
  assert.match(api, /capacityScale/)
  assert.match(api, /materialCompleteness/)
  assert.match(api, /approveVenueApplication/)
  assert.match(api, /rejectVenueApplication/)
})

test('venue apply page exposes structured fields and two material uploads', () => {
  const page = source('../app/console/venue/apply/page.tsx')
  assert.match(page, /venueNameEn/)
  assert.match(page, /FIRE_SAFETY_PERMIT/)
  assert.match(page, /VENUE_LEASE_AGREEMENT/)
})
```

Run:

```powershell
cd frontend
node --test src/lib/venue-application-review.test.ts
```

Expected: FAIL because the new contracts are absent.

- [ ] **Step 2: Add TypeScript types**

Add:

```ts
export type VenueApplicationReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type VenueApplicationCapacityScale = 'EXTRA_LARGE' | 'LARGE' | 'MEDIUM' | 'SMALL'
export type VenueApplicationMaterialType =
  | 'FIRE_SAFETY_PERMIT'
  | 'VENUE_LEASE_AGREEMENT'
  | 'LEGACY_GENERAL_PROOF'
```

Add request, response, and `PageResult<VenueApplicationVO>` fields matching the Java DTO names after JSON camel-case conversion.

- [ ] **Step 3: Add API functions using `request<T>()`**

Implement:

```ts
listVenueApplications(params: {
  page?: number
  size?: number
  keyword?: string
  status?: VenueApplicationReviewStatus
  city?: string
  capacityScale?: VenueApplicationCapacityScale
  materialCompleteness?: string
}): Promise<PageResult<VenueApplicationVO>>

approveVenueApplication(id: number, reviewNote?: string)
rejectVenueApplication(id: number, reviewNote: string)
```

Keep `listMyVenueApplications()` returning the existing array shape for organizer pages. Add `uploadVenueApplicationMaterial(file, materialType)` as a thin wrapper over `uploadPrivateAsset()` with `venue-fire-safety` and `venue-lease-agreement` biz types.

- [ ] **Step 4: Update `/console/venue/apply`**

Add controlled fields for English name, venue type, province, and district. Maintain the old `proofNote`/legacy upload controls. Add two `PrivateFileUpload` instances and upload them independently. Submit:

```ts
materials: [
  fireAsset ? { materialType: 'FIRE_SAFETY_PERMIT', assetId: fireAsset.id, validFrom, validTo } : null,
  leaseAsset ? { materialType: 'VENUE_LEASE_AGREEMENT', assetId: leaseAsset.id, validFrom, validTo } : null,
].filter(Boolean)
```

Do not make the new materials mandatory for existing legacy-compatible submissions unless the current form already requires a proof.

- [ ] **Step 5: Run frontend contract tests and typecheck**

Run:

```powershell
cd frontend
node --test src/lib/venue-application-review.test.ts
pnpm typecheck
```

Expected: both commands pass.

## Task 6: Replace the admin page with a table and Drawer workflow

**Files:**
- Modify: `frontend/src/app/console/venue/applications/page.tsx`
- Modify: `frontend/src/lib/venue-application-review.test.ts`

- [ ] **Step 1: Extend failing page assertions**

Assert the page source contains:

```ts
assert.match(page, /GlobalPagination/)
assert.match(page, /<Drawer/)
assert.match(page, /SafeImage/)
assert.match(page, /capacityScale/)
assert.match(page, /materialCompleteness/)
assert.match(page, /待审核申请/)
assert.match(page, /已入库场馆档案/)
assert.match(page, /已驳回记录/)
assert.match(page, /reviewNote\.trim\(\)/)
assert.doesNotMatch(page, /pageApplications = applications\.slice/)
```

Run the test and confirm it fails against the card-based implementation.

- [ ] **Step 2: Implement query state and server-side loading**

Use state for:

```ts
type VenueTab = 'PENDING' | 'APPROVED' | 'REJECTED'
type VenueFilterState = {
  keyword: string
  city: string
  capacityScale: string
  materialCompleteness: string
}
```

Call `listVenueApplications({ page, size: DEFAULT_PAGE_SIZE, status, ...filters })` whenever the query state or page changes. Reset page to `1` when a filter or tab changes. Keep loading and error states in Chinese.

- [ ] **Step 3: Render dense table columns**

Render columns for:

- venue name, type, qualification number;
- city/district and address;
- capacity and scale;
- contact name and phone;
- fire/lease material badges;
- review status;
- actions.

Use `min-w-*`, `whitespace-nowrap`, `truncate`, and a horizontally scrollable table wrapper. Make the whole row open the Drawer while stopping propagation on action buttons.

- [ ] **Step 4: Implement Drawer details and material preview**

Use `Drawer` with `width="w-[640px]"`. Use `SafeImage` for image materials. Reuse `Modal` for enlarged previews, matching the existing organizer application material preview pattern. For private assets, use the protected download endpoint and do not expose raw untrusted URLs.

Render the historical compatibility label exactly as:

```text
通用审批综合证明材料（历史凭证）
```

- [ ] **Step 5: Implement approve/reject control console**

The approve action sends the optional trimmed note. The reject action must execute:

```ts
if (!reviewNote.trim()) {
  setDrawerError('驳回必须填写整改原因')
  return
}
```

Disable controls while saving, close the Drawer after success, and reload the current page plus pending count. If a request fails, keep the Drawer open and show the API error.

- [ ] **Step 6: Run frontend tests**

Run:

```powershell
cd frontend
node --test src/lib/venue-application-review.test.ts src/lib/console-modal-drawer-layout.test.ts
pnpm typecheck
```

Expected: all selected tests and typecheck pass.

## Task 7: Update implementation notes and run end-to-end verification

**Files:**
- Modify: `implementation-notes.md`

- [ ] **Step 1: Record implementation and deviations**

Append a dated `2026-09-12` section covering:

- `venue_application_material` migration and manifest update;
- legacy proof compatibility behavior;
- service-side filters and pagination;
- independent approve/reject audit events;
- structured uploads and Drawer workflow;
- any local migration or runtime verification that was intentionally not executed because it would have side effects.

- [ ] **Step 2: Run Java tests**

Run:

```powershell
mvn -pl java-ticket "-Dtest=VenueApplicationMaterialServiceTest,VenueApplicationServiceTest,VenueApplicationReviewCoverageTest" test
```

Expected: all selected tests pass with exit code `0`.

- [ ] **Step 3: Run frontend typecheck and focused tests**

Run:

```powershell
cd frontend
node --test src/lib/venue-application-review.test.ts src/lib/console-modal-drawer-layout.test.ts
pnpm typecheck
```

Expected: no test failures and no TypeScript errors.

- [ ] **Step 4: Run boundary verification**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
```

Expected: exit `0`, with no cross-database mapper/entity/SQL violations.

- [ ] **Step 5: Inspect the final diff without committing**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors. Do not run `git commit`, `git push`, `git reset`, or destructive cleanup commands.
