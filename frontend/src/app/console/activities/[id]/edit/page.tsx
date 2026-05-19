'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { getAdminActivity, listCategories, updateAdminActivity } from '@/lib/api'
import type { CategoryVO } from '@/types/api'

type ActivityForm = {
  name: string
  categoryId: string
  artistId: string
  poster: string
  description: string
}

const emptyForm: ActivityForm = {
  name: '',
  categoryId: '',
  artistId: '',
  poster: '',
  description: '',
}

export default function EditActivityPage() {
  const params = useParams<{ id: string }>()
  const activityId = Number(params.id)
  const [userId, setUserId] = useState(0)
  const [isAuthed, setIsAuthed] = useState(false)
  const [categories, setCategories] = useState<CategoryVO[]>([])
  const [form, setForm] = useState<ActivityForm>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!Number.isInteger(activityId) || activityId <= 0) {
      setError('活动ID不正确')
      setLoading(false)
      return
    }

    const u = getUser()
    if (!u) {
      setIsAuthed(false)
      setError('请先登录')
      setLoading(false)
      return
    }
    setIsAuthed(true)
    setUserId(u.userId)
    setLoading(true)
    Promise.all([
      getAdminActivity(activityId, u.userId),
      listCategories().catch(() => [] as CategoryVO[]),
    ]).then(([activity, categoryList]) => {
      setForm({
        name: activity.name || '',
        categoryId: String(activity.categoryId || ''),
        artistId: String(activity.artistId || ''),
        poster: activity.poster || '',
        description: activity.description || '',
      })
      setCategories(categoryList)
      setLoading(false)
    }).catch(err => {
      setError(err instanceof Error ? err.message : '加载活动失败')
      setLoading(false)
    })
  }, [activityId])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isAuthed || !userId) {
      setError('请先登录')
      return
    }
    if (!Number.isInteger(activityId) || activityId <= 0) {
      setError('活动ID不正确')
      return
    }
    if (!form.name.trim()) {
      setError('请填写活动名称')
      return
    }
    if (!isPositiveInteger(form.categoryId)) {
      setError('请选择分类')
      return
    }
    if (!isPositiveInteger(form.artistId)) {
      setError('艺人ID不正确')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')
    try {
      await updateAdminActivity(activityId, {
        userId,
        name: form.name.trim(),
        categoryId: Number(form.categoryId),
        artistId: Number(form.artistId),
        poster: form.poster.trim() || null,
        description: form.description.trim() || null,
      })
      setMessage('活动基础信息已保存')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存活动失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="py-20 text-center text-[14px] text-[#999]">加载中...</div>
  }

  if (!isAuthed || !Number.isInteger(activityId) || activityId <= 0) {
    return (
      <div className="rounded-xl border border-[#ffd9e6] bg-white p-6 text-[14px] text-[#666]">
        <div className="text-[#ff4d4f]">{error || '请先登录'}</div>
        <div className="mt-4 flex gap-2">
          <Link href="/console/activities" className="rounded-lg border border-[#e5e5e5] px-4 py-2 text-[14px] text-[#666]">
            返回列表
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#1a1a2e]">编辑活动基础信息</h1>
          <p className="mt-1 text-[13px] text-[#999]">只维护活动名称、分类、艺人、海报和描述；场次与票档请到场次管理维护。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/console/activities" className="rounded-lg border border-[#e5e5e5] px-4 py-2 text-[14px] text-[#666] hover:bg-[#fafafa]">
            返回列表
          </Link>
          <Link href={`/console/sessions?activityId=${activityId}`} className="rounded-lg bg-[#1a1a2e] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#2a2a42]">
            管理场次/票档
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-[720px] rounded-xl border border-[#e5e5e5] bg-white p-6">
        <div className="grid gap-4">
          <label className="block text-[13px] font-medium text-[#333]">
            活动名称 *
            <input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="例：2026 XX演唱会北京站" />
          </label>

          <label className="block text-[13px] font-medium text-[#333]">
            分类 *
            <select value={form.categoryId} onChange={event => setForm({ ...form, categoryId: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]">
              <option value="">请选择分类</option>
              {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>

          <label className="block text-[13px] font-medium text-[#333]">
            艺人 ID *
            <input type="number" min="1" value={form.artistId} onChange={event => setForm({ ...form, artistId: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="例：1" />
          </label>

          <label className="block text-[13px] font-medium text-[#333]">
            海报 URL
            <input value={form.poster} onChange={event => setForm({ ...form, poster: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="https://..." />
          </label>

          <label className="block text-[13px] font-medium text-[#333]">
            描述
            <textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} rows={5} className="mt-1.5 w-full resize-none rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" placeholder="描述活动内容..." />
          </label>
        </div>

        {error && <div className="mt-4 rounded-lg bg-[#fff0f3] px-3 py-2 text-[13px] text-[#ff4d4f]">{error}</div>}
        {message && <div className="mt-4 rounded-lg bg-[#f0fff4] px-3 py-2 text-[13px] text-[#16a34a]">{message}</div>}

        <div className="mt-5 flex justify-end gap-2">
          <Link href="/console/activities" className="rounded-lg border border-[#e5e5e5] px-4 py-2 text-[14px] text-[#666]">
            取消
          </Link>
          <button disabled={saving || !isAuthed || !userId} className="rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50">
            {saving ? '保存中...' : '保存基础信息'}
          </button>
        </div>
      </form>
    </div>
  )
}

function isPositiveInteger(value: string) {
  if (!/^[1-9]\d*$/.test(value)) return false
  return Number.isInteger(Number(value)) && Number(value) > 0
}
