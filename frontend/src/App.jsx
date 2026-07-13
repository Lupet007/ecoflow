import { useEffect, useMemo, useRef, useState } from 'react'
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
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import './App.css'

// Vite doesn't resolve Leaflet's default marker icon URLs, so point them at
// the bundled asset paths instead.
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})
import { API_BASE_URL } from './config'
import AppHeader from './components/AppHeader'
import AppFooter from './components/AppFooter'
import RecommendationsPage from './pages/RecommendationsPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import GpxUploadPage from './pages/GpxUploadPage'
import StatsDashboardPage from './pages/StatsDashboardPage'
import EcoProfilePage from './pages/EcoProfilePage'
import { isLoggedIn } from './services/authService'
import { useRealGeolocation } from './hooks/useRealGeolocation'
import {
  buildRouteWaypoints,
  calculateAirQualityIndex,
  calculateRouteAirQuality,
  evaluateAirQualityAlert,
  normalizeAirQualityStations,
  normalizeSensorData,
  selectRouteByStrategy
} from './utils/environment'

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
  if (type === 'ALL') return 'Vsi okoljski podatki'
  if (type === 'AIR_QUALITY') return 'Kakovost zraka'
  if (type === 'LAND_TEMPERATURE') return 'Temperatura tal'
  if (type === 'WATER_QUALITY') return 'Kakovost vode'
  return 'Drugi okoljski podatki'
}

function formatActivityType(type) {
  if (type === 'WALKING') return 'Hoja'
  if (type === 'CYCLING') return 'Kolesarjenje'
  if (type === 'RUNNING') return 'Tek'
  return type
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

function formatDuration(totalMinutes) {
  if (totalMinutes === null || totalMinutes === undefined) return 'ni podatkov'

  const rounded = Math.max(0, Math.round(totalMinutes))
  const hours = Math.floor(rounded / 60)
  const minutes = rounded % 60

  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours} h`
  return `${hours} h ${minutes} min`
}

function getScoreColor(score) {
  if (score === null || score === undefined) return '#94a3b8'
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

function MapResizeHandler() {
  const map = useMap()

  useEffect(() => {
    const invalidate = () => map.invalidateSize()

    // Leaflet measures its container once at creation and never rechecks -
    // the mobile layout can settle into its final width a frame after mount.
    invalidate()
    const timeoutId = setTimeout(invalidate, 300)

    window.addEventListener('resize', invalidate)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', invalidate)
    }
  }, [map])

  return null
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

function FlyToUserLocation({ position }) {
  const map = useMap()

  useEffect(() => {
    if (position) {
      // Zoomed in closer than FlyToRegion's city-level view, and flies
      // regardless of where in the world the real position is - the user
      // may be testing from outside Slovenia entirely, and would otherwise
      // never see their own marker on the default Slovenia-centered map.
      map.flyTo([position.latitude, position.longitude], 12, { duration: 1.5 })
    }
  }, [position, map])

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

function FlyToPlannedRoute({ startPoint, endPoint, routePoints }) {
  const map = useMap()

  useEffect(() => {
    // Once the actual routed path is known, fit to its real shape rather than
    // just the straight-line box between the two endpoints.
    if (routePoints && routePoints.length > 1) {
      const bounds = [
        [Math.min(...routePoints.map(p => p[0])), Math.min(...routePoints.map(p => p[1]))],
        [Math.max(...routePoints.map(p => p[0])), Math.max(...routePoints.map(p => p[1]))]
      ]
      map.fitBounds(bounds, { padding: [60, 60] })
      return
    }

    if (startPoint && endPoint) {
      const bounds = [
        [Math.min(startPoint[0], endPoint[0]), Math.min(startPoint[1], endPoint[1])],
        [Math.max(startPoint[0], endPoint[0]), Math.max(startPoint[1], endPoint[1])]
      ]
      map.fitBounds(bounds, { padding: [60, 60] })
      return
    }

    // Only the start (or only the destination) is known yet - jump straight
    // there so it's visible immediately, instead of leaving the map wherever
    // it happened to be centered (e.g. the user's real, possibly far-away,
    // GPS location).
    if (startPoint) {
      map.flyTo(startPoint, 13, { duration: 1.2 })
    } else if (endPoint) {
      map.flyTo(endPoint, 13, { duration: 1.2 })
    }
  }, [startPoint, endPoint, routePoints, map])

  return null
}

function RouteClickHandler({ onSelectPoint }) {
  useMapEvents({
    click(event) {
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

const trendColors = {
  AIR_QUALITY: '#2563eb',
  LAND_TEMPERATURE: '#b45309',
  WATER_QUALITY: '#0891b2'
}

function formatShortDate(value) {
  return new Intl.DateTimeFormat('sl-SI', { month: 'short', day: 'numeric' }).format(value)
}

function getProductDate(product) {
  // Prefers createdAt (when our system actually ingested the record) over
  // publicationDate (when the satellite originally captured it), since the
  // "last 30/90 days" trend filter is meant to reflect recent system
  // activity, not the age of the underlying satellite imagery.
  const value = product.createdAt || product.publicationDate || product.originDate
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
}

function HistoricalTrends({ products, routes }) {
  const [period, setPeriod] = useState('90')

  const cutoff = useMemo(() => {
    if (period === 'ALL') return null
    const date = new Date()
    date.setDate(date.getDate() - Number(period))
    return date
  }, [period])

  const productTrend = useMemo(() => {
    const days = new Map()

    products.forEach(product => {
      const date = getProductDate(product)
      if (!date || (cutoff && date < cutoff)) return

      const key = date.toISOString().slice(0, 10)
      const day = days.get(key) || {
        date,
        AIR_QUALITY: 0,
        LAND_TEMPERATURE: 0,
        WATER_QUALITY: 0
      }
      const type = getEnvironmentalType(product.name)
      if (trendColors[type]) day[type] += 1
      days.set(key, day)
    })

    return [...days.values()].sort((a, b) => a.date - b.date)
  }, [products, cutoff])

  const routeTrend = useMemo(() => routes
    .map(route => ({
      name: route.name,
      score: Number(route.ecoScore),
      date: route.uploadedAt ? new Date(route.uploadedAt) : null
    }))
    .filter(item => item.date && !Number.isNaN(item.date.getTime()) && Number.isFinite(item.score))
    .filter(item => !cutoff || item.date >= cutoff)
    .sort((a, b) => a.date - b.date), [routes, cutoff])

  const maxDailyCount = Math.max(1, ...productTrend.map(day =>
    day.AIR_QUALITY + day.LAND_TEMPERATURE + day.WATER_QUALITY
  ))
  const chartWidth = 720
  const chartHeight = 190
  const plot = { left: 38, right: 12, top: 12, bottom: 34 }
  const plotWidth = chartWidth - plot.left - plot.right
  const plotHeight = chartHeight - plot.top - plot.bottom
  const barSlot = productTrend.length ? plotWidth / productTrend.length : plotWidth
  const barWidth = Math.min(38, Math.max(8, barSlot * 0.62))
  const routePoints = routeTrend.map((item, index) => ({
    ...item,
    x: plot.left + (routeTrend.length === 1 ? plotWidth / 2 : (index / (routeTrend.length - 1)) * plotWidth),
    y: plot.top + ((100 - item.score) / 100) * plotHeight
  }))
  const averageScore = routeTrend.length
    ? Math.round(routeTrend.reduce((sum, item) => sum + item.score, 0) / routeTrend.length)
    : null

  const renderGrid = (maxValue) => [0, 0.25, 0.5, 0.75, 1].map(step => {
    const y = plot.top + plotHeight - step * plotHeight
    return (
      <g key={step}>
        <line x1={plot.left} x2={chartWidth - plot.right} y1={y} y2={y} className="trend-grid-line" />
        <text x={plot.left - 9} y={y + 4} textAnchor="end" className="trend-axis-label">
          {Math.round(maxValue * step)}
        </text>
      </g>
    )
  })

  return (
    <section style={styles.trendsSection} className="eco-trends">
      <div style={styles.trendsHeader}>
        <div>
          <p style={styles.eyebrow}>Zgodovinski pregled</p>
          <h2 style={styles.sectionTitle}>Okoljski trendi</h2>
          <p style={styles.text}>Aktivnost objav in kakovost poti skozi čas.</p>
        </div>
        <div className="trend-period-control" aria-label="Zgodovinsko obdobje">
          {[['30', '30 dni'], ['90', '90 dni'], ['ALL', 'Celotno obdobje']].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={period === value ? 'trend-period-button active' : 'trend-period-button'}
              onClick={() => setPeriod(value)}
              aria-pressed={period === value}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="trend-summary-row">
        <div><strong>{productTrend.length}</strong><span>aktivnih dni s podatki</span></div>
        <div><strong>{productTrend.reduce((sum, day) => sum + day.AIR_QUALITY + day.LAND_TEMPERATURE + day.WATER_QUALITY, 0)}</strong><span>objavljenih zapisov</span></div>
        <div><strong>{routeTrend.length}</strong><span>spremljanih poti</span></div>
        <div><strong>{averageScore ?? '--'}</strong><span>povprečna eko-ocena</span></div>
      </div>

      <div className="trend-chart-grid">
        <article className="trend-chart-panel">
          <div className="trend-chart-heading">
            <div>
              <h3>Aktivnost okoljskih podatkov</h3>
              <p>Objavljeni zapisi na dan</p>
            </div>
            <div className="trend-legend">
              {Object.entries(trendColors).map(([type, color]) => (
                <span key={type}><i style={{ background: color }} />{formatEnvironmentalType(type)}</span>
              ))}
            </div>
          </div>
          {productTrend.length ? (
            <div className="trend-chart-scroll">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Dnevni okoljski zapisi po kategorijah">
                {renderGrid(maxDailyCount)}
                {productTrend.map((day, index) => {
                  const x = plot.left + index * barSlot + (barSlot - barWidth) / 2
                  let stackedHeight = 0
                  const total = day.AIR_QUALITY + day.LAND_TEMPERATURE + day.WATER_QUALITY
                  return (
                    <g key={day.date.toISOString()}>
                      {Object.keys(trendColors).map(type => {
                        const height = (day[type] / maxDailyCount) * plotHeight
                        const y = plot.top + plotHeight - stackedHeight - height
                        stackedHeight += height
                        return day[type] > 0 ? (
                          <rect key={type} x={x} y={y} width={barWidth} height={height} fill={trendColors[type]} rx="2">
                            <title>{`${formatShortDate(day.date)}: ${day[type]} zapisov (${formatEnvironmentalType(type).toLowerCase()})`}</title>
                          </rect>
                        ) : null
                      })}
                      {(index === 0 || index === productTrend.length - 1 || productTrend.length <= 6) && (
                        <text x={x + barWidth / 2} y={chartHeight - 17} textAnchor="middle" className="trend-axis-label">
                          {formatShortDate(day.date)}
                        </text>
                      )}
                      <title>{`${formatShortDate(day.date)}: ${total} zapisov skupaj`}</title>
                    </g>
                  )
                })}
              </svg>
            </div>
          ) : <div className="trend-empty">V tem obdobju ni okoljske zgodovine.</div>}
        </article>

        <article className="trend-chart-panel">
          <div className="trend-chart-heading">
            <div>
              <h3>Zgodovina eko-ocen poti</h3>
              <p>Ocena ob nalaganju, od 100</p>
            </div>
            {averageScore !== null && <span className="trend-average">Povprečje {averageScore}</span>}
          </div>
          {routePoints.length ? (
            <div className="trend-chart-scroll">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Eko-ocene naloženih poti skozi čas">
                {renderGrid(100)}
                {routePoints.length > 1 && (
                  <polyline
                    points={routePoints.map(point => `${point.x},${point.y}`).join(' ')}
                    className="route-trend-line"
                    fill="none"
                  />
                )}
                {routePoints.map((point, index) => (
                  <g key={`${point.name}-${point.date.toISOString()}-${index}`}>
                    <circle cx={point.x} cy={point.y} r="6" fill={getScoreColor(point.score)} className="route-trend-point">
                      <title>{`${point.name}: ${point.score}/100 dne ${formatShortDate(point.date)}`}</title>
                    </circle>
                    {(index === 0 || index === routePoints.length - 1 || routePoints.length <= 6) && (
                      <text x={point.x} y={chartHeight - 17} textAnchor="middle" className="trend-axis-label">
                        {formatShortDate(point.date)}
                      </text>
                    )}
                  </g>
                ))}
              </svg>
            </div>
          ) : <div className="trend-empty">Naloži GPX pot za začetek zgodovine eko-ocen.</div>}
        </article>
      </div>
    </section>
  )
}

function MapPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const routeIdParam = searchParams.get('routeId')

  const [products, setProducts] = useState([])
  const [uploadedRoutes, setUploadedRoutes] = useState([])
  const [visibleRouteCount, setVisibleRouteCount] = useState(6)
  const [sensorStatus, setSensorStatus] = useState('Nalaganje podatkov senzorjev v živo ...')
  const [airQualityStations, setAirQualityStations] = useState([])
  const [airQualityStatus, setAirQualityStatus] = useState('Nalaganje ARSO postaj za kakovost zraka ...')

  // Read-only "you are here" marker - no measurement is recorded here (that
  // stays on the Dashboard's "Share my real location" action); this just
  // displays the real position on the map, reusing the airQualityStations
  // already polled above instead of a second network round-trip.
  const { position: myPosition, error: myLocationError, requestLocation: requestMyLocation } = useRealGeolocation()
  const myAirQuality = myPosition
    ? calculateRouteAirQuality([[myPosition.latitude, myPosition.longitude]], airQualityStations)
    : null

  // The marker itself shows as soon as a real position is known (including a
  // silent auto-resolve on mount if permission was already granted), but the
  // map should only ever fly the camera there in response to the user
  // explicitly clicking "Moja lokacija" - otherwise it would keep yanking the
  // view away from a route the user just navigated to (e.g. an uploaded GPX
  // near Maribor, or manual panning), which is what was happening before.
  const [flyToMyPosition, setFlyToMyPosition] = useState(null)
  const explicitLocateRef = useRef(false)

  useEffect(() => {
    if (myPosition && explicitLocateRef.current) {
      setFlyToMyPosition(myPosition)
      explicitLocateRef.current = false
    }
  }, [myPosition])

  const handleLocateClick = () => {
    explicitLocateRef.current = true
    requestMyLocation()
  }

  const [status, setStatus] = useState('Nalaganje okoljskih podatkov ...')
  const [statusIsError, setStatusIsError] = useState(false)
  const [routesStatus, setRoutesStatus] = useState('Nalaganje naloženih GPX poti ...')

  const [ecoProfile, setEcoProfile] = useState(() => {
    const stored = localStorage.getItem('ecoProfile')
    return stored ? JSON.parse(stored) : null
  })

  const [profileUpdated, setProfileUpdated] = useState(false)

  const [environmentFilter, setEnvironmentFilter] = useState(
    ecoProfile?.ecoPriority || 'ALL'
  )

  // Route from recommendations
  const [selectedRouteFromRecommendations, setSelectedRouteFromRecommendations] = useState(null)
  const [selectedRouteCoordinates, setSelectedRouteCoordinates] = useState([])

  useEffect(() => {
    if (localStorage.getItem('ecoProfileJustSaved') === 'true') {
      localStorage.removeItem('ecoProfileJustSaved')
      setTimeout(() => setProfileUpdated(true), 0)
    }

    const handleStorageChange = () => {
      const stored = localStorage.getItem('ecoProfile')
      const newProfile = stored ? JSON.parse(stored) : null
      setEcoProfile(newProfile)

      if (newProfile) {
        setEnvironmentFilter(newProfile.ecoPriority || 'ALL')

        setTimeout(() => {
          setProfileUpdated(true)

          setTimeout(() => {
            setProfileUpdated(false)
          }, 3000)
        }, 0)
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
      axios.get(`${API_BASE_URL}/api/routes/${routeIdParam}`, {
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

  const clearLoadedRecommendation = () => {
    setSelectedRouteFromRecommendations(null)
    setSelectedRouteCoordinates([])
    setSearchParams(current => {
      const next = new URLSearchParams(current)
      next.delete('routeId')
      return next
    })
  }

  const [selectionMode, setSelectionMode] = useState(null)
  const [startPoint, setStartPoint] = useState(null)
  const [endPoint, setEndPoint] = useState(null)
  const [routePoints, setRoutePoints] = useState([])
  const [routeAlternatives, setRouteAlternatives] = useState([])
  const [routeStatus, setRouteStatus] = useState('Klikni na zemljevid, da nastaviš začetno točko, nato še enkrat za cilj.')
  const [routeInfo, setRouteInfo] = useState(null)

  const [selectedRouteType, setSelectedRouteType] = useState('ECO')
  const [showHeatmap, setShowHeatmap] = useState(false)
  const lastNotification = useRef(null)
  const routeRequestId = useRef(0)

  // Address search for start/destination - real geocoding via the free OSM
  // Nominatim service (no API key), consistent with the rest of the app's
  // real-data-only sources. Debounced per field so typing doesn't hammer the
  // (rate-limited) public endpoint on every keystroke.
  const [startQuery, setStartQuery] = useState('')
  const [endQuery, setEndQuery] = useState('')
  const [startSuggestions, setStartSuggestions] = useState([])
  const [endSuggestions, setEndSuggestions] = useState([])
  const [searchingField, setSearchingField] = useState(null)
  const searchDebounce = useRef({})

  const searchAddress = async (query, field) => {
    if (query.trim().length < 3) {
      if (field === 'START') setStartSuggestions([])
      else setEndSuggestions([])
      return
    }

    setSearchingField(field)

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`
      )
      const data = await response.json()
      const results = data.map(item => ({
        label: item.display_name,
        point: [parseFloat(item.lat), parseFloat(item.lon)]
      }))

      if (field === 'START') setStartSuggestions(results)
      else setEndSuggestions(results)
    } catch (error) {
      console.error('Address search failed:', error)
    } finally {
      setSearchingField(current => (current === field ? null : current))
    }
  }

  const handleStartQueryChange = (value) => {
    setStartQuery(value)
    clearTimeout(searchDebounce.current.start)
    searchDebounce.current.start = setTimeout(() => searchAddress(value, 'START'), 600)
  }

  const handleEndQueryChange = (value) => {
    setEndQuery(value)
    clearTimeout(searchDebounce.current.end)
    searchDebounce.current.end = setTimeout(() => searchAddress(value, 'END'), 600)
  }

  const selectStartSuggestion = (suggestion) => {
    setStartQuery(suggestion.label)
    setStartSuggestions([])
    setStartPoint(suggestion.point)

    if (endPoint) {
      setRouteStatus('Izračunavanje tvoje poti ...')
      calculateRoute(undefined, { start: suggestion.point, end: endPoint })
    } else {
      setRouteStatus('Začetna točka izbrana. Išči ali klikni na zemljevid za določitev cilja.')
    }
  }

  const selectEndSuggestion = (suggestion) => {
    setEndQuery(suggestion.label)
    setEndSuggestions([])
    setEndPoint(suggestion.point)

    if (startPoint) {
      setRouteStatus('Izračunavanje tvoje poti ...')
      calculateRoute(undefined, { start: startPoint, end: suggestion.point })
    } else {
      setRouteStatus('Cilj izbran. Išči ali klikni na zemljevid za določitev začetne točke.')
    }
  }

  // Favorite routes are a lightweight, purely local (localStorage) quick-access
  // list for planned routes - separate from the backend-driven Recommendations
  // page, which only ever reflects real uploaded GPX routes. Saving a favorite
  // never touches the backend, so it cannot affect uploaded routes, the
  // Environmental trends chart, or the Recommendations engine.
  const [favoriteRoutes, setFavoriteRoutes] = useState(() => {
    const stored = localStorage.getItem('favoriteRoutes')
    return stored ? JSON.parse(stored) : []
  })

  const saveFavoriteRoute = () => {
    if (!startPoint || !endPoint) return

    const defaultName = `${startQuery || `${startPoint[0].toFixed(3)}, ${startPoint[1].toFixed(3)}`} → ${endQuery || `${endPoint[0].toFixed(3)}, ${endPoint[1].toFixed(3)}`}`
    const name = window.prompt('Ime za to omiljeno pot:', defaultName)
    if (!name) return

    const favorite = {
      id: Date.now(),
      name,
      start: startPoint,
      end: endPoint,
      startQuery,
      endQuery,
      routeType: selectedRouteType
    }

    setFavoriteRoutes(current => {
      const updated = [...current, favorite]
      localStorage.setItem('favoriteRoutes', JSON.stringify(updated))
      return updated
    })
  }

  const loadFavoriteRoute = (favorite) => {
    setStartPoint(favorite.start)
    setEndPoint(favorite.end)
    setStartQuery(favorite.startQuery || '')
    setEndQuery(favorite.endQuery || '')
    setSelectedRouteType(favorite.routeType || 'ECO')
    setRouteStatus('Izračunavanje shranjene poti ...')
    calculateRoute(favorite.routeType || 'ECO', { start: favorite.start, end: favorite.end })
  }

  const deleteFavoriteRoute = (id) => {
    setFavoriteRoutes(current => {
      const updated = current.filter(favorite => favorite.id !== id)
      localStorage.setItem('favoriteRoutes', JSON.stringify(updated))
      return updated
    })
  }

  const environmentalAlert = useMemo(() => {
    if (!ecoProfile?.alertsEnabled) return null
    const regionCenter = regionCoordinates[ecoProfile.preferredRegion]

    return evaluateAirQualityAlert(
      airQualityStations,
      regionCenter,
      ecoProfile.alertThreshold
    )
  }, [ecoProfile, airQualityStations])

  useEffect(() => {
    if (!environmentalAlert || typeof Notification === 'undefined') return
    const notificationKey = `${environmentalAlert.title}-${environmentalAlert.message}`
    if (Notification.permission !== 'granted' || lastNotification.current === notificationKey) return

    new Notification(environmentalAlert.title, { body: environmentalAlert.message })
    lastNotification.current = notificationKey
  }, [environmentalAlert])

  // Point intensity comes from each ARSO station's current EAQI reading;
  // stations with no usable pollutant reading are left out.
  const heatmapPoints = useMemo(() => {
    return airQualityStations
      .map(station => {
        const score = calculateAirQualityIndex(station)
        if (score === null) return null

        return {
          position: [station.latitude, station.longitude],
          intensity: Math.max(0.3, (100 - score) / 100),
          label: `${station.stationName || 'ARSO postaja'} – kakovost zraka: ${score}/100`,
          color: getScoreColor(score)
        }
      })
      .filter(Boolean)
  }, [airQualityStations])

  const routeOptions = [
    {
      id: 'ECO',
      name: 'Eko pot',
      color: '#15803d',
      description: 'Čistejši zrak in bolj zdravi pogoji za hojo.'
    },
    {
      id: 'FAST',
      name: 'Hitra pot',
      color: '#2563eb',
      description: 'Najkrajši čas potovanja.'
    },
    {
      id: 'BALANCED',
      name: 'Uravnotežena pot',
      color: '#b45309',
      description: 'Uravnoteženo razmerje med hitrostjo in okoljskimi pogoji.'
    }
  ]

  const loadUploadedRoutes = () => {
    axios.get(`${API_BASE_URL}/api/routes`, {
      headers: getAuthHeaders()
    })
      .then(response => {
        setUploadedRoutes(response.data)
        setRoutesStatus(`Naloženih ${response.data.length} GPX poti.`)
      })
      .catch(error => {
        console.error(error)
        setRoutesStatus('Nalaganje naloženih GPX poti ni uspelo.')
      })
  }

  useEffect(() => {
    const loadEnvironmentalData = () => {
      axios.get(`${API_BASE_URL}/api/copernicus-products`, {
        headers: getAuthHeaders()
      })
        .then(response => {
          setProducts(response.data)
          setStatus(`Okoljski podatki osveženi ob ${new Date().toLocaleTimeString()}`)
          setStatusIsError(false)
        })
        .catch(error => {
          console.error(error)
          if (error.response?.status === 401 || error.response?.status === 403) {
            setStatus('Seja ni veljavna. Znova se prijavi za nalaganje okoljskih podatkov.')
          } else {
            setStatus('Nalaganje okoljskih podatkov ni uspelo')
          }
          setStatusIsError(true)
        })

      loadUploadedRoutes()
    }

    loadEnvironmentalData()

    const refreshInterval = setInterval(() => {
      loadEnvironmentalData()
    }, 300000)

    return () => clearInterval(refreshInterval)
  }, [])

  useEffect(() => {
    const loadSensorData = () => {
      axios.get(`${API_BASE_URL}/api/succulent-data`, { headers: getAuthHeaders() })
        .then(response => {
          const readings = normalizeSensorData(response.data).slice(-500)
          setSensorStatus(readings.length
            ? `${readings.length} nedavnih meritev v živo`
            : 'Ni razpoložljivih meritev v živo')
        })
        .catch(error => {
          console.error(error)
          setSensorStatus('Storitev senzorjev v živo ni na voljo')
        })
    }

    loadSensorData()
    const sensorInterval = setInterval(loadSensorData, 15000)
    return () => clearInterval(sensorInterval)
  }, [])

  useEffect(() => {
    const loadAirQualityStations = () => {
      axios.get(`${API_BASE_URL}/api/air-quality`, { headers: getAuthHeaders() })
        .then(response => {
          const stations = normalizeAirQualityStations(response.data)
          setAirQualityStations(stations)
          setAirQualityStatus(stations.length
            ? `${stations.length} ARSO postaj poroča`
            : 'Ni razpoložljivih ARSO podatkov o kakovosti zraka')
        })
        .catch(error => {
          console.error(error)
          setAirQualityStatus('Storitev ARSO kakovosti zraka ni na voljo')
        })
    }

    loadAirQualityStations()
    // ARSO refreshes hourly, so polling every 5 minutes is frequent enough
    // without hammering the backend for data that rarely changes.
    const airQualityInterval = setInterval(loadAirQualityStations, 300000)
    return () => clearInterval(airQualityInterval)
  }, [])

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const environmentalType = getEnvironmentalType(product.name)

      return environmentFilter === 'ALL' || environmentalType === environmentFilter
    })
  }, [products, environmentFilter])

  const handleSelectPoint = (point) => {
    // "Select start"/"Select destination" buttons still work as an explicit
    // override, e.g. to redo just one point of an already-planned route.
    if (selectionMode === 'START') {
      setStartPoint(point)
      setStartQuery('')
      setSelectionMode(null)
      if (endPoint) {
        setRouteStatus('Izračunavanje tvoje poti ...')
        calculateRoute(undefined, { start: point, end: endPoint })
      } else {
        setRouteStatus('Začetna točka izbrana. Ponovno klikni na zemljevid za določitev cilja.')
      }
      return
    }

    if (selectionMode === 'END') {
      setEndPoint(point)
      setEndQuery('')
      setSelectionMode(null)
      if (startPoint) {
        setRouteStatus('Izračunavanje tvoje poti ...')
        calculateRoute(undefined, { start: startPoint, end: point })
      }
      return
    }

    // No button pressed - clicking the map directly sets start, then
    // destination, then auto-calculates, so planning a route never requires
    // scrolling back up to press a button first.
    if (!startPoint) {
      setStartPoint(point)
      setStartQuery('')
      setRouteStatus('Začetna točka izbrana. Ponovno klikni na zemljevid za določitev cilja.')
      return
    }

    if (!endPoint) {
      setEndPoint(point)
      setEndQuery('')
      setRouteStatus('Izračunavanje tvoje poti ...')
      calculateRoute(undefined, { start: startPoint, end: point })
      return
    }

    // Both points already set - this click starts a fresh selection.
    setStartPoint(point)
    setStartQuery('')
    setEndPoint(null)
    setEndQuery('')
    setRoutePoints([])
    setRouteAlternatives([])
    setRouteInfo(null)
    setRouteStatus('Nova začetna točka izbrana. Ponovno klikni na zemljevid za določitev cilja.')
  }

  const clearRoute = () => {
    setStartPoint(null)
    setEndPoint(null)
    setStartQuery('')
    setEndQuery('')
    setStartSuggestions([])
    setEndSuggestions([])
    setRoutePoints([])
    setRouteAlternatives([])
    setRouteInfo(null)
    setSelectionMode(null)
    setRouteStatus('Klikni na zemljevid, da nastaviš začetno točko, nato še enkrat za cilj.')
  }

  const calculateRoute = async (routeTypeOverride, pointsOverride) => {
    const routeType = routeTypeOverride ?? selectedRouteType
    // Accepts the two points directly so a click that just set the second
    // point can trigger a calculation immediately, without waiting for React
    // state to flush (startPoint/endPoint would still read stale/null here
    // in that same tick otherwise).
    const effectiveStart = pointsOverride?.start ?? startPoint
    const effectiveEnd = pointsOverride?.end ?? endPoint

    if (!effectiveStart || !effectiveEnd) {
      setRouteStatus('Najprej izberi začetno točko in cilj.')
      return
    }

    // Guards against overlapping requests: switching route type quickly (e.g.
    // Fast then Balanced before Fast's network round-trip finishes) starts a
    // second calculateRoute() call while the first is still in flight. Without
    // this, whichever fetch happens to resolve last wins and overwrites the
    // screen - regardless of which button was actually clicked last - making
    // "Balanced" sometimes display an older "Fast" result or vice versa.
    const requestId = ++routeRequestId.current
    const isStale = () => requestId !== routeRequestId.current

    setRouteStatus('Izračunavanje poti ...')

    try {
      const routingService = ecoProfile?.activityType === 'CYCLING' ? 'routed-bike' : 'routed-foot'
      const routingProfile = routingService === 'routed-bike' ? 'bike' : 'foot'

      const corridorRequests = buildRouteWaypoints(effectiveStart, effectiveEnd).map(async waypoints => {
        try {
          const coordinates = [effectiveStart, ...waypoints, effectiveEnd]
            .map(point => `${point[1]},${point[0]}`)
            .join(';')
          const response = await fetch(
            `https://routing.openstreetmap.de/${routingService}/route/v1/${routingProfile}/${coordinates}?overview=full&geometries=geojson`
          )
          if (!response.ok) return null
          const data = await response.json()
          return data.routes?.[0] ?? null
        } catch (error) {
          console.error('Route candidate failed:', error)
          return null
        }
      })
      const routeResponses = await Promise.all(corridorRequests)
      const availableRoutes = routeResponses.filter(Boolean)

      if (availableRoutes.length === 0) {
        throw new Error('No routes returned by route service')
      }

      const selectedEnvironment =
        environmentFilter === 'ALL'
          ? 'AIR_QUALITY'
          : environmentFilter

      const candidates = availableRoutes.map((route, index) => {
        const points = route.geometry.coordinates.map(point => [point[1], point[0]])
        const distanceKm = route.distance / 1000
        const durationMin = route.duration / 60
        // null when no ARSO station is within range - never replaced with a fallback score.
        const airQuality = calculateRouteAirQuality(points, airQualityStations)

        return {
          id: index,
          points,
          distanceKm,
          durationMin,
          airQuality,
          environmentScore: airQuality?.score ?? null
        }
      })

      if (isStale()) return

      const selectedRoute = selectRouteByStrategy(candidates, routeType)
      const strategyReason = selectedRoute.ecoDataUnavailable
        ? 'Nobena ARSO postaja za kakovost zraka ni dovolj blizu tej poti - prikazana je najhitrejša možna pot.'
        : routeType === 'FAST'
          ? 'Izbrana je bila pot z najkrajšim trajanjem.'
          : routeType === 'ECO'
            ? 'Izbrana je bila pot z najboljšim resničnim indeksom kakovosti zraka v bližini.'
            : 'Izbrana je bila pot z mediano trajanja kot ravnotežje med hitrostjo in okoljem.'

      setRouteAlternatives(candidates.map(candidate => candidate.points))
      setRoutePoints(selectedRoute.points)

      setRouteInfo({
        distanceKm: selectedRoute.distanceKm.toFixed(2),
        durationMin: Math.round(selectedRoute.durationMin),
        ecoScore: selectedRoute.environmentScore,
        environmentType: selectedEnvironment,
        alternativeCount: candidates.length,
        stationCount: selectedRoute.airQuality?.stationCount ?? 0,
        stationNames: selectedRoute.airQuality?.stationNames ?? [],
        nearestStationKm: selectedRoute.airQuality?.nearestDistanceKm ?? null,
        strategyReason,
        recommendation:
          selectedRoute.environmentScore === null
            ? 'Ni bližnje ARSO postaje - okoljska ocena za to pot ni na voljo.'
            : selectedRoute.environmentScore >= 85
              ? 'Odlična pot za aktivnosti na prostem.'
              : selectedRoute.environmentScore >= 70
                ? 'Dobra pot s sprejemljivimi okoljskimi pogoji.'
                : 'Okoljski pogoji so manj primerni.'
      })

      setRouteStatus(`${routeOptions.find(option => option.id === routeType)?.name} izbrana izmed ${candidates.length} možnih poti.`)
    } catch (error) {
      console.error(error)

      if (isStale()) return

      const fallbackRoute = [effectiveStart, effectiveEnd]
      const distanceKm = calculateDistanceKm(fallbackRoute)

      const selectedEnvironment =
        environmentFilter === 'ALL'
          ? 'AIR_QUALITY'
          : environmentFilter

      setRoutePoints(fallbackRoute)
      setRouteAlternatives([fallbackRoute])

      const fallbackAirQuality = calculateRouteAirQuality(fallbackRoute, airQualityStations)

      setRouteInfo({
        distanceKm: distanceKm.toFixed(2),
        // No real routing duration exists for this fallback (straight-line
        // preview only) - showing a guessed number under the same "Trajanje"
        // label as a real routed time would misrepresent it, so this stays
        // null and the UI shows "ni podatkov" instead.
        durationMin: null,
        ecoScore: fallbackAirQuality?.score ?? null,
        environmentType: selectedEnvironment,
        alternativeCount: 1,
        stationCount: fallbackAirQuality?.stationCount ?? 0,
        stationNames: fallbackAirQuality?.stationNames ?? [],
        nearestStationKm: fallbackAirQuality?.nearestDistanceKm ?? null,
        strategyReason: 'Storitev za izračun poti ni bila na voljo, zato je bil uporabljen neposreden prikaz razdalje v ravni črti (brez ocene trajanja).',
        recommendation: fallbackAirQuality?.score != null
          ? 'Nadomestni prikaz poti je bil ustvarjen z uporabo najbližje resnične ARSO postaje.'
          : 'Nadomestni prikaz poti je bil ustvarjen - brez bližnje ARSO postaje za oceno.'
      })

      setRouteStatus('Ustvarjena je bila nadomestna pot.')
    }
  }

  const selectRouteType = (routeTypeId) => {
    setSelectedRouteType(routeTypeId)

    if (startPoint && endPoint) {
      calculateRoute(routeTypeId)
    }
  }

  return (
    <div style={styles.page}>
      <AppHeader />

      <section style={styles.container} className="eco-container">
        <div style={styles.pageIntro}>
          <p style={styles.description}>
            Inteligentno načrtovanje okolju prijaznih poti z uporabo satelitskih, GPX in senzorskih podatkov.
          </p>
          <div style={styles.statusPill}>
            <span style={statusIsError ? styles.statusDotError : styles.statusDot} />
            {status}
          </div>
        </div>

        {ecoProfile?.alertsEnabled && (
          <div
            style={environmentalAlert ? styles.environmentAlert : styles.environmentAlertClear}
            className="eco-environment-alert"
            role={environmentalAlert ? 'alert' : 'status'}
          >
            <div style={styles.alertContent} className="eco-alert-content">
              <strong>
                {environmentalAlert?.title || `Razmere v bližini ${ecoProfile.preferredRegion} so znotraj tvojega praga`}
              </strong>
              <p>{environmentalAlert?.message || `${sensorStatus}. Nivo opozorila: ${ecoProfile.alertThreshold}.`}</p>
            </div>
            <div style={styles.alertActions} className="eco-alert-actions">
              <Link to="/profile" style={styles.alertSettingsLink}>Nastavitve opozoril</Link>
            </div>
          </div>
        )}

        <div style={styles.plannerRow} className="eco-planner-row">
          <aside style={styles.sidebar} className="eco-sidebar">
            <div style={styles.panelHeader}>
              <div>
                <p style={styles.eyebrow}>Pametno načrtovanje poti</p>
                <h2 style={styles.sectionTitle}>Načrtuj svojo pot</h2>
              </div>
              <div style={styles.routeTypeBadge}>{selectedRouteType}</div>
            </div>

            {ecoProfile && (
              <div style={profileUpdated ? styles.profileNoticeActive : styles.profileNotice}>
                {profileUpdated
                  ? 'Eko profil posodobljen. Filtri zemljevida in nastavitve poti so bili uporabljeni.'
                  : (
                    <>
                      Eko profil je aktiven: <strong>{formatActivityType(ecoProfile.activityType)}</strong> ·{' '}
                      <strong>{formatEnvironmentalType(ecoProfile.ecoPriority)}</strong> ·{' '}
                      <strong>{ecoProfile.preferredRegion}</strong>
                      <Link to="/profile" style={styles.inlineLink}>Uredi profil →</Link>
                    </>
                  )}
              </div>
            )}

            {!ecoProfile && (
              <div style={styles.profileNoticeWarning}>
                Ustvari eko profil za prilagojena priporočila poti.
                <Link to="/profile" style={styles.inlineLinkWarning}>Ustvari profil →</Link>
              </div>
            )}

            {selectedRouteFromRecommendations && (
              <div style={styles.loadedRouteNotice}>
                <div>
                  Pot naložena: <strong>{selectedRouteFromRecommendations.name}</strong>
                  <br />
                  <small>Eko-ocena: {selectedRouteFromRecommendations.ecoScore}/100</small>
                </div>
                <button
                  onClick={clearLoadedRecommendation}
                  style={styles.loadedRouteCloseButton}
                  aria-label="Odstrani naloženo pot"
                  title="Odstrani naloženo pot"
                >
                  ×
                </button>
              </div>
            )}

            <p style={styles.text}>
              Išči naslov spodaj ali klikni na zemljevid, da določiš začetno točko, nato cilj. Poti se primerjajo in izračunajo samodejno.
            </p>

            <div style={styles.searchField}>
              <input
                type="text"
                value={startQuery}
                onChange={(e) => handleStartQueryChange(e.target.value)}
                placeholder="Išči začetni naslov ali ulico ..."
                style={styles.searchInput}
              />
              {searchingField === 'START' && startQuery.trim().length >= 3 && (
                <span style={styles.searchStatus}>Iskanje ...</span>
              )}
              {startSuggestions.length > 0 && (
                <div style={styles.searchResults}>
                  {startSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => selectStartSuggestion(suggestion)}
                      style={styles.searchResultItem}
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={styles.searchField}>
              <input
                type="text"
                value={endQuery}
                onChange={(e) => handleEndQueryChange(e.target.value)}
                placeholder="Išči naslov ali ulico cilja ..."
                style={styles.searchInput}
              />
              {searchingField === 'END' && endQuery.trim().length >= 3 && (
                <span style={styles.searchStatus}>Iskanje ...</span>
              )}
              {endSuggestions.length > 0 && (
                <div style={styles.searchResults}>
                  {endSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => selectEndSuggestion(suggestion)}
                      style={styles.searchResultItem}
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={styles.pointsBlock}>
              <div style={styles.pointRow}>
                <span style={styles.pointDotStart} />
                <span>{startPoint
                  ? `Začetek: ${startPoint[0].toFixed(4)}, ${startPoint[1].toFixed(4)}`
                  : 'Začetna točka še ni določena'}</span>
              </div>
              <div style={styles.pointRow}>
                <span style={styles.pointDotEnd} />
                <span>{endPoint
                  ? `Cilj: ${endPoint[0].toFixed(4)}, ${endPoint[1].toFixed(4)}`
                  : 'Cilj še ni določen'}</span>
              </div>

              {(startPoint || endPoint) && (
                <button
                  onClick={clearRoute}
                  style={styles.clearButton}
                  aria-label="Počisti pot"
                  title="Počisti pot"
                >
                  ×
                </button>
              )}
            </div>

            <p style={styles.routeStatus}>{routeStatus}</p>

            {myLocationError && (
              <p style={styles.errorText}>{myLocationError}</p>
            )}

            <div style={styles.buttonRow} className="eco-button-row">
              <button onClick={() => calculateRoute()} style={styles.secondaryButton}>
                Ponovno izračunaj
              </button>

              <button
                onClick={() => setShowHeatmap(h => !h)}
                style={showHeatmap ? styles.heatmapButtonActive : styles.secondaryButton}
              >
                {showHeatmap ? 'Skrij toplotno karto' : 'Prikaži toplotno karto'}
              </button>

              {startPoint && endPoint && (
                <button onClick={saveFavoriteRoute} style={styles.secondaryButton}>
                  Sačuvaj rutu
                </button>
              )}
            </div>

            {favoriteRoutes.length > 0 && (
              <div style={styles.favoritesBlock}>
                <p style={styles.favoritesLabel}>Omiljene rute</p>
                <div style={styles.favoritesList}>
                  {favoriteRoutes.map(favorite => (
                    <div key={favorite.id} style={styles.favoriteItem}>
                      <button
                        onClick={() => loadFavoriteRoute(favorite)}
                        style={styles.favoriteButton}
                        title="Naloži to omiljeno pot"
                      >
                        {favorite.name}
                      </button>
                      <button
                        onClick={() => deleteFavoriteRoute(favorite.id)}
                        style={styles.favoriteRemoveButton}
                        aria-label="Odstrani iz omiljenih"
                        title="Odstrani iz omiljenih"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={styles.optionRow} className="eco-option-row">
              {routeOptions.map(route => {
                const isSelected = selectedRouteType === route.id
                const showDetail = isSelected && routeInfo

                return (
                  <div key={route.id} style={styles.optionCard}>
                    <button
                      onClick={() => selectRouteType(route.id)}
                      style={isSelected ? styles.optionButtonActive : styles.optionButton}
                    >
                      <span style={{ ...styles.optionDot, backgroundColor: route.color }} />
                      <span style={styles.optionName}>{route.name}</span>
                      {showDetail && (
                        <span style={styles.optionMeta}>
                          {routeInfo.distanceKm} km · {formatDuration(routeInfo.durationMin)}
                        </span>
                      )}
                    </button>

                    {!showDetail && (
                      <p style={styles.optionDesc}>{route.description}</p>
                    )}

                    {showDetail && (
                      <div style={styles.optionDetail}>
                        <div style={styles.metricGrid}>
                          <div style={styles.metricBox}>
                            <span style={styles.metricLabel}>Razdalja</span>
                            <strong style={styles.metricValue}>{routeInfo.distanceKm} km</strong>
                          </div>
                          <div style={styles.metricBox}>
                            <span style={styles.metricLabel}>Trajanje</span>
                            <strong style={styles.metricValue}>{formatDuration(routeInfo.durationMin)}</strong>
                          </div>
                          <div style={styles.metricBox}>
                            <span style={styles.metricLabel}>Eko-ocena</span>
                            <strong style={{ ...styles.metricValue, color: getScoreColor(routeInfo.ecoScore) }}>
                              {routeInfo.ecoScore !== null ? `${routeInfo.ecoScore}/100` : 'Ni podatkov'}
                            </strong>
                          </div>
                        </div>

                        <p style={styles.text}>
                          <strong>Sloj:</strong> {formatEnvironmentalType(routeInfo.environmentType)}
                        </p>
                        <p style={styles.text}>
                          <strong>Izbira:</strong> {routeInfo.strategyReason}
                        </p>
                        <p style={styles.mutedText}>
                          Primerjanih {routeInfo.alternativeCount} možnih poti z uporabo {routeInfo.stationCount} bližnjih ARSO postaj.
                        </p>
                        <p style={styles.text}>{routeInfo.recommendation}</p>

                        <p style={styles.text}>
                          <strong>Najbližja ARSO postaja:</strong> {routeInfo.nearestStationKm !== null ? `${routeInfo.nearestStationKm} km stran` : 'Nobena v okviru 35 km'}
                        </p>
                        {routeInfo.stationNames?.length > 0 && (
                          <p style={styles.text}>
                            <strong>Uporabljene postaje:</strong> {routeInfo.stationNames.join(', ')}
                          </p>
                        )}
                        <p style={routeInfo.stationCount ? styles.successText : styles.mutedText}>
                          {routeInfo.stationCount
                            ? 'Eko-ocena temelji na resničnih ARSO meritvah kakovosti zraka v bližini te poti.'
                            : 'Nobena resnična postaja za kakovost zraka ni dovolj blizu, da bi lahko pošteno ocenili to pot.'}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </aside>

          <div style={styles.mapBox} className="eco-map-box">
            <div style={styles.mapLegend}>
              <span><i style={{ ...styles.legendDot, backgroundColor: '#15803d' }} /> Eko</span>
              <span><i style={{ ...styles.legendDot, backgroundColor: '#2563eb' }} /> Hitro</span>
              <span><i style={{ ...styles.legendDot, backgroundColor: '#b45309' }} /> Uravnoteženo</span>
            </div>

            <button onClick={handleLocateClick} style={styles.locateButton} title="Prikaži mojo resnično lokacijo">
              Moja lokacija
            </button>

            <MapContainer
              center={ecoProfile?.preferredRegion ? regionCoordinates[ecoProfile.preferredRegion] : [46.1512, 14.9955]}
              zoom={8}
              style={styles.map}
              className="eco-map"
            >
              <MapResizeHandler />

              <RouteClickHandler
                onSelectPoint={handleSelectPoint}
              />

              <FlyToRegion
                center={ecoProfile?.preferredRegion
                  ? regionCoordinates[ecoProfile.preferredRegion]
                  : null}
              />

              <FlyToUserLocation position={flyToMyPosition} />

              <FlyToPlannedRoute startPoint={startPoint} endPoint={endPoint} routePoints={routePoints} />

              {selectedRouteCoordinates.length > 0 && (
                <FlyToRoute routeCoordinates={selectedRouteCoordinates} />
              )}

              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
              />

              {myPosition && (
                <CircleMarker
                  center={[myPosition.latitude, myPosition.longitude]}
                  radius={9}
                  pathOptions={{
                    color: '#2563eb',
                    fillColor: '#2563eb',
                    fillOpacity: 0.85,
                    weight: 3
                  }}
                >
                  <Popup>
                    <strong>Tukaj si</strong>
                    <br />
                    {myAirQuality?.score != null
                      ? <>Resnični indeks kakovosti zraka: {myAirQuality.score}/100
                          <br />Najbližja postaja: {myAirQuality.stationNames?.[0] ?? 'ARSO postaja'} ({myAirQuality.nearestDistanceKm} km)</>
                      : 'Nobena resnična ARSO postaja za kakovost zraka ni v dosegu tvoje lokacije (ARSO pokriva samo Slovenijo).'}
                  </Popup>
                </CircleMarker>
              )}

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
                  <Popup>Začetna točka</Popup>
                </Marker>
              )}

              {endPoint && (
                <Marker position={endPoint}>
                  <Popup>Cilj</Popup>
                </Marker>
              )}

              {routeAlternatives.map((alternative, index) => (
                <Polyline
                  key={`alternative-${index}`}
                  positions={alternative}
                  pathOptions={{
                    color: '#94a3b8',
                    weight: 3,
                    opacity: 0.38,
                    dashArray: '7, 8'
                  }}
                />
              ))}

              {routePoints.length > 0 && (
                <Polyline
                  positions={routePoints}
                  pathOptions={{
                    color:
                      selectedRouteType === 'ECO'
                        ? '#15803d'
                        : selectedRouteType === 'FAST'
                          ? '#2563eb'
                          : '#b45309',
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
                      color: '#15803d',
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
                        color: '#15803d',
                        fillColor: '#86efac',
                        fillOpacity: 0.8,
                        weight: 2
                      }}
                    >
                      <Popup>Začetek</Popup>
                    </CircleMarker>
                  )}
                  {selectedRouteCoordinates.length > 0 && (
                    <CircleMarker
                      center={selectedRouteCoordinates[selectedRouteCoordinates.length - 1]}
                      radius={6}
                      pathOptions={{
                        color: '#b91c1c',
                        fillColor: '#fca5a5',
                        fillOpacity: 0.8,
                        weight: 2
                      }}
                    >
                      <Popup>Konec</Popup>
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
                      Eko-ocena: {route.ecoScore}/100
                      <br />
                      Stanje: {route.ecoScoreLabel}
                      <br />
                      Točke: {route.pointCount}
                    </Popup>
                  </Polyline>
                )
              })}
            </MapContainer>
          </div>
        </div>

        <div style={styles.infoPanel}>
          <p style={styles.eyebrow}>Stanje sistema</p>
          <h2 style={styles.sectionTitle}>Moduli projekta</h2>

          <div style={styles.moduleList} className="eco-module-list">
            <div style={styles.moduleItem}>
              <span style={styles.moduleDot} />
              <div>
                <strong>Copernicus podatki</strong>
                <p>{filteredProducts.length} vidnih produktov</p>
              </div>
            </div>

            <div style={styles.moduleItem}>
              <span style={styles.moduleDot} />
              <div>
                <strong>GPX poti</strong>
                <p>{uploadedRoutes.length} naloženih poti</p>
              </div>
            </div>

            <div style={styles.moduleItem}>
              <span style={styles.moduleDot} />
              <div>
                <strong>Toplotna karta</strong>
                <p>{showHeatmap ? 'Omogočeno' : 'Onemogočeno'}</p>
              </div>
            </div>

            <div style={styles.moduleItem}>
              <span style={styles.moduleDot} />
              <div>
                <strong>Eko profil</strong>
                <p>{ecoProfile ? 'Aktiven' : 'Ni nastavljen'}</p>
              </div>
            </div>

            <div style={styles.moduleItem}>
              <span style={styles.moduleDot} />
              <div>
                <strong>ARSO kakovost zraka</strong>
                <p>{airQualityStatus}</p>
              </div>
            </div>

            <div style={styles.moduleItem}>
              <span style={styles.moduleDot} />
              <div>
                <strong>Simulirani IoT senzorji (demo)</strong>
                <p>{sensorStatus}</p>
              </div>
            </div>
          </div>
        </div>

        <HistoricalTrends products={filteredProducts} routes={uploadedRoutes} />

        <section style={styles.uploadedRoutesSection}>
          <div style={styles.uploadedRoutesHeader} className="eco-uploaded-header">
            <div>
              <p style={styles.eyebrow}>Arhiv poti</p>
              <h2 style={styles.sectionTitle}>Naložene GPX poti</h2>
              <p style={styles.text}>{routesStatus}</p>
            </div>

            <button onClick={loadUploadedRoutes} style={styles.secondaryButton}>
              Osveži poti
            </button>
          </div>

          {uploadedRoutes.length === 0 ? (
            <div style={styles.emptyState}>
              <h3>Še ni naloženih GPX poti</h3>
              <p>Naloži GPX pot za analizo eko-ocene in prikaz na zemljevidu.</p>
              <Link to="/gpx-upload" style={styles.emptyButton}>Naloži GPX pot</Link>
            </div>
          ) : (
            <>
              <div style={styles.routeCardsGrid} className="eco-route-cards">
                {uploadedRoutes.slice(0, visibleRouteCount).map(route => (
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

                    <p style={styles.text}><strong>Stanje:</strong> {route.ecoScoreLabel}</p>
                    <p style={styles.text}><strong>Točke sledi:</strong> {route.pointCount}</p>
                    <p style={styles.text}><strong>Naloženo:</strong> {route.uploadedAt || 'ni na voljo'}</p>

                    <p style={styles.mutedText}>
                      Ta naložena GPX pot je narisana na zemljevidu z uporabo shranjenih koordinat poti iz strežnika.
                    </p>
                  </div>
                ))}
              </div>

              {visibleRouteCount < uploadedRoutes.length && (
                <button
                  onClick={() => setVisibleRouteCount(count => count + 6)}
                  style={styles.viewMoreButton}
                >
                  Prikaži več ({uploadedRoutes.length - visibleRouteCount} preostalih)
                </button>
              )}
            </>
          )}
        </section>
      </section>

      <AppFooter />
    </div>
  )
}

function PrivateRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" />
}

function ThemeToggle() {
  const [theme, setTheme] = useState(() => localStorage.getItem('ecoTheme') || 'light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('ecoTheme', theme)
  }, [theme])

  return (
    <button
      onClick={() => setTheme(current => (current === 'dark' ? 'light' : 'dark'))}
      style={themeToggleStyle}
      title={theme === 'dark' ? 'Preklopi na svetli način' : 'Preklopi na temni način'}
    >
      {theme === 'dark' ? 'Svetli način' : 'Temni način'}
    </button>
  )
}

function CookieConsent() {
  const [accepted, setAccepted] = useState(() => localStorage.getItem('cookieConsentAccepted') === 'true')

  if (accepted) return null

  const accept = () => {
    localStorage.setItem('cookieConsentAccepted', 'true')
    setAccepted(true)
  }

  return (
    <div style={cookieConsentStyle} role="dialog" aria-label="Obvestilo o piškotkih">
      <p style={cookieConsentTextStyle}>
        Ta stran za prijavo in shranjevanje tvojih nastavitev uporablja lokalno shrambo brskalnika. Z nadaljnjo uporabo se s tem strinjaš.
      </p>
      <button onClick={accept} style={cookieConsentButtonStyle}>V redu</button>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ThemeToggle />
      <CookieConsent />
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

const themeToggleStyle = {
  position: 'fixed',
  bottom: '20px',
  right: '20px',
  zIndex: 1000,
  padding: '10px 16px',
  borderRadius: '999px',
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text)',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '13px',
  fontFamily: 'var(--font)',
  boxShadow: 'var(--shadow-md)'
}

const cookieConsentStyle = {
  position: 'fixed',
  bottom: '20px',
  left: '20px',
  zIndex: 1000,
  maxWidth: '360px',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  padding: '16px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  boxShadow: 'var(--shadow-md)',
  fontFamily: 'var(--font)'
}

const cookieConsentTextStyle = {
  margin: 0,
  color: 'var(--text)',
  fontSize: '13px',
  lineHeight: 1.5
}

const cookieConsentButtonStyle = {
  alignSelf: 'flex-end',
  padding: '8px 18px',
  borderRadius: 'var(--radius-sm)',
  border: 'none',
  background: 'var(--brand)',
  color: '#fff',
  fontWeight: 700,
  fontSize: '13px',
  cursor: 'pointer',
  fontFamily: 'var(--font)'
}

const baseButton = {
  padding: '10px 16px',
  color: '#ffffff',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '14px',
  fontFamily: 'var(--font)',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  background: 'var(--brand)'
}

const outlineButton = {
  ...baseButton,
  color: 'var(--text)',
  background: 'var(--surface)',
  border: '1px solid var(--border-strong)'
}

const card = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-sm)'
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontFamily: 'var(--font)'
  },
  header: {
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
    width: '48px',
    height: '48px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--brand)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: 800,
    letterSpacing: '0.02em'
  },
  title: {
    margin: 0,
    fontSize: '32px',
    lineHeight: 1.1,
    fontWeight: 800,
    letterSpacing: '-0.03em',
    color: 'var(--text)'
  },
  description: {
    color: 'var(--text-muted)',
    marginTop: '6px',
    fontSize: '15px'
  },
  pageIntro: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '20px'
  },
  statusPill: {
    alignSelf: 'flex-start',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '7px 12px',
    borderRadius: '999px',
    background: 'var(--surface-muted)',
    border: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontSize: '13px',
    fontWeight: 600
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'var(--brand)'
  },
  statusDotError: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'var(--danger)'
  },
  nav: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end'
  },
  navButtonPrimary: {
    ...baseButton
  },
  navButtonSecondary: {
    ...outlineButton
  },
  navButtonGhost: {
    ...outlineButton,
    color: 'var(--danger)',
    borderColor: 'var(--border)'
  },
  container: {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '0 28px 52px'
  },
  environmentAlert: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '18px',
    marginBottom: '18px',
    padding: '16px 18px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid #fed7aa',
    background: 'var(--warning-soft)',
    color: 'var(--warning)'
  },
  environmentAlertClear: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '18px',
    marginBottom: '18px',
    padding: '16px 18px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--brand-soft-border)',
    background: 'var(--brand-soft)',
    color: 'var(--brand-hover)'
  },
  alertSettingsLink: {
    color: 'inherit',
    fontWeight: 700,
    whiteSpace: 'nowrap',
    overflowWrap: 'anywhere'
  },
  alertContent: {
    minWidth: 0
  },
  alertActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '8px',
    flexWrap: 'wrap',
    flexShrink: 0
  },
  alertTestButton: {
    padding: '7px 10px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid currentColor',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    fontWeight: 600,
    whiteSpace: 'nowrap'
  },
  filters: {
    ...card,
    padding: '18px',
    borderRadius: 'var(--radius-lg)',
    marginBottom: '20px',
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 1fr) auto',
    gap: '16px',
    alignItems: 'end'
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    color: 'var(--text-muted)',
    fontWeight: 600,
    fontSize: '13px'
  },
  input: {
    width: '100%',
    minHeight: '42px',
    padding: '8px 12px',
    borderRadius: 'var(--radius-sm)'
  },
  resetButton: {
    ...outlineButton,
    color: 'var(--danger)',
    minHeight: '42px'
  },
  plannerRow: {
    display: 'flex',
    gap: '20px',
    alignItems: 'stretch',
    marginBottom: '20px'
  },
  sidebar: {
    ...card,
    flex: '0 0 380px',
    padding: '20px',
    borderRadius: 'var(--radius-lg)'
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
    color: 'var(--brand)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    fontSize: '11px',
    fontWeight: 700
  },
  sectionTitle: {
    margin: '4px 0 0',
    color: 'var(--text)',
    fontSize: '22px',
    fontWeight: 700,
    letterSpacing: '-0.02em'
  },
  cardTitle: {
    margin: '6px 0 12px',
    color: 'var(--text)',
    fontSize: '18px',
    fontWeight: 700
  },
  routeTypeBadge: {
    padding: '6px 12px',
    borderRadius: '999px',
    background: 'var(--brand-soft)',
    border: '1px solid var(--brand-soft-border)',
    color: 'var(--brand-hover)',
    fontWeight: 700,
    fontSize: '12px'
  },
  text: {
    color: 'var(--text-muted)',
    lineHeight: 1.6,
    fontSize: '14px'
  },
  mutedText: {
    color: 'var(--text-faint)',
    lineHeight: 1.55,
    marginTop: '10px',
    fontSize: '13px'
  },
  profileNotice: {
    background: 'var(--brand-soft)',
    border: '1px solid var(--brand-soft-border)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 14px',
    marginBottom: '14px',
    fontSize: '13px',
    color: 'var(--brand-hover)'
  },
  profileNoticeActive: {
    background: 'var(--brand)',
    border: '1px solid var(--brand)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 14px',
    marginBottom: '14px',
    fontSize: '13px',
    color: '#ffffff'
  },
  loadedRouteNotice: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '10px',
    background: 'var(--info-soft)',
    border: '1px solid var(--info-soft-border)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 14px',
    marginBottom: '14px',
    fontSize: '13px',
    color: 'var(--info)'
  },
  loadedRouteCloseButton: {
    width: '22px',
    height: '22px',
    flexShrink: 0,
    borderRadius: '50%',
    border: '1px solid currentColor',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: '14px',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0
  },
  profileNoticeWarning: {
    background: 'var(--warning-soft)',
    border: '1px solid var(--warning-soft-border)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 14px',
    marginBottom: '14px',
    fontSize: '13px',
    color: 'var(--warning)'
  },
  inlineLink: {
    color: 'inherit',
    marginLeft: '10px',
    fontWeight: 700,
    textDecoration: 'none'
  },
  inlineLinkWarning: {
    color: 'inherit',
    marginLeft: '10px',
    fontWeight: 700,
    textDecoration: 'none'
  },
  searchField: {
    position: 'relative',
    marginTop: '8px'
  },
  searchInput: {
    width: '100%',
    minHeight: '40px',
    padding: '8px 12px',
    borderRadius: 'var(--radius-md)',
    fontSize: '13px'
  },
  searchStatus: {
    position: 'absolute',
    top: '11px',
    right: '12px',
    color: 'var(--text-faint)',
    fontSize: '12px'
  },
  searchResults: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    zIndex: 600,
    background: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-md)',
    maxHeight: '220px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column'
  },
  searchResultItem: {
    padding: '10px 12px',
    border: 'none',
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '13px',
    fontFamily: 'var(--font)'
  },
  pointsBlock: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px 40px 12px 14px',
    background: 'var(--surface-muted)',
    borderRadius: 'var(--radius-md)',
    marginTop: '6px',
    marginBottom: '6px'
  },
  pointRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '14px',
    color: 'var(--text)'
  },
  pointDotStart: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: 'var(--brand)',
    flexShrink: 0
  },
  pointDotEnd: {
    width: '10px',
    height: '10px',
    borderRadius: '2px',
    backgroundColor: 'var(--danger)',
    flexShrink: 0
  },
  clearButton: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '16px',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0
  },
  routeStatus: {
    marginTop: '4px',
    marginBottom: '4px',
    color: 'var(--text-muted)',
    fontSize: '13px',
    fontWeight: 600
  },
  errorText: {
    color: 'var(--warning)',
    fontWeight: 600,
    fontSize: '13px'
  },
  buttonRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '10px',
    marginBottom: '16px'
  },
  secondaryButton: {
    ...outlineButton,
    padding: '8px 14px',
    fontSize: '13px'
  },
  heatmapButtonActive: {
    ...baseButton,
    background: 'var(--info)',
    padding: '8px 14px',
    fontSize: '13px'
  },
  favoritesBlock: {
    marginBottom: '16px'
  },
  favoritesLabel: {
    margin: '0 0 8px',
    color: 'var(--text-muted)',
    fontSize: '12px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em'
  },
  favoritesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  favoriteItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  favoriteButton: {
    flex: 1,
    minWidth: 0,
    padding: '8px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
    background: 'var(--surface-muted)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    textAlign: 'left',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font)'
  },
  favoriteRemoveButton: {
    width: '28px',
    height: '28px',
    flexShrink: 0,
    borderRadius: '50%',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '15px',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0
  },
  optionRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  optionCard: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden'
  },
  optionButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 14px',
    border: 'none',
    background: 'var(--surface)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '14px',
    fontFamily: 'var(--font)',
    textAlign: 'left'
  },
  optionButtonActive: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 14px',
    border: 'none',
    background: 'var(--surface-muted)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '14px',
    fontFamily: 'var(--font)',
    textAlign: 'left',
    borderLeft: '3px solid var(--brand)'
  },
  optionDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0
  },
  optionName: {
    flex: 1
  },
  optionMeta: {
    color: 'var(--text-muted)',
    fontSize: '12px',
    fontWeight: 500,
    whiteSpace: 'nowrap'
  },
  optionDesc: {
    margin: 0,
    padding: '0 14px 12px 34px',
    color: 'var(--text-muted)',
    fontSize: '13px',
    background: 'var(--surface)'
  },
  optionDetail: {
    padding: '4px 14px 16px',
    background: 'var(--surface-muted)',
    borderTop: '1px solid var(--border)'
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
    margin: '12px 0'
  },
  metricBox: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px'
  },
  metricLabel: {
    display: 'block',
    color: 'var(--text-faint)',
    fontSize: '11px',
    marginBottom: '4px'
  },
  metricValue: {
    color: 'var(--text)',
    fontSize: '15px'
  },
  successText: {
    color: 'var(--brand)',
    fontWeight: 700,
    marginTop: '8px',
    fontSize: '13px'
  },
  mapBox: {
    ...card,
    flex: '1 1 auto',
    padding: '10px',
    borderRadius: 'var(--radius-lg)',
    position: 'relative',
    minWidth: 0,
    display: 'flex',
    alignSelf: 'stretch'
  },
  mapLegend: {
    position: 'absolute',
    top: '20px',
    left: '20px',
    zIndex: 500,
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '999px',
    padding: '6px 12px',
    color: 'var(--text-muted)',
    fontSize: '12px',
    fontWeight: 600,
    boxShadow: 'var(--shadow-sm)'
  },
  legendDot: {
    display: 'inline-block',
    width: '9px',
    height: '9px',
    borderRadius: '50%',
    marginRight: '5px'
  },
  locateButton: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    zIndex: 500,
    padding: '8px 14px',
    borderRadius: '999px',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '13px',
    fontFamily: 'var(--font)',
    boxShadow: 'var(--shadow-sm)'
  },
  map: {
    height: '100%',
    minHeight: 0,
    width: '100%',
    flex: 1,
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden'
  },
  infoPanel: {
    ...card,
    padding: '20px',
    borderRadius: 'var(--radius-lg)',
    marginBottom: '20px'
  },
  moduleList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '10px',
    marginTop: '16px'
  },
  moduleItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'var(--surface-muted)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 14px',
    fontSize: '13px'
  },
  moduleDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'var(--brand)',
    flexShrink: 0
  },
  trendsSection: {
    ...card,
    marginTop: '20px',
    padding: '18px',
    borderRadius: 'var(--radius-lg)'
  },
  trendsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    marginBottom: '12px'
  },
  uploadedRoutesSection: {
    ...card,
    marginTop: '20px',
    padding: '20px',
    borderRadius: 'var(--radius-lg)'
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
  viewMoreButton: {
    display: 'block',
    margin: '18px auto 0',
    padding: '10px 20px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer'
  },
  gpxCard: {
    background: 'var(--surface-muted)',
    padding: '16px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)'
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
    padding: '6px 12px',
    borderRadius: '999px',
    color: '#fff',
    fontWeight: '700',
    fontSize: '13px',
    whiteSpace: 'nowrap'
  },
  emptyState: {
    border: '1px dashed var(--border-strong)',
    borderRadius: 'var(--radius-lg)',
    padding: '34px',
    textAlign: 'center',
    color: 'var(--text-muted)'
  },
  emptyButton: {
    ...baseButton,
    marginTop: '16px',
    display: 'inline-flex'
  }
}

export default App
