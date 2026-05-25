# Artist Token Identity Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 清理艺人治理接口中的客户端 `userId` 语义，让前端请求体不再携带操作者 ID，后端控制器显式使用 token subject 构造服务层请求。

**Architecture:** 仅收敛艺人提交、更新、审核、风险标记四个接口的身份来源。Controller 继续从 `Authorization` 解析 operatorId，并把 operatorId 写入服务层 DTO；前端类型和调用点移除 `userId` 字段，避免维护者误以为客户端 ID 有权限含义。

**Tech Stack:** Java Spring Boot、JUnit 5、Mockito、Next.js 16、React 19、TypeScript、pnpm。

---

## Scope Guardrails

- 不修改 `frontend/src/components/seatcraft/**`。
- 不修改 `frontend/src/components/seatcraft-unified/**`。
- 不修改座位图相关 API、座位表交互、SeatCraft 深色 IDE 风格。
- 不修改 `frontend/src/app/console/layout.tsx` 的后台整体视觉风格。
- 不改数据库 schema。
- 不改 internal API token 机制。
- 不清理其他业务 DTO 的 `userId`，例如活动、场次、场馆、退款等。

## File Structure

- Modify: `frontend/src/types/api.ts`
  - 移除 `ArtistSubmissionRequest`、`ArtistUpdateRequest`、`ArtistReviewRequest`、`ArtistRiskRequest` 中的 `userId` 字段。
- Modify: `frontend/src/app/console/artists/pending/page.tsx`
  - 审核和风险标记调用不再传 `userId`。
- Modify: `frontend/src/app/console/artists/[id]/edit/page.tsx`
  - 保存艺人资料时不再传 `userId`。
  - 保留 `uploadTicketAsset({ userId, ... })`，因为上传接口仍要求 token subject 与 query `userId` 一致，且不属于本次艺人治理 DTO 清理。
- Modify: `frontend/src/components/activity-artist/ActivityArtistSelector.tsx`
  - 提交找不到的艺人时不再传 `userId`。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
  - 艺人相关端点不再通过 `request.setUserId(operatorId)` 覆盖客户端字段。
  - Controller 新建带 operatorId 的服务层 DTO，避免依赖客户端请求体携带身份字段。
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java`
  - 更新测试，验证 Controller 委托给服务层的 DTO 使用 token subject，并且请求体无需 `userId`。

---

### Task 1: 前端类型和调用点移除艺人 `userId`

**Files:**
- Modify: `frontend/src/types/api.ts:143-179`
- Modify: `frontend/src/app/console/artists/pending/page.tsx`
- Modify: `frontend/src/app/console/artists/[id]/edit/page.tsx`
- Modify: `frontend/src/components/activity-artist/ActivityArtistSelector.tsx`

- [ ] **Step 1: 修改前端类型**

在 `frontend/src/types/api.ts` 中把四个艺人请求类型改为：

```ts
export interface ArtistSubmissionRequest {
  name: string
  alias?: string | null
  artistType?: string | null
  countryOrRegion?: string | null
  agency?: string | null
  representativeWorks?: string | null
  categoryTags?: string | null
  description?: string | null
  sourceNote?: string | null
}

export interface ArtistUpdateRequest {
  name: string
  alias?: string | null
  artistType?: string | null
  countryOrRegion?: string | null
  agency?: string | null
  representativeWorks?: string | null
  categoryTags?: string | null
  description?: string | null
  avatar?: string | null
}

export interface ArtistReviewRequest {
  action: 'approve' | 'reject'
  note?: string | null
}

export interface ArtistRiskRequest {
  riskStatus: ArtistRiskStatus
  reason?: string | null
}
```

- [ ] **Step 2: 修改待审核页调用**

在 `frontend/src/app/console/artists/pending/page.tsx` 中把审核调用改为：

```ts
await reviewAdminArtist(artistId, { action, note: note.trim() || null })
```

把风险标记调用改为：

```ts
await updateAdminArtistRisk(artistId, { riskStatus: 'risky', reason })
```

- [ ] **Step 3: 修改艺人编辑页调用**

在 `frontend/src/app/console/artists/[id]/edit/page.tsx` 中，`updateAdminArtist` 请求体保留业务字段，移除 `userId: user.id`：

```ts
const updated = await updateAdminArtist(artist.id, {
  name: form.name.trim(),
  alias: emptyToNull(form.alias),
  artistType: emptyToNull(form.artistType),
  countryOrRegion: emptyToNull(form.countryOrRegion),
  agency: emptyToNull(form.agency),
  representativeWorks: emptyToNull(form.representativeWorks),
  categoryTags: emptyToNull(form.categoryTags),
  description: emptyToNull(form.description),
  avatar: emptyToNull(form.avatar),
})
```

不要修改同文件中的上传调用：

```ts
uploadTicketAsset({ userId: user.id, bizType: 'artist-avatar', file })
```

- [ ] **Step 4: 修改活动艺人选择器提交调用**

在 `frontend/src/components/activity-artist/ActivityArtistSelector.tsx` 中把提交调用改为：

```ts
await submitAdminArtist({ name, sourceNote: '活动表单搜索不到时提交' })
```

- [ ] **Step 5: 运行前端类型检查**

Run: `pnpm typecheck`

Workdir: `C:\Users\Administrator\Desktop\omni\frontend`

Expected: `tsc --noEmit` 通过，无 `userId` 缺失类型错误。

---

### Task 2: 后端 Controller 显式构造服务层身份 DTO

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java:216-285`
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java:627-831`

- [ ] **Step 1: 添加 Controller 私有构造方法**

在 `AdminController` 艺人接口附近添加四个私有方法，用于把 token subject 写入服务层 DTO，同时复制请求体业务字段。

```java
private ArtistSubmissionRequest toServiceArtistSubmissionRequest(Long operatorId, ArtistSubmissionRequest source) {
    ArtistSubmissionRequest target = new ArtistSubmissionRequest();
    target.setUserId(operatorId);
    if (source == null) return target;
    target.setName(source.getName());
    target.setAlias(source.getAlias());
    target.setArtistType(source.getArtistType());
    target.setCountryOrRegion(source.getCountryOrRegion());
    target.setAgency(source.getAgency());
    target.setRepresentativeWorks(source.getRepresentativeWorks());
    target.setCategoryTags(source.getCategoryTags());
    target.setDescription(source.getDescription());
    target.setSourceNote(source.getSourceNote());
    return target;
}

private ArtistUpdateRequest toServiceArtistUpdateRequest(Long operatorId, ArtistUpdateRequest source) {
    ArtistUpdateRequest target = new ArtistUpdateRequest();
    target.setUserId(operatorId);
    if (source == null) return target;
    target.setName(source.getName());
    target.setAlias(source.getAlias());
    target.setArtistType(source.getArtistType());
    target.setCountryOrRegion(source.getCountryOrRegion());
    target.setAgency(source.getAgency());
    target.setRepresentativeWorks(source.getRepresentativeWorks());
    target.setCategoryTags(source.getCategoryTags());
    target.setDescription(source.getDescription());
    target.setAvatar(source.getAvatar());
    return target;
}

private ArtistReviewRequest toServiceArtistReviewRequest(Long operatorId, ArtistReviewRequest source) {
    ArtistReviewRequest target = new ArtistReviewRequest();
    target.setUserId(operatorId);
    if (source == null) return target;
    target.setAction(source.getAction());
    target.setNote(source.getNote());
    return target;
}

private ArtistRiskRequest toServiceArtistRiskRequest(Long operatorId, ArtistRiskRequest source) {
    ArtistRiskRequest target = new ArtistRiskRequest();
    target.setUserId(operatorId);
    if (source == null) return target;
    target.setRiskStatus(source.getRiskStatus());
    target.setReason(source.getReason());
    return target;
}
```

- [ ] **Step 2: 修改四个艺人端点使用服务层 DTO**

把 `submitArtist` 中的请求处理替换为：

```java
ArtistSubmissionRequest serviceRequest = toServiceArtistSubmissionRequest(operatorId, request);
return Result.success(artistGovernanceService.submit(serviceRequest));
```

把 `updateArtist` 中的请求处理替换为：

```java
ArtistUpdateRequest serviceRequest = toServiceArtistUpdateRequest(operatorId, request);
return Result.success(artistGovernanceService.updateProfile(id, serviceRequest));
```

把 `reviewArtist` 中的请求处理替换为：

```java
ArtistReviewRequest serviceRequest = toServiceArtistReviewRequest(operatorId, request);
return Result.success(artistGovernanceService.review(id, serviceRequest));
```

把 `updateArtistRisk` 中的请求处理替换为：

```java
ArtistRiskRequest serviceRequest = toServiceArtistRiskRequest(operatorId, request);
return Result.success(artistGovernanceService.updateRisk(id, serviceRequest));
```

- [ ] **Step 3: 更新 Controller 测试断言**

在 `AdminControllerTest` 中，使用 `ArgumentCaptor` 捕获服务层 DTO，而不是断言原始请求体被原地覆盖。

`submitArtistDelegatesToGovernanceService` 的核心断言改为：

```java
ArgumentCaptor<ArtistSubmissionRequest> captor = ArgumentCaptor.forClass(ArtistSubmissionRequest.class);
verify(artistGovernanceService).submit(captor.capture());
assertEquals(2002L, captor.getValue().getUserId());
assertEquals("新艺人", captor.getValue().getName());
```

`updateArtistDelegatesToGovernanceService` 的核心断言改为：

```java
ArgumentCaptor<ArtistUpdateRequest> captor = ArgumentCaptor.forClass(ArtistUpdateRequest.class);
verify(artistGovernanceService).updateProfile(eq(99L), captor.capture());
assertEquals(2002L, captor.getValue().getUserId());
assertEquals("更新艺人", captor.getValue().getName());
```

`reviewArtistDelegatesToGovernanceService` 的核心断言改为：

```java
ArgumentCaptor<ArtistReviewRequest> captor = ArgumentCaptor.forClass(ArtistReviewRequest.class);
verify(artistGovernanceService).review(eq(99L), captor.capture());
assertEquals(2002L, captor.getValue().getUserId());
assertEquals("approve", captor.getValue().getAction());
```

`updateArtistRiskDelegatesToGovernanceService` 的核心断言改为：

```java
ArgumentCaptor<ArtistRiskRequest> captor = ArgumentCaptor.forClass(ArtistRiskRequest.class);
verify(artistGovernanceService).updateRisk(eq(99L), captor.capture());
assertEquals(2002L, captor.getValue().getUserId());
assertEquals("risky", captor.getValue().getRiskStatus());
assertEquals("风险原因", captor.getValue().getReason());
```

- [ ] **Step 4: 运行后端 Controller 测试**

Run: `mvn test -pl java-ticket -Dtest=AdminControllerTest`

Workdir: `C:\Users\Administrator\Desktop\omni\java`

Expected: `BUILD SUCCESS`，`AdminControllerTest` 全部通过。

---

### Task 3: 验证艺人治理服务和微服务边界

**Files:**
- No code changes.

- [ ] **Step 1: 运行艺人治理服务测试**

Run: `mvn test -pl java-ticket -Dtest=ArtistGovernanceServiceTest`

Workdir: `C:\Users\Administrator\Desktop\omni\java`

Expected: `BUILD SUCCESS`。

- [ ] **Step 2: 运行前端类型检查**

Run: `pnpm typecheck`

Workdir: `C:\Users\Administrator\Desktop\omni\frontend`

Expected: `tsc --noEmit` 通过。

- [ ] **Step 3: 运行限定文件空白检查**

Run:

```powershell
git diff --check -- "frontend/src/types/api.ts" "frontend/src/app/console/artists/pending/page.tsx" "frontend/src/app/console/artists/[id]/edit/page.tsx" "frontend/src/components/activity-artist/ActivityArtistSelector.tsx" "java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java" "java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java"
```

Workdir: `C:\Users\Administrator\Desktop\omni`

Expected: 无本次文件的 trailing whitespace 报错。PowerShell 可能显示 LF/CRLF warning，可接受。

- [ ] **Step 4: 运行微服务边界检查**

Run: `powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1`

Workdir: `C:\Users\Administrator\Desktop\omni`

Expected: `All microservice boundary checks passed.`

---

## Self-Review

- Spec coverage: 本计划覆盖前端艺人 DTO、四个前端调用点、后端四个艺人端点、Controller 测试和边界验证。
- Placeholder scan: 未使用 TBD/TODO/稍后实现等占位描述。
- Type consistency: 前端请求类型移除 `userId`；后端服务层 DTO 仍保留 `userId`，由 Controller 私有构造方法填充，和现有 `ArtistGovernanceService` 签名一致。
