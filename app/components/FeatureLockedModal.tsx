'use client'

import {
  useEffect,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

interface FeatureLockedModalProps {
  open: boolean
  featureName: string
  onClose: () => void
}

export default function FeatureLockedModal({
  open,
  featureName,
  onClose,
}: FeatureLockedModalProps) {
  const [mounted, setMounted] =
    useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }

    function handleEscape(
      event: KeyboardEvent,
    ) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener(
      'keydown',
      handleEscape,
    )

    const previousOverflow =
      document.body.style.overflow

    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener(
        'keydown',
        handleEscape,
      )

      document.body.style.overflow =
        previousOverflow
    }
  }, [open, onClose])

  if (!mounted || !open) {
    return null
  }

  return createPortal(
    <div
      className="
        fixed inset-0 z-[99999]
        flex items-center justify-center
        bg-slate-950/75
        p-4
        backdrop-blur-md
      "
      role="dialog"
      aria-modal="true"
      aria-labelledby="feature-lock-title"
      aria-describedby="feature-lock-description"
      onMouseDown={onClose}
    >
      <div
        className="
          relative w-full max-w-md
          overflow-hidden
          rounded-3xl
          border border-white/10
          bg-[#0b1324]
          shadow-[0_25px_80px_rgba(0,0,0,0.55)]
          animate-in
          fade-in
          zoom-in-95
          duration-200
        "
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        {/* Top glow */}
        <div
          className="
            pointer-events-none
            absolute -top-24 left-1/2
            h-48 w-48
            -translate-x-1/2
            rounded-full
            bg-amber-400/10
            blur-3xl
          "
        />

        <div className="relative p-7 sm:p-8">
          {/* Icon */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/10 bg-amber-400/10">
            <span className="text-3xl">
              🔒
            </span>
          </div>

          {/* Label */}
          <div className="mt-5 flex justify-center">
            <span className="rounded-full border border-amber-400/10 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
              Feature Restricted
            </span>
          </div>

          {/* Title */}
          <h2
            id="feature-lock-title"
            className="mt-4 text-center text-2xl font-semibold tracking-tight text-white"
          >
            {featureName} is unavailable
          </h2>

          {/* Description */}
          <p
            id="feature-lock-description"
            className="mx-auto mt-3 max-w-sm text-center text-sm leading-6 text-slate-400"
          >
            This feature is not currently available
            for your account.
          </p>

          <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-6 text-slate-500">
            Contact{' '}
            <span className="font-semibold text-blue-300">
              Tynato Support
            </span>{' '}
            for access or more details.
          </p>

          {/* Action */}
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="
              mt-7 w-full
              rounded-xl
              bg-blue-600
              px-5 py-3.5
              text-sm font-semibold
              text-white
              shadow-lg
              shadow-blue-600/20
              transition-all
              duration-200
              hover:bg-blue-500
              hover:shadow-blue-500/25
              focus:outline-none
              focus:ring-2
              focus:ring-blue-400/50
              active:scale-[0.99]
            "
          >
            Back to Dashboard
          </button>

          {/* Secondary hint */}
          <p className="mt-3 text-center text-xs text-slate-600">
            Press Esc to close
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}