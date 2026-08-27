'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Droplets,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDispatch, useSelector } from 'react-redux'
import type { RootState } from '@/src/store/store'
import { SIDEBAR_COLLAPSED_STORAGE_KEY, setSidebarCollapsed, setSidebarOpen } from '@/src/store/uiSlice'
import { useLanguage } from '@/context/LanguageContext'
import { useGetMeQuery } from '@/src/store/waternetApi'
import { visibleWorkspaces, workspaceForPath, workspaceHome } from '@/lib/workspaces'

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const dispatch = useDispatch()
  const { data: profile } = useGetMeQuery()
  const { sidebarOpen, sidebarCollapsed, isMobile } = useSelector((state: RootState) => state.ui)
  const { direction, t, translate } = useLanguage()
  const sidebarExpanded = isMobile ? sidebarOpen : !sidebarCollapsed

  useEffect(() => {
    const storedPreference = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)
    if (storedPreference !== null) {
      dispatch(setSidebarCollapsed(storedPreference === 'true'))
    }
  }, [dispatch])

  const setDesktopSidebarCollapsed = (collapsed: boolean) => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed))
    dispatch(setSidebarCollapsed(collapsed))
  }
  const navigation = visibleWorkspaces(profile)
  const activeWorkspace = workspaceForPath(pathname)

  return (
    <>
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={() => dispatch(setSidebarOpen(false))}
            className="fixed inset-0 bg-black z-40 lg:hidden"
            aria-hidden
          />
        )}
      </AnimatePresence>

      {isMobile && !sidebarOpen && (
        <button
          type="button"
          onClick={() => dispatch(setSidebarOpen(true))}
          className={`sidebar-expand-control fixed top-1/2 ${direction === 'rtl' ? 'right-2' : 'left-2'} z-50 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] shadow-lg hover:text-[var(--text-primary)]`}
          aria-label={t('expandSidebar')}
        >
          {direction === 'rtl' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      )}

      <motion.aside
        className={`app-sidebar fixed lg:static inset-y-0 ${direction === 'rtl' ? 'right-0' : 'left-0'} z-50 flex flex-col transition-all duration-300 ease-in-out ${sidebarExpanded ? 'w-[280px]' : 'w-[88px]'} ${isMobile && !sidebarOpen ? (direction === 'rtl' ? 'translate-x-full' : '-translate-x-full') : 'translate-x-0'}`}
      >
        <div className="h-16 flex items-center px-4 border-b elegant-divider">
          <div className="flex min-w-0 items-center gap-3 overflow-hidden">
            <div className="brand-mark relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
              <Droplets className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[var(--gold)] ring-2 ring-[var(--bg-surface)]" />
            </div>
            <motion.div
              animate={{ opacity: sidebarExpanded ? 1 : 0, display: sidebarExpanded ? 'block' : 'none' }}
              className="whitespace-nowrap"
            >
              <h1 className="text-sm font-extrabold tracking-[0.18em] text-[var(--text-primary)]">WSMIS</h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--text-muted)]">{t('waterSupplyManagementSystem')}</p>
            </motion.div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-5 scrollbar-thin scrollbar-thumb-slate-200">
          {sidebarExpanded && (
            <div className="mb-2 px-5">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {translate('Work Areas')}
              </p>
            </div>
          )}
          <div className="space-y-1 px-3">
            {navigation.map((workspace) => {
              const path = workspaceHome(workspace, profile)
              const isActive = activeWorkspace?.id === workspace.id
              const Icon = workspace.icon
              return (
                <Link
                  key={workspace.id}
                  href={path}
                  prefetch={false}
                  onPointerEnter={() => router.prefetch(path)}
                  onFocus={() => router.prefetch(path)}
                  onPointerDown={() => router.prefetch(path)}
                  onClick={() => {
                    if (!isActive) window.dispatchEvent(new Event('wsmis:navigation-start'))
                    if (isMobile) dispatch(setSidebarOpen(false))
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  title={!sidebarExpanded ? translate(workspace.label) : ''}
                  className={`nav-item w-full px-3 py-3 text-sm font-bold ${isActive ? 'nav-item-active' : ''} ${sidebarExpanded ? '' : 'justify-center'}`}
                >
                  <Icon size={19} className={isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'} />
                  {sidebarExpanded && <span className="truncate">{translate(workspace.label)}</span>}
                  {isActive && sidebarExpanded && (
                    <div className={`${direction === 'rtl' ? 'mr-auto' : 'ml-auto'} h-1.5 w-1.5 rounded-full bg-[var(--gold)]`} />
                  )}
                </Link>
              )
            })}
          </div>
        </div>

        {(!isMobile || sidebarOpen) && (
          <div className={`absolute top-1/2 ${direction === 'rtl' ? '-left-3' : '-right-3'} z-50`}>
            <button
              onClick={() => {
                if (isMobile) dispatch(setSidebarOpen(false))
                else setDesktopSidebarCollapsed(!sidebarCollapsed)
              }}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] shadow-lg hover:text-[var(--text-primary)]"
              type="button"
              aria-label={sidebarExpanded ? t('collapseSidebar') : t('expandSidebar')}
            >
              {sidebarExpanded ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
            </button>
          </div>
        )}
      </motion.aside>
    </>
  )
}
