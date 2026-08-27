'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function RegisterPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function register() {
  const cleanEmail = email.trim().toLowerCase()

  if (!cleanEmail || !password || !confirmPassword) {
    alert('Please fill in all fields')
    return
  }

  if (password.length < 6) {
    alert('Password must be at least 6 characters')
    return
  }

  if (password !== confirmPassword) {
    alert('Passwords do not match')
    return
  }

  setLoading(true)

  try {
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
    })

    if (error) {
      console.error('Supabase registration error:', error)
      alert(error.message || 'Registration failed')
      return
    }

    if (!data.user) {
      alert('Registration failed. Please try again.')
      return
    }

    if (data.session) {
      router.push('/dashboard')
      return
    }

    alert(
      'Registration successful. Please check your email to verify your account.'
    )

    router.push('/login')
  } catch (error) {
    console.error('Registration exception:', error)

    alert(
      error instanceof Error
        ? error.message
        : 'Registration failed. Please try again.'
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
          Create Account
        </h1>

        <p
          className="text-center mb-8"
          style={{ color: 'var(--text-muted)' }}
        >
          Start your free Tynato CRM trial
        </p>

        <div className="space-y-5">
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
              placeholder="Create a password"
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 rounded-lg border"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block mb-2">
              Confirm Password
            </label>

            <input
              type="password"
              value={confirmPassword}
              placeholder="Confirm your password"
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-4 rounded-lg border"
              disabled={loading}
            />
          </div>

          <button
            onClick={register}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-4 rounded-lg transition"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>

          <p
            className="text-center text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="text-blue-400 hover:underline"
            >
              Login
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}