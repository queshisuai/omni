'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, RefreshCw, Save, ShieldCheck } from 'lucide-react'
import { globalConfirm } from '@/components/GlobalDialog'
import { getUserInfo, listRbacPermissions, listRbacRoles, updateRbacRolePermissions } from '@/lib/api'
import { canUseConsoleAction } from '@/lib/console-auth'
import type { RbacPermissionVO, RbacRoleVO } from '@/types/api'

function groupPermission(code: string) {
  const prefix = code.split('.')[0]
  const labels: Record<string, string> = {
    activity: '活动',
    artist: '艺人',
    compensation: '补偿任务',
    organizer: '主办方账号',
    payment: '支付',
    rbac: '角色权限',
    reconcile: '对账',
    refund: '退款',
    risk: '风控',
    station: '站点',
    support: '客服',
    ticket: '票务',
  }
  return labels[prefix] || '其他'
}

function diffPermissionCodes(before: string[], after: string[]) {
  const beforeSet = new Set(before)
  const afterSet = new Set(after)
  return {
    added: after.filter(code => !beforeSet.has(code)),
    removed: before.filter(code => !afterSet.has(code)),
  }
}

function formatPermissionList(codes: string[], permissionNameByCode: Map<string, string>) {
  if (codes.length === 0) return '无'
  const visibleCodes = codes.slice(0, 8)
  const items = visibleCodes.map(code => `${permissionNameByCode.get(code) || code}（${code}）`)
  if (codes.length > visibleCodes.length) {
    items.push(`另有 ${codes.length - visibleCodes.length} 项`)
  }
  return items.join('\n')
}

export default function ConsoleRolesPage() {
  const router = useRouter()
  const [roles, setRoles] = useState<RbacRoleVO[]>([])
  const [permissions, setPermissions] = useState<RbacPermissionVO[]>([])
  const [selectedRoleCode, setSelectedRoleCode] = useState('')
  const [selectedByRole, setSelectedByRole] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [savingRoleCode, setSavingRoleCode] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [roleItems, permissionItems] = await Promise.all([listRbacRoles(), listRbacPermissions()])
      setRoles(roleItems)
      setPermissions(permissionItems)
      setSelectedByRole(Object.fromEntries(roleItems.map(role => [role.code, role.permissionCodes || []])))
      setSelectedRoleCode(current => current || roleItems[0]?.code || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载角色权限失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getUserInfo()
      .then(info => {
        if (info.role !== 'admin' && !canUseConsoleAction('rbac.manage', info.permissionCodes || [])) {
          router.replace('/console')
          return
        }
        return load()
      })
      .catch(() => router.replace('/login?ru=/console/roles'))
  }, [router])

  const selectedRole = roles.find(role => role.code === selectedRoleCode)
  const selectedPermissionCodes = selectedByRole[selectedRoleCode] || []
  const originalPermissionCodes = selectedRole?.permissionCodes || []
  const permissionNameByCode = useMemo(() => {
    return new Map(permissions.map(permission => [permission.code, permission.name]))
  }, [permissions])
  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, RbacPermissionVO[]>()
    for (const permission of permissions) {
      const label = groupPermission(permission.code)
      groups.set(label, [...(groups.get(label) || []), permission])
    }
    return Array.from(groups.entries())
  }, [permissions])

  const togglePermission = (permissionCode: string) => {
    if (!selectedRoleCode) return
    setSelectedByRole(current => {
      const existing = current[selectedRoleCode] || []
      const next = existing.includes(permissionCode)
        ? existing.filter(code => code !== permissionCode)
        : [...existing, permissionCode]
      return { ...current, [selectedRoleCode]: next }
    })
  }

  const saveRole = async () => {
    if (!selectedRoleCode) return
    setMessage('')
    setError('')
    const { added, removed } = diffPermissionCodes(originalPermissionCodes, selectedPermissionCodes)
    if (added.length === 0 && removed.length === 0) {
      setMessage('角色授权没有变化')
      return
    }
    const isDangerous = selectedRoleCode === 'platform_super_admin' || removed.includes('rbac.manage')
    const confirmed = await globalConfirm({
      type: isDangerous ? 'danger' : 'confirm',
      title: isDangerous ? '确认保存高危授权变更' : '确认保存角色授权',
      content: [
        `角色：${selectedRole?.name || selectedRoleCode}`,
        '',
        `新增权限：\n${formatPermissionList(added, permissionNameByCode)}`,
        '',
        `移除权限：\n${formatPermissionList(removed, permissionNameByCode)}`,
        '',
        isDangerous ? '该操作可能影响平台后台管理能力，请确认后继续。' : '保存后将立即影响该角色的后台访问能力。',
      ].join('\n'),
      confirmText: '保存',
      cancelText: '取消',
    })
    if (!confirmed) return
    setSavingRoleCode(selectedRoleCode)
    try {
      await updateRbacRolePermissions(selectedRoleCode, selectedPermissionCodes)
      await load()
      setMessage('角色授权已保存')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存角色授权失败')
    } finally {
      setSavingRoleCode('')
    }
  }

  if (loading) {
    return <div className="p-8 text-[14px] text-gray-500">正在加载角色权限...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold text-[#111]">角色权限管理</h1>
          <p className="mt-2 text-[14px] text-gray-500">维护后台职位对应的权限点，保存后通过后端 RBAC 鉴权生效。</p>
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

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4 text-[16px] font-bold text-[#111]">职位角色</div>
          <div className="divide-y divide-gray-100">
            {roles.map(role => {
              const active = role.code === selectedRoleCode
              return (
                <button
                  key={role.code}
                  onClick={() => setSelectedRoleCode(role.code)}
                  className={`flex w-full items-center gap-3 px-5 py-4 text-left transition-colors ${active ? 'bg-[#fff0f5]' : 'hover:bg-gray-50'}`}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-[#ff1268] text-white' : 'bg-gray-100 text-gray-500'}`}>
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold text-[#111]">{role.name}</div>
                    <div className="mt-1 truncate font-mono text-[12px] text-gray-500">{role.code}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
            <div>
              <div className="text-[16px] font-bold text-[#111]">{selectedRole?.name || '请选择角色'}</div>
              <div className="mt-1 font-mono text-[12px] text-gray-500">{selectedRole?.code || '-'}</div>
            </div>
            <button
              onClick={saveRole}
              disabled={!selectedRoleCode || Boolean(savingRoleCode)}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#ff1268] px-4 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {savingRoleCode ? '保存中...' : '保存授权'}
            </button>
          </div>

          <div className="space-y-5 p-5">
            {groupedPermissions.map(([group, items]) => (
              <div key={group}>
                <div className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-[#111]">
                  <KeyRound className="h-4 w-4 text-[#ff1268]" />
                  {group}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {items.map(permission => {
                    const checked = selectedPermissionCodes.includes(permission.code)
                    return (
                      <label key={permission.code} className={`flex min-h-[82px] cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${checked ? 'border-[#ff1268] bg-[#fff7fb]' : 'border-gray-100 hover:border-gray-200'}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePermission(permission.code)}
                          className="mt-1 h-4 w-4 accent-[#ff1268]"
                        />
                        <span className="min-w-0">
                          <span className="block text-[14px] font-semibold text-[#111]">{permission.name}</span>
                          <span className="mt-1 block font-mono text-[12px] text-gray-500">{permission.code}</span>
                          {permission.description && <span className="mt-1 block text-[12px] text-gray-400">{permission.description}</span>}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
