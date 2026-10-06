'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Sidebar from '@/app/components/Sidebar'
import { apiFetch } from '@/app/lib/api'

type NotificationItem = {
  id: string
  team_id: string | null
  type: string
  title: string
  message: string
  entity_type: string | null
  entity_id: string | null
  is_read: boolean
  read_at: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
] as const

function timeLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const minutes = Math.floor(
    (Date.now() - date.getTime()) / 60000,
  )
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`

  return date.toLocaleDateString()
}

function iconFor(type: string) {
  if (type.includes('LEAD')) return '👤'
  if (type.includes('AUDIO')) return '🎙️'
  if (type.includes('INVOICE')) return '🧾'
  if (type.includes('TEAM')) return '👥'
  return '🔔'
}

function targetFor(item: NotificationItem) {
  if (!item.entity_type || !item.entity_id) return null

  switch (item.entity_type.toLowerCase()) {
    case 'lead':
      return `/leads/${item.entity_id}`
    case 'custom_lead':
      return `/audio?custom_lead_id=${item.entity_id}`
    case 'audio':
    case 'audio_evaluation':
      return `/audio/evaluation/${item.entity_id}`
    case 'invoice':
      return '/invoices'
    case 'team':
    case 'user':
      return '/users'
    default:
      return null
  }
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [filter, setFilter] =
    useState<(typeof FILTERS)[number]['value']>('all')
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)

      const response = await apiFetch(
        `/notifications?limit=50&offset=0&unread_only=${filter === 'unread'}`,
      )

      if (!response.ok) return

      const data = await response.json()
      setItems(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Notifications load failed:', error)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  const unreadCount = useMemo(
    () => items.filter((item) => !item.is_read).length,
    [items],
  )

  const markRead = async (item: NotificationItem) => {
    if (item.is_read) return

    try {
      const response = await apiFetch(
        `/notifications/${item.id}/read`,
        { method: 'PATCH' },
      )

      if (!response.ok) return

      setItems((previous) =>
        previous.map((current) =>
          current.id === item.id
            ? {
                ...current,
                is_read: true,
                read_at: new Date().toISOString(),
              }
            : current,
        ),
      )
    } catch (error) {
      console.error('Notification read failed:', error)
    }
  }

  const markAllRead = async () => {
    if (unreadCount === 0) return

    try {
      setMarkingAll(true)

      const response = await apiFetch(
        '/notifications/read-all',
        { method: 'PATCH' },
      )

      if (!response.ok) return

      const now = new Date().toISOString()

      setItems((previous) =>
        previous.map((item) => ({
          ...item,
          is_read: true,
          read_at: item.read_at || now,
        })),
      )
    } catch (error) {
      console.error('Mark all read failed:', error)
    } finally {
      setMarkingAll(false)
    }
  }

  return (
    <div className="flex h-screen min-w-0 overflow-hidden">
      <Sidebar />

      <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mb-6 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="break-words text-3xl font-bold sm:text-4xl">
                Notifications
              </h1>

              <p
                className="mt-2 text-sm sm:text-base"
                style={{ color: 'var(--text-muted)' }}
              >
                Stay updated on activity in your workspace.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={markingAll || unreadCount === 0}
              className="inline-flex w-full items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
              style={{
                borderColor: 'var(--border-soft)',
                color: 'var(--text-primary)',
                background: 'var(--bg-card)',
              }}
            >
              {markingAll ? 'Marking...' : 'Mark all as read'}
            </button>
          </div>

          <div
            className="mb-5 flex items-center gap-2 overflow-x-auto rounded-xl p-1"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-soft)',
            }}
          >
            {FILTERS.map((option) => {
              const active = filter === option.value

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  className="shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition"
                  style={{
                    background: active
                      ? 'var(--bg-card)'
                      : 'transparent',
                    color: active
                      ? 'var(--text-primary)'
                      : 'var(--text-muted)',
                  }}
                >
                  {option.label}
                </button>
              )
            })}

            <span
              className="ml-auto shrink-0 px-3 text-xs"
              style={{ color: 'var(--text-soft)' }}
            >
              {filter === 'unread'
                ? `${unreadCount} unread`
                : `${items.length} loaded`}
            </span>
          </div>

          <section
            className="overflow-hidden rounded-2xl"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-soft)',
            }}
          >
            {loading ? (
              <div
                className="px-4 py-16 text-center text-sm"
                style={{ color: 'var(--text-muted)' }}
              >
                Loading notifications...
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-16 text-center">
                <div
                  className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-xl"
                  style={{ background: 'var(--bg-surface)' }}
                >
                  🔕
                </div>

                <h2
                  className="mt-4 text-base font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  No notifications
                </h2>

                <p
                  className="mt-1 text-sm"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {filter === 'unread'
                    ? "You're all caught up."
                    : 'Notifications will appear here when there is activity.'}
                </p>

                <Link
                  href="/dashboard"
                  className="mt-4 inline-block text-sm font-semibold"
                  style={{ color: 'var(--accent)' }}
                >
                  Back to dashboard
                </Link>
              </div>
            ) : (
              <div>
                {items.map((item) => {
                  const href = targetFor(item)

                  const body = (
                    <div
                      className="flex min-w-0 gap-3 px-4 py-4 sm:px-5"
                      style={{
                        background: item.is_read
                          ? 'transparent'
                          : 'var(--accent-soft)',
                      }}
                    >
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base"
                        style={{ background: 'var(--bg-surface)' }}
                      >
                        {iconFor(item.type)}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-start gap-3">
                          <div
                            className="min-w-0 flex-1 break-words text-sm font-semibold sm:text-[15px]"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {item.title}
                          </div>

                          {!item.is_read && (
                            <span
                              title="Unread"
                              className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ background: 'var(--accent)' }}
                            />
                          )}
                        </div>

                        <div
                          className="mt-1 break-words text-sm leading-6"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {item.message}
                        </div>

                        <div
                          className="mt-2 text-xs"
                          style={{ color: 'var(--text-soft)' }}
                        >
                          {timeLabel(item.created_at)}
                          {item.is_read ? ' · Seen' : ''}
                        </div>
                      </div>
                    </div>
                  )

                  if (href) {
                    return (
                      <Link
                        key={item.id}
                        href={href}
                        onClick={() => void markRead(item)}
                        className="block border-b transition hover:bg-black/5"
                        style={{ borderColor: 'var(--border-soft)' }}
                      >
                        {body}
                      </Link>
                    )
                  }

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void markRead(item)}
                      className="block w-full border-b text-left transition hover:bg-black/5"
                      style={{ borderColor: 'var(--border-soft)' }}
                    >
                      {body}
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
