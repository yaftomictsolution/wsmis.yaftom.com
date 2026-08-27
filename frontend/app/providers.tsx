'use client'

import { Provider } from 'react-redux'
import { store } from '../src/store/store'
import { ThemeProvider } from '../context/ThemeContext'
import { LanguageProvider } from '../context/LanguageContext'
import { DashboardEffectsProvider } from '../context/DashboardEffectsContext'
import { CalendarProvider } from '../context/CalendarContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <LanguageProvider>
        <CalendarProvider>
          <DashboardEffectsProvider>
            <ThemeProvider>{children}</ThemeProvider>
          </DashboardEffectsProvider>
        </CalendarProvider>
      </LanguageProvider>
    </Provider>
  )
}
