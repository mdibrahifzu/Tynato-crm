'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/app/lib/api'
import Sidebar from '@/app/components/Sidebar'

interface Connection {
  id: string
  meta_user_id: string
  status: string
  api_version: string
  connected_at: string
}

function Icon({ name, className = 'h-5 w-5' }: { name: string; className?: string }) {
  const common = {
    className,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
    'aria-hidden': true as const,
  }

  switch (name) {
    case 'meta':
      return (
        <svg {...common}>
          <path d="M4.8 15.5c1.8-5.8 4.6-8.9 7-8.9 2.1 0 2.8 2.4 4.1 5.9 1.1 3 1.7 4 3.2 4 1 0 1.8-.8 2.2-1.8" />
          <path d="M19.2 8.5c-1.8 5.8-4.6 8.9-7 8.9-2.1 0-2.8-2.4-4.1-5.9-1.1-3-1.7-4-3.2-4-1 0-1.8.8-2.2 1.8" />
        </svg>
      )
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 3l7 3v5c0 4.5-2.8 8.3-7 10-4.2-1.7-7-5.5-7-10V6l7-3z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      )
    case 'building':
      return (
        <svg {...common}>
          <path d="M4 21V5a2 2 0 0 1 2-2h8v18" />
          <path d="M14 9h4a2 2 0 0 1 2 2v10" />
          <path d="M8 7h2M8 11h2M8 15h2M17 13h1M17 17h1M4 21h17" />
        </svg>
      )
    case 'page':
      return (
        <svg {...common}>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
      )
    case 'megaphone':
      return (
        <svg {...common}>
          <path d="M4 13h3l9 4V7l-9 4H4z" />
          <path d="M7 13l1 5" />
          <path d="M19 10a3 3 0 0 1 0 4" />
        </svg>
      )
    case 'refresh':
      return (
        <svg {...common}>
          <path d="M20 11a8 8 0 0 0-14.8-4M4 5v4h4" />
          <path d="M4 13a8 8 0 0 0 14.8 4M20 19v-4h-4" />
        </svg>
      )
    case 'check':
      return (
        <svg {...common}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      )
    case 'alert':
      return (
        <svg {...common}>
          <path d="M12 4 20 20H4L12 4z" />
          <path d="M12 9v5M12 17h.01" />
        </svg>
      )
    case 'unlink':
      return (
        <svg {...common}>
          <path d="m9 15-2 2a3 3 0 0 1-4-4l3-3a3 3 0 0 1 4 0" />
          <path d="m15 9 2-2a3 3 0 0 1 4 4l-3 3a3 3 0 0 1-4 0" />
          <path d="m8 12 8 0" />
        </svg>
      )
    default:
      return null
  }
}

function statusLabel(status: string) {
  return status.replaceAll('_', ' ')
}

export default function MetaIntegrationPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [discovering, setDiscovering] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  async function loadConnections() {
    setError('')

    try {
      const response = await apiFetch('/meta/connections')
      const data = await response.json().catch(() => [])

      if (!response.ok) {
        throw new Error(data.detail || 'Unable to load Meta connections')
      }

      setConnections(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Meta connections')
    } finally {
      setLoading(false)
    }
  }

  async function connectMeta() {
    setConnecting(true)
    setMessage('')
    setError('')

    try {
      const response = await apiFetch('/meta/oauth/start', { method: 'POST' })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.auth_url) {
        throw new Error(data.detail || 'Unable to start Meta authorization')
      }

      window.location.assign(data.auth_url)
    } catch (err) {
      setConnecting(false)
      setError(err instanceof Error ? err.message : 'Unable to connect Meta')
    }
  }

  async function discoverAssets(id: string) {
    setDiscovering(id)
    setMessage('')
    setError('')

    try {
      const response = await apiFetch(`/meta/connections/${id}/discover`, {
        method: 'POST',
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.detail || 'Unable to discover Meta assets')
      }

      const summary = data.summary || {}

      setMessage(
        `Discovery complete: ${summary.businesses || 0} businesses, ${summary.pages || 0} pages, and ${summary.ad_accounts || 0} ad accounts.`
      )

      await loadConnections()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to discover Meta assets')
    } finally {
      setDiscovering(null)
    }
  }

  async function disconnectMeta(id: string) {
    setDisconnecting(id)
    setMessage('')
    setError('')

    try {
      const response = await apiFetch(`/meta/connections/${id}`, {
        method: 'DELETE',
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.detail || 'Unable to disconnect Meta')
      }

      setMessage('Meta connection disconnected.')
      await loadConnections()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to disconnect Meta')
    } finally {
      setDisconnecting(null)
    }
  }

  useEffect(() => {
    void loadConnections()
  }, [])

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-main)' }}>
      <Sidebar />

      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-7xl px-5 py-7 sm:px-8 lg:px-10">
          <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm">
                <span style={{ color: 'var(--text-muted)' }}>Settings</span>
                <span style={{ color: 'var(--text-muted)', opacity: 0.5 }}>/</span>
                <span style={{ color: 'var(--accent)' }}>Integrations</span>
              </div>

              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Meta Integration
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: 'var(--text-muted)' }}>
                Connect your Meta business assets to Tynato CRM. OAuth credentials remain on
                the backend and are never shown in the browser.
              </p>
            </div>

            <div
              className="inline-flex items-center gap-2 self-start rounded-full border px-3 py-2 text-xs font-medium sm:self-auto"
              style={{
                borderColor: 'rgba(59,130,246,0.25)',
                background: 'rgba(59,130,246,0.08)',
                color: 'var(--text-primary)',
              }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: 'var(--accent)' }} />
              Secure integration
            </div>
          </div>

          {(message || error) && (
            <div
              role="status"
              className="mb-6 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
              style={{
                borderColor: error ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)',
                background: error ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
              }}
            >
              <div
                className="mt-0.5 shrink-0"
                style={{ color: error ? '#f87171' : '#4ade80' }}
              >
                <Icon name={error ? 'alert' : 'check'} className="h-5 w-5" />
              </div>
              <p className="leading-6">{error || message}</p>
            </div>
          )}

          <section
            className="overflow-hidden rounded-2xl border"
            style={{
              background:
                'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(139,92,246,0.10) 45%, var(--bg-card) 100%)',
              borderColor: 'rgba(255,255,255,0.09)',
              boxShadow: '0 16px 50px rgba(0,0,0,0.18)',
            }}
          >
            <div className="grid gap-0 lg:grid-cols-[1.35fr_0.85fr]">
              <div className="p-6 sm:p-8 lg:p-10">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border bg-white/5">
                  <span style={{ color: '#60a5fa' }}>
                    <Icon name="meta" className="h-7 w-7" />
                  </span>
                </div>

                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: '#60a5fa' }}>
                  Marketing integration
                </p>

                <h2 className="max-w-xl text-2xl font-bold sm:text-3xl">
                  Bring Meta business assets into your CRM workflow
                </h2>

                <p className="mt-3 max-w-xl text-sm leading-6" style={{ color: 'var(--text-muted)' }}>
                  Connect once, then discover the Meta businesses, Pages, and ad accounts
                  that the signed-in organization is authorized to use.
                </p>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={connectMeta}
                    disabled={connecting}
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      background: 'var(--accent)',
                      boxShadow: '0 10px 24px rgba(59,130,246,0.22)',
                    }}
                  >
                    <Icon name="meta" className="h-5 w-5" />
                    {connecting ? 'Opening Meta…' : 'Connect Meta Ads'}
                  </button>

                  <div
                    className="inline-flex items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium"
                    style={{
                      borderColor: 'rgba(255,255,255,0.10)',
                      color: 'var(--text-muted)',
                      background: 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <Icon name="shield" className="h-4 w-4" />
                    Backend-managed credentials
                  </div>
                </div>
              </div>

              <div
                className="border-t p-6 lg:border-l lg:border-t-0 sm:p-8"
                style={{ borderColor: 'rgba(255,255,255,0.08)' }}
              >
                <p className="text-sm font-semibold">What this phase supports</p>

                <div className="mt-5 space-y-3">
                  {[
                    ['building', 'Business assets', 'Discover authorized Meta businesses'],
                    ['page', 'Facebook Pages', 'Discover Pages available to the connection'],
                    ['megaphone', 'Ad accounts', 'Discover authorized ad accounts'],
                  ].map(([icon, title, description]) => (
                    <div
                      key={title}
                      className="rounded-xl border p-4"
                      style={{
                        borderColor: 'rgba(255,255,255,0.08)',
                        background: 'rgba(255,255,255,0.025)',
                      }}
                    >
                      <div className="flex gap-3">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                          style={{
                            background: 'rgba(59,130,246,0.10)',
                            color: '#60a5fa',
                          }}
                        >
                          <Icon name={icon} className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{title}</p>
                          <p className="mt-1 text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
                            {description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-8">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Connected accounts</h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                  Manage the Meta connection for this CRM workspace.
                </p>
              </div>

              <span
                className="rounded-full px-3 py-1.5 text-xs font-medium"
                style={{
                  background: 'var(--bg-card)',
                  color: 'var(--text-muted)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {connections.length} {connections.length === 1 ? 'connection' : 'connections'}
              </span>
            </div>

            {loading ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {[1, 2].map((item) => (
                  <div
                    key={item}
                    className="animate-pulse rounded-2xl border p-6"
                    style={{
                      background: 'var(--bg-card)',
                      borderColor: 'rgba(255,255,255,0.08)',
                    }}
                  >
                    <div className="h-4 w-32 rounded bg-white/10" />
                    <div className="mt-3 h-3 w-48 rounded bg-white/5" />
                    <div className="mt-8 h-10 w-full rounded-xl bg-white/5" />
                  </div>
                ))}
              </div>
            ) : connections.length === 0 ? (
              <div
                className="rounded-2xl border p-8 text-center sm:p-10"
                style={{
                  background: 'var(--bg-card)',
                  borderColor: 'rgba(255,255,255,0.08)',
                }}
              >
                <div
                  className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{
                    background: 'rgba(59,130,246,0.10)',
                    color: '#60a5fa',
                  }}
                >
                  <Icon name="meta" className="h-6 w-6" />
                </div>

                <h3 className="mt-4 text-lg font-semibold">No Meta connection yet</h3>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6" style={{ color: 'var(--text-muted)' }}>
                  Connect a Meta account to start discovering the business assets available
                  to this CRM workspace.
                </p>

                <button
                  type="button"
                  onClick={connectMeta}
                  disabled={connecting}
                  className="mt-6 rounded-xl px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                  style={{ background: 'var(--accent)' }}
                >
                  {connecting ? 'Opening Meta…' : 'Connect Meta Ads'}
                </button>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {connections.map((connection) => {
                  const connected =
                    connection.status.toLowerCase() === 'connected' ||
                    connection.status.toLowerCase() === 'active'

                  return (
                    <article
                      key={connection.id}
                      className="rounded-2xl border p-6"
                      style={{
                        background: 'var(--bg-card)',
                        borderColor: 'rgba(255,255,255,0.08)',
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                            style={{
                              background: connected
                                ? 'rgba(34,197,94,0.10)'
                                : 'rgba(251,191,36,0.10)',
                              color: connected ? '#4ade80' : '#fbbf24',
                            }}
                          >
                            <Icon name={connected ? 'check' : 'alert'} className="h-5 w-5" />
                          </div>

                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold">
                              Meta connection
                            </h3>
                            <p className="mt-1 truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                              User ID: {connection.meta_user_id}
                            </p>
                          </div>
                        </div>

                        <span
                          className="rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize"
                          style={{
                            background: connected ? 'rgba(34,197,94,0.10)' : 'rgba(251,191,36,0.10)',
                            color: connected ? '#4ade80' : '#fbbf24',
                          }}
                        >
                          {statusLabel(connection.status)}
                        </span>
                      </div>

                      <div className="mt-6 grid grid-cols-2 gap-3">
                        <div
                          className="rounded-xl p-3"
                          style={{ background: 'var(--bg-surface)' }}
                        >
                          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            Graph API
                          </p>
                          <p className="mt-1 text-sm font-semibold">{connection.api_version}</p>
                        </div>

                        <div
                          className="rounded-xl p-3"
                          style={{ background: 'var(--bg-surface)' }}
                        >
                          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            Connected
                          </p>
                          <p className="mt-1 text-sm font-semibold">
                            {connection.connected_at
                              ? new Date(connection.connected_at).toLocaleDateString()
                              : '—'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => void discoverAssets(connection.id)}
                          disabled={discovering === connection.id || disconnecting === connection.id}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                          style={{ background: 'var(--accent)', color: '#fff' }}
                        >
                          <Icon name="refresh" className="h-4 w-4" />
                          {discovering === connection.id ? 'Discovering…' : 'Discover assets'}
                        </button>

                        <button
                          type="button"
                          onClick={() => void disconnectMeta(connection.id)}
                          disabled={discovering === connection.id || disconnecting === connection.id}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:bg-white/5 disabled:opacity-60"
                          style={{
                            borderColor: 'rgba(255,255,255,0.10)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          <Icon name="unlink" className="h-4 w-4" />
                          {disconnecting === connection.id ? 'Disconnecting…' : 'Disconnect'}
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          <section
            className="mt-8 rounded-2xl border p-6 sm:p-7"
            style={{
              background: 'var(--bg-surface)',
              borderColor: 'rgba(255,255,255,0.08)',
            }}
          >
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--accent)' }}>
                  Integration flow
                </p>
                <h2 className="mt-2 text-xl font-bold">How the connection works</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: 'var(--text-muted)' }}>
                  OAuth authorization is completed through the CRM backend. Tokens stay
                  encrypted in the database, and Meta tables are tenant-isolated.
                </p>
              </div>

              <div
                className="inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs"
                style={{
                  borderColor: 'rgba(34,197,94,0.20)',
                  background: 'rgba(34,197,94,0.06)',
                  color: '#86efac',
                }}
              >
                <Icon name="shield" className="h-4 w-4" />
                Tenant aware
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {[
                ['01', 'Authorize', 'Sign in with Meta and grant the requested permissions.'],
                ['02', 'Discover', 'Find the Meta businesses, Pages, and ad accounts available to the workspace.'],
                ['03', 'Manage', 'Keep the connection visible here and disconnect it when access is no longer required.'],
              ].map(([step, title, description]) => (
                <div
                  key={step}
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: 'rgba(255,255,255,0.08)',
                    background: 'var(--bg-card)',
                  }}
                >
                  <span
                    className="text-xs font-bold"
                    style={{ color: 'var(--accent)' }}
                  >
                    {step}
                  </span>
                  <h3 className="mt-2 text-sm font-semibold">{title}</h3>
                  <p className="mt-1 text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
