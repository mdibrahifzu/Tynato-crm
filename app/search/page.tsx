'use client'

import Sidebar from '../components/Sidebar'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function SearchPage() {

  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)

  const router = useRouter()

  async function searchLeads() {

    if (!query.trim()) {

      alert('Please enter a search query')

      return

    }

    setLoading(true)

    try {

      const {
        data: { session }
      } = await supabase.auth.getSession()

      const email =
        session?.user?.email || ''

      const response = await fetch(
        'http://127.0.0.1:8000/search',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify({
            query,
            user_email: email
          })
        }
      )

      const data =
        await response.json()

      alert(
        `${data.saved_leads} leads saved successfully`
      )

      router.push('/leads')

    } catch (error) {

      console.error(error)

      alert('Search failed')

    } finally {

      setLoading(false)

    }

  }

  return (

    <div className="flex min-h-screen">

      <Sidebar />

      <div className="flex-1 p-10">

        <h1 className="text-4xl font-bold mb-8">
          Find Leads
        </h1>

        <div
          className="rounded-xl p-8"
          style={{
            background:
              'var(--bg-card)',
            border:
              '1px solid rgba(255,255,255,0.08)'
          }}
        >

          <label
            className="block mb-3 font-medium"
            style={{
              color:
                'var(--text-primary)'
            }}
          >
            Search Query
          </label>

          <input
            className="
            w-full
            p-4
            rounded-lg
            border
            "
            placeholder="e.g. schools in trichy"
            value={query}
            onChange={(e) =>
              setQuery(
                e.target.value
              )
            }
          />

          <p
            className="mt-3 text-sm"
            style={{
              color:
                'var(--text-muted)'
            }}
          >
            Search businesses,
            schools, hospitals,
            restaurants, clinics,
            colleges, hotels and
            other local businesses.
          </p>

          <button
            className="
            bg-blue-600
            hover:bg-blue-700
            text-white
            px-6
            py-3
            rounded-lg
            mt-6
            transition
            "
            onClick={searchLeads}
            disabled={loading}
          >

            {
              loading
                ? 'Searching...'
                : 'Search Leads'
            }

          </button>

        </div>

      </div>

    </div>

  )

}