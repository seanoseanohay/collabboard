import { render, screen, waitFor } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('shows login page when unauthenticated', async () => {
    render(<App />)
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /collabboard/i })
      ).toBeInTheDocument()
    })
  })
})
