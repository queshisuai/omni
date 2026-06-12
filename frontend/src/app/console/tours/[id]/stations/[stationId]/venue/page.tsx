'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { getUser } from '@/lib/auth'
import {
  approveStationConfigVersion,
  createStationConfigVersion,
  getAdminTourDetail,
  listAdminVenues,
  submitStationConfigVersion,
  submitVenueApplication,
  uploadPrivateAsset,
} from '@/lib/api'
import { canUseConsoleAction } from '@/lib/console-auth'
import {
  StationVenueApprovalForm,
  createEmptyStationVenueApprovalValue,
  validateStationVenueApproval,
  type StationVenueApprovalValue,
} from '@/components/station-config/StationVenueApprovalForm'
import type { PrivateAssetVO, StationEntity, VenueEntity } from '@/types/api'

export default function AddStationVenuePage() {
  const params = useParams<{ id: string; stationId: string }>()
  const router = useRouter()
  const tourId = Number(params.id)
  const stationId = Number(params.stationId)
  const [userId, setUserId] = useState(0)
  const [permissionCodes, setPermissionCodes] = useState<string[]>([])
  const [station, setStation] = useState<StationEntity | null>(null)
  const [venues, setVenues] = useState<VenueEntity[]>([])
  const [value, setValue] = useState<StationVenueApprovalValue>(() => ({
    ...createEmptyStationVenueApprovalValue(),
    mode: 'new',
  }))
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingProof, setUploadingProof] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const user = getUser()
    if (!user) {
      setError('请先登录后再添加场馆')
      setLoading(false)
      return
    }
    if (!Number.isInteger(tourId) || tourId <= 0 || !Number.isInteger(stationId) || stationId <= 0) {
      setError('巡演或站点编号不正确')
      setLoading(false)
      return
    }
    setUserId(user.userId)
    setPermissionCodes(user.permissionCodes || [])
    Promise.all([getAdminTourDetail(user.userId, tourId), listAdminVenues(user.userId)])
      .then(([detail, venueList]) => {
        const matched = detail.stations.find(item => item.id === stationId) || null
        if (!matched) {
          setError('站点不存在或无权限访问')
          return
        }
        setStation(matched)
        setVenues(venueList)
        setValue({
          ...createEmptyStationVenueApprovalValue(matched.city || ''),
          stationName: matched.stationName || (matched.city ? `${matched.city}站` : ''),
          mode: 'new',
        })
      })
      .catch(err => setError(err instanceof Error ? err.message : '加载站点失败'))
      .finally(() => setLoading(false))
  }, [tourId, stationId])

  const handleProofUpload = async (file: File): Promise<PrivateAssetVO> => {
    if (!userId) throw new Error('请先登录')
    setUploadingProof(true)
    try {
      return await uploadPrivateAsset({ userId, bizType: 'venue-proof', file })
    } finally {
      setUploadingProof(false)
    }
  }

  const handleSubmit = async () => {
    if (!station || !userId) return
    if (value.mode === 'tba') {
      setError('添加场馆时请选择已有场馆或填写新场馆')
      return
    }
    const validationError = validateStationVenueApproval(value)
    if (validationError) {
      setError(validationError)
      return
    }
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      const application = await submitVenueApplication({
        venueId: value.mode === 'existing' ? value.venueId : null,
        venueName: value.venueName.trim(),
        city: value.city.trim(),
        address: value.venueAddress.trim(),
        capacity: value.capacity ? Number(value.capacity) : null,
        contactName: value.contactName.trim(),
        contactPhone: value.contactPhone.trim(),
        qualificationNo: value.qualificationNo.trim() || null,
        businessScope: value.businessScope.trim() || null,
        description: value.description.trim() || null,
        validFrom: value.validFrom,
        validTo: value.validTo,
        proofNote: value.proofNote.trim() || null,
        proofAssetId: value.proofAsset?.id ?? null,
        layoutSnapshot: '{}',
      })
      const version = await createStationConfigVersion(station.id, {
        userId,
        changeType: station.venueApplicationId ? 'change_venue' : 'set_venue',
        city: value.city.trim(),
        stationName: value.stationName.trim() || `${value.city.trim()}站`,
        venueId: value.mode === 'existing' ? value.venueId : null,
        venueApplicationId: application.id,
        venueName: value.venueName.trim(),
        venueAddress: value.venueAddress.trim(),
        startTime: value.startTime || null,
        endTime: value.endTime || null,
        scheduleTba: !value.startTime,
        reason: '巡演城市站添加场馆',
      })
      await submitStationConfigVersion(version.id)
      if (canUseConsoleAction('station.review', permissionCodes)) {
        await approveStationConfigVersion(version.id, { reviewNote: '管理员直接添加场馆' })
        setMessage('场馆已添加并应用到该城市站。')
      } else {
        setMessage('场馆审核资料已提交，等待平台核验。审核通过后可继续配置场次和票档。')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交场馆审核资料失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="py-20 text-center text-[14px] text-[#999]">加载中...</div>
  }

  if (error && !station) {
    return (
      <div className="rounded-xl border border-[#ffd9e6] bg-white p-6 text-[14px] text-[#666]">
        <div className="text-[#ff4d4f]">{error}</div>
        <Link href={`/console/tours/${tourId}`} className="mt-4 inline-block rounded-lg border border-[#e5e5e5] px-4 py-2 text-[14px] text-[#666]">返回巡演详情</Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href={`/console/tours/${tourId}`} className="mb-2 inline-flex text-[13px] text-[#666] hover:text-[#ff1268]">返回巡演详情</Link>
          <h1 className="text-[22px] font-bold text-[#1a1a2e]">添加场馆</h1>
          <p className="mt-1 text-[13px] text-[#999]">为 {station?.city || '当前城市'} 站上传场馆审核文件。平台核验资料真伪，不代表拥有场馆或授予场地使用权。</p>
        </div>
      </div>

      <div className="max-w-[920px] rounded-xl border border-[#e5e5e5] bg-white p-5">
        <StationVenueApprovalForm
          value={value}
          venues={venues}
          submitting={submitting}
          uploading={uploadingProof}
          cityLocked
          onUploadProof={handleProofUpload}
          onChange={next => setValue({ ...next, city: station?.city || next.city })}
        />

        {error && <div className="mt-4 rounded-lg bg-[#fff0f3] px-3 py-2 text-[13px] text-[#ff1268]">{error}</div>}
        {message && <div className="mt-4 rounded-lg bg-[#f0fff4] px-3 py-2 text-[13px] text-[#16a34a]">{message}</div>}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => router.push(`/console/tours/${tourId}`)} className="rounded-lg border border-[#e5e5e5] px-4 py-2 text-[14px] text-[#666]">返回</button>
          <button type="button" onClick={handleSubmit} disabled={submitting || uploadingProof} className="rounded-lg bg-[#ff1268] px-5 py-2 text-[14px] font-medium text-white disabled:opacity-50">
            {uploadingProof ? '附件上传中...' : submitting ? '提交中...' : '提交场馆审核资料'}
          </button>
        </div>
      </div>
    </div>
  )
}
