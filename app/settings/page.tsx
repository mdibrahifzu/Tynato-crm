'use client'

import Sidebar from '../components/Sidebar'

export default function SettingsPage() {

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