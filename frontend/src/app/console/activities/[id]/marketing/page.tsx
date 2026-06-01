'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, BarChart3, Save, TicketPercent } from 'lucide-react'
import { getActivityMarketing, updateActivityMarketing } from '@/lib/api'
import { formatDiscountRule, normalizeFunnelSteps } from '@/lib/marketing-tools'
import type { ActivityMarketingOverviewVO, ActivityMarketingRulePayload } from '@/types/api'

export default function ActivityMarketingPage() {
  const params = useParams<{ id: string }>()
  const activityId = Number(params.id)
  const [overview, setOverview] = useState<ActivityMarketingOverviewVO | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<ActivityMarketingRulePayload>({
    enabled: false,
    couponName: '',
    discountType: 'FULL_REDUCTION',
    thresholdAmount: null,
    discountAmount: null,
    maxCouponCount: null,
    perUserLimit: 1,
  })

  const funnelSteps = useMemo(() => normalizeFunnelSteps(overview?.funnelSteps ?? []), [overview])

  const loadMarketing = () => {
    if (!Number.isInteger(activityId) || activityId <= 0) {
      setError('活动ID不正确')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    getActivityMarketing(activityId)
      .then((data) => {
        setOverview(data)
        setForm({
          enabled: Boolean(data.rule?.enabled),
          couponName: data.rule?.couponName ?? '',
          discountType: data.rule?.discountType === 'DIRECT_REDUCTION' ? 'DIRECT_REDUCTION' : 'FULL_REDUCTION',
          thresholdAmount: data.rule?.thresholdAmount ?? null,
          discountAmount: data.rule?.discountAmount ?? null,
          maxCouponCount: data.rule?.maxCouponCount ?? null,
          perUserLimit: data.rule?.perUserLimit ?? 1,
          startTime: data.rule?.startTime ?? null,
          endTime: data.rule?.endTime ?? null,
        })
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : '营销数据加载失败')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadMarketing()
  }, [activityId])

  const updateNumber = (key: 'thresholdAmount' | 'discountAmount' | 'maxCouponCount' | 'perUserLimit', value: string) => {
    setForm((prev) => ({ ...prev, [key]: value === '' ? null : Number(value) }))
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const next = await updateActivityMarketing(activityId, form)
      setOverview(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : '营销配置保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="py-20 text-center text-[14px] text-[#999]">加载中...</div>
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/console/activities" className="mb-2 inline-flex items-center gap-1 text-[13px] text-[#666] hover:text-[#ff1268]">
            <ArrowLeft className="h-4 w-4" /> 返回活动列表
          </Link>
          <h1 className="text-[22px] font-bold text-[#1a1a2e]">活动营销工具</h1>
          <p className="mt-1 text-[13px] text-[#999]">{overview?.activityName || '当前活动'}</p>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-[#ffd9e6] bg-white px-4 py-3 text-[14px] text-[#ff4d4f]">{error}</div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
        <form onSubmit={submit} className="rounded-xl border border-[#e5e5e5] bg-white p-5">
          <div className="mb-5 flex items-center gap-2">
            <TicketPercent className="h-5 w-5 text-[#ff1268]" />
            <h2 className="text-[16px] font-semibold text-[#1a1a2e]">优惠券 / 满减</h2>
          </div>

          <label className="mb-4 flex items-center justify-between rounded-lg border border-[#e5e5e5] px-3 py-2 text-[14px]">
            <span className="text-[#333]">启用优惠</span>
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => setForm((prev) => ({ ...prev, enabled: event.target.checked }))}
              className="h-4 w-4 accent-[#ff1268]"
            />
          </label>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-[13px] text-[#666]">优惠名称</span>
              <input
                value={form.couponName ?? ''}
                onChange={(event) => setForm((prev) => ({ ...prev, couponName: event.target.value }))}
                className="h-10 w-full rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]"
                placeholder="例如：开票满减"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[13px] text-[#666]">优惠类型</span>
              <select
                value={form.discountType}
                onChange={(event) => setForm((prev) => ({ ...prev, discountType: event.target.value }))}
                className="h-10 w-full rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]"
              >
                <option value="FULL_REDUCTION">满减</option>
                <option value="DIRECT_REDUCTION">立减</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[13px] text-[#666]">满减门槛</span>
                <input
                  type="number"
                  min="0"
                  value={form.thresholdAmount ?? ''}
                  onChange={(event) => updateNumber('thresholdAmount', event.target.value)}
                  disabled={form.discountType !== 'FULL_REDUCTION'}
                  className="h-10 w-full rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268] disabled:bg-[#f7f7f7] disabled:text-[#aaa]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] text-[#666]">优惠金额</span>
                <input
                  type="number"
                  min="0"
                  value={form.discountAmount ?? ''}
                  onChange={(event) => updateNumber('discountAmount', event.target.value)}
                  className="h-10 w-full rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[13px] text-[#666]">发券数量</span>
                <input
                  type="number"
                  min="1"
                  value={form.maxCouponCount ?? ''}
                  onChange={(event) => updateNumber('maxCouponCount', event.target.value)}
                  className="h-10 w-full rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] text-[#666]">每人限领</span>
                <input
                  type="number"
                  min="1"
                  value={form.perUserLimit ?? ''}
                  onChange={(event) => updateNumber('perUserLimit', event.target.value)}
                  className="h-10 w-full rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]"
                />
              </label>
            </div>
          </div>

          <div className="mt-5 rounded-lg bg-[#fff7fb] px-3 py-2 text-[13px] text-[#ff1268]">
            {formatDiscountRule(overview?.rule)}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#ff1268] text-[14px] font-medium text-white disabled:bg-[#ffc0d7]"
          >
            <Save className="h-4 w-4" /> {saving ? '保存中...' : '保存营销配置'}
          </button>
        </form>

        <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
          <div className="mb-5 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#1a1a2e]" />
            <h2 className="text-[16px] font-semibold text-[#1a1a2e]">活动漏斗</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {funnelSteps.map((step) => (
              <div key={step.key} className="rounded-lg border border-[#eeeeee] p-4">
                <div className="text-[13px] text-[#666]">{step.label}</div>
                <div className="mt-2 text-[28px] font-bold leading-none text-[#1a1a2e]">{step.count}</div>
                <div className="mt-2 text-[12px] text-[#999]">上一步转化 {step.rateText}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
