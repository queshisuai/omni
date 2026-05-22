'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { createTourDraft } from '@/lib/api'
import type { UserRole } from '@/types/api'

export default function NewTourPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [poster, setPoster] = useState('')
  const [description, setDescription] = useState('')
  const [role, setRole] = useState<UserRole | ''>('')
  const [checkingRole, setCheckingRole] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const user = getUser()
    if (user) {
      setRole(user.role || '')
    } else {
      setError('请先登录后再创建巡演项目')
    }
    setCheckingRole(false)
  }, [])

  if (checkingRole) {
    return <div className="py-20 text-center text-[14px] text-[#999]">加载中...</div>
  }

  if (!role) {
    return (
      <div className="max-w-[720px] rounded-xl border border-[#e5e5e5] bg-white p-6">
        <h1 className="mb-2 text-[22px] font-bold text-[#1a1a2e]">请先登录</h1>
        <p className="mb-5 text-[14px] text-[#666]">登录后可创建和管理自己的巡演项目。</p>
        <Link href="/login" className="inline-flex rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white">去登录</Link>
      </div>
    )
  }

  if (role === 'admin') {
    return (
      <div className="max-w-[720px] rounded-xl border border-[#e5e5e5] bg-white p-6">
        <h1 className="mb-2 text-[22px] font-bold text-[#1a1a2e]">创建巡演仅面向主办方</h1>
        <p className="mb-5 text-[14px] text-[#666]">平台管理员可在活动管理、场馆审核和入驻审核中处理平台运营事项，不在此创建主办方巡演草稿。</p>
        <Link href="/console/tours" className="inline-flex rounded-lg bg-[#1a1a2e] px-4 py-2 text-[14px] font-medium text-white">返回巡演管理</Link>
      </div>
    )
  }

  const handleSubmit = async () => {
    const user = getUser()
    if (!user) {
      setError('请先登录后再创建巡演项目')
      return
    }
    if (!title.trim()) {
      setError('请填写巡演名称')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const tour = await createTourDraft({
        userId: user.userId,
        title: title.trim(),
        poster: poster.trim() || null,
        description: description.trim() || null,
      })
      router.push(`/console/tours/${tour.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1 className="mb-5 text-[22px] font-bold text-[#1a1a2e]">创建巡演草稿</h1>
      <div className="max-w-[720px] rounded-xl border border-[#e5e5e5] bg-white p-6">
        <div className="mb-6">
          <h2 className="mb-3 text-[16px] font-semibold text-[#1a1a2e]">巡演基本信息</h2>
          <label className="mb-3 block">
            <span className="mb-1 block text-[13px] text-[#666]">巡演名称 *</span>
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" placeholder="例：2026 万象巡回演唱会" />
          </label>
          <label className="mb-3 block">
            <span className="mb-1 block text-[13px] text-[#666]">主海报 URL</span>
            <input value={poster} onChange={e => setPoster(e.target.value)} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" placeholder="https://..." />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] text-[#666]">巡演简介</span>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className="w-full resize-none rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" />
          </label>
        </div>
        {error && <div className="mb-4 rounded-lg bg-[#fff0f3] px-3 py-2 text-[13px] text-[#ff1268]">{error}</div>}
        <button onClick={handleSubmit} disabled={submitting} className="rounded-lg bg-[#ff1268] px-5 py-2.5 text-[14px] font-medium text-white disabled:opacity-60">
          {submitting ? '创建中...' : '保存草稿'}
        </button>
      </div>
    </div>
  )
}
