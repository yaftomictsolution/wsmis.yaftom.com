'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useDispatch } from 'react-redux'
import { useRouter } from 'next/navigation'
import { setMobile } from '@/src/store/uiSlice'
import { Header } from '@/components/Header'
import { RouteProgress } from '@/components/RouteProgress'
import { Sidebar } from '@/components/Sidebar'
import { TrainingEnvironmentBanner } from '@/components/TrainingEnvironmentBanner'
import { WaterFishLayer } from '@/components/WaterFishLayer'
import { WaterWaveBackground } from '@/components/WaterWaveBackground'
import { WorkspaceNavigation } from '@/components/WorkspaceNavigation'
import { TrainingModeProvider } from '@/context/TrainingModeContext'
import { PaymentModalProvider } from '@/context/PaymentModalContext'
import {
  clearAuthSession,
  getAuthToken,
  getServerAuthSession,
  hasAuthSession,
  setAuthSession,
  subscribeToAuthSession,
} from '@/lib/api'
import { useGetMeQuery, useGetSettingsQuery } from '@/src/store/waternetApi'
import { useCalendar } from '@/context/CalendarContext'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch()
  const router = useRouter()
  const { setCalendarSystem, setShowGregorianSecondary } = useCalendar()
  const hasStoredToken = useSyncExternalStore(
    subscribeToAuthSession,
    hasAuthSession,
    getServerAuthSession,
  )
  const {
    data: authenticatedUser,
    error: authenticationError,
    isFetching: authenticationChecking,
  } = useGetMeQuery(undefined, {
    skip: hasStoredToken !== true,
    refetchOnMountOrArgChange: true,
  })
  const { data: settings } = useGetSettingsQuery(undefined, {
    skip: hasStoredToken !== true,
  })

  useEffect(() => {
    const handleResize = () => {
      dispatch(setMobile(window.innerWidth < 1024))
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [dispatch])

  useEffect(() => {
    if (hasStoredToken === false) {
      router.replace('/login')
    }
  }, [hasStoredToken, router])

  useEffect(() => {
    if (!authenticatedUser) return

    const token = getAuthToken()
    if (token) setAuthSession(token, authenticatedUser)
  }, [authenticatedUser])

  useEffect(() => {
    const profile = settings?.system.system_profile
    if (!profile) return

    setCalendarSystem(profile.calendar_system ?? 'shamsi')
    setShowGregorianSecondary(Boolean(profile.show_gregorian_secondary))
  }, [setCalendarSystem, setShowGregorianSecondary, settings])

  const authenticationStatus = (
    authenticationError
    && typeof authenticationError === 'object'
    && 'status' in authenticationError
  ) ? authenticationError.status : null
  const authenticationUnauthorized = authenticationStatus === 401

  useEffect(() => {
    if (authenticationUnauthorized) {
      clearAuthSession()
      router.replace('/login')
    }
  }, [authenticationUnauthorized, router])

  const authReady = hasStoredToken === true
    && Boolean(authenticatedUser)
    && !authenticationUnauthorized
    && !authenticationChecking

  if (!authReady) {
    return (
      <div className="app-shell dashboard-main flex h-screen w-full items-center justify-center">
        <div className="h-10 w-10 animate-pulse rounded-full bg-[var(--accent-soft)] ring-1 ring-[var(--border-subtle)]" />
      </div>
    )
  }

  return (
    <TrainingModeProvider>
      <PaymentModalProvider>
        <div className="app-shell flex h-screen w-full overflow-hidden font-sans transition-colors duration-300">
          <Sidebar />
          <div className="dashboard-workspace water-ripple-surface flex-1 flex flex-col min-w-0 overflow-hidden relative">
            <WaterWaveBackground />
            <WaterFishLayer />
            <RouteProgress />
            <Header />
            <TrainingEnvironmentBanner />
            <WorkspaceNavigation />
            <main className="dashboard-main flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent relative z-10">
              {children}
            </main>
          </div>
        </div>
      </PaymentModalProvider>
    </TrainingModeProvider>
  )
}
