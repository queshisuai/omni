# SeatCraft Version History Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 展示完整 SeatCraft 历史版本，并允许管理员回到某个版本或删除可删除版本。

**Architecture:** 后端在 `java-ticket` 的 SeatCraft version service 内新增删除版本能力，复用现有 version/detail 表和服务边界。前端复用现有 versioned draft API，列表组件只负责展示、回滚、删除和刷新，不影响主草稿加载。

**Tech Stack:** Spring Boot + MyBatis-Plus + JUnit/Mockito，Next.js + React + TypeScript，Node test。

---

## File Structure

- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SeatCraftLayoutVersionService.java`，新增 `deleteVersion()`，禁止删除 published，并清理 version details。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`，新增 `DELETE /seatcraft/{ownerType}/{ownerId}/versions/{versionId}`。
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/SeatCraftLayoutVersionServiceTest.java`，覆盖删除 archived/draft、禁止删除 published。
- Modify: `frontend/src/lib/api.ts`，新增 `deleteSeatCraftVersion()`。
- Modify: `frontend/src/app/console/activities/[id]/seat-layout/page.tsx`，历史列表支持回滚和删除。
- Modify: `frontend/src/app/console/sessions/[id]/seat-layout/page.tsx`，历史列表支持回滚、删除和刷新已售座位叠加。
- Modify: `frontend/src/components/seatcraft/block-layout.test.ts`，保持现有 versioned payload/merge 行为测试。

### Task 1: Backend Delete Version

**Files:**
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/SeatCraftLayoutVersionServiceTest.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/SeatCraftLayoutVersionService.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`

- [ ] **Step 1: Write failing tests**

Add tests to `SeatCraftLayoutVersionServiceTest`:

```java
@Test
void deleteVersionRemovesArchivedVersionAndDetails() {
    SeatLayoutVersion archived = version(80L, 2, "archived");

    when(versionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(archived);
    when(blockMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(versionBlock(101L, 80L, "block-a", 1, "gridBlock")));

    service.deleteVersion("session", 3001L, 80L);

    verify(overrideMapper).delete(any(LambdaQueryWrapper.class));
    verify(bindingMapper).delete(any(LambdaQueryWrapper.class));
    verify(groupMapper).delete(any(LambdaQueryWrapper.class));
    verify(blockMapper).delete(any(LambdaQueryWrapper.class));
    verify(versionMapper).deleteById(80L);
}

@Test
void deleteVersionRejectsPublishedVersion() {
    SeatLayoutVersion published = version(80L, 2, "published");
    when(versionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(published);

    BusinessException error = assertThrows(BusinessException.class,
            () -> service.deleteVersion("session", 3001L, 80L));

    assertEquals(400, error.getCode());
    verify(versionMapper, never()).deleteById(80L);
}
```

- [ ] **Step 2: Run tests to verify failure**

Run: `mvn test -pl java-ticket "-Dtest=SeatCraftLayoutVersionServiceTest"`

Expected: FAIL because `deleteVersion` does not exist.

- [ ] **Step 3: Implement service method**

Add to `SeatCraftLayoutVersionService`:

```java
@Transactional
public void deleteVersion(String ownerType, Long ownerId, Long versionId) {
    validateOwner(ownerType, ownerId);
    SeatLayoutVersion target = versionMapper.selectOne(new LambdaQueryWrapper<SeatLayoutVersion>()
            .eq(SeatLayoutVersion::getOwnerType, trim(ownerType))
            .eq(SeatLayoutVersion::getOwnerId, ownerId)
            .eq(SeatLayoutVersion::getId, versionId)
            .last("limit 1"));
    if (target == null) {
        throw new BusinessException(404, "目标版本不存在");
    }
    if (STATUS_PUBLISHED.equals(trim(target.getVersionStatus()))) {
        throw new BusinessException(400, "已发布版本不能删除");
    }
    deleteVersionDetails(target.getId());
    versionMapper.deleteById(target.getId());
}
```

- [ ] **Step 4: Implement controller endpoint**

Add to `AdminController` near rollback endpoint:

```java
@DeleteMapping("/seatcraft/{ownerType}/{ownerId}/versions/{versionId}")
public Result<Void> deleteSeatCraftVersion(
        @RequestHeader(value = "Authorization", required = false) String authorization,
        @PathVariable String ownerType,
        @PathVariable Long ownerId,
        @PathVariable Long versionId) {
    Long operatorId = parseOperatorId(authorization);
    if (operatorId == null) {
        return Result.fail(ResultCode.UNAUTHORIZED);
    }
    seatCraftLayoutVersionService.deleteVersion(ownerType, ownerId, versionId);
    return Result.success(null);
}
```

- [ ] **Step 5: Run tests**

Run: `mvn test -pl java-ticket "-Dtest=SeatCraftLayoutVersionServiceTest"`

Expected: PASS.

### Task 2: Frontend History Actions

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/app/console/activities/[id]/seat-layout/page.tsx`
- Modify: `frontend/src/app/console/sessions/[id]/seat-layout/page.tsx`

- [ ] **Step 1: Add API wrapper**

Add to `frontend/src/lib/api.ts`:

```ts
export async function deleteSeatCraftVersion(ownerType: SeatCraftOwnerType, ownerId: number, versionId: number) {
  assertSeatCraftOwner(ownerType, ownerId)
  assertPositiveInteger(versionId, 'SeatCraft 版本ID')
  return request<void>(`/api/ticket/admin/seatcraft/${ownerType}/${ownerId}/versions/${versionId}`, {
    method: 'DELETE',
  })
}
```

- [ ] **Step 2: Add page handlers**

In both Activity and Session pages, import `deleteSeatCraftVersion` and `rollbackSeatCraftVersion`, add handlers that:

```ts
const refreshVersions = () => listSeatCraftVersions('activity', activityId).then(setVersions).catch(() => undefined)
```

For Session, also refresh seats after rollback/delete:

```ts
const refreshSessionSeats = (userId: number) => getSessionSeatLayout(sessionId, userId).then(legacyLayout => setSessionSeats(legacyLayout?.seats ?? sessionSeats)).catch(() => undefined)
```

Rollback handler:

```ts
const handleRollbackVersion = async (version: SeatCraftVersionSummaryVO) => {
  if (!version.id || saving || publishing || creating) return
  setError('')
  setMessage('')
  try {
    const response = await rollbackSeatCraftVersion('activity', activityId, version.id)
    setLayout(toSeatCraftVersionedLayoutDraft(response))
    await refreshVersions()
    setMessage(`已回到 v${version.versionNo ?? '-'}，可继续编辑或发布`)
  } catch (err) {
    setError(err instanceof Error ? err.message : '回到历史版本失败')
  }
}
```

Delete handler:

```ts
const handleDeleteVersion = async (version: SeatCraftVersionSummaryVO) => {
  if (!version.id || version.versionStatus === 'published' || saving || publishing || creating) return
  if (!window.confirm(`确认删除 v${version.versionNo ?? '-'}？删除后不可恢复。`)) return
  setError('')
  setMessage('')
  try {
    await deleteSeatCraftVersion('activity', activityId, version.id)
    await refreshVersions()
    setMessage(`已删除 v${version.versionNo ?? '-'}`)
  } catch (err) {
    setError(err instanceof Error ? err.message : '删除历史版本失败')
  }
}
```

- [ ] **Step 3: Render full list actions**

Update `SeatCraftVersionList` props in both pages:

```ts
function SeatCraftVersionList({ versions, onRollback, onDelete, disabled }: {
  versions: SeatCraftVersionSummaryVO[]
  onRollback: (version: SeatCraftVersionSummaryVO) => void
  onDelete: (version: SeatCraftVersionSummaryVO) => void
  disabled: boolean
})
```

Render all versions in rows, not compact tags. Disable delete for `published`.

- [ ] **Step 4: Run frontend checks**

Run: `pnpm typecheck`

Expected: PASS.

### Task 3: Final Verification

- [ ] Run backend test: `mvn test -pl java-ticket "-Dtest=SeatCraftLayoutVersionServiceTest"`
- [ ] Run frontend typecheck: `pnpm typecheck`
- [ ] Run frontend SeatCraft tests: `node --test --experimental-strip-types --experimental-transform-types --test-name-pattern "versioned|stage|history|binding|ticketGroupKey|primary|secondary|persisted version metadata" "src/components/seatcraft/block-layout.test.ts" "src/components/seatcraft/history.test.ts"`
- [ ] Run whitespace check: `git diff --check -- java/java-ticket/src/main/java/com/omni/ticket/service/SeatCraftLayoutVersionService.java java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java java/java-ticket/src/test/java/com/omni/ticket/service/SeatCraftLayoutVersionServiceTest.java frontend/src/lib/api.ts frontend/src/app/console/activities/[id]/seat-layout/page.tsx frontend/src/app/console/sessions/[id]/seat-layout/page.tsx`

## Self Review

- Spec coverage: plan covers full list display, rollback, delete, safety rule for published versions, and refresh/error behavior.
- Placeholder scan: no TBD/TODO placeholders.
- Type consistency: uses existing `SeatCraftVersionSummaryVO`, `SeatCraftOwnerType`, and versioned layout adapters.
