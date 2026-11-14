import { Plus, Search, ShoppingBag } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BrandHero, Modal, QtyStepper } from '../components/ui'
import { MENU, MENU_CATEGORIES, MIN_FOOD_ORDER, type MenuItem } from '../data/catalog'
import { peso } from '../lib/format'
import { useStore } from '../store/AppStore'

export default function Food() {
  const { cart, addToCart, notify } = useStore()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('All')
  const [picked, setPicked] = useState<MenuItem | null>(null)
  const [option, setOption] = useState(0)
  const [qty, setQty] = useState(1)

  const items = useMemo(
    () =>
      MENU.filter((m) => (cat === 'All' || m.category === cat) && (m.name + m.description).toLowerCase().includes(q.toLowerCase())),
    [q, cat],
  )
  const foodLines = cart.filter((l) => l.kind === 'food')
  const foodCount = foodLines.reduce((n, l) => n + l.qty, 0)
  const foodSubtotal = foodLines.reduce((n, l) => n + l.unitPrice * l.qty, 0)

  const open = (m: MenuItem) => {
    setPicked(m)
    setOption(0)
    setQty(1)
  }

  const quickAdd = (m: MenuItem) => {
    if (m.options) return open(m)
    add(m, undefined, 1)
  }

  const add = (m: MenuItem, optIdx: number | undefined, n: number) => {
    const choice = optIdx !== undefined && m.options ? m.options.choices[optIdx] : undefined
    addToCart({
      kind: 'food',
      key: m.id + (choice ? ':' + choice.name : ''),
      itemId: m.id,
      name: m.name,
      emoji: m.emoji,
      option: choice?.name,
      unitPrice: m.price + (choice?.delta ?? 0),
      qty: n,
    })
    notify(`Added ${n} × ${m.name}`)
    setPicked(null)
  }

  const grouped = MENU_CATEGORIES.map((c) => ({ c, list: items.filter((i) => i.category === c) })).filter((g) => g.list.length)

  return (
    <>
      <BrandHero brand="pahuway">
        <div className="mt-6 flex max-w-md items-center gap-2 rounded-2xl bg-white px-3 text-slate-800 shadow-lg">
          <Search size={18} className="text-slate-400" />
          <input className="w-full bg-transparent py-3 text-sm outline-none" placeholder="Search coffee, silog, desserts…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </BrandHero>

      <div className="sticky top-16 z-30 border-b border-slate-200 bg-sand-50/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3">
          {['All', ...MENU_CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`chip shrink-0 px-4 py-2 text-sm ${cat === c ? 'bg-cafe-700 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
          🛵 Minimum order {peso(MIN_FOOD_ORDER)} · Delivery fee from ₱40 · <b>Free delivery</b> for Hiraya Beach House guests
        </div>

        {grouped.length === 0 && <p className="py-16 text-center text-slate-500">No items match “{q}”.</p>}

        {grouped.map(({ c, list }) => (
          <section key={c} className="mb-8">
            <h2 className="mb-3 text-lg font-extrabold">{c}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((m) => (
                <div key={m.id} className="card flex gap-3 p-3 transition hover:shadow-md">
                  <button onClick={() => open(m)} className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-sand-100 text-5xl" aria-label={`View ${m.name}`}>
                    {m.emoji}
                  </button>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <button onClick={() => open(m)} className="text-left">
                      <p className="font-bold leading-tight">{m.name}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{m.description}</p>
                    </button>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {m.tags?.map((t) => (
                        <span key={t} className={`chip px-2 py-0.5 text-[10px] ${t === 'Bestseller' ? 'bg-coral-500/10 text-coral-600' : t === 'Spicy' ? 'bg-red-50 text-red-600' : t === 'New' ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {t}
                        </span>
                      ))}
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <span className="font-extrabold text-cafe-700">{peso(m.price)}</span>
                      <button onClick={() => quickAdd(m)} className="rounded-full bg-cafe-700 p-1.5 text-white hover:bg-cafe-600" aria-label={`Add ${m.name}`}>
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {foodCount > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-30 px-4 md:bottom-6">
          <Link to="/cart" className="mx-auto flex max-w-md items-center justify-between rounded-2xl bg-cafe-700 px-5 py-3.5 text-white shadow-xl hover:bg-cafe-600">
            <span className="flex items-center gap-2 font-bold">
              <ShoppingBag size={18} /> {foodCount} item{foodCount > 1 ? 's' : ''}
            </span>
            <span className="font-extrabold">View cart · {peso(foodSubtotal)}</span>
          </Link>
        </div>
      )}

      <Modal open={!!picked} onClose={() => setPicked(null)} title={picked?.name ?? ''}>
        {picked && (
          <>
            <div className="flex h-40 items-center justify-center rounded-2xl bg-sand-100 text-7xl">{picked.emoji}</div>
            <p className="mt-4 text-sm text-slate-600">{picked.description}</p>
            {picked.options && (
              <div className="mt-4">
                <p className="label">{picked.options.label}</p>
                <div className="grid grid-cols-2 gap-2">
                  {picked.options.choices.map((ch, i) => (
                    <button key={ch.name} onClick={() => setOption(i)} className={`rounded-xl border p-3 text-left text-sm ${option === i ? 'border-cafe-700 bg-amber-50 font-bold' : 'border-slate-200'}`}>
                      {ch.name}
                      <span className="block text-xs text-slate-500">{ch.delta ? `+${peso(ch.delta)}` : 'Included'}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-6 flex items-center gap-3">
              <QtyStepper value={qty} onChange={setQty} min={1} />
              <button className="btn flex-1 bg-cafe-700 text-white hover:bg-cafe-600" onClick={() => add(picked, picked.options ? option : undefined, qty)}>
                Add to cart · {peso((picked.price + (picked.options?.choices[option].delta ?? 0)) * qty)}
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}
