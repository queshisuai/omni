'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Edit, Search, ShieldAlert } from 'lucide-react'
import { globalAlert } from '@/components/GlobalDialog'
import { GlobalPagination } from '@/components/Pagination'
import { SafeImage } from '@/components/SafeImage'
import { Modal } from '@/components/ui/Modal'
import { getUser } from '@/lib/auth'
import { listAdminArtists, updateAdminArtistRisk } from '@/lib/api'
import {
  canToggleArtistRiskStatus,
  formatArtistListReviewStatus,
  formatArtistListRiskStatus,
  formatArtistRiskToggleAction,
  getArtistListReviewTone,
  getArtistListRiskTone,
  getNextArtistRiskStatus,
} from '@/lib/console-artists'
import { canUseConsoleAction } from '@/lib/console-auth'
import type { ArtistEntity, ArtistReviewStatus, ArtistRiskStatus, UserRole } from '@/types/api'

const PAGE_SIZE = 10
const RISK_WARNING = '警告：将该艺人列入风险后，系统将通过联动机制自动停售下架所有包含该艺人的已发布演出活动！'

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
  const [pendingArtistCount, setPendingArtistCount] = useState(0)
  const [riskTarget, setRiskTarget] = useState<ArtistEntity | null>(null)
  const [riskReason, setRiskReason] = useState('')
  const [riskError, setRiskError] = useState('')
  const [riskSubmitting, setRiskSubmitting] = useState(false)
  const loadDataRef = useRef(() => {})
  const lastRefreshRef = useRef(0)
  const canManageAllArtists = role !== 'organizer' && canUseConsoleAction('artist.manage', permissionCodes)

  const loadPendingCount = () => {
    listAdminArtists({ page: 1, size: 1, reviewStatus: 'pending' })
      .then(res => setPendingArtistCount(res.total))
      .catch(() => setPendingArtistCount(0))
  }

  const loadData = (nextPage = page) => {
    const user = getUser()
    if (!user) {
      setCheckingRole(false)
      setLoading(false)
      setError('请先登录后再查看艺人档案')
      return
    }
    const permissions = user.permissionCodes || []
    setRole(user.role || 'user')
    setPermissionCodes(permissions)
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
      setPage(res.current || nextPage)
      setLoading(false)
      if (user.role !== 'organizer' && canUseConsoleAction('artist.manage', permissions)) loadPendingCount()
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

  const openRiskModal = (item: ArtistEntity) => {
    if (!canToggleArtistRiskStatus(item.riskStatus)) return
    setRiskTarget(item)
    setRiskReason('')
    setRiskError('')
  }

  const closeRiskModal = () => {
    if (riskSubmitting) return
    setRiskTarget(null)
    setRiskReason('')
    setRiskError('')
  }

  const submitRiskChange = async () => {
    if (!riskTarget) return
    const nextRiskStatus = getNextArtistRiskStatus(riskTarget.riskStatus)
    if (!nextRiskStatus) {
      closeRiskModal()
      return
    }
    if (nextRiskStatus === 'risky' && !riskReason.trim()) {
      setRiskError('风险原因不能为空')
      return
    }

    setRiskSubmitting(true)
    setRiskError('')
    try {
      await updateAdminArtistRisk(riskTarget.id, {
        riskStatus: nextRiskStatus,
        reason: nextRiskStatus === 'risky' ? riskReason.trim() : null,
      })
      closeRiskModal()
      loadData(page)
    } catch (err) {
      await globalAlert(err instanceof Error ? err.message : '操作失败')
    } finally {
      setRiskSubmitting(false)
    }
  }

  if (checkingRole || !role) {
    return <div className="py-20 text-center text-[14px] text-[#999]">加载中...</div>
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#1a1a2e]">{canManageAllArtists ? '艺人档案管理' : '我的艺人'}</h1>
          <p className="mt-1 text-[13px] text-[#999]">{canManageAllArtists ? '按审核、风险和资料维度维护全平台艺人档案。' : '查看自己提交的艺人档案和审核状态。'}</p>
        </div>
        {canManageAllArtists && (
          <Link href="/console/artists/pending" className="inline-flex items-center gap-2 rounded-lg border border-[#ffd9e6] bg-[#fff0f5] px-4 py-2 text-[14px] font-medium text-[#ff1268] hover:bg-[#ffe4ef]">
            待审核艺人
            <span className="rounded-full bg-[#ff1268] px-2 py-0.5 text-[12px] text-white">{pendingArtistCount}</span>
          </Link>
        )}
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
        <div className="overflow-hidden rounded-xl border border-[#e5e5e5] bg-white">
          <table className="w-full table-fixed text-[14px]">
            <thead>
              <tr className="border-b border-[#e5e5e5] bg-[#fafafa] text-left text-[#666]">
                <th className="w-16 whitespace-nowrap p-3">头像</th>
                <th className="w-52 whitespace-nowrap p-3">艺人/团体名称</th>
                <th className="w-36 whitespace-nowrap p-3">地区/类型</th>
                <th className="w-24 min-w-[90px] whitespace-nowrap p-3">所属类目标签</th>
                <th className="w-52 whitespace-nowrap p-3">代表作品</th>
                <th className="w-24 min-w-[90px] whitespace-nowrap p-3 text-center">审核状态</th>
                <th className="w-24 min-w-[90px] whitespace-nowrap p-3 text-center">风险等级</th>
                <th className="w-40 min-w-[150px] whitespace-nowrap p-3 text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const canToggleRisk = canManageAllArtists && canToggleArtistRiskStatus(item.riskStatus)
                return (
                  <tr key={item.id} className="border-b border-[#f0f0f0] hover:bg-[#fafafa]">
                    <td className="p-3">
                      <SafeImage src={item.avatar} alt={item.name} fallbackText={item.name} title="40×40px 艺人头像" className="h-10 w-10 rounded-lg object-cover" />
                    </td>
                    <td className="max-w-[240px] truncate p-3 font-medium text-[#1a1a2e]" title={`${item.name}${item.alias ? ` / ${item.alias}` : ''}`}>{item.name}{item.alias ? ` / ${item.alias}` : ''}</td>
                    <td className="truncate whitespace-nowrap p-3 text-[#666]" title={[item.countryOrRegion, item.artistType].filter(Boolean).join(' / ')}>{[item.countryOrRegion, item.artistType].filter(Boolean).join(' / ') || '-'}</td>
                    <td className="w-24 min-w-[90px] max-w-[140px] truncate p-3 text-[#666]" title={item.categoryTags || ''}>{item.categoryTags || '-'}</td>
                    <td className="max-w-[200px] truncate p-3 text-[#666]" title={item.representativeWorks || ''}>{item.representativeWorks || '-'}</td>
                    <td className="w-24 min-w-[90px] whitespace-nowrap p-3 text-center"><StatusPill label={formatArtistListReviewStatus(item.reviewStatus)} tone={getArtistListReviewTone(item.reviewStatus)} /></td>
                    <td className="w-24 min-w-[90px] whitespace-nowrap p-3 text-center">
                      <div className="flex flex-col gap-1">
                        <StatusPill label={formatArtistListRiskStatus(item.riskStatus)} tone={getArtistListRiskTone(item.riskStatus)} />
                        {item.riskReason && item.riskStatus === 'risky' && <span className="max-w-[120px] truncate text-[12px] text-[#dc2626]" title={item.riskReason}>{item.riskReason}</span>}
                      </div>
                    </td>
                    <td className="w-40 min-w-[150px] whitespace-nowrap p-3 text-center">
                      <div className="flex items-center gap-2 whitespace-nowrap justify-center">
                        {canManageAllArtists && (
                          <button
                            type="button"
                            onClick={() => openRiskModal(item)}
                            disabled={!canToggleRisk || riskSubmitting}
                            className={`inline-flex whitespace-nowrap items-center gap-1 rounded-lg border px-3 py-1.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-60 ${item.riskStatus === 'risky' ? 'border-[#15803d] text-[#15803d] hover:bg-[#f0fdf4]' : 'border-[#dc2626] text-[#dc2626] hover:bg-[#fef2f2]'}`}
                          >
                            <ShieldAlert className="h-3.5 w-3.5" />
                            {formatArtistRiskToggleAction(item.riskStatus)}
                          </button>
                        )}
                        <Link href={`/console/artists/${item.id}/edit`} className="inline-flex items-center gap-1 rounded-lg border border-[#ddd] px-3 py-1.5 text-[13px] text-[#333] hover:border-[#ff1268] hover:text-[#ff1268]">
                          <Edit className="h-3.5 w-3.5" /> 编辑
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="border-t border-[#f0f0f0] px-4 pb-4">
            <GlobalPagination page={page} total={total} pageSize={PAGE_SIZE} loading={loading} onChange={loadData} />
          </div>
        </div>
      )}

      <Modal
        open={Boolean(riskTarget)}
        onClose={closeRiskModal}
        title={riskTarget ? formatArtistRiskToggleAction(riskTarget.riskStatus) : '风险处理'}
        danger={riskTarget ? getNextArtistRiskStatus(riskTarget.riskStatus) === 'risky' : false}
        loading={riskSubmitting}
        footer={(
          <>
            <button type="button" onClick={closeRiskModal} disabled={riskSubmitting} className="rounded-xl border border-[#e5e5e5] bg-white px-5 py-2.5 text-[14px] font-medium text-[#666] hover:bg-[#f5f5f5] disabled:opacity-60">取消</button>
            <button type="button" onClick={submitRiskChange} disabled={riskSubmitting} className="rounded-xl bg-[#dc2626] px-5 py-2.5 text-[14px] font-medium text-white hover:bg-[#b91c1c] disabled:opacity-60">
              {riskSubmitting ? '处理中...' : riskTarget && getNextArtistRiskStatus(riskTarget.riskStatus) === 'risky' ? '确认列入风险' : '确认解除风险'}
            </button>
          </>
        )}
      >
        {riskTarget && getNextArtistRiskStatus(riskTarget.riskStatus) === 'risky' ? (
          <>
            <p className="rounded-xl border border-[#fecaca] bg-[#fef2f2] p-3 text-[14px] leading-6 text-[#dc2626]">{RISK_WARNING}</p>
            <label className="mt-4 block text-[13px] font-medium text-[#333]">
              风险原因 (reason) *
              <textarea
                value={riskReason}
                onChange={event => {
                  setRiskReason(event.target.value)
                  if (event.target.value.trim()) setRiskError('')
                }}
                rows={4}
                placeholder="请输入列入风险的具体原因"
                className={`mt-1 w-full resize-none rounded-xl border p-3 text-[14px] outline-none ${riskError ? 'border-[#dc2626]' : 'border-[#e5e5e5] focus:border-[#ff1268]'}`}
              />
            </label>
            {riskError && <div className="mt-1.5 text-[13px] text-[#dc2626]">{riskError}</div>}
          </>
        ) : riskTarget ? (
          <p className="text-[14px] leading-6 text-[#666]">确认解除艺人“{riskTarget.name}”的风险状态？解除后活动仍需按既有审核与上架规则恢复售票。</p>
        ) : null}
      </Modal>
    </div>
  )
}

function StatusPill({ label, tone }: { label: string; tone: 'green' | 'red' | 'yellow' | 'gray' }) {
  const className = tone === 'green' ? 'bg-[#f0fdf4] text-[#15803d]' : tone === 'red' ? 'bg-[#fef2f2] text-[#dc2626]' : tone === 'yellow' ? 'bg-[#fffbeb] text-[#b45309]' : 'bg-[#f5f5f5] text-[#666]'
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] ${className}`}>{label}</span>
}
