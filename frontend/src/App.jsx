import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import axios from 'axios'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import { isLoggedIn, logout } from './services/authService'

function MapPage() {
  const [products, setProducts] = useState([])
  const [status, setStatus] = useState('Loading Copernicus products...')

  useEffect(() => {
    axios.get('http://localhost:8080/api/copernicus-products')
      .then(response => {
        setProducts(response.data)
        setStatus('Copernicus products loaded successfully')
      })
      .catch(error => {
        console.error(error)
        setStatus('Failed to load Copernicus products')
      })
  }, [])

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif' }}>
      <header style={{ padding: '20px', backgroundColor: '#f4f4f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0 }}>🌿 EcoFlow</h1>
          <p>{status}</p>
        </div>
        <button
          onClick={handleLogout}
          style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
        >
          Sign out
        </button>
      </header>

      <section style={{ height: '400px', width: '100%' }}>
        <MapContainer
          center={[46.5547, 15.6459]}
          zoom={7}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          />
          <Marker position={[46.5547, 15.6459]}>
            <Popup>EcoFlow - Slovenia environmental data prototype</Popup>
          </Marker>
        </MapContainer>
      </section>

      <section style={{ padding: '20px' }}>
        <h2>Copernicus Products</h2>
        <table border="1" cellPadding="8" cellSpacing="0" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Product name</th>
              <th>Content type</th>
              <th>Content length</th>
              <th>Publication date</th>
            </tr>
          </thead>
          <tbody>
            {products.map(product => (
              <tr key={product.id}>
                <td>{product.id}</td>
                <td>{product.name}</td>
                <td>{product.contentType}</td>
                <td>{product.contentLength}</td>
                <td>{product.publicationDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function PrivateRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <MapPage />
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
