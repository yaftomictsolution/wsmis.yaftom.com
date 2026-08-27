'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowRight, CircleAlert, Droplets, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { ApiError, apiRequest, setAuthSession } from '@/lib/api'
import { useLanguage } from '@/context/LanguageContext'

type LoginResponse = {
  token: string
  user: unknown
}

export default function LoginPage() {
  const router = useRouter()
  const { translate } = useLanguage()
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [sessionNotice, setSessionNotice] = useState('')

  useEffect(() => {
    const expired = new URLSearchParams(window.location.search).get('reason') === 'session_expired'
      || sessionStorage.getItem('wsmis_session_expired') === '1'
    if (expired) setSessionNotice('Your session expired. Please sign in again.')
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    const form = new FormData(event.currentTarget)

    try {
      const response = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: {
          email: form.get('email'),
          password: form.get('password'),
        },
      })
      setAuthSession(response.token, response.user)
      const nextPath = sessionStorage.getItem('wsmis_auth_next')
      sessionStorage.removeItem('wsmis_auth_next')
      sessionStorage.removeItem('wsmis_session_expired')
      router.replace(nextPath?.startsWith('/dashboard') ? nextPath : '/dashboard')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : translate('Unable to login. Is the Laravel API running?'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="app-shell dashboard-main min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(56,189,248,0.18),transparent_32%),linear-gradient(135deg,rgba(2,132,199,0.12),transparent_42%,rgba(45,212,191,0.10))]" />

      <div className="w-full max-w-md relative z-10">
        <div className="elegant-panel p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="brand-mark h-10 w-10 rounded-lg flex items-center justify-center">
              <Droplets className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)] font-extrabold">{translate('WaterNet MIS')}</p>
              <h1 className="text-xl font-extrabold text-[var(--text-primary)]">{translate('Sign in')}</h1>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {sessionNotice && (
              <div className="flex items-start gap-2 rounded-lg border border-[var(--accent)]/35 bg-[var(--accent-soft)] px-3 py-2 text-sm font-bold text-[var(--accent-strong)]">
                <CircleAlert className="mt-0.5 h-4 w-4 flex-none" />
                <span>{translate(sessionNotice)}</span>
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-3 py-2 text-sm font-bold text-[var(--coral)]">
                {error}
              </div>
            )}

            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-[var(--text-secondary)]">{translate('Email')}</span>
              <span className="relative block">
                <Mail className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="admin@waternet.local"
                  className="field-control h-11 ps-10 pe-3 text-sm"
                />
              </span>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-[var(--text-secondary)]">{translate('Password')}</span>
              <span className="relative block">
                <LockKeyhole className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder={translate('Enter your password')}
                  className="field-control h-11 ps-10 pe-10 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  aria-label={showPassword ? translate('Hide password') : translate('Show password')}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>

            <div className="flex items-center justify-between text-xs">
              <label className="inline-flex items-center gap-2 text-[var(--text-muted)]">
                <input type="checkbox" className="rounded border-[var(--border-subtle)]" />
                {translate('Remember me')}
              </label>
              <button type="button" className="font-bold text-[var(--accent)] hover:text-[var(--accent-strong)]">
                {translate('Forgot password')}
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="primary-action h-11 w-full text-sm"
            >
              {isSubmitting ? translate('Signing in...') : translate('Login')}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

        </div>
      </div>
    </main>
  )
}

