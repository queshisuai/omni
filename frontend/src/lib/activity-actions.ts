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
  activeLoadingLabel?: string
  tone: 'primary' | 'secondary'
}

export interface ActivitySubscriptionLike {
  id: number
  targetType?: string | null
  targetId?: number | string | null
  activityId?: number | string | null
  artistId?: number | string | null
  status?: number | null
}

export interface ActivitySubscriptionContext {
  activityId?: number | string | null
  artistId?: number | string | null
}

export interface ActivitySubscriptionLabelState {
  active?: boolean
  loading?: boolean
}

const ACTIVE_ACTION_LABELS: Partial<Record<ActivitySubscriptionActionType, string>> = {
  ACTIVITY_WANT: '已想看',
  SALE_REMINDER: '已提醒',
  ARTIST_FOLLOW: '已关注',
  CALENDAR: '已加入日历',
}

export function isActivityOnSale(activity?: ActivitySaleStatusLike | null): boolean {
  return Number(activity?.status) === 1
}

export function getActivitySubscriptionActions(activity?: ActivitySaleStatusLike | null): ActivitySubscriptionAction[] {
  const actions: ActivitySubscriptionAction[] = [
    { type: 'ACTIVITY_WANT', label: '想看', loadingLabel: '添加中...', activeLoadingLabel: '取消中...', tone: 'primary' },
  ]

  if (!isActivityOnSale(activity)) {
    actions.push({ type: 'SALE_REMINDER', label: '开售提醒', loadingLabel: '开启中...', activeLoadingLabel: '取消中...', tone: 'secondary' })
  }

  actions.push(
    { type: 'ARTIST_FOLLOW', label: '关注艺人', loadingLabel: '关注中...', activeLoadingLabel: '取消中...', tone: 'secondary' },
    { type: 'CALENDAR', label: '加入日历', loadingLabel: '生成中...', tone: 'secondary' },
  )

  return actions
}

function toPositiveNumber(value: number | string | null | undefined) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
}

function sameId(left: number | string | null | undefined, right: number | string | null | undefined) {
  const leftNumber = toPositiveNumber(left)
  const rightNumber = toPositiveNumber(right)
  return leftNumber != null && rightNumber != null && leftNumber === rightNumber
}

function isActiveSubscription(subscription: ActivitySubscriptionLike) {
  return Number(subscription.status ?? 1) === 1
}

export function findActivitySubscriptionAction(
  actionType: Exclude<ActivitySubscriptionActionType, 'CALENDAR'>,
  subscriptions: ActivitySubscriptionLike[],
  context: ActivitySubscriptionContext,
) {
  return subscriptions.find((subscription) => {
    if (!isActiveSubscription(subscription)) return false
    if (String(subscription.targetType).toUpperCase() !== actionType) return false
    if (actionType === 'ARTIST_FOLLOW') {
      return sameId(subscription.artistId, context.artistId) || sameId(subscription.targetId, context.artistId)
    }
    return sameId(subscription.activityId, context.activityId) || sameId(subscription.targetId, context.activityId)
  }) ?? null
}

export function getActivitySubscriptionActionLabel(
  action: ActivitySubscriptionAction,
  state: ActivitySubscriptionLabelState = {},
) {
  if (state.loading) return state.active ? action.activeLoadingLabel ?? action.loadingLabel : action.loadingLabel
  if (state.active) return ACTIVE_ACTION_LABELS[action.type] ?? action.label
  return action.label
}

export function upsertActivitySubscription(
  subscriptions: ActivitySubscriptionLike[],
  subscription: ActivitySubscriptionLike,
) {
  return [
    subscription,
    ...subscriptions.filter(item => item.id !== subscription.id),
  ]
}

export function removeActivitySubscriptionById(
  subscriptions: ActivitySubscriptionLike[],
  subscriptionId: number,
) {
  return subscriptions.filter(item => item.id !== subscriptionId)
}
