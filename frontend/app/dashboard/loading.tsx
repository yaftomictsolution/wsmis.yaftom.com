export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 p-6 lg:p-8" aria-label="Loading module">
      <div className="h-8 w-56 animate-pulse rounded-md bg-[var(--bg-muted)]" />
      <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-[var(--bg-muted)]" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-24 animate-pulse rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]" />
        ))}
      </div>
      <div className="space-y-3 border-t border-[var(--border-subtle)] pt-6">
        {[0, 1, 2, 3, 4].map((item) => (
          <div key={item} className="h-12 animate-pulse rounded-md bg-[var(--bg-muted)]" />
        ))}
      </div>
    </div>
  )
}
