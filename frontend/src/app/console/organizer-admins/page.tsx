'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, RefreshCw, ShieldOff, Users } from 'lucide-react'
import { globalConfirm } from '@/components/GlobalDialog'
import { createOrganizerAdminAccount, deactivateOrganizerAdminAccount, getUserInfo, listOrganizerAdminAccounts } from '@/lib/api'
import { canUseConsoleAction } from '@/lib/console-auth'
import type { OrganizerAdminAccountVO } from '@/types/api'

export default function OrganizerAdminsPage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<OrganizerAdminAccountVO[]>([])
  const [form, setForm] = useState({ phone: '', nickname: '', password: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setAccounts(await listOrganizerAdminAccounts())
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载主办方管理员账号失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getUserInfo()
      .then(info => {
        if (info.role !== 'admin' && !canUseConsoleAction('organizer.account.manage', info.permissionCodes || [])) {
          router.replace('/console')
          return
        }
        return load()
      })
      .catch(() => router.replace('/login?ru=/console/organizer-admins'))
  }, [router])

  const submit = async () => {
    setMessage('')
    setError('')
    if (!form.phone.trim() || !form.nickname.trim() || !form.password.trim()) {
      setError('请填写手机号、昵称和初始密码')
      return
    }
    setSaving(true)
    try {
      await createOrganizerAdminAccount({
        phone: form.phone.trim(),
        nickname: form.nickname.trim(),
        password: form.password.trim(),
      })
      setForm({ phone: '', nickname: '', password: '' })
      await load()
      setMessage('主办方管理员账号已创建')
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建主办方管理员账号失败')
    } finally {
      setSaving(false)
    }
  }

  const deactivate = async (account: OrganizerAdminAccountVO) => {
    const confirmed = await globalConfirm({
      type: 'danger',
      title: '停用主办方管理员',
      content: `确认停用「${account.nickname || account.phone}」吗？停用后该账号将不能继续进入后台。`,
      confirmText: '停用',
      cancelText: '取消',
    })
    if (!confirmed) return
    setMessage('')
    setError('')
    setSaving(true)
    try {
      await deactivateOrganizerAdminAccount(account.id)
      await load()
      setMessage('主办方管理员账号已停用')
    } catch (err) {
      setError(err instanceof Error ? err.message : '停用主办方管理员账号失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-[14px] text-gray-500">正在加载主办方管理员账号...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold text-[#111]">主办方管理员</h1>
          <p className="mt-2 text-[14px] text-gray-500">维护平台侧负责主办方账号管理的职位账号，不等同于普通主办方账号。</p>
        </div>
        <button
          onClick={load}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-[13px] text-gray-600 hover:border-[#ff1268] hover:text-[#ff1268]"
        >
          <RefreshCw className="h-4 w-4" />
          刷新
        </button>
      </div>

      {(message || error) && (
        <div className={`rounded-xl px-4 py-3 text-[13px] ${error ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
          {error || message}
        </div>
      )}

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-[16px] font-bold text-[#111]">
          <Plus className="h-4 w-4 text-[#ff1268]" />
          新建主办方管理员
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="手机号" className="h-10 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]" />
          <input value={form.nickname} onChange={event => setForm({ ...form, nickname: event.target.value })} placeholder="昵称" className="h-10 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]" />
          <input value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} placeholder="初始密码" type="password" className="h-10 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]" />
          <button onClick={submit} disabled={saving} className="h-10 rounded-lg bg-[#ff1268] px-4 text-[13px] font-medium text-white disabled:opacity-60">创建</button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4 text-[16px] font-bold text-[#111]">账号列表</div>
        <div className="divide-y divide-gray-100">
          {accounts.length === 0 ? (
            <div className="px-5 py-10 text-center text-[13px] text-gray-400">暂无主办方管理员账号</div>
          ) : accounts.map(account => (
            <div key={account.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#fff0f5] text-[#ff1268]">
                  <Users className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold text-[#111]">{account.nickname || '未命名管理员'}</div>
                  <div className="mt-1 text-[12px] text-gray-500">{account.phone} · {account.status === 1 ? '启用中' : '已停用'} · {account.role}</div>
                </div>
              </div>
              <button
                onClick={() => deactivate(account)}
                disabled={saving || account.status === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-[13px] text-gray-600 hover:border-red-300 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShieldOff className="h-4 w-4" />
                停用
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
