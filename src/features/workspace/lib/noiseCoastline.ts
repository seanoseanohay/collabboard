/**
 * Procedural coastline generator.
 * Produces an irregular polygon that looks like a natural landmass by casting
 * rays from a center point and varying each ray's length with layered noise.
 */

/**
 * Generates an irregular polygon simulating a landmass coastline.
 * Uses radial distortion: casts rays at equal angles from the ellipse center,
 * each ray's length is modulated by layered 1-D value noise (FBM).
 *
 * @param cx - center x in scene units
 * @param cy - center y in scene units
 * @param baseRx - base horizontal radius
 * @param baseRy - base vertical radius
 * @param rng - seeded random function returning values in [0, 1)
 * @param vertexCount - number of polygon vertices (60–120 recommended)
 */
export function generateCoastline(
  cx: number,
  cy: number,
  baseRx: number,
  baseRy: number,
  rng: () => number,
  vertexCount = 80,
): Array<{ x: number; y: number }> {
  // Build a per-coastline noise table so each landmass has a unique shape
  const noiseTable = Array.from({ length: 256 }, () => rng() * 2 - 1)

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  const smoothstep = (t: number) => t * t * (3 - 2 * t)

  // 1-D value noise
  const noise = (t: number): number => {
    const i = Math.floor(t) & 255
    const f = t - Math.floor(t)
    return lerp(noiseTable[i]!, noiseTable[(i + 1) & 255]!, smoothstep(f))
  }

  // Fractional Brownian Motion — 3 octaves for a natural, multi-scale coastline
  const fbm = (t: number): number =>
    noise(t * 2) * 0.5 + noise(t * 4) * 0.25 + noise(t * 8) * 0.125

  // Each continent gets a unique phase offset so rng sequences don't repeat
  const phase = rng() * 10

  const points: Array<{ x: number; y: number }> = []
  for (let i = 0; i < vertexCount; i++) {
    const angle = (i / vertexCount) * Math.PI * 2
    const noiseVal = fbm(i * 1.7 + phase)
    // Radius varies between ~40% and ~110% of base radius for craggy look
    const radiusScale = 0.75 + noiseVal * 0.65
    points.push({
      x: cx + baseRx * radiusScale * Math.cos(angle),
      y: cy + baseRy * radiusScale * Math.sin(angle),
    })
  }

  return points
}
