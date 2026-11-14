import { Bike, Check, Fuel, HardHat, MapPin, ShieldCheck, Users } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BrandHero, Modal, QtyStepper, Row } from '../components/ui'
import { PICKUP_POINTS, SCOOTERS, SCOOTER_ADDONS, SCOOTER_DEPOSIT, type Scooter } from '../data/catalog'
import { addDays, daysBetween, peso, prettyDate, today } from '../lib/format'
import { scooterTotal, scootersAvailable } from '../lib/pricing'
import { useStore } from '../store/AppStore'

const TIMES = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00']

export default function Scooters() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { orders, addToCart, notify } = useStore()
  const [start, setStart] = useState(params.get('start') ?? addDays(today(), 1))
  const [end, setEnd] = useState(params.get('end') ?? addDays(today(), 3))
  const [time, setTime] = useState('09:00')
  const [picked, setPicked] = useState<Scooter | null>(null)
  const [qty, setQty] = useState(1)
  const [addons, setAddons] = useState<string[]>(['tank'])
  const [pickup, setPickup] = useState(PICKUP_POINTS[0].name)

  const days = Math.max(1, daysBetween(start, end))
  const validRange = end > start && start >= today()

  const toggle = (id: string) => setAddons((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))

  const book = () => {
    if (!picked) return
    const p = scooterTotal(picked.id, days, qty, addons, pickup)
    addToCart({
      kind: 'scooter',
      key: `scooter:${picked.id}:${Date.now()}`,
      scooterId: picked.id,
      name: picked.model,
      start,
      end,
      days,
      qty,
      addons,
      pickup,
      pickupTime: time,
      total: p.total,
    })
    notify(`${picked.model} added to your trip`)
    setPicked(null)
    nav('/cart')
  }

  const price = picked ? scooterTotal(picked.id, days, qty, addons, pickup) : null
  const available = picked ? scootersAvailable(picked.id, start, end, orders) : 0

  return (
    <>
      <BrandHero brand="baybayin">
        <div className="mt-6 grid max-w-3xl gap-2 rounded-2xl bg-white p-3 text-slate-800 shadow-lg sm:grid-cols-3">
          <label>
            <span className="label">Pick-up date</span>
            <input type="date" className="input" min={today()} value={start} onChange={(e) => { setStart(e.target.value); if (e.target.value >= end) setEnd(addDays(e.target.value, 1)) }} />
          </label>
          <label>
            <span className="label">Return date</span>
            <input type="date" className="input" min={addDays(start, 1)} value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
          <label>
            <span className="label">Pick-up time</span>
            <select className="input" value={time} onChange={(e) => setTime(e.target.value)}>
              {TIMES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
        </div>
      </BrandHero>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            {validRange ? (
              <>
                <b>{days} day{days > 1 ? 's' : ''}</b> · {prettyDate(start)} → {prettyDate(end)} {days >= 7 && <span className="chip ml-1 bg-emerald-100 text-emerald-700">15% weekly discount</span>}
              </>
            ) : (
              <span className="text-red-600">Choose a valid date range.</span>
            )}
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="chip bg-white ring-1 ring-slate-200"><HardHat size={12} /> Helmet included</span>
            <span className="chip bg-white ring-1 ring-slate-200"><ShieldCheck size={12} /> 24/7 roadside help</span>
            <span className="chip bg-white ring-1 ring-slate-200"><MapPin size={12} /> Free town drop-off</span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SCOOTERS.map((s) => {
            const left = validRange ? scootersAvailable(s.id, start, end, orders) : 0
            return (
              <div key={s.id} className="card overflow-hidden">
                <div className="relative flex h-36 items-center justify-center bg-gradient-to-br from-sea-50 to-sea-100">
                  <span className={`flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg ${s.color}`}>
                    <Bike size={40} />
                  </span>
                  <span className={`chip absolute right-3 top-3 ${left > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                    {left > 0 ? `${left} available` : 'Fully booked'}
                  </span>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-extrabold">{s.model}</h3>
                      <p className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Fuel size={12} /> {s.cc}cc automatic</span>
                        <span className="flex items-center gap-1"><Users size={12} /> {s.seats} riders</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-extrabold text-sea-700">{peso(s.pricePerDay)}</p>
                      <p className="text-[11px] text-slate-500">per day</p>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1 text-sm text-slate-600">
                    {s.features.map((f) => (
                      <li key={f} className="flex items-center gap-2"><Check size={14} className="text-sea-600" /> {f}</li>
                    ))}
                  </ul>
                  <button className="btn-primary mt-4 w-full" disabled={!validRange || left === 0} onClick={() => { setPicked(s); setQty(1) }}>
                    {validRange ? `Reserve · ${peso(s.pricePerDay * days)} total` : 'Select dates'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="card mt-8 p-5 text-sm text-slate-600">
          <h3 className="mb-2 font-bold text-slate-800">Rental requirements</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>Valid driver’s license (local or international) presented on pick-up.</li>
            <li>Refundable security deposit of {peso(SCOOTER_DEPOSIT)} or one valid government ID.</li>
            <li>Return with the same fuel level. Late returns are charged {peso(100)}/hour.</li>
            <li>Free cancellation up to 24 hours before pick-up.</li>
          </ul>
        </div>
      </div>

      <Modal open={!!picked} onClose={() => setPicked(null)} title={`Reserve ${picked?.model ?? ''}`}>
        {picked && price && (
          <div className="space-y-5">
            <p className="rounded-xl bg-sea-50 p-3 text-sm text-sea-900">
              {prettyDate(start)} {time} → {prettyDate(end)} · <b>{days} day{days > 1 ? 's' : ''}</b>
            </p>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold">Number of scooters</p>
                <p className="text-xs text-slate-500">{available} available for these dates</p>
              </div>
              <QtyStepper value={qty} onChange={setQty} min={1} max={available} />
            </div>
            <label className="block">
              <span className="label">Pick-up / drop-off point</span>
              <select className="input" value={pickup} onChange={(e) => setPickup(e.target.value)}>
                {PICKUP_POINTS.map((p) => (
                  <option key={p.name} value={p.name}>{p.name}{p.fee ? ` (+${peso(p.fee)})` : ' (free)'}</option>
                ))}
              </select>
            </label>
            <div>
              <p className="label">Add-ons</p>
              <div className="space-y-2">
                {SCOOTER_ADDONS.map((a) => (
                  <label key={a.id} className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 text-sm ${addons.includes(a.id) ? 'border-sea-500 bg-sea-50' : 'border-slate-200'}`}>
                    <span className="flex items-center gap-2">
                      <input type="checkbox" checked={addons.includes(a.id)} onChange={() => toggle(a.id)} className="accent-sea-700" />
                      {a.name}
                    </span>
                    <span className="text-slate-500">{peso(a.price)}/{a.per === 'day' ? 'day' : 'rental'}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1 border-t border-slate-100 pt-4 text-sm">
              <Row label={`${peso(picked.pricePerDay)} × ${days} day(s) × ${qty}`} value={peso(price.base)} />
              {price.discount > 0 && <Row label="Weekly discount (15%)" value={`−${peso(price.discount)}`} className="text-emerald-700" />}
              {price.addonTotal > 0 && <Row label="Add-ons" value={peso(price.addonTotal)} />}
              {price.pickupFee > 0 && <Row label="Delivery fee" value={peso(price.pickupFee)} />}
              <Row label="Total" value={peso(price.total)} className="pt-1 text-base font-extrabold" />
              <p className="text-xs text-slate-500">+ {peso(SCOOTER_DEPOSIT)} refundable deposit collected at pick-up.</p>
            </div>
            <button className="btn-primary w-full" onClick={book}>Add to trip</button>
          </div>
        )}
      </Modal>
    </>
  )
}

