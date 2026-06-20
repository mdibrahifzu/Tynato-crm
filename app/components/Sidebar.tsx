'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Sidebar() {

  const pathname =
    usePathname()

  const menus = [

    {
      label: 'Dashboard',
      href: '/dashboard'
    },

    {
      label: 'Leads',
      href: '/leads'
    },

    {
      label: 'Find Leads',
      href: '/search'
    },

    {
      label: 'Search History',
      href: '/search_history'
    },

    {
      label: 'Users',
      href: '/users'
    },

    {
      label: 'Settings',
      href: '/settings'
    }

  ]

  return (

    <div
      className="
      w-72
      min-h-screen
      p-6
      border-r
      "
      style={{
        background:
          'var(--bg-sidebar)'
      }}
    >

      <h1
        className="
        text-2xl
        font-bold
        mb-8
        "
      >
        Tynato CRM
      </h1>

      <div
        className="
        flex
        flex-col
        gap-2
        "
      >

        {menus.map((menu) => (

          <Link
            key={menu.href}
            href={menu.href}
            className={`
            p-3
            rounded-lg
            transition
            ${
              pathname ===
              menu.href
                ? 'bg-blue-600 text-white'
                : 'hover:bg-white/10'
            }
            `}
          >
            {menu.label}
          </Link>

        ))}

      </div>

    </div>

  )
}