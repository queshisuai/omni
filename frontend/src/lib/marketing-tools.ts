import type { ActivityFunnelStepVO, ActivityMarketingRuleVO } from '@/types/api'

export interface NormalizedFunnelStep extends ActivityFunnelStepVO {
  rateText: string
}

export interface DashboardBar {
  label: string
  value: number
  widthPercent: number
}

export function formatDiscountRule(rule: ActivityMarketingRuleVO | null | undefined) {
  if (!rule?.enabled || rule.discountType === 'NONE') return '暂未启用优惠'
  const name = rule.couponName?.trim() || '活动优惠'
  const discount = formatMoney(rule.discountAmount)
  const maxCount = rule.maxCouponCount ? `，共 ${rule.maxCouponCount} 张` : ''
  const perUser = rule.perUserLimit ? `，每人限领 ${rule.perUserLimit} 张` : ''
  if (rule.discountType === 'FULL_REDUCTION') {
    return `${name}：满 ${formatMoney(rule.thresholdAmount)} 元减 ${discount} 元${perUser}${maxCount}`
  }
  return `${name}：立减 ${discount} 元${perUser}${maxCount}`
}

export function normalizeFunnelSteps(steps: ActivityFunnelStepVO[]): NormalizedFunnelStep[] {
  return steps.map((step, index) => {
    if (index === 0) return { ...step, rateText: '基准' }
    const previous = steps[index - 1]?.count ?? 0
    return { ...step, rateText: previous > 0 ? `${((step.count / previous) * 100).toFixed(1)}%` : '暂无数据' }
  })
}

export function summarizeOpsMetric(input: { numerator: number; denominator: number }) {
  if (input.denominator <= 0) return '暂无数据'
  return `${((input.numerator / input.denominator) * 100).toFixed(1)}%`
}

export function buildDashboardBars(items: Array<{ label: string; value: number }>): DashboardBar[] {
  const maxValue = Math.max(0, ...items.map(item => Number(item.value) || 0))
  return items.map(item => {
    const value = Math.max(0, Number(item.value) || 0)
    return {
      label: item.label,
      value,
      widthPercent: maxValue > 0 ? Math.round((value / maxValue) * 1000) / 10 : 0,
    }
  })
}

function formatMoney(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return '0'
  return Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}
