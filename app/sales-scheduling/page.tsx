'use client'

import { useEffect, useState } from 'react'
import { apiFetch, parseApiResponse, rescheduleSalesCall, type SalesAvailabilityInterval, type SalesCallInternalBooking, type SalesCallSettings } from '@/app/lib/api'
import SalesSchedulerShell from '@/app/components/SalesSchedulerShell'

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

const DURATION_OPTIONS = [15, 30, 45, 60]

function todayLocalDate() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function dateTimeLocalDefault(date: string, hour: string) {
  return `${date}T${hour}`
}

function toSchedulerLocalInput(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value))

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value])) as Record<string, string>
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`
}

export default function SalesSchedulingPage() {
  const [settings, setSettings] = useState<SalesCallSettings | null>(null)
  const [intervals, setIntervals] = useState<SalesAvailabilityInterval[]>([])
  const [date, setDate] = useState(todayLocalDate)
  const [blocks, setBlocks] = useState<any[]>([])
  const [bookings, setBookings] = useState<SalesCallInternalBooking[]>([])
  const [startLocal, setStartLocal] = useState(dateTimeLocalDefault(todayLocalDate(), '10:00'))
  const [endLocal, setEndLocal] = useState(dateTimeLocalDefault(todayLocalDate(), '10:30'))
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [reschedulingId, setReschedulingId] = useState<string | null>(null)
  const [rescheduleStartLocal, setRescheduleStartLocal] = useState('')
  const [authorized, setAuthorized] = useState<boolean | null>(null)

  const currentUserId = settings?.user_id || ''

  useEffect(() => {
    const today = todayLocalDate()
    setStartLocal(dateTimeLocalDefault(today, '10:00'))
    setEndLocal(dateTimeLocalDefault(today, '10:30'))
  }, [])

  async function loadBase() {
    setLoading(true)
    setError('')
    try {
      const meResponse = await apiFetch('/sales-scheduling/me')
      if (!meResponse.ok) {
        setAuthorized(false)
        setLoading(false)
        return
      }
      setAuthorized(true)

      const [settingsResponse, availabilityResponse] = await Promise.all([
        apiFetch('/sales-scheduling/settings'),
        apiFetch('/sales-scheduling/availability'),
      ])

      setSettings(await parseApiResponse<SalesCallSettings>(settingsResponse))
      const availabilityData = await parseApiResponse<{ intervals: SalesAvailabilityInterval[] }>(availabilityResponse)
      setIntervals(availabilityData.intervals)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load sales scheduling settings.')
    } finally {
      setLoading(false)
    }
  }

  async function loadDateData() {
    try {
      const [blocksResponse, bookingsResponse] = await Promise.all([
        apiFetch(`/sales-scheduling/blocks?date=${encodeURIComponent(date)}`),
        apiFetch(`/sales-scheduling/bookings?date=${encodeURIComponent(date)}`),
      ])
      const blocksData = await parseApiResponse<{ blocks: any[] }>(blocksResponse)
      const bookingsData = await parseApiResponse<{ bookings: SalesCallInternalBooking[] }>(bookingsResponse)
      setBlocks(blocksData.blocks)
      setBookings(bookingsData.bookings)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load scheduling data.')
    }
  }

  useEffect(() => {
    void loadBase()
  }, [])

  useEffect(() => {
    if (authorized) void loadDateData()
  }, [authorized, date])

  useEffect(() => {
    const hour = startLocal.slice(11, 16) || '10:00'
    const nextDate = `${date}T${hour}`
    setStartLocal(nextDate)

    const endHour = endLocal.slice(11, 16) || '10:30'
    setEndLocal(`${date}T${endHour}`)
  }, [date])

  async function saveSettings() {
    if (!settings) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await apiFetch('/sales-scheduling/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          default_slot_duration_minutes: Number(settings.default_slot_duration_minutes),
          timezone: settings.timezone,
        }),
      })
      const updated = await parseApiResponse<SalesCallSettings>(response)
      setSettings((current) => current ? { ...current, ...updated } : updated)
      setMessage('Scheduling settings saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save scheduling settings.')
    } finally {
      setSaving(false)
    }
  }

  async function saveAvailability() {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const payload = {
        intervals: intervals.map((item) => ({
          day_of_week: Number(item.day_of_week),
          start_time: item.start_time.slice(0, 8),
          end_time: item.end_time.slice(0, 8),
          slot_duration_minutes:
            item.slot_duration_minutes == null
              ? null
              : Number(item.slot_duration_minutes),
        })),
      }

      const response = await apiFetch('/sales-scheduling/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await parseApiResponse<{ intervals: SalesAvailabilityInterval[] }>(response)
      setIntervals(data.intervals)
      setMessage('Weekly availability saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save weekly availability.')
    } finally {
      setSaving(false)
    }
  }

  async function createBlock() {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await apiFetch('/sales-scheduling/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_local: startLocal,
          end_local: endLocal,
          reason: reason.trim() || null,
        }),
      })
      await parseApiResponse<any>(response)
      setMessage('Unavailable period created.')
      setReason('')
      await loadDateData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create unavailable period.')
    } finally {
      setSaving(false)
    }
  }

  async function removeBlock(blockId: string) {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await parseApiResponse(await apiFetch(`/sales-scheduling/blocks/${blockId}`, { method: 'DELETE' }))
      setMessage('Unavailable period removed.')
      await loadDateData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove unavailable period.')
    } finally {
      setSaving(false)
    }
  }

  async function rescheduleBooking(bookingId: string) {
    if (!rescheduleStartLocal) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await rescheduleSalesCall(bookingId, rescheduleStartLocal)
      setMessage('Booking rescheduled.')
      setReschedulingId(null)
      setRescheduleStartLocal('')
      await loadDateData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reschedule booking.')
    } finally {
      setSaving(false)
    }
  }

  async function updateBooking(bookingId: string, status: 'cancelled' | 'completed') {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await parseApiResponse(await apiFetch(`/sales-scheduling/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }))
      setMessage(status === 'cancelled' ? 'Booking cancelled.' : 'Booking marked completed.')
      await loadDateData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update booking.')
    } finally {
      setSaving(false)
    }
  }

  function addInterval() {
    setIntervals((current) => [
      ...current,
      {
        id: `new-${Date.now()}`,
        day_of_week: 0,
        start_time: '09:00:00',
        end_time: '17:00:00',
        slot_duration_minutes: null,
        is_active: true,
      },
    ])
  }

  function updateInterval(index: number, patch: Partial<SalesAvailabilityInterval>) {
    setIntervals((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))
  }

  function removeInterval(index: number) {
    setIntervals((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  if (loading) {
    return <div className="min-h-screen bg-[#07101f] px-6 py-10 text-slate-400">Loading Sales Scheduling…</div>
  }

  if (authorized === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07101f] px-6">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b1526] p-8 text-center">
          <h1 className="text-2xl font-semibold text-white">Access restricted</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">This workspace is only available to authorized Tynato Sales Scheduling users.</p>
          <a href="/dashboard" className="mt-6 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500">Return to CRM</a>
        </div>
      </div>
    )
  }

  return (
    <SalesSchedulerShell>
      <div className="min-h-screen text-white">
        <header className="border-b border-white/10 bg-[#0b1526] px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">Internal Sales</p>
            <h1 className="mt-1 text-2xl font-semibold">Sales Call Control</h1>
            <p className="mt-1 text-sm text-slate-400">Set availability, block time, and manage customer sales-call bookings.</p>
          </div>
          <div className="text-right text-sm text-slate-400">
            <div className="font-medium text-slate-200">{settings?.full_name || settings?.email}</div>
            <div>{settings?.timezone}</div>
          </div>
        </div>
        </header>

        <main className="mx-auto max-w-7xl space-y-6 px-5 py-6 sm:px-8 sm:py-8">
        {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
        {message && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{message}</div>}

        <section className="grid gap-6 lg:grid-cols-[1fr_1.35fr]">
          <div className="rounded-2xl border border-white/10 bg-[#0b1526] p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Scheduling Settings</h2>
            <p className="mt-2 text-sm text-slate-400">Set your default call duration and working timezone.</p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Default call duration</label>
                <select
                  value={settings?.default_slot_duration_minutes || 30}
                  onChange={(event) => setSettings((current) => current ? { ...current, default_slot_duration_minutes: Number(event.target.value) } : current)}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                >
                  {DURATION_OPTIONS.map((duration) => <option key={duration} value={duration}>{duration} minutes</option>)}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Timezone</label>
                <input
                  value={settings?.timezone || 'Asia/Kolkata'}
                  onChange={(event) => setSettings((current) => current ? { ...current, timezone: event.target.value } : current)}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                  placeholder="Asia/Kolkata"
                />
                <p className="mt-2 text-xs text-slate-500">Use a valid IANA timezone, for example Asia/Kolkata.</p>
              </div>

              <button disabled={saving} onClick={() => void saveSettings()} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">Save Settings</button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0b1526] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Weekly Availability</h2>
                <p className="mt-2 text-sm text-slate-400">Customers can only book inside these recurring windows.</p>
              </div>
              <button type="button" onClick={addInterval} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/[0.04]">Add Window</button>
            </div>

            <div className="mt-5 space-y-3">
              {intervals.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">No availability configured.</div>
              ) : intervals.map((interval, index) => (
                <div key={interval.id || `${interval.day_of_week}-${index}`} className="grid gap-3 rounded-xl border border-white/10 bg-black/10 p-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto] md:items-end">
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Day</label>
                    <select value={interval.day_of_week} onChange={(event) => updateInterval(index, { day_of_week: Number(event.target.value) })} className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white">
                      {DAYS.map((day, dayIndex) => <option key={day} value={dayIndex}>{day}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Start</label>
                    <input type="time" value={interval.start_time.slice(0,5)} onChange={(event) => updateInterval(index, { start_time: `${event.target.value}:00` })} className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">End</label>
                    <input type="time" value={interval.end_time.slice(0,5)} onChange={(event) => updateInterval(index, { end_time: `${event.target.value}:00` })} className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Slot duration</label>
                    <select value={interval.slot_duration_minutes ?? ''} onChange={(event) => updateInterval(index, { slot_duration_minutes: event.target.value ? Number(event.target.value) : null })} className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white">
                      <option value="">Use default</option>
                      {DURATION_OPTIONS.map((duration) => <option key={duration} value={duration}>{duration} min</option>)}
                    </select>
                  </div>
                  <button type="button" onClick={() => removeInterval(index)} className="rounded-lg border border-red-500/20 px-3 py-2.5 text-sm text-red-300 hover:bg-red-500/10">Remove</button>
                </div>
              ))}
            </div>

            <button disabled={saving} onClick={() => void saveAvailability()} className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">Save Availability</button>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1.35fr]">
          <div className="rounded-2xl border border-white/10 bg-[#0b1526] p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Block Unavailable Time</h2>
            <p className="mt-2 text-sm text-slate-400">Times are entered in {settings?.timezone || 'your scheduling timezone'}.</p>
            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm text-slate-300">Start</label>
                <input type="datetime-local" value={startLocal} onChange={(event) => setStartLocal(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white" />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-300">End</label>
                <input type="datetime-local" value={endLocal} onChange={(event) => setEndLocal(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white" />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-300">Reason (optional)</label>
                <input value={reason} onChange={(event) => setReason(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white" placeholder="Internal meeting" maxLength={500} />
              </div>
              <button disabled={saving} onClick={() => void createBlock()} className="w-full rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50">Mark Unavailable</button>
            </div>

            <div className="mt-6">
              <div className="mb-3 text-sm font-semibold text-slate-200">Blocks on {date}</div>
              {blocks.length === 0 ? (
                <p className="text-sm text-slate-500">No unavailable periods.</p>
              ) : (
                <div className="space-y-2">
                  {blocks.map((block) => (
                    <div key={block.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/10 p-3">
                      <div>
                        <div className="text-sm font-medium text-white">{new Date(block.start_at).toLocaleString([], { timeZone: settings?.timezone || 'Asia/Kolkata' })} — {new Date(block.end_at).toLocaleString([], { timeZone: settings?.timezone || 'Asia/Kolkata' })}</div>
                        {block.reason && <div className="mt-1 text-xs text-slate-500">{block.reason}</div>}
                      </div>
                      <button type="button" disabled={saving} onClick={() => void removeBlock(block.id)} className="rounded-lg border border-red-500/20 px-3 py-2 text-xs text-red-300">Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0b1526] p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Central Bookings</h2>
                <p className="mt-2 text-sm text-slate-400">Minimal internal view: time, assigned sales person, and customer team.</p>
              </div>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white" />
            </div>

            <div className="mt-5 overflow-x-auto">
              {bookings.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">No bookings for this date.</div>
              ) : (
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="pb-3 pr-4">Time</th>
                      <th className="pb-3 pr-4">Sales Person</th>
                      <th className="pb-3 pr-4">Customer Team</th>
                      <th className="pb-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((booking) => {
                      const canManage = booking.sales_user_id === currentUserId
                      return (
                        <tr key={booking.id} className="border-t border-white/10 align-top">
                          <td className="py-4 pr-4 whitespace-nowrap text-slate-200">{new Date(booking.start_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: settings?.timezone || 'Asia/Kolkata' })} — {new Date(booking.end_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: settings?.timezone || 'Asia/Kolkata' })}</td>
                          <td className="py-4 pr-4 text-slate-300">{booking.sales_user_name || 'Sales Scheduler'}</td>
                          <td className="py-4 pr-4 font-medium text-white">{booking.customer_team_name}</td>
                          <td className="py-4">
                            {canManage ? (
                              <div className="space-y-2">
                                <div className="flex flex-wrap gap-2">
                                  <button disabled={saving} onClick={() => void updateBooking(booking.id, 'completed')} className="rounded-lg border border-emerald-500/20 px-3 py-2 text-xs text-emerald-300">Complete</button>
                                  <button disabled={saving} onClick={() => void updateBooking(booking.id, 'cancelled')} className="rounded-lg border border-red-500/20 px-3 py-2 text-xs text-red-300">Cancel</button>
                                  <button
                                    disabled={saving}
                                    onClick={() => {
                                      setReschedulingId(booking.id)
                                      setRescheduleStartLocal(toSchedulerLocalInput(booking.start_at, settings?.timezone || 'Asia/Kolkata'))
                                    }}
                                    className="rounded-lg border border-blue-500/20 px-3 py-2 text-xs text-blue-300"
                                  >
                                    Reschedule
                                  </button>
                                </div>
                                {reschedulingId === booking.id && (
                                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-black/10 p-2">
                                    <input
                                      type="datetime-local"
                                      value={rescheduleStartLocal}
                                      onChange={(event) => setRescheduleStartLocal(event.target.value)}
                                      className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white"
                                    />
                                    <button disabled={saving} onClick={() => void rescheduleBooking(booking.id)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Save</button>
                                    <button type="button" disabled={saving} onClick={() => { setReschedulingId(null); setRescheduleStartLocal('') }} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">Close</button>
                                  </div>
                                )}
                              </div>
                            ) : <span className="text-xs text-slate-500">View only</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </section>
        </main>
      </div>
    </SalesSchedulerShell>
  )
}
