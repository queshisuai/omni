'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  listAdminActivityQuestions,
  listAdminActivityReviewReports,
  listAdminActivityReviews,
  moderateAdminActivityQuestion,
  moderateAdminActivityReview,
  moderateAdminActivityReviewReport,
} from '@/lib/api'
import { globalAlert } from '@/components/GlobalDialog'
import type { ActivityQuestionVO, ActivityReviewReportVO, ActivityReviewVO } from '@/types/api'

type TabKey = 'reviews' | 'reports' | 'questions'

const reviewStatusOptions = [
  { label: '待审核', value: '0' },
  { label: '已展示', value: '1' },
  { label: '已隐藏', value: '2' },
  { label: '全部', value: '' },
]

const reportStatusOptions = [
  { label: '待处理', value: 'PENDING' },
  { label: '已处理', value: 'RESOLVED' },
  { label: '已驳回', value: 'REJECTED' },
  { label: '全部', value: '' },
]

const questionStatusOptions = [
  { label: '待回复', value: 'PENDING' },
  { label: '已回复', value: 'ANSWERED' },
  { label: '已隐藏', value: 'HIDDEN' },
  { label: '全部', value: '' },
]

function formatTime(value?: string | null) {
  if (!value) return '暂无时间'
  return value.slice(0, 16).replace('T', ' ')
}

function reviewStatusLabel(status?: number | null) {
  if (status === 0) return '待审核'
  if (status === 1) return '已展示'
  if (status === 2) return '已隐藏'
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

function questionStatusLabel(status: string) {
  if (status === 'PENDING') return '待回复'
  if (status === 'ANSWERED') return '已回复'
  if (status === 'HIDDEN') return '已隐藏'
  return '未知问答状态'
}

function isKnownQuestionStatus(value?: string | null) {
  return value === 'PENDING' || value === 'ANSWERED' || value === 'HIDDEN'
}

function canAnswerQuestion(value?: string | null) {
  return isKnownQuestionStatus(value)
}

function canHideQuestion(value?: string | null) {
  return value === 'PENDING' || value === 'ANSWERED'
}

function canRestoreQuestion(value?: string | null) {
  return value === 'HIDDEN'
}

function reportStatusLabel(status: string) {
  if (status === 'PENDING') return '待处理'
  if (status === 'RESOLVED') return '已处理'
  if (status === 'REJECTED') return '已驳回'
  return '未知举报状态'
}

export default function ActivityEngagementConsolePage() {
  const [activeTab, setActiveTab] = useState<TabKey>('reviews')
  const [reviews, setReviews] = useState<ActivityReviewVO[]>([])
  const [reports, setReports] = useState<ActivityReviewReportVO[]>([])
  const [questions, setQuestions] = useState<ActivityQuestionVO[]>([])
  const [reviewStatus, setReviewStatus] = useState('0')
  const [reportStatus, setReportStatus] = useState('PENDING')
  const [questionStatus, setQuestionStatus] = useState('PENDING')
  const [answerDrafts, setAnswerDrafts] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)

  const loadReviews = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listAdminActivityReviews({ status: reviewStatus === '' ? undefined : Number(reviewStatus) })
      setReviews(data)
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '加载评价失败')
    } finally {
      setLoading(false)
    }
  }, [reviewStatus])

  const loadReports = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listAdminActivityReviewReports(reportStatus || undefined)
      setReports(data)
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '加载举报失败')
    } finally {
      setLoading(false)
    }
  }, [reportStatus])

  const loadQuestions = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listAdminActivityQuestions({ status: questionStatus || undefined })
      setQuestions(data)
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '加载问答失败')
    } finally {
      setLoading(false)
    }
  }, [questionStatus])

  const refreshActive = useCallback(async () => {
    if (activeTab === 'reviews') await loadReviews()
    if (activeTab === 'reports') await loadReports()
    if (activeTab === 'questions') await loadQuestions()
  }, [activeTab, loadQuestions, loadReports, loadReviews])

  useEffect(() => {
    void refreshActive()
  }, [refreshActive])

  const counts = useMemo(() => ({
    reviews: reviews.length,
    reports: reports.length,
    questions: questions.length,
  }), [questions.length, reports.length, reviews.length])

  const handleReviewAction = async (reviewId: number | null | undefined, action: 'APPROVE' | 'HIDE' | 'RESTORE') => {
    if (!reviewId) return
    setActingId(`review-${reviewId}`)
    try {
      await moderateAdminActivityReview(reviewId, action)
      await loadReviews()
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '处理评价失败')
    } finally {
      setActingId(null)
    }
  }

  const handleReportAction = async (reportId: number | null | undefined, action: 'RESOLVE' | 'REJECT') => {
    if (!reportId) return
    setActingId(`report-${reportId}`)
    try {
      await moderateAdminActivityReviewReport(reportId, action)
      await loadReports()
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '处理举报失败')
    } finally {
      setActingId(null)
    }
  }

  const handleQuestionAnswer = async (question: ActivityQuestionVO) => {
    if (!question.id) return
    const answer = (answerDrafts[question.id] || question.answer || '').trim()
    if (!answer) {
      await globalAlert('请填写回复内容')
      return
    }
    setActingId(`question-${question.id}`)
    try {
      await moderateAdminActivityQuestion(question.id, { action: 'ANSWER', answer })
      setAnswerDrafts(current => ({ ...current, [question.id!]: '' }))
      await loadQuestions()
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '回复问题失败')
    } finally {
      setActingId(null)
    }
  }

  const handleQuestionAction = async (questionId: number | null | undefined, action: 'HIDE' | 'RESTORE') => {
    if (!questionId) return
    setActingId(`question-${questionId}`)
    try {
      await moderateAdminActivityQuestion(questionId, { action })
      await loadQuestions()
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '处理问题失败')
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#111]">评价问答管理</h1>
          <p className="mt-1 text-[13px] text-gray-500">审核购后评价、处理用户举报，并维护活动购前问答。</p>
        </div>
        <button
          type="button"
          onClick={() => void refreshActive()}
          disabled={loading}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-[13px] text-gray-600 hover:border-[#ff1268] hover:text-[#ff1268] disabled:opacity-60"
        >
          {loading ? '刷新中...' : '刷新'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {[
          { key: 'reviews' as const, label: '评价审核', count: counts.reviews },
          { key: 'reports' as const, label: '评价举报', count: counts.reports },
          { key: 'questions' as const, label: '购前问答', count: counts.questions },
        ].map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`border-b-2 px-4 py-3 text-[14px] ${
              activeTab === tab.key
                ? 'border-[#ff1268] text-[#ff1268]'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            {tab.label} <span className="text-[12px] text-gray-400">({tab.count})</span>
          </button>
        ))}
      </div>

      {activeTab === 'reviews' && (
        <section className="space-y-3">
          <select
            value={reviewStatus}
            onChange={event => setReviewStatus(event.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-[#ff1268]"
          >
            {reviewStatusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          {reviews.length === 0 ? (
            <div className="rounded-lg bg-white py-12 text-center text-[13px] text-gray-500">暂无评价记录</div>
          ) : (
            <div className="space-y-3">
              {reviews.map(review => (
                <article key={review.id || `${review.activityId}-${review.userId}-${review.orderId}`} className="rounded-lg border border-gray-100 bg-white p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[14px] font-semibold text-[#111]">活动编号：{review.activityId} · 订单编号：{review.orderId || '未绑定'}</div>
                    <span className="rounded-full bg-gray-50 px-3 py-1 text-[12px] text-gray-500">{reviewStatusLabel(review.status)}</span>
                  </div>
                  <div className="mb-2 text-[13px] text-[#ff1268]">{review.rating} 星</div>
                  <p className="text-[13px] leading-6 text-gray-600">{review.content || '用户未填写文字评价'}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[12px] text-gray-400">
                    <span>用户编号：{review.userId} · {formatTime(review.createTime)}</span>
                    <div className="flex flex-wrap gap-2">
                      {canApproveReview(review.status) && <button disabled={actingId === `review-${review.id}`} onClick={() => void handleReviewAction(review.id, 'APPROVE')} className="rounded border border-[#ff1268] px-3 py-1 text-[#ff1268] disabled:opacity-60">通过</button>}
                      {canHideReview(review.status) && <button disabled={actingId === `review-${review.id}`} onClick={() => void handleReviewAction(review.id, 'HIDE')} className="rounded border border-gray-200 px-3 py-1 text-gray-600 disabled:opacity-60">隐藏</button>}
                      {canRestoreReview(review.status) && <button disabled={actingId === `review-${review.id}`} onClick={() => void handleReviewAction(review.id, 'RESTORE')} className="rounded border border-gray-200 px-3 py-1 text-gray-600 disabled:opacity-60">恢复展示</button>}
                      {!isKnownReviewStatus(review.status) && <span className="rounded border border-[#ffd591] bg-[#fff7e6] px-3 py-1 text-[#ad6800]">状态待核对</span>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'reports' && (
        <section className="space-y-3">
          <select
            value={reportStatus}
            onChange={event => setReportStatus(event.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-[#ff1268]"
          >
            {reportStatusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          {reports.length === 0 ? (
            <div className="rounded-lg bg-white py-12 text-center text-[13px] text-gray-500">暂无举报记录</div>
          ) : (
            <div className="space-y-3">
              {reports.map(report => (
                <article key={report.id || `${report.reviewId}-${report.userId}`} className="rounded-lg border border-gray-100 bg-white p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[14px] font-semibold text-[#111]">评价编号：{report.reviewId} · 活动编号：{report.activityId}</div>
                    <span className="rounded-full bg-gray-50 px-3 py-1 text-[12px] text-gray-500">{reportStatusLabel(report.status)}</span>
                  </div>
                  <p className="text-[13px] leading-6 text-gray-600">{report.reason}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[12px] text-gray-400">
                    <span>举报用户编号：{report.userId} · {formatTime(report.createTime)}</span>
                    {report.status === 'PENDING' && (
                      <div className="flex flex-wrap gap-2">
                        <button disabled={actingId === `report-${report.id}`} onClick={() => void handleReportAction(report.id, 'RESOLVE')} className="rounded border border-[#ff1268] px-3 py-1 text-[#ff1268] disabled:opacity-60">确认并隐藏评价</button>
                        <button disabled={actingId === `report-${report.id}`} onClick={() => void handleReportAction(report.id, 'REJECT')} className="rounded border border-gray-200 px-3 py-1 text-gray-600 disabled:opacity-60">驳回举报</button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'questions' && (
        <section className="space-y-3">
          <select
            value={questionStatus}
            onChange={event => setQuestionStatus(event.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-[#ff1268]"
          >
            {questionStatusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          {questions.length === 0 ? (
            <div className="rounded-lg bg-white py-12 text-center text-[13px] text-gray-500">暂无问答记录</div>
          ) : (
            <div className="space-y-3">
              {questions.map(question => (
                <article key={question.id || `${question.activityId}-${question.userId}`} className="rounded-lg border border-gray-100 bg-white p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[14px] font-semibold text-[#111]">活动编号：{question.activityId} · 用户编号：{question.userId}</div>
                    <span className="rounded-full bg-gray-50 px-3 py-1 text-[12px] text-gray-500">{questionStatusLabel(question.status)}</span>
                  </div>
                  <p className="mb-3 text-[13px] leading-6 text-gray-700">问：{question.content}</p>
                  <textarea
                    value={answerDrafts[question.id || 0] ?? question.answer ?? ''}
                    onChange={event => question.id && setAnswerDrafts(current => ({ ...current, [question.id!]: event.target.value }))}
                    placeholder="填写主办方回复"
                    className="h-20 w-full resize-none rounded-lg border border-gray-200 p-3 text-[13px] outline-none focus:border-[#ff1268]"
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[12px] text-gray-400">
                    <span>{formatTime(question.createTime)}</span>
                    <div className="flex flex-wrap gap-2">
                      {canAnswerQuestion(question.status) && <button disabled={actingId === `question-${question.id}`} onClick={() => void handleQuestionAnswer(question)} className="rounded border border-[#ff1268] px-3 py-1 text-[#ff1268] disabled:opacity-60">保存回复</button>}
                      {canHideQuestion(question.status) && <button disabled={actingId === `question-${question.id}`} onClick={() => void handleQuestionAction(question.id, 'HIDE')} className="rounded border border-gray-200 px-3 py-1 text-gray-600 disabled:opacity-60">隐藏</button>}
                      {canRestoreQuestion(question.status) && <button disabled={actingId === `question-${question.id}`} onClick={() => void handleQuestionAction(question.id, 'RESTORE')} className="rounded border border-gray-200 px-3 py-1 text-gray-600 disabled:opacity-60">恢复</button>}
                      {!isKnownQuestionStatus(question.status) && <span className="rounded border border-[#ffd591] bg-[#fff7e6] px-3 py-1 text-[#ad6800]">状态待核对</span>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
