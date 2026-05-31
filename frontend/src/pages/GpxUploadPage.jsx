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
      setUploadStatus(
        error.response?.data ||
        'Failed to upload GPX route.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>EcoFlow GPX Route Upload</h1>
          <p style={styles.subtitle}>
            Upload a GPX route file and analyse it with backend eco-score logic.
          </p>
        </div>

        <Link to="/" style={styles.backButton}>
          Back to map
        </Link>
      </header>

      <main style={styles.container}>
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Upload GPX route</h2>

          <p style={styles.text}>
            Select a GPX file exported from Strava, Komoot, Garmin, AllTrails or another GPS tracking app.
          </p>

          <input
            type="file"
            accept=".gpx"
            onChange={handleFileChange}
            style={styles.fileInput}
          />

          {selectedFile && (
            <div style={styles.fileInfo}>
              <strong>Selected file:</strong> {selectedFile.name}
              <br />
              <strong>File size:</strong> {(selectedFile.size / 1024).toFixed(2)} KB
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={loading}
            style={styles.uploadButton}
          >
            {loading ? 'Analysing...' : 'Upload and analyse route'}
          </button>

          {uploadStatus && (
            <p style={styles.status}>
              {uploadStatus}
            </p>
          )}
        </section>

        {uploadedRoute && (
          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>Eco-score result</h2>

            <div style={styles.resultBox}>
              <h3>{uploadedRoute.name}</h3>

              <div style={styles.scoreBox}>
                Eco-score: {uploadedRoute.ecoScore}/100
              </div>

              <p>
                <strong>Status:</strong> {uploadedRoute.ecoScoreLabel}
              </p>

              <p>
                <strong>Track points:</strong> {uploadedRoute.pointCount}
              </p>

              <p style={styles.text}>
                The route is now stored in PostgreSQL and can be displayed on the Leaflet map.
              </p>

              <Link to="/" style={styles.mapButton}>
                View route on map
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0f172a',
    color: '#e5e7eb',
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '28px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    margin: 0,
    fontSize: '32px',
    color: '#f8fafc',
  },
  subtitle: {
    marginTop: '8px',
    color: '#94a3b8',
  },
  backButton: {
    padding: '10px 16px',
    background: '#334155',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: '8px',
    fontWeight: '600',
  },
  container: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '0 24px 32px',
    display: 'grid',
    gap: '24px',
  },
  card: {
    background: '#1e293b',
    borderRadius: '14px',
    padding: '24px',
    border: '1px solid #334155',
  },
  sectionTitle: {
    marginTop: 0,
    color: '#f8fafc',
  },
  text: {
    color: '#cbd5e1',
    lineHeight: 1.6,
  },
  fileInput: {
    marginTop: '14px',
    marginBottom: '16px',
    padding: '12px',
    background: '#0f172a',
    color: '#e5e7eb',
    border: '1px solid #475569',
    borderRadius: '8px',
    width: '100%',
  },
  fileInfo: {
    background: '#0f172a',
    padding: '14px',
    borderRadius: '8px',
    marginBottom: '16px',
    color: '#cbd5e1',
  },
  uploadButton: {
    padding: '12px 18px',
    background: '#10b981',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '700',
  },
  status: {
    marginTop: '14px',
    color: '#86efac',
    fontWeight: '600',
  },
  resultBox: {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '12px',
    padding: '20px',
  },
  scoreBox: {
    background: '#10b981',
    color: '#fff',
    padding: '10px 14px',
    borderRadius: '8px',
    display: 'inline-block',
    fontWeight: '700',
    marginBottom: '12px',
  },
  mapButton: {
    display: 'inline-block',
    marginTop: '12px',
    padding: '10px 16px',
    background: '#3b82f6',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: '8px',
    fontWeight: '700',
  },
}

export default GpxUploadPage