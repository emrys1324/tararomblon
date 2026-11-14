import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Account from './pages/Account'
import Cart from './pages/Cart'
import Food from './pages/Food'
import Home from './pages/Home'
import Partner from './pages/Partner'
import Scooters from './pages/Scooters'
import Stays from './pages/Stays'
import Trips, { TripDetail } from './pages/Trips'
import { AppStoreProvider } from './store/AppStore'

export default function App() {
  return (
    <AppStoreProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="food" element={<Food />} />
            <Route path="scooters" element={<Scooters />} />
            <Route path="stays" element={<Stays />} />
            <Route path="cart" element={<Cart />} />
            <Route path="trips" element={<Trips />} />
            <Route path="trips/:id" element={<TripDetail />} />
            <Route path="account" element={<Account />} />
            <Route path="partner" element={<Partner />} />
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppStoreProvider>
  )
}
