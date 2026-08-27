import { supabase } from './supabase'

export async function apiFetch(
  path: string,
  options: RequestInit = {}
) {
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    console.error('Failed to get session:', error)
  }

  const token = data.session?.access_token

  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      ...(token
        ? { Authorization: `Bearer ${token}` }
        : {}),
    },
  })

  if (res.status === 401) {
    window.location.href = '/login'
  }

  return res
}