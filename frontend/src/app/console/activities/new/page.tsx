'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { listCategories, listAdminVenues, createAdminActivity, createAdminSession, createAdminTicketType, deleteAdminActivity, getVenueDefaultLayout, updateActivitySeatLayout } from '@/lib/api'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import type { CategoryVO, VenueEntity, ActivityEntity, SessionEntity, SeatCraftLayoutVO, UserRole } from '@/types/api'

type SessionDraft = {
  key: string
  venueId: number | null
  startTime: string
  endTime: string
}

type TicketTypeDraft = {
  key: string
  sessionKey: string
  name: string
  price: number
  totalStock: number
}

export default function NewActivityPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [role, setRole] = useState<UserRole | ''>('')
  const [checkingRole, setCheckingRole] = useState(true)

  // 分类和场馆
  const [categories, setCategories] = useState<CategoryVO[]>([])
  const [venues, setVenues] = useState<VenueEntity[]>([])

  // 步骤1：基本信息
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [artistName, setArtistName] = useState('')
  const [description, setDescription] = useState('')
  const [poster, setPoster] = useState('')

  // 步骤2：场次
  const [sessions, setSessions] = useState<SessionDraft[]>([{ key: 's1', venueId: null, startTime: '', endTime: '' }])
  const [venueDefaultLayout, setVenueDefaultLayout] = useState<SeatCraftLayoutVO | null>(null)
  const [loadingDefaultLayout, setLoadingDefaultLayout] = useState(false)

  // 步骤3：票档
  const [ticketTypes, setTicketTypes] = useState<TicketTypeDraft[]>([
    { key: 't1', sessionKey: 's1', name: '', price: 0, totalStock: 0 },
  ])

  useEffect(() => {
    const u = getUser()
    if (!u) return
    setRole(u.role || 'user')
    setCheckingRole(false)
    listCategories().then(setCategories).catch(() => {})
    listAdminVenues(u.userId).then(setVenues).catch(() => {})
  }, [])

  const primaryVenueId = sessions.find(s => s.venueId)?.venueId ?? null

  useEffect(() => {
    const u = getUser()
    if (!u || !primaryVenueId) {
      setVenueDefaultLayout(null)
      return
    }
    let cancelled = false
    setLoadingDefaultLayout(true)
    getVenueDefaultLayout(primaryVenueId)
      .then(layout => {
        if (cancelled) return
        setVenueDefaultLayout(layout)
      })
      .catch(() => {
        if (cancelled) return
        setVenueDefaultLayout(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingDefaultLayout(false)
      })

    return () => { cancelled = true }
  }, [primaryVenueId])

  const addSession = () => {
    const key = 's' + Date.now()
    setSessions([...sessions, { key, venueId: null, startTime: '', endTime: '' }])
    setTicketTypes([...ticketTypes, { key: 't' + Date.now(), sessionKey: key, name: '', price: 0, totalStock: 0 }])
  }

  const removeSession = (key: string) => {
    if (sessions.length <= 1) return
    setSessions(sessions.filter(s => s.key !== key))
    setTicketTypes(ticketTypes.filter(t => t.sessionKey !== key))
  }

  const addTicketType = (sessionKey: string) => {
    setTicketTypes([...ticketTypes, { key: 't' + Date.now(), sessionKey, name: '', price: 0, totalStock: 0 }])
  }

  const removeTicketType = (key: string) => {
    setTicketTypes(ticketTypes.filter(t => t.key !== key))
  }

  const updateSession = (key: string, field: string, value: string | number | null) => {
    setSessions(sessions.map(s => s.key === key ? { ...s, [field]: value } : s))
  }

  const updateTicketType = (key: string, field: string, value: string | number) => {
    setTicketTypes(ticketTypes.map(t => t.key === key ? { ...t, [field]: value } : t))
  }

  const handleSubmit = async () => {
    const u = getUser()
    if (!u || !categoryId || !name.trim()) return
    setSubmitting(true)
    try {
      // 1. 创建活动（artistId用1占位，实际产品可传自定义艺人）
      const activity: ActivityEntity = await createAdminActivity({
        userId: u.userId,
        categoryId,
        artistId: 1,
        name: name.trim(),
        description,
        poster,
      })

      if (venueDefaultLayout) {
        try {
          await updateActivitySeatLayout(activity.id, {
            userId: u.userId,
            layout: venueDefaultLayout,
          })
        } catch (err) {
          await deleteAdminActivity(activity.id, { userId: u.userId, reason: '创建活动失败自动清理' }).catch(() => {})
          throw err
        }
      }

      // 2. 创建场次
      const createdSessions: Map<string, SessionEntity> = new Map()
      for (const s of sessions) {
        if (!s.venueId || !s.startTime) continue
        const session: SessionEntity = await createAdminSession({
          userId: u.userId,
          activityId: activity.id,
          venueId: s.venueId,
          startTime: s.startTime,
          endTime: s.endTime || null,
        })
        createdSessions.set(s.key, session)
      }

      // 3. 创建票档
      for (const t of ticketTypes) {
        const session = createdSessions.get(t.sessionKey)
        if (!session || !t.name || t.price <= 0 || t.totalStock <= 0) continue
        await createAdminTicketType({
          userId: u.userId,
          sessionId: session.id,
          name: t.name,
          price: t.price,
          totalStock: t.totalStock,
        })
      }

      router.push('/console/activities')
    } catch (err) {
      alert('创建失败: ' + (err instanceof Error ? err.message : '未知错误'))
    } finally {
      setSubmitting(false)
    }
  }

  const steps = ['活动信息', '设置场次', '设置票档']
  const isAdmin = role === 'admin'

  if (checkingRole || !role) {
    return <div className="py-20 text-center text-[14px] text-[#999]">加载中...</div>
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[22px] font-bold text-[#1a1a2e]">{isAdmin ? '新建平台活动' : '新建我的活动'}</h1>
        <p className="mt-1 text-[13px] text-[#999]">{isAdmin ? '为平台创建活动，并配置场次、票档和初始库存。' : '为自己主办的项目创建活动，并配置场次、票档和初始库存。'}</p>
      </div>

      {/* 步骤条 */}
      <div className="flex items-center gap-0 mb-8">
        {steps.map((label, i) => (
          <div key={i} className="flex items-center">
            <div className={`flex items-center gap-2 ${i + 1 <= step ? 'text-[#ff1268]' : 'text-[#999]'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold border-2 ${
                i + 1 < step
                  ? 'bg-[#ff1268] border-[#ff1268] text-white'
                  : i + 1 === step
                  ? 'border-[#ff1268] text-[#ff1268] bg-white'
                  : 'border-[#ddd] text-[#999] bg-white'
              }`}>
                {i + 1 < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className="text-[14px] font-medium">{label}</span>
            </div>
            {i < steps.length - 1 && <div className={`w-12 h-0.5 mx-3 ${i + 1 < step ? 'bg-[#ff1268]' : 'bg-[#ddd]'}`} />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[#e5e5e5] p-6 max-w-[680px]">
        {/* 步骤1：基本信息 */}
        {step === 1 && (
          <div>
            <div className="mb-4">
              <label className="block text-[13px] font-medium text-[#333] mb-1.5">活动名称 *</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border border-[#ddd] rounded-lg text-[14px] outline-none focus:border-[#ff1268]" placeholder="例：2026 XX演唱会北京站" />
            </div>
            <div className="mb-4">
              <label className="block text-[13px] font-medium text-[#333] mb-1.5">分类 *</label>
              <select value={categoryId ?? ''} onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : null)} className="w-full px-3 py-2 border border-[#ddd] rounded-lg text-[14px] outline-none focus:border-[#ff1268]">
                <option value="">请选择分类</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-[13px] font-medium text-[#333] mb-1.5">艺人名称</label>
              <input value={artistName} onChange={e => setArtistName(e.target.value)} className="w-full px-3 py-2 border border-[#ddd] rounded-lg text-[14px] outline-none focus:border-[#ff1268]" placeholder="例：周杰伦" />
            </div>
            <div className="mb-4">
              <label className="block text-[13px] font-medium text-[#333] mb-1.5">活动简介</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 border border-[#ddd] rounded-lg text-[14px] outline-none focus:border-[#ff1268] resize-none" placeholder="描述活动内容..." />
            </div>
            <div className="mb-4">
              <label className="block text-[13px] font-medium text-[#333] mb-1.5">海报URL</label>
              <input value={poster} onChange={e => setPoster(e.target.value)} className="w-full px-3 py-2 border border-[#ddd] rounded-lg text-[14px] outline-none focus:border-[#ff1268]" placeholder="https://..." />
            </div>
          </div>
        )}

        {/* 步骤2：场次 */}
        {step === 2 && (
          <div>
            {primaryVenueId && (
              <div className="mb-5 rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-4">
                <div className="mb-2 text-[14px] font-semibold text-[#1a1a2e]">场馆默认座位图</div>
                {loadingDefaultLayout ? (
                  <div className="text-[13px] text-[#999]">加载中...</div>
                ) : venueDefaultLayout ? (
                  <div className="space-y-1 text-[13px] text-[#333]">
                    <div>布局名称：{venueDefaultLayout.name}</div>
                    <div>舞台标题：{venueDefaultLayout.stageTitle}</div>
                    <div>区域数量：{venueDefaultLayout.sections.length}</div>
                    <div>画布大小：{venueDefaultLayout.canvasWidth} × {venueDefaultLayout.canvasHeight}</div>
                  </div>
                ) : (
                  <div className="text-[13px] text-[#999]">该场馆暂无默认座位图，可在活动创建后配置。</div>
                )}
              </div>
            )}

            {sessions.map((s, i) => (
              <div key={s.key} className="mb-5 p-4 border border-[#f0f0f0] rounded-lg bg-[#fafafa]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[14px] font-medium text-[#333]">场次 {i + 1}</span>
                  {sessions.length > 1 && (
                    <button onClick={() => removeSession(s.key)} className="text-[12px] text-[#ef4444] bg-transparent border-none cursor-pointer">删除</button>
                  )}
                </div>
                <div className="mb-3">
                  <label className="block text-[12px] text-[#666] mb-1">场馆 *</label>
                  <select value={s.venueId ?? ''} onChange={e => updateSession(s.key, 'venueId', e.target.value ? Number(e.target.value) : null)} className="w-full px-3 py-2 border border-[#ddd] rounded-lg text-[14px] outline-none focus:border-[#ff1268]">
                    <option value="">选择场馆</option>
                    {venues.map(v => <option key={v.id} value={v.id}>{v.name} ({v.city})</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] text-[#666] mb-1">开始时间 *</label>
                    <input type="datetime-local" value={s.startTime} onChange={e => updateSession(s.key, 'startTime', e.target.value)} className="w-full px-3 py-2 border border-[#ddd] rounded-lg text-[14px] outline-none focus:border-[#ff1268]" />
                  </div>
                  <div>
                    <label className="block text-[12px] text-[#666] mb-1">结束时间</label>
                    <input type="datetime-local" value={s.endTime} onChange={e => updateSession(s.key, 'endTime', e.target.value)} className="w-full px-3 py-2 border border-[#ddd] rounded-lg text-[14px] outline-none focus:border-[#ff1268]" />
                  </div>
                </div>
              </div>
            ))}
            <button onClick={addSession} className="text-[13px] text-[#ff1268] bg-transparent border border-dashed border-[#ff1268] rounded-lg px-4 py-2 w-full cursor-pointer hover:bg-[#fff0f3] transition-colors">
              + 添加场次
            </button>
          </div>
        )}

        {/* 步骤3：票档 */}
        {step === 3 && (
          <div>
            {sessions.map((s, si) => {
              const sessionTT = ticketTypes.filter(t => t.sessionKey === s.key)
              return (
                <div key={s.key} className="mb-5">
                  <div className="text-[14px] font-medium text-[#333] mb-3">场次 {si + 1} 的票档</div>
                  {sessionTT.map(tt => (
                    <div key={tt.key} className="flex items-end gap-3 mb-2 p-3 border border-[#f0f0f0] rounded-lg bg-[#fafafa]">
                      <div className="flex-1">
                        <label className="block text-[12px] text-[#666] mb-1">名称</label>
                        <input value={tt.name} onChange={e => updateTicketType(tt.key, 'name', e.target.value)} className="w-full px-3 py-1.5 border border-[#ddd] rounded text-[13px] outline-none focus:border-[#ff1268]" placeholder="如：普通票/VIP/套票" />
                      </div>
                      <div className="w-[120px]">
                        <label className="block text-[12px] text-[#666] mb-1">价格</label>
                        <input type="number" value={tt.price || ''} onChange={e => updateTicketType(tt.key, 'price', Number(e.target.value))} className="w-full px-3 py-1.5 border border-[#ddd] rounded text-[13px] outline-none focus:border-[#ff1268]" placeholder="0" />
                      </div>
                      <div className="w-[120px]">
                        <label className="block text-[12px] text-[#666] mb-1">库存</label>
                        <input type="number" value={tt.totalStock || ''} onChange={e => updateTicketType(tt.key, 'totalStock', Number(e.target.value))} className="w-full px-3 py-1.5 border border-[#ddd] rounded text-[13px] outline-none focus:border-[#ff1268]" placeholder="0" />
                      </div>
                      <button onClick={() => removeTicketType(tt.key)} className="text-[12px] text-[#ef4444] bg-transparent border-none cursor-pointer pb-1.5 whitespace-nowrap">删除</button>
                    </div>
                  ))}
                  <button onClick={() => addTicketType(s.key)} className="text-[12px] text-[#ff1268] bg-transparent border-none cursor-pointer">
                    + 添加票档
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* 底部按钮 */}
        <div className="flex items-center justify-between mt-8 pt-5 border-t border-[#f0f0f0]">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            className="flex items-center gap-1 text-[14px] text-[#666] bg-transparent border-none cursor-pointer disabled:opacity-30 hover:text-[#333] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> 上一步
          </button>
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-1 bg-[#ff1268] text-white px-5 py-2 rounded-lg text-[14px] font-medium border-none cursor-pointer hover:bg-[#e0105a] transition-colors"
            >
              下一步 <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-1 bg-[#22c55e] text-white px-6 py-2 rounded-lg text-[14px] font-medium border-none cursor-pointer hover:bg-[#16a34a] transition-colors disabled:opacity-50"
            >
              {submitting ? '提交中...' : isAdmin ? '提交平台活动' : '提交我的活动'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
