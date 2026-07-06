import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register } from '../services/authService'
import AppFooter from '../components/AppFooter'

function RegisterPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Gesli se ne ujemata.')
      return
    }

    if (formData.password.length < 6) {
      setError('Geslo mora imeti vsaj 6 znakov.')
      return
    }

    setLoading(true)

    try {
      await register(formData.firstName, formData.lastName, formData.email, formData.password)
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Registracija ni uspela. Poskusi znova.')
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
              <p style={styles.logoSub}>Ustvari svoj okoljski račun</p>
            </div>
          </div>

          <h2 style={styles.title}>Ustvari račun</h2>
          <p style={styles.subtitle}>Pridruži se platformi EcoFlow za priporočila poti.</p>

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.row} className="eco-name-row">
              <div style={styles.field}>
                <label style={styles.label} htmlFor="firstName">Ime</label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="Ana"
                  style={styles.input}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label} htmlFor="lastName">Priimek</label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Novak"
                  style={styles.input}
                />
              </div>
            </div>

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
                placeholder="Vsaj 6 znakov"
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label} htmlFor="confirmPassword">Potrdi geslo</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                style={styles.input}
              />
            </div>

            {error && <p style={styles.error}>{error}</p>}

            <button type="submit" disabled={loading} style={styles.button}>
              {loading ? 'Ustvarjanje računa ...' : 'Ustvari račun'}
            </button>
          </form>

          <p style={styles.footer}>
            Že imaš račun?{' '}
            <Link to="/login" style={styles.link}>Prijava</Link>
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
    maxWidth: '480px',
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
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '14px'
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
    fontSize: '14px',
    width: '100%'
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

export default RegisterPage
