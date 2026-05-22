# Local Asset Upload Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working slice of local uploads: service-owned asset tables, local file storage, user avatar upload, ticket admin asset upload, and frontend upload controls for avatar and Tour poster.

**Architecture:** Keep ownership inside existing services. `java-user` writes `user_asset` in `omni_user`; `java-ticket` writes `ticket_asset` in `omni_ticket_split`; files live under `OMNI_UPLOAD_ROOT`; existing business fields keep storing `/uploads/...` public URLs.

**Tech Stack:** Spring Boot 2.7, MyBatis-Plus, PostgreSQL, multipart upload, Next.js 16, React 19, TypeScript.

---

## Scope

This phase implements upload infrastructure and the smallest UI integrations. It does not implement activity purchase limits or partial refunds; those affect order/payment/ticket inventory and need separate plans.

## Files

- Create `sql/migrations/shared/20260522_user_asset_upload.sql` and `sql/production-split/user/20260522_user_asset_upload.sql`.
- Create `sql/migrations/shared/20260522_ticket_asset_upload.sql` and `sql/production-split/ticket/20260522_ticket_asset_upload.sql`.
- Create `java/java-user/src/main/java/com/omni/user/entity/UserAsset.java`.
- Create `java/java-user/src/main/java/com/omni/user/mapper/UserAssetMapper.java`.
- Create `java/java-user/src/main/java/com/omni/user/dto/AssetUploadResponse.java`.
- Create `java/java-user/src/main/java/com/omni/user/config/UploadStaticResourceConfig.java`.
- Create `java/java-user/src/main/java/com/omni/user/service/UserAssetService.java`.
- Modify `java/java-user/src/main/java/com/omni/user/controller/UserController.java`.
- Create `java/java-user/src/test/java/com/omni/user/service/UserAssetServiceTest.java`.
- Create `java/java-ticket/src/main/java/com/omni/ticket/entity/TicketAsset.java`.
- Create `java/java-ticket/src/main/java/com/omni/ticket/mapper/TicketAssetMapper.java`.
- Create `java/java-ticket/src/main/java/com/omni/ticket/dto/AssetUploadResponse.java`.
- Create `java/java-ticket/src/main/java/com/omni/ticket/config/UploadStaticResourceConfig.java`.
- Create `java/java-ticket/src/main/java/com/omni/ticket/service/TicketAssetService.java`.
- Modify `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`.
- Create `java/java-ticket/src/test/java/com/omni/ticket/service/TicketAssetServiceTest.java`.
- Modify `frontend/src/types/api.ts`.
- Modify `frontend/src/lib/api.ts`.
- Create `frontend/src/components/LocalFileUpload.tsx`.
- Modify `frontend/src/app/profile/account/page.tsx`.
- Modify `frontend/src/app/console/tours/new/page.tsx`.

---

## Task 1: Asset Schema

**Files:** SQL files listed above.

- [ ] **Step 1: Add user asset migrations**

Create both user SQL files with this content. The production split file must include the owner comment.

```sql
-- owner: java-user

CREATE TABLE IF NOT EXISTS user_asset (
    id BIGSERIAL PRIMARY KEY,
    uploader_id BIGINT NOT NULL,
    biz_type VARCHAR(64) NOT NULL,
    original_name VARCHAR(255),
    stored_name VARCHAR(255) NOT NULL,
    relative_path VARCHAR(500) NOT NULL,
    public_url VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    sha256 VARCHAR(128),
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_asset_uploader ON user_asset(uploader_id);
CREATE INDEX IF NOT EXISTS idx_user_asset_biz_type ON user_asset(biz_type);
```

For the shared migration, omit only `-- owner: java-user`.

- [ ] **Step 2: Add ticket asset migrations**

Create both ticket SQL files with this content. The production split file must include the owner comment.

```sql
-- owner: java-ticket

CREATE TABLE IF NOT EXISTS ticket_asset (
    id BIGSERIAL PRIMARY KEY,
    uploader_id BIGINT NOT NULL,
    biz_type VARCHAR(64) NOT NULL,
    original_name VARCHAR(255),
    stored_name VARCHAR(255) NOT NULL,
    relative_path VARCHAR(500) NOT NULL,
    public_url VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    sha256 VARCHAR(128),
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ticket_asset_uploader ON ticket_asset(uploader_id);
CREATE INDEX IF NOT EXISTS idx_ticket_asset_biz_type ON ticket_asset(biz_type);
```

For the shared migration, omit only `-- owner: java-ticket`.

- [ ] **Step 3: Verify SQL safety**

Run: `powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1`

Expected: `PASS production split SQL safety check`.

- [ ] **Step 4: Apply local migrations**

Run:

```powershell
$env:PGPASSWORD='123456'; $env:PGCLIENTENCODING='UTF8'; psql -v ON_ERROR_STOP=1 -h localhost -p 5432 -U postgres -d omni_user -f sql/production-split/user/20260522_user_asset_upload.sql
$env:PGPASSWORD='123456'; $env:PGCLIENTENCODING='UTF8'; psql -v ON_ERROR_STOP=1 -h localhost -p 5432 -U postgres -d omni_ticket_split -f sql/production-split/ticket/20260522_ticket_asset_upload.sql
```

Expected: tables and indexes created or already exist.

- [ ] **Step 5: Commit**

Run: `git add sql/migrations/shared/20260522_user_asset_upload.sql sql/production-split/user/20260522_user_asset_upload.sql sql/migrations/shared/20260522_ticket_asset_upload.sql sql/production-split/ticket/20260522_ticket_asset_upload.sql && git commit -m "feat: add local asset schema"`

---

## Task 2: User Avatar Upload Backend

**Files:** user entity, mapper, DTO, config, service, controller, service test.

- [ ] **Step 1: Write failing service tests**

Create `UserAssetServiceTest` with tests for image upload success, non-image rejection, and oversized file rejection. Use `MockMultipartFile` and a temporary upload root from `java.nio.file.Files.createTempDirectory`.

Expected tests before implementation: compile fails because `UserAssetService` does not exist.

- [ ] **Step 2: Add user asset entity, mapper, and DTO**

Implement fields matching `user_asset`. `AssetUploadResponse` must expose `id`, `bizType`, `publicUrl`, `originalName`, `mimeType`, and `sizeBytes`.

- [ ] **Step 3: Implement `UserAssetService`**

Rules:

- Only accepts `image/jpeg`, `image/png`, `image/webp`, and `image/gif`.
- Max size is 2 MB.
- Writes under `<uploadRoot>/user/avatar/YYYY/MM/<uuid>.<ext>`.
- Public URL is `/uploads/user/avatar/YYYY/MM/<uuid>.<ext>`.
- Inserts `user_asset`.
- Updates `user.avatar` via `UserMapper.updateById` or an update wrapper.
- Returns `UserInfoResponse` for the updated user.

- [ ] **Step 4: Add static resource mapping**

`UploadStaticResourceConfig` maps `/uploads/**` to `file:${OMNI_UPLOAD_ROOT}/`. Default root is `${user.dir}/../runtime/uploads` when the env/config value is empty.

- [ ] **Step 5: Add controller endpoint**

Add to `UserController`:

```text
POST /api/user/assets/avatar
Authorization: Bearer <token>
multipart field: file
```

The controller must call `requireAuthUserId(authorization)` and then `userAssetService.uploadAvatar(userId, file)`.

- [ ] **Step 6: Run tests**

Run from `java`: `mvn -pl java-user "-Dtest=UserAssetServiceTest" test`

Expected: tests pass.

- [ ] **Step 7: Commit**

Run: `git add java/java-user && git commit -m "feat: upload user avatars locally"`

---

## Task 3: Ticket Admin Asset Upload Backend

**Files:** ticket entity, mapper, DTO, config, service, controller, service test.

- [ ] **Step 1: Write failing service tests**

Create `TicketAssetServiceTest` with tests for `activity-poster` image success, `venue-proof` PDF success, unsupported `bizType` rejection, and invalid file type rejection.

Expected before implementation: compile fails because `TicketAssetService` does not exist.

- [ ] **Step 2: Add ticket asset entity, mapper, and DTO**

Implement fields matching `ticket_asset`. Reuse the same DTO shape as user service, but keep it in the ticket package.

- [ ] **Step 3: Implement `TicketAssetService`**

Rules:

- Allowed biz types: `activity-poster`, `tour-poster`, `station-poster`, `artist-avatar`, `venue-proof`.
- Poster/avatar biz types accept images only.
- `venue-proof` accepts images and `application/pdf`.
- Image max size is 5 MB; proof max size is 10 MB.
- Writes under `<uploadRoot>/ticket/<bizType>/YYYY/MM/<uuid>.<ext>`.
- Public URL is `/uploads/ticket/<bizType>/YYYY/MM/<uuid>.<ext>`.
- Calls `UserAccessService.requireAdminOrOrganizer(userId)` if such helper exists; otherwise use the existing role-checking pattern in `AdminController` before calling the service.

- [ ] **Step 4: Add static resource mapping**

Same `/uploads/**` mapping as user service.

- [ ] **Step 5: Add controller endpoint**

Add to `AdminController`:

```text
POST /api/ticket/admin/assets
multipart fields: userId, bizType, file
```

Validate `userId` with existing role logic. Return `Result<AssetUploadResponse>`.

- [ ] **Step 6: Run tests**

Run from `java`: `mvn -pl java-ticket "-Dtest=TicketAssetServiceTest,AdminControllerTest" test`

Expected: tests pass.

- [ ] **Step 7: Commit**

Run: `git add java/java-ticket && git commit -m "feat: upload ticket assets locally"`

---

## Task 4: Frontend Upload API and Control

**Files:** `frontend/src/types/api.ts`, `frontend/src/lib/api.ts`, `frontend/src/components/LocalFileUpload.tsx`.

- [ ] **Step 1: Add `AssetUploadVO` type**

Add:

```ts
export interface AssetUploadVO {
  id: number
  bizType: string
  publicUrl: string
  originalName: string | null
  mimeType: string
  sizeBytes: number
}
```

- [ ] **Step 2: Add multipart request helper**

In `api.ts`, add a helper that does not force `Content-Type: application/json` for `FormData`. It must still send `Authorization` when token exists and parse `ApiResult<T>`.

- [ ] **Step 3: Add upload API functions**

Add:

```ts
export async function uploadUserAvatar(file: File) { ... }
export async function uploadTicketAsset(params: { userId: number; bizType: string; file: File }) { ... }
```

Use this shape:

```ts
export async function uploadUserAvatar(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return multipartRequest<UserInfo>('/api/user/assets/avatar', formData)
}

export async function uploadTicketAsset(params: { userId: number; bizType: string; file: File }) {
  const formData = new FormData()
  formData.append('userId', String(params.userId))
  formData.append('bizType', params.bizType)
  formData.append('file', params.file)
  return multipartRequest<AssetUploadVO>('/api/ticket/admin/assets', formData)
}
```

- [ ] **Step 4: Add `LocalFileUpload` component**

Props:

```ts
type LocalFileUploadProps = {
  label: string
  value: string
  accept: string
  uploading: boolean
  onUpload: (file: File) => Promise<string>
  onChange: (url: string) => void
  hint?: string
}
```

Behavior: choose file, call `onUpload`, set returned URL, show preview for images, show errors inline.

- [ ] **Step 5: Run typecheck**

Run from `frontend`: `pnpm typecheck`

Expected: passes.

- [ ] **Step 6: Commit**

Run: `git add frontend/src/types/api.ts frontend/src/lib/api.ts frontend/src/components/LocalFileUpload.tsx && git commit -m "feat: add frontend upload control"`

---

## Task 5: Frontend Avatar and Tour Poster Integration

**Files:** `frontend/src/app/profile/account/page.tsx`, `frontend/src/app/console/tours/new/page.tsx`.

- [ ] **Step 1: Replace avatar URL field**

In account settings, replace the `头像地址` text field with `LocalFileUpload`. On upload call `uploadUserAvatar(file)`, update `form.avatar` from returned user avatar or asset public URL, and call `updateStoredUser({ nickname: next.nickname || null })` after saving profile.

- [ ] **Step 2: Replace Tour poster URL field**

In new Tour page, replace `主海报 URL` input with `LocalFileUpload`. On upload call `uploadTicketAsset({ userId: user.userId, bizType: 'tour-poster', file })` and set `poster` to `publicUrl`.

- [ ] **Step 3: Run frontend verification**

Run from `frontend`: `pnpm typecheck`

Expected: passes.

- [ ] **Step 4: Commit**

Run: `git add frontend/src/app/profile/account/page.tsx frontend/src/app/console/tours/new/page.tsx && git commit -m "feat: use local uploads for avatar and tour poster"`

---

## Task 6: Final Verification

- [ ] **Step 1: Backend tests**

Run from `java`:

```powershell
mvn test -pl java-user,java-ticket -am
```

Expected: build success.

- [ ] **Step 2: Frontend typecheck**

Run from `frontend`: `pnpm typecheck`

Expected: passes.

- [ ] **Step 3: Boundary and SQL checks**

Run from repo root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-production-split-sql.ps1
git diff --check
```

Expected: all pass; `git diff --check` has no whitespace errors.

- [ ] **Step 4: Manual smoke test after user restarts services**

Use browser:

- Upload avatar in `/profile/account`, save, refresh `/profile`, confirm avatar persists.
- Upload Tour poster in `/console/tours/new`, create Tour, confirm poster path is `/uploads/ticket/tour-poster/...`.
- Confirm files exist under `runtime/uploads` or configured `OMNI_UPLOAD_ROOT`.

- [ ] **Step 5: Final commit if needed**

If Task 6 changed docs or scripts, commit them with `chore: verify local asset uploads`.

---

## Self-Review

- Spec coverage: phase 1 covers local upload roots, `user_asset`, `ticket_asset`, user avatar upload, ticket admin asset upload, and replacing two URL fields. Purchase limits and partial refunds intentionally remain separate plans.
- Placeholder scan: no `TBD`, no unspecified implementation step, and each task has explicit files and commands.
- Type consistency: `AssetUploadResponse` backend maps to `AssetUploadVO` frontend; public URL field is consistently `publicUrl`; upload root is consistently `OMNI_UPLOAD_ROOT`.
