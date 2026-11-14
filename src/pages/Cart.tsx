import { Banknote, CreditCard, Loader2, ShoppingBag, Smartphone, Trash2, Wallet } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BrandMark, EmptyState, Modal, QtyStepper, Row } from '../components/ui'
import { BRANDS, DELIVERY_ZONES, MIN_FOOD_ORDER, SCOOTER_ADDONS, type BrandId } from '../data/catalog'
import { peso, prettyDate, shortId } from '../lib/format'
import { roomAvailable, scootersAvailable } from '../lib/pricing'
import { brandOfLine, useStore } from '../store/AppStore'
import { PAYMENT_LABEL, STATUS_FLOW, type CartLine, type Order, type PaymentMethod } from '../store/types'

const SERVICE_FEE = 10

const PAY_ICON: Record<PaymentMethod, typeof Wallet> = { gcash: Smartphone, maya: Wallet, card: CreditCard, cash: Banknote }

export default function Cart() {
  const store = useStore()
  const { cart, user, orders, updateQty, removeLine, placeOrders, setUser } = store
  const nav = useNavigate()

  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [zone, setZone] = useState(DELIVERY_ZONES[0].name)
  const [address, setAddress] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [license, setLicense] = useState('')
  const [arrival, setArrival] = useState('14:00')
  const [requests, setRequests] = useState('')
  const [payment, setPayment] = useState<PaymentMethod>('gcash')
  const [error, setError] = useState('')
  const [paying, setPaying] = useState<Order[] | null>(null)
  const [processing, setProcessing] = useState(false)

  if (cart.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState
          icon={<ShoppingBag size={40} />}
          title="Your trip cart is empty"
          text="Add a beach stay, a scooter or something from Pahuway Cafe — then check out everything at once."
          action={<div className="flex flex-wrap justify-center gap-2"><Link to="/stays" className="btn-primary">Find a stay</Link><Link to="/scooters" className="btn-ghost">Rent a scooter</Link><Link to="/food" className="btn-ghost">Order food</Link></div>}
        />
      </div>
    )
  }

  const byBrand = (['hiraya', 'baybayin', 'pahuway'] as BrandId[])
    .map((b) => ({ b, lines: cart.filter((l) => brandOfLine(l) === b) }))
    .filter((g) => g.lines.length)

  const has = (b: BrandId) => byBrand.some((g) => g.b === b)
  const lineTotal = (l: CartLine) => (l.kind === 'food' ? l.unitPrice * l.qty : l.total)
  const foodSubtotal = cart.filter((l) => l.kind === 'food').reduce((n, l) => n + lineTotal(l), 0)
  const zoneInfo = DELIVERY_ZONES.find((z) => z.name === zone)!
  const fees = (b: BrandId) =>
    b === 'pahuway' ? [{ label: 'Delivery fee', amount: zoneInfo.fee }, { label: 'Service fee', amount: SERVICE_FEE }] : []
  const brandTotal = (b: BrandId) =>
    cart.filter((l) => brandOfLine(l) === b).reduce((n, l) => n + lineTotal(l), 0) + fees(b).reduce((n, f) => n + f.amount, 0)
  const grandTotal = byBrand.reduce((n, g) => n + brandTotal(g.b), 0)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim() || !/^(\+?63|0)9\d{9}$/.test(phone.replace(/[\s-]/g, ''))) return setError('Enter your name and a valid PH mobile number (e.g. 0917 123 4567).')
    if (has('pahuway') && foodSubtotal < MIN_FOOD_ORDER) return setError(`Pahuway Cafe minimum order is ${peso(MIN_FOOD_ORDER)}.`)
    if (has('pahuway') && !address.trim()) return setError('Enter a delivery address or landmark.')
    if (has('baybayin') && license.trim().length < 5) return setError('Enter the driver’s license number of the rider.')

    // Re-check availability right before booking (another booking may have landed).
    for (const l of cart) {
      if (l.kind === 'scooter' && scootersAvailable(l.scooterId, l.start, l.end, orders) < l.qty) return setError(`${l.name} is no longer available for those dates.`)
      if (l.kind === 'stay' && !roomAvailable(l.roomId, l.checkIn, l.checkOut, orders)) return setError(`${l.name} was just booked for those dates.`)
    }

    const ref = shortId('TRIP')
    const now = Date.now()
    const customer = { name: name.trim(), phone: phone.trim(), email: email.trim() }
    const newOrders: Order[] = byBrand.map(({ b, lines }) => {
      const subtotal = lines.reduce((n, l) => n + lineTotal(l), 0)
      const status = STATUS_FLOW[b][0]
      return {
        id: shortId(b === 'pahuway' ? 'PC' : b === 'baybayin' ? 'BSR' : 'HBH'),
        checkoutRef: ref,
        brand: b,
        createdAt: now,
        status,
        history: [{ status, at: now }],
        customer,
        payment,
        paid: false,
        subtotal,
        fees: fees(b),
        total: brandTotal(b),
        lines,
        ...(b === 'pahuway' ? { deliveryZone: zone, address, deliveryNotes } : {}),
        ...(b === 'baybayin' ? { licenseNo: license } : {}),
        ...(b === 'hiraya' ? { arrivalTime: arrival, specialRequests: requests } : {}),
      }
    })
    if (!user) setUser(customer)

    if (payment === 'cash') return finish(newOrders)
    setPaying(newOrders)
  }

  const finish = (list: Order[]) => {
    placeOrders(list)
    nav(`/trips?ref=${list[0].checkoutRef}`)
  }

  const confirmPayment = () => {
    if (!paying) return
    setProcessing(true)
    setTimeout(() => {
      setProcessing(false)
      finish(paying.map((o) => ({ ...o, paid: true })))
      setPaying(null)
    }, 1400)
  }

  return (
    <form onSubmit={submit} className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        <h1 className="text-2xl font-extrabold">Your trip</h1>

        {byBrand.map(({ b, lines }) => (
          <section key={b} className="card overflow-hidden">
            <header className="flex items-center gap-3 border-b border-slate-100 p-4">
              <BrandMark brand={b} size="sm" />
              <div className="flex-1">
                <p className="font-bold">{BRANDS[b].name}</p>
                <p className="text-xs text-slate-500">{BRANDS[b].service}</p>
              </div>
              <Link to={BRANDS[b].path} className="text-xs font-bold text-sea-700">+ Add more</Link>
            </header>
            <ul className="divide-y divide-slate-100">
              {lines.map((l) => (
                <li key={l.key} className="flex items-start gap-3 p-4">
                  <LineSummary line={l} />
                  <div className="flex flex-col items-end gap-2">
                    <span className="font-bold tabular-nums">{peso(lineTotal(l))}</span>
                    {l.kind === 'food' ? (
                      <QtyStepper value={l.qty} onChange={(n) => updateQty(l.key, n)} />
                    ) : (
                      <button type="button" onClick={() => removeLine(l.key)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-600"><Trash2 size={14} /> Remove</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div className="space-y-3 border-t border-slate-100 bg-sand-50 p-4">
              {b === 'pahuway' && (
                <>
                  <label className="block">
                    <span className="label">Delivery area</span>
                    <select className="input" value={zone} onChange={(e) => setZone(e.target.value)}>
                      {DELIVERY_ZONES.map((z) => <option key={z.name} value={z.name}>{z.name} — {z.fee ? peso(z.fee) : 'Free'} · {z.eta}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="label">Address / landmark</span>
                    <input className="input" placeholder="e.g. Blue gate beside Capaclan chapel, or room no." value={address} onChange={(e) => setAddress(e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="label">Note to rider (optional)</span>
                    <input className="input" placeholder="Less ice, call on arrival…" value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} />
                  </label>
                  {foodSubtotal < MIN_FOOD_ORDER && <p className="text-xs font-semibold text-amber-700">Add {peso(MIN_FOOD_ORDER - foodSubtotal)} more to reach the minimum order.</p>}
                </>
              )}
              {b === 'baybayin' && (
                <label className="block">
                  <span className="label">Driver’s license no.</span>
                  <input className="input" placeholder="N01-23-456789" value={license} onChange={(e) => setLicense(e.target.value)} />
                  <span className="mt-1 block text-xs text-slate-500">Bring the physical license on pick-up. Deposit: ₱1,000 or 1 valid ID.</span>
                </label>
              )}
              {b === 'hiraya' && (
                <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                  <label className="block">
                    <span className="label">Arrival time</span>
                    <input type="time" className="input" value={arrival} onChange={(e) => setArrival(e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="label">Special requests</span>
                    <input className="input" placeholder="Port pick-up, early check-in, celebration…" value={requests} onChange={(e) => setRequests(e.target.value)} />
                  </label>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <section className="card space-y-3 p-4">
          <h2 className="font-extrabold">Contact details</h2>
          <input className="input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          <input className="input" placeholder="Mobile no. (09XX XXX XXXX)" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" />
          <input className="input" placeholder="Email (for receipts)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </section>

        <section className="card space-y-2 p-4">
          <h2 className="font-extrabold">Payment</h2>
          {(Object.keys(PAYMENT_LABEL) as PaymentMethod[]).map((m) => {
            const Icon = PAY_ICON[m]
            return (
              <label key={m} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${payment === m ? 'border-sea-500 bg-sea-50 font-bold' : 'border-slate-200'}`}>
                <input type="radio" name="pay" checked={payment === m} onChange={() => setPayment(m)} className="accent-sea-700" />
                <Icon size={18} className="text-sea-700" /> {PAYMENT_LABEL[m]}
              </label>
            )
          })}
        </section>

        <section className="card space-y-1.5 p-4 text-sm">
          {byBrand.map(({ b }) => <Row key={b} label={BRANDS[b].name} value={peso(brandTotal(b))} />)}
          {has('pahuway') && <p className="text-xs text-slate-500">Food includes {zoneInfo.fee ? `${peso(zoneInfo.fee)} delivery + ` : 'free delivery + '}{peso(SERVICE_FEE)} service fee</p>}
          <Row label="Total" value={peso(grandTotal)} className="border-t border-slate-100 pt-2 text-lg font-extrabold" />
          {error && <p className="rounded-xl bg-red-50 p-2 text-xs font-semibold text-red-700" role="alert">{error}</p>}
          <button className="btn-coral mt-2 w-full py-3 text-base">{payment === 'cash' ? 'Place booking' : `Pay ${peso(grandTotal)}`}</button>
          <p className="text-center text-[11px] text-slate-400">Each partner confirms its part of your trip separately.</p>
        </section>
      </aside>

      <Modal open={!!paying} onClose={() => !processing && setPaying(null)} title={`Pay with ${PAYMENT_LABEL[payment]}`}>
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sea-50 text-sea-700">
            {(() => { const I = PAY_ICON[payment]; return <I size={32} /> })()}
          </div>
          <p className="text-3xl font-extrabold">{peso(grandTotal)}</p>
          <p className="text-sm text-slate-500">Demo payment — in production this hands off to the PayMongo / Xendit checkout for {PAYMENT_LABEL[payment]}.</p>
          <button type="button" className="btn-primary w-full" onClick={confirmPayment} disabled={processing}>
            {processing ? <><Loader2 size={16} className="animate-spin" /> Processing…</> : 'Authorize payment'}
          </button>
        </div>
      </Modal>
    </form>
  )
}

export function LineSummary({ line }: { line: CartLine }) {
  if (line.kind === 'food')
    return (
      <div className="flex flex-1 items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sand-100 text-2xl">{line.emoji}</span>
        <div>
          <p className="font-semibold">{line.name}</p>
          <p className="text-xs text-slate-500">{line.option ? `${line.option} · ` : ''}{peso(line.unitPrice)} each</p>
        </div>
      </div>
    )
  if (line.kind === 'scooter')
    return (
      <div className="flex-1">
        <p className="font-semibold">{line.qty > 1 ? `${line.qty} × ` : ''}{line.name}</p>
        <p className="text-xs text-slate-500">{prettyDate(line.start)} {line.pickupTime} → {prettyDate(line.end)} · {line.days} day{line.days > 1 ? 's' : ''}</p>
        <p className="text-xs text-slate-500">{line.pickup}</p>
        {line.addons.length > 0 && <p className="text-xs text-slate-500">+ {line.addons.map((a) => SCOOTER_ADDONS.find((x) => x.id === a)?.name).join(', ')}</p>}
      </div>
    )
  return (
    <div className="flex-1">
      <p className="font-semibold">{line.name}</p>
      <p className="text-xs text-slate-500">{prettyDate(line.checkIn)} → {prettyDate(line.checkOut)} · {line.nights} night{line.nights > 1 ? 's' : ''} · {line.guests} guest{line.guests > 1 ? 's' : ''}</p>
    </div>
  )
}
