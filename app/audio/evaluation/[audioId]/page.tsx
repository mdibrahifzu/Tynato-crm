'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useParams, useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import { apiFetch } from '@/app/lib/api'
import { supabase } from '@/app/lib/supabase'

type ScoreItem = {
  score: number
  max_score: number
  assessment?: string
  confidence?: string
  evidence?: {
    text: string
    confidence: string
  }[]
}

type Recommendation = {
  problem: string
  evidence?: {
    text: string
    confidence: string
  }[]
  action: string
  priority: string
  success_criteria: string
  when_to_apply: string
}

type Risk = {
  risk: string
  evidence?: {
    text: string
    confidence: string
  }[]
  severity: string
  recommended_action: string
}

type CustomerAnalysis = {
  problems: string[]
  goals: string[]
  requirements: string[]
  concerns: string[]
  objections: string[]
  budget: string
  timeline: string
  decision_maker: string
  competitors: string[]
  buying_signals: string[]
  risk_signals: string[]
  engagement: string
  commitment: string
  requested_next_action: string
  buying_intent: string
}

type EvaluationAnalysis = {
  summary: string
  confidence: string
  lead_stage: string
  manager_insight: string
  salesperson_analysis: Record<
    string,
    ScoreItem
  >
  customer_analysis: CustomerAnalysis
  conversion_risks: Risk[]
  new_recommendations: Recommendation[]
  next_call_plan: string[]
  conversion_strategy: {
    recommended_action: string
    reason: string
  }
  objections: {
    objection: string
    root_cause: string
    salesperson_response: string
    response_quality: string
    missed_opportunity: string
    recommended_response: string
    confidence: string
  }[]
  sales_process_compliance: {
    status: string
    violations: string[]
    evidence: {
      text: string
      confidence: string
    }[]
  }
}

type Evaluation = {
  id: string
  audio_id: string
  status:
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed'
    | string

  client_name: string | null
  is_new_conversation: boolean | null
  performance_score: number | null
  summary: string | null
  model_name: string | null
  error_message?: string | null
  analysis: EvaluationAnalysis
}

type HistoryItem = {
  id: string
  audio_id: string
  client_name: string | null
  performance_score: number | null
  summary: string | null
  model_name: string | null
  analysis?: EvaluationAnalysis
  created_at: string
  updated_at: string
}

const scoreOrder = [
  ['opening', 'Opening'],
  ['rapport', 'Rapport'],
  ['discovery', 'Discovery'],
  ['question_quality', 'Question Quality'],
  ['active_listening', 'Active Listening'],
  ['problem_identification', 'Problem Identification'],
  ['qualification', 'Qualification'],
  ['presentation', 'Presentation'],
  ['value_proposition', 'Value Proposition'],
  ['personalization', 'Personalization'],
  ['objection_handling', 'Objection Handling'],
  ['trust_building', 'Trust Building'],
  ['price_handling', 'Price Handling'],
  ['urgency', 'Urgency'],
  ['closing', 'Closing'],
  ['next_step', 'Next Step'],
] as const

function pretty(value?: string | null) {
  if (!value) return 'Unknown'

  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    )
}

function scoreLabel(score: number) {
  if (score >= 85) return 'Excellent'
  if (score >= 70) return 'Strong'
  if (score >= 55) return 'Needs Improvement'
  return 'At Risk'
}

function scoreBarClass(score: number) {
  if (score >= 85) return 'bg-emerald-400'
  if (score >= 70) return 'bg-blue-400'
  if (score >= 55) return 'bg-amber-400'
  return 'bg-rose-400'
}

function evidenceText(
  evidence:
    | {
        text: string
        confidence: string
      }[]
    | undefined
) {
  return evidence?.map((item) => item.text) ?? []
}

export default function AudioEvaluationDetailPage() {
  const params = useParams()
  const router = useRouter()

  const audioId = String(params.audioId ?? '')

  const [authChecking, setAuthChecking] =
    useState(true)

  const [loading, setLoading] =
    useState(true)

  const [evaluation, setEvaluation] =
    useState<Evaluation | null>(null)

  const [history, setHistory] =
    useState<HistoryItem[]>([])

  const [error, setError] = useState('')

  const [polling, setPolling] =
    useState(false)

  useEffect(() => {
    let mounted = true

    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!mounted) return

      if (!session) {
        router.replace('/login')
        return
      }

      setAuthChecking(false)
    }

    checkAuth()

    return () => {
      mounted = false
    }
  }, [router])

  const loadEvaluation = useCallback(
    async (showLoader = true) => {
      if (!audioId) return

      if (showLoader) {
        setLoading(true)
      }

      try {
        setError('')

        const response = await apiFetch(
          `/audio/${audioId}/evaluation`
        )

        const data = await response
          .json()
          .catch(() => null)

        if (!response.ok) {
          throw new Error(
            typeof data?.detail === 'string'
              ? data.detail
              : response.status === 404
                ? 'This recording has not been evaluated yet.'
                : 'Failed to load evaluation.'
          )
        }

        setEvaluation(data)

        const historyResponse = await apiFetch(
          '/audio/evaluations/history?limit=20'
        )

        if (historyResponse.ok) {
          const historyData =
            await historyResponse
              .json()
              .catch(() => [])

          setHistory(
            Array.isArray(historyData)
              ? historyData
              : []
          )
        } else {
          setHistory([])
        }

        return data as Evaluation
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load evaluation.'
        )
        return null
      } finally {
        if (showLoader) {
          setLoading(false)
        }
      }
    },
    [audioId]
  )

  useEffect(() => {
    if (!authChecking && audioId) {
      loadEvaluation()
    }
  }, [
    authChecking,
    audioId,
    loadEvaluation,
  ])

  useEffect(() => {
    if (
      !evaluation ||
      !(
        evaluation.status === 'pending' ||
        evaluation.status === 'processing'
      )
    ) {
      setPolling(false)
      return
    }

    setPolling(true)

    const timer = window.setInterval(
      async () => {
        const result =
          await loadEvaluation(false)

        if (
          result &&
          result.status !== 'pending' &&
          result.status !== 'processing'
        ) {
          window.clearInterval(timer)
          setPolling(false)
        }
      },
      3000
    )

    return () => {
      window.clearInterval(timer)
      setPolling(false)
    }
  }, [evaluation?.status, loadEvaluation])

  const scoreItems = useMemo(() => {
    if (
      !evaluation?.analysis?.salesperson_analysis
    ) {
      return []
    }

    return scoreOrder.map(([key, label]) => {
      const item =
        evaluation.analysis
          .salesperson_analysis[key]

      const score = item?.score ?? 0
      const maxScore = item?.max_score ?? 0

      return {
        key,
        label,
        score,
        maxScore,
        percentage:
          maxScore > 0
            ? Math.round(
                (score / maxScore) * 100
              )
            : 0,
        assessment:
          item?.assessment ?? 'Unknown',
        evidence:
          evidenceText(item?.evidence),
      }
    })
  }, [evaluation])

  const historyPoints = useMemo(() => {
    const points = [...history]

    if (
      evaluation &&
      !points.some(
        (item) =>
          item.audio_id === evaluation.audio_id
      )
    ) {
      points.push({
        id: evaluation.id,
        audio_id: evaluation.audio_id,
        client_name: evaluation.client_name,
        performance_score:
          evaluation.performance_score,
        summary: evaluation.summary,
        model_name: evaluation.model_name,
        analysis: evaluation.analysis,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }

    return points
  }, [history, evaluation])

  if (authChecking || loading) {
    return (
      <div className="flex min-h-screen bg-[#07111f] text-white">
        <Sidebar />

        <main className="min-w-0 flex-1 p-5 sm:p-7 lg:p-10">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 h-8 w-64 animate-pulse rounded bg-white/10" />

            <div className="grid gap-5 lg:grid-cols-3">
              <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
              <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
              <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
            </div>

            <div className="mt-6 h-96 animate-pulse rounded-2xl bg-white/5" />
          </div>
        </main>
      </div>
    )
  }

  if (error && !evaluation) {
    return (
      <div className="flex min-h-screen bg-[#07111f] text-white">
        <Sidebar />

        <main className="min-w-0 flex-1 p-5 sm:p-7 lg:p-10">
          <div className="mx-auto max-w-3xl pt-16">
            <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-8">
              <p className="text-sm uppercase tracking-[0.18em] text-rose-300">
                Evaluation
              </p>

              <h1 className="mt-2 text-2xl font-bold">
                Evaluation unavailable
              </h1>

              <p className="mt-3 text-sm leading-6 text-white/55">
                {error}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    router.push('/audio')
                  }
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium hover:bg-blue-500"
                >
                  Back to Recordings
                </button>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      '/audio/evaluation'
                    )
                  }
                  className="rounded-lg border border-white/10 px-4 py-2.5 text-sm hover:bg-white/5"
                >
                  Open Evaluation
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!evaluation) {
    return null
  }

  const score =
    evaluation.performance_score ?? 0

  const analysis = evaluation.analysis

  const customer =
    analysis.customer_analysis

  const isProcessing =
    evaluation.status === 'pending' ||
    evaluation.status === 'processing'

  const isFailed =
    evaluation.status === 'failed'

  const isNonSales =
    analysis.lead_stage === 'UNKNOWN' &&
    score === 0 &&
    analysis.salesperson_analysis?.opening?.score ===
      0

  const currentHistoryIndex =
    historyPoints.findIndex(
      (item) =>
        item.audio_id === evaluation.audio_id
    )

  const previousPoint =
    currentHistoryIndex > 0
      ? historyPoints[currentHistoryIndex - 1]
      : null

  const previousScore =
    previousPoint?.performance_score ?? null

  const improvement =
    previousScore !== null
      ? score - previousScore
      : null

  return (
    <div className="flex min-h-screen bg-[#07111f] text-white">
      <Sidebar />

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1500px] px-5 py-7 md:px-8 lg:px-10">
          <div className="mb-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                router.push('/audio')
              }
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white"
            >
              ← Recordings
            </button>

            <button
              type="button"
              onClick={() =>
                router.push(
                  '/audio/evaluation'
                )
              }
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white"
            >
              Evaluation Center
            </button>
          </div>

          <header className="mb-8 flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-blue-300">
                <span className="h-2 w-2 rounded-full bg-blue-400" />
                AI Call Evaluation
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
                Sales Performance
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/45">
                Evidence-based analysis of the sales
                conversation.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-[10px] uppercase tracking-widest text-white/30">
                  Client
                </p>

                <p className="mt-1 font-semibold">
                  {evaluation.client_name ||
                    'Unknown'}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-[10px] uppercase tracking-widest text-white/30">
                  Lead Stage
                </p>

                <p className="mt-1 font-semibold">
                  {pretty(
                    analysis.lead_stage
                  )}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-[10px] uppercase tracking-widest text-white/30">
                  AI Model
                </p>

                <p className="mt-1 font-semibold">
                  {evaluation.model_name ||
                    'Pending'}
                </p>
              </div>
            </div>
          </header>

          {isProcessing && (
            <section className="mb-7 rounded-2xl border border-blue-400/20 bg-blue-400/[0.06] p-6">
              <div className="flex items-start gap-4">
                <div className="mt-1 h-5 w-5 animate-spin rounded-full border-2 border-blue-300 border-t-transparent" />

                <div>
                  <h2 className="font-semibold">
                    AI evaluation in progress
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-white/50">
                    The evaluation is being generated.
                    This page will update automatically.
                  </p>

                  {polling && (
                    <p className="mt-2 text-xs text-blue-300/70">
                      Checking for the completed result…
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          {isFailed && (
            <section className="mb-7 rounded-2xl border border-rose-400/20 bg-rose-500/[0.06] p-6">
              <h2 className="font-semibold text-rose-200">
                Evaluation failed
              </h2>

              <p className="mt-2 text-sm leading-6 text-white/50">
                {evaluation.error_message ||
                  'The AI evaluation could not be completed.'}
              </p>

              <button
                type="button"
                onClick={() =>
                  router.push('/audio')
                }
                className="mt-4 rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
              >
                Back to Recordings
              </button>
            </section>
          )}

          {!isProcessing && !isFailed && (
            <>
              <section className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                  <p className="text-[11px] uppercase tracking-widest text-white/30">
                    Performance Score
                  </p>

                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-4xl font-bold">
                      {score}
                    </span>

                    <span className="pb-1 text-sm text-white/30">
                      /100
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-white/45">
                    {scoreLabel(score)}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                  <p className="text-[11px] uppercase tracking-widest text-white/30">
                    Buying Intent
                  </p>

                  <p className="mt-3 text-xl font-semibold">
                    {pretty(
                      customer.buying_intent
                    )}
                  </p>

                  <p className="mt-2 text-xs text-white/35">
                    Based only on available evidence.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                  <p className="text-[11px] uppercase tracking-widest text-white/30">
                    Improvement
                  </p>

                  <p className="mt-3 text-xl font-semibold">
                    {improvement === null
                      ? 'Baseline'
                      : improvement > 0
                        ? `+${improvement}`
                        : improvement}
                  </p>

                  <p className="mt-2 text-xs text-white/35">
                    Compared with the previous completed evaluation.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                  <p className="text-[11px] uppercase tracking-widest text-white/30">
                    Conversation
                  </p>

                  <p className="mt-3 text-xl font-semibold">
                    {evaluation.is_new_conversation
                      ? 'New'
                      : 'Existing'}
                  </p>

                  <p className="mt-2 text-xs text-white/35">
                    Conversation classification.
                  </p>
                </div>
              </section>

              {isNonSales && (
                <section className="mb-7 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-6">
                  <h2 className="font-semibold text-amber-200">
                    No reliable sales evidence
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-white/50">
                    This conversation does not contain
                    enough evidence to support a meaningful
                    sales-performance evaluation. The score
                    remains at zero rather than inventing
                    sales behavior.
                  </p>
                </section>
              )}

              <section className="mb-7 rounded-2xl border border-white/10 bg-white/[0.035] p-6">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">
                      Performance Breakdown
                    </h2>

                    <p className="mt-1 text-xs text-white/35">
                      Sixteen weighted sales-performance
                      categories evaluated from evidence.
                    </p>
                  </div>

                  <div className="text-sm text-white/40">
                    Overall{' '}
                    <span className="font-semibold text-white">
                      {score}/100
                    </span>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {scoreItems.map((item) => (
                    <div
                      key={item.key}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="text-sm font-medium">
                            {item.label}
                          </h3>

                          <p className="mt-1 text-xs text-white/30">
                            {item.assessment}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="text-lg font-semibold">
                            {item.score}
                          </span>

                          <span className="text-xs text-white/30">
                            /{item.maxScore}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full ${scoreBarClass(
                            item.percentage
                          )}`}
                          style={{
                            width: `${Math.min(
                              100,
                              item.percentage
                            )}%`,
                          }}
                        />
                      </div>

                      {item.evidence.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {item.evidence
                            .slice(0, 2)
                            .map(
                              (
                                evidence,
                                index
                              ) => (
                                <p
                                  key={index}
                                  className="text-xs leading-5 text-white/35"
                                >
                                  “{evidence}”
                                </p>
                              )
                            )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section className="mb-7 grid gap-7 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
                  <h2 className="text-xl font-semibold">
                    Customer Analysis
                  </h2>

                  <div className="mt-5 space-y-5">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-white/30">
                        Problems
                      </p>

                      <div className="mt-2 space-y-1">
                        {customer.problems
                          ?.length ? (
                          customer.problems.map(
                            (item, index) => (
                              <p
                                key={index}
                                className="text-sm text-white/60"
                              >
                                • {item}
                              </p>
                            )
                          )
                        ) : (
                          <p className="text-sm text-white/35">
                            Unknown
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-widest text-white/30">
                        Goals
                      </p>

                      <div className="mt-2 space-y-1">
                        {customer.goals
                          ?.length ? (
                          customer.goals.map(
                            (item, index) => (
                              <p
                                key={index}
                                className="text-sm text-white/60"
                              >
                                • {item}
                              </p>
                            )
                          )
                        ) : (
                          <p className="text-sm text-white/35">
                            Unknown
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-white/30">
                          Budget
                        </p>

                        <p className="mt-2 text-sm text-white/60">
                          {customer.budget ||
                            'Unknown'}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-widest text-white/30">
                          Timeline
                        </p>

                        <p className="mt-2 text-sm text-white/60">
                          {customer.timeline ||
                            'Unknown'}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-widest text-white/30">
                          Decision Maker
                        </p>

                        <p className="mt-2 text-sm text-white/60">
                          {customer.decision_maker ||
                            'Unknown'}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-widest text-white/30">
                          Engagement
                        </p>

                        <p className="mt-2 text-sm text-white/60">
                          {customer.engagement ||
                            'Unknown'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
                  <h2 className="text-xl font-semibold">
                    Evaluation Summary
                  </h2>

                  <p className="mt-4 text-sm leading-7 text-white/55">
                    {analysis.summary ||
                      evaluation.summary ||
                      'No summary available.'}
                  </p>

                  {analysis.manager_insight && (
                    <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <p className="text-xs uppercase tracking-widest text-white/30">
                        Manager Insight
                      </p>

                      <p className="mt-2 text-sm leading-6 text-white/55">
                        {analysis.manager_insight}
                      </p>
                    </div>
                  )}

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-white/30">
                        Buying Intent
                      </p>

                      <p className="mt-2 text-sm text-white/60">
                        {pretty(
                          customer.buying_intent
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-widest text-white/30">
                        Confidence
                      </p>

                      <p className="mt-2 text-sm text-white/60">
                        {pretty(
                          analysis.confidence
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="mb-7 rounded-2xl border border-white/10 bg-white/[0.035] p-6">
                <h2 className="text-xl font-semibold">
                  Recommendations
                </h2>

                {analysis.new_recommendations
                  ?.length ? (
                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    {analysis.new_recommendations.map(
                      (recommendation, index) => (
                        <div
                          key={index}
                          className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <h3 className="font-medium">
                              {recommendation.action}
                            </h3>

                            <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-blue-300">
                              {pretty(
                                recommendation.priority
                              )}
                            </span>
                          </div>

                          <p className="mt-4 text-xs uppercase tracking-widest text-white/30">
                            Problem
                          </p>

                          <p className="mt-1 text-sm leading-6 text-white/55">
                            {recommendation.problem}
                          </p>

                          <p className="mt-4 text-xs uppercase tracking-widest text-white/30">
                            Success Criteria
                          </p>

                          <p className="mt-1 text-sm leading-6 text-white/55">
                            {recommendation.success_criteria}
                          </p>

                          <p className="mt-4 text-xs uppercase tracking-widest text-white/30">
                            When to Apply
                          </p>

                          <p className="mt-1 text-sm leading-6 text-white/55">
                            {recommendation.when_to_apply}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-white/35">
                    No new recommendations were generated.
                  </p>
                )}
              </section>

              <section className="mb-7 grid gap-7 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
                  <h2 className="text-xl font-semibold">
                    Next Call Plan
                  </h2>

                  <div className="mt-5 space-y-3">
                    {analysis.next_call_plan?.length ? (
                      analysis.next_call_plan
                        .slice(0, 5)
                        .map(
                          (item, index) => (
                            <div
                              key={index}
                              className="flex gap-3"
                            >
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-xs font-semibold text-blue-300">
                                {index + 1}
                              </span>

                              <p className="pt-1 text-sm leading-6 text-white/55">
                                {item}
                              </p>
                            </div>
                          )
                        )
                    ) : (
                      <p className="text-sm text-white/35">
                        No next-call plan available.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
                  <h2 className="text-xl font-semibold">
                    Conversion Strategy
                  </h2>

                  <p className="mt-4 text-sm text-white/35">
                    Recommended action
                  </p>

                  <p className="mt-1 text-lg font-semibold">
                    {pretty(
                      analysis.conversion_strategy
                        ?.recommended_action
                    )}
                  </p>

                  <p className="mt-4 text-sm leading-6 text-white/55">
                    {analysis.conversion_strategy
                      ?.reason ||
                      'No conversion strategy available.'}
                  </p>
                </div>
              </section>

              <section className="mb-7 rounded-2xl border border-white/10 bg-white/[0.035] p-6">
                <h2 className="text-xl font-semibold">
                  Conversion Risks
                </h2>

                {analysis.conversion_risks?.length ? (
                  <div className="mt-5 space-y-4">
                    {analysis.conversion_risks.map(
                      (risk, index) => (
                        <div
                          key={index}
                          className="rounded-xl border border-rose-400/10 bg-rose-500/[0.04] p-5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <h3 className="font-medium">
                              {risk.risk}
                            </h3>

                            <span className="rounded-full border border-rose-400/20 px-2.5 py-1 text-[10px] uppercase tracking-wider text-rose-300">
                              {pretty(
                                risk.severity
                              )}
                            </span>
                          </div>

                          <p className="mt-3 text-sm leading-6 text-white/50">
                            {risk.recommended_action}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-white/35">
                    No conversion risks identified.
                  </p>
                )}
              </section>

              <section className="mb-7 rounded-2xl border border-white/10 bg-white/[0.035] p-6">
                <h2 className="text-xl font-semibold">
                  Performance Improvement
                </h2>

                {historyPoints.length <= 1 ? (
                  <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                    <p className="text-sm text-white/45">
                      This evaluation is the baseline.
                    </p>

                    <p className="mt-2 text-xs text-white/25">
                      Future completed evaluations can
                      be compared against this score.
                    </p>
                  </div>
                ) : (
                  <div className="mt-6">
                    <div className="overflow-x-auto">
                      <svg
                        viewBox="0 0 760 260"
                        className="min-w-[700px] w-full"
                        role="img"
                        aria-label="Sales performance trend"
                      >
                        {[0, 25, 50, 75, 100].map(
                          (value) => {
                            const y =
                              28 +
                              ((100 - value) /
                                100) *
                                204

                            return (
                              <g
                                key={value}
                              >
                                <line
                                  x1="42"
                                  x2="718"
                                  y1={y}
                                  y2={y}
                                  stroke="currentColor"
                                  className="text-white/[0.06]"
                                />

                                <text
                                  x="5"
                                  y={y + 4}
                                  fontSize="11"
                                  fill="currentColor"
                                  className="text-white/25"
                                >
                                  {value}
                                </text>
                              </g>
                            )
                          }
                        )}

                        <polyline
                          points={historyPoints
                            .map(
                              (
                                point,
                                index
                              ) => {
                                const x =
                                  historyPoints.length ===
                                  1
                                    ? 380
                                    : 42 +
                                      (index /
                                        (historyPoints.length -
                                          1)) *
                                        676

                                const score =
                                  point.performance_score ??
                                  0

                                const y =
                                  28 +
                                  ((100 -
                                    score) /
                                    100) *
                                    204

                                return `${x},${y}`
                              }
                            )
                            .join(' ')}
                          fill="none"
                          stroke="currentColor"
                          className="text-blue-400"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {historyPoints.map(
                          (
                            point,
                            index
                          ) => {
                            const x =
                              historyPoints.length ===
                              1
                                ? 380
                                : 42 +
                                  (index /
                                    (historyPoints.length -
                                      1)) *
                                    676

                            const score =
                              point.performance_score ??
                              0

                            const y =
                              28 +
                              ((100 -
                                score) /
                                100) *
                                204

                            const current =
                              point.audio_id ===
                              evaluation.audio_id

                            return (
                              <g
                                key={
                                  point.id
                                }
                              >
                                <circle
                                  cx={x}
                                  cy={y}
                                  r={
                                    current
                                      ? 7
                                      : 5
                                  }
                                  fill="currentColor"
                                  className={
                                    current
                                      ? 'text-cyan-300'
                                      : 'text-blue-400'
                                  }
                                />

                                <text
                                  x={x}
                                  y="250"
                                  textAnchor="middle"
                                  fontSize="10"
                                  fill="currentColor"
                                  className="text-white/25"
                                >
                                  {index ===
                                  historyPoints.length -
                                    1
                                    ? 'Current'
                                    : `Call ${index + 1}`}
                                </text>
                              </g>
                            )
                          }
                        )}
                      </svg>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      {historyPoints.map(
                        (point, index) => (
                          <div
                            key={point.id}
                            className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                          >
                            <p className="text-[10px] text-white/25">
                              {point.audio_id ===
                              evaluation.audio_id
                                ? 'Current'
                                : `Call ${index + 1}`}
                            </p>

                            <p className="mt-1 text-sm font-semibold">
                              {point.performance_score ??
                                0}
                              <span className="text-xs text-white/25">
                                /100
                              </span>
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </section>

              <section className="mb-7 rounded-2xl border border-white/10 bg-white/[0.035] p-6">
                <h2 className="text-xl font-semibold">
                  Sales Process Compliance
                </h2>

                <div className="mt-4">
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/60">
                    {pretty(
                      analysis
                        .sales_process_compliance
                        ?.status
                    )}
                  </span>
                </div>

                {analysis
                  .sales_process_compliance
                  ?.violations?.length > 0 && (
                  <div className="mt-5 space-y-2">
                    {analysis.sales_process_compliance.violations.map(
                      (violation, index) => (
                        <p
                          key={index}
                          className="text-sm text-white/55"
                        >
                          • {violation}
                        </p>
                      )
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  )
}