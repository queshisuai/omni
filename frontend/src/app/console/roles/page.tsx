'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, RefreshCw, RotateCcw, Save, Search, ShieldCheck, UserRound, UsersRound } from 'lucide-react'
import { globalConfirm } from '@/components/GlobalDialog'
import {
  getRbacUserPermissions,
  getUserInfo,
  listRbacPermissions,
  listRbacRoles,
  searchRbacUsers,
  updateRbacRolePermissions,
  updateRbacUserPermissionOverrides,
} from '@/lib/api'
import { canUseConsoleAction } from '@/lib/console-auth'
import { buildRbacPermissionDiff, formatRbacPermissionDiffList } from '@/lib/rbac-permission-diff'
import {
  groupRbacPermissionsByDomain,
  isRootLockedPermission,
  orderRbacPermissionCodes,
  orderRbacRoles,
  ROOT_LOCK_TOOLTIP,
} from '@/lib/rbac-permission-groups'
import { getRbacRoleTemplatesForRole } from '@/lib/rbac-role-templates'
import type { RbacPermissionVO, RbacRoleVO, RbacUserPermissionSummaryVO, RbacUserPermissionVO } from '@/types/api'

type WorkMode = 'role' | 'user'
type UserDraft = { allow: string[]; deny: string[] }

function formatInlineDiffList(items: Array<{ code: string; name: string }>) {
  return formatRbacPermissionDiffList(items, 4).replaceAll('\n', '、')
}

function displayUserName(user: Pick<RbacUserPermissionSummaryVO, 'userId' | 'nickname' | 'phone'> | null | undefined) {
  if (!user) return '请选择账号'
  return user.nickname || user.phone || `UID ${user.userId}`
}

function displayUserMeta(user: Pick<RbacUserPermissionSummaryVO, 'userId' | 'phone' | 'baseRoleName'> | null | undefined) {
  if (!user) return '输入姓名、手机号或 UID 检索账号'
  return `${user.baseRoleName} · UID ${user.userId}${user.phone ? ` · ${user.phone}` : ''}`
}

function hasPermission(codes: string[], permissionCode: string) {
  return codes.includes(permissionCode)
}

export default function ConsoleRolesPage() {
  const router = useRouter()
  const [workMode, setWorkMode] = useState<WorkMode>('role')
  const [roles, setRoles] = useState<RbacRoleVO[]>([])
  const [permissions, setPermissions] = useState<RbacPermissionVO[]>([])
  const [selectedRoleCode, setSelectedRoleCode] = useState('')
  const [selectedByRole, setSelectedByRole] = useState<Record<string, string[]>>({})
  const [userKeyword, setUserKeyword] = useState('')
  const [userResults, setUserResults] = useState<RbacUserPermissionSummaryVO[]>([])
  const [selectedUserPermissions, setSelectedUserPermissions] = useState<RbacUserPermissionVO | null>(null)
  const [userDraft, setUserDraft] = useState<UserDraft>({ allow: [], deny: [] })
  const [collapsedDomains, setCollapsedDomains] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [userSearching, setUserSearching] = useState(false)
  const [userLoading, setUserLoading] = useState(false)
  const [savingKey, setSavingKey] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [roleItems, permissionItems] = await Promise.all([listRbacRoles(), listRbacPermissions()])
      const orderedRoles = orderRbacRoles(roleItems)
      setRoles(orderedRoles)
      setPermissions(permissionItems)
      setSelectedByRole(Object.fromEntries(orderedRoles.map(role => [role.code, orderRbacPermissionCodes(role.permissionCodes || [])])))
      setSelectedRoleCode(current => current || orderedRoles[0]?.code || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载角色权限失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    getUserInfo()
      .then(info => {
        if (!canUseConsoleAction('rbac.manage', info.permissionCodes || [])) {
          router.replace('/console')
          return
        }
        return load()
      })
      .catch(() => router.replace('/login?ru=/console/rbac/roles'))
  }, [load, router])

  const selectedRole = roles.find(role => role.code === selectedRoleCode)
  const selectedPermissionCodes = selectedByRole[selectedRoleCode] || []
  const activeRoleCode = workMode === 'user' ? selectedUserPermissions?.effectiveRole || null : selectedRoleCode
  const rolePermissionCodes = useMemo(() => {
    if (workMode !== 'role') return []
    const codes = new Set(selectedPermissionCodes)
    if (isRootLockedPermission(selectedRoleCode, 'rbac.manage')) codes.add('rbac.manage')
    return orderRbacPermissionCodes([...codes])
  }, [selectedPermissionCodes, selectedRoleCode, workMode])
  const userEffectivePermissionCodes = useMemo(() => {
    if (!selectedUserPermissions) return []
    const inherited = new Set(selectedUserPermissions.inheritedPermissionCodes || [])
    const allow = new Set(userDraft.allow || [])
    const deny = new Set(userDraft.deny || [])
    const effective = new Set([...inherited, ...allow])
    for (const code of deny) effective.delete(code)
    if (isRootLockedPermission(selectedUserPermissions.effectiveRole, 'rbac.manage')) effective.add('rbac.manage')
    return orderRbacPermissionCodes([...effective])
  }, [selectedUserPermissions, userDraft])
  const currentEffectivePermissionCodes = workMode === 'user' ? userEffectivePermissionCodes : rolePermissionCodes
  const originalPermissionCodes = workMode === 'user'
    ? selectedUserPermissions?.effectivePermissionCodes || []
    : selectedRole?.permissionCodes || []
  const permissionNameByCode = useMemo(() => {
    return new Map(permissions.map(permission => [permission.code, permission.name]))
  }, [permissions])
  const availablePermissionCodes = useMemo(() => {
    return permissions.map(permission => permission.code)
  }, [permissions])
  const roleTemplates = useMemo(() => {
    return getRbacRoleTemplatesForRole(selectedRoleCode, availablePermissionCodes)
  }, [availablePermissionCodes, selectedRoleCode])
  const activeTemplate = roleTemplates[0] || null
  const permissionChangePreview = useMemo(() => {
    return buildRbacPermissionDiff(originalPermissionCodes, currentEffectivePermissionCodes, permissionNameByCode, {
      roleCode: activeRoleCode,
    })
  }, [activeRoleCode, currentEffectivePermissionCodes, originalPermissionCodes, permissionNameByCode])
  const groupedPermissions = useMemo(() => {
    return groupRbacPermissionsByDomain(permissions)
  }, [permissions])

  const selectUser = async (user: RbacUserPermissionSummaryVO) => {
    setUserLoading(true)
    setError('')
    setMessage('')
    try {
      const detail = await getRbacUserPermissions(user.userId)
      setSelectedUserPermissions(detail)
      setUserDraft({
        allow: orderRbacPermissionCodes(detail.allowPermissionCodes || []),
        deny: orderRbacPermissionCodes(detail.denyPermissionCodes || []),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载账号权限微调失败')
    } finally {
      setUserLoading(false)
    }
  }

  const searchUsersForOverride = async () => {
    const keyword = userKeyword.trim()
    if (!keyword) {
      setMessage('请输入姓名、手机号或 UID 后再检索账号')
      return
    }
    setUserSearching(true)
    setError('')
    setMessage('')
    try {
      const users = await searchRbacUsers(keyword)
      setUserResults(users)
      if (users.length === 0) {
        setSelectedUserPermissions(null)
        setMessage('未找到匹配账号')
      } else if (users.length === 1) {
        await selectUser(users[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '检索账号失败')
    } finally {
      setUserSearching(false)
    }
  }

  const toggleRolePermission = (permissionCode: string) => {
    if (!selectedRoleCode) return
    if (isRootLockedPermission(selectedRoleCode, permissionCode)) {
      setMessage(ROOT_LOCK_TOOLTIP)
      return
    }
    setSelectedByRole(current => {
      const existing = current[selectedRoleCode] || []
      const next = existing.includes(permissionCode)
        ? existing.filter(code => code !== permissionCode)
        : [...existing, permissionCode]
      return { ...current, [selectedRoleCode]: orderRbacPermissionCodes(next) }
    })
  }

  const toggleUserPermission = (permissionCode: string) => {
    if (!selectedUserPermissions) return
    if (isRootLockedPermission(selectedUserPermissions.effectiveRole, permissionCode)) {
      setMessage(ROOT_LOCK_TOOLTIP)
      return
    }
    const inherited = hasPermission(selectedUserPermissions.inheritedPermissionCodes, permissionCode)
    setUserDraft(current => {
      const allow = new Set(current.allow)
      const deny = new Set(current.deny)
      if (inherited) {
        allow.delete(permissionCode)
        if (deny.has(permissionCode)) {
          deny.delete(permissionCode)
        } else {
          deny.add(permissionCode)
        }
      } else {
        deny.delete(permissionCode)
        if (allow.has(permissionCode)) {
          allow.delete(permissionCode)
        } else {
          allow.add(permissionCode)
        }
      }
      return {
        allow: orderRbacPermissionCodes([...allow]),
        deny: orderRbacPermissionCodes([...deny]),
      }
    })
  }

  const togglePermission = (permissionCode: string) => {
    if (workMode === 'user') {
      toggleUserPermission(permissionCode)
      return
    }
    toggleRolePermission(permissionCode)
  }

  const applyRoleTemplate = () => {
    if (!selectedRoleCode || !activeTemplate) return
    setSelectedByRole(current => ({ ...current, [selectedRoleCode]: activeTemplate.permissionCodes }))
    setError('')
    setMessage(`已套用${activeTemplate.name}，请核对权限变更预览后保存`)
  }

  const resetUserToRoleDefault = () => {
    if (!selectedUserPermissions) return
    setUserDraft({ allow: [], deny: [] })
    setError('')
    setMessage('已还原为角色默认权限，请核对权限变更预览后保存')
  }

  const toggleDomain = (domainKey: string, permissionCodes: string[]) => {
    const allSelected = permissionCodes.length > 0 && permissionCodes.every(code => currentEffectivePermissionCodes.includes(code))
    if (workMode === 'role') {
      if (!selectedRoleCode) return
      setSelectedByRole(current => {
        const next = new Set(current[selectedRoleCode] || [])
        if (allSelected) {
          for (const code of permissionCodes) {
            if (!isRootLockedPermission(selectedRoleCode, code)) next.delete(code)
          }
        } else {
          for (const code of permissionCodes) next.add(code)
        }
        if (isRootLockedPermission(selectedRoleCode, 'rbac.manage')) next.add('rbac.manage')
        return { ...current, [selectedRoleCode]: orderRbacPermissionCodes([...next]) }
      })
      return
    }
    if (!selectedUserPermissions) return
    setUserDraft(current => {
      const allow = new Set(current.allow)
      const deny = new Set(current.deny)
      for (const code of permissionCodes) {
        if (isRootLockedPermission(selectedUserPermissions.effectiveRole, code)) {
          deny.delete(code)
          continue
        }
        const inherited = hasPermission(selectedUserPermissions.inheritedPermissionCodes, code)
        if (allSelected) {
          if (inherited) deny.add(code)
          allow.delete(code)
        } else {
          deny.delete(code)
          if (!inherited) allow.add(code)
        }
      }
      return {
        allow: orderRbacPermissionCodes([...allow]),
        deny: orderRbacPermissionCodes([...deny]),
      }
    })
    setCollapsedDomains(current => ({ ...current, [domainKey]: false }))
  }

  const saveRole = async () => {
    if (!selectedRoleCode) return
    setMessage('')
    setError('')
    if (!permissionChangePreview.hasChanges) {
      setMessage('角色授权没有变化')
      return
    }
    const confirmed = await globalConfirm({
      type: permissionChangePreview.hasSensitiveChanges ? 'danger' : 'confirm',
      title: '确认更新角色权限',
      content: [
        `角色：${selectedRole?.name || selectedRoleCode}`,
        '',
        `新增权限：\n${formatRbacPermissionDiffList(permissionChangePreview.added)}`,
        '',
        `移除权限：\n${formatRbacPermissionDiffList(permissionChangePreview.removed)}`,
        '',
        permissionChangePreview.hasSensitiveChanges ? '本次包含敏感权限变更，可能影响平台后台管理能力，请确认后继续。' : '保存后将立即影响该角色的后台访问能力。',
      ].join('\n'),
      confirmText: '确认更新',
      cancelText: '取消',
    })
    if (!confirmed) return
    setSavingKey(`role:${selectedRoleCode}`)
    try {
      await updateRbacRolePermissions(selectedRoleCode, currentEffectivePermissionCodes)
      await load()
      setMessage('角色授权已保存')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存角色授权失败')
    } finally {
      setSavingKey('')
    }
  }

  const saveUser = async () => {
    if (!selectedUserPermissions) return
    setMessage('')
    setError('')
    if (!permissionChangePreview.hasChanges) {
      setMessage('账号权限微调没有变化')
      return
    }
    const confirmed = await globalConfirm({
      type: permissionChangePreview.hasSensitiveChanges ? 'danger' : 'confirm',
      title: '确认保存账号权限微调',
      content: [
        `账号：${displayUserName(selectedUserPermissions)}`,
        `当前基准角色：${selectedUserPermissions.baseRoleName}`,
        '',
        `新增权限：\n${formatRbacPermissionDiffList(permissionChangePreview.added)}`,
        '',
        `移除权限：\n${formatRbacPermissionDiffList(permissionChangePreview.removed)}`,
        '',
        permissionChangePreview.hasSensitiveChanges ? '本次包含敏感权限变更，可能影响账号后台访问能力，请确认后继续。' : '保存后将立即影响该账号的后台访问能力。',
      ].join('\n'),
      confirmText: '确认保存',
      cancelText: '取消',
    })
    if (!confirmed) return
    setSavingKey(`user:${selectedUserPermissions.userId}`)
    try {
      const refreshed = await updateRbacUserPermissionOverrides(selectedUserPermissions.userId, {
        allowPermissionCodes: userDraft.allow,
        denyPermissionCodes: userDraft.deny,
        reason: '控制台账号权限微调',
      })
      setSelectedUserPermissions(refreshed)
      setUserDraft({
        allow: orderRbacPermissionCodes(refreshed.allowPermissionCodes || []),
        deny: orderRbacPermissionCodes(refreshed.denyPermissionCodes || []),
      })
      setMessage('账号权限微调已保存')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存账号权限微调失败')
    } finally {
      setSavingKey('')
    }
  }

  const saveCurrent = () => {
    if (workMode === 'user') return saveUser()
    return saveRole()
  }

  if (loading) {
    return <div className="p-8 text-[14px] text-gray-500">正在加载角色权限...</div>
  }

  const selectedCountByDomain = (items: RbacPermissionVO[]) => {
    return items.filter(item => currentEffectivePermissionCodes.includes(item.code)).length
  }

  const workbenchTitle = workMode === 'user' ? displayUserName(selectedUserPermissions) : selectedRole?.name || '请选择角色'
  const workbenchMeta = workMode === 'user'
    ? displayUserMeta(selectedUserPermissions)
    : selectedRole?.code || '-'
  const saveDisabled = Boolean(savingKey) || (workMode === 'user' ? !selectedUserPermissions : !selectedRoleCode)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold text-[#111]">角色权限管理</h1>
          <p className="mt-2 text-[14px] text-gray-500">维护职位角色模板，并对指定账号做权限特许开放或显式禁用。</p>
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
        <div className={`rounded-lg px-4 py-3 text-[13px] ${error ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
          {error || message}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[310px_1fr]">
        <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="grid grid-cols-2 border-b border-gray-100 p-2">
            <button
              type="button"
              onClick={() => setWorkMode('role')}
              className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg text-[13px] font-medium ${workMode === 'role' ? 'bg-[#ff1268] text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <ShieldCheck className="h-4 w-4" />
              按职位角色
            </button>
            <button
              type="button"
              onClick={() => setWorkMode('user')}
              className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg text-[13px] font-medium ${workMode === 'user' ? 'bg-[#ff1268] text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <UserRound className="h-4 w-4" />
              按指定账号
            </button>
          </div>

          {workMode === 'role' ? (
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
          ) : (
            <div className="space-y-3 p-4">
              <form
                onSubmit={event => {
                  event.preventDefault()
                  void searchUsersForOverride()
                }}
                className="flex gap-2"
              >
                <input
                  value={userKeyword}
                  onChange={event => setUserKeyword(event.target.value)}
                  placeholder="姓名 / 手机号 / UID"
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-[#ff1268]"
                />
                <button
                  type="submit"
                  disabled={userSearching}
                  className="inline-flex h-9 w-10 items-center justify-center rounded-lg bg-[#ff1268] text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Search className="h-4 w-4" />
                </button>
              </form>
              <div className="space-y-2">
                {userResults.map(user => {
                  const active = user.userId === selectedUserPermissions?.userId
                  return (
                    <button
                      key={user.userId}
                      type="button"
                      onClick={() => selectUser(user)}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${active ? 'border-[#ff1268] bg-[#fff0f5]' : 'border-gray-100 hover:bg-gray-50'}`}
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-[#ff1268] text-white' : 'bg-gray-100 text-gray-500'}`}>
                        <UsersRound className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold text-[#111]">{displayUserName(user)}</div>
                        <div className="mt-1 truncate text-[12px] text-gray-500">{displayUserMeta(user)}</div>
                      </div>
                    </button>
                  )
                })}
                {userLoading && <div className="rounded-lg bg-gray-50 px-3 py-2 text-[12px] text-gray-500">正在加载账号权限...</div>}
              </div>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
            <div>
              <div className="text-[16px] font-bold text-[#111]">{workbenchTitle}</div>
              <div className="mt-1 font-mono text-[12px] text-gray-500">{workbenchMeta}</div>
            </div>
            <button
              onClick={saveCurrent}
              disabled={saveDisabled}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#ff1268] px-4 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {savingKey ? '保存中...' : workMode === 'user' ? '保存账号微调' : '保存授权'}
            </button>
          </div>

          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-[13px]">
              {workMode === 'user' ? (
                <div className="min-w-0">
                  <span className="font-semibold text-[#111]">当前基准角色：</span>
                  <span className="font-semibold text-[#ff1268]">{selectedUserPermissions?.baseRoleName || '请先选择账号'}</span>
                  <span className="ml-2 text-gray-500">在基准角色底色上进行特许开放或显式禁用。</span>
                </div>
              ) : (
                <div className="min-w-0">
                  <span className="font-semibold text-[#111]">套用角色模板：</span>
                  <span className="font-semibold text-[#ff1268]">{activeTemplate?.name || '暂无模板'}</span>
                  <span className="ml-2 text-gray-500">
                    {activeTemplate ? `${activeTemplate.description} 包含 ${activeTemplate.permissionCodes.length} 项权限。` : '当前角色暂无官方模板。'}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={workMode === 'user' ? resetUserToRoleDefault : applyRoleTemplate}
                disabled={workMode === 'user' ? !selectedUserPermissions : !activeTemplate}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#ff1268] bg-white px-3 text-[13px] font-medium text-[#ff1268] hover:bg-[#fff0f5] disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
              >
                {workMode === 'user' ? <RotateCcw className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                {workMode === 'user' ? '还原为角色默认' : '套用模板'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50/40 px-3.5 py-2 text-[13px]">
              <div className="min-w-0 truncate text-gray-700">
                <span className="font-semibold text-[#111]">权限变更预览：</span>
                新增: {formatInlineDiffList(permissionChangePreview.added)} | 移除: {formatInlineDiffList(permissionChangePreview.removed)}
              </div>
              <div className="hidden shrink-0 text-[12px] text-gray-500 xl:block">
                保存前请核对以上变更，保存后将立即影响该角色（或账号）的后台访问能力。
              </div>
            </div>

            {workMode === 'user' && !selectedUserPermissions ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-16 text-center text-[14px] text-gray-500">
                请先在左侧检索并选择账号，再进行专属权限微调。
              </div>
            ) : (
              <div className="space-y-3">
                {groupedPermissions.map(group => {
                  const selectedCount = selectedCountByDomain(group.items)
                  const collapsed = Boolean(collapsedDomains[group.key])
                  const allSelected = group.items.length > 0 && selectedCount === group.items.length
                  return (
                    <div key={group.key} className="rounded-xl border border-gray-100 bg-white">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setCollapsedDomains(current => ({ ...current, [group.key]: !collapsed }))}
                        onKeyDown={event => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setCollapsedDomains(current => ({ ...current, [group.key]: !collapsed }))
                          }
                        }}
                        className="flex cursor-pointer items-center justify-between gap-3 rounded-t-xl bg-gray-50 px-4 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onClick={event => {
                              event.stopPropagation()
                              toggleDomain(group.key, group.items.map(item => item.code))
                            }}
                            onChange={() => undefined}
                            className="h-4 w-4 accent-[#ff1268]"
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[14px] font-bold text-[#111]">{group.title}</span>
                              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-gray-500">{selectedCount}/{group.items.length} 已选</span>
                            </div>
                            <div className="mt-1 truncate text-[12px] text-gray-500">{group.summary}</div>
                          </div>
                        </div>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${collapsed ? '-rotate-90' : 'rotate-0'}`} />
                      </div>
                      {!collapsed && (
                        <div className="flex flex-wrap gap-2 px-4 py-3">
                          {group.items.map(permission => {
                            const locked = isRootLockedPermission(activeRoleCode, permission.code)
                            const inherited = Boolean(selectedUserPermissions?.inheritedPermissionCodes.includes(permission.code))
                            const allowed = userDraft.allow.includes(permission.code)
                            const denied = userDraft.deny.includes(permission.code)
                            const checked = currentEffectivePermissionCodes.includes(permission.code)
                            const chipClass = locked
                              ? 'border border-amber-300 bg-amber-50/70 text-gray-800 cursor-not-allowed'
                              : denied
                                ? 'border border-amber-200 bg-amber-50/70 text-amber-700 cursor-pointer'
                                : checked
                                  ? 'border border-red-200 bg-red-50/70 text-gray-900 font-bold cursor-pointer'
                                  : 'border border-gray-200 bg-gray-50/80 text-gray-600 hover:bg-gray-100 cursor-pointer'
                            return (
                              <label
                                key={permission.code}
                                title={locked ? ROOT_LOCK_TOOLTIP : permission.description || permission.name}
                                onClick={event => {
                                  if (locked) {
                                    event.preventDefault()
                                    setMessage(ROOT_LOCK_TOOLTIP)
                                    return
                                  }
                                  event.preventDefault()
                                  togglePermission(permission.code)
                                }}
                                className={`inline-flex select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] transition-colors ${chipClass}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={locked}
                                  onChange={() => undefined}
                                  className={`h-3.5 w-3.5 accent-[#ff1268] ${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                />
                                <span>{permission.name}</span>
                                <span className="font-mono text-[10px] font-normal text-gray-400">{permission.code}</span>
                                {workMode === 'user' && inherited && !allowed && !denied && (
                                  <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-normal text-gray-500">继承</span>
                                )}
                                {workMode === 'user' && allowed && (
                                  <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-normal text-green-600">特许</span>
                                )}
                                {workMode === 'user' && denied && (
                                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-normal text-amber-700">禁用</span>
                                )}
                                {locked && (
                                  <>
                                    <i className="fa-solid fa-lock text-amber-500" aria-hidden="true" />
                                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">[系统自保]</span>
                                  </>
                                )}
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
