# Artist Avatar Edit Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an artist detail/edit page with an `artist-avatar` upload entry, allowing admins to edit any artist and organizers to edit only their own pending submissions.

**Architecture:** Reuse the existing ticket-owned artist table and ticket asset upload endpoint. Add a focused artist update DTO and governance service method for authorization and persistence, then add a console edit page that loads artist detail, uploads avatar through `LocalFileUpload`, and saves profile fields through a new API wrapper.

**Tech Stack:** Java Spring Boot, MyBatis-Plus, PostgreSQL existing schema, Next.js 16, React 19, TypeScript, existing `request<T>()`, `LocalFileUpload`, and `uploadTicketAsset()` helpers.

---

## File Map

- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/ArtistUpdateRequest.java`
  - Request DTO for editable artist profile fields and operator `userId`.
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/ArtistGovernanceService.java`
  - Add `updateProfile(Long artistId, ArtistUpdateRequest request)` with admin/all and organizer/self-pending authorization.
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
  - Add `PUT /api/ticket/admin/artists/{id}` endpoint delegating to governance service.
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/ArtistGovernanceServiceTest.java`
  - Add unit coverage for admin edit, organizer self-pending edit, organizer approved edit rejection, organizer other-user edit rejection, and blank name validation.
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java`
  - Add controller delegation test for artist profile update.
- Modify: `frontend/src/types/api.ts`
  - Add `ArtistUpdateRequest` TypeScript interface.
- Modify: `frontend/src/lib/api.ts`
  - Add `updateAdminArtist(id, params)` wrapper.
- Create: `frontend/src/app/console/artists/[id]/edit/page.tsx`
  - New artist detail/edit page with avatar upload and profile form.
- Modify: `frontend/src/app/console/artists/pending/page.tsx`
  - Add “编辑资料” link for each pending artist.

---

## Task 1: Backend Artist Update Contract

**Files:**
- Create: `java/java-ticket/src/main/java/com/omni/ticket/dto/ArtistUpdateRequest.java`
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/service/ArtistGovernanceServiceTest.java`
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/ArtistGovernanceService.java`

- [ ] **Step 1: Create update request DTO**

Create `java/java-ticket/src/main/java/com/omni/ticket/dto/ArtistUpdateRequest.java`:

```java
package com.omni.ticket.dto;

public class ArtistUpdateRequest {
    private Long userId;
    private String name;
    private String alias;
    private String artistType;
    private String countryOrRegion;
    private String agency;
    private String representativeWorks;
    private String categoryTags;
    private String description;
    private String avatar;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getAlias() { return alias; }
    public void setAlias(String alias) { this.alias = alias; }
    public String getArtistType() { return artistType; }
    public void setArtistType(String artistType) { this.artistType = artistType; }
    public String getCountryOrRegion() { return countryOrRegion; }
    public void setCountryOrRegion(String countryOrRegion) { this.countryOrRegion = countryOrRegion; }
    public String getAgency() { return agency; }
    public void setAgency(String agency) { this.agency = agency; }
    public String getRepresentativeWorks() { return representativeWorks; }
    public void setRepresentativeWorks(String representativeWorks) { this.representativeWorks = representativeWorks; }
    public String getCategoryTags() { return categoryTags; }
    public void setCategoryTags(String categoryTags) { this.categoryTags = categoryTags; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getAvatar() { return avatar; }
    public void setAvatar(String avatar) { this.avatar = avatar; }
}
```

- [ ] **Step 2: Add failing service tests**

In `java/java-ticket/src/test/java/com/omni/ticket/service/ArtistGovernanceServiceTest.java`, add import:

```java
import com.omni.ticket.dto.ArtistUpdateRequest;
```

Add these tests before `private ArtistGovernanceService service()`:

```java
    @Test
    void adminCanUpdateAnyArtistProfile() {
        ArtistGovernanceService service = service();
        Artist artist = artist(99L);
        artist.setSubmittedBy(2003L);
        artist.setReviewStatus("approved");
        when(userAccessService.requireAdminOrOrganizer(2002L)).thenReturn(user(2002L, "admin"));
        when(artistMapper.selectById(99L)).thenReturn(artist);
        ArtistUpdateRequest request = updateRequest(2002L);
        request.setName("更新艺人");
        request.setAvatar("/uploads/ticket/artist-avatar/2026/05/a.png");

        Artist updated = service.updateProfile(99L, request);

        assertEquals("更新艺人", updated.getName());
        assertEquals("/uploads/ticket/artist-avatar/2026/05/a.png", updated.getAvatar());
        assertEquals("歌手", updated.getArtistType());
        assertNotNull(updated.getUpdateTime());
        verify(artistMapper).updateById(artist);
    }

    @Test
    void organizerCanUpdateOwnPendingArtistProfile() {
        ArtistGovernanceService service = service();
        Artist artist = artist(99L);
        artist.setSubmittedBy(2003L);
        artist.setReviewStatus("pending");
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(artistMapper.selectById(99L)).thenReturn(artist);
        ArtistUpdateRequest request = updateRequest(2003L);
        request.setName("主办方补充艺人");

        Artist updated = service.updateProfile(99L, request);

        assertEquals("主办方补充艺人", updated.getName());
        assertEquals(2003L, updated.getSubmittedBy());
        verify(artistMapper).updateById(artist);
    }

    @Test
    void organizerCannotUpdateApprovedArtistProfile() {
        ArtistGovernanceService service = service();
        Artist artist = artist(99L);
        artist.setSubmittedBy(2003L);
        artist.setReviewStatus("approved");
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(artistMapper.selectById(99L)).thenReturn(artist);
        ArtistUpdateRequest request = updateRequest(2003L);

        BusinessException exception = assertThrows(BusinessException.class, () -> service.updateProfile(99L, request));

        assertEquals("只能编辑自己提交且待审核的艺人档案", exception.getMessage());
    }

    @Test
    void organizerCannotUpdateOtherUsersPendingArtistProfile() {
        ArtistGovernanceService service = service();
        Artist artist = artist(99L);
        artist.setSubmittedBy(2004L);
        artist.setReviewStatus("pending");
        when(userAccessService.requireAdminOrOrganizer(2003L)).thenReturn(user(2003L, "organizer"));
        when(artistMapper.selectById(99L)).thenReturn(artist);
        ArtistUpdateRequest request = updateRequest(2003L);

        BusinessException exception = assertThrows(BusinessException.class, () -> service.updateProfile(99L, request));

        assertEquals("只能编辑自己提交且待审核的艺人档案", exception.getMessage());
    }

    @Test
    void updateArtistProfileRequiresName() {
        ArtistGovernanceService service = service();
        ArtistUpdateRequest request = updateRequest(2002L);
        request.setName(" ");

        BusinessException exception = assertThrows(BusinessException.class, () -> service.updateProfile(99L, request));

        assertEquals("艺人/团队名称不能为空", exception.getMessage());
    }

    private ArtistUpdateRequest updateRequest(Long userId) {
        ArtistUpdateRequest request = new ArtistUpdateRequest();
        request.setUserId(userId);
        request.setName("测试艺人");
        request.setAlias("别名");
        request.setArtistType("歌手");
        request.setCountryOrRegion("中国");
        request.setAgency("经纪公司");
        request.setRepresentativeWorks("代表作");
        request.setCategoryTags("流行");
        request.setDescription("简介");
        request.setAvatar("/uploads/ticket/artist-avatar/2026/05/default.png");
        return request;
    }
```

- [ ] **Step 3: Run service test to verify failure**

Run from `C:\Users\Administrator\Desktop\omni\java`:

```powershell
mvn test -pl java-ticket -Dtest=ArtistGovernanceServiceTest
```

Expected: compilation fails because `ArtistGovernanceService.updateProfile()` does not exist.

- [ ] **Step 4: Implement service method**

In `java/java-ticket/src/main/java/com/omni/ticket/service/ArtistGovernanceService.java`, add import:

```java
import com.omni.ticket.dto.ArtistUpdateRequest;
```

Add this method after `submit(...)` and before `listPending(...)`:

```java
    public Artist updateProfile(Long artistId, ArtistUpdateRequest request) {
        if (request == null || request.getUserId() == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "艺人更新参数不能为空");
        }
        if (!StringUtils.hasText(request.getName())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "艺人/团队名称不能为空");
        }
        Artist artist = requireArtist(artistId);
        String role = null;
        InternalUserRefResponse user = userAccessService.requireAdminOrOrganizer(request.getUserId());
        if (user != null) {
            role = user.getRole();
        }
        boolean admin = "admin".equals(role);
        boolean ownPending = request.getUserId().equals(artist.getSubmittedBy()) && REVIEW_PENDING.equals(artist.getReviewStatus());
        if (!admin && !ownPending) {
            throw new BusinessException(ResultCode.FORBIDDEN, "只能编辑自己提交且待审核的艺人档案");
        }
        LocalDateTime now = LocalDateTime.now();
        artist.setName(request.getName().trim());
        artist.setAlias(trimToNull(request.getAlias()));
        artist.setArtistType(trimToNull(request.getArtistType()));
        artist.setCountryOrRegion(trimToNull(request.getCountryOrRegion()));
        artist.setAgency(trimToNull(request.getAgency()));
        artist.setRepresentativeWorks(trimToNull(request.getRepresentativeWorks()));
        artist.setCategoryTags(trimToNull(request.getCategoryTags()));
        artist.setDescription(trimToNull(request.getDescription()));
        artist.setAvatar(trimToNull(request.getAvatar()));
        artist.setUpdateTime(now);
        artistMapper.updateById(artist);
        return artist;
    }
```

- [ ] **Step 5: Run service test to verify pass**

Run from `C:\Users\Administrator\Desktop\omni\java`:

```powershell
mvn test -pl java-ticket -Dtest=ArtistGovernanceServiceTest
```

Expected: `BUILD SUCCESS`; all `ArtistGovernanceServiceTest` tests pass.

- [ ] **Step 6: Commit backend service contract**

Run from repository root `C:\Users\Administrator\Desktop\omni`:

```powershell
git add java/java-ticket/src/main/java/com/omni/ticket/dto/ArtistUpdateRequest.java java/java-ticket/src/main/java/com/omni/ticket/service/ArtistGovernanceService.java java/java-ticket/src/test/java/com/omni/ticket/service/ArtistGovernanceServiceTest.java
git commit -m "feat: update artist profile data"
```

---

## Task 2: Backend Artist Update Endpoint

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java`

- [ ] **Step 1: Add failing controller delegation test**

In `java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java`, add import:

```java
import com.omni.ticket.dto.ArtistUpdateRequest;
```

Add this test after `submitArtistDelegatesToGovernanceService()`:

```java
    @Test
    void updateArtistDelegatesToGovernanceService() {
        AdminController controller = controller();
        ArtistUpdateRequest request = new ArtistUpdateRequest();
        request.setUserId(2003L);
        request.setName("更新艺人");
        Artist artist = new Artist();
        artist.setId(99L);
        artist.setName("更新艺人");
        when(artistGovernanceService.updateProfile(99L, request)).thenReturn(artist);

        Result<Artist> result = controller.updateArtist(99L, request);

        assertEquals(200, result.getCode());
        assertEquals("更新艺人", result.getData().getName());
        verify(artistGovernanceService).updateProfile(99L, request);
    }
```

- [ ] **Step 2: Run controller test to verify failure**

Run from `C:\Users\Administrator\Desktop\omni\java`:

```powershell
mvn test -pl java-ticket -Dtest=AdminControllerTest
```

Expected: compilation fails because `AdminController.updateArtist()` does not exist.

- [ ] **Step 3: Implement controller endpoint**

In `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`, add import:

```java
import com.omni.ticket.dto.ArtistUpdateRequest;
```

Add this method after `submitArtist(...)` and before `listPendingArtists(...)`:

```java
    @PutMapping("/artists/{id}")
    public Result<Artist> updateArtist(@PathVariable Long id, @RequestBody ArtistUpdateRequest request) {
        return Result.success(artistGovernanceService.updateProfile(id, request));
    }
```

- [ ] **Step 4: Run controller test to verify pass**

Run from `C:\Users\Administrator\Desktop\omni\java`:

```powershell
mvn test -pl java-ticket -Dtest=AdminControllerTest
```

Expected: `BUILD SUCCESS`; all `AdminControllerTest` tests pass.

- [ ] **Step 5: Commit backend endpoint**

Run from repository root `C:\Users\Administrator\Desktop\omni`:

```powershell
git add java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java
git commit -m "feat: expose artist profile update endpoint"
```

---

## Task 3: Frontend API Types And Wrapper

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add TypeScript request type**

In `frontend/src/types/api.ts`, add this interface after `ArtistSubmissionRequest`:

```ts
export interface ArtistUpdateRequest {
  userId: number
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
```

- [ ] **Step 2: Add API wrapper**

In `frontend/src/lib/api.ts`, add this function after `getAdminArtist(...)`:

```ts
export async function updateAdminArtist(id: number, params: import('@/types/api').ArtistUpdateRequest) {
  assertPositiveInteger(id, 'artistId')
  return request<import('@/types/api').ArtistEntity>(`/api/ticket/admin/artists/${id}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  })
}
```

- [ ] **Step 3: Run frontend typecheck**

Run from `C:\Users\Administrator\Desktop\omni\frontend`:

```powershell
pnpm typecheck
```

Expected: `tsc --noEmit` succeeds.

- [ ] **Step 4: Commit frontend API contract**

Run from repository root `C:\Users\Administrator\Desktop\omni`:

```powershell
git add frontend/src/types/api.ts frontend/src/lib/api.ts
git commit -m "feat: add artist update API client"
```

---

## Task 4: Artist Detail/Edit Page With Avatar Upload

**Files:**
- Create: `frontend/src/app/console/artists/[id]/edit/page.tsx`

- [ ] **Step 1: Create edit page**

Create `frontend/src/app/console/artists/[id]/edit/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { getAdminArtist, getUserInfo, updateAdminArtist, uploadTicketAsset } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'
import { LocalFileUpload } from '@/components/LocalFileUpload'
import type { ArtistEntity, UserInfo } from '@/types/api'

type FormState = {
  name: string
  alias: string
  artistType: string
  countryOrRegion: string
  agency: string
  representativeWorks: string
  categoryTags: string
  description: string
  avatar: string
}

const EMPTY_FORM: FormState = {
  name: '',
  alias: '',
  artistType: '',
  countryOrRegion: '',
  agency: '',
  representativeWorks: '',
  categoryTags: '',
  description: '',
  avatar: '',
}

function canEditArtist(user: UserInfo | null, artist: ArtistEntity | null) {
  if (!user || !artist) return false
  if (user.role === 'admin') return true
  return user.role === 'organizer' && artist.submittedBy === user.id && artist.reviewStatus === 'pending'
}

export default function EditArtistPage() {
  const params = useParams()
  const router = useRouter()
  const artistId = Number(params.id)
  const [user, setUser] = useState<UserInfo | null>(null)
  const [artist, setArtist] = useState<ArtistEntity | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace(`/login?ru=/console/artists/${artistId}/edit`)
      return
    }
    if (!Number.isInteger(artistId) || artistId <= 0) {
      setError('艺人 ID 不正确')
      setLoading(false)
      return
    }
    let active = true
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const [info, detail] = await Promise.all([getUserInfo(), getAdminArtist(artistId)])
        if (!active) return
        setUser(info)
        setArtist(detail)
        setForm({
          name: detail.name || '',
          alias: detail.alias || '',
          artistType: detail.artistType || '',
          countryOrRegion: detail.countryOrRegion || '',
          agency: detail.agency || '',
          representativeWorks: detail.representativeWorks || '',
          categoryTags: detail.categoryTags || '',
          description: detail.description || '',
          avatar: detail.avatar || '',
        })
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : '加载艺人资料失败')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [artistId, router])

  const editable = canEditArtist(user, artist)

  const save = async () => {
    if (!user || !artist || saving) return
    if (!editable) {
      setError('当前账号不能编辑该艺人档案')
      return
    }
    if (!form.name.trim()) {
      setError('艺人/团队名称不能为空')
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const updated = await updateAdminArtist(artist.id, {
        userId: user.id,
        name: form.name.trim(),
        alias: form.alias.trim() || null,
        artistType: form.artistType.trim() || null,
        countryOrRegion: form.countryOrRegion.trim() || null,
        agency: form.agency.trim() || null,
        representativeWorks: form.representativeWorks.trim() || null,
        categoryTags: form.categoryTags.trim() || null,
        description: form.description.trim() || null,
        avatar: form.avatar.trim() || null,
      })
      setArtist(updated)
      setMessage('艺人资料已保存')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存艺人资料失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/console/artists/pending" className="inline-flex items-center gap-1 text-[13px] text-[#666] hover:text-[#ff1268]">
            <ArrowLeft className="h-4 w-4" /> 返回艺人审核
          </Link>
          <h1 className="mt-2 text-[24px] font-bold text-[#1a1a2e]">艺人资料编辑</h1>
          <p className="mt-1 text-[14px] text-[#666]">管理员可编辑所有艺人；主办方只能编辑自己提交且待审核的艺人。</p>
        </div>
        <button
          type="button"
          disabled={!editable || saving || loading}
          onClick={save}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ff1268] px-5 py-2 text-[14px] font-medium text-white disabled:bg-[#f7a8c6]"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          保存资料
        </button>
      </div>

      {error && <div className="rounded-xl bg-[#fef2f2] p-3 text-[14px] text-[#dc2626]">{error}</div>}
      {message && <div className="rounded-xl bg-[#f0fdf4] p-3 text-[14px] text-[#15803d]">{message}</div>}

      {loading ? (
        <div className="rounded-2xl bg-white p-8 text-center text-[#999]">加载中...</div>
      ) : artist ? (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <section className="rounded-2xl border border-[#eee] bg-white p-5 shadow-sm">
            <LocalFileUpload
              label="艺人头像"
              value={form.avatar}
              accept="image/jpeg,image/png,image/webp,image/gif"
              uploading={saving || !editable}
              onUpload={async (file) => {
                if (!user?.id) throw new Error('请先登录')
                const asset = await uploadTicketAsset({ userId: user.id, bizType: 'artist-avatar', file })
                return asset.publicUrl
              }}
              onChange={(avatar) => setForm(prev => ({ ...prev, avatar }))}
              hint="支持 JPG、PNG、WEBP、GIF，上传后自动写入头像地址。"
            />
            <div className="mt-4 rounded-xl bg-[#fafafa] p-3 text-[12px] leading-5 text-[#666]">
              审核状态：{artist.reviewStatus || '未知'}<br />
              风险状态：{artist.riskStatus || '未知'}<br />
              提交人：{artist.submittedBy || '未知'}
            </div>
            {!editable && <div className="mt-3 rounded-xl bg-[#fff7ed] p-3 text-[13px] text-[#c2410c]">当前账号没有编辑权限。</div>}
          </section>

          <section className="rounded-2xl border border-[#eee] bg-white p-5 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="艺人/团队名称 *" value={form.name} disabled={!editable} onChange={name => setForm(prev => ({ ...prev, name }))} />
              <Field label="别名" value={form.alias} disabled={!editable} onChange={alias => setForm(prev => ({ ...prev, alias }))} />
              <Field label="艺人类型" value={form.artistType} disabled={!editable} onChange={artistType => setForm(prev => ({ ...prev, artistType }))} placeholder="歌手 / 乐队 / 团队" />
              <Field label="国家/地区" value={form.countryOrRegion} disabled={!editable} onChange={countryOrRegion => setForm(prev => ({ ...prev, countryOrRegion }))} />
              <Field label="经纪公司" value={form.agency} disabled={!editable} onChange={agency => setForm(prev => ({ ...prev, agency }))} />
              <Field label="分类标签" value={form.categoryTags} disabled={!editable} onChange={categoryTags => setForm(prev => ({ ...prev, categoryTags }))} placeholder="流行,摇滚" />
              <label className="block text-[13px] font-medium text-[#333] sm:col-span-2">
                代表作品
                <input value={form.representativeWorks} disabled={!editable} onChange={event => setForm(prev => ({ ...prev, representativeWorks: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268] disabled:bg-[#f5f5f5]" />
              </label>
              <label className="block text-[13px] font-medium text-[#333] sm:col-span-2">
                简介
                <textarea value={form.description} disabled={!editable} onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))} rows={5} className="mt-1.5 w-full resize-none rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268] disabled:bg-[#f5f5f5]" />
              </label>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

function Field({ label, value, onChange, disabled, placeholder }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean; placeholder?: string }) {
  return (
    <label className="block text-[13px] font-medium text-[#333]">
      {label}
      <input value={value} disabled={disabled} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268] disabled:bg-[#f5f5f5]" />
    </label>
  )
}
```

- [ ] **Step 2: Run frontend typecheck**

Run from `C:\Users\Administrator\Desktop\omni\frontend`:

```powershell
pnpm typecheck
```

Expected: `tsc --noEmit` succeeds.

- [ ] **Step 3: Commit edit page**

Run from repository root `C:\Users\Administrator\Desktop\omni`:

```powershell
git add frontend/src/app/console/artists/[id]/edit/page.tsx
git commit -m "feat: add artist edit page"
```

---

## Task 5: Pending Artist Entry Point

**Files:**
- Modify: `frontend/src/app/console/artists/pending/page.tsx`

- [ ] **Step 1: Add edit link import**

In `frontend/src/app/console/artists/pending/page.tsx`, add import:

```ts
import Link from 'next/link'
```

- [ ] **Step 2: Add edit link to action buttons**

Inside the button group around existing “通过/拒绝/标记风险” buttons, add this `Link` before the approve button:

```tsx
                  <Link href={`/console/artists/${item.id}/edit`} className="rounded-full border border-[#ff1268] px-4 py-2 text-[13px] text-[#ff1268] hover:bg-[#fff0f5]">编辑资料</Link>
```

- [ ] **Step 3: Show avatar thumbnail in pending list**

Replace the `<div>` beginning at the current artist text block with this structure:

```tsx
                <div className="flex min-w-0 gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#fff0f5] text-[12px] text-[#ff1268]">
                    {item.avatar ? <img src={item.avatar} alt={item.name} className="h-full w-full object-cover" /> : '艺人'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[16px] font-semibold text-[#1a1a2e]">{item.name}{item.alias ? ` / ${item.alias}` : ''}</div>
                    <div className="mt-1 text-[13px] text-[#666]">{[item.countryOrRegion, item.artistType, item.categoryTags].filter(Boolean).join(' · ') || '暂无身份信息'}</div>
                    {item.representativeWorks && <div className="mt-1 text-[13px] text-[#999]">代表作品：{item.representativeWorks}</div>}
                    {item.description && <div className="mt-2 text-[13px] text-[#555]">{item.description}</div>}
                  </div>
                </div>
```

- [ ] **Step 4: Run frontend typecheck**

Run from `C:\Users\Administrator\Desktop\omni\frontend`:

```powershell
pnpm typecheck
```

Expected: `tsc --noEmit` succeeds.

- [ ] **Step 5: Commit pending page entry point**

Run from repository root `C:\Users\Administrator\Desktop\omni`:

```powershell
git add frontend/src/app/console/artists/pending/page.tsx
git commit -m "feat: link pending artists to edit page"
```

---

## Task 6: Final Verification

**Files:**
- No source changes expected.

- [ ] **Step 1: Run backend focused tests**

Run from `C:\Users\Administrator\Desktop\omni\java`:

```powershell
mvn test -pl java-ticket -Dtest=ArtistGovernanceServiceTest,AdminControllerTest
```

Expected: `BUILD SUCCESS`; both test classes pass. If PowerShell parses the comma incorrectly, run the two classes separately:

```powershell
mvn test -pl java-ticket -Dtest=ArtistGovernanceServiceTest
mvn test -pl java-ticket -Dtest=AdminControllerTest
```

- [ ] **Step 2: Run frontend typecheck**

Run from `C:\Users\Administrator\Desktop\omni\frontend`:

```powershell
pnpm typecheck
```

Expected: `tsc --noEmit` succeeds.

- [ ] **Step 3: Run boundary verification**

Run from repository root `C:\Users\Administrator\Desktop\omni`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1
```

Expected: `All microservice boundary checks passed.`

- [ ] **Step 4: Run whitespace check**

Run from repository root `C:\Users\Administrator\Desktop\omni`:

```powershell
git diff --check
```

Expected: no output except possible LF/CRLF warnings.

- [ ] **Step 5: Commit final verification notes only if source changed during verification**

If verification required fixes, commit the changed files with a focused message. If no files changed, do not create an empty commit.

---

## Self-Review

- Spec coverage: The plan implements an artist edit page, avatar upload via existing `artist-avatar` asset type, backend update endpoint, and the chosen permission model: admin any artist, organizer own pending only.
- Placeholder scan: No deferred implementation placeholders are present; all tasks include exact files, code, commands, and expected results.
- Type consistency: Backend request type is `ArtistUpdateRequest`; frontend request type uses the same name; API wrapper is `updateAdminArtist`; controller method is `updateArtist`; service method is `updateProfile`.
- Scope check: This plan intentionally does not add a full artist list page. It adds the edit page and links it from the existing pending review page, which is the minimal path for the requested “艺人头像入口”。
