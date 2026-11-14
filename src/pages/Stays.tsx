import { BedDouble, Check, ChevronLeft, ChevronRight, Maximize, Users, Waves as WavesIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BrandHero, Modal, Row, Waves } from '../components/ui'
import { EXTRA_GUEST_FEE, ROOMS, type Room } from '../data/catalog'
import { addDays, daysBetween, parseISODate, peso, prettyDate, toISODate, today } from '../lib/format'
import { roomAvailable, roomUnitsFree, stayTotal } from '../lib/pricing'
import { useStore } from '../store/AppStore'
import type { Order } from '../store/types'

export default function Stays() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { orders, addToCart, notify } = useStore()
  const [checkIn, setCheckIn] = useState(params.get('start') ?? addDays(today(), 7))
  const [checkOut, setCheckOut] = useState(params.get('end') ?? addDays(today(), 9))
  const [guests, setGuests] = useState(Number(params.get('guests') ?? 2))
  const [picked, setPicked] = useState<Room | null>(null)

  const nights = daysBetween(checkIn, checkOut)
  const valid = nights > 0 && checkIn >= today()

  const book = (room: Room) => {
    const p = stayTotal(room, nights, guests)
    addToCart({ kind: 'stay', key: `stay:${room.id}:${Date.now()}`, roomId: room.id, name: room.name, checkIn, checkOut, nights, guests, total: p.total })
    notify(`${room.name} added to your trip`)
    setPicked(null)
    nav('/cart')
  }

  return (
    <>
      <BrandHero brand="hiraya">
        <div className="mt-6 grid max-w-3xl gap-2 rounded-2xl bg-white p-3 text-slate-800 shadow-lg sm:grid-cols-3">
          <label>
            <span className="label">Check-in</span>
            <input type="date" className="input" min={today()} value={checkIn} onChange={(e) => { setCheckIn(e.target.value); if (e.target.value >= checkOut) setCheckOut(addDays(e.target.value, 1)) }} />
          </label>
          <label>
            <span className="label">Check-out</span>
            <input type="date" className="input" min={addDays(checkIn, 1)} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </label>
          <label>
            <span className="label">Guests</span>
            <select className="input" value={guests} onChange={(e) => setGuests(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} guest{n > 1 ? 's' : ''}</option>)}
            </select>
          </label>
        </div>
      </BrandHero>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <p className="mb-5 text-sm text-slate-600">
          {valid ? <><b>{nights} night{nights > 1 ? 's' : ''}</b> · {prettyDate(checkIn)} → {prettyDate(checkOut)} · {guests} guest{guests > 1 ? 's' : ''}</> : <span className="text-red-600">Choose valid dates.</span>}
        </p>

        <div className="grid gap-5 md:grid-cols-2">
          {ROOMS.map((r) => {
            const fits = guests <= r.maxGuests
            const free = valid && roomAvailable(r.id, checkIn, checkOut, orders)
            const p = stayTotal(r, Math.max(1, nights), guests)
            return (
              <article key={r.id} className="card overflow-hidden">
                <button className={`relative block h-44 w-full bg-gradient-to-br ${r.gradient}`} onClick={() => setPicked(r)} aria-label={`View ${r.name}`}>
                  <Waves />
                  <WavesIcon className="absolute bottom-4 left-4 text-white/70" size={36} />
                  <span className={`chip absolute right-3 top-3 ${!fits ? 'bg-amber-100 text-amber-800' : free ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                    {!fits ? `Max ${r.maxGuests} guests` : free ? 'Available' : 'Not available'}
                  </span>
                </button>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-extrabold">{r.name}</h3>
                      <p className="flex flex-wrap gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><BedDouble size={12} /> {r.beds}</span>
                        <span className="flex items-center gap-1"><Users size={12} /> up to {r.maxGuests}</span>
                        <span className="flex items-center gap-1"><Maximize size={12} /> {r.size}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-extrabold text-sky-700">{peso(r.pricePerNight)}</p>
                      <p className="text-[11px] text-slate-500">per night</p>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">{r.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {r.amenities.slice(0, 4).map((a) => <span key={a} className="chip bg-sand-100 text-slate-600">{a}</span>)}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button className="btn-ghost flex-1" onClick={() => setPicked(r)}>Details & calendar</button>
                    <button className="btn-primary flex-1" disabled={!free || !fits} onClick={() => book(r)}>
                      {valid ? `Book · ${peso(p.total)}` : 'Select dates'}
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        <div className="card mt-8 grid gap-4 p-5 text-sm text-slate-600 sm:grid-cols-3">
          <div><p className="font-bold text-slate-800">House rules</p><p>Check-in 2 PM, check-out 12 NN. Quiet hours 10 PM–6 AM. No smoking indoors.</p></div>
          <div><p className="font-bold text-slate-800">Extra guests</p><p>{peso(EXTRA_GUEST_FEE)}/night per guest beyond 2, includes bedding and breakfast.</p></div>
          <div><p className="font-bold text-slate-800">Cancellation</p><p>Free cancellation up to 7 days before check-in. 50% refund within 7 days.</p></div>
        </div>
      </div>

      <Modal open={!!picked} onClose={() => setPicked(null)} title={picked?.name ?? ''}>
        {picked && (
          <RoomDetail
            room={picked}
            orders={orders}
            checkIn={checkIn}
            checkOut={checkOut}
            guests={guests}
            onRange={(a, b) => { setCheckIn(a); setCheckOut(b) }}
            onBook={() => book(picked)}
          />
        )}
      </Modal>
    </>
  )
}

function RoomDetail({ room, orders, checkIn, checkOut, guests, onRange, onBook }: {
  room: Room; orders: Order[]; checkIn: string; checkOut: string; guests: number
  onRange: (a: string, b: string) => void; onBook: () => void
}) {
  const nights = daysBetween(checkIn, checkOut)
  const free = nights > 0 && roomAvailable(room.id, checkIn, checkOut, orders)
  const fits = guests <= room.maxGuests
  const p = stayTotal(room, Math.max(1, nights), guests)

  return (
    <div className="space-y-4">
      <div className={`h-32 rounded-2xl bg-gradient-to-br ${room.gradient}`} />
      <p className="text-sm text-slate-600">{room.description}</p>
      <ul className="grid grid-cols-2 gap-1 text-sm">
        {room.amenities.map((a) => <li key={a} className="flex items-center gap-2"><Check size={14} className="text-sea-600" />{a}</li>)}
      </ul>
      <Calendar roomId={room.id} orders={orders} checkIn={checkIn} checkOut={checkOut} onRange={onRange} />
      <div className="space-y-1 border-t border-slate-100 pt-3 text-sm">
        <Row label={`${peso(room.pricePerNight)} × ${nights} night(s)`} value={peso(p.base)} />
        {p.extra > 0 && <Row label={`Extra guests (${guests - 2})`} value={peso(p.extra)} />}
        <Row label="Total" value={peso(p.total)} className="text-base font-extrabold" />
      </div>
      {!fits && <p className="text-sm text-amber-700">This room fits up to {room.maxGuests} guests.</p>}
      <button className="btn-primary w-full" disabled={!free || !fits} onClick={onBook}>
        {free ? `Add to trip · ${prettyDate(checkIn)} → ${prettyDate(checkOut)}` : 'Selected dates unavailable'}
      </button>
    </div>
  )
}

function Calendar({ roomId, orders, checkIn, checkOut, onRange }: {
  roomId: string; orders: Order[]; checkIn: string; checkOut: string; onRange: (a: string, b: string) => void
}) {
  const [month, setMonth] = useState(() => { const d = parseISODate(checkIn); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [anchor, setAnchor] = useState<string | null>(null)
  const t = today()

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const pad = first.getDay()
    const len = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    return [...Array(pad).fill(null), ...Array.from({ length: len }, (_, i) => toISODate(new Date(month.getFullYear(), month.getMonth(), i + 1)))]
  }, [month])

  const click = (d: string) => {
    if (!anchor || d <= anchor) {
      setAnchor(d)
      onRange(d, addDays(d, 1))
    } else {
      onRange(anchor, d)
      setAnchor(null)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <button className="rounded-lg p-1 hover:bg-slate-100" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={18} /></button>
        <p className="text-sm font-bold">{month.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</p>
        <button className="rounded-lg p-1 hover:bg-slate-100" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={18} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-400">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <span key={i} />
          const past = d < t
          const full = !past && roomUnitsFree(roomId, d, orders) <= 0
          const inRange = d >= checkIn && d < checkOut
          const edge = d === checkIn || d === checkOut
          return (
            <button
              key={d}
              disabled={past || (full && !anchor)}
              onClick={() => click(d)}
              className={`aspect-square rounded-lg text-xs font-semibold transition ${
                edge ? 'bg-sea-700 text-white' : inRange ? 'bg-sea-100 text-sea-800' : full ? 'bg-slate-100 text-slate-300 line-through' : past ? 'text-slate-300' : 'hover:bg-sea-50'
              }`}
            >
              {Number(d.slice(8))}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">{anchor ? 'Now tap your check-out date.' : 'Tap a check-in date. Struck-through dates are booked.'}</p>
    </div>
  )
}
