'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SafeImage } from '@/components/SafeImage'
import { Modal } from '@/components/ui/Modal'
import { getUserInfo, listPendingAdminArtists, reviewAdminArtist, updateAdminArtistRisk } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'
import { canUseConsoleAction } from '@/lib/console-auth'
import { formatArtistListReviewStatus, isKnownArtistReviewStatus, isReviewableArtistReviewStatus } from '@/lib/console-artists'
import type { ArtistEntity, UserInfo } from '@/types/api'

type ArtistReviewAction = 'approve' | 'reject' | 'risk'

interface ArtistReviewDialog {
  artist: ArtistEntity
  action: ArtistReviewAction
  note: string
}

export default function PendingArtistsPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [items, setItems] = useState<ArtistEntity[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [artistReviewDialog, setArtistReviewDialog] = useState<ArtistReviewDialog | null>(null)
  const [reviewError, setReviewError] = useState('')

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

  const review = (artist: ArtistEntity, action: 'approve' | 'reject') => {
    if (!user) return
    if (!guardReviewableArtist(artist)) return
    setError('')
    setReviewError('')
    setArtistReviewDialog({ artist, action, note: '' })
  }

  const markRisk = (artist: ArtistEntity) => {
    if (!user) return
    if (!guardReviewableArtist(artist)) return
    setError('')
    setReviewError('')
    setArtistReviewDialog({ artist, action: 'risk', note: '' })
  }

  const closeArtistReviewDialog = () => {
    if (savingId) return
    setArtistReviewDialog(null)
    setReviewError('')
  }

  const submitArtistReview = async () => {
    if (!user || !artistReviewDialog) return
    const { artist, action } = artistReviewDialog
    if (!guardReviewableArtist(artist)) {
      closeArtistReviewDialog()
      return
    }
    const note = artistReviewDialog.note.trim()
    if ((action === 'reject' || action === 'risk') && !note) {
      setReviewError(action === 'risk' ? '风险原因不能为空' : '拒绝原因不能为空')
      return
    }
    setSavingId(artist.id)
    setError('')
    setReviewError('')
    try {
      if (action === 'risk') {
        await updateAdminArtistRisk(artist.id, { riskStatus: 'risky', reason: note })
      } else {
        await reviewAdminArtist(artist.id, { action, note: note || null })
      }
      setArtistReviewDialog(null)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '审核失败')
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
      <Modal
        open={Boolean(artistReviewDialog)}
        onClose={closeArtistReviewDialog}
        title={artistReviewDialog?.action === 'approve' ? '通过艺人审核' : artistReviewDialog?.action === 'reject' ? '拒绝艺人审核' : '标记风险艺人'}
        size="md"
        danger={artistReviewDialog?.action !== 'approve'}
        loading={Boolean(savingId)}
        footer={(
          <>
            <button type="button" onClick={closeArtistReviewDialog} disabled={Boolean(savingId)} className="rounded-lg border border-[#e5e5e5] px-4 py-2 text-[14px] text-[#666] disabled:cursor-not-allowed disabled:opacity-60">取消</button>
            <button type="button" onClick={submitArtistReview} disabled={Boolean(savingId)} className={`rounded-lg px-4 py-2 text-[14px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${artistReviewDialog?.action === 'approve' ? 'bg-[#16a34a] hover:bg-[#13813b]' : 'bg-[#f53f3f] hover:bg-[#d92d2d]'}`}>
              {savingId ? '提交中...' : artistReviewDialog?.action === 'approve' ? '确认通过' : artistReviewDialog?.action === 'reject' ? '确认拒绝' : '确认标记风险'}
            </button>
          </>
        )}
      >
        {artistReviewDialog ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-[#fafafa] p-3 text-[13px] text-[#666]">
              {artistReviewDialog.artist.name}{artistReviewDialog.artist.alias ? ` / ${artistReviewDialog.artist.alias}` : ''}
            </div>
            <label className="block text-[13px] font-medium text-[#333]">
              {artistReviewDialog.action === 'approve' ? '审核备注' : artistReviewDialog.action === 'reject' ? '拒绝原因 *' : '风险原因 *'}
              <textarea
                value={artistReviewDialog.note}
                onChange={event => {
                  setArtistReviewDialog({ ...artistReviewDialog, note: event.target.value })
                  if (event.target.value.trim()) setReviewError('')
                }}
                rows={4}
                placeholder={artistReviewDialog.action === 'approve' ? '请输入审核备注（可选）' : artistReviewDialog.action === 'reject' ? '请输入拒绝原因（必填）' : '请输入风险原因（必填）'}
                className={`mt-1 w-full resize-none rounded-xl border p-3 text-[14px] outline-none ${reviewError ? 'border-[#dc2626]' : 'border-[#e5e5e5] focus:border-[#ff1268]'}`}
              />
            </label>
            {reviewError && <div className="text-[13px] text-[#dc2626]">{reviewError}</div>}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
