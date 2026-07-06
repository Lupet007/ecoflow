import { Link, useLocation } from 'react-router-dom'
import { logout } from '../services/authService'

const NAV_LINKS = [
  { to: '/', label: 'Zemljevid' },
  { to: '/gpx-upload', label: 'Naloži GPX' },
  { to: '/dashboard', label: 'Nadzorna plošča' },
  { to: '/profile', label: 'Eko profil' },
  { to: '/recommendations', label: 'Priporočila' }
]

function AppHeader() {
  const location = useLocation()

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  }

  return (
    <header style={styles.header} className="eco-app-header">
      <Link to="/" style={styles.brand}>
        <span style={styles.logoBadge}>EF</span>
        <span style={styles.brandName}>EcoFlow</span>
      </Link>

      <nav style={styles.nav} className="eco-app-header-nav">
        {NAV_LINKS.map(link => (
          <Link
            key={link.to}
            to={link.to}
            style={location.pathname === link.to ? styles.navLinkActive : styles.navLink}
          >
            {link.label}
          </Link>
        ))}

        <button onClick={handleLogout} style={styles.signOutButton}>
          Odjava
        </button>
      </nav>
    </header>
  )
}

const styles = {
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 900,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '14px 28px',
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    boxShadow: 'var(--shadow-sm)'
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    textDecoration: 'none'
  },
  logoBadge: {
    width: '34px',
    height: '34px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--brand)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: 800
  },
  brandName: {
    color: 'var(--text)',
    fontSize: '18px',
    fontWeight: 800,
    letterSpacing: '-0.02em'
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap'
  },
  navLink: {
    padding: '8px 12px',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-muted)',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 600
  },
  navLinkActive: {
    padding: '8px 12px',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--brand-hover)',
    background: 'var(--brand-soft)',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 700
  },
  signOutButton: {
    marginLeft: '6px',
    padding: '8px 14px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    color: 'var(--danger)',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: 'var(--font)'
  }
}

export default AppHeader
