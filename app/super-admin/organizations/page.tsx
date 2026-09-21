'use client'

import { useEffect, useState } from 'react'
import {
  getOrganizations,
  updateOrganizationStatus,
  type Organization,
} from '@/app/lib/api'

export default function OrganizationsPage() {
  const [organizations, setOrganizations] =
    useState<Organization[]>([])

  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function load(searchValue = '') {
    try {
      setLoading(true)
      setError('')

      const data = await getOrganizations(
        searchValue.trim(),
      )

      setOrganizations(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load organizations',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function toggleStatus(org: Organization) {
    if (actionId) return

    setActionId(org.id)
    setError('')

    try {
      const newStatus =
        org.status === 'active'
          ? 'suspended'
          : 'active'

      const updated =
        await updateOrganizationStatus(
          org.id,
          newStatus,
        )

      setOrganizations((current) =>
        current.map((item) =>
          item.id === updated.id
            ? { ...item, ...updated }
            : item,
        ),
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to update organization',
      )
    } finally {
      setActionId(null)
    }
  }

  function handleSearch(event: React.FormEvent) {
    event.preventDefault()
    load(search)
  }

  return (
    <section className="min-h-screen p-5 sm:p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Organizations
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          Manage customer organizations and platform access.
        </p>
      </header>

      <form
        onSubmit={handleSearch}
        className="mb-6 flex flex-col gap-3 sm:flex-row"
      >
        <input
          type="text"
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="Search organization..."
          className="w-full max-w-md rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-white/20"
        />

        <button
          type="submit"
          disabled={loading}
          className="
  rounded-lg
  bg-blue-600
  px-5 py-2.5
  text-sm font-medium text-white
  transition
  hover:bg-blue-500
  disabled:cursor-not-allowed
  disabled:opacity-50
"
        >
          {loading ? 'Loading...' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm font-medium text-red-300">
            Organization operation failed
          </p>

          <p className="mt-1 text-sm text-red-400/80">
            {error}
          </p>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[950px] text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03]">
            <tr className="text-left text-slate-400">
              <th className="px-4 py-3">
                Organization
              </th>

              <th className="px-4 py-3">
                Owner
              </th>

              <th className="px-4 py-3">
                Plan
              </th>

              <th className="px-4 py-3">
                Status
              </th>

              <th className="px-4 py-3 text-right">
                Action
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
                  Loading organizations...
                </td>
              </tr>
            ) : organizations.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  No organizations found.
                </td>
              </tr>
            ) : (
              organizations.map((org) => {
                const isUpdating =
                  actionId === org.id

                return (
                  <tr
                    key={org.id}
                    className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-4">
                      <div className="font-medium text-white">
                        {org.name || '—'}
                      </div>

                      <div className="mt-1 font-mono text-xs text-slate-500">
                        {org.id}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="text-slate-300">
                        {org.owner_name || '—'}
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        {org.owner_email || '—'}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-slate-300">
                      {org.plan || '—'}
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={[
                          'inline-flex rounded-full px-2.5 py-1 text-xs font-medium',
                          org.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-amber-500/10 text-amber-300',
                        ].join(' ')}
                      >
                        {org.status}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-right">
  <div className="flex justify-end gap-2">
    <a
      href={`/super-admin/organizations/${org.id}`}
      className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-300 transition hover:bg-blue-500/20"
    >
      Manage
    </a>

    
  </div>
</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading &&
        organizations.length > 0 && (
          <div className="mt-4 text-xs text-slate-500">
            Showing {organizations.length}{' '}
            organization
            {organizations.length === 1 ? '' : 's'}.
          </div>
        )}
    </section>
  )
}