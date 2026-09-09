'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase'

const menus = [
  { label: 'Dashboard', href: '/dashboard', icon: '⌂' },
  { label: 'Leads', href: '/leads', icon: '◉' },
  { label: 'Custom Lead', href: '/custom-lead', icon: '＋' },
  { label: 'Find Leads', href: '/search', icon: '⌕' },
  { label: 'Upload Audio', href: '/audio', icon: '◒' },
  { label: 'Invoices', href: '/invoices', icon: '▣' },
  {
    label: 'Search History',
    href: '/search_history',
    icon: '◷',
  },
  { label: 'Users', href: '/users', icon: '♙' },
  { label: 'Settings', href: '/settings', icon: '⚙' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    async function loadRole() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setIsAdmin(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      setIsAdmin(profile?.role === 'admin')
    }

    loadRole()
  }, [])

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Logout failed:', error)
      return
    }

    window.location.href = '/login'
  }

  return (
    <aside
      className="
        sticky top-0
        flex h-screen w-[250px] shrink-0 flex-col
        border-r border-white/10
        p-4
        max-lg:w-[86px]
        max-lg:px-3
      "
      style={{ background: 'var(--bg-sidebar)' }}
    >
      <Link
        href="/dashboard"
        className="mb-7 flex items-center gap-3 px-2 py-2"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 text-base font-black text-white shadow-lg shadow-blue-600/20">
          T
        </span>

        <span className="max-lg:hidden">
          <span className="block text-lg font-bold tracking-tight text-white">
            Tynato CRM
          </span>

          <span className="block text-[10px] uppercase tracking-[0.18em] text-slate-400">
            Sales Workspace
          </span>
        </span>
      </Link>

      <nav className="flex-1 space-y-1">
        {menus.map((menu) => {
          const active =
            pathname === menu.href ||
            (menu.href === '/audio' &&
              pathname.startsWith('/audio/evaluation/'))

          return (
            <Link
              key={menu.href}
              href={menu.href}
              className={`
                group flex items-center gap-3 rounded-xl px-3 py-3
                text-sm font-medium transition
                max-lg:justify-center
                ${
                  active
                    ? 'bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-400/10'
                    : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'
                }
              `}
            >
              <span
                className={`
                  flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                  text-base
                  ${
                    active
                      ? 'bg-blue-500/15 text-blue-300'
                      : 'bg-white/[0.03] text-slate-500 group-hover:text-slate-300'
                  }
                `}
              >
                {menu.icon}
              </span>

              <span className="max-lg:hidden">
                {menu.label}
              </span>
            </Link>
          )
        })}
      </nav>

      <div className="mt-4 border-t border-white/10 pt-4">
        <div className="mb-3 hidden rounded-xl bg-white/[0.04] px-3 py-2 text-[10px] uppercase tracking-wider text-slate-500 max-lg:hidden">
          {isAdmin ? 'Administrator' : 'Sales Workspace'}
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="
            flex w-full items-center gap-3 rounded-xl px-3 py-3
            text-left text-sm font-medium text-rose-300
            transition hover:bg-rose-500/10
            max-lg:justify-center
          "
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-300">
            ↪
          </span>

          <span className="max-lg:hidden">
            Logout
          </span>
        </button>
      </div>
    </aside>
  )
}