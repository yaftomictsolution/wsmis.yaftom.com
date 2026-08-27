import { configureStore } from '@reduxjs/toolkit'
import counterReducer from './counterSlice'
import uiReducer from './uiSlice'
import filtersReducer from './filtersSlice'
import { waternetApi } from './waternetApi'

export const store = configureStore({
  reducer: {
    counter: counterReducer,
    ui: uiReducer,
    dashboardFilters: filtersReducer,
    [waternetApi.reducerPath]: waternetApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(waternetApi.middleware),
})

// Types for TypeScript
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
