'use client'

import { useEffect, useRef } from 'react'

import { useDashboardEffects } from '@/context/DashboardEffectsContext'

type FishDefinition = {
  src: string
  direction: 1 | -1
  y: number
  minSize: number
  widthRatio: number
  maxSize: number
  opacity: number
  duration: number
  routePhase: number
  waveCycles: number
  waveHeight: number
  tailCycle: number
  headCycle: number
  mouthCycle: number
  motionPhase: number
  finColor: string
  finHighlight: string
  mouthColor: string
}

type LoadedFish = FishDefinition & {
  image: HTMLImageElement
}

const fish: FishDefinition[] = [
  {
    src: '/images/fish-silver-teal.webp',
    direction: 1,
    y: 0.1,
    minSize: 108,
    widthRatio: 0.12,
    maxSize: 180,
    opacity: 0.68,
    duration: 27,
    routePhase: 8 / 27,
    waveCycles: 1.15,
    waveHeight: 0.06,
    tailCycle: 0.5,
    headCycle: 2.4,
    mouthCycle: 3.2,
    motionPhase: -0.18,
    finColor: 'rgba(35, 137, 164, 0.78)',
    finHighlight: 'rgba(178, 235, 239, 0.82)',
    mouthColor: 'rgba(8, 48, 57, 0.84)',
  },
  {
    src: '/images/fish-gold-coral.webp',
    direction: -1,
    y: 0.2,
    minSize: 92,
    widthRatio: 0.09,
    maxSize: 142,
    opacity: 0.64,
    duration: 32,
    routePhase: 19 / 32,
    waveCycles: 1.3,
    waveHeight: 0.055,
    tailCycle: 0.62,
    headCycle: 2.6,
    mouthCycle: 3.5,
    motionPhase: -0.42,
    finColor: 'rgba(230, 91, 27, 0.8)',
    finHighlight: 'rgba(255, 205, 75, 0.86)',
    mouthColor: 'rgba(81, 36, 12, 0.86)',
  },
  {
    src: '/images/fish-sapphire-violet.webp',
    direction: 1,
    y: 0.43,
    minSize: 116,
    widthRatio: 0.13,
    maxSize: 192,
    opacity: 0.62,
    duration: 35,
    routePhase: 25 / 35,
    waveCycles: 1.45,
    waveHeight: 0.075,
    tailCycle: 0.54,
    headCycle: 2.3,
    mouthCycle: 3,
    motionPhase: -0.66,
    finColor: 'rgba(47, 57, 194, 0.82)',
    finHighlight: 'rgba(53, 205, 244, 0.84)',
    mouthColor: 'rgba(8, 28, 73, 0.88)',
  },
  {
    src: '/images/fish-silver-teal.webp',
    direction: -1,
    y: 0.57,
    minSize: 78,
    widthRatio: 0.08,
    maxSize: 122,
    opacity: 0.54,
    duration: 29,
    routePhase: 6 / 29,
    waveCycles: 1.2,
    waveHeight: 0.06,
    tailCycle: 0.68,
    headCycle: 2.8,
    mouthCycle: 3.7,
    motionPhase: -0.34,
    finColor: 'rgba(35, 137, 164, 0.74)',
    finHighlight: 'rgba(178, 235, 239, 0.76)',
    mouthColor: 'rgba(8, 48, 57, 0.84)',
  },
  {
    src: '/images/fish-gold-coral.webp',
    direction: 1,
    y: 0.77,
    minSize: 100,
    widthRatio: 0.11,
    maxSize: 164,
    opacity: 0.68,
    duration: 31,
    routePhase: 15 / 31,
    waveCycles: 1.35,
    waveHeight: 0.055,
    tailCycle: 0.57,
    headCycle: 2.5,
    mouthCycle: 3.3,
    motionPhase: -0.12,
    finColor: 'rgba(230, 91, 27, 0.8)',
    finHighlight: 'rgba(255, 205, 75, 0.86)',
    mouthColor: 'rgba(81, 36, 12, 0.86)',
  },
  {
    src: '/images/fish-sapphire-violet.webp',
    direction: -1,
    y: 0.88,
    minSize: 114,
    widthRatio: 0.12,
    maxSize: 184,
    opacity: 0.64,
    duration: 37,
    routePhase: 29 / 37,
    waveCycles: 1.5,
    waveHeight: 0.065,
    tailCycle: 0.64,
    headCycle: 2.7,
    mouthCycle: 3.6,
    motionPhase: -0.54,
    finColor: 'rgba(47, 57, 194, 0.82)',
    finHighlight: 'rgba(53, 205, 244, 0.84)',
    mouthColor: 'rgba(8, 28, 73, 0.88)',
  },
]

const imageCache = new Map<string, Promise<HTMLImageElement>>()

const loadImage = (src: string) => {
  const cached = imageCache.get(src)
  if (cached) return cached

  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Unable to load fish image: ${src}`))
    image.src = src
  })

  imageCache.set(src, pending)
  return pending
}

const wrapProgress = (value: number) => ((value % 1) + 1) % 1
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

const drawFin = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  flap: number,
  color: string,
  highlight: string,
  opacity: number,
) => {
  context.save()
  context.translate(x, y)
  context.rotate((flap - 0.5) * 0.16)
  context.scale(1, 0.62 + flap * 0.46)
  context.globalAlpha *= opacity
  context.fillStyle = color
  context.strokeStyle = highlight
  context.lineWidth = Math.max(0.6, width * 0.025)
  context.beginPath()
  context.moveTo(0, 0)
  context.quadraticCurveTo(width * 0.7, height * 0.12, width, height * 0.52)
  context.quadraticCurveTo(width * 0.44, height * 0.72, width * 0.16, height)
  context.closePath()
  context.fill()
  context.stroke()
  context.restore()
}

const drawFishWake = (
  context: CanvasRenderingContext2D,
  definition: LoadedFish,
  size: number,
  height: number,
  seconds: number,
  tailAngle: number,
  compact: boolean,
) => {
  const tailX = -size * 0.48
  const wakeLength = size * (compact ? 0.68 : 0.92)
  const tailPhase = (seconds / definition.tailCycle) * Math.PI * 2
  const tailPulse = Math.sin(tailPhase)
  const wakeOpacity = 0.16 + definition.opacity * 0.1

  context.save()
  context.lineCap = 'round'
  context.lineJoin = 'round'

  // The head pushes a small bow wave before the tail wake develops.
  context.globalAlpha *= wakeOpacity * 0.52
  context.strokeStyle = 'rgba(225, 252, 255, 0.78)'
  context.lineWidth = Math.max(0.6, size * 0.0045)
  context.beginPath()
  context.ellipse(
    size * 0.44,
    0,
    size * 0.055,
    height * 0.3,
    0,
    -Math.PI / 2,
    Math.PI / 2,
  )
  context.stroke()
  context.globalAlpha /= wakeOpacity * 0.52

  // Two pressure lines spread from the body and form the soft V wake.
  for (const side of [-1, 1]) {
    const startY = side * height * (0.07 + Math.abs(tailAngle) * 0.22)
    const endY = side * height * (0.34 + Math.abs(tailPulse) * 0.06)
    const pulseY = side * tailPulse * height * 0.035

    context.globalAlpha *= wakeOpacity
    context.strokeStyle = 'rgba(220, 250, 255, 0.88)'
    context.lineWidth = Math.max(0.65, size * 0.005)
    context.beginPath()
    context.moveTo(tailX + size * 0.035, startY)
    context.bezierCurveTo(
      tailX - wakeLength * 0.2,
      startY + pulseY,
      tailX - wakeLength * 0.56,
      endY * 0.72,
      tailX - wakeLength,
      endY,
    )
    context.stroke()

    context.globalAlpha /= wakeOpacity
    context.globalAlpha *= wakeOpacity * 0.46
    context.strokeStyle = 'rgba(8, 102, 132, 0.56)'
    context.lineWidth = Math.max(0.5, size * 0.0035)
    context.beginPath()
    context.moveTo(tailX - size * 0.015, startY + side * height * 0.025)
    context.bezierCurveTo(
      tailX - wakeLength * 0.24,
      startY + pulseY + side * height * 0.025,
      tailX - wakeLength * 0.6,
      endY * 0.76,
      tailX - wakeLength * 0.96,
      endY * 0.98,
    )
    context.stroke()
    context.globalAlpha /= wakeOpacity * 0.46
  }

  // A light oscillating center trail links the tail movement to the wake.
  context.globalAlpha *= wakeOpacity * 0.72
  context.strokeStyle = 'rgba(202, 246, 253, 0.82)'
  context.lineWidth = Math.max(0.55, size * 0.004)
  context.beginPath()
  context.moveTo(tailX, tailAngle * height * 0.42)
  context.bezierCurveTo(
    tailX - wakeLength * 0.18,
    -tailPulse * height * 0.1,
    tailX - wakeLength * 0.35,
    tailPulse * height * 0.09,
    tailX - wakeLength * 0.54,
    -tailPulse * height * 0.045,
  )
  context.stroke()
  context.globalAlpha /= wakeOpacity * 0.72

  // Fading elliptical vortices mimic the water displaced by each tail stroke.
  const vortexCount = compact ? 2 : 3
  for (let index = 0; index < vortexCount; index += 1) {
    const age = wrapProgress(
      seconds * 0.52
      + definition.routePhase
      + definition.motionPhase * 0.07
      + index / vortexCount,
    )
    const fade = Math.pow(1 - age, 1.7)
    const distance = size * (0.15 + age * (compact ? 0.55 : 0.78))
    const radiusX = size * (0.025 + age * 0.075)
    const radiusY = height * (0.075 + age * 0.25)
    const vortexY = Math.sin(tailPhase - age * Math.PI * 2.4 + index) * height * 0.055

    context.globalAlpha *= fade * (compact ? 0.2 : 0.25)
    context.strokeStyle = index % 2 === 0
      ? 'rgba(222, 251, 255, 0.82)'
      : 'rgba(19, 126, 153, 0.54)'
    context.lineWidth = Math.max(0.55, size * 0.0038 * (1 - age * 0.35))
    context.beginPath()
    context.ellipse(
      tailX - distance,
      vortexY,
      radiusX,
      radiusY,
      0,
      -Math.PI * 0.82,
      Math.PI * 0.82,
    )
    context.stroke()
    context.globalAlpha /= fade * (compact ? 0.2 : 0.25)
  }

  context.restore()
}

const drawFish = (
  context: CanvasRenderingContext2D,
  definition: LoadedFish,
  viewportWidth: number,
  viewportHeight: number,
  seconds: number,
) => {
  const size = Math.min(
    definition.maxSize,
    Math.max(definition.minSize, viewportWidth * definition.widthRatio),
  )
  const aspectRatio = definition.image.naturalWidth / definition.image.naturalHeight
  const height = size / aspectRatio
  const progress = wrapProgress(seconds / definition.duration + definition.routePhase)
  const travelWidth = viewportWidth + size * 2
  const centerX = definition.direction === 1
    ? -size + progress * travelWidth
    : viewportWidth + size - progress * travelWidth
  const routeWave = Math.sin(
    progress * Math.PI * 2 * definition.waveCycles + definition.routePhase * Math.PI * 2,
  )
  const centerY = viewportHeight * definition.y + routeWave * viewportHeight * definition.waveHeight
  const motionTime = seconds + definition.motionPhase
  const tailAngle = Math.sin((motionTime / definition.tailCycle) * Math.PI * 2) * 0.13
  const headAngle = Math.sin((motionTime / definition.headCycle) * Math.PI * 2) * 0.018
  const finFlap = (Math.sin((motionTime / 0.78) * Math.PI * 2) + 1) / 2
  const mouthWave = Math.max(0, Math.sin((motionTime / definition.mouthCycle) * Math.PI * 2))
  const mouthOpen = 0.18 + Math.pow(mouthWave, 6) * 0.82
  const routeDerivative = Math.cos(
    progress * Math.PI * 2 * definition.waveCycles + definition.routePhase * Math.PI * 2,
  ) * Math.PI * 2 * definition.waveCycles * viewportHeight * definition.waveHeight
  const routeTilt = Math.atan2(definition.direction * routeDerivative, travelWidth)
  const bodyTilt = clamp(
    routeTilt * 0.58 + Math.cos(progress * Math.PI * 2 * definition.waveCycles) * 0.012,
    -0.12,
    0.12,
  )
  const sourceWidth = definition.image.naturalWidth
  const sourceHeight = definition.image.naturalHeight
  const left = -size / 2
  const top = -height / 2

  if (
    centerX + size < 0
    || centerX - size > viewportWidth
    || centerY + height < 0
    || centerY - height > viewportHeight
  ) {
    return
  }

  context.save()
  context.globalAlpha = definition.opacity
  context.translate(centerX, centerY)
  context.rotate(bodyTilt)
  context.scale(definition.direction, 1)

  drawFishWake(
    context,
    definition,
    size,
    height,
    seconds,
    tailAngle,
    viewportWidth <= 768,
  )

  drawFin(
    context,
    left + size * 0.46,
    top + height * 0.58,
    size * 0.15,
    height * 0.2,
    1 - finFlap,
    definition.finColor,
    definition.finHighlight,
    0.34,
  )

  const tailPivotX = left + size * 0.3
  context.save()
  context.translate(tailPivotX, 0)
  context.rotate(tailAngle)
  context.drawImage(
    definition.image,
    0,
    0,
    sourceWidth * 0.35,
    sourceHeight,
    -size * 0.3,
    top,
    size * 0.35,
    height,
  )
  context.restore()

  context.drawImage(
    definition.image,
    sourceWidth * 0.27,
    0,
    sourceWidth * 0.49,
    sourceHeight,
    left + size * 0.27,
    top,
    size * 0.49,
    height,
  )

  const headPivotX = left + size * 0.72
  context.save()
  context.translate(headPivotX, 0)
  context.rotate(headAngle)
  context.drawImage(
    definition.image,
    sourceWidth * 0.7,
    0,
    sourceWidth * 0.3,
    sourceHeight,
    -size * 0.02,
    top,
    size * 0.3,
    height,
  )

  context.strokeStyle = 'rgba(3, 36, 49, 0.38)'
  context.lineWidth = Math.max(0.7, size * 0.004)
  context.beginPath()
  context.moveTo(size * 0.055, -height * 0.17)
  context.quadraticCurveTo(size * 0.07, 0, size * 0.055, height * 0.17)
  context.stroke()

  context.fillStyle = definition.mouthColor
  context.beginPath()
  context.ellipse(
    size * 0.272,
    0,
    Math.max(0.8, size * 0.009),
    Math.max(0.45, height * 0.04 * mouthOpen),
    0,
    0,
    Math.PI * 2,
  )
  context.fill()
  context.restore()

  drawFin(
    context,
    left + size * 0.58,
    top + height * 0.49,
    size * 0.18,
    height * 0.25,
    finFlap,
    definition.finColor,
    definition.finHighlight,
    0.76,
  )

  context.restore()
}

export function WaterFishLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { fishVisible } = useDashboardEffects()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !fishVisible) return

    const context = canvas.getContext('2d', {
      alpha: true,
      desynchronized: true,
    })
    if (!context) return

    let disposed = false
    let animationFrame: number | null = null
    let resizeFrame: number | null = null
    let lastFrameAt = 0
    let loadedFish: LoadedFish[] = []
    let viewportWidth = 0
    let viewportHeight = 0
    let pixelRatio = 1
    let interactionPriorityUntil = 0

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const workspace = canvas.parentElement

    const prioritizePointer = () => {
      interactionPriorityUntil = performance.now() + 220
    }

    const resizeCanvas = () => {
      const bounds = canvas.getBoundingClientRect()
      viewportWidth = Math.max(1, bounds.width)
      viewportHeight = Math.max(1, bounds.height)
      pixelRatio = 1

      const nextWidth = Math.max(1, Math.round(viewportWidth * pixelRatio))
      const nextHeight = Math.max(1, Math.round(viewportHeight * pixelRatio))
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth
        canvas.height = nextHeight
      }

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'medium'
    }

    const drawFrame = (timestamp: number) => {
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      context.clearRect(0, 0, viewportWidth, viewportHeight)
      loadedFish.forEach((definition, index) => {
        if (viewportWidth <= 640 && (index === 3 || index === 5)) return
        drawFish(context, definition, viewportWidth, viewportHeight, timestamp / 1000)
      })
    }

    const scheduleAnimation = () => {
      if (disposed || document.hidden || reducedMotion || animationFrame !== null) return
      animationFrame = window.requestAnimationFrame(render)
    }

    const render = (timestamp: number) => {
      animationFrame = null
      if (disposed || document.hidden) return

      const lowerPowerDevice = viewportWidth <= 768 || (navigator.hardwareConcurrency ?? 4) <= 4
      const pointerIsActive = performance.now() < interactionPriorityUntil
      const targetFps = pointerIsActive
        ? (lowerPowerDevice ? 12 : 15)
        : (lowerPowerDevice ? 20 : 24)
      const frameInterval = 1000 / targetFps
      if (timestamp - lastFrameAt >= frameInterval) {
        lastFrameAt = timestamp - ((timestamp - lastFrameAt) % frameInterval)
        drawFrame(timestamp)
      }

      scheduleAnimation()
    }

    const queueResize = () => {
      if (resizeFrame !== null) return
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = null
        resizeCanvas()
        if (loadedFish.length > 0) drawFrame(performance.now())
      })
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (animationFrame !== null) {
          window.cancelAnimationFrame(animationFrame)
          animationFrame = null
        }
        return
      }

      lastFrameAt = 0
      scheduleAnimation()
    }

    const resizeObserver = new ResizeObserver(queueResize)
    resizeObserver.observe(canvas)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    workspace?.addEventListener('pointermove', prioritizePointer, { passive: true })
    workspace?.addEventListener('pointerdown', prioritizePointer, { passive: true })
    resizeCanvas()

    void Promise.all(fish.map(async (definition) => ({
      ...definition,
      image: await loadImage(definition.src),
    })))
      .then((definitions) => {
        if (disposed) return
        loadedFish = definitions
        drawFrame(performance.now())
        scheduleAnimation()
      })
      .catch((error) => {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Fish images could not be rendered.', error)
        }
      })

    return () => {
      disposed = true
      resizeObserver.disconnect()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      workspace?.removeEventListener('pointermove', prioritizePointer)
      workspace?.removeEventListener('pointerdown', prioritizePointer)
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame)
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame)
    }
  }, [fishVisible])

  return (
    <canvas
      ref={canvasRef}
      className="water-fish-layer"
      aria-hidden="true"
      data-water-fish-layer
      data-fish-renderer="canvas"
      data-fish-wakes="analytic"
      data-fish-count={fish.length}
      data-fish-visible={fishVisible}
    />
  )
}
