'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

const NAVIGATION_START_EVENT = 'wsmis:navigation-start'

export function RouteProgress() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const activeRef = useRef(false)
  const intervalRef = useRef<number | null>(null)
  const completionRef = useRef<number | null>(null)
  const safetyRef = useRef<number | null>(null)

  const clearTimers = () => {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current)
    if (completionRef.current !== null) window.clearTimeout(completionRef.current)
    if (safetyRef.current !== null) window.clearTimeout(safetyRef.current)
    intervalRef.current = null
    completionRef.current = null
    safetyRef.current = null
  }

  useEffect(() => {
    const start = () => {
      clearTimers()
      activeRef.current = true
      setProgress(16)
      setVisible(true)

      intervalRef.current = window.setInterval(() => {
        setProgress((current) => Math.min(88, current + Math.max(1, (88 - current) * 0.14)))
      }, 140)

      safetyRef.current = window.setTimeout(() => {
        activeRef.current = false
        clearTimers()
        setVisible(false)
        setProgress(0)
      }, 8000)
    }

    window.addEventListener(NAVIGATION_START_EVENT, start)
    return () => {
      window.removeEventListener(NAVIGATION_START_EVENT, start)
      clearTimers()
    }
  }, [])

  useEffect(() => {
    if (!activeRef.current) return

    if (intervalRef.current !== null) window.clearInterval(intervalRef.current)
    intervalRef.current = null
    window.requestAnimationFrame(() => setProgress(100))
    completionRef.current = window.setTimeout(() => {
      activeRef.current = false
      setVisible(false)
      setProgress(0)
    }, 180)
  }, [pathname])

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 top-0 z-[90] h-[3px] overflow-hidden transition-opacity duration-150 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <div
        className="h-full w-full bg-[var(--accent)] shadow-[0_0_12px_var(--accent)] transition-transform duration-150 ease-out"
        style={{ transform: `scaleX(${progress / 100})`, transformOrigin: 'left center' }}
      />
    </div>
  )
}
