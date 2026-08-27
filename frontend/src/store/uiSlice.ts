import { createSlice } from '@reduxjs/toolkit'

export const SIDEBAR_COLLAPSED_STORAGE_KEY = 'wsmis.sidebarCollapsed'

export interface UIState {
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  isMobile: boolean
}

const initialState: UIState = {
  sidebarOpen: true,
  sidebarCollapsed: false,
  isMobile: false,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen
    },
    setSidebarOpen: (state, action: { payload: boolean }) => {
      state.sidebarOpen = action.payload
    },
    setMobile: (state, action: { payload: boolean }) => {
      if (state.isMobile === action.payload) return
      state.isMobile = action.payload
      if (action.payload) state.sidebarOpen = false
    },
    setSidebarCollapsed: (state, action: { payload: boolean }) => {
      state.sidebarCollapsed = action.payload
    },
    toggleSidebarCollapsed: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed
    },
  },
})

export const { toggleSidebar, setSidebarOpen, setMobile, setSidebarCollapsed, toggleSidebarCollapsed } = uiSlice.actions
export default uiSlice.reducer
