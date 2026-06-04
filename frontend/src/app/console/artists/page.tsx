'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Edit, Search } from 'lucide-react'
import { getUser } from '@/lib/auth'
import { listAdminArtists, updateAdminArtistRisk } from '@/lib/api'
import { canUseConsoleAction } from '@/lib/console-auth'
import type { ArtistEntity, ArtistReviewStatus, ArtistRiskStatus, UserRole } from '@/types/api'

const PAGE_SIZE = 10

export default function ArtistsPage() {
  const [items, setItems] = useState<ArtistEntity[]>([])
  const [role, setRole] = useState<UserRole | ''>('')
  const [permissionCodes, setPermissionCodes] = useState<string[]>([])
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
  const canManageAllArtists = role !== 'organizer' && canUseConsoleAction('artist.manage', permissionCodes)

  const loadData = (nextPage = page) => {
    const user = getUser()
    if (!user) return
    setRole(user.role || 'user')
    setPermissionCodes(user.permissionCodes || [])
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
          <h1 className="text-[22px] font-bold text-[#1a1a2e]">{canManageAllArtists ? '艺人管理' : '我的艺人'}</h1>
          <p className="mt-1 text-[13px] text-[#999]">{canManageAllArtists ? '查看、筛选和维护全平台艺人档案。' : '查看自己提交的艺人档案和审核状态。'}</p>
        </div>
        {canManageAllArtists && <Link href="/console/artists/pending" className="rounded-lg border border-[#ffd9e6] bg-[#fff0f5] px-4 py-2 text-[14px] font-medium text-[#ff1268] hover:bg-[#ffe4ef]">待审核艺人</Link>}
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
          {items.map(item => <ArtistCard key={item.id} item={item} canManageAllArtists={canManageAllArtists} onUpdate={() => loadData(page)} />)}
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

function ArtistCard({ item, canManageAllArtists, onUpdate }: { item: ArtistEntity; canManageAllArtists: boolean; onUpdate: () => void }) {
  const [updating, setUpdating] = useState(false)
  const [riskModalOpen, setRiskModalOpen] = useState(false)
  const [riskReason, setRiskReason] = useState('')
  const [riskError, setRiskError] = useState('')

  const handleRiskToggle = async (confirmedReason: string | null) => {
    const isRisky = item.riskStatus === 'risky'
    
    if (confirmedReason === null) {
      setRiskModalOpen(false)
      return
    }

    if (!isRisky && !confirmedReason.trim()) {
      setRiskError('必须填写风险原因')
      return
    }

    setRiskError('')
    setUpdating(true)
    setRiskModalOpen(false)
    try {
      await updateAdminArtistRisk(item.id, {
        riskStatus: isRisky ? 'normal' : 'risky',
        reason: isRisky ? null : confirmedReason.trim(),
      })
      onUpdate()
    } catch (err) {
      alert(err instanceof Error ? err.message : `操作失败`)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <>
      <div className="rounded-xl border border-[#eee] bg-white p-4 shadow-sm relative">
        {updating && <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/60 text-[13px] text-[#ff1268]">更新中...</div>}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            {item.avatar ? <img src={item.avatar} alt={item.name} className="h-16 w-16 shrink-0 rounded-xl object-cover" /> : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[#f5f5f5] text-[13px] font-semibold text-[#999]">艺人</div>}
            <div className="min-w-0">
              <div className="text-[16px] font-semibold text-[#1a1a2e]">{item.name}{item.alias ? ` / ${item.alias}` : ''}</div>
              <div className="mt-1 text-[13px] text-[#666]">{[item.countryOrRegion, item.artistType, item.categoryTags].filter(Boolean).join(' · ') || '暂无身份信息'}</div>
              {item.representativeWorks && <div className="mt-1 text-[13px] text-[#999]">代表作品：{item.representativeWorks}</div>}
              {item.description && <div className="mt-2 line-clamp-2 text-[13px] text-[#555]">{item.description}</div>}
              {item.riskReason && item.riskStatus === 'risky' && <div className="mt-2 text-[13px] text-[#dc2626]">风险原因：{item.riskReason}</div>}
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusPill label={reviewLabel(item.reviewStatus)} tone={item.reviewStatus === 'approved' ? 'green' : item.reviewStatus === 'rejected' ? 'red' : 'yellow'} />
                <StatusPill label={item.riskStatus === 'risky' ? '风险艺人' : '风险正常'} tone={item.riskStatus === 'risky' ? 'red' : 'gray'} />
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canManageAllArtists && (
              <button
                onClick={() => {
                  setRiskReason('')
                  setRiskError('')
                  setRiskModalOpen(true)
                }}
                disabled={updating}
                className={`inline-flex shrink-0 items-center justify-center rounded-full border px-4 py-2 text-[13px] transition-colors ${
                  item.riskStatus === 'risky' 
                    ? 'border-[#dc2626] text-[#dc2626] hover:bg-[#fef2f2]' 
                    : 'border-[#ff7a00] text-[#ff7a00] hover:bg-[#fff7ed]'
                }`}
              >
                {item.riskStatus === 'risky' ? '解除风险' : '列入风险'}
              </button>
            )}
            <Link href={`/console/artists/${item.id}/edit`} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#ddd] px-4 py-2 text-[13px] text-[#333] hover:border-[#ff1268] hover:text-[#ff1268]">
              <Edit className="h-3.5 w-3.5" /> 编辑资料
            </Link>
          </div>
        </div>
      </div>

      {riskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-[18px] font-semibold text-[#1a1a2e]">
              {item.riskStatus === 'risky' ? '解除风险' : '列入风险'}
            </h3>
            <p className="mt-2 text-[14px] text-[#666]">
              {item.riskStatus === 'risky' 
                ? `确定要解除艺人“${item.name}”的风险状态吗？解除后该艺人的演出将允许正常售票。` 
                : `将艺人“${item.name}”列入风险后，所有包含该艺人的活动均会被自动拦截并暂停售票。`}
            </p>
            
            {item.riskStatus !== 'risky' && (
              <div className="mt-4">
                <textarea
                  value={riskReason}
                  onChange={e => {
                    setRiskReason(e.target.value)
                    if (e.target.value.trim()) setRiskError('')
                  }}
                  placeholder="请输入列入风险的原因（必填）..."
                  className={`w-full resize-none rounded-xl border p-3 text-[14px] outline-none transition-colors ${riskError ? 'border-[#dc2626] focus:border-[#dc2626]' : 'border-[#e5e5e5] focus:border-[#ff1268]'}`}
                  rows={3}
                />
                {riskError && <div className="mt-1.5 text-[13px] text-[#dc2626]">{riskError}</div>}
              </div>
            )}
            
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setRiskModalOpen(false)}
                className="rounded-xl border border-[#e5e5e5] bg-white px-5 py-2.5 text-[14px] font-medium text-[#666] hover:bg-[#f5f5f5]"
              >
                取消
              </button>
              <button
                onClick={() => handleRiskToggle(item.riskStatus === 'risky' ? '' : riskReason)}
                className={`rounded-xl px-5 py-2.5 text-[14px] font-medium text-white ${
                  item.riskStatus === 'risky' 
                    ? 'bg-[#15803d] hover:bg-[#166534]' 
                    : 'bg-[#dc2626] hover:bg-[#b91c1c]'
                }`}
              >
                {item.riskStatus === 'risky' ? '确认解除' : '确认列入风险'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
