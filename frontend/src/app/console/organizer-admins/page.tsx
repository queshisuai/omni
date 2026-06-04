'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Pencil, Plus, RefreshCw, ShieldOff, Trash2, Users, X } from 'lucide-react'
import { globalConfirm } from '@/components/GlobalDialog'
import {
  createOrganizerAdminAccount,
  deactivateOrganizerAdminAccount,
  deleteOrganizerAdminAccount,
  getUserInfo,
  listOrganizerAdminAccounts,
  updateOrganizerAdminAccount,
} from '@/lib/api'
import { canUseConsoleAction } from '@/lib/console-auth'
import type { OrganizerAdminAccountVO } from '@/types/api'

const emptyEditForm = { phone: '', nickname: '', password: '', status: 1 }

export default function OrganizerAdminsPage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<OrganizerAdminAccountVO[]>([])
  const [form, setForm] = useState({ phone: '', nickname: '', password: '' })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState(emptyEditForm)
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
        if (!canUseConsoleAction('organizer.account.manage', info.permissionCodes || [])) {
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

  const startEdit = (account: OrganizerAdminAccountVO) => {
    setMessage('')
    setError('')
    setEditingId(account.id)
    setEditForm({
      phone: account.phone,
      nickname: account.nickname || '',
      password: '',
      status: account.status,
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm(emptyEditForm)
  }

  const saveEdit = async () => {
    if (!editingId) return
    setMessage('')
    setError('')
    if (!editForm.phone.trim() || !editForm.nickname.trim()) {
      setError('请填写手机号和昵称')
      return
    }
    setSaving(true)
    try {
      await updateOrganizerAdminAccount(editingId, {
        phone: editForm.phone.trim(),
        nickname: editForm.nickname.trim(),
        password: editForm.password.trim() || undefined,
        status: editForm.status,
      })
      cancelEdit()
      await load()
      setMessage('主办方管理员账号已更新')
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新主办方管理员账号失败')
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (account: OrganizerAdminAccountVO) => {
    if (account.status === 1) {
      const confirmed = await globalConfirm({
        type: 'danger',
        title: '停用主办方管理员账号',
        content: `确认停用「${account.nickname || account.phone}」吗？停用后该账号将不能继续进入后台。`,
        confirmText: '停用',
        cancelText: '取消',
      })
      if (!confirmed) return
    }
    setMessage('')
    setError('')
    setSaving(true)
    try {
      if (account.status === 1) {
        await deactivateOrganizerAdminAccount(account.id)
        setMessage('主办方管理员账号已停用')
      } else {
        await updateOrganizerAdminAccount(account.id, {
          phone: account.phone,
          nickname: account.nickname || '',
          status: 1,
        })
        setMessage('主办方管理员账号已启用')
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新账号状态失败')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (account: OrganizerAdminAccountVO) => {
    const confirmed = await globalConfirm({
      type: 'danger',
      title: '删除主办方管理员账号',
      content: `确认删除「${account.nickname || account.phone}」吗？删除后该账号将不再出现在列表中，也不能继续登录后台。`,
      confirmText: '删除',
      cancelText: '取消',
    })
    if (!confirmed) return
    setMessage('')
    setError('')
    setSaving(true)
    try {
      await deleteOrganizerAdminAccount(account.id)
      await load()
      setMessage('主办方管理员账号已删除')
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除主办方管理员账号失败')
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
          <h1 className="text-[24px] font-bold text-[#111]">主办方管理员账号管理</h1>
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
          新建主办方管理员账号
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
                {editingId === account.id ? (
                  <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-[170px_170px_170px_110px]">
                    <input value={editForm.phone} onChange={event => setEditForm({ ...editForm, phone: event.target.value })} placeholder="手机号" className="h-9 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]" />
                    <input value={editForm.nickname} onChange={event => setEditForm({ ...editForm, nickname: event.target.value })} placeholder="昵称" className="h-9 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]" />
                    <input value={editForm.password} onChange={event => setEditForm({ ...editForm, password: event.target.value })} placeholder="新密码（可不填）" type="password" className="h-9 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]" />
                    <select value={editForm.status} onChange={event => setEditForm({ ...editForm, status: Number(event.target.value) })} className="h-9 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]">
                      <option value={1}>启用</option>
                      <option value={0}>停用</option>
                    </select>
                  </div>
                ) : (
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold text-[#111]">{account.nickname || '未命名管理员'}</div>
                    <div className="mt-1 text-[12px] text-gray-500">{account.phone} · {account.status === 1 ? '启用中' : '已停用'} · {account.role}</div>
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
                    onClick={() => toggleStatus(account)}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-[13px] text-gray-600 hover:border-[#ff1268] hover:text-[#ff1268] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {account.status === 1 ? <ShieldOff className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                    {account.status === 1 ? '停用' : '启用'}
                  </button>
                  <button
                    onClick={() => remove(account)}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-[13px] text-gray-600 hover:border-red-300 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    删除
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
