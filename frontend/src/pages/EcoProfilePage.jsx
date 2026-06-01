import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'

function predictEcoScore(profile) {
  let score = 70 // baseline

  // Activity bonus
  if (profile.activityType === 'WALKING') score += 10
  if (profile.activityType === 'RUNNING') score += 6
  if (profile.activityType === 'CYCLING') score += 3

  // Eco priority bonus
  if (profile.ecoPriority === 'AIR_QUALITY') score += 8
  if (profile.ecoPriority === 'WATER_QUALITY') score += 5
  if (profile.ecoPriority === 'LAND_TEMPERATURE') score += 3

  // Alerts bonus
  if (profile.alertsEnabled) score += 4

  return Math.min(100, score)
}

function getScoreColor(score) {
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#3b82f6'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

function getScoreLabel(score) {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Moderate'
  return 'Poor'
}

const REGIONS = ['Ljubljana', 'Maribor', 'Koper', 'Celje', 'Kranj']
const ECO_PRIORITIES = [
  { value: 'AIR_QUALITY', label: '🌬️ Clean air', desc: 'Prioritize routes with good air quality' },
  { value: 'WATER_QUALITY', label: '💧 Clean water', desc: 'Prioritize routes near clean water sources' },
  { value: 'LAND_TEMPERATURE', label: '🌡️ Low temperature', desc: 'Avoid high temperature zones' },
]
const ACTIVITY_TYPES = [
  { value: 'WALKING', label: '🚶 Walking', desc: 'Shorter routes, max 5km' },
  { value: 'CYCLING', label: '🚴 Cycling', desc: 'Medium routes, max 15km' },
  { value: 'RUNNING', label: '🏃 Running', desc: 'Elevation bonus in eco-score' },
]

function EcoProfilePage() {
  const navigate = useNavigate()
  const [saved, setSaved] = useState(false)

  const [profile, setProfile] = useState({
    ecoPriority: 'AIR_QUALITY',
    activityType: 'WALKING',
    preferredRegion: 'Ljubljana',
    alertsEnabled: false,
    alertThreshold: 'MODERATE',
  })

  useEffect(() => {
    const stored = localStorage.getItem('ecoProfile')
    if (stored) {
      setProfile(JSON.parse(stored))
    }
  }, [])

  const completeness = useMemo(() => {
    let score = 0
    if (profile.ecoPriority) score += 25
    if (profile.activityType) score += 25
    if (profile.preferredRegion) score += 25
    if (profile.alertsEnabled) score += 25
    return score
  }, [profile])

  const predictedScore = useMemo(() => predictEcoScore(profile), [profile])

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

  return (
    <div style={styles.page}>
      <header style={styles.header} className="eco-header">
        <div>
          <h1 style={styles.title}>🌿 Eco Profile</h1>
          <p style={styles.subtitle}>Set your environmental preferences to personalise your experience.</p>
        </div>
        <div className="eco-header-buttons">
          <Link to="/" style={styles.backButton}>← Back to map</Link>
        </div>
      </header>

      <main style={styles.container} className="eco-container">

        {/* Eco Priority */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>🌍 Eco priority</h2>
          <p style={styles.sectionDesc}>What environmental factor matters most to you?</p>
          <div style={styles.optionGrid}>
            {ECO_PRIORITIES.map(opt => (
              <div
                key={opt.value}
                onClick={() => setProfile(p => ({ ...p, ecoPriority: opt.value }))}
                style={{
                  ...styles.optionCard,
                  borderColor: profile.ecoPriority === opt.value ? '#22c55e' : '#334155',
                  backgroundColor: profile.ecoPriority === opt.value ? '#0f2a1a' : '#0f172a',
                }}
              >
                <div style={styles.optionLabel}>{opt.label}</div>
                <div style={styles.optionDesc}>{opt.desc}</div>
                {profile.ecoPriority === opt.value && (
                  <div style={styles.selectedBadge}>✓ Selected</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Activity Type */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>🏃 Activity type</h2>
          <p style={styles.sectionDesc}>How do you usually travel your routes?</p>
          <div style={styles.optionGrid}>
            {ACTIVITY_TYPES.map(opt => (
              <div
                key={opt.value}
                onClick={() => setProfile(p => ({ ...p, activityType: opt.value }))}
                style={{
                  ...styles.optionCard,
                  borderColor: profile.activityType === opt.value ? '#3b82f6' : '#334155',
                  backgroundColor: profile.activityType === opt.value ? '#0f1f3a' : '#0f172a',
                }}
              >
                <div style={styles.optionLabel}>{opt.label}</div>
                <div style={styles.optionDesc}>{opt.desc}</div>
                {profile.activityType === opt.value && (
                  <div style={{ ...styles.selectedBadge, backgroundColor: '#3b82f6' }}>✓ Selected</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Preferred Region */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>📍 Preferred region</h2>
          <p style={styles.sectionDesc}>The map will centre on your preferred region.</p>
          <div style={styles.regionGrid}>
            {REGIONS.map(region => (
              <button
                key={region}
                onClick={() => setProfile(p => ({ ...p, preferredRegion: region }))}
                style={{
                  ...styles.regionButton,
                  backgroundColor: profile.preferredRegion === region ? '#6366f1' : '#1e293b',
                  borderColor: profile.preferredRegion === region ? '#6366f1' : '#334155',
                }}
              >
                {region}
              </button>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>⚠️ Environmental alerts</h2>
          <p style={styles.sectionDesc}>Get notified when environmental conditions are poor.</p>

          <div style={styles.toggleRow}>
            <span style={styles.toggleLabel}>Enable alerts</span>
            <div
              onClick={() => setProfile(p => ({ ...p, alertsEnabled: !p.alertsEnabled }))}
              style={{
                ...styles.toggle,
                backgroundColor: profile.alertsEnabled ? '#22c55e' : '#334155',
              }}
            >
              <div style={{
                ...styles.toggleThumb,
                transform: profile.alertsEnabled ? 'translateX(24px)' : 'translateX(2px)',
              }} />
            </div>
          </div>

          {profile.alertsEnabled && (
            <div style={styles.alertOptions}>
              <p style={styles.sectionDesc}>Alert me when air quality is:</p>
              <div style={styles.regionGrid}>
                {['POOR', 'MODERATE', 'ANY'].map(level => (
                  <button
                    key={level}
                    onClick={() => setProfile(p => ({ ...p, alertThreshold: level }))}
                    style={{
                      ...styles.regionButton,
                      backgroundColor: profile.alertThreshold === level ? '#f59e0b' : '#1e293b',
                      borderColor: profile.alertThreshold === level ? '#f59e0b' : '#334155',
                    }}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Profile completeness */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>📊 Profile completeness</h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#94a3b8', fontSize: '14px' }}>Your profile is {completeness}% complete</span>
            <span style={{ color: completeness === 100 ? '#22c55e' : '#f59e0b', fontWeight: '700' }}>
              {completeness === 100 ? '✅ Complete' : '⚠️ Incomplete'}
            </span>
          </div>
          <div style={styles.progressTrack}>
            <div style={{
              ...styles.progressFill,
              width: `${completeness}%`,
              backgroundColor: completeness === 100 ? '#22c55e' : '#f59e0b',
              transition: 'width 0.5s ease'
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
            <span>Eco priority ✓</span>
            <span>Activity ✓</span>
            <span>Region ✓</span>
            <span style={{ color: profile.alertsEnabled ? '#22c55e' : '#64748b' }}>Alerts {profile.alertsEnabled ? '✓' : '○'}</span>
          </div>
        </div>

        {/* Predicted eco score */}
        <div style={{ ...styles.section, border: `2px solid ${getScoreColor(predictedScore)}` }}>
          <h2 style={styles.sectionTitle}>⭐ Predicted eco-score</h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px' }}>
            Based on your preferences, your routes will score approximately:
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{
              width: '90px', height: '90px', borderRadius: '50%',
              border: `5px solid ${getScoreColor(predictedScore)}`,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>
              <span style={{ fontSize: '24px', fontWeight: '800', color: getScoreColor(predictedScore) }}>
                {predictedScore}
              </span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>/ 100</span>
            </div>
            <div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: getScoreColor(predictedScore), marginBottom: '6px' }}>
                {getScoreLabel(predictedScore)}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '13px', lineHeight: '1.6' }}>
                {profile.activityType === 'WALKING' && '🚶 Walking gives the highest eco bonus (+10)'}
                {profile.activityType === 'RUNNING' && '🏃 Running gives elevation bonus (+6)'}
                {profile.activityType === 'CYCLING' && '🚴 Cycling is eco-friendly (+3)'}
                <br />
                {profile.ecoPriority === 'AIR_QUALITY' && '🌬️ Clean air priority adds +8 to score'}
                {profile.ecoPriority === 'WATER_QUALITY' && '💧 Water quality priority adds +5 to score'}
                {profile.ecoPriority === 'LAND_TEMPERATURE' && '🌡️ Temperature priority adds +3 to score'}
                <br />
                {profile.alertsEnabled && '⚠️ Alerts enabled adds +4 to score'}
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div style={styles.summaryBox}>
          <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Your current profile</h3>
          <p>🌍 Eco priority: <strong style={{ color: '#22c55e' }}>{ECO_PRIORITIES.find(e => e.value === profile.ecoPriority)?.label}</strong></p>
          <p>🏃 Activity: <strong style={{ color: '#3b82f6' }}>{ACTIVITY_TYPES.find(a => a.value === profile.activityType)?.label}</strong></p>
          <p>📍 Region: <strong style={{ color: '#6366f1' }}>{profile.preferredRegion}</strong></p>
          <p>⚠️ Alerts: <strong style={{ color: profile.alertsEnabled ? '#22c55e' : '#94a3b8' }}>{profile.alertsEnabled ? `Enabled (${profile.alertThreshold})` : 'Disabled'}</strong></p>
        </div>

        {/* Buttons */}
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
  title: { margin: 0, fontSize: '32px', color: '#f8fafc' },
  subtitle: { marginTop: '8px', color: '#94a3b8' },
  backButton: {
    padding: '10px 16px',
    backgroundColor: '#334155',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: '8px',
    fontWeight: '600'
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 24px 40px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  section: {
    backgroundColor: '#1e293b',
    borderRadius: '14px',
    padding: '24px',
    border: '1px solid #334155'
  },
  sectionTitle: { margin: '0 0 8px 0', color: '#f8fafc', fontSize: '20px' },
  sectionDesc: { color: '#94a3b8', marginBottom: '16px', fontSize: '14px' },
  optionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '14px'
  },
  optionCard: {
    padding: '18px',
    borderRadius: '12px',
    border: '2px solid',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  optionLabel: { fontSize: '16px', fontWeight: '700', marginBottom: '6px', color: '#f8fafc' },
  optionDesc: { fontSize: '13px', color: '#94a3b8' },
  selectedBadge: {
    marginTop: '10px',
    display: 'inline-block',
    padding: '3px 10px',
    backgroundColor: '#22c55e',
    color: '#fff',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '700'
  },
  regionGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px'
  },
  regionButton: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: '2px solid',
    cursor: 'pointer',
    color: '#fff',
    fontWeight: '600',
    fontSize: '14px'
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '16px'
  },
  toggleLabel: { color: '#cbd5e1', fontSize: '15px' },
  toggle: {
    width: '52px',
    height: '28px',
    borderRadius: '14px',
    cursor: 'pointer',
    position: 'relative',
    transition: 'background-color 0.2s'
  },
  toggleThumb: {
    position: 'absolute',
    top: '3px',
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    backgroundColor: '#fff',
    transition: 'transform 0.2s'
  },
  alertOptions: { marginTop: '8px' },
  summaryBox: {
    backgroundColor: '#1e293b',
    borderRadius: '14px',
    padding: '24px',
    border: '1px solid #22c55e'
  },
  progressTrack: {
    height: '12px',
    backgroundColor: '#0f172a',
    borderRadius: '6px',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: '6px',
  },
  buttonRow: {
    display: 'flex',
    gap: '14px',
    flexWrap: 'wrap'
  },
  saveButton: {
    padding: '12px 28px',
    backgroundColor: '#22c55e',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '15px'
  },
  resetButton: {
    padding: '12px 28px',
    backgroundColor: '#334155',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '15px'
  }
}

export default EcoProfilePage
