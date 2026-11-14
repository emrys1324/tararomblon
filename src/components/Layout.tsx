import { BedDouble, Bike, CalendarCheck, Coffee, Home, LayoutDashboard, ShoppingBag, User } from 'lucide-react'
import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useStore } from '../store/AppStore'

const NAV = [
  { to: '/food', label: 'Food', icon: Coffee },
  { to: '/scooters', label: 'Scooters', icon: Bike },
  { to: '/stays', label: 'Stays', icon: BedDouble },
  { to: '/trips', label: 'My Trips', icon: CalendarCheck },
]

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <img src="/favicon.svg" alt="" className="h-8 w-8" />
      <span className="text-lg font-extrabold tracking-tight text-sea-800">
        Tara<span className="text-coral-500">Romblon</span>
      </span>
    </Link>
  )
}

export default function Layout() {
  const { cartCount, user, toast } = useStore()
  const { pathname } = useLocation()
  const isPartner = pathname.startsWith('/partner')

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `rounded-xl px-3 py-2 text-sm font-semibold transition ${isActive ? 'bg-sea-50 text-sea-700' : 'text-slate-600 hover:text-sea-700'}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <Link to="/partner" className="hidden items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 hover:text-sea-700 sm:flex">
              <LayoutDashboard size={16} /> Partners
            </Link>
            <Link to="/account" className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-slate-600 hover:text-sea-700" aria-label="Account">
              <User size={20} />
              <span className="hidden sm:inline">{user ? user.name.split(' ')[0] : 'Sign in'}</span>
            </Link>
            <Link to="/cart" className="relative rounded-xl p-2 text-slate-600 hover:text-sea-700" aria-label={`Cart, ${cartCount} items`}>
              <ShoppingBag size={22} />
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-coral-500 px-1 text-[11px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>

      <footer className="hidden border-t border-slate-200 bg-white md:block">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm text-slate-500 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-3 max-w-sm">
              Your all-in-one island companion — order food, rent a scooter and book your beach stay in Romblon, with one account and one checkout.
            </p>
          </div>
          <div>
            <p className="mb-2 font-bold text-slate-700">Services</p>
            <ul className="space-y-1">
              <li><Link to="/food" className="hover:text-sea-700">Pahuway Cafe</Link></li>
              <li><Link to="/scooters" className="hover:text-sea-700">Baybayin Scooter Rental</Link></li>
              <li><Link to="/stays" className="hover:text-sea-700">Hiraya Beach House</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-2 font-bold text-slate-700">Help</p>
            <ul className="space-y-1">
              <li><Link to="/trips" className="hover:text-sea-700">Track an order</Link></li>
              <li><Link to="/partner" className="hover:text-sea-700">Partner dashboard</Link></li>
              <li>Romblon, Romblon · Philippines</li>
            </ul>
          </div>
        </div>
        <p className="border-t border-slate-100 py-4 text-center text-xs text-slate-400">© {new Date().getFullYear()} Tara Romblon · Demo build — no real payments are processed.</p>
      </footer>

      {!isPartner && (
        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          {[{ to: '/', label: 'Home', icon: Home }, ...NAV.slice(0, 3), { to: '/trips', label: 'Trips', icon: CalendarCheck }].map((n) => (
            <NavLink
              key={n.to + n.label}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${isActive ? 'text-sea-700' : 'text-slate-500'}`}
            >
              <n.icon size={20} />
              {n.label}
            </NavLink>
          ))}
        </nav>
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 md:bottom-8" role="status">
          <div className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg">{toast.text}</div>
        </div>
      )}
    </div>
  )
}
