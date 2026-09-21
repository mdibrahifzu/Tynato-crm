'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Sidebar from '@/app/components/Sidebar'
import { apiFetch } from '@/app/lib/api'

type Lead = {
  id: string
  full_name?: string | null
  phone_number?: string | null
  email?: string | null
  project_location?: string | null
  team_id?: string | null
}

type InvoiceItem = {
  name: string
  quantity: string
  unit_cost: string
}

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function dueDateDefault() {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

export default function InvoicesPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loadingLeads, setLoadingLeads] = useState(true)
  const [customerMode, setCustomerMode] = useState<'lead' | 'custom'>('lead')
  const [selectedLeadId, setSelectedLeadId] = useState('')

  const [customerName, setCustomerName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [billingAddress, setBillingAddress] = useState('')

  const [businessName, setBusinessName] = useState('Tynato CRM')
  const [businessAddress, setBusinessAddress] = useState('Chennai, India')
  const [businessPhone, setBusinessPhone] = useState('')
  const [businessEmail, setBusinessEmail] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [businessSettingsLoading, setBusinessSettingsLoading] = useState(true)

  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(today())
  const [dueDate, setDueDate] = useState(dueDateDefault())
  const [currency, setCurrency] = useState('INR')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [purchaseOrder, setPurchaseOrder] = useState('')

  const [taxTitle, setTaxTitle] = useState('GST')
 const [taxPercent, setTaxPercent] = useState('')
  const [notes, setNotes] = useState('')
  const [terms, setTerms] = useState('')

const [items, setItems] = useState<InvoiceItem[]>([
  { name: '', quantity: '', unit_cost: '' },
])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

useEffect(() => {
  const loadLeads = async () => {
    try {
      const response = await apiFetch('/custom-leads')
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          data?.detail || `Failed to load leads: ${response.status}`
        )
      }

      const customLeads: Lead[] = Array.isArray(data)
  ? data
  : Array.isArray(data?.items)
    ? data.items
    : []

const seen = new Set<string>()

const uniqueLeads: Lead[] = customLeads.filter((lead) => {
  const key = lead.id

  if (seen.has(key)) {
    return false
  }

  seen.add(key)
  return true
})

setLeads(uniqueLeads)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load leads.'
      )
    } finally {
      setLoadingLeads(false)
    }
  }

  loadLeads()
}, [])
  useEffect(() => {
    const loadBusinessSettings = async () => {
      try {
        setBusinessSettingsLoading(true)

        const response = await apiFetch('/business-settings')
        const data = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(data?.detail || 'Failed to load business settings.')
        }

        setBusinessName(data?.business_name || '')
        setBusinessAddress(data?.business_address || '')
        setBusinessPhone(data?.business_phone || '')
        setBusinessEmail(data?.business_email || '')
        setLogoUrl(data?.logo_url || '')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load business settings.')
      } finally {
        setBusinessSettingsLoading(false)
      }
    }

    loadBusinessSettings()
  }, [])

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === selectedLeadId) ?? null,
    [leads, selectedLeadId]
  )

  useEffect(() => {
    if (customerMode !== 'lead' || !selectedLead) return
   setCustomerName(selectedLead.full_name || '')
setCustomerPhone(selectedLead.phone_number || '')
setCustomerEmail(selectedLead.email || '')
setBillingAddress(selectedLead.project_location || '')
  }, [customerMode, selectedLead])

const subtotal = useMemo(
  () =>
    items.reduce(
      (sum, item) =>
        sum +
        Math.max(0, Number(item.quantity) || 0) *
          Math.max(0, Number(item.unit_cost) || 0),
      0
    ),
  [items]
)

const safeTaxPercent = useMemo(() => {
  const value = Number(taxPercent)

  if (!Number.isFinite(value)) return 0

  return Math.min(100, Math.max(0, value))
}, [taxPercent])

const taxAmount = useMemo(
  () => subtotal * (safeTaxPercent / 100),
  [subtotal, safeTaxPercent]
)

const total = subtotal + taxAmount
const updateItem = (
  index: number,
  field: keyof InvoiceItem,
  value: string
) => {
  setItems((current) =>
    current.map((item, itemIndex) => {
      if (itemIndex !== index) return item

      if (field === 'name') {
        return {
          ...item,
          name: value,
        }
      }

      return {
        ...item,
        [field]: value,
      }
    })
  )
}

  const generateInvoice = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (customerMode === 'lead' && !selectedLeadId) {
      setError('Select an existing lead.')
      return
    }
    if (customerMode === 'custom' && !customerName.trim() && !companyName.trim()) {
      setError('Enter a customer name or company name.')
      return
    }
    if (!invoiceNumber.trim()) {
      setError('Enter an invoice number.')
      return
    }
    if (dueDate && invoiceDate && dueDate < invoiceDate) {
      setError('Due date cannot be before invoice date.')
      return
    }

    const validItems = items
  .map((item) => ({
    name: item.name.trim(),
    quantity: Number(item.quantity),
    unit_cost: Number(item.unit_cost),
  }))
  .filter(
    (item) =>
      item.name &&
      Number.isFinite(item.quantity) &&
      item.quantity > 0 &&
      Number.isFinite(item.unit_cost) &&
      item.unit_cost >= 0
  )
    if (!validItems.length) {
      setError('Add at least one valid invoice item.')
      return
    }
    if (!businessName.trim() && !businessAddress.trim() && !businessPhone.trim() && !businessEmail.trim()) {
      setError('Configure your business details in Settings before generating an invoice.')
      return
    }

    setLoading(true)
    try {
      const response = await apiFetch('/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
  lead_id: null,
  custom_lead_id:
    customerMode === 'lead'
      ? selectedLeadId
      : null,
          customer_name: customerName.trim() || null,
          company_name: companyName.trim() || null,
          customer_phone: customerPhone.trim() || null,
          customer_email: customerEmail.trim() || null,
          billing_address: billingAddress.trim() || null,
          number: invoiceNumber.trim(),
          currency: currency.toUpperCase(),
          date: invoiceDate,
          due_date: dueDate || null,
          payment_terms: paymentTerms.trim() || null,
          purchase_order: purchaseOrder.trim() || null,
          tax_title: Number(taxPercent) > 0 ? taxTitle.trim() || 'GST' : null,
          tax_percent: Number(taxPercent) > 0 ? Number(taxPercent) : null,
          items: validItems.map((item) => ({
            name: item.name.trim(),
            quantity: Number(item.quantity),
            unit_cost: Number(item.unit_cost),
          })),
          notes: notes.trim() || null,
          
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        const message = Array.isArray(data?.detail)
          ? data.detail.map((x: { msg?: string }) => x?.msg || 'Invalid input').join(', ')
          : data?.detail || 'Failed to generate invoice.'
        throw new Error(message)
      }

      const pdf = await response.blob()
      const type = response.headers.get('content-type') || ''
      if (!type.includes('application/pdf')) throw new Error('The server did not return a PDF.')

      const url = window.URL.createObjectURL(pdf)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `invoice-${invoiceNumber.trim().replace(/[\\/:*?"<>| ]+/g, '-')}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.URL.revokeObjectURL(url)
      setSuccess('Invoice generated successfully.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate invoice.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 p-5 sm:p-7 lg:p-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-blue-400">Billing</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Create Invoice</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">
              Create an invoice for an existing custom lead or a customer entered manually, then generate the PDF securely through the backend.
            </p>
          </div>

          {error && <div className="mb-6 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
          {success && <div className="mb-6 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{success}</div>}

          <form onSubmit={generateInvoice} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-6">
              <section className="rounded-2xl bg-[var(--bg-card)] p-6">
                <h2 className="text-lg font-semibold">Customer</h2>
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={() => setCustomerMode('lead')} className={`rounded-lg px-4 py-2 text-sm ${customerMode === 'lead' ? 'bg-blue-600' : 'border border-white/10'}`}>
                    Existing Custom Lead
                  </button>
                  <button type="button" onClick={() => setCustomerMode('custom')} className={`rounded-lg px-4 py-2 text-sm ${customerMode === 'custom' ? 'bg-blue-600' : 'border border-white/10'}`}>
                    Custom Customer
                  </button>
                </div>

                {customerMode === 'lead' && (
                  <div className="mt-5">
                    <label className="mb-2 block text-sm text-white/70">Lead</label>
                    <select value={selectedLeadId} onChange={(e) => setSelectedLeadId(e.target.value)} disabled={loadingLeads} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
                      <option value="">{loadingLeads ? 'Loading leads...' : 'Select a lead'}</option>
                      {leads.map((lead) => (
  <option key={lead.id} value={lead.id}>
    {lead.full_name || 'Unnamed Lead'}
  </option>
))}
                    </select>
                  </div>
                )}

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm text-white/70">Customer Name</label>
                    <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm text-white/70">Company Name</label>
                    <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm text-white/70">Phone</label>
                    <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm text-white/70">Email</label>
                    <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm" />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="mb-2 block text-sm text-white/70">Billing Address</label>
                  <textarea rows={4} value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm" />
                </div>
              </section>

              <section className="rounded-2xl bg-[var(--bg-card)] p-6">
                <h2 className="text-lg font-semibold">Your Business</h2>
                <p className="mt-1 text-sm text-white/40">
                  Permanent business details come from Settings.
                </p>

                {businessSettingsLoading ? (
                  <div className="mt-5 text-sm text-white/40">Loading business settings…</div>
                ) : (
                  <>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                        <div className="text-xs text-white/40">Business Name</div>
                        <div className="mt-1 text-sm">{businessName || 'Not configured'}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                        <div className="text-xs text-white/40">Phone</div>
                        <div className="mt-1 text-sm">{businessPhone || 'Not configured'}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                        <div className="text-xs text-white/40">Email</div>
                        <div className="mt-1 text-sm">{businessEmail || 'Not configured'}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                        <div className="text-xs text-white/40">Logo</div>
                        <div className="mt-1 text-sm">{logoUrl ? 'Configured' : 'No logo'}</div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                      <div className="text-xs text-white/40">Address</div>
                      <div className="mt-1 whitespace-pre-line text-sm">{businessAddress || 'Not configured'}</div>
                    </div>

                    {logoUrl && (
                      <div className="mt-4">
                        <img src={logoUrl} alt="Business logo" className="h-16 w-16 rounded-xl bg-white p-2 object-contain" />
                      </div>
                    )}

                    <p className="mt-4 text-xs text-blue-300/60">
                      Edit permanent business information from Settings.
                    </p>
                  </>
                )}
              </section>

              <section className="rounded-2xl bg-[var(--bg-card)] p-6">
                <h2 className="text-lg font-semibold">Invoice Details</h2>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Invoice Number" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm" />
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm"><option>INR</option><option>USD</option><option>EUR</option><option>GBP</option></select>
                  <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm" />
                  <input type="date" value={dueDate} min={invoiceDate} onChange={(e) => setDueDate(e.target.value)} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm" />
                  <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="Payment Terms" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm" />
                  <input value={purchaseOrder} onChange={(e) => setPurchaseOrder(e.target.value)} placeholder="Purchase Order / Reference" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm" />
                </div>
              </section>

              <section className="rounded-2xl bg-[var(--bg-card)] p-6">
  <div className="flex items-center justify-between">
    <div>
      <h2 className="text-lg font-semibold">Line Items</h2>
      <p className="mt-1 text-sm text-white/40">
        Add the products or services included in this invoice.
      </p>
    </div>
  </div>

  <div className="mt-5 space-y-4">
    {items.map((item, index) => (
      <div
        key={index}
        className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
      >
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_160px_auto]">
          
          {/* Product / Service Name */}
          <div>
            <label className="mb-1.5 block text-xs text-white/40">
              Product / Service
            </label>

            <input
              type="text"
              value={item.name}
              onChange={(e) =>
                updateItem(index, 'name', e.target.value)
              }
              placeholder="Product / Service Name"
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm"
            />
          </div>

          {/* Quantity */}
          <div>
            <label className="mb-1.5 block text-xs text-white/40">
              Quantity
            </label>

            <input
              type="text"
              min="1"
              value={item.quantity}
              onChange={(e) =>
                updateItem(index, 'quantity', e.target.value)
              }
              placeholder="Qty"
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm"
            />
          </div>

          {/* Unit Cost */}
          <div>
            <label className="mb-1.5 block text-xs text-white/40">
              Unit Cost
            </label>

            <input
              type="text"
              min="0"
              value={item.unit_cost}
              onChange={(e) =>
                updateItem(index, 'unit_cost', e.target.value)
              }
              placeholder="Unit Cost"
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm"
            />
          </div>

          {/* Remove */}
          <div className="flex items-end">
            <button
              type="button"
              disabled={items.length === 1}
              onClick={() =>
                setItems((current) =>
                  current.filter((_, i) => i !== index)
                )
              }
              className="w-full rounded-lg border border-rose-400/20 px-3 py-2.5 text-sm text-rose-300 disabled:opacity-30"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    ))}
  </div>

  <button
    type="button"
    onClick={() =>
      setItems((current) => [
        ...current,
        {
          name: '',
          quantity: '',
          unit_cost: '',
        },
      ])
    }
    className="mt-4 rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/[0.03]"
  >
    + Add Item
  </button>
</section>

              <section className="rounded-2xl bg-[var(--bg-card)] p-6">
                <h2 className="text-lg font-semibold">Tax & Additional Details</h2>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <input value={taxTitle} onChange={(e) => setTaxTitle(e.target.value)} placeholder="Tax Label (GST)" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm" />
                  <input
  type="text"
  min="0"
  max="100"
  value={taxPercent}
  onChange={(e) => {
    const value = e.target.value

    if (value === '') {
      setTaxPercent('')
      return
    }

    const numericValue = Number(value)

    if (!Number.isFinite(numericValue)) return

    setTaxPercent(
      String(Math.min(100, Math.max(0, numericValue)))
    )
  }}
  placeholder="Tax / GST %"
  className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm"
/>
                </div>
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" className="mt-4 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm" />
                
              </section>
            </div>

            <aside className="xl:sticky xl:top-6 xl:h-fit">
              <section className="rounded-2xl border border-blue-400/20 bg-blue-500/[0.05] p-6">
                <p className="text-[11px] uppercase tracking-widest text-blue-300/60">Invoice Preview</p>
                <div className="mt-5 text-sm">
                  <p className="text-white/40">Customer</p>
                  <p className="mt-1 font-semibold">{customerName || companyName || 'Customer'}</p>
                  {billingAddress && <p className="mt-1 whitespace-pre-line text-xs text-white/40">{billingAddress}</p>}
                </div>
                <div className="mt-5 border-t border-white/10 pt-5 space-y-2 text-sm text-white/50">
                  <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal, currency)}</span></div>
                  <div className="flex justify-between"><span>{taxTitle || 'Tax'} {Number(taxPercent) > 0 ? `(${taxPercent}%)` : ''}</span><span>{money(taxAmount, currency)}</span></div>
                  <div className="flex justify-between border-t border-white/10 pt-3 text-base font-bold text-white"><span>Total</span><span>{money(total, currency)}</span></div>
                </div>
                <button type="submit" disabled={loading || businessSettingsLoading} className="mt-6 w-full rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50">
                  {loading ? 'Generating Invoice…' : 'Generate Invoice PDF'}
                </button>
                <p className="mt-3 text-center text-xs leading-5 text-white/30">Invoice Generator credentials remain on the backend.</p>
              </section>
            </aside>
          </form>
        </div>
      </main>
    </div>
  )
}
