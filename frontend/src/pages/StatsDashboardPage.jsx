import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { calculateRouteAirQuality, normalizeAirQualityStations } from '../utils/environment'
import { useRealGeolocation } from '../hooks/useRealGeolocation'

function getAuthHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` }
}

function getEnvironmentalType(name) {
  if (!name) return 'OTHER'
  if (name.includes('SL_2') || name.includes('LST')) return 'LAND_TEMPERATURE'
  if (name.includes('OL_2') || name.includes('WRR')) return 'WATER_QUALITY'
  return 'AIR_QUALITY'
}

function StatCard({ label, value, color, icon, description }) {
  return (
    <div style={{ ...styles.statCard, borderColor: `${color}55` }}>
      <div style={{ ...styles.statIcon, background: `${color}22`, color }}>{icon}</div>
      <div>
        <div style={{ ...styles.statValue, color }}>{value}</div>
        <div style={styles.statLabel}>{label}</div>
        {description && <div style={styles.statDescription}>{description}</div>}
      </div>
    </div>
  )
}

function BarChart({ data, maxValue }) {
  return (
    <div style={styles.barChart}>
      {data.map((item, i) => (
        <div key={i} style={styles.barRow}>
          <div style={styles.barLabel}>{item.label}</div>
          <div style={styles.barTrack}>
            <div
              style={{
                ...styles.barFill,
                width: maxValue > 0 ? `${Math.max(4, (item.value / maxValue) * 100)}%` : '0%',
                background: `linear-gradient(135deg, ${item.color}, ${item.color}cc)`
              }}
            />
          </div>
          <div style={styles.barValue}>{item.value}</div>
        </div>
      ))}
    </div>
  )
}

function StatsDashboardPage() {
  const [products, setProducts] = useState([])
  const [routes, setRoutes] = useState([])
  const [sensorData, setSensorData] = useState([])
  const [sensorStatus, setSensorStatus] = useState('loading')
  const [loading, setLoading] = useState(true)
  const [selectedActivity, setSelectedActivity] = useState('WALKING')
  const [locationState, setLocationState] = useState({ status: 'idle', message: '' })

  const loadSensorData = () => {
    axios.get('http://localhost:8080/api/succulent-data', { headers: getAuthHeaders() })
      .then(res => {
        if (Array.isArray(res.data)) {
          setSensorData(res.data)
          setSensorStatus('ok')
        } else if (res.data?.status === 'unavailable') {
          setSensorStatus('unavailable')
        } else {
          setSensorStatus('ok')
        }
      })
      .catch(() => setSensorStatus('unavailable'))
  }

  useEffect(() => {
    const headers = getAuthHeaders()

    Promise.all([
      axios.get('http://localhost:8080/api/copernicus-products', { headers }),
      axios.get('http://localhost:8080/api/routes', { headers })
    ])
      .then(([prodRes, routeRes]) => {
        setProducts(prodRes.data)
        setRoutes(routeRes.data)
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))

    loadSensorData()
  }, [])

  // Looks up real ARSO air quality and real Open-Meteo temperature for a
  // real GPS position - reusing the same nearest-station EAQI logic already
  // built and tested for route scoring, rather than duplicating it or
  // fabricating a reading.
  const recordMeasurementForPosition = async ({ latitude, longitude }) => {
    setLocationState({ status: 'requesting', message: 'Looking up real air quality and weather for your location...' })

    try {
      const [airQualityRes, weatherRes] = await Promise.all([
        axios.get('http://localhost:8080/api/air-quality', { headers: getAuthHeaders() }),
        axios.get('https://api.open-meteo.com/v1/forecast', {
          params: { latitude, longitude, current: 'temperature_2m' }
        })
      ])

      const stations = normalizeAirQualityStations(airQualityRes.data)
      const airQuality = calculateRouteAirQuality([[latitude, longitude]], stations)
      const temperature = weatherRes.data?.current?.temperature_2m

      // ARSO only monitors Slovenia, while Open-Meteo is global - so outside
      // Slovenia, air quality alone is expected to be unavailable. Only
      // refuse to record when NEITHER real source has anything, and only
      // ever send the specific fields that are genuinely known (never a
      // fabricated placeholder for the other one).
      if (airQuality?.score == null && temperature == null) {
        setLocationState({
          status: 'error',
          message: 'Could not record a real measurement: no nearby ARSO air-quality station and no weather data for your current location.'
        })
        return
      }

      const measurement = { latitude, longitude, activity_type: selectedActivity }
      if (airQuality?.score != null) {
        measurement.air_quality = airQuality.score
        measurement.eco_score = airQuality.score
      }
      if (temperature != null) {
        measurement.temperature = temperature
      }

      await axios.post('http://localhost:8080/api/succulent-data', measurement, { headers: getAuthHeaders() })

      const parts = []
      parts.push(airQuality?.score != null
        ? `${airQuality.stationCount} nearby ARSO station(s)`
        : 'no ARSO air-quality station nearby (Slovenia only)')
      if (temperature != null) parts.push(`${temperature}°C`)

      setLocationState({
        status: 'success',
        message: `Recorded your real location - ${parts.join(', ')}.`
      })
      loadSensorData()
    } catch (err) {
      console.error(err)
      setLocationState({ status: 'error', message: 'Failed to record your real measurement.' })
    }
  }

  // recordMeasurementForPosition fires both when the button below is clicked
  // (first-time grant) and automatically once useRealGeolocation silently
  // resolves a position on mount because permission was already granted on a
  // previous visit - so repeat visits don't require clicking the button again.
  const { error: geoError, requestLocation } = useRealGeolocation(recordMeasurementForPosition)

  const airCount = products.filter(p => getEnvironmentalType(p.name) === 'AIR_QUALITY').length
  const waterCount = products.filter(p => getEnvironmentalType(p.name) === 'WATER_QUALITY').length
  const tempCount = products.filter(p => getEnvironmentalType(p.name) === 'LAND_TEMPERATURE').length
  const otherCount = products.length - airCount - waterCount - tempCount

  const avgScore = routes.length > 0
    ? (routes.reduce((sum, r) => sum + (r.ecoScore || 0), 0) / routes.length).toFixed(1)
    : 0

  const excellentRoutes = routes.filter(r => r.ecoScore >= 80).length
  const goodRoutes = routes.filter(r => r.ecoScore >= 60 && r.ecoScore < 80).length
  const moderateRoutes = routes.filter(r => r.ecoScore >= 40 && r.ecoScore < 60).length
  const poorRoutes = routes.filter(r => r.ecoScore < 40).length

  const envBarData = [
    { label: 'Air quality', value: airCount, color: '#3b82f6' },
    { label: 'Water quality', value: waterCount, color: '#06b6d4' },
    { label: 'Land temperature', value: tempCount, color: '#f59e0b' },
    { label: 'Other', value: otherCount, color: '#6366f1' }
  ]

  const scoreBarData = [
    { label: 'Excellent (80+)', value: excellentRoutes, color: '#22c55e' },
    { label: 'Good (60–79)', value: goodRoutes, color: '#3b82f6' },
    { label: 'Moderate (40–59)', value: moderateRoutes, color: '#f59e0b' },
    { label: 'Poor (<40)', value: poorRoutes, color: '#ef4444' }
  ]

  const maxEnv = Math.max(...envBarData.map(d => d.value), 1)
  const maxScore = Math.max(...scoreBarData.map(d => d.value), 1)

  return (
    <div style={styles.page}>
      <div style={styles.glowOne} />
      <div style={styles.glowTwo} />

      <header style={styles.header} className="eco-header">
        <div>
          <p style={styles.eyebrow}>Analytics center</p>
          <h1 style={styles.title}>Environmental Dashboard</h1>
          <p style={styles.subtitle}>
            Real-time overview of satellite products, GPX routes and environmental measurements.
          </p>
        </div>

        <Link to="/" style={styles.backButton}>← Back to map</Link>
      </header>

      {loading ? (
        <div style={styles.loadingCard}>
          <div style={styles.spinner}>🌿</div>
          <strong>Loading dashboard data...</strong>
          <span>Fetching environmental products and uploaded routes.</span>
        </div>
      ) : (
        <main style={styles.container} className="eco-container">
          <div style={styles.cardsGrid} className="eco-cards-grid">
            <StatCard
              label="Environmental products"
              value={products.length}
              color="#3b82f6"
              icon="🌍"
              description="Copernicus records"
            />
            <StatCard
              label="Uploaded GPX routes"
              value={routes.length}
              color="#22c55e"
              icon="🗺️"
              description="Stored route files"
            />
            <StatCard
              label="Average eco-score"
              value={`${avgScore}/100`}
              color="#f59e0b"
              icon="⭐"
              description="Across saved routes"
            />
            <StatCard
              label="Excellent routes"
              value={excellentRoutes}
              color="#10b981"
              icon="✅"
              description="Routes above 80"
            />
          </div>

          <div style={styles.gridTwo}>
            <section style={styles.section}>
              <div style={styles.sectionHeader}>
                <div>
                  <p style={styles.eyebrow}>Satellite data</p>
                  <h2 style={styles.sectionTitle}>Environmental data by type</h2>
                </div>
                <span style={styles.pill}>{products.length} products</span>
              </div>

              <p style={styles.sectionDesc}>
                Distribution of Copernicus satellite products currently stored in the database.
              </p>

              <BarChart data={envBarData} maxValue={maxEnv} />
            </section>

            <section style={styles.section}>
              <div style={styles.sectionHeader}>
                <div>
                  <p style={styles.eyebrow}>Route quality</p>
                  <h2 style={styles.sectionTitle}>Routes by eco-score</h2>
                </div>
                <span style={styles.pill}>{routes.length} routes</span>
              </div>

              <p style={styles.sectionDesc}>
                Eco-score distribution across all uploaded GPX routes.
              </p>

              {routes.length === 0 ? (
                <p style={styles.empty}>No routes uploaded yet. Upload a GPX file to see stats.</p>
              ) : (
                <BarChart data={scoreBarData} maxValue={maxScore} />
              )}
            </section>
          </div>

          {routes.length > 0 && (
            <section style={styles.section}>
              <div style={styles.sectionHeader}>
                <div>
                  <p style={styles.eyebrow}>Route archive</p>
                  <h2 style={styles.sectionTitle}>Uploaded routes</h2>
                </div>
              </div>

              <div style={styles.routeTable}>
                <div style={styles.tableHeader}>
                  <span>Name</span>
                  <span>Points</span>
                  <span>Eco-score</span>
                  <span>Status</span>
                </div>

                {routes.map(route => (
                  <div key={route.id} style={styles.tableRow}>
                    <span style={styles.routeName}>{route.name}</span>
                    <span>{route.pointCount}</span>
                    <span style={{
                      color: route.ecoScore >= 80 ? '#22c55e' : route.ecoScore >= 60 ? '#3b82f6' : '#f59e0b',
                      fontWeight: 900
                    }}>
                      {route.ecoScore}/100
                    </span>
                    <span style={styles.badge}>{route.ecoScoreLabel}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <div>
                <p style={styles.eyebrow}>IoT integration (simulated demo)</p>
                <h2 style={styles.sectionTitle}>Live sensor data</h2>
              </div>
              <span style={sensorStatus === 'ok' ? styles.pillSuccess : styles.pillWarning}>
                {sensorStatus === 'ok' ? 'Online' : 'Unavailable'}
              </span>
            </div>

            <p style={styles.sectionDesc}>
              Simulated sensor readings generated by a demo script (no physical IoT devices are connected), sent through the
              Succulent data collection framework to illustrate how live device data would flow through the system.
            </p>

            <div style={styles.locationRecorder}>
              <select
                value={selectedActivity}
                onChange={(e) => setSelectedActivity(e.target.value)}
                style={styles.activitySelect}
              >
                <option value="WALKING">🚶 Walking</option>
                <option value="CYCLING">🚴 Cycling</option>
                <option value="RUNNING">🏃 Running</option>
              </select>

              <button
                onClick={requestLocation}
                disabled={locationState.status === 'requesting'}
                style={styles.recordButton}
              >
                {locationState.status === 'requesting' ? 'Getting your location...' : '📍 Share my real location'}
              </button>

              {geoError && (
                <p style={styles.locationError}>{geoError}</p>
              )}

              {!geoError && locationState.message && (
                <p style={locationState.status === 'error' ? styles.locationError : styles.locationSuccess}>
                  {locationState.message}
                </p>
              )}
            </div>

            {sensorStatus === 'unavailable' && (
              <div style={styles.sensorOffline}>
                <span style={styles.offlineIcon}>📡</span>
                <div>
                  <strong>Succulent server offline</strong>
                  <p style={styles.offlineText}>
                    Start the collector: <code style={styles.code}>cd succulent &amp;&amp; python run.py</code><br />
                    Then run simulator: <code style={styles.code}>python simulate_data.py</code>
                  </p>
                </div>
              </div>
            )}

            {sensorStatus === 'ok' && sensorData.length === 0 && (
              <p style={styles.empty}>No sensor measurements yet. Run the simulator to generate data.</p>
            )}

            {sensorStatus === 'ok' && sensorData.length > 0 && (
              <>
                <div style={styles.sensorCards}>
                  <div style={styles.sensorStat}>
                    <strong style={{ color: '#22c55e' }}>{sensorData.length}</strong>
                    <span>Total measurements</span>
                  </div>

                  <div style={styles.sensorStat}>
                    <strong style={{ color: '#3b82f6' }}>
                      {sensorData.filter(d => d.activity_type === 'WALKING').length}
                    </strong>
                    <span>🚶 Walking</span>
                  </div>

                  <div style={styles.sensorStat}>
                    <strong style={{ color: '#f59e0b' }}>
                      {sensorData.filter(d => d.activity_type === 'CYCLING').length}
                    </strong>
                    <span>🚴 Cycling</span>
                  </div>

                  <div style={styles.sensorStat}>
                    <strong style={{ color: '#a78bfa' }}>
                      {sensorData.filter(d => d.activity_type === 'RUNNING').length}
                    </strong>
                    <span>🏃 Running</span>
                  </div>
                </div>

                <div style={styles.sensorTableWrap}>
                  <div style={styles.sensorTableHeader}>
                    <span>Latitude</span>
                    <span>Longitude</span>
                    <span>Activity</span>
                    <span>Air quality</span>
                    <span>Eco-score</span>
                    <span>Timestamp</span>
                  </div>

                  {sensorData.slice(-10).reverse().map((row, i) => (
                    <div key={i} style={styles.sensorTableRow}>
                      <span>{row.latitude}</span>
                      <span>{row.longitude}</span>
                      <span>{row.activity_type}</span>
                      <span style={{
                        color: row.air_quality >= 70 ? '#22c55e' : row.air_quality >= 40 ? '#f59e0b' : '#ef4444',
                        fontWeight: 800
                      }}>
                        {row.air_quality}
                      </span>
                      <span style={{ color: '#3b82f6', fontWeight: 900 }}>{row.eco_score}</span>
                      <span style={{ color: '#64748b' }}>{row.timestamp || '—'}</span>
                    </div>
                  ))}
                </div>

                {sensorData.length > 10 && (
                  <p style={styles.showingText}>
                    Showing last 10 of {sensorData.length} measurements
                  </p>
                )}
              </>
            )}
          </section>
        </main>
      )}
    </div>
  )
}

const glassCard = {
  background: 'linear-gradient(180deg, rgba(30,41,59,0.94), rgba(15,23,42,0.96))',
  border: '1px solid rgba(148,163,184,0.22)',
  boxShadow: '0 26px 90px rgba(0,0,0,0.36)',
  backdropFilter: 'blur(16px)'
}

const styles = {
  page: {
    minHeight: '100vh',
    position: 'relative',
    overflow: 'hidden',
    background:
      'radial-gradient(circle at 15% 0%, rgba(34,197,94,0.18), transparent 30%), radial-gradient(circle at 90% 15%, rgba(56,189,248,0.12), transparent 28%), linear-gradient(135deg, #020617, #0f172a)',
    color: '#e5e7eb',
    fontFamily: 'Inter, system-ui, Segoe UI, Arial, sans-serif'
  },
  glowOne: {
    position: 'fixed',
    width: '420px',
    height: '420px',
    borderRadius: '50%',
    background: 'rgba(34,197,94,0.14)',
    filter: 'blur(90px)',
    top: '-130px',
    left: '-130px'
  },
  glowTwo: {
    position: 'fixed',
    width: '420px',
    height: '420px',
    borderRadius: '50%',
    background: 'rgba(59,130,246,0.14)',
    filter: 'blur(90px)',
    right: '-130px',
    bottom: '-130px'
  },
  header: {
    position: 'relative',
    zIndex: 1,
    maxWidth: '1240px',
    margin: '0 auto',
    padding: '32px 24px 22px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px'
  },
  eyebrow: {
    margin: 0,
    color: '#38bdf8',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    fontSize: '11px',
    fontWeight: 900
  },
  title: {
    margin: '5px 0 0',
    fontSize: '44px',
    lineHeight: 1,
    fontWeight: 900,
    letterSpacing: '-0.06em',
    color: '#f8fafc'
  },
  subtitle: {
    marginTop: '10px',
    color: '#94a3b8',
    fontSize: '16px'
  },
  backButton: {
    padding: '11px 16px',
    background: 'linear-gradient(135deg, #334155, #475569)',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: '12px',
    fontWeight: 800,
    boxShadow: '0 14px 34px rgba(0,0,0,0.24)'
  },
  loadingCard: {
    ...glassCard,
    position: 'relative',
    zIndex: 1,
    maxWidth: '520px',
    margin: '80px auto',
    padding: '34px',
    borderRadius: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    alignItems: 'center',
    color: '#cbd5e1'
  },
  spinner: {
    fontSize: '38px'
  },
  container: {
    position: 'relative',
    zIndex: 1,
    maxWidth: '1240px',
    margin: '0 auto',
    padding: '0 24px 44px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
    gap: '16px'
  },
  statCard: {
    ...glassCard,
    borderRadius: '20px',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  statIcon: {
    width: '52px',
    height: '52px',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px'
  },
  statValue: {
    fontSize: '32px',
    lineHeight: 1,
    fontWeight: 900
  },
  statLabel: {
    color: '#f8fafc',
    fontSize: '14px',
    fontWeight: 800,
    marginTop: '5px'
  },
  statDescription: {
    color: '#94a3b8',
    fontSize: '12px',
    marginTop: '2px'
  },
  gridTwo: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px'
  },
  section: {
    ...glassCard,
    borderRadius: '24px',
    padding: '24px'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    marginBottom: '12px'
  },
  sectionTitle: {
    margin: '5px 0 0',
    color: '#f8fafc',
    fontSize: '24px',
    fontWeight: 850,
    letterSpacing: '-0.04em'
  },
  sectionDesc: {
    color: '#94a3b8',
    marginBottom: '22px',
    fontSize: '14px',
    lineHeight: 1.6
  },
  pill: {
    padding: '7px 10px',
    borderRadius: '999px',
    background: 'rgba(59,130,246,0.12)',
    border: '1px solid rgba(59,130,246,0.35)',
    color: '#93c5fd',
    fontSize: '12px',
    fontWeight: 900
  },
  pillSuccess: {
    padding: '7px 10px',
    borderRadius: '999px',
    background: 'rgba(34,197,94,0.12)',
    border: '1px solid rgba(34,197,94,0.35)',
    color: '#86efac',
    fontSize: '12px',
    fontWeight: 900
  },
  pillWarning: {
    padding: '7px 10px',
    borderRadius: '999px',
    background: 'rgba(245,158,11,0.12)',
    border: '1px solid rgba(245,158,11,0.35)',
    color: '#fde68a',
    fontSize: '12px',
    fontWeight: 900
  },
  barChart: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px'
  },
  barRow: {
    display: 'grid',
    gridTemplateColumns: '160px 1fr 52px',
    alignItems: 'center',
    gap: '12px'
  },
  barLabel: {
    color: '#cbd5e1',
    fontSize: '14px',
    textAlign: 'right'
  },
  barTrack: {
    height: '30px',
    backgroundColor: 'rgba(2,6,23,0.7)',
    borderRadius: '999px',
    overflow: 'hidden',
    border: '1px solid rgba(148,163,184,0.12)'
  },
  barFill: {
    height: '100%',
    borderRadius: '999px',
    transition: 'width 0.6s ease'
  },
  barValue: {
    color: '#f8fafc',
    fontWeight: 900,
    fontSize: '15px'
  },
  empty: {
    color: '#64748b',
    fontStyle: 'italic'
  },
  routeTable: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr 1fr',
    padding: '12px 14px',
    backgroundColor: 'rgba(15,23,42,0.8)',
    borderRadius: '12px',
    color: '#64748b',
    fontWeight: 900,
    fontSize: '13px'
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr 1fr',
    padding: '14px',
    backgroundColor: 'rgba(15,23,42,0.68)',
    borderRadius: '12px',
    alignItems: 'center',
    border: '1px solid rgba(148,163,184,0.12)'
  },
  routeName: {
    color: '#e2e8f0',
    fontWeight: 700,
    fontSize: '14px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  badge: {
    backgroundColor: 'rgba(59,130,246,0.14)',
    border: '1px solid rgba(59,130,246,0.28)',
    color: '#93c5fd',
    padding: '5px 9px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 800,
    display: 'inline-block'
  },
  sensorOffline: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
    backgroundColor: 'rgba(15,23,42,0.72)',
    border: '1px solid rgba(245,158,11,0.28)',
    borderRadius: '18px',
    padding: '18px',
    color: '#e2e8f0'
  },
  offlineIcon: {
    width: '46px',
    height: '46px',
    borderRadius: '16px',
    background: 'rgba(245,158,11,0.14)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px'
  },
  offlineText: {
    margin: '6px 0 0',
    color: '#94a3b8',
    fontSize: '13px',
    lineHeight: 1.6
  },
  code: {
    backgroundColor: '#020617',
    padding: '3px 7px',
    borderRadius: '6px',
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#22c55e'
  },
  sensorCards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '12px',
    marginBottom: '18px'
  },
  sensorStat: {
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderRadius: '16px',
    padding: '16px',
    border: '1px solid rgba(148,163,184,0.12)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  sensorTableWrap: {
    overflowX: 'auto'
  },
  sensorTableHeader: {
    minWidth: '760px',
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    padding: '12px 14px',
    backgroundColor: 'rgba(15,23,42,0.8)',
    borderRadius: '12px',
    color: '#64748b',
    fontWeight: 900,
    fontSize: '13px'
  },
  sensorTableRow: {
    minWidth: '760px',
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    padding: '12px 14px',
    backgroundColor: 'rgba(15,23,42,0.62)',
    borderRadius: '12px',
    marginTop: '8px',
    fontSize: '13px',
    border: '1px solid rgba(148,163,184,0.10)'
  },
  showingText: {
    color: '#64748b',
    fontSize: '13px',
    marginTop: '10px',
    textAlign: 'center'
  },
  locationRecorder: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '18px'
  },
  activitySelect: {
    padding: '10px 12px',
    borderRadius: '12px',
    border: '1px solid rgba(148,163,184,0.28)',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    fontWeight: 700
  },
  recordButton: {
    padding: '10px 16px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #10b981, #22c55e)',
    color: '#fff',
    fontWeight: 800,
    cursor: 'pointer'
  },
  locationSuccess: {
    color: '#86efac',
    fontSize: '13px',
    fontWeight: 700,
    margin: 0,
    width: '100%'
  },
  locationError: {
    color: '#fca5a5',
    fontSize: '13px',
    fontWeight: 700,
    margin: 0,
    width: '100%'
  }
}

export default StatsDashboardPage