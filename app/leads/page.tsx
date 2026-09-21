'use client'

import Sidebar from '../components/Sidebar'
import { useEffect, useState } from 'react'
import { apiFetch } from '@/app/lib/api'


interface Lead {
  id: string
  business_name: string
  phone: string
  website: string
  address: string
  status?: string
  notes?: string
  last_updated?: string
  follow_up_date?: string
  attachment_url?: string
  attachment_name?: string
}

interface EditedLead {
  status?: string
  notes?: string
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'converted', label: 'Converted' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'interested', label: 'Interested' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'junk', label: 'Junk' },
]

function getStatusLabel(status?: string) {
  const value = status || 'new'

  return (
    STATUS_OPTIONS.find(
      (option) => option.value === value
    )?.label || 'New'
  )
}

function StatusBadge({ status }: { status?: string }) {
  const label = getStatusLabel(status)

  return (
    <span
      className="
        inline-flex
        items-center
        px-3
        py-1
        rounded-full
        text-sm
        bg-slate-500/20
        text-slate-300
      "
    >
      {label}
    </span>
  )
}
function LeadsContent() {

  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  const [editedLeads, setEditedLeads] =
    useState<Record<string, EditedLead>>({})

  const [saving, setSaving] =
    useState<string | null>(null)

  useEffect(() => {
    fetchLeads()
  }, [])

  async function fetchLeads() {
    try {
      setLoading(true)

      const response = await apiFetch('/leads')

      if (!response.ok) {
        throw new Error('Failed to fetch leads')
      }

      const data = await response.json()

      setLeads(data)
    } catch (error) {
      console.error(
        'Failed to fetch leads:',
        error
      )
    } finally {
      setLoading(false)
    }
  }

  function handleStatusChange(
    leadId: string,
    status: string
  ) {
    setEditedLeads((previous) => ({
      ...previous,
      [leadId]: {
        ...previous[leadId],
        status,
      },
    }))
  }

  function handleNotesChange(
    leadId: string,
    notes: string
  ) {
    setEditedLeads((previous) => ({
      ...previous,
      [leadId]: {
        ...previous[leadId],
        notes,
      },
    }))
  }

  async function updateLead(leadId: string) {
    try {
      setSaving(leadId)

      const lead = leads.find(
        (item) => item.id === leadId
      )

      if (!lead) {
        throw new Error('Lead not found')
      }

      const changes =
        editedLeads[leadId] || {}

      const status =
        changes.status ??
        lead.status ??
        'new'

      const notes =
        changes.notes ??
        lead.notes ??
        ''

      const formData = new FormData()

      formData.append(
        'status',
        status
      )

      formData.append(
        'notes',
        notes
      )

      const response = await apiFetch(
        `/leads/${leadId}`,
        {
          method: 'PUT',
          body: formData,
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            'Failed to update lead'
        )
      }

      /*
       * Fetch the latest database values
       * so the table always reflects the
       * saved status and notes.
       */
      await fetchLeads()

      setEditedLeads((previous) => {
        const copy = {
          ...previous,
        }

        delete copy[leadId]

        return copy
      })
    } catch (error: any) {
      console.error(
        'Failed to update lead:',
        error
      )

      alert(
        error?.message ||
          'Update failed'
      )
    } finally {
      setSaving(null)
    }
  }

if (loading) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 p-10">
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-400">Loading leads...</p>
        </div>
      </main>
    </div>
  )
}


  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 p-10">
        {/* Header */}

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold">
            Leads ({leads.length})
          </h1>
        </div>

        {/* Table */}

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
            <table className="w-full">
              <thead>
                <tr
                  style={{
                    background:
                      'var(--bg-surface)',
                  }}
                >
                  <th className="p-4 text-left">
                    Business
                  </th>

                  <th className="p-4 text-left">
                    Phone
                  </th>

                  <th className="p-4 text-left">
                    Website
                  </th>

                  <th className="p-4 text-left">
                    Attachment
                  </th>

                  <th className="p-4 text-left">
                    Status
                  </th>

                  <th className="p-4 text-left">
                    Update Status
                  </th>

                  <th className="p-4 text-left">
                    Notes
                  </th>

                  <th className="p-4 text-left">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {leads.map((lead) => {
                  const edited =
                    editedLeads[lead.id]

                  const currentStatus =
                    edited?.status ??
                    lead.status ??
                    'new'

                  const currentNotes =
                    edited?.notes ??
                    lead.notes ??
                    ''

                  return (
                    <tr
                      key={lead.id}
                      className="
                        border-t
                        border-white/5
                        hover:bg-white/5
                        transition
                      "
                    >
                      {/* Business */}

                      <td className="p-4">
                        <div className="font-semibold">
                          {lead.business_name ||
                            'N/A'}
                        </div>

                        {lead.address && (
                          <div
                            className="
                              text-xs
                              mt-1
                            "
                            style={{
                              color:
                                'var(--text-muted)',
                            }}
                          >
                            {lead.address}
                          </div>
                        )}
                      </td>

                      {/* Phone */}

                      <td className="p-4">
                        {lead.phone ||
                          'N/A'}
                      </td>

                      {/* Website */}

                      <td className="p-4">
                        {lead.website ? (
                          <a
                            href={
                              lead.website
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="
                              text-blue-400
                              hover:underline
                            "
                          >
                            Visit
                          </a>
                        ) : (
                          'N/A'
                        )}
                      </td>

                      {/* Attachment */}

                      <td className="p-4">
                        {lead.attachment_url ? (
                          <a
                            href={
                              lead.attachment_url
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="
                              text-blue-400
                              hover:underline
                            "
                          >
                            {lead.attachment_name ||
                              'View File'}
                          </a>
                        ) : (
                          'N/A'
                        )}
                      </td>

                      {/* Current Status */}

                      <td className="p-4">
                        <StatusBadge
                          status={
                            lead.status
                          }
                        />
                      </td>

                      {/* Update Status */}

                      <td className="p-4">
                        <select
  value={currentStatus}
  onChange={(e) =>
    handleStatusChange(
      lead.id,
      e.target.value
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
    cursor-pointer
  "
  style={{
    color: '#000000',
    backgroundColor: '#ffffff',
  }}
>
  {STATUS_OPTIONS.map((option) => (
    <option
      key={option.value}
      value={option.value}
      style={{
        color: '#000000',
        backgroundColor: '#ffffff',
      }}
    >
      {option.label}
    </option>
  ))}
</select>
                      </td>

                      {/* Notes */}

                      <td className="p-4">
                        <textarea
                          rows={2}
                          value={
                            currentNotes
                          }
                          onChange={(e) =>
                            handleNotesChange(
                              lead.id,
                              e.target.value
                            )
                          }
                          className="
                            border
                            rounded
                            p-2
                            w-full
                            min-w-[180px]
                            bg-white
                            text-black
                          "
                          placeholder="Add notes..."
                        />
                      </td>

                      {/* Actions */}

                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() =>
                            updateLead(
                              lead.id
                            )
                          }
                          disabled={
                            saving ===
                            lead.id
                          }
                          className="
                            bg-blue-600
                            hover:bg-blue-700
                            disabled:opacity-50
                            disabled:cursor-not-allowed
                            text-white
                            px-4
                            py-2
                            rounded
                            transition
                          "
                        >
                          {saving === lead.id
                            ? 'Saving...'
                            : 'Update'}
                        </button>
                      </td>
                    </tr>
                  )
                })}

                {leads.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="
                        p-10
                        text-center
                        text-gray-400
                      "
                    >
                      No leads found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}

export default LeadsContent
