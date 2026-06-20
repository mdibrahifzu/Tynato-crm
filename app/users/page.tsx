'use client'

import Sidebar from '../components/Sidebar'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface User {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
  created_at: string
}

export default function UsersPage() {

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {

    const { data, error } =
      await supabase
        .from('profiles')
        .select('*')
        .order(
          'created_at',
          { ascending: false }
        )

    if (error) {

      alert(error.message)

      setLoading(false)

      return
    }

    setUsers(data || [])
    setLoading(false)
  }

  if (loading) {

    return (

      <div className="flex min-h-screen">

        <Sidebar />

        <div className="flex-1 p-10">
          Loading Users...
        </div>

      </div>

    )
  }

  return (

    <div className="flex min-h-screen">

      <Sidebar />

      <div className="flex-1 p-10">

        <h1 className="text-3xl font-bold mb-6">
          Users Management
        </h1>

        <div className="overflow-x-auto rounded-xl">

          <table
            className="min-w-full"
            style={{
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >

            <thead>

              <tr
                style={{
                  background: 'var(--bg-surface)'
                }}
              >

                <th
                  className="p-4 text-left"
                  style={{
                    borderBottom:
                      '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  Name
                </th>

                <th
                  className="p-4 text-left"
                  style={{
                    borderBottom:
                      '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  Email
                </th>

                <th
                  className="p-4 text-left"
                  style={{
                    borderBottom:
                      '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  Role
                </th>

                <th
                  className="p-4 text-left"
                  style={{
                    borderBottom:
                      '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  Status
                </th>

                <th
                  className="p-4 text-left"
                  style={{
                    borderBottom:
                      '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  Created
                </th>

              </tr>

            </thead>

            <tbody>

              {users.map((user) => (

                <tr
                  key={user.id}
                  className="hover:bg-white/5 transition"
                >

                  <td
                    className="p-4"
                    style={{
                      borderBottom:
                        '1px solid rgba(255,255,255,0.06)'
                    }}
                  >
                    {user.full_name}
                  </td>

                  <td
                    className="p-4"
                    style={{
                      borderBottom:
                        '1px solid rgba(255,255,255,0.06)'
                    }}
                  >
                    {user.email}
                  </td>

                  <td
                    className="p-4"
                    style={{
                      borderBottom:
                        '1px solid rgba(255,255,255,0.06)'
                    }}
                  >
                    {user.role}
                  </td>

                  <td
                    className="p-4"
                    style={{
                      borderBottom:
                        '1px solid rgba(255,255,255,0.06)'
                    }}
                  >

                    <span
                      className="
                      px-3
                      py-1
                      rounded-full
                      text-sm
                      font-medium
                      "
                      style={{
                        background:
                          user.is_active
                            ? '#22c55e20'
                            : '#ef444420',

                        color:
                          user.is_active
                            ? '#22c55e'
                            : '#ef4444'
                      }}
                    >
                      {
                        user.is_active
                          ? 'Active'
                          : 'Disabled'
                      }
                    </span>

                  </td>

                  <td
                    className="p-4"
                    style={{
                      borderBottom:
                        '1px solid rgba(255,255,255,0.06)'
                    }}
                  >
                    {
                      new Date(
                        user.created_at
                      ).toLocaleString()
                    }
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