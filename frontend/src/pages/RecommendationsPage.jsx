import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'

function RecommendationsPage() {
  const navigate = useNavigate()
  const [recommendations, setRecommendations] = useState([])
const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const ecoProfile = JSON.parse(localStorage.getItem('ecoProfile') || 'null')

  const fetchRecommendations = async () => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (ecoProfile?.activityType) params.activityType = ecoProfile.activityType
      if (ecoProfile?.ecoPriority) params.ecoPriority = ecoProfile.ecoPriority
      params.limit = 6

      const response = await axios.get(
        'http://localhost:8080/api/routes/recommend',
        {
          params,
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      )
      setRecommendations(response.data)
    } catch (err) {
      console.error(err)
      setError(
        err.response?.data?.error ||
        'Could not load recommendations. Check that you are signed in and the server is running.'
      )
    } finally {
      setLoading(false)
    }
  }

useEffect(() => {
  let cancelled = false

  const loadInitialRecommendations = async () => {
    try {
      const params = {}
      if (ecoProfile?.activityType) params.activityType = ecoProfile.activityType
      if (ecoProfile?.ecoPriority) params.ecoPriority = ecoProfile.ecoPriority
      params.limit = 6

      const response = await axios.get(
        'http://localhost:8080/api/routes/recommend',
        {
          params,
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      )

      if (!cancelled) {
        setRecommendations(response.data)
      }
    } catch (err) {
      console.error(err)

      if (!cancelled) {
        setError(
          err.response?.data?.error ||
          'Could not load recommendations. Check that you are signed in and the server is running.'
        )
      }
    } finally {
      if (!cancelled) {
        setLoading(false)
      }
    }
  }

  loadInitialRecommendations()

  return () => {
    cancelled = true
  }
}, [])

  // KLIK NA PREPORUKU → navigira na home s routeId
  const handleRouteClick = (routeId) => {
    navigate(`/?routeId=${routeId}`)
  }

  const ringColor = (match) => {
    if (match >= 80) return '#22c55e'
    if (match >= 60) return '#3b82f6'
    if (match >= 40) return '#f59e0b'
    return '#ef4444'
  }

  const prettyName = (name) => {
    if (!name) return 'Unnamed route'
    return name
      .replace(/\.gpx$/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }

  const activityLabel = (a) => {
    if (!a) return 'Any activity'
    const map = { WALKING: 'Walking', RUNNING: 'Running', CYCLING: 'Cycling' }
    return map[a] || a
  }

  const priorityLabel = (p) => {
    if (!p) return 'No priority'
    const map = {
      AIR_QUALITY: 'Clean air',
      WATER_QUALITY: 'Clean water',
      LAND_TEMPERATURE: 'Low temperature'
    }
    return map[p] || p
  }

  return (
    <div style={styles.page}>
      <div style={styles.glowOne} />
      <div style={styles.glowTwo} />

      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Personalized for you</p>
          <h1 style={styles.title}>Routes picked for you</h1>
          <p style={styles.subtitle}>
            EcoFlow finds the routes that best fit your preferences. Click any route to view it on the map.
          </p>
        </div>
        <Link to="/" style={styles.backButton}>← Back to map</Link>
      </header>

      <div style={styles.container}>

        {/* HOW IT WORKS */}
        <div style={styles.explainerCard}>
          <p style={styles.explainerEyebrow}>How this works</p>
          <div style={styles.steps}>
            <div style={styles.step}>
              <div style={styles.stepIcon}>👤</div>
              <div>
                <div style={styles.stepTitle}>1. Your profile</div>
                <div style={styles.stepText}>
                  We read what you like: activity and environmental priority.
                </div>
              </div>
            </div>

            <div style={styles.stepArrow}>→</div>

            <div style={styles.step}>
              <div style={styles.stepIcon}>🧮</div>
              <div>
                <div style={styles.stepTitle}>2. We compare routes</div>
                <div style={styles.stepText}>
                  EcoFlow looks at each route's elevation, length and eco-score and
                  measures how well it fits what you want.
                </div>
              </div>
            </div>

            <div style={styles.stepArrow}>→</div>

            <div style={styles.step}>
              <div style={styles.stepIcon}>🎯</div>
              <div>
                <div style={styles.stepTitle}>3. Your best matches</div>
                <div style={styles.stepText}>
                  The routes that fit you best appear first. Click any route to view it on the map.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile chip row */}
        {ecoProfile ? (
          <div style={styles.profileBanner}>
            <span style={styles.profileLabel}>Matching for</span>
            <span style={styles.chip}>🚶 {activityLabel(ecoProfile.activityType)}</span>
            <span style={styles.chip}>🌿 {priorityLabel(ecoProfile.ecoPriority)}</span>
            <Link to="/profile" style={styles.profileLink}>Change →</Link>
          </div>
        ) : (
          <div style={styles.profileBannerWarning}>
            No eco profile yet — showing default matches.
            <Link to="/profile" style={styles.profileLinkWarning}>Set up your profile →</Link>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={styles.stateCard}>
            <div style={styles.spinner} />
            <p style={styles.stateText}>Comparing routes to your profile…</p>
          </div>
        )}

        {/* Error */}
        {error && <div style={styles.errorCard}>{error}</div>}

        {/* Empty */}
        {!loading && !error && recommendations.length === 0 && (
          <div style={styles.stateCard}>
            <div style={styles.emptyIcon}>🗺️</div>
            <p style={styles.stateText}>No routes to match yet. Upload a few GPX routes first.</p>
            <Link to="/gpx-upload" style={styles.uploadLink}>Upload a route</Link>
          </div>
        )}

        {/* Results */}
        {!loading && !error && recommendations.length > 0 && (
          <>
            <div style={styles.resultsHeader}>
              <span style={styles.resultsCount}>{recommendations.length} routes matched</span>
              <span style={styles.resultsHint}>click any route to view on map</span>
            </div>

            <div style={styles.cardGrid}>
              {recommendations.map((rec, index) => {
                const color = ringColor(rec.matchPercent)
                return (
                  <button
                    key={rec.routeId}
                    type="button"
                    onClick={() => handleRouteClick(rec.routeId)}
                    style={{
                      ...styles.recCard,
                      border: index === 0
                        ? '2px solid rgba(34,197,94,0.65)'
                        : '1px solid rgba(148,163,184,0.18)',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 20px 50px rgba(34,197,94,0.2)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 26px 90px rgba(0,0,0,0.36)'
                    }}
                  >
                    {/* Ring column */}
                    <div style={styles.ringColumn}>
                      <div style={styles.ringWrap}>
                        <svg width="72" height="72" viewBox="0 0 72 72" style={styles.ringSvg}>
                          <circle
                            cx="36" cy="36" r="30"
                            fill="none"
                            stroke="rgba(148,163,184,0.18)"
                            strokeWidth="6"
                          />
                          <circle
                            cx="36" cy="36" r="30"
                            fill="none"
                            stroke={color}
                            strokeWidth="6"
                            strokeLinecap="round"
                            strokeDasharray={`${(rec.matchPercent / 100) * 188.4} 188.4`}
                            transform="rotate(-90 36 36)"
                          />
                        </svg>
                        <div style={styles.ringText}>
                          <span style={styles.ringNum}>{Math.round(rec.matchPercent)}%</span>
                        </div>
                      </div>
                      <span style={styles.matchLabel}>match</span>
                    </div>

                    {/* Info column */}
                    <div style={styles.infoColumn}>
                      <div style={styles.nameRow}>
                        <h3 style={styles.recName}>{prettyName(rec.routeName)}</h3>
                        {index === 0 && <span style={styles.topBadge}>★ Best match</span>}
                      </div>

                      <div style={styles.statRow}>
                        <span style={styles.stat}>📏 {rec.lengthKm} km</span>
                        <span style={styles.stat}>⛰️ avg {rec.avgElevation} m</span>
                        <span style={styles.stat}>🔺 max {rec.maxElevation} m</span>
                        <span style={{ ...styles.ecoStat, color: ringColor(rec.ecoScore) }}>
                          🌿 eco {Math.round(rec.ecoScore)}
                        </span>
                      </div>

                      <div style={{
                        ...styles.reasonBox,
                        ...(index === 0 ? styles.reasonBoxBest : {})
                      }}>
                        <span style={{
                          ...styles.reasonLabel,
                          ...(index === 0 ? styles.reasonLabelBest : {})
                        }}>
                          {index === 0 ? '★ Why this is your top match' : 'Why this route'}
                        </span>
                        <span style={styles.reasonText}>
                          {rec.reason
                            ? rec.reason.replace(/^Recommended because:\s*/i, '')
                            : 'Good overall match for your profile.'}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {!loading && (
          <button style={styles.refreshButton} onClick={fetchRecommendations}>
            ↻ Refresh recommendations
          </button>
        )}
      </div>

      <style>{`
        @keyframes ecoSpin { to { transform: rotate(360deg); } }
        @media (max-width: 720px) {
          .eco-steps { flex-direction: column; }
          .eco-step-arrow { display: none; }
        }
      `}</style>
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
    background: 'radial-gradient(circle at 15% 0%, rgba(34,197,94,0.18), transparent 30%), radial-gradient(circle at 90% 15%, rgba(56,189,248,0.12), transparent 28%), linear-gradient(135deg, #020617, #0f172a)',
    color: '#e5e7eb',
    fontFamily: 'Inter, system-ui, Segoe UI, Arial, sans-serif'
  },
  glowOne: {
    position: 'fixed', width: '420px', height: '420px', borderRadius: '50%',
    background: 'rgba(34,197,94,0.14)', filter: 'blur(90px)', top: '-130px', left: '-130px'
  },
  glowTwo: {
    position: 'fixed', width: '420px', height: '420px', borderRadius: '50%',
    background: 'rgba(59,130,246,0.14)', filter: 'blur(90px)', right: '-130px', bottom: '-130px'
  },
  header: {
    position: 'relative', zIndex: 1, maxWidth: '1120px', margin: '0 auto',
    padding: '32px 24px 18px', display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap'
  },
  eyebrow: {
    margin: 0, color: '#38bdf8', textTransform: 'uppercase',
    letterSpacing: '0.12em', fontSize: '11px', fontWeight: 900
  },
  title: {
    margin: '6px 0 0', fontSize: '40px', lineHeight: 1.05,
    fontWeight: 900, letterSpacing: '-0.05em', color: '#f8fafc'
  },
  subtitle: { marginTop: '10px', color: '#94a3b8', fontSize: '15px', maxWidth: '520px' },
  backButton: {
    padding: '11px 16px', background: 'linear-gradient(135deg, #334155, #475569)',
    color: '#fff', textDecoration: 'none', borderRadius: '12px',
    fontWeight: 800, boxShadow: '0 14px 34px rgba(0,0,0,0.24)', whiteSpace: 'nowrap'
  },
  container: {
    position: 'relative', zIndex: 1, maxWidth: '1120px',
    margin: '0 auto', padding: '0 24px 44px', display: 'grid', gap: '18px'
  },

  explainerCard: { ...glassCard, borderRadius: '20px', padding: '20px 22px' },
  explainerEyebrow: {
    margin: '0 0 14px', color: '#86efac', textTransform: 'uppercase',
    letterSpacing: '0.1em', fontSize: '11px', fontWeight: 900
  },
  steps: { display: 'flex', alignItems: 'stretch', gap: '14px' },
  step: { display: 'flex', gap: '12px', flex: 1, alignItems: 'flex-start' },
  stepIcon: {
    width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
    background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.28)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
  },
  stepTitle: { color: '#f8fafc', fontWeight: 800, fontSize: '14px' },
  stepText: { color: '#94a3b8', fontSize: '12.5px', lineHeight: 1.5, marginTop: '3px' },
  stepArrow: { color: '#475569', fontSize: '20px', display: 'flex', alignItems: 'center', fontWeight: 900 },

  profileBanner: {
    display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
    background: 'rgba(20,83,45,0.30)', border: '1px solid rgba(34,197,94,0.32)',
    borderRadius: '14px', padding: '12px 16px'
  },
  profileLabel: { color: '#86efac', fontSize: '13px', fontWeight: 800 },
  chip: {
    padding: '6px 12px', borderRadius: '999px', background: 'rgba(15,23,42,0.7)',
    border: '1px solid rgba(148,163,184,0.2)', color: '#e2e8f0',
    fontSize: '13px', fontWeight: 700
  },
  profileLink: { color: '#86efac', marginLeft: 'auto', fontWeight: 800, textDecoration: 'none', fontSize: '13px' },
  profileBannerWarning: {
    background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.36)',
    borderRadius: '14px', padding: '12px 16px', fontSize: '13px', color: '#fde68a'
  },
  profileLinkWarning: { color: '#fbbf24', marginLeft: '10px', fontWeight: 800, textDecoration: 'none' },

  resultsHeader: { display: 'flex', alignItems: 'baseline', gap: '12px', marginTop: '4px' },
  resultsCount: { color: '#f8fafc', fontSize: '16px', fontWeight: 850 },
  resultsHint: { color: '#64748b', fontSize: '13px' },

cardGrid: {
  display: 'grid',
  gap: '12px'
},

recCard: {
  ...glassCard,
  borderRadius: '18px',
  padding: '18px 20px',
  display: 'flex',
  alignItems: 'stretch',
  gap: '18px',

  border: '1px solid rgba(148,163,184,0.18)',
  color: 'inherit',
  textAlign: 'left',
  fontFamily: 'inherit',
  cursor: 'pointer',
},

  ringColumn: {
    width: '78px', flexShrink: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '4px'
  },
  ringWrap: { position: 'relative', width: '72px', height: '72px' },
  ringSvg: { display: 'block' },
  ringText: {
    position: 'absolute', inset: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center'
  },
  ringNum: { fontSize: '19px', fontWeight: 900, color: '#f8fafc', lineHeight: 1, letterSpacing: '-0.02em' },
  matchLabel: { fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' },

  infoColumn: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center' },
  nameRow: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  recName: { margin: 0, color: '#f8fafc', fontSize: '17px', fontWeight: 850, wordBreak: 'break-word' },
  topBadge: {
    padding: '4px 10px', borderRadius: '999px', background: 'rgba(34,197,94,0.16)',
    border: '1px solid rgba(34,197,94,0.45)', color: '#86efac',
    fontWeight: 900, fontSize: '11px', whiteSpace: 'nowrap'
  },
  statRow: { display: 'flex', gap: '14px', flexWrap: 'wrap' },
  stat: { color: '#cbd5e1', fontSize: '13px', fontWeight: 600 },
  ecoStat: { fontSize: '13px', fontWeight: 800 },
  reasonBox: {
    display: 'flex', flexDirection: 'column', gap: '2px',
    background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.14)',
    borderRadius: '12px', padding: '9px 12px'
  },
  reasonLabel: {
    color: '#38bdf8', fontSize: '10px', fontWeight: 900,
    textTransform: 'uppercase', letterSpacing: '0.08em'
  },
  reasonLabelBest: { color: '#86efac' },
  reasonBoxBest: {
    background: 'rgba(20,83,45,0.28)', border: '1px solid rgba(34,197,94,0.35)'
  },
  reasonText: { color: '#cbd5e1', fontSize: '13px', lineHeight: 1.5 },

  stateCard: {
    ...glassCard, borderRadius: '18px', padding: '40px 24px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px'
  },
  stateText: { color: '#cbd5e1', fontSize: '15px', textAlign: 'center' },
  spinner: {
    width: '36px', height: '36px', borderRadius: '50%',
    border: '3px solid rgba(148,163,184,0.2)', borderTopColor: '#22c55e',
    animation: 'ecoSpin 0.8s linear infinite'
  },
  emptyIcon: { fontSize: '40px' },
  uploadLink: {
    marginTop: '6px', padding: '11px 18px',
    background: 'linear-gradient(135deg, #10b981, #22c55e)', color: '#fff',
    textDecoration: 'none', borderRadius: '12px', fontWeight: 900
  },
  errorCard: {
    padding: '14px 16px', borderRadius: '14px',
    background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.32)',
    color: '#fecaca', fontWeight: 700
  },

  refreshButton: {
    justifySelf: 'start', marginTop: '6px', padding: '12px 20px', border: 'none',
    borderRadius: '14px', background: 'linear-gradient(135deg, #10b981, #22c55e)',
    color: '#fff', fontSize: '14px', fontWeight: 900, cursor: 'pointer',
    boxShadow: '0 18px 40px rgba(34,197,94,0.22)'
  }
}

export default RecommendationsPage