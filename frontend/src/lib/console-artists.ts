import type { ArtistRiskStatus } from '@/types/api'

export type ArtistListStatusTone = 'green' | 'red' | 'yellow' | 'gray'

export function formatArtistListReviewStatus(status?: string | null) {
  switch (status) {
    case 'pending':
      return '待审核'
    case 'approved':
      return '已通过'
    case 'rejected':
      return '已拒绝'
    default:
      return '未知审核状态'
  }
}

export function getArtistListReviewTone(status?: string | null): ArtistListStatusTone {
  switch (status) {
    case 'approved':
      return 'green'
    case 'rejected':
      return 'red'
    case 'pending':
    default:
      return 'yellow'
  }
}

export function formatArtistListRiskStatus(status?: string | null) {
  switch (status) {
    case 'normal':
      return '风险正常'
    case 'risky':
      return '风险艺人'
    default:
      return '未知风险状态'
  }
}

export function getArtistListRiskTone(status?: string | null): ArtistListStatusTone {
  switch (status) {
    case 'risky':
      return 'red'
    case 'normal':
      return 'gray'
    default:
      return 'yellow'
  }
}

export function canToggleArtistRiskStatus(status?: string | null) {
  return status === 'normal' || status === 'risky'
}

export function getNextArtistRiskStatus(status?: string | null): ArtistRiskStatus | null {
  if (status === 'risky') return 'normal'
  if (status === 'normal') return 'risky'
  return null
}

export function formatArtistRiskToggleAction(status?: string | null) {
  if (status === 'risky') return '解除风险'
  if (status === 'normal') return '列入风险'
  return '状态待核对'
}
