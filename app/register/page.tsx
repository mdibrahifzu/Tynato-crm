'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function RegisterPage() {

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function register() {

    if (!email || !password) {

      alert('Please fill all fields')

      return

    }

    setLoading(true)

    try {

      const { data, error } =
        await supabase.auth.signUp({
          email,
          password
        })

      if (error) {

        alert(error.message)

        return

      }

      if (data.user) {

        const {
          error: profileError
        } =
          await supabase
            .from('profiles')
            .insert([
              {
                id: data.user.id,
                email: data.user.email,
                full_name: 'Admin',
                role: 'admin'
              }
            ])

        if (profileError) {

          console.error(profileError)

          alert(
            'Profile creation failed'
          )

          return

        }

      }

      alert(
        'Registration Successful'
      )

      setEmail('')
      setPassword('')

    } catch (err) {

      console.error(err)

      alert('Registration Failed')

    } finally {

      setLoading(false)

    }

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
          Register
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
          Create your Tynato CRM account
        </p>

        <div className="space-y-5">

          <div>

            <label
              className="block mb-2"
              style={{
                color:
                  'var(--text-primary)'
              }}
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
              style={{
                color:
                  'var(--text-primary)'
              }}
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
            onClick={register}
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
                ? 'Creating Account...'
                : 'Create Account'
            }

          </button>

        </div>

      </div>

    </div>

  )

}