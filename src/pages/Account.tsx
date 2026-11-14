import { LogOut, UserCircle2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { peso } from '../lib/format'
import { useStore } from '../store/AppStore'

export default function Account() {
  const { user, setUser, orders, notify } = useStore()
  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [email, setEmail] = useState(user?.email ?? '')

  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) return
    setUser({ name: name.trim(), phone: phone.trim(), email: email.trim() })
    notify(user ? 'Profile updated' : `Welcome, ${name.split(' ')[0]}!`)
  }

  const spent = orders.filter((o) => o.status !== 'cancelled').reduce((n, o) => n + o.total, 0)

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <div className="card p-6">
        <div className="mb-5 flex items-center gap-3">
          <UserCircle2 size={48} className="text-sea-600" />
          <div>
            <h1 className="text-xl font-extrabold">{user ? user.name : 'Sign in to Tara Romblon'}</h1>
            <p className="text-sm text-slate-500">{user ? `${orders.length} bookings · ${peso(spent)} spent` : 'One account for food, scooters and stays.'}</p>
          </div>
        </div>
        <form onSubmit={save} className="space-y-3">
          <input className="input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" placeholder="Mobile no. — we’ll text a one-time code" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
          <input className="input" type="email" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn-primary w-full">{user ? 'Save profile' : 'Continue'}</button>
          {!user && <p className="text-center text-xs text-slate-400">Demo: no OTP is sent. Data stays in this browser.</p>}
        </form>
        {user && (
          <div className="mt-5 flex justify-between border-t border-slate-100 pt-4 text-sm">
            <Link to="/trips" className="font-bold text-sea-700">View my trips →</Link>
            <button className="flex items-center gap-1 text-slate-500 hover:text-red-600" onClick={() => { setUser(null); setName(''); setPhone(''); setEmail('') }}>
              <LogOut size={14} /> Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
