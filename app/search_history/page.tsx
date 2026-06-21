'use client'

import Sidebar from '../components/Sidebar'
import { useEffect, useState } from 'react'
import { API_URL } from '@/app/lib/config'

interface SearchHistory {
  id: string
  query: string
  user_email: string
  created_at: string
}

export default function SearchHistoryPage() {

  const [history, setHistory] = useState<SearchHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchHistory()
  }, [])

  async function fetchHistory() {

    try {

      const response = await fetch(
        `${API_URL}/search_history`
      )

      const data = await response.json()

      if (Array.isArray(data)) {

        setHistory(data)

      } else {

        setHistory([])

      }

    } catch (error) {

      console.error(error)

      setHistory([])

    } finally {

      setLoading(false)

    }
  }

  if (loading) {

    return (

      <div className="flex min-h-screen">

        <Sidebar />

        <div className="flex-1 p-10">
          Loading Search History...
        </div>

      </div>

    )
  }

  return (

    <div className="flex min-h-screen">

      <Sidebar />

      <div className="flex-1 p-10">

        <h1 className="text-4xl font-bold mb-8">
          Search History
        </h1>

        <div
          className="overflow-hidden rounded-xl"
          style={{
            background: 'var(--bg-card)',
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
                  #
                </th>

                <th className="p-4 text-left">
                  Query
                </th>

                <th className="p-4 text-left">
                  User
                </th>

                <th className="p-4 text-left">
                  Created
                </th>

                <th className="p-4 text-left">
                  Status
                </th>

              </tr>

            </thead>

            <tbody>

              {history.length === 0 ? (

                <tr>

                  <td
                    colSpan={5}
                    className="p-10 text-center"
                  >

                    <div className="text-5xl mb-3">
                      🔍
                    </div>

                    <h2 className="text-xl font-semibold">
                      No Search History Found
                    </h2>

                  </td>

                </tr>

              ) : (

                history.map((item, index) => (

                  <tr
                    key={item.id}
                    className="
                    hover:bg-white/5
                    transition
                    "
                  >

                    <td className="p-4">
                      {index + 1}
                    </td>

                    <td className="p-4 font-medium">
                      {item.query}
                    </td>

                    <td className="p-4">
                      {item.user_email || 'N/A'}
                    </td>

                    <td className="p-4">
                      {
                        new Date(
                          item.created_at
                        ).toLocaleString()
                      }
                    </td>

                    <td className="p-4">

                      <span
                        className="
                        px-3
                        py-1
                        rounded-full
                        text-sm
                        "
                        style={{
                          background:
                            '#22c55e20',
                          color:
                            '#22c55e'
                        }}
                      >
                        Done
                      </span>

                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>

      </div>

    </div>

  )
}