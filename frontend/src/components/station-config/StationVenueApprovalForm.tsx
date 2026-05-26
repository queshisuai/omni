'use client'

import { useMemo } from 'react'
import { PrivateFileUpload } from '@/components/PrivateFileUpload'
import type { PrivateAssetVO, VenueEntity } from '@/types/api'

export type StationVenueMode = 'tba' | 'existing' | 'new'

export type StationVenueApprovalValue = {
  city: string
  stationName: string
  mode: StationVenueMode
  venueId: number | null
  venueName: string
  venueAddress: string
  capacity: string
  contactName: string
  contactPhone: string
  qualificationNo: string
  businessScope: string
  description: string
  validFrom: string
  validTo: string
  proofNote: string
  proofAsset: PrivateAssetVO | null
  startTime: string
  endTime: string
}

type Props = {
  value: StationVenueApprovalValue
  venues: VenueEntity[]
  submitting?: boolean
  uploading?: boolean
  cityLocked?: boolean
  onUploadProof: (file: File) => Promise<PrivateAssetVO>
  onChange: (value: StationVenueApprovalValue) => void
}

export function createEmptyStationVenueApprovalValue(city = ''): StationVenueApprovalValue {
  return {
    city,
    stationName: '',
    mode: 'tba',
    venueId: null,
    venueName: '',
    venueAddress: '',
    capacity: '',
    contactName: '',
    contactPhone: '',
    qualificationNo: '',
    businessScope: '',
    description: '',
    validFrom: '',
    validTo: '',
    proofNote: '',
    proofAsset: null,
    startTime: '',
    endTime: '',
  }
}

export function validateStationVenueApproval(value: StationVenueApprovalValue) {
  if (!value.city.trim()) return '请填写城市'
  if (value.mode === 'tba') return ''
  if (value.mode === 'existing' && !value.venueId) return '请选择已审核场馆记录'
  if (!value.venueName.trim()) return '请填写场馆名称'
  if (!value.venueAddress.trim()) return '请填写场馆地址'
  if (!value.contactName.trim()) return '请填写审批资料联系人'
  if (!value.contactPhone.trim()) return '请填写审批资料联系电话'
  if (!value.validFrom) return '请选择场地使用开始时间'
  if (!value.validTo) return '请选择场地使用结束时间'
  if (value.validTo <= value.validFrom) return '场地使用结束时间必须晚于开始时间'
  if (!value.proofNote.trim() && !value.proofAsset) return '请填写场馆审批文件说明或上传审核附件'
  return ''
}

export function StationVenueApprovalForm({ value, venues, submitting, uploading, cityLocked, onUploadProof, onChange }: Props) {
  const selectedVenue = useMemo(() => venues.find(venue => venue.id === value.venueId), [venues, value.venueId])
  const selectableVenues = useMemo(() => {
    if (!cityLocked || !value.city.trim()) return venues
    return venues.filter(venue => venue.city === value.city.trim())
  }, [cityLocked, value.city, venues])
  const patch = (updates: Partial<StationVenueApprovalValue>) => onChange({ ...value, ...updates })

  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-4">
      <div className="mb-3 text-[14px] font-semibold text-[#1a1a2e]">站点配置</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[12px] text-[#666]">
          城市 *
          <input value={value.city} disabled={cityLocked} onChange={event => patch({ city: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268] disabled:bg-[#f5f5f5] disabled:text-[#999]" />
        </label>
        <label className="block text-[12px] text-[#666]">
          站点名
          <input value={value.stationName} onChange={event => patch({ stationName: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="留空默认城市 + 站" />
        </label>
      </div>

      <div className="mt-4 grid gap-2 text-[13px] text-[#333] sm:grid-cols-3">
        {(['tba', 'existing', 'new'] as const).map(mode => (
          <label key={mode} className="flex cursor-pointer items-start gap-2 rounded-lg border border-[#e5e5e5] bg-white p-3">
            <input type="radio" checked={value.mode === mode} onChange={() => patch({ mode })} className="mt-0.5 accent-[#ff1268]" />
          <span>{mode === 'tba' ? '场馆待定' : mode === 'existing' ? '选择已有场馆' : '填写新场馆'}</span>
          </label>
        ))}
      </div>

      {value.mode === 'existing' && (
        <label className="mt-3 block text-[12px] text-[#666]">
          已审核场馆记录 *
          <select value={value.venueId ?? ''} onChange={event => {
            const venueId = event.target.value ? Number(event.target.value) : null
            const venue = venues.find(item => item.id === venueId)
            patch({ venueId, venueName: venue?.name || '', venueAddress: venue?.address || '', city: cityLocked ? value.city : venue?.city || value.city })
          }} className="mt-1 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]">
            <option value="">请选择已审核场馆记录</option>
            {selectableVenues.map(venue => <option key={venue.id} value={venue.id}>{venue.name} ({venue.city})</option>)}
          </select>
          {selectedVenue && <span className="mt-1 block text-[12px] text-[#999]">选择已有场馆记录仍需提交本次活动审批资料。</span>}
        </label>
      )}

      {value.mode !== 'tba' && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input value={value.venueName} onChange={event => patch({ venueName: event.target.value })} className="h-10 rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="场馆名称 *" />
          <input value={value.venueAddress} onChange={event => patch({ venueAddress: event.target.value })} className="h-10 rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="场馆地址 *" />
          <input type="number" value={value.capacity} onChange={event => patch({ capacity: event.target.value })} className="h-10 rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="容量" />
          <input value={value.qualificationNo} onChange={event => patch({ qualificationNo: event.target.value })} className="h-10 rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="资质编号" />
          <input value={value.contactName} onChange={event => patch({ contactName: event.target.value })} className="h-10 rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="联系人 *" />
          <input value={value.contactPhone} onChange={event => patch({ contactPhone: event.target.value })} className="h-10 rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="联系电话 *" />
          <label className="text-[12px] text-[#666]">
            使用开始时间 *
            <input type="datetime-local" value={value.validFrom} onChange={event => patch({ validFrom: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" />
          </label>
          <label className="text-[12px] text-[#666]">
            使用结束时间 *
            <input type="datetime-local" value={value.validTo} onChange={event => patch({ validTo: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" />
          </label>
          <textarea value={value.businessScope} onChange={event => patch({ businessScope: event.target.value })} rows={2} className="rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268] sm:col-span-2" placeholder="经营范围" />
          <textarea value={value.description} onChange={event => patch({ description: event.target.value })} rows={2} className="rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268] sm:col-span-2" placeholder="资料说明/备注" />
          <textarea value={value.proofNote} onChange={event => patch({ proofNote: event.target.value })} rows={3} className="rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268] sm:col-span-2" placeholder="场馆审批文件说明（与附件至少填一项）" />
          <div className="sm:col-span-2">
            <PrivateFileUpload label="场馆审核资料附件" value={value.proofAsset} accept="application/pdf,image/jpeg,image/png,image/webp" uploading={Boolean(uploading || submitting)} onUpload={onUploadProof} onChange={asset => patch({ proofAsset: asset })} hint="选择已有场馆记录也必须上传或填写本次活动审批资料。" />
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-[12px] text-[#666]">
          开始时间
          <input type="datetime-local" value={value.startTime} onChange={event => patch({ startTime: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" />
        </label>
        <label className="block text-[12px] text-[#666]">
          结束时间
          <input type="datetime-local" value={value.endTime} onChange={event => patch({ endTime: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" />
        </label>
      </div>
    </div>
  )
}
