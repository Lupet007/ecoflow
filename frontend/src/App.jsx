import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import axios from 'axios'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import { isLoggedIn, logout } from './services/authService'
import GpxUploadPage from './pages/GpxUploadPage'

function getEnvironmentalType(productName) {
  if (!productName) return 'OTHER'

  if (productName.includes('SL_2') || productName.includes('LST')) {
    return 'LAND_TEMPERATURE'
  }

  if (productName.includes('OL_2') || productName.includes('WRR')) {
    return 'WATER_QUALITY'
  }

  return 'AIR_QUALITY'
}

function formatEnvironmentalType(type) {
  if (type === 'ALL') return 'All environmental data'
  if (type === 'AIR_QUALITY') return 'Air quality'
  if (type === 'LAND_TEMPERATURE') return 'Land temperature'
  if (type === 'WATER_QUALITY') return 'Water quality'
  return 'Other environmental data'
}

function formatRecommendation(type) {
  if (type === 'AIR_QUALITY') {
    return 'Suitable for checking general outdoor conditions.'
  }

  if (type === 'LAND_TEMPERATURE') {
    return 'Useful for planning walking routes during warmer or colder periods.'
  }

  if (type === 'WATER_QUALITY') {
    return 'Relevant near rivers, lakes and coastal walking areas.'
  }

  return 'Environmental information available for this area.'
}

function MapPage() {
  const [products, setProducts] = useState([])
  const [status, setStatus] = useState('Loading environmental data...')

  const [environmentFilter, setEnvironmentFilter] = useState('ALL')
  const [dateFromFilter, setDateFromFilter] = useState('')
  const [dateToFilter, setDateToFilter] = useState('')

  useEffect(() => {
    axios.get('http://localhost:8080/api/copernicus-products', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    })
      .then(response => {
        setProducts(response.data)
        setStatus('Environmental data loaded successfully')
      })
      .catch(error => {
        console.error(error)
        setStatus('Failed to load environmental data')
      })
  }, [])

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  }

  const environmentalTypes = useMemo(() => {
    return ['ALL', 'AIR_QUALITY', 'LAND_TEMPERATURE', 'WATER_QUALITY']
  }, [])

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const environmentalType = getEnvironmentalType(product.name)

      const matchesType =
        environmentFilter === 'ALL' ||
        environmentalType === environmentFilter

      const publicationDate = product.publicationDate
        ? new Date(product.publicationDate)
        : null

      const matchesFrom =
        !dateFromFilter ||
        (publicationDate && publicationDate >= new Date(dateFromFilter))

      const matchesTo =
        !dateToFilter ||
        (publicationDate && publicationDate <= new Date(dateToFilter))

      return matchesType && matchesFrom && matchesTo
    })
  }, [products, environmentFilter, dateFromFilter, dateToFilter])

  const resetFilters = () => {
    setEnvironmentFilter('ALL')
    setDateFromFilter('')
    setDateToFilter('')
  }

  const productLocations = [
    { position: [46.5547, 15.6459], city: 'Maribor' },
    { position: [46.2397, 14.3556], city: 'Gorenjska' },
    { position: [45.5481, 13.7302], city: 'Koper' },
    { position: [46.0569, 14.5058], city: 'Ljubljana' },
    { position: [46.1512, 15.2372], city: 'Celje' }
  ]

  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#0f172a',
      minHeight: '100vh',
      color: 'white'
    }}>

      <header style={{
        padding: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div>
          <h1 style={{
            margin: 0,
            fontSize: '42px',
            fontWeight: '700',
            color: '#f8fafc'
          }}>
            EcoFlow
          </h1>

          <p style={{ color: '#cbd5e1', marginTop: '6px' }}>
            {status}
          </p>

          <p style={{ color: '#94a3b8', marginTop: '4px' }}>
            Explore environmental conditions before choosing a walking or recreation route.
          </p>
        </div>

<Link
  to="/gpx-upload"
  style={{
    padding: '10px 18px',
    background: '#10b981',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: '10px',
    fontWeight: '600',
    marginRight: '10px'
  }}
>
  Upload GPX
</Link>

        <button
          onClick={handleLogout}
          style={{
            padding: '10px 18px',
            background: '#a855f7',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          Sign out
        </button>
      </header>

      <section style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 20px 20px'
      }}>

        <div style={{
          backgroundColor: '#1e293b',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px'
        }}>

          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '600'
            }}>
              Environmental layer
            </label>

            <select
              value={environmentFilter}
              onChange={(e) => setEnvironmentFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px'
              }}
            >
              {environmentalTypes.map(type => (
                <option key={type} value={type}>
                  {formatEnvironmentalType(type)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '600'
            }}>
              Data date from
            </label>

            <input
              type="date"
              value={dateFromFilter}
              onChange={(e) => setDateFromFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '600'
            }}>
              Data date to
            </label>

            <input
              type="date"
              value={dateToFilter}
              onChange={(e) => setDateToFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px'
              }}
            />
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={resetFilters}
              style={{
                padding: '12px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Reset filters
            </button>
          </div>
        </div>

        <div style={{
          backgroundColor: '#1e293b',
          padding: '12px',
          borderRadius: '12px'
        }}>
          <MapContainer
            center={[46.1512, 14.9955]}
            zoom={7}
            style={{
              height: '450px',
              width: '100%',
              borderRadius: '10px'
            }}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            />

            {filteredProducts.map((product, index) => {
              const location =
                productLocations[index % productLocations.length]

              const environmentalType = getEnvironmentalType(product.name)

              return (
                <Marker
                  key={product.id}
                  position={location.position}
                >
                  <Popup>
                    <div style={{ maxWidth: '260px' }}>
                      <strong>{location.city}</strong>
                      <br />
                      <br />
                      <strong>Environmental data:</strong>
                      <br />
                      {formatEnvironmentalType(environmentalType)}
                      <br />
                      <br />
                      <strong>Route planning note:</strong>
                      <br />
                      {formatRecommendation(environmentalType)}
                      <br />
                      <br />
                      <strong>Data date:</strong>
                      <br />
                      {product.publicationDate}
                    </div>
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>
        </div>

        <section style={{
          marginTop: '24px',
          backgroundColor: '#1e293b',
          padding: '20px',
          borderRadius: '12px',
          overflowX: 'auto'
        }}>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <h2 style={{ margin: 0 }}>
              Environmental Data Overview
            </h2>

            <div style={{
              backgroundColor: '#0f172a',
              padding: '8px 14px',
              borderRadius: '8px',
              fontWeight: '600'
            }}>
              Showing {filteredProducts.length} / {products.length}
            </div>
          </div>

          <table
            border="1"
            cellPadding="10"
            cellSpacing="0"
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              backgroundColor: '#0f172a'
            }}
          >
            <thead>
              <tr>
                <th>ID</th>
                <th>Environmental data</th>
                <th>Recommended use</th>
                <th>Content length</th>
                <th>Data date</th>
              </tr>
            </thead>

            <tbody>
              {filteredProducts.map(product => {
                const environmentalType = getEnvironmentalType(product.name)

                return (
                  <tr key={product.id}>
                    <td>{product.id}</td>
                    <td>{formatEnvironmentalType(environmentalType)}</td>
                    <td>{formatRecommendation(environmentalType)}</td>
                    <td>{product.contentLength}</td>
                    <td>{product.publicationDate}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
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
    path="/gpx-upload"
    element={
      <PrivateRoute>
        <GpxUploadPage />
      </PrivateRoute>
    }
  />

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