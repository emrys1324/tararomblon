import { Bike, Coffee, Home as HomeIcon, Minus, Plus, Star } from 'lucide-react'
import type { ReactNode } from 'react'
import { BRANDS, type BrandId } from '../data/catalog'
import { STATUS_LABEL, type OrderStatus } from '../store/types'

export const BRAND_ICON: Record<BrandId, typeof Coffee> = {
  pahuway: Coffee,
  baybayin: Bike,
  hiraya: HomeIcon,
}

export function BrandMark({ brand, size = 'md' }: { brand: BrandId; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = BRAND_ICON[brand]
  const dims = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-14 w-14' : 'h-10 w-10'
  const icon = size === 'sm' ? 16 : size === 'lg' ? 28 : 20
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white ${BRANDS[brand].gradient} ${dims}`}>
      <Icon size={icon} />
    </span>
  )
}

export function Rating({ value, count }: { value: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm font-semibold">
      <Star size={14} className="fill-amber-400 text-amber-400" />
      {value.toFixed(1)}
      {count !== undefined && <span className="font-normal text-slate-500">({count})</span>}
    </span>
  )
}

const STATUS_COLOR: Partial<Record<OrderStatus, string>> = {
  placed: 'bg-amber-100 text-amber-800',
  preparing: 'bg-amber-100 text-amber-800',
  on_the_way: 'bg-sky-100 text-sky-800',
  confirmed: 'bg-sea-100 text-sea-800',
  picked_up: 'bg-sky-100 text-sky-800',
  checked_in: 'bg-sky-100 text-sky-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  returned: 'bg-emerald-100 text-emerald-800',
  checked_out: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-200 text-slate-600',
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`chip ${STATUS_COLOR[status] ?? 'bg-slate-100'}`}>{STATUS_LABEL[status]}</span>
}

export function QtyStepper({ value, onChange, min = 0, max = 99 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white">
      <button type="button" aria-label="Decrease" className="p-2 text-slate-600 hover:text-sea-700 disabled:opacity-30" disabled={value <= min} onClick={() => onChange(value - 1)}>
        <Minus size={16} />
      </button>
      <span className="w-7 text-center text-sm font-bold tabular-nums">{value}</span>
      <button type="button" aria-label="Increase" className="p-2 text-slate-600 hover:text-sea-700 disabled:opacity-30" disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Plus size={16} />
      </button>
    </div>
  )
}

export function BrandHero({ brand, children }: { brand: BrandId; children?: ReactNode }) {
  const b = BRANDS[brand]
  return (
    <section className={`relative overflow-hidden bg-gradient-to-br ${b.gradient} text-white`}>
      <Waves />
      <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-8 sm:pt-12">
        <div className="flex items-center gap-3">
          <BrandMark brand={brand} size="lg" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/80">{b.service}</p>
            <h1 className="text-2xl font-extrabold sm:text-3xl">{b.name}</h1>
          </div>
        </div>
        <p className="mt-3 max-w-xl text-white/90">{b.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-white/90">
          <span className="chip bg-white/20 text-white">
            <Star size={12} className="fill-white" /> {b.rating} · {b.reviews} reviews
          </span>
          <span className="chip bg-white/20 text-white">{b.hours}</span>
        </div>
        {children}
      </div>
    </section>
  )
}

export function Waves({ className = '' }: { className?: string }) {
  return (
    <svg className={`pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full opacity-20 ${className}`} viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden>
      <path d="M0 60c150-40 300-40 450 0s300 40 450 0 225-30 300-10v70H0z" fill="white" />
      <path d="M0 90c200-30 400-30 600 0s400 30 600 0v30H0z" fill="white" opacity=".6" />
    </svg>
  )
}

export function Section({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 sm:text-2xl">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Modal({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title: string }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="text-lg font-extrabold">{title}</h3>
          <button className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 text-sea-600">{icon}</div>
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Row({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={`flex justify-between gap-4 ${className}`}>
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  )
}
