'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const themeStorageKey = 'theme'
const themeChangeEvent = 'wsmis-theme-change'

const getStoredTheme = (): Theme => {
  const saved = window.localStorage.getItem(themeStorageKey)
  return saved === 'dark' ? 'dark' : 'light'
}

const getServerTheme = (): Theme => 'light'

const subscribeToTheme = (notify: () => void) => {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === themeStorageKey) notify()
  }
  const handleThemeChange = () => notify()

  window.addEventListener('storage', handleStorage)
  window.addEventListener(themeChangeEvent, handleThemeChange)

  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(themeChangeEvent, handleThemeChange)
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribeToTheme, getStoredTheme, getServerTheme)

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    const nextTheme: Theme = getStoredTheme() === 'dark' ? 'light' : 'dark'
    window.localStorage.setItem(themeStorageKey, nextTheme)
    window.dispatchEvent(new Event(themeChangeEvent))
  }, [])

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
