import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import axios from 'axios'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  useMapEvents,
  useMap
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import GpxUploadPage from './pages/GpxUploadPage'
import StatsDashboardPage from './pages/StatsDashboardPage'
import EcoProfilePage from './pages/EcoProfilePage'
import { isLoggedIn, logout } from './services/authService'

function getAuthHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  }
}

function getEnvironmentalType(productName) {
  if (!productName) return 'OTHER'
  if (productName.includes('SL_2') || productName.includes('LST')) return 'LAND_TEMPERATURE'
  if (productName.includes('OL_2') || productName.includes('WRR')) return 'WATER_QUALITY'
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
  if (type === 'AIR_QUALITY') return 'Excellent conditions for walking and outdoor activity.'
  if (type === 'LAND_TEMPERATURE') return 'Temperature conditions should be monitored.'
  if (type === 'WATER_QUALITY') return 'Suitable for routes near rivers and lakes.'
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

function getScoreColor(score) {
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#3b82f6'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

function parseRouteCoordinates(route) {
  if (!route.coordinates) return []

  try {
    const parsed = JSON.parse(route.coordinates)

    return parsed
      .map(point => {
        const lat = point.latitude ?? point.lat
        const lon = point.longitude ?? point.lon

        if (lat === undefined || lon === undefined) return null

        return [lat, lon]
      })
      .filter(Boolean)
  } catch (error) {
    console.error('Failed to parse route coordinates:', error)
    return []
  }
}

function FlyToRegion({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center) {
      map.flyTo(center, 9, { duration: 1.5 })
    }
  }, [center, map])
  return null
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

const regionCoordinates = {
  Ljubljana: [46.0569, 14.5058],
  Maribor: [46.5547, 15.6459],
  Koper: [45.5481, 13.7302],
  Celje: [46.1512, 15.2372],
  Kranj: [46.2397, 14.3556],
}

function MapPage() {
  const [products, setProducts] = useState([])
  const [uploadedRoutes, setUploadedRoutes] = useState([])

  const [status, setStatus] = useState('Loading environmental data...')
  const [routesStatus, setRoutesStatus] = useState('Loading uploaded GPX routes...')

  // Load eco profile dynamically from localStorage
  const [ecoProfile, setEcoProfile] = useState(() => {
    const stored = localStorage.getItem('ecoProfile')
    return stored ? JSON.parse(stored) : null
  })
  const [profileUpdated, setProfileUpdated] = useState(false)

  useEffect(() => {
    // Show animation if user just saved profile and navigated back
    if (localStorage.getItem('ecoProfileJustSaved') === 'true') {
      localStorage.removeItem('ecoProfileJustSaved')
      setProfileUpdated(true)
      setTimeout(() => setProfileUpdated(false), 3000)
    }

    const handleStorageChange = () => {
      const stored = localStorage.getItem('ecoProfile')
      const newProfile = stored ? JSON.parse(stored) : null
      setEcoProfile(newProfile)
      if (newProfile) {
        setEnvironmentFilter(newProfile.ecoPriority || 'ALL')
        setProfileUpdated(true)
        setTimeout(() => setProfileUpdated(false), 3000)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('ecoProfileUpdated', handleStorageChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('ecoProfileUpdated', handleStorageChange)
    }
  }, [])

  const [environmentFilter, setEnvironmentFilter] = useState(
    ecoProfile?.ecoPriority || 'ALL'
  )
  const [dateFromFilter, setDateFromFilter] = useState('')
  const [dateToFilter, setDateToFilter] = useState('')

  const [selectionMode, setSelectionMode] = useState(null)
  const [startPoint, setStartPoint] = useState(null)
  const [endPoint, setEndPoint] = useState(null)
  const [routePoints, setRoutePoints] = useState([])
  const [routeStatus, setRouteStatus] = useState('Select start and destination points on the map.')
  const [routeInfo, setRouteInfo] = useState(null)

  const [selectedRouteType, setSelectedRouteType] = useState('ECO')
  const [showHeatmap, setShowHeatmap] = useState(false)

  // Heatmap data: environmental hotspots across Slovenia
  const heatmapPoints = [
    { position: [46.5547, 15.6459], intensity: 0.9, label: 'Maribor – Air Quality', color: '#3b82f6' },
    { position: [46.2397, 14.3556], intensity: 0.7, label: 'Gorenjska – Air Quality', color: '#3b82f6' },
    { position: [45.5481, 13.7302], intensity: 0.8, label: 'Koper – Water Quality', color: '#06b6d4' },
    { position: [46.0569, 14.5058], intensity: 1.0, label: 'Ljubljana – Air Quality', color: '#3b82f6' },
    { position: [46.1512, 15.2372], intensity: 0.6, label: 'Celje – Land Temperature', color: '#f59e0b' },
    { position: [46.3600, 13.7200], intensity: 0.5, label: 'Tolmin – Air Quality', color: '#3b82f6' },
    { position: [45.9631, 15.1708], intensity: 0.7, label: 'Novo Mesto – Water Quality', color: '#06b6d4' },
    { position: [46.4992, 15.0466], intensity: 0.6, label: 'Slovenj Gradec – Land Temperature', color: '#f59e0b' },
    { position: [46.6592, 16.1635], intensity: 0.8, label: 'Murska Sobota – Air Quality', color: '#3b82f6' },
    { position: [45.8100, 14.0000], intensity: 0.9, label: 'Postojna – Water Quality', color: '#06b6d4' },
  ]

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

  const loadUploadedRoutes = () => {
    axios.get('http://localhost:8080/api/routes', {
      headers: getAuthHeaders()
    })
      .then(response => {
        setUploadedRoutes(response.data)
        setRoutesStatus(`Loaded ${response.data.length} uploaded GPX route(s).`)
      })
      .catch(error => {
        console.error(error)
        setRoutesStatus('Failed to load uploaded GPX routes.')
      })
  }

  useEffect(() => {
    axios.get('http://localhost:8080/api/copernicus-products', {
      headers: getAuthHeaders()
    })
      .then(response => {
        setProducts(response.data)
        setStatus('Environmental data loaded successfully')
      })
      .catch(error => {
        console.error(error)
        setStatus('Failed to load environmental data')
      })

    loadUploadedRoutes()
  }, [])

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
      setRouteStatus('Start point selected. Now select destination point.')
    } else if (selectionMode === 'END') {
      setEndPoint(point)
      setSelectionMode(null)
      setRouteStatus('Destination selected. Click Calculate route.')
    }
  }

  const clearRoute = () => {
    setStartPoint(null)
    setEndPoint(null)
    setRoutePoints([])
    setRouteInfo(null)
    setSelectionMode(null)
    setRouteStatus('Select start and destination points on the map.')
  }

  const useDemoRoute = () => {
    setStartPoint([46.5547, 15.6459])
    setEndPoint([46.5602, 15.6487])
    setRoutePoints([])
    setRouteInfo(null)
    setSelectionMode(null)
    setRouteStatus('Demo route selected. Click Calculate route.')
  }

  const calculateRoute = async () => {
    if (!startPoint || !endPoint) {
      setRouteStatus('Please select start and destination points first.')
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
      const coordinates = data.routes[0].geometry.coordinates
      const leafletPoints = coordinates.map(point => [point[1], point[0]])

      const distanceKm = data.routes[0].distance / 1000

      const selectedEnvironment =
        environmentFilter === 'ALL'
          ? 'AIR_QUALITY'
          : environmentFilter

      let ecoScore = calculateEcoScore(distanceKm, selectedEnvironment)

      if (selectedRouteType === 'ECO') ecoScore += 5
      if (selectedRouteType === 'FAST') ecoScore -= 8
      if (selectedRouteType === 'BALANCED') ecoScore += 1

      // Apply activity type bonus from eco profile
      if (ecoProfile?.activityType === 'WALKING') ecoScore += 5
      if (ecoProfile?.activityType === 'RUNNING') ecoScore += 3
      if (ecoProfile?.activityType === 'CYCLING') ecoScore += 1

      setRoutePoints(leafletPoints)

      setRouteInfo({
        distanceKm: distanceKm.toFixed(2),
        durationMin: Math.round(data.routes[0].duration / 60),
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
      const distanceKm = calculateDistanceKm(fallbackRoute)

      const selectedEnvironment =
        environmentFilter === 'ALL'
          ? 'AIR_QUALITY'
          : environmentFilter

      setRoutePoints(fallbackRoute)

      setRouteInfo({
        distanceKm: distanceKm.toFixed(2),
        durationMin: Math.round(distanceKm * 12),
        ecoScore: calculateEcoScore(distanceKm, selectedEnvironment),
        environmentType: selectedEnvironment,
        recommendation: 'Fallback route preview generated.'
      })

      setRouteStatus('Fallback route generated.')
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header} className="eco-header">
        <div>
          <h1 style={styles.title} className="eco-title">🌿 EcoFlow</h1>
          <p style={styles.status}>{status}</p>
          <p style={styles.description}>
            Plan eco-friendly walking routes using environmental and GPX data.
          </p>
        </div>

        <div className="eco-header-buttons">
          <Link to="/gpx-upload" style={styles.secondaryButton}>
            Upload GPX
          </Link>

          <Link to="/dashboard" style={{ ...styles.secondaryButton, backgroundColor: '#6366f1' }}>
            Dashboard
          </Link>

          <Link to="/profile" style={{ ...styles.secondaryButton, backgroundColor: '#f59e0b' }}>
            Eco Profile
          </Link>

          <button onClick={handleLogout} style={styles.logoutButton}>
            Sign out
          </button>
        </div>
      </header>

      <section style={styles.container} className="eco-container">
        <div style={styles.routePanel}>
          <h2 style={styles.sectionTitle}>Route planner</h2>

          {ecoProfile && (
            <div style={{
              backgroundColor: profileUpdated ? '#14532d' : '#0f2a1a',
              border: `1px solid ${profileUpdated ? '#4ade80' : '#22c55e'}`,
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '12px',
              fontSize: '13px',
              color: '#86efac',
              transition: 'all 0.4s ease',
              boxShadow: profileUpdated ? '0 0 16px rgba(34,197,94,0.4)' : 'none'
            }}>
              {profileUpdated
                ? '✅ Eco Profile updated! Map filter and settings applied.'
                : <>🌿 Eco Profile active: <strong>{ecoProfile.activityType}</strong> · <strong>{ecoProfile.ecoPriority.replace(/_/g, ' ')}</strong> · <strong>{ecoProfile.preferredRegion}</strong>
                  {' '}<Link to="/profile" style={{ color: '#22c55e', marginLeft: '8px' }}>Edit profile →</Link></>
              }
            </div>
          )}

          <p style={styles.text}>
            Select points directly on the map and compare route options.
          </p>

          <div style={styles.buttonRow} className="eco-button-row">
            <button
              onClick={() => {
                setSelectionMode('START')
                setRouteStatus('Click on the map to select start point.')
              }}
              style={styles.primaryButton}
            >
              Select start
            </button>

            <button
              onClick={() => {
                setSelectionMode('END')
                setRouteStatus('Click on the map to select destination point.')
              }}
              style={styles.primaryButton}
            >
              Select destination
            </button>

            <button onClick={calculateRoute} style={styles.greenButton}>
              Calculate route
            </button>

            <button onClick={useDemoRoute} style={styles.secondaryDarkButton}>
              Demo route
            </button>

            <button onClick={clearRoute} style={styles.dangerButton}>
              Clear route
            </button>

            <button
              onClick={() => setShowHeatmap(h => !h)}
              style={{
                ...styles.primaryButton,
                backgroundColor: showHeatmap ? '#0ea5e9' : '#334155'
              }}
            >
              {showHeatmap ? '🌡️ Hide heatmap' : '🌡️ Show heatmap'}
            </button>
          </div>

          <div style={styles.optionRow} className="eco-option-row">
            {routeOptions.map(route => (
              <button
                key={route.id}
                onClick={() => setSelectedRouteType(route.id)}
                style={{
                  ...styles.routeOptionButton,
                  backgroundColor:
                    selectedRouteType === route.id
                      ? route.color
                      : '#334155'
                }}
              >
                {route.name}
              </button>
            ))}
          </div>

          <p style={styles.routeStatus}>{routeStatus}</p>

          {routeInfo && (
            <>
              <div style={styles.routeSummary}>
                <h3 style={{ marginTop: 0 }}>Route recommendation</h3>
                <p><strong>Distance:</strong> {routeInfo.distanceKm} km</p>
                <p><strong>Estimated duration:</strong> {routeInfo.durationMin} min</p>
                <p><strong>Environmental layer:</strong> {formatEnvironmentalType(routeInfo.environmentType)}</p>
                <p><strong>Eco-score:</strong> {routeInfo.ecoScore}/100</p>
                <p>{routeInfo.recommendation}</p>
              </div>

              <div style={styles.conditionsPanel}>
                <h3 style={{ marginTop: 0 }}>Current environmental conditions</h3>
                <p><strong>Air quality:</strong> Good</p>
                <p><strong>Temperature:</strong> 21°C</p>
                <p><strong>Humidity:</strong> 48%</p>
                <p style={{ color: '#22c55e', fontWeight: '700' }}>
                  Recommendation: Excellent for walking and outdoor activity.
                </p>
              </div>
            </>
          )}
        </div>

        <div style={styles.filters} className="eco-filters">
          <div>
            <label style={styles.label}>Environmental layer</label>
            <select
              value={environmentFilter}
              onChange={(e) => setEnvironmentFilter(e.target.value)}
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
            <label style={styles.label}>Data date from</label>
            <input
              type="date"
              value={dateFromFilter}
              onChange={(e) => setDateFromFilter(e.target.value)}
              style={styles.input}
            />
          </div>

          <div>
            <label style={styles.label}>Data date to</label>
            <input
              type="date"
              value={dateToFilter}
              onChange={(e) => setDateToFilter(e.target.value)}
              style={styles.input}
            />
          </div>

          <button onClick={resetFilters} style={styles.dangerButton}>
            Reset filters
          </button>
        </div>

        <div style={styles.mapBox}>
          <MapContainer
            center={ecoProfile?.preferredRegion ? regionCoordinates[ecoProfile.preferredRegion] : [46.1512, 14.9955]}
            zoom={8}
            style={styles.map}
            className="eco-map"
          >
            <RouteClickHandler
              selectionMode={selectionMode}
              onSelectPoint={handleSelectPoint}
            />

            <FlyToRegion
              center={ecoProfile?.preferredRegion
                ? regionCoordinates[ecoProfile.preferredRegion]
                : null}
            />

            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            />

            {filteredProducts.map((product, index) => {
              const location = productLocations[index % productLocations.length]
              const environmentalType = getEnvironmentalType(product.name)

              return (
                <Marker key={product.id} position={location.position}>
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

            {/* Heatmap layer */}
            {showHeatmap && heatmapPoints.map((point, index) => (
              <CircleMarker
                key={`heat-${index}`}
                center={point.position}
                radius={40 * point.intensity}
                pathOptions={{
                  color: point.color,
                  fillColor: point.color,
                  fillOpacity: 0.25,
                  weight: 0
                }}
              >
                <Popup>{point.label}</Popup>
              </CircleMarker>
            ))}

            {showHeatmap && heatmapPoints.map((point, index) => (
              <CircleMarker
                key={`heat-core-${index}`}
                center={point.position}
                radius={14 * point.intensity}
                pathOptions={{
                  color: point.color,
                  fillColor: point.color,
                  fillOpacity: 0.7,
                  weight: 1
                }}
              >
                <Popup>{point.label}</Popup>
              </CircleMarker>
            ))}

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

            {uploadedRoutes.map(route => {
              const positions = parseRouteCoordinates(route)

              if (positions.length === 0) return null

              return (
                <Polyline
                  key={`uploaded-${route.id}`}
                  positions={positions}
                  pathOptions={{
                    color: getScoreColor(route.ecoScore),
                    weight: 5,
                    opacity: 0.85
                  }}
                >
                  <Popup>
                    <strong>{route.name}</strong>
                    <br />
                    Eco-score: {route.ecoScore}/100
                    <br />
                    Status: {route.ecoScoreLabel}
                    <br />
                    Points: {route.pointCount}
                  </Popup>
                </Polyline>
              )
            })}
          </MapContainer>
        </div>

        <section style={styles.uploadedRoutesSection}>
          <div style={styles.uploadedRoutesHeader} className="eco-uploaded-header">
            <div>
              <h2 style={{ margin: 0 }}>Uploaded GPX Routes</h2>
              <p style={styles.text}>{routesStatus}</p>
            </div>

            <button onClick={loadUploadedRoutes} style={styles.greenButton}>
              Refresh routes
            </button>
          </div>

          {uploadedRoutes.length === 0 ? (
            <p style={styles.text}>
              No GPX routes uploaded yet. Upload a GPX file to display it on the map.
            </p>
          ) : (
            <div style={styles.routeCardsGrid} className="eco-route-cards">
              {uploadedRoutes.map(route => (
                <div key={route.id} style={styles.gpxCard}>
                  <h3 style={{ marginTop: 0 }}>{route.name}</h3>

                  <div
                    style={{
                      ...styles.scoreBadge,
                      backgroundColor: getScoreColor(route.ecoScore)
                    }}
                  >
                    Eco-score: {route.ecoScore}/100
                  </div>

                  <p><strong>Status:</strong> {route.ecoScoreLabel}</p>
                  <p><strong>Track points:</strong> {route.pointCount}</p>
                  <p><strong>Uploaded:</strong> {route.uploadedAt || 'N/A'}</p>

                  <p style={styles.text}>
                    This uploaded GPX route is drawn on the map using stored route coordinates from the backend.
                  </p>
                </div>
              ))}
            </div>
          )}
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
          path="/dashboard"
          element={
            <PrivateRoute>
              <StatsDashboardPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <EcoProfilePage />
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
  optionRow: {
    display: 'flex',
    gap: '10px',
    marginTop: '16px',
    flexWrap: 'wrap'
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
  routeOptionButton: {
    padding: '10px 16px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '700',
    color: '#fff'
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
  conditionsPanel: {
    marginTop: '16px',
    backgroundColor: '#0f172a',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid #334155'
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
  },
  uploadedRoutesSection: {
    marginTop: '24px',
    backgroundColor: '#1e293b',
    padding: '22px',
    borderRadius: '14px',
    border: '1px solid #334155'
  },
  uploadedRoutesHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '18px'
  },
  routeCardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '16px'
  },
  gpxCard: {
    backgroundColor: '#0f172a',
    padding: '18px',
    borderRadius: '12px',
    border: '1px solid #334155'
  },
  scoreBadge: {
    display: 'inline-block',
    padding: '8px 12px',
    borderRadius: '8px',
    color: '#fff',
    fontWeight: '700',
    marginBottom: '12px'
  }
}

export default App