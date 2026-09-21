'use client'

import {
  ChangeEvent,
  DragEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react' 
import {
  useRouter,
  useSearchParams,
} from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import { apiFetch } from '@/app/lib/api'

type AudioStatus =
  | 'uploaded'
  | 'processing'
  | 'completed'
  | 'failed'

type AudioItem = {
  id: string
  owner_id?: string
  team_id?: string | null
  custom_lead_id?: string | null
  original_filename: string
  mime_type: string
  file_size: number
  status: AudioStatus
  processing_attempts: number
  error_message?: string | null
  created_at: string
  updated_at: string
  lead_name?: string | null
  lead_phone?: string | null
  lead_email?: string | null
  transcript?: string | null
  summary?: string | null
  key_points?: string[] | null
  action_items?: string[] | null
  decisions?: string[] | null
  follow_up?: string[] | null
}

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

const MAX_FILE_SIZE = 25 * 1024 * 1024

const ACCEPTED_TYPES = new Set([
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/ogg',
  'audio/flac',
  'audio/webm',
])

const ACCEPTED_EXTENSIONS =
  /\.(mp3|wav|m4a|aac|ogg|flac|webm)$/i

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

function statusLabel(status: AudioStatus) {
  switch (status) {
    case 'uploaded':
      return 'Queued'
    case 'processing':
      return 'Processing'
    case 'completed':
      return 'Completed'
    case 'failed':
      return 'Failed'
    default:
      return status
  }
}

function statusClass(status: AudioStatus) {
  switch (status) {
    case 'completed':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'

    case 'processing':
      return 'border-blue-400/20 bg-blue-400/10 text-blue-300'

    case 'failed':
      return 'border-rose-400/20 bg-rose-400/10 text-rose-300'

    default:
      return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
  }
}

function AudioPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [items, setItems] = useState<AudioItem[]>([])
  const [customLeads, setCustomLeads] = useState<CustomLead[]>([])
  const [selectedLeadId, setSelectedLeadId] =
    useState<string>('')

  const [selected, setSelected] =
    useState<AudioItem | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)

  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [evaluatingId, setEvaluatingId] =
    useState<string | null>(null)
  const [processingAudioId, setProcessingAudioId] =
    useState<string | null>(null)

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  

  const loadCustomLeads = useCallback(async () => {
    try {
      const response = await apiFetch('/custom-leads')

      const body = await response
        .json()
        .catch(() => null)

      if (!response.ok) {
        throw new Error(
          body?.detail ||
            `Failed to load leads: ${response.status}`
        )
      }

      setCustomLeads(
        Array.isArray(body)
          ? body
          : Array.isArray(body?.data)
            ? body.data
            : []
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load custom leads.'
      )
    }
  }, [])

  const leadIdFromUrl =
    searchParams.get('custom_lead_id') ?? ''

  useEffect(() => {
    setSelectedLeadId(leadIdFromUrl)
  }, [leadIdFromUrl])

  useEffect(() => {
    loadCustomLeads()
  }, [loadCustomLeads])

  const loadAudio = useCallback(async () => {
    try {
      setError('')
      setLoading(true)

      const params = new URLSearchParams({
        limit: '20',
        offset: '0',
      })

      if (selectedLeadId) {
        params.set('custom_lead_id', selectedLeadId)
      }

      const response = await apiFetch(
        `/audio?${params.toString()}`
      )

      const body = await response
        .json()
        .catch(() => null)

      if (!response.ok) {
        throw new Error(
          body?.detail ||
            `Failed to load audio: ${response.status}`
        )
      }

      setItems(Array.isArray(body) ? body : [])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load audio.'
      )
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [selectedLeadId])

  const fetchAudioById = useCallback(
    async (audioId: string) => {
      const response = await apiFetch(
        `/audio/${audioId}`
      )

      const body = await response
        .json()
        .catch(() => null)

      if (!response.ok) {
        throw new Error(
          body?.detail ||
            `Failed to load audio: ${response.status}`
        )
      }

      return body as AudioItem
    },
    []
  )

  useEffect(() => {
    setSelected(null)
    loadAudio()
  }, [loadAudio])

  useEffect(() => {
    if (!processingAudioId) return

    let cancelled = false
    let timer: number | undefined

    const poll = async () => {
      if (cancelled) return

      try {
        const audio = await fetchAudioById(
          processingAudioId
        )

        if (cancelled) return

        setItems((previous) =>
          previous.map((item) =>
            item.id === audio.id
              ? { ...item, ...audio }
              : item
          )
        )

        setSelected((current) =>
          current?.id === audio.id
            ? { ...current, ...audio }
            : current
        )

        if (audio.status === 'completed') {
          setProcessingAudioId(null)
          setMessage(
            'Audio processing completed. You can now evaluate the call.'
          )
          return
        }

        if (audio.status === 'failed') {
          setProcessingAudioId(null)
          setError(
            audio.error_message ||
              'Audio processing failed.'
          )
          return
        }

        timer = window.setTimeout(poll, 3000)
      } catch (err) {
        console.error(
          'Audio status polling failed:',
          err
        )

        if (!cancelled) {
          timer = window.setTimeout(poll, 5000)
        }
      }
    }

    poll()

    return () => {
      cancelled = true
      if (timer !== undefined) {
        window.clearTimeout(timer)
      }
    }
  }, [processingAudioId, fetchAudioById])

  

  const validateFile = (nextFile: File) => {
    if (!nextFile.size) {
      return 'The selected file is empty.'
    }

    if (nextFile.size > MAX_FILE_SIZE) {
      return 'Audio file must be 25 MB or smaller.'
    }

    const validMime =
      !nextFile.type ||
      ACCEPTED_TYPES.has(nextFile.type)

    const validExtension =
      ACCEPTED_EXTENSIONS.test(nextFile.name)

    if (!validMime || !validExtension) {
      return (
        'Unsupported format. Use MP3, WAV, M4A, AAC, ' +
        'OGG, FLAC, or WEBM.'
      )
    }

    return ''
  }

  const applyFile = (nextFile: File | null) => {
    setError('')
    setMessage('')

    if (!nextFile) {
      setFile(null)
      return
    }

    const validationError =
      validateFile(nextFile)

    if (validationError) {
      setFile(null)
      setError(validationError)
      return
    }

    setFile(nextFile)
  }

  const chooseFile = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    applyFile(
      event.target.files?.[0] ?? null
    )
  }
  
  const handleDrop = (
    event: DragEvent<HTMLButtonElement>
  ) => {
    event.preventDefault()
    setDragging(false)

    applyFile(
      event.dataTransfer.files?.[0] ?? null
    )
  }

  const uploadAudio = async () => {
    if (!file || uploading) return

    setUploading(true)
    setError('')
    setMessage('Uploading audio…')

    try {
      const formData = new FormData()
      formData.append('file', file)

      if (selectedLeadId) {
        formData.append(
          'custom_lead_id',
          selectedLeadId
        )
      }

      const response = await apiFetch(
        '/audio/upload',
        {
          method: 'POST',
          body: formData,
        }
      )

      const body = await response
        .json()
        .catch(() => null)

      if (!response.ok) {
        throw new Error(
          body?.detail ||
            `Upload failed: ${response.status}`
        )
      }

      setFile(null)

      if (inputRef.current) {
        inputRef.current.value = ''
      }

      const audioId = body?.audio_id as
        | string
        | undefined

      if (!audioId) {
        throw new Error(
          'Upload succeeded but no audio ID was returned.'
        )
      }

      const newAudio = await fetchAudioById(audioId)

      setItems((previous) => [
        newAudio,
        ...previous.filter((item) => item.id !== audioId),
      ])
      setSelected(null)
      setProcessingAudioId(audioId)
      setMessage(
        'Upload complete. Processing has started.'
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Upload failed.'
      )
      setMessage('')
    } finally {
      setUploading(false)
    }
  }

  const openAudio = async (audioId: string) => {
    setError('')
    setMessage('Loading recording…')

    try {
      const response = await apiFetch(
        `/audio/${audioId}`
      )

      const body = await response
        .json()
        .catch(() => null)

      if (!response.ok) {
        throw new Error(
          body?.detail ||
            `Failed to load audio: ${response.status}`
        )
      }

      setSelected(body)
      setMessage('')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load audio.'
      )
      setMessage('')
    }
  }

  const retryAudio = async (audioId: string) => {
    setError('')
    setMessage('Retrying processing…')

    try {
      const response = await apiFetch(
        `/audio/${audioId}/retry`,
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
            `Retry failed: ${response.status}`
        )
      }

      const updatedAudio = await fetchAudioById(audioId)

      setItems((previous) =>
        previous.map((item) =>
          item.id === audioId
            ? { ...item, ...updatedAudio }
            : item
        )
      )
      setSelected((current) =>
        current?.id === audioId
          ? { ...current, ...updatedAudio }
          : current
      )
      setProcessingAudioId(audioId)
      setMessage(
        'Audio queued for processing.'
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Retry failed.'
      )
      setMessage('')
    }
  }

  const evaluateAudio = async (
    audioId: string
  ) => {
    if (evaluatingId) return

    setEvaluatingId(audioId)
    setError('')
    setMessage('Starting AI evaluation…')

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
          : 'Unable to start AI evaluation.'
      )
      setMessage('')
    } finally {
      setEvaluatingId(null)
    }
  }

  const deleteAudio = async (
    audioId: string
  ) => {
    const confirmed = window.confirm(
      'Delete this audio recording and its evaluation?'
    )

    if (!confirmed) return

    setError('')
    setMessage('Deleting recording…')

    try {
      const response = await apiFetch(
        `/audio/${audioId}`,
        {
          method: 'DELETE',
        }
      )

      const body = await response
        .json()
        .catch(() => null)

      if (!response.ok) {
        throw new Error(
          body?.detail ||
            `Delete failed: ${response.status}`
        )
      }

      if (processingAudioId === audioId) {
        setProcessingAudioId(null)
      }

      setItems((previous) =>
        previous.filter((item) => item.id !== audioId)
      )

      setSelected((current) =>
        current?.id === audioId
          ? null
          : current
      )

      setMessage('Audio deleted.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Delete failed.'
      )
      setMessage('')
    }
  }

  const openPicker = () => {
    inputRef.current?.click()
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="min-w-0 flex-1 p-5 sm:p-7 lg:p-10">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-blue-400">
              CRM Audio
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Call Recordings
            </h1>

            <p
              className="mt-2 max-w-2xl text-sm leading-6 sm:text-base"
              style={{
                color: 'var(--text-muted)',
              }}
            >
              Upload a sales call, let the CRM
              process it, then run an AI evaluation.
            </p>
          </header>

          {(message || error) && (
            <div className="mb-6 space-y-3">
              {message && (
                <div className="rounded-xl border border-blue-400/10 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
                  {message}
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-rose-400/10 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {error}
                </div>
              )}
            </div>
          )}

          <section
            className="rounded-2xl p-6"
            style={{
              background: 'var(--bg-card)',
              border:
                '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div>
              <h2 className="text-xl font-semibold">
                Upload Call Recording
              </h2>

              <p
                className="mt-1 text-sm"
                style={{
                  color: 'var(--text-muted)',
                }}
              >
                Maximum 25 MB. Supported formats:
                MP3, WAV, M4A, AAC, OGG, FLAC and WEBM.
              </p>
            </div>

            <div className="mt-6">
              <label
                htmlFor="audio-lead"
                className="mb-2 block text-sm font-medium"
              >
                Associate with Lead
              </label>

              <select
                id="audio-lead"
                value={selectedLeadId}
                onChange={(event) => {
                  const nextLeadId = event.target.value
                  setSelectedLeadId(nextLeadId)

                  router.replace(
                    nextLeadId
                      ? `/audio?custom_lead_id=${nextLeadId}`
                      : '/audio'
                  )
                }}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400/40"
              >
                <option value="" className="bg-slate-900">
                  All Leads / No Lead
                </option>

                {customLeads.map((lead) => (
                  <option
                    key={lead.id}
                    value={lead.id}
                    className="bg-slate-900"
                  >
                    {lead.full_name || 'Unnamed Lead'}
                    {lead.phone_number
                      ? ` — ${lead.phone_number}`
                      : ''}
                  </option>
                ))}
              </select>

              <p
                className="mt-2 text-xs"
                style={{
                  color: 'var(--text-muted)',
                }}
              >
                Select the Custom Lead this recording belongs to.
                Multiple calls can be stored for the same lead.
              </p>
            </div>

            <button
              type="button"
              onClick={openPicker}
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => {
                setDragging(false)
              }}
              onDrop={handleDrop}
              className={`mt-6 flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${
                dragging
                  ? 'border-blue-400 bg-blue-500/10'
                  : 'border-white/10 hover:border-white/20 hover:bg-white/[0.03]'
              }`}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-2xl text-blue-300">
                ↑
              </div>

              <div className="mt-4 font-semibold">
                Drop your audio here
              </div>

              <div
                className="mt-1 text-sm"
                style={{
                  color: 'var(--text-muted)',
                }}
              >
                or click to browse
              </div>
            </button>

            <input
              ref={inputRef}
              type="file"
              accept=".mp3,.wav,.m4a,.aac,.ogg,.flac,.webm,audio/*"
              onChange={chooseFile}
              className="sr-only"
            />

            {file && (
              <div className="mt-4 flex flex-col gap-4 rounded-xl border border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {file.name}
                  </div>

                  <div
                    className="mt-1 text-xs"
                    style={{
                      color: 'var(--text-muted)',
                    }}
                  >
                    {formatBytes(file.size)}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null)

                      if (inputRef.current) {
                        inputRef.current.value = ''
                      }
                    }}
                    className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
                  >
                    Remove
                  </button>

                  <button
                    type="button"
                    onClick={uploadAudio}
                    disabled={uploading}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {uploading
                      ? 'Uploading…'
                      : 'Upload Audio'}
                  </button>
                </div>
              </div>
            )}
          </section>

          <section
            className="mt-8 rounded-2xl p-6"
            style={{
              background: 'var(--bg-card)',
              border:
                '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {selectedLeadId && (
              <div className="mb-5 rounded-xl border border-violet-400/10 bg-violet-500/[0.05] px-4 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-violet-300">
                      Lead Audio History
                    </p>
                    <p className="mt-1 font-medium">
                      {customLeads.find(
                        (lead) => lead.id === selectedLeadId
                      )?.full_name || 'Selected Lead'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLeadId('')
                      router.replace('/audio')
                    }}
                    className="w-fit rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
                  >
                    Show All Audio
                  </button>
                </div>
              </div>
            )}

            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  {selectedLeadId
                    ? 'Previous Recordings'
                    : 'Call Recordings'}
                </h2>

                <p
                  className="mt-1 text-sm"
                  style={{
                    color: 'var(--text-muted)',
                  }}
                >
                  {selectedLeadId
                    ? 'Previous calls for this lead'
                    : 'Upload → Process → Evaluate'}
                </p>
              </div>

              {items.length > 0 && (
                <button
                  type="button"
                  onClick={loadAudio}
                  className="w-fit rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
                >
                  Refresh
                </button>
              )}
            </div>

            {loading ? (
              <div className="rounded-xl border border-white/10 p-6 text-sm text-white/50">
                Loading recordings…
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-xl border border-white/10 p-8 text-center">
                <div className="font-medium">
                  No recordings yet
                </div>

                <div
                  className="mt-1 text-sm"
                  style={{
                    color: 'var(--text-muted)',
                  }}
                >
                  Upload your first sales call to get
                  started.
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-xl border border-white/10 p-4"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {item.original_filename}
                        </div>

                        {item.custom_lead_id && (
                          <div className="mt-2 text-xs text-violet-300">
                            Lead: {item.lead_name || 'Unnamed Lead'}
                            {item.lead_phone
                              ? ` · ${item.lead_phone}`
                              : ''}
                          </div>
                        )}

                        <div
                          className="mt-1 text-xs"
                          style={{
                            color:
                              'var(--text-muted)',
                          }}
                        >
                          {formatBytes(
                            item.file_size
                          )}{' '}
                          ·{' '}
                          {formatDate(
                            item.created_at
                          )}
                        </div>
                      </div>

                      <span
                        className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-medium ${statusClass(item.status)}`}
                      >
                        {statusLabel(item.status)}
                      </span>
                    </div>

                    {item.error_message && (
                      <div className="mt-3 rounded-lg border border-rose-400/10 bg-rose-500/10 p-3 text-xs text-rose-200">
                        {item.error_message}
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          openAudio(item.id)
                        }
                        className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
                      >
                        {item.status ===
                        'completed'
                          ? 'View Result'
                          : 'View Status'}
                      </button>

                      {item.status ===
                        'completed' && (
                        <button
                          type="button"
                          disabled={
                            evaluatingId ===
                            item.id
                          }
                          onClick={() =>
                            evaluateAudio(
                              item.id
                            )
                          }
                          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {evaluatingId ===
                          item.id
                            ? 'Starting…'
                            : 'AI Evaluation'}
                        </button>
                      )}

                      {item.status === 'failed' && (
                        <button
                          type="button"
                          onClick={() =>
                            retryAudio(item.id)
                          }
                          className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium hover:bg-amber-500"
                        >
                          Retry
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          deleteAudio(item.id)
                        }
                        className="rounded-lg border border-rose-400/20 px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10"
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {selected && (
            <section
              className="mt-8 rounded-2xl p-6"
              style={{
                background: 'var(--bg-card)',
                border:
                  '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold">
                    {selected.original_filename}
                  </h2>

                  {selected.custom_lead_id && (
                    <p className="mt-1 text-xs text-violet-300">
                      Lead: {selected.lead_name || 'Unnamed Lead'}
                      {selected.lead_phone
                        ? ` · ${selected.lead_phone}`
                        : ''}
                    </p>
                  )}

                  <p
                    className="mt-1 text-sm"
                    style={{
                      color:
                        'var(--text-muted)',
                    }}
                  >
                    {statusLabel(
                      selected.status
                    )}{' '}
                    ·{' '}
                    {formatDate(
                      selected.updated_at
                    )}
                  </p>
                </div>

                {selected.status ===
                  'completed' && (
                  <button
                    type="button"
                    onClick={() =>
                      evaluateAudio(
                        selected.id
                      )
                    }
                    disabled={
                      evaluatingId ===
                      selected.id
                    }
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
                  >
                    {evaluatingId ===
                    selected.id
                      ? 'Starting…'
                      : 'AI Evaluation'}
                  </button>
                )}
              </div>

              {selected.summary && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold">
                    Summary
                  </h3>

                  <p
                    className="mt-2 text-sm leading-6"
                    style={{
                      color:
                        'var(--text-muted)',
                    }}
                  >
                    {selected.summary}
                  </p>
                </div>
              )}

              {selected.key_points &&
                selected.key_points.length >
                  0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold">
                      Key Points
                    </h3>

                    <ul className="mt-2 space-y-2 text-sm text-white/60">
                      {selected.key_points.map(
                        (point, index) => (
                          <li key={index}>
                            • {point}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}

              {selected.action_items &&
                selected.action_items.length >
                  0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold">
                      Action Items
                    </h3>

                    <ul className="mt-2 space-y-2 text-sm text-white/60">
                      {selected.action_items.map(
                        (item, index) => (
                          <li key={index}>
                            • {item}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}
            </section>
          )}
        </div>
      </main>
    </div>
   )
}

export default function AudioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-sm text-white/50">
            Loading audio…
          </div>
        </div>
      }
    >
      <AudioPageContent />
    </Suspense>
  )
}