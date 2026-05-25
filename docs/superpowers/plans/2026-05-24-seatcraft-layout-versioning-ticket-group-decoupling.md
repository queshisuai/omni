# SeatCraft Layout Versioning and Ticket Group Decoupling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SeatCraft draft/publish/rollback versioning and explicit block-ticket-group bindings while preserving existing materialized runtime tables.

**Architecture:** Store draft and published SeatCraft layouts in new version tables. Treat `seat_layout_version_group_binding` as the authoritative relationship between blocks and ticket groups. Publish materializes a version into the existing `seat_block`, `seat_override`, and `ticket_group` tables so current seat generation and sales flows continue to work.

**Tech Stack:** Java Spring Boot, MyBatis-Plus, PostgreSQL, Next.js 16, React 19, TypeScript, pnpm, Maven.

---

## File Structure

- Create `sql/migrations/shared/20260524_seatcraft_layout_versioning.sql`
  - Shared migration for version tables and indexes.
- Create `sql/production-split/ticket/20260524_seatcraft_layout_versioning.sql`
  - Production-split ticket migration with owner comment.
- Modify `sql/production-split/manifest.json`
  - Register the new ticket migration.
- Create `java/java-ticket/src/main/java/com/omni/ticket/entity/SeatLayoutVersion.java`
  - Version root entity.
- Create `java/java-ticket/src/main/java/com/omni/ticket/entity/SeatLayoutVersionBlock.java`
  - Version block snapshot entity.
- Create `java/java-ticket/src/main/java/com/omni/ticket/entity/SeatLayoutVersionOverride.java`
  - Version override snapshot entity.
- Create `java/java-ticket/src/main/java/com/omni/ticket/entity/SeatLayoutVersionTicketGroup.java`
  - Version ticket group snapshot entity.
- Create `java/java-ticket/src/main/java/com/omni/ticket/entity/SeatLayoutVersionGroupBinding.java`
  - Version block-to-group binding entity.
- Create mapper interfaces for the five entities under `java/java-ticket/src/main/java/com/omni/ticket/mapper/`.
- Modify `java/java-ticket/src/main/java/com/omni/ticket/dto/SeatCraftBlockDtos.java`
  - Add version metadata and `BindingRequest`.
- Create `java/java-ticket/src/main/java/com/omni/ticket/service/SeatCraftLayoutVersionService.java`
  - Draft, publish, rollback, materialize, and version listing workflow.
- Modify `java/java-ticket/src/main/java/com/omni/ticket/service/SeatCraftBlockLayoutService.java`
  - Preserve current materialized replacement and expose reusable conversion helpers if needed.
- Modify `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
  - Add versioned SeatCraft endpoints.
- Modify frontend SeatCraft types and layout payload helpers:
  - `frontend/src/types/api.ts`
  - `frontend/src/components/seatcraft/types.ts`
  - `frontend/src/components/seatcraft/block-layout.ts`
  - `frontend/src/components/seatcraft/block-layout.test.ts`
- Modify frontend designer controls:
  - `frontend/src/components/seatcraft/SeatLayoutDesigner.tsx`
  - `frontend/src/components/seatcraft/SeatLayoutControls.tsx`

---

### Task 1: SQL Version Tables

**Files:**
- Create: `sql/migrations/shared/20260524_seatcraft_layout_versioning.sql`
- Create: `sql/production-split/ticket/20260524_seatcraft_layout_versioning.sql`
- Modify: `sql/production-split/manifest.json`

- [ ] **Step 1: Add shared migration**

Create `sql/migrations/shared/20260524_seatcraft_layout_versioning.sql`:

```sql
CREATE TABLE IF NOT EXISTS seat_layout_version (
    id BIGSERIAL PRIMARY KEY,
    owner_type VARCHAR(30) NOT NULL,
    owner_id BIGINT NOT NULL,
    version_no INTEGER NOT NULL,
    version_status VARCHAR(20) NOT NULL,
    name VARCHAR(80),
    template_type VARCHAR(20),
    stage_title VARCHAR(80),
    stage_x INTEGER,
    stage_y INTEGER,
    canvas_width INTEGER,
    canvas_height INTEGER,
    base_version_id BIGINT REFERENCES seat_layout_version(id),
    published_at TIMESTAMP,
    published_by BIGINT,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_seat_layout_version_owner CHECK (owner_type IN ('venue', 'venue_application', 'station', 'activity', 'session')),
    CONSTRAINT chk_seat_layout_version_status CHECK (version_status IN ('draft', 'published', 'archived')),
    CONSTRAINT uq_seat_layout_version_no UNIQUE (owner_type, owner_id, version_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_seat_layout_version_draft
    ON seat_layout_version(owner_type, owner_id)
    WHERE version_status = 'draft';

CREATE UNIQUE INDEX IF NOT EXISTS uq_seat_layout_version_published
    ON seat_layout_version(owner_type, owner_id)
    WHERE version_status = 'published';

CREATE TABLE IF NOT EXISTS seat_layout_version_block (
    id BIGSERIAL PRIMARY KEY,
    version_id BIGINT NOT NULL REFERENCES seat_layout_version(id) ON DELETE CASCADE,
    block_key VARCHAR(80) NOT NULL,
    name VARCHAR(80) NOT NULL,
    block_type VARCHAR(30) NOT NULL,
    x NUMERIC(12, 2) NOT NULL DEFAULT 0,
    y NUMERIC(12, 2) NOT NULL DEFAULT 0,
    rotation NUMERIC(8, 2) NOT NULL DEFAULT 0,
    scale NUMERIC(8, 2) NOT NULL DEFAULT 1,
    rows INTEGER,
    cols INTEGER,
    seats_per_row INTEGER,
    row_spacing NUMERIC(12, 2),
    seat_spacing NUMERIC(12, 2),
    inner_radius NUMERIC(12, 2),
    arc_start_angle NUMERIC(8, 2),
    arc_end_angle NUMERIC(8, 2),
    width NUMERIC(12, 2),
    height NUMERIC(12, 2),
    capacity INTEGER,
    polygon_points JSONB,
    color VARCHAR(20) NOT NULL DEFAULT '#ff1268',
    sort INTEGER NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_seat_layout_version_block_type CHECK (block_type IN ('gridBlock', 'arcBlock', 'standingBlock', 'polygonBlock')),
    CONSTRAINT uq_seat_layout_version_block_key UNIQUE (version_id, block_key)
);

CREATE TABLE IF NOT EXISTS seat_layout_version_override (
    id BIGSERIAL PRIMARY KEY,
    version_block_id BIGINT NOT NULL REFERENCES seat_layout_version_block(id) ON DELETE CASCADE,
    row_no INTEGER NOT NULL,
    seat_no INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'visible',
    dx NUMERIC(12, 2) NOT NULL DEFAULT 0,
    dy NUMERIC(12, 2) NOT NULL DEFAULT 0,
    custom_label VARCHAR(40),
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_seat_layout_version_override_status CHECK (status IN ('visible', 'hidden', 'deleted')),
    CONSTRAINT uq_seat_layout_version_override_position UNIQUE (version_block_id, row_no, seat_no)
);

CREATE TABLE IF NOT EXISTS seat_layout_version_ticket_group (
    id BIGSERIAL PRIMARY KEY,
    version_id BIGINT NOT NULL REFERENCES seat_layout_version(id) ON DELETE CASCADE,
    group_key VARCHAR(80) NOT NULL,
    name VARCHAR(80) NOT NULL,
    default_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    activity_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    sort INTEGER NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_seat_layout_version_group_key UNIQUE (version_id, group_key)
);

CREATE TABLE IF NOT EXISTS seat_layout_version_group_binding (
    id BIGSERIAL PRIMARY KEY,
    version_id BIGINT NOT NULL REFERENCES seat_layout_version(id) ON DELETE CASCADE,
    block_key VARCHAR(80) NOT NULL,
    group_key VARCHAR(80) NOT NULL,
    binding_role VARCHAR(20) NOT NULL DEFAULT 'primary',
    sort INTEGER NOT NULL DEFAULT 0,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_seat_layout_version_binding_role CHECK (binding_role IN ('primary')),
    CONSTRAINT uq_seat_layout_version_binding UNIQUE (version_id, block_key, binding_role)
);

CREATE INDEX IF NOT EXISTS idx_seat_layout_version_owner ON seat_layout_version(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_seat_layout_version_block_version ON seat_layout_version_block(version_id);
CREATE INDEX IF NOT EXISTS idx_seat_layout_version_override_block ON seat_layout_version_override(version_block_id);
CREATE INDEX IF NOT EXISTS idx_seat_layout_version_group_version ON seat_layout_version_ticket_group(version_id);
CREATE INDEX IF NOT EXISTS idx_seat_layout_version_binding_version ON seat_layout_version_group_binding(version_id);
```

- [ ] **Step 2: Add production-split migration**

Create `sql/production-split/ticket/20260524_seatcraft_layout_versioning.sql` with the same SQL as Step 1, and add this first line:

```sql
-- owner: java-ticket
```

- [ ] **Step 3: Register migration in manifest**

Modify the `ticket` service entry in `sql/production-split/manifest.json` so `migrations` includes:

```json
"ticket/20260524_seatcraft_layout_versioning.sql"
```

Keep existing migrations in the array.

- [ ] **Step 4: Run SQL safety check**

Run from repo root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1
```

Expected: `PASS production split SQL safety check`.

---

### Task 2: Version Entities, Mappers, and DTOs

**Files:**
- Create entity classes under `java/java-ticket/src/main/java/com/omni/ticket/entity/`
- Create mapper interfaces under `java/java-ticket/src/main/java/com/omni/ticket/mapper/`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/dto/SeatCraftBlockDtos.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/dto/SeatCraftBlockDtosTest.java`

- [ ] **Step 1: Write DTO test**

Create `java/java-ticket/src/test/java/com/omni/ticket/dto/SeatCraftBlockDtosTest.java`:

```java
package com.omni.ticket.dto;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SeatCraftBlockDtosTest {
    @Test
    void layoutRequestCarriesVersionAndBindings() {
        SeatCraftBlockDtos.LayoutRequest layout = new SeatCraftBlockDtos.LayoutRequest();
        layout.setVersionId(10L);
        layout.setVersionNo(3);
        layout.setVersionStatus("draft");

        SeatCraftBlockDtos.BindingRequest binding = new SeatCraftBlockDtos.BindingRequest();
        binding.setBlockKey("block-a");
        binding.setGroupKey("vip");
        binding.setBindingRole("primary");
        binding.setSort(1);
        layout.getBindings().add(binding);

        assertEquals(10L, layout.getVersionId());
        assertEquals(3, layout.getVersionNo());
        assertEquals("draft", layout.getVersionStatus());
        assertEquals("block-a", layout.getBindings().get(0).getBlockKey());
        assertEquals("vip", layout.getBindings().get(0).getGroupKey());
        assertEquals("primary", layout.getBindings().get(0).getBindingRole());
    }
}
```

- [ ] **Step 2: Run RED DTO test**

Run from `java`:

```powershell
mvn test -pl java-ticket "-Dtest=SeatCraftBlockDtosTest"
```

Expected: FAIL because the new DTO fields/classes do not exist.

- [ ] **Step 3: Add DTO fields**

Modify `SeatCraftBlockDtos.LayoutRequest`:

```java
private Long versionId;
private Integer versionNo;
private String versionStatus;
private List<BindingRequest> bindings = new ArrayList<>();

public Long getVersionId() { return versionId; }
public void setVersionId(Long versionId) { this.versionId = versionId; }
public Integer getVersionNo() { return versionNo; }
public void setVersionNo(Integer versionNo) { this.versionNo = versionNo; }
public String getVersionStatus() { return versionStatus; }
public void setVersionStatus(String versionStatus) { this.versionStatus = versionStatus; }
public List<BindingRequest> getBindings() { return bindings; }
public void setBindings(List<BindingRequest> bindings) { this.bindings = bindings; }
```

Add nested class:

```java
public static class BindingRequest {
    private String blockKey;
    private String groupKey;
    private String bindingRole;
    private Integer sort;

    public String getBlockKey() { return blockKey; }
    public void setBlockKey(String blockKey) { this.blockKey = blockKey; }
    public String getGroupKey() { return groupKey; }
    public void setGroupKey(String groupKey) { this.groupKey = groupKey; }
    public String getBindingRole() { return bindingRole; }
    public void setBindingRole(String bindingRole) { this.bindingRole = bindingRole; }
    public Integer getSort() { return sort; }
    public void setSort(Integer sort) { this.sort = sort; }
}
```

- [ ] **Step 4: Add entity classes**

Create the five entity classes with JavaBean getters/setters and `@TableName`:

```java
@TableName("seat_layout_version")
public class SeatLayoutVersion { ... }
```

Fields must match SQL columns. For `SeatLayoutVersionBlock.polygonPoints`, use:

```java
@TableField(typeHandler = JsonbStringTypeHandler.class, jdbcType = JdbcType.OTHER)
private String polygonPoints;
```

and annotate the class:

```java
@TableName(value = "seat_layout_version_block", autoResultMap = true)
```

- [ ] **Step 5: Add mapper interfaces**

Create each mapper as:

```java
package com.omni.ticket.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.omni.ticket.entity.SeatLayoutVersion;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface SeatLayoutVersionMapper extends BaseMapper<SeatLayoutVersion> {
}
```

Repeat for the four detail entities.

- [ ] **Step 6: Run GREEN DTO test and compile**

Run from `java`:

```powershell
mvn test -pl java-ticket "-Dtest=SeatCraftBlockDtosTest"
```

Expected: PASS.

---

### Task 3: Draft Save and Read Service

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/service/SeatCraftLayoutVersionService.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/service/SeatCraftLayoutVersionServiceTest.java`

- [ ] **Step 1: Write RED test for draft persistence**

Create `SeatCraftLayoutVersionServiceTest` with Mockito setup for the five version mappers. Add this test:

```java
@Test
void saveDraftPersistsVersionBlocksGroupsOverridesAndBindingsWithoutMaterializedTables() {
    SeatCraftBlockDtos.LayoutRequest layout = sampleLayout();
    when(versionMapper.selectOne(any())).thenReturn(null);
    when(versionMapper.selectList(any())).thenReturn(List.of());
    doAnswer(invocation -> { SeatLayoutVersion version = invocation.getArgument(0); version.setId(100L); return 1; }).when(versionMapper).insert(any());
    doAnswer(invocation -> { SeatLayoutVersionBlock block = invocation.getArgument(0); block.setId(200L); return 1; }).when(blockMapper).insert(any());

    SeatCraftBlockDtos.LayoutRequest result = service.saveDraft("session", 3001L, layout, 2003L);

    assertEquals(100L, result.getVersionId());
    assertEquals("draft", result.getVersionStatus());
    verify(blockMapper).insert(any(SeatLayoutVersionBlock.class));
    verify(groupMapper).insert(any(SeatLayoutVersionTicketGroup.class));
    verify(bindingMapper).insert(any(SeatLayoutVersionGroupBinding.class));
    verify(overrideMapper).insert(any(SeatLayoutVersionOverride.class));
    verifyNoInteractions(seatBlockMapper, seatOverrideMapper, ticketGroupMapper);
}
```

Include helper `sampleLayout()` with one block, one group, one binding, and one override.

- [ ] **Step 2: Run RED test**

Run from `java`:

```powershell
mvn test -pl java-ticket "-Dtest=SeatCraftLayoutVersionServiceTest"
```

Expected: FAIL because service does not exist.

- [ ] **Step 3: Implement `saveDraft`**

Create `SeatCraftLayoutVersionService` with constructor-injected version mappers and materialized mappers. Implement:

```java
@Transactional
public SeatCraftBlockDtos.LayoutRequest saveDraft(String ownerType, Long ownerId, SeatCraftBlockDtos.LayoutRequest layout, Long operatorId)
```

Minimal behavior:

- Validate owner and layout.
- Find existing draft by owner.
- If none, create next `version_no` and `version_status='draft'`.
- Delete existing draft details when updating.
- Insert version blocks, groups, bindings, overrides.
- Return `getDraft(ownerType, ownerId)`.

- [ ] **Step 4: Implement `getDraft`**

Implement:

```java
public SeatCraftBlockDtos.LayoutRequest getDraft(String ownerType, Long ownerId)
```

Behavior:

- Return existing draft if present.
- If no draft and published exists, clone published into a new draft and return it.
- If neither exists, return `null`.

- [ ] **Step 5: Run GREEN test**

Run from `java`:

```powershell
mvn test -pl java-ticket "-Dtest=SeatCraftLayoutVersionServiceTest"
```

Expected: PASS.

---

### Task 4: Publish Materialization and Rollback

**Files:**
- Modify: `SeatCraftLayoutVersionService.java`
- Test: `SeatCraftLayoutVersionServiceTest.java`

- [ ] **Step 1: Add RED tests**

Add tests:

```java
@Test
void publishDraftArchivesCurrentPublishedAndMaterializesCompatibilityFields() { ... }

@Test
void rollbackClonesHistoricalVersionAsDraft() { ... }

@Test
void publishRejectsBlockWithoutPrimaryBinding() { ... }
```

The publish test must verify:

- current published is updated to `archived`.
- draft is updated to `published`.
- materialized `SeatBlock.ticketGroupKey` equals binding `groupKey`.
- materialized `TicketGroup.sourceBlockIds` contains the bound block key.

- [ ] **Step 2: Run RED tests**

Run:

```powershell
mvn test -pl java-ticket "-Dtest=SeatCraftLayoutVersionServiceTest"
```

Expected: new tests fail because publish/rollback are not implemented.

- [ ] **Step 3: Implement publish**

Implement:

```java
@Transactional
public SeatCraftBlockDtos.LayoutRequest publishDraft(String ownerType, Long ownerId, Long operatorId)
```

Required behavior:

- Load draft or throw `BusinessException(404, "草稿版本不存在")`.
- Load blocks, groups, bindings, overrides.
- Validate every active block has a primary binding and every active group has at least one block.
- Archive current published versions for owner.
- Mark draft as published and set `publishedAt/publishedBy/updateTime`.
- Materialize into existing `seat_block`, `seat_override`, `ticket_group` using the current compatibility strategy.

- [ ] **Step 4: Implement rollback**

Implement:

```java
@Transactional
public SeatCraftBlockDtos.LayoutRequest rollbackToDraft(String ownerType, Long ownerId, Long versionId, Long operatorId)
```

Behavior:

- Load target version for same owner or throw 404.
- Delete existing draft for owner.
- Clone target version into a new draft with next version number and `baseVersionId=target.id`.
- Return cloned draft.

- [ ] **Step 5: Run GREEN tests**

Run:

```powershell
mvn test -pl java-ticket "-Dtest=SeatCraftLayoutVersionServiceTest"
```

Expected: PASS.

---

### Task 5: Admin Versioned API Endpoints

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Test: `java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java`

- [ ] **Step 1: Add RED controller tests**

Add tests that call controller methods directly with mocked `SeatCraftLayoutVersionService`:

```java
@Test
void getSeatCraftDraftReturnsVersionedDraft() { ... }

@Test
void saveSeatCraftDraftUsesTokenSubjectAndService() { ... }

@Test
void publishSeatCraftDraftUsesTokenSubjectAndService() { ... }
```

Verify service methods receive `ownerType`, `ownerId`, request body, and token subject user id.

- [ ] **Step 2: Run RED controller tests**

Run:

```powershell
mvn test -pl java-ticket "-Dtest=AdminControllerTest"
```

Expected: FAIL because endpoints are absent.

- [ ] **Step 3: Add controller dependency**

Inject `SeatCraftLayoutVersionService` into `AdminController`. If the controller has multiple constructors, ensure production constructor is annotated with `@Autowired` per project convention.

- [ ] **Step 4: Add endpoints**

Add methods:

```java
@GetMapping("/seatcraft/{ownerType}/{ownerId}/draft")
public Result<SeatCraftBlockDtos.LayoutRequest> getSeatCraftDraft(...)

@PutMapping("/seatcraft/{ownerType}/{ownerId}/draft")
public Result<SeatCraftBlockDtos.LayoutRequest> saveSeatCraftDraft(...)

@PostMapping("/seatcraft/{ownerType}/{ownerId}/publish")
public Result<SeatCraftBlockDtos.LayoutRequest> publishSeatCraftDraft(...)

@PostMapping("/seatcraft/{ownerType}/{ownerId}/versions/{versionId}/rollback")
public Result<SeatCraftBlockDtos.LayoutRequest> rollbackSeatCraftVersion(...)

@GetMapping("/seatcraft/{ownerType}/{ownerId}/versions")
public Result<List<SeatCraftBlockDtos.VersionSummary>> listSeatCraftVersions(...)
```

Add `VersionSummary` DTO in Task 2 or here if missing.

- [ ] **Step 5: Run GREEN controller tests**

Run:

```powershell
mvn test -pl java-ticket "-Dtest=AdminControllerTest"
```

Expected: PASS.

---

### Task 6: Frontend Bindings in Layout Payload

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/components/seatcraft/types.ts`
- Modify: `frontend/src/components/seatcraft/block-layout.ts`
- Modify: `frontend/src/components/seatcraft/block-layout.test.ts`

- [ ] **Step 1: Add RED frontend tests**

In `block-layout.test.ts`, add:

```ts
test('layout draft derives bindings from legacy block ticket group keys', () => {
  const draft = toSeatCraftLayoutDraft({
    id: 1,
    name: '布局',
    templateType: 'concert',
    stage: { title: '舞台', x: 0, y: 0 },
    canvasWidth: 1000,
    canvasHeight: 800,
    sections: [],
    blockLayout: {
      blocks: [{ ...gridBlock(), ticketGroupKey: 'vip' }],
      overrides: [],
      ticketGroups: [{ groupKey: 'vip', name: 'VIP', sourceBlockKeys: ['block-a'], sort: 0 }],
    },
  })

  assert.deepEqual(draft.bindings, [{ blockKey: 'block-a', groupKey: 'vip', bindingRole: 'primary', sort: 0 }])
})

test('layout payload keeps bindings as authoritative relationship', () => {
  const payload = toSeatCraftLayoutPayload({
    id: 1,
    name: '布局',
    templateType: 'concert',
    stage: { title: '舞台', x: 0, y: 0 },
    canvasWidth: 1000,
    canvasHeight: 800,
    sections: [],
    blocks: [gridBlock()],
    ticketGroups: [{ groupKey: 'vip', name: 'VIP', sourceBlockKeys: [], sort: 0 }],
    bindings: [{ blockKey: 'block-a', groupKey: 'vip', bindingRole: 'primary', sort: 0 }],
  })

  assert.deepEqual(payload.blockLayout?.bindings, [{ blockKey: 'block-a', groupKey: 'vip', bindingRole: 'primary', sort: 0 }])
  assert.deepEqual(payload.blockLayout?.ticketGroups?.[0]?.sourceBlockKeys, ['block-a'])
  assert.equal(payload.blockLayout?.blocks?.[0]?.ticketGroupKey, 'vip')
})
```

- [ ] **Step 2: Run RED frontend tests**

Run from `frontend`:

```powershell
node --test --experimental-strip-types --experimental-transform-types "src/components/seatcraft/block-layout.test.ts"
```

Expected: new binding tests fail because bindings are not supported. Existing two arc failures may still appear.

- [ ] **Step 3: Add frontend types**

Add API and draft binding types:

```ts
export interface SeatCraftBindingVO {
  blockKey: string
  groupKey: string
  bindingRole?: 'primary'
  sort?: number | null
}
```

Add `bindings?: SeatCraftBindingVO[]` to `SeatCraftLayoutVO.blockLayout` and `SeatCraftLayoutDraft`.

- [ ] **Step 4: Implement binding derivation and payload compatibility**

In `block-layout.ts`, add helper:

```ts
function deriveBindings(blocks: SeatBlockDraft[], ticketGroups: TicketGroupDraft[]) {
  const bindings = blocks
    .filter(block => block.ticketGroupKey)
    .map((block, index) => ({ blockKey: block.blockKey, groupKey: block.ticketGroupKey, bindingRole: 'primary' as const, sort: index }))
  if (bindings.length > 0) return bindings
  return ticketGroups.flatMap(group => (group.sourceBlockKeys ?? []).map((blockKey, index) => ({ blockKey, groupKey: group.groupKey, bindingRole: 'primary' as const, sort: index })))
}
```

Update `toSeatCraftLayoutDraft()` to use `layout.blockLayout?.bindings ?? deriveBindings(blocks, ticketGroups)`.

Update `toSeatCraftLayoutPayload()` to:

- Use `layout.bindings ?? deriveBindings(blocks, ticketGroups)`.
- Fill each block `ticketGroupKey` from binding when missing or stale.
- Fill each group `sourceBlockKeys` from bindings.
- Include `bindings` in `blockLayout`.

- [ ] **Step 5: Run tests**

Run:

```powershell
node --test --experimental-strip-types --experimental-transform-types "src/components/seatcraft/block-layout.test.ts"
pnpm typecheck
```

Expected: binding tests pass; the two known arc failures may remain until separately fixed.

---

### Task 7: Frontend Binding UI Minimal Decoupling

**Files:**
- Modify: `frontend/src/components/seatcraft/SeatLayoutDesigner.tsx`
- Modify: `frontend/src/components/seatcraft/SeatLayoutControls.tsx`

- [ ] **Step 1: Add binding update helpers in designer**

Add:

```ts
const bindings = layout.bindings ?? []

const updateBlockBinding = (blockKey: string, groupKey: string) => {
  const nextBindings = bindings.filter(binding => binding.blockKey !== blockKey || binding.bindingRole !== 'primary')
  nextBindings.push({ blockKey, groupKey, bindingRole: 'primary', sort: nextBindings.length })
  commit({ ...layout, bindings: nextBindings })
}
```

- [ ] **Step 2: Pass bindings to controls**

Extend `SeatLayoutControlsProps` with:

```ts
onUpdateBlockBinding?: (blockKey: string, groupKey: string) => void
```

Pass `onUpdateBlockBinding={updateBlockBinding}`.

- [ ] **Step 3: Add block binding selector in controls**

In the active block panel, render a `select` listing `layout.ticketGroups`. The value is resolved from `layout.bindings` for `activeBlock.blockKey`, falling back to `activeBlock.ticketGroupKey`.

On change call:

```ts
onUpdateBlockBinding?.(activeBlock.blockKey, event.target.value)
```

Keep existing ticket group name/price edit UI unchanged.

- [ ] **Step 4: Run typecheck**

Run:

```powershell
pnpm typecheck
```

Expected: PASS.

---

### Task 8: Final Verification

**Files:**
- No new implementation files unless fixing verification issues.

- [ ] **Step 1: Backend targeted tests**

Run from `java`:

```powershell
mvn test -pl java-ticket "-Dtest=SeatCraftBlockDtosTest,SeatCraftLayoutVersionServiceTest,AdminControllerTest,SessionBlockTicketStockServiceTest"
```

Expected: PASS.

- [ ] **Step 2: Frontend tests and typecheck**

Run from `frontend`:

```powershell
node --test --experimental-strip-types --experimental-transform-types "src/components/seatcraft/block-layout.test.ts"
pnpm typecheck
```

Expected: binding tests pass. Existing arc failures may still appear; record actual output.

- [ ] **Step 3: SQL and boundary checks**

Run from repo root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
```

Expected: both pass.

- [ ] **Step 4: Targeted diff check**

Run:

```powershell
git diff --check -- java/java-ticket/src/main/java/com/omni/ticket java/java-ticket/src/test/java/com/omni/ticket frontend/src/components/seatcraft frontend/src/types/api.ts sql/migrations/shared/20260524_seatcraft_layout_versioning.sql sql/production-split/ticket/20260524_seatcraft_layout_versioning.sql sql/production-split/manifest.json docs/superpowers/specs/2026-05-24-seatcraft-layout-versioning-ticket-group-decoupling-design.md docs/superpowers/plans/2026-05-24-seatcraft-layout-versioning-ticket-group-decoupling.md
```

Expected: no whitespace errors. LF/CRLF warnings are acceptable.

---

## Plan Self-Review

- Spec coverage: SQL model, version entities, draft save/read, publish materialization, rollback, API, frontend bindings, minimal UI, and verification are covered.
- Placeholder scan: no placeholder tasks remain; code snippets and commands are explicit.
- Type consistency: version terms use `versionId`, `versionNo`, `versionStatus`, `bindings`, `bindingRole`, `blockKey`, and `groupKey` consistently across backend and frontend.
- Scope check: P3 is intentionally large, but tasks are staged so materialized runtime compatibility is preserved before frontend adoption.
