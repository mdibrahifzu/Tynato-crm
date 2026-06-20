'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function LoginPage() {

  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function login() {

    setLoading(true)

    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password
      })

    setLoading(false)

    if (error) {

      alert(error.message)

      return

    }

    router.push('/dashboard')

  }

  return (

    <div
      className="
      min-h-screen
      flex
      items-center
      justify-center
      px-6
      "
    >

      <div
        className="
        w-full
        max-w-md
        rounded-2xl
        p-8
        "
        style={{
          background:
            'var(--bg-card)',
          border:
            '1px solid rgba(255,255,255,0.08)'
        }}
      >

        <h1
          className="
          text-4xl
          font-bold
          text-center
          mb-2
          "
        >
          Login
        </h1>

        <p
          className="
          text-center
          mb-8
          "
          style={{
            color:
              'var(--text-muted)'
          }}
        >
          Sign in to Tynato CRM
        </p>

        <div className="space-y-5">

          <div>

            <label
              className="block mb-2"
            >
              Email
            </label>

            <input
              type="email"
              value={email}
              placeholder="name@company.com"
              onChange={(e) =>
                setEmail(
                  e.target.value
                )
              }
              className="
              w-full
              p-4
              rounded-lg
              border
              "
            />

          </div>

          <div>

            <label
              className="block mb-2"
            >
              Password
            </label>

            <input
              type="password"
              value={password}
              placeholder="Enter password"
              onChange={(e) =>
                setPassword(
                  e.target.value
                )
              }
              className="
              w-full
              p-4
              rounded-lg
              border
              "
            />

          </div>

          <button
            onClick={login}
            disabled={loading}
            className="
            w-full
            bg-blue-600
            hover:bg-blue-700
            text-white
            font-medium
            py-4
            rounded-lg
            transition
            "
          >

            {
              loading
                ? 'Signing In...'
                : 'Login'
            }

          </button>

        </div>

      </div>

    </div>

  )

}