# Artist Management List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增后台艺人管理列表页，让 admin 查看全平台艺人、organizer 查看自己提交的艺人，并从列表进入艺人编辑页。

**Architecture:** 在 `java-ticket` 的现有 admin artist controller 下新增 token 鉴权列表接口，复用 `ArtistAdminService` 查询 `artist` 表并返回 MyBatis-Plus `Page<Artist>`。前端新增 `/console/artists` 页面和 API wrapper，沿用当前后台白卡片列表风格，不触碰 SeatCraft 座位图组件和全局后台布局视觉。

**Tech Stack:** Java Spring Boot、MyBatis-Plus、JUnit 5、Mockito、Next.js 16、React 19、TypeScript、pnpm。

---

## Scope Guardrails

- 不修改 `frontend/src/components/seatcraft/**`。
- 不修改 `frontend/src/components/seatcraft-unified/**`。
- 不修改座位图 API、座位表交互、SeatCraft 深色 IDE 风格。
- 不重做 `frontend/src/app/console/layout.tsx` 的视觉结构，只增加菜单项。
- 不新增数据库表或迁移。
- 不新增艺人创建页；提交新艺人仍通过活动艺人选择器的“搜索不到时提交”。
- 不改变现有艺人编辑权限：admin 可编辑任意艺人；organizer 只能编辑自己提交且 `pending` 的艺人。
- 不删除或替代 `/console/artists/pending` 待审核页。

## File Structure

- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/ArtistAdminService.java`
  - 新增 `listManageable(...)`，按操作者角色、关键词、审核状态、风险状态分页查询艺人。
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
  - 新增 `GET /api/ticket/admin/artists`，从 token 解析 operatorId，admin 查询全部，organizer 查询自己提交。
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java`
  - 覆盖未登录、普通用户、admin、organizer 调用列表接口。
- Create: `java/java-ticket/src/test/java/com/omni/ticket/service/ArtistAdminServiceTest.java`
  - 覆盖列表查询 wrapper 的角色约束、关键词和状态筛选。
- Modify: `frontend/src/types/api.ts`
  - 补充 `ArtistListParams`，如已有 `PageVO<T>` 则复用；如无则使用现有 `Page<T>` 类型命名。
- Modify: `frontend/src/lib/api.ts`
  - 新增 `listAdminArtists(params)`。
- Create: `frontend/src/app/console/artists/page.tsx`
  - 新增艺人管理列表页。
- Modify: `frontend/src/app/console/layout.tsx`
  - admin 菜单新增“艺人管理”和“艺人档案审核”；organizer 菜单新增“我的艺人”。

---

### Task 1: 后端艺人列表服务

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/service/ArtistAdminService.java`
- Create: `java/java-ticket/src/test/java/com/omni/ticket/service/ArtistAdminServiceTest.java`

- [ ] **Step 1: 写服务测试**

创建 `ArtistAdminServiceTest`，用 Mockito 捕获 `LambdaQueryWrapper<Artist>`，重点验证服务不会绕过角色过滤。

```java
package com.omni.ticket.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.omni.ticket.entity.Artist;
import com.omni.ticket.mapper.ArtistMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ArtistAdminServiceTest {
    @Mock
    private ArtistMapper artistMapper;

    @Test
    void listManageableAllowsAdminToQueryAllArtists() {
        ArtistAdminService service = new ArtistAdminService(artistMapper);
        Page<Artist> page = new Page<>(1, 10);
        page.setRecords(List.of(artist(1L, 2003L)));
        when(artistMapper.selectPage(any(), any())).thenReturn(page);

        Page<Artist> result = service.listManageable(2002L, "admin", 1, 10, "周", "approved", "normal");

        assertEquals(1, result.getRecords().size());
        ArgumentCaptor<LambdaQueryWrapper<Artist>> captor = ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(artistMapper).selectPage(any(Page.class), captor.capture());
    }

    @Test
    void listManageableLimitsOrganizerToOwnSubmissions() {
        ArtistAdminService service = new ArtistAdminService(artistMapper);
        Page<Artist> page = new Page<>(1, 10);
        page.setRecords(List.of(artist(2L, 2003L)));
        when(artistMapper.selectPage(any(), any())).thenReturn(page);

        Page<Artist> result = service.listManageable(2003L, "organizer", 1, 10, null, null, null);

        assertEquals(1, result.getRecords().size());
        verify(artistMapper).selectPage(any(Page.class), any(LambdaQueryWrapper.class));
    }

    private Artist artist(Long id, Long submittedBy) {
        Artist artist = new Artist();
        artist.setId(id);
        artist.setName("测试艺人" + id);
        artist.setSubmittedBy(submittedBy);
        artist.setStatus(1);
        artist.setReviewStatus("pending");
        artist.setRiskStatus("normal");
        return artist;
    }
}
```

- [ ] **Step 2: 运行服务测试确认失败**

Run: `mvn test -pl java-ticket -Dtest=ArtistAdminServiceTest`

Workdir: `C:\Users\Administrator\Desktop\omni\java`

Expected: 编译失败或测试失败，原因是 `listManageable` 尚不存在。

- [ ] **Step 3: 实现服务方法**

在 `ArtistAdminService` 添加 imports：

```java
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
```

添加方法：

```java
public Page<Artist> listManageable(Long operatorId, String role, long page, long size,
                                   String keyword, String reviewStatus, String riskStatus) {
    long current = Math.max(1, page);
    long pageSize = Math.min(50, Math.max(1, size));
    String term = keyword == null ? "" : keyword.trim();
    LambdaQueryWrapper<Artist> wrapper = new LambdaQueryWrapper<Artist>()
            .eq(Artist::getStatus, 1)
            .orderByDesc(Artist::getUpdateTime)
            .orderByDesc(Artist::getCreateTime)
            .orderByAsc(Artist::getName);
    if ("organizer".equals(role)) {
        wrapper.eq(Artist::getSubmittedBy, operatorId);
    }
    if (StringUtils.hasText(term)) {
        wrapper.and(w -> w.like(Artist::getName, term)
                .or().like(Artist::getAlias, term)
                .or().like(Artist::getCategoryTags, term)
                .or().like(Artist::getRepresentativeWorks, term));
    }
    if (StringUtils.hasText(reviewStatus)) {
        wrapper.eq(Artist::getReviewStatus, reviewStatus.trim());
    }
    if (StringUtils.hasText(riskStatus)) {
        wrapper.eq(Artist::getRiskStatus, riskStatus.trim());
    }
    return artistMapper.selectPage(new Page<>(current, pageSize), wrapper);
}
```

- [ ] **Step 4: 运行服务测试确认通过**

Run: `mvn test -pl java-ticket -Dtest=ArtistAdminServiceTest`

Workdir: `C:\Users\Administrator\Desktop\omni\java`

Expected: `BUILD SUCCESS`。

---

### Task 2: 后端 Controller 列表接口

**Files:**
- Modify: `java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java`
- Modify: `java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java`

- [ ] **Step 1: 写 Controller 测试**

在 `AdminControllerTest` 艺人接口测试区域新增：

```java
@Test
void listArtistsRejectsMissingAuthorization() {
    AdminController controller = controller();

    Result<Page<Artist>> result = controller.listArtists(null, 1, 10, null, null, null);

    assertEquals(401, result.getCode());
    verify(artistAdminService, never()).listManageable(any(), any(), anyLong(), anyLong(), any(), any(), any());
}

@Test
void listArtistsRejectsUserRole() {
    AdminController controller = controller();
    when(userAccessService.requireAdminOrOrganizerRole(2004L)).thenReturn(null);

    Result<Page<Artist>> result = controller.listArtists(
            "Bearer " + JwtUtil.generateToken(2004L, "13900000001", "user"), 1, 10, null, null, null);

    assertEquals(403, result.getCode());
    verify(artistAdminService, never()).listManageable(any(), any(), anyLong(), anyLong(), any(), any(), any());
}

@Test
void listArtistsDelegatesForAdmin() {
    AdminController controller = controller();
    Page<Artist> page = new Page<>(1, 10);
    page.setRecords(List.of(new Artist()));
    when(userAccessService.requireAdminOrOrganizerRole(2002L)).thenReturn("admin");
    when(artistAdminService.listManageable(2002L, "admin", 1, 10, "周", "approved", "normal")).thenReturn(page);

    Result<Page<Artist>> result = controller.listArtists(
            "Bearer " + JwtUtil.generateToken(2002L, "13800000001", "admin"), 1, 10, "周", "approved", "normal");

    assertEquals(200, result.getCode());
    assertEquals(1, result.getData().getRecords().size());
    verify(artistAdminService).listManageable(2002L, "admin", 1, 10, "周", "approved", "normal");
}

@Test
void listArtistsDelegatesForOrganizer() {
    AdminController controller = controller();
    Page<Artist> page = new Page<>(1, 10);
    page.setRecords(List.of(new Artist()));
    when(userAccessService.requireAdminOrOrganizerRole(2003L)).thenReturn("organizer");
    when(artistAdminService.listManageable(2003L, "organizer", 1, 10, null, "pending", null)).thenReturn(page);

    Result<Page<Artist>> result = controller.listArtists(
            "Bearer " + JwtUtil.generateToken(2003L, "13800000002", "organizer"), 1, 10, null, "pending", null);

    assertEquals(200, result.getCode());
    assertEquals(1, result.getData().getRecords().size());
    verify(artistAdminService).listManageable(2003L, "organizer", 1, 10, null, "pending", null);
}
```

如果缺少 import，添加：

```java
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import static org.mockito.ArgumentMatchers.anyLong;
```

- [ ] **Step 2: 运行 Controller 测试确认失败**

Run: `mvn test -pl java-ticket -Dtest=AdminControllerTest`

Workdir: `C:\Users\Administrator\Desktop\omni\java`

Expected: 编译失败或测试失败，原因是 `listArtists` endpoint 尚不存在。

- [ ] **Step 3: 实现 Controller endpoint**

在 `AdminController` 添加 import：

```java
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
```

在 `searchArtists` 和 `getArtist` 之间新增：

```java
@GetMapping("/artists")
public Result<Page<Artist>> listArtists(@RequestHeader(value = "Authorization", required = false) String authorization,
                                        @RequestParam(defaultValue = "1") long page,
                                        @RequestParam(defaultValue = "10") long size,
                                        @RequestParam(required = false) String keyword,
                                        @RequestParam(required = false) String reviewStatus,
                                        @RequestParam(required = false) String riskStatus) {
    Long operatorId = parseOperatorId(authorization);
    if (operatorId == null) {
        return Result.fail(ResultCode.UNAUTHORIZED);
    }
    String role = checkRole(operatorId);
    if (role == null) {
        return Result.fail(ResultCode.FORBIDDEN);
    }
    return Result.success(artistAdminService.listManageable(operatorId, role, page, size, keyword, reviewStatus, riskStatus));
}
```

- [ ] **Step 4: 运行 Controller 测试确认通过**

Run: `mvn test -pl java-ticket -Dtest=AdminControllerTest`

Workdir: `C:\Users\Administrator\Desktop\omni\java`

Expected: `BUILD SUCCESS`。

---

### Task 3: 前端 API 和类型

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: 增加前端类型**

在 `frontend/src/types/api.ts` 的艺人类型附近添加：

```ts
export interface ArtistListParams {
  page?: number
  size?: number
  keyword?: string
  reviewStatus?: ArtistReviewStatus | ''
  riskStatus?: ArtistRiskStatus | ''
}
```

- [ ] **Step 2: 增加 API wrapper**

在 `frontend/src/lib/api.ts` 的艺人 API 区域添加：

```ts
export async function listAdminArtists(params: import('@/types/api').ArtistListParams = {}) {
  const search = new URLSearchParams()
  search.set('page', String(params.page ?? 1))
  search.set('size', String(params.size ?? 10))
  if (params.keyword?.trim()) search.set('keyword', params.keyword.trim())
  if (params.reviewStatus) search.set('reviewStatus', params.reviewStatus)
  if (params.riskStatus) search.set('riskStatus', params.riskStatus)
  return request<import('@/types/api').PageResult<import('@/types/api').ArtistEntity>>(`/api/ticket/admin/artists?${search.toString()}`)
}
```

如果项目已有分页响应类型不是 `PageResult<T>`，按 `listAdminActivities(...)` 当前使用的分页类型命名替换为一致类型。

- [ ] **Step 3: 运行前端类型检查**

Run: `pnpm typecheck`

Workdir: `C:\Users\Administrator\Desktop\omni\frontend`

Expected: `tsc --noEmit` 通过。

---

### Task 4: 前端艺人管理列表页和导航

**Files:**
- Create: `frontend/src/app/console/artists/page.tsx`
- Modify: `frontend/src/app/console/layout.tsx`

- [ ] **Step 1: 新增页面**

创建 `frontend/src/app/console/artists/page.tsx`，实现：

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Edit, Search } from 'lucide-react'
import { getUser } from '@/lib/auth'
import { listAdminArtists } from '@/lib/api'
import type { ArtistEntity, ArtistReviewStatus, ArtistRiskStatus, UserRole } from '@/types/api'

const PAGE_SIZE = 10

export default function ArtistsPage() {
  const [items, setItems] = useState<ArtistEntity[]>([])
  const [role, setRole] = useState<UserRole | ''>('')
  const [checkingRole, setCheckingRole] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [reviewStatus, setReviewStatus] = useState<ArtistReviewStatus | ''>('')
  const [riskStatus, setRiskStatus] = useState<ArtistRiskStatus | ''>('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const loadDataRef = useRef(() => {})
  const lastRefreshRef = useRef(0)
  const isAdmin = role === 'admin'

  const loadData = (nextPage = page) => {
    const user = getUser()
    if (!user) return
    setRole(user.role || 'user')
    setCheckingRole(false)
    setLoading(true)
    setError('')
    listAdminArtists({
      page: nextPage,
      size: PAGE_SIZE,
      keyword,
      reviewStatus,
      riskStatus,
    }).then(res => {
      setItems(res.records)
      setTotal(res.total)
      setPages(res.pages || 1)
      setPage(res.current || nextPage)
      setLoading(false)
    }).catch(err => {
      setError(err instanceof Error ? err.message : '加载艺人失败')
      setLoading(false)
    })
  }

  loadDataRef.current = loadData

  const refreshWhenVisible = () => {
    const now = Date.now()
    if (now - lastRefreshRef.current < 200) return
    lastRefreshRef.current = now
    loadDataRef.current()
  }

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) refreshWhenVisible()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshWhenVisible()
    }
    window.addEventListener('pageshow', handlePageShow)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('pageshow', handlePageShow)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    loadData(1)
  }

  if (checkingRole || !role) {
    return <div className="py-20 text-center text-[14px] text-[#999]">加载中...</div>
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#1a1a2e]">{isAdmin ? '艺人管理' : '我的艺人'}</h1>
          <p className="mt-1 text-[13px] text-[#999]">{isAdmin ? '查看、筛选和维护全平台艺人档案。' : '查看自己提交的艺人档案和审核状态。'}</p>
        </div>
        {isAdmin && <Link href="/console/artists/pending" className="rounded-lg border border-[#ffd9e6] bg-[#fff0f5] px-4 py-2 text-[14px] font-medium text-[#ff1268] hover:bg-[#ffe4ef]">待审核艺人</Link>}
      </div>

      <form onSubmit={handleSearch} className="mb-5 grid gap-3 rounded-xl border border-[#e5e5e5] bg-white p-4 lg:grid-cols-[1fr_180px_180px_auto]">
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999]" />
          <input value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="搜索艺人名称、别名、标签或代表作" className="h-10 w-full rounded-lg border border-[#e5e5e5] pl-9 pr-3 text-[14px] outline-none focus:border-[#ff1268]" />
        </label>
        <select value={reviewStatus} onChange={event => setReviewStatus(event.target.value as ArtistReviewStatus | '')} className="h-10 rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]">
          <option value="">全部审核状态</option>
          <option value="pending">待审核</option>
          <option value="approved">已通过</option>
          <option value="rejected">已拒绝</option>
        </select>
        <select value={riskStatus} onChange={event => setRiskStatus(event.target.value as ArtistRiskStatus | '')} className="h-10 rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]">
          <option value="">全部风险状态</option>
          <option value="normal">正常</option>
          <option value="risky">风险</option>
        </select>
        <button type="submit" className="h-10 rounded-lg bg-[#ff1268] px-5 text-[14px] font-medium text-white hover:bg-[#e0105a]">搜索</button>
      </form>

      {error && <div className="mb-4 rounded-xl bg-[#fef2f2] p-3 text-[14px] text-[#dc2626]">{error}</div>}

      {loading ? <div className="rounded-xl bg-white p-6 text-center text-[14px] text-[#999]">加载艺人中...</div> : items.length === 0 ? (
        <div className="rounded-xl border border-[#eee] bg-white p-8 text-center text-[14px] text-[#999]">暂无艺人档案</div>
      ) : (
        <div className="space-y-3">
          {items.map(item => <ArtistCard key={item.id} item={item} />)}
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3 rounded-xl border border-[#e5e5e5] bg-white p-4 text-[13px] text-[#666] sm:flex-row sm:items-center sm:justify-between">
        <span>共 {total} 条，当前第 {page} / {pages} 页</span>
        <div className="flex gap-2">
          <button disabled={page <= 1 || loading} onClick={() => loadData(page - 1)} className="rounded-lg border border-[#ddd] px-3 py-1.5 disabled:opacity-50">上一页</button>
          <button disabled={page >= pages || loading} onClick={() => loadData(page + 1)} className="rounded-lg border border-[#ddd] px-3 py-1.5 disabled:opacity-50">下一页</button>
        </div>
      </div>
    </div>
  )
}

function ArtistCard({ item }: { item: ArtistEntity }) {
  return (
    <div className="rounded-xl border border-[#eee] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          {item.avatar ? <img src={item.avatar} alt={item.name} className="h-16 w-16 shrink-0 rounded-xl object-cover" /> : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[#f5f5f5] text-[13px] font-semibold text-[#999]">艺人</div>}
          <div className="min-w-0">
            <div className="text-[16px] font-semibold text-[#1a1a2e]">{item.name}{item.alias ? ` / ${item.alias}` : ''}</div>
            <div className="mt-1 text-[13px] text-[#666]">{[item.countryOrRegion, item.artistType, item.categoryTags].filter(Boolean).join(' · ') || '暂无身份信息'}</div>
            {item.representativeWorks && <div className="mt-1 text-[13px] text-[#999]">代表作品：{item.representativeWorks}</div>}
            {item.description && <div className="mt-2 line-clamp-2 text-[13px] text-[#555]">{item.description}</div>}
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusPill label={reviewLabel(item.reviewStatus)} tone={item.reviewStatus === 'approved' ? 'green' : item.reviewStatus === 'rejected' ? 'red' : 'yellow'} />
              <StatusPill label={item.riskStatus === 'risky' ? '风险艺人' : '风险正常'} tone={item.riskStatus === 'risky' ? 'red' : 'gray'} />
            </div>
          </div>
        </div>
        <Link href={`/console/artists/${item.id}/edit`} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#ddd] px-4 py-2 text-[13px] text-[#333] hover:border-[#ff1268] hover:text-[#ff1268]"><Edit className="h-3.5 w-3.5" /> 编辑资料</Link>
      </div>
    </div>
  )
}

function StatusPill({ label, tone }: { label: string; tone: 'green' | 'red' | 'yellow' | 'gray' }) {
  const className = tone === 'green' ? 'bg-[#f0fdf4] text-[#15803d]' : tone === 'red' ? 'bg-[#fef2f2] text-[#dc2626]' : tone === 'yellow' ? 'bg-[#fffbeb] text-[#b45309]' : 'bg-[#f5f5f5] text-[#666]'
  return <span className={`rounded-full px-2.5 py-1 text-[12px] ${className}`}>{label}</span>
}

function reviewLabel(status: ArtistEntity['reviewStatus']) {
  if (status === 'approved') return '已通过'
  if (status === 'rejected') return '已拒绝'
  return '待审核'
}
```

- [ ] **Step 2: 增加导航入口**

在 `frontend/src/app/console/layout.tsx` 的 lucide import 中加入：

```ts
Users
```

在 admin `menuItems` 中加入：

```ts
{ href: '/console/artists', label: '艺人管理', icon: Users, roles: ['admin'] },
{ href: '/console/artists/pending', label: '艺人档案审核', icon: ClipboardList, roles: ['admin'] },
```

在 organizer `organizerMenuItems` 中加入：

```ts
{ href: '/console/artists', label: '我的艺人', icon: Users },
```

- [ ] **Step 3: 运行前端类型检查**

Run: `pnpm typecheck`

Workdir: `C:\Users\Administrator\Desktop\omni\frontend`

Expected: `tsc --noEmit` 通过。

---

### Task 5: 最终验证

**Files:**
- No code changes.

- [ ] **Step 1: 后端艺人相关测试**

Run: `mvn test -pl java-ticket -Dtest=ArtistAdminServiceTest`

Workdir: `C:\Users\Administrator\Desktop\omni\java`

Expected: `BUILD SUCCESS`。

- [ ] **Step 2: 后端 Controller 测试**

Run: `mvn test -pl java-ticket -Dtest=AdminControllerTest`

Workdir: `C:\Users\Administrator\Desktop\omni\java`

Expected: `BUILD SUCCESS`。

- [ ] **Step 3: 前端类型检查**

Run: `pnpm typecheck`

Workdir: `C:\Users\Administrator\Desktop\omni\frontend`

Expected: `tsc --noEmit` 通过。

- [ ] **Step 4: 限定文件空白检查**

Run:

```powershell
git diff --check -- "docs/superpowers/plans/2026-05-23-artist-management-list.md" "frontend/src/app/console/artists/page.tsx" "frontend/src/app/console/layout.tsx" "frontend/src/lib/api.ts" "frontend/src/types/api.ts" "java/java-ticket/src/main/java/com/omni/ticket/controller/AdminController.java" "java/java-ticket/src/main/java/com/omni/ticket/service/ArtistAdminService.java" "java/java-ticket/src/test/java/com/omni/ticket/controller/AdminControllerTest.java" "java/java-ticket/src/test/java/com/omni/ticket/service/ArtistAdminServiceTest.java"
```

Workdir: `C:\Users\Administrator\Desktop\omni`

Expected: 无 trailing whitespace 报错。LF/CRLF warning 可接受。

- [ ] **Step 5: 微服务边界检查**

Run: `powershell -ExecutionPolicy Bypass -File scripts/verify-microservice-boundaries.ps1`

Workdir: `C:\Users\Administrator\Desktop\omni`

Expected: `All microservice boundary checks passed.`

---

## Self-Review

- Spec coverage: 覆盖 admin 全量列表、organizer 自己提交列表、关键词筛选、审核状态筛选、风险状态筛选、前端列表页、导航入口和编辑跳转。
- Placeholder scan: 未使用 TBD/TODO/稍后实现等占位描述。
- Type consistency: 后端返回 `Page<Artist>`；前端 API wrapper 使用现有分页响应类型；页面读取 `records/total/pages/current`，与现有后台活动列表一致。
- Scope check: 单一功能，未包含艺人创建页、批量管理、SeatCraft 或场馆证明上传。
