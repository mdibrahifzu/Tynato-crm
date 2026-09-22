'use client'

import { useEffect } from 'react'

export default function ThemeProvider() {
  useEffect(() => {
    const savedTheme =
      localStorage.getItem('theme') || 'midnight'

    const allowedThemes = [
      'midnight',
      'cloud',
      'violet',
    ]

    const theme = allowedThemes.includes(savedTheme)
      ? savedTheme
      : 'midnight'

    document.documentElement.setAttribute(
      'data-theme',
      theme
    )
  }, [])

  return null
}