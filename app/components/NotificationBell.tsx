'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
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

type Props = {
  compact?: boolean
  placement?: 'up' | 'down'
}

function timeLabel(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

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
  if (!item.entity_type || !item.entity_id) {
    return null
  }

  switch (item.entity_type.toLowerCase()) {
    case 'lead':
      return `/leads/${item.entity_id}`

    case 'custom_lead':
        if (['LEAD_FOLLOW_UP', 'LEAD_ASSIGNED'].includes(item.type.toUpperCase())) {
        return '/custom-lead'
      }
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

export default function NotificationBell({
  compact = false,
  placement = 'up',
}: Props) {
  const [count, setCount] = useState(0)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toastItem, setToastItem] = useState<NotificationItem | null>(null)

  const initializedNotifications = useRef(false)
  const knownNotificationIds = useRef<Set<string>>(new Set())

  const wrapperRef = useRef<HTMLDivElement | null>(null)

  const countRequestInFlight = useRef(false)
  const previewRequestInFlight = useRef(false)
    const lastFocusRefresh = useRef(0)
  const lastCount = useRef(0)
  const countInitialized = useRef(false)
  const openRef = useRef(false)



    const loadPreview = useCallback(
    async (showNewToast = true, showSpinner = false) => {
      if (previewRequestInFlight.current) {
        return
      }

      previewRequestInFlight.current = true

      if (showSpinner) {
        setLoading(true)
      }

      try {
        const response = await apiFetch('/notifications?limit=8')

        if (!response.ok) {
          return
        }

        const data = await response.json()
        const nextItems = Array.isArray(data)
          ? (data as NotificationItem[])
          : []

        if (initializedNotifications.current && showNewToast) {
          const newest = nextItems.find(
            (item) =>
              !item.is_read &&
              !knownNotificationIds.current.has(item.id),
          )

          if (newest) {
            setToastItem(newest)
          }
        }

        knownNotificationIds.current = new Set(
          nextItems.map((item) => item.id),
        )
        initializedNotifications.current = true

        setItems((prev) => {
          const same =
            prev.length === nextItems.length &&
            prev.every(
              (entry, index) =>
                entry.id === nextItems[index].id &&
                entry.is_read === nextItems[index].is_read,
            )

          return same ? prev : nextItems
        })
      } catch (error) {
        console.error('Notification preview failed:', error)
      } finally {
        previewRequestInFlight.current = false

        if (showSpinner) {
          setLoading(false)
        }
      }
    },
    [],
  )

  const refreshCount = useCallback(async () => {
    if (countRequestInFlight.current) {
      return
    }

    if (
      typeof document !== 'undefined' &&
      document.visibilityState === 'hidden'
    ) {
      return
    }

    countRequestInFlight.current = true

    try {
      const response = await apiFetch('/notifications/unread-count')

      if (!response.ok) {
        return
      }

      const data = await response.json()
      const next = Number(data?.count ?? 0)
      const previous = lastCount.current

      lastCount.current = next
      setCount(next)

      if (!countInitialized.current) {
        countInitialized.current = true
        return
      }

      if (next > previous) {
        // A new notification arrived: fetch the list and show the toast.
        void loadPreview(true)
      } else if (next !== previous && openRef.current) {
        // Count changed while the panel is open: refresh quietly.
        void loadPreview(false)
      }
    } catch (error) {
      console.error('Notification count failed:', error)
    } finally {
      countRequestInFlight.current = false
    }
  }, [loadPreview])

    useEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(() => {
    void refreshCount()
    void loadPreview(false)

    // Only the cheap unread-count endpoint is polled.
    const timer = window.setInterval(() => {
      void refreshCount()
    }, 15_000)

    const onFocus = () => {
      const now = Date.now()

      if (now - lastFocusRefresh.current < 5_000) {
        return
      }

      lastFocusRefresh.current = now
      void refreshCount()
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshCount()
      }
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [loadPreview, refreshCount])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    void navigator.serviceWorker
      .register('/service-worker.js', { scope: '/' })
      .then((registration) => registration.update())
      .catch((error) => {
        console.error('Service worker registration failed:', error)
      })
  }, [])

  useEffect(() => {
    if (!toastItem) {
      return
    }

    const timer = window.setTimeout(() => {
      setToastItem(null)
    }, 8_000)

    return () => window.clearTimeout(timer)
  }, [toastItem])

  useEffect(() => {
    const onOutside = (
      event: MouseEvent,
    ) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(
          event.target as Node,
        )
      ) {
        setOpen(false)
      }
    }

    document.addEventListener(
      'mousedown',
      onOutside,
    )

    return () => {
      document.removeEventListener(
        'mousedown',
        onOutside,
      )
    }
  }, [])

  const toggle = async () => {
    const next = !open

    setOpen(next)

    if (!next) {
      return
    }

    /*
     * Opening the notification panel only
     * loads the preview.
     *
     * Do NOT call refreshCount() again here.
     * The polling/focus logic already handles count refresh.
     */
        await loadPreview(false, items.length === 0)
  }

  const markRead = async (
    item: NotificationItem,
  ) => {
    if (item.is_read) {
      return
    }

    try {
      const response = await apiFetch(
        `/notifications/${item.id}/read`,
        {
          method: 'PATCH',
        },
      )

      if (!response.ok) {
        return
      }

      setItems((prev) =>
        prev.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                is_read: true,
                read_at:
                  new Date().toISOString(),
              }
            : entry,
        ),
      )

      lastCount.current = Math.max(0, lastCount.current - 1)
      setCount((prev) => Math.max(0, prev - 1))
    } catch (error) {
      console.error(
        'Mark notification read failed:',
        error,
      )
    }
  }

  const position =
    placement === 'up'
      ? 'bottom-[calc(100%+8px)]'
      : 'top-[calc(100%+8px)]'

  return (
    <>
      {toastItem && (
        <button
          type="button"
          onClick={() => {
            const href = targetFor(toastItem)
            void markRead(toastItem)
            setToastItem(null)
            if (href) {
              window.location.href = href
            }
          }}
          className="fixed right-4 top-4 z-[200] w-[min(380px,calc(100vw-32px))] rounded-2xl border p-4 text-left shadow-2xl"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-soft)',
            color: 'var(--text-primary)',
          }}
          aria-label="New notification"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--bg-surface)' }}>
              {iconFor(toastItem.type)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{toastItem.title}</span>
              <span className="mt-1 block text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
                {toastItem.message}
              </span>
              <span className="mt-2 block text-[11px] font-semibold" style={{ color: 'var(--accent)' }}>
                Open Custom Lead →
              </span>
            </span>
          </div>
        </button>
      )}

    <div
      ref={wrapperRef}
      className="relative w-full"
    >
      <button
        type="button"
        onClick={() => void toggle()}
        aria-expanded={open}
        aria-label="Notifications"
        title="Notifications"
        className={[
          'relative flex w-full items-center rounded-xl p-3 transition hover:bg-white/[0.05]',
          compact
            ? 'justify-center'
            : 'gap-3 text-left',
        ].join(' ')}
        style={{
          color: 'var(--text-primary)',
        }}
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{
            background:
              'var(--bg-surface)',
          }}
        >
          🔔
        </span>

        {!compact && (
          <span className="min-w-0 flex-1 truncate font-medium">
            Notifications
          </span>
        )}

        {count > 0 && (
          <span
            className={[
              'flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold text-white',
              compact
                ? 'absolute -right-1 -top-1'
                : 'ml-auto',
            ].join(' ')}
            style={{
              background: 'var(--accent)',
            }}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notification preview"
          className={[
            'absolute left-0 z-[100] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border shadow-2xl',
            position,
          ].join(' ')}
          style={{
            width:
              'min(390px, calc(100vw - 24px))',
            background:
              'var(--bg-card)',
            borderColor:
              'var(--border-soft)',
          }}
        >
          <div
            className="flex items-center justify-between gap-3 border-b px-4 py-3"
            style={{
              borderColor:
                'var(--border-soft)',
            }}
          >
            <div>
              <div
                className="text-sm font-semibold"
                style={{
                  color:
                    'var(--text-primary)',
                }}
              >
                Notifications
              </div>

              <div
                className="mt-0.5 text-xs"
                style={{
                  color:
                    'var(--text-muted)',
                }}
              >
                {count} unread
              </div>
            </div>

            <Link
              href="/notifications"
              onClick={() =>
                setOpen(false)
              }
              className="text-xs font-semibold"
              style={{
                color: 'var(--accent)',
              }}
            >
              View all
            </Link>
          </div>

          <div className="max-h-[390px] overflow-y-auto">
            {loading ? (
              <div
                className="px-4 py-8 text-center text-sm"
                style={{
                  color:
                    'var(--text-muted)',
                }}
              >
                Loading...
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <div className="text-2xl">
                  🔕
                </div>

                <div
                  className="mt-2 text-sm font-semibold"
                  style={{
                    color:
                      'var(--text-primary)',
                  }}
                >
                  No notifications
                </div>

                <div
                  className="mt-1 text-xs"
                  style={{
                    color:
                      'var(--text-muted)',
                  }}
                >
                  You're all caught up.
                </div>
              </div>
            ) : (
              items.map((item) => {
                const href =
                  targetFor(item)

                const body = (
                  <div
                    className="flex min-w-0 gap-3 px-4 py-3"
                    style={{
                      background:
                        item.is_read
                          ? 'transparent'
                          : 'var(--accent-soft)',
                    }}
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                      style={{
                        background:
                          'var(--bg-surface)',
                      }}
                    >
                      {iconFor(
                        item.type,
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-start gap-2">
                        <span
                          className="min-w-0 flex-1 break-words text-sm font-semibold"
                          style={{
                            color:
                              'var(--text-primary)',
                          }}
                        >
                          {item.title}
                        </span>

                        {!item.is_read && (
                          <span
                            title="Unread"
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                            style={{
                              background:
                                'var(--accent)',
                            }}
                          />
                        )}
                      </span>

                      <span
                        className="mt-1 block break-words text-xs leading-5"
                        style={{
                          color:
                            'var(--text-muted)',
                        }}
                      >
                        {item.message}
                      </span>

                      <span
                        className="mt-1.5 block text-[11px]"
                        style={{
                          color:
                            'var(--text-soft)',
                        }}
                      >
                        {timeLabel(
                          item.created_at,
                        )}
                      </span>
                    </span>
                  </div>
                )

                if (href) {
                  return (
                    <Link
                      key={item.id}
                      href={href}
                      onClick={() =>
                        void markRead(
                          item,
                        )
                      }
                      className="block border-b transition hover:bg-black/5"
                      style={{
                        borderColor:
                          'var(--border-soft)',
                      }}
                    >
                      {body}
                    </Link>
                  )
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      void markRead(
                        item,
                      )
                    }
                    className="block w-full border-b text-left transition hover:bg-black/5"
                    style={{
                      borderColor:
                        'var(--border-soft)',
                    }}
                  >
                    {body}
                  </button>
                )
              })
            )}
          </div>

          {items.length > 0 && (
            <div
              className="border-t px-4 py-3"
              style={{
                borderColor:
                  'var(--border-soft)',
              }}
            >
              <Link
                href="/notifications"
                onClick={() =>
                  setOpen(false)
                }
                className="block text-center text-xs font-semibold"
                style={{
                  color: 'var(--accent)',
                }}
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
    </>
  )
}
