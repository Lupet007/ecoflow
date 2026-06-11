import { useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'

function GpxUploadPage() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadStatus, setUploadStatus] = useState('')
  const [uploadedRoute, setUploadedRoute] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleFileChange = (event) => {
    const file = event.target.files[0]

    if (!file) return

    if (!file.name.toLowerCase().endsWith('.gpx')) {
      setUploadStatus('Please select a valid GPX file.')
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
      setUploadStatus('Please select a GPX file first.')
      return
    }

    setLoading(true)
    setUploadStatus('Uploading and analysing GPX route...')
    setUploadedRoute(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

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
      setUploadStatus('GPX route uploaded and analysed successfully.')
    } catch (error) {
      console.error(error)
      setUploadStatus(error.response?.data || 'Failed to upload GPX route.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.glowOne} />
      <div style={styles.glowTwo} />

      <header style={styles.header} className="eco-gpx-header">
        <div>
          <p style={styles.eyebrow}>GPX route processing</p>
          <h1 style={styles.title}>Upload & analyse route</h1>
          <p style={styles.subtitle}>
            Import GPS tracks and calculate route eco-score using backend analysis.
          </p>
        </div>

        <Link to="/" style={styles.backButton}>
          ← Back to map
        </Link>
      </header>

      <main style={styles.container}>
        <section style={styles.heroCard}>
          <div>
            <p style={styles.eyebrow}>Route file</p>
            <h2 style={styles.sectionTitle}>Select GPX file</h2>
            <p style={styles.text}>
              Upload a GPX file exported from Strava, Komoot, Garmin, AllTrails or another GPS tracking app.
            </p>
          </div>

          <label style={styles.dropZone}>
            <input
              type="file"
              accept=".gpx"
              onChange={handleFileChange}
              style={styles.hiddenInput}
            />
            <div style={styles.dropIcon}>🗺️</div>
            <strong>Click to choose GPX file</strong>
            <span>Only .gpx route files are supported</span>
          </label>

          {selectedFile && (
            <div style={styles.fileInfo}>
              <div>
                <strong>{selectedFile.name}</strong>
                <p>{(selectedFile.size / 1024).toFixed(2)} KB</p>
              </div>
              <span style={styles.fileBadge}>Ready</span>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={loading}
            style={{
              ...styles.uploadButton,
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Analysing route...' : 'Upload and analyse route'}
          </button>

          {uploadStatus && (
            <p style={uploadStatus.includes('Failed') || uploadStatus.includes('valid') ? styles.errorStatus : styles.status}>
              {uploadStatus}
            </p>
          )}
        </section>

        {uploadedRoute && (
          <section style={styles.resultCard}>
            <div>
              <p style={styles.eyebrow}>Analysis complete</p>
              <h2 style={styles.sectionTitle}>Eco-score result</h2>
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
                    <span>Status</span>
                    <strong>{uploadedRoute.ecoScoreLabel}</strong>
                  </div>

                  <div style={styles.statBox}>
                    <span>Track points</span>
                    <strong>{uploadedRoute.pointCount}</strong>
                  </div>
                </div>

                <p style={styles.text}>
                  The route is now stored in PostgreSQL and can be displayed on the Leaflet map.
                </p>

                <Link to="/" style={styles.mapButton}>
                  View route on map
                </Link>
              </div>
            </div>
          </section>
        )}
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
    maxWidth: '1120px',
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
    maxWidth: '1120px',
    margin: '0 auto',
    padding: '0 24px 44px',
    display: 'grid',
    gap: '24px'
  },
  heroCard: {
    ...glassCard,
    borderRadius: '24px',
    padding: '28px'
  },
  resultCard: {
    ...glassCard,
    borderRadius: '24px',
    padding: '28px'
  },
  sectionTitle: {
    margin: '5px 0 0',
    color: '#f8fafc',
    fontSize: '28px',
    fontWeight: 850,
    letterSpacing: '-0.04em'
  },
  text: {
    color: '#cbd5e1',
    lineHeight: 1.65,
    marginTop: '10px'
  },
  dropZone: {
    marginTop: '22px',
    minHeight: '190px',
    border: '1px dashed rgba(134,239,172,0.48)',
    borderRadius: '22px',
    background: 'rgba(15,23,42,0.72)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    cursor: 'pointer',
    color: '#e5e7eb'
  },
  hiddenInput: {
    display: 'none'
  },
  dropIcon: {
    fontSize: '42px',
    marginBottom: '4px'
  },
  fileInfo: {
    marginTop: '18px',
    padding: '16px',
    borderRadius: '16px',
    background: 'rgba(15,23,42,0.78)',
    border: '1px solid rgba(148,163,184,0.18)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '14px'
  },
  fileBadge: {
    padding: '6px 10px',
    borderRadius: '999px',
    background: 'rgba(34,197,94,0.16)',
    border: '1px solid rgba(34,197,94,0.35)',
    color: '#86efac',
    fontWeight: 900,
    fontSize: '12px'
  },
  uploadButton: {
    marginTop: '18px',
    minHeight: '50px',
    width: '100%',
    border: 'none',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #10b981, #22c55e)',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow: '0 18px 40px rgba(34,197,94,0.22)'
  },
  status: {
    marginTop: '14px',
    padding: '12px 14px',
    borderRadius: '14px',
    background: 'rgba(34,197,94,0.12)',
    border: '1px solid rgba(34,197,94,0.32)',
    color: '#bbf7d0',
    fontWeight: 800
  },
  errorStatus: {
    marginTop: '14px',
    padding: '12px 14px',
    borderRadius: '14px',
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.32)',
    color: '#fecaca',
    fontWeight: 800
  },
  resultGrid: {
    marginTop: '22px',
    display: 'grid',
    gridTemplateColumns: '150px 1fr',
    gap: '24px',
    alignItems: 'center'
  },
  scoreCircle: {
    width: '140px',
    height: '140px',
    borderRadius: '50%',
    border: '7px solid #22c55e',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(34,197,94,0.08)'
  },
  resultContent: {
    minWidth: 0
  },
  routeName: {
    margin: 0,
    color: '#f8fafc',
    fontSize: '24px',
    wordBreak: 'break-word'
  },
  resultStats: {
    marginTop: '16px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '12px'
  },
  statBox: {
    background: 'rgba(15,23,42,0.78)',
    border: '1px solid rgba(148,163,184,0.18)',
    borderRadius: '16px',
    padding: '14px'
  },
  mapButton: {
    display: 'inline-flex',
    marginTop: '18px',
    padding: '11px 16px',
    background: 'linear-gradient(135deg, #3b82f6, #38bdf8)',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: '12px',
    fontWeight: 900
  }
}

export default GpxUploadPage