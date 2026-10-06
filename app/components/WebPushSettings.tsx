"use client"

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/app/lib/api'
import {
  disableWebPush,
  enableWebPush,
  getWebPushSubscription,
  isWebPushSupported,
} from '@/app/lib/web_push'

export default function WebPushSettings() {
  const [supported, setSupported] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const refresh = useCallback(async () => {
    if (!isWebPushSupported()) {
      setSupported(false)
      setPermission('unsupported')
      setEnabled(false)
      return
    }

    setSupported(true)
    setPermission(Notification.permission)

    try {
      const subscription = await getWebPushSubscription()
      setEnabled(Boolean(subscription))
    } catch {
      setEnabled(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function handleEnable() {
    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const result = await enableWebPush(apiFetch)

      if (!result) {
        setPermission(Notification.permission)
        setError(
          Notification.permission === 'denied'
            ? 'Notifications are blocked for this browser. Allow notifications in the browser site settings, then try again.'
            : 'Notification permission was not granted.',
        )
        return
      }

      setPermission(Notification.permission)
      setEnabled(true)
      setSuccess('Push notifications are enabled on this device.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to enable push notifications.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDisable() {
    setBusy(true)
    setError('')
    setSuccess('')

    try {
      await disableWebPush(apiFetch)
      setEnabled(false)
      setSuccess('Push notifications are disabled on this device.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to disable push notifications.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mb-6 rounded-2xl border p-5 sm:p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.18em]" style={{ color: 'var(--accent)' }}>
            Notifications
          </p>
          <h2 className="mt-2 text-xl font-semibold">Browser & mobile push</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6" style={{ color: 'var(--text-muted)' }}>
            Receive Tynato CRM alerts for new leads and other workspace activity even when the CRM tab is not open.
          </p>
        </div>

        <div
          className="inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold"
          style={{
            borderColor: enabled ? 'rgba(34,197,94,0.22)' : 'var(--border-soft)',
            background: enabled ? 'rgba(34,197,94,0.08)' : 'var(--bg-surface)',
            color: enabled ? '#4ade80' : 'var(--text-muted)',
          }}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: enabled ? '#22c55e' : '#64748b' }} />
          {enabled ? 'Enabled' : 'Not enabled'}
        </div>
      </div>

      {!supported && (
        <div className="mt-5 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(245,158,11,0.20)', background: 'rgba(245,158,11,0.07)', color: '#fbbf24' }}>
          This browser does not support Web Push notifications.
        </div>
      )}

      {supported && permission === 'denied' && !enabled && (
        <div className="mt-5 rounded-xl border px-4 py-3 text-sm leading-6" style={{ borderColor: 'rgba(239,68,68,0.20)', background: 'rgba(239,68,68,0.07)', color: '#fca5a5' }}>
          Notifications are blocked for this site. Allow notifications in your browser's site settings, then return here.
        </div>
      )}

      {(error || success) && (
        <div className="mt-5 rounded-xl border px-4 py-3 text-sm leading-6" style={{ borderColor: error ? 'rgba(239,68,68,0.20)' : 'rgba(34,197,94,0.20)', background: error ? 'rgba(239,68,68,0.07)' : 'rgba(34,197,94,0.07)', color: error ? '#fca5a5' : '#86efac' }}>
          {error || success}
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-soft)' }}>
        <div>
          <p className="text-sm font-semibold">This device</p>
          <p className="mt-1 text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
            The subscription is tied to the signed-in user and current workspace.
          </p>
        </div>

        {supported && (enabled ? (
          <button
            type="button"
            onClick={() => void handleDisable()}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderColor: 'var(--border-soft)', color: 'var(--text-primary)', background: 'var(--bg-card)' }}
          >
            {busy ? 'Updating…' : 'Disable notifications'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleEnable()}
            disabled={busy || permission === 'denied'}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/15 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Enabling…' : 'Enable notifications'}
          </button>
        ))}
      </div>
    </section>
  )
}
