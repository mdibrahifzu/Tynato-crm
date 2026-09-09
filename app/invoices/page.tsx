'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import { apiFetch } from '@/app/lib/api'

type Lead = {
  id: string
  business_name?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  address?: string | null
  team_id?: string | null
}

type InvoiceItem = {
  name: string
  quantity: number
  unit_cost: number
}

type CreatedInvoice = {
  id: string | null
  invoiceNumber: string
}

function formatMoney(
  amount: number,
  currency: string
) {
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

function getDefaultDate() {
  return new Date().toISOString().slice(0, 10)
}

function getDefaultDueDate() {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  return date.toISOString().slice(0, 10)
}

export default function InvoicesPage() {
  const router = useRouter()

  const [leads, setLeads] = useState<Lead[]>([])
  const [loadingLeads, setLoadingLeads] = useState(true)

  const [selectedLeadId, setSelectedLeadId] =
    useState('')

  const [invoiceNumber, setInvoiceNumber] =
    useState('')

  const [invoiceDate, setInvoiceDate] =
    useState(getDefaultDate())

  const [dueDate, setDueDate] =
    useState(getDefaultDueDate())

  const [currency, setCurrency] =
    useState('INR')

  const [fromAddress, setFromAddress] =
    useState('Tynato CRM\nChennai, India')

  const [notes, setNotes] =
    useState('')

  const [items, setItems] = useState<InvoiceItem[]>([
    {
      name: '',
      quantity: 1,
      unit_cost: 0,
    },
  ])

  const [loading, setLoading] =
    useState(false)

  const [error, setError] = useState('')

  const [success, setSuccess] =
    useState('')

  const [createdInvoice, setCreatedInvoice] =
    useState<CreatedInvoice | null>(null)

  useEffect(() => {
    const loadLeads = async () => {
      try {
        setError('')

        const response = await apiFetch(
          '/leads'
        )

        const data = await response
          .json()
          .catch(() => null)

        if (!response.ok) {
          throw new Error(
            data?.detail ||
              `Failed to load leads: ${response.status}`
          )
        }

        const nextLeads = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
            ? data.items
            : []

        setLeads(nextLeads)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load leads.'
        )
      } finally {
        setLoadingLeads(false)
      }
    }

    loadLeads()
  }, [])

  const selectedLead = useMemo(
    () =>
      leads.find(
        (lead) =>
          lead.id === selectedLeadId
      ) ?? null,
    [leads, selectedLeadId]
  )

  const toAddress = useMemo(() => {
    if (!selectedLead) {
      return ''
    }

    const lines = [
      selectedLead.business_name || '',
      selectedLead.address || '',
      selectedLead.phone || '',
    ].filter(Boolean)

    return lines.join('\n')
  }, [selectedLead])

  const total = useMemo(
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

  const updateItem = (
    index: number,
    field: keyof InvoiceItem,
    value: string
  ) => {
    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item
        }

        if (field === 'name') {
          return {
            ...item,
            name: value,
          }
        }

        const numberValue =
          Number(value)

        return {
          ...item,
          [field]:
            Number.isFinite(numberValue)
              ? numberValue
              : 0,
        }
      })
    )
  }

  const addItem = () => {
    setItems((current) => [
      ...current,
      {
        name: '',
        quantity: 1,
        unit_cost: 0,
      },
    ])
  }

  const removeItem = (index: number) => {
    setItems((current) =>
      current.length === 1
        ? current
        : current.filter(
            (_, itemIndex) =>
              itemIndex !== index
          )
    )
  }

  const generateInvoice = async (
    event: FormEvent
  ) => {
    event.preventDefault()

    setError('')
    setSuccess('')
    setCreatedInvoice(null)

    if (!selectedLeadId) {
      setError('Please select a lead.')
      return
    }

    if (!invoiceNumber.trim()) {
      setError(
        'Please enter an invoice number.'
      )
      return
    }

    const validItems = items.filter(
      (item) =>
        item.name.trim() &&
        item.quantity > 0 &&
        item.unit_cost >= 0
    )

    if (validItems.length === 0) {
      setError(
        'Add at least one valid invoice item.'
      )
      return
    }

    if (
      dueDate &&
      invoiceDate &&
      dueDate < invoiceDate
    ) {
      setError(
        'Due date cannot be before invoice date.'
      )
      return
    }

    if (!toAddress.trim()) {
      setError(
        'The selected lead does not have enough customer information.'
      )
      return
    }

    setLoading(true)

    try {
      const response = await apiFetch(
        '/invoices',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            lead_id: selectedLeadId,
            from: fromAddress.trim(),
            to: toAddress,
            number: invoiceNumber.trim(),
            currency: currency.toUpperCase(),
            date: invoiceDate,
            due_date: dueDate || null,
            items: validItems.map(
              (item) => ({
                name: item.name.trim(),
                quantity: Number(
                  item.quantity
                ),
                unit_cost: Number(
                  item.unit_cost
                ),
              })
            ),
            notes:
              notes.trim() || null,
          }),
        }
      )

      if (!response.ok) {
        let message =
          'Failed to generate invoice.'

        try {
          const data =
            await response.json()

          if (Array.isArray(data?.detail)) {
            message =
              data.detail
                .map(
                  (item: {
                    msg?: string
                  }) =>
                    item?.msg || 'Invalid input'
                )
                .join(', ')
          } else if (
            typeof data?.detail ===
            'string'
          ) {
            message = data.detail
          }
        } catch {
          const text =
            await response.text().catch(
              () => ''
            )

          if (text) {
            message = text
          }
        }

        throw new Error(message)
      }

      const pdfBlob =
        await response.blob()

      const contentType =
        response.headers.get(
          'content-type'
        ) || ''

      if (
        !contentType.includes(
          'application/pdf'
        )
      ) {
        throw new Error(
          'The server did not return a PDF.'
        )
      }

      const invoiceId =
        response.headers.get(
          'X-Invoice-Id'
        )

      const downloadUrl =
        window.URL.createObjectURL(
          pdfBlob
        )

      const anchor =
        document.createElement('a')

      anchor.href = downloadUrl
      anchor.download =
        `invoice-${invoiceNumber
          .trim()
          .replace(
            /[\\/:*?"<>| ]+/g,
            '-'
          )}.pdf`

      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()

      window.URL.revokeObjectURL(
        downloadUrl
      )

      setCreatedInvoice({
        id: invoiceId,
        invoiceNumber:
          invoiceNumber.trim(),
      })

      setSuccess(
        'Invoice generated successfully.'
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to generate invoice.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="min-w-0 flex-1 p-5 sm:p-7 lg:p-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-blue-400">
                Billing
              </p>

              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                Create Invoice
              </h1>

              <p
                className="mt-2 max-w-2xl text-sm leading-6 sm:text-base"
                style={{
                  color:
                    'var(--text-muted)',
                }}
              >
                Create a CRM invoice and
                generate the PDF through the
                connected billing service.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                router.push('/leads')
              }
              className="w-fit rounded-lg border border-white/10 px-4 py-2.5 text-sm hover:bg-white/5"
            >
              Back to Leads
            </button>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {success}
              {createdInvoice?.id && (
                <span className="ml-2 text-emerald-300/60">
                  Invoice ID:{' '}
                  {createdInvoice.id}
                </span>
              )}
            </div>
          )}

          <form
            onSubmit={generateInvoice}
            className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]"
          >
            <div className="space-y-6">
              <section
                className="rounded-2xl p-6"
                style={{
                  background:
                    'var(--bg-card)',
                  border:
                    '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <h2 className="text-lg font-semibold">
                  Customer
                </h2>

                <div className="mt-5">
                  <label className="mb-2 block text-sm text-white/70">
                    Lead
                  </label>

                  <select
                    value={selectedLeadId}
                    onChange={(event) =>
                      setSelectedLeadId(
                        event.target.value
                      )
                    }
                    disabled={loadingLeads}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="">
                      {loadingLeads
                        ? 'Loading leads...'
                        : 'Select a lead'}
                    </option>

                    {leads.map((lead) => (
                      <option
                        key={lead.id}
                        value={lead.id}
                      >
                        {lead.business_name ||
                          lead.email ||
                          lead.id}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedLead && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <p className="text-[10px] uppercase tracking-widest text-white/30">
                        Business
                      </p>
                      <p className="mt-1 text-sm text-white/70">
                        {selectedLead.business_name ||
                          'Unknown'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <p className="text-[10px] uppercase tracking-widest text-white/30">
                        Phone
                      </p>
                      <p className="mt-1 text-sm text-white/70">
                        {selectedLead.phone ||
                          'Unknown'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 sm:col-span-2">
                      <p className="text-[10px] uppercase tracking-widest text-white/30">
                        Bill To
                      </p>

                      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-white/60">
                        {toAddress ||
                          'No customer address available'}
                      </p>
                    </div>
                  </div>
                )}
              </section>

              <section
                className="rounded-2xl p-6"
                style={{
                  background:
                    'var(--bg-card)',
                  border:
                    '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <h2 className="text-lg font-semibold">
                  Invoice Details
                </h2>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm text-white/70">
                      Invoice Number
                    </label>

                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(event) =>
                        setInvoiceNumber(
                          event.target.value
                        )
                      }
                      placeholder="INV-001"
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-white/70">
                      Currency
                    </label>

                    <select
                      value={currency}
                      onChange={(event) =>
                        setCurrency(
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    >
                      <option value="INR">
                        INR — Indian Rupee
                      </option>
                      <option value="USD">
                        USD — US Dollar
                      </option>
                      <option value="EUR">
                        EUR — Euro
                      </option>
                      <option value="GBP">
                        GBP — Pound
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-white/70">
                      Invoice Date
                    </label>

                    <input
                      type="date"
                      value={invoiceDate}
                      onChange={(event) =>
                        setInvoiceDate(
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-white/70">
                      Due Date
                    </label>

                    <input
                      type="date"
                      value={dueDate}
                      min={invoiceDate}
                      onChange={(event) =>
                        setDueDate(
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="mt-5">
                  <label className="mb-2 block text-sm text-white/70">
                    From
                  </label>

                  <textarea
                    value={fromAddress}
                    onChange={(event) =>
                      setFromAddress(
                        event.target.value
                      )
                    }
                    rows={3}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div className="mt-5">
                  <label className="mb-2 block text-sm text-white/70">
                    Notes
                  </label>

                  <textarea
                    value={notes}
                    onChange={(event) =>
                      setNotes(
                        event.target.value
                      )
                    }
                    rows={3}
                    placeholder="Optional invoice notes"
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </section>

              <section
                className="rounded-2xl p-6"
                style={{
                  background:
                    'var(--bg-card)',
                  border:
                    '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Line Items
                    </h2>

                    <p className="mt-1 text-sm text-white/40">
                      Amounts are calculated from
                      quantity × unit price.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addItem}
                    className="w-fit rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
                  >
                    + Add Item
                  </button>
                </div>

                <div className="mt-5 space-y-4">
                  {items.map(
                    (item, index) => (
                      <div
                        key={index}
                        className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                      >
                        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_120px_160px_auto]">
                          <div>
                            <label className="mb-2 block text-xs text-white/40">
                              Description
                            </label>

                            <input
                              type="text"
                              value={item.name}
                              onChange={(event) =>
                                updateItem(
                                  index,
                                  'name',
                                  event.target
                                    .value
                                )
                              }
                              placeholder="Service or product"
                              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-xs text-white/40">
                              Quantity
                            </label>

                            <input
                              type="number"
                              min="0.001"
                              step="0.001"
                              value={
                                item.quantity
                              }
                              onChange={(event) =>
                                updateItem(
                                  index,
                                  'quantity',
                                  event.target
                                    .value
                                )
                              }
                              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-xs text-white/40">
                              Unit Price
                            </label>

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                item.unit_cost
                              }
                              onChange={(event) =>
                                updateItem(
                                  index,
                                  'unit_cost',
                                  event.target
                                    .value
                                )
                              }
                              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                            />
                          </div>

                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={() =>
                                removeItem(
                                  index
                                )
                              }
                              disabled={
                                items.length ===
                                1
                              }
                              className="w-full rounded-lg border border-rose-400/20 px-3 py-2.5 text-sm text-rose-300 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 flex justify-end text-sm text-white/50">
                          Line total:{' '}
                          <span className="ml-2 font-semibold text-white">
                            {formatMoney(
                              Math.max(
                                0,
                                Number(
                                  item.quantity
                                ) || 0
                              ) *
                                Math.max(
                                  0,
                                  Number(
                                    item.unit_cost
                                  ) || 0
                                ),
                              currency
                            )}
                          </span>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </section>
            </div>

            <aside className="xl:sticky xl:top-6 xl:h-fit">
              <section className="rounded-2xl border border-blue-400/20 bg-blue-500/[0.05] p-6">
                <p className="text-[11px] uppercase tracking-widest text-blue-300/60">
                  Invoice Preview
                </p>

                <div className="mt-5">
                  <p className="text-sm text-white/40">
                    Customer
                  </p>

                  <p className="mt-1 font-semibold">
                    {selectedLead?.business_name ||
                      'Select a lead'}
                  </p>
                </div>

                <div className="mt-5 border-t border-white/10 pt-5">
                  <div className="flex justify-between text-sm text-white/40">
                    <span>Invoice</span>
                    <span>
                      {invoiceNumber ||
                        'Not set'}
                    </span>
                  </div>

                  <div className="mt-2 flex justify-between text-sm text-white/40">
                    <span>Currency</span>
                    <span>
                      {currency}
                    </span>
                  </div>
                </div>

                <div className="mt-6 border-t border-white/10 pt-5">
                  <div className="flex justify-between">
                    <span className="text-white/50">
                      Total
                    </span>

                    <span className="text-2xl font-bold">
                      {formatMoney(
                        total,
                        currency
                      )}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-6 w-full rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-semibold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading
                    ? 'Generating Invoice…'
                    : 'Generate Invoice PDF'}
                </button>

                <p className="mt-3 text-center text-xs leading-5 text-white/30">
                  The PDF is generated securely
                  by the backend. Your Invoice
                  Generator API key is never exposed
                  to the browser.
                </p>
              </section>
            </aside>
          </form>
        </div>
      </main>
    </div>
  )
}