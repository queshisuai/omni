import type { SupportAiSuggestionStatus } from '../types/api.ts'

export function canUseSupportCopilot(
  role: string | null | undefined,
  permissionCodes: string[] = [],
) {
  void role
  return permissionCodes.includes('support.ai.use')
}

export function getCopilotErrorMessage(code: number | null) {
  if (code === 409) return '会话内容已发生变化，当前 AI 建议已失效，请重新生成。'
  if (code === 502) return 'AI 返回内容未通过系统事实校验，请重新生成。'
  if (code === 503) return 'AI 服务暂时不可用，请稍后重试。'
  return 'AI 建议处理失败，请稍后重试。'
}

export function canActOnSuggestion(status: SupportAiSuggestionStatus) {
  return status === 'READY' || status === 'ACCEPTED'
}

export function isCopilotDraftStatus(status: SupportAiSuggestionStatus) {
  return status === 'READY' || status === 'ACCEPTED' || status === 'ACCEPTED_EDITED'
}

export function haveMessagesChanged(previousIds: number[], nextIds: number[]) {
  return previousIds.length !== nextIds.length
    || previousIds.some((id, index) => id !== nextIds[index])
}
