import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import AppHeader from '../components/AppHeader'
import AppFooter from '../components/AppFooter'
import { API_BASE_URL } from '../config'

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
        `${API_BASE_URL}/api/routes/recommend`,
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
        'Priporočil ni bilo mogoče naložiti. Preveri, da si prijavljen/-a in da strežnik deluje.'
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
          `${API_BASE_URL}/api/routes/recommend`,
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
            'Priporočil ni bilo mogoče naložiti. Preveri, da si prijavljen/-a in da strežnik deluje.'
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

  const handleRouteClick = (routeId) => {
    navigate(`/?routeId=${routeId}`)
  }

  const ringColor = (match) => {
    if (match >= 80) return '#15803d'
    if (match >= 60) return '#2563eb'
    if (match >= 40) return '#b45309'
    return '#b91c1c'
  }

  const prettyName = (name) => {
    if (!name) return 'Neimenovana pot'
    return name
      .replace(/\.gpx$/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }

  const activityLabel = (a) => {
    if (!a) return 'Katerakoli aktivnost'
    const map = { WALKING: 'Hoja', RUNNING: 'Tek', CYCLING: 'Kolesarjenje' }
    return map[a] || a
  }

  const priorityLabel = (p) => {
    if (!p) return 'Brez prioritete'
    const map = {
      AIR_QUALITY: 'Čist zrak',
      WATER_QUALITY: 'Čista voda',
      LAND_TEMPERATURE: 'Nizka temperatura'
    }
    return map[p] || p
  }

  return (
    <div style={styles.page}>
      <AppHeader />

      <div style={styles.header}>
        <p style={styles.eyebrow}>Prilagojeno zate</p>
        <h1 style={styles.title}>Poti izbrane zate</h1>
        <p style={styles.subtitle}>
          EcoFlow poišče poti, ki se najbolje ujemajo s tvojimi nastavitvami. Klikni na katerokoli pot za prikaz na zemljevidu.
        </p>
      </div>

      <div style={styles.container}>

        {/* HOW IT WORKS */}
        <div style={styles.explainerCard}>
          <p style={styles.explainerEyebrow}>Kako to deluje</p>
          <div style={styles.steps} className="eco-steps">
            <div style={styles.step}>
              <div style={styles.stepIcon}>1</div>
              <div>
                <div style={styles.stepTitle}>Tvoj profil</div>
                <div style={styles.stepText}>
                  Preberemo, kaj ti je všeč: aktivnost in okoljsko prioriteto.
                </div>
              </div>
            </div>

            <div style={styles.stepArrow} className="eco-step-arrow">→</div>

            <div style={styles.step}>
              <div style={styles.stepIcon}>2</div>
              <div>
                <div style={styles.stepTitle}>Primerjamo poti</div>
                <div style={styles.stepText}>
                  EcoFlow pogleda nadmorsko višino, dolžino in eko-oceno vsake poti
                  ter izmeri, kako dobro ustreza temu, kar želiš.
                </div>
              </div>
            </div>

            <div style={styles.stepArrow} className="eco-step-arrow">→</div>

            <div style={styles.step}>
              <div style={styles.stepIcon}>3</div>
              <div>
                <div style={styles.stepTitle}>Tvoji najboljši zadetki</div>
                <div style={styles.stepText}>
                  Poti, ki ti najbolj ustrezajo, se prikažejo prve. Klikni na katerokoli pot za prikaz na zemljevidu.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile chip row */}
        {ecoProfile ? (
          <div style={styles.profileBanner}>
            <span style={styles.profileLabel}>Ujemanje za</span>
            <span style={styles.chip}>{activityLabel(ecoProfile.activityType)}</span>
            <span style={styles.chip}>{priorityLabel(ecoProfile.ecoPriority)}</span>
            <Link to="/profile" style={styles.profileLink}>Spremeni →</Link>
          </div>
        ) : (
          <div style={styles.profileBannerWarning}>
            Eko profil še ni nastavljen — prikazani privzeti zadetki.
            <Link to="/profile" style={styles.profileLinkWarning}>Nastavi svoj profil →</Link>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={styles.stateCard}>
            <div style={styles.spinner} />
            <p style={styles.stateText}>Primerjanje poti s tvojim profilom …</p>
          </div>
        )}

        {/* Error */}
        {error && <div style={styles.errorCard}>{error}</div>}

        {/* Empty */}
        {!loading && !error && recommendations.length === 0 && (
          <div style={styles.stateCard}>
            <p style={styles.stateText}>Še ni poti za primerjavo. Najprej naloži nekaj GPX poti.</p>
            <Link to="/gpx-upload" style={styles.uploadLink}>Naloži pot</Link>
          </div>
        )}

        {/* Results */}
        {!loading && !error && recommendations.length > 0 && (
          <>
            <div style={styles.resultsHeader}>
              <span style={styles.resultsCount}>{recommendations.length} ujemajočih poti</span>
              <span style={styles.resultsHint}>klikni na katerokoli pot za prikaz na zemljevidu</span>
            </div>

            {recommendations.some(rec => rec.limitedData) && (
              <div style={styles.profileBannerWarning}>
                V bazi je še premalo poti za natančno primerjavo ujemanja — naloži več GPX poti za boljše rezultate.
              </div>
            )}

            <div style={styles.cardGrid}>
              {recommendations.map((rec, index) => {
                const color = ringColor(rec.matchPercent)
                return (
                  <button
                    key={rec.routeId}
                    type="button"
                    className="eco-recCard"
                    onClick={() => handleRouteClick(rec.routeId)}
                    style={{
                      ...styles.recCard,
                      border: index === 0
                        ? '2px solid var(--brand)'
                        : '1px solid var(--border)'
                    }}
                  >
                    {/* Ring column */}
                    <div style={styles.ringColumn}>
                      <div style={styles.ringWrap}>
                        <svg width="72" height="72" viewBox="0 0 72 72" style={styles.ringSvg}>
                          <circle
                            cx="36" cy="36" r="30"
                            fill="none"
                            stroke="var(--border)"
                            strokeWidth="6"
                          />
                          {!rec.limitedData && (
                            <circle
                              cx="36" cy="36" r="30"
                              fill="none"
                              stroke={color}
                              strokeWidth="6"
                              strokeLinecap="round"
                              strokeDasharray={`${(rec.matchPercent / 100) * 188.4} 188.4`}
                              transform="rotate(-90 36 36)"
                            />
                          )}
                        </svg>
                        <div style={styles.ringText}>
                          <span style={styles.ringNum}>
                            {rec.limitedData ? '—' : `${Math.round(rec.matchPercent)}%`}
                          </span>
                        </div>
                      </div>
                      <span style={styles.matchLabel}>
                        {rec.limitedData ? 'premalo poti' : 'ujemanje'}
                      </span>
                    </div>

                    {/* Info column */}
                    <div style={styles.infoColumn}>
                      <div style={styles.nameRow}>
                        <h3 style={styles.recName}>{prettyName(rec.routeName)}</h3>
                        {index === 0 && <span style={styles.topBadge}>Najboljši zadetek</span>}
                      </div>

                      <div style={styles.statRow}>
                        <span style={styles.stat}>{rec.lengthKm} km</span>
                        <span style={styles.stat}>povp. {rec.avgElevation} m</span>
                        <span style={styles.stat}>maks. {rec.maxElevation} m</span>
                        <span style={{ ...styles.ecoStat, color: ringColor(rec.ecoScore) }}>
                          eko {Math.round(rec.ecoScore)}
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
                          {index === 0 ? 'Zakaj je to tvoj najboljši zadetek' : 'Zakaj ta pot'}
                        </span>
                        <span style={styles.reasonText}>
                          {rec.reason
                            ? rec.reason.replace(/^Priporočeno, ker:\s*/i, '')
                            : 'Dobro splošno ujemanje s tvojim profilom.'}
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
            Osveži priporočila
          </button>
        )}
      </div>

      <AppFooter />

      <style>{`
        @keyframes ecoSpin { to { transform: rotate(360deg); } }
        .eco-recCard:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }
        @media (max-width: 720px) {
          .eco-steps { flex-direction: column; }
          .eco-step-arrow { display: none; }
        }
      `}</style>
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
    maxWidth: '1120px', margin: '0 auto',
    padding: '32px 24px 18px'
  },
  eyebrow: {
    margin: 0, color: 'var(--brand)', textTransform: 'uppercase',
    letterSpacing: '0.1em', fontSize: '11px', fontWeight: 700
  },
  title: {
    margin: '6px 0 0', fontSize: '30px', lineHeight: 1.1,
    fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)'
  },
  subtitle: { marginTop: '8px', color: 'var(--text-muted)', fontSize: '14px', maxWidth: '520px' },
  container: {
    maxWidth: '1120px',
    margin: '0 auto', padding: '0 24px 44px', display: 'grid', gap: '16px'
  },

  explainerCard: { ...card, borderRadius: 'var(--radius-lg)', padding: '20px 22px' },
  explainerEyebrow: {
    margin: '0 0 14px', color: 'var(--brand)', textTransform: 'uppercase',
    letterSpacing: '0.1em', fontSize: '11px', fontWeight: 700
  },
  steps: { display: 'flex', alignItems: 'stretch', gap: '14px' },
  step: { display: 'flex', gap: '12px', flex: 1, alignItems: 'flex-start' },
  stepIcon: {
    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
    background: 'var(--brand-soft)', border: '1px solid var(--brand-soft-border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
    fontWeight: 700, color: 'var(--brand-hover)'
  },
  stepTitle: { color: 'var(--text)', fontWeight: 700, fontSize: '14px' },
  stepText: { color: 'var(--text-muted)', fontSize: '12.5px', lineHeight: 1.5, marginTop: '3px' },
  stepArrow: { color: 'var(--text-faint)', fontSize: '18px', display: 'flex', alignItems: 'center', fontWeight: 700 },

  profileBanner: {
    display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
    background: 'var(--brand-soft)', border: '1px solid var(--brand-soft-border)',
    borderRadius: 'var(--radius-md)', padding: '12px 16px'
  },
  profileLabel: { color: 'var(--brand-hover)', fontSize: '13px', fontWeight: 700 },
  chip: {
    padding: '6px 12px', borderRadius: '999px', background: 'var(--surface)',
    border: '1px solid var(--border)', color: 'var(--text)',
    fontSize: '13px', fontWeight: 600
  },
  profileLink: { color: 'inherit', marginLeft: 'auto', fontWeight: 700, textDecoration: 'none', fontSize: '13px' },
  profileBannerWarning: {
    background: 'var(--warning-soft)', border: '1px solid var(--warning-soft-border)',
    borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: '13px', color: 'var(--warning)'
  },
  profileLinkWarning: { color: 'inherit', marginLeft: '10px', fontWeight: 700, textDecoration: 'none' },

  resultsHeader: { display: 'flex', alignItems: 'baseline', gap: '12px', marginTop: '4px' },
  resultsCount: { color: 'var(--text)', fontSize: '15px', fontWeight: 700 },
  resultsHint: { color: 'var(--text-faint)', fontSize: '13px' },

  cardGrid: {
    display: 'grid',
    gap: '12px'
  },

  recCard: {
    ...card,
    borderRadius: 'var(--radius-lg)',
    padding: '18px 20px',
    display: 'flex',
    alignItems: 'stretch',
    gap: '18px',
    color: 'inherit',
    textAlign: 'left',
    fontFamily: 'inherit',
    cursor: 'pointer',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
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
  ringNum: { fontSize: '17px', fontWeight: 700, color: 'var(--text)', lineHeight: 1, letterSpacing: '-0.01em' },
  matchLabel: { fontSize: '10px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' },

  infoColumn: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center' },
  nameRow: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  recName: { margin: 0, color: 'var(--text)', fontSize: '16px', fontWeight: 700, wordBreak: 'break-word' },
  topBadge: {
    padding: '4px 10px', borderRadius: '999px', background: 'var(--brand-soft)',
    border: '1px solid var(--brand-soft-border)', color: 'var(--brand-hover)',
    fontWeight: 700, fontSize: '11px', whiteSpace: 'nowrap'
  },
  statRow: { display: 'flex', gap: '14px', flexWrap: 'wrap' },
  stat: { color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 },
  ecoStat: { fontSize: '13px', fontWeight: 700 },
  reasonBox: {
    display: 'flex', flexDirection: 'column', gap: '2px',
    background: 'var(--surface-muted)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', padding: '9px 12px'
  },
  reasonLabel: {
    color: 'var(--info)', fontSize: '10px', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.08em'
  },
  reasonLabelBest: { color: 'var(--brand)' },
  reasonBoxBest: {
    background: 'var(--brand-soft)', border: '1px solid var(--brand-soft-border)'
  },
  reasonText: { color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.5 },

  stateCard: {
    ...card, borderRadius: 'var(--radius-lg)', padding: '40px 24px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px'
  },
  stateText: { color: 'var(--text-muted)', fontSize: '15px', textAlign: 'center' },
  spinner: {
    width: '32px', height: '32px', borderRadius: '50%',
    border: '3px solid var(--border)', borderTopColor: 'var(--brand)',
    animation: 'ecoSpin 0.8s linear infinite'
  },
  uploadLink: {
    marginTop: '6px', padding: '10px 18px',
    background: 'var(--brand)', color: '#fff',
    textDecoration: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700
  },
  errorCard: {
    padding: '14px 16px', borderRadius: 'var(--radius-md)',
    background: 'var(--danger-soft)', border: '1px solid var(--danger-soft-border)',
    color: 'var(--danger)', fontWeight: 600
  },

  refreshButton: {
    justifySelf: 'start', marginTop: '6px', padding: '11px 20px', border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-md)', background: 'var(--surface)',
    color: 'var(--text)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)'
  }
}

export default RecommendationsPage
