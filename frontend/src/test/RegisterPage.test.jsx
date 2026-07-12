import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RegisterPage from '../pages/RegisterPage'
import * as authService from '../services/authService'

vi.mock('../services/authService')

const renderRegisterPage = () =>
  render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>
  )

const fill = () => {
  fireEvent.change(screen.getByLabelText('Ime'), { target: { value: 'Ana' } })
  fireEvent.change(screen.getByLabelText('Priimek'), { target: { value: 'Novak' } })
  fireEvent.change(screen.getByLabelText('E-poštni naslov'), { target: { value: 'ana@test.com' } })
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders registration form', () => {
    renderRegisterPage()
    expect(screen.getByRole('heading', { name: 'EcoFlow' })).toBeInTheDocument()
    expect(screen.getByLabelText('Ime')).toBeInTheDocument()
    expect(screen.getByLabelText('Priimek')).toBeInTheDocument()
    expect(screen.getByLabelText('E-poštni naslov')).toBeInTheDocument()
    expect(screen.getByLabelText('Geslo')).toBeInTheDocument()
    expect(screen.getByLabelText('Potrdi geslo')).toBeInTheDocument()
  })

  it('shows error when passwords do not match', async () => {
    renderRegisterPage()
    fill()
    fireEvent.change(screen.getByLabelText('Geslo'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Potrdi geslo'), { target: { value: 'different456' } })
    fireEvent.submit(screen.getByRole('button', { name: /ustvari račun/i }).closest('form'))

    await waitFor(() => {
      expect(screen.getByText('Gesli se ne ujemata.')).toBeInTheDocument()
    })
  })

  it('shows error when password is too short', async () => {
    renderRegisterPage()
    fill()
    fireEvent.change(screen.getByLabelText('Geslo'), { target: { value: '123' } })
    fireEvent.change(screen.getByLabelText('Potrdi geslo'), { target: { value: '123' } })
    fireEvent.submit(screen.getByRole('button', { name: /ustvari račun/i }).closest('form'))

    await waitFor(() => {
      expect(screen.getByText('Geslo mora imeti vsaj 6 znakov.')).toBeInTheDocument()
    })
  })

  it('calls register with correct data', async () => {
    authService.register.mockResolvedValue({})

    renderRegisterPage()
    fill()
    fireEvent.change(screen.getByLabelText('Geslo'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Potrdi geslo'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /ustvari račun/i }))

    await waitFor(() => {
      expect(authService.register).toHaveBeenCalledWith('Ana', 'Novak', 'ana@test.com', 'password123')
    })
  })

  it('has link to login page', () => {
    renderRegisterPage()
    expect(screen.getByText('Prijava')).toBeInTheDocument()
  })
})