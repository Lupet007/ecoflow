import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'

function getAuthHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` }
}

function getEnvironmentalType(name) {
  if (!name) return 'OTHER'
  if (name.includes('SL_2') || name.includes('LST')) return 'LAND_TEMPERATURE'
  if (name.includes('OL_2') || name.includes('WRR')) return 'WATER_QUALITY'
  return 'AIR_QUALITY'
}

function StatCard({ label, value, color, icon }) {
  return (
    <div style={{ ...styles.statCard, borderTop: `4px solid ${color}` }}>
      <div style={styles.statIcon}>{icon}</div>
      <div style={{ ...styles.statValue, color }}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
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
                width: maxValue > 0 ? `${(item.value / maxValue) * 100}%` : '0%',
                backgroundColor: item.color
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
  const [sensorStatus, setSensorStatus] = useState('loading') // loading | ok | unavailable
  const [loading, setLoading] = useState(true)

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

    // Fetch succulent sensor data separately (non-blocking)
    axios.get('http://localhost:8080/api/succulent-data', { headers })
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
  }, [])

  // Environmental product stats
  const airCount = products.filter(p => getEnvironmentalType(p.name) === 'AIR_QUALITY').length
  const waterCount = products.filter(p => getEnvironmentalType(p.name) === 'WATER_QUALITY').length
  const tempCount = products.filter(p => getEnvironmentalType(p.name) === 'LAND_TEMPERATURE').length
  const otherCount = products.length - airCount - waterCount - tempCount

  // Route stats
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
      <header style={styles.header} className="eco-header">
        <div>
          <h1 style={styles.title}>📊 Environmental Dashboard</h1>
          <p style={styles.subtitle}>Overview of environmental data and route statistics.</p>
        </div>
        <div className="eco-header-buttons">
          <Link to="/" style={styles.backButton}>← Back to map</Link>
        </div>
      </header>

      {loading ? (
        <div style={styles.loading}>Loading dashboard data...</div>
      ) : (
        <main style={styles.container} className="eco-container">

          {/* Summary cards */}
          <div style={styles.cardsGrid} className="eco-cards-grid">
            <StatCard
              label="Total environmental products"
              value={products.length}
              color="#3b82f6"
              icon="🌍"
            />
            <StatCard
              label="Uploaded GPX routes"
              value={routes.length}
              color="#22c55e"
              icon="🗺️"
            />
            <StatCard
              label="Average eco-score"
              value={`${avgScore}/100`}
              color="#f59e0b"
              icon="⭐"
            />
            <StatCard
              label="Excellent routes"
              value={excellentRoutes}
              color="#10b981"
              icon="✅"
            />
          </div>

          {/* Environmental products chart */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Environmental data by type</h2>
            <p style={styles.sectionDesc}>
              Distribution of Copernicus satellite products currently stored in the database.
            </p>
            <BarChart data={envBarData} maxValue={maxEnv} />
          </div>

          {/* Route eco-score chart */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Routes by eco-score</h2>
            <p style={styles.sectionDesc}>
              Eco-score distribution across all uploaded GPX routes.
            </p>
            {routes.length === 0 ? (
              <p style={styles.empty}>No routes uploaded yet. Upload a GPX file to see stats.</p>
            ) : (
              <BarChart data={scoreBarData} maxValue={maxScore} />
            )}
          </div>

          {/* Route list */}
          {routes.length > 0 && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Uploaded routes</h2>
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
                    <span style={{ color: route.ecoScore >= 80 ? '#22c55e' : route.ecoScore >= 60 ? '#3b82f6' : '#f59e0b', fontWeight: 700 }}>
                      {route.ecoScore}/100
                    </span>
                    <span style={styles.badge}>{route.ecoScoreLabel}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Succulent sensor data section */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>🌵 Live sensor data</h2>
            <p style={styles.sectionDesc}>
              Real-time environmental measurements collected from IoT devices and smartwatches via the Succulent data collection framework.
            </p>

            {sensorStatus === 'unavailable' && (
              <div style={styles.sensorOffline}>
                <span style={{ fontSize: '20px' }}>📡</span>
                <div>
                  <strong>Succulent server offline</strong>
                  <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '13px' }}>
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
                    <div style={{ fontSize: '24px', fontWeight: 700, color: '#22c55e' }}>{sensorData.length}</div>
                    <div style={{ color: '#94a3b8', fontSize: '13px' }}>Total measurements</div>
                  </div>
                  <div style={styles.sensorStat}>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: '#3b82f6' }}>
                      {sensorData.filter(d => d.activity_type === 'WALKING').length}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '13px' }}>🚶 Walking</div>
                  </div>
                  <div style={styles.sensorStat}>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: '#f59e0b' }}>
                      {sensorData.filter(d => d.activity_type === 'CYCLING').length}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '13px' }}>🚴 Cycling</div>
                  </div>
                  <div style={styles.sensorStat}>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: '#a78bfa' }}>
                      {sensorData.filter(d => d.activity_type === 'RUNNING').length}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '13px' }}>🏃 Running</div>
                  </div>
                </div>

                <div style={{ marginTop: '20px' }}>
                  <div style={styles.tableHeader}>
                    <span>Latitude</span>
                    <span>Longitude</span>
                    <span>Activity</span>
                    <span>Air quality</span>
                    <span>Eco-score</span>
                    <span>Timestamp</span>
                  </div>
                  {sensorData.slice(-10).reverse().map((row, i) => (
                    <div key={i} style={{ ...styles.tableRow, gridTemplateColumns: 'repeat(6, 1fr)' }}>
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>{row.latitude}</span>
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>{row.longitude}</span>
                      <span style={{ fontSize: '13px' }}>{row.activity_type}</span>
                      <span style={{ color: row.air_quality >= 70 ? '#22c55e' : row.air_quality >= 40 ? '#f59e0b' : '#ef4444', fontWeight: 600, fontSize: '13px' }}>
                        {row.air_quality}
                      </span>
                      <span style={{ color: '#3b82f6', fontWeight: 700, fontSize: '13px' }}>{row.eco_score}</span>
                      <span style={{ color: '#64748b', fontSize: '12px' }}>{row.timestamp || '—'}</span>
                    </div>
                  ))}
                  {sensorData.length > 10 && (
                    <p style={{ color: '#64748b', fontSize: '13px', marginTop: '8px', textAlign: 'center' }}>
                      Showing last 10 of {sensorData.length} measurements
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

        </main>
      )}
    </div>
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
    fontSize: '32px',
    color: '#f8fafc'
  },
  subtitle: {
    marginTop: '8px',
    color: '#94a3b8'
  },
  backButton: {
    padding: '10px 16px',
    backgroundColor: '#334155',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: '8px',
    fontWeight: '600'
  },
  loading: {
    textAlign: 'center',
    padding: '60px',
    color: '#94a3b8',
    fontSize: '18px'
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 24px 40px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px'
  },
  statCard: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #334155',
    textAlign: 'center'
  },
  statIcon: {
    fontSize: '28px',
    marginBottom: '10px'
  },
  statValue: {
    fontSize: '32px',
    fontWeight: '700',
    marginBottom: '6px'
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: '14px'
  },
  section: {
    backgroundColor: '#1e293b',
    borderRadius: '14px',
    padding: '24px',
    border: '1px solid #334155'
  },
  sectionTitle: {
    margin: '0 0 8px 0',
    color: '#f8fafc',
    fontSize: '20px'
  },
  sectionDesc: {
    color: '#94a3b8',
    marginBottom: '20px',
    fontSize: '14px'
  },
  barChart: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px'
  },
  barRow: {
    display: 'grid',
    gridTemplateColumns: '160px 1fr 50px',
    alignItems: 'center',
    gap: '12px'
  },
  barLabel: {
    color: '#cbd5e1',
    fontSize: '14px',
    textAlign: 'right'
  },
  barTrack: {
    height: '28px',
    backgroundColor: '#0f172a',
    borderRadius: '6px',
    overflow: 'hidden'
  },
  barFill: {
    height: '100%',
    borderRadius: '6px',
    transition: 'width 0.6s ease'
  },
  barValue: {
    color: '#f8fafc',
    fontWeight: '700',
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
    padding: '10px 14px',
    backgroundColor: '#0f172a',
    borderRadius: '8px',
    color: '#64748b',
    fontWeight: '700',
    fontSize: '13px'
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr 1fr',
    padding: '12px 14px',
    backgroundColor: '#0f172a',
    borderRadius: '8px',
    alignItems: 'center',
    border: '1px solid #1e293b'
  },
  routeName: {
    color: '#e2e8f0',
    fontWeight: '500',
    fontSize: '14px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  badge: {
    backgroundColor: '#1e3a5f',
    color: '#93c5fd',
    padding: '3px 8px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    display: 'inline-block'
  },
  sensorOffline: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    backgroundColor: '#1a1a2e',
    border: '1px solid #334155',
    borderRadius: '10px',
    padding: '16px 20px',
    color: '#e2e8f0'
  },
  code: {
    backgroundColor: '#0f172a',
    padding: '2px 6px',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#22c55e'
  },
  sensorCards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '12px',
    marginBottom: '4px'
  },
  sensorStat: {
    backgroundColor: '#0f172a',
    borderRadius: '10px',
    padding: '16px',
    textAlign: 'center',
    border: '1px solid #1e293b'
  }
}

export default StatsDashboardPage
