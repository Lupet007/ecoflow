import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login } from '../services/authService'
import AppFooter from '../components/AppFooter'

function LoginPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await login(formData.email, formData.password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Prijava ni uspela. Preveri svoje podatke za prijavo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.centerArea}>
        <div style={styles.card}>
          <div style={styles.logo}>
            <div style={styles.logoIcon}>EF</div>
            <div>
              <h1 style={styles.logoText}>EcoFlow</h1>
              <p style={styles.logoSub}>Pametno okoljsko načrtovanje poti</p>
            </div>
          </div>

          <h2 style={styles.title}>Dobrodošli nazaj</h2>
          <p style={styles.subtitle}>Prijavi se za nadaljevanje v svoj EcoFlow prostor.</p>

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label} htmlFor="email">E-poštni naslov</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="ti@primer.com"
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label} htmlFor="password">Geslo</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                style={styles.input}
              />
            </div>

            {error && <p style={styles.error}>{error}</p>}

            <button type="submit" disabled={loading} style={styles.button}>
              {loading ? 'Prijavljanje ...' : 'Prijava'}
            </button>
          </form>

          <p style={styles.footer}>
            Nimaš računa?{' '}
            <Link to="/register" style={styles.link}>Ustvari ga</Link>
          </p>
        </div>
      </div>

      <AppFooter />
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg)',
    fontFamily: 'var(--font)'
  },
  centerArea: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px'
  },
  card: {
    width: '100%',
    maxWidth: '440px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '36px',
    boxShadow: 'var(--shadow-lg)'
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    marginBottom: '26px'
  },
  logoIcon: {
    width: '48px',
    height: '48px',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--brand)',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 800
  },
  logoText: {
    margin: 0,
    color: 'var(--text)',
    fontSize: '24px',
    fontWeight: 800,
    letterSpacing: '-0.02em'
  },
  logoSub: {
    margin: '3px 0 0',
    color: 'var(--text-muted)',
    fontSize: '13px'
  },
  title: {
    margin: 0,
    color: 'var(--text)',
    fontSize: '24px',
    fontWeight: 700
  },
  subtitle: {
    margin: '8px 0 26px',
    color: 'var(--text-muted)',
    fontSize: '14px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  label: {
    color: 'var(--text-muted)',
    fontSize: '13px',
    fontWeight: 600
  },
  input: {
    minHeight: '44px',
    padding: '10px 14px',
    borderRadius: 'var(--radius-md)',
    fontSize: '14px'
  },
  error: {
    margin: 0,
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--danger-soft)',
    border: '1px solid var(--danger-soft-border)',
    color: 'var(--danger)',
    fontSize: '13px'
  },
  button: {
    minHeight: '46px',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    background: 'var(--brand)',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'var(--font)'
  },
  footer: {
    marginTop: '20px',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '14px'
  },
  link: {
    color: 'var(--brand)',
    textDecoration: 'none',
    fontWeight: 700
  }
}

export default LoginPage
