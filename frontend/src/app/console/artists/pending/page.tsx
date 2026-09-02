'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SafeImage } from '@/components/SafeImage'
import { getUserInfo, listPendingAdminArtists, reviewAdminArtist, updateAdminArtistRisk } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'
import { canUseConsoleAction } from '@/lib/console-auth'
import { formatArtistListReviewStatus, isKnownArtistReviewStatus, isReviewableArtistReviewStatus } from '@/lib/console-artists'
import type { ArtistEntity, UserInfo } from '@/types/api'

export default function PendingArtistsPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [items, setItems] = useState<ArtistEntity[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      setItems(await listPendingAdminArtists())
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载待审核艺人失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login?ru=/console/artists/pending')
      return
    }
    let active = true
    ;(async () => {
      try {
        const info = await getUserInfo()
        if (!active) return
        if (!canUseConsoleAction('artist.manage', info.permissionCodes || [])) {
          router.replace('/console')
          return
        }
        setUser(info)
        await loadData()
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : '校验后台权限失败')
      }
    })()
    return () => { active = false }
  }, [router])

  const guardReviewableArtist = (artist: ArtistEntity) => {
    if (isReviewableArtistReviewStatus(artist.reviewStatus)) return true
    setError(isKnownArtistReviewStatus(artist.reviewStatus) ? '当前艺人审核状态不能操作' : '艺人审核状态待核对，请刷新后再操作')
    return false
  }

  const review = async (artist: ArtistEntity, action: 'approve' | 'reject') => {
    if (!user) return
    if (!guardReviewableArtist(artist)) return
    setSavingId(artist.id)
    setError('')
    try {
      await reviewAdminArtist(artist.id, { action, note: note.trim() || null })
      await loadData()
      setNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '审核失败')
    } finally {
      setSavingId(null)
    }
  }

  const markRisk = async (artist: ArtistEntity) => {
    if (!user) return
    if (!guardReviewableArtist(artist)) return
    const reason = note.trim()
    if (!reason) {
      setError('标记风险艺人必须填写备注')
      return
    }
    setSavingId(artist.id)
    setError('')
    try {
      await updateAdminArtistRisk(artist.id, { riskStatus: 'risky', reason })
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '标记风险失败')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-bold text-[#1a1a2e]">艺人档案审核</h1>
        <p className="mt-1 text-[14px] text-[#666]">审核主办方提交的艺人档案，风险艺人会阻止活动上架。</p>
      </div>

      <textarea value={note} onChange={event => setNote(event.target.value)} className="h-20 w-full rounded-xl border border-[#ddd] p-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="审核备注或风险原因" />

      {error && <div className="rounded-xl bg-[#fef2f2] p-3 text-[14px] text-[#dc2626]">{error}</div>}
      {loading ? <div className="text-[14px] text-[#999]">加载中...</div> : items.length === 0 ? <div className="rounded-xl bg-white p-6 text-center text-[#999]">暂无待审核艺人</div> : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="rounded-xl border border-[#eee] bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                  {item.avatar ? (
                    <SafeImage src={item.avatar} alt={item.name} className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#f5f5f5] text-[13px] font-semibold text-[#999]">艺人</div>
                  )}
                  <div className="min-w-0">
                    <div className="text-[16px] font-semibold text-[#1a1a2e]">{item.name}{item.alias ? ` / ${item.alias}` : ''}</div>
                    <div className="mt-1 text-[13px] text-[#666]">{[item.countryOrRegion, item.artistType, item.categoryTags].filter(Boolean).join(' · ') || '暂无身份信息'}</div>
                    <div className="mt-1 text-[13px] text-[#999]">审核状态：{formatArtistListReviewStatus(item.reviewStatus)}</div>
                    {item.representativeWorks && <div className="mt-1 text-[13px] text-[#999]">代表作品：{item.representativeWorks}</div>}
                    {item.description && <div className="mt-2 text-[13px] text-[#555]">{item.description}</div>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/console/artists/${item.id}/edit`} className="rounded-full border border-[#ddd] px-4 py-2 text-[13px] text-[#333] hover:border-[#ff1268] hover:text-[#ff1268]">编辑资料</Link>
                  {isReviewableArtistReviewStatus(item.reviewStatus) ? (
                    <>
                      <button disabled={savingId === item.id} onClick={() => review(item, 'approve')} className="rounded-full bg-[#16a34a] px-4 py-2 text-[13px] text-white disabled:bg-[#86efac]">通过</button>
                      <button disabled={savingId === item.id} onClick={() => review(item, 'reject')} className="rounded-full bg-[#ef4444] px-4 py-2 text-[13px] text-white disabled:bg-[#fca5a5]">拒绝</button>
                      <button disabled={savingId === item.id} onClick={() => markRisk(item)} className="rounded-full border border-[#ef4444] px-4 py-2 text-[13px] text-[#ef4444] disabled:text-[#fca5a5]">标记风险</button>
                    </>
                  ) : (
                    <span className="rounded-full border border-[#ffd591] bg-[#fff7e6] px-4 py-2 text-[13px] text-[#ad6800]">
                      {isKnownArtistReviewStatus(item.reviewStatus) ? '已结束' : '状态待核对'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
