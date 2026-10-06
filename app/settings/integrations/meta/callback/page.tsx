'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiFetch } from '@/app/lib/api'
import Sidebar from '@/app/components/Sidebar'

function Spinner() {
  return (
    <span
      className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white"
      aria-hidden="true"
    />
  )
}

export default function MetaCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sent = useRef(false)

  const [message, setMessage] = useState('Completing Meta authorization…')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (sent.current) return
    sent.current = true

    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    window.history.replaceState({}, document.title, '/integrations/meta/callback')

    if (error || !code || !state) {
      setFailed(true)
      setMessage('Meta authorization was cancelled or returned an invalid response.')
      return
    }

    void (async () => {
      try {
        const response = await apiFetch('/meta/oauth/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, state }),
        })

        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(data.detail || 'Meta authorization failed')
        }

        setMessage('Meta connected successfully. Redirecting to Integrations…')
        window.setTimeout(() => router.replace('/integrations/meta'), 650)
      } catch (err) {
        setFailed(true)
        setMessage(err instanceof Error ? err.message : 'Meta authorization failed')
      }
    })()
  }, [router, searchParams])

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-main)' }}>
      <Sidebar />

      <main className="flex min-w-0 flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <section
          className="w-full max-w-lg rounded-2xl border p-7 text-center sm:p-10"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'rgba(255,255,255,0.08)',
            boxShadow: '0 18px 55px rgba(0,0,0,0.22)',
          }}
        >
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              background: failed ? 'rgba(239,68,68,0.10)' : 'rgba(59,130,246,0.10)',
              color: failed ? '#f87171' : '#60a5fa',
            }}
          >
            {failed ? (
              <span className="text-2xl font-bold">!</span>
            ) : (
              <Spinner />
            )}
          </div>

          <h1 className="mt-5 text-2xl font-bold">
            {failed ? 'Meta authorization failed' : 'Connecting Meta'}
          </h1>

          <p className="mx-auto mt-3 max-w-md text-sm leading-6" style={{ color: 'var(--text-muted)' }}>
            {message}
          </p>

          {failed && (
            <button
              type="button"
              onClick={() => router.replace('/integrations/meta')}
              className="mt-7 rounded-xl px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
              style={{ background: 'var(--accent)' }}
            >
              Back to Integrations
            </button>
          )}
        </section>
      </main>
    </div>
  )
}
