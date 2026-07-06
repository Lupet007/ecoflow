function AppFooter() {
  return (
    <footer style={styles.footer}>
      <div style={styles.inner}>
        <span style={styles.brand}>EcoFlow</span>
        <span style={styles.text}>
          Diplomski projekt — Fakulteta za elektrotehniko, računalništvo in informatiko, Univerza v Mariboru
        </span>
        <span style={styles.text}>© {new Date().getFullYear()} EcoFlow</span>
      </div>
    </footer>
  )
}

const styles = {
  footer: {
    borderTop: '1px solid var(--border)',
    background: 'var(--surface)',
    marginTop: '32px'
  },
  inner: {
    maxWidth: '1240px',
    margin: '0 auto',
    padding: '20px 28px',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '8px 16px'
  },
  brand: {
    color: 'var(--text)',
    fontWeight: 800,
    fontSize: '14px'
  },
  text: {
    color: 'var(--text-faint)',
    fontSize: '13px'
  }
}

export default AppFooter
