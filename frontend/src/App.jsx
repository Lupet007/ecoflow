import { useEffect, useMemo, useState, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link, useSearchParams } from 'react-router-dom'
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
import RecommendationsPage from './pages/RecommendationsPage'
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
    const parsed = JSON.parse(route.coordinates || '[]')

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

function FlyToRoute({ routeCoordinates }) {
  const map = useMap()

  useEffect(() => {
    if (routeCoordinates && routeCoordinates.length > 0) {
      const bounds = [
        [
          Math.min(...routeCoordinates.map(c => c[0])),
          Math.min(...routeCoordinates.map(c => c[1]))
        ],
        [
          Math.max(...routeCoordinates.map(c => c[0])),
          Math.max(...routeCoordinates.map(c => c[1]))
        ]
      ]
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [routeCoordinates, map])

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
  const [searchParams] = useSearchParams()
  const routeIdParam = searchParams.get('routeId')

  const [products, setProducts] = useState([])
  const [uploadedRoutes, setUploadedRoutes] = useState([])

  const [status, setStatus] = useState('Loading environmental data...')
  const [routesStatus, setRoutesStatus] = useState('Loading uploaded GPX routes...')

  const [ecoProfile, setEcoProfile] = useState(() => {
    const stored = localStorage.getItem('ecoProfile')
    return stored ? JSON.parse(stored) : null
  })

  const [profileUpdated, setProfileUpdated] = useState(false)

  // Route from recommendations
  const [selectedRouteFromRecommendations, setSelectedRouteFromRecommendations] = useState(null)
  const [selectedRouteCoordinates, setSelectedRouteCoordinates] = useState([])

  useEffect(() => {
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

  // Detektuj routeId iz query parametra i učitaj rutu
  useEffect(() => {
    if (routeIdParam) {
      axios.get(`http://localhost:8080/api/routes/${routeIdParam}`, {
        headers: getAuthHeaders()
      })
        .then(response => {
          const route = response.data
          setSelectedRouteFromRecommendations(route)
          const coords = parseRouteCoordinates(route)
          setSelectedRouteCoordinates(coords)
        })
        .catch(error => {
          console.error('Failed to load route:', error)
        })
    }
  }, [routeIdParam])

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
      <div style={styles.backgroundGlowOne} />
      <div style={styles.backgroundGlowTwo} />

      <header style={styles.header} className="eco-header">
        <div style={styles.brandBlock}>
          <div style={styles.logoRow}>
            <div style={styles.logoBadge}>🌿</div>
            <div>
              <h1 style={styles.title} className="eco-title">EcoFlow</h1>
              <p style={styles.description}>
                Intelligent environmental route planning with satellite, GPX and sensor data.
              </p>
            </div>
          </div>

          <div style={styles.statusPill}>
            <span style={status.includes('Failed') ? styles.statusDotError : styles.statusDot} />
            {status}
          </div>
        </div>

        <nav style={styles.nav} className="eco-header-buttons">
          <Link to="/gpx-upload" style={styles.navButtonGreen}>
            Upload GPX
          </Link>

          <Link to="/dashboard" style={styles.navButtonBlue}>
            Dashboard
          </Link>

          <Link to="/profile" style={styles.navButtonOrange}>
            Eco Profile
          </Link>

          <Link to="/recommendations" style={styles.navButtonPurple}>
            Recommendations
          </Link>

          <button onClick={handleLogout} style={styles.logoutButton}>
            Sign out
          </button>
        </nav>
      </header>

      <section style={styles.container} className="eco-container">
        <div style={styles.topGrid}>
          <div style={styles.routePanel}>
            <div style={styles.panelHeader}>
              <div>
                <p style={styles.eyebrow}>Route intelligence</p>
                <h2 style={styles.sectionTitle}>Plan your route</h2>
              </div>
              <div style={styles.routeTypeBadge}>{selectedRouteType}</div>
            </div>

            {ecoProfile && (
              <div style={profileUpdated ? styles.profileNoticeActive : styles.profileNotice}>
                {profileUpdated
                  ? '✅ Eco Profile updated. Map filters and route preferences were applied.'
                  : (
                    <>
                      🌿 Eco Profile active: <strong>{ecoProfile.activityType}</strong> ·{' '}
                      <strong>{ecoProfile.ecoPriority.replaceAll('_', ' ')}</strong> ·{' '}
                      <strong>{ecoProfile.preferredRegion}</strong>
                      <Link to="/profile" style={styles.inlineLink}>Edit profile →</Link>
                    </>
                  )}
              </div>
            )}

            {!ecoProfile && (
              <div style={styles.profileNoticeWarning}>
                Create an Eco Profile to unlock personalized route recommendations.
                <Link to="/profile" style={styles.inlineLinkWarning}>Create profile →</Link>
              </div>
            )}

            {selectedRouteFromRecommendations && (
              <div style={styles.loadedRouteNotice}>
                ✅ Route loaded: <strong>{selectedRouteFromRecommendations.name}</strong>
                <br />
                <small>Eco-score: {selectedRouteFromRecommendations.ecoScore}/100</small>
              </div>
            )}

            <p style={styles.text}>
              Select start and destination points directly on the Leaflet map, compare route options and evaluate environmental suitability.
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
                style={showHeatmap ? styles.heatmapButtonActive : styles.heatmapButton}
              >
                {showHeatmap ? 'Hide heatmap' : 'Show heatmap'}
              </button>
            </div>

            <div style={styles.optionRow} className="eco-option-row">
              {routeOptions.map(route => (
                <button
                  key={route.id}
                  onClick={() => setSelectedRouteType(route.id)}
                  style={{
                    ...styles.routeOptionButton,
                    borderColor:
                      selectedRouteType === route.id
                        ? route.color
                        : 'rgba(148, 163, 184, 0.18)',
                    background:
                      selectedRouteType === route.id
                        ? `linear-gradient(135deg, ${route.color}, ${route.color}cc)`
                        : 'rgba(15, 23, 42, 0.72)'
                  }}
                >
                  <span>{route.name}</span>
                  <small style={styles.routeOptionDesc}>{route.description}</small>
                </button>
              ))}
            </div>

            <p style={styles.routeStatus}>{routeStatus}</p>

            {routeInfo && (
              <div style={styles.insightGrid}>
                <div style={styles.routeSummary}>
                  <p style={styles.eyebrow}>Recommendation</p>
                  <h3 style={styles.cardTitle}>Route analysis</h3>

                  <div style={styles.metricGrid}>
                    <div style={styles.metricBox}>
                      <span style={styles.metricLabel}>Distance</span>
                      <strong style={styles.metricValue}>{routeInfo.distanceKm} km</strong>
                    </div>
                    <div style={styles.metricBox}>
                      <span style={styles.metricLabel}>Duration</span>
                      <strong style={styles.metricValue}>{routeInfo.durationMin} min</strong>
                    </div>
                    <div style={styles.metricBox}>
                      <span style={styles.metricLabel}>Eco-score</span>
                      <strong style={{ ...styles.metricValue, color: getScoreColor(routeInfo.ecoScore) }}>
                        {routeInfo.ecoScore}/100
                      </strong>
                    </div>
                  </div>

                  <p style={styles.text}>
                    <strong>Layer:</strong> {formatEnvironmentalType(routeInfo.environmentType)}
                  </p>
                  <p style={styles.text}>{routeInfo.recommendation}</p>
                </div>

                <div style={styles.conditionsPanel}>
                  <p style={styles.eyebrow}>Live preview</p>
                  <h3 style={styles.cardTitle}>Environmental conditions</h3>
                  <p style={styles.text}><strong>Air quality:</strong> Good</p>
                  <p style={styles.text}><strong>Temperature:</strong> 21°C</p>
                  <p style={styles.text}><strong>Humidity:</strong> 48%</p>
                  <p style={styles.successText}>
                    Recommendation: Excellent for walking and outdoor activity.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div style={styles.infoPanel}>
            <p style={styles.eyebrow}>System status</p>
            <h2 style={styles.sectionTitle}>Project modules</h2>

            <div style={styles.moduleList}>
              <div style={styles.moduleItem}>
                <span style={styles.moduleIcon}>🛰️</span>
                <div>
                  <strong>Copernicus data</strong>
                  <p>{filteredProducts.length} visible products</p>
                </div>
              </div>

              <div style={styles.moduleItem}>
                <span style={styles.moduleIcon}>🗺️</span>
                <div>
                  <strong>GPX routes</strong>
                  <p>{uploadedRoutes.length} uploaded route(s)</p>
                </div>
              </div>

              <div style={styles.moduleItem}>
                <span style={styles.moduleIcon}>🔥</span>
                <div>
                  <strong>Heatmap</strong>
                  <p>{showHeatmap ? 'Enabled' : 'Disabled'}</p>
                </div>
              </div>

              <div style={styles.moduleItem}>
                <span style={styles.moduleIcon}>👤</span>
                <div>
                  <strong>Eco Profile</strong>
                  <p>{ecoProfile ? 'Active' : 'Not configured'}</p>
                </div>
              </div>
            </div>
          </div>
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

          <button onClick={resetFilters} style={styles.dangerButtonLarge}>
            Reset filters
          </button>
        </div>

        <div style={styles.mapBox}>
          <div style={styles.mapHeader}>
            <div>
              <p style={styles.eyebrow}>Interactive GIS map</p>
              <h2 style={styles.mapTitle}>Environmental route visualization</h2>
            </div>
            <div style={styles.mapLegend}>
              <span><i style={{ ...styles.legendDot, backgroundColor: '#22c55e' }} /> Eco</span>
              <span><i style={{ ...styles.legendDot, backgroundColor: '#3b82f6' }} /> Fast</span>
              <span><i style={{ ...styles.legendDot, backgroundColor: '#f59e0b' }} /> Balanced</span>
            </div>
          </div>

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

            {selectedRouteCoordinates.length > 0 && (
              <FlyToRoute routeCoordinates={selectedRouteCoordinates} />
            )}

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

            {selectedRouteCoordinates.length > 0 && (
              <>
                <Polyline
                  positions={selectedRouteCoordinates}
                  pathOptions={{
                    color: '#22c55e',
                    weight: 5,
                    opacity: 0.85,
                    dashArray: '5, 5'
                  }}
                />
                {selectedRouteCoordinates.length > 0 && (
                  <CircleMarker
                    center={selectedRouteCoordinates[0]}
                    radius={6}
                    pathOptions={{
                      color: '#10b981',
                      fillColor: '#86efac',
                      fillOpacity: 0.8,
                      weight: 2
                    }}
                  >
                    <Popup>Start</Popup>
                  </CircleMarker>
                )}
                {selectedRouteCoordinates.length > 0 && (
                  <CircleMarker
                    center={selectedRouteCoordinates[selectedRouteCoordinates.length - 1]}
                    radius={6}
                    pathOptions={{
                      color: '#ef4444',
                      fillColor: '#fca5a5',
                      fillOpacity: 0.8,
                      weight: 2
                    }}
                  >
                    <Popup>End</Popup>
                  </CircleMarker>
                )}
              </>
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
              <p style={styles.eyebrow}>Route archive</p>
              <h2 style={styles.sectionTitle}>Uploaded GPX Routes</h2>
              <p style={styles.text}>{routesStatus}</p>
            </div>

            <button onClick={loadUploadedRoutes} style={styles.greenButton}>
              Refresh routes
            </button>
          </div>

          {uploadedRoutes.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>🗺️</div>
              <h3>No GPX routes uploaded yet</h3>
              <p>Upload a GPX route to analyse its eco-score and display it on the map.</p>
              <Link to="/gpx-upload" style={styles.emptyButton}>Upload GPX route</Link>
            </div>
          ) : (
            <div style={styles.routeCardsGrid} className="eco-route-cards">
              {uploadedRoutes.map(route => (
                <div key={route.id} style={styles.gpxCard}>
                  <div style={styles.gpxCardHeader}>
                    <h3 style={styles.cardTitle}>{route.name}</h3>

                    <div
                      style={{
                        ...styles.scoreBadge,
                        backgroundColor: getScoreColor(route.ecoScore)
                      }}
                    >
                      {route.ecoScore}/100
                    </div>
                  </div>

                  <p style={styles.text}><strong>Status:</strong> {route.ecoScoreLabel}</p>
                  <p style={styles.text}><strong>Track points:</strong> {route.pointCount}</p>
                  <p style={styles.text}><strong>Uploaded:</strong> {route.uploadedAt || 'N/A'}</p>

                  <p style={styles.mutedText}>
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
          path="/recommendations"
          element={
            <PrivateRoute>
              <RecommendationsPage />
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

const glassCard = {
  background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.92), rgba(15, 23, 42, 0.94))',
  border: '1px solid rgba(148, 163, 184, 0.22)',
  boxShadow: '0 24px 80px rgba(0, 0, 0, 0.28)',
  backdropFilter: 'blur(14px)'
}

const baseButton = {
  padding: '11px 16px',
  color: '#fff',
  border: 'none',
  borderRadius: '12px',
  cursor: 'pointer',
  fontWeight: '800',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  boxShadow: '0 12px 30px rgba(0,0,0,0.24)'
}

const styles = {
  page: {
    position: 'relative',
    minHeight: '100vh',
    overflow: 'hidden',
    background:
      'radial-gradient(circle at 15% 0%, rgba(34,197,94,0.18), transparent 30%), radial-gradient(circle at 90% 10%, rgba(56,189,248,0.12), transparent 26%), linear-gradient(135deg, #020617 0%, #0f172a 45%, #111827 100%)',
    color: '#e5e7eb',
    fontFamily: 'Inter, system-ui, Segoe UI, Arial, sans-serif'
  },
  backgroundGlowOne: {
    position: 'fixed',
    width: '420px',
    height: '420px',
    borderRadius: '50%',
    background: 'rgba(34,197,94,0.14)',
    filter: 'blur(90px)',
    top: '-120px',
    left: '-120px',
    pointerEvents: 'none'
  },
  backgroundGlowTwo: {
    position: 'fixed',
    width: '420px',
    height: '420px',
    borderRadius: '50%',
    background: 'rgba(59,130,246,0.12)',
    filter: 'blur(90px)',
    right: '-140px',
    top: '180px',
    pointerEvents: 'none'
  },
  header: {
    position: 'relative',
    zIndex: 1,
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '30px 28px 22px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '24px'
  },
  brandBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  logoBadge: {
    width: '58px',
    height: '58px',
    borderRadius: '18px',
    background: 'linear-gradient(135deg, rgba(34,197,94,0.28), rgba(56,189,248,0.18))',
    border: '1px solid rgba(134,239,172,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    boxShadow: '0 18px 50px rgba(34,197,94,0.18)'
  },
  title: {
    margin: 0,
    fontSize: '48px',
    lineHeight: 1,
    fontWeight: 900,
    letterSpacing: '-0.06em',
    color: '#f8fafc'
  },
  description: {
    color: '#93c5fd',
    marginTop: '8px',
    fontSize: '17px'
  },
  statusPill: {
    alignSelf: 'flex-start',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '999px',
    background: 'rgba(15, 23, 42, 0.72)',
    border: '1px solid rgba(148, 163, 184, 0.22)',
    color: '#cbd5e1',
    fontSize: '13px',
    fontWeight: 700
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#22c55e',
    boxShadow: '0 0 16px rgba(34,197,94,0.8)'
  },
  statusDotError: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#ef4444',
    boxShadow: '0 0 16px rgba(239,68,68,0.8)'
  },
  nav: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end'
  },
  navButtonGreen: {
    ...baseButton,
    background: 'linear-gradient(135deg, #10b981, #22c55e)'
  },
  navButtonBlue: {
    ...baseButton,
    background: 'linear-gradient(135deg, #4f46e5, #38bdf8)'
  },
  navButtonOrange: {
    ...baseButton,
    background: 'linear-gradient(135deg, #f59e0b, #f97316)'
  },
  navButtonPurple: {
    ...baseButton,
    background: 'linear-gradient(135deg, #8b5cf6, #6366f1)'
  },
  logoutButton: {
    ...baseButton,
    background: 'linear-gradient(135deg, #a855f7, #ec4899)'
  },
  container: {
    position: 'relative',
    zIndex: 1,
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '0 28px 52px'
  },
  topGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 0.8fr)',
    gap: '22px',
    marginBottom: '22px'
  },
  routePanel: {
    ...glassCard,
    padding: '24px',
    borderRadius: '22px'
  },
  infoPanel: {
    ...glassCard,
    padding: '24px',
    borderRadius: '22px'
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '16px',
    alignItems: 'flex-start',
    marginBottom: '12px'
  },
  eyebrow: {
    margin: 0,
    color: '#38bdf8',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    fontSize: '11px',
    fontWeight: 900
  },
  sectionTitle: {
    margin: '5px 0 0',
    color: '#f8fafc',
    fontSize: '26px',
    fontWeight: 850,
    letterSpacing: '-0.04em'
  },
  mapTitle: {
    margin: '5px 0 0',
    color: '#f8fafc',
    fontSize: '22px',
    fontWeight: 850,
    letterSpacing: '-0.04em'
  },
  cardTitle: {
    margin: '6px 0 12px',
    color: '#f8fafc',
    fontSize: '20px',
    fontWeight: 800
  },
  routeTypeBadge: {
    padding: '8px 12px',
    borderRadius: '999px',
    background: 'rgba(34,197,94,0.12)',
    border: '1px solid rgba(34,197,94,0.35)',
    color: '#86efac',
    fontWeight: 900,
    fontSize: '12px'
  },
  text: {
    color: '#cbd5e1',
    lineHeight: 1.65
  },
  mutedText: {
    color: '#94a3b8',
    lineHeight: 1.55,
    marginTop: '12px'
  },
  profileNotice: {
    background: 'rgba(20, 83, 45, 0.34)',
    border: '1px solid rgba(34,197,94,0.35)',
    borderRadius: '14px',
    padding: '12px 14px',
    marginBottom: '14px',
    fontSize: '13px',
    color: '#bbf7d0'
  },
  profileNoticeActive: {
    background: 'rgba(20, 83, 45, 0.72)',
    border: '1px solid rgba(74,222,128,0.8)',
    borderRadius: '14px',
    padding: '12px 14px',
    marginBottom: '14px',
    fontSize: '13px',
    color: '#dcfce7',
    boxShadow: '0 0 28px rgba(34,197,94,0.24)'
  },
  loadedRouteNotice: {
    background: 'rgba(34,197,94,0.15)',
    border: '1px solid rgba(74,222,128,0.6)',
    borderRadius: '14px',
    padding: '12px 14px',
    marginBottom: '14px',
    fontSize: '13px',
    color: '#86efac'
  },
  profileNoticeWarning: {
    background: 'rgba(245,158,11,0.12)',
    border: '1px solid rgba(245,158,11,0.36)',
    borderRadius: '14px',
    padding: '12px 14px',
    marginBottom: '14px',
    fontSize: '13px',
    color: '#fde68a'
  },
  inlineLink: {
    color: '#86efac',
    marginLeft: '10px',
    fontWeight: 800,
    textDecoration: 'none'
  },
  inlineLinkWarning: {
    color: '#fbbf24',
    marginLeft: '10px',
    fontWeight: 800,
    textDecoration: 'none'
  },
  buttonRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginTop: '18px',
    marginBottom: '14px'
  },
  optionRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: '10px',
    marginTop: '14px'
  },
  primaryButton: {
    ...baseButton,
    background: 'linear-gradient(135deg, #6366f1, #818cf8)'
  },
  greenButton: {
    ...baseButton,
    background: 'linear-gradient(135deg, #10b981, #22c55e)'
  },
  secondaryDarkButton: {
    ...baseButton,
    background: 'linear-gradient(135deg, #334155, #475569)'
  },
  dangerButton: {
    ...baseButton,
    background: 'linear-gradient(135deg, #ef4444, #fb7185)'
  },
  dangerButtonLarge: {
    ...baseButton,
    minHeight: '48px',
    background: 'linear-gradient(135deg, #ef4444, #fb7185)'
  },
  heatmapButton: {
    ...baseButton,
    background: 'linear-gradient(135deg, #334155, #475569)'
  },
  heatmapButtonActive: {
    ...baseButton,
    background: 'linear-gradient(135deg, #0284c7, #38bdf8)'
  },
  routeOptionButton: {
    padding: '14px',
    borderRadius: '16px',
    border: '1px solid',
    cursor: 'pointer',
    color: '#fff',
    fontWeight: 850,
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  routeOptionDesc: {
    color: 'rgba(226,232,240,0.78)',
    fontWeight: 500,
    lineHeight: 1.35
  },
  routeStatus: {
    marginTop: '16px',
    color: '#86efac',
    fontWeight: 800,
    textAlign: 'center'
  },
  insightGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginTop: '18px'
  },
  routeSummary: {
    background: 'rgba(15, 23, 42, 0.78)',
    border: '1px solid rgba(34,197,94,0.35)',
    padding: '18px',
    borderRadius: '18px'
  },
  conditionsPanel: {
    background: 'rgba(15, 23, 42, 0.78)',
    padding: '18px',
    borderRadius: '18px',
    border: '1px solid rgba(148, 163, 184, 0.22)'
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
    marginBottom: '14px'
  },
  metricBox: {
    background: 'rgba(2, 6, 23, 0.7)',
    border: '1px solid rgba(148,163,184,0.14)',
    borderRadius: '14px',
    padding: '12px'
  },
  metricLabel: {
    display: 'block',
    color: '#94a3b8',
    fontSize: '12px',
    marginBottom: '4px'
  },
  metricValue: {
    color: '#f8fafc',
    fontSize: '18px'
  },
  successText: {
    color: '#22c55e',
    fontWeight: 900,
    marginTop: '8px'
  },
  moduleList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '18px'
  },
  moduleItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'rgba(15, 23, 42, 0.66)',
    border: '1px solid rgba(148, 163, 184, 0.16)',
    borderRadius: '16px',
    padding: '14px'
  },
  moduleIcon: {
    width: '42px',
    height: '42px',
    borderRadius: '14px',
    background: 'rgba(34,197,94,0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px'
  },
  filters: {
    ...glassCard,
    padding: '20px',
    borderRadius: '22px',
    marginBottom: '22px',
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(180px, 1fr)) auto',
    gap: '16px',
    alignItems: 'end'
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    color: '#e2e8f0',
    fontWeight: 850,
    fontSize: '13px'
  },
  input: {
    width: '100%',
    minHeight: '48px',
    padding: '10px 12px',
    borderRadius: '14px',
    border: '1px solid rgba(148,163,184,0.28)',
    backgroundColor: '#0f172a',
    color: '#f8fafc'
  },
  mapBox: {
    ...glassCard,
    padding: '14px',
    borderRadius: '24px',
    position: 'relative'
  },
  mapHeader: {
    padding: '8px 8px 14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '14px',
    flexWrap: 'wrap'
  },
  mapLegend: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    color: '#cbd5e1',
    fontSize: '13px',
    fontWeight: 700
  },
  legendDot: {
    display: 'inline-block',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    marginRight: '5px'
  },
  map: {
    height: '570px',
    width: '100%',
    borderRadius: '18px',
    overflow: 'hidden'
  },
  uploadedRoutesSection: {
    ...glassCard,
    marginTop: '24px',
    padding: '24px',
    borderRadius: '22px'
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px'
  },
  gpxCard: {
    background: 'rgba(15, 23, 42, 0.78)',
    padding: '18px',
    borderRadius: '18px',
    border: '1px solid rgba(148, 163, 184, 0.18)'
  },
  gpxCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '10px'
  },
  scoreBadge: {
    display: 'inline-block',
    padding: '8px 12px',
    borderRadius: '999px',
    color: '#fff',
    fontWeight: '900',
    fontSize: '13px',
    whiteSpace: 'nowrap'
  },
  emptyState: {
    background: 'rgba(15,23,42,0.72)',
    border: '1px dashed rgba(148,163,184,0.28)',
    borderRadius: '20px',
    padding: '34px',
    textAlign: 'center'
  },
  emptyIcon: {
    fontSize: '40px',
    marginBottom: '10px'
  },
  emptyButton: {
    ...baseButton,
    marginTop: '16px',
    background: 'linear-gradient(135deg, #10b981, #22c55e)'
  }
}

export default App