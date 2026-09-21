'use client'

import Sidebar from '../components/Sidebar'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/app/lib/api'
import { supabase } from '@/app/lib/supabase'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)

  const router = useRouter()

  async function searchLeads() {
    const trimmedQuery = query.trim()

    if (!trimmedQuery) {
      alert('Please enter a search query')
      return
    }

    setLoading(true)
    setShowUpgrade(false)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const userEmail = sessionData.session?.user?.email

      if (!userEmail) {
        alert('Your session has expired. Please log in again.')
        return
      }

      const response = await apiFetch('/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: trimmedQuery,
          user_email: userEmail,
        }),
      })

      if (response.status === 402) {
        setShowUpgrade(true)
        return
      }

      const data = await response.json()

      if (!response.ok) {
        const detail =
          typeof data?.detail === 'string'
            ? data.detail
            : data?.detail?.message
              ? data.detail.message
              : JSON.stringify(data)

        console.error('SEARCH API ERROR:', response.status, data)

        alert(`Search API error (${response.status}): ${detail}`)
        return
      }

      alert(`${data.saved_leads ?? 0} leads saved successfully`)
      router.push('/leads')
    } catch (error) {
      console.error('Search error:', error)

      alert(
        error instanceof Error
          ? error.message
          : 'Search failed'
      )
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
            background: 'var(--bg-card)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <label
            className="block mb-3 font-medium"
            style={{ color: 'var(--text-primary)' }}
          >
            Search Query
          </label>
          <form
  onSubmit={(e) => {
    e.preventDefault()
    if (!loading) {
      searchLeads()
    }
  }}
>
          <input
            className="w-full p-4 rounded-lg border"
            placeholder="e.g. schools in trichy"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <p
            className="mt-3 text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            Search businesses, schools, hospitals,
            restaurants, clinics, colleges, hotels and
            other local businesses.
          </p>

          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg mt-6 transition"
            onClick={searchLeads}
            disabled={loading}
          >
            {loading ? 'Searching...' : 'Search Leads'}
          </button></form>

          {showUpgrade && (
            <div className="mt-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-5">
              <h2 className="text-lg font-semibold">
                Free Trial Limit Reached
              </h2>

              <p className="mt-2 text-sm">
                You have used your 2 free lead searches.
                Upgrade your subscription to continue searching.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}