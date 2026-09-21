'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  getMyModuleAccess,
  type ModuleAccess,
} from '@/app/lib/api'

interface ModuleAccessContextValue {
  modules: ModuleAccess[]
  loading: boolean
  error: string
  isEnabled: (moduleKey: string) => boolean
  refresh: () => Promise<void>
}

const ModuleAccessContext =
  createContext<ModuleAccessContextValue | null>(
    null,
  )

const CACHE_KEY = 'tynato_module_access'
const CACHE_TIME_KEY =
  'tynato_module_access_time'

const CACHE_TTL = 60_000

function readCachedModules(): ModuleAccess[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const cached =
      sessionStorage.getItem(CACHE_KEY)

    const timestamp =
      sessionStorage.getItem(CACHE_TIME_KEY)

    if (!cached || !timestamp) {
      return []
    }

    const cacheAge =
      Date.now() - Number(timestamp)

    if (cacheAge >= CACHE_TTL) {
      return []
    }

    const parsed = JSON.parse(cached)

    return Array.isArray(parsed)
      ? parsed
      : []
  } catch {
    return []
  }
}

function saveCachedModules(
  modules: ModuleAccess[],
) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify(modules),
    )

    sessionStorage.setItem(
      CACHE_TIME_KEY,
      String(Date.now()),
    )
  } catch {
    // Ignore browser storage failures.
  }
}

export function ModuleAccessProvider({
  children,
}: {
  children: React.ReactNode
}) {
  /*
   * IMPORTANT:
   *
   * Do NOT initialize state from sessionStorage.
   *
   * Server and first client render must be identical.
   */
  const [modules, setModules] =
    useState<ModuleAccess[]>([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const requestInFlight =
    useRef(false)

  const refresh = useCallback(
    async () => {
      if (requestInFlight.current) {
        return
      }

      requestInFlight.current = true

      try {
        setError('')

        const data =
          await getMyModuleAccess()

        setModules(data)

        saveCachedModules(data)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load module access',
        )
      } finally {
        requestInFlight.current = false
        setLoading(false)
      }
    },
    [],
  )

  /*
   * Runs only after hydration.
   *
   * First try the browser cache.
   * Then refresh from API if the cache
   * is missing or expired.
   */
  useEffect(() => {
    const cached =
      readCachedModules()

    if (cached.length > 0) {
      setModules(cached)

      setLoading(false)

      const timestamp =
        sessionStorage.getItem(
          CACHE_TIME_KEY,
        )

      const cacheAge = timestamp
        ? Date.now() - Number(timestamp)
        : Number.MAX_SAFE_INTEGER

      if (cacheAge < CACHE_TTL) {
        return
      }
    }

    refresh()
  }, [refresh])

  /*
   * Revalidate when the user returns to the tab.
   * This keeps entitlement changes reasonably fresh
   * without polling every few seconds.
   */
  useEffect(() => {
    async function handleFocus() {
      const timestamp =
        sessionStorage.getItem(
          CACHE_TIME_KEY,
        )

      if (!timestamp) {
        await refresh()
        return
      }

      const age =
        Date.now() - Number(timestamp)

      if (age >= CACHE_TTL) {
        await refresh()
      }
    }

    window.addEventListener(
      'focus',
      handleFocus,
    )

    return () => {
      window.removeEventListener(
        'focus',
        handleFocus,
      )
    }
  }, [refresh])

  /*
   * SECURITY / UX NOTE:
   *
   * During the initial render we return true so
   * that SSR and the first client render remain
   * identical.
   *
   * The backend is still the authoritative
   * access-control layer.
   */
  const isEnabled = useCallback(
    (moduleKey: string) => {
      if (loading) {
        return true
      }

      const module = modules.find(
        (item) =>
          item.module_key === moduleKey,
      )

      /*
       * If the module isn't returned, don't
       * create a hydration-changing render.
       *
       * Backend protection remains authoritative.
       */
      if (!module) {
        return true
      }

      return module.effective_enabled
    },
    [modules, loading],
  )

  const value = useMemo(
    () => ({
      modules,
      loading,
      error,
      isEnabled,
      refresh,
    }),
    [
      modules,
      loading,
      error,
      isEnabled,
      refresh,
    ],
  )

  return (
    <ModuleAccessContext.Provider
      value={value}
    >
      {children}
    </ModuleAccessContext.Provider>
  )
}

export function useModuleAccess() {
  const context =
    useContext(ModuleAccessContext)

  if (!context) {
    throw new Error(
      'useModuleAccess must be used inside ModuleAccessProvider',
    )
  }

  return context
}