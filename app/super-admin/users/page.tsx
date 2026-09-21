'use client'

import { useEffect, useState } from 'react'
import {
  getPlatformUsers,
  type PlatformUser,
} from '@/app/lib/api'

export default function UsersPage() {
  const [users, setUsers] = useState<PlatformUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  async function loadUsers(value = '') {
    try {
      setLoading(true)
      setError('')

      const data = await getPlatformUsers(value)
      setUsers(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load platform users',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  function handleSearch(event: React.FormEvent) {
    event.preventDefault()
    loadUsers(search.trim())
  }

  return (
    <section className="min-h-screen p-5 sm:p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Platform Users
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          View users across the Tynato platform.
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
          placeholder="Search by name or email..."
          className="w-full max-w-md rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-white/20"
        />

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg  px-5 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm font-medium text-red-300">
            Failed to load users
          </p>

          <p className="mt-1 text-sm text-red-400/80">
            {error}
          </p>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03]">
            <tr className="text-left text-slate-400">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">
                Platform Role
              </th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  Loading users...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-4">
                    <div className="font-medium text-white">
                      {user.full_name || '—'}
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      {user.email || '—'}
                    </div>
                  </td>

                  <td className="px-4 py-4 text-slate-300">
                    {user.role || '—'}
                  </td>

                  <td className="px-4 py-4">
                    <span
                      className={[
                        'inline-flex rounded-full px-2.5 py-1 text-xs font-medium',
                        user.platform_role ===
                        'super_admin'
                          ? 'bg-purple-500/10 text-purple-300'
                          : 'bg-slate-500/10 text-slate-400',
                      ].join(' ')}
                    >
                      {user.platform_role || 'user'}
                    </span>
                  </td>

                  <td className="px-4 py-4">
                    <span
                      className={[
                        'inline-flex rounded-full px-2.5 py-1 text-xs font-medium',
                        user.is_active
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-red-500/10 text-red-300',
                      ].join(' ')}
                    >
                      {user.is_active
                        ? 'Active'
                        : 'Inactive'}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-slate-400">
                    {formatDate(user.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && users.length > 0 && (
        <div className="mt-4 text-xs text-slate-500">
          Showing {users.length} user
          {users.length === 1 ? '' : 's'}.
        </div>
      )}
    </section>
  )
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleDateString()
}