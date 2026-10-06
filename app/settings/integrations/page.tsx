'use client'

import Link from 'next/link'
import Sidebar from '@/app/components/Sidebar'

const integrations = [
  {
    name: 'Meta Ads',
    description:
      'Connect Meta Business assets, import leads, and prepare campaign and performance sync.',
    href: '/integrations/meta',
    status: 'Available',
    active: true,
  },
  {
    name: 'Google Ads',
    description:
      'Connect Google Ads when the advertising integration is released.',
    href: '#',
    status: 'Coming Soon',
    active: false,
  },
  {
    name: 'WhatsApp Business',
    description:
      'Connect WhatsApp Business for future customer messaging workflows.',
    href: '#',
    status: 'Coming Soon',
    active: false,
  },
  {
    name: 'Email Marketing',
    description:
      'Connect email marketing tools for future campaign workflows.',
    href: '#',
    status: 'Coming Soon',
    active: false,
  },
]

export default function IntegrationsSettingsPage() {
  return (
    <div
      className="flex min-h-screen"
      style={{ background: 'var(--bg-main)' }}
    >
      <Sidebar />

      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 lg:px-10">
          <div className="mb-8">
            <div className="mb-3 flex items-center gap-2 text-sm">
              <Link
                href="/settings"
                className="transition hover:opacity-80"
                style={{ color: 'var(--text-muted)' }}
              >
                Settings
              </Link>

              <span style={{ color: 'var(--text-muted)', opacity: 0.45 }}>
                /
              </span>

              <span style={{ color: 'var(--accent)' }}>
                Integrations
              </span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Integrations
            </h1>

            <p
              className="mt-2 max-w-2xl text-sm leading-6"
              style={{ color: 'var(--text-muted)' }}
            >
              Connect external platforms to Tynato CRM while keeping
              credentials, organization access, and data flows controlled
              by the backend.
            </p>
          </div>

          <div className="space-y-4">
            {integrations.map((integration) => {
              const card = (
                <div
                  className="flex items-center gap-4 rounded-2xl border p-5 transition sm:gap-5"
                  style={{
                    background: 'var(--bg-card)',
                    borderColor: integration.active
                      ? 'rgba(59,130,246,0.35)'
                      : 'rgba(255,255,255,0.08)',
                    opacity: integration.active ? 1 : 0.72,
                  }}
                >
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl font-semibold"
                    style={{
                      background: integration.active
                        ? 'rgba(59,130,246,0.11)'
                        : 'rgba(255,255,255,0.05)',
                      color: integration.active
                        ? 'var(--accent)'
                        : 'var(--text-muted)',
                    }}
                  >
                    {integration.name === 'Meta Ads' ? '∞' : '•'}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold">
                        {integration.name}
                      </h2>

                      <span
                        className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                        style={{
                          background: integration.active
                            ? 'rgba(34,197,94,0.10)'
                            : 'rgba(255,255,255,0.05)',
                          color: integration.active
                            ? '#4ade80'
                            : 'var(--text-muted)',
                        }}
                      >
                        {integration.status}
                      </span>
                    </div>

                    <p
                      className="mt-1 text-sm leading-6"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {integration.description}
                    </p>
                  </div>

                  {integration.active && (
                    <span
                      className="shrink-0 text-xl"
                      style={{ color: 'var(--accent)' }}
                    >
                      →
                    </span>
                  )}
                </div>
              )

              return integration.active ? (
                <Link
                  key={integration.name}
                  href={integration.href}
                  className="block"
                >
                  {card}
                </Link>
              ) : (
                <div key={integration.name}>{card}</div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
