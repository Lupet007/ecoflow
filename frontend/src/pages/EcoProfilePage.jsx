import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'

const REGIONS = ['Ljubljana', 'Maribor', 'Koper', 'Celje', 'Kranj']

const ECO_PRIORITIES = [
  { value: 'AIR_QUALITY', label: 'Clean air', icon: '🌬️', desc: 'Prioritize routes with good air quality' },
  { value: 'WATER_QUALITY', label: 'Clean water', icon: '💧', desc: 'Prioritize routes near clean water sources' },
  { value: 'LAND_TEMPERATURE', label: 'Low temperature', icon: '🌡️', desc: 'Avoid high temperature zones' },
]

const ACTIVITY_TYPES = [
  { value: 'WALKING', label: 'Walking', icon: '🚶', desc: 'Shorter routes and comfort-first planning' },
  { value: 'CYCLING', label: 'Cycling', icon: '🚴', desc: 'Balanced medium routes up to 15km' },
  { value: 'RUNNING', label: 'Running', icon: '🏃', desc: 'Cleaner air and moderate exposure time' },
]

function EcoProfilePage() {
  const [saved, setSaved] = useState(false)

  const [profile, setProfile] = useState(() => {
    const stored = localStorage.getItem('ecoProfile')
    return stored ? JSON.parse(stored) : {
      ecoPriority: 'AIR_QUALITY',
      activityType: 'WALKING',
      preferredRegion: 'Ljubljana',
      alertsEnabled: false,
      alertThreshold: 'MODERATE',
    }
  })

  const completeness = useMemo(() => {
    let score = 0
    if (profile.ecoPriority) score += 25
    if (profile.activityType) score += 25
    if (profile.preferredRegion) score += 25
    if (profile.alertsEnabled) score += 25
    return score
  }, [profile])

  const priorityInfo = useMemo(
    () => ECO_PRIORITIES.find(e => e.value === profile.ecoPriority),
    [profile.ecoPriority]
  )
  const activityInfo = useMemo(
    () => ACTIVITY_TYPES.find(a => a.value === profile.activityType),
    [profile.activityType]
  )

  const handleSave = () => {
    localStorage.setItem('ecoProfile', JSON.stringify(profile))
    localStorage.setItem('ecoProfileJustSaved', 'true')
    window.dispatchEvent(new Event('ecoProfileUpdated'))
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleReset = () => {
    const defaults = {
      ecoPriority: 'AIR_QUALITY',
      activityType: 'WALKING',
      preferredRegion: 'Ljubljana',
      alertsEnabled: false,
      alertThreshold: 'MODERATE',
    }
    setProfile(defaults)
    localStorage.removeItem('ecoProfile')
  }

  const handleAlertsToggle = async () => {
    const enabling = !profile.alertsEnabled

    if (enabling && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      await Notification.requestPermission()
    }

    setProfile(current => ({ ...current, alertsEnabled: enabling }))
  }

  return (
    <div style={styles.page}>
      <div style={styles.glowOne} />
      <div style={styles.glowTwo} />

      <header style={styles.header} className="eco-header">
        <div>
          <p style={styles.eyebrow}>Personalization</p>
          <h1 style={styles.title}>Eco Profile</h1>
          <p style={styles.subtitle}>
            Configure your activity, region and environmental priorities for smarter route recommendations.
          </p>
        </div>

        <Link to="/" style={styles.backButton}>← Back to map</Link>
      </header>

      <main style={styles.container} className="eco-container">
        <section style={styles.heroGrid}>
          <div style={styles.profileCard}>
            <p style={styles.eyebrow}>Profile status</p>
            <h2 style={styles.sectionTitle}>Your route preferences</h2>
            <p style={styles.sectionDesc}>
              EcoFlow uses this profile to adapt route recommendations, map focus and predicted eco-score.
            </p>

            <div style={styles.summaryList}>
              <div style={styles.summaryItem}>
                <span>🌍</span>
                <div>
                  <strong>Priority</strong>
                  <p>{ECO_PRIORITIES.find(e => e.value === profile.ecoPriority)?.label}</p>
                </div>
              </div>

              <div style={styles.summaryItem}>
                <span>🏃</span>
                <div>
                  <strong>Activity</strong>
                  <p>{ACTIVITY_TYPES.find(a => a.value === profile.activityType)?.label}</p>
                </div>
              </div>

              <div style={styles.summaryItem}>
                <span>📍</span>
                <div>
                  <strong>Region</strong>
                  <p>{profile.preferredRegion}</p>
                </div>
              </div>

              <div style={styles.summaryItem}>
                <span>⚠️</span>
                <div>
                  <strong>Alerts</strong>
                  <p>{profile.alertsEnabled ? `Enabled (${profile.alertThreshold})` : 'Disabled'}</p>
                </div>
              </div>
            </div>
          </div>

          <div style={styles.scoreCard}>
            <p style={styles.eyebrow}>What this means</p>
            <h2 style={styles.sectionTitle}>Your routes will be tuned for</h2>

            <div style={styles.scoreCircle}>
              <span style={{ fontSize: '48px' }}>{priorityInfo?.icon}</span>
            </div>

            <h3 style={styles.scoreLabel}>{priorityInfo?.label}</h3>

            <p style={styles.sectionDesc}>
              Eco/Fast/Balanced route options and GPX eco-scores will favor {priorityInfo?.desc?.toLowerCase()},
              tuned for {activityInfo?.label?.toLowerCase()} around {profile.preferredRegion}. This reflects your
              own selections below - not a measured or predicted number.
            </p>
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.eyebrow}>Environmental priority</p>
              <h2 style={styles.sectionTitle}>What matters most?</h2>
            </div>
          </div>

          <div style={styles.optionGrid}>
            {ECO_PRIORITIES.map(opt => (
              <button
                key={opt.value}
                onClick={() => setProfile(p => ({ ...p, ecoPriority: opt.value }))}
                style={{
                  ...styles.optionCard,
                  borderColor: profile.ecoPriority === opt.value ? '#22c55e' : 'rgba(148,163,184,0.18)',
                  background: profile.ecoPriority === opt.value
                    ? 'linear-gradient(180deg, rgba(34,197,94,0.18), rgba(15,23,42,0.9))'
                    : 'rgba(15,23,42,0.72)'
                }}
              >
                <span style={styles.optionIcon}>{opt.icon}</span>
                <strong>{opt.label}</strong>
                <small>{opt.desc}</small>
                {profile.ecoPriority === opt.value && <em style={styles.selectedBadge}>Selected</em>}
              </button>
            ))}
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.eyebrow}>Activity type</p>
              <h2 style={styles.sectionTitle}>How will you move?</h2>
            </div>
          </div>

          <div style={styles.optionGrid}>
            {ACTIVITY_TYPES.map(opt => (
              <button
                key={opt.value}
                onClick={() => setProfile(p => ({ ...p, activityType: opt.value }))}
                style={{
                  ...styles.optionCard,
                  borderColor: profile.activityType === opt.value ? '#3b82f6' : 'rgba(148,163,184,0.18)',
                  background: profile.activityType === opt.value
                    ? 'linear-gradient(180deg, rgba(59,130,246,0.18), rgba(15,23,42,0.9))'
                    : 'rgba(15,23,42,0.72)'
                }}
              >
                <span style={styles.optionIcon}>{opt.icon}</span>
                <strong>{opt.label}</strong>
                <small>{opt.desc}</small>
                {profile.activityType === opt.value && <em style={{ ...styles.selectedBadge, background: '#3b82f6' }}>Selected</em>}
              </button>
            ))}
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.eyebrow}>Preferred region</p>
              <h2 style={styles.sectionTitle}>Map focus area</h2>
            </div>
          </div>

          <div style={styles.regionGrid}>
            {REGIONS.map(region => (
              <button
                key={region}
                onClick={() => setProfile(p => ({ ...p, preferredRegion: region }))}
                style={{
                  ...styles.regionButton,
                  background: profile.preferredRegion === region
                    ? 'linear-gradient(135deg, #6366f1, #38bdf8)'
                    : 'rgba(15,23,42,0.72)',
                  borderColor: profile.preferredRegion === region
                    ? '#818cf8'
                    : 'rgba(148,163,184,0.18)'
                }}
              >
                {region}
              </button>
            ))}
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.eyebrow}>Environmental alerts</p>
              <h2 style={styles.sectionTitle}>Alert preferences</h2>
            </div>

            <button
              type="button"
              aria-label={profile.alertsEnabled ? 'Disable environmental alerts' : 'Enable environmental alerts'}
              aria-pressed={profile.alertsEnabled}
              onClick={handleAlertsToggle}
              style={{
                ...styles.toggle,
                background: profile.alertsEnabled ? '#22c55e' : '#334155'
              }}
            >
              <div style={{
                ...styles.toggleThumb,
                transform: profile.alertsEnabled ? 'translateX(24px)' : 'translateX(2px)'
              }} />
            </button>
          </div>

          <p style={styles.sectionDesc}>
            Get notified when environmental conditions are less suitable for outdoor activity.
          </p>

          {profile.alertsEnabled && (
            <div style={styles.regionGrid}>
              {['POOR', 'MODERATE', 'ANY'].map(level => (
                <button
                  key={level}
                  onClick={() => setProfile(p => ({ ...p, alertThreshold: level }))}
                  style={{
                    ...styles.regionButton,
                    background: profile.alertThreshold === level
                      ? 'linear-gradient(135deg, #f59e0b, #f97316)'
                      : 'rgba(15,23,42,0.72)',
                    borderColor: profile.alertThreshold === level
                      ? '#f59e0b'
                      : 'rgba(148,163,184,0.18)'
                  }}
                >
                  {level}
                </button>
              ))}
            </div>
          )}
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.eyebrow}>Completeness</p>
              <h2 style={styles.sectionTitle}>Profile readiness</h2>
            </div>

            <span style={completeness === 100 ? styles.pillSuccess : styles.pillWarning}>
              {completeness}% complete
            </span>
          </div>

          <div style={styles.progressTrack}>
            <div style={{
              ...styles.progressFill,
              width: `${completeness}%`,
              background: completeness === 100
                ? 'linear-gradient(135deg, #10b981, #22c55e)'
                : 'linear-gradient(135deg, #f59e0b, #f97316)'
            }} />
          </div>

          <div style={styles.progressLabels}>
            <span>Priority</span>
            <span>Activity</span>
            <span>Region</span>
            <span>Alerts</span>
          </div>
        </section>

        <div style={styles.buttonRow}>
          <button onClick={handleSave} style={styles.saveButton}>
            {saved ? '✓ Saved!' : 'Save preferences'}
          </button>

          <button onClick={handleReset} style={styles.resetButton}>
            Reset to defaults
          </button>
        </div>
      </main>
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
      'radial-gradient(circle at 15% 0%, rgba(34,197,94,0.18), transparent 30%), radial-gradient(circle at 90% 15%, rgba(168,85,247,0.12), transparent 28%), linear-gradient(135deg, #020617, #0f172a)',
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
    background: 'rgba(168,85,247,0.14)',
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
  heroGrid: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 0.8fr',
    gap: '24px'
  },
  profileCard: {
    ...glassCard,
    borderRadius: '24px',
    padding: '26px'
  },
  scoreCard: {
    ...glassCard,
    borderRadius: '24px',
    padding: '26px',
    textAlign: 'center'
  },
  section: {
    ...glassCard,
    borderRadius: '24px',
    padding: '26px'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    marginBottom: '18px'
  },
  sectionTitle: {
    margin: '5px 0 0',
    color: '#f8fafc',
    fontSize: '25px',
    fontWeight: 850,
    letterSpacing: '-0.04em'
  },
  sectionDesc: {
    color: '#94a3b8',
    marginTop: '10px',
    fontSize: '14px',
    lineHeight: 1.65
  },
  summaryList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '14px',
    marginTop: '22px'
  },
  summaryItem: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    background: 'rgba(15,23,42,0.72)',
    border: '1px solid rgba(148,163,184,0.14)',
    borderRadius: '16px',
    padding: '14px'
  },
  scoreCircle: {
    width: '142px',
    height: '142px',
    borderRadius: '50%',
    border: '7px solid #22c55e',
    margin: '24px auto 14px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(15,23,42,0.6)'
  },
  scoreLabel: {
    margin: '0 0 8px',
    fontSize: '24px',
    color: '#22c55e'
  },
  optionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
    gap: '14px'
  },
  optionCard: {
    padding: '20px',
    borderRadius: '18px',
    border: '1px solid',
    cursor: 'pointer',
    color: '#fff',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  optionIcon: {
    fontSize: '30px'
  },
  selectedBadge: {
    marginTop: '6px',
    alignSelf: 'flex-start',
    padding: '5px 10px',
    background: '#22c55e',
    color: '#fff',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 900,
    fontStyle: 'normal'
  },
  regionGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px'
  },
  regionButton: {
    padding: '11px 18px',
    borderRadius: '14px',
    border: '1px solid',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 850
  },
  toggle: {
    width: '54px',
    height: '30px',
    borderRadius: '999px',
    cursor: 'pointer',
    position: 'relative',
    border: 0,
    padding: 0,
    transition: 'background-color 0.2s',
    flexShrink: 0
  },
  toggleThumb: {
    position: 'absolute',
    top: '3px',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: '#fff',
    transition: 'transform 0.2s'
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
  progressTrack: {
    height: '14px',
    backgroundColor: 'rgba(15,23,42,0.82)',
    borderRadius: '999px',
    overflow: 'hidden',
    border: '1px solid rgba(148,163,184,0.14)'
  },
  progressFill: {
    height: '100%',
    borderRadius: '999px',
    transition: 'width 0.5s ease'
  },
  progressLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '10px',
    color: '#64748b',
    fontSize: '12px',
    fontWeight: 800
  },
  buttonRow: {
    display: 'flex',
    gap: '14px',
    flexWrap: 'wrap'
  },
  saveButton: {
    padding: '13px 28px',
    background: 'linear-gradient(135deg, #10b981, #22c55e)',
    color: '#fff',
    border: 'none',
    borderRadius: '14px',
    cursor: 'pointer',
    fontWeight: 900,
    fontSize: '15px',
    boxShadow: '0 18px 40px rgba(34,197,94,0.22)'
  },
  resetButton: {
    padding: '13px 28px',
    background: 'linear-gradient(135deg, #334155, #475569)',
    color: '#fff',
    border: 'none',
    borderRadius: '14px',
    cursor: 'pointer',
    fontWeight: 850,
    fontSize: '15px'
  }
}

export default EcoProfilePage
