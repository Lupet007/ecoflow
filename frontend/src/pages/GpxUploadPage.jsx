import { useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import AppHeader from '../components/AppHeader'
import AppFooter from '../components/AppFooter'

function formatActivity(type) {
  if (type === 'WALKING') return 'Hoja'
  if (type === 'CYCLING') return 'Kolesarjenje'
  if (type === 'RUNNING') return 'Tek'
  return type
}

function formatPriority(type) {
  if (type === 'AIR_QUALITY') return 'Kakovost zraka'
  if (type === 'WATER_QUALITY') return 'Kakovost vode'
  if (type === 'LAND_TEMPERATURE') return 'Temperatura tal'
  return type
}

function GpxUploadPage() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadStatus, setUploadStatus] = useState('')
  const [uploadedRoute, setUploadedRoute] = useState(null)
  const [loading, setLoading] = useState(false)

  // Load eco profile from localStorage
  const ecoProfile = JSON.parse(localStorage.getItem('ecoProfile') || 'null')

  const handleFileChange = (event) => {
    const file = event.target.files[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.gpx')) {
      setUploadStatus('Prosimo, izberi veljavno GPX datoteko.')
      setSelectedFile(null)
      setUploadedRoute(null)
      return
    }

    setSelectedFile(file)
    setUploadStatus('')
    setUploadedRoute(null)
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadStatus('Najprej izberi GPX datoteko.')
      return
    }

    setLoading(true)
    setUploadStatus('Nalaganje in analiziranje GPX poti ...')
    setUploadedRoute(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      // Send eco profile with upload for personalized scoring
      if (ecoProfile?.activityType) {
        formData.append('activityType', ecoProfile.activityType)
      }
      if (ecoProfile?.ecoPriority) {
        formData.append('ecoPriority', ecoProfile.ecoPriority)
      }

      const response = await axios.post(
        'http://localhost:8080/api/routes/upload',
        formData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      )

      setUploadedRoute(response.data)
      setUploadStatus('GPX pot je bila uspešno naložena in analizirana.')
    } catch (error) {
      console.error(error)
      setUploadStatus(error.response?.data?.error || 'Nalaganje GPX poti ni uspelo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <AppHeader />

      <div style={styles.header}>
        <p style={styles.eyebrow}>Obdelava GPX poti</p>
        <h1 style={styles.title}>Naloži in analiziraj pot</h1>
        <p style={styles.subtitle}>
          Uvozi GPS sledi in izračunaj eko-oceno poti z uporabo analize na strežniku.
        </p>
      </div>

      <main style={styles.container}>

        {/* Eco Profile indicator */}
        {ecoProfile ? (
          <div style={styles.profileBanner}>
            Eko profil je aktiven — ocena bo prilagojena za:
            <strong> {formatActivity(ecoProfile.activityType)}</strong> ·
            <strong> {formatPriority(ecoProfile.ecoPriority)}</strong> ·
            <strong> {ecoProfile.preferredRegion}</strong>
            <Link to="/profile" style={styles.profileLink}>Uredi →</Link>
          </div>
        ) : (
          <div style={styles.profileBannerWarning}>
            Eko profil ni nastavljen — ocena bo uporabila privzete nastavitve.
            <Link to="/profile" style={styles.profileLinkWarning}>Ustvari profil →</Link>
          </div>
        )}

        <section style={styles.heroCard}>
          <div>
            <p style={styles.eyebrow}>Datoteka poti</p>
            <h2 style={styles.sectionTitle}>Izberi GPX datoteko</h2>
            <p style={styles.text}>
              Naloži GPX datoteko, izvoženo iz Strave, Komoota, Garmina, AllTrails ali druge aplikacije za sledenje GPS.
            </p>
          </div>

          <label style={styles.dropZone}>
            <input
              type="file"
              accept=".gpx"
              onChange={handleFileChange}
              style={styles.hiddenInput}
            />
            <strong>Klikni za izbiro GPX datoteke</strong>
            <span>Podprte so samo datoteke .gpx</span>
          </label>

          {selectedFile && (
            <div style={styles.fileInfo}>
              <div>
                <strong>{selectedFile.name}</strong>
                <p>{(selectedFile.size / 1024).toFixed(2)} KB</p>
              </div>
              <span style={styles.fileBadge}>Pripravljeno</span>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={loading}
            style={{ ...styles.uploadButton, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Analiziranje poti ...' : 'Naloži in analiziraj pot'}
          </button>

          {uploadStatus && (
            <p style={
              uploadStatus.includes('ni uspelo') || uploadStatus.includes('veljavno') || uploadStatus.includes('Najprej')
                ? styles.errorStatus
                : styles.status
            }>
              {uploadStatus}
            </p>
          )}
        </section>

        {uploadedRoute && (
          <section style={styles.resultCard}>
            <div>
              <p style={styles.eyebrow}>Analiza zaključena</p>
              <h2 style={styles.sectionTitle}>Rezultat eko-ocene</h2>
            </div>

            <div style={styles.resultGrid}>
              <div style={styles.scoreCircle}>
                <strong>{uploadedRoute.ecoScore}</strong>
                <span>/100</span>
              </div>

              <div style={styles.resultContent}>
                <h3 style={styles.routeName}>{uploadedRoute.name}</h3>

                <div style={styles.resultStats}>
                  <div style={styles.statBox}>
                    <span>Stanje</span>
                    <strong>{uploadedRoute.ecoScoreLabel}</strong>
                  </div>
                  <div style={styles.statBox}>
                    <span>Točke sledi</span>
                    <strong>{uploadedRoute.pointCount}</strong>
                  </div>
                  {uploadedRoute.activityType && uploadedRoute.activityType !== 'DEFAULT' && (
                    <div style={styles.statBox}>
                      <span>Aktivnost</span>
                      <strong>{formatActivity(uploadedRoute.activityType)}</strong>
                    </div>
                  )}
                  {uploadedRoute.ecoPriority && uploadedRoute.ecoPriority !== 'DEFAULT' && (
                    <div style={styles.statBox}>
                      <span>Prioriteta</span>
                      <strong>{formatPriority(uploadedRoute.ecoPriority)}</strong>
                    </div>
                  )}
                </div>

                <p style={styles.text}>
                  Pot je zdaj shranjena v PostgreSQL in prikazana na Leaflet zemljevidu.
                </p>

                <Link to="/" style={styles.mapButton}>Prikaži pot na zemljevidu</Link>
              </div>
            </div>
          </section>
        )}
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
    maxWidth: '1120px', margin: '0 auto',
    padding: '32px 24px 22px'
  },
  eyebrow: {
    margin: 0, color: 'var(--brand)', textTransform: 'uppercase',
    letterSpacing: '0.1em', fontSize: '11px', fontWeight: 700
  },
  title: {
    margin: '4px 0 0', fontSize: '30px', lineHeight: 1.1,
    fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)'
  },
  subtitle: { marginTop: '8px', color: 'var(--text-muted)', fontSize: '15px' },
  container: {
    maxWidth: '1120px',
    margin: '0 auto', padding: '0 24px 44px', display: 'grid', gap: '20px'
  },
  profileBanner: {
    background: 'var(--brand-soft)', border: '1px solid var(--brand-soft-border)',
    borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: '13px', color: 'var(--brand-hover)'
  },
  profileBannerWarning: {
    background: 'var(--warning-soft)', border: '1px solid var(--warning-soft-border)',
    borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: '13px', color: 'var(--warning)'
  },
  profileLink: { color: 'inherit', marginLeft: '10px', fontWeight: 700, textDecoration: 'none' },
  profileLinkWarning: { color: 'inherit', marginLeft: '10px', fontWeight: 700, textDecoration: 'none' },
  heroCard: { ...card, borderRadius: 'var(--radius-lg)', padding: '24px' },
  resultCard: { ...card, borderRadius: 'var(--radius-lg)', padding: '24px' },
  sectionTitle: { margin: '4px 0 0', color: 'var(--text)', fontSize: '22px', fontWeight: 700, letterSpacing: '-0.01em' },
  text: { color: 'var(--text-muted)', lineHeight: 1.6, marginTop: '8px', fontSize: '14px' },
  dropZone: {
    marginTop: '20px', minHeight: '160px', border: '1px dashed var(--border-strong)',
    borderRadius: 'var(--radius-lg)', background: 'var(--surface-muted)', display: 'flex',
    flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: '6px', cursor: 'pointer', color: 'var(--text)'
  },
  hiddenInput: { display: 'none' },
  fileInfo: {
    marginTop: '16px', padding: '14px', borderRadius: 'var(--radius-md)',
    background: 'var(--surface-muted)', border: '1px solid var(--border)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px'
  },
  fileBadge: {
    padding: '5px 10px', borderRadius: '999px', background: 'var(--brand-soft)',
    border: '1px solid var(--brand-soft-border)', color: 'var(--brand-hover)', fontWeight: 700, fontSize: '12px'
  },
  uploadButton: {
    marginTop: '16px', minHeight: '46px', width: '100%', border: 'none',
    borderRadius: 'var(--radius-md)', background: 'var(--brand)',
    color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)'
  },
  status: {
    marginTop: '14px', padding: '12px 14px', borderRadius: 'var(--radius-md)',
    background: 'var(--brand-soft)', border: '1px solid var(--brand-soft-border)',
    color: 'var(--brand-hover)', fontWeight: 600
  },
  errorStatus: {
    marginTop: '14px', padding: '12px 14px', borderRadius: 'var(--radius-md)',
    background: 'var(--danger-soft)', border: '1px solid var(--danger-soft-border)',
    color: 'var(--danger)', fontWeight: 600
  },
  resultGrid: { marginTop: '20px', display: 'grid', gridTemplateColumns: '150px 1fr', gap: '24px', alignItems: 'center' },
  scoreCircle: {
    width: '128px', height: '128px', borderRadius: '50%', border: '4px solid var(--brand)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', background: 'var(--brand-soft)', color: 'var(--brand-hover)'
  },
  resultContent: { minWidth: 0 },
  routeName: { margin: 0, color: 'var(--text)', fontSize: '20px', wordBreak: 'break-word' },
  resultStats: { marginTop: '14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' },
  statBox: {
    background: 'var(--surface-muted)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px'
  },
  mapButton: {
    display: 'inline-flex', marginTop: '16px', padding: '10px 16px',
    background: 'var(--info)', color: '#fff',
    textDecoration: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700
  }
}

export default GpxUploadPage
