'use client'

import { useEffect } from 'react'

export default function ThemeProvider() {

  useEffect(() => {

    const savedTheme =
      localStorage.getItem('theme') ||
      'midnight'

    document.documentElement.setAttribute(
      'data-theme',
      savedTheme
    )

  }, [])

  return null
}