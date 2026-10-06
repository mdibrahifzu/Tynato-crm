"use client"

import Link from "next/link"
import Sidebar from "@/app/components/Sidebar"

export default function IntegrationsPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-main)", color: "var(--text-primary)" }}>
      <div className="flex min-h-screen">
        <Sidebar />

        <main className="min-w-0 flex-1 overflow-x-hidden">
          <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--accent)" }}>
                Workspace
              </p>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Integrations</h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 sm:text-base" style={{ color: "var(--text-muted)" }}>
                    Connect approved external platforms to this Tynato workspace. Each connection is isolated to the current customer workspace.
                  </p>
                </div>
              </div>
            </div>

            <section className="grid gap-5 lg:grid-cols-2">
              <Link
                href="/integrations/meta"
                className="group rounded-2xl border p-6 transition hover:-translate-y-0.5 hover:border-blue-400/30 hover:bg-white/[0.02]"
                style={{ background: "var(--bg-card)", borderColor: "var(--border-soft)" }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-xl text-blue-300">
                    M
                  </div>
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                    Available
                  </span>
                </div>
                <h2 className="mt-5 text-xl font-semibold">Meta Ads</h2>
                <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                  Connect Pages, lead forms and advertising accounts. View synchronized campaigns and read-only performance data, with incoming Meta leads imported into Tynato CRM.
                </p>
                <div className="mt-6 flex items-center justify-between border-t pt-4 text-sm" style={{ borderColor: "var(--border-soft)" }}>
                  <span style={{ color: "var(--text-soft)" }}>Manage connection</span>
                  <span className="text-blue-300 transition group-hover:translate-x-0.5">→</span>
                </div>
              </Link>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
