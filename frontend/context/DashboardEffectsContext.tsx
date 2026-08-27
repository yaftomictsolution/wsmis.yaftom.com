'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react'

type DashboardEffectsContextValue = {
  fishVisible: boolean
  setFishVisible: (visible: boolean) => void
  toggleFishVisibility: () => void
}

const DashboardEffectsContext = createContext<DashboardEffectsContextValue | undefined>(undefined)

const fishVisibilityStorageKey = 'wsmis_dashboard_fish_visible'
const fishVisibilityChangeEvent = 'wsmis-dashboard-fish-visibility-change'

const getStoredFishVisibility = () => (
  window.localStorage.getItem(fishVisibilityStorageKey) !== 'false'
)

const getServerFishVisibility = () => true

const subscribeToFishVisibility = (notify: () => void) => {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === fishVisibilityStorageKey) notify()
  }
  const handleVisibilityChange = () => notify()

  window.addEventListener('storage', handleStorage)
  window.addEventListener(fishVisibilityChangeEvent, handleVisibilityChange)

  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(fishVisibilityChangeEvent, handleVisibilityChange)
  }
}

export function DashboardEffectsProvider({ children }: { children: ReactNode }) {
  const fishVisible = useSyncExternalStore(
    subscribeToFishVisibility,
    getStoredFishVisibility,
    getServerFishVisibility,
  )

  const setFishVisible = useCallback((visible: boolean) => {
    window.localStorage.setItem(fishVisibilityStorageKey, String(visible))
    window.dispatchEvent(new Event(fishVisibilityChangeEvent))
  }, [])

  const toggleFishVisibility = useCallback(() => {
    setFishVisible(!getStoredFishVisibility())
  }, [setFishVisible])

  const value = useMemo(
    () => ({ fishVisible, setFishVisible, toggleFishVisibility }),
    [fishVisible, setFishVisible, toggleFishVisibility],
  )

  return (
    <DashboardEffectsContext.Provider value={value}>
      {children}
    </DashboardEffectsContext.Provider>
  )
}

export function useDashboardEffects() {
  const context = useContext(DashboardEffectsContext)
  if (!context) {
    throw new Error('useDashboardEffects must be used within a DashboardEffectsProvider')
  }
  return context
}
