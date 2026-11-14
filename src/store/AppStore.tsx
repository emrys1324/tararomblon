import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { BrandId } from '../data/catalog'
import type { CartLine, Customer, Order, OrderStatus } from './types'

// Demo persistence layer. Swap for API calls (see PROPOSAL.md → Phase 2) without touching pages.
const KEY = 'tararomblon:v1'

interface Persisted {
  user: Customer | null
  cart: CartLine[]
  orders: Order[]
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Persisted
  } catch {
    /* storage unavailable */
  }
  return { user: null, cart: [], orders: [] }
}

interface Toast {
  id: number
  text: string
}

interface Store extends Persisted {
  setUser: (u: Customer | null) => void
  addToCart: (line: CartLine) => void
  updateQty: (key: string, qty: number) => void
  removeLine: (key: string) => void
  clearCart: (kind?: CartLine['kind']) => void
  placeOrders: (orders: Order[]) => void
  setStatus: (orderId: string, status: OrderStatus) => void
  reviewOrder: (orderId: string, rating: number, text: string) => void
  resetDemo: () => void
  cartCount: number
  toast: Toast | null
  notify: (text: string) => void
}

const Ctx = createContext<Store | null>(null)

export const brandOfLine = (l: CartLine): BrandId =>
  l.kind === 'food' ? 'pahuway' : l.kind === 'scooter' ? 'baybayin' : 'hiraya'

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(load)
  const [toast, setToast] = useState<Toast | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* ignore */
    }
  }, [state])

  // Keep tabs in sync (e.g. partner dashboard open in a second tab).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setState(load())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const notify = useCallback((text: string) => {
    const id = Date.now()
    setToast({ id, text })
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 2600)
  }, [])

  const store = useMemo<Store>(() => {
    const patch = (fn: (s: Persisted) => Persisted) => setState(fn)
    return {
      ...state,
      toast,
      notify,
      cartCount: state.cart.reduce((n, l) => n + (l.kind === 'food' ? l.qty : 1), 0),
      setUser: (user) => patch((s) => ({ ...s, user })),
      addToCart: (line) =>
        patch((s) => {
          if (line.kind === 'food') {
            const existing = s.cart.find((l) => l.key === line.key)
            if (existing && existing.kind === 'food') {
              return { ...s, cart: s.cart.map((l) => (l.key === line.key && l.kind === 'food' ? { ...l, qty: l.qty + line.qty } : l)) }
            }
          }
          return { ...s, cart: [...s.cart, line] }
        }),
      updateQty: (key, qty) =>
        patch((s) => ({
          ...s,
          cart: qty <= 0 ? s.cart.filter((l) => l.key !== key) : s.cart.map((l) => (l.key === key && l.kind === 'food' ? { ...l, qty } : l)),
        })),
      removeLine: (key) => patch((s) => ({ ...s, cart: s.cart.filter((l) => l.key !== key) })),
      clearCart: (kind) => patch((s) => ({ ...s, cart: kind ? s.cart.filter((l) => l.kind !== kind) : [] })),
      placeOrders: (orders) => patch((s) => ({ ...s, cart: [], orders: [...orders, ...s.orders] })),
      setStatus: (orderId, status) =>
        patch((s) => ({
          ...s,
          orders: s.orders.map((o) =>
            o.id === orderId
              ? { ...o, status, paid: o.paid || status === 'delivered' || status === 'checked_out' || status === 'returned', history: [...o.history, { status, at: Date.now() }] }
              : o,
          ),
        })),
      reviewOrder: (orderId, rating, text) =>
        patch((s) => ({ ...s, orders: s.orders.map((o) => (o.id === orderId ? { ...o, review: { rating, text } } : o)) })),
      resetDemo: () => patch(() => ({ user: null, cart: [], orders: [] })),
    }
  }, [state, toast, notify])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore must be used inside AppStoreProvider')
  return s
}
