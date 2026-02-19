import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

describe('App', () => {
  it('shows login page when unauthenticated', async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /meboard/i, level: 1 })
      ).toBeInTheDocument()
    })
  })
})
