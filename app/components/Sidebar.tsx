'use client'
 
import Link from 'next/link'
import {
  usePathname,
  useRouter,
} from 'next/navigation'
import {
  useEffect,
  useState,
} from 'react'
 
import NotificationBell from './NotificationBell'
import PushEnable from './PushEnable'
import { supabase } from '@/app/lib/supabase'
 
const menus: Array<{
  label: string
  href: string
  icon: string
}> = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: '⌂',
  },
  {
    label: 'Leads',
    href: '/leads',
    icon: '◉',
  },
  {
    label: 'Custom Lead',
    href: '/custom-lead',
    icon: '＋',
  },
  {
    label: 'Upload Audio',
    href: '/audio',
    icon: '◒',
  },
  {
    label: 'Invoices',
    href: '/invoices',
    icon: '▣',
  },
  {
    label: 'Users',
    href: '/users',
    icon: '♙',
  },
  {
    label: 'Integrations',
    href: '/integrations',
    icon: '◇',
  },
  {
    label: 'Sales Call',
    href: '/sales-call',
    icon: '◷',
  },
]
 
export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
 
  const [isAdmin, setIsAdmin] =
    useState(false)
 
  useEffect(() => {
    async function loadRole() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
 
        if (!user) {
          setIsAdmin(false)
          return
        }
 
        const { data: profile } =
          await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
 
        setIsAdmin(
          profile?.role === 'admin',
        )

      } catch (error) {
        console.error(
          'Failed to load user role:',
          error,
        )
 
        setIsAdmin(false)
      }
    }
 
    void loadRole()
  }, [])
 
  async function handleLogout() {
    const { error } =
      await supabase.auth.signOut()
 
    if (error) {
      console.error(
        'Logout failed:',
        error,
      )
      return
    }
 
    router.replace('/login')
  }
 
  return (
    <aside
      className="
        sticky
        top-0
        flex
        h-screen
        w-[250px]
        shrink-0
        flex-col
        border-r
        p-4
        max-lg:w-[86px]
        max-lg:px-3
      "
      style={{
        background:
          'var(--bg-sidebar)',
        borderColor:
          'var(--border-soft)',
      }}
    >
      {/* =====================================================
          BRAND
      ===================================================== */}
 
      <div className="shrink-0">
        <Link
          href="/dashboard"
          className="
            mb-5
            flex
            items-center
            gap-3
            px-2
            py-2
          "
        >
          <span
            className="
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-xl
              bg-gradient-to-br
              from-blue-500
              to-violet-600
              text-base
              font-black
              text-white
              shadow-lg
              shadow-blue-600/20
            "
          >
            T
          </span>
 
          <span className="max-lg:hidden">
            <span
              className="
                block
                text-lg
                font-bold
                tracking-tight
              "
              style={{
                color:
                  'var(--text-primary)',
              }}
            >
              Tynato CRM
            </span>
 
            <span
              className="
                block
                text-[10px]
                uppercase
                tracking-[0.18em]
              "
              style={{
                color:
                  'var(--text-muted)',
              }}
            >
              Sales Workspace
            </span>
          </span>
        </Link>
      </div>
 
      {/* =====================================================
          SCROLLABLE NAVIGATION
          
          Only this section scrolls.
          Footer stays pinned.
      ===================================================== */}
 
      <nav
        className="
          crm-sidebar-nav
          min-h-0
          flex-1
          overflow-y-auto
          overflow-x-hidden
          pr-1
          space-y-1
        "
      >
        {menus.map((menu) => {
          const active =
            pathname === menu.href ||
            (menu.href === '/audio' &&
              pathname.startsWith(
                '/audio/evaluation/',
              )) ||
            (menu.href === '/integrations' &&
              pathname.startsWith('/integrations/'))
 
          return (
            <Link
              key={menu.href}
              href={menu.href}
              aria-current={
                active
                  ? 'page'
                  : undefined
              }
              title={menu.label}
              className="
                group
                flex
                min-w-0
                items-center
                gap-3
                rounded-xl
                px-3
                py-3
                text-sm
                font-medium
                transition
                max-lg:justify-center
              "
              style={{
                color: active
                  ? '#93c5fd'
                  : 'var(--text-muted)',
 
                background:
                  active
                    ? 'rgba(59,130,246,0.15)'
                    : 'transparent',
 
                boxShadow:
                  active
                    ? 'inset 0 0 0 1px rgba(96,165,250,0.10)'
                    : 'none',
              }}
            >
              {/* Icon */}
              <span
                className="
                  flex
                  h-8
                  w-8
                  shrink-0
                  items-center
                  justify-center
                  rounded-lg
                  text-base
                "
                style={{
                  background:
                    active
                      ? 'rgba(59,130,246,0.15)'
                      : 'rgba(255,255,255,0.03)',
 
                  color:
                    active
                      ? '#93c5fd'
                      : '#64748b',
                }}
              >
                {menu.icon}
              </span>
 
              {/* Label */}
              <span
                className="
                  min-w-0
                  truncate
                  max-lg:hidden
                "
              >
                {menu.label}
              </span>
            </Link>
          )
        })}
      </nav>
 
      {/* =====================================================
          FIXED FOOTER ACTIONS
 
          Notifications → Settings → Logout
      ===================================================== */}
 
      <div
        className="
          mt-3
          shrink-0
          border-t
          pt-3
        "
        style={{
          borderColor:
            'var(--border-soft)',
        }}
      >
        {/* Workspace / Admin badge */}
        <div
          className="
            mb-2
            hidden
            rounded-xl
            px-3
            py-2
            text-[10px]
            uppercase
            tracking-wider
            max-lg:hidden
          "
          style={{
            background:
              'var(--bg-surface)',
            color:
              'var(--text-soft)',
          }}
        >
          {isAdmin
            ? 'Administrator'
            : 'Sales Workspace'}
        </div>
 
        <PushEnable />
 
        {/* ================================
            NOTIFICATIONS
            ================================ */}
 
        <div className="mb-1">
          <div className="max-lg:hidden">
            <NotificationBell
              placement="up"
            />
          </div>
 
          <div className="hidden max-lg:block">
            <NotificationBell
              compact
              placement="up"
            />
          </div>
        </div>
 
        {/* ================================
            SETTINGS
            ================================ */}
 
        <Link
          href="/settings"
          aria-current={
            pathname === '/settings'
              ? 'page'
              : undefined
          }
          title="Settings"
          className="
            group
            flex
            min-w-0
            items-center
            gap-3
            rounded-xl
            px-3
            py-3
            text-sm
            font-medium
            transition
            max-lg:justify-center
          "
          style={{
            color:
              pathname === '/settings'
                ? '#93c5fd'
                : 'var(--text-muted)',
 
            background:
              pathname === '/settings'
                ? 'rgba(59,130,246,0.15)'
                : 'transparent',
 
            boxShadow:
              pathname === '/settings'
                ? 'inset 0 0 0 1px rgba(96,165,250,0.10)'
                : 'none',
          }}
        >
          <span
            className="
              flex
              h-8
              w-8
              shrink-0
              items-center
              justify-center
              rounded-lg
              text-base
            "
            style={{
              background:
                pathname === '/settings'
                  ? 'rgba(59,130,246,0.15)'
                  : 'rgba(255,255,255,0.03)',
 
              color:
                pathname === '/settings'
                  ? '#93c5fd'
                  : '#64748b',
            }}
          >
            ⚙
          </span>
 
          <span className="max-lg:hidden">
            Settings
          </span>
        </Link>
 
        {/* ================================
            LOGOUT
            ================================ */}
 
        <button
          type="button"
          onClick={() =>
            void handleLogout()
          }
          title="Logout"
          className="
            mt-1
            flex
            w-full
            min-w-0
            items-center
            gap-3
            rounded-xl
            px-3
            py-3
            text-left
            text-sm
            font-medium
            text-rose-300
            transition
            hover:bg-rose-500/10
            max-lg:justify-center
          "
        >
          <span
            className="
              flex
              h-8
              w-8
              shrink-0
              items-center
              justify-center
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