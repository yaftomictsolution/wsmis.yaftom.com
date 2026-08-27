'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useLanguage } from '@/context/LanguageContext'
import { useGetMeQuery } from '@/src/store/waternetApi'
import { activeWorkspaceTab, visibleWorkspaceTabs, workspaceForPath } from '@/lib/workspaces'

export function WorkspaceNavigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { translate } = useLanguage()
  const { data: profile } = useGetMeQuery()
  const workspace = workspaceForPath(pathname)

  if (!workspace || workspace.id === 'dashboard') return null

  const tabs = visibleWorkspaceTabs(workspace, profile)
  const activeTab = activeWorkspaceTab(workspace, pathname, profile)
  const WorkspaceIcon = workspace.icon

  return (
    <nav
      className="relative z-20 flex min-h-14 items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 px-3 backdrop-blur-md lg:px-5"
      aria-label={translate(`${workspace.label} navigation`)}
    >
      <div className="hidden flex-none items-center gap-2 border-e border-[var(--border-subtle)] pe-4 xl:flex">
        <WorkspaceIcon className="h-4 w-4 text-[var(--accent)]" />
        <span className="whitespace-nowrap text-sm font-extrabold text-[var(--text-primary)]">{translate(workspace.label)}</span>
      </div>
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab?.path === tab.path
          return (
            <Link
              key={tab.path}
              href={tab.path}
              prefetch={false}
              onPointerEnter={() => router.prefetch(tab.path)}
              onPointerDown={() => router.prefetch(tab.path)}
              onFocus={() => router.prefetch(tab.path)}
              onClick={() => {
                if (!isActive) window.dispatchEvent(new Event('wsmis:navigation-start'))
              }}
              className={`flex min-h-9 flex-none items-center gap-2 rounded-md px-3 text-xs font-extrabold transition-colors ${
                isActive
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-3.5 w-3.5" />
              {translate(tab.label)}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
