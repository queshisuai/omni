'use client'

import { useEffect, useState } from 'react'
import { getToken, getUser } from '@/lib/auth'
import {
  approveVenueApplication,
  listVenueApplications,
  privateAssetDownloadUrl,
  rejectVenueApplication,
} from '@/lib/api'
import { DEFAULT_PAGE_SIZE, GlobalPagination } from '@/components/Pagination'
import { CONSOLE_TABLE_HEADER_CLASS, ConsoleTable } from '@/components/ConsoleTable'
import { SafeImage } from '@/components/SafeImage'
import { Drawer } from '@/components/ui/Drawer'
import { Modal } from '@/components/ui/Modal'
import type {
  VenueApplicationCapacityScale,
  VenueApplicationMaterialVO,
  VenueApplicationReviewStatus,
  VenueApplicationVO,
} from '@/types/api'

type VenueTab = VenueApplicationReviewStatus

const cities = ['全部城市', '北京', '上海', '深圳', '广州', '成都', '杭州']
const scaleOptions: Array<{ value: VenueApplicationCapacityScale | ''; label: string }> = [
  { value: '', label: '全部容量规模' },
  { value: 'EXTRA_LARGE', label: '超大型体育场（≥ 30,000人）' },
  { value: 'LARGE', label: '万人大型体育馆（10,000 - 29,999人）' },
  { value: 'MEDIUM', label: '中型演艺中心/剧场（3,000 - 9,999人）' },
  { value: 'SMALL', label: '小型剧场/Livehouse（< 3,000人）' },
]
const completenessOptions = [
  { value: '', label: '全部资质完整度' },
  { value: 'COMPLETE', label: '证照齐全' },
  { value: 'MISSING_FIRE', label: '缺少消防合格证' },
  { value: 'MISSING_LEASE', label: '缺少场地租赁协议' },
  { value: 'LEGACY_GENERAL_PROOF', label: '包含通用证明（历史数据）' },
]

function statusLabel(status: number) {
  return status === 0 ? '待审核' : status === 1 ? '已通过' : status === 2 ? '已驳回' : '状态待核对'
}

function scaleLabel(scale?: string | null) {
  return scale === 'EXTRA_LARGE' ? '超大型体育场'
    : scale === 'LARGE' ? '万人大型体育馆'
      : scale === 'MEDIUM' ? '中型演艺中心/剧场'
        : scale === 'SMALL' ? '小型剧场/Livehouse' : '规模待补充'
}

function completenessLabel(value?: string | null) {
  return value === 'COMPLETE' ? '证照齐全'
    : value === 'LEGACY_GENERAL_PROOF' ? '包含通用证明（历史数据）'
      : value === 'MISSING_FIRE' ? '缺少消防合格证'
        : value === 'MISSING_LEASE' ? '缺少场地租赁协议' : '资质待核验'
}

function formatSize(size?: number | null) {
  if (size == null) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function materialFor(item: VenueApplicationVO, type: string) {
  return item.materials?.find(material => material.materialType === type) || null
}

function MaterialPreview({ material, onOpen }: { material: VenueApplicationMaterialVO; onOpen: (src: string) => void }) {
  const asset = material.asset
  const [src, setSrc] = useState('')
  const isImage = Boolean(asset?.contentType?.startsWith('image/'))

  useEffect(() => {
    if (!asset?.id || !isImage) return
    const token = getToken()
    if (!token) return
    let objectUrl = ''
    let active = true
    fetch(privateAssetDownloadUrl(asset.id), { headers: { Authorization: `Bearer ${token}` } })
      .then(response => response.ok ? response.blob() : Promise.reject(new Error('附件读取失败')))
      .then(blob => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
      })
      .catch(() => setSrc(''))
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [asset?.id, isImage])

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#f0f0f0] p-3">
      {isImage && src ? (
        <button type="button" onClick={() => onOpen(src)} className="h-16 w-20 overflow-hidden rounded border border-[#e5e5e5]">
          <SafeImage src={src} alt={material.label} className="h-full w-full object-cover" />
        </button>
      ) : (
        <div className="flex h-16 w-20 items-center justify-center rounded bg-[#f7f7f7] text-[12px] text-[#999]">
          {asset?.contentType === 'application/pdf' ? 'PDF' : '附件'}
        </div>
      )}
      <div className="min-w-0 flex-1 text-[13px] text-[#666]">
        <div className="font-medium text-[#333]">{material.label}</div>
        <div className="truncate">{asset?.originalFilename || material.note || '未提供文件名'}</div>
        <div className="mt-1 text-[12px] text-[#999]">
          {formatSize(asset?.fileSize)} · {material.validFrom || '未填写'} 至 {material.validTo || '未填写'}
        </div>
      </div>
    </div>
  )
}

export default function VenueApplicationsPage() {
  const [userId, setUserId] = useState(0)
  const [tab, setTab] = useState<VenueTab>('PENDING')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [applications, setApplications] = useState<VenueApplicationVO[]>([])
  const [filters, setFilters] = useState({ keyword: '', city: '', capacityScale: '', materialCompleteness: '' })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [drawerItem, setDrawerItem] = useState<VenueApplicationVO | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [drawerError, setDrawerError] = useState('')
  const [saving, setSaving] = useState(false)
  const [previewSrc, setPreviewSrc] = useState('')

  const loadData = async () => {
    if (!userId) return
    setLoading(true)
    setLoadError('')
    try {
      const [result, pending] = await Promise.all([
        listVenueApplications({
          page,
          size: DEFAULT_PAGE_SIZE,
          status: tab,
          keyword: filters.keyword,
          city: filters.city,
          capacityScale: filters.capacityScale as VenueApplicationCapacityScale,
          materialCompleteness: filters.materialCompleteness,
        }),
        listVenueApplications({ page: 1, size: 1, status: 'PENDING' }),
      ])
      setApplications(result.records)
      setTotal(result.total)
      setPendingCount(pending.total)
    } catch (error) {
      setLoadError(getErrorMessage(error, '加载场馆资料审核失败'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const user = getUser()
    if (user) setUserId(user.userId)
  }, [])

  useEffect(() => {
    loadData()
  }, [userId, page, tab, filters.keyword, filters.city, filters.capacityScale, filters.materialCompleteness])

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setPage(1)
    setFilters(current => ({ ...current, [key]: value }))
  }

  const openDrawer = (item: VenueApplicationVO) => {
    setDrawerItem(item)
    setReviewNote('')
    setDrawerError('')
  }

  const closeDrawer = () => {
    if (saving) return
    setDrawerItem(null)
    setDrawerError('')
  }

  const handleApprove = async () => {
    if (!drawerItem) return
    setSaving(true)
    setDrawerError('')
    try {
      await approveVenueApplication(drawerItem.id, reviewNote)
      setDrawerItem(null)
      await loadData()
    } catch (error) {
      setDrawerError(getErrorMessage(error, '审核通过失败，请稍后重试'))
    } finally {
      setSaving(false)
    }
  }

  const handleReject = async () => {
    if (!drawerItem) return
    if (!reviewNote.trim()) {
      setDrawerError('驳回必须填写整改原因')
      return
    }
    setSaving(true)
    setDrawerError('')
    try {
      await rejectVenueApplication(drawerItem.id, reviewNote)
      setDrawerItem(null)
      await loadData()
    } catch (error) {
      setDrawerError(getErrorMessage(error, '驳回申请失败，请稍后重试'))
    } finally {
      setSaving(false)
    }
  }

  const renderStatusTab = (value: VenueTab, label: string) => (
    <button type="button" onClick={() => { setTab(value); setPage(1) }} className={`border-b-2 px-1 pb-3 text-[14px] font-medium ${tab === value ? 'border-[#ff1268] text-[#ff1268]' : 'border-transparent text-[#777]'}`}>
      {label}{value === 'PENDING' ? ` ${pendingCount} 待办` : ''}
    </button>
  )

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#1a1a2e]">场馆资料审核</h1>
          <p className="mt-1 text-[13px] text-[#999]">按城市、容量和资质完整度核验场馆申请，审核通过后纳入公共场馆库。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input value={filters.keyword} onChange={event => updateFilter('keyword', event.target.value)} placeholder="搜索名称、编号、地址、联系人" className="h-9 w-64 rounded-lg border border-[#e5e5e5] px-3 text-[13px] outline-none focus:border-[#ff1268]" />
          <select value={filters.capacityScale} onChange={event => updateFilter('capacityScale', event.target.value)} className="h-9 rounded-lg border border-[#e5e5e5] px-3 text-[13px] outline-none focus:border-[#ff1268]">
            {scaleOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={filters.materialCompleteness} onChange={event => updateFilter('materialCompleteness', event.target.value)} className="h-9 rounded-lg border border-[#e5e5e5] px-3 text-[13px] outline-none focus:border-[#ff1268]">
            {completenessOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-5 border-b border-[#e5e5e5]">
        {renderStatusTab('PENDING', '待审核申请')}
        {renderStatusTab('APPROVED', '已入库场馆档案')}
        {renderStatusTab('REJECTED', '已驳回记录')}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-[13px]">
        {cities.map(city => (
          <button key={city} type="button" onClick={() => updateFilter('city', city === '全部城市' ? '' : city)} className={`rounded-full px-3 py-1.5 ${filters.city === (city === '全部城市' ? '' : city) ? 'bg-[#ff1268] text-white' : 'bg-[#f5f5f5] text-[#666]'}`}>
            {city}
          </button>
        ))}
      </div>

      {loadError ? <div className="rounded-xl border border-[#ffd9e6] bg-white py-16 text-center text-[14px] text-[#ef4444]">{loadError}</div> : (
        <ConsoleTable
          loading={loading}
          skeletonRows={6}
          skeletonColumns={7}
          footer={<GlobalPagination page={page} total={total} loading={loading} onChange={setPage} />}
        >
            <table className="w-full table-fixed text-left text-[13px]">
            <thead className={CONSOLE_TABLE_HEADER_CLASS}>
              <tr>
                <th className="px-4 py-3">场馆信息 / 资质编号</th>
                <th className="px-4 py-3">所属城市与详细地址</th>
                <th className="w-32 whitespace-nowrap px-4 py-3">核定容量与规模梯队</th>
                <th className="w-36 whitespace-nowrap px-4 py-3">提报经办人 / 电话</th>
                <th className="px-4 py-3">资质审批附件状态</th>
                <th className="w-24 whitespace-nowrap px-4 py-3 text-center">审核状态</th>
                <th className="w-28 whitespace-nowrap py-3 pr-4 pl-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {loading ? <tr><td colSpan={7} className="px-4 py-16 text-center text-[#999]">加载中...</td></tr> : applications.length === 0 ? <tr><td colSpan={7} className="px-4 py-16 text-center text-[#999]">暂无场馆审核资料</td></tr> : applications.map(item => {
                const fire = materialFor(item, 'FIRE_SAFETY_PERMIT')
                const lease = materialFor(item, 'VENUE_LEASE_AGREEMENT')
                return (
                  <tr key={item.id} onClick={() => openDrawer(item)} className="cursor-pointer hover:bg-[#fff8fb]">
                    <td className="px-4 py-3 align-top">
                      <div className="truncate font-medium text-[#333]" title={item.venueName}>{item.venueName}</div>
                      <div className="mt-1 text-[12px] text-[#999]">{item.venueType || '综合演艺场馆'} · {item.qualificationNo || '未填写资质编号'}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="text-[#333]">{item.city}{item.district ? ` · ${item.district}` : ''}</div>
                      <div className="mt-1 truncate text-[#999]" title={item.address}>{item.address || '未填写地址'}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="text-[#333]">{item.capacity == null ? '-' : `${item.capacity.toLocaleString()} 座位`}</div>
                      <span className="mt-1 inline-block rounded bg-[#f5f5f5] px-2 py-0.5 text-[12px] text-[#666]">{scaleLabel(item.capacityScale)}</span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="text-[#333]">{item.contactName || '-'}</div>
                      <div className="mt-1 text-[#999]">{item.contactPhone || '-'}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-1.5">
                        <span className={`rounded px-2 py-0.5 text-[12px] ${fire ? 'bg-[#ecfdf3] text-[#16803c]' : 'bg-[#fff7e6] text-[#ad6800]'}`}>消防证明 {fire ? '已上传' : '待补充'}</span>
                        <span className={`rounded px-2 py-0.5 text-[12px] ${lease ? 'bg-[#ecfdf3] text-[#16803c]' : 'bg-[#fff7e6] text-[#ad6800]'}`}>租赁协议 {lease ? '已上传' : '待补充'}</span>
                      </div>
                      <div className="mt-1 text-[12px] text-[#999]">{completenessLabel(item.materialCompleteness)}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-center">
                      <span className={`rounded-full px-2 py-1 text-[12px] ${item.status === 0 ? 'bg-[#fff7e6] text-[#ad6800]' : item.status === 1 ? 'bg-[#ecfdf3] text-[#16803c]' : 'bg-[#fff1f2] text-[#d4383b]'}`}>{statusLabel(item.status)}</span>
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <button type="button" onClick={event => { event.stopPropagation(); openDrawer(item) }} className={`rounded-lg px-3 py-1.5 text-[12px] font-medium ${item.status === 0 ? 'bg-[#ff1268] text-white' : 'border border-[#e5e5e5] text-[#666]'}`}>
                        {item.status === 0 ? '审核凭证' : '查看档案'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            </table>
        </ConsoleTable>
      )}

      <Drawer
        open={Boolean(drawerItem)}
        onClose={closeDrawer}
        title="场馆资质核验"
        width="w-[640px]"
        loading={saving}
        footer={drawerItem?.status === 0 ? (
          <div className="flex justify-end gap-2">
            <button type="button" disabled={saving} onClick={handleReject} className="rounded-lg bg-[#ef4444] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50">驳回申请</button>
            <button type="button" disabled={saving} onClick={handleApprove} className="rounded-lg bg-[#22c55e] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50">审核通过并纳入场馆库</button>
          </div>
        ) : null}
      >
        {drawerItem && (
          <div className="space-y-5">
            <section>
              <h3 className="mb-2 text-[14px] font-semibold text-[#333]">基本物理信息</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-[#fafafa] p-3 text-[13px] text-[#666]">
                <div>中文名称：{drawerItem.venueName}</div>
                <div>英文名称：{drawerItem.venueNameEn || '未填写'}</div>
                <div>场馆类型：{drawerItem.venueType || '综合演艺场馆'}</div>
                <div>核定容量：{drawerItem.capacity == null ? '-' : `${drawerItem.capacity.toLocaleString()} 人`}</div>
                <div>所属地区：{drawerItem.province || drawerItem.city} · {drawerItem.district || '区县未填写'}</div>
                <div>经办人：{drawerItem.contactName} / {drawerItem.contactPhone}</div>
                <div className="col-span-2">详细地址：{drawerItem.address || '未填写'}</div>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-[14px] font-semibold text-[#333]">重点合规资质证件</h3>
              <div className="space-y-2">
                {drawerItem.materials?.length ? drawerItem.materials.map(material => <MaterialPreview key={`${material.materialType}-${material.id || material.assetId}`} material={material} onOpen={setPreviewSrc} />) : <div className="text-[13px] text-[#999]">暂无结构化材料</div>}
                {drawerItem.legacyProof && <div className="rounded-lg border border-[#f0f0f0] bg-[#fafafa] p-3 text-[13px] text-[#666]">{drawerItem.legacyProof.label}<div className="mt-1">{drawerItem.legacyProof.note || drawerItem.proofFileUrl || '历史材料未提供说明'}</div></div>}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-[14px] font-semibold text-[#333]">经营范围与提报说明</h3>
              <div className="space-y-2 rounded-lg border border-[#f0f0f0] p-3 text-[13px] leading-6 text-[#666]">
                <div>经营范围：{drawerItem.businessScope || '未填写'}</div>
                <div>提报说明：{drawerItem.description || '未填写'}</div>
              </div>
            </section>

            {drawerItem.status === 0 && (
              <section>
                <h3 className="mb-2 text-[14px] font-semibold text-[#333]">审核控制台</h3>
                <textarea value={reviewNote} onChange={event => { setReviewNote(event.target.value); if (event.target.value.trim()) setDrawerError('') }} rows={5} placeholder="填写审批意见；驳回时必须填写整改原因" className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-[13px] outline-none focus:border-[#ff1268]" />
                {drawerError && <div className="mt-2 text-[13px] text-[#ef4444]">{drawerError}</div>}
              </section>
            )}
            {drawerItem.status !== 0 && drawerItem.reviewNote && <div className="text-[13px] text-[#999]">审核备注：{drawerItem.reviewNote}</div>}
          </div>
        )}
      </Drawer>

      <Modal open={Boolean(previewSrc)} onClose={() => setPreviewSrc('')} title="材料预览" size="lg">
        <div className="flex min-h-[360px] items-center justify-center bg-[#fafafa] p-4">
          <SafeImage src={previewSrc} alt="资质材料预览" className="max-h-[70vh] max-w-full object-contain" />
        </div>
      </Modal>
    </div>
  )
}
