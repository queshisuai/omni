export type ActivitySubscriptionActionType =
  | 'ACTIVITY_WANT'
  | 'SALE_REMINDER'
  | 'ARTIST_FOLLOW'
  | 'CALENDAR'

export interface ActivitySaleStatusLike {
  status?: number | null
}

export interface ActivitySubscriptionAction {
  type: ActivitySubscriptionActionType
  label: string
  loadingLabel: string
  tone: 'primary' | 'secondary'
}

export function isActivityOnSale(activity?: ActivitySaleStatusLike | null): boolean {
  return Number(activity?.status) === 1
}

export function getActivitySubscriptionActions(activity?: ActivitySaleStatusLike | null): ActivitySubscriptionAction[] {
  const actions: ActivitySubscriptionAction[] = [
    { type: 'ACTIVITY_WANT', label: '想看', loadingLabel: '添加中...', tone: 'primary' },
  ]

  if (!isActivityOnSale(activity)) {
    actions.push({ type: 'SALE_REMINDER', label: '开售提醒', loadingLabel: '开启中...', tone: 'secondary' })
  }

  actions.push(
    { type: 'ARTIST_FOLLOW', label: '关注艺人', loadingLabel: '关注中...', tone: 'secondary' },
    { type: 'CALENDAR', label: '加入日历', loadingLabel: '生成中...', tone: 'secondary' },
  )

  return actions
}
