'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import { apiFetch } from '@/app/lib/api'

type AudioItem = {
  id: string
  original_filename: string
  file_size: number
  status: 'uploaded' | 'processing' | 'completed' | 'failed'
  created_at: string
  updated_at: string
  summary?: string | null
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown date'
  }

  return date.toLocaleString()
}

export default function AudioEvaluationPage() {
  const router = useRouter()

  const [items, setItems] = useState<AudioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [evaluatingId, setEvaluatingId] =
    useState<string | null>(null)
  const [error, setError] = useState('')

  const loadAudio = useCallback(async () => {
    try {
      setError('')

      const response = await apiFetch(
        '/audio?limit=50&offset=0'
      )

      const body = await response
        .json()
        .catch(() => null)

      if (!response.ok) {
        throw new Error(
          body?.detail ||
            `Failed to load recordings: ${response.status}`
        )
      }

      setItems(Array.isArray(body) ? body : [])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load recordings.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAudio()
  }, [loadAudio])

  const evaluateAudio = async (
    audioId: string
  ) => {
    if (evaluatingId) return

    setEvaluatingId(audioId)
    setError('')

    try {
      const response = await apiFetch(
        `/audio/${audioId}/evaluate`,
        {
          method: 'POST',
        }
      )

      const body = await response
        .json()
        .catch(() => null)

      if (!response.ok) {
        throw new Error(
          body?.detail ||
            `Evaluation failed: ${response.status}`
        )
      }

      router.push(
        `/audio/evaluation/${audioId}`
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to start evaluation.'
      )
    } finally {
      setEvaluatingId(null)
    }
  }

  const completedCalls = items.filter(
    (item) => item.status === 'completed'
  )

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="min-w-0 flex-1 p-5 sm:p-7 lg:p-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <button
              type="button"
              onClick={() => router.push('/audio')}
              className="mb-5 text-sm text-white/45 hover:text-white"
            >
              ← Back to Call Recordings
            </button>

            <p className="text-sm font-medium uppercase tracking-[0.18em] text-blue-400">
              AI Sales Analysis
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Call Evaluation
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50 sm:text-base">
              Select a completed sales call to run the
              AI performance evaluation.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-rose-400/10 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          )}

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-white/50">
              Loading completed recordings…
            </div>
          ) : completedCalls.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
              <div className="text-lg font-semibold">
                No completed recordings
              </div>

              <p className="mt-2 text-sm text-white/45">
                Upload a call recording and wait until
                processing is complete before evaluating it.
              </p>

              <button
                type="button"
                onClick={() => router.push('/audio')}
                className="mt-6 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium hover:bg-blue-500"
              >
                Go to Call Recordings
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {completedCalls.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold">
                        {item.original_filename}
                      </h2>

                      <p className="mt-1 text-xs text-white/35">
                        {formatBytes(item.file_size)} ·{' '}
                        {formatDate(item.created_at)}
                      </p>

                      {item.summary && (
                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/50">
                          {item.summary}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={
                        evaluatingId === item.id
                      }
                      onClick={() =>
                        evaluateAudio(item.id)
                      }
                      className="shrink-0 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {evaluatingId === item.id
                        ? 'Starting Evaluation…'
                        : 'AI Evaluation'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}