import Link from 'next/link'

function ArrowUpRight() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M5 15L15 5M7 5H15V13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M4.5 10.2L8.2 13.7L15.5 6.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LeadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 19.2C3.8 15.9 6 14.2 9 14.2C12 14.2 14.2 15.9 14.5 19.2M17 8.2H21M19 6.2V10.2M16.5 15.2H21M16.5 18.2H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7.5 3.5V7.5M16.5 3.5V7.5M3.5 9.5H20.5M8 13H11M8 16.5H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function ConversationIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M4 5.5C4 4.4 4.9 3.5 6 3.5H18C19.1 3.5 20 4.4 20 5.5V14C20 15.1 19.1 16 18 16H11L6 20V16H6C4.9 16 4 15.1 4 14V5.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 8H16M8 11.5H13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function WorkspacePreview() {
  return (
    <div className="relative mx-auto w-full max-w-[650px]">
      <div className="overflow-hidden rounded-[18px] border border-[#dfe5df] bg-white shadow-[0_24px_70px_rgba(25,45,34,0.12)]">
        <div className="flex h-12 items-center justify-between border-b border-[#e9ede8] bg-[#fbfcfa] px-4 sm:px-5">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#cbd5cc]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#d7ddd7]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#e4e8e3]" />
          </div>
          <span className="rounded-md border border-[#e7ebe6] bg-white px-3 py-1 text-[10px] text-[#7c887e]">Tynato workspace</span>
          <div className="w-10" />
        </div>

        <div className="grid min-h-[390px] grid-cols-[112px_1fr] sm:grid-cols-[150px_1fr]">
          <aside className="border-r border-[#e9ede8] bg-[#f8faf7] px-2.5 py-4 sm:px-3.5">
            <div className="mb-7 flex items-center gap-2 px-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#245b42] text-[11px] font-semibold text-white">T</div>
              <span className="hidden text-xs font-semibold tracking-tight text-[#25382b] sm:block">Tynato</span>
            </div>
            <p className="mb-2 px-2 text-[8px] font-semibold uppercase tracking-[0.16em] text-[#9aa49a]">Workspace</p>
            <nav aria-label="Workspace preview" className="space-y-1 text-[10px] sm:text-[11px]">
              <div className="rounded-md bg-[#e8f0e9] px-2.5 py-2 font-medium text-[#245b42]">Overview</div>
              <div className="rounded-md px-2.5 py-2 text-[#68766b]">Leads</div>
              <div className="rounded-md px-2.5 py-2 text-[#68766b]">Follow-ups</div>
              <div className="rounded-md px-2.5 py-2 text-[#68766b]">Call insights</div>
            </nav>
            <div className="mt-8 border-t border-[#e5eae4] pt-4">
              <p className="px-2 text-[8px] font-semibold uppercase tracking-[0.16em] text-[#9aa49a]">Manage</p>
              <div className="mt-2 rounded-md px-2.5 py-2 text-[10px] text-[#68766b] sm:text-[11px]">Team & settings</div>
            </div>
          </aside>

          <div className="min-w-0 bg-white p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#edf0ec] pb-4">
              <div>
                <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-[#89958a]">Your workspace</p>
                <h2 className="mt-1 text-base font-semibold tracking-tight text-[#203328] sm:text-lg">Good morning</h2>
                <p className="mt-1 text-[10px] text-[#849087] sm:text-[11px]">Keep your customer work moving.</p>
              </div>
              <div className="rounded-md border border-[#e6ebe5] px-2.5 py-1.5 text-[9px] text-[#68766b]">Today</div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold text-[#2b3b30] sm:text-sm">Lead activity</h3>
                <p className="mt-1 text-[9px] text-[#929c92] sm:text-[10px]">A clear view of the conversations in progress.</p>
              </div>
              <span className="rounded-full bg-[#edf4ed] px-2.5 py-1 text-[9px] font-medium text-[#376b4d]">Recently updated</span>
            </div>

            <div className="mt-3 overflow-hidden rounded-lg border border-[#e9eee8]">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] border-b border-[#edf0ec] bg-[#fafbf9] px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.12em] text-[#9aa49a] sm:grid-cols-[minmax(0,1fr)_105px_85px]">
                <span>Customer</span><span className="hidden sm:block">Status</span><span className="text-right">Next step</span>
              </div>
              {[
                { initials: 'AK', name: 'New enquiry', detail: 'Contact details received', status: 'New', statusClass: 'bg-[#eef3f7] text-[#536b80]', next: 'Review' },
                { initials: 'SM', name: 'Customer follow-up', detail: 'Conversation in progress', status: 'Follow-up', statusClass: 'bg-[#f7f1df] text-[#8b7134]', next: 'Schedule' },
                { initials: 'RJ', name: 'Call review', detail: 'Notes ready to review', status: 'Interested', statusClass: 'bg-[#eaf3eb] text-[#3e704b]', next: 'View notes' },
              ].map((item) => (
                <div key={item.initials} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-[#edf0ec] px-3 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_105px_85px]">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#edf2ed] text-[9px] font-semibold text-[#49634f]">{item.initials}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[10px] font-semibold text-[#35443a] sm:text-[11px]">{item.name}</span>
                      <span className="mt-0.5 block truncate text-[9px] text-[#98a198]">{item.detail}</span>
                    </span>
                  </div>
                  <span className={`hidden w-fit rounded-full px-2 py-1 text-[9px] font-medium sm:inline-flex ${item.statusClass}`}>{item.status}</span>
                  <span className="text-right text-[9px] font-medium text-[#3e704b]">{item.next}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-[#e8ede7] bg-[#fbfcfa] p-3">
                <div className="flex items-center gap-2 text-[#477153]"><CalendarIcon /><span className="text-[10px] font-semibold text-[#405246]">Follow-ups</span></div>
                <p className="mt-2 text-[9px] leading-4 text-[#89948a]">Keep the next conversation and reminder close to each lead.</p>
              </div>
              <div className="rounded-lg border border-[#e8ede7] bg-[#fbfcfa] p-3">
                <div className="flex items-center gap-2 text-[#477153]"><ConversationIcon /><span className="text-[10px] font-semibold text-[#405246]">Call insights</span></div>
                <p className="mt-2 text-[9px] leading-4 text-[#89948a]">Review key points from customer conversations.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-4 left-5 right-5 -z-10 h-12 rounded-full bg-[#315b40]/10 blur-2xl" />
    </div>
  )
}

const capabilities = [
  {
    number: '01',
    icon: <LeadIcon />,
    title: 'Lead management',
    description: 'Keep customer details, ownership, status and notes together in one organised view.',
  },
  {
    number: '02',
    icon: <CalendarIcon />,
    title: 'Thoughtful follow-ups',
    description: 'Plan the next conversation, assign responsibility and keep reminders connected to the lead.',
  },
  {
    number: '03',
    icon: <ConversationIcon />,
    title: 'Call understanding',
    description: 'Bring call recordings and useful conversation notes into the sales workflow.',
  },
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f7f8f5] text-[#243329]">
      <header className="sticky top-0 z-30 border-b border-[#e6eae4] bg-[#f7f8f5]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Tynato CRM home">
            <span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-[#245b42] text-sm font-semibold text-white">T</span>
            <span>
              <span className="block text-[16px] font-semibold leading-tight tracking-[-0.03em] text-[#23362a]">Tynato</span>
              <span className="mt-0.5 block text-[8px] font-semibold uppercase tracking-[0.19em] text-[#829084]">Customer relationship management</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-8 text-[13px] font-medium text-[#68766b] md:flex" aria-label="Main navigation">
            <a href="#workspace" className="transition hover:text-[#245b42]">Workspace</a>
            <a href="#capabilities" className="transition hover:text-[#245b42]">What you can do</a>
            <a href="#approach" className="transition hover:text-[#245b42]">Our approach</a>
          </nav>
          <Link href="/login" className="inline-flex items-center gap-2 rounded-md bg-[#245b42] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#1d4b36] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245b42]">
            Sign in <ArrowUpRight />
          </Link>
        </div>
      </header>

      <section id="workspace" className="border-b border-[#e8ece6]">
        <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.88fr_1.12fr] lg:gap-14 lg:py-24">
          <div className="max-w-[510px]">
            <div className="mb-6 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.19em] text-[#55745d]">
              <span className="h-px w-7 bg-[#6e9876]" /> A more considered way to work
            </div>
            <h1 className="text-[43px] font-semibold leading-[1.08] tracking-[-0.055em] text-[#203329] sm:text-[54px] lg:text-[60px]">
              Good customer relationships start with <span className="text-[#39734d]">good follow-through.</span>
            </h1>
            <p className="mt-6 max-w-[455px] text-[15px] leading-7 text-[#68766c]">
              Tynato brings lead management, team follow-ups and call insights into one calm, connected workspace — so the next step is easier to see and act on.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/login" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#245b42] px-5 text-[13px] font-semibold text-white transition hover:bg-[#1d4b36] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245b42]">
                Open your workspace <ArrowUpRight />
              </Link>
              <a href="#capabilities" className="inline-flex min-h-12 items-center justify-center rounded-md border border-[#d9e1d8] bg-white px-5 text-[13px] font-semibold text-[#405548] transition hover:border-[#b9cbb9] hover:bg-[#fbfcfa]">
                Explore the workspace
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-[#718075]">
              <span className="inline-flex items-center gap-2"><CheckIcon /> Lead visibility</span>
              <span className="inline-flex items-center gap-2"><CheckIcon /> Clear ownership</span>
              <span className="inline-flex items-center gap-2"><CheckIcon /> Timely follow-ups</span>
            </div>
          </div>
          <div className="lg:pl-2">
            <WorkspacePreview />
            <p className="mt-5 text-center text-[10px] tracking-[0.02em] text-[#98a198]">A simple view of the work your team manages every day.</p>
          </div>
        </div>
      </section>

      <section id="capabilities" className="bg-white">
        <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-8 sm:py-20">
          <div className="max-w-[620px]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.19em] text-[#55745d]">The essentials, connected</p>
            <h2 className="mt-4 text-[32px] font-semibold leading-tight tracking-[-0.045em] text-[#24362b] sm:text-[40px]">Less searching. More meaningful follow-through.</h2>
            <p className="mt-4 text-[14px] leading-7 text-[#768278]">A practical set of tools designed around the way customer relationships actually move.</p>
          </div>
          <div className="mt-12 grid gap-0 border-y border-[#e8ece6] md:grid-cols-3 md:divide-x md:divide-[#e8ece6]">
            {capabilities.map((item) => (
              <article key={item.number} className="group py-7 md:px-7 md:py-8 first:md:pl-0 last:md:pr-0">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#edf3ed] text-[#39734d]">{item.icon}</span>
                  <span className="text-[10px] font-semibold tracking-[0.12em] text-[#a1aaa1]">{item.number}</span>
                </div>
                <h3 className="mt-6 text-[17px] font-semibold tracking-[-0.02em] text-[#2c3d31]">{item.title}</h3>
                <p className="mt-2 max-w-[300px] text-[13px] leading-6 text-[#78847a]">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="approach" className="border-y border-[#e5ebe3] bg-[#eef3ed]">
        <div className="mx-auto grid max-w-[1200px] gap-8 px-5 py-16 sm:px-8 sm:py-20 md:grid-cols-[0.72fr_1.28fr] md:items-center">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.19em] text-[#55745d]">A clear working rhythm</p>
            <h2 className="mt-4 text-[31px] font-semibold leading-tight tracking-[-0.045em] text-[#24362b] sm:text-[38px]">From first contact to the next conversation.</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { step: '01', title: 'Capture', body: 'Bring new enquiries into one place.' },
              { step: '02', title: 'Organise', body: 'Keep context, ownership and status clear.' },
              { step: '03', title: 'Follow through', body: 'Know what needs attention next.' },
            ].map((item) => (
              <div key={item.step} className="border-l-2 border-[#86a68a] bg-white/75 px-4 py-4 sm:min-h-[130px]">
                <span className="text-[10px] font-semibold tracking-[0.12em] text-[#7d967f]">{item.step}</span>
                <h3 className="mt-3 text-[14px] font-semibold text-[#304336]">{item.title}</h3>
                <p className="mt-1.5 text-[12px] leading-5 text-[#7a877c]">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 py-16 sm:px-8 sm:py-20 md:flex-row md:items-center md:justify-between">
          <div className="max-w-[650px]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.19em] text-[#55745d]">Tynato CRM</p>
            <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-[#24362b] sm:text-[36px]">Keep the next customer conversation moving.</h2>
            <p className="mt-3 text-[14px] leading-7 text-[#768278]">Sign in to continue managing your leads, follow-ups and team workflow.</p>
          </div>
          <Link href="/login" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 self-start rounded-md bg-[#245b42] px-5 text-[13px] font-semibold text-white transition hover:bg-[#1d4b36] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245b42] md:self-center">
            Sign in to Tynato <ArrowUpRight />
          </Link>
        </div>
      </section>

      <footer className="border-t border-[#e5eae4] bg-[#f7f8f5]">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-5 py-6 text-[11px] text-[#879287] sm:px-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#245b42] text-[10px] font-semibold text-white">T</span>
            <span className="font-medium text-[#536257]">Tynato CRM</span>
          </div>
          <p>Lead management · Team follow-ups · Call insights</p>
          <p>© {new Date().getFullYear()} Tynato. All rights reserved.</p>
        </div>
      </footer>
    </main>
  )
}
