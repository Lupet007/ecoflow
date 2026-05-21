import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import axios from 'axios'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import { isLoggedIn, logout } from './services/authService'

const API_URL = 'http://localhost:8080/api/copernicus-products'

const productLocations = [
  { lat: 46.5547, lng: 15.6459, city: 'Maribor' },
  { lat: 46.0569, lng: 14.5058, city: 'Ljubljana' },
  { lat: 46.2397, lng: 15.2677, city: 'Celje' },
  { lat: 45.5481, lng: 13.7302, city: 'Koper' },
  { lat: 46.1512, lng: 14.9955, city: 'Zasavje' },
]

function MapPage() {
  const [products, setProducts] = useState([])
  const [status, setStatus] = useState('Loading Copernicus products...')
  const [contentTypeFilter, setContentTypeFilter] = useState('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    axios.get(API_URL, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    })
      .then(response => {
        const productsWithLocation = response.data.map((product, index) => ({
          ...product,
          location: productLocations[index % productLocations.length],
        }))

        setProducts(productsWithLocation)
        setStatus('Copernicus products loaded successfully')
      })
      .catch(error => {
        console.error(error)
        setStatus('Failed to load Copernicus products')
      })
  }, [])

  const contentTypes = useMemo(() => {
    const uniqueTypes = products
      .map(product => product.contentType)
      .filter(Boolean)

    return ['ALL', ...new Set(uniqueTypes)]
  }, [products])

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesContentType =
        contentTypeFilter === 'ALL' || product.contentType === contentTypeFilter

      const publicationDate = product.publicationDate
        ? new Date(product.publicationDate)
        : null

      const matchesDateFrom =
        !dateFrom || (publicationDate && publicationDate >= new Date(dateFrom))

      const matchesDateTo =
        !dateTo || (publicationDate && publicationDate <= new Date(dateTo))

      return matchesContentType && matchesDateFrom && matchesDateTo
    })
  }, [products, contentTypeFilter, dateFrom, dateTo])

  const resetFilters = () => {
    setContentTypeFilter('ALL')
    setDateFrom('')
    setDateTo('')
  }

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>EcoFlow</h1>
          <p style={styles.status}>{status}</p>
        </div>

        <button onClick={handleLogout} style={styles.logoutButton}>
          Sign out
        </button>
      </header>

      <section style={styles.filters}>
        <div style={styles.filterGroup}>
          <label style={styles.label}>Product type</label>
          <select
            value={contentTypeFilter}
            onChange={(event) => setContentTypeFilter(event.target.value)}
            style={styles.input}
          >
            {contentTypes.map(type => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.label}>Publication date from</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            style={styles.input}
          />
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.label}>Publication date to</label>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            style={styles.input}
          />
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.label}>Visible records</label>
          <div style={styles.counter}>
            {filteredProducts.length} / {products.length}
          </div>
        </div>

        <button onClick={resetFilters} style={styles.resetButton}>
          Reset filters
        </button>
      </section>

      <section style={styles.mapSection}>
        <MapContainer
          center={[46.1512, 14.9955]}
          zoom={8}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {filteredProducts.map(product => (
            <Marker
              key={product.id}
              position={[product.location.lat, product.location.lng]}
            >
              <Popup>
                <div style={styles.popup}>
                  <strong>{product.location.city}</strong>
                  <br />
                  <br />
                  <strong>Product:</strong>
                  <br />
                  {shortenText(product.name, 80)}
                  <br />
                  <br />
                  <strong>Type:</strong> {product.contentType}
                  <br />
                  <strong>Publication:</strong> {formatDate(product.publicationDate)}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </section>

      <section style={styles.tableSection}>
        <h2 style={styles.subtitle}>Copernicus Products</h2>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>ID</th>
                <th style={styles.th}>Product name</th>
                <th style={styles.th}>Content type</th>
                <th style={styles.th}>Content length</th>
                <th style={styles.th}>Publication date</th>
              </tr>
            </thead>

            <tbody>
              {filteredProducts.map(product => (
                <tr key={product.id}>
                  <td style={styles.td}>{product.id}</td>
                  <td style={styles.td}>{shortenText(product.name, 90)}</td>
                  <td style={styles.td}>{product.contentType}</td>
                  <td style={styles.td}>{product.contentLength}</td>
                  <td style={styles.td}>{formatDate(product.publicationDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function shortenText(text, maxLength) {
  if (!text) return '-'
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}...`
}

function formatDate(dateValue) {
  if (!dateValue) return '-'
  return new Date(dateValue).toLocaleString()
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

const styles = {
  page: {
    minHeight: '100vh',
    fontFamily: 'Arial, sans-serif',
    background: '#111827',
    color: '#e5e7eb',
  },
  header: {
    maxWidth: '1180px',
    margin: '0 auto',
    padding: '20px 32px',
    background: '#1f2937',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #374151',
  },
  title: {
    margin: 0,
    fontSize: '28px',
  },
  status: {
    margin: '6px 0 0',
    color: '#9ca3af',
  },
  logoutButton: {
    padding: '10px 18px',
    background: '#10b981',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  filters: {
    maxWidth: '1180px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '16px',
    padding: '20px 32px',
    background: '#111827',
    borderBottom: '1px solid #374151',
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    color: '#d1d5db',
    fontWeight: '600',
  },
  input: {
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #4b5563',
    background: '#1f2937',
    color: '#e5e7eb',
  },
  counter: {
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #4b5563',
    background: '#1f2937',
    color: '#e5e7eb',
    textAlign: 'center',
    fontWeight: '600',
  },
  resetButton: {
    marginTop: '22px',
    height: '40px',
    borderRadius: '8px',
    border: '1px solid #4b5563',
    background: '#374151',
    color: '#f9fafb',
    cursor: 'pointer',
    fontWeight: '600',
  },
  mapSection: {
    maxWidth: '1180px',
    margin: '0 auto',
    height: '430px',
    width: '100%',
  },
  tableSection: {
    maxWidth: '1180px',
    margin: '0 auto',
    padding: '24px 32px',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: '18px',
  },
  tableWrapper: {
    overflowX: 'auto',
    border: '1px solid #4b5563',
    borderRadius: '8px',
  },
  table: {
    width: '100%',
    minWidth: '900px',
    borderCollapse: 'collapse',
    background: '#111827',
  },
  th: {
    border: '1px solid #4b5563',
    padding: '12px',
    background: '#1f2937',
    color: '#f9fafb',
  },
  td: {
    border: '1px solid #4b5563',
    padding: '10px',
    color: '#d1d5db',
    verticalAlign: 'top',
  },
  popup: {
    maxWidth: '260px',
    fontSize: '13px',
  },
}

export default App