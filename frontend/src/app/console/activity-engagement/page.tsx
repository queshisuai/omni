'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { Modal } from '@/components/ui/Modal'
import { DEFAULT_PAGE_SIZE, GlobalPagination } from '@/components/Pagination'
import { SafeImage } from '@/components/SafeImage'
import { globalAlert } from '@/components/GlobalDialog'
import {
  listAdminActivityEngagements,
  listAdminActivityQuestions,
  listAdminActivityReviewReports,
  listAdminActivityReviews,
  replyAdminActivityQuestion,
  updateAdminActivityQuestion,
  updateAdminActivityReportStatus,
  updateAdminActivityReviewStatus,
} from '@/lib/api'
import type {
  ActivityEngagementOverviewVO,
  ActivityQuestionVO,
  ActivityReviewReportVO,
  ActivityReviewVO,
} from '@/types/api'

type TabKey = 'questions' | 'reviews' | 'reports'
type ReplyIdentity = 'OFFICIAL_SUPPORT' | 'ORGANIZER_PROXY'
type AuditModalState =
  | { type: 'review-status'; title: string; review: ActivityReviewVO; status: number }
  | { type: 'question-update'; title: string; question: ActivityQuestionVO; status?: string | null; withAnswer?: boolean }
  | { type: 'report-status'; title: string; report: ActivityReviewReportVO; action: 'RESOLVE' | 'REJECT' }

const PAGE_SIZE = DEFAULT_PAGE_SIZE

const reviewStatusOptions = [
  { label: '待审核', value: '0' },
  { label: '已公开', value: '1' },
  { label: '已隐藏', value: '2' },
  { label: '全部', value: '' },
]

const questionStatusOptions = [
  { label: '待回复', value: 'PENDING' },
  { label: '已回复', value: 'ANSWERED' },
  { label: '已隐藏', value: 'HIDDEN' },
  { label: '全部', value: '' },
]

const reportStatusOptions = [
  { label: '待处理', value: 'PENDING' },
  { label: '已处理', value: 'RESOLVED' },
  { label: '已驳回', value: 'REJECTED' },
  { label: '全部', value: '' },
]

function formatTime(value?: string | null) {
  if (!value) return '暂无时间'
  return value.slice(0, 16).replace('T', ' ')
}

function formatCount(value?: number | null) {
  return value ?? 0
}

function reviewStatusLabel(value?: number | null) {
  if (value === 0) return '待审核'
  if (value === 1) return '已公开'
  if (value === 2) return '已隐藏'
  return '未知评价状态'
}

function isKnownReviewStatus(value?: number | null) {
  return value === 0 || value === 1 || value === 2
}

function canApproveReview(value?: number | null) {
  return value === 0 || value === 2
}

function canHideReview(value?: number | null) {
  return value === 0 || value === 1
}

function canRestoreReview(value?: number | null) {
  return value === 2
}

function questionStatusLabel(value?: string | null) {
  if (value === 'PENDING') return '待回复'
  if (value === 'ANSWERED') return '已回复'
  if (value === 'HIDDEN') return '已隐藏'
  return '未知问答状态'
}

function isKnownQuestionStatus(value?: string | null) {
  return value === 'PENDING' || value === 'ANSWERED' || value === 'HIDDEN'
}

function canAnswerQuestion(value?: string | null) {
  return value === 'PENDING'
}

function canHideQuestion(value?: string | null) {
  return value === 'PENDING' || value === 'ANSWERED'
}

function canRestoreQuestion(value?: string | null) {
  return value === 'HIDDEN'
}

function reportStatusLabel(value?: string | null) {
  if (value === 'PENDING') return '待处理'
  if (value === 'RESOLVED') return '已处理'
  if (value === 'REJECTED') return '已驳回'
  return '未知举报状态'
}

function isKnownReportStatus(value?: string | null) {
  return value === 'PENDING' || value === 'RESOLVED' || value === 'REJECTED'
}

function canResolveReport(value?: string | null) {
  return value === 'PENDING'
}

function canRejectReport(value?: string | null) {
  return value === 'PENDING'
}

function targetTypeLabel(value?: string | null) {
  if (value === 'TOUR') return '大型巡演'
  return '普通活动'
}

function replyIdentityLabel(value?: string | null) {
  if (value === 'OFFICIAL_SUPPORT') return '平台官方客服'
  if (value === 'ORGANIZER_PROXY') return '代主办方'
  return '回复主体待确认'
}

function parseReviewImages(value?: string | null) {
  if (!value) return []
  return value.split(',').map(item => item.trim()).filter(Boolean).slice(0, 4)
}

export default function ActivityEngagementConsolePage() {
  const [targets, setTargets] = useState<ActivityEngagementOverviewVO[]>([])
  const [selectedTarget, setSelectedTarget] = useState<ActivityEngagementOverviewVO | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('questions')
  const [keyword, setKeyword] = useState('')
  const [itemType, setItemType] = useState('')
  const [todoOnly, setTodoOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [targetLoading, setTargetLoading] = useState(false)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)
  const [reviews, setReviews] = useState<ActivityReviewVO[]>([])
  const [questions, setQuestions] = useState<ActivityQuestionVO[]>([])
  const [reports, setReports] = useState<ActivityReviewReportVO[]>([])
  const [reviewStatus, setReviewStatus] = useState('0')
  const [questionStatus, setQuestionStatus] = useState('PENDING')
  const [reportStatus, setReportStatus] = useState('PENDING')
  const [answerDrafts, setAnswerDrafts] = useState<Record<number, string>>({})
  const [identityDrafts, setIdentityDrafts] = useState<Record<number, ReplyIdentity>>({})
  const [auditModal, setAuditModal] = useState<AuditModalState | null>(null)
  const [auditReason, setAuditReason] = useState('')
  const [auditAnswer, setAuditAnswer] = useState('')
  const [auditReplyIdentity, setAuditReplyIdentity] = useState<ReplyIdentity>('ORGANIZER_PROXY')
  const [auditError, setAuditError] = useState('')

  const fetchTargets = useCallback(async (nextPage: number) => {
    setTargetLoading(true)
    try {
      const data = await listAdminActivityEngagements({
        page: nextPage,
        size: PAGE_SIZE,
        keyword,
        itemType: itemType || undefined,
        todoOnly,
      })
      setTargets(data.records || [])
      setTotal(data.total || 0)
      setPage(data.current || nextPage)
      return data.records || []
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '加载活动互动概览失败')
      return []
    } finally {
      setTargetLoading(false)
    }
  }, [itemType, keyword, todoOnly])

  const loadQuestions = useCallback(async () => {
    if (!selectedTarget) return
    setDrawerLoading(true)
    try {
      const data = await listAdminActivityQuestions(selectedTarget.targetId, {
        itemType: selectedTarget.targetType,
        status: questionStatus || undefined,
      })
      setQuestions(data)
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '加载购前问答失败')
    } finally {
      setDrawerLoading(false)
    }
  }, [questionStatus, selectedTarget])

  const loadReviews = useCallback(async () => {
    if (!selectedTarget) return
    setDrawerLoading(true)
    try {
      const data = await listAdminActivityReviews(selectedTarget.targetId, {
        itemType: selectedTarget.targetType,
        status: reviewStatus === '' ? undefined : Number(reviewStatus),
      })
      setReviews(data)
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '加载评价失败')
    } finally {
      setDrawerLoading(false)
    }
  }, [reviewStatus, selectedTarget])

  const loadReports = useCallback(async () => {
    if (!selectedTarget) return
    setDrawerLoading(true)
    try {
      const data = await listAdminActivityReviewReports(selectedTarget.targetId, {
        itemType: selectedTarget.targetType,
        status: reportStatus || undefined,
      })
      setReports(data)
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '加载违规举报失败')
    } finally {
      setDrawerLoading(false)
    }
  }, [reportStatus, selectedTarget])

  const refreshActiveTab = useCallback(async () => {
    if (activeTab === 'questions') await loadQuestions()
    if (activeTab === 'reviews') await loadReviews()
    if (activeTab === 'reports') await loadReports()
  }, [activeTab, loadQuestions, loadReports, loadReviews])

  useEffect(() => {
    void fetchTargets(page)
  }, [fetchTargets, page])

  useEffect(() => {
    void refreshActiveTab()
  }, [refreshActiveTab])

  const openDrawer = (target: ActivityEngagementOverviewVO) => {
    setSelectedTarget(target)
    setActiveTab('questions')
  }

  const updateSelectedTargetFromRows = (rows: ActivityEngagementOverviewVO[]) => {
    if (!selectedTarget) return
    const nextTarget = rows.find(row => row.targetId === selectedTarget.targetId && row.targetType === selectedTarget.targetType)
    if (nextTarget) setSelectedTarget(nextTarget)
  }

  const refreshAfterAction = async () => {
    await refreshActiveTab()
    const rows = await fetchTargets(page)
    updateSelectedTargetFromRows(rows)
  }

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    void fetchTargets(1)
  }

  const handleReviewPublish = async (review: ActivityReviewVO) => {
    if (!selectedTarget || !review.id) return
    if (!canApproveReview(review.status)) {
      await globalAlert('评价状态待核对，请刷新后再操作')
      return
    }
    setActingId(`review-${review.id}`)
    try {
      await updateAdminActivityReviewStatus(selectedTarget.targetId, review.id, {
        itemType: selectedTarget.targetType,
        status: 1,
      })
      await refreshAfterAction()
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '处理评价失败')
    } finally {
      setActingId(null)
    }
  }

  const handleQuestionReply = async (question: ActivityQuestionVO) => {
    if (!selectedTarget || !question.id) return
    if (!canAnswerQuestion(question.status)) {
      await globalAlert('问答状态待核对，请刷新后再操作')
      return
    }
    const answer = (answerDrafts[question.id] || '').trim()
    if (!answer) {
      await globalAlert('请填写回复内容')
      return
    }
    setActingId(`question-${question.id}`)
    try {
      await replyAdminActivityQuestion(selectedTarget.targetId, question.id, {
        itemType: selectedTarget.targetType,
        answer,
        replyIdentity: identityDrafts[question.id] || 'ORGANIZER_PROXY',
      })
      setAnswerDrafts(current => ({ ...current, [question.id!]: '' }))
      await refreshAfterAction()
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '回复问题失败')
    } finally {
      setActingId(null)
    }
  }

  const handleReportReject = async (report: ActivityReviewReportVO) => {
    if (!selectedTarget || !report.id) return
    if (!canRejectReport(report.status)) {
      await globalAlert('举报状态待核对，请刷新后再操作')
      return
    }
    setActingId(`report-${report.id}`)
    try {
      await updateAdminActivityReportStatus(selectedTarget.targetId, report.id, {
        itemType: selectedTarget.targetType,
        action: 'REJECT',
      })
      await refreshAfterAction()
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '处理举报失败')
    } finally {
      setActingId(null)
    }
  }

  const openAuditModal = (modal: AuditModalState) => {
    setAuditModal(modal)
    setAuditReason('')
    setAuditError('')
    if (modal.type === 'question-update' && modal.withAnswer) {
      const questionId = modal.question.id || 0
      setAuditAnswer((answerDrafts[questionId] || modal.question.answer || '').trim())
      setAuditReplyIdentity(identityDrafts[questionId] || (modal.question.replyIdentity === 'OFFICIAL_SUPPORT' ? 'OFFICIAL_SUPPORT' : 'ORGANIZER_PROXY'))
    } else {
      setAuditAnswer('')
      setAuditReplyIdentity('ORGANIZER_PROXY')
    }
  }

  const submitAuditModal = async () => {
    if (!selectedTarget || !auditModal) return
    const reason = auditReason.trim()
    if (!reason) {
      setAuditError('请填写操作原因/备注')
      return
    }
    setAuditError('')
    const id = auditModal.type === 'review-status'
      ? auditModal.review.id
      : auditModal.type === 'question-update'
        ? auditModal.question.id
        : auditModal.report.id
    if (!id) return
    setActingId(`${auditModal.type}-${id}`)
    try {
      if (auditModal.type === 'review-status') {
        await updateAdminActivityReviewStatus(selectedTarget.targetId, id, {
          itemType: selectedTarget.targetType,
          status: auditModal.status,
          reason,
        })
      }
      if (auditModal.type === 'question-update') {
        const body: Parameters<typeof updateAdminActivityQuestion>[2] = {
          itemType: selectedTarget.targetType,
          status: auditModal.status,
          reason,
        }
        if (auditModal.withAnswer) {
          const answer = auditAnswer.trim()
          if (!answer) {
            setAuditError('请填写回复内容')
            return
          }
          body.answer = answer
          body.replyIdentity = auditReplyIdentity
        }
        await updateAdminActivityQuestion(selectedTarget.targetId, id, body)
      }
      if (auditModal.type === 'report-status') {
        await updateAdminActivityReportStatus(selectedTarget.targetId, id, {
          itemType: selectedTarget.targetType,
          action: auditModal.action,
          reason,
        })
      }
      setAuditModal(null)
      await refreshAfterAction()
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '提交操作失败')
    } finally {
      setActingId(null)
    }
  }

  const renderStatusWarning = (known: boolean) => (
    known ? null : <span className="rounded border border-[#ffd591] bg-[#fff7e6] px-3 py-1 text-[#ad6800]">状态待核对</span>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#111]">评价问答管理</h1>
          <p className="mt-1 text-[13px] text-gray-500">按活动或巡演聚合处理评价审核、购前问答和违规举报。</p>
        </div>
        <button
          type="button"
          onClick={() => void fetchTargets(page)}
          disabled={targetLoading}
          className="h-10 rounded-lg border border-gray-200 bg-white px-4 text-[13px] text-gray-600 hover:border-[#ff1268] hover:text-[#ff1268] disabled:opacity-60"
        >
          {targetLoading ? '刷新中...' : '刷新'}
        </button>
      </div>

      <form onSubmit={handleSearch} className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 lg:flex-row lg:items-center">
        <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-[12px] text-gray-500">
          活动关键字
          <input
            value={keyword}
            onChange={event => setKeyword(event.target.value)}
            placeholder="搜索活动或巡演名称"
            className="h-10 rounded-lg border border-gray-200 px-3 text-[14px] text-[#111] outline-none focus:border-[#ff1268]"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-gray-500">
          类型筛选
          <select value={itemType} onChange={event => setItemType(event.target.value)} className="h-10 rounded-lg border border-gray-200 px-3 text-[14px] text-[#111] outline-none focus:border-[#ff1268]">
            <option value="">全部类型</option>
            <option value="ACTIVITY">普通活动</option>
            <option value="TOUR">大型巡演</option>
          </select>
        </label>
        <label className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 px-3 text-[13px] text-gray-600">
          <input type="checkbox" checked={todoOnly} onChange={event => setTodoOnly(event.target.checked)} className="h-4 w-4 accent-[#ff1268]" />
          仅看有待办
        </label>
        <button type="submit" className="mt-5 h-10 rounded-lg bg-[#ff1268] px-5 text-[14px] font-medium text-white hover:bg-[#e0105a]">查询</button>
      </form>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
        <table className="w-full table-fixed text-[14px]">
          <thead>
            <tr className="border-b border-gray-100 bg-[#fafafa] text-left text-gray-500">
              <th className="w-[34%] p-3">活动/巡演信息</th>
              <th className="w-[18%] p-3">主办方名称</th>
              <th className="w-[15%] p-3 text-center">评价统计</th>
              <th className="w-[15%] p-3 text-center">问答统计</th>
              <th className="w-[10%] p-3 text-center">举报待办数</th>
              <th className="w-[8%] p-3 text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {targets.length === 0 && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-[13px] text-gray-500">{targetLoading ? '加载活动互动概览中...' : '暂无互动管理数据'}</td>
              </tr>
            )}
            {targets.map(target => (
              <tr key={`${target.targetType}-${target.targetId}`} onClick={() => openDrawer(target)} className="cursor-pointer border-b border-gray-50 hover:bg-[#fff7fb]">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <SafeImage src={target.poster || null} alt={target.activityName || '活动海报'} fallbackText={target.activityName || '活动'} className="h-16 w-12 rounded-lg object-cover" />
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-[#111]" title={target.activityName}>{target.activityName || '未命名活动'}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-gray-400">
                        <span className="rounded-full bg-[#fff0f6] px-2 py-0.5 text-[#ff1268]">{targetTypeLabel(target.targetType)}</span>
                        <span>ID：{target.targetId}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="truncate p-3 text-gray-600" title={target.organizerName || ''}>{target.organizerName || '未关联主办方'}</td>
                <td className="p-3 text-center text-gray-600">
                  <div>待审核数 / 总评价数</div>
                  <div className="mt-1 font-semibold text-[#111]">{formatCount(target.pendingReviewCount)} / {formatCount(target.totalReviewCount)}</div>
                </td>
                <td className="p-3 text-center text-gray-600">
                  <div>待回复数 / 总问答数</div>
                  <div className="mt-1 font-semibold text-[#111]">{formatCount(target.pendingQuestionCount)} / {formatCount(target.totalQuestionCount)}</div>
                </td>
                <td className="p-3 text-center font-semibold text-[#ff1268]">{formatCount(target.pendingReportCount)}</td>
                <td className="p-3 text-center">
                  <button type="button" onClick={event => { event.stopPropagation(); openDrawer(target) }} className="rounded-lg border border-[#ff1268] px-3 py-1.5 text-[13px] text-[#ff1268] hover:bg-[#fff0f6]">管理互动</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-gray-100 px-4 pb-4">
          <GlobalPagination page={page} total={total} pageSize={PAGE_SIZE} loading={targetLoading} onChange={setPage} />
        </div>
      </div>

      <Drawer open={Boolean(selectedTarget)} onClose={() => setSelectedTarget(null)} title="互动详情管理" width="w-[760px]" loading={drawerLoading}>
        {selectedTarget && (
          <div className="space-y-5">
            <div className="rounded-xl border border-gray-100 bg-[#fafafa] p-4">
              <div className="flex items-center gap-3">
                <SafeImage src={selectedTarget.poster || null} alt={selectedTarget.activityName || '活动海报'} fallbackText={selectedTarget.activityName || '活动'} className="h-20 w-16 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#fff0f6] px-2 py-0.5 text-[12px] text-[#ff1268]">{targetTypeLabel(selectedTarget.targetType)}</span>
                    <span className="text-[12px] text-gray-400">ID：{selectedTarget.targetId}</span>
                  </div>
                  <div className="mt-1 truncate text-[18px] font-bold text-[#111]" title={selectedTarget.activityName}>{selectedTarget.activityName || '未命名活动'}</div>
                  <div className="mt-1 text-[13px] text-gray-500">当前前台评分：{(selectedTarget.averageRating ?? 0).toFixed(1)} · 公开评价 {formatCount(selectedTarget.publishedReviewCount)} 条</div>
                </div>
              </div>
            </div>

            <div className="flex border-b border-gray-100">
              {[
                { key: 'questions' as const, label: '购前问答', count: selectedTarget.pendingQuestionCount },
                { key: 'reviews' as const, label: '评价管理（先审后发）', count: selectedTarget.pendingReviewCount },
                { key: 'reports' as const, label: '违规举报', count: selectedTarget.pendingReportCount },
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`border-b-2 px-4 py-3 text-[14px] ${activeTab === tab.key ? 'border-[#ff1268] text-[#ff1268]' : 'border-transparent text-gray-500 hover:text-[#111]'}`}
                >
                  {tab.label} <span className="text-[12px] text-gray-400">({formatCount(tab.count)})</span>
                </button>
              ))}
            </div>

            {activeTab === 'questions' && (
              <section className="space-y-3">
                <select value={questionStatus} onChange={event => setQuestionStatus(event.target.value)} className="h-9 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]">
                  {questionStatusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                {questions.length === 0 ? <div className="rounded-lg bg-gray-50 py-10 text-center text-[13px] text-gray-500">暂无问答记录</div> : questions.map(question => {
                  const questionId = question.id || 0
                  const identity = identityDrafts[questionId] || (question.replyIdentity === 'OFFICIAL_SUPPORT' ? 'OFFICIAL_SUPPORT' : 'ORGANIZER_PROXY')
                  return (
                    <article key={question.id || `${question.activityId}-${question.userId}`} className="rounded-xl border border-gray-100 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[13px] font-semibold text-[#111]">活动编号：{question.activityId} · 用户编号：{question.userId}</div>
                        <span className="rounded-full bg-gray-50 px-3 py-1 text-[12px] text-gray-500">{questionStatusLabel(question.status)}</span>
                      </div>
                      <p className="mt-3 text-[13px] leading-6 text-gray-700">问：{question.content}</p>
                      {question.answer && (
                        <div className="mt-3 rounded-lg bg-[#fafafa] p-3 text-[13px] text-gray-600">
                          <div className="mb-1 text-[12px] text-gray-400">回复主体：{replyIdentityLabel(question.replyIdentity)} · {formatTime(question.answeredAt)}</div>
                          {question.answer}
                        </div>
                      )}
                      {canAnswerQuestion(question.status) && (
                        <div className="mt-3 space-y-2">
                          <textarea value={answerDrafts[questionId] || ''} onChange={event => setAnswerDrafts(current => ({ ...current, [questionId]: event.target.value }))} placeholder="填写回复内容" className="h-20 w-full resize-none rounded-lg border border-gray-200 p-3 text-[13px] outline-none focus:border-[#ff1268]" />
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex gap-3 text-[13px] text-gray-600">
                              <label className="inline-flex items-center gap-1"><input type="radio" checked={identity === 'OFFICIAL_SUPPORT'} onChange={() => setIdentityDrafts(current => ({ ...current, [questionId]: 'OFFICIAL_SUPPORT' }))} className="accent-[#ff1268]" />平台官方客服</label>
                              <label className="inline-flex items-center gap-1"><input type="radio" checked={identity === 'ORGANIZER_PROXY'} onChange={() => setIdentityDrafts(current => ({ ...current, [questionId]: 'ORGANIZER_PROXY' }))} className="accent-[#ff1268]" />代主办方</label>
                            </div>
                            <button type="button" disabled={actingId === `question-${question.id}`} onClick={() => void handleQuestionReply(question)} className="rounded-lg bg-[#ff1268] px-3 py-1.5 text-[13px] text-white disabled:opacity-60">提交回复</button>
                          </div>
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-gray-400">
                        <span>{formatTime(question.createTime)}</span>
                        <div className="flex flex-wrap gap-2">
                          {question.answer && <button type="button" onClick={() => openAuditModal({ type: 'question-update', title: '改写回复', question, withAnswer: true })} className="rounded border border-[#ff1268] px-3 py-1 text-[#ff1268]">改写回复</button>}
                          {canHideQuestion(question.status) && <button type="button" onClick={() => openAuditModal({ type: 'question-update', title: '下架隐藏问答', question, status: 'HIDDEN' })} className="rounded border border-gray-200 px-3 py-1 text-gray-600">下架隐藏</button>}
                          {canRestoreQuestion(question.status) && <button type="button" onClick={() => openAuditModal({ type: 'question-update', title: '恢复问答展示', question, status: question.answer ? 'ANSWERED' : 'PENDING' })} className="rounded border border-gray-200 px-3 py-1 text-gray-600">恢复展示</button>}
                          {renderStatusWarning(isKnownQuestionStatus(question.status))}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </section>
            )}

            {activeTab === 'reviews' && (
              <section className="space-y-3">
                <select value={reviewStatus} onChange={event => setReviewStatus(event.target.value)} className="h-9 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]">
                  {reviewStatusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                {reviews.length === 0 ? <div className="rounded-lg bg-gray-50 py-10 text-center text-[13px] text-gray-500">暂无评价记录</div> : reviews.map(review => (
                  <article key={review.id || `${review.activityId}-${review.userId}-${review.orderId}`} className="rounded-xl border border-gray-100 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[13px] font-semibold text-[#111]">活动编号：{review.activityId} · 订单编号：{review.orderId || '未绑定'} · 用户编号：{review.userId}</div>
                      <span className="rounded-full bg-gray-50 px-3 py-1 text-[12px] text-gray-500">{reviewStatusLabel(review.status)}</span>
                    </div>
                    <div className="mt-3 text-[13px] text-[#ff1268]">{review.rating} 星 · 购票认证</div>
                    <p className="mt-2 text-[13px] leading-6 text-gray-700">{review.content || '用户未填写文字评价'}</p>
                    {parseReviewImages(review.images).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {parseReviewImages(review.images).map(image => <SafeImage key={image} src={image} alt="评价晒图" className="h-16 w-16 rounded-lg object-cover" />)}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-gray-400">
                      <span>{formatTime(review.createTime)}</span>
                      <div className="flex flex-wrap gap-2">
                        {canApproveReview(review.status) && <button type="button" disabled={actingId === `review-${review.id}`} onClick={() => void handleReviewPublish(review)} className="rounded border border-[#ff1268] px-3 py-1 text-[#ff1268] disabled:opacity-60">通过并发布</button>}
                        {canHideReview(review.status) && <button type="button" onClick={() => openAuditModal({ type: 'review-status', title: review.status === 0 ? '驳回/屏蔽评价' : '隐藏/下架评价', review, status: 2 })} className="rounded border border-gray-200 px-3 py-1 text-gray-600">驳回/屏蔽</button>}
                        {canRestoreReview(review.status) && <button type="button" onClick={() => openAuditModal({ type: 'review-status', title: '恢复公开评价', review, status: 1 })} className="rounded border border-gray-200 px-3 py-1 text-gray-600">恢复公开</button>}
                        {renderStatusWarning(isKnownReviewStatus(review.status))}
                      </div>
                    </div>
                  </article>
                ))}
              </section>
            )}

            {activeTab === 'reports' && (
              <section className="space-y-3">
                <select value={reportStatus} onChange={event => setReportStatus(event.target.value)} className="h-9 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]">
                  {reportStatusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                {reports.length === 0 ? <div className="rounded-lg bg-gray-50 py-10 text-center text-[13px] text-gray-500">暂无举报记录</div> : reports.map(report => (
                  <article key={report.id || `${report.reviewId}-${report.userId}`} className="rounded-xl border border-gray-100 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[13px] font-semibold text-[#111]">评价编号：{report.reviewId} · 活动编号：{report.activityId} · 举报用户编号：{report.userId}</div>
                      <span className="rounded-full bg-gray-50 px-3 py-1 text-[12px] text-gray-500">{reportStatusLabel(report.status)}</span>
                    </div>
                    <p className="mt-3 text-[13px] leading-6 text-gray-700">{report.reason}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-gray-400">
                      <span>{formatTime(report.createTime)}</span>
                      <div className="flex flex-wrap gap-2">
                        {canResolveReport(report.status) && <button type="button" onClick={() => openAuditModal({ type: 'report-status', title: '确认违规并隐藏内容', report, action: 'RESOLVE' })} className="rounded border border-[#ff1268] px-3 py-1 text-[#ff1268]">确认违规并隐藏内容</button>}
                        {canRejectReport(report.status) && <button type="button" disabled={actingId === `report-${report.id}`} onClick={() => void handleReportReject(report)} className="rounded border border-gray-200 px-3 py-1 text-gray-600 disabled:opacity-60">驳回举报</button>}
                        {renderStatusWarning(isKnownReportStatus(report.status))}
                      </div>
                    </div>
                  </article>
                ))}
              </section>
            )}
          </div>
        )}
      </Drawer>

      <Modal
        open={Boolean(auditModal)}
        onClose={() => setAuditModal(null)}
        title={auditModal?.title || '操作留痕'}
        danger
        loading={Boolean(actingId)}
        footer={(
          <>
            <button type="button" onClick={() => setAuditModal(null)} disabled={Boolean(actingId)} className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-[14px] text-gray-600 hover:border-[#ff1268] hover:text-[#ff1268] disabled:opacity-60">取消</button>
            <button type="button" onClick={() => void submitAuditModal()} disabled={Boolean(actingId)} className="rounded-xl bg-[#ff1268] px-5 py-2.5 text-[14px] font-medium text-white hover:bg-[#e0105a] disabled:opacity-60">{actingId ? '提交中...' : '确认提交'}</button>
          </>
        )}
      >
        {auditModal?.type === 'question-update' && auditModal.withAnswer && (
          <div className="mb-4 space-y-2">
            <label className="block text-[13px] font-medium text-gray-700">回复内容</label>
            <textarea value={auditAnswer} onChange={event => setAuditAnswer(event.target.value)} className="h-24 w-full resize-none rounded-lg border border-gray-200 p-3 text-[13px] outline-none focus:border-[#ff1268]" />
            <div className="flex gap-4 text-[13px] text-gray-600">
              <label className="inline-flex items-center gap-1"><input type="radio" checked={auditReplyIdentity === 'OFFICIAL_SUPPORT'} onChange={() => setAuditReplyIdentity('OFFICIAL_SUPPORT')} className="accent-[#ff1268]" />平台官方客服</label>
              <label className="inline-flex items-center gap-1"><input type="radio" checked={auditReplyIdentity === 'ORGANIZER_PROXY'} onChange={() => setAuditReplyIdentity('ORGANIZER_PROXY')} className="accent-[#ff1268]" />代主办方</label>
            </div>
          </div>
        )}
        <label className="block text-[13px] font-medium text-gray-700">操作原因/备注</label>
        <textarea
          value={auditReason}
          onChange={event => setAuditReason(event.target.value)}
          placeholder="请填写操作原因/备注"
          className="mt-2 h-24 w-full resize-none rounded-lg border border-gray-200 p-3 text-[13px] outline-none focus:border-[#ff1268]"
        />
        {auditError && <div className="mt-2 text-[12px] text-[#dc2626]">{auditError}</div>}
      </Modal>
    </div>
  )
}
