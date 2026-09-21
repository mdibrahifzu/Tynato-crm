'use client'

import { useEffect, useState } from 'react'
import {
  getGlobalModules,
  updateGlobalModule,
  type ModuleSetting,
} from '@/app/lib/api'

export default function ModulesPage() {
  const [modules, setModules] = useState<ModuleSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadModules() {
      try {
        setLoading(true)
        setError('')

        const data = await getGlobalModules()

        if (!cancelled) {
          setModules(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load modules',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadModules()

    return () => {
      cancelled = true
    }
  }, [])

  async function toggleModule(module: ModuleSetting) {
    if (saving) return

    setSaving(module.module_key)
    setError('')

    try {
      const updated = await updateGlobalModule(
        module.module_key,
        !module.is_enabled,
      )

      setModules((current) =>
        current.map((item) =>
          item.module_key === updated.module_key
            ? updated
            : item,
        ),
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to update module',
      )
    } finally {
      setSaving(null)
    }
  }

  return (
    <section className="min-h-screen p-5 sm:p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Global Modules
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          Control which CRM modules are available across the
          Tynato platform.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm font-medium text-red-300">
            Module operation failed
          </p>

          <p className="mt-1 text-sm text-red-400/80">
            {error}
          </p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]"
            />
          ))}
        </div>
      ) : modules.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <p className="text-sm text-slate-400">
            No modules are configured.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {modules.map((module) => {
            const isSaving =
              saving === module.module_key

            return (
              <div
                key={module.module_key}
                className="flex flex-col gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <h2 className="font-medium text-white">
                      {module.module_name}
                    </h2>

                    <span
                      className={[
                        'rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-wide',
                        module.is_enabled
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-slate-500/10 text-slate-400',
                      ].join(' ')}
                    >
                      {module.is_enabled
                        ? 'Active'
                        : 'Disabled'}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    {module.module_key}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => toggleModule(module)}
                  className={[
                    'rounded-lg px-4 py-2 text-sm font-medium transition',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    module.is_enabled
                      ? 'bg-red-500/10 text-red-300 hover:bg-red-500/20'
                      : 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20',
                  ].join(' ')}
                >
                  {isSaving
                    ? 'Saving...'
                    : module.is_enabled
                      ? 'Disable'
                      : 'Enable'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}