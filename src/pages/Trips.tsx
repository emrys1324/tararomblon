import { CalendarCheck, CheckCircle2, Circle, MessageCircle, Phone, Star } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { BrandMark, EmptyState, Row, StatusBadge } from '../components/ui'
import { BRANDS } from '../data/catalog'
import { daysBetween, peso, prettyDateTime, today } from '../lib/format'
import { useStore } from '../store/AppStore'
import { PAYMENT_LABEL, STATUS_FLOW, STATUS_LABEL, type Order } from '../store/types'
import { LineSummary } from './Cart'

const isDone = (o: Order) => ['delivered', 'returned', 'checked_out', 'cancelled'].includes(o.status)

export function orderHeadline(o: Order) {
  const l = o.lines[0]
  if (o.brand === 'pahuway') return `${o.lines.reduce((n, x) => n + (x.kind === 'food' ? x.qty : 0), 0)} item(s) · ${o.deliveryZone}`
  if (l.kind === 'scooter') return `${l.name} · ${l.days} day(s)`
  if (l.kind === 'stay') return `${l.name} · ${l.nights} night(s)`
  return ''
}

export default function Trips() {
  const { orders } = useStore()
  const [params] = useSearchParams()
  const ref = params.get('ref')
  const [tab, setTab] = useState<'active' | 'past'>('active')

  const justBooked = ref ? orders.filter((o) => o.checkoutRef === ref) : []
  const list = orders.filter((o) => (tab === 'active' ? !isDone(o) : isDone(o)))

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {justBooked.length > 0 && (
        <div className="mb-6 rounded-3xl bg-gradient-to-br from-sea-700 to-sea-500 p-5 text-white shadow-lg">
          <CheckCircle2 size={32} />
          <h1 className="mt-2 text-2xl font-extrabold">Salamat! Your trip is booked.</h1>
          <p className="text-white/85">Reference <b>{ref}</b> · {justBooked.length} booking{justBooked.length > 1 ? 's' : ''} sent to our partners. A copy was sent to your email and SMS.</p>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-extrabold">My trips</h2>
        <div className="flex rounded-xl bg-white p-1 ring-1 ring-slate-200">
          {(['active', 'past'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-sm font-bold capitalize ${tab === t ? 'bg-sea-700 text-white' : 'text-slate-500'}`}>{t === 'active' ? 'Upcoming' : 'Past'}</button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<CalendarCheck size={40} />} title={tab === 'active' ? 'No upcoming bookings' : 'No past bookings yet'} text="Your food orders, scooter rentals and stays will appear here." action={<Link to="/" className="btn-primary">Plan your trip</Link>} />
      ) : (
        <ul className="space-y-3">
          {list.map((o) => (
            <li key={o.id}>
              <Link to={`/trips/${o.id}`} className="card flex items-center gap-3 p-4 transition hover:shadow-md">
                <BrandMark brand={o.brand} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-bold">{BRANDS[o.brand].name}</p>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="truncate text-sm text-slate-500">{orderHeadline(o)}</p>
                  <p className="text-xs text-slate-400">{o.id} · {prettyDateTime(o.createdAt)}</p>
                </div>
                <span className="font-extrabold tabular-nums">{peso(o.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function TripDetail() {
  const { id } = useParams()
  const { orders, setStatus, reviewOrder, notify } = useStore()
  const o = orders.find((x) => x.id === id)
  const [rating, setRating] = useState(5)
  const [text, setText] = useState('')

  if (!o) return <div className="mx-auto max-w-3xl px-4 py-10"><EmptyState icon={<CalendarCheck size={40} />} title="Booking not found" text="It may have been made on another device." action={<Link to="/trips" className="btn-primary">Back to my trips</Link>} /></div>

  const flow = STATUS_FLOW[o.brand]
  const idx = flow.indexOf(o.status)
  const b = BRANDS[o.brand]
  const first = o.lines[0]
  const canCancel =
    o.status === flow[0] &&
    (o.brand === 'pahuway' ||
      (first.kind === 'scooter' && daysBetween(today(), first.start) >= 1) ||
      (first.kind === 'stay' && daysBetween(today(), first.checkIn) >= 1))

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <Link to="/trips" className="text-sm font-bold text-sea-700">← My trips</Link>
      <div className="card p-5">
        <div className="flex items-center gap-3">
          <BrandMark brand={o.brand} size="lg" />
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{b.service} · {o.id}</p>
            <h1 className="text-xl font-extrabold">{b.name}</h1>
          </div>
          <StatusBadge status={o.status} />
        </div>

        {o.status !== 'cancelled' && (
          <ol className="mt-6 grid gap-3" style={{ gridTemplateColumns: `repeat(${flow.length}, minmax(0,1fr))` }}>
            {flow.map((s, i) => {
              const at = o.history.find((h) => h.status === s)?.at
              return (
                <li key={s} className="flex flex-col items-center text-center">
                  {i <= idx ? <CheckCircle2 className="text-sea-600" /> : <Circle className="text-slate-300" />}
                  <div className={`mt-1 h-1 w-full rounded ${i <= idx ? 'bg-sea-500' : 'bg-slate-200'}`} />
                  <p className={`mt-1 text-xs font-semibold ${i <= idx ? 'text-slate-800' : 'text-slate-400'}`}>{STATUS_LABEL[s]}</p>
                  {at && <p className="text-[10px] text-slate-400">{prettyDateTime(at)}</p>}
                </li>
              )
            })}
          </ol>
        )}
        {o.brand === 'pahuway' && o.status !== 'delivered' && o.status !== 'cancelled' && (
          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Estimated delivery: {o.deliveryZone && `${o.deliveryZone.split(' (')[0]} · `}~30–45 minutes from order.</p>
        )}
      </div>

      <div className="card divide-y divide-slate-100">
        {o.lines.map((l) => (
          <div key={l.key} className="flex items-start gap-3 p-4">
            <LineSummary line={l} />
            <span className="font-semibold tabular-nums">{peso(l.kind === 'food' ? l.unitPrice * l.qty : l.total)}</span>
          </div>
        ))}
        <div className="space-y-1 p-4 text-sm">
          <Row label="Subtotal" value={peso(o.subtotal)} />
          {o.fees.map((f) => <Row key={f.label} label={f.label} value={f.amount ? peso(f.amount) : 'Free'} />)}
          <Row label="Total" value={peso(o.total)} className="text-base font-extrabold" />
          <Row label="Payment" value={`${PAYMENT_LABEL[o.payment]} · ${o.paid ? 'Paid' : 'To pay'}`} />
        </div>
      </div>

      <div className="card space-y-1 p-4 text-sm">
        <Row label="Guest" value={o.customer.name} />
        <Row label="Mobile" value={o.customer.phone} />
        {o.address && <Row label="Deliver to" value={o.address} />}
        {o.deliveryNotes && <Row label="Rider note" value={o.deliveryNotes} />}
        {o.licenseNo && <Row label="License no." value={o.licenseNo} />}
        {o.arrivalTime && <Row label="Arrival time" value={o.arrivalTime} />}
        {o.specialRequests && <Row label="Requests" value={o.specialRequests} />}
        <Row label="Trip reference" value={o.checkoutRef} />
      </div>

      <div className="flex flex-wrap gap-2">
        <a href="tel:+639000000000" className="btn-ghost"><Phone size={16} /> Call {b.name.split(' ')[0]}</a>
        <a href="sms:+639000000000" className="btn-ghost"><MessageCircle size={16} /> Message</a>
        {canCancel && (
          <button className="btn-ghost text-red-600" onClick={() => { if (confirm('Cancel this booking?')) { setStatus(o.id, 'cancelled'); notify('Booking cancelled') } }}>
            Cancel booking
          </button>
        )}
      </div>

      {isDone(o) && o.status !== 'cancelled' && (
        <div className="card p-4">
          {o.review ? (
            <p className="text-sm">You rated this <b>{o.review.rating}★</b>{o.review.text && ` — “${o.review.text}”`}. Salamat!</p>
          ) : (
            <>
              <p className="font-bold">How was {b.name}?</p>
              <div className="my-2 flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`}>
                    <Star size={28} className={n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />
                  </button>
                ))}
              </div>
              <textarea className="input" rows={2} placeholder="Share a few words (optional)" value={text} onChange={(e) => setText(e.target.value)} />
              <button className="btn-primary mt-2" onClick={() => { reviewOrder(o.id, rating, text); notify('Thanks for your review!') }}>Submit review</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
