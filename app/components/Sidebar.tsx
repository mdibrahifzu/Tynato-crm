'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase'

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

  const menus = [
    {
      label: 'Dashboard',
      href: '/dashboard',
    },
    {
      label: 'Leads',
      href: '/leads',
    },
    {
      label: 'Find Leads',
      href: '/search',
    },
    {
      label: 'Search History',
      href: '/search_history',
    },
    {
      label: 'Settings',
      href: '/settings',
    },
  ]

  if (isAdmin) {
    menus.push({
      label: 'Users',
      href: '/users',
    })
  }

  return (
    <div
      className="w-72 min-h-screen p-6 border-r"
      style={{
        background: 'var(--bg-sidebar)',
      }}
    >
      <h1 className="text-2xl font-bold mb-8">
        Tynato CRM
      </h1>

      <div className="flex flex-col gap-2">
        {menus.map((menu) => (
          <Link
            key={menu.href}
            href={menu.href}
            className={`
              p-3
              rounded-lg
              transition
              ${
                pathname === menu.href
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-white/10'
              }
            `}
          >
            {menu.label}
          </Link>
        ))}
      </div>

      <button
        onClick={handleLogout}
        className="
          w-full
          p-3
          mt-6
          rounded-lg
          text-left
          text-red-400
          hover:bg-red-500/10
          transition
        "
      >
        Logout
      </button>
    </div>
  )
}