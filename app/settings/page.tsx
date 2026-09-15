'use client'

import Sidebar from '../components/Sidebar'
import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import { apiFetch } from '@/app/lib/api'

type BusinessSettings = {
  id: string | null
  owner_id: string
  team_id: string | null
  business_name: string
  business_address: string
  business_phone: string
  business_email: string
  terms_and_conditions: string
  logo_url: string | null
  workspace_type: 'personal' | 'team'
  can_edit: boolean
  team_name: string | null
  updated_at: string | null
}

const inputClass =
  'w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/10 disabled:cursor-not-allowed disabled:opacity-60'

export default function SettingsPage() {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')

  const [business, setBusiness] = useState<BusinessSettings | null>(null)
  const [businessName, setBusinessName] = useState('')
  const [businessAddress, setBusinessAddress] = useState('')
  const [businessPhone, setBusinessPhone] = useState('')
  const [businessEmail, setBusinessEmail] = useState('')
  const [termsAndConditions, setTermsAndConditions] = useState('')
  const [loadingBusiness, setLoadingBusiness] = useState(true)
  const [savingBusiness, setSavingBusiness] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [businessError, setBusinessError] = useState('')
  const [businessSuccess, setBusinessSuccess] = useState('')

  useEffect(() => {
    let mounted = true

    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!mounted || !user) return

      setEmail(user.email || '')

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      if (mounted) setFullName(profile?.full_name || '')
    }

    loadProfile()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true

    async function loadBusinessSettings() {
      setLoadingBusiness(true)
      setBusinessError('')

      try {
        const response = await apiFetch('/business-settings')
        const data = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(
            data?.detail || 'Unable to load business settings.'
          )
        }

        if (!mounted) return

        setBusiness(data)
        setBusinessName(data?.business_name || '')
        setBusinessAddress(data?.business_address || '')
        setBusinessPhone(data?.business_phone || '')
        setBusinessEmail(data?.business_email || '')
        setTermsAndConditions(data?.terms_and_conditions || '')
      } catch (error) {
        if (!mounted) return

        setBusinessError(
          error instanceof Error
            ? error.message
            : 'Unable to load business settings.'
        )
      } finally {
        if (mounted) setLoadingBusiness(false)
      }
    }

    loadBusinessSettings()

    return () => {
      mounted = false
    }
  }, [])

  function setTheme(theme: string) {
    localStorage.setItem('theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
  }

  async function saveBusinessSettings() {
    if (!business?.can_edit || savingBusiness) return

    setBusinessError('')
    setBusinessSuccess('')
    setSavingBusiness(true)

    try {
      const response = await apiFetch('/business-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: businessName.trim(),
          business_address: businessAddress.trim(),
          business_phone: businessPhone.trim(),
          business_email: businessEmail.trim(),
          terms_and_conditions: termsAndConditions.trim(),
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          data?.detail || 'Unable to save business settings.'
        )
      }

      setBusiness(data)
      setBusinessName(data?.business_name || '')
      setBusinessAddress(data?.business_address || '')
      setBusinessPhone(data?.business_phone || '')
      setBusinessEmail(data?.business_email || '')
      setTermsAndConditions(data?.terms_and_conditions || '')
      setBusinessSuccess('Business details saved successfully.')
    } catch (error) {
      setBusinessError(
        error instanceof Error
          ? error.message
          : 'Unable to save business settings.'
      )
    } finally {
      setSavingBusiness(false)
    }
  }

  async function uploadLogo(file: File) {
    if (!business?.can_edit || uploadingLogo) return

    setBusinessError('')
    setBusinessSuccess('')

    if (file.size > 2 * 1024 * 1024) {
      setBusinessError('Logo must be 2 MB or smaller.')
      return
    }

    const allowed = ['image/png', 'image/jpeg', 'image/webp']
    if (!allowed.includes(file.type)) {
      setBusinessError('Please choose a PNG, JPG, or WEBP image.')
      return
    }

    setUploadingLogo(true)

    try {
      const form = new FormData()
      form.append('file', file)

      const response = await apiFetch('/business-settings/logo', {
        method: 'POST',
        body: form,
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.detail || 'Logo upload failed.')
      }

      setBusiness((current) =>
        current
          ? { ...current, logo_url: data?.logo_url || null }
          : current
      )
      setBusinessSuccess('Business logo updated successfully.')
    } catch (error) {
      setBusinessError(
        error instanceof Error ? error.message : 'Logo upload failed.'
      )
    } finally {
      setUploadingLogo(false)
    }
  }

  async function removeLogo() {
    if (!business?.can_edit || uploadingLogo || !business.logo_url) return

    setBusinessError('')
    setBusinessSuccess('')
    setUploadingLogo(true)

    try {
      const response = await apiFetch('/business-settings/logo', {
        method: 'DELETE',
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.detail || 'Unable to remove logo.')
      }

      setBusiness((current) =>
        current ? { ...current, logo_url: null } : current
      )
      setBusinessSuccess('Business logo removed.')
    } catch (error) {
      setBusinessError(
        error instanceof Error ? error.message : 'Unable to remove logo.'
      )
    } finally {
      setUploadingLogo(false)
    }
  }

  const isReadOnlyTeamMember =
    business?.workspace_type === 'team' && !business.can_edit

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="min-w-0 flex-1 p-5 sm:p-7 lg:p-10">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-blue-400">
              Account
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Settings
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">
              Manage your account preferences and the permanent business details used for new invoices.
            </p>
          </div>

          <section className="mb-6 rounded-2xl bg-[var(--bg-card)] p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Account</h2>
                <p className="mt-1 text-sm text-white/40">
                  Your login account information.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-white/35">
                  Login Email
                </div>
                <div className="mt-1 break-all text-sm font-medium text-white">
                  {email || 'Not available'}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-white/35">
                  Name
                </div>
                <div className="mt-1 text-sm font-medium text-white">
                  {fullName || 'Not set'}
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs text-white/35">
              Login email changes are handled separately from your invoice business email.
            </p>
          </section>

          <section className="rounded-2xl bg-[var(--bg-card)] p-5 sm:p-6">
            <div className="flex flex-col gap-4 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-400/80">
                  Invoice Profile
                </p>
                <h2 className="mt-2 text-xl font-semibold">Your Business</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-white/45">
                  These details are saved for your workspace and automatically used for future invoices.
                </p>
              </div>

              {business?.workspace_type === 'team' && (
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/55">
                  <span className="text-white/30">Team:</span>{' '}
                  {business.team_name || 'Current team'}
                  {!business.can_edit && (
                    <span className="ml-2 text-amber-300/80">View only</span>
                  )}
                </div>
              )}

              {business?.workspace_type === 'personal' && (
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/40">
                  Personal workspace
                </div>
              )}
            </div>

            {businessError && (
              <div className="mt-5 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {businessError}
              </div>
            )}

            {businessSuccess && (
              <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {businessSuccess}
              </div>
            )}

            {loadingBusiness ? (
              <div className="mt-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="h-12 animate-pulse rounded-xl bg-white/[0.04]" />
                  <div className="h-12 animate-pulse rounded-xl bg-white/[0.04]" />
                </div>
                <div className="h-28 animate-pulse rounded-xl bg-white/[0.04]" />
              </div>
            ) : (
              <>
                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm text-white/65">
                      Business Name
                    </label>
                    <input
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      disabled={!business?.can_edit || savingBusiness}
                      maxLength={200}
                      placeholder="Your company or business name"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-white/65">
                      Business Phone
                    </label>
                    <input
                      value={businessPhone}
                      onChange={(e) => setBusinessPhone(e.target.value)}
                      disabled={!business?.can_edit || savingBusiness}
                      maxLength={50}
                      placeholder="Business phone number"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-white/65">
                      Business Email
                    </label>
                    <input
                      type="email"
                      value={businessEmail}
                      onChange={(e) => setBusinessEmail(e.target.value)}
                      disabled={!business?.can_edit || savingBusiness}
                      maxLength={320}
                      placeholder="billing@yourcompany.com"
                      className={inputClass}
                    />
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/10 px-4 py-3">
                    <div className="text-xs uppercase tracking-wide text-white/35">
                      Used for
                    </div>
                    <div className="mt-1 text-sm text-white/70">
                      New invoices only
                    </div>
                    <div className="mt-1 text-xs leading-5 text-white/35">
                      Existing invoices keep the business information that was saved when they were generated.
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <label className="mb-2 block text-sm text-white/65">
                    Business Address
                  </label>
                  <textarea
                    rows={4}
                    value={businessAddress}
                    onChange={(e) => setBusinessAddress(e.target.value)}
                    disabled={!business?.can_edit || savingBusiness}
                    maxLength={1000}
                    placeholder="Business address"
                    className={`${inputClass} resize-y`}
                  />
                </div>
                <div className="mt-5">
                    <label className="mb-2 block text-sm text-white/65">
                      Invoice Terms & Conditions
                    </label>

                    <textarea
                      rows={7}
                      value={termsAndConditions}
                      onChange={(e) => setTermsAndConditions(e.target.value)}
                      disabled={!business?.can_edit || savingBusiness}
                      maxLength={5000}
                      placeholder="Example: Payment is due within 30 days. All services are subject to the agreed terms and conditions."
                      className={`${inputClass} resize-y`}
                    />

                    <p className="mt-2 text-xs leading-5 text-white/35">
                      These terms are automatically included in new invoices. Existing invoices keep the terms that were saved when they were generated.
                    </p>
                  </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 p-4 sm:p-5">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                      {business?.logo_url ? (
                        <img
                          src={business.logo_url}
                          alt="Business logo"
                          className="h-full w-full object-contain bg-white p-2"
                        />
                      ) : (
                        <div className="text-center text-xs leading-5 text-white/30">
                          No logo
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold">Business Logo</h3>
                      <p className="mt-1 text-xs leading-5 text-white/40">
                        Add the logo that should appear on new invoices. PNG, JPG, or WEBP up to 2 MB.
                      </p>

                      {business?.can_edit && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <label className="inline-flex cursor-pointer items-center rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium transition hover:bg-white/5 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
                            {uploadingLogo ? 'Uploading…' : 'Choose Logo'}
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="sr-only"
                              disabled={uploadingLogo}
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) uploadLogo(file)
                                e.currentTarget.value = ''
                              }}
                            />
                          </label>

                          {business.logo_url && (
                            <button
                              type="button"
                              onClick={removeLogo}
                              disabled={uploadingLogo}
                              className="rounded-lg border border-rose-400/20 px-4 py-2.5 text-sm font-medium text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-50"
                            >
                              Remove Logo
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 border-t border-white/[0.06] pt-6 sm:flex-row sm:items-center sm:justify-between">
                  {isReadOnlyTeamMember ? (
                    <p className="text-xs leading-5 text-amber-300/70">
                      You can view this team's business information, but only the team owner can edit it.
                    </p>
                  ) : (
                    <p className="text-xs leading-5 text-white/35">
                      Changes here affect the default business information used for future invoices.
                    </p>
                  )}

                  {business?.can_edit && (
                    <button
                      type="button"
                      onClick={saveBusinessSettings}
                      disabled={savingBusiness || uploadingLogo}
                      className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingBusiness ? 'Saving…' : 'Save Business Details'}
                    </button>
                  )}
                </div>
              </>
            )}
          </section>

          <section className="mt-6 rounded-2xl bg-[var(--bg-card)] p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Appearance</h2>
            <p className="mt-1 text-sm text-white/40">
              Choose how Tynato CRM looks on this device.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setTheme('midnight')}
                className="crm-card w-full px-4 py-4 text-left transition hover:-translate-y-0.5"
              >
                <div className="text-base font-semibold">🌙 Midnight</div>
                <div className="mt-1 text-xs text-white/35">Dark interface</div>
              </button>

              <button
                type="button"
                onClick={() => setTheme('cloud')}
                className="crm-card w-full px-4 py-4 text-left transition hover:-translate-y-0.5"
              >
                <div className="text-base font-semibold">☁ Cloud</div>
                <div className="mt-1 text-xs text-white/35">Light interface</div>
              </button>

              <button
                type="button"
                onClick={() => setTheme('violet')}
                className="crm-card w-full px-4 py-4 text-left transition hover:-translate-y-0.5"
              >
                <div className="text-base font-semibold">🟣 Violet</div>
                <div className="mt-1 text-xs text-white/35">Violet accent</div>
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
