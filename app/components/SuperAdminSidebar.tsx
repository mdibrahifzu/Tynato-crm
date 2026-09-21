'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'

const menus = [
  {
    label: 'Dashboard',
    href: '/super-admin',
    icon: '⌂',
  },
  {
    label: 'Organizations',
    href: '/super-admin/organizations',
    icon: '▦',
  },
  {
    label: 'Modules',
    href: '/super-admin/modules',
    icon: '◈',
  },
  {
    label: 'Users',
    href: '/super-admin/users',
    icon: '♙',
  },
  {
    label: 'Audit Logs',
    href: '/super-admin/audit-logs',
    icon: '◷',
  },
  // {
  //   label: 'System Health',
  //   href: '/super-admin/system-health',
  //   icon: '⌁',
  // },
]

export default function SuperAdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error(
        'Super Admin logout failed:',
        error,
      )
      return
    }

    router.replace('/login')
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
      {/* Brand */}
      <Link
        href="/super-admin"
        className="mb-7 flex items-center gap-3 px-2 py-2"
      >
        <span
          className="
            flex h-10 w-10 items-center justify-center
            rounded-xl
            bg-gradient-to-br from-blue-500 to-violet-600
            text-base font-black text-white
            shadow-lg shadow-blue-600/20
          "
        >
          T
        </span>

        <span className="max-lg:hidden">
          <span className="block text-lg font-bold tracking-tight text-white">
            Tynato
          </span>

          <span className="block text-[10px] uppercase tracking-[0.18em] text-blue-300">
            Super Admin
          </span>
        </span>
      </Link>

      {/* Platform indicator */}
      <div className="mb-4 max-lg:hidden">
        <div
          className="
            flex items-center gap-2
            rounded-xl
            border border-white/5
            bg-white/[0.03]
            px-3 py-2
          "
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />

          <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
            Platform Console
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {menus.map((menu) => {
          const active =
            menu.href === '/super-admin'
              ? pathname === '/super-admin'
              : pathname.startsWith(menu.href)

          return (
            <Link
              key={menu.href}
              href={menu.href}
              className={`
                group flex items-center gap-3
                rounded-xl px-3 py-3
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
                  flex h-8 w-8 shrink-0 items-center justify-center
                  rounded-lg text-base
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

      {/* Super Admin account */}
      <div className="mt-4 border-t border-white/10 pt-4">
        <div className="mb-3 hidden rounded-xl bg-white/[0.04] px-3 py-2 max-lg:hidden">
          <div className="text-[10px] uppercase tracking-[0.15em] text-slate-500">
            Access Level
          </div>

          <div className="mt-1 text-xs font-semibold text-purple-300">
            Super Administrator
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="
            flex w-full items-center gap-3
            rounded-xl px-3 py-3
            text-left text-sm font-medium
            text-rose-300
            transition
            hover:bg-rose-500/10
            max-lg:justify-center
          "
        >
          <span
            className="
              flex h-8 w-8 items-center justify-center
              rounded-lg
              bg-rose-500/10
              text-rose-300
            "
          >
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