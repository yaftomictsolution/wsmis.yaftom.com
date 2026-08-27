'use client'

import { useEffect, useRef } from 'react'

type RippleOptions = {
  imageUrl: string
  resolution: number
  dropRadius: number
  perturbance: number
  interactive: boolean
}

type RippleElement = JQuery<HTMLElement> & {
  ripples: (
    optionsOrCommand: RippleOptions | 'destroy' | 'hide' | 'pause' | 'play',
  ) => RippleElement
}

const RIPPLE_IMAGE = '/images/water-ripple-surface.webp'
const RIPPLE_OPTIONS: RippleOptions = {
  imageUrl: RIPPLE_IMAGE,
  resolution: 192,
  dropRadius: 18,
  perturbance: 0.02,
  interactive: true,
}

export function WaterWaveBackground() {
  const anchorRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const workspace = anchorRef.current?.parentElement
    if (!workspace) return

    let disposed = false
    let resizeTimer: number | null = null
    let idleTimer: number | null = null
    let resizeObserver: ResizeObserver | null = null
    let rippleElement: RippleElement | null = null
    let ripplesAwake = false

    const pauseRipples = () => {
      if (!rippleElement || !ripplesAwake) return

      rippleElement.ripples('pause')
      ripplesAwake = false
      workspace.dataset.waterRipplesMotion = 'idle'
    }

    const scheduleIdlePause = () => {
      if (idleTimer !== null) window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(() => {
        idleTimer = null
        pauseRipples()
      }, 1200)
    }

    const wakeRipples = () => {
      if (!rippleElement || document.hidden) return

      if (!ripplesAwake) {
        rippleElement.ripples('play')
        ripplesAwake = true
        workspace.dataset.waterRipplesMotion = 'active'
      }

      scheduleIdlePause()
    }

    const handleVisibilityChange = () => {
      if (document.hidden) pauseRipples()
    }

    const initializeRipples = async () => {
      try {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          workspace.dataset.waterRipples = 'reduced-motion'
          return
        }

        const jqueryModule = await import('jquery')
        await import('jquery.ripples')

        if (disposed) return

        const $workspace = jqueryModule.default(workspace) as unknown as RippleElement
        $workspace.ripples(RIPPLE_OPTIONS)
        rippleElement = $workspace
        ripplesAwake = true
        workspace.dataset.waterRipples = 'ready'
        pauseRipples()

        resizeObserver = new ResizeObserver(() => {
          if (resizeTimer !== null) window.clearTimeout(resizeTimer)

          resizeTimer = window.setTimeout(() => {
            resizeTimer = null
            window.dispatchEvent(new Event('resize'))
          }, 160)
        })
        resizeObserver.observe(workspace)

        workspace.addEventListener('pointerenter', wakeRipples, { passive: true })
        workspace.addEventListener('pointermove', wakeRipples, { passive: true })
        workspace.addEventListener('pointerdown', wakeRipples, { passive: true })
        document.addEventListener('visibilitychange', handleVisibilityChange)
      } catch (error) {
        workspace.dataset.waterRipples = 'fallback'

        if (process.env.NODE_ENV !== 'production') {
          console.warn('WebGL water ripples are unavailable; using the static water background.', error)
        }
      }
    }

    void initializeRipples()

    return () => {
      disposed = true
      resizeObserver?.disconnect()
      workspace.removeEventListener('pointerenter', wakeRipples)
      workspace.removeEventListener('pointermove', wakeRipples)
      workspace.removeEventListener('pointerdown', wakeRipples)
      document.removeEventListener('visibilitychange', handleVisibilityChange)

      if (resizeTimer !== null) window.clearTimeout(resizeTimer)
      if (idleTimer !== null) window.clearTimeout(idleTimer)

      if (rippleElement) {
        try {
          rippleElement.ripples('pause')
          rippleElement.ripples('hide')
          rippleElement.ripples('destroy')
        } catch {
          // The plugin may already be detached during a full-page navigation.
        }
      }

      delete workspace.dataset.waterRipples
      delete workspace.dataset.waterRipplesMotion
    }
  }, [])

  return (
    <span
      ref={anchorRef}
      className="water-ripple-controller"
      aria-hidden="true"
      data-water-ripple-controller
    />
  )
}
