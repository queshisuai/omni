import type { Activity } from '@/types/omni'

export function toActivitySaleStatus(status: number | null | undefined): Activity['status'] {
  if (status === 1) return 'on_sale'
  if (status === 2) return 'coming_soon'
  if (status === 0) return 'sold_out'
  return 'status_syncing'
}
