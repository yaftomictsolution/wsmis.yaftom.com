'use client'

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useLanguage } from '@/context/LanguageContext'

export type CashMovementPoint = {
  label: string
  income: number
  expense: number
  net: number
}

const compactMoney = (value: number) => new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(value)

export function CashMovementChart({ data }: { data: CashMovementPoint[] }) {
  const { translate } = useLanguage()

  return (
    <div className="h-[290px] w-full" data-testid="cash-movement-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 18, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="4 5" vertical={false} opacity={0.65} />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 700 }}
            dy={9}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => compactMoney(Number(value))}
            tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 700 }}
            width={58}
          />
          <Tooltip
            cursor={{ stroke: 'var(--border-strong)', strokeDasharray: '4 4' }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <div className="min-w-44 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] p-3 shadow-xl">
                  <p className="text-xs font-extrabold text-[var(--text-primary)]">{label}</p>
                  {payload.map((entry) => (
                    <div key={String(entry.dataKey)} className="mt-2 flex items-center justify-between gap-5 text-xs font-bold">
                      <span style={{ color: entry.color }}>{translate(String(entry.name))}</span>
                      <span className="text-[var(--text-primary)]">AFN {Number(entry.value ?? 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )
            }}
          />
          <Area
            type="monotone"
            dataKey="income"
            name="Income"
            stroke="var(--mint)"
            fill="var(--mint)"
            fillOpacity={0.12}
            strokeWidth={3}
            activeDot={{ r: 5, strokeWidth: 3, fill: 'var(--bg-surface)' }}
          />
          <Area
            type="monotone"
            dataKey="expense"
            name="Expenses"
            stroke="var(--coral)"
            fill="var(--coral)"
            fillOpacity={0.08}
            strokeWidth={3}
            activeDot={{ r: 5, strokeWidth: 3, fill: 'var(--bg-surface)' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
