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

describe('GpxUploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
  })

  it('renders upload form', () => {
    renderGpxUploadPage()
    expect(screen.getByText('EcoFlow GPX Route Upload')).toBeInTheDocument()
    expect(screen.getByText(/upload and analyse route/i)).toBeInTheDocument()
    expect(screen.getByText('Back to map')).toBeInTheDocument()
  })

  it('shows error when non-GPX file is selected', () => {
    renderGpxUploadPage()

    const file = new File(['content'], 'route.txt', { type: 'text/plain' })
    const input = screen.getByRole('button', { name: /upload and analyse/i }).closest('main').querySelector('input[type="file"]')

    fireEvent.change(input, { target: { files: [file] } })

    expect(screen.getByText('Please select a valid GPX file.')).toBeInTheDocument()
  })

  it('shows error when upload button clicked without file', async () => {
    renderGpxUploadPage()

    fireEvent.click(screen.getByRole('button', { name: /upload and analyse/i }))

    await waitFor(() => {
      expect(screen.getByText('Please select a GPX file first.')).toBeInTheDocument()
    })
  })

  it('shows eco-score result after successful upload', async () => {
    axios.post.mockResolvedValue({
      data: {
        name: 'test_route.gpx',
        ecoScore: 85,
        ecoScoreLabel: 'Excellent',
        pointCount: 10
      }
    })

    renderGpxUploadPage()

    const file = new File(['<gpx></gpx>'], 'test_route.gpx', { type: 'application/gpx+xml' })
    const input = screen.getByRole('button', { name: /upload and analyse/i }).closest('main').querySelector('input[type="file"]')

    fireEvent.change(input, { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: /upload and analyse/i }))

    await waitFor(() => {
      expect(screen.getByText('Eco-score result')).toBeInTheDocument()
      expect(screen.getByText(/85\/100/)).toBeInTheDocument()
      expect(screen.getByText('Excellent')).toBeInTheDocument()
    })
  })

  it('shows error message when upload fails', async () => {
    axios.post.mockRejectedValue({
      response: { data: 'Failed to process GPX file.' }
    })

    renderGpxUploadPage()

    const file = new File(['<gpx></gpx>'], 'test_route.gpx', { type: 'application/gpx+xml' })
    const input = screen.getByRole('button', { name: /upload and analyse/i }).closest('main').querySelector('input[type="file"]')

    fireEvent.change(input, { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: /upload and analyse/i }))

    await waitFor(() => {
      expect(screen.getByText('Failed to process GPX file.')).toBeInTheDocument()
    })
  })
})
