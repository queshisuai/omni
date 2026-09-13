import type { ReactNode } from 'react'
import { ConsoleTableSkeleton } from '@/components/Skeleton'

export const CONSOLE_TABLE_HEADER_CLASS = 'bg-gray-50 text-gray-500 font-semibold border-b border-gray-200'

interface ConsoleTableProps {
  children: ReactNode
  footer?: ReactNode
  loading?: boolean
  skeletonRows?: number
  skeletonColumns?: number
  className?: string
}

export function ConsoleTable({
  children,
  footer,
  loading = false,
  skeletonRows = 6,
  skeletonColumns = 6,
  className = '',
}: ConsoleTableProps) {
  return (
    <div className={`w-full rounded-xl border border-gray-200 bg-white overflow-hidden ${className}`}>
      {loading ? (
        <ConsoleTableSkeleton rows={skeletonRows} columns={skeletonColumns} bare />
      ) : (
        <div className="w-full overflow-x-auto">{children}</div>
      )}
      {footer ? <div className="border-t border-gray-200 px-4 pb-4">{footer}</div> : null}
    </div>
  )
}
