'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { SafeImage } from '@/components/SafeImage'
import { CONSOLE_TABLE_HEADER_CLASS, ConsoleTable } from '@/components/ConsoleTable'
import { DEFAULT_PAGE_SIZE, GlobalPagination } from '@/components/Pagination'
import { Drawer } from '@/components/ui/Drawer'
import {
  approveAdminArtist,
  getUserInfo,
  listPendingAdminArtists,
  markRiskAdminArtist,
  rejectAdminArtist,
} from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'
import { canUseConsoleAction } from '@/lib/console-auth'
import { formatArtistListReviewStatus, isReviewableArtistReviewStatus } from '@/lib/console-artists'
import type { ArtistEntity, ArtistListParams, UserInfo } from '@/types/api'

type ArtistTabKey = 'pending' | 'approved' | 'rejected' | 'risky'
type QualificationStatus = '' | 'uploaded' | 'pending'

const TABS: Array<{ key: ArtistTabKey; label: string; params: Pick<ArtistListParams, 'status' | 'riskStatus'> }> = [
  { key: 'pending', label: '待审核档案', params: { status: 'pending' } },
  { key: 'approved', label: '正式艺人库归档', params: { status: 'approved' } },
  { key: 'rejected', label: '已驳回记录', params: { status: 'rejected' } },
  { key: 'risky', label: '风控拦截名单', params: { status: 'all', riskStatus: 'risky' } },
]

const CATEGORY_OPTIONS = ['流行音乐/演唱会', '戏剧/话剧歌剧', '亲子儿童剧', '舞蹈芭蕾', '独立音乐']

const QUALIFICATION_OPTIONS: Array<{ value: QualificationStatus; label: string }> = [
  { value: '', label: '全部资质完整度' },
  { value: 'uploaded', label: '已上传经纪授权公函' },
  { value: 'pending', label: '授权材料待核实' },
]

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function splitText(value?: string | null) {
  return (value || '').split(/[、,，\n]/).map(item => item.trim()).filter(Boolean)
}

function getQualificationLabel(item: ArtistEntity) {
  return item.sourceNote?.trim() ? '经纪授权书 [已核验]' : '授权材料待核实'
}

function extractAttachmentUrl(item: ArtistEntity) {
  const note = item.sourceNote?.trim()
  if (!note) return ''
  const match = note.match(/https?:\/\/\S+|\/[^\s，,]+/)
  return match?.[0] || ''
}

function isImageUrl(url: string) {
  return /\.(png|jpe?g|webp|gif|bmp)(\?.*)?$/i.test(url)
}

function statusClassName(status?: string | null, riskStatus?: string | null) {
  if (riskStatus === 'risky') return 'bg-[#fef2f2] text-[#dc2626]'
  if (status === 'approved') return 'bg-[#f0fdf4] text-[#15803d]'
  if (status === 'rejected') return 'bg-[#fef2f2] text-[#b91c1c]'
  return 'bg-[#fffbeb] text-[#b45309]'
}

export default function PendingArtistsPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [items, setItems] = useState<ArtistEntity[]>([])
  const [activeTab, setActiveTab] = useState<ArtistTabKey>('pending')
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('')
  const [qualificationStatus, setQualificationStatus] = useState<QualificationStatus>('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [selected, setSelected] = useState<ArtistEntity | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [riskReason, setRiskReason] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingAction, setSavingAction] = useState<'approve' | 'reject' | 'risk' | null>(null)
  const [error, setError] = useState('')

  const activeTabConfig = useMemo(() => TABS.find(tab => tab.key === activeTab) || TABS[0], [activeTab])

  const loadPendingCount = useCallback(async () => {
    try {
      const res = await listPendingAdminArtists({ page: 1, size: 1, status: 'pending' })
      setPendingCount(res.total)
    } catch {
      setPendingCount(0)
    }
  }, [])

  const loadData = useCallback(async (nextPage = page) => {
    setLoading(true)
    setError('')
    try {
      const res = await listPendingAdminArtists({
        page: nextPage,
        size: DEFAULT_PAGE_SIZE,
        keyword,
        category,
        qualificationStatus,
        ...activeTabConfig.params,
      })
      setItems(res.records || [])
      setTotal(res.total || 0)
      setPage(res.current || nextPage)
      if (activeTab === 'pending') setPendingCount(res.total || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载艺人档案审核列表失败')
    } finally {
      setLoading(false)
    }
  }, [activeTab, activeTabConfig.params, category, keyword, page, qualificationStatus])

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login?ru=/console/artists/pending')
      return
    }
    let active = true
    ;(async () => {
      try {
        const info = await getUserInfo()
        if (!active) return
        if (!canUseConsoleAction('artist.manage', info.permissionCodes || [])) {
          router.replace('/console')
          return
        }
        setUser(info)
        await loadPendingCount()
        await loadData(1)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : '校验后台权限失败')
      }
    })()
    return () => { active = false }
  }, [loadData, loadPendingCount, router])

  useEffect(() => {
    if (!user) return
    void loadData(page)
  }, [activeTab, category, qualificationStatus, keyword, page, user])

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    setKeyword(keywordInput.trim())
  }

  const openDrawer = (item: ArtistEntity) => {
    setSelected(item)
    setReviewNote('')
    setRiskReason('')
    setReviewError('')
  }

  const closeDrawer = () => {
    if (savingAction) return
    setSelected(null)
    setReviewError('')
  }

  const refreshAfterAction = async () => {
    setSelected(null)
    setReviewNote('')
    setRiskReason('')
    await loadPendingCount()
    await loadData(page)
  }

  const approveArtist = async () => {
    if (!selected) return
    setSavingAction('approve')
    setReviewError('')
    try {
      await approveAdminArtist(selected.id, { note: reviewNote.trim() || null })
      await refreshAfterAction()
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : '审核通过失败')
    } finally {
      setSavingAction(null)
    }
  }

  const rejectArtist = async () => {
    if (!selected) return
    const note = reviewNote.trim()
    if (!note) {
      setReviewError('驳回整改原因不能为空')
      return
    }
    setSavingAction('reject')
    setReviewError('')
    try {
      await rejectAdminArtist(selected.id, { note })
      await refreshAfterAction()
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : '驳回整改失败')
    } finally {
      setSavingAction(null)
    }
  }

  const markRisk = async () => {
    if (!selected) return
    const reason = riskReason.trim()
    if (!reason) {
      setReviewError('风控判定依据不能为空')
      return
    }
    setSavingAction('risk')
    setReviewError('')
    try {
      await markRiskAdminArtist(selected.id, { reason })
      await refreshAfterAction()
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : '标记风险艺人失败')
    } finally {
      setSavingAction(null)
    }
  }

  const selectedAttachmentUrl = selected ? extractAttachmentUrl(selected) : ''
  const canReviewSelected = selected ? isReviewableArtistReviewStatus(selected.reviewStatus) : false

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[24px] font-bold text-[#1a1a2e]">艺人档案审核</h1>
        <p className="mt-1 text-[14px] text-[#666]">集中处理艺人入库、驳回整改与风控拦截。</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => { setActiveTab(tab.key); setPage(1) }}
            className={`rounded-full border px-3 py-1.5 text-[13px] ${activeTab === tab.key ? 'border-[#ff1268] bg-[#fff0f5] text-[#ff1268]' : 'border-[#e5e5e5] bg-white text-[#666]'}`}
          >
            {tab.label}
            {tab.key === 'pending' ? <span className="ml-2 rounded-full bg-[#ff1268] px-2 py-0.5 text-[11px] text-white">{pendingCount}</span> : null}
          </button>
        ))}
      </div>

      <form onSubmit={submitSearch} className="grid gap-3 rounded-xl border border-[#e5e5e5] bg-white p-4 lg:grid-cols-[1fr_190px_190px_auto]">
        <input
          value={keywordInput}
          onChange={event => setKeywordInput(event.target.value)}
          placeholder="搜索艺人名称、外文名、代表作品、提报主办方"
          className="h-10 rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]"
        />
        <select value={category} onChange={event => { setCategory(event.target.value); setPage(1) }} className="h-10 rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]">
          <option value="">全部艺术类目</option>
          {CATEGORY_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
        <select value={qualificationStatus} onChange={event => { setQualificationStatus(event.target.value as QualificationStatus); setPage(1) }} className="h-10 rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]">
          {QUALIFICATION_OPTIONS.map(option => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
        </select>
        <button type="submit" className="h-10 rounded-lg bg-[#ff1268] px-5 text-[14px] font-medium text-white hover:bg-[#e0105a]">搜索</button>
      </form>

      {error ? <div className="rounded-xl bg-[#fef2f2] p-3 text-[14px] text-[#dc2626]">{error}</div> : null}

      <ConsoleTable
        loading={loading}
        skeletonRows={6}
        skeletonColumns={7}
        footer={<GlobalPagination page={page} total={total} pageSize={DEFAULT_PAGE_SIZE} loading={loading} onChange={setPage} />}
      >
          <table className="w-full table-fixed text-left text-[13px]">
            <thead className={CONSOLE_TABLE_HEADER_CLASS}>
              <tr>
                <th className="w-[24%] px-4 py-3">艺人/团体基本信息</th>
                <th className="w-[12%] px-4 py-3">艺术类目标签</th>
                <th className="w-[18%] px-4 py-3">代表作品 / 代表剧目</th>
                <th className="w-[14%] px-4 py-3">提报主办方</th>
                <th className="w-[16%] px-4 py-3">演艺合规资质附件状态</th>
                <th className="w-[9%] px-4 py-3">审核状态</th>
                <th className="w-[7%] whitespace-nowrap px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-[#999]">加载中...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-[#999]">暂无符合条件的艺人档案</td></tr>
              ) : items.map(item => (
                <tr key={item.id} onClick={() => openDrawer(item)} className="cursor-pointer align-middle text-[#333] hover:bg-[#fafafa]">
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <SafeImage src={item.avatar} alt={item.name} fallbackText={item.name} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-[#1a1a2e]" title={item.name}>{item.name}</div>
                        <div className="mt-1 truncate text-[12px] text-[#999]" title={item.alias || ''}>{item.alias || '暂无外文名'}</div>
                        <span className="mt-1 inline-flex rounded-full bg-[#f5f5f5] px-2 py-0.5 text-[11px] text-[#666]">{item.artistType || '个人/团体待核实'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="truncate px-4 py-3" title={item.categoryTags || ''}>{item.categoryTags || '-'}</td>
                  <td className="truncate px-4 py-3 text-[#666]" title={item.representativeWorks || ''}>{item.representativeWorks || '-'}</td>
                  <td className="truncate px-4 py-3 text-[#666]" title={item.agency || ''}>{item.agency || '-'}</td>
                  <td className="truncate px-4 py-3 text-[#666]" title={item.sourceNote || ''}>{getQualificationLabel(item)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] ${statusClassName(item.reviewStatus, item.riskStatus)}`}>
                      {item.riskStatus === 'risky' ? '风险拦截' : formatArtistListReviewStatus(item.reviewStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={event => { event.stopPropagation(); openDrawer(item) }} className="whitespace-nowrap rounded-lg border border-[#ff1268] px-3 py-1.5 text-[12px] text-[#ff1268] hover:bg-[#fff0f5]">
                      {isReviewableArtistReviewStatus(item.reviewStatus) ? '资质审核' : '查看档案'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </ConsoleTable>

      <Drawer open={Boolean(selected)} onClose={closeDrawer} title={selected ? `${isReviewableArtistReviewStatus(selected.reviewStatus) ? '资质审核' : '查看档案'}：${selected.name}` : '艺人档案'} width="w-[640px]" loading={Boolean(savingAction)}>
        {selected ? (
          <div className="space-y-5 text-[13px] text-[#555]">
            <section className="rounded-xl border border-[#e5e5e5] p-4">
              <div className="mb-3 text-[15px] font-semibold text-[#1a1a2e]">基本档案</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoItem label="艺人全称" value={selected.name} />
                <InfoItem label="外文名" value={selected.alias || '-'} />
                <InfoItem label="国籍/地区" value={selected.countryOrRegion || '-'} />
                <InfoItem label="艺术类目" value={selected.categoryTags || selected.artistType || '-'} />
                <InfoItem label="提报主办方" value={selected.agency || '-'} />
                <InfoItem label="提报人编号" value={selected.submittedBy ? String(selected.submittedBy) : '-'} />
                <InfoItem label="审核状态" value={selected.riskStatus === 'risky' ? '风险拦截' : formatArtistListReviewStatus(selected.reviewStatus)} />
                <InfoItem label="审核时间" value={formatDate(selected.reviewedAt)} />
              </div>
              <div className="mt-4">
                <div className="mb-2 font-medium text-[#333]">代表作品列表</div>
                <div className="flex flex-wrap gap-2">
                  {(splitText(selected.representativeWorks).length ? splitText(selected.representativeWorks) : ['暂无代表作品']).map(work => (
                    <span key={work} className="rounded-full bg-[#f5f5f5] px-2.5 py-1 text-[12px] text-[#666]">{work}</span>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <div className="mb-2 font-medium text-[#333]">艺术简历</div>
                <p className="whitespace-pre-wrap rounded-lg bg-[#fafafa] p-3 leading-6">{selected.description || '暂无艺术简历'}</p>
              </div>
            </section>

            <section className="rounded-xl border border-[#e5e5e5] p-4">
              <div className="mb-3 text-[15px] font-semibold text-[#1a1a2e]">演出经纪授权公函</div>
              {selectedAttachmentUrl ? (
                isImageUrl(selectedAttachmentUrl) ? (
                  <SafeImage src={selectedAttachmentUrl} alt="经纪授权公函" className="h-44 w-full rounded-lg border border-[#e5e5e5] object-cover" />
                ) : (
                  <a href={selectedAttachmentUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-lg border border-[#ff1268] px-4 py-2 text-[#ff1268] hover:bg-[#fff0f5]">打开 PDF / 附件验真入口</a>
                )
              ) : (
                <div className="rounded-lg bg-[#fffbeb] p-3 text-[#b45309]">暂未发现结构化附件，仅可依据资质说明进行人工核验。</div>
              )}
              {selected.sourceNote ? <p className="mt-3 whitespace-pre-wrap leading-6 text-[#666]">{selected.sourceNote}</p> : null}
            </section>

            {canReviewSelected ? (
              <section className="rounded-xl border border-[#ffd9e6] bg-[#fffafd] p-4">
                <div className="mb-3 text-[15px] font-semibold text-[#1a1a2e]">决策操作区</div>
                <label className="block font-medium text-[#333]">
                  审核意见
                  <textarea
                    value={reviewNote}
                    onChange={event => {
                      setReviewNote(event.target.value)
                      if (event.target.value.trim()) setReviewError('')
                    }}
                    rows={4}
                    placeholder="请输入审核意见；驳回整改时必填"
                    className={`mt-1 w-full resize-none rounded-lg border p-3 text-[14px] outline-none ${reviewError ? 'border-[#dc2626]' : 'border-[#e5e5e5] focus:border-[#ff1268]'}`}
                  />
                </label>
                <label className="mt-3 block font-medium text-[#333]">
                  风控判定依据
                  <textarea
                    value={riskReason}
                    onChange={event => {
                      setRiskReason(event.target.value)
                      if (event.target.value.trim()) setReviewError('')
                    }}
                    rows={3}
                    placeholder="标记为风险艺人时必须填写依据"
                    className={`mt-1 w-full resize-none rounded-lg border p-3 text-[14px] outline-none ${reviewError ? 'border-[#dc2626]' : 'border-[#e5e5e5] focus:border-[#ff1268]'}`}
                  />
                </label>
                {reviewError ? <div className="mt-2 rounded-lg bg-[#fef2f2] px-3 py-2 text-[#dc2626]">{reviewError}</div> : null}
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button type="button" disabled={Boolean(savingAction)} onClick={approveArtist} className="rounded-lg bg-[#16a34a] px-4 py-2 text-white disabled:opacity-60">{savingAction === 'approve' ? '提交中...' : '审核通过并入库'}</button>
                  <button type="button" disabled={Boolean(savingAction)} onClick={rejectArtist} className="rounded-lg bg-[#f97316] px-4 py-2 text-white disabled:opacity-60">{savingAction === 'reject' ? '提交中...' : '驳回整改'}</button>
                  <button type="button" disabled={Boolean(savingAction)} onClick={markRisk} className="rounded-lg bg-[#dc2626] px-4 py-2 text-white disabled:opacity-60">{savingAction === 'risk' ? '提交中...' : '标记为风险艺人'}</button>
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[12px] text-[#999]">{label}</div>
      <div className="mt-1 truncate font-medium text-[#333]" title={value}>{value}</div>
    </div>
  )
}
