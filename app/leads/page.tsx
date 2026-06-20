'use client'

import Sidebar from '../components/Sidebar'
import { useEffect, useState } from 'react'

interface Lead {
  id: string
  business_name: string
  phone: string
  website: string
  address: string
  status?: string
  notes?: string
}

export default function LeadsPage() {

  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  const [editedLeads, setEditedLeads] =
    useState<any>({})

  useEffect(() => {
    fetchLeads()
  }, [])

  async function fetchLeads() {

    try {

      const response = await fetch(
        'http://localhost:8000/leads'
      )

      const data = await response.json()

      setLeads(data)

    } catch (error) {

      console.error(error)

    } finally {

      setLoading(false)

    }
  }

  async function updateLead(
    leadId: string
  ) {

    try {

      const leadData =
        editedLeads[leadId]

      const response = await fetch(
        `http://localhost:8000/leads/${leadId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify({
            status:
              leadData?.status || 'new',
            notes:
              leadData?.notes || ''
          })
        }
      )

      const data =
        await response.json()

      console.log(data)

      await fetchLeads()

      setEditedLeads((prev: any) => {

        const copy = {
          ...prev
        }

        delete copy[leadId]

        return copy

      })

      alert(
        'Lead updated successfully'
      )

    } catch (error) {

      console.error(error)

      alert('Update failed')

    }

  }

  if (loading) {

    return (

      <div className="flex min-h-screen">

        <Sidebar />

        <div className="flex-1 p-10">
          Loading Leads...
        </div>

      </div>

    )
  }

  return (

    <div className="flex min-h-screen">

      <Sidebar />

      <div className="flex-1 p-10">

        <h1 className="text-4xl font-bold mb-8">
          Leads ({leads.length})
        </h1>

        <div
          className="overflow-hidden rounded-xl"
          style={{
            background:
              'var(--bg-card)',
            border:
              '1px solid rgba(255,255,255,0.08)'
          }}
        >

          <table className="w-full">

            <thead>

              <tr
                style={{
                  background:
                    'var(--bg-surface)'
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

              {leads.map((lead) => (

                <tr
                  key={lead.id}
                  className="
                  hover:bg-white/5
                  transition
                  "
                >

                  <td className="p-4">

                    <div className="font-semibold">
                      {lead.business_name}
                    </div>

                    <div
                      className="text-xs mt-1"
                      style={{
                        color:
                          'var(--text-muted)'
                      }}
                    >
                      {lead.address}
                    </div>

                  </td>

                  <td className="p-4">
                    {lead.phone || 'N/A'}
                  </td>

                  <td className="p-4">

                    {lead.website ? (

                      <a
                        href={lead.website}
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

                  <td className="p-4">

                    {lead.status === 'interested' && (
                      <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">
                        Interested
                      </span>
                    )}

                    {lead.status === 'follow_up' && (
                      <span className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-sm">
                        Follow Up
                      </span>
                    )}

                    {lead.status === 'junk' && (
                      <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm">
                        Junk
                      </span>
                    )}

                    {lead.status === 'not_interested' && (
                      <span className="bg-gray-500/20 text-gray-300 px-3 py-1 rounded-full text-sm">
                        Not Interested
                      </span>
                    )}

                    {lead.status === 'converted' && (
                      <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm">
                        Converted
                      </span>
                    )}

                    {(!lead.status ||
                      lead.status === 'new') && (
                      <span className="bg-slate-500/20 text-slate-300 px-3 py-1 rounded-full text-sm">
                        New
                      </span>
                    )}

                  </td>

                  <td className="p-4">

                    <select
                      className="
                      border
                      rounded
                      px-3
                      py-2
                      "
                      value={
                        editedLeads[lead.id]
                          ?.status ??
                        lead.status ??
                        'new'
                      }
                      onChange={(e) =>
                        setEditedLeads({
                          ...editedLeads,
                          [lead.id]: {
                            ...editedLeads[
                              lead.id
                            ],
                            status:
                              e.target.value
                          }
                        })
                      }
                    >

                      <option value="new">
                        New
                      </option>

                      <option value="follow_up">
                        Follow Up
                      </option>

                      <option value="interested">
                        Interested
                      </option>

                      <option value="not_interested">
                        Not Interested
                      </option>

                      <option value="junk">
                        Junk
                      </option>

                      <option value="converted">
                        Converted
                      </option>

                    </select>

                  </td>

                  <td className="p-4">

                    <textarea
                      rows={2}
                      className="
                      border
                      rounded
                      p-2
                      w-full
                      "
                      value={
                        editedLeads[lead.id]
                          ?.notes ??
                        lead.notes ??
                        ''
                      }
                      onChange={(e) =>
                        setEditedLeads({
                          ...editedLeads,
                          [lead.id]: {
                            ...editedLeads[
                              lead.id
                            ],
                            notes:
                              e.target.value
                          }
                        })
                      }
                    />

                  </td>

                  <td className="p-4">

                    <button
                      className="
                      bg-blue-600
                      hover:bg-blue-700
                      text-white
                      px-4
                      py-2
                      rounded
                      "
                      onClick={() =>
                        updateLead(
                          lead.id
                        )
                      }
                    >
                      Update
                    </button>

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </div>

    </div>

  )
}