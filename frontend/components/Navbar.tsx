'use client'

import Link from 'next/link'
import { Bell, Menu, Search } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'
import type { RootState } from '@/src/store/store'
import { SIDEBAR_COLLAPSED_STORAGE_KEY, setSidebarCollapsed, setSidebarOpen } from '@/src/store/uiSlice'
import { useLanguage } from '@/context/LanguageContext'

export function Navbar() {
  const dispatch = useDispatch()
  const { sidebarOpen, sidebarCollapsed, isMobile } = useSelector((state: RootState) => state.ui)
  const { t, translate } = useLanguage()
  const sidebarExpanded = isMobile ? sidebarOpen : !sidebarCollapsed

  const toggleSidebar = () => {
    if (isMobile) {
      dispatch(setSidebarOpen(!sidebarOpen))
      return
    }

    const collapsed = !sidebarCollapsed
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed))
    dispatch(setSidebarCollapsed(collapsed))
  }

  return (
    <header className="app-header">
      <button
        type="button"
        onClick={toggleSidebar}
        className="icon-button"
        aria-label={sidebarExpanded ? translate('Close sidebar') : translate('Open sidebar')}
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex flex-1 items-center gap-4">
        <Link href="/" className="flex items-center gap-2 font-extrabold text-[var(--text-primary)]">
          <span className="text-lg">{translate('WaterNet MIS')}</span>
        </Link>

        <div className="hidden flex-1 max-w-md lg:block">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="search"
              placeholder={t('search')}
              className="field-control py-2 pl-9 pr-4 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" className="icon-button relative" aria-label={t('notifications')}>
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--coral)]" aria-hidden />
        </button>
        <div className="h-6 w-px bg-[var(--border-subtle)]" />
        <button type="button" className="ghost-action px-2 py-1.5 text-left text-sm">
          <span className="avatar-mark flex h-8 w-8 items-center justify-center rounded-lg text-sm font-extrabold">U</span>
          <span className="hidden sm:inline">{translate('User')}</span>
        </button>
      </div>
    </header>
  )
}
