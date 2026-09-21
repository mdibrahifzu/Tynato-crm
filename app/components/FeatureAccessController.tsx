'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { supabase } from '@/app/lib/supabase'

import {
  getMyModuleAccess,
  type ModuleAccess,
} from '@/app/lib/api'

import {
  getModuleForPath,
  getModuleState,
  type ModuleRoute,
} from '@/app/lib/module-routes'

import Sidebar from './Sidebar'

const CACHE_TTL = 60_000

/*
 * In-memory module cache.
 *
 * IMPORTANT:
 * Cache is associated with a specific authenticated
 * Supabase user so one user's module access is never
 * reused for another user.
 */
let memoryModules: ModuleAccess[] | null = null
let memoryCachedAt = 0
let memoryUserId: string | null = null

const SESSION_CACHE_PREFIX = 'tynato_module_access'

function getSessionCacheKey(
  userId: string,
): string {
  return `${SESSION_CACHE_PREFIX}:${userId}`
}

function readSessionCache(
  userId: string,
): ModuleAccess[] | null {
  try {
    const raw = sessionStorage.getItem(
      getSessionCacheKey(userId),
    )

    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw)

    if (
      !parsed ||
      !Array.isArray(parsed.modules) ||
      typeof parsed.cachedAt !== 'number'
    ) {
      sessionStorage.removeItem(
        getSessionCacheKey(userId),
      )

      return null
    }

    if (
      Date.now() - parsed.cachedAt >=
      CACHE_TTL
    ) {
      sessionStorage.removeItem(
        getSessionCacheKey(userId),
      )

      return null
    }

    return parsed.modules
  } catch {
    try {
      sessionStorage.removeItem(
        getSessionCacheKey(userId),
      )
    } catch {
      // Ignore storage failures.
    }

    return null
  }
}

function saveSessionCache(
  userId: string,
  modules: ModuleAccess[],
) {
  try {
    sessionStorage.setItem(
      getSessionCacheKey(userId),
      JSON.stringify({
        modules,
        cachedAt: Date.now(),
      }),
    )
  } catch {
    // Ignore storage failures.
  }
}

function clearSessionCache(
  userId?: string | null,
) {
  try {
    if (userId) {
      sessionStorage.removeItem(
        getSessionCacheKey(userId),
      )
      return
    }

    /*
     * Fallback cleanup for the old non-user-specific key
     * from previous versions.
     */
    sessionStorage.removeItem(
      'tynato_module_access',
    )
  } catch {
    // Ignore storage failures.
  }
}

/*
 * Reset all in-memory module cache state.
 */
function clearMemoryCache() {
  memoryModules = null
  memoryCachedAt = 0
  memoryUserId = null
}

/*
 * LOCKED CONTENT
 *
 * Sidebar is rendered separately.
 * This component ONLY renders the locked content area.
 */
function LockedFeatureContent({
  feature,
  onClose,
}: {
  feature: ModuleRoute
  onClose: () => void
}) {
  return (
    <main
      className="
        flex
        min-h-screen
        flex-1
        items-center
        justify-center
        overflow-auto
        bg-[#07101f]
        px-8
        py-10
        max-lg:px-5
      "
    >
      <div className="w-full max-w-2xl">
        <div
          className="
            w-full
            rounded-2xl
            border
            border-white/10
            bg-[#0b1526]
            px-8
            py-10
            text-center
            shadow-[0_25px_80px_rgba(0,0,0,0.55)]
            lg:px-12
            lg:py-12
          "
        >
          {/* Lock icon */}
          <div
            className="
              mx-auto
              mb-6
              flex
              h-16
              w-16
              items-center
              justify-center
              rounded-full
              bg-yellow-500/10
              text-3xl
            "
          >
            🔒
          </div>

          {/* Badge */}
          <div
            className="
              mx-auto
              mb-5
              inline-flex
              rounded-full
              border
              border-yellow-500/40
              bg-yellow-500/10
              px-4
              py-1.5
              text-xs
              font-semibold
              uppercase
              tracking-[0.18em]
              text-yellow-400
            "
          >
            Feature Restricted
          </div>

          {/* Feature title */}
          <h1 className="text-3xl font-semibold text-white">
            {feature.featureName} is unavailable
          </h1>

          {/* Message */}
          <p className="mt-4 text-base leading-7 text-slate-400">
            This feature is currently not available for your account.
          </p>

          <p className="mt-2 text-sm text-slate-400">
            Contact{' '}
            <span className="font-semibold text-blue-400">
              Tynato Support
            </span>{' '}
            for access or more details.
          </p>

          {/* Back */}
          <button
            type="button"
            onClick={onClose}
            className="
              mt-8
              w-full
              rounded-xl
              bg-blue-600
              px-6
              py-3.5
              text-sm
              font-semibold
              text-white
              shadow-lg
              shadow-blue-600/20
              transition
              hover:bg-blue-500
            "
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </main>
  )
}

/*
 * LOCKED PAGE SHELL
 *
 * Sidebar stays fully functional.
 * Only the feature content is replaced.
 */
function LockedFeaturePage({
  feature,
  onClose,
}: {
  feature: ModuleRoute
  onClose: () => void
}) {
  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />

      <LockedFeatureContent
        feature={feature}
        onClose={onClose}
      />
    </div>
  )
}

export default function FeatureAccessController({
  children,
}: {
  children: ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  const currentFeature =
    getModuleForPath(pathname)

  /*
   * Authentication readiness.
   *
   * false:
   * Supabase is still restoring/checking the session.
   *
   * true:
   * We know whether the user is authenticated.
   */
  const [authReady, setAuthReady] =
    useState(false)

  /*
   * Store only the authenticated user's ID.
   *
   * We use this to:
   * - prevent module API calls before authentication
   * - isolate module cache per user
   * - clear access state when authentication changes
   */
  const [sessionUserId, setSessionUserId] =
    useState<string | null>(null)

  const [modules, setModules] =
    useState<ModuleAccess[] | null>(null)

  const [checking, setChecking] =
    useState(false)

  const requestInFlight =
    useRef(false)

  /*
   * --------------------------------------------------------
   * AUTHENTICATION INITIALIZATION
   * --------------------------------------------------------
   *
   * Register the listener first, then read the current
   * session. This prevents missing an auth event during
   * application startup.
   */
  useEffect(() => {
    let mounted = true

    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        (event, session) => {
          if (!mounted) {
            return
          }

          const nextUserId =
            session?.user?.id ?? null

          /*
           * When the user signs out, clear everything.
           */
          if (event === 'SIGNED_OUT') {
            clearMemoryCache()
            clearSessionCache(
              sessionUserId,
            )

            setModules(null)
            setSessionUserId(null)
            setChecking(false)
            setAuthReady(true)

            return
          }

          /*
           * When a new user signs in, do not reuse
           * the previous user's module state.
           */
          if (event === 'SIGNED_IN') {
            clearMemoryCache()

            if (
              sessionUserId &&
              sessionUserId !== nextUserId
            ) {
              clearSessionCache(
                sessionUserId,
              )
            }

            setModules(null)
          }

          setSessionUserId(
            nextUserId,
          )

          setAuthReady(true)
        },
      )

    async function initializeAuth() {
      try {
        const {
          data: { session },
          error,
        } =
          await supabase.auth.getSession()

        if (!mounted) {
          return
        }

        if (error) {
          console.error(
            'Failed to restore Supabase session:',
            error,
          )
        }

        setSessionUserId(
          session?.user?.id ?? null,
        )

        setAuthReady(true)
      } catch (error) {
        if (!mounted) {
          return
        }

        console.error(
          'Failed to initialize authentication:',
          error,
        )

        setSessionUserId(null)
        setAuthReady(true)
      }
    }

    void initializeAuth()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [sessionUserId])

  /*
   * --------------------------------------------------------
   * MODULE ACCESS
   * --------------------------------------------------------
   */
  const refreshAccess = useCallback(
    async (force = false) => {
      /*
       * NEVER call the protected module-access endpoint
       * without an authenticated user.
       */
      if (!authReady || !sessionUserId) {
        setChecking(false)
        return
      }

      /*
       * Prevent duplicate simultaneous requests.
       */
      if (requestInFlight.current) {
        return
      }

      const now = Date.now()

      /*
       * ----------------------------------------------------
       * MEMORY CACHE
       * ----------------------------------------------------
       *
       * Only use the memory cache when it belongs to the
       * currently authenticated user.
       */
      if (
        !force &&
        memoryUserId === sessionUserId &&
        memoryModules &&
        now - memoryCachedAt < CACHE_TTL
      ) {
        setModules(memoryModules)
        return
      }

      /*
       * ----------------------------------------------------
       * SESSION CACHE
       * ----------------------------------------------------
       */
      const cached =
        readSessionCache(
          sessionUserId,
        )

      if (!force && cached) {
        memoryModules = cached
        memoryCachedAt = Date.now()
        memoryUserId = sessionUserId

        setModules(cached)

        return
      }

      requestInFlight.current = true
      setChecking(true)

      try {
        const data =
          await getMyModuleAccess()

        /*
         * Store cache only for the authenticated user
         * whose request actually completed.
         */
        memoryModules = data
        memoryCachedAt = Date.now()
        memoryUserId =
          sessionUserId

        saveSessionCache(
          sessionUserId,
          data,
        )

        setModules(data)
      } catch (error) {
        console.error(
          'Module access check failed:',
          error,
        )

        /*
         * Preserve previous known state only when the
         * cached state belongs to this same user.
         *
         * Never use another user's module state.
         */
        if (
          memoryUserId === sessionUserId &&
          memoryModules
        ) {
          setModules(
            memoryModules,
          )
        } else {
          setModules([])
        }
      } finally {
        requestInFlight.current = false
        setChecking(false)
      }
    },
    [
      authReady,
      sessionUserId,
    ],
  )

  /*
   * --------------------------------------------------------
   * CHECK ACCESS ON FEATURE ROUTES
   * --------------------------------------------------------
   *
   * This is where the previous race condition happened.
   *
   * We now wait for authReady before calling
   * getMyModuleAccess().
   */
  useEffect(() => {
    /*
     * Supabase authentication is not ready yet.
     */
    if (!authReady) {
      return
    }

    /*
     * Login, root, dashboard, users, settings,
     * super-admin, etc. remain untouched unless
     * explicitly registered in module-routes.ts.
     */
    if (!currentFeature) {
      setChecking(false)
      return
    }

    /*
     * Feature route but there is no authenticated user.
     *
     * Do NOT call the protected API.
     */
    if (!sessionUserId) {
      setChecking(false)
      setModules(null)
      return
    }

    void refreshAccess()
  }, [
    authReady,
    sessionUserId,
    pathname,
    currentFeature,
    refreshAccess,
  ])

  /*
   * --------------------------------------------------------
   * REVALIDATE WHEN RETURNING TO THE TAB
   * --------------------------------------------------------
   *
   * No continuous polling.
   */
  useEffect(() => {
    /*
     * Do not attach focus handling until authentication
     * is known and a user is authenticated.
     */
    if (
      !authReady ||
      !sessionUserId ||
      !currentFeature
    ) {
      return
    }

    function handleFocus() {
      /*
       * Only refresh when the current user's cache
       * has expired.
       */
      if (
        memoryUserId !== sessionUserId ||
        Date.now() - memoryCachedAt >=
          CACHE_TTL
      ) {
        void refreshAccess()
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
  }, [
    authReady,
    sessionUserId,
    currentFeature,
    refreshAccess,
  ])

  /*
   * --------------------------------------------------------
   * NON-FEATURE ROUTES
   * --------------------------------------------------------
   *
   * Login/root/dashboard/etc. are returned exactly
   * as they were.
   */
  if (!currentFeature) {
    return <>{children}</>
  }

  /*
   * --------------------------------------------------------
   * WAIT FOR AUTHENTICATION / ACCESS
   * --------------------------------------------------------
   *
   * Keep the actual page alive while access is being
   * resolved so the existing sidebar remains visible.
   */
  if (
    !authReady ||
    modules === null ||
    checking
  ) {
    return <>{children}</>
  }

  /*
   * --------------------------------------------------------
   * MODULE STATE
   * --------------------------------------------------------
   */
  const module = getModuleState(
    modules,
    currentFeature.moduleKey,
  )

  /*
   * No entitlement record:
   * default to enabled for backwards compatibility.
   */
  const enabled = module
    ? module.effective_enabled
    : true

  /*
   * --------------------------------------------------------
   * ENABLED
   * --------------------------------------------------------
   *
   * Render the existing page exactly as before.
   * The existing page owns its Sidebar.
   */
  if (enabled) {
    return <>{children}</>
  }

  /*
   * --------------------------------------------------------
   * DISABLED
   * --------------------------------------------------------
   *
   * Do NOT render the actual feature page.
   *
   * Render:
   * Sidebar
   * +
   * Locked feature content
   */
  return (
    <LockedFeaturePage
      feature={currentFeature}
      onClose={() => {
        clearSessionCache(
          sessionUserId,
        )

        clearMemoryCache()

        setModules(null)

        router.replace(
          '/dashboard',
        )
      }}
    />
  )
}