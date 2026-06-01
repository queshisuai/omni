import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildDashboardBars, formatDiscountRule, normalizeFunnelSteps, summarizeOpsMetric } from './marketing-tools.ts'

test('formats full reduction coupon rule in Chinese', () => {
  assert.equal(formatDiscountRule({
    enabled: true,
    couponName: '开票满减',
    discountType: 'FULL_REDUCTION',
    thresholdAmount: 300,
    discountAmount: 30,
    maxCouponCount: 500,
    perUserLimit: 1,
    status: 1,
  }), '开票满减：满 300 元减 30 元，每人限领 1 张，共 500 张')
})

test('formats disabled marketing rule clearly', () => {
  assert.equal(formatDiscountRule({
    enabled: false,
    couponName: '',
    discountType: 'NONE',
    thresholdAmount: null,
    discountAmount: null,
    maxCouponCount: null,
    perUserLimit: null,
    status: 0,
  }), '暂未启用优惠')
})

test('normalizes funnel steps with conversion rate from previous step', () => {
  const steps = normalizeFunnelSteps([
    { key: 'exposure', label: '曝光', count: 100 },
    { key: 'detail', label: '详情页', count: 50 },
    { key: 'paid', label: '支付', count: 10 },
  ])

  assert.equal(steps[0].rateText, '基准')
  assert.equal(steps[1].rateText, '50.0%')
  assert.equal(steps[2].rateText, '20.0%')
})

test('summarizes operation metric rate', () => {
  assert.equal(summarizeOpsMetric({ numerator: 3, denominator: 12 }), '25.0%')
  assert.equal(summarizeOpsMetric({ numerator: 0, denominator: 0 }), '暂无数据')
})

test('normalizes dashboard bars against the largest value', () => {
  const bars = buildDashboardBars([
    { label: '票档售罄', value: 20 },
    { label: '重复请求', value: 5 },
  ])

  assert.deepEqual(bars.map(item => item.widthPercent), [100, 25])
  assert.equal(buildDashboardBars([{ label: '暂无', value: 0 }])[0].widthPercent, 0)
})
