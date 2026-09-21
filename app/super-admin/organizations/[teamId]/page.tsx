'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import {
  getOrganization,
  getOrganizationModules,
  updateOrganizationModule,
  updateOrganizationStatus,
  type Organization,
  type OrganizationModuleSetting,
} from '@/app/lib/api'


export default function OrganizationManagePage() {
  const params = useParams()

  const teamId = String(params.teamId)

  const [organization, setOrganization] =
    useState<Organization | null>(null)

  const [modules, setModules] =
    useState<OrganizationModuleSetting[]>([])

  const [loading, setLoading] =
    useState(true)

  const [savingModule, setSavingModule] =
    useState<string | null>(null)

  const [savingStatus, setSavingStatus] =
    useState(false)

  const [error, setError] =
    useState('')


  /* =========================================================
     LOAD ORGANIZATION
     ========================================================= */

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError('')

        const [org, moduleData] =
          await Promise.all([
            getOrganization(teamId),
            getOrganizationModules(teamId),
          ])

        if (cancelled) {
          return
        }

        setOrganization(org)

        // IMPORTANT:
        // getOrganizationModules() returns an object.
        // We need the actual modules array.
        setModules(moduleData.modules)

      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load organization',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [teamId])


  /* =========================================================
     UPDATE MODULE OVERRIDE
     
     null  -> Inherit Global
     true  -> Enable for Organization
     false -> Disable for Organization
     ========================================================= */

  async function updateModuleOverride(
    module: OrganizationModuleSetting,
    accessOverride: boolean | null,
  ) {
    if (savingModule !== null) {
      return
    }

    const previousModules = modules

    const globalEnabled =
      module.global_enabled

    const effectiveEnabled =
      organization?.status !== 'active'
        ? false
        : accessOverride !== null
          ? accessOverride
          : globalEnabled

    /*
     * Optimistic update
     */
    setModules((current) =>
      current.map((item) => {
        if (
          item.module_key !== module.module_key
        ) {
          return item
        }

        return {
          ...item,
          organization_override:
            accessOverride,
          effective_enabled:
            effectiveEnabled,
        }
      }),
    )

    setSavingModule(module.module_key)
    setError('')

    try {
      const updated =
        await updateOrganizationModule(
          teamId,
          module.module_key,
          accessOverride,
        )

      /*
       * Reconcile with backend.
       */
      setModules((current) =>
        current.map((item) => {
          if (
            item.module_key !==
            updated.module_key
          ) {
            return item
          }

          return {
            ...item,
            global_enabled:
              updated.global_enabled,
            organization_override:
              updated.access_override,
            effective_enabled:
              updated.effective_enabled,
          }
        }),
      )
    } catch (err) {
      /*
       * Roll back optimistic update.
       */
      setModules(previousModules)

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to update module',
      )
    } finally {
      setSavingModule(null)
    }
  }


  /* =========================================================
     ORGANIZATION STATUS
     ========================================================= */

  async function toggleOrganizationStatus() {
    if (
      !organization ||
      savingStatus
    ) {
      return
    }

    const previousStatus =
      organization.status

    const nextStatus =
      previousStatus === 'active'
        ? 'suspended'
        : 'active'

    /*
     * Optimistic status update.
     */
    setOrganization((current) =>
      current
        ? {
            ...current,
            status: nextStatus,
          }
        : current,
    )

    setSavingStatus(true)
    setError('')

    try {
      const updated =
        await updateOrganizationStatus(
          organization.id,
          nextStatus,
        )

      setOrganization((current) =>
        current
          ? {
              ...current,
              ...updated,
            }
          : updated,
      )

      /*
       * If organization becomes suspended,
       * every module is effectively locked.
       */
      if (nextStatus === 'suspended') {
        setModules((current) =>
          current.map((module) => ({
            ...module,
            effective_enabled: false,
          })),
        )
      } else {
        /*
         * Reload module access when reactivated.
         */
        const refreshed =
          await getOrganizationModules(
            teamId,
          )

        setModules(refreshed.modules)
      }

    } catch (err) {
      setOrganization((current) =>
        current
          ? {
              ...current,
              status: previousStatus,
            }
          : current,
      )

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to update organization status',
      )
    } finally {
      setSavingStatus(false)
    }
  }


  /* =========================================================
     LOADING
     ========================================================= */

  if (loading) {
    return (
      <section className="min-h-screen p-5 sm:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-white/5" />

          <div className="h-28 rounded-2xl bg-white/[0.03]" />

          <div className="h-96 rounded-2xl bg-white/[0.03]" />
        </div>
      </section>
    )
  }


  /* =========================================================
     ORGANIZATION NOT FOUND
     ========================================================= */

  if (!organization) {
    return (
      <section className="min-h-screen p-5 sm:p-8">
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-5">
          <p className="font-medium text-red-300">
            Failed to load organization
          </p>

          <p className="mt-1 text-sm text-red-400/80">
            {error ||
              'Organization not found.'}
          </p>
        </div>
      </section>
    )
  }


  /* =========================================================
     PAGE
     ========================================================= */

  return (
    <section className="min-h-screen p-5 sm:p-8">

      {/* Header */}
      <div className="mb-6">
        <Link
          href="/super-admin/organizations"
          className="text-sm text-slate-500 transition hover:text-slate-300"
        >
          ← Back to Organizations
        </Link>

        <div className="mt-4">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {organization.name}
          </h1>

          <p className="mt-1 font-mono text-xs text-slate-500">
            {organization.id}
          </p>
        </div>
      </div>


      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm text-red-300">
            {error}
          </p>
        </div>
      )}


      {/* Organization Overview */}
      <div className="mb-8 grid gap-4 lg:grid-cols-[1fr_auto]">

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">

            <Info
              label="Owner"
              value={
                organization.owner_name ||
                organization.owner_email ||
                '—'
              }
              secondary={
                organization.owner_email ||
                undefined
              }
            />

            <Info
              label="Plan"
              value={
                organization.plan || '—'
              }
            />

            <Info
              label="Members"
              value={
                organization.member_limit
                  ? `Limit ${organization.member_limit}`
                  : '—'
              }
            />

            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Status
              </p>

              <span
                className={[
                  'mt-2 inline-flex rounded-full px-3 py-1 text-xs font-medium',
                  organization.status ===
                  'active'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-amber-500/10 text-amber-300',
                ].join(' ')}
              >
                {organization.status}
              </span>
            </div>

          </div>
        </div>


        <button
          type="button"
          disabled={savingStatus}
          onClick={toggleOrganizationStatus}
          className={[
            'rounded-xl border px-5 py-3 text-sm font-medium transition',
            'disabled:cursor-not-allowed disabled:opacity-50',
            organization.status === 'active'
              ? 'border-amber-500/20 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
              : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20',
          ].join(' ')}
        >
          {savingStatus
            ? 'Saving...'
            : organization.status ===
                'active'
              ? 'Suspend Organization'
              : 'Activate Organization'}
        </button>

      </div>


      {/* Feature Access */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03]">

        <div className="border-b border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white">
            Feature Access
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Control which platform modules are available
            to this organization.
          </p>
        </div>


        <div className="overflow-x-auto">

          <table className="w-full min-w-[950px] text-sm">

            <thead className="border-b border-white/10 bg-white/[0.02]">

              <tr className="text-left text-slate-500">

                <th className="px-6 py-4">
                  Module
                </th>

                <th className="px-6 py-4 text-center">
                  Global
                </th>

                <th className="px-6 py-4 text-center">
                  Organization
                </th>

                <th className="px-6 py-4 text-center">
                  Access
                </th>

                <th className="px-6 py-4 text-right">
                  Override
                </th>

              </tr>

            </thead>


            <tbody>

              {modules.map((module) => {

                const globalEnabled =
                  module.global_enabled

                const override =
                  module.organization_override

                const accessEnabled =
                  organization.status ===
                    'active' &&
                  module.effective_enabled

                const saving =
                  savingModule ===
                  module.module_key


                return (
                  <tr
                    key={module.module_key}
                    className="border-b border-white/5 last:border-0"
                  >

                    {/* Module */}
                    <td className="px-6 py-4">

                      <div className="font-medium text-white">
                        {module.module_name}
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        {module.module_key}
                      </div>

                    </td>


                    {/* Global */}
                    <td className="px-6 py-4 text-center">

                      {globalEnabled ? (
                        <span className="inline-flex rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                          ON
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300">
                          🔒 OFF
                        </span>
                      )}

                    </td>


                    {/* Organization Override */}
                    <td className="px-6 py-4 text-center">

                      {override === null ? (
                        <span className="inline-flex rounded-full bg-slate-500/10 px-3 py-1 text-xs font-medium text-slate-300">
                          INHERIT
                        </span>
                      ) : override ? (
                        <span className="inline-flex rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                          ENABLED
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300">
                          DISABLED
                        </span>
                      )}

                    </td>


                    {/* Effective Access */}
                    <td className="px-6 py-4 text-center">

                      {accessEnabled ? (
                        <span className="inline-flex rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                          Available
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
                          🔒 Locked
                        </span>
                      )}

                    </td>


                    {/* Override Control */}
                    <td className="px-6 py-4 text-right">

                      <select
                        value={
                          override === null
                            ? 'inherit'
                            : override
                              ? 'enabled'
                              : 'disabled'
                        }
                        disabled={
                          saving ||
                          organization.status !==
                            'active'
                        }
                        onChange={(event) => {
                          const value =
                            event.target.value

                          const nextOverride =
                            value === 'inherit'
                              ? null
                              : value ===
                                  'enabled'

                                ? true
                                : false

                          void updateModuleOverride(
                            module,
                            nextOverride,
                          )
                        }}
                        className="
                          rounded-lg
                          border border-white/10
                          bg-[#0b1526]
                          px-3 py-2
                          text-xs
                          text-white
                          outline-none
                          transition
                          focus:border-blue-500/50
                          disabled:cursor-not-allowed
                          disabled:opacity-50
                        "
                      >

                        <option value="inherit">
                          Inherit Global
                        </option>

                        <option value="enabled">
                          Enable for Organization
                        </option>

                        <option value="disabled">
                          Disable for Organization
                        </option>

                      </select>

                    </td>

                  </tr>
                )
              })}

            </tbody>

          </table>

        </div>
      </div>

    </section>
  )
}


/* =========================================================
   INFO COMPONENT
   ========================================================= */

function Info({
  label,
  value,
  secondary,
}: {
  label: string
  value: string
  secondary?: string
}) {
  return (
    <div>

      <p className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-2 font-medium text-white">
        {value}
      </p>

      {secondary &&
        secondary !== value && (
          <p className="mt-1 text-xs text-slate-500">
            {secondary}
          </p>
        )}

    </div>
  )
}