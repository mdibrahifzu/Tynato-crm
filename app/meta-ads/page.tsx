"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import Sidebar from "@/app/components/Sidebar"
import { apiFetch } from "@/app/lib/api"

type Connection = { id: string; status: string }
type Account = { id: string; meta_ad_account_id: string; name: string; currency: string | null; timezone_name: string | null; status: string }
type Campaign = { id: string; ad_account_row_id: string; ad_account_name: string; meta_campaign_id: string; name: string; status: string; objective: string | null; daily_budget: string | number | null; lifetime_budget: string | number | null; last_seen_at: string | null }
type Insight = { date_start: string; date_stop: string; level: string; spend: number | string | null; impressions: number | string | null; reach: number | string | null; frequency: number | string | null; clicks: number | string | null; ctr: number | string | null; cpc: number | string | null; cpm: number | string | null; lead_count: number | string | null; campaign_id: string | null; campaign_name: string | null }
type MetaLead = { id: string; full_name: string | null; phone_number: string | null; email: string | null; project_location: string | null; status: string; owner_id: string; leadgen_id: string; meta_page_id: string | null; meta_form_id: string | null; meta_campaign_id: string | null; meta_adset_id: string | null; meta_ad_id: string | null; campaign_name_snapshot: string | null; form_name_snapshot: string | null; meta_created_at: string | null; imported_at: string }

function num(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
function money(value: unknown, currency = "") {
  return `${currency ? `${currency} ` : ""}${num(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function integer(value: unknown) { return Math.round(num(value)).toLocaleString() }
function percent(value: unknown) { return `${num(value).toFixed(2)}%` }
function dateString(daysAgo: number) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}
function formatDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

async function parseJson(response: Response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body?.detail || "Request failed")
  return body
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="crm-card p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-soft)" }}>{label}</p>
      <p className="mt-3 text-2xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{hint}</p>}
    </div>
  )
}

export default function MetaAdsPage() {
  const [connection, setConnection] = useState<Connection | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [insights, setInsights] = useState<Insight[]>([])
  const [metaLeads, setMetaLeads] = useState<MetaLead[]>([])
  const [accountId, setAccountId] = useState("all")
  const [since, setSince] = useState(dateString(29))
  const [until, setUntil] = useState(dateString(0))
  const [level, setLevel] = useState("account")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [campaignSyncing, setCampaignSyncing] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const selectedAccount = accounts.find((item) => item.id === accountId) || null
  const currency = selectedAccount?.currency || ""

  const totals = useMemo(() => {
    const spend = insights.reduce((sum, row) => sum + num(row.spend), 0)
    const impressions = insights.reduce((sum, row) => sum + num(row.impressions), 0)
    const clicks = insights.reduce((sum, row) => sum + num(row.clicks), 0)
    const leads = insights.reduce((sum, row) => sum + num(row.lead_count), 0)
    const reach = insights.length ? Math.max(...insights.map((row) => num(row.reach))) : 0
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
    const cpc = clicks > 0 ? spend / clicks : 0
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0
    const cpl = leads > 0 ? spend / leads : 0
    return { spend, impressions, clicks, leads, reach, ctr, cpc, cpm, cpl }
  }, [insights])

  const visibleCampaigns = useMemo(
    () => accountId === "all" ? campaigns : campaigns.filter((item) => item.ad_account_row_id === accountId),
    [accountId, campaigns],
  )

  async function loadBase() {
    const [connectionsResponse, accountsResponse, campaignsResponse] = await Promise.all([
      apiFetch("/meta/connections"),
      apiFetch("/meta/ad-accounts"),
      apiFetch("/meta/campaigns"),
    ])
    const connectionData = await connectionsResponse.json().catch(() => [])
    const accountData = await accountsResponse.json().catch(() => [])
    const campaignData = await campaignsResponse.json().catch(() => [])
    if (!connectionsResponse.ok) throw new Error(connectionData?.detail || "Unable to load Meta connection")
    if (!accountsResponse.ok) throw new Error(accountData?.detail || "Unable to load Meta ad accounts")
    if (!campaignsResponse.ok) throw new Error(campaignData?.detail || "Unable to load Meta campaigns")
    const active = Array.isArray(connectionData) ? connectionData.find((item: Connection) => item.status === "active") : null
    setConnection(active || null)
    setAccounts(Array.isArray(accountData) ? accountData : [])
    setCampaigns(Array.isArray(campaignData) ? campaignData : [])
    return active as Connection | null
  }

  async function loadMetrics(connectionArg = connection) {
    const params = new URLSearchParams({ since, until })
    if (accountId !== "all") params.set("ad_account_row_id", accountId)
    if (level) params.set("level", level)

    const [insightsResponse, leadsResponse] = await Promise.all([
      apiFetch(`/meta/insights?${params.toString()}`),
      apiFetch("/meta/leads"),
    ])
    const insightData = await insightsResponse.json().catch(() => [])
    const leadData = await leadsResponse.json().catch(() => [])
    if (!insightsResponse.ok) throw new Error(insightData?.detail || "Unable to load Meta insights")
    if (!leadsResponse.ok) throw new Error(leadData?.detail || "Unable to load Meta leads")
    setInsights(Array.isArray(insightData) ? insightData : [])
    setMetaLeads(Array.isArray(leadData) ? leadData : [])
    void connectionArg
  }

  async function loadAll() {
    try {
      setLoading(true)
      setError("")
      const active = await loadBase()
      if (active) await loadMetrics(active)
      else {
        setInsights([])
        setMetaLeads([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Meta Ads data")
    } finally {
      setLoading(false)
    }
  }

  async function refreshMetrics() {
    try {
      setRefreshing(true)
      setError("")
      if (connection?.status === "active") await loadMetrics(connection)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refresh Meta metrics")
    } finally {
      setRefreshing(false)
    }
  }

  async function pollJob(jobId: string) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      const body = await parseJson(await apiFetch(`/meta/jobs/${jobId}`))
      if (["completed", "dead", "failed"].includes(body?.status)) return body
    }
    return null
  }

  async function syncInsights() {
    if (!connection) return
    try {
      setSyncing(true)
      setMessage("")
      setError("")
      const query = new URLSearchParams({ since, until })
      if (accountId !== "all") query.set("ad_account_row_id", accountId)
      const body = await parseJson(await apiFetch(`/meta/connections/${connection.id}/insights/sync?${query.toString()}`, { method: "POST" }))
      const job = await pollJob(body.job_id)
      setMessage(job?.status === "completed" ? "Meta insights sync completed." : `Insights sync status: ${job?.status || body.status || "pending"}.`)
      await loadMetrics(connection)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sync Meta insights")
    } finally {
      setSyncing(false)
    }
  }

  async function syncCampaigns() {
    if (!connection) return
    try {
      setCampaignSyncing(true)
      setMessage("")
      setError("")
      const body = await parseJson(
        await apiFetch(`/meta/connections/${connection.id}/campaigns/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ad_account_row_id: accountId === "all" ? null : accountId }),
        }),
      )
      const job = await pollJob(body.job_id)
      setMessage(job?.status === "completed" ? "Campaign mirror sync completed." : `Campaign sync status: ${job?.status || body.status || "pending"}.`)
      await loadBase()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sync campaigns")
    } finally {
      setCampaignSyncing(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-main)" }}>
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-x-hidden">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm">
                <Link href="/settings/integrations" style={{ color: "var(--text-muted)" }}>Integrations</Link>
                <span style={{ color: "var(--text-soft)" }}>/</span>
                <span style={{ color: "var(--accent)" }}>Meta Ads</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Meta Ads</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                Read-only Meta performance mirrored into Tynato CRM. Campaign controls such as budgets, targeting, pause/resume, publishing, and deletion are not exposed.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/integrations/meta" className="inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold" style={{ borderColor: "var(--border-soft)", background: "var(--bg-card)", color: "var(--text-primary)" }}>Meta settings</Link>
              <button type="button" onClick={() => void refreshMetrics()} disabled={refreshing || !connection} className="inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-50" style={{ borderColor: "var(--border-soft)", background: "var(--bg-card)", color: "var(--text-primary)" }}>{refreshing ? "Refreshing…" : "Refresh"}</button>
            </div>
          </div>

          {(message || error) && <div className="mb-6 rounded-xl border px-4 py-3 text-sm leading-6" style={{ borderColor: error ? "rgba(239,68,68,0.20)" : "rgba(34,197,94,0.20)", background: error ? "rgba(239,68,68,0.07)" : "rgba(34,197,94,0.07)", color: error ? "#fca5a5" : "#86efac" }}>{error || message}</div>}

          {!loading && !connection ? (
            <section className="crm-card p-6 sm:p-8">
              <h2 className="text-xl font-semibold">Meta is not connected</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: "var(--text-muted)" }}>Connect Meta and discover at least one ad account before using performance analytics.</p>
              <Link href="/integrations/meta" className="mt-5 inline-flex rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">Connect Meta</Link>
            </section>
          ) : (
            <div className="space-y-6">
              <section className="crm-card p-4 sm:p-5">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <label className="text-sm">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-soft)" }}>Ad account</span>
                    <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full rounded-xl px-3 py-2.5 text-sm">
                      <option value="all">All discovered accounts</option>
                      {accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency || "—"}</option>)}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-soft)" }}>Level</span>
                    <select value={level} onChange={(e) => setLevel(e.target.value)} className="w-full rounded-xl px-3 py-2.5 text-sm">
                      <option value="account">Account</option>
                      <option value="campaign">Campaign</option>
                      <option value="adset">Ad Set</option>
                      <option value="ad">Ad</option>
                    </select>
                  </label>
                  <label className="text-sm"><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-soft)" }}>Since</span><input type="date" value={since} onChange={(e) => setSince(e.target.value)} className="w-full rounded-xl px-3 py-2.5 text-sm" /></label>
                  <label className="text-sm"><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-soft)" }}>Until</span><input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="w-full rounded-xl px-3 py-2.5 text-sm" /></label>
                  <div className="flex items-end gap-2">
                    <button type="button" onClick={() => void refreshMetrics()} disabled={refreshing || !connection} className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Load</button>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--border-soft)" }}>
                  <p className="text-xs leading-5" style={{ color: "var(--text-muted)" }}>Reporting reads the synchronized PostgreSQL mirror; sync first when you need fresh Meta data.</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void syncInsights()} disabled={syncing || !connection} className="rounded-xl border px-3 py-2 text-xs font-semibold" style={{ borderColor: "var(--border-soft)", background: "var(--bg-card)" }}>{syncing ? "Syncing insights…" : "Sync insights"}</button>
                    <button type="button" onClick={() => void syncCampaigns()} disabled={campaignSyncing || !connection} className="rounded-xl border px-3 py-2 text-xs font-semibold" style={{ borderColor: "var(--border-soft)", background: "var(--bg-card)" }}>{campaignSyncing ? "Syncing campaigns…" : "Sync campaigns"}</button>
                  </div>
                </div>
              </section>

              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Spend" value={money(totals.spend, currency)} />
                <Metric label="Impressions" value={integer(totals.impressions)} />
                <Metric label="Clicks" value={integer(totals.clicks)} />
                <Metric label="CTR" value={percent(totals.ctr)} hint="Computed from synchronized impressions and clicks" />
                <Metric label="CPC" value={money(totals.cpc, currency)} hint="Computed from spend / clicks" />
                <Metric label="CPM" value={money(totals.cpm, currency)} hint="Computed from spend / impressions × 1,000" />
                <Metric label="Leads" value={integer(totals.leads)} />
                <Metric label="CPL" value={money(totals.cpl, currency)} hint="Computed from spend / Meta-reported leads" />
              </section>

              <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
                <div className="crm-card overflow-hidden">
                  <div className="flex items-center justify-between border-b p-5" style={{ borderColor: "var(--border-soft)" }}>
                    <div><p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--accent)" }}>Performance</p><h2 className="mt-2 text-lg font-semibold">Synchronized insight rows</h2></div>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{insights.length} rows</span>
                  </div>
                  <div className="overflow-x-auto">
                    {insights.length === 0 ? <div className="p-8 text-sm" style={{ color: "var(--text-muted)" }}>No synchronized insight rows match the selected period.</div> : (
                      <table className="min-w-[760px] text-left">
                        <thead><tr style={{ background: "var(--bg-surface)" }}>
                          {['Date','Campaign','Spend','Impr.','Clicks','CTR','Leads'].map((label) => <th key={label} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-soft)" }}>{label}</th>)}
                        </tr></thead>
                        <tbody>
                          {insights.slice().reverse().slice(0, 100).map((row, index) => <tr key={`${row.date_start}-${row.campaign_id || row.level}-${index}`} className="border-t" style={{ borderColor: "var(--border-soft)" }}>
                            <td className="px-4 py-3 text-xs">{row.date_start}</td>
                            <td className="max-w-[230px] px-4 py-3 text-xs"><span className="block truncate font-medium">{row.campaign_name || row.level}</span>{row.campaign_id && <span className="block truncate" style={{ color: "var(--text-soft)" }}>{row.campaign_id}</span>}</td>
                            <td className="px-4 py-3 text-xs">{money(row.spend, currency)}</td>
                            <td className="px-4 py-3 text-xs">{integer(row.impressions)}</td>
                            <td className="px-4 py-3 text-xs">{integer(row.clicks)}</td>
                            <td className="px-4 py-3 text-xs">{percent(row.ctr)}</td>
                            <td className="px-4 py-3 text-xs">{integer(row.lead_count)}</td>
                          </tr>)}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                <div className="crm-card p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--accent)" }}>Reach & efficiency</p>
                  <h2 className="mt-2 text-lg font-semibold">Additional metrics</h2>
                  <div className="mt-5 space-y-3">
                    <div className="crm-surface flex items-center justify-between px-4 py-3"><span className="text-sm" style={{ color: "var(--text-muted)" }}>Peak daily reach</span><strong>{integer(totals.reach)}</strong></div>
                    <div className="crm-surface flex items-center justify-between px-4 py-3"><span className="text-sm" style={{ color: "var(--text-muted)" }}>Daily rows</span><strong>{insights.length}</strong></div>
                    <div className="rounded-xl border p-4 text-xs leading-5" style={{ borderColor: "rgba(59,130,246,0.18)", background: "var(--accent-soft)", color: "var(--text-muted)" }}>Reach is shown as peak daily reach because daily reach values cannot safely be summed into unique period reach.</div>
                  </div>
                </div>
              </section>

              <section className="crm-card overflow-hidden">
                <div className="flex items-center justify-between border-b p-5" style={{ borderColor: "var(--border-soft)" }}>
                  <div><p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--accent)" }}>Campaign mirror</p><h2 className="mt-2 text-lg font-semibold">Campaigns</h2></div>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{visibleCampaigns.length}</span>
                </div>
                {visibleCampaigns.length === 0 ? <div className="p-8 text-sm" style={{ color: "var(--text-muted)" }}>No campaigns are mirrored for the current selection.</div> : (
                  <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
                    {visibleCampaigns.slice(0, 60).map((campaign) => <div key={campaign.id} className="crm-surface p-4">
                      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{campaign.name}</p><p className="mt-1 truncate text-xs" style={{ color: "var(--text-soft)" }}>{campaign.meta_campaign_id}</p></div><span className="rounded-full px-2 py-1 text-[10px] font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{campaign.status || "unknown"}</span></div>
                      <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>{campaign.ad_account_name}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs" style={{ color: "var(--text-muted)" }}><div><span style={{ color: "var(--text-soft)" }}>Objective</span><br />{campaign.objective || "—"}</div><div><span style={{ color: "var(--text-soft)" }}>Last seen</span><br />{formatDate(campaign.last_seen_at)}</div></div>
                    </div>)}
                  </div>
                )}
              </section>

              <section className="crm-card overflow-hidden">
                <div className="flex flex-col gap-2 border-b p-5 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--border-soft)" }}>
                  <div><p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--accent)" }}>CRM lead ingestion</p><h2 className="mt-2 text-lg font-semibold">Meta leads imported into Tynato</h2></div>
                  <Link href="/leads" className="text-sm font-semibold" style={{ color: "var(--accent)" }}>Open CRM leads →</Link>
                </div>
                {metaLeads.length === 0 ? <div className="p-8 text-sm" style={{ color: "var(--text-muted)" }}>No Meta-attributed CRM leads have been imported yet.</div> : (
                  <div className="overflow-x-auto">
                    <table className="min-w-[980px] text-left">
                      <thead><tr style={{ background: "var(--bg-surface)" }}>{['Lead','Campaign','Form','Ad Set','Ad','Status','Imported'].map((label) => <th key={label} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-soft)" }}>{label}</th>)}</tr></thead>
                      <tbody>{metaLeads.slice(0, 100).map((lead) => <tr key={lead.id} className="border-t" style={{ borderColor: "var(--border-soft)" }}>
                        <td className="px-4 py-3"><p className="text-sm font-semibold">{lead.full_name || "Unnamed lead"}</p><p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{lead.phone_number || lead.email || "—"}</p></td>
                        <td className="px-4 py-3 text-xs">{lead.campaign_name_snapshot || lead.meta_campaign_id || "—"}</td>
                        <td className="px-4 py-3 text-xs">{lead.form_name_snapshot || lead.meta_form_id || "—"}</td>
                        <td className="px-4 py-3 text-xs">{lead.meta_adset_id || "—"}</td>
                        <td className="px-4 py-3 text-xs">{lead.meta_ad_id || "—"}</td>
                        <td className="px-4 py-3 text-xs capitalize">{lead.status.replaceAll('_', ' ')}</td>
                        <td className="px-4 py-3 text-xs">{formatDate(lead.imported_at)}</td>
                      </tr>)}</tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
