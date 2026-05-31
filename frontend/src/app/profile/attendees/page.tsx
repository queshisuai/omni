'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Edit3, Loader2, Plus, Save, Trash2, UserRound, X } from 'lucide-react'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { globalConfirm } from '@/components/GlobalDialog'
import { createUserAttendee, deleteUserAttendee, listUserAttendees, updateUserAttendee } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'
import { getAttendeeIdTypeLabel } from '@/lib/attendees'
import type { UserAttendeePayload, UserAttendeeVO } from '@/types/api'

type FormState = {
  realName: string
  idType: 'ID_CARD' | 'PASSPORT'
  idNo: string
  phone: string
  isDefault: boolean
}

const emptyForm: FormState = {
  realName: '',
  idType: 'ID_CARD',
  idNo: '',
  phone: '',
  isDefault: false,
}

export default function ProfileAttendeesPage() {
  const router = useRouter()
  const [attendees, setAttendees] = useState<UserAttendeeVO[]>([])
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadAttendees = useCallback(async () => {
    if (!isAuthenticated()) {
      router.replace('/login?ru=/profile/attendees')
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await listUserAttendees()
      setAttendees(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '实名观演人加载失败')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    void loadAttendees()
  }, [loadAttendees])

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
    setMessage('')
  }

  const beginEdit = (attendee: UserAttendeeVO) => {
    setEditingId(attendee.id)
    setForm({
      realName: attendee.realName,
      idType: attendee.idType === 'PASSPORT' ? 'PASSPORT' : 'ID_CARD',
      idNo: '',
      phone: attendee.phone || '',
      isDefault: Boolean(attendee.isDefault),
    })
    setMessage('编辑时需要重新输入完整证件号。')
  }

  const buildPayload = (): UserAttendeePayload => ({
    realName: form.realName.trim(),
    idType: form.idType,
    idNo: form.idNo.trim(),
    phone: form.phone.trim() || null,
    isDefault: form.isDefault,
  })

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')
    setError('')
    const payload = buildPayload()
    if (!payload.realName) {
      setError('请输入姓名')
      return
    }
    if (!payload.idNo) {
      setError('请输入证件号')
      return
    }
    setSaving(true)
    try {
      const saved = editingId ? await updateUserAttendee(editingId, payload) : await createUserAttendee(payload)
      setAttendees((prev) => {
        const withoutSaved = prev.filter((item) => item.id !== saved.id)
        return [saved, ...withoutSaved]
      })
      resetForm()
      setMessage(editingId ? '实名观演人已更新' : '实名观演人已新增')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存实名观演人失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (attendee: UserAttendeeVO) => {
    const confirmed = await globalConfirm(`确认删除实名观演人“${attendee.realName}”？删除后不会影响已生成订单。`, '删除实名观演人')
    if (!confirmed) return
    setDeletingId(attendee.id)
    setError('')
    try {
      await deleteUserAttendee(attendee.id)
      setAttendees((prev) => prev.filter((item) => item.id !== attendee.id))
      if (editingId === attendee.id) resetForm()
      setMessage('实名观演人已删除')
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除实名观演人失败')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <Header />
      <main className="min-h-[calc(100vh-200px)] bg-[#f7f8fa] px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-[1120px]">
          <div className="mb-6">
            <h1 className="text-[28px] font-semibold text-[#111]">实名观演人</h1>
            <p className="mt-2 text-sm text-[#666]">维护常用观演人，下单实名制活动时可直接选择。</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[380px_1fr] lg:items-start">
            <section className="rounded-lg border border-[#eee] bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-center gap-2">
                {editingId ? <Edit3 className="h-5 w-5 text-[#ff1268]" /> : <Plus className="h-5 w-5 text-[#ff1268]" />}
                <h2 className="text-[18px] font-semibold text-[#111]">{editingId ? '编辑观演人' : '新增观演人'}</h2>
              </div>
              <form className="grid gap-4" onSubmit={handleSubmit}>
                <Field label="姓名" value={form.realName} onChange={(value) => setForm((prev) => ({ ...prev, realName: value }))} placeholder="请输入真实姓名" />
                <label className="grid gap-1.5 text-sm text-[#555]">
                  证件类型
                  <select
                    value={form.idType}
                    onChange={(event) => setForm((prev) => ({ ...prev, idType: event.target.value as FormState['idType'] }))}
                    className="h-11 rounded-lg border border-[#ddd] bg-white px-3 text-sm outline-none focus:border-[#ff1268]"
                  >
                    <option value="ID_CARD">身份证</option>
                    <option value="PASSPORT">护照</option>
                  </select>
                </label>
                <Field label="证件号" value={form.idNo} onChange={(value) => setForm((prev) => ({ ...prev, idNo: value }))} placeholder="请输入完整证件号" />
                <Field label="手机号" value={form.phone} onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))} placeholder="可选" />
                <label className="flex items-center gap-2 text-sm text-[#555]">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(event) => setForm((prev) => ({ ...prev, isDefault: event.target.checked }))}
                    className="h-4 w-4 accent-[#ff1268]"
                  />
                  设为默认观演人
                </label>
                {(error || message) && (
                  <div className={`rounded-lg px-3 py-2 text-sm ${error ? 'bg-[#fff5f5] text-[#b91c1c]' : 'bg-[#f6ffed] text-[#389e0d]'}`}>
                    {error || message}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ff1268] px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    保存
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-[#ddd] bg-white px-5 py-2.5 text-sm font-medium text-[#666]"
                    >
                      <X className="h-4 w-4" />
                      取消编辑
                    </button>
                  )}
                </div>
              </form>
            </section>

            <section className="rounded-lg border border-[#eee] bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-[18px] font-semibold text-[#111]">常用观演人</h2>
                <span className="text-sm text-[#777]">共 {attendees.length} 位</span>
              </div>
              {loading ? (
                <div className="flex min-h-[260px] items-center justify-center text-[#666]">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin text-[#ff1268]" />
                  正在加载实名观演人...
                </div>
              ) : attendees.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#ddd] px-6 py-10 text-center">
                  <UserRound className="mx-auto mb-3 h-9 w-9 text-[#ff1268]" />
                  <div className="text-[16px] font-medium text-[#111]">暂无实名观演人</div>
                  <p className="mt-2 text-sm text-[#777]">先新增常用观演人，实名制活动下单会更快。</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {attendees.map((attendee) => (
                    <div key={attendee.id} className="rounded-lg border border-[#eee] p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[16px] font-semibold text-[#111]">{attendee.realName}</span>
                            {attendee.isDefault && <span className="rounded-full bg-[#fff0f5] px-2 py-0.5 text-xs text-[#ff1268]">默认</span>}
                          </div>
                          <div className="mt-2 grid gap-1 text-sm text-[#666]">
                            <span>{getAttendeeIdTypeLabel(attendee.idType)}：{attendee.idNoMask}</span>
                            <span>手机号：{attendee.phone || '-'}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => beginEdit(attendee)}
                            className="inline-flex items-center gap-1 rounded-full border border-[#ddd] px-3 py-1.5 text-xs font-medium text-[#555]"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(attendee)}
                            disabled={deletingId === attendee.id}
                            className="inline-flex items-center gap-1 rounded-full border border-[#ffd6d6] px-3 py-1.5 text-xs font-medium text-[#b91c1c] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingId === attendee.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            删除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="grid gap-1.5 text-sm text-[#555]">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 rounded-lg border border-[#ddd] px-3 text-sm text-[#111] outline-none focus:border-[#ff1268]"
      />
    </label>
  )
}
