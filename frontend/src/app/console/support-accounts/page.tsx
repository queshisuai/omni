'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, Headphones, MessageSquareText, Pencil, Plus, ShieldOff, X } from 'lucide-react'
import { createSupportAccount, deactivateSupportAccount, getUserInfo, listSupportAccounts, updateSupportAccount } from '@/lib/api'
import { canUseConsoleAction } from '@/lib/console-auth'
import { getSupportConversationRecordsHref } from '@/lib/support-tools'
import type { SupportAccountVO } from '@/types/api'

type SupportRole = 'support_manager' | 'support_agent'

const supportRoleOptions: Array<{ value: SupportRole; label: string }> = [
  { value: 'support_agent', label: '普通客服' },
  { value: 'support_manager', label: '客服主管' },
]

function formatSupportRole(role: string | null | undefined) {
  return supportRoleOptions.find(option => option.value === role)?.label || '普通客服'
}

export default function SupportAccountsPage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<SupportAccountVO[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState<{ phone: string; nickname: string; password: string; supportRole: SupportRole }>({ phone: '', nickname: '', password: '', supportRole: 'support_agent' })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<{ phone: string; nickname: string; password: string; status: number; supportRole: SupportRole }>({ phone: '', nickname: '', password: '', status: 1, supportRole: 'support_agent' })

  const load = async () => {
    const data = await listSupportAccounts()
    setAccounts(data)
  }

  useEffect(() => {
    getUserInfo()
      .then(info => {
        if (!canUseConsoleAction('support.account.manage', info.permissionCodes || [])) {
          router.replace('/console')
          return
        }
        return load()
      })
      .catch(() => router.replace('/login?ru=/console/support-accounts'))
      .finally(() => setLoading(false))
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
      await createSupportAccount({
        phone: form.phone.trim(),
        nickname: form.nickname.trim(),
        password: form.password.trim(),
        supportRole: form.supportRole,
      })
      setForm({ phone: '', nickname: '', password: '', supportRole: 'support_agent' })
      await load()
      setMessage('客服账号已创建')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '创建失败')
    } finally {
      setSaving(false)
    }
  }

  const deactivate = async (id: number) => {
    setMessage('')
    setError('')
    setSaving(true)
    try {
      await deactivateSupportAccount(id)
      await load()
      setMessage('客服账号已停用，历史会话仍保留')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '停用失败')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (account: SupportAccountVO) => {
    setMessage('')
    setError('')
    setEditingId(account.id)
    setEditForm({
      phone: account.phone,
      nickname: account.nickname || '',
      password: '',
      status: account.status,
      supportRole: account.supportRole === 'support_manager' ? 'support_manager' : 'support_agent',
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({ phone: '', nickname: '', password: '', status: 1, supportRole: 'support_agent' })
  }

  const saveEdit = async () => {
    if (!editingId) return
    setMessage('')
    setError('')
    if (!editForm.phone.trim() || !editForm.nickname.trim()) {
      setError('请填写手机号和客服昵称')
      return
    }
    setSaving(true)
    try {
      await updateSupportAccount(editingId, {
        phone: editForm.phone.trim(),
        nickname: editForm.nickname.trim(),
        password: editForm.password.trim() || undefined,
        status: editForm.status,
        supportRole: editForm.supportRole,
      })
      cancelEdit()
      await load()
      setMessage('客服账号已更新')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '更新失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-[14px] text-gray-500">正在加载客服账号...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold text-[#111]">客服账号管理</h1>
          <p className="mt-2 text-[14px] text-gray-500">平台管理员创建、编辑和停用人工客服账号；客服登录后进入客服工作台，不进入平台后台或主办方后台。</p>
        </div>
        <Link href={getSupportConversationRecordsHref()} className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-[13px] text-gray-600 hover:border-[#ff1268] hover:text-[#ff1268]">
          <MessageSquareText className="h-4 w-4" />
          查看用户会话记录
        </Link>
      </div>

      {(message || error) && (
        <div className={`rounded-xl px-4 py-3 text-[13px] ${error ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
          {error || message}
        </div>
      )}

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-[16px] font-bold text-[#111]">
          <Plus className="h-4 w-4 text-[#ff1268]" />
          新建人工客服
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_140px_auto]">
          <input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="手机号" className="h-10 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]" />
          <input value={form.nickname} onChange={event => setForm({ ...form, nickname: event.target.value })} placeholder="客服昵称" className="h-10 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]" />
          <input value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} placeholder="初始密码" type="password" className="h-10 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]" />
          <select value={form.supportRole} onChange={event => setForm({ ...form, supportRole: event.target.value as SupportRole })} className="h-10 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]">
            {supportRoleOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <button onClick={submit} disabled={saving} className="h-10 rounded-lg bg-[#ff1268] px-4 text-[13px] font-medium text-white disabled:opacity-60">创建</button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4 text-[16px] font-bold text-[#111]">人工客服列表</div>
        <div className="divide-y divide-gray-100">
          {accounts.length === 0 ? (
            <div className="px-5 py-10 text-center text-[13px] text-gray-400">暂无客服账号</div>
          ) : accounts.map(account => (
            <div key={account.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff0f5] text-[#ff1268]">
                  <Headphones className="h-5 w-5" />
                </div>
                {editingId === account.id ? (
                  <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-[150px_150px_150px_120px_110px]">
                    <input value={editForm.phone} onChange={event => setEditForm({ ...editForm, phone: event.target.value })} placeholder="手机号" className="h-9 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]" />
                    <input value={editForm.nickname} onChange={event => setEditForm({ ...editForm, nickname: event.target.value })} placeholder="客服昵称" className="h-9 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]" />
                    <input value={editForm.password} onChange={event => setEditForm({ ...editForm, password: event.target.value })} placeholder="新密码（可不填）" type="password" className="h-9 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]" />
                    <select value={editForm.supportRole} onChange={event => setEditForm({ ...editForm, supportRole: event.target.value as SupportRole })} className="h-9 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]">
                      {supportRoleOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <select value={editForm.status} onChange={event => setEditForm({ ...editForm, status: Number(event.target.value) })} className="h-9 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]">
                      <option value={1}>启用</option>
                      <option value={0}>停用</option>
                    </select>
                  </div>
                ) : (
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold text-[#111]">{account.nickname || '未命名客服'}</div>
                    <div className="mt-1 text-[12px] text-gray-500">{account.phone} · {formatSupportRole(account.supportRole)} · {account.status === 1 ? '启用中' : '已停用'}</div>
                  </div>
                )}
              </div>
              {editingId === account.id ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#ff1268] px-3 py-2 text-[13px] text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    保存
                  </button>
                  <button
                    onClick={cancelEdit}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-[13px] text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    取消
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(account)}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-[13px] text-gray-600 hover:border-[#ff1268] hover:text-[#ff1268] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Pencil className="h-4 w-4" />
                    编辑
                  </button>
                  <button
                    onClick={() => deactivate(account.id)}
                    disabled={saving || account.status === 0}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-[13px] text-gray-600 hover:border-red-300 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ShieldOff className="h-4 w-4" />
                    停用
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
