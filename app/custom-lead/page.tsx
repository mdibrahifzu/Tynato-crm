'use client'

import Sidebar from '../components/Sidebar'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/app/lib/api'

const SOURCE_COLUMNS = [
  'ad_name',
  'form_name',
  'full_name',
  'phone_number',
  'email',
  'project_location?',
  'created_time',
] as const

type SourceColumn =
  (typeof SOURCE_COLUMNS)[number]

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
  {
    value: 'new',
    label: 'New',
  },
  {
    value: 'converted',
    label: 'Converted',
  },
  {
    value: 'not_interested',
    label: 'Not Interested',
  },
  {
    value: 'interested',
    label: 'Interested',
  },
  {
    value: 'follow_up',
    label: 'Follow-up',
  },
  {
    value: 'junk',
    label: 'Junk',
  },
]

function columnLabel(
  column: SourceColumn
) {
  const labels: Record<
    SourceColumn,
    string
  > = {
    ad_name: 'Ad Name',
    form_name: 'Form Name',
    full_name: 'Full Name',
    phone_number: 'Phone Number',
    email: 'Email',
    'project_location?':
      'Project Location?',
    created_time: 'Created Time',
  }

  return labels[column]
}

function displayValue(
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ''
  ) {
    return 'Nil'
  }

  return String(value)
}

function formatDate(
  value: string | null
) {
  if (!value) {
    return 'Nil'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}

export default function CustomLeadPage() {
  const router = useRouter()
  const [file, setFile] =
    useState<File | null>(null)

  const [preview, setPreview] =
    useState<Record<string, string>[]>(
      []
    )

  const [leads, setLeads] =
    useState<CustomLead[]>([])

  const [processing, setProcessing] =
    useState(false)

  const [importing, setImporting] =
    useState(false)

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState<string | null>(null)

  const [statusEdits, setStatusEdits] =
    useState<Record<string, string>>({})

  const [noteEdits, setNoteEdits] =
    useState<Record<string, string>>({})

  const [message, setMessage] =
    useState('')

  const [processedCount, setProcessedCount] =
    useState(0)

  const [skippedCount, setSkippedCount] =
    useState(0)

  async function loadCustomLeads() {
    try {
      setLoading(true)

      const response =
        await apiFetch(
          '/custom-leads'
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            'Failed to load custom leads.'
        )
      }

      setLeads(
        Array.isArray(data)
          ? data
          : []
      )
    } catch (error: any) {
      console.error(error)

      setMessage(
        error?.message ||
          'Failed to load custom leads.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCustomLeads()
  }, [])

  async function processFile(
    selectedFile: File
  ) {
    try {
      setProcessing(true)
      setMessage('')

      const formData = new FormData()

      formData.append(
        'file',
        selectedFile
      )

      const response =
        await apiFetch(
          '/leads/custom/preview',
          {
            method: 'POST',
            body: formData,
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            'Could not process file.'
        )
      }

      setPreview(
        Array.isArray(data.preview)
          ? data.preview
          : []
      )

      setProcessedCount(
        data.total_rows || 0
      )

      setSkippedCount(
        data.skipped_rows || 0
      )

      setMessage(
        'File processed successfully.'
      )
    } catch (error: any) {
      console.error(error)

      setMessage(
        error?.message ||
          'File processing failed.'
      )

      setPreview([])
    } finally {
      setProcessing(false)
    }
  }

  async function importLeads() {
    if (!file) {
      setMessage(
        'Please select a file first.'
      )

      return
    }

    try {
      setImporting(true)
      setMessage('')

      const formData =
        new FormData()

      formData.append(
        'file',
        file
      )

      const response =
        await apiFetch(
          '/leads/custom/import',
          {
            method: 'POST',
            body: formData,
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            'Import failed.'
        )
      }

      setMessage(
        `Import completed: ${data.saved_leads} leads added.`
      )

      setFile(null)
      setPreview([])
      setProcessedCount(0)
      setSkippedCount(0)

      await loadCustomLeads()
    } catch (error: any) {
      console.error(error)

      setMessage(
        error?.message ||
          'Import failed.'
      )
    } finally {
      setImporting(false)
    }
  }

  async function updateCustomLead(
    lead: CustomLead
  ) {
    try {
      setSaving(lead.id)

      const status =
        statusEdits[lead.id] ??
        lead.status

      const notes =
        noteEdits[lead.id] ??
        lead.notes ??
        ''

      const response =
        await apiFetch(
          `/custom-leads/${lead.id}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              status,
              notes,
            }),
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            'Failed to update custom lead.'
        )
      }

      setLeads(
        (previous) =>
          previous.map(
            (item) =>
              item.id === lead.id
                ? data
                : item
          )
      )

      setStatusEdits(
        (previous) => {
          const next = {
            ...previous,
          }

          delete next[lead.id]

          return next
        }
      )

      setNoteEdits(
        (previous) => {
          const next = {
            ...previous,
          }

          delete next[lead.id]

          return next
        }
      )

      setMessage(
        'Custom lead updated successfully.'
      )
    } catch (error: any) {
      console.error(error)

      setMessage(
        error?.message ||
          'Update failed.'
      )
    } finally {
      setSaving(null)
    }
  }
  async function deleteCustomLead(
  lead: CustomLead
) {
  const leadName =
    lead.full_name ||
    lead.phone_number ||
    lead.email ||
    'this lead'

  const confirmed = window.confirm(
    `Delete ${leadName}?\n\n` +
      `This will remove the lead from Custom Leads. ` +
      `Existing audio recordings and evaluations will be preserved.`
  )

  if (!confirmed) {
    return
  }

  try {
    setSaving(lead.id)
    setMessage('')

    const response = await apiFetch(
      `/custom-leads/${lead.id}`,
      {
        method: 'DELETE',
      }
    )

    const data = await response
      .json()
      .catch(() => null)

    if (!response.ok) {
      throw new Error(
        data?.detail ||
          'Failed to delete custom lead.'
      )
    }

    setLeads((previous) =>
      previous.filter(
        (item) => item.id !== lead.id
      )
    )

    setMessage(
      'Custom lead deleted successfully.'
    )
  } catch (error: any) {
    console.error(error)

    setMessage(
      error?.message ||
        'Delete failed.'
    )
  } finally {
    setSaving(null)
  }
}

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 p-10">

        <div className="mb-8">
          <h1 className="text-4xl font-bold">
            Custom Leads
          </h1>

          <p
            className="mt-2"
            style={{
              color: 'var(--text-muted)',
            }}
          >
            Upload and manage custom lead data.
          </p>
        </div>

        {/* ================= UPLOAD ================= */}

        <div
          className="rounded-xl p-6 mb-8"
          style={{
            background:
              'var(--bg-card)',
            border:
              '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <h2 className="text-xl font-bold mb-4">
            Upload Lead File
          </h2>

          <input
            id="custom-lead-file"
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(event) => {
              const selected =
                event.target.files?.[0] ||
                null

              setFile(selected)
              setPreview([])
              setMessage('')

              if (selected) {
                processFile(selected)
              }
            }}
          />

          <label
            htmlFor="custom-lead-file"
            className="
              inline-flex
              px-5
              py-3
              rounded-lg
              bg-blue-600
              hover:bg-blue-700
              text-white
              font-medium
              cursor-pointer
            "
          >
            Choose Lead File
          </label>

          {processing && (
            <span className="ml-4 text-sm text-blue-400">
              Processing file...
            </span>
          )}

          {file && !processing && (
            <div className="mt-4 text-sm text-gray-300">
              {file.name}
            </div>
          )}

          {message && (
            <div className="mt-4 text-sm">
              {message}
            </div>
          )}
        </div>

        {/* ================= PREVIEW ================= */}

        {preview.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">

              <div
                className="rounded-xl p-5"
                style={{
                  background:
                    'var(--bg-card)',
                }}
              >
                <div className="text-sm text-gray-400">
                  Processed
                </div>

                <div className="text-2xl font-bold mt-1">
                  {processedCount}
                </div>
              </div>

              <div
                className="rounded-xl p-5"
                style={{
                  background:
                    'var(--bg-card)',
                }}
              >
                <div className="text-sm text-gray-400">
                  Skipped
                </div>

                <div className="text-2xl font-bold mt-1">
                  {skippedCount}
                </div>
              </div>

              <div
                className="rounded-xl p-5"
                style={{
                  background:
                    'var(--bg-card)',
                }}
              >
                <div className="text-sm text-gray-400">
                  Preview
                </div>

                <div className="text-2xl font-bold mt-1">
                  {preview.length}
                </div>
              </div>

            </div>

            <div
              className="overflow-hidden rounded-xl mb-8"
              style={{
                background:
                  'var(--bg-card)',
              }}
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px]">

                  <thead>
                    <tr
                      style={{
                        background:
                          'var(--bg-surface)',
                      }}
                    >
                      {SOURCE_COLUMNS.map(
                        (column) => (
                          <th
                            key={column}
                            className="p-4 text-left whitespace-nowrap"
                          >
                            {columnLabel(
                              column
                            )}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {preview.map(
                      (row, index) => (
                        <tr
                          key={index}
                          className="border-t border-white/5"
                        >
                          {SOURCE_COLUMNS.map(
                            (column) => (
                              <td
                                key={column}
                                className="p-4 whitespace-nowrap"
                              >
                                {displayValue(
                                  row[column]
                                )}
                              </td>
                            )
                          )}
                        </tr>
                      )
                    )}
                  </tbody>

                </table>
              </div>
            </div>

            <div className="flex justify-end mb-12">
              <button
                disabled={
                  importing ||
                  processing ||
                  !file
                }
                onClick={importLeads}
                className="
                  bg-green-600
                  hover:bg-green-700
                  disabled:opacity-50
                  text-white
                  px-6
                  py-3
                  rounded-lg
                  font-medium
                "
              >
                {importing
                  ? 'Importing...'
                  : 'Import Leads'}
              </button>
            </div>
          </>
        )}

        {/* ================= SAVED LEADS ================= */}

        <div className="mb-4">
          <h2 className="text-2xl font-bold">
            Custom Leads ({leads.length})
          </h2>
        </div>

        {loading ? (
          <div className="text-gray-400">
            Loading Custom Leads...
          </div>
        ) : leads.length === 0 ? (
          <div className="text-gray-400">
            No Custom Leads found.
          </div>
        ) : (
          <div
            className="overflow-hidden rounded-xl"
            style={{
              background:
                'var(--bg-card)',
              border:
                '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1700px]">

                <thead>
                  <tr
                    style={{
                      background:
                        'var(--bg-surface)',
                    }}
                  >
                    {SOURCE_COLUMNS.map(
                      (column) => (
                        <th
                          key={column}
                          className="p-4 text-left whitespace-nowrap"
                        >
                          {columnLabel(
                            column
                          )}
                        </th>
                      )
                    )}

                    <th className="p-4 text-left whitespace-nowrap">
                      Status
                    </th>

                    <th className="p-4 text-left whitespace-nowrap">
                      Update Status
                    </th>

                    <th className="p-4 text-left whitespace-nowrap">
                      Notes
                    </th>

                    <th className="p-4 text-left whitespace-nowrap">
                      Actions
                    </th>
                    
                  </tr>
                  
                </thead>

                <tbody>
                  {leads.map(
                    (lead) => {
                      const currentStatus =
                        statusEdits[lead.id] ??
                        lead.status ??
                        'new'

                      const currentNotes =
                        noteEdits[lead.id] ??
                        lead.notes ??
                        ''

                      return (
                        <tr
                          key={lead.id}
                          className="border-t border-white/5 hover:bg-white/5"
                        >

                          <td className="p-4 whitespace-nowrap">
                            {displayValue(
                              lead.ad_name
                            )}
                          </td>

                          <td className="p-4 whitespace-nowrap">
                            {displayValue(
                              lead.form_name
                            )}
                          </td>

                          <td className="p-4 whitespace-nowrap">
                            {displayValue(
                              lead.full_name
                            )}
                          </td>

                          <td className="p-4 whitespace-nowrap">
                            {displayValue(
                              lead.phone_number
                            )}
                          </td>

                          <td className="p-4 whitespace-nowrap">
                            {displayValue(
                              lead.email
                            )}
                          </td>

                          <td className="p-4 whitespace-nowrap">
                            {displayValue(
                              lead.project_location
                            )}
                          </td>

                          <td className="p-4 whitespace-nowrap">
                            {formatDate(
                              lead.created_time
                            )}
                          </td>

                          <td className="p-4 whitespace-nowrap">
                            <span className="px-3 py-1 rounded-full bg-slate-500/20 text-slate-300">
                              {
                                STATUS_OPTIONS.find(
                                  (option) =>
                                    option.value ===
                                    lead.status
                                )?.label ||
                                  'New'
                              }
                            </span>
                          </td>

                          <td className="p-4">
                            <select
                              value={
                                currentStatus
                              }
                              onChange={(event) =>
                                setStatusEdits(
                                  (previous) => ({
                                    ...previous,
                                    [lead.id]:
                                      event.target
                                        .value,
                                  })
                                )
                              }
                              className="
                                border
                                rounded
                                px-3
                                py-2
                                bg-white
                                text-black
                                min-w-[170px]
                              "
                            >
                              {STATUS_OPTIONS.map(
                                (option) => (
                                  <option
                                    key={
                                      option.value
                                    }
                                    value={
                                      option.value
                                    }
                                  >
                                    {
                                      option.label
                                    }
                                  </option>
                                )
                              )}
                            </select>
                          </td>

                          <td className="p-4">
                            <textarea
                              rows={2}
                              value={
                                currentNotes
                              }
                              onChange={(event) =>
                                setNoteEdits(
                                  (previous) => ({
                                    ...previous,
                                    [lead.id]:
                                      event.target
                                        .value,
                                  })
                                )
                              }
                              placeholder="Add notes..."
                              maxLength={5000}
                              className="
                                border
                                rounded
                                p-2
                                min-w-[220px]
                                bg-white
                                text-black
                              "
                            />
                          </td>

                          <td className="p-4">
  <div className="flex flex-wrap items-center gap-2">

  <button
    type="button"
    onClick={() =>
      router.push(
        `/audio?custom_lead_id=${lead.id}`
      )
    }
    className="
      rounded-lg
      border
      border-violet-500/30
      bg-violet-500/10
      px-4
      py-2
      text-violet-300
      hover:bg-violet-500/20
    "
  >
    🎙️ Audio
  </button>

  <button
    type="button"
    onClick={() =>
      updateCustomLead(lead)
    }
    disabled={saving === lead.id}
    className="
      rounded-lg
      bg-blue-600
      px-4
      py-2
      text-white
      hover:bg-blue-700
      disabled:opacity-50
    "
  >
    {saving === lead.id
      ? 'Saving...'
      : 'Update'}
  </button>

  <button
    type="button"
    onClick={() =>
      deleteCustomLead(lead)
    }
    disabled={saving === lead.id}
    className="
      rounded-lg
      border
      border-rose-500/30
      bg-rose-500/10
      px-4
      py-2
      text-rose-300
      hover:bg-rose-500/20
      disabled:opacity-50
    "
  >
    Delete
  </button>

</div>
</td>

                        </tr>
                      )
                    }
                  )}
                </tbody>

              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}