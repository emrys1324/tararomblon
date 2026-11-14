import { ArrowRight, Bike, CalendarDays, Coffee, CreditCard, Home as HomeIcon, MapPin, ShieldCheck, Truck } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BrandMark, Rating, Section, Waves } from '../components/ui'
import { BRANDS, MENU, ROMBLON_SPOTS, ROOMS, SCOOTERS } from '../data/catalog'
import { addDays, peso, today } from '../lib/format'

type Tab = 'stays' | 'scooters' | 'food'

export default function Home() {
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>('stays')
  const [start, setStart] = useState(addDays(today(), 7))
  const [end, setEnd] = useState(addDays(today(), 10))
  const [guests, setGuests] = useState(2)

  const search = () => {
    if (tab === 'food') return nav('/food')
    const q = new URLSearchParams({ start, end, ...(tab === 'stays' ? { guests: String(guests) } : {}) })
    nav(`/${tab}?${q}`)
  }

  const tabs: { id: Tab; label: string; icon: typeof Coffee }[] = [
    { id: 'stays', label: 'Stays', icon: HomeIcon },
    { id: 'scooters', label: 'Scooters', icon: Bike },
    { id: 'food', label: 'Food', icon: Coffee },
  ]

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-sea-900 via-sea-700 to-sea-500 text-white">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-coral-400/40 blur-3xl" />
        <Waves className="h-40" />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-10 sm:pt-16">
          <p className="chip bg-white/15 text-white">
            <MapPin size={12} /> Romblon, Philippines
          </p>
          <h1 className="mt-4 max-w-2xl text-4xl font-extrabold leading-tight sm:text-5xl">
            Tara na sa Romblon! <span className="text-coral-400">One app</span> for your whole island trip.
          </h1>
          <p className="mt-3 max-w-xl text-white/85">
            Book your beach stay, reserve a scooter and get island food delivered — with one account and one checkout.
          </p>

          <div className="mt-8 max-w-3xl rounded-3xl bg-white p-2 text-slate-800 shadow-2xl">
            <div className="flex gap-1 p-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-bold transition ${tab === t.id ? 'bg-sea-700 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <t.icon size={16} /> {t.label}
                </button>
              ))}
            </div>
            <div className="grid gap-2 p-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
              {tab === 'food' ? (
                <div className="sm:col-span-3">
                  <p className="label">Delivering to</p>
                  <p className="input flex items-center gap-2 text-slate-500">
                    <Truck size={16} /> Romblon town & nearby barangays · 20–60 min
                  </p>
                </div>
              ) : (
                <>
                  <label>
                    <span className="label">{tab === 'stays' ? 'Check-in' : 'Pick-up'}</span>
                    <input type="date" className="input" value={start} min={today()} onChange={(e) => { setStart(e.target.value); if (e.target.value >= end) setEnd(addDays(e.target.value, 1)) }} />
                  </label>
                  <label>
                    <span className="label">{tab === 'stays' ? 'Check-out' : 'Return'}</span>
                    <input type="date" className="input" value={end} min={addDays(start, 1)} onChange={(e) => setEnd(e.target.value)} />
                  </label>
                  {tab === 'stays' ? (
                    <label>
                      <span className="label">Guests</span>
                      <select className="input" value={guests} onChange={(e) => setGuests(Number(e.target.value))}>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>{n} guest{n > 1 ? 's' : ''}</option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <span className="hidden sm:block" />
                  )}
                </>
              )}
              <button className="btn-coral h-[42px] px-6" onClick={search}>
                {tab === 'food' ? 'Order now' : 'Search'} <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      <Section title="Everything you need on the island" subtitle="Three trusted local partners, one booking app.">
        <div className="grid gap-4 md:grid-cols-3">
          {Object.values(BRANDS).map((b) => (
            <Link key={b.id} to={b.path} className="card group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
              <div className={`relative h-32 bg-gradient-to-br ${b.gradient}`}>
                <Waves />
                <span className="absolute left-4 top-4 chip bg-white/90 text-slate-800">{b.service}</span>
              </div>
              <div className="flex items-start gap-3 p-4">
                <BrandMark brand={b.id} />
                <div className="flex-1">
                  <h3 className="font-extrabold text-slate-900 group-hover:text-sea-700">{b.name}</h3>
                  <p className="text-sm text-slate-500">{b.tagline}</p>
                  <div className="mt-2"><Rating value={b.rating} count={b.reviews} /></div>
                </div>
                <ArrowRight size={18} className="mt-1 text-slate-300 transition group-hover:translate-x-1 group-hover:text-sea-600" />
              </div>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Popular at Pahuway Cafe" subtitle="Delivered hot to your hotel or beach spot." action={<Link to="/food" className="text-sm font-bold text-sea-700">See menu →</Link>}>
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
          {MENU.filter((m) => m.tags?.includes('Bestseller')).map((m) => (
            <Link key={m.id} to="/food" className="card w-44 shrink-0 snap-start p-4 transition hover:shadow-md">
              <div className="flex h-20 items-center justify-center rounded-xl bg-sand-100 text-4xl">{m.emoji}</div>
              <p className="mt-3 line-clamp-1 text-sm font-bold">{m.name}</p>
              <p className="text-sm font-semibold text-cafe-700">{peso(m.price)}</p>
            </Link>
          ))}
        </div>
      </Section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-4 md:grid-cols-2">
        <Link to="/stays" className="card group relative overflow-hidden p-6">
          <div className={`absolute inset-0 bg-gradient-to-br ${ROOMS[1].gradient} opacity-90`} />
          <div className="relative text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-white/80">Hiraya Beach House</p>
            <h3 className="mt-1 text-2xl font-extrabold">Beachfront rooms from {peso(Math.min(...ROOMS.map((r) => r.pricePerNight)))}/night</h3>
            <p className="mt-1 text-white/85">Breakfast included. Free food delivery from Pahuway for guests.</p>
            <span className="btn mt-4 bg-white text-sea-800">Check availability <ArrowRight size={16} /></span>
          </div>
        </Link>
        <Link to="/scooters" className="card group relative overflow-hidden p-6">
          <div className="absolute inset-0 bg-gradient-to-br from-sea-800 to-sea-500 opacity-95" />
          <div className="relative text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-white/80">Baybayin Scooter Rental</p>
            <h3 className="mt-1 text-2xl font-extrabold">Scooters from {peso(Math.min(...SCOOTERS.map((s) => s.pricePerDay)))}/day</h3>
            <p className="mt-1 text-white/85">Helmets included. 15% off weekly rentals. Free drop-off in town.</p>
            <span className="btn mt-4 bg-white text-sea-800">Reserve a ride <ArrowRight size={16} /></span>
          </div>
        </Link>
      </section>

      <Section title="Explore Romblon" subtitle="Ride there on a Baybayin scooter — most spots are under 30 minutes from town.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {ROMBLON_SPOTS.map((s) => (
            <div key={s.name} className="card flex items-start gap-3 p-4">
              <span className="text-3xl">{s.emoji}</span>
              <div>
                <p className="font-bold">{s.name}</p>
                <p className="text-sm text-slate-500">{s.blurb}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Why book with Tara Romblon">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: CalendarDays, t: 'One trip, one checkout', d: 'Stay, scooter and food in a single cart.' },
            { icon: CreditCard, t: 'Pay your way', d: 'GCash, Maya, card, or cash on arrival.' },
            { icon: ShieldCheck, t: 'Verified local partners', d: 'Real businesses based in Romblon town.' },
            { icon: Truck, t: 'Live order tracking', d: 'Know when your food or scooter is on its way.' },
          ].map((f) => (
            <div key={f.t} className="card p-5">
              <f.icon className="text-sea-600" />
              <p className="mt-3 font-bold">{f.t}</p>
              <p className="text-sm text-slate-500">{f.d}</p>
            </div>
          ))}
        </div>
      </Section>
    </>
  )
}
