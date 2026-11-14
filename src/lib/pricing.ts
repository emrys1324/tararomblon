import {
  EXTRA_GUEST_FEE,
  ROOMS,
  SCOOTERS,
  SCOOTER_ADDONS,
  PICKUP_POINTS,
  type Room,
} from '../data/catalog'
import type { Order } from '../store/types'
import { addDays, parseISODate, rangesOverlap, toISODate } from './format'

export function scooterTotal(scooterId: string, days: number, qty: number, addons: string[], pickup: string) {
  const s = SCOOTERS.find((x) => x.id === scooterId)!
  const base = s.pricePerDay * days * qty
  // Weekly discount: 7+ days → 15% off the base rate
  const discount = days >= 7 ? Math.round(base * 0.15) : 0
  const addonTotal = addons.reduce((sum, id) => {
    const a = SCOOTER_ADDONS.find((x) => x.id === id)
    if (!a) return sum
    return sum + (a.per === 'day' ? a.price * days : a.price) * qty
  }, 0)
  const pickupFee = PICKUP_POINTS.find((p) => p.name === pickup)?.fee ?? 0
  return { base, discount, addonTotal, pickupFee, total: base - discount + addonTotal + pickupFee }
}

export function stayTotal(room: Room, nights: number, guests: number) {
  const base = room.pricePerNight * nights
  const extraGuests = room.id === 'h4' ? 0 : Math.max(0, guests - 2)
  const extra = extraGuests * EXTRA_GUEST_FEE * nights
  return { base, extra, total: base + extra }
}

const active = (o: Order) => o.status !== 'cancelled'

/** Units of a scooter still free for every day in [start, end). */
export function scootersAvailable(scooterId: string, start: string, end: string, orders: Order[]) {
  const s = SCOOTERS.find((x) => x.id === scooterId)!
  let worst = 0
  for (let d = start; d < end; d = addDays(d, 1)) {
    let used = 0
    for (const o of orders.filter(active)) {
      for (const l of o.lines) {
        if (l.kind === 'scooter' && l.scooterId === scooterId && rangesOverlap(l.start, l.end, d, addDays(d, 1))) used += l.qty
      }
    }
    worst = Math.max(worst, used)
  }
  return Math.max(0, s.units - worst)
}

// Seeded "already booked" nights so the calendar feels real in the demo.
function seededBlocked(roomId: string, date: string) {
  const d = parseISODate(date)
  const n = d.getDate() * 7 + d.getMonth() * 13 + roomId.charCodeAt(1) * 3
  const room = ROOMS.find((r) => r.id === roomId)!
  // Whole house is blocked on most weekends; others ~1 in 9 nights
  if (roomId === 'h4') return d.getDay() === 6 && n % 3 !== 0 ? 1 : 0
  return n % 9 === 0 ? room.units : 0
}

export function roomUnitsFree(roomId: string, date: string, orders: Order[]) {
  const room = ROOMS.find((r) => r.id === roomId)!
  let used = seededBlocked(roomId, date)
  for (const o of orders.filter(active)) {
    for (const l of o.lines) {
      if (l.kind === 'stay' && (l.roomId === roomId || l.roomId === 'h4' || roomId === 'h4') && l.checkIn <= date && date < l.checkOut) {
        // Whole-house booking takes every room; any room booking blocks the whole house
        used += l.roomId === roomId ? 1 : roomId === 'h4' ? 1 : room.units
      }
    }
  }
  return Math.max(0, room.units - used)
}

export function roomAvailable(roomId: string, checkIn: string, checkOut: string, orders: Order[]) {
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) {
    if (roomUnitsFree(roomId, d, orders) <= 0) return false
  }
  return true
}

export const nextDays = (start: Date, n: number) =>
  Array.from({ length: n }, (_, i) => toISODate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)))
