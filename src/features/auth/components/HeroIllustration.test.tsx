import { render, screen } from '@testing-library/react'
import { HeroIllustration } from './HeroIllustration'

describe('HeroIllustration', () => {
  it('renders an accessible SVG illustration', () => {
    render(<HeroIllustration />)
    const svg = screen.getByRole('img', { name: /ship.*wheel/i })
    expect(svg).toBeInTheDocument()
  })
})
