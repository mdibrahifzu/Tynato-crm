'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  getMyModuleAccess,
  type ModuleAccess,
} from '@/app/lib/api'

interface FeatureGateProps {
  moduleKey: string
  featureName: string
  children: React.ReactNode
}

export default function FeatureGate({
  moduleKey,
  featureName,
  children,
}: FeatureGateProps) {
  const router = useRouter()

  const [status, setStatus] = useState<
    'checking' | 'allowed' | 'locked'
  >('checking')

  useEffect(() => {
    let cancelled = false

    async function checkAccess() {
      try {
        /*
         * IMPORTANT:
         * Check the server when this page is entered.
         * Do not trust stale Sidebar/session state.
         */
        const modules =
          await getMyModuleAccess()

        const module = modules.find(
          (item) =>
            item.module_key === moduleKey,
        )

        if (cancelled) {
          return
        }

        if (!module) {
          /*
           * Unknown module = fail closed.
           * Do not allow access when the entitlement
           * cannot be verified.
           */
          setStatus('locked')
          return
        }

        setStatus(
          module.effective_enabled
            ? 'allowed'
            : 'locked',
        )
      } catch (error) {
        console.error(
          `Module access check failed for ${moduleKey}:`,
          error,
        )

        if (!cancelled) {
          /*
           * Fail closed.
           */
          setStatus('locked')
        }
      }
    }

    checkAccess()

    return () => {
      cancelled = true
    }
  }, [moduleKey])

  /*
   * SECURITY/UI loading state
   */
  if (status === 'checking') {
    return (
      <div className="flex min-h-screen">
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div
              className="
                mx-auto h-10 w-10
                animate-spin
                rounded-full
                border-2
                border-white/10
                border-t-blue-500
              "
            />

            <p className="mt-4 text-sm text-slate-500">
              Checking feature access...
            </p>
          </div>
        </div>
      </div>
    )
  }

  /*
   * LOCKED PAGE
   */
  if (status === 'locked') {
    return (
      <div className="flex min-h-screen">
        <div className="flex flex-1 items-center justify-center px-5 py-12">
          <div
            className="
              w-full max-w-lg
              rounded-3xl
              border border-white/10
              bg-[#0d1525]
              p-8
              text-center
              shadow-2xl shadow-black/20
            "
          >
            <div
              className="
                mx-auto flex h-16 w-16
                items-center justify-center
                rounded-2xl
                bg-amber-500/10
                text-3xl
              "
            >
              🔒
            </div>

            <div className="mt-5">
              <span
                className="
                  inline-flex rounded-full
                  border border-amber-400/10
                  bg-amber-400/10
                  px-3 py-1
                  text-[11px]
                  font-semibold
                  uppercase
                  tracking-[0.18em]
                  text-amber-300
                "
              >
                Feature Restricted
              </span>
            </div>

            <h1
              className="
                mt-5
                text-2xl
                font-semibold
                tracking-tight
                text-white
              "
            >
              {featureName} is unavailable
            </h1>

            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">
              This feature is currently not
              available for your account.
            </p>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Contact{' '}
              <span className="font-semibold text-blue-300">
                Tynato Support
              </span>{' '}
              for access or more details.
            </p>

            <button
              type="button"
              onClick={() =>
                router.replace('/dashboard')
              }
              className="
                mt-7 w-full rounded-xl
                bg-blue-600
                px-5 py-3.5
                text-sm font-semibold
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
      </div>
    )
  }

  /*
   * FEATURE ENABLED
   */
  return <>{children}</>
}