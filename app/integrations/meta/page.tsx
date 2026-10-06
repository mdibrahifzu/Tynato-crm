"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import Sidebar from "@/app/components/Sidebar"
import { apiFetch } from "@/app/lib/api"

type Connection = {
  id: string
  meta_user_id?: string | null
  granted_scopes?: string[] | null
  status: string
  api_version: string
  token_expires_at?: string | null
  last_validated_at?: string | null
  last_successful_sync_at?: string | null
  connected_at?: string | null
}

type MetaPage = {
  id: string
  meta_page_id: string
  page_name: string
  page_category: string | null
  status: string
  last_seen_at: string | null
  updated_at: string | null
}

type MetaForm = {
  id: string
  meta_form_id: string
  meta_page_id: string
  name: string | null
  status: string | null
  is_selected: boolean
  questions: unknown[] | null
  last_seen_at: string | null
  updated_at: string | null
}

type AdAccount = {
  id: string
  meta_ad_account_id: string
  name: string
  account_status: number | null
  currency: string | null
  timezone_name: string | null
  is_selected: boolean
  status: string
  last_seen_at: string | null
}

function formatDate(value?: string | null) {
  if (!value) return "Never"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ")
}

function statusTone(status: string) {
  const normalized = status.toLowerCase()
  if (normalized === "active") return { bg: "rgba(34,197,94,0.10)", border: "rgba(34,197,94,0.20)", text: "#4ade80" }
  if (normalized.includes("expir") || normalized.includes("insufficient")) return { bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.20)", text: "#fbbf24" }
  if (normalized === "disconnected" || normalized === "revoked") return { bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.20)", text: "#f87171" }
  return { bg: "var(--bg-surface)", border: "var(--border-soft)", text: "var(--text-muted)" }
}

function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: "primary" | "secondary" | "danger"
}) {
  const styles = variant === "primary"
    ? { background: "#2563eb", color: "#fff", borderColor: "transparent" }
    : variant === "danger"
      ? { background: "rgba(239,68,68,0.08)", color: "#fca5a5", borderColor: "rgba(239,68,68,0.20)" }
      : { background: "var(--bg-card)", color: "var(--text-primary)", borderColor: "var(--border-soft)" }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      style={styles}
    >
      {children}
    </button>
  )
}

export default function MetaIntegrationPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [pages, setPages] = useState<MetaPage[]>([])
  const [accounts, setAccounts] = useState<AdAccount[]>([])
  const [forms, setForms] = useState<Record<string, MetaForm[]>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const connection = useMemo(
    () => connections.find((item) => item.status === "active") ?? connections[0] ?? null,
    [connections],
  )

  const active = connection?.status === "active"

  async function readJson(response: Response) {
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(body?.detail || "Request failed")
    }
    return body
  }

  async function loadAll() {
    setError("")
    try {
      setLoading(true)
      const responses = await Promise.all([
        apiFetch("/meta/connections"),
        apiFetch("/meta/pages"),
        apiFetch("/meta/ad-accounts"),
      ])
      const [connectionData, pageData, accountData] = await Promise.all(
        responses.map((response) => response.json().catch(() => [])),
      )

      if (!responses[0].ok) throw new Error(connectionData?.detail || "Unable to load Meta connection")
      if (!responses[1].ok) throw new Error(pageData?.detail || "Unable to load Meta Pages")
      if (!responses[2].ok) throw new Error(accountData?.detail || "Unable to load Meta ad accounts")

      setConnections(Array.isArray(connectionData) ? connectionData : [])
      setPages(Array.isArray(pageData) ? pageData : [])
      setAccounts(Array.isArray(accountData) ? accountData : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Meta integration")
    } finally {
      setLoading(false)
    }
  }

  async function connectMeta() {
    try {
      setBusy("connect")
      setError("")
      const body = await readJson(await apiFetch("/meta/oauth/start", { method: "POST" }))
      if (!body?.auth_url) throw new Error("Meta authorization URL was not returned")
      window.location.assign(body.auth_url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start Meta authorization")
      setBusy("")
    }
  }

  async function discover() {
    if (!connection) return
    try {
      setBusy("discover")
      setMessage("")
      setError("")
      const body = await readJson(await apiFetch(`/meta/connections/${connection.id}/discover`, { method: "POST" }))
      const summary = body?.summary || {}
      setMessage(`Discovery complete: ${summary.businesses || 0} businesses, ${summary.pages || 0} Pages, ${summary.ad_accounts || 0} ad accounts.`)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to discover Meta assets")
    } finally {
      setBusy("")
    }
  }

  async function loadForms(page: MetaPage) {
    if (forms[page.meta_page_id]) {
      setForms((current) => {
        const next = { ...current }
        delete next[page.meta_page_id]
        return next
      })
      return
    }

    try {
      setBusy(`forms:${page.meta_page_id}`)
      const body = await readJson(await apiFetch(`/meta/pages/${encodeURIComponent(page.meta_page_id)}/forms`))
      setForms((current) => ({ ...current, [page.meta_page_id]: Array.isArray(body) ? body : [] }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Page forms")
    } finally {
      setBusy("")
    }
  }

  async function syncForms(page: MetaPage) {
    if (!connection) return
    try {
      setBusy(`sync-forms:${page.meta_page_id}`)
      setMessage("")
      const body = await readJson(
        await apiFetch(`/meta/connections/${connection.id}/pages/${encodeURIComponent(page.meta_page_id)}/forms/sync`, { method: "POST" }),
      )
      setMessage(`Form sync queued (${body?.status || "pending"}).`)
      await loadForms(page)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to queue form sync")
    } finally {
      setBusy("")
    }
  }

  async function disconnect() {
    if (!connection) return
    if (!window.confirm("Disconnect Meta from this workspace? Existing CRM history will remain, but Meta credentials and active asset links will be removed.")) return

    try {
      setBusy("disconnect")
      setMessage("")
      setError("")
      await readJson(await apiFetch(`/meta/connections/${connection.id}`, { method: "DELETE" }))
      setMessage("Meta disconnected. CRM history remains available.")
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to disconnect Meta")
    } finally {
      setBusy("")
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  const tone = statusTone(connection?.status || "disconnected")

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-main)" }}>
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-x-hidden">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex items-center gap-2 text-sm">
                <Link href="/settings" style={{ color: "var(--text-muted)" }}>Settings</Link>
                <span style={{ color: "var(--text-soft)" }}>/</span>
                <Link href="/settings/integrations" style={{ color: "var(--text-muted)" }}>Integrations</Link>
                <span style={{ color: "var(--text-soft)" }}>/</span>
                <span style={{ color: "var(--accent)" }}>Meta</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Meta Integration</h1>
                <span className="rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize" style={{ background: tone.bg, borderColor: tone.border, color: tone.text }}>
                  {formatStatus(connection?.status || "not connected")}
                </span>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                Connect Meta to bring authorized Pages, lead forms, ad accounts, campaigns, insights, and incoming leads into this Tynato workspace. Meta-side editing and publishing are intentionally unavailable.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href="/meta-ads" className="inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:bg-white/5" style={{ borderColor: "var(--border-soft)", color: "var(--text-primary)", background: "var(--bg-card)" }}>
                Open Meta Ads
              </Link>
              {active ? (
                <Button onClick={discover} disabled={busy === "discover"}>
                  {busy === "discover" ? "Discovering…" : "Refresh assets"}
                </Button>
              ) : (
                <Button onClick={connectMeta} disabled={busy === "connect"}>
                  {busy === "connect" ? "Connecting…" : connection ? "Reconnect Meta" : "Connect Meta"}
                </Button>
              )}
            </div>
          </div>

          {(message || error) && (
            <div className="mb-6 rounded-xl border px-4 py-3 text-sm leading-6" style={{ borderColor: error ? "rgba(239,68,68,0.20)" : "rgba(34,197,94,0.20)", background: error ? "rgba(239,68,68,0.07)" : "rgba(34,197,94,0.07)", color: error ? "#fca5a5" : "#86efac" }}>
              {error || message}
            </div>
          )}

          {loading ? (
            <div className="crm-card p-8 text-sm" style={{ color: "var(--text-muted)" }}>Loading Meta workspace…</div>
          ) : !connection ? (
            <section className="crm-card overflow-hidden">
              <div className="grid lg:grid-cols-[1.3fr_0.7fr]">
                <div className="p-6 sm:p-8 lg:p-10">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>Marketing integration</p>
                  <h2 className="mt-3 text-2xl font-bold sm:text-3xl">Connect your Meta workspace once</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                    Tynato stores the Meta authorization on the backend, binds it to this workspace, and keeps CRM data in PostgreSQL. The browser never receives Meta access tokens.
                  </p>
                  <div className="mt-7">
                    <Button onClick={connectMeta} disabled={busy === "connect"}>
                      {busy === "connect" ? "Connecting…" : "Connect Meta"}
                    </Button>
                  </div>
                </div>
                <div className="border-t p-6 lg:border-l lg:border-t-0" style={{ borderColor: "var(--border-soft)", background: "var(--bg-surface)" }}>
                  <p className="text-sm font-semibold">After connection</p>
                  <div className="mt-4 space-y-3 text-sm" style={{ color: "var(--text-muted)" }}>
                    <div>01 · Discover Pages and ad accounts</div>
                    <div>02 · Sync lead forms and performance data</div>
                    <div>03 · Import new Meta leads automatically</div>
                    <div>04 · Continue the normal CRM sales workflow</div>
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <div className="space-y-6">
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Pages", pages.length.toString()],
                  ["Ad accounts", accounts.length.toString()],
                  ["Last successful sync", formatDate(connection.last_successful_sync_at)],
                  ["API version", connection.api_version || "—"],
                ].map(([label, value]) => (
                  <div key={label} className="crm-card p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--text-soft)" }}>{label}</p>
                    <p className="mt-3 break-words text-lg font-semibold">{value}</p>
                  </div>
                ))}
              </section>

              <section className="crm-card overflow-hidden">
                <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6" style={{ borderColor: "var(--border-soft)" }}>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--accent)" }}>Connection</p>
                    <h2 className="mt-2 text-xl font-semibold">Workspace Meta connection</h2>
                    <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>Connection status and sync health only. No raw tokens are displayed.</p>
                  </div>
                  <Button variant="danger" onClick={disconnect} disabled={busy === "disconnect"}>
                    {busy === "disconnect" ? "Disconnecting…" : "Disconnect Meta"}
                  </Button>
                </div>
                <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4 sm:p-6">
                  <div className="crm-surface p-4"><p className="text-xs" style={{ color: "var(--text-soft)" }}>Status</p><p className="mt-1 text-sm font-semibold capitalize">{formatStatus(connection.status)}</p></div>
                  <div className="crm-surface p-4"><p className="text-xs" style={{ color: "var(--text-soft)" }}>Connected</p><p className="mt-1 text-sm font-semibold">{formatDate(connection.connected_at)}</p></div>
                  <div className="crm-surface p-4"><p className="text-xs" style={{ color: "var(--text-soft)" }}>Validated</p><p className="mt-1 text-sm font-semibold">{formatDate(connection.last_validated_at)}</p></div>
                  <div className="crm-surface p-4"><p className="text-xs" style={{ color: "var(--text-soft)" }}>Token expiry</p><p className="mt-1 text-sm font-semibold">{formatDate(connection.token_expires_at)}</p></div>
                </div>
              </section>

              <section className="crm-card overflow-hidden">
                <div className="border-b p-5 sm:p-6" style={{ borderColor: "var(--border-soft)" }}>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--accent)" }}>Meta Pages</p>
                  <h2 className="mt-2 text-xl font-semibold">Lead sources</h2>
                  <p className="mt-1 text-sm leading-6" style={{ color: "var(--text-muted)" }}>Inspect lead forms attached to discovered Pages. Forms are synchronized by the backend job queue.</p>
                </div>
                {pages.length === 0 ? (
                  <div className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>No Pages discovered yet. Use “Refresh assets” after Meta authorization.</div>
                ) : (
                  <div className="divide-y" style={{ borderColor: "var(--border-soft)" }}>
                    {pages.map((page) => {
                      const pageForms = forms[page.meta_page_id]
                      const pageBusy = busy === `forms:${page.meta_page_id}` || busy === `sync-forms:${page.meta_page_id}`
                      return (
                        <div key={page.id} className="p-5 sm:p-6">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0">
                              <p className="break-words text-base font-semibold">{page.page_name}</p>
                              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                                {page.page_category || "Meta Page"} · {page.meta_page_id} · Seen {formatDate(page.last_seen_at)}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button variant="secondary" onClick={() => void loadForms(page)} disabled={pageBusy}>{pageForms ? "Hide forms" : "View forms"}</Button>
                              <Button variant="secondary" onClick={() => void syncForms(page)} disabled={!active || pageBusy}>{busy === `sync-forms:${page.meta_page_id}` ? "Queueing…" : "Sync forms"}</Button>
                            </div>
                          </div>
                          {pageForms && (
                            <div className="mt-4 overflow-hidden rounded-xl border" style={{ background: "var(--bg-surface)", borderColor: "var(--border-soft)" }}>
                              {pageForms.length === 0 ? (
                                <div className="p-4 text-sm" style={{ color: "var(--text-muted)" }}>No lead forms are currently mirrored.</div>
                              ) : (
                                <div className="divide-y" style={{ borderColor: "var(--border-soft)" }}>
                                  {pageForms.map((form) => (
                                    <div key={form.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                                      <div>
                                        <p className="text-sm font-semibold">{form.name || "Unnamed form"}</p>
                                        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{form.meta_form_id} · {form.status || "unknown"}</p>
                                      </div>
                                      <span className="rounded-full border px-2.5 py-1 text-[11px] font-semibold" style={{ borderColor: form.is_selected ? "rgba(34,197,94,0.20)" : "var(--border-soft)", background: form.is_selected ? "rgba(34,197,94,0.08)" : "transparent", color: form.is_selected ? "#4ade80" : "var(--text-muted)" }}>
                                        {form.is_selected ? "Selected" : "Available"}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              <section className="crm-card overflow-hidden">
                <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6" style={{ borderColor: "var(--border-soft)" }}>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--accent)" }}>Ad accounts</p>
                    <h2 className="mt-2 text-xl font-semibold">Authorized Meta advertising accounts</h2>
                  </div>
                  <Link href="/meta-ads" className="text-sm font-semibold" style={{ color: "var(--accent)" }}>View performance →</Link>
                </div>
                {accounts.length === 0 ? (
                  <div className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>No ad accounts discovered.</div>
                ) : (
                  <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
                    {accounts.map((account) => (
                      <div key={account.id} className="crm-surface p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold">{account.name}</p>
                            <p className="mt-1 break-all text-xs" style={{ color: "var(--text-muted)" }}>act_{account.meta_ad_account_id}</p>
                          </div>
                          <span className="rounded-full px-2 py-1 text-[10px] font-semibold" style={{ background: "rgba(59,130,246,0.10)", color: "#93c5fd" }}>{account.currency || "—"}</span>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                          <div><span style={{ color: "var(--text-soft)" }}>Timezone</span><br />{account.timezone_name || "—"}</div>
                          <div><span style={{ color: "var(--text-soft)" }}>Seen</span><br />{formatDate(account.last_seen_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border p-5 sm:p-6" style={{ background: "var(--accent-soft)", borderColor: "rgba(59,130,246,0.18)" }}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(59,130,246,0.12)", color: "var(--accent)" }}>i</div>
                  <div>
                    <h3 className="text-sm font-semibold">Read-only Meta integration</h3>
                    <p className="mt-1 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                      Tynato can read and synchronize Meta assets, advertising performance, and incoming lead attribution. It does not expose controls to pause campaigns, change budgets or targeting, publish ads, or delete Meta assets.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
