'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, Search, ShieldOff, XCircle } from 'lucide-react'
import { approveOrganizerApplication, deactivateOrganizer, getUserInfo, listOrganizerApplications, rejectOrganizerApplication } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'
import { canUseConsoleAction } from '@/lib/console-auth'
import { globalAlert, globalConfirm } from '@/components/GlobalDialog'
import type { OrganizerApplicationStatus, OrganizerApplicationVO, UserInfo } from '@/types/api'

const STATUS_OPTIONS: Array<{ value: OrganizerApplicationStatus | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 0, label: '待审核' },
  { value: 1, label: '已通过' },
  { value: 2, label: '已驳回' },
]

function statusMeta(status: OrganizerApplicationStatus) {
  if (status === 0) return { text: '待审核', color: '#ff7a00', bg: '#fff7ed' }
  if (status === 1) return { text: '已通过', color: '#16a34a', bg: '#f0fdf4' }
  if (status === 2) return { text: '已驳回', color: '#ef4444', bg: '#fef2f2' }
  return { text: '未知入驻状态', color: '#6b7280', bg: '#f3f4f6' }
}

function organizerStatusMeta(status: OrganizerApplicationVO['organizerStatus']) {
  if (status === 3) return { text: '已取消主办方', color: '#ef4444', bg: '#fef2f2' }
  if (status === 1) return { text: '主办方有效', color: '#16a34a', bg: '#f0fdf4' }
  if (status === 2) return { text: '认证已拒绝', color: '#ef4444', bg: '#fef2f2' }
  if (status === 0) return { text: '认证待审核', color: '#ff7a00', bg: '#fff7ed' }
  return { text: '未知主办方状态', color: '#6b7280', bg: '#f3f4f6' }
}

function isKnownOrganizerStatus(status?: number | null) {
  return status === 0 || status === 1 || status === 2 || status === 3
}

function isCancelledOrganizerAccount(item: OrganizerApplicationVO) {
  return item.organizerStatus === 3 || item.role === 'user'
}

function canDeactivateOrganizerAccount(item: OrganizerApplicationVO) {
  return item.status === 1 && item.organizerStatus === 1 && item.role !== 'user'
}

function isKnownOrganizerApplicationStatus(status?: number | null) {
  return status === 0 || status === 1 || status === 2
}

function isReviewableOrganizerApplicationStatus(status?: number | null) {
  return status === 0
}

export default function OrganizerApplicationsPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrganizerApplicationStatus | 'all'>('all')
  const [items, setItems] = useState<OrganizerApplicationVO[]>([])
  const [keyword, setKeyword] = useState('')
  const [reviewNote, setReviewNote] = useState('')

  const loadData = async (status: OrganizerApplicationStatus | 'all' = statusFilter) => {
    setLoading(true)
    setError('')
    try {
      const list = await listOrganizerApplications(status === 'all' ? undefined : status)
      setItems(list)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载入驻申请失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login?ru=/console/organizer-applications')
      return
    }

    let active = true
    ;(async () => {
      try {
        const info = await getUserInfo()
        if (!active) return
        if (!canUseConsoleAction('organizer.review', info.permissionCodes || [])) {
          router.replace('/console')
          return
        }
        setUser(info)
        await loadData('all')
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : '校验后台权限失败')
      }
    })()

    return () => {
      active = false
    }
  }, [router])

  useEffect(() => {
    if (!user) return
    void loadData(statusFilter)
  }, [statusFilter, user])

  const filteredItems = useMemo(() => {
    const query = keyword.trim().toLowerCase()
    if (!query) return items
    return items.filter((item) => {
      return [item.organizerName, item.contactName, item.contactPhone, item.phone || '', item.nickname || '']
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
  }, [items, keyword])

  const handleApprove = async (item: OrganizerApplicationVO) => {
    if (!isReviewableOrganizerApplicationStatus(item.status)) {
      setError('入驻审核状态待核对，请刷新后再操作')
      return
    }
    setSavingId(item.id)
    setError('')
    try {
      await approveOrganizerApplication(item.id, reviewNote.trim() || undefined)
      setReviewNote('')
      await loadData(statusFilter)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '通过申请失败')
    } finally {
      setSavingId(null)
    }
  }

  const handleReject = async (item: OrganizerApplicationVO) => {
    if (!isReviewableOrganizerApplicationStatus(item.status)) {
      setError('入驻审核状态待核对，请刷新后再操作')
      return
    }
    const note = reviewNote.trim()
    if (!note) {
      setError('驳回时必须填写原因')
      return
    }
    setSavingId(item.id)
    setError('')
    try {
      await rejectOrganizerApplication(item.id, note)
      setReviewNote('')
      await loadData(statusFilter)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '驳回申请失败')
    } finally {
      setSavingId(null)
    }
  }

  const handleDeactivate = async (item: OrganizerApplicationVO) => {
    if (!user) return
    if (!canDeactivateOrganizerAccount(item)) {
      setError(isKnownOrganizerStatus(item.organizerStatus) ? '当前主办方状态不能取消' : '主办方状态待核对，请刷新后再操作')
      return
    }
    const confirmed = await globalConfirm(`取消主办方后，${item.organizerName} 将降级为普通用户并无法继续访问后台；其旗下全部活动、场次、票档将下架，并直接为关联已支付订单发起真实支付宝退款。“同意退款”表示你确认平台将对这批已支付订单执行退款，可能产生退款失败、结果未知或需人工处理的记录。请确认：同意取消主办方并同意退款。`)
    if (!confirmed) return
    setSavingId(item.id)
    setError('')
    try {
      const result = await deactivateOrganizer({
        userId: user.id,
        organizerId: item.userId,
        confirmRefund: true,
        reason: '管理员取消主办方自动退款',
      })
      const abnormalCount = result.refundFailedCount + result.refundUnknownCount + result.refundCompensationRequiredCount
      const summary = `已下架活动 ${result.deactivatedActivityCount} 个，已支付订单 ${result.paidOrderCount} 笔，退款成功 ${result.refundSuccessCount} 笔，退款失败 ${result.refundFailedCount} 笔，结果未知 ${result.refundUnknownCount} 笔，需人工处理 ${result.refundCompensationRequiredCount} 笔。`
      await globalAlert(abnormalCount > 0 ? `主办方已取消，但部分退款异常。${summary}` : `主办方已取消。${summary}`)
      await loadData(statusFilter)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '取消主办方失败')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[24px] font-bold text-[#1a1a2e]">主办方管理</h1>
          <p className="mt-2 text-sm text-[#666]">管理员管理主办方入驻申请，支持通过、驳回与取消主办方。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((item) => (
            <button
              key={String(item.value)}
              onClick={() => setStatusFilter(item.value)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                statusFilter === item.value ? 'bg-[#ff1268] text-white' : 'bg-white text-[#666] border border-[#e5e5e5]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-[#e5e5e5] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999]" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索商户名称、联系人、手机号"
              className="w-full rounded-2xl border border-[#e5e5e5] bg-[#fafafa] py-3 pl-10 pr-4 text-sm outline-none focus:border-[#ff1268]"
            />
          </div>
          <div className="text-sm text-[#666]">共 {filteredItems.length} 条申请</div>
        </div>
        <div className="mt-3">
          <textarea
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            rows={3}
            placeholder="审核备注，驳回时请填写原因"
            className="w-full rounded-2xl border border-[#e5e5e5] bg-[#fafafa] px-4 py-3 text-sm outline-none focus:border-[#ff1268]"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-[#e5e5e5] bg-white shadow-sm">
          <div className="flex items-center gap-3 text-[#666]">
            <Loader2 className="h-5 w-5 animate-spin text-[#ff1268]" />
            正在加载入驻申请...
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-[#ffd9e6] bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-[#ff4d4f]">{error}</p>
          <button
            onClick={() => loadData(statusFilter)}
            className="mt-4 rounded-full bg-[#ff1268] px-5 py-2 text-sm font-medium text-white"
          >
            重新加载
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-10 text-center text-sm text-[#666] shadow-sm">
          暂无符合条件的入驻申请
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => {
            const meta = statusMeta(item.status)
            const userStatusMeta = organizerStatusMeta(item.organizerStatus)
            const isCancelled = isCancelledOrganizerAccount(item)
            const reviewable = isReviewableOrganizerApplicationStatus(item.status)
            const canDeactivate = canDeactivateOrganizerAccount(item)
            return (
              <div key={item.id} className="rounded-xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[18px] font-semibold text-[#111]">{item.organizerName}</h2>
                      <span
                        className="rounded-full px-3 py-1 text-xs font-medium"
                        style={{ color: meta.color, backgroundColor: meta.bg }}
                      >
                        {meta.text}
                      </span>
                      <span
                        className="rounded-full px-3 py-1 text-xs font-medium"
                        style={{ color: userStatusMeta.color, backgroundColor: userStatusMeta.bg }}
                      >
                        {userStatusMeta.text}
                      </span>
                    </div>
                    <div className="grid gap-2 text-sm text-[#666] sm:grid-cols-2 lg:grid-cols-3">
                      <span>联系人：{item.contactName}</span>
                      <span>联系电话：{item.contactPhone}</span>
                      <span>联系邮箱：{item.contactEmail || '未填写'}</span>
                      <span>主体类型：{item.subjectType === 'enterprise' ? '企业' : '个人'}</span>
                      <span>手机号：{item.phone || '未绑定'}</span>
                      <span>昵称：{item.nickname || '未设置'}</span>
                    </div>
                    <div className="text-sm text-[#666]">营业执照号：{item.licenseNo || '未填写'}</div>
                    <div className="text-sm text-[#666]">经营范围：{item.businessScope || '未填写'}</div>
                    <div className="text-sm text-[#666]">申请说明：{item.description || '未填写'}</div>
                    {item.reviewNote ? <div className="text-sm text-[#111]">审核备注：{item.reviewNote}</div> : null}
                  </div>
                  <div className="flex flex-col gap-2 lg:min-w-[160px] lg:items-end">
                    <button
                      onClick={() => handleApprove(item)}
                      disabled={savingId === item.id || !reviewable}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-[#16a34a] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#13813b] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      通过
                    </button>
                    <button
                      onClick={() => handleReject(item)}
                      disabled={savingId === item.id || !reviewable}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-[#ef4444] px-4 py-2 text-sm font-medium text-[#ef4444] transition-colors hover:bg-[#fef2f2] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <XCircle className="h-4 w-4" />
                      驳回
                    </button>
                    <button
                      onClick={() => handleDeactivate(item)}
                      disabled={savingId === item.id || !canDeactivate}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-[#f97316] px-4 py-2 text-sm font-medium text-[#f97316] transition-colors hover:bg-[#fff7ed] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ShieldOff className="h-4 w-4" />
                      {isCancelled ? '已取消主办方' : '取消主办方'}
                    </button>
                    {(!isKnownOrganizerApplicationStatus(item.status) || !isKnownOrganizerStatus(item.organizerStatus)) ? <span className="rounded-full border border-[#ffd591] bg-[#fff7e6] px-3 py-1 text-[12px] text-[#ad6800]">状态待核对</span> : null}
                    <div className="text-xs text-[#999]">驳回前请在上方备注框填写原因</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
