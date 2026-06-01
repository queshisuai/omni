function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-200/80 ${className}`} />
}

export function SearchResultsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-gray-100 bg-white p-3">
          <SkeletonBlock className="aspect-[3/4] w-full" />
          <SkeletonBlock className="mt-3 h-4 w-5/6" />
          <SkeletonBlock className="mt-2 h-4 w-2/3" />
          <SkeletonBlock className="mt-3 h-5 w-20" />
        </div>
      ))}
    </div>
  )
}

export function TicketWalletSkeleton() {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-lg border border-[#eee] bg-white p-4">
          <div className="grid gap-4 md:grid-cols-[88px_1fr_156px]">
            <SkeletonBlock className="h-[118px] w-[88px]" />
            <div>
              <SkeletonBlock className="h-6 w-32" />
              <SkeletonBlock className="mt-3 h-5 w-3/4" />
              <SkeletonBlock className="mt-3 h-4 w-5/6" />
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <SkeletonBlock className="h-9" />
                <SkeletonBlock className="h-9" />
              </div>
            </div>
            <div className="space-y-2">
              <SkeletonBlock className="h-10 w-full" />
              <SkeletonBlock className="h-10 w-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function ConsoleTableSkeleton({ rows = 6, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
        <SkeletonBlock className="h-4 w-40" />
      </div>
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="grid gap-4 px-4 py-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {Array.from({ length: columns }).map((__, columnIndex) => (
              <SkeletonBlock key={columnIndex} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function ConsoleDashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <SkeletonBlock className="h-7 w-56" />
        <SkeletonBlock className="mt-3 h-4 w-80" />
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-gray-200 bg-white p-6">
            <SkeletonBlock className="h-5 w-28" />
            <SkeletonBlock className="mt-6 h-9 w-20" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-gray-200 bg-white p-5">
            <SkeletonBlock className="h-5 w-36" />
            <SkeletonBlock className="mt-5 h-3 w-full" />
            <SkeletonBlock className="mt-3 h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  )
}

