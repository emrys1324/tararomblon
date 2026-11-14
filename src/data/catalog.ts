// Demo catalog for the three launch partners. In production this comes from the API / partner CMS.

export type BrandId = 'pahuway' | 'baybayin' | 'hiraya'

export interface Brand {
  id: BrandId
  name: string
  service: 'Food delivery' | 'Scooter rental' | 'Accommodation'
  tagline: string
  description: string
  path: string
  hours: string
  rating: number
  reviews: number
  gradient: string
  accent: string
}

export const BRANDS: Record<BrandId, Brand> = {
  pahuway: {
    id: 'pahuway',
    name: 'Pahuway Cafe',
    service: 'Food delivery',
    tagline: 'Island comfort food & coffee, delivered',
    description:
      '“Pahuway” means to rest. Brewed coffee, all-day silog, and Romblon-style merienda delivered to your hotel, beach or home.',
    path: '/food',
    hours: '7:00 AM – 9:00 PM daily',
    rating: 4.8,
    reviews: 312,
    gradient: 'from-amber-700 via-orange-600 to-coral-400',
    accent: 'text-cafe-700',
  },
  baybayin: {
    id: 'baybayin',
    name: 'Baybayin Scooter Rental',
    service: 'Scooter rental',
    tagline: 'Ride the coast at your own pace',
    description:
      'Well-maintained automatic scooters with helmets, island map and roadside assistance. Free drop-off within Romblon town proper.',
    path: '/scooters',
    hours: 'Pick-up 7:00 AM – 6:00 PM',
    rating: 4.9,
    reviews: 187,
    gradient: 'from-sea-800 via-sea-600 to-sea-300',
    accent: 'text-sea-700',
  },
  hiraya: {
    id: 'hiraya',
    name: 'Hiraya Beach House',
    service: 'Accommodation',
    tagline: 'Wake up to the sound of the sea',
    description:
      'A small beachfront house with garden rooms, sea-view suites and a whole-house option for barkadas and families.',
    path: '/stays',
    hours: 'Check-in 2:00 PM · Check-out 12:00 NN',
    rating: 4.9,
    reviews: 241,
    gradient: 'from-sky-700 via-sea-500 to-amber-200',
    accent: 'text-sky-700',
  },
}

// ---------- Pahuway Cafe ----------
export interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  category: string
  emoji: string
  tags?: ('Bestseller' | 'New' | 'Spicy' | 'Vegetarian')[]
  options?: { label: string; choices: { name: string; delta: number }[] }
}

export const MENU_CATEGORIES = ['Coffee', 'Non-coffee', 'All-day breakfast', 'Rice meals', 'Merienda', 'Desserts']

export const MENU: MenuItem[] = [
  { id: 'c1', name: 'Pahuway Iced Latte', description: 'Double shot espresso, fresh milk, muscovado syrup.', price: 140, category: 'Coffee', emoji: '🧋', tags: ['Bestseller'], options: { label: 'Size', choices: [{ name: '16 oz', delta: 0 }, { name: '22 oz', delta: 30 }] } },
  { id: 'c2', name: 'Kapeng Barako', description: 'Strong Batangas barako, brewed hot. Best with pandesal.', price: 90, category: 'Coffee', emoji: '☕' },
  { id: 'c3', name: 'Spanish Latte', description: 'Sweetened condensed milk, espresso and milk over ice.', price: 155, category: 'Coffee', emoji: '🥛', options: { label: 'Size', choices: [{ name: '16 oz', delta: 0 }, { name: '22 oz', delta: 30 }] } },
  { id: 'c4', name: 'Sea Salt Cold Brew', description: '18-hour cold brew topped with sea salt cream.', price: 170, category: 'Coffee', emoji: '🌊', tags: ['New'] },
  { id: 'n1', name: 'Calamansi Honey Cooler', description: 'Fresh calamansi, wild honey, soda water and mint.', price: 110, category: 'Non-coffee', emoji: '🍋', tags: ['Bestseller'] },
  { id: 'n2', name: 'Ube Milk', description: 'Real ube halaya blended with cold milk.', price: 130, category: 'Non-coffee', emoji: '💜' },
  { id: 'n3', name: 'Fresh Buko Shake', description: 'Young coconut meat and juice, blended.', price: 120, category: 'Non-coffee', emoji: '🥥', tags: ['Vegetarian'] },
  { id: 'b1', name: 'Tapsilog', description: 'House-cured beef tapa, garlic rice, sunny-side egg, atchara.', price: 220, category: 'All-day breakfast', emoji: '🍳', tags: ['Bestseller'] },
  { id: 'b2', name: 'Danggitsilog', description: 'Crispy danggit, garlic rice, egg, spiced vinegar.', price: 210, category: 'All-day breakfast', emoji: '🐟' },
  { id: 'b3', name: 'Longsilog', description: 'Sweet longganisa, garlic rice and egg.', price: 195, category: 'All-day breakfast', emoji: '🌭' },
  { id: 'b4', name: 'Island Pancake Stack', description: 'Fluffy pancakes, mango, coconut caramel.', price: 185, category: 'All-day breakfast', emoji: '🥞', tags: ['Vegetarian'] },
  { id: 'r1', name: 'Kinilaw na Tanigue', description: 'Fresh tanigue cured in coconut vinegar, ginger and chili.', price: 260, category: 'Rice meals', emoji: '🐠', tags: ['Spicy'] },
  { id: 'r2', name: 'Chicken Adobo sa Gata', description: 'Adobo slow-cooked in coconut milk. Served with rice.', price: 240, category: 'Rice meals', emoji: '🍗', tags: ['Bestseller'] },
  { id: 'r3', name: 'Grilled Liempo Plate', description: 'Char-grilled pork belly, ensaladang talong, rice.', price: 265, category: 'Rice meals', emoji: '🥩' },
  { id: 'r4', name: 'Pinakbet Bowl', description: 'Vegetables in light bagoong sauce over brown rice.', price: 190, category: 'Rice meals', emoji: '🥬', tags: ['Vegetarian'] },
  { id: 'm1', name: 'Pancit Canton Guisado', description: 'Good for 2–3. Veggies, pork and shrimp.', price: 280, category: 'Merienda', emoji: '🍜' },
  { id: 'm2', name: 'Turon a la Mode', description: 'Banana-langka spring rolls with vanilla ice cream.', price: 120, category: 'Merienda', emoji: '🍌' },
  { id: 'm3', name: 'Ensaymada', description: 'Buttery brioche, cheese and sugar.', price: 75, category: 'Merienda', emoji: '🥐' },
  { id: 'd1', name: 'Mango Float Cup', description: 'Graham, cream and Guimaras-style sweet mango.', price: 130, category: 'Desserts', emoji: '🥭', tags: ['Bestseller'] },
  { id: 'd2', name: 'Halo-halo Espesyal', description: 'Shaved ice, leche flan, ube, beans and pinipig.', price: 165, category: 'Desserts', emoji: '🍧' },
]

export interface DeliveryZone {
  name: string
  fee: number
  eta: string
}

export const DELIVERY_ZONES: DeliveryZone[] = [
  { name: 'Poblacion (Town proper)', fee: 40, eta: '20–30 min' },
  { name: 'Capaclan', fee: 50, eta: '25–35 min' },
  { name: 'Lonos', fee: 60, eta: '30–40 min' },
  { name: 'Bagacay', fee: 70, eta: '30–45 min' },
  { name: 'Agnay', fee: 80, eta: '35–45 min' },
  { name: 'Ginablan', fee: 90, eta: '35–50 min' },
  { name: 'Lamao', fee: 100, eta: '40–55 min' },
  { name: 'Li-o', fee: 110, eta: '45–60 min' },
  { name: 'Hiraya Beach House (guests)', fee: 0, eta: '30–40 min' },
]

export const MIN_FOOD_ORDER = 200

// ---------- Baybayin Scooter Rental ----------
export interface Scooter {
  id: string
  model: string
  cc: number
  pricePerDay: number
  units: number
  seats: number
  features: string[]
  color: string
}

export const SCOOTERS: Scooter[] = [
  { id: 's1', model: 'Honda Beat 110', cc: 110, pricePerDay: 400, units: 6, seats: 2, features: ['Fuel-efficient', 'Light & easy', 'Best for beginners'], color: 'bg-rose-500' },
  { id: 's2', model: 'Yamaha Mio i125', cc: 125, pricePerDay: 450, units: 5, seats: 2, features: ['Under-seat storage', 'Smooth CVT', 'USB charger'], color: 'bg-sky-500' },
  { id: 's3', model: 'Honda Click 125i', cc: 125, pricePerDay: 500, units: 6, seats: 2, features: ['Island favorite', 'Big compartment', 'Idle stop'], color: 'bg-slate-700' },
  { id: 's4', model: 'Yamaha NMAX 155', cc: 155, pricePerDay: 800, units: 3, seats: 2, features: ['ABS brakes', 'Comfort for 2', 'Smart key'], color: 'bg-indigo-600' },
  { id: 's5', model: 'Honda ADV 160', cc: 160, pricePerDay: 1000, units: 2, seats: 2, features: ['Adventure-ready', 'Dual shocks', 'ABS'], color: 'bg-emerald-600' },
]

export interface AddOn {
  id: string
  name: string
  price: number
  per: 'day' | 'booking'
}

export const SCOOTER_ADDONS: AddOn[] = [
  { id: 'helmet', name: 'Extra helmet (passenger)', price: 50, per: 'day' },
  { id: 'insurance', name: 'Damage protection', price: 100, per: 'day' },
  { id: 'tank', name: 'Full tank on pick-up', price: 250, per: 'booking' },
  { id: 'holder', name: 'Phone holder + powerbank', price: 60, per: 'day' },
]

export const PICKUP_POINTS = [
  { name: 'Baybayin shop – Romblon Port area', fee: 0 },
  { name: 'Hiraya Beach House', fee: 0 },
  { name: 'Hotel / home in Poblacion', fee: 0 },
  { name: 'Hotel outside town proper', fee: 150 },
]

export const SCOOTER_DEPOSIT = 1000

// ---------- Hiraya Beach House ----------
export interface Room {
  id: string
  name: string
  pricePerNight: number
  maxGuests: number
  beds: string
  size: string
  description: string
  amenities: string[]
  gradient: string
  units: number
}

export const ROOMS: Room[] = [
  { id: 'h1', name: 'Kubo Garden Room', pricePerNight: 2200, maxGuests: 2, beds: '1 queen bed', size: '18 m²', description: 'A bamboo-and-wood room tucked in the garden, steps from the sand. Fan + aircon, private toilet and bath.', amenities: ['Aircon', 'Wi-Fi', 'Hot shower', 'Breakfast for 2'], gradient: 'from-emerald-700 to-lime-300', units: 3 },
  { id: 'h2', name: 'Sea-view Deluxe', pricePerNight: 3500, maxGuests: 3, beds: '1 king + 1 daybed', size: '28 m²', description: 'Second-floor room with a private balcony facing the sunrise over Tablas Strait.', amenities: ['Balcony', 'Aircon', 'Wi-Fi', 'Mini-fridge', 'Breakfast for 2'], gradient: 'from-sky-700 to-cyan-300', units: 2 },
  { id: 'h3', name: 'Family Suite', pricePerNight: 5200, maxGuests: 5, beds: '2 queen beds + 1 single', size: '42 m²', description: 'Two connected rooms with a small living area and kitchenette. Ideal for families.', amenities: ['Kitchenette', 'Aircon', 'Wi-Fi', 'Smart TV', 'Breakfast for 4'], gradient: 'from-amber-600 to-orange-200', units: 1 },
  { id: 'h4', name: 'Whole Beach House', pricePerNight: 12500, maxGuests: 12, beds: '5 rooms, 7 beds', size: 'Entire property', description: 'Book the whole house — garden, beachfront cabana, kitchen and grill. Perfect for barkada trips and events.', amenities: ['Private beach access', 'Full kitchen', 'Grill', 'Karaoke', 'Caretaker'], gradient: 'from-sea-800 to-coral-400', units: 1 },
]

export const EXTRA_GUEST_FEE = 600 // per guest per night above 2 (except whole house)

// ---------- Romblon guide ----------
export const ROMBLON_SPOTS = [
  { name: 'Bonbon Beach', blurb: 'Walk on a sandbar to Bangug Island at low tide.', emoji: '🏝️' },
  { name: 'Fort San Andres', blurb: '17th-century Spanish fort with views of the port.', emoji: '🏰' },
  { name: 'Marble showrooms', blurb: 'Romblon is the Marble Capital of the Philippines.', emoji: '🪨' },
  { name: 'Cobrador Island', blurb: 'Snorkel the clearest water in the province.', emoji: '🤿' },
  { name: 'Tiamban Beach', blurb: 'Quiet white-sand cove a short ride from town.', emoji: '🌅' },
  { name: 'St. Joseph Cathedral', blurb: 'Baroque coral-stone church in the town plaza.', emoji: '⛪' },
]
