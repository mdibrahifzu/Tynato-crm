'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'
import { apiFetch } from '@/app/lib/api'

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function finishAuth() {
      const mode =
        searchParams.get('mode') === 'link'
          ? 'link'
          : 'login'

      const authError =
        searchParams.get('error') ||
        searchParams.get('error_description')

      if (authError) {
        if (active) {
          setError('Facebook authorization was cancelled or failed.')
        }
        return
      }

      // Browser clients can already have the session persisted by
      // Supabase Auth. Only exchange the code when no session exists.
      let { data: sessionData } =
        await supabase.auth.getSession()

      const code = searchParams.get('code')

      if (!sessionData.session && code) {
        const { data, error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code)

        if (exchangeError) {
          if (active) {
            setError(exchangeError.message)
          }
          return
        }

        sessionData = data
      }

      if (!sessionData.session) {
        if (active) {
          setError(
            'Facebook sign-in completed without an active CRM session.',
          )
        }
        return
      }

      if (mode === 'link') {
        router.replace('/settings')
        return
      }

      // Keep the existing Super Admin routing behavior.
      try {
        const response = await apiFetch('/super-admin/access-check')
        if (response.ok) {
          const data = await response.json().catch(() => null)

          if (
            data?.success &&
            data?.platform_role === 'super_admin'
          ) {
            router.replace('/super-admin')
            return
          }
        }
      } catch {
        // Normal CRM users continue below.
      }

      // Existing CRM team resolution determines whether the account
      // has an organization. Do not manufacture a team here.
      try {
        const response = await apiFetch('/team/me')

        if (response.ok) {
          const data = await response.json()

          if (data?.has_team) {
            router.replace('/dashboard')
            return
          }

          router.replace('/users')
          return
        }
      } catch {
        // Fall back to the dashboard so existing behavior is preserved.
      }

      router.replace('/dashboard')
    }

    void finishAuth()

    return () => {
      active = false
    }
  }, [router, searchParams])

  return (
    <main
      className="flex min-h-screen items-center justify-center px-6"
      style={{ background: 'var(--bg-main)' }}
    >
      <section
        className="w-full max-w-md rounded-2xl border p-8 text-center"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'rgba(255,255,255,0.08)',
        }}
      >
        <h1 className="text-xl font-bold">
          {error ? 'Facebook sign-in failed' : 'Completing sign-in…'}
        </h1>

        <p
          className="mt-3 text-sm leading-6"
          style={{ color: error ? '#fca5a5' : 'var(--text-muted)' }}
        >
          {error || 'Please wait while Tynato CRM completes the authentication flow.'}
        </p>

        {error && (
          <button
            type="button"
            onClick={() => router.replace('/login')}
            className="mt-6 rounded-xl px-5 py-3 text-sm font-semibold text-white"
            style={{ background: 'var(--accent)' }}
          >
            Back to Login
          </button>
        )}
      </section>
    </main>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main
          className="flex min-h-screen items-center justify-center"
          style={{ background: 'var(--bg-main)' }}
        >
          <p className="text-sm">Completing sign-in…</p>
        </main>
      }
    >
      <CallbackContent />
    </Suspense>
  )
}
