import type { BrandId } from '../data/catalog'

export interface FoodLine {
  kind: 'food'
  key: string
  itemId: string
  name: string
  emoji: string
  option?: string
  unitPrice: number
  qty: number
}

export interface ScooterLine {
  kind: 'scooter'
  key: string
  scooterId: string
  name: string
  start: string
  end: string
  days: number
  qty: number
  addons: string[]
  pickup: string
  pickupTime: string
  total: number
}

export interface StayLine {
  kind: 'stay'
  key: string
  roomId: string
  name: string
  checkIn: string
  checkOut: string
  nights: number
  guests: number
  total: number
}

export type CartLine = FoodLine | ScooterLine | StayLine

export type PaymentMethod = 'gcash' | 'maya' | 'card' | 'cash'

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  gcash: 'GCash',
  maya: 'Maya',
  card: 'Credit / debit card',
  cash: 'Cash on delivery / arrival',
}

export type FoodStatus = 'placed' | 'preparing' | 'on_the_way' | 'delivered' | 'cancelled'
export type ScooterStatus = 'confirmed' | 'picked_up' | 'returned' | 'cancelled'
export type StayStatus = 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'
export type OrderStatus = FoodStatus | ScooterStatus | StayStatus

export const STATUS_FLOW: Record<BrandId, OrderStatus[]> = {
  pahuway: ['placed', 'preparing', 'on_the_way', 'delivered'],
  baybayin: ['confirmed', 'picked_up', 'returned'],
  hiraya: ['confirmed', 'checked_in', 'checked_out'],
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: 'Order placed',
  preparing: 'Preparing',
  on_the_way: 'Rider on the way',
  delivered: 'Delivered',
  confirmed: 'Confirmed',
  picked_up: 'Scooter picked up',
  returned: 'Returned',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  cancelled: 'Cancelled',
}

export interface Customer {
  name: string
  phone: string
  email: string
}

export interface Order {
  id: string
  checkoutRef: string
  brand: BrandId
  createdAt: number
  status: OrderStatus
  history: { status: OrderStatus; at: number }[]
  customer: Customer
  payment: PaymentMethod
  paid: boolean
  subtotal: number
  fees: { label: string; amount: number }[]
  total: number
  lines: CartLine[]
  // food
  deliveryZone?: string
  address?: string
  deliveryNotes?: string
  // stay
  specialRequests?: string
  arrivalTime?: string
  // scooter
  licenseNo?: string
  review?: { rating: number; text: string }
}
