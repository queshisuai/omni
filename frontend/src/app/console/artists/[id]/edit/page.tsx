'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { getAdminArtist, getUserInfo, updateAdminArtist, uploadTicketAsset } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'
import { LocalFileUpload } from '@/components/LocalFileUpload'
import type { ArtistEntity, UserInfo } from '@/types/api'

type FormState = {
  name: string
  alias: string
  artistType: string
  countryOrRegion: string
  agency: string
  representativeWorks: string
  categoryTags: string
  description: string
  avatar: string
}

const EMPTY_FORM: FormState = {
  name: '',
  alias: '',
  artistType: '',
  countryOrRegion: '',
  agency: '',
  representativeWorks: '',
  categoryTags: '',
  description: '',
  avatar: '',
}

function canEditArtist(user: UserInfo | null, artist: ArtistEntity | null) {
  if (!user || !artist) return false
  if (user.role === 'admin') return true
  return user.role === 'organizer' && artist.submittedBy === user.id && artist.reviewStatus === 'pending'
}

export default function EditArtistPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const artistId = Number(params.id)
  const [user, setUser] = useState<UserInfo | null>(null)
  const [artist, setArtist] = useState<ArtistEntity | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!Number.isInteger(artistId) || artistId <= 0) {
      setError('艺人 ID 不正确')
      setLoading(false)
      return
    }
    if (!isAuthenticated()) {
      router.replace(`/login?ru=/console/artists/${artistId}/edit`)
      return
    }
    let active = true
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const [info, detail] = await Promise.all([getUserInfo(), getAdminArtist(artistId)])
        if (!active) return
        setUser(info)
        setArtist(detail)
        setForm({
          name: detail.name || '',
          alias: detail.alias || '',
          artistType: detail.artistType || '',
          countryOrRegion: detail.countryOrRegion || '',
          agency: detail.agency || '',
          representativeWorks: detail.representativeWorks || '',
          categoryTags: detail.categoryTags || '',
          description: detail.description || '',
          avatar: detail.avatar || '',
        })
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : '加载艺人资料失败')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [artistId, router])

  const editable = canEditArtist(user, artist)

  const save = async () => {
    if (!user || !artist || saving) return
    if (!editable) {
      setError('当前账号不能编辑该艺人档案')
      return
    }
    if (!form.name.trim()) {
      setError('艺人/团队名称不能为空')
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const updated = await updateAdminArtist(artist.id, {
        name: form.name.trim(),
        alias: form.alias.trim() || null,
        artistType: form.artistType.trim() || null,
        countryOrRegion: form.countryOrRegion.trim() || null,
        agency: form.agency.trim() || null,
        representativeWorks: form.representativeWorks.trim() || null,
        categoryTags: form.categoryTags.trim() || null,
        description: form.description.trim() || null,
        avatar: form.avatar.trim() || null,
      })
      setArtist(updated)
      setMessage('艺人资料已保存')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存艺人资料失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/console/artists/pending" className="inline-flex items-center gap-1 text-[13px] text-[#666] hover:text-[#ff1268]">
            <ArrowLeft className="h-4 w-4" /> 返回艺人审核
          </Link>
          <h1 className="mt-2 text-[24px] font-bold text-[#1a1a2e]">艺人资料编辑</h1>
          <p className="mt-1 text-[14px] text-[#666]">管理员可编辑所有艺人；主办方只能编辑自己提交且待审核的艺人。</p>
        </div>
        <button
          type="button"
          disabled={!editable || saving || loading}
          onClick={save}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ff1268] px-5 py-2 text-[14px] font-medium text-white disabled:bg-[#f7a8c6]"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          保存资料
        </button>
      </div>

      {error && <div className="rounded-xl bg-[#fef2f2] p-3 text-[14px] text-[#dc2626]">{error}</div>}
      {message && <div className="rounded-xl bg-[#f0fdf4] p-3 text-[14px] text-[#15803d]">{message}</div>}

      {loading ? (
        <div className="rounded-2xl bg-white p-8 text-center text-[#999]">加载中...</div>
      ) : artist ? (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <section className="rounded-2xl border border-[#eee] bg-white p-5 shadow-sm">
            <LocalFileUpload
              label="艺人头像"
              value={form.avatar}
              accept="image/jpeg,image/png,image/webp,image/gif"
              uploading={saving || !editable}
              onUpload={async (file) => {
                if (!user?.id) throw new Error('请先登录')
                if (!editable) throw new Error('当前账号不能编辑该艺人档案')
                const asset = await uploadTicketAsset({ userId: user.id, bizType: 'artist-avatar', file })
                return asset.publicUrl
              }}
              onChange={(avatar) => {
                if (!editable) return
                setForm(prev => ({ ...prev, avatar }))
              }}
              hint="支持 JPG、PNG、WEBP、GIF，上传后自动写入头像地址。"
            />
            <div className="mt-4 rounded-xl bg-[#fafafa] p-3 text-[12px] leading-5 text-[#666]">
              审核状态：{artist.reviewStatus || '未知'}<br />
              风险状态：{artist.riskStatus || '未知'}<br />
              提交人：{artist.submittedBy || '未知'}
            </div>
            {!editable && <div className="mt-3 rounded-xl bg-[#fff7ed] p-3 text-[13px] text-[#c2410c]">当前账号没有编辑权限。</div>}
          </section>

          <section className="rounded-2xl border border-[#eee] bg-white p-5 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="艺人/团队名称 *" value={form.name} disabled={!editable} onChange={name => setForm(prev => ({ ...prev, name }))} />
              <Field label="别名" value={form.alias} disabled={!editable} onChange={alias => setForm(prev => ({ ...prev, alias }))} />
              <Field label="艺人类型" value={form.artistType} disabled={!editable} onChange={artistType => setForm(prev => ({ ...prev, artistType }))} placeholder="歌手 / 乐队 / 团队" />
              <Field label="国家/地区" value={form.countryOrRegion} disabled={!editable} onChange={countryOrRegion => setForm(prev => ({ ...prev, countryOrRegion }))} />
              <Field label="经纪公司" value={form.agency} disabled={!editable} onChange={agency => setForm(prev => ({ ...prev, agency }))} />
              <Field label="分类标签" value={form.categoryTags} disabled={!editable} onChange={categoryTags => setForm(prev => ({ ...prev, categoryTags }))} placeholder="流行,摇滚" />
              <label className="block text-[13px] font-medium text-[#333] sm:col-span-2">
                代表作品
                <input value={form.representativeWorks} disabled={!editable} onChange={event => setForm(prev => ({ ...prev, representativeWorks: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268] disabled:bg-[#f5f5f5]" />
              </label>
              <label className="block text-[13px] font-medium text-[#333] sm:col-span-2">
                简介
                <textarea value={form.description} disabled={!editable} onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))} rows={5} className="mt-1.5 w-full resize-none rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268] disabled:bg-[#f5f5f5]" />
              </label>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

function Field({ label, value, onChange, disabled, placeholder }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean; placeholder?: string }) {
  return (
    <label className="block text-[13px] font-medium text-[#333]">
      {label}
      <input value={value} disabled={disabled} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268] disabled:bg-[#f5f5f5]" />
    </label>
  )
}
