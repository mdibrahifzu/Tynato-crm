'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { supabase } from '@/app/lib/supabase'

export default function SalesSchedulerShell({
  children,
}: {
  children: ReactNode
}) {
  const router = useRouter()

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <div className="min-h-screen bg-[#07101f] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07101f]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/sales-scheduling" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 text-base font-black text-white shadow-lg shadow-blue-600/20">
              T
            </span>
            <span>
              <span className="block text-lg font-bold tracking-tight text-white">
                Tynato
              </span>
              <span className="block text-[10px] uppercase tracking-[0.18em] text-slate-500">
                Sales Dashboard
              </span>
            </span>
          </Link>

          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.05]"
          >
            Logout
          </button>
        </div>
      </header>

      {children}
    </div>
  )
}
