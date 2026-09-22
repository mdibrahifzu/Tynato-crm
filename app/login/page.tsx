'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { superAdminAccessCheck } from '../lib/api'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const cleanEmail = email.trim().toLowerCase()

    if (!cleanEmail || !password) {
      alert('Please enter your email and password')
      return
    }

    if (loading) return

    setLoading(true)

    try {
      // Clear only the browser's previous local session first.
      // This prevents an old/rotated refresh token from interfering
      // with the new login.
      await supabase.auth.signOut({ scope: 'local' })

      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        })

      // Check the login result BEFORE calling any protected API.
      if (error) {
        alert(error.message)
        return
      }

      if (!data.session?.access_token) {
        alert(
          'Login succeeded, but Supabase did not return an active session.',
        )
        return
      }

      // Explicitly persist the fresh session returned by sign-in.
      const { error: setSessionError } =
        await supabase.auth.setSession(data.session)

      if (setSessionError) {
        console.error(
          'Failed to persist Supabase session:',
          setSessionError,
        )
        alert(
          'Login succeeded, but the session could not be saved. Please try again.',
        )
        return
      }

      try {
        const result = await superAdminAccessCheck()

        if (
          result.success &&
          result.platform_role === 'super_admin'
        ) {
          router.replace('/super-admin')
          return
        }
      } catch {
        // Normal CRM users continue to the regular dashboard.
      }

      router.replace('/dashboard')
    } catch (error) {
      console.error('Login error:', error)
      alert(
        error instanceof Error
          ? error.message
          : 'Login failed. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <h1 className="text-4xl font-bold text-center mb-2">
          Login
        </h1>

        <p
          className="text-center mb-8"
          style={{ color: 'var(--text-muted)' }}
        >
          Sign in to Tynato CRM
        </p>

        <form onSubmit={login} className="space-y-5">
          <div>
            <label className="block mb-2">
              Email
            </label>
          
            <input
              type="email"
              value={email}
              placeholder="name@company.com"
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 rounded-lg border"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block mb-2">
              Password
            </label>

            <input
              type="password"
              value={password}
              placeholder="Enter password"
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 rounded-lg border"
              disabled={loading}
            />
          </div>

          <button
  type="submit"
  disabled={loading}
  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-4 rounded-lg transition"
>
  {loading ? 'Signing In...' : 'Login'}
</button>

          {/* Registration link */}
          <p
            className="text-center text-sm pt-2"
            style={{ color: 'var(--text-muted)' }}
          >
            New user?{' '}
            <button
              type="button"
              onClick={() => router.push('/register')}
              className="text-blue-400 hover:underline font-medium"
            >
              Register here
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}