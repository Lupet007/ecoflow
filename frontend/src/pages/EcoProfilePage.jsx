import { useState, useMemo } from 'react'
import AppHeader from '../components/AppHeader'
import AppFooter from '../components/AppFooter'

const REGIONS = ['Ljubljana', 'Maribor', 'Koper', 'Celje', 'Kranj']

const ECO_PRIORITIES = [
  { value: 'AIR_QUALITY', label: 'Čist zrak', desc: 'Daj prednost potem z dobro kakovostjo zraka' },
  { value: 'WATER_QUALITY', label: 'Čista voda', desc: 'Daj prednost potem blizu čistih vodnih virov' },
  { value: 'LAND_TEMPERATURE', label: 'Nizka temperatura', desc: 'Izogibaj se območjem z visoko temperaturo' },
]

const ACTIVITY_TYPES = [
  { value: 'WALKING', label: 'Hoja', desc: 'Krajše poti in načrtovanje, ki daje prednost udobju' },
  { value: 'CYCLING', label: 'Kolesarjenje', desc: 'Uravnotežene srednje dolge poti do 15 km' },
  { value: 'RUNNING', label: 'Tek', desc: 'Čistejši zrak in zmerna izpostavljenost' },
]

const ALERT_LEVELS = [
  { value: 'POOR', label: 'Slabo' },
  { value: 'MODERATE', label: 'Zmerno' },
  { value: 'ANY', label: 'Katerokoli' },
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
      <AppHeader />

      <div style={styles.header}>
        <p style={styles.eyebrow}>Personalizacija</p>
        <h1 style={styles.title}>Eko profil</h1>
        <p style={styles.subtitle}>
          Nastavi svojo aktivnost, regijo in okoljske prioritete za pametnejša priporočila poti.
        </p>
      </div>

      <main style={styles.container} className="eco-container">
        <section style={styles.heroGrid} className="eco-hero-grid">
          <div style={styles.profileCard}>
            <p style={styles.eyebrow}>Stanje profila</p>
            <h2 style={styles.sectionTitle}>Tvoje nastavitve poti</h2>
            <p style={styles.sectionDesc}>
              EcoFlow uporablja ta profil za prilagajanje priporočil poti, fokusa zemljevida in predvidene eko-ocene.
            </p>

            <div style={styles.summaryList}>
              <div style={styles.summaryItem}>
                <span style={styles.summaryDot} />
                <div>
                  <strong>Prioriteta</strong>
                  <p>{ECO_PRIORITIES.find(e => e.value === profile.ecoPriority)?.label}</p>
                </div>
              </div>

              <div style={styles.summaryItem}>
                <span style={styles.summaryDot} />
                <div>
                  <strong>Aktivnost</strong>
                  <p>{ACTIVITY_TYPES.find(a => a.value === profile.activityType)?.label}</p>
                </div>
              </div>

              <div style={styles.summaryItem}>
                <span style={styles.summaryDot} />
                <div>
                  <strong>Regija</strong>
                  <p>{profile.preferredRegion}</p>
                </div>
              </div>

              <div style={styles.summaryItem}>
                <span style={styles.summaryDot} />
                <div>
                  <strong>Opozorila</strong>
                  <p>{profile.alertsEnabled
                    ? `Omogočeno (${ALERT_LEVELS.find(l => l.value === profile.alertThreshold)?.label})`
                    : 'Onemogočeno'}</p>
                </div>
              </div>
            </div>
          </div>

          <div style={styles.scoreCard}>
            <p style={styles.eyebrow}>Kaj to pomeni</p>
            <h2 style={styles.sectionTitle}>Tvoje poti bodo prilagojene za</h2>

            <div style={styles.scoreCircle}>
              <strong style={styles.scoreCircleLabel}>{priorityInfo?.label}</strong>
            </div>

            <p style={styles.sectionDesc}>
              Možnosti poti Eko/Hitro/Uravnoteženo in GPX eko-ocene bodo dajale prednost: {priorityInfo?.desc?.toLowerCase()},
              prilagojeno za {activityInfo?.label?.toLowerCase()} v okolici {profile.preferredRegion}. To odraža tvoje
              lastne izbire spodaj - ne izmerjeno ali predvideno število.
            </p>
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.eyebrow}>Okoljska prioriteta</p>
              <h2 style={styles.sectionTitle}>Kaj ti je najbolj pomembno?</h2>
            </div>
          </div>

          <div style={styles.optionGrid}>
            {ECO_PRIORITIES.map(opt => (
              <button
                key={opt.value}
                onClick={() => setProfile(p => ({ ...p, ecoPriority: opt.value }))}
                style={profile.ecoPriority === opt.value ? styles.optionCardActive : styles.optionCard}
              >
                <strong>{opt.label}</strong>
                <small>{opt.desc}</small>
                {profile.ecoPriority === opt.value && <em style={styles.selectedBadge}>Izbrano</em>}
              </button>
            ))}
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.eyebrow}>Vrsta aktivnosti</p>
              <h2 style={styles.sectionTitle}>Kako se boš gibal/-a?</h2>
            </div>
          </div>

          <div style={styles.optionGrid}>
            {ACTIVITY_TYPES.map(opt => (
              <button
                key={opt.value}
                onClick={() => setProfile(p => ({ ...p, activityType: opt.value }))}
                style={profile.activityType === opt.value ? styles.optionCardActiveInfo : styles.optionCard}
              >
                <strong>{opt.label}</strong>
                <small>{opt.desc}</small>
                {profile.activityType === opt.value && <em style={{ ...styles.selectedBadge, background: 'var(--info)' }}>Izbrano</em>}
              </button>
            ))}
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.eyebrow}>Priljubljena regija</p>
              <h2 style={styles.sectionTitle}>Območje fokusa zemljevida</h2>
            </div>
          </div>

          <div style={styles.regionGrid}>
            {REGIONS.map(region => (
              <button
                key={region}
                onClick={() => setProfile(p => ({ ...p, preferredRegion: region }))}
                style={profile.preferredRegion === region ? styles.regionButtonActive : styles.regionButton}
              >
                {region}
              </button>
            ))}
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.eyebrow}>Okoljska opozorila</p>
              <h2 style={styles.sectionTitle}>Nastavitve opozoril</h2>
            </div>

            <button
              type="button"
              aria-label={profile.alertsEnabled ? 'Onemogoči okoljska opozorila' : 'Omogoči okoljska opozorila'}
              aria-pressed={profile.alertsEnabled}
              onClick={handleAlertsToggle}
              style={{
                ...styles.toggle,
                background: profile.alertsEnabled ? 'var(--brand)' : 'var(--border-strong)'
              }}
            >
              <div style={{
                ...styles.toggleThumb,
                transform: profile.alertsEnabled ? 'translateX(24px)' : 'translateX(2px)'
              }} />
            </button>
          </div>

          <p style={styles.sectionDesc}>
            Prejmi obvestilo, ko so okoljski pogoji manj primerni za aktivnosti na prostem.
          </p>

          {profile.alertsEnabled && (
            <div style={styles.regionGrid}>
              {ALERT_LEVELS.map(level => (
                <button
                  key={level.value}
                  onClick={() => setProfile(p => ({ ...p, alertThreshold: level.value }))}
                  style={profile.alertThreshold === level.value ? styles.regionButtonActiveWarning : styles.regionButton}
                >
                  {level.label}
                </button>
              ))}
            </div>
          )}
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.eyebrow}>Popolnost</p>
              <h2 style={styles.sectionTitle}>Pripravljenost profila</h2>
            </div>

            <span style={completeness === 100 ? styles.pillSuccess : styles.pillWarning}>
              {completeness}% dokončano
            </span>
          </div>

          <div style={styles.progressTrack}>
            <div style={{
              ...styles.progressFill,
              width: `${completeness}%`,
              backgroundColor: completeness === 100 ? 'var(--brand)' : 'var(--warning)'
            }} />
          </div>

          <div style={styles.progressLabels}>
            <span>Prioriteta</span>
            <span>Aktivnost</span>
            <span>Regija</span>
            <span>Opozorila</span>
          </div>
        </section>

        <div style={styles.buttonRow}>
          <button onClick={handleSave} style={styles.saveButton}>
            {saved ? 'Shranjeno!' : 'Shrani nastavitve'}
          </button>

          <button onClick={handleReset} style={styles.resetButton}>
            Ponastavi na privzeto
          </button>
        </div>
      </main>

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
  container: {
    maxWidth: '1240px',
    margin: '0 auto',
    padding: '0 24px 44px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  heroGrid: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 0.8fr',
    gap: '20px'
  },
  profileCard: {
    ...card,
    borderRadius: 'var(--radius-lg)',
    padding: '24px'
  },
  scoreCard: {
    ...card,
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
    textAlign: 'center'
  },
  section: {
    ...card,
    borderRadius: 'var(--radius-lg)',
    padding: '24px'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    marginBottom: '16px'
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
    marginTop: '8px',
    fontSize: '14px',
    lineHeight: 1.6
  },
  summaryList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
    marginTop: '18px'
  },
  summaryItem: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    background: 'var(--surface-muted)',
    borderRadius: 'var(--radius-md)',
    padding: '12px'
  },
  summaryDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'var(--brand)',
    flexShrink: 0
  },
  scoreCircle: {
    width: '128px',
    height: '128px',
    borderRadius: '50%',
    border: '4px solid var(--brand)',
    margin: '20px auto 14px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px',
    background: 'var(--brand-soft)'
  },
  scoreCircleLabel: {
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--brand-hover)',
    textAlign: 'center'
  },
  optionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
    gap: '12px'
  },
  optionCard: {
    padding: '18px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    color: 'var(--text)',
    background: 'var(--surface)',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontFamily: 'var(--font)'
  },
  optionCardActive: {
    padding: '18px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--brand)',
    cursor: 'pointer',
    color: 'var(--text)',
    background: 'var(--brand-soft)',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontFamily: 'var(--font)'
  },
  optionCardActiveInfo: {
    padding: '18px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--info)',
    cursor: 'pointer',
    color: 'var(--text)',
    background: 'var(--info-soft)',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontFamily: 'var(--font)'
  },
  selectedBadge: {
    marginTop: '4px',
    alignSelf: 'flex-start',
    padding: '4px 10px',
    background: 'var(--brand)',
    color: '#fff',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 700,
    fontStyle: 'normal'
  },
  regionGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px'
  },
  regionButton: {
    padding: '10px 18px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-strong)',
    color: 'var(--text)',
    background: 'var(--surface)',
    cursor: 'pointer',
    fontWeight: 600,
    fontFamily: 'var(--font)'
  },
  regionButtonActive: {
    padding: '10px 18px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--brand)',
    color: '#fff',
    background: 'var(--brand)',
    cursor: 'pointer',
    fontWeight: 700,
    fontFamily: 'var(--font)'
  },
  regionButtonActiveWarning: {
    padding: '10px 18px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--warning)',
    color: '#fff',
    background: 'var(--warning)',
    cursor: 'pointer',
    fontWeight: 700,
    fontFamily: 'var(--font)'
  },
  toggle: {
    width: '48px',
    height: '28px',
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
    top: '2px',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: '#fff',
    transition: 'transform 0.2s'
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
  progressTrack: {
    height: '12px',
    backgroundColor: 'var(--surface-muted)',
    borderRadius: '999px',
    overflow: 'hidden',
    border: '1px solid var(--border)'
  },
  progressFill: {
    height: '100%',
    borderRadius: '999px',
    transition: 'width 0.5s ease'
  },
  progressLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '8px',
    color: 'var(--text-faint)',
    fontSize: '12px',
    fontWeight: 700
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap'
  },
  saveButton: {
    padding: '12px 28px',
    background: 'var(--brand)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '15px',
    fontFamily: 'var(--font)'
  },
  resetButton: {
    padding: '12px 28px',
    background: 'var(--surface)',
    color: 'var(--text)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '15px',
    fontFamily: 'var(--font)'
  }
}

export default EcoProfilePage
