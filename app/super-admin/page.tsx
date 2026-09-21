'use client'

import { useEffect, useState } from 'react'
import {
  getSuperAdminDashboard,
  type SuperAdminDashboard,
} from '@/app/lib/api'

export default function SuperAdminDashboardPage() {
  const [stats, setStats] =
    useState<SuperAdminDashboard | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadDashboard() {
      try {
        setLoading(true)
        setError('')

        const data = await getSuperAdminDashboard()

        if (!cancelled) {
          setStats(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load platform dashboard.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadDashboard()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <PageShell
      title="Platform Dashboard"
      description="Global Tynato platform administration."
    >
      {loading && <LoadingState />}

      {!loading && error && (
        <ErrorState message={error} />
      )}

      {!loading && !error && stats && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Organizations"
              value={stats.organizations.total}
            />

            <StatCard
              label="Active Organizations"
              value={stats.organizations.active}
            />

            <StatCard
              label="Suspended Organizations"
              value={stats.organizations.suspended}
            />

            <StatCard
              label="Total Users"
              value={stats.users}
            />
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <InfoCard
              title="Platform Access"
              value={`${stats.super_admins} Super Admin`}
              description="Accounts currently assigned platform-level administration access."
            />

            <InfoCard
              title="Organization Status"
              value={`${stats.organizations.active} Active`}
              description={`${stats.organizations.suspended} organization(s) currently suspended.`}
            />
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">
                  Platform Control Center
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Use this console to manage organizations,
                  platform modules, users, privileged activity,
                  and system health. Business CRM data remains
                  inside the normal organization workflow.
                </p>
              </div>

              <div className="shrink-0 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                Protected
              </div>
            </div>
          </div>
        </>
      )}
    </PageShell>
  )
}

function PageShell({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="min-h-screen p-5 sm:p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {title}
        </h1>

        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            {description}
          </p>
        )}
      </header>

      {children}
    </section>
  )
}

function StatCard({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-sm text-slate-400">
        {label}
      </p>

      <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
        {value.toLocaleString()}
      </p>
    </div>
  )
}

function InfoCard({
  title,
  value,
  description,
}: {
  title: string
  value: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-sm text-slate-400">
        {title}
      </p>

      <p className="mt-3 text-xl font-semibold text-white">
        {value}
      </p>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]"
        />
      ))}
    </div>
  )
}

function ErrorState({
  message,
}: {
  message: string
}) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
      <p className="text-sm font-medium text-red-300">
        Unable to load Super Admin dashboard
      </p>

      <p className="mt-1 text-sm text-red-400/80">
        {message}
      </p>
    </div>
  )
}