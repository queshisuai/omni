'use client'

import { useEffect, useState, startTransition } from 'react'
import { searchAdminArtists } from '@/lib/api'
import type { ActivityArtistVO, ArtistSearchVO, ActivityArtistVisibility } from '@/types/api'

const ROLE_OPTIONS = [
  { value: 'primary', label: '主艺人' },
  { value: 'co_headliner', label: '联合主艺人' },
  { value: 'performer', label: '参演艺人' },
  { value: 'special_guest', label: '特邀嘉宾' },
  { value: 'flying_guest', label: '飞行嘉宾' },
  { value: 'host', label: '主持人' },
  { value: 'band', label: '乐队/伴奏' },
  { value: 'production_team', label: '制作团队' },
  { value: 'custom', label: '自定义' },
]

type Props = {
  value: ActivityArtistVO[]
  onChange: (value: ActivityArtistVO[]) => void
}

export function ActivityArtistSelector({ value, onChange }: Props) {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<ArtistSearchVO[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!keyword.trim()) {
      setResults([])
      return
    }
    let cancelled = false
    setSearching(true)
    const timer = window.setTimeout(() => {
      searchAdminArtists(keyword)
        .then(items => { if (!cancelled) setResults(items) })
        .catch(() => { if (!cancelled) setResults([]) })
        .finally(() => { if (!cancelled) setSearching(false) })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [keyword])

  const normalize = (items: ActivityArtistVO[]) => {
    const primary = items.find(item => item.isPrimary || item.primary)
    const ordered = primary ? [primary, ...items.filter(item => item.artistId !== primary.artistId)] : [...items]
    return ordered.map((item, index) => ({ ...item, isPrimary: primary?.artistId === item.artistId, sort: index + 1 }))
  }

  const addArtist = (artist: ArtistSearchVO) => {
    if (value.some(item => item.artistId === artist.id)) return
    const next: ActivityArtistVO = {
      artistId: artist.id,
      name: artist.name,
      alias: artist.alias,
      artistType: artist.artistType,
      countryOrRegion: artist.countryOrRegion,
      categoryTags: artist.categoryTags,
      avatar: artist.avatar,
      isPrimary: value.length === 0,
      roleType: value.length === 0 ? 'primary' : 'performer',
      roleName: value.length === 0 ? '主艺人' : '参演艺人',
      visibility: 'public',
      sort: value.length + 1,
    }
    onChange(normalize([...value, next]))
    setKeyword('')
    setResults([])
  }

  const update = (artistId: number, patch: Partial<ActivityArtistVO>) => {
    onChange(normalize(value.map(item => item.artistId === artistId ? { ...item, ...patch } : item)))
  }

  const remove = (artistId: number) => {
    onChange(normalize(value.filter(item => item.artistId !== artistId)))
  }

  const move = (artistId: number, direction: -1 | 1) => {
    const index = value.findIndex(item => item.artistId === artistId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= value.length) return
    const next = [...value]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    onChange(normalize(next))
  }

  const setPrimary = (artistId: number) => {
    startTransition(() => {
      onChange(normalize(value.map(item => ({ ...item, isPrimary: item.artistId === artistId, roleType: item.artistId === artistId ? 'primary' : item.roleType, roleName: item.artistId === artistId ? '主艺人' : item.roleName }))))
    })
  }

  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-4">
      <div className="mb-3 text-[14px] font-semibold text-[#1a1a2e]">活动艺人阵容 *</div>
      <input value={keyword} onChange={event => setKeyword(event.target.value)} className="h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="搜索艺人/团队名称、别名、代表作品" />
      {keyword.trim() && (
        <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-[#e5e5e5] bg-white">
          {searching ? <div className="p-3 text-[13px] text-[#999]">搜索中...</div> : results.length === 0 ? <div className="p-3 text-[13px] text-[#999]">未找到艺人，请联系平台补充艺人档案。</div> : results.map(artist => (
            <button key={artist.id} type="button" onClick={() => addArtist(artist)} className="block w-full border-b border-[#f5f5f5] bg-white px-3 py-2 text-left hover:bg-[#fff7fa]">
              <div className="text-[14px] font-medium text-[#333]">{artist.name}{artist.alias ? ` / ${artist.alias}` : ''}</div>
              <div className="mt-0.5 text-[12px] text-[#999]">{[artist.countryOrRegion, artist.artistType, artist.categoryTags].filter(Boolean).join(' · ') || '暂无身份信息'}</div>
            </button>
          ))}
        </div>
      )}
      <div className="mt-4 space-y-3">
        {value.map((item, index) => (
          <div key={item.artistId} className="rounded-lg border border-[#e5e5e5] bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#fff0f3] px-3 py-1 text-[13px] font-medium text-[#ff1268]">{item.name || `艺人 ${item.artistId}`}</span>
              {(item.isPrimary || item.primary) && <span className="rounded-full bg-[#1a1a2e] px-2 py-0.5 text-[12px] text-white">主艺人</span>}
              <button type="button" onClick={() => setPrimary(item.artistId)} className="text-[12px] text-[#3b82f6]">设为主艺人</button>
              <button type="button" disabled={index === 0} onClick={() => move(item.artistId, -1)} className="text-[12px] text-[#666] disabled:text-[#bbb]">上移</button>
              <button type="button" disabled={index === value.length - 1} onClick={() => move(item.artistId, 1)} className="text-[12px] text-[#666] disabled:text-[#bbb]">下移</button>
              <button type="button" onClick={() => remove(item.artistId)} className="ml-auto text-[12px] text-[#ef4444]">移除</button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <select value={item.roleType || 'performer'} onChange={event => update(item.artistId, { roleType: event.target.value, roleName: ROLE_OPTIONS.find(role => role.value === event.target.value)?.label || item.roleName })} className="h-9 rounded-lg border border-[#ddd] px-2 text-[13px]">
                {ROLE_OPTIONS.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
              <input value={item.roleName || ''} onChange={event => update(item.artistId, { roleName: event.target.value })} className="h-9 rounded-lg border border-[#ddd] px-2 text-[13px]" placeholder="展示角色名" />
              <select value={item.visibility || 'public'} onChange={event => update(item.artistId, { visibility: event.target.value as ActivityArtistVisibility })} className="h-9 rounded-lg border border-[#ddd] px-2 text-[13px]">
                <option value="public">C端公开展示</option>
                <option value="hidden">后台保密嘉宾</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
