import Link from 'next/link'

const features = [
  {
    title: 'Lead Management',
    description:
      'Organize and manage your leads from a centralized CRM workspace.',
  },
  {
    title: 'Lead Discovery',
    description:
      'Find and explore relevant business leads through the CRM search tools.',
  },
  {
    title: 'Track Progress',
    description:
      'Keep track of lead status and follow your sales workflow efficiently.',
  },
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0f172a] text-white">

      {/* Header */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">

          <Link
            href="/"
            className="text-2xl font-bold tracking-tight"
          >
            Tynato <span className="text-blue-500">CRM</span>
          </Link>

          <Link
            href="/login"
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold transition hover:bg-blue-500"
          >
            Login
          </Link>

        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute -right-40 -top-40 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute -left-40 top-40 h-96 w-96 rounded-full bg-blue-500/5 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-6 py-24 text-center lg:px-8 lg:py-32">

          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
            Tynato CRM
          </p>

          <h1 className="mx-auto max-w-4xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            A smarter way to
            <span className="text-blue-500"> manage your leads</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
            Tynato CRM provides a centralized workspace to discover,
            organize, manage, and track business leads efficiently.
          </p>

          <div className="mt-9 flex justify-center">
            <Link
              href="/login"
              className="rounded-lg bg-blue-600 px-7 py-3.5 text-sm font-semibold shadow-lg shadow-blue-600/20 transition hover:bg-blue-500"
            >
              Login to Tynato CRM
            </Link>
          </div>

        </div>
      </section>

      {/* About */}
      <section className="border-t border-white/10 bg-[#111c32]">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center lg:px-8">

          <h2 className="text-2xl font-bold sm:text-3xl">
            Built to simplify CRM operations
          </h2>

          <p className="mt-5 leading-7 text-slate-400">
            Tynato CRM brings essential lead management and discovery
            capabilities together in one organized platform, helping teams
            work with their lead information more efficiently.
          </p>

        </div>
      </section>

      {/* Features */}
      <section className="bg-[#0f172a]">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">

          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-400">
              Core capabilities
            </p>

            <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
              Everything in one workspace
            </h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">

            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-slate-700 bg-[#1e293b] p-6 transition hover:border-blue-500/50"
              >
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/10 text-blue-400">
                  <span className="text-lg">✦</span>
                </div>

                <h3 className="text-lg font-semibold">
                  {feature.title}
                </h3>

                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {feature.description}
                </p>
              </div>
            ))}

          </div>
        </div>
      </section>

      {/* Login CTA */}
      <section className="border-t border-white/10 bg-[#111c32]">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">

          <h2 className="text-2xl font-bold sm:text-3xl">
            Ready to get started?
          </h2>

          <p className="mt-4 text-slate-400">
            Sign in to access your Tynato CRM workspace.
          </p>

          <Link
            href="/login"
            className="mt-7 inline-block rounded-lg bg-blue-600 px-7 py-3.5 text-sm font-semibold transition hover:bg-blue-500"
          >
            Login
          </Link>

        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-8">

          <span className="font-medium text-slate-300">
            Tynato CRM
          </span>

          <span>
            CRM platform for organized lead management
          </span>

        </div>
      </footer>

    </main>
  )
}