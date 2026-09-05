'use client'

function resolveApiBaseUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL

  const isLocalBrowser =
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1'].includes(window.location.hostname)

  const baseUrl = configuredUrl ?? (isLocalBrowser ? '/api' : 'http://127.0.0.1:8000/api')

  const normalizedUrl = baseUrl.replace(/\/+$/, '')

  return normalizedUrl.endsWith('/api') ? normalizedUrl : `${normalizedUrl}/api`
}

export const API_BASE_URL = resolveApiBaseUrl()
const authSessionChangeEvent = 'wsmis-auth-session-change'

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
}

export class ApiError extends Error {
  status: number
  errors?: Record<string, string[]>

  constructor(message: string, status: number, errors?: Record<string, string[]>) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

export function getAuthToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('waternet_token')
}

export function hasAuthSession(): boolean | null {
  return Boolean(getAuthToken())
}

export function getServerAuthSession(): boolean | null {
  return null
}

export function subscribeToAuthSession(notify: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || ['waternet_token', 'waternet_user'].includes(event.key)) notify()
  }

  window.addEventListener('storage', handleStorage)
  window.addEventListener(authSessionChangeEvent, notify)

  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(authSessionChangeEvent, notify)
  }
}

export function setAuthSession(token: string, user: unknown) {
  localStorage.setItem('waternet_token', token)
  localStorage.setItem('waternet_user', JSON.stringify(user))
  window.dispatchEvent(new Event(authSessionChangeEvent))
}

export function clearAuthSession() {
  localStorage.removeItem('waternet_token')
  localStorage.removeItem('waternet_user')
  window.dispatchEvent(new Event(authSessionChangeEvent))
}

export function getStoredUser<T>() {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('waternet_user')
  if (!raw) return null

  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getAuthToken()
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  const contentType = response.headers.get('content-type') ?? ''
  const payload = contentType.includes('application/json') ? await response.json() : null

  if (!response.ok) {
    throw new ApiError(payload?.message ?? 'Request failed', response.status, payload?.errors)
  }

  return payload as T
}

export async function downloadApiFile(path: string, filename: string): Promise<void> {
  const token = getAuthToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Accept: 'application/octet-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!response.ok) {
    let message = 'Unable to download file.'
    try { message = (await response.json())?.message ?? message } catch { /* Non-JSON download error. */ }
    throw new ApiError(message, response.status)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
