'use client'

import { useEffect, useState } from 'react'
import {
  getAuditLogs,
  type AuditLog,
} from '@/app/lib/api'

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadAuditLogs() {
      try {
        setLoading(true)
        setError('')

        const data = await getAuditLogs(100, 0)

        if (!cancelled) {
          setLogs(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load audit logs',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadAuditLogs()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="min-h-screen p-5 sm:p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Audit Logs
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          Track privileged platform operations and administrative
          activity.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm font-medium text-red-300">
            Failed to load audit logs
          </p>

          <p className="mt-1 text-sm text-red-400/80">
            {error}
          </p>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03]">
            <tr className="text-left text-slate-400">
              <th className="px-4 py-3">
                Time
              </th>

              <th className="px-4 py-3">
                Actor
              </th>

              <th className="px-4 py-3">
                Action
              </th>

              <th className="px-4 py-3">
                Target
              </th>

              <th className="px-4 py-3">
                Target ID
              </th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  Loading audit logs...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  No audit logs found.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]"
                >
                  <td className="whitespace-nowrap px-4 py-4 text-slate-400">
                    {formatDateTime(log.created_at)}
                  </td>

                  <td className="px-4 py-4">
                    <div className="text-slate-300">
                      {log.actor_email ||
                        log.actor_user_id}
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <span className="inline-flex rounded-full bg-purple-500/10 px-2.5 py-1 text-xs font-medium text-purple-300">
                      {log.action}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-slate-300">
                    {log.target_type}
                  </td>

                  <td className="px-4 py-4 font-mono text-xs text-slate-500">
                    {log.target_id || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && logs.length > 0 && (
        <div className="mt-4 text-xs text-slate-500">
          Showing {logs.length} recent audit log
          {logs.length === 1 ? '' : 's'}.
        </div>
      )}
    </section>
  )
}

function formatDateTime(
  value: string | null | undefined,
) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleString()
}