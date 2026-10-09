'use client'

import Sidebar from '@/app/components/Sidebar'
import {
  apiFetch,
  parseApiResponse,
  isSalesScheduler,
  type SalesCallAvailability,
  type SalesCallBooking,
} from '@/app/lib/api'
import { useEffect, useMemo, useState } from 'react'

function todayLocalDate() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export default function SalesCallPage() {
  const [date, setDate] = useState(todayLocalDate)
  const [availability, setAvailability] = useState<SalesCallAvailability | null>(null)
  const [bookings, setBookings] = useState<SalesCallBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const bookedStarts = useMemo(
    () => new Set(bookings.map((item) => item.start_at)),
    [bookings],
  )

  async function load() {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const availabilityResponse = await apiFetch(
        `/sales-call/availability?date=${encodeURIComponent(date)}`,
      )
      const availabilityData = await parseApiResponse<SalesCallAvailability>(
        availabilityResponse,
      )

      const bookingsResponse = await apiFetch(
        `/sales-call/my-bookings?date=${encodeURIComponent(date)}`,
      )
      const bookingsData = await parseApiResponse<{
        date: string
        bookings: SalesCallBooking[]
      }>(bookingsResponse)

      setAvailability(availabilityData)
      setBookings(bookingsData.bookings)
    } catch (err) {
      setAvailability(null)
      setBookings([])
      setError(err instanceof Error ? err.message : 'Unable to load sales call availability.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function guardSalesScheduler() {
      try {
        if (await isSalesScheduler()) {
          window.location.replace('/sales-scheduling')
          return
        }
      } catch {
        // Backend remains the source of truth; customer page may continue.
      }

      if (!cancelled) {
        void load()
      }
    }

    void guardSalesScheduler()

    return () => {
      cancelled = true
    }
  }, [date])

  async function book(startAt: string) {
    setBookingId(startAt)
    setError('')
    setSuccess('')

    try {
      const response = await apiFetch('/sales-call/book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ start_at: startAt }),
      })

      await parseApiResponse<SalesCallBooking>(response)
      setSuccess('Sales call booked successfully.')
      await load()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'This slot is no longer available.',
      )
    } finally {
      setBookingId(null)
    }
  }

  return (
    <div className="crm-page flex min-h-screen">
      <Sidebar />

      <main className="min-w-0 flex-1 overflow-auto px-5 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto w-full max-w-5xl">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
              Sales Scheduling
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white">
              Book a Sales Call
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Choose an available time. Other customer bookings and internal scheduling details are never exposed here.
            </p>
          </div>

          <section className="rounded-2xl border border-white/10 bg-[var(--bg-card)] p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300" htmlFor="sales-call-date">
                  Date
                </label>
                <input
                  id="sales-call-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-blue-400/50"
                />
              </div>
              <div className="text-sm text-slate-400">
                Timezone: <span className="font-medium text-slate-200">{availability?.timezone || '—'}</span>
              </div>
            </div>

            {error && (
              <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {success && (
              <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                {success}
              </div>
            )}

            {bookings.length > 0 && (
              <div className="mt-6 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
                <p className="text-sm font-semibold text-blue-200">Your booked sales call</p>
                <div className="mt-2 space-y-1 text-sm text-slate-300">
                  {bookings.map((booking) => (
                    <p key={booking.id}>
                      {new Date(booking.start_at).toLocaleString([], {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6">
              {loading ? (
                <div className="rounded-xl border border-white/10 bg-black/10 px-4 py-10 text-center text-sm text-slate-400">
                  Loading available slots…
                </div>
              ) : availability?.slots.length ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {availability.slots.map((slot) => {
                    const alreadyBooked = bookedStarts.has(slot.start_at)
                    const busy = bookingId === slot.start_at

                    return (
                      <button
                        key={slot.start_at}
                        type="button"
                        disabled={alreadyBooked || Boolean(bookingId)}
                        onClick={() => void book(slot.start_at)}
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-left transition hover:border-blue-400/40 hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <div className="text-base font-semibold text-white">
                          {slot.display_time}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {busy ? 'Booking…' : alreadyBooked ? 'Booked' : 'Available'}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-black/10 px-4 py-10 text-center text-sm text-slate-400">
                  No sales-call slots are available for this date.
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
