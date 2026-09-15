'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

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

  setLoading(true)

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    })

    if (error) {
      alert(error.message)
      return
    }

    router.push('/dashboard')
  } catch (error) {
    console.error('Login error:', error)
    alert('Login failed. Please try again.')
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