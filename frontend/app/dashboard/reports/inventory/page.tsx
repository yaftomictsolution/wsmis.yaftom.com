'use client'

import { useMemo, useState } from 'react'
import { Package, TrendingUp, AlertTriangle, Download } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatsCard } from '@/components/StatsCard'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { useGetOperationalReportQuery } from '@/src/store/waternetApi'
import { downloadCsv, reportRange, type ReportRangePreset } from '@/lib/reporting'

export default function InventoryReportsPage() {
  const [dateRange, setDateRange] = useState('last6months')
  const range = useMemo(() => reportRange(dateRange as ReportRangePreset), [dateRange])
  const { data } = useGetOperationalReportQuery(
    { type: 'inventory', ...range },
    { refetchOnMountOrArgChange: true },
  )
  const report = data?.inventory
  const totals = report?.totals
  const categoryDistribution = (report?.category_distribution ?? []).map((item, index) => ({
    name: item.name,
    value: item.quantity,
    color: ['#0284c7', '#0d9488', '#c58b14', '#dc5f4a', '#6366f1'][index % 5],
  }))
  const stockLevelData = (report?.stock_levels ?? []).slice(0, 10).map((item) => ({
    name: item.name,
    stock: item.quantity,
    reorder: item.reorder_level,
  }))

  return (
    <div className="relative mx-auto min-h-full max-w-[1600px] space-y-6 p-4 lg:p-8">
      <PageHeader title="Inventory Reports" subtitle="Stock levels, purchase history, sales history, and low stock alerts" />

      <div className="flex flex-wrap items-center gap-3">
        <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="field-control h-10 px-3 text-sm">
          <option value="last3months">Last 3 Months</option>
          <option value="last6months">Last 6 Months</option>
          <option value="lastyear">Last Year</option>
        </select>
        <button
          type="button"
          onClick={() => downloadCsv(`inventory-report-${range.from}-${range.to}.csv`, report?.stock_levels ?? [])}
          disabled={!report?.stock_levels.length}
          className="btn-secondary h-10 px-4 text-sm flex items-center gap-2"
        >
          <Download className="h-4 w-4" /> Export
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Total Items" value={totals?.items ?? 0} icon={<Package className="h-5 w-5 text-[var(--accent)]" />} />
        <StatsCard title="Stock Value" value={`AFN ${Number(totals?.stock_value ?? 0).toLocaleString()}`} icon={<TrendingUp className="h-5 w-5 text-[var(--mint)]" />} />
        <StatsCard title="Low Stock Items" value={totals?.low_stock_items ?? 0} icon={<AlertTriangle className="h-5 w-5 text-[var(--coral)]" />} />
        <StatsCard title="Issued in Period" value={Number(totals?.issued_quantity ?? 0).toLocaleString()} icon={<Package className="h-5 w-5 text-[var(--gold)]" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Stock Levels vs Reorder Point</h3>
          {stockLevelData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stockLevelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                <Bar dataKey="stock" name="Current Stock" fill="#0d9488" radius={[0, 4, 4, 0]} />
                <Bar dataKey="reorder" name="Reorder Level" fill="#dc5f4a" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-[var(--text-muted)]">No inventory data available</div>
          )}
        </div>

        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Inventory by Category</h3>
          {categoryDistribution.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={categoryDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value">
                    {categoryDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {categoryDistribution.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-[var(--text-muted)]">{item.name}: {item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-[var(--text-muted)]">No category data available</div>
          )}
        </div>
      </div>
    </div>
  )
}
