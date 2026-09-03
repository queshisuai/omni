'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  FileText,
  MessageSquarePlus,
  RefreshCw,
  Save,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react'
import {
  createOrganizerOpsFollowUp,
  getUserInfo,
  listOperationAuditLogs,
  listOrganizerAdminAccounts,
  listOrganizerApplications,
  listOrganizerOpsAssignments,
  listOrganizerOpsFollowUps,
  updateOrganizerOpsAssignment,
} from '@/lib/api'
import { DEFAULT_PAGE_SIZE, GlobalPagination } from '@/components/Pagination'
import { canUseConsoleAction } from '@/lib/console-auth'
import {
  formatOperationAction,
  formatOperationTargetRef,
  formatOrganizerOpsAccountLabel,
  formatOrganizerOpsFollowType,
} from '@/lib/operation-display'
import type {
  OperationAuditLogVO,
  OrganizerAdminAccountVO,
  OrganizerApplicationVO,
  OrganizerOpsAssignmentVO,
  OrganizerOpsFollowUpVO,
  UserInfo,
} from '@/types/api'

type FollowUpsByOrganizer = Record<number, OrganizerOpsFollowUpVO[]>

type LoadState = {
  applications: OrganizerApplicationVO[]
  accounts: OrganizerAdminAccountVO[]
  audits: OperationAuditLogVO[]
  assignments: OrganizerOpsAssignmentVO[]
  followUpsByOrganizer: FollowUpsByOrganizer
  applicationError: string
  accountError: string
  auditError: string
  assignmentError: string
  followError: string
}

type AssignmentForm = {
  assignedOperatorId: string
  riskLevel: string
  status: string
  nextFollowAt: string
}

type FollowForm = {
  followType: string
  content: string
  nextFollowAt: string
}

const initialState: LoadState = {
  applications: [],
  accounts: [],
  audits: [],
  assignments: [],
  followUpsByOrganizer: {},
  applicationError: '',
  accountError: '',
  auditError: '',
  assignmentError: '',
  followError: '',
}

const emptyAssignmentForm: AssignmentForm = {
  assignedOperatorId: '',
  riskLevel: 'normal',
  status: 'active',
  nextFollowAt: '',
}

const emptyFollowForm: FollowForm = {
  followType: 'note',
  content: '',
  nextFollowAt: '',
}

const riskOptions = [
  { value: 'normal', label: '正常' },
  { value: 'watch', label: '关注' },
  { value: 'high', label: '高风险' },
]

const statusOptions = [
  { value: 'active', label: '正常跟进' },
  { value: 'pending_material', label: '待补材料' },
  { value: 'restricted', label: '已限制' },
  { value: 'inactive', label: '暂停跟进' },
]

const followTypeOptions = [
  { value: 'note', label: '内部备注' },
  { value: 'phone', label: '电话沟通' },
  { value: 'material', label: '材料补充' },
  { value: 'audit', label: '审核处理' },
  { value: 'risk', label: '风险复核' },
]

function formatTime(value?: string | null) {
  if (!value) return '-'
  return value.replace('T', ' ').slice(0, 19)
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return ''
  return value.replace(' ', 'T').slice(0, 16)
}

function toApiDateTime(value: string) {
  if (!value.trim()) return null
  return value.trim().length === 16 ? `${value.trim()}:00` : value.trim()
}

function countActiveAccounts(accounts: OrganizerAdminAccountVO[]) {
  return accounts.filter(account => account.status === 1).length
}

function isDue(value?: string | null) {
  if (!value) return false
  const time = new Date(value).getTime()
  return Number.isFinite(time) && time <= Date.now()
}

function optionLabel(options: Array<{ value: string; label: string }>, value?: string | null, fallback = '未识别') {
  return options.find(item => item.value === value)?.label || fallback
}

function riskClass(value?: string | null) {
  if (value === 'high') return 'bg-red-50 text-red-600'
  if (value === 'watch') return 'bg-amber-50 text-amber-600'
  return 'bg-green-50 text-green-600'
}

function statusClass(value?: string | null) {
  if (value === 'restricted') return 'bg-red-50 text-red-600'
  if (value === 'pending_material') return 'bg-amber-50 text-amber-600'
  if (value === 'inactive') return 'bg-gray-100 text-gray-500'
  return 'bg-blue-50 text-blue-600'
}

function MetricCard({
  icon: Icon,
  title,
  value,
  hint,
  href,
}: {
  icon: typeof ClipboardList
  title: string
  value: string | number
  hint: string
  href?: string
}) {
  const content = (
    <>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#fff0f5] text-[#ff1268]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] text-gray-500">{title}</div>
          <div className="mt-1 text-[24px] font-bold leading-none text-[#111]">{value}</div>
        </div>
      </div>
      <div className="text-[12px] leading-5 text-gray-500">{hint}</div>
    </>
  )

  if (!href) {
    return <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">{content}</div>
  }

  return (
    <Link href={href} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-[#ff1268]">
      {content}
    </Link>
  )
}

function Badge({ label, className }: { label: string; className: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-medium ${className}`}>{label}</span>
}

export default function OrganizerOpsPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [state, setState] = useState<LoadState>(initialState)
  const [selectedOrganizerId, setSelectedOrganizerId] = useState<number | null>(null)
  const [assignmentForm, setAssignmentForm] = useState<AssignmentForm>(emptyAssignmentForm)
  const [followForm, setFollowForm] = useState<FollowForm>(emptyFollowForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<'assignment' | 'follow' | ''>('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [assignmentPage, setAssignmentPage] = useState(1)

  const permissions = useMemo(() => user?.permissionCodes || [], [user])
  const canReviewOrganizer = canUseConsoleAction('organizer.review', permissions)
  const canManageOpsAccounts = canUseConsoleAction('organizer.account.manage', permissions)
  const canViewAudit = canUseConsoleAction('audit.view', permissions)
  const canViewFollow = canReviewOrganizer || canUseConsoleAction('organizer.follow.manage', permissions)
  const canWriteFollow = canUseConsoleAction('organizer.follow.manage', permissions)
  const canAssignOrganizer = canUseConsoleAction('organizer.assign.manage', permissions)

  const selectedAssignment = useMemo(
    () => state.assignments.find(item => item.organizerUserId === selectedOrganizerId) || null,
    [selectedOrganizerId, state.assignments]
  )
  const selectedFollowUps = selectedOrganizerId ? state.followUpsByOrganizer[selectedOrganizerId] || [] : []
  const assignmentPageItems = useMemo(
    () => state.assignments.slice((assignmentPage - 1) * DEFAULT_PAGE_SIZE, assignmentPage * DEFAULT_PAGE_SIZE),
    [state.assignments, assignmentPage],
  )

  const organizerNameByUserId = useMemo(() => {
    const map = new Map<number, string>()
    for (const item of state.applications) {
      map.set(item.userId, item.organizerName || `主办方编号：${item.userId}`)
    }
    return map
  }, [state.applications])

  const accountNameById = useMemo(() => {
    const map = new Map<number, string>()
    for (const account of state.accounts) {
      map.set(account.id, formatOrganizerOpsAccountLabel(account))
    }
    return map
  }, [state.accounts])

  const load = async (info = user) => {
    if (!info) return
    const currentPermissions = info.permissionCodes || []
    const nextState: LoadState = { ...initialState, followUpsByOrganizer: {} }
    const canReview = canUseConsoleAction('organizer.review', currentPermissions)
    const canManageAccounts = canUseConsoleAction('organizer.account.manage', currentPermissions)
    const canAudit = canUseConsoleAction('audit.view', currentPermissions)
    const canFollowView = canReview || canUseConsoleAction('organizer.follow.manage', currentPermissions)

    setLoading(true)
    setMessage('')
    setError('')

    try {
      if (canReview) {
        try {
          nextState.applications = await listOrganizerApplications(0)
        } catch (err) {
          nextState.applicationError = err instanceof Error ? err.message : '加载待审核主办方申请失败'
        }
      } else {
        nextState.applicationError = '暂无主办方审核权限'
      }

      if (canManageAccounts) {
        try {
          nextState.accounts = await listOrganizerAdminAccounts()
        } catch (err) {
          nextState.accountError = err instanceof Error ? err.message : '加载平台主办方运营员账号失败'
        }
      } else {
        nextState.accountError = '暂无运营员账号列表权限，可填写负责人编号'
      }

      if (canFollowView) {
        try {
          nextState.assignments = await listOrganizerOpsAssignments()
          const followPairs = await Promise.all(nextState.assignments.map(async assignment => {
            try {
              const followUps = await listOrganizerOpsFollowUps(assignment.organizerUserId)
              return [assignment.organizerUserId, followUps] as const
            } catch {
              nextState.followError = '部分主办方跟进记录加载失败'
              return [assignment.organizerUserId, []] as const
            }
          }))
          nextState.followUpsByOrganizer = Object.fromEntries(followPairs)
        } catch (err) {
          nextState.assignmentError = err instanceof Error ? err.message : '加载主办方跟进队列失败'
        }
      } else {
        nextState.assignmentError = '暂无主办方跟进查看权限'
      }

      if (canAudit) {
        try {
          nextState.audits = await listOperationAuditLogs({ limit: 5 })
        } catch (err) {
          nextState.auditError = err instanceof Error ? err.message : '加载操作审计失败'
        }
      } else {
        nextState.auditError = '暂无操作审计查看权限'
      }

      setState(nextState)
      setAssignmentPage(1)
      setSelectedOrganizerId(current => {
        if (current && nextState.assignments.some(item => item.organizerUserId === current)) return current
        return nextState.assignments[0]?.organizerUserId || null
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const info = await getUserInfo()
        if (!active) return
        const currentPermissions = info.permissionCodes || []
        const canEnter =
          canUseConsoleAction('organizer.review', currentPermissions) ||
          canUseConsoleAction('organizer.account.manage', currentPermissions) ||
          canUseConsoleAction('organizer.follow.manage', currentPermissions) ||
          canUseConsoleAction('organizer.assign.manage', currentPermissions)
        if (!canEnter) {
          router.replace('/console')
          return
        }
        setUser(info)
        await load(info)
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : '校验平台主办方运营权限失败')
          setLoading(false)
        }
      }
    })()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  useEffect(() => {
    if (!selectedAssignment) {
      setAssignmentForm(emptyAssignmentForm)
      return
    }
    setAssignmentForm({
      assignedOperatorId: selectedAssignment.assignedOperatorId ? String(selectedAssignment.assignedOperatorId) : '',
      riskLevel: selectedAssignment.riskLevel || 'normal',
      status: selectedAssignment.status || 'active',
      nextFollowAt: toDateTimeLocal(selectedAssignment.nextFollowAt),
    })
    setFollowForm(current => ({
      ...current,
      nextFollowAt: toDateTimeLocal(selectedAssignment.nextFollowAt),
    }))
  }, [
    selectedAssignment?.assignedOperatorId,
    selectedAssignment?.nextFollowAt,
    selectedAssignment?.organizerUserId,
    selectedAssignment?.riskLevel,
    selectedAssignment?.status,
  ])

  const saveAssignment = async () => {
    if (!selectedAssignment || !canAssignOrganizer) return
    const assignedOperatorId = assignmentForm.assignedOperatorId.trim() ? Number(assignmentForm.assignedOperatorId.trim()) : null
    if (assignedOperatorId !== null && (!Number.isInteger(assignedOperatorId) || assignedOperatorId <= 0)) {
      setError('负责人编号不正确')
      setMessage('')
      return
    }

    setSaving('assignment')
    setError('')
    setMessage('')
    try {
      await updateOrganizerOpsAssignment(selectedAssignment.organizerUserId, {
        assignedOperatorId,
        riskLevel: assignmentForm.riskLevel,
        status: assignmentForm.status,
        nextFollowAt: toApiDateTime(assignmentForm.nextFollowAt),
      })
      await load()
      setMessage('主办方分配和跟进计划已保存')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存主办方分配失败')
    } finally {
      setSaving('')
    }
  }

  const submitFollowUp = async () => {
    if (!selectedAssignment || !canWriteFollow) return
    if (!followForm.content.trim()) {
      setError('请填写跟进内容')
      setMessage('')
      return
    }

    setSaving('follow')
    setError('')
    setMessage('')
    try {
      await createOrganizerOpsFollowUp(selectedAssignment.organizerUserId, {
        followType: followForm.followType,
        content: followForm.content.trim(),
        nextFollowAt: toApiDateTime(followForm.nextFollowAt),
      })
      setFollowForm({ ...emptyFollowForm, nextFollowAt: followForm.nextFollowAt })
      await load()
      setMessage('跟进记录已添加')
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加跟进记录失败')
    } finally {
      setSaving('')
    }
  }

  const activeAccountCount = countActiveAccounts(state.accounts)
  const inactiveAccountCount = state.accounts.length - activeAccountCount
  const highRiskCount = state.assignments.filter(item => item.riskLevel === 'high').length
  const dueFollowCount = state.assignments.filter(item => isDue(item.nextFollowAt)).length

  const organizerLabel = (organizerUserId: number) => organizerNameByUserId.get(organizerUserId) || `主办方编号：${organizerUserId}`
  const operatorLabel = (operatorId?: number | null) => {
    if (!operatorId) return '未分配'
    return accountNameById.get(operatorId) || `运营员编号：${operatorId}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold text-[#111]">平台主办方运营工作台</h1>
          <p className="mt-2 text-[14px] text-gray-500">聚合主办方审核、运营分配、跟进记录和最近操作审计。</p>
        </div>
        <button
          onClick={() => load()}
          disabled={loading || !user}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-[13px] text-gray-600 hover:border-[#ff1268] hover:text-[#ff1268] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {(message || error) ? (
        <div className={`rounded-lg px-4 py-3 text-[13px] ${error ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
          {error || message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={ClipboardList}
          title="待审核主办方申请"
          value={state.applicationError ? '-' : state.applications.length}
          hint={state.applicationError || '进入主办方审核页处理入驻资料。'}
          href={canReviewOrganizer ? '/console/organizer-applications' : undefined}
        />
        <MetricCard
          icon={CalendarClock}
          title="跟进队列"
          value={state.assignmentError ? '-' : state.assignments.length}
          hint={state.assignmentError || `到期 ${dueFollowCount} 个，高风险 ${highRiskCount} 个。`}
        />
        <MetricCard
          icon={Users}
          title="平台主办方运营员"
          value={state.accountError && state.accounts.length === 0 ? '-' : state.accounts.length}
          hint={state.accountError || `启用 ${activeAccountCount} 个，停用 ${inactiveAccountCount} 个。`}
          href={canManageOpsAccounts ? '/console/organizer-admins' : undefined}
        />
        <MetricCard
          icon={ShieldCheck}
          title="最近操作审计"
          value={state.auditError ? '-' : state.audits.length}
          hint={state.auditError || '查看最近后台人工操作记录。'}
          href={canViewAudit ? '/console/audit-logs' : undefined}
        />
      </div>

      <section className="rounded-lg border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2 text-[16px] font-bold text-[#111]">
            <ClipboardList className="h-4 w-4 text-[#ff1268]" />
            待办入口
          </div>
        </div>
        <div className="grid gap-3 p-5 md:grid-cols-4">
          {canReviewOrganizer ? (
            <Link href="/console/organizer-applications" className="rounded-lg border border-gray-200 px-4 py-3 text-[13px] text-gray-700 hover:border-[#ff1268] hover:text-[#ff1268]">
              主办方审核
            </Link>
          ) : null}
          {canViewFollow ? (
            <button type="button" onClick={() => setSelectedOrganizerId(state.assignments[0]?.organizerUserId || null)} className="rounded-lg border border-gray-200 px-4 py-3 text-left text-[13px] text-gray-700 hover:border-[#ff1268] hover:text-[#ff1268]">
              跟进队列
            </button>
          ) : null}
          {canManageOpsAccounts ? (
            <Link href="/console/organizer-admins" className="rounded-lg border border-gray-200 px-4 py-3 text-[13px] text-gray-700 hover:border-[#ff1268] hover:text-[#ff1268]">
              运营员账号
            </Link>
          ) : null}
          {canViewAudit ? (
            <Link href="/console/audit-logs" className="rounded-lg border border-gray-200 px-4 py-3 text-[13px] text-gray-700 hover:border-[#ff1268] hover:text-[#ff1268]">
              操作审计
            </Link>
          ) : null}
          {!canReviewOrganizer && !canViewFollow && !canManageOpsAccounts && !canViewAudit ? (
            <div className="rounded-lg bg-gray-50 px-4 py-3 text-[13px] text-gray-400">暂无可用入口</div>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2 text-[16px] font-bold text-[#111]">
            <CalendarClock className="h-4 w-4 text-[#ff1268]" />
            主办方跟进队列
          </div>
          {state.followError ? <div className="text-[12px] text-amber-600">{state.followError}</div> : null}
        </div>
        {loading ? (
          <div className="py-12 text-center text-[14px] text-gray-400">正在加载跟进队列...</div>
        ) : state.assignmentError ? (
          <div className="py-12 text-center text-[14px] text-gray-400">{state.assignmentError}</div>
        ) : state.assignments.length === 0 ? (
          <div className="py-12 text-center text-[14px] text-gray-400">暂无主办方跟进记录</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[13px]">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-5 py-3 font-medium">主办方</th>
                  <th className="px-4 py-3 font-medium">风险等级</th>
                  <th className="px-4 py-3 font-medium">当前状态</th>
                  <th className="px-4 py-3 font-medium">负责人</th>
                  <th className="px-4 py-3 font-medium">下次跟进</th>
                  <th className="px-4 py-3 font-medium">最近跟进</th>
                  <th className="px-5 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assignmentPageItems.map(assignment => {
                  const latestFollowUp = state.followUpsByOrganizer[assignment.organizerUserId]?.[0]
                  const active = assignment.organizerUserId === selectedOrganizerId
                  return (
                    <tr key={assignment.organizerUserId} className={active ? 'bg-[#fff7fb]' : 'bg-white'}>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-[#111]">{organizerLabel(assignment.organizerUserId)}</div>
                        <div className="mt-1 text-[12px] text-gray-400">主办方编号：{assignment.organizerUserId}</div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge label={optionLabel(riskOptions, assignment.riskLevel)} className={riskClass(assignment.riskLevel)} />
                      </td>
                      <td className="px-4 py-4">
                        <Badge label={optionLabel(statusOptions, assignment.status)} className={statusClass(assignment.status)} />
                      </td>
                      <td className="px-4 py-4 text-gray-600">{operatorLabel(assignment.assignedOperatorId)}</td>
                      <td className={`px-4 py-4 ${isDue(assignment.nextFollowAt) ? 'font-semibold text-red-500' : 'text-gray-600'}`}>
                        {formatTime(assignment.nextFollowAt)}
                      </td>
                      <td className="max-w-[280px] px-4 py-4">
                        {latestFollowUp ? (
                          <div className="min-w-0">
                            <div className="truncate text-gray-700">{latestFollowUp.content}</div>
                            <div className="mt-1 text-[12px] text-gray-400">{formatOrganizerOpsFollowType(latestFollowUp.followType)} · {formatTime(latestFollowUp.createTime)}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">暂无跟进记录</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedOrganizerId(assignment.organizerUserId)}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-[13px] text-gray-600 hover:border-[#ff1268] hover:text-[#ff1268]"
                        >
                          处理
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !state.assignmentError && state.assignments.length > 0 ? (
          <div className="border-t border-gray-100 px-5 pb-4">
            <GlobalPagination page={assignmentPage} total={state.assignments.length} loading={loading} onChange={setAssignmentPage} />
          </div>
        ) : null}
      </section>

      {selectedAssignment ? (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[16px] font-bold text-[#111]">
                  <UserCheck className="h-4 w-4 text-[#ff1268]" />
                  {organizerLabel(selectedAssignment.organizerUserId)}
                </div>
                <div className="mt-1 text-[12px] text-gray-400">主办方编号：{selectedAssignment.organizerUserId}</div>
              </div>
              <div className="flex gap-2">
                <Badge label={optionLabel(riskOptions, selectedAssignment.riskLevel)} className={riskClass(selectedAssignment.riskLevel)} />
                <Badge label={optionLabel(statusOptions, selectedAssignment.status)} className={statusClass(selectedAssignment.status)} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-[13px] text-gray-600">
                <span className="mb-1.5 block">负责人</span>
                {state.accounts.length > 0 ? (
                  <select
                    value={assignmentForm.assignedOperatorId}
                    disabled={!canAssignOrganizer || saving === 'assignment'}
                    onChange={event => setAssignmentForm({ ...assignmentForm, assignedOperatorId: event.target.value })}
                    className="h-10 w-full rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268] disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">未分配</option>
                    {state.accounts.map(account => (
                      <option key={account.id} value={account.id}>{formatOrganizerOpsAccountLabel(account)}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={assignmentForm.assignedOperatorId}
                    disabled={!canAssignOrganizer || saving === 'assignment'}
                    onChange={event => setAssignmentForm({ ...assignmentForm, assignedOperatorId: event.target.value })}
                    placeholder="负责人编号"
                    className="h-10 w-full rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268] disabled:bg-gray-50 disabled:text-gray-400"
                  />
                )}
              </label>
              <label className="text-[13px] text-gray-600">
                <span className="mb-1.5 block">下次跟进时间</span>
                <input
                  type="datetime-local"
                  value={assignmentForm.nextFollowAt}
                  disabled={!canAssignOrganizer || saving === 'assignment'}
                  onChange={event => setAssignmentForm({ ...assignmentForm, nextFollowAt: event.target.value })}
                  className="h-10 w-full rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268] disabled:bg-gray-50 disabled:text-gray-400"
                />
              </label>
              <label className="text-[13px] text-gray-600">
                <span className="mb-1.5 block">风险等级</span>
                <select
                  value={assignmentForm.riskLevel}
                  disabled={!canAssignOrganizer || saving === 'assignment'}
                  onChange={event => setAssignmentForm({ ...assignmentForm, riskLevel: event.target.value })}
                  className="h-10 w-full rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268] disabled:bg-gray-50 disabled:text-gray-400"
                >
                  {riskOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="text-[13px] text-gray-600">
                <span className="mb-1.5 block">当前状态</span>
                <select
                  value={assignmentForm.status}
                  disabled={!canAssignOrganizer || saving === 'assignment'}
                  onChange={event => setAssignmentForm({ ...assignmentForm, status: event.target.value })}
                  className="h-10 w-full rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268] disabled:bg-gray-50 disabled:text-gray-400"
                >
                  {statusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>

            {canAssignOrganizer ? (
              <button
                type="button"
                onClick={saveAssignment}
                disabled={saving === 'assignment'}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-[#ff1268] px-4 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving === 'assignment' ? '保存中...' : '保存分配和跟进计划'}
              </button>
            ) : (
              <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-[13px] text-gray-500">暂无分配调整权限</div>
            )}

            <div className="mt-6 border-t border-gray-100 pt-5">
              <div className="mb-4 flex items-center gap-2 text-[15px] font-bold text-[#111]">
                <MessageSquarePlus className="h-4 w-4 text-[#ff1268]" />
                添加跟进记录
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-[13px] text-gray-600">
                  <span className="mb-1.5 block">跟进类型</span>
                  <select
                    value={followForm.followType}
                    disabled={!canWriteFollow || saving === 'follow'}
                    onChange={event => setFollowForm({ ...followForm, followType: event.target.value })}
                    className="h-10 w-full rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268] disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    {followTypeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="text-[13px] text-gray-600">
                  <span className="mb-1.5 block">下次跟进时间</span>
                  <input
                    type="datetime-local"
                    value={followForm.nextFollowAt}
                    disabled={!canWriteFollow || saving === 'follow'}
                    onChange={event => setFollowForm({ ...followForm, nextFollowAt: event.target.value })}
                    className="h-10 w-full rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268] disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </label>
              </div>
              <textarea
                value={followForm.content}
                disabled={!canWriteFollow || saving === 'follow'}
                onChange={event => setFollowForm({ ...followForm, content: event.target.value })}
                rows={4}
                placeholder="记录沟通结果、材料缺口、风险点或下一步动作"
                className="mt-3 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-[#ff1268] disabled:bg-gray-50 disabled:text-gray-400"
              />
              {canWriteFollow ? (
                <button
                  type="button"
                  onClick={submitFollowUp}
                  disabled={saving === 'follow'}
                  className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-[#ff1268] px-4 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <MessageSquarePlus className="h-4 w-4" />
                  {saving === 'follow' ? '提交中...' : '添加跟进'}
                </button>
              ) : (
                <div className="mt-3 rounded-lg bg-gray-50 px-4 py-3 text-[13px] text-gray-500">暂无写入跟进记录权限</div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 text-[16px] font-bold text-[#111]">
              <FileText className="h-4 w-4 text-[#ff1268]" />
              跟进记录
            </div>
            {selectedFollowUps.length === 0 ? (
              <div className="px-5 py-10 text-center text-[14px] text-gray-400">暂无跟进记录</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {selectedFollowUps.map(item => (
                  <div key={item.id} className="px-5 py-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <Badge label={formatOrganizerOpsFollowType(item.followType)} className="bg-gray-100 text-gray-600" />
                      <span className="text-[12px] text-gray-400">{formatTime(item.createTime)}</span>
                    </div>
                    <div className="whitespace-pre-wrap text-[13px] leading-6 text-gray-700">{item.content}</div>
                    <div className="mt-2 text-[12px] text-gray-400">
                      操作人：{operatorLabel(item.operatorId)} · 下次跟进：{formatTime(item.nextFollowAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 text-[16px] font-bold text-[#111]">
          <UserCheck className="h-4 w-4 text-[#ff1268]" />
          最近操作
        </div>
        {loading ? (
          <div className="py-12 text-center text-[14px] text-gray-400">正在加载操作审计...</div>
        ) : state.auditError ? (
          <div className="py-12 text-center text-[14px] text-gray-400">{state.auditError}</div>
        ) : state.audits.length === 0 ? (
          <div className="py-12 text-center text-[14px] text-gray-400">暂无操作审计记录</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {state.audits.map(item => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold text-[#111]">{formatOperationAction(item.action)}</div>
                  <div className="mt-1 text-[12px] text-gray-500">
                    {formatOperationTargetRef(item.targetType, item.targetRef, item.targetId)} · 操作人编号：{item.operatorId || '-'}
                  </div>
                </div>
                <div className="text-[12px] text-gray-400">{formatTime(item.createTime)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {state.assignments.some(item => item.riskLevel === 'high') ? (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-600">
          <AlertTriangle className="h-4 w-4" />
          当前存在高风险主办方，请优先处理跟进队列中的高风险项。
        </div>
      ) : null}
    </div>
  )
}
