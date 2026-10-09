'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/app/lib/api'

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}

function sameKey(sub: PushSubscription, key: Uint8Array) {
  const current = sub.options?.applicationServerKey
  if (!current) return false
  const a = new Uint8Array(current)
  return a.length === key.length && a.every((value, index) => value === key[index])
}

type State = 'hidden' | 'ask' | 'busy' | 'on' | 'blocked'

export default function PushEnable() {
  const [state, setState] = useState<State>('hidden')
  const [error, setError] = useState('')

  const subscribe = useCallback(async () => {
    await navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
    const registration = await navigator.serviceWorker.ready

    const keyResponse = await apiFetch('/web-push/public-key')
    if (!keyResponse.ok) throw new Error('Web push is not configured on the server.')
    const { public_key } = await keyResponse.json()
    const key = urlBase64ToUint8Array(public_key)

    let sub = await registration.pushManager.getSubscription()

    // A subscription made with a different VAPID key can never receive pushes.
    if (sub && !sameKey(sub, key)) {
      await sub.unsubscribe()
      sub = null
    }

    if (!sub) {
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key as unknown as BufferSource,
      })
    }

    const json = sub.toJSON()
    const response = await apiFetch('/web-push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
        expirationTime: json.expirationTime ?? null,
      }),
    })

    if (!response.ok) throw new Error('Could not save the push subscription.')
  }, [])

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      return
    }

    if (Notification.permission === 'denied') {
      setState('blocked')
      return
    }

    if (Notification.permission === 'granted') {
      // Quietly refresh the subscription (handles expired ones).
      subscribe()
        .then(() => setState('on'))
        .catch((err) => {
          console.error('Push refresh failed:', err)
          setState('ask')
        })
      return
    }

    setState('ask')
  }, [subscribe])

  const enable = async () => {
    try {
      setError('')
      setState('busy')

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'blocked' : 'ask')
        return
      }

      await subscribe()
      setState('on')
    } catch (err) {
      console.error('Push enable failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to enable push.')
      setState('ask')
    }
  }

  if (state === 'hidden' || state === 'on') return null

  if (state === 'blocked') {
    return (
      <p className="mb-1 px-3 py-2 text-[11px] max-lg:hidden" style={{ color: 'var(--text-soft)' }}>
        Push is blocked. Allow notifications for this site in your browser settings.
      </p>
    )
  }

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => void enable()}
        disabled={state === 'busy'}
        title="Enable push notifications"
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-xs font-medium transition hover:bg-white/[0.05] disabled:opacity-50 max-lg:justify-center"
        style={{ color: 'var(--accent)' }}
      >
        <span>🔔</span>
        <span className="max-lg:hidden">
          {state === 'busy' ? 'Enabling…' : 'Enable push alerts'}
        </span>
      </button>
      {error && (
        <p className="px-3 text-[11px] text-rose-300 max-lg:hidden">{error}</p>
      )}
    </div>
  )
}
