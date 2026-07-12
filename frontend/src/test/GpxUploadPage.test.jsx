import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import GpxUploadPage from '../pages/GpxUploadPage'
import axios from 'axios'

vi.mock('axios')

const renderGpxUploadPage = () =>
  render(
    <MemoryRouter>
      <GpxUploadPage />
    </MemoryRouter>
  )

const fileInput = () =>
  screen.getByRole('button', { name: /naloži in analiziraj/i })
    .closest('main')
    .querySelector('input[type="file"]')

describe('GpxUploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
  })

  it('renders upload form', () => {
    renderGpxUploadPage()
    expect(screen.getByText('Izberi GPX datoteko')).toBeInTheDocument()
    expect(screen.getByText('Klikni za izbiro GPX datoteke')).toBeInTheDocument()
  })

  it('shows error when non-GPX file is selected', () => {
    renderGpxUploadPage()
    const file = new File(['content'], 'route.txt', { type: 'text/plain' })
    fireEvent.change(fileInput(), { target: { files: [file] } })
    expect(screen.getByText('Prosimo, izberi veljavno GPX datoteko.')).toBeInTheDocument()
  })

  it('shows error when upload button clicked without file', async () => {
    renderGpxUploadPage()
    fireEvent.click(screen.getByRole('button', { name: /naloži in analiziraj/i }))
    await waitFor(() => {
      expect(screen.getByText('Najprej izberi GPX datoteko.')).toBeInTheDocument()
    })
  })

  it('shows eco-score result after successful upload', async () => {
    axios.post.mockResolvedValue({
      data: { name: 'test_route.gpx', ecoScore: 85, ecoScoreLabel: 'Odlično', pointCount: 10 }
    })

    renderGpxUploadPage()
    const file = new File(['<gpx></gpx>'], 'test_route.gpx', { type: 'application/gpx+xml' })
    fireEvent.change(fileInput(), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: /naloži in analiziraj/i }))

    await waitFor(() => {
      expect(screen.getByText('Rezultat eko-ocene')).toBeInTheDocument()
      expect(screen.getByText('85')).toBeInTheDocument()
      expect(screen.getByText('Odlično')).toBeInTheDocument()
    })
  })

  it('shows error message when upload fails', async () => {
    axios.post.mockRejectedValue({ response: { data: 'Failed to process GPX file.' } })

    renderGpxUploadPage()
    const file = new File(['<gpx></gpx>'], 'test_route.gpx', { type: 'application/gpx+xml' })
    fireEvent.change(fileInput(), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: /naloži in analiziraj/i }))

    await waitFor(() => {
      // data je navaden string (ne {error}), zato komponenta pokaže svoj fallback:
      expect(screen.getByText('Nalaganje GPX poti ni uspelo.')).toBeInTheDocument()
    })
  })
})