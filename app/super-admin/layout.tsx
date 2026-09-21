'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'
import { superAdminAccessCheck } from '@/app/lib/api'
import SuperAdminSidebar from '@/app/components/SuperAdminSidebar'

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function verifyAccess() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          router.replace('/login')
          return
        }

        const result =
          await superAdminAccessCheck()

        if (
          !result.success ||
          result.platform_role !== 'super_admin'
        ) {
          router.replace('/dashboard')
          return
        }

        if (!cancelled) {
          setAuthorized(true)
        }
      } catch (error) {
        console.error(
          'Super Admin access verification failed:',
          error,
        )

        if (!cancelled) {
          router.replace('/dashboard')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    verifyAccess()

    return () => {
      cancelled = true
    }
  }, [router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070d19] text-slate-400">
        Verifying Super Admin access...
      </div>
    )
  }

  if (!authorized) {
    return null
  }

  return (
    <div className="flex min-h-screen bg-[#070d19] text-white">
      <SuperAdminSidebar />

      <main className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  )
}