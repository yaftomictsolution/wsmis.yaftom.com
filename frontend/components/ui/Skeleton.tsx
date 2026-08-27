'use client'

import type { ReactNode } from 'react'

type SkeletonProps = {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={`skeleton-shimmer block rounded-md ${className}`}
    />
  )
}

export function StatCardSkeleton() {
  return (
    <div className="elegant-panel p-6">
      <div className="flex items-start justify-between">
        <div className="w-full max-w-[180px] space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-11 w-11 rounded-lg" />
      </div>
    </div>
  )
}

export function FormSectionSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="elegant-panel p-5">
      <div className="mb-5 flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-64 max-w-[70vw]" />
        </div>
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function PanelSkeleton({ children }: { children?: ReactNode }) {
  return (
    <div className="elegant-panel p-5">
      {children ?? (
        <div className="space-y-3">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3 w-72 max-w-full" />
          <div className="grid gap-3 pt-2 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
