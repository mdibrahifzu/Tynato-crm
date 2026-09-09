'use client'

import Sidebar from '../components/Sidebar'
import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase'

export default function SettingsPage() {

    const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setEmail(user.email || '')

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      setFullName(profile?.full_name || '')
    }
    loadProfile()
  }, [])

  function setTheme(
    theme: string
  ) {

    localStorage.setItem(
      'theme',
      theme
    )

    document.documentElement.setAttribute(
      'data-theme',
      theme
    )
  }

  return (

    <div className="flex">

      <Sidebar />

      <div className="flex-1 p-10">

        <h1
          className="
          text-3xl
          font-bold
          mb-8
          "
        >
          Settings
        </h1>

                <div
          className="crm-card mb-8 max-w-md"
        >
          
          <div>
            <div className="text-sm text-slate-400">Email</div>
            <div className="font-semibold">{email}</div>
          </div>
        </div>

        <div
          className="
          flex
          gap-6
          "
        >

          <button
            onClick={() =>
              setTheme(
                'midnight'
              )
            }
            className="
            crm-card
            w-48
            "
          >
            🌙 Midnight
          </button>

          <button
            onClick={() =>
              setTheme(
                'cloud'
              )
            }
            className="
            crm-card
            w-48
            "
          >
            ☁ Cloud
          </button>

          <button
            onClick={() =>
              setTheme(
                'violet'
              )
            }
            className="
            crm-card
            w-48
            "
          >
            🟣 Violet
          </button>

        </div>

      </div>

    </div>

  )
}
