'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Eye, FileImage, Loader2, Search, ShieldOff, XCircle } from 'lucide-react'
import {
  approveOrganizerApplication,
  batchOrganizerOnsaleSummary,
  getUserInfo,
  listOrganizerApplications,
  listOrganizers,
  rejectOrganizerApplication,
  revokeOrganizer,
} from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'
import { canUseConsoleAction } from '@/lib/console-auth'
import { GlobalPagination } from '@/components/Pagination'
import { Drawer } from '@/components/ui/Drawer'
import { Modal } from '@/components/ui/Modal'
import { SafeImage } from '@/components/SafeImage'
import type { OrganizerApplicationStatus, OrganizerApplicationVO, PageResult, SubjectType, UserInfo } from '@/types/api'

type Tab = 'applications' | 'directory'
type ApplicationFilterStatus = 'all' | 'PENDING' | 'APPROVED' | 'REJECTED'
type CooperationStatus = 'all' | 'ACTIVE' | 'FROZEN'

interface MaterialRecord {
  id: number
  materialType: string
  assetId: number
  publicUrl: string | null
  originalName: string | null
  mimeType: string | null
  sizeBytes: number | null
  createTime: string | null
}

type ApplicationRecord = OrganizerApplicationVO & { materials?: MaterialRecord[] | null }

interface OrganizerRecord {
  organizerId: number
  organizerName: string
  subjectType: SubjectType | null
  qualificationNo: string | null
  contactName: string | null
  contactPhone: string | null
  followUpOperatorId: number | null
  followUpOperatorName: string | null
  onsaleActivityCount: number | null
  cooperationStatus: string | null
}

const PAGE_SIZE = 10
const EMPTY_PAGE = <T,>(): PageResult<T> => ({ records: [], total: 0, size: PAGE_SIZE, current: 1, pages: 0 })

const APPLICATION_STATUS_OPTIONS: Array<{ value: ApplicationFilterStatus; label: string }> = [
  { value: 'all', label: '全部状态' },
  { value: 'PENDING', label: '待审核' },
  { value: 'APPROVED', label: '已通过' },
  { value: 'REJECTED', label: '已驳回' },
]
const SUBJECT_TYPE_OPTIONS: Array<{ value: 'all' | SubjectType; label: string }> = [
  { value: 'all', label: '全部主体' },
  { value: 'enterprise', label: '企业' },
  { value: 'personal', label: '个人' },
]
const COOPERATION_STATUS_OPTIONS: Array<{ value: CooperationStatus; label: string }> = [
  { value: 'all', label: '全部合作状态' },
  { value: 'ACTIVE', label: '合作中' },
  { value: 'FROZEN', label: '已冻结' },
]

function applicationStatusMeta(status: OrganizerApplicationStatus | string | null | undefined) {
  if (status === 0 || status === 'PENDING') return { text: '待审核', color: '#d46b08', bg: '#fff7e6' }
  if (status === 1 || status === 'APPROVED') return { text: '已通过', color: '#389e0d', bg: '#f6ffed' }
  if (status === 2 || status === 'REJECTED') return { text: '已驳回', color: '#cf1322', bg: '#fff1f0' }
  return { text: '状态待核对', color: '#595959', bg: '#f5f5f5' }
}

function subjectTypeLabel(subjectType: SubjectType | null | undefined) {
  if (subjectType === 'enterprise') return '企业'
  if (subjectType === 'personal') return '个人'
  return '未填写'
}

function isPendingApplication(application: ApplicationRecord) {
  const status = application.status as unknown
  return status === 0 || status === 'PENDING'
}

function isActiveOrganizer(organizer: OrganizerRecord) {
  return organizer.cooperationStatus === 'ACTIVE'
}

function normalizeActivitySummary(value: Record<string, number> | Array<{ organizerId: number; onsaleActivityCount: number | null }>) {
  if (Array.isArray(value)) {
    return value.reduce<Record<number, number>>((result, item) => {
      if (Number.isFinite(item.onsaleActivityCount)) result[item.organizerId] = Number(item.onsaleActivityCount)
      return result
    }, {})
  }
  return Object.entries(value || {}).reduce<Record<number, number>>((result, [organizerId, count]) => {
    if (Number.isFinite(Number(count))) result[Number(organizerId)] = Number(count)
    return result
  }, {})
}

function formatMaterialType(materialType: string) {
  if (materialType === 'BUSINESS_LICENSE') return '营业执照'
  if (materialType === 'ID_CARD_FRONT') return '身份证正面'
  if (materialType === 'ID_CARD_BACK') return '身份证反面'
  if (materialType === 'OTHER_QUALIFICATION') return '其他资质'
  return '其他材料'
}

function formatDate(value: string | null | undefined) {
  return value ? value.replace('T', ' ').slice(0, 16) : '未记录'
}

export default function OrganizerApplicationsPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('applications')
  const [error, setError] = useState('')
  const [applicationPage, setApplicationPage] = useState(1)
  const [applicationKeyword, setApplicationKeyword] = useState('')
  const [applicationStatus, setApplicationStatus] = useState<ApplicationFilterStatus>('all')
  const [subjectType, setSubjectType] = useState<'all' | SubjectType>('all')
  const [applicationData, setApplicationData] = useState<PageResult<ApplicationRecord>>(EMPTY_PAGE)
  const [applicationLoading, setApplicationLoading] = useState(false)
  const [organizerPage, setOrganizerPage] = useState(1)
  const [organizerKeyword, setOrganizerKeyword] = useState('')
  const [followUpOperator, setFollowUpOperator] = useState('')
  const [cooperationStatus, setCooperationStatus] = useState<CooperationStatus>('all')
  const [organizerData, setOrganizerData] = useState<PageResult<OrganizerRecord>>(EMPTY_PAGE)
  const [organizerLoading, setOrganizerLoading] = useState(false)
  const [activityCounts, setActivityCounts] = useState<Record<number, number>>({})
  const [activityCountLoading, setActivityCountLoading] = useState(false)
  const [activityCountFailed, setActivityCountFailed] = useState(false)
  const [selectedApplication, setSelectedApplication] = useState<ApplicationRecord | null>(null)
  const [selectedOrganizer, setSelectedOrganizer] = useState<OrganizerRecord | null>(null)
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialRecord | null>(null)
  const [reviewDialog, setReviewDialog] = useState<{ item: ApplicationRecord; action: 'approve' | 'reject'; note: string } | null>(null)
  const [revokeDialog, setRevokeDialog] = useState<{ item: OrganizerRecord; reason: string } | null>(null)
  const [dialogError, setDialogError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login?ru=/console/organizer-applications')
      return
    }
    let active = true
    void getUserInfo()
      .then(info => {
        if (!active) return
        const permissions = info.permissionCodes || []
        if (!canUseConsoleAction('organizer.review', permissions) && !canUseConsoleAction('organizer.account.manage', permissions)) {
          router.replace('/console')
          return
        }
        setUser(info)
      })
      .catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : '校验后台权限失败')
      })
    return () => { active = false }
  }, [router])

  useEffect(() => {
    if (!user || activeTab !== 'applications') return
    let active = true
    setApplicationLoading(true)
    setError('')
    void listOrganizerApplications({
      page: applicationPage,
      size: PAGE_SIZE,
      keyword: applicationKeyword.trim() || undefined,
      status: applicationStatus === 'all' ? undefined : applicationStatus,
      subjectType: subjectType === 'all' ? undefined : subjectType,
    })
      .then(data => { if (active) setApplicationData(data || EMPTY_PAGE<ApplicationRecord>()) })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : '加载入驻申请失败') })
      .finally(() => { if (active) setApplicationLoading(false) })
    return () => { active = false }
  }, [activeTab, applicationKeyword, applicationPage, applicationStatus, subjectType, user])

  useEffect(() => {
    if (!user || activeTab !== 'directory') return
    let active = true
    setOrganizerLoading(true)
    setError('')
    void listOrganizers({
      page: organizerPage,
      size: PAGE_SIZE,
      keyword: organizerKeyword.trim() || undefined,
      followUpOperator: followUpOperator.trim() || undefined,
      cooperationStatus: cooperationStatus === 'all' ? undefined : cooperationStatus,
    })
      .then(data => { if (active) setOrganizerData(data || EMPTY_PAGE<OrganizerRecord>()) })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : '加载主办方名录失败') })
      .finally(() => { if (active) setOrganizerLoading(false) })
    return () => { active = false }
  }, [activeTab, cooperationStatus, followUpOperator, organizerKeyword, organizerPage, user])

  useEffect(() => {
    if (activeTab !== 'directory' || organizerData.records.length === 0) {
      setActivityCounts({})
      setActivityCountFailed(false)
      setActivityCountLoading(false)
      return
    }
    const organizerIds = organizerData.records.map(item => item.organizerId).filter(id => Number.isInteger(id) && id > 0)
    if (organizerIds.length === 0) {
      setActivityCountLoading(false)
      return
    }
    let active = true
    setActivityCounts({})
    setActivityCountFailed(false)
    setActivityCountLoading(true)
    void batchOrganizerOnsaleSummary(organizerIds, { timeoutMs: 3000 })
      .then(summary => { if (active) setActivityCounts(normalizeActivitySummary(summary)) })
      .catch(() => { if (active) setActivityCountFailed(true) })
      .finally(() => { if (active) setActivityCountLoading(false) })
    return () => { active = false }
  }, [activeTab, organizerData.records])

  const applicationRows = useMemo(() => applicationData.records || [], [applicationData.records])
  const organizerRows = useMemo(() => organizerData.records || [], [organizerData.records])
  const resetApplicationPage = <T extends string>(setter: Dispatch<SetStateAction<T>>, value: T) => { setApplicationPage(1); setter(value) }
  const resetOrganizerPage = <T extends string>(setter: Dispatch<SetStateAction<T>>, value: T) => { setOrganizerPage(1); setter(value) }
  const openApplicationDrawer = (item: ApplicationRecord) => { setSelectedApplication(item); setSelectedOrganizer(null) }
  const openOrganizerDrawer = (item: OrganizerRecord) => { setSelectedOrganizer(item); setSelectedApplication(null) }
  const openReviewDialog = (item: ApplicationRecord, action: 'approve' | 'reject') => { setSelectedApplication(item); setDialogError(''); setReviewDialog({ item, action, note: '' }) }
  const closeReviewDialog = () => { if (!saving) { setReviewDialog(null); setDialogError('') } }
  const submitReview = async () => {
    if (!reviewDialog) return
    const note = reviewDialog.note.trim()
    if (reviewDialog.action === 'reject' && !note) { setDialogError('驳回原因不能为空'); return }
    setSaving(true)
    setDialogError('')
    try {
      if (reviewDialog.action === 'approve') await approveOrganizerApplication(reviewDialog.item.id, note || undefined)
      else await rejectOrganizerApplication(reviewDialog.item.id, note)
      setReviewDialog(null)
      setSelectedApplication(null)
      setApplicationPage(1)
    } catch (reason) {
      setDialogError(reason instanceof Error ? reason.message : '提交审核结果失败')
    } finally { setSaving(false) }
  }
  const openRevokeDialog = (item: OrganizerRecord) => { setSelectedOrganizer(item); setDialogError(''); setRevokeDialog({ item, reason: '' }) }
  const closeRevokeDialog = () => { if (!saving) { setRevokeDialog(null); setDialogError('') } }
  const submitRevoke = async () => {
    if (!revokeDialog) return
    const reason = revokeDialog.reason.trim()
    if (!reason) { setDialogError('取消合作/冻结原因不能为空'); return }
    setSaving(true)
    setDialogError('')
    try {
      await revokeOrganizer(revokeDialog.item.organizerId, reason)
      setRevokeDialog(null)
      setSelectedOrganizer(null)
      setOrganizerPage(1)
    } catch (requestError) {
      setDialogError(requestError instanceof Error ? requestError.message : '冻结主办方失败')
    } finally { setSaving(false) }
  }

  const renderApplicationTable = () => (
    <>
      <div className="overflow-x-auto rounded-lg border border-[#e5e5e5] bg-white">
        <table className="min-w-[980px] w-full text-left text-[13px]">
          <thead className="bg-[#fafafa] text-[12px] font-medium text-[#777]"><tr><th className="whitespace-nowrap px-4 py-3">申请单 / 时间</th><th className="whitespace-nowrap px-4 py-3">主办方与用户</th><th className="whitespace-nowrap px-4 py-3">主体类型</th><th className="whitespace-nowrap px-4 py-3">联系人</th><th className="whitespace-nowrap px-4 py-3">营业执照</th><th className="whitespace-nowrap px-4 py-3">申请状态</th><th className="whitespace-nowrap px-4 py-3 text-right">操作</th></tr></thead>
          <tbody className="divide-y divide-[#f0f0f0]">
            {applicationRows.map(item => {
              const status = applicationStatusMeta(item.status)
              return <tr key={item.id} onClick={() => openApplicationDrawer(item)} className="cursor-pointer transition-colors hover:bg-[#fff8fb]"><td className="px-4 py-4 align-top"><div className="font-medium text-[#222]">#{item.id}</div><div className="mt-1 whitespace-nowrap text-[12px] text-[#999]">{formatDate(item.createTime)}</div></td><td className="px-4 py-4 align-top"><div className="font-medium text-[#222]">{item.organizerName || '未填写'}</div><div className="mt-1 text-[12px] text-[#999]">用户 ID：{item.userId}</div></td><td className="px-4 py-4 align-top text-[#555]">{subjectTypeLabel(item.subjectType)}</td><td className="px-4 py-4 align-top"><div className="text-[#333]">{item.contactName || '未填写'}</div><div className="mt-1 text-[12px] text-[#999]">{item.contactPhone || item.phone || '未填写'}</div></td><td className="px-4 py-4 align-top">{item.materials?.some(material => material.materialType === 'BUSINESS_LICENSE') || item.licenseNo ? <span className="text-[#389e0d]">已提供</span> : <span className="text-[#999]">未上传</span>}</td><td className="px-4 py-4 align-top"><span className="inline-flex rounded-md px-2 py-1 text-[12px] font-medium" style={{ color: status.color, backgroundColor: status.bg }}>{status.text}</span></td><td className="px-4 py-4 align-top"><div className="flex justify-end gap-2 whitespace-nowrap"><button type="button" onClick={event => { event.stopPropagation(); openApplicationDrawer(item) }} className="inline-flex items-center gap-1 rounded-md border border-[#e5e5e5] px-2.5 py-1.5 text-[12px] text-[#555] hover:border-[#ff1268] hover:text-[#ff1268]"><Eye className="h-3.5 w-3.5" />查看详情</button>{isPendingApplication(item) ? <button type="button" onClick={event => { event.stopPropagation(); openReviewDialog(item, 'approve') }} className="inline-flex items-center gap-1 rounded-md bg-[#ff1268] px-2.5 py-1.5 text-[12px] font-medium text-white hover:bg-[#e0105a]"><CheckCircle2 className="h-3.5 w-3.5" />立即审核</button> : null}</div></td></tr>
            })}
          </tbody>
        </table>
        {!applicationLoading && applicationRows.length === 0 ? <div className="px-6 py-16 text-center text-sm text-[#888]">暂无符合条件的入驻申请</div> : null}
      </div>
      <GlobalPagination page={applicationPage} total={applicationData.total} pageSize={PAGE_SIZE} loading={applicationLoading} onChange={setApplicationPage} />
    </>
  )

  const renderOrganizerTable = () => (
    <>
      <div className="overflow-x-auto rounded-lg border border-[#e5e5e5] bg-white">
        <table className="min-w-[1050px] w-full text-left text-[13px]">
          <thead className="bg-[#fafafa] text-[12px] font-medium text-[#777]"><tr><th className="whitespace-nowrap px-4 py-3">主办方名称</th><th className="whitespace-nowrap px-4 py-3">统一社会信用代码 / 资质编号</th><th className="whitespace-nowrap px-4 py-3">对接联系人</th><th className="whitespace-nowrap px-4 py-3">平台运营跟进人</th><th className="whitespace-nowrap px-4 py-3">旗下在售活动数</th><th className="whitespace-nowrap px-4 py-3">合作状态</th><th className="whitespace-nowrap px-4 py-3 text-right">操作</th></tr></thead>
          <tbody className="divide-y divide-[#f0f0f0]">
            {organizerRows.map(item => <tr key={item.organizerId} onClick={() => openOrganizerDrawer(item)} className="cursor-pointer transition-colors hover:bg-[#fff8fb]"><td className="px-4 py-4 align-top"><div className="font-medium text-[#222]">{item.organizerName || '未填写'}</div><div className="mt-1 text-[12px] text-[#999]">主办方 ID：{item.organizerId}</div></td><td className="px-4 py-4 align-top text-[#555]">{item.qualificationNo || '未填写'}</td><td className="px-4 py-4 align-top"><div className="text-[#333]">{item.contactName || '未填写'}</div><div className="mt-1 text-[12px] text-[#999]">{item.contactPhone || '未填写'}</div></td><td className="px-4 py-4 align-top text-[#555]">{item.followUpOperatorName || item.followUpOperatorId || '未分配'}</td><td className="px-4 py-4 align-top">{activityCountLoading ? <span className="text-[#999]">统计中</span> : activityCountFailed ? <span className="text-[#999]">-</span> : <span className="font-medium text-[#222]">{activityCounts[item.organizerId] ?? '-'}</span>}</td><td className="px-4 py-4 align-top"><span className={`inline-flex rounded-md px-2 py-1 text-[12px] font-medium ${isActiveOrganizer(item) ? 'bg-[#f6ffed] text-[#389e0d]' : 'bg-[#fff1f0] text-[#cf1322]'}`}>{isActiveOrganizer(item) ? '合作中' : item.cooperationStatus === 'FROZEN' ? '已冻结' : '状态待核对'}</span></td><td className="px-4 py-4 align-top"><div className="flex justify-end gap-2 whitespace-nowrap"><button type="button" onClick={event => { event.stopPropagation(); openOrganizerDrawer(item) }} className="inline-flex items-center gap-1 rounded-md border border-[#e5e5e5] px-2.5 py-1.5 text-[12px] text-[#555] hover:border-[#ff1268] hover:text-[#ff1268]"><Eye className="h-3.5 w-3.5" />查看详情</button>{isActiveOrganizer(item) ? <button type="button" onClick={event => { event.stopPropagation(); openRevokeDialog(item) }} className="inline-flex items-center gap-1 rounded-md border border-[#ff4d4f] px-2.5 py-1.5 text-[12px] text-[#cf1322] hover:bg-[#fff1f0]"><ShieldOff className="h-3.5 w-3.5" />冻结</button> : null}</div></td></tr>)}
          </tbody>
        </table>
        {!organizerLoading && organizerRows.length === 0 ? <div className="px-6 py-16 text-center text-sm text-[#888]">暂无符合条件的正式主办方</div> : null}
      </div>
      <GlobalPagination page={organizerPage} total={organizerData.total} pageSize={PAGE_SIZE} loading={organizerLoading} onChange={setOrganizerPage} />
    </>
  )

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 border-b border-[#e5e5e5] pb-4 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="text-[24px] font-bold text-[#1a1a2e]">主办方入驻审核和管理</h1><p className="mt-2 text-sm text-[#666]">集中处理入驻申请、资质材料、正式名录和合作状态。</p></div><div className="inline-flex w-fit rounded-lg border border-[#e5e5e5] bg-white p-1"><button type="button" onClick={() => setActiveTab('applications')} className={`rounded-md px-4 py-2 text-sm font-medium ${activeTab === 'applications' ? 'bg-[#ff1268] text-white' : 'text-[#666] hover:text-[#ff1268]'}`}>入驻审核申请</button><button type="button" onClick={() => setActiveTab('directory')} className={`rounded-md px-4 py-2 text-sm font-medium ${activeTab === 'directory' ? 'bg-[#ff1268] text-white' : 'text-[#666] hover:text-[#ff1268]'}`}>正式主办方名录</button></div></div>
    {error ? <div className="flex items-center justify-between gap-4 rounded-lg border border-[#ffd9e6] bg-white px-4 py-3 text-sm text-[#cf1322]"><span>{error}</span><button type="button" onClick={() => setError('')} className="rounded-md border border-[#e5e5e5] px-3 py-1.5 text-[12px] text-[#555]">关闭提示</button></div> : null}
    {activeTab === 'applications' ? <><div className="flex flex-col gap-3 border-b border-[#e5e5e5] pb-4 lg:flex-row lg:items-center"><div className="relative min-w-0 flex-1 lg:max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999]" /><input value={applicationKeyword} onChange={event => resetApplicationPage(setApplicationKeyword, event.target.value)} placeholder="搜索主办方、联系人、手机号" className="w-full rounded-lg border border-[#e5e5e5] bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#ff1268]" /></div><select value={applicationStatus} onChange={event => resetApplicationPage(setApplicationStatus, event.target.value as ApplicationFilterStatus)} className="rounded-lg border border-[#e5e5e5] bg-white px-3 py-2.5 text-sm text-[#555] outline-none focus:border-[#ff1268]">{APPLICATION_STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><select value={subjectType} onChange={event => resetApplicationPage(setSubjectType, event.target.value as 'all' | SubjectType)} className="rounded-lg border border-[#e5e5e5] bg-white px-3 py-2.5 text-sm text-[#555] outline-none focus:border-[#ff1268]">{SUBJECT_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><span className="text-[13px] text-[#888]">共 {applicationData.total} 条申请</span></div>{applicationLoading && applicationRows.length === 0 ? <Loading text="正在加载入驻申请" /> : renderApplicationTable()}</> : <><div className="flex flex-col gap-3 border-b border-[#e5e5e5] pb-4 lg:flex-row lg:items-center"><div className="relative min-w-0 flex-1 lg:max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999]" /><input value={organizerKeyword} onChange={event => resetOrganizerPage(setOrganizerKeyword, event.target.value)} placeholder="搜索主办方名称、联系人、手机号" className="w-full rounded-lg border border-[#e5e5e5] bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#ff1268]" /></div><input value={followUpOperator} onChange={event => resetOrganizerPage(setFollowUpOperator, event.target.value)} placeholder="运营跟进人" className="rounded-lg border border-[#e5e5e5] bg-white px-3 py-2.5 text-sm text-[#555] outline-none focus:border-[#ff1268] lg:w-40" /><select value={cooperationStatus} onChange={event => resetOrganizerPage(setCooperationStatus, event.target.value as CooperationStatus)} className="rounded-lg border border-[#e5e5e5] bg-white px-3 py-2.5 text-sm text-[#555] outline-none focus:border-[#ff1268]">{COOPERATION_STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><span className="text-[13px] text-[#888]">共 {organizerData.total} 家主办方</span></div>{organizerLoading && organizerRows.length === 0 ? <Loading text="正在加载正式主办方名录" /> : renderOrganizerTable()}</>}

    <Drawer open={Boolean(selectedApplication)} onClose={() => setSelectedApplication(null)} title="入驻申请详情" width="w-[560px]" footer={selectedApplication && isPendingApplication(selectedApplication) ? <div className="flex justify-end gap-3"><button type="button" onClick={() => openReviewDialog(selectedApplication, 'reject')} className="inline-flex items-center gap-2 rounded-lg border border-[#ff4d4f] px-4 py-2 text-sm font-medium text-[#cf1322]"><XCircle className="h-4 w-4" />驳回申请</button><button type="button" onClick={() => openReviewDialog(selectedApplication, 'approve')} className="inline-flex items-center gap-2 rounded-lg bg-[#ff1268] px-4 py-2 text-sm font-medium text-white"><CheckCircle2 className="h-4 w-4" />审核通过</button></div> : null}>{selectedApplication ? <div className="space-y-5 text-sm"><div className="flex items-start justify-between gap-4"><div><div className="text-lg font-semibold text-[#222]">{selectedApplication.organizerName || '未填写'}</div><div className="mt-1 text-[12px] text-[#999]">申请单 #{selectedApplication.id} · 用户 ID {selectedApplication.userId}</div></div><span className="rounded-md px-2 py-1 text-[12px] font-medium" style={{ color: applicationStatusMeta(selectedApplication.status).color, backgroundColor: applicationStatusMeta(selectedApplication.status).bg }}>{applicationStatusMeta(selectedApplication.status).text}</span></div><div className="grid grid-cols-2 gap-x-4 gap-y-4 border-y border-[#f0f0f0] py-4"><Detail label="主体类型" value={subjectTypeLabel(selectedApplication.subjectType)} /><Detail label="联系人" value={selectedApplication.contactName} /><Detail label="联系电话" value={selectedApplication.contactPhone} /><Detail label="联系邮箱" value={selectedApplication.contactEmail || '未填写'} /><Detail label="统一社会信用代码 / 资质编号" value={selectedApplication.licenseNo || '未填写'} /><Detail label="提交时间" value={formatDate(selectedApplication.createTime)} /></div><Detail label="经营范围" value={selectedApplication.businessScope || '未填写'} block /><Detail label="申请说明" value={selectedApplication.description || '未填写'} block />{selectedApplication.reviewNote ? <Detail label="审核备注" value={selectedApplication.reviewNote} block /> : null}<div><div className="mb-2 flex items-center gap-2 font-medium text-[#333]"><FileImage className="h-4 w-4 text-[#ff1268]" />申请材料</div>{selectedApplication.materials?.length ? <div className="grid grid-cols-2 gap-3">{selectedApplication.materials.map(material => <button key={material.id} type="button" onClick={() => setSelectedMaterial(material)} className="overflow-hidden rounded-lg border border-[#e5e5e5] bg-[#fafafa] text-left hover:border-[#ff1268]"><SafeImage src={material.publicUrl} alt={formatMaterialType(material.materialType)} fallbackText="材料加载失败" className="h-32 w-full object-cover" /><span className="block truncate px-3 py-2 text-[12px] text-[#555]">{formatMaterialType(material.materialType)} · {material.originalName || '未命名文件'}</span></button>)}</div> : <div className="rounded-lg border border-dashed border-[#d9d9d9] px-4 py-6 text-center text-[13px] text-[#999]">未上传</div>}</div></div> : null}</Drawer>
    <Drawer open={Boolean(selectedOrganizer)} onClose={() => setSelectedOrganizer(null)} title="正式主办方详情" width="w-[520px]" footer={selectedOrganizer && isActiveOrganizer(selectedOrganizer) ? <div className="flex justify-end"><button type="button" onClick={() => openRevokeDialog(selectedOrganizer)} className="inline-flex items-center gap-2 rounded-lg border border-[#ff4d4f] px-4 py-2 text-sm font-medium text-[#cf1322]"><ShieldOff className="h-4 w-4" />取消合作 / 冻结</button></div> : null}>{selectedOrganizer ? <div className="space-y-5 text-sm"><div><div className="text-lg font-semibold text-[#222]">{selectedOrganizer.organizerName || '未填写'}</div><div className="mt-1 text-[12px] text-[#999]">主办方 ID {selectedOrganizer.organizerId}</div></div><div className="grid grid-cols-2 gap-x-4 gap-y-4 border-y border-[#f0f0f0] py-4"><Detail label="合作状态" value={isActiveOrganizer(selectedOrganizer) ? '合作中' : selectedOrganizer.cooperationStatus === 'FROZEN' ? '已冻结' : '状态待核对'} /><Detail label="主体类型" value={subjectTypeLabel(selectedOrganizer.subjectType)} /><Detail label="统一社会信用代码 / 资质编号" value={selectedOrganizer.qualificationNo || '未填写'} /><Detail label="联系人" value={selectedOrganizer.contactName || '未填写'} /><Detail label="联系电话" value={selectedOrganizer.contactPhone || '未填写'} /><Detail label="平台运营跟进人" value={selectedOrganizer.followUpOperatorName || selectedOrganizer.followUpOperatorId || '未分配'} /><Detail label="旗下在售活动数" value={activityCountLoading ? '统计中' : activityCountFailed ? '-' : activityCounts[selectedOrganizer.organizerId] ?? '-'} /></div><div className="rounded-lg border border-[#ffe7ba] bg-[#fffbe6] p-4 text-[13px] leading-6 text-[#874d00]">资质材料来自用户域历史入驻申请。冻结操作只改变主办方资质状态，不会自动退款，也不会修改历史订单或活动数据。</div></div> : null}</Drawer>
    <Modal open={Boolean(selectedMaterial)} onClose={() => setSelectedMaterial(null)} title="材料预览" size="xl" footer={<div className="flex justify-end"><button type="button" onClick={() => setSelectedMaterial(null)} className="rounded-lg border border-[#e5e5e5] px-4 py-2 text-sm text-[#555]">关闭预览</button></div>}>{selectedMaterial ? <div className="space-y-3"><div className="flex justify-center rounded-lg bg-[#f5f5f5] p-3"><SafeImage src={selectedMaterial.publicUrl} alt={formatMaterialType(selectedMaterial.materialType)} fallbackText="材料加载失败" className="max-h-[65vh] w-auto max-w-full object-contain" /></div><div className="text-center text-[13px] text-[#666]">{formatMaterialType(selectedMaterial.materialType)} · {selectedMaterial.originalName || '未命名文件'}</div></div> : null}</Modal>
    <Modal open={Boolean(reviewDialog)} onClose={closeReviewDialog} title={reviewDialog?.action === 'reject' ? '驳回入驻申请' : '审核通过入驻申请'} danger={reviewDialog?.action === 'reject'} loading={saving} footer={<div className="flex justify-end gap-3"><button type="button" onClick={closeReviewDialog} disabled={saving} className="rounded-lg border border-[#e5e5e5] px-4 py-2 text-sm text-[#555]">取消</button><button type="button" onClick={submitReview} disabled={saving} className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${reviewDialog?.action === 'reject' ? 'bg-[#f53f3f]' : 'bg-[#ff1268]'}`}>{saving ? '提交中' : reviewDialog?.action === 'reject' ? '确认驳回' : '确认通过'}</button></div>}>{reviewDialog ? <div className="space-y-4"><div className="rounded-lg bg-[#fafafa] p-3 text-sm text-[#555]">{reviewDialog.item.organizerName} · {reviewDialog.item.contactName}</div><label className="block text-sm font-medium text-[#333]">{reviewDialog.action === 'reject' ? '驳回原因 *' : '审核备注'}<textarea value={reviewDialog.note} onChange={event => { setReviewDialog({ ...reviewDialog, note: event.target.value }); if (event.target.value.trim()) setDialogError('') }} rows={5} placeholder={reviewDialog.action === 'reject' ? '请输入驳回原因（必填）' : '请输入审核备注（可选）'} className="mt-2 w-full resize-none rounded-lg border border-[#e5e5e5] p-3 text-sm outline-none focus:border-[#ff1268]" /></label>{dialogError ? <div className="text-[13px] text-[#cf1322]">{dialogError}</div> : null}</div> : null}</Modal>
    <Modal open={Boolean(revokeDialog)} onClose={closeRevokeDialog} title="冻结主办方资质" size="lg" danger loading={saving} footer={<div className="flex justify-end gap-3"><button type="button" onClick={closeRevokeDialog} disabled={saving} className="rounded-lg border border-[#e5e5e5] px-4 py-2 text-sm text-[#555]">暂不冻结</button><button type="button" onClick={submitRevoke} disabled={saving} className="rounded-lg bg-[#f53f3f] px-4 py-2 text-sm font-medium text-white">{saving ? '提交中' : '确认冻结'}</button></div>}>{revokeDialog ? <div className="space-y-4 text-sm"><div className="rounded-lg border border-[#ffccc7] bg-[#fff2f0] p-4 leading-6 text-[#a8071a]"><div className="font-semibold">请确认高危操作</div><div className="mt-1">冻结主办方资质后，该账号将不能继续使用主办方后台能力。此操作不会自动退款，也不会修改历史订单或活动数据；已售订单仍按原履约和退款流程处理。历史申请和资质材料会保留。</div></div><div className="font-medium text-[#333]">{revokeDialog.item.organizerName}</div><label className="block font-medium text-[#333]">取消合作 / 冻结原因 *<textarea value={revokeDialog.reason} onChange={event => { setRevokeDialog({ ...revokeDialog, reason: event.target.value }); if (event.target.value.trim()) setDialogError('') }} rows={4} placeholder="请输入冻结原因（必填）" className="mt-2 w-full resize-none rounded-lg border border-[#e5e5e5] p-3 text-sm outline-none focus:border-[#ff1268]" /></label>{dialogError ? <div className="text-[13px] text-[#cf1322]">{dialogError}</div> : null}</div> : null}</Modal>
  </div>
}

function Loading({ text }: { text: string }) {
  return <div className="flex min-h-[220px] items-center justify-center border border-[#e5e5e5] bg-white text-sm text-[#888]"><Loader2 className="mr-2 h-4 w-4 animate-spin text-[#ff1268]" />{text}</div>
}

function Detail({ label, value, block = false }: { label: string; value: string | number | null | undefined; block?: boolean }) {
  return <div className={block ? 'rounded-lg bg-[#fafafa] p-3' : ''}><div className="text-[12px] text-[#999]">{label}</div><div className="mt-1 break-words leading-6 text-[#333]">{value || '未填写'}</div></div>
}
