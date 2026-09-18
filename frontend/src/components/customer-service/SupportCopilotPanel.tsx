'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Check,
  Pencil,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react'
import {
  acceptCsCopilotSuggestion,
  ApiError,
  editCsCopilotSuggestion,
  generateCsCopilotSuggestion,
  rejectCsCopilotSuggestion,
} from '@/lib/api'
import {
  canActOnSuggestion,
  getCopilotErrorMessage,
} from '@/lib/customer-service-copilot'
import type { SupportAiSuggestion } from '@/types/api'

type LoadingAction = 'generate' | 'accept' | 'edit' | 'reject' | null

type SupportCopilotPanelProps = {
  sessionId: number
  canUse: boolean
  onDraftChange: (draft: string) => void
}

function getApiErrorCode(error: unknown) {
  return error instanceof ApiError ? error.code : null
}

function getSuggestionText(suggestion: SupportAiSuggestion) {
  return suggestion.editedText || suggestion.suggestionText || ''
}

function getStatusLabel(status: SupportAiSuggestion['status']) {
  if (status === 'GENERATING') return '正在分析'
  if (status === 'READY') return '待人工确认'
  if (status === 'ACCEPTED') return '已采用'
  if (status === 'ACCEPTED_EDITED') return '已人工修改'
  if (status === 'REJECTED') return '已拒绝'
  if (status === 'EXPIRED') return '已失效'
  return '生成失败'
}

export default function SupportCopilotPanel({
  sessionId,
  canUse,
  onDraftChange,
}: SupportCopilotPanelProps) {
  const [suggestion, setSuggestion] = useState<SupportAiSuggestion | null>(null)
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null)
  const [error, setError] = useState('')
  const [editDraft, setEditDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const requestSessionRef = useRef(sessionId)

  const busy = loadingAction !== null
  const actionable = suggestion ? canActOnSuggestion(suggestion.status) : false

  useEffect(() => {
    requestSessionRef.current = sessionId
    setSuggestion(null)
    setLoadingAction(null)
    setError('')
    setEditDraft('')
    setEditing(false)
  }, [sessionId])

  const updateSuggestion = (next: SupportAiSuggestion) => {
    setSuggestion(next)
    if (next.status === 'ACCEPTED' || next.status === 'ACCEPTED_EDITED') {
      const text = getSuggestionText(next)
      setEditDraft(text)
      onDraftChange(text)
    }
  }

  const handleGenerate = async () => {
    if (!canUse || busy) return
    const requestedSessionId = sessionId
    setLoadingAction('generate')
    setError('')
    setEditing(false)
    try {
      const result = await generateCsCopilotSuggestion(requestedSessionId)
      if (requestSessionRef.current !== requestedSessionId) return
      setSuggestion(result)
      setEditDraft('')
    } catch (err: unknown) {
      if (requestSessionRef.current !== requestedSessionId) return
      setError(getCopilotErrorMessage(getApiErrorCode(err)))
      if (getApiErrorCode(err) === 409) {
        setSuggestion(current => current ? { ...current, status: 'EXPIRED' } : current)
      }
    } finally {
      if (requestSessionRef.current === requestedSessionId) setLoadingAction(null)
    }
  }

  const handleAccept = async () => {
    if (!suggestion || suggestion.status !== 'READY' || busy) return
    const requestedSessionId = sessionId
    setLoadingAction('accept')
    setError('')
    try {
      const result = await acceptCsCopilotSuggestion(suggestion.suggestionId)
      if (requestSessionRef.current !== requestedSessionId) return
      updateSuggestion(result)
      setEditing(false)
    } catch (err: unknown) {
      if (requestSessionRef.current !== requestedSessionId) return
      const code = getApiErrorCode(err)
      setError(getCopilotErrorMessage(code))
      if (code === 409) {
        setSuggestion(current => current ? { ...current, status: 'EXPIRED' } : current)
      }
    } finally {
      if (requestSessionRef.current === requestedSessionId) setLoadingAction(null)
    }
  }

  const handleStartEditing = async () => {
    if (!suggestion || busy) return
    if (suggestion.status === 'READY') {
      const requestedSessionId = sessionId
      setLoadingAction('accept')
      setError('')
      try {
        const result = await acceptCsCopilotSuggestion(suggestion.suggestionId)
        if (requestSessionRef.current !== requestedSessionId) return
        updateSuggestion(result)
        setEditing(true)
      } catch (err: unknown) {
        if (requestSessionRef.current !== requestedSessionId) return
        const code = getApiErrorCode(err)
        setError(getCopilotErrorMessage(code))
        if (code === 409) {
          setSuggestion(current => current ? { ...current, status: 'EXPIRED' } : current)
        }
      } finally {
        if (requestSessionRef.current === requestedSessionId) setLoadingAction(null)
      }
      return
    }
    if (suggestion.status === 'ACCEPTED') {
      setEditDraft(getSuggestionText(suggestion))
      setEditing(true)
    }
  }

  const handleSaveEdit = async () => {
    if (!suggestion || suggestion.status !== 'ACCEPTED' || !editDraft.trim() || busy) return
    const requestedSessionId = sessionId
    setLoadingAction('edit')
    setError('')
    try {
      const result = await editCsCopilotSuggestion(suggestion.suggestionId, {
        editedText: editDraft.trim(),
      })
      if (requestSessionRef.current !== requestedSessionId) return
      updateSuggestion(result)
      setEditing(false)
    } catch (err: unknown) {
      if (requestSessionRef.current !== requestedSessionId) return
      const code = getApiErrorCode(err)
      setError(getCopilotErrorMessage(code))
      if (code === 409) {
        setSuggestion(current => current ? { ...current, status: 'EXPIRED' } : current)
      }
    } finally {
      if (requestSessionRef.current === requestedSessionId) setLoadingAction(null)
    }
  }

  const handleReject = async () => {
    if (!suggestion || suggestion.status !== 'READY' || busy) return
    const requestedSessionId = sessionId
    setLoadingAction('reject')
    setError('')
    try {
      const result = await rejectCsCopilotSuggestion(suggestion.suggestionId, { reason: null })
      if (requestSessionRef.current !== requestedSessionId) return
      setSuggestion(result)
      setEditDraft('')
      setEditing(false)
    } catch (err: unknown) {
      if (requestSessionRef.current !== requestedSessionId) return
      const code = getApiErrorCode(err)
      setError(getCopilotErrorMessage(code))
      if (code === 409) {
        setSuggestion(current => current ? { ...current, status: 'EXPIRED' } : current)
      }
    } finally {
      if (requestSessionRef.current === requestedSessionId) setLoadingAction(null)
    }
  }

  return (
    <section className="border-b border-[#e5e7eb] bg-[#fffafe] px-4 py-4" data-testid="support-copilot-panel">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#fff0f5] text-[#ff1268]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-[13px] font-semibold text-[#111827]">AI 客服 Copilot</h3>
            <div className="mt-0.5 text-[10px] text-[#9ca3af]">
              {suggestion ? getStatusLabel(suggestion.status) : 'AI 草稿，人工确认后发送'}
            </div>
          </div>
        </div>
        {suggestion?.status === 'EXPIRED' ? (
          <span className="shrink-0 rounded-full bg-[#fef2f2] px-2 py-1 text-[10px] text-[#dc2626]">已失效</span>
        ) : null}
      </div>

      {!canUse ? (
        <div className="mt-3 rounded-md bg-[#f8f9fb] px-3 py-3 text-[11px] leading-5 text-[#9ca3af]">
          当前账号暂无 AI 回复建议权限
        </div>
      ) : suggestion ? (
        <div className="mt-3 space-y-3">
          {suggestion.suggestionText ? (
            <InfoBlock label="AI 回复建议">
              <div className="whitespace-pre-wrap leading-5 text-[#374151]">{suggestion.suggestionText}</div>
            </InfoBlock>
          ) : null}
          <div className="grid grid-cols-1 gap-2 text-[11px]">
            <InfoBlock label="问题摘要">{suggestion.summary || '暂无摘要'}</InfoBlock>
            <InfoBlock label="问题类型">{suggestion.issueType || '暂无分类'}</InfoBlock>
            <InfoBlock label="建议动作">{suggestion.recommendedAction || '暂无建议'}</InfoBlock>
          </div>
          <InfoBlock label="缺失信息">
            {suggestion.missingInformation.length > 0 ? (
              <ul className="space-y-1">
                {suggestion.missingInformation.map(item => <li key={item}>• {item}</li>)}
              </ul>
            ) : '暂无'}
          </InfoBlock>
          <InfoBlock label="事实依据">
            {suggestion.sourceEvidence.length > 0 ? (
              <ul className="space-y-1">
                {suggestion.sourceEvidence.map(item => (
                  <li key={`${item.factKey}-${item.text}`}>
                    <span className="text-[#9ca3af]">{item.factKey}：</span>{item.text}
                  </li>
                ))}
              </ul>
            ) : '暂无'}
          </InfoBlock>

          {suggestion.status === 'EXPIRED' ? (
            <div className="rounded-md bg-[#fef2f2] px-3 py-2 text-[11px] leading-5 text-[#dc2626]">
              会话内容已发生变化，当前 AI 建议已失效，请重新生成。
            </div>
          ) : suggestion.status === 'FAILED' ? (
            <div className="rounded-md bg-[#fff7ed] px-3 py-2 text-[11px] leading-5 text-[#c2410c]">
              {error || 'AI 建议生成失败，请重新生成。'}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-md bg-[#f8f9fb] px-3 py-2 text-[11px] text-[#6b7280]">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-[#9ca3af]" />
              AI 建议尚未发送
            </div>
          )}

          {editing && suggestion.status === 'ACCEPTED' ? (
            <div className="space-y-2">
              <textarea
                value={editDraft}
                onChange={event => setEditDraft(event.target.value)}
                rows={4}
                maxLength={5000}
                className="w-full resize-none rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-[12px] leading-5 text-[#374151] outline-none focus:border-[#ff1268]"
                aria-label="编辑 AI 回复建议"
              />
              <button
                type="button"
                onClick={() => void handleSaveEdit()}
                disabled={busy || !editDraft.trim()}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#ff1268] px-3 text-[11px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Check className="h-3.5 w-3.5" />
                {loadingAction === 'edit' ? '保存中...' : '保存修改'}
              </button>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {suggestion.status === 'READY' ? (
              <>
                <button
                  type="button"
                  onClick={() => void handleAccept()}
                  disabled={busy}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#ff1268] px-3 text-[11px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Check className="h-3.5 w-3.5" />
                  {loadingAction === 'accept' ? '处理中...' : '采用建议'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleStartEditing()}
                  disabled={busy}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#e5e7eb] bg-white px-3 text-[11px] font-medium text-[#4b5563] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  编辑
                </button>
                <button
                  type="button"
                  onClick={() => void handleReject()}
                  disabled={busy}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#fecaca] bg-white px-3 text-[11px] font-medium text-[#dc2626] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <X className="h-3.5 w-3.5" />
                  拒绝
                </button>
              </>
            ) : null}
            {suggestion.status === 'ACCEPTED' && !editing ? (
              <button
                type="button"
                onClick={() => void handleStartEditing()}
                disabled={busy}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#e5e7eb] bg-white px-3 text-[11px] font-medium text-[#4b5563] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Pencil className="h-3.5 w-3.5" />
                编辑
              </button>
            ) : null}
            {suggestion.status === 'EXPIRED' ? (
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={busy}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#ff1268] px-3 text-[11px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                重新生成
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <div className="rounded-md bg-white px-3 py-3 text-[11px] text-[#9ca3af]">暂无 AI 回复建议</div>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={busy}
            className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-[#ff1268] text-[12px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {loadingAction === 'generate' ? '正在分析会话……' : '生成 AI 回复建议'}
          </button>
        </div>
      )}

      {suggestion?.status !== 'EXPIRED' && error ? (
        <div className="mt-3 rounded-md bg-[#fef2f2] px-3 py-2 text-[11px] leading-5 text-[#dc2626]">{error}</div>
      ) : null}

      {suggestion && !actionable && suggestion.status === 'ACCEPTED_EDITED' ? (
        <div className="mt-2 text-[10px] text-[#6b7280]">已接受 AI 建议，可继续修改；发送前请人工确认。</div>
      ) : null}
    </section>
  )
}

function InfoBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md bg-white px-3 py-2 text-[11px] leading-5 text-[#4b5563]">
      <div className="mb-1 text-[10px] font-semibold text-[#9ca3af]">{label}</div>
      {children}
    </div>
  )
}
