import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register } from '../services/authService'

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
      setError('Passwords do not match.')
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)

    try {
      await register(formData.firstName, formData.lastName, formData.email, formData.password)
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.glowOne} />
      <div style={styles.glowTwo} />

      <div style={styles.card}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>🌿</div>
          <div>
            <h1 style={styles.logoText}>EcoFlow</h1>
            <p style={styles.logoSub}>Create your environmental account</p>
          </div>
        </div>

        <h2 style={styles.title}>Create account</h2>
        <p style={styles.subtitle}>Join the EcoFlow route recommendation platform.</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label} htmlFor="firstName">First name</label>
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
              <label style={styles.label} htmlFor="lastName">Last name</label>
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
            <label style={styles.label} htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={formData.password}
              onChange={handleChange}
              placeholder="Min. 6 characters"
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="confirmPassword">Confirm password</label>
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
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p style={styles.footer}>
          Already have an account?{' '}
          <Link to="/login" style={styles.link}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background:
      'radial-gradient(circle at 20% 10%, rgba(34,197,94,0.18), transparent 30%), radial-gradient(circle at 80% 20%, rgba(168,85,247,0.14), transparent 28%), linear-gradient(135deg, #020617, #0f172a)'
  },
  glowOne: {
    position: 'fixed',
    width: '360px',
    height: '360px',
    borderRadius: '50%',
    background: 'rgba(34,197,94,0.16)',
    filter: 'blur(90px)',
    top: '-100px',
    left: '-100px'
  },
  glowTwo: {
    position: 'fixed',
    width: '360px',
    height: '360px',
    borderRadius: '50%',
    background: 'rgba(168,85,247,0.14)',
    filter: 'blur(90px)',
    right: '-100px',
    bottom: '-100px'
  },
  card: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: '520px',
    background: 'linear-gradient(180deg, rgba(30,41,59,0.95), rgba(15,23,42,0.96))',
    border: '1px solid rgba(148,163,184,0.22)',
    borderRadius: '24px',
    padding: '42px',
    boxShadow: '0 30px 100px rgba(0,0,0,0.45)',
    backdropFilter: 'blur(16px)'
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    marginBottom: '28px'
  },
  logoIcon: {
    width: '54px',
    height: '54px',
    borderRadius: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, rgba(34,197,94,0.28), rgba(168,85,247,0.18))',
    border: '1px solid rgba(134,239,172,0.35)',
    fontSize: '28px'
  },
  logoText: {
    margin: 0,
    color: '#f8fafc',
    fontSize: '30px',
    fontWeight: 900,
    letterSpacing: '-0.05em'
  },
  logoSub: {
    margin: '3px 0 0',
    color: '#93c5fd',
    fontSize: '13px'
  },
  title: {
    margin: 0,
    color: '#f8fafc',
    fontSize: '28px',
    fontWeight: 850
  },
  subtitle: {
    margin: '8px 0 28px',
    color: '#94a3b8',
    fontSize: '15px'
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
    gap: '7px'
  },
  label: {
    color: '#e2e8f0',
    fontSize: '13px',
    fontWeight: 800
  },
  input: {
    minHeight: '48px',
    padding: '12px 14px',
    borderRadius: '14px',
    border: '1px solid rgba(148,163,184,0.28)',
    background: '#0f172a',
    color: '#f8fafc',
    fontSize: '15px',
    width: '100%'
  },
  error: {
    margin: 0,
    padding: '10px 12px',
    borderRadius: '12px',
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.35)',
    color: '#fecaca',
    fontSize: '14px'
  },
  button: {
    minHeight: '50px',
    border: 'none',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #10b981, #22c55e)',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow: '0 18px 40px rgba(34,197,94,0.22)'
  },
  footer: {
    marginTop: '22px',
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '14px'
  },
  link: {
    color: '#86efac',
    textDecoration: 'none',
    fontWeight: 900
  }
}

export default RegisterPage