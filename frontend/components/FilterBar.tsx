'use client'

import { useDispatch, useSelector } from 'react-redux'
import type { RootState } from '@/src/store/store'
import { setSearch, setStatus, resetFilters } from '@/src/store/filtersSlice'

export function FilterBar() {
  const dispatch = useDispatch()
  const { search, status } = useSelector((state: RootState) => state.dashboardFilters)

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="search"
        placeholder="Search..."
        value={search}
        onChange={(e) => dispatch(setSearch(e.target.value))}
        className="field-control px-3 py-2 text-sm"
      />
      <select
        value={status}
        onChange={(e) => dispatch(setStatus(e.target.value))}
        className="field-control px-3 py-2 text-sm"
      >
        <option value="all">All status</option>
        <option value="active">Active</option>
        <option value="pending">Pending</option>
        <option value="completed">Completed</option>
      </select>
      <button
        type="button"
        onClick={() => dispatch(resetFilters())}
        className="secondary-action min-h-0 px-3 py-2 text-sm"
      >
        Reset
      </button>
    </div>
  )
}
