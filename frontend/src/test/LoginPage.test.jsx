import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LoginPage from '../pages/LoginPage'
import * as authService from '../services/authService'

vi.mock('../services/authService')

const renderLoginPage = () =>
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  )

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders login form', () => {
    renderLoginPage()
    expect(screen.getByText('EcoFlow')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows error when login fails', async () => {
    authService.login.mockRejectedValue({
      response: { data: { message: 'Invalid credentials' } }
    })

    renderLoginPage()

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'wrong@test.com' }
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrongpass' }
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })

  it('calls login with correct credentials', async () => {
    authService.login.mockResolvedValue({})

    renderLoginPage()

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'test@test.com' }
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' }
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith('test@test.com', 'password123')
    })
  })

  it('has link to register page', () => {
    renderLoginPage()
    expect(screen.getByText('Ustvari ga')).toBeInTheDocument()
  })
})
