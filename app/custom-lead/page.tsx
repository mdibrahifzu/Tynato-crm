'use client'

import Sidebar from '../components/Sidebar'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/app/lib/api'

/* ==========================================================
   TYPES & CONSTANTS
========================================================== */

const SOURCE_COLUMNS = [
  'ad_name',
  'form_name',
  'full_name',
  'phone_number',
  'email',
  'project_location?',
  'created_time',
] as const

type SourceColumn = (typeof SOURCE_COLUMNS)[number]

type CustomLead = {
  id: string
  ad_name: string | null
  form_name: string | null
  full_name: string | null
  phone_number: string | null
  email: string | null
  project_location: string | null
  created_time: string | null
  status: string
  notes: string | null
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'converted', label: 'Converted' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'interested', label: 'Interested' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'junk', label: 'Junk' },
]

const STATUS_STYLES: Record<string, string> = {
  new: 'border-slate-500/30 bg-slate-500/15 text-slate-300',
  interested: 'border-sky-500/30 bg-sky-500/15 text-sky-300',
  follow_up: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
  converted: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
  not_interested: 'border-rose-500/30 bg-rose-500/15 text-rose-300',
  junk: 'border-zinc-500/30 bg-zinc-500/15 text-zinc-400',
}

// Shared by header and rows so columns always line up.
// Actions column is a fixed width (not auto) for that reason.
const LEAD_GRID =
  'xl:grid xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.6fr)_184px] xl:items-center xl:gap-4'

const LEAD_HEADERS = [
  'Lead',
  'Campaign',
  'Created',
  'Status',
  'Notes',
  'Actions',
]

/* ==========================================================
   HELPERS
========================================================== */

function columnLabel(column: SourceColumn) {
  const labels: Record<SourceColumn, string> = {
    ad_name: 'Ad Name',
    form_name: 'Form Name',
    full_name: 'Full Name',
    phone_number: 'Phone Number',
    email: 'Email',
    'project_location?': 'Project Location?',
    created_time: 'Created Time',
  }

  return labels[column]
}

function displayValue(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ''
  ) {
    return 'Nil'
  }

  return String(value)
}

function formatDate(value: string | null) {
  if (!value) return 'Nil'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString()
}

function cleanPhone(value: string | null) {
  return value ? value.replace(/^p:/i, '') : null
}

/* ==========================================================
   LEAD ROW
   One component: stacked card on small screens,
   single grid row from `xl` up. Owns its own edit drafts.
========================================================== */

function MobileLabel({ children }: { children: ReactNode }) {
  return (
    <div
      className="mb-1 text-[10px] font-semibold uppercase tracking-wide xl:hidden"
      style={{ color: 'var(--text-muted)' }}
    >
      {children}
    </div>
  )
}

function LeadRow({
  lead,
  busy,
  onSave,
  onDelete,
  onAudio,
}: {
  lead: CustomLead
  busy: boolean
  onSave: (lead: CustomLead, status: string, notes: string) => void
  onDelete: (lead: CustomLead) => void
  onAudio: (lead: CustomLead) => void
}) {
  const [status, setStatus] = useState(lead.status ?? 'new')
  const [notes, setNotes] = useState(lead.notes ?? '')

  const dirty =
    status !== (lead.status ?? 'new') ||
    notes !== (lead.notes ?? '')

  const muted = { color: 'var(--text-muted)' }

  return (
    <article
      className={`flex min-w-0 flex-col gap-4 px-4 py-4 transition-colors hover:bg-[var(--accent-soft)] xl:py-3 ${LEAD_GRID}`}
    >
      {/* Lead */}
      <div className="min-w-0">
        <div className="break-words text-sm font-semibold">
          {displayValue(lead.full_name)}
        </div>
        <div className="break-words text-xs" style={muted}>
          {displayValue(cleanPhone(lead.phone_number))}
        </div>
        {lead.email && (
          <div className="break-all text-xs" style={muted}>
            {lead.email}
          </div>
        )}
      </div>

      {/* Campaign */}
      <div className="min-w-0">
        <MobileLabel>Campaign</MobileLabel>
        <div className="break-words text-xs font-medium">
          {displayValue(lead.ad_name)}
        </div>
        <div className="break-words text-xs" style={muted}>
          {displayValue(lead.form_name)}
        </div>
        {lead.project_location && (
          <div className="break-words text-xs" style={muted}>
            📍 {lead.project_location}
          </div>
        )}
      </div>

      {/* Created */}
      <div className="min-w-0">
        <MobileLabel>Created</MobileLabel>
        <div className="break-words text-xs">
          {formatDate(lead.created_time)}
        </div>
      </div>

      {/* Status */}
      <div className="min-w-0">
        <MobileLabel>Status</MobileLabel>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label={`Status for ${lead.full_name || 'lead'}`}
          className={`block w-full min-w-0 rounded-md border px-2 py-1.5 text-xs font-medium ${
            STATUS_STYLES[status] ?? STATUS_STYLES.new
          }`}
        >
          {STATUS_OPTIONS.map((option) => (
            <option
              key={option.value}
              value={option.value}
              className="bg-slate-900 text-slate-100"
            >
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div className="min-w-0">
        <MobileLabel>Notes</MobileLabel>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes..."
          maxLength={5000}
          aria-label={`Notes for ${lead.full_name || 'lead'}`}
          className="block w-full min-w-0 resize-none rounded-md border p-2 text-xs"
          style={{
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            borderColor: 'var(--border-soft)',
          }}
        />
      </div>

      {/* Actions */}
      <div className="flex min-w-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => onAudio(lead)}
          className="inline-flex h-8 flex-1 items-center justify-center whitespace-nowrap rounded-md border border-violet-500/30 bg-violet-500/10 px-2 text-[11px] font-medium text-violet-300 transition hover:bg-violet-500/20 xl:flex-none"
        >
          🎙️ Audio
        </button>

        <button
          type="button"
          onClick={() => onSave(lead, status, notes)}
          disabled={!dirty || busy}
          className="inline-flex h-8 flex-1 items-center justify-center whitespace-nowrap rounded-md bg-blue-600 px-2.5 text-[11px] font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 xl:flex-none"
        >
          {busy ? 'Saving…' : 'Update'}
        </button>

        <button
          type="button"
          onClick={() => onDelete(lead)}
          disabled={busy}
          className="inline-flex h-8 flex-1 items-center justify-center whitespace-nowrap rounded-md border border-rose-500/30 bg-rose-500/10 px-2 text-[11px] font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40 xl:flex-none"
        >
          Delete
        </button>
      </div>
    </article>
  )
}

/* ==========================================================
   PAGE
========================================================== */

export default function CustomLeadPage() {
  const router = useRouter()

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Record<string, string>[]>([])
  const [leads, setLeads] = useState<CustomLead[]>([])

  const [processing, setProcessing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const [message, setMessage] = useState('')
  const [processedCount, setProcessedCount] = useState(0)
  const [skippedCount, setSkippedCount] = useState(0)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  /* ---------------- data loading ---------------- */

  async function loadCustomLeads() {
    try {
      setLoading(true)

      const response = await apiFetch('/custom-leads')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.detail || 'Failed to load custom leads.')
      }

      setLeads(Array.isArray(data) ? data : [])
    } catch (error: any) {
      console.error(error)
      setMessage(error?.message || 'Failed to load custom leads.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCustomLeads()
  }, [])

  /* ---------------- upload / import ---------------- */

  async function processFile(selectedFile: File) {
    try {
      setProcessing(true)
      setMessage('')

      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await apiFetch('/leads/custom/preview', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.detail || 'Could not process file.')
      }

      setPreview(Array.isArray(data.preview) ? data.preview : [])
      setProcessedCount(data.total_rows || 0)
      setSkippedCount(data.skipped_rows || 0)
      setMessage('File processed successfully.')
    } catch (error: any) {
      console.error(error)
      setMessage(error?.message || 'File processing failed.')
      setPreview([])
    } finally {
      setProcessing(false)
    }
  }

  async function importLeads() {
    if (!file) {
      setMessage('Please select a file first.')
      return
    }

    try {
      setImporting(true)
      setMessage('')

      const formData = new FormData()
      formData.append('file', file)

      const response = await apiFetch('/leads/custom/import', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.detail || 'Import failed.')
      }

      setMessage(`Import completed: ${data.saved_leads} leads added.`)

      setFile(null)
      setPreview([])
      setProcessedCount(0)
      setSkippedCount(0)

      await loadCustomLeads()
    } catch (error: any) {
      console.error(error)
      setMessage(error?.message || 'Import failed.')
    } finally {
      setImporting(false)
    }
  }

  /* ---------------- update / delete ---------------- */

  async function updateCustomLead(
    lead: CustomLead,
    status: string,
    notes: string
  ) {
    try {
      setSaving(lead.id)
      setMessage('')

      const response = await apiFetch(`/custom-leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.detail || 'Failed to update custom lead.')
      }

      setLeads((previous) =>
        previous.map((item) => (item.id === lead.id ? data : item))
      )

      setMessage('Custom lead updated successfully.')
    } catch (error: any) {
      console.error(error)
      setMessage(error?.message || 'Update failed.')
    } finally {
      setSaving(null)
    }
  }

  async function deleteCustomLead(lead: CustomLead) {
    const leadName =
      lead.full_name || lead.phone_number || lead.email || 'this lead'

    const confirmed = window.confirm(
      `Delete ${leadName}?\n\n` +
        `This will remove the lead from Custom Leads. ` +
        `Existing audio recordings and evaluations will be preserved.`
    )

    if (!confirmed) return

    try {
      setSaving(lead.id)
      setMessage('')

      const response = await apiFetch(`/custom-leads/${lead.id}`, {
        method: 'DELETE',
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.detail || 'Failed to delete custom lead.')
      }

      setLeads((previous) =>
        previous.filter((item) => item.id !== lead.id)
      )

      setMessage('Custom lead deleted successfully.')
    } catch (error: any) {
      console.error(error)
      setMessage(error?.message || 'Delete failed.')
    } finally {
      setSaving(null)
    }
  }

  /* ---------------- derived data ---------------- */

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}

    for (const lead of leads) {
      counts[lead.status] = (counts[lead.status] || 0) + 1
    }

    return counts
  }, [leads])

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase()

    return leads.filter((lead) => {
      if (statusFilter !== 'all' && lead.status !== statusFilter) {
        return false
      }

      if (!query) return true

      return [
        lead.full_name,
        lead.phone_number,
        lead.email,
        lead.ad_name,
        lead.form_name,
        lead.project_location,
      ].some((value) => value?.toLowerCase().includes(query))
    })
  }, [leads, search, statusFilter])

  /* ---------------- render ---------------- */

  const card = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-soft)',
  }

  return (
        <div className="flex h-screen w-full min-w-0 overflow-hidden">
      <Sidebar />

            <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">
        {/* ==================================================
            PAGE HEADER
        ================================================== */}
        <div className="mb-6 min-w-0">
          <h1 className="text-3xl font-bold sm:text-4xl">Custom Leads</h1>

          <p
            className="mt-1 break-words text-sm sm:text-base"
            style={{ color: 'var(--text-muted)' }}
          >
            Upload and manage custom lead data.
          </p>
        </div>

        {/* ==================================================
            UPLOAD
        ================================================== */}
        <div className="mb-6 min-w-0 rounded-xl p-4 sm:p-5" style={card}>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-bold sm:text-xl">
                Upload Lead File
              </h2>

              <p
                className="mt-1 text-xs sm:text-sm"
                style={{ color: 'var(--text-muted)' }}
              >
                CSV, XLS, or XLSX
              </p>
            </div>

            <div className="min-w-0">
              <input
                id="custom-lead-file"
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(event) => {
                  const selected = event.target.files?.[0] || null

                  setFile(selected)
                  setPreview([])
                  setMessage('')

                  if (selected) processFile(selected)
                }}
              />

              <label
                htmlFor="custom-lead-file"
                className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 sm:w-auto"
              >
                Choose Lead File
              </label>
            </div>
          </div>

          {processing && (
            <div
              className="mt-3 break-words text-xs sm:text-sm"
              style={{ color: '#60a5fa' }}
            >
              Processing file...
            </div>
          )}

          {file && !processing && (
            <div
              className="mt-3 break-words text-xs sm:text-sm"
              style={{ color: 'var(--text-muted)' }}
            >
              Selected: {file.name}
            </div>
          )}

          {message && (
            <div className="mt-3 break-words text-xs sm:text-sm">
              {message}
            </div>
          )}
        </div>

        {/* ==================================================
            PREVIEW
        ================================================== */}
        {preview.length > 0 && (
          <>
            <div className="mb-5 grid grid-cols-3 gap-3">
              {[
                ['Processed', processedCount],
                ['Skipped', skippedCount],
                ['Preview', preview.length],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="min-w-0 rounded-xl p-3 sm:p-4"
                  style={card}
                >
                  <div
                    className="text-[11px] uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {label}
                  </div>
                  <div className="mt-1 text-xl font-bold sm:text-2xl">
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {/* Preview table on wide desktop */}
            <div
              className="mb-6 hidden overflow-hidden rounded-xl 2xl:block"
              style={card}
            >
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                  <col className="w-[13%]" />
                  <col className="w-[12%]" />
                  <col className="w-[19%]" />
                </colgroup>

                <thead>
                  <tr style={{ background: 'var(--bg-surface)' }}>
                    {SOURCE_COLUMNS.map((column) => (
                      <th
                        key={column}
                        className="border-b border-white/5 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {columnLabel(column)}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {preview.map((row, index) => (
                    <tr key={index} className="border-t border-white/5">
                      {SOURCE_COLUMNS.map((column) => (
                        <td
                          key={column}
                          className="min-w-0 px-3 py-2.5 align-middle text-xs"
                        >
                          <div className="break-words">
                            {displayValue(row[column])}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Preview cards on smaller widths */}
            <div className="mb-6 grid min-w-0 gap-3 2xl:hidden">
              {preview.map((row, index) => (
                <article
                  key={index}
                  className="min-w-0 rounded-xl p-4"
                  style={card}
                >
                  <div className="mb-3 text-sm font-semibold">
                    Preview #{index + 1}
                  </div>

                  <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                    {SOURCE_COLUMNS.map((column) => (
                      <div key={column} className="min-w-0">
                        <div
                          className="text-[11px] font-semibold uppercase tracking-wide"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {columnLabel(column)}
                        </div>
                        <div className="mt-1 break-words text-sm">
                          {displayValue(row[column])}
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            <div className="mb-8 flex justify-end">
              <button
                disabled={importing || processing || !file}
                onClick={importLeads}
                className="w-full rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50 sm:w-auto"
              >
                {importing ? 'Importing...' : 'Import Leads'}
              </button>
            </div>
          </>
        )}

        {/* ==================================================
            SAVED LEADS
        ================================================== */}
        <section className="min-w-0">
          <div className="mb-3 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="break-words text-2xl font-bold">
              Custom Leads{' '}
              <span
                className="text-base font-medium"
                style={{ color: 'var(--text-muted)' }}
              >
                ({filteredLeads.length}
                {filteredLeads.length !== leads.length &&
                  ` of ${leads.length}`}
                )
              </span>
            </h2>

            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, email, ad..."
              className="w-full rounded-lg border px-3 py-2 text-sm sm:w-72"
              style={{
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-soft)',
              }}
            />
          </div>

          {/* Status filter chips */}
          <div className="mb-4 flex flex-wrap gap-2">
            {[{ value: 'all', label: 'All' }, ...STATUS_OPTIONS].map(
              (option) => {
                const active = statusFilter === option.value
                const count =
                  option.value === 'all'
                    ? leads.length
                    : statusCounts[option.value] || 0

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStatusFilter(option.value)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      active
                        ? 'border-blue-500 bg-blue-600 text-white'
                        : 'border-white/10 hover:bg-white/5'
                    }`}
                  >
                    {option.label} · {count}
                  </button>
                )
              }
            )}
          </div>

          {loading ? (
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Loading Custom Leads...
            </div>
          ) : leads.length === 0 ? (
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No Custom Leads found.
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No leads match your search or filter.
            </div>
          ) : (
            <div className="min-w-0 overflow-hidden rounded-xl" style={card}>
              {/* Column header (desktop only) */}
              <div
                className={`hidden border-b border-white/5 px-4 py-2 ${LEAD_GRID}`}
                style={{ background: 'var(--bg-surface)' }}
              >
                {LEAD_HEADERS.map((label) => (
                  <div
                    key={label}
                    className="text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {label}
                  </div>
                ))}
              </div>

              <div className="divide-y divide-white/5">
                {filteredLeads.map((lead) => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    busy={saving === lead.id}
                    onSave={updateCustomLead}
                    onDelete={deleteCustomLead}
                    onAudio={(l) =>
                      router.push(`/audio?custom_lead_id=${l.id}`)
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}