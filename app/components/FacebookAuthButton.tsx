'use client'

import { useState } from 'react'
import { supabase } from '@/app/lib/supabase'

export default function FacebookAuthButton() {
  const [loading, setLoading] = useState(false)

  async function signInWithFacebook() {
    if (loading) return

    setLoading(true)

    const redirectTo =
      `${window.location.origin}/auth/callback?mode=login`

    const { data, error } =
      await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo,
        },
      })

    if (error) {
      console.error('Facebook sign-in failed:', error)
      alert(error.message)
      setLoading(false)
      return
    }

    // Browser clients normally redirect automatically. The fallback
    // is useful for configurations where Supabase returns the URL.
    if (data?.url) {
      window.location.assign(data.url)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void signInWithFacebook()}
      disabled={loading}
      className="mt-4 flex w-full items-center justify-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'rgba(255,255,255,0.10)',
        color: 'var(--text-primary)',
      }}
    >
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1877F2] text-sm font-bold text-white"
        aria-hidden="true"
      >
        f
      </span>

      {loading ? 'Opening Facebook…' : 'Continue with Facebook'}
    </button>
  )
}
