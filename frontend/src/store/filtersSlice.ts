import { createSlice } from '@reduxjs/toolkit'

export interface DashboardFiltersState {
  search: string
  status: string
  dateFrom: string
  dateTo: string
}

const initialState: DashboardFiltersState = {
  search: '',
  status: 'all',
  dateFrom: '',
  dateTo: '',
}

const filtersSlice = createSlice({
  name: 'dashboardFilters',
  initialState,
  reducers: {
    setSearch: (state, action: { payload: string }) => {
      state.search = action.payload
    },
    setStatus: (state, action: { payload: string }) => {
      state.status = action.payload
    },
    setDateFrom: (state, action: { payload: string }) => {
      state.dateFrom = action.payload
    },
    setDateTo: (state, action: { payload: string }) => {
      state.dateTo = action.payload
    },
    resetFilters: () => initialState,
  },
})

export const { setSearch, setStatus, setDateFrom, setDateTo, resetFilters } = filtersSlice.actions
export default filtersSlice.reducer
