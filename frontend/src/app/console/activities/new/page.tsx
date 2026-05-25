'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { listCategories, listAdminVenues, createAdminActivity, createAdminSession, createAdminTicketType, deleteAdminActivity, listVenueSeatLayoutTemplates, updateActivitySeatLayout, uploadTicketAsset, uploadPrivateAsset, listMyVenueApplications } from '@/lib/api'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { ActivityArtistSelector } from '@/components/activity-artist/ActivityArtistSelector'
import { LocalFileUpload } from '@/components/LocalFileUpload'
import { PrivateFileUpload } from '@/components/PrivateFileUpload'
import { globalAlert } from '@/components/GlobalDialog'
import type { CategoryVO, VenueEntity, ActivityEntity, SessionEntity, SeatLayoutTemplateCandidateVO, UserRole, ActivityArtistVO, PrivateAssetVO, VenueApplicationVO } from '@/types/api'

type SessionDraft = {
  key: string
  venueId: number | null
  venueApplicationId: number | null
  startTime: string
  endTime: string
}

type TicketTypeDraft = {
  key: string
  sessionKey: string
  name: string
  price: string
  totalStock: string
}

type SeatMapVisibility = 'published' | 'hidden'

function sessionVenueValue(session: SessionDraft) {
  return session.venueApplicationId ? `application:${session.venueApplicationId}` : session.venueId ? `venue:${session.venueId}` : ''
}

function resolveVenueSelection(value: string, applications: VenueApplicationVO[]) {
  if (!value) return { venueId: null, venueApplicationId: null }
  const [type, rawId] = value.split(':')
  const id = Number(rawId)
  if (!Number.isInteger(id) || id <= 0) return { venueId: null, venueApplicationId: null }
  if (type === 'application') {
    const application = applications.find(item => item.id === id)
    return { venueId: application?.venueId ?? null, venueApplicationId: application?.id ?? null }
  }
  return { venueId: id, venueApplicationId: null }
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
  const [venueApplications, setVenueApplications] = useState<VenueApplicationVO[]>([])

  // 步骤1：基本信息
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [artists, setArtists] = useState<ActivityArtistVO[]>([])
  const [description, setDescription] = useState('')
  const [poster, setPoster] = useState('')
  const [venueApprovalNo, setVenueApprovalNo] = useState('')
  const [venueApprovalFileUrl, setVenueApprovalFileUrl] = useState('')
  const [venueApprovalAsset, setVenueApprovalAsset] = useState<PrivateAssetVO | null>(null)
  const [venueApprovalNote, setVenueApprovalNote] = useState('')
  const [seatMapVisibility, setSeatMapVisibility] = useState<SeatMapVisibility>('hidden')
  const [perUserLimit, setPerUserLimit] = useState('')
  const [uploadingVenueApproval, setUploadingVenueApproval] = useState(false)

  // 步骤2：场次
  const [sessions, setSessions] = useState<SessionDraft[]>([{ key: 's1', venueId: null, venueApplicationId: null, startTime: '', endTime: '' }])
  const [templateCandidates, setTemplateCandidates] = useState<SeatLayoutTemplateCandidateVO[]>([])
  const [selectedTemplateSource, setSelectedTemplateSource] = useState('')
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  // 步骤3：票档
  const [ticketTypes, setTicketTypes] = useState<TicketTypeDraft[]>([
    { key: 't1', sessionKey: 's1', name: '', price: '', totalStock: '' },
  ])

  useEffect(() => {
    const u = getUser()
    if (!u) return
    setRole(u.role || 'user')
    setCheckingRole(false)
    listCategories().then(setCategories).catch(() => {})
    listAdminVenues(u.userId).then(setVenues).catch(() => {})
    listMyVenueApplications()
      .then(items => setVenueApplications(items.filter(item => item.status === 1 && item.venueId != null)))
      .catch(() => setVenueApplications([]))
  }, [])

  const primaryVenueId = sessions.find(s => s.venueId)?.venueId ?? null

  useEffect(() => {
    const u = getUser()
    if (!u || !primaryVenueId) {
      setTemplateCandidates([])
      setSelectedTemplateSource('')
      return
    }
    let cancelled = false
    setLoadingTemplates(true)
    listVenueSeatLayoutTemplates(primaryVenueId, u.userId)
      .then(candidates => {
        if (cancelled) return
        setTemplateCandidates(candidates)
        setSelectedTemplateSource('')
      })
      .catch(() => {
        if (cancelled) return
        setTemplateCandidates([])
        setSelectedTemplateSource('')
      })
      .finally(() => {
        if (!cancelled) setLoadingTemplates(false)
      })

    return () => { cancelled = true }
  }, [primaryVenueId])

  const addSession = () => {
    const key = 's' + Date.now()
    setSessions([...sessions, { key, venueId: null, venueApplicationId: null, startTime: '', endTime: '' }])
    setTicketTypes([...ticketTypes, { key: 't' + Date.now(), sessionKey: key, name: '', price: '', totalStock: '' }])
  }

  const removeSession = (key: string) => {
    if (sessions.length <= 1) return
    setSessions(sessions.filter(s => s.key !== key))
    setTicketTypes(ticketTypes.filter(t => t.sessionKey !== key))
  }

  const addTicketType = (sessionKey: string) => {
    setTicketTypes([...ticketTypes, { key: 't' + Date.now(), sessionKey, name: '', price: '', totalStock: '' }])
  }

  const removeTicketType = (key: string) => {
    setTicketTypes(ticketTypes.filter(t => t.key !== key))
  }

  const updateSession = (key: string, field: string, value: string | number | null) => {
    setSessions(sessions.map(s => s.key === key ? { ...s, [field]: value } : s))
  }

  const updateSessionVenueSource = (key: string, value: string) => {
    const selection = resolveVenueSelection(value, venueApplications)
    setSessions(sessions.map(s => s.key === key ? { ...s, ...selection } : s))
  }

  const updateTicketType = (key: string, field: string, value: string) => {
    setTicketTypes(ticketTypes.map(t => t.key === key ? { ...t, [field]: value } : t))
  }

  const handleVenueApprovalUpload = async (file: File) => {
    const u = getUser()
    if (!u?.userId) throw new Error('请先登录')
    setUploadingVenueApproval(true)
    try {
      return await uploadPrivateAsset({ userId: u.userId, bizType: 'activity-venue-proof', file })
    } finally {
      setUploadingVenueApproval(false)
    }
  }

  const handleSubmit = async () => {
    const u = getUser()
    if (!u || !categoryId || !name.trim() || artists.length === 0) return
    const limitText = perUserLimit.trim()
    if (limitText && (!/^\d+$/.test(limitText) || Number(limitText) <= 0)) {
      await globalAlert('个人限购张数必须为正整数')
      return
    }
    const validSessions = sessions.filter(s => s.venueId && s.startTime)
    if (validSessions.length === 0) {
      await globalAlert('请至少填写一个有效场次的场馆和开始时间')
      return
    }
    if (validSessions.length !== sessions.length) {
      await globalAlert('场次信息需填写完整，或删除未填写完整的场次')
      return
    }
    const hasIncompleteTicketType = ticketTypes.some(t => {
      const price = Number(t.price)
      const totalStock = Number(t.totalStock)
      const hasAnyValue = Boolean(t.name.trim()) || Boolean(t.price.trim()) || Boolean(t.totalStock.trim())
      const isComplete = Boolean(t.name.trim()) && Number.isFinite(price) && price > 0 && Number.isInteger(totalStock) && totalStock > 0
      return hasAnyValue && !isComplete
    })
    if (hasIncompleteTicketType) {
      await globalAlert('票档信息需填写完整，或整行留空表示票档待公布')
      return
    }
    setSubmitting(true)
    try {
      // 1. 创建活动，并保存有序艺人阵容
      const activity: ActivityEntity = await createAdminActivity({
        userId: u.userId,
        categoryId,
        artists: artists.map((artist, index) => ({
          artistId: artist.artistId,
          isPrimary: Boolean(artist.isPrimary || artist.primary),
          roleType: artist.roleType || 'performer',
          roleName: artist.roleName || '参演艺人',
          visibility: artist.visibility || 'public',
          sort: index + 1,
        })),
        name: name.trim(),
        description,
        poster,
        venueApprovalNo: venueApprovalNo.trim() || null,
        venueApprovalFileUrl: venueApprovalAsset ? `private-asset:${venueApprovalAsset.id}` : venueApprovalFileUrl.trim() || null,
        venueApprovalNote: venueApprovalNote.trim() || null,
        venueApplicationId: sessions.find(s => s.venueApplicationId)?.venueApplicationId ?? null,
        seatMapVisibility,
        perUserLimit: limitText ? Number(limitText) : null,
      })

      const selectedTemplate = templateCandidates.find(candidate => `${candidate.sourceType}:${candidate.sourceId}` === selectedTemplateSource)
      if (selectedTemplate) {
        try {
          await updateActivitySeatLayout(activity.id, {
            userId: u.userId,
            layout: selectedTemplate.layout,
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
        const price = Number(t.price)
        const totalStock = Number(t.totalStock)
        if (!session || !t.name.trim() || !Number.isFinite(price) || price <= 0 || !Number.isInteger(totalStock) || totalStock <= 0) continue
        await createAdminTicketType({
          userId: u.userId,
          sessionId: session.id,
          name: t.name.trim(),
          price,
          totalStock,
        })
      }

      router.push('/console/activities')
    } catch (err) {
      await globalAlert('创建失败: ' + (err instanceof Error ? err.message : '未知错误'))
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
              <ActivityArtistSelector value={artists} onChange={setArtists} />
            </div>
            <div className="mb-4">
              <label className="block text-[13px] font-medium text-[#333] mb-1.5">活动简介</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 border border-[#ddd] rounded-lg text-[14px] outline-none focus:border-[#ff1268] resize-none" placeholder="描述活动内容..." />
            </div>
            <div className="mb-4">
              <LocalFileUpload
                label="活动海报"
                value={poster}
                accept="image/jpeg,image/png,image/webp,image/gif"
                uploading={submitting}
                onUpload={async (file) => {
                  const u = getUser()
                  if (!u?.userId) throw new Error('请先登录')
                  const asset = await uploadTicketAsset({ userId: u.userId, bizType: 'activity-poster', file })
                  return asset.publicUrl
                }}
                onChange={setPoster}
                hint="支持 JPG、PNG、WEBP、GIF，上传后自动写入海报地址。"
              />
            </div>
            <div className="mb-4">
              <label className="block text-[13px] font-medium text-[#333] mb-1.5">个人限购</label>
              <input type="number" min={1} value={perUserLimit} onChange={e => setPerUserLimit(e.target.value)} className="w-full px-3 py-2 border border-[#ddd] rounded-lg text-[14px] outline-none focus:border-[#ff1268]" placeholder="留空表示不限购，例如 2" />
              <p className="mt-1 text-[12px] text-[#999]">巡演城市站按每个城市站单独限购，不按整轮巡演累计。</p>
            </div>
            <div className="rounded-xl border border-[#ffe1ec] bg-[#fff7fa] p-4">
              <div className="mb-3 text-[14px] font-semibold text-[#1a1a2e]">场地审批凭证</div>
              <div className="grid gap-3">
                <input value={venueApprovalNo} onChange={e => setVenueApprovalNo(e.target.value)} className="w-full px-3 py-2 border border-[#ddd] rounded-lg text-[14px] outline-none focus:border-[#ff1268]" placeholder="凭证编号" />
                <PrivateFileUpload
                  label="场地审批凭证附件"
                  value={venueApprovalAsset}
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  uploading={submitting || uploadingVenueApproval}
                  onUpload={handleVenueApprovalUpload}
                  onChange={setVenueApprovalAsset}
                  hint="支持 PDF、JPEG、PNG、WEBP；附件以私有文件保存，仅供平台审核。"
                />
                <input value={venueApprovalFileUrl} onChange={e => setVenueApprovalFileUrl(e.target.value)} className="w-full px-3 py-2 border border-[#ddd] rounded-lg text-[14px] outline-none focus:border-[#ff1268]" placeholder="外部凭证链接（可选）" />
                <textarea value={venueApprovalNote} onChange={e => setVenueApprovalNote(e.target.value)} rows={2} className="w-full px-3 py-2 border border-[#ddd] rounded-lg text-[14px] outline-none focus:border-[#ff1268] resize-none" placeholder="凭证说明" />
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-4">
              <div className="mb-2 text-[14px] font-semibold text-[#1a1a2e]">座位图展示策略</div>
              <div className="space-y-2 text-[13px] text-[#333]">
                <label className="flex cursor-pointer items-start gap-2">
                  <input type="radio" name="seatMapVisibility" value="hidden" checked={seatMapVisibility === 'hidden'} onChange={() => setSeatMapVisibility('hidden')} className="mt-0.5 accent-[#ff1268]" />
                  <span><span className="font-medium">暂不展示</span>：活动创建后先隐藏座位图，配置确认后再开放。</span>
                </label>
                <label className="flex cursor-pointer items-start gap-2">
                  <input type="radio" name="seatMapVisibility" value="published" checked={seatMapVisibility === 'published'} onChange={() => setSeatMapVisibility('published')} className="mt-0.5 accent-[#ff1268]" />
                  <span><span className="font-medium">立即展示</span>：创建完成后 C 端可查看活动座位图。</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* 步骤2：场次 */}
        {step === 2 && (
          <div>
            {primaryVenueId && (
              <div className="mb-5 rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-4">
                <div className="mb-2 text-[14px] font-semibold text-[#1a1a2e]">地点历史座位模板</div>
                {loadingTemplates ? (
                  <div className="text-[13px] text-[#999]">加载中...</div>
                ) : templateCandidates.length > 0 ? (
                  <div className="space-y-3 text-[13px] text-[#333]">
                    <div>检测到该地点有历史座位模板，可复制为本活动初始座位图后再调整。</div>
                    <select value={selectedTemplateSource} onChange={e => setSelectedTemplateSource(e.target.value)} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]">
                      <option value="">不使用模板，稍后配置</option>
                      {templateCandidates.map(candidate => <option key={`${candidate.sourceType}:${candidate.sourceId}`} value={`${candidate.sourceType}:${candidate.sourceId}`}>{candidate.name}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="text-[13px] text-[#999]">该地点暂无可复用历史模板，可在活动创建后配置。</div>
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
                  <select value={sessionVenueValue(s)} onChange={e => updateSessionVenueSource(s.key, e.target.value)} className="w-full px-3 py-2 border border-[#ddd] rounded-lg text-[14px] outline-none focus:border-[#ff1268]">
                    <option value="">选择场馆</option>
                    {venues.length > 0 && (
                      <optgroup label="平台场馆">
                        {venues.map(v => <option key={`venue:${v.id}`} value={`venue:${v.id}`}>{v.name} ({v.city})</option>)}
                      </optgroup>
                    )}
                    {venueApplications.length > 0 && (
                      <optgroup label="我的已通过场地申请">
                        {venueApplications.map(item => <option key={`application:${item.id}`} value={`application:${item.id}`}>{item.venueName} ({item.city})</option>)}
                      </optgroup>
                    )}
                  </select>
                  {venues.length === 0 && venueApplications.length === 0 && <div className="mt-2 text-[12px] text-[#999]">暂无可用场馆，请先提交并通过场地凭证审核。</div>}
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
            <div className="mb-4 rounded-lg bg-[#fff7fb] px-4 py-3 text-[13px] text-[#666]">
              票档可以暂不公布：整行留空即可先创建活动和场次，后续在场次管理中补充票档。
            </div>
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
                        <input type="number" min="0" value={tt.price} onChange={e => updateTicketType(tt.key, 'price', e.target.value)} className="w-full px-3 py-1.5 border border-[#ddd] rounded text-[13px] outline-none focus:border-[#ff1268]" placeholder="0" />
                      </div>
                      <div className="w-[120px]">
                        <label className="block text-[12px] text-[#666] mb-1">库存</label>
                        <input type="number" min="0" step="1" value={tt.totalStock} onChange={e => updateTicketType(tt.key, 'totalStock', e.target.value)} className="w-full px-3 py-1.5 border border-[#ddd] rounded text-[13px] outline-none focus:border-[#ff1268]" placeholder="0" />
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
