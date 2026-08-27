'use client'

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, ImagePlus, RefreshCw, Trash2, Upload } from 'lucide-react'
import { API_BASE_URL, getAuthToken } from '@/lib/api'

type CustomerPhotoCaptureProps = {
  customerId?: number
  hasStoredPhoto?: boolean
  file: File | null
  onChange: (file: File | null) => void
  onRemoveStoredPhoto: () => void
  disabled?: boolean
  error?: string
}

const PHOTO_WIDTH = 800
const PHOTO_HEIGHT = 1000

export function CustomerPhotoCapture({
  customerId,
  hasStoredPhoto = false,
  file,
  onChange,
  onRemoveStoredPhoto,
  disabled = false,
  error,
}: CustomerPhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [storedPreview, setStoredPreview] = useState<string | null>(null)

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraActive(false)
    setCameraStarting(false)
  }

  useEffect(() => stopCamera, [])

  useEffect(() => {
    if (!file) {
      setFilePreview(null)
      return
    }

    const url = URL.createObjectURL(file)
    setFilePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    if (!customerId || !hasStoredPhoto || file) {
      setStoredPreview(null)
      return
    }

    const controller = new AbortController()
    let objectUrl: string | null = null

    const loadStoredPhoto = async () => {
      const token = getAuthToken()
      const response = await fetch(`${API_BASE_URL}/customers/${customerId}/photo`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        signal: controller.signal,
      })
      if (!response.ok) throw new Error('Unable to load customer photo.')
      objectUrl = URL.createObjectURL(await response.blob())
      setStoredPreview(objectUrl)
    }

    loadStoredPhoto().catch((loadError) => {
      if ((loadError as Error).name !== 'AbortError') setCameraError('Unable to load the saved customer photo.')
    })

    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [customerId, file, hasStoredPhoto])

  useEffect(() => {
    if (!cameraActive || !videoRef.current || !streamRef.current) return
    videoRef.current.srcObject = streamRef.current
    videoRef.current.play().catch(() => setCameraError('Unable to start the camera preview.'))
  }, [cameraActive])

  const startCamera = async () => {
    setCameraError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access requires localhost or a secure HTTPS connection.')
      return
    }

    stopCamera()
    setCameraStarting(true)
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 1600 },
        },
      })
      setCameraActive(true)
    } catch {
      setCameraError('Camera permission was not granted. You can upload a photo instead.')
    } finally {
      setCameraStarting(false)
    }
  }

  const capturePhoto = () => {
    const video = videoRef.current
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      setCameraError('The camera is still preparing. Please try again.')
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = PHOTO_WIDTH
    canvas.height = PHOTO_HEIGHT
    const context = canvas.getContext('2d')
    if (!context) {
      setCameraError('Unable to capture the photo.')
      return
    }

    const targetRatio = PHOTO_WIDTH / PHOTO_HEIGHT
    const sourceRatio = video.videoWidth / video.videoHeight
    let sourceX = 0
    let sourceY = 0
    let sourceWidth = video.videoWidth
    let sourceHeight = video.videoHeight

    if (sourceRatio > targetRatio) {
      sourceWidth = video.videoHeight * targetRatio
      sourceX = (video.videoWidth - sourceWidth) / 2
    } else {
      sourceHeight = video.videoWidth / targetRatio
      sourceY = (video.videoHeight - sourceHeight) / 2
    }

    context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, PHOTO_WIDTH, PHOTO_HEIGHT)
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError('Unable to capture the photo.')
        return
      }
      onChange(new File([blob], `customer-photo-${Date.now()}.jpg`, { type: 'image/jpeg' }))
      stopCamera()
    }, 'image/jpeg', 0.9)
  }

  const selectPhoto = (selected?: File) => {
    if (!selected) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) {
      setCameraError('Select a JPG, PNG, or WebP image.')
      return
    }
    if (selected.size > 5 * 1024 * 1024) {
      setCameraError('The customer photo may not be larger than 5 MB.')
      return
    }
    setCameraError('')
    stopCamera()
    onChange(selected)
  }

  const removePhoto = () => {
    stopCamera()
    setCameraError('')
    if (file) onChange(null)
    else if (hasStoredPhoto) onRemoveStoredPhoto()
  }

  const preview = filePreview ?? storedPreview

  return (
    <section className="border-t border-[var(--border-subtle)] pt-6">
      <div className="mb-4 flex items-center gap-2">
        <Camera className="h-4 w-4 text-[var(--accent)]" />
        <div>
          <h3 className="text-sm font-extrabold text-[var(--text-primary)]">Customer Photo</h3>
          <p className="mt-0.5 text-xs font-bold text-[var(--text-muted)]">Shown on the printed customer contract</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
        <div className="relative aspect-[4/5] overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)]">
          {cameraActive ? (
            <video ref={videoRef} muted playsInline className="h-full w-full -scale-x-100 object-cover" />
          ) : preview ? (
            <img src={preview} alt="Customer contract portrait" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
              <ImagePlus className="h-9 w-9" />
              <span className="text-xs font-extrabold">No photo</span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col justify-center gap-3">
          <input
            ref={uploadRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              selectPhoto(event.target.files?.[0])
              event.target.value = ''
            }}
          />

          <div className="flex flex-wrap gap-2">
            {cameraActive ? (
              <>
                <button type="button" onClick={capturePhoto} disabled={disabled} className="primary-action text-sm">
                  <Camera className="h-4 w-4" />
                  Take Photo
                </button>
                <button type="button" onClick={stopCamera} disabled={disabled} className="secondary-action text-sm">
                  <CameraOff className="h-4 w-4" />
                  Close Camera
                </button>
              </>
            ) : (
              <button type="button" onClick={startCamera} disabled={disabled || cameraStarting} className="primary-action text-sm disabled:cursor-wait disabled:opacity-60">
                {cameraStarting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                {preview ? 'Retake Photo' : 'Open Camera'}
              </button>
            )}

            <button type="button" onClick={() => uploadRef.current?.click()} disabled={disabled} className="secondary-action text-sm">
              <Upload className="h-4 w-4" />
              Upload Photo
            </button>

            {(preview || cameraActive) && (
              <button type="button" onClick={removePhoto} disabled={disabled} className="secondary-action text-sm text-[var(--coral)]">
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            )}
          </div>

          {(cameraError || error) && (
            <p className="text-xs font-bold text-[var(--coral)]">{cameraError || error}</p>
          )}
        </div>
      </div>
    </section>
  )
}
