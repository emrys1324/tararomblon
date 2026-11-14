import { ArrowRight, Ban, ClipboardList, TrendingUp, Wallet } from 'lucide-react'
import { useState } from 'react'
import { BrandMark, EmptyState, StatusBadge } from '../components/ui'
import { BRANDS, type BrandId } from '../data/catalog'
import { peso, prettyDateTime, toISODate } from '../lib/format'
import { useStore } from '../store/AppStore'
import { STATUS_FLOW, STATUS_LABEL } from '../store/types'
import { LineSummary } from './Cart'

// Partner (merchant) console. In production each brand logs in and sees only its own orders.
export default function Partner() {
  const { orders, setStatus, notify, resetDemo } = useStore()
  const [brand, setBrand] = useState<BrandId>('pahuway')
  const [filter, setFilter] = useState<'open' | 'all'>('open')

  const mine = orders.filter((o) => o.brand === brand)
  const flow = STATUS_FLOW[brand]
  const open = mine.filter((o) => o.status !== 'cancelled' && o.status !== flow[flow.length - 1])
  const list = filter === 'open' ? open : mine
  const todayStr = toISODate(new Date())
  const todays = mine.filter((o) => toISODate(new Date(o.createdAt)) === todayStr && o.status !== 'cancelled')
  const revenue = mine.filter((o) => o.status !== 'cancelled').reduce((n, o) => n + o.total, 0)
  const commission = Math.round(revenue * 0.1)

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Partner console</p>
          <h1 className="text-2xl font-extrabold">Manage orders & bookings</h1>
        </div>
        <button className="text-xs font-semibold text-slate-400 hover:text-red-600" onClick={() => { if (confirm('Clear all demo data?')) resetDemo() }}>Reset demo data</button>
      </div>

      <div className="mb-5 grid gap-2 sm:grid-cols-3">
        {(Object.keys(BRANDS) as BrandId[]).map((b) => (
          <button key={b} onClick={() => setBrand(b)} className={`card flex items-center gap-3 p-3 text-left transition ${brand === b ? 'ring-2 ring-sea-500' : 'opacity-70 hover:opacity-100'}`}>
            <BrandMark brand={b} size="sm" />
            <div>
              <p className="text-sm font-bold">{BRANDS[b].name}</p>
              <p className="text-xs text-slate-500">{orders.filter((o) => o.brand === b && o.status !== 'cancelled' && o.status !== STATUS_FLOW[b][STATUS_FLOW[b].length - 1]).length} open</p>
            </div>
          </button>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { icon: ClipboardList, label: 'Open', value: String(open.length) },
          { icon: TrendingUp, label: 'New today', value: String(todays.length) },
          { icon: Wallet, label: 'Gross sales', value: peso(revenue) },
          { icon: Wallet, label: 'Est. payout (after 10%)', value: peso(revenue - commission) },
        ].map((k) => (
          <div key={k.label} className="card p-4">
            <k.icon size={18} className="text-sea-600" />
            <p className="mt-2 text-xl font-extrabold tabular-nums">{k.value}</p>
            <p className="text-xs text-slate-500">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="mb-3 flex gap-2">
        {(['open', 'all'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`chip px-3 py-1.5 text-sm ${filter === f ? 'bg-sea-700 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
            {f === 'open' ? 'Needs action' : 'All'}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<ClipboardList size={40} />} title="Nothing here yet" text="Place a booking from the customer side (in another tab works too) and it will appear here in real time." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((o) => {
            const i = flow.indexOf(o.status)
            const next = i >= 0 && i < flow.length - 1 ? flow[i + 1] : null
            return (
              <div key={o.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{o.id} <span className="font-normal text-slate-400">· {prettyDateTime(o.createdAt)}</span></p>
                    <p className="text-sm text-slate-600">{o.customer.name} · {o.customer.phone}</p>
                  </div>
                  <StatusBadge status={o.status} />
                </div>
                <div className="my-3 space-y-2 rounded-xl bg-sand-50 p-3">
                  {o.lines.map((l) => (
                    <div key={l.key} className="flex gap-2 text-sm">
                      {l.kind === 'food' && <span className="font-bold">{l.qty}×</span>}
                      <LineSummary line={l} />
                    </div>
                  ))}
                  {o.address && <p className="text-xs text-slate-600">📍 {o.deliveryZone} — {o.address}{o.deliveryNotes && ` · “${o.deliveryNotes}”`}</p>}
                  {o.licenseNo && <p className="text-xs text-slate-600">🪪 License {o.licenseNo}</p>}
                  {o.specialRequests && <p className="text-xs text-slate-600">📝 {o.specialRequests}</p>}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm"><b>{peso(o.total)}</b> <span className="text-slate-500">· {o.paid ? 'Paid' : 'Collect on site'}</span></p>
                  <div className="flex gap-2">
                    {o.status === flow[0] && (
                      <button className="btn-ghost px-3 py-2 text-red-600" onClick={() => { setStatus(o.id, 'cancelled'); notify(`${o.id} declined`) }} aria-label="Decline"><Ban size={16} /></button>
                    )}
                    {next && (
                      <button className="btn-primary px-3 py-2" onClick={() => { setStatus(o.id, next); notify(`${o.id} → ${STATUS_LABEL[next]}`) }}>
                        {STATUS_LABEL[next]} <ArrowRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
