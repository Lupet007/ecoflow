import { useState } from 'react'
import { Link } from 'react-router-dom'

function GpxUploadPage() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadStatus, setUploadStatus] = useState('')
  const [recommendations, setRecommendations] = useState([])

  const handleFileChange = (event) => {
    const file = event.target.files[0]

    if (!file) return

    if (!file.name.toLowerCase().endsWith('.gpx')) {
      setUploadStatus('Please select a valid GPX file.')
      setSelectedFile(null)
      return
    }

    setSelectedFile(file)
    setUploadStatus('')
  }

  const handleUpload = () => {
    if (!selectedFile) {
      setUploadStatus('Please select a GPX file first.')
      return
    }

    setUploadStatus('GPX file uploaded successfully. Route analysis preview generated.')

    const mockRecommendations = [
      {
        title: 'Recommended walking conditions',
        ecoScore: 86,
        level: 'Good',
        description: 'The uploaded route is suitable for walking. Environmental conditions are acceptable for outdoor activity.'
      },
      {
        title: 'Air quality recommendation',
        ecoScore: 91,
        level: 'Very good',
        description: 'Air quality indicators suggest that this route is appropriate for recreation.'
      },
      {
        title: 'Route safety note',
        ecoScore: 78,
        level: 'Moderate',
        description: 'Some parts of the route should be checked again when real-time environmental data is available.'
      }
    ]

    setRecommendations(mockRecommendations)
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>EcoFlow GPX Route Analysis</h1>
          <p style={styles.subtitle}>
            Upload a GPX route file and preview environmental recommendations.
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
            Select a GPX file exported from a sport tracking application or GPS device.
            The route will later be analysed with environmental data and eco-score logic.
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

          <button onClick={handleUpload} style={styles.uploadButton}>
            Analyse route
          </button>

          {uploadStatus && (
            <p style={styles.status}>
              {uploadStatus}
            </p>
          )}
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Environmental recommendations</h2>

          {recommendations.length === 0 ? (
            <p style={styles.text}>
              Recommendations will be displayed after a GPX route is selected and analysed.
            </p>
          ) : (
            <div style={styles.recommendationGrid}>
              {recommendations.map((item, index) => (
                <div key={index} style={styles.recommendationCard}>
                  <h3 style={styles.recommendationTitle}>{item.title}</h3>

                  <div style={styles.scoreBox}>
                    Eco-score: {item.ecoScore}/100
                  </div>

                  <p style={styles.level}>
                    Level: {item.level}
                  </p>

                  <p style={styles.text}>
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
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
  recommendationGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '16px',
    marginTop: '16px',
  },
  recommendationCard: {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '12px',
    padding: '18px',
  },
  recommendationTitle: {
    marginTop: 0,
    color: '#f8fafc',
  },
  scoreBox: {
    background: '#10b981',
    color: '#fff',
    padding: '8px 12px',
    borderRadius: '8px',
    display: 'inline-block',
    fontWeight: '700',
    marginBottom: '10px',
  },
  level: {
    color: '#facc15',
    fontWeight: '600',
  },
}

export default GpxUploadPage