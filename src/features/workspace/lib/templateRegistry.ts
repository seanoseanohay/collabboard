/**
 * Client-side template registry for AI-generated canvas templates.
 * Each template spec defines the frame dimensions and all child objects
 * as offsets (relLeft, relTop) from the frame's top-left corner.
 * No AI, no I/O — pure data.
 */

export interface TemplateObjectSpec {
  type: 'rect' | 'text' | 'sticky'
  relLeft: number
  relTop: number
  width: number
  height: number
  fill?: string
  stroke?: string
  strokeWeight?: number
  text?: string
  fontSize?: number
}

export interface TemplateSpec {
  id: string
  frameTitle: string
  frameWidth: number
  frameHeight: number
  objects: TemplateObjectSpec[]
}

// ─── Pros & Cons ──────────────────────────────────────────────────────────────

const PROS_CONS: TemplateSpec = {
  id: 'pros-cons',
  frameTitle: 'Pros & Cons',
  frameWidth: 540,
  frameHeight: 460,
  objects: [
    // Section header labels
    { type: 'text', relLeft: 20, relTop: 52, width: 240, height: 40,
      text: 'Pros', fill: '#166534', fontSize: 16 },
    { type: 'text', relLeft: 280, relTop: 52, width: 240, height: 40,
      text: 'Cons', fill: '#991b1b', fontSize: 16 },
    // Section background rects
    { type: 'rect', relLeft: 20, relTop: 100, width: 240, height: 340,
      fill: '#f0fdf4', stroke: '#16a34a', strokeWeight: 2 },
    { type: 'rect', relLeft: 280, relTop: 100, width: 240, height: 340,
      fill: '#fef2f2', stroke: '#dc2626', strokeWeight: 2 },
    // Sticky note fields (3 per column)
    { type: 'sticky', relLeft: 30, relTop: 110, width: 220, height: 90,
      fill: '#dcfce7', text: '' },
    { type: 'sticky', relLeft: 30, relTop: 220, width: 220, height: 90,
      fill: '#dcfce7', text: '' },
    { type: 'sticky', relLeft: 30, relTop: 330, width: 220, height: 90,
      fill: '#dcfce7', text: '' },
    { type: 'sticky', relLeft: 290, relTop: 110, width: 220, height: 90,
      fill: '#fee2e2', text: '' },
    { type: 'sticky', relLeft: 290, relTop: 220, width: 220, height: 90,
      fill: '#fee2e2', text: '' },
    { type: 'sticky', relLeft: 290, relTop: 330, width: 220, height: 90,
      fill: '#fee2e2', text: '' },
  ],
}

// ─── SWOT Analysis ────────────────────────────────────────────────────────────

const SWOT: TemplateSpec = {
  id: 'swot',
  frameTitle: 'SWOT Analysis',
  frameWidth: 560,
  frameHeight: 500,
  objects: [
    // Section background rects (2×2 grid)
    { type: 'rect', relLeft: 20, relTop: 52, width: 240, height: 210,
      fill: '#dcfce7', stroke: '#16a34a', strokeWeight: 2 },
    { type: 'rect', relLeft: 300, relTop: 52, width: 240, height: 210,
      fill: '#fee2e2', stroke: '#dc2626', strokeWeight: 2 },
    { type: 'rect', relLeft: 20, relTop: 278, width: 240, height: 210,
      fill: '#dbeafe', stroke: '#2563eb', strokeWeight: 2 },
    { type: 'rect', relLeft: 300, relTop: 278, width: 240, height: 210,
      fill: '#fef9c3', stroke: '#ca8a04', strokeWeight: 2 },
    // Editable section header labels
    { type: 'text', relLeft: 30, relTop: 60, width: 220, height: 28,
      text: 'Strengths', fill: '#166534', fontSize: 14 },
    { type: 'text', relLeft: 310, relTop: 60, width: 220, height: 28,
      text: 'Weaknesses', fill: '#991b1b', fontSize: 14 },
    { type: 'text', relLeft: 30, relTop: 286, width: 220, height: 28,
      text: 'Opportunities', fill: '#1d4ed8', fontSize: 14 },
    { type: 'text', relLeft: 310, relTop: 286, width: 220, height: 28,
      text: 'Threats', fill: '#92400e', fontSize: 14 },
    // Sticky note fields (one per quadrant)
    { type: 'sticky', relLeft: 30, relTop: 96, width: 220, height: 156,
      fill: '#f0fdf4', text: '' },
    { type: 'sticky', relLeft: 310, relTop: 96, width: 220, height: 156,
      fill: '#fef2f2', text: '' },
    { type: 'sticky', relLeft: 30, relTop: 316, width: 220, height: 162,
      fill: '#eff6ff', text: '' },
    { type: 'sticky', relLeft: 310, relTop: 316, width: 220, height: 162,
      fill: '#fefce8', text: '' },
  ],
}

// ─── User Journey ─────────────────────────────────────────────────────────────

const USER_JOURNEY: TemplateSpec = {
  id: 'user-journey',
  frameTitle: 'User Journey',
  frameWidth: 980,
  frameHeight: 380,
  objects: [
    // Stage header stickies (horizontal row)
    { type: 'sticky', relLeft: 20, relTop: 52, width: 170, height: 44,
      fill: '#dbeafe', stroke: '#2563eb', strokeWeight: 2, text: 'Awareness' },
    { type: 'sticky', relLeft: 210, relTop: 52, width: 170, height: 44,
      fill: '#dbeafe', stroke: '#2563eb', strokeWeight: 2, text: 'Consideration' },
    { type: 'sticky', relLeft: 400, relTop: 52, width: 170, height: 44,
      fill: '#dbeafe', stroke: '#2563eb', strokeWeight: 2, text: 'Decision' },
    { type: 'sticky', relLeft: 590, relTop: 52, width: 170, height: 44,
      fill: '#dbeafe', stroke: '#2563eb', strokeWeight: 2, text: 'Retention' },
    { type: 'sticky', relLeft: 780, relTop: 52, width: 170, height: 44,
      fill: '#dbeafe', stroke: '#2563eb', strokeWeight: 2, text: 'Advocacy' },
    // Body sticky note fields
    { type: 'sticky', relLeft: 20, relTop: 110, width: 170, height: 250,
      fill: '#f8fafc', text: 'How do users discover us?' },
    { type: 'sticky', relLeft: 210, relTop: 110, width: 170, height: 250,
      fill: '#f8fafc', text: 'What influences their decision?' },
    { type: 'sticky', relLeft: 400, relTop: 110, width: 170, height: 250,
      fill: '#f8fafc', text: 'What drives conversion?' },
    { type: 'sticky', relLeft: 590, relTop: 110, width: 170, height: 250,
      fill: '#f8fafc', text: 'How do we keep them engaged?' },
    { type: 'sticky', relLeft: 780, relTop: 110, width: 170, height: 250,
      fill: '#f8fafc', text: 'How do they spread the word?' },
  ],
}

// ─── Retrospective ────────────────────────────────────────────────────────────

const RETROSPECTIVE: TemplateSpec = {
  id: 'retrospective',
  frameTitle: 'Retrospective',
  frameWidth: 740,
  frameHeight: 460,
  objects: [
    // Column header stickies
    { type: 'sticky', relLeft: 20, relTop: 52, width: 220, height: 44,
      fill: '#dcfce7', stroke: '#16a34a', strokeWeight: 2, text: 'What Went Well' },
    { type: 'sticky', relLeft: 260, relTop: 52, width: 220, height: 44,
      fill: '#fee2e2', stroke: '#dc2626', strokeWeight: 2, text: "What Didn't" },
    { type: 'sticky', relLeft: 500, relTop: 52, width: 220, height: 44,
      fill: '#dbeafe', stroke: '#2563eb', strokeWeight: 2, text: 'Action Items' },
    // Body sticky note fields
    { type: 'sticky', relLeft: 20, relTop: 110, width: 220, height: 340,
      fill: '#f0fdf4', text: '' },
    { type: 'sticky', relLeft: 260, relTop: 110, width: 220, height: 340,
      fill: '#fef2f2', text: '' },
    { type: 'sticky', relLeft: 500, relTop: 110, width: 220, height: 340,
      fill: '#eff6ff', text: '' },
  ],
}

export const TEMPLATE_REGISTRY: Record<string, TemplateSpec> = {
  'pros-cons': PROS_CONS,
  swot: SWOT,
  'user-journey': USER_JOURNEY,
  retrospective: RETROSPECTIVE,
}
