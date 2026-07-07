import { useEffect, useState } from 'react'
import axios from 'axios'
import { calculateRouteAirQuality, normalizeAirQualityStations } from '../utils/environment'
import { useRealGeolocation } from '../hooks/useRealGeolocation'
import AppHeader from '../components/AppHeader'
import AppFooter from '../components/AppFooter'
import { API_BASE_URL } from '../config'

function getAuthHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` }
}

// Succulent reports a missing numeric value (e.g. no nearby ARSO station)
// as the literal token NaN - render that as "no data" instead.
function formatMetric(value) {
  if (value === null || value === undefined) return '—'
  return Number.isFinite(Number(value)) ? value : '—'
}

function getEnvironmentalType(name) {
  if (!name) return 'OTHER'
  if (name.includes('SL_2') || name.includes('LST')) return 'LAND_TEMPERATURE'
  if (name.includes('OL_2') || name.includes('WRR')) return 'WATER_QUALITY'
  return 'AIR_QUALITY'
}

function StatCard({ label, value, color, description }) {
  return (
    <div style={{ ...styles.statCard, borderLeftColor: color }}>
      <div style={{ ...styles.statValue, color }}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
      {description && <div style={styles.statDescription}>{description}</div>}
    </div>
  )
}

function BarChart({ data, maxValue }) {
  return (
    <div style={styles.barChart} className="eco-bar-chart">
      {data.map((item, i) => (
        <div key={i} style={styles.barRow} className="eco-bar-row">
          <div style={styles.barLabel} className="eco-bar-label">{item.label}</div>
          <div style={styles.barTrack} className="eco-bar-track">
            <div
              style={{
                ...styles.barFill,
                width: maxValue > 0 ? `${Math.max(4, (item.value / maxValue) * 100)}%` : '0%',
                backgroundColor: item.color
              }}
            />
          </div>
          <div style={styles.barValue} className="eco-bar-value">{item.value}</div>
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
    axios.get(`${API_BASE_URL}/api/succulent-data`, { headers: getAuthHeaders() })
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
      axios.get(`${API_BASE_URL}/api/copernicus-products`, { headers }),
      axios.get(`${API_BASE_URL}/api/routes`, { headers })
    ])
      .then(([prodRes, routeRes]) => {
        setProducts(prodRes.data)
        setRoutes(routeRes.data)
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))

    loadSensorData()
  }, [])

  // Looks up ARSO air quality and Open-Meteo temperature for a GPS position,
  // reusing the same nearest-station EAQI logic used for route scoring.
  const recordMeasurementForPosition = async ({ latitude, longitude }) => {
    setLocationState({ status: 'requesting', message: 'Iskanje resnične kakovosti zraka in vremena za tvojo lokacijo ...' })

    try {
      const [airQualityRes, weatherRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/air-quality`, { headers: getAuthHeaders() }),
        axios.get('https://api.open-meteo.com/v1/forecast', {
          params: { latitude, longitude, current: 'temperature_2m' }
        })
      ])

      const stations = normalizeAirQualityStations(airQualityRes.data)
      const airQuality = calculateRouteAirQuality([[latitude, longitude]], stations)
      const temperature = weatherRes.data?.current?.temperature_2m

      // ARSO only covers Slovenia while Open-Meteo is global, so only bail
      // out when neither source returned anything.
      if (airQuality?.score == null && temperature == null) {
        setLocationState({
          status: 'error',
          message: 'Ni bilo mogoče zabeležiti resnične meritve: ni bližnje ARSO postaje za kakovost zraka niti vremenskih podatkov za tvojo trenutno lokacijo.'
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

      await axios.post(`${API_BASE_URL}/api/succulent-data`, measurement, { headers: getAuthHeaders() })

      const parts = []
      parts.push(airQuality?.score != null
        ? `${airQuality.stationCount} bližnjih ARSO postaj`
        : 'brez bližnje ARSO postaje za kakovost zraka (samo Slovenija)')
      if (temperature != null) parts.push(`${temperature}°C`)

      setLocationState({
        status: 'success',
        message: `Zabeležena tvoja resnična lokacija - ${parts.join(', ')}.`
      })
      loadSensorData()
    } catch (err) {
      console.error(err)
      setLocationState({ status: 'error', message: 'Beleženje tvoje resnične meritve ni uspelo.' })
    }
  }

  // Also fires automatically on mount if geolocation permission was already
  // granted previously, so repeat visits don't need the button clicked again.
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
    { label: 'Kakovost zraka', value: airCount, color: '#2563eb' },
    { label: 'Kakovost vode', value: waterCount, color: '#0891b2' },
    { label: 'Temperatura tal', value: tempCount, color: '#b45309' },
    { label: 'Drugo', value: otherCount, color: '#6366f1' }
  ]

  const scoreBarData = [
    { label: 'Odlično (80+)', value: excellentRoutes, color: '#15803d' },
    { label: 'Dobro (60–79)', value: goodRoutes, color: '#2563eb' },
    { label: 'Zmerno (40–59)', value: moderateRoutes, color: '#b45309' },
    { label: 'Slabo (<40)', value: poorRoutes, color: '#b91c1c' }
  ]

  const maxEnv = Math.max(...envBarData.map(d => d.value), 1)
  const maxScore = Math.max(...scoreBarData.map(d => d.value), 1)

  return (
    <div style={styles.page}>
      <AppHeader />

      <div style={styles.header} className="eco-page-header">
        <p style={styles.eyebrow}>Analitski center</p>
        <h1 style={styles.title}>Okoljska nadzorna plošča</h1>
        <p style={styles.subtitle}>
          Pregled satelitskih produktov, GPX poti in okoljskih meritev v realnem času.
        </p>
      </div>

      {loading ? (
        <div style={styles.loadingCard}>
          <strong>Nalaganje podatkov nadzorne plošče ...</strong>
          <span>Pridobivanje okoljskih produktov in naloženih poti.</span>
        </div>
      ) : (
        <main style={styles.container} className="eco-container">
          <div style={styles.cardsGrid} className="eco-cards-grid">
            <StatCard
              label="Okoljski produkti"
              value={products.length}
              color="#2563eb"
              description="Copernicus zapisi"
            />
            <StatCard
              label="Naložene GPX poti"
              value={routes.length}
              color="#15803d"
              description="Shranjene datoteke poti"
            />
            <StatCard
              label="Povprečna eko-ocena"
              value={`${avgScore}/100`}
              color="#b45309"
              description="Med shranjenimi potmi"
            />
            <StatCard
              label="Odlične poti"
              value={excellentRoutes}
              color="#0891b2"
              description="Poti nad oceno 80"
            />
          </div>

          <div style={styles.gridTwo} className="eco-dashboard-grid-two">
            <section style={styles.section}>
              <div style={styles.sectionHeader} className="eco-section-header">
                <div>
                  <p style={styles.eyebrow}>Satelitski podatki</p>
                  <h2 style={styles.sectionTitle}>Okoljski podatki po vrsti</h2>
                </div>
                <span style={styles.pill}>{products.length} produktov</span>
              </div>

              <p style={styles.sectionDesc}>
                Porazdelitev Copernicus satelitskih produktov, trenutno shranjenih v bazi podatkov.
              </p>

              <BarChart data={envBarData} maxValue={maxEnv} />
            </section>

            <section style={styles.section}>
              <div style={styles.sectionHeader} className="eco-section-header">
                <div>
                  <p style={styles.eyebrow}>Kakovost poti</p>
                  <h2 style={styles.sectionTitle}>Poti po eko-oceni</h2>
                </div>
                <span style={styles.pill}>{routes.length} poti</span>
              </div>

              <p style={styles.sectionDesc}>
                Porazdelitev eko-ocen med vsemi naloženimi GPX potmi.
              </p>

              {routes.length === 0 ? (
                <p style={styles.empty}>Še ni naloženih poti. Naloži GPX datoteko za prikaz statistike.</p>
              ) : (
                <BarChart data={scoreBarData} maxValue={maxScore} />
              )}
            </section>
          </div>

          {routes.length > 0 && (
            <section style={styles.section}>
              <div style={styles.sectionHeader} className="eco-section-header">
                <div>
                  <p style={styles.eyebrow}>Arhiv poti</p>
                  <h2 style={styles.sectionTitle}>Naložene poti</h2>
                </div>
              </div>

              <div style={styles.routeTable} className="eco-route-table">
                <div style={styles.tableHeader} className="eco-route-table-header">
                  <span>Ime</span>
                  <span>Točke</span>
                  <span>Eko-ocena</span>
                  <span>Stanje</span>
                </div>

                {routes.map(route => (
                  <div key={route.id} style={styles.tableRow} className="eco-route-table-row">
                    <span style={styles.routeName}>{route.name}</span>
                    <span>{route.pointCount}</span>
                    <span style={{
                      color: route.ecoScore >= 80 ? '#15803d' : route.ecoScore >= 60 ? '#2563eb' : '#b45309',
                      fontWeight: 700
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
            <div style={styles.sectionHeader} className="eco-section-header">
              <div>
                <p style={styles.eyebrow}>IoT senzorji</p>
                <h2 style={styles.sectionTitle}>Podatki senzorjev v živo</h2>
              </div>
              <span style={sensorStatus === 'ok' ? styles.pillSuccess : styles.pillWarning}>
                {sensorStatus === 'ok' ? 'Povezano' : 'Ni na voljo'}
              </span>
            </div>

            <div style={styles.locationRecorder}>
              <select
                value={selectedActivity}
                onChange={(e) => setSelectedActivity(e.target.value)}
                style={styles.activitySelect}
              >
                <option value="WALKING">Hoja</option>
                <option value="CYCLING">Kolesarjenje</option>
                <option value="RUNNING">Tek</option>
              </select>

              <button
                onClick={requestLocation}
                disabled={locationState.status === 'requesting'}
                style={styles.recordButton}
              >
                {locationState.status === 'requesting' ? 'Pridobivanje tvoje lokacije ...' : 'Deli mojo resnično lokacijo'}
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
                <div>
                  <strong>Succulent strežnik ni povezan</strong>
                  <p style={styles.offlineText}>
                    Zaženi zbiralnik: <code style={styles.code}>cd succulent &amp;&amp; python run.py</code><br />
                    Nato zaženi simulator: <code style={styles.code}>python simulate_data.py</code>
                  </p>
                </div>
              </div>
            )}

            {sensorStatus === 'ok' && sensorData.length === 0 && (
              <p style={styles.empty}>Še ni meritev senzorjev. Zaženi simulator za ustvarjanje podatkov.</p>
            )}

            {sensorStatus === 'ok' && sensorData.length > 0 && (
              <>
                <div style={styles.sensorCards}>
                  <div style={styles.sensorStat}>
                    <strong style={{ color: 'var(--brand)' }}>{sensorData.length}</strong>
                    <span>Skupno meritev</span>
                  </div>

                  <div style={styles.sensorStat}>
                    <strong style={{ color: 'var(--info)' }}>
                      {sensorData.filter(d => d.activity_type === 'WALKING').length}
                    </strong>
                    <span>Hoja</span>
                  </div>

                  <div style={styles.sensorStat}>
                    <strong style={{ color: 'var(--warning)' }}>
                      {sensorData.filter(d => d.activity_type === 'CYCLING').length}
                    </strong>
                    <span>Kolesarjenje</span>
                  </div>

                  <div style={styles.sensorStat}>
                    <strong style={{ color: '#7c3aed' }}>
                      {sensorData.filter(d => d.activity_type === 'RUNNING').length}
                    </strong>
                    <span>Tek</span>
                  </div>
                </div>

                <div style={styles.sensorTableWrap} className="eco-sensor-table-wrap">
                  <div style={styles.sensorTableHeader} className="eco-sensor-table-header">
                    <span>Zemljepisna širina</span>
                    <span>Zemljepisna dolžina</span>
                    <span>Aktivnost</span>
                    <span>Kakovost zraka</span>
                    <span>Eko-ocena</span>
                    <span>Časovni žig</span>
                  </div>

                  {sensorData.slice(-10).reverse().map((row, i) => (
                    <div key={i} style={styles.sensorTableRow} className="eco-sensor-table-row">
                      <span>{row.latitude}</span>
                      <span>{row.longitude}</span>
                      <span>{row.activity_type}</span>
                      <span style={{
                        color: !Number.isFinite(Number(row.air_quality))
                          ? 'var(--text-faint)'
                          : Number(row.air_quality) >= 70 ? '#15803d' : Number(row.air_quality) >= 40 ? '#b45309' : '#b91c1c',
                        fontWeight: 700
                      }}>
                        {formatMetric(row.air_quality)}
                      </span>
                      <span style={{ color: Number.isFinite(Number(row.eco_score)) ? 'var(--info)' : 'var(--text-faint)', fontWeight: 700 }}>{formatMetric(row.eco_score)}</span>
                      <span style={{ color: 'var(--text-faint)' }}>{row.timestamp || '—'}</span>
                    </div>
                  ))}
                </div>

                {sensorData.length > 10 && (
                  <p style={styles.showingText}>
                    Prikazanih zadnjih 10 od {sensorData.length} meritev
                  </p>
                )}
              </>
            )}
          </section>
        </main>
      )}

      <AppFooter />
    </div>
  )
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
    maxWidth: '1240px',
    margin: '0 auto',
    padding: '32px 24px 22px'
  },
  eyebrow: {
    margin: 0,
    color: 'var(--brand)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    fontSize: '11px',
    fontWeight: 700
  },
  title: {
    margin: '4px 0 0',
    fontSize: '30px',
    lineHeight: 1.1,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: 'var(--text)'
  },
  subtitle: {
    marginTop: '8px',
    color: 'var(--text-muted)',
    fontSize: '15px'
  },
  loadingCard: {
    ...card,
    maxWidth: '520px',
    margin: '80px auto',
    padding: '34px',
    borderRadius: 'var(--radius-lg)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: 'center',
    color: 'var(--text-muted)'
  },
  container: {
    maxWidth: '1240px',
    margin: '0 auto',
    padding: '0 24px 44px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '16px'
  },
  statCard: {
    ...card,
    borderLeft: '3px solid',
    borderRadius: 'var(--radius-md)',
    padding: '18px'
  },
  statValue: {
    fontSize: '28px',
    lineHeight: 1,
    fontWeight: 800
  },
  statLabel: {
    color: 'var(--text)',
    fontSize: '13px',
    fontWeight: 700,
    marginTop: '6px'
  },
  statDescription: {
    color: 'var(--text-faint)',
    fontSize: '12px',
    marginTop: '2px'
  },
  gridTwo: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px'
  },
  section: {
    ...card,
    borderRadius: 'var(--radius-lg)',
    padding: '20px'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    marginBottom: '12px'
  },
  sectionTitle: {
    margin: '4px 0 0',
    color: 'var(--text)',
    fontSize: '20px',
    fontWeight: 700,
    letterSpacing: '-0.01em'
  },
  sectionDesc: {
    color: 'var(--text-muted)',
    marginBottom: '18px',
    fontSize: '14px',
    lineHeight: 1.6
  },
  pill: {
    padding: '6px 10px',
    borderRadius: '999px',
    background: 'var(--info-soft)',
    border: '1px solid var(--info-soft-border)',
    color: 'var(--info)',
    fontSize: '12px',
    fontWeight: 700
  },
  pillSuccess: {
    padding: '6px 10px',
    borderRadius: '999px',
    background: 'var(--brand-soft)',
    border: '1px solid var(--brand-soft-border)',
    color: 'var(--brand-hover)',
    fontSize: '12px',
    fontWeight: 700
  },
  pillWarning: {
    padding: '6px 10px',
    borderRadius: '999px',
    background: 'var(--warning-soft)',
    border: '1px solid var(--warning-soft-border)',
    color: 'var(--warning)',
    fontSize: '12px',
    fontWeight: 700
  },
  barChart: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  barRow: {
    display: 'grid',
    gridTemplateColumns: '160px 1fr 52px',
    alignItems: 'center',
    gap: '12px'
  },
  barLabel: {
    color: 'var(--text-muted)',
    fontSize: '13px',
    textAlign: 'right'
  },
  barTrack: {
    height: '24px',
    backgroundColor: 'var(--surface-muted)',
    borderRadius: '999px',
    overflow: 'hidden',
    border: '1px solid var(--border)'
  },
  barFill: {
    height: '100%',
    borderRadius: '999px',
    transition: 'width 0.6s ease'
  },
  barValue: {
    color: 'var(--text)',
    fontWeight: 700,
    fontSize: '14px'
  },
  empty: {
    color: 'var(--text-faint)',
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
    backgroundColor: 'var(--surface-muted)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-muted)',
    fontWeight: 700,
    fontSize: '13px'
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr 1fr',
    padding: '12px 14px',
    borderRadius: 'var(--radius-sm)',
    alignItems: 'center',
    border: '1px solid var(--border)'
  },
  routeName: {
    color: 'var(--text)',
    fontWeight: 600,
    fontSize: '14px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  badge: {
    backgroundColor: 'var(--info-soft)',
    border: '1px solid var(--info-soft-border)',
    color: 'var(--info)',
    padding: '4px 9px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 700,
    display: 'inline-block'
  },
  sensorOffline: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
    backgroundColor: 'var(--warning-soft)',
    border: '1px solid var(--warning-soft-border)',
    borderRadius: 'var(--radius-md)',
    padding: '16px',
    color: 'var(--text)'
  },
  offlineText: {
    margin: '6px 0 0',
    color: 'var(--text-muted)',
    fontSize: '13px',
    lineHeight: 1.6
  },
  code: {
    backgroundColor: 'var(--surface-muted)',
    padding: '3px 7px',
    borderRadius: '6px',
    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
    fontSize: '12px',
    color: 'var(--brand)'
  },
  sensorCards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '12px',
    marginBottom: '16px'
  },
  sensorStat: {
    backgroundColor: 'var(--surface-muted)',
    borderRadius: 'var(--radius-md)',
    padding: '14px',
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
    padding: '10px 14px',
    backgroundColor: 'var(--surface-muted)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-muted)',
    fontWeight: 700,
    fontSize: '13px'
  },
  sensorTableRow: {
    minWidth: '760px',
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    padding: '10px 14px',
    borderRadius: 'var(--radius-sm)',
    marginTop: '8px',
    fontSize: '13px',
    border: '1px solid var(--border)'
  },
  showingText: {
    color: 'var(--text-faint)',
    fontSize: '13px',
    marginTop: '10px',
    textAlign: 'center'
  },
  locationRecorder: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '16px'
  },
  activitySelect: {
    padding: '9px 12px',
    borderRadius: 'var(--radius-md)',
    fontWeight: 600
  },
  recordButton: {
    padding: '9px 16px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    background: 'var(--brand)',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer'
  },
  locationSuccess: {
    color: 'var(--brand-hover)',
    fontSize: '13px',
    fontWeight: 600,
    margin: 0,
    width: '100%'
  },
  locationError: {
    color: 'var(--danger)',
    fontSize: '13px',
    fontWeight: 600,
    margin: 0,
    width: '100%'
  }
}

export default StatsDashboardPage
