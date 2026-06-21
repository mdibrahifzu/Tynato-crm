'use client'

import Sidebar from '../components/Sidebar'
import { useEffect, useState } from 'react'
import { API_URL } from '@/app/lib/config'

export default function DashboardPage() {

  const [stats, setStats] = useState<any>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboard()
  }, [])

  async function fetchDashboard() {

    try {

      const response = await fetch(
       `${API_URL}/search`
      )

      const data = await response.json()

      setStats(data)

    } catch (error) {

      console.error(error)

    } finally {

      setLoading(false)

    }

  }

  if (loading) {

    return (

      <div className="flex min-h-screen">

        <Sidebar />

        <div className="flex-1 p-10">
          Loading Dashboard...
        </div>

      </div>

    )

  }

  return (

    <div className="flex min-h-screen">

      <Sidebar />

      <div className="flex-1 p-10">

        <h1 className="text-4xl font-bold mb-8">
          Tynato CRM Dashboard
        </h1>

        {/* Stats */}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">

          <div
            className="rounded-xl p-6"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid rgba(255,255,255,0.08)'
            }}
          >

            <p
              style={{
                color: 'var(--text-muted)'
              }}
            >
              Total Leads
            </p>

            <h2 className="text-4xl font-bold mt-2">
              {stats.total_leads || 0}
            </h2>

          </div>

          <div
            className="rounded-xl p-6"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid rgba(255,255,255,0.08)'
            }}
          >

            <p
              style={{
                color: 'var(--text-muted)'
              }}
            >
              Interested
            </p>

            <h2 className="text-4xl font-bold mt-2 text-green-400">
              {stats.interested || 0}
            </h2>

          </div>

          <div
            className="rounded-xl p-6"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid rgba(255,255,255,0.08)'
            }}
          >

            <p
              style={{
                color: 'var(--text-muted)'
              }}
            >
              Follow Up
            </p>

            <h2 className="text-4xl font-bold mt-2 text-yellow-400">
              {stats.follow_up || 0}
            </h2>

          </div>

          <div
            className="rounded-xl p-6"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid rgba(255,255,255,0.08)'
            }}
          >

            <p
              style={{
                color: 'var(--text-muted)'
              }}
            >
              Converted
            </p>

            <h2 className="text-4xl font-bold mt-2 text-blue-400">
              {stats.converted || 0}
            </h2>

          </div>

        </div>

        {/* Content */}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Lead Funnel */}

          <div
            className="rounded-xl p-6"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid rgba(255,255,255,0.08)'
            }}
          >

            <h2 className="text-xl font-bold mb-6">
              Lead Funnel
            </h2>

            <div className="space-y-5">

              <div>

                <div className="flex justify-between mb-2">
                  <span>Total Leads</span>
                  <span>
                    {stats.total_leads || 0}
                  </span>
                </div>

                <div className="w-full bg-slate-700 rounded-full h-3">
                  <div
                    className="bg-blue-500 h-3 rounded-full"
                    style={{
                      width: '100%'
                    }}
                  />
                </div>

              </div>

              <div>

                <div className="flex justify-between mb-2">
                  <span>Interested</span>
                  <span>
                    {stats.interested || 0}
                  </span>
                </div>

                <div className="w-full bg-slate-700 rounded-full h-3">

                  <div
                    className="bg-green-500 h-3 rounded-full"
                    style={{
                      width: `${stats.total_leads
                        ? (stats.interested / stats.total_leads) * 100
                        : 0}%`
                    }}
                  />

                </div>

              </div>

              <div>

                <div className="flex justify-between mb-2">
                  <span>Follow Up</span>
                  <span>
                    {stats.follow_up || 0}
                  </span>
                </div>

                <div className="w-full bg-slate-700 rounded-full h-3">

                  <div
                    className="bg-yellow-500 h-3 rounded-full"
                    style={{
                      width: `${stats.total_leads
                        ? (stats.follow_up / stats.total_leads) * 100
                        : 0}%`
                    }}
                  />

                </div>

              </div>

              <div>

                <div className="flex justify-between mb-2">
                  <span>Converted</span>
                  <span>
                    {stats.converted || 0}
                  </span>
                </div>

                <div className="w-full bg-slate-700 rounded-full h-3">

                  <div
                    className="bg-purple-500 h-3 rounded-full"
                    style={{
                      width: `${stats.total_leads
                        ? (stats.converted / stats.total_leads) * 100
                        : 0}%`
                    }}
                  />

                </div>

              </div>

            </div>

          </div>

          {/* Recent Searches */}

          <div
            className="rounded-xl p-6"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid rgba(255,255,255,0.08)'
            }}
          >

            <h2 className="text-xl font-bold mb-6">
              Recent Searches
            </h2>

            <div className="space-y-3">

              {stats.recent_searches?.length > 0 ? (

                stats.recent_searches.map(
                  (
                    search: string,
                    index: number
                  ) => (

                    <div
                      key={index}
                      className="p-3 rounded-lg"
                      style={{
                        background:
                          'var(--bg-surface)'
                      }}
                    >
                      🔍 {search}
                    </div>

                  )
                )

              ) : (

                <div
                  style={{
                    color:
                      'var(--text-muted)'
                  }}
                >
                  No recent searches
                </div>

              )}

            </div>

          </div>

        </div>

      </div>

    </div>

  )

}