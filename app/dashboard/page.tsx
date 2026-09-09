'use client'

import Sidebar from '../components/Sidebar'
import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import { apiFetch } from '@/app/lib/api'

interface DashboardStats {
  total_leads: number
  interested: number
  follow_up: number
  converted: number
  recent_searches: string[]
  total_users: number
}

const emptyStats: DashboardStats = {
  total_leads: 0,
  interested: 0,
  follow_up: 0,
  converted: 0,
  recent_searches: [],
  total_users: 0,
}

function percent(value: number, total: number) {
  if (!total) return 0
  return Math.min(100, Math.max(0, (value / total) * 100))
}

function StatCard({
  label,
  value,
  helper,
  icon,
  accent,
}: {
  label: string
  value: number
  helper: string
  icon: string
  accent: string
}) {
  return (
    <div className="crm-card relative overflow-hidden p-5">
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: accent }}
      />

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-400">
            {label}
          </p>

          <p className="mt-2 text-3xl font-bold tracking-tight">
            {value}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            {helper}
          </p>
        </div>

        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl text-lg"
          style={{
            background: 'var(--accent-soft)',
            color: accent,
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}

function FunnelRow({
  label,
  value,
  total,
  barClass,
}: {
  label: string
  value: number
  total: number
  barClass: string
}) {
  const width = percent(value, total)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4 text-sm">
        <span className="text-slate-400">
          {label}
        </span>
        <span className="font-semibold">
          {value}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className={`h-full rounded-full ${barClass}`}
          style={{ width: `${label === 'Total Leads' ? 100 : width}%` }}
        />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(emptyStats)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuthentication()
  }, [])

  async function checkAuthentication() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      window.location.href = '/login'
      return
    }

    fetchDashboard()
  }

  async function fetchDashboard() {
    try {
      const response = await apiFetch('/dashboard')

      if (!response.ok) {
        throw new Error(
          `Failed to fetch dashboard: ${response.status}`
        )
      }

      const data = await response.json()

      console.log('Dashboard Data:', data)

      setStats({
        total_leads: data.total_leads || 0,
        interested: data.interested || 0,
        follow_up: data.follow_up || 0,
        converted: data.converted || 0,
        recent_searches: data.recent_searches || [],
        total_users: data.total_users || 0,
      })
    } catch (error) {
      console.error('Dashboard Error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="crm-page flex min-h-screen">
        <Sidebar />

        <main className="min-w-0 flex-1 p-5 sm:p-7 lg:p-10">
          <div className="mx-auto max-w-7xl">
            <div className="animate-pulse space-y-5">
              <div className="h-8 w-64 rounded bg-white/[0.06]" />
              <div className="h-4 w-96 max-w-full rounded bg-white/[0.04]" />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-36 rounded-2xl bg-white/[0.05]"
                  />
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="crm-page flex min-h-screen">
      <Sidebar />

      <main className="min-w-0 flex-1 p-5 sm:p-7 lg:p-10">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <header className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
                Overview
              </p>

              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Tynato CRM Dashboard
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                A live overview of your current lead pipeline and recent
                CRM activity.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-slate-400">
              Live CRM overview
            </div>
          </header>

          {/* Stats */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total Leads"
              value={stats.total_leads}
              helper="All leads currently in CRM"
              icon="◉"
              accent="#60a5fa"
            />

            <StatCard
              label="Interested"
              value={stats.interested}
              helper="Leads showing interest"
              icon="↗"
              accent="#34d399"
            />

            <StatCard
              label="Follow Up"
              value={stats.follow_up}
              helper="Leads requiring follow-up"
              icon="◷"
              accent="#fbbf24"
            />

            <StatCard
              label="Converted"
              value={stats.converted}
              helper="Leads marked converted"
              icon="✓"
              accent="#a78bfa"
            />
          </section>

          {/* Main analytics */}
          <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.9fr]">
            <div className="crm-card p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    Lead Funnel
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Current distribution across the main lead states.
                  </p>
                </div>

                <span className="rounded-full border border-blue-400/10 bg-blue-400/10 px-3 py-1 text-[11px] font-medium text-blue-300">
                  {stats.total_leads} total
                </span>
              </div>

              <div className="mt-8 space-y-7">
                <FunnelRow
                  label="Total Leads"
                  value={stats.total_leads}
                  total={stats.total_leads}
                  barClass="bg-blue-400"
                />

                <FunnelRow
                  label="Interested"
                  value={stats.interested}
                  total={stats.total_leads}
                  barClass="bg-emerald-400"
                />

                <FunnelRow
                  label="Follow Up"
                  value={stats.follow_up}
                  total={stats.total_leads}
                  barClass="bg-amber-400"
                />

                <FunnelRow
                  label="Converted"
                  value={stats.converted}
                  total={stats.total_leads}
                  barClass="bg-violet-400"
                />
              </div>
            </div>

            <div className="crm-card p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    Quick Metrics
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Useful context from the existing dashboard API.
                  </p>
                </div>

                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] text-slate-300">
                  ◌
                </span>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="crm-surface p-4">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">
                    Interest rate
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {Math.round(
                      percent(
                        stats.interested,
                        stats.total_leads
                      )
                    )}%
                  </p>
                </div>

                <div className="crm-surface p-4">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">
                    Conversion rate
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {Math.round(
                      percent(
                        stats.converted,
                        stats.total_leads
                      )
                    )}%
                  </p>
                </div>

                <div className="crm-surface col-span-2 p-4">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">
                    Team users
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {stats.total_users}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Recent searches */}
          <section className="crm-card mt-6 p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Recent Searches
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Latest search activity already returned by the dashboard API.
                </p>
              </div>

              <span className="text-xs text-slate-500">
                {stats.recent_searches.length} recent
              </span>
            </div>

            <div className="mt-5">
              {stats.recent_searches.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {stats.recent_searches.map((search, index) => (
                    <div
                      key={`${search}-${index}`}
                      className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-4 py-3 transition hover:bg-white/[0.04]"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-300">
                        ⌕
                      </span>

                      <span className="min-w-0 truncate text-sm text-slate-300">
                        {search}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 px-5 py-10 text-center">
                  <div className="text-3xl">⌕</div>
                  <p className="mt-3 font-medium">
                    No recent searches
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Search activity will appear here when available.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
