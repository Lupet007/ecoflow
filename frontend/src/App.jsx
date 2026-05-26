import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import axios from 'axios'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMapEvents
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import GpxUploadPage from './pages/GpxUploadPage'
import { isLoggedIn, logout } from './services/authService'

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
    return 'Excellent conditions for walking and outdoor activity.'
  }

  if (type === 'LAND_TEMPERATURE') {
    return 'Temperature conditions should be monitored.'
  }

  if (type === 'WATER_QUALITY') {
    return 'Suitable for routes near rivers and lakes.'
  }

  return 'Environmental information available.'
}

function calculateDistanceKm(routePoints) {
  if (!routePoints || routePoints.length < 2) return 0

  let distance = 0

  for (let i = 1; i < routePoints.length; i++) {
    const [lat1, lon1] = routePoints[i - 1]
    const [lat2, lon2] = routePoints[i]

    const R = 6371

    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    distance += R * c
  }

  return distance
}

function calculateEcoScore(distanceKm, environmentType) {
  let score = 90

  if (distanceKm > 5) score -= 8
  if (distanceKm > 10) score -= 12

  if (environmentType === 'AIR_QUALITY') score += 4
  if (environmentType === 'LAND_TEMPERATURE') score -= 3
  if (environmentType === 'WATER_QUALITY') score += 2

  return Math.max(45, Math.min(100, Math.round(score)))
}

function RouteClickHandler({ selectionMode, onSelectPoint }) {
  useMapEvents({
    click(event) {
      if (!selectionMode) return

      onSelectPoint([event.latlng.lat, event.latlng.lng])
    }
  })

  return null
}

function MapPage() {
  const [products, setProducts] = useState([])
  const [status, setStatus] = useState('Loading environmental data...')

  const [environmentFilter, setEnvironmentFilter] = useState('ALL')
  const [dateFromFilter, setDateFromFilter] = useState('')
  const [dateToFilter, setDateToFilter] = useState('')

  const [selectionMode, setSelectionMode] = useState(null)
  const [startPoint, setStartPoint] = useState(null)
  const [endPoint, setEndPoint] = useState(null)

  const [routePoints, setRoutePoints] = useState([])
  const [routeStatus, setRouteStatus] = useState(
    'Select start and destination points on the map.'
  )

  const [routeInfo, setRouteInfo] = useState(null)

  const [selectedRouteType, setSelectedRouteType] = useState('ECO')

  const routeOptions = [
    {
      id: 'ECO',
      name: 'Eco Route',
      color: '#22c55e',
      description: 'Cleaner air and healthier walking conditions.'
    },
    {
      id: 'FAST',
      name: 'Fast Route',
      color: '#3b82f6',
      description: 'Shortest travel duration.'
    },
    {
      id: 'BALANCED',
      name: 'Balanced Route',
      color: '#f59e0b',
      description: 'Balanced travel and environmental conditions.'
    }
  ]

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

  const environmentalTypes = useMemo(() => {
    return [
      'ALL',
      'AIR_QUALITY',
      'LAND_TEMPERATURE',
      'WATER_QUALITY'
    ]
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
        (publicationDate &&
          publicationDate >= new Date(dateFromFilter))

      const matchesTo =
        !dateToFilter ||
        (publicationDate &&
          publicationDate <= new Date(dateToFilter))

      return matchesType && matchesFrom && matchesTo
    })
  }, [products, environmentFilter, dateFromFilter, dateToFilter])

  const productLocations = [
    { position: [46.5547, 15.6459], city: 'Maribor' },
    { position: [46.2397, 14.3556], city: 'Gorenjska' },
    { position: [45.5481, 13.7302], city: 'Koper' },
    { position: [46.0569, 14.5058], city: 'Ljubljana' },
    { position: [46.1512, 15.2372], city: 'Celje' }
  ]

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  }

  const resetFilters = () => {
    setEnvironmentFilter('ALL')
    setDateFromFilter('')
    setDateToFilter('')
  }

  const handleSelectPoint = (point) => {

    if (selectionMode === 'START') {
      setStartPoint(point)
      setSelectionMode('END')
      setRouteStatus(
        'Start point selected. Now select destination point.'
      )
    }

    else if (selectionMode === 'END') {
      setEndPoint(point)
      setSelectionMode(null)
      setRouteStatus(
        'Destination selected. Click Calculate route.'
      )
    }
  }

  const clearRoute = () => {
    setStartPoint(null)
    setEndPoint(null)
    setRoutePoints([])
    setRouteInfo(null)
    setSelectionMode(null)

    setRouteStatus(
      'Select start and destination points on the map.'
    )
  }

  const useDemoRoute = () => {
    setStartPoint([46.5547, 15.6459])
    setEndPoint([46.5602, 15.6487])

    setRoutePoints([])
    setRouteInfo(null)
    setSelectionMode(null)

    setRouteStatus(
      'Demo route selected. Click Calculate route.'
    )
  }

  const calculateRoute = async () => {

    if (!startPoint || !endPoint) {
      setRouteStatus(
        'Please select start and destination points first.'
      )
      return
    }

    setRouteStatus('Calculating route...')

    try {

      const url =
        `https://router.project-osrm.org/route/v1/foot/` +
        `${startPoint[1]},${startPoint[0]};${endPoint[1]},${endPoint[0]}` +
        `?overview=full&geometries=geojson`

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Route service unavailable')
      }

      const data = await response.json()

      const coordinates =
        data.routes[0].geometry.coordinates

      const leafletPoints =
        coordinates.map(point => [point[1], point[0]])

      const distanceKm =
        data.routes[0].distance / 1000

      const selectedEnvironment =
        environmentFilter === 'ALL'
          ? 'AIR_QUALITY'
          : environmentFilter

      let ecoScore =
        calculateEcoScore(distanceKm, selectedEnvironment)

      if (selectedRouteType === 'ECO') ecoScore += 5
      if (selectedRouteType === 'FAST') ecoScore -= 8
      if (selectedRouteType === 'BALANCED') ecoScore += 1

      setRoutePoints(leafletPoints)

      setRouteInfo({
        distanceKm: distanceKm.toFixed(2),

        durationMin: Math.round(
          data.routes[0].duration / 60
        ),

        ecoScore,

        environmentType: selectedEnvironment,

        recommendation:
          ecoScore >= 85
            ? 'Excellent route for outdoor activity.'
            : ecoScore >= 70
              ? 'Good route with acceptable environmental conditions.'
              : 'Environmental conditions are less suitable.'
      })

      setRouteStatus('Route calculated successfully.')

    } catch (error) {

      console.error(error)

      const fallbackRoute = [startPoint, endPoint]

      const distanceKm =
        calculateDistanceKm(fallbackRoute)

      const selectedEnvironment =
        environmentFilter === 'ALL'
          ? 'AIR_QUALITY'
          : environmentFilter

      setRoutePoints(fallbackRoute)

      setRouteInfo({
        distanceKm: distanceKm.toFixed(2),

        durationMin: Math.round(distanceKm * 12),

        ecoScore:
          calculateEcoScore(distanceKm, selectedEnvironment),

        environmentType: selectedEnvironment,

        recommendation:
          'Fallback route preview generated.'
      })

      setRouteStatus('Fallback route generated.')
    }
  }

  return (
    <div style={styles.page}>

      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>
            🌿 EcoFlow
          </h1>

          <p style={styles.status}>
            {status}
          </p>

          <p style={styles.description}>
            Plan eco-friendly walking routes using environmental data.
          </p>
        </div>

        <div>
          <Link
            to="/gpx-upload"
            style={styles.secondaryButton}
          >
            Upload GPX
          </Link>

          <button
            onClick={handleLogout}
            style={styles.logoutButton}
          >
            Sign out
          </button>
        </div>
      </header>

      <section style={styles.container}>

        <div style={styles.routePanel}>

          <h2 style={styles.sectionTitle}>
            Route planner
          </h2>

          <p style={styles.text}>
            Select points directly on the map and compare route options.
          </p>

          <div style={styles.buttonRow}>

            <button
              onClick={() => {
                setSelectionMode('START')
                setRouteStatus(
                  'Click on the map to select start point.'
                )
              }}
              style={styles.primaryButton}
            >
              Select start
            </button>

            <button
              onClick={() => {
                setSelectionMode('END')
                setRouteStatus(
                  'Click on the map to select destination point.'
                )
              }}
              style={styles.primaryButton}
            >
              Select destination
            </button>

            <button
              onClick={calculateRoute}
              style={styles.greenButton}
            >
              Calculate route
            </button>

            <button
              onClick={useDemoRoute}
              style={styles.secondaryDarkButton}
            >
              Demo route
            </button>

            <button
              onClick={clearRoute}
              style={styles.dangerButton}
            >
              Clear route
            </button>
          </div>

          <div style={{
            display: 'flex',
            gap: '10px',
            marginTop: '16px',
            flexWrap: 'wrap'
          }}>
            {routeOptions.map(route => (
              <button
                key={route.id}
                onClick={() => setSelectedRouteType(route.id)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '700',
                  backgroundColor:
                    selectedRouteType === route.id
                      ? route.color
                      : '#334155',
                  color: '#fff'
                }}
              >
                {route.name}
              </button>
            ))}
          </div>

          <p style={styles.routeStatus}>
            {routeStatus}
          </p>

          {routeInfo && (
            <>
              <div style={styles.routeSummary}>
                <h3 style={{ marginTop: 0 }}>
                  Route recommendation
                </h3>

                <p>
                  <strong>Distance:</strong>{' '}
                  {routeInfo.distanceKm} km
                </p>

                <p>
                  <strong>Estimated duration:</strong>{' '}
                  {routeInfo.durationMin} min
                </p>

                <p>
                  <strong>Environmental layer:</strong>{' '}
                  {formatEnvironmentalType(
                    routeInfo.environmentType
                  )}
                </p>

                <p>
                  <strong>Eco-score:</strong>{' '}
                  {routeInfo.ecoScore}/100
                </p>

                <p>
                  {routeInfo.recommendation}
                </p>
              </div>

              <div style={{
                marginTop: '16px',
                backgroundColor: '#0f172a',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid #334155'
              }}>
                <h3 style={{ marginTop: 0 }}>
                  Current environmental conditions
                </h3>

                <p>
                  <strong>Air quality:</strong> Good
                </p>

                <p>
                  <strong>Temperature:</strong> 21°C
                </p>

                <p>
                  <strong>Humidity:</strong> 48%
                </p>

                <p style={{
                  color: '#22c55e',
                  fontWeight: '700'
                }}>
                  Recommendation:
                  Excellent for walking and outdoor activity.
                </p>
              </div>
            </>
          )}
        </div>

        <div style={styles.filters}>

          <div>
            <label style={styles.label}>
              Environmental layer
            </label>

            <select
              value={environmentFilter}
              onChange={(e) =>
                setEnvironmentFilter(e.target.value)
              }
              style={styles.input}
            >
              {environmentalTypes.map(type => (
                <option key={type} value={type}>
                  {formatEnvironmentalType(type)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={styles.label}>
              Data date from
            </label>

            <input
              type="date"
              value={dateFromFilter}
              onChange={(e) =>
                setDateFromFilter(e.target.value)
              }
              style={styles.input}
            />
          </div>

          <div>
            <label style={styles.label}>
              Data date to
            </label>

            <input
              type="date"
              value={dateToFilter}
              onChange={(e) =>
                setDateToFilter(e.target.value)
              }
              style={styles.input}
            />
          </div>

          <button
            onClick={resetFilters}
            style={styles.dangerButton}
          >
            Reset filters
          </button>
        </div>

        <div style={styles.mapBox}>
          <MapContainer
            center={[46.1512, 14.9955]}
            zoom={8}
            style={styles.map}
          >

            <RouteClickHandler
              selectionMode={selectionMode}
              onSelectPoint={handleSelectPoint}
            />

            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            />

            {filteredProducts.map((product, index) => {

              const location =
                productLocations[
                  index % productLocations.length
                ]

              const environmentalType =
                getEnvironmentalType(product.name)

              return (
                <Marker
                  key={product.id}
                  position={location.position}
                >
                  <Popup>
                    <strong>{location.city}</strong>
                    <br />
                    {formatEnvironmentalType(environmentalType)}
                    <br />
                    {formatRecommendation(environmentalType)}
                  </Popup>
                </Marker>
              )
            })}

            {startPoint && (
              <Marker position={startPoint}>
                <Popup>Start point</Popup>
              </Marker>
            )}

            {endPoint && (
              <Marker position={endPoint}>
                <Popup>Destination point</Popup>
              </Marker>
            )}

            {routePoints.length > 0 && (
              <Polyline
                positions={routePoints}
                pathOptions={{
                  color:
                    selectedRouteType === 'ECO'
                      ? '#22c55e'
                      : selectedRouteType === 'FAST'
                        ? '#3b82f6'
                        : '#f59e0b',

                  weight: 6,
                  opacity: 0.9
                }}
              />
            )}
          </MapContainer>
        </div>
      </section>
    </div>
  )
}

function PrivateRoute({ children }) {
  return isLoggedIn()
    ? children
    : <Navigate to="/login" />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route
          path="/register"
          element={<RegisterPage />}
        />

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

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#0f172a',
    color: '#e5e7eb',
    fontFamily: 'Arial, sans-serif'
  },

  header: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },

  title: {
    margin: 0,
    fontSize: '40px',
    color: '#f8fafc'
  },

  status: {
    color: '#cbd5e1',
    margin: '6px 0'
  },

  description: {
    color: '#94a3b8',
    margin: 0
  },

  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 24px 32px'
  },

  routePanel: {
    backgroundColor: '#1e293b',
    padding: '22px',
    borderRadius: '14px',
    marginBottom: '20px',
    border: '1px solid #334155'
  },

  sectionTitle: {
    marginTop: 0,
    color: '#f8fafc'
  },

  text: {
    color: '#cbd5e1'
  },

  buttonRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginTop: '16px'
  },

  primaryButton: {
    padding: '10px 16px',
    backgroundColor: '#6366f1',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '700'
  },

  greenButton: {
    padding: '10px 16px',
    backgroundColor: '#10b981',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '700'
  },

  secondaryButton: {
    padding: '10px 16px',
    backgroundColor: '#10b981',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: '8px',
    marginRight: '10px',
    fontWeight: '700'
  },

  secondaryDarkButton: {
    padding: '10px 16px',
    backgroundColor: '#334155',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '700'
  },

  dangerButton: {
    padding: '10px 16px',
    backgroundColor: '#ef4444',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '700'
  },

  logoutButton: {
    padding: '10px 16px',
    backgroundColor: '#a855f7',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '700'
  },

  routeStatus: {
    marginTop: '14px',
    color: '#86efac',
    fontWeight: '600'
  },

  routeSummary: {
    backgroundColor: '#0f172a',
    border: '1px solid #22c55e',
    padding: '16px',
    borderRadius: '12px',
    marginTop: '16px',
    color: '#cbd5e1'
  },

  filters: {
    backgroundColor: '#1e293b',
    padding: '20px',
    borderRadius: '14px',
    marginBottom: '20px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
    border: '1px solid #334155'
  },

  label: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: '700'
  },

  input: {
    width: '100%',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #475569'
  },

  mapBox: {
    backgroundColor: '#1e293b',
    padding: '12px',
    borderRadius: '14px',
    border: '1px solid #334155'
  },

  map: {
    height: '550px',
    width: '100%',
    borderRadius: '10px'
  }
}

export default App