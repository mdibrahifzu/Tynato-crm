import Link from 'next/link'

function ArrowUpRight() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M5 15L15 5M7 5H15V13"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SparkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M12 2.8L13.9 9.1L20.2 11L13.9 12.9L12 19.2L10.1 12.9L3.8 11L10.1 9.1L12 2.8Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M5 10.5L8.2 13.5L15 6.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function MiniBars() {
  const bars = [42, 58, 35, 67, 52, 82, 62, 91, 74, 96, 81, 100]

  return (
    <div className="flex h-20 items-end gap-1.5">
      {bars.map((height, index) => (
        <div
          key={index}
          className="flex-1 rounded-t-md bg-gradient-to-t from-blue-500/30 to-violet-400/80"
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  )
}

function LeadRow({
  initials,
  name,
  company,
  stage,
  score,
}: {
  initials: string
  name: string
  company: string
  stage: string
  score: string
}) {
  return (
    <div className="flex items-center gap-3 border-b border-white/[0.06] py-3 last:border-b-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[10px] font-semibold text-white">
        {initials}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-white">{name}</p>
        <p className="truncate text-[10px] text-slate-500">{company}</p>
      </div>

      <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[9px] text-slate-400">
        {stage}
      </span>

      <span className="w-8 text-right text-[10px] font-semibold text-cyan-300">
        {score}
      </span>
    </div>
  )
}

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#060914] text-white">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[8%] top-[8%] h-[420px] w-[420px] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute right-[5%] top-[15%] h-[500px] w-[500px] rounded-full bg-violet-600/10 blur-[130px]" />
        <div className="absolute bottom-[-150px] left-[35%] h-[420px] w-[420px] rounded-full bg-cyan-500/5 blur-[120px]" />

        <div
          className="absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.20) 1px, transparent 0)',
            backgroundSize: '26px 26px',
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-20 border-b border-white/[0.07] bg-[#060914]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1320px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-gradient-to-br from-blue-500 via-violet-500 to-fuchsia-500 text-sm font-bold shadow-[0_8px_28px_rgba(79,70,229,0.30)]">
            T
            </div>

            <div>
              <div className="text-[17px] font-semibold tracking-[-0.02em]">
                Tynato <span className="text-blue-400">CRM</span>
              </div>
              <div className="mt-[-2px] text-[9px] font-medium uppercase tracking-[0.24em] text-slate-500">
                Sales Workspace
              </div>
            </div>
          </Link>

          <Link
            href="/login"
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
          >
            Login
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10">
        <div className="mx-auto grid max-w-[1320px] items-center gap-14 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:pb-28 lg:pt-20">
          {/* Copy */}
          <div className="max-w-[600px]">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/[0.07] px-3.5 py-2 text-xs font-medium text-blue-200">
              <SparkIcon />
              Built around the sales workflow
            </div>

            <h1 className="text-[48px] font-semibold leading-[0.98] tracking-[-0.045em] sm:text-[64px] lg:text-[72px]">
              Manage leads.
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-violet-400 bg-clip-text text-transparent">
                Understand
              </span>
              <br />
              <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                conversations.
              </span>
              <br />
              Improve sales.
            </h1>

            <p className="mt-7 max-w-[560px] text-[16px] leading-8 text-slate-400 sm:text-[17px]">
              Tynato CRM brings lead discovery, lead management, sales
              workflow, and AI-powered call intelligence together in one
              focused workspace.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(59,130,246,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(124,58,237,0.28)]"
              >
                Login to Tynato CRM
                <ArrowUpRight />
              </Link>

              <a
                href="#platform"
                className="inline-flex items-center justify-center rounded-xl border border-white/[0.10] bg-white/[0.03] px-6 py-3.5 text-sm font-semibold text-slate-200 backdrop-blur transition hover:bg-white/[0.06]"
              >
                Explore platform
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-xs text-slate-500">
              <span className="flex items-center gap-2">
                <CheckIcon />
                Lead-first workflow
              </span>
              <span className="flex items-center gap-2">
                <CheckIcon />
                AI-ready architecture
              </span>
              <span className="flex items-center gap-2">
                <CheckIcon />
                Authenticated CRM access
              </span>
            </div>
          </div>

          {/* Product Preview */}
          <div className="relative">
            <div className="absolute -inset-8 rounded-[40px] bg-blue-500/[0.07] blur-3xl" />

            <div className="relative overflow-hidden rounded-[26px] border border-white/[0.10] bg-[#0b1220]/95 shadow-[0_40px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl">
              {/* Browser/top bar */}
              <div className="flex h-12 items-center justify-between border-b border-white/[0.07] px-4 sm:px-5">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-400/70" />
                  <span className="h-2 w-2 rounded-full bg-yellow-400/70" />
                  <span className="h-2 w-2 rounded-full bg-green-400/70" />
                </div>

                <div className="rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-[9px] text-slate-500">
                  app.tynatocrm.local
                </div>

                <div className="w-10" />
              </div>

              <div className="grid grid-cols-[82px_1fr] sm:grid-cols-[98px_1fr]">
                {/* Sidebar */}
                <aside className="border-r border-white/[0.07] bg-[#080e1b] p-2.5 sm:p-3">
                  <div className="mb-5 flex justify-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 text-[11px] font-bold">
                      T
                    </div>
                  </div>

                  <div className="space-y-1">
                    {[
  { label: 'Dashboard', active: true },
  { label: 'Leads', active: false },
  { label: 'Find Leads', active: false },
  { label: 'Upload Audio', active: false },
  { label: 'Users', active: false },
  { label: 'Settings', active: false },
].map(({ label, active }) => (
                      <div
                        key={label}
                        className={`rounded-lg px-2 py-2 text-[8px] sm:text-[9px] ${
                          active
                            ? 'bg-blue-500/15 text-blue-300'
                            : 'text-slate-500'
                        }`}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                </aside>

                {/* Dashboard */}
                <div className="min-w-0 bg-[#0d1626] p-3.5 sm:p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-[8px] uppercase tracking-[0.18em] text-slate-500">
                        Overview
                      </p>
                      <h3 className="mt-1 text-sm font-semibold sm:text-base">
                        Sales workspace
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span className="text-[9px] text-emerald-300">
                        Live
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      ['Total leads', '240', '+14%'],
                      ['Interested', '86', '+9%'],
                      ['Follow up', '41', '+6%'],
                      ['Converted', '23', '+18%'],
                    ].map(([label, value, change]) => (
                      <div
                        key={label}
                        className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"
                      >
                        <p className="text-[8px] text-slate-500">{label}</p>
                        <div className="mt-1.5 flex items-end justify-between gap-2">
                          <p className="text-lg font-semibold tracking-tight">
                            {value}
                          </p>
                          <span className="text-[8px] text-emerald-400">
                            {change}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Middle section */}
                  <div className="mt-3 grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
                    {/* Pipeline */}
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <p className="text-[8px] uppercase tracking-[0.18em] text-slate-500">
                            Pipeline
                          </p>
                          <p className="mt-1 text-xs font-medium">
                            Lead performance
                          </p>
                        </div>

                        <span className="text-[8px] text-slate-500">
                          This month
                        </span>
                      </div>

                      <MiniBars />

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div>
                          <p className="text-[8px] text-slate-500">
                            Qualified
                          </p>
                          <p className="mt-0.5 text-[11px] font-semibold">
                            114
                          </p>
                        </div>

                        <div>
                          <p className="text-[8px] text-slate-500">
                            Meetings
                          </p>
                          <p className="mt-0.5 text-[11px] font-semibold">
                            37
                          </p>
                        </div>

                        <div>
                          <p className="text-[8px] text-slate-500">
                            Won
                          </p>
                          <p className="mt-0.5 text-[11px] font-semibold">
                            23
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* AI call insight */}
                    <div className="rounded-xl border border-blue-400/10 bg-gradient-to-br from-blue-500/[0.08] to-violet-500/[0.06] p-3.5">
                      <div className="flex items-start justify-between">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-400/10 text-blue-300">
                          <SparkIcon />
                        </div>

                        <span className="rounded-full border border-emerald-400/10 bg-emerald-400/5 px-2 py-1 text-[8px] text-emerald-300">
                          AI Ready
                        </span>
                      </div>

                      <p className="mt-4 text-[8px] uppercase tracking-[0.18em] text-slate-500">
                        AI Call Analysis
                      </p>

                      <p className="mt-1 text-sm font-semibold">
                        Conversation intelligence
                      </p>

                      <p className="mt-2 text-[9px] leading-5 text-slate-500">
                        Turn sales conversations into structured insights,
                        coaching signals, and next-step actions.
                      </p>

                      <div className="mt-4 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                          <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-blue-400 to-violet-400" />
                        </div>
                        <span className="text-[9px] text-slate-400">
                          78%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Recent leads */}
                  <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <p className="text-[8px] uppercase tracking-[0.18em] text-slate-500">
                          Recent activity
                        </p>
                        <p className="mt-1 text-xs font-medium">
                          High-priority leads
                        </p>
                      </div>

                      <span className="text-[8px] text-blue-300">
                        View all
                      </span>
                    </div>

                    <LeadRow
                      initials="AK"
                      name="Arun Kumar"
                      company="TechNova Solutions"
                      stage="Discovery"
                      score="92"
                    />

                    <LeadRow
                      initials="SM"
                      name="Sarah Mathews"
                      company="PrimeWorks"
                      stage="Proposal"
                      score="88"
                    />

                    <LeadRow
                      initials="RJ"
                      name="Rahul Jain"
                      company="Vertex Systems"
                      stage="Follow-up"
                      score="81"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform */}
      <section
        id="platform"
        className="relative z-10 border-t border-white/[0.06] bg-[#080d19]/70"
      >
        <div className="mx-auto max-w-[1320px] px-5 py-20 sm:px-8 lg:py-24">
          <div className="max-w-[680px]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">
              One sales workspace
            </p>

            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
              Everything your sales team needs in one place.
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-500 sm:text-base">
              From discovering new leads to understanding customer
              conversations, Tynato keeps the complete workflow connected.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                number: '01',
                title: 'Find Leads',
                text: 'Discover and organize new business opportunities.',
              },
              {
                number: '02',
                title: 'Manage Leads',
                text: 'Keep ownership, status, notes and follow-ups together.',
              },
              {
                number: '03',
                title: 'Analyze Calls',
                text: 'Convert sales conversations into structured intelligence.',
              },
              {
                number: '04',
                title: 'Improve Sales',
                text: 'Turn call insights into practical next-step actions.',
              },
            ].map((item) => (
              <div
                key={item.number}
                className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 transition hover:-translate-y-1 hover:border-blue-400/20 hover:bg-white/[0.04]"
              >
                <span className="text-xs font-semibold text-blue-400/70">
                  {item.number}
                </span>

                <h3 className="mt-7 text-base font-semibold">
                  {item.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto max-w-[900px] px-5 py-24 text-center sm:px-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 text-sm font-bold shadow-[0_12px_35px_rgba(79,70,229,0.25)]">
            T
          </div>

          <h2 className="mt-6 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            Build a better sales workflow.
          </h2>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-500 sm:text-base">
            Bring lead management and conversation intelligence together with
            Tynato CRM.
          </p>

          <Link
            href="/login"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
          >
            Enter Tynato CRM
            <ArrowUpRight />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-3 px-5 py-6 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© {new Date().getFullYear()} Tynato CRM</p>
          <p>Sales workspace · Lead management · AI call intelligence</p>
        </div>
      </footer>
    </main>
  )
}