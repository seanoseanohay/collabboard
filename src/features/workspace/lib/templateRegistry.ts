/**
 * Client-side template registry for AI-generated canvas templates.
 * Each template spec defines the frame dimensions and all child objects
 * as offsets (relLeft, relTop) from the frame's top-left corner.
 * No AI, no I/O — pure data.
 */

export interface TemplateObjectSpec {
  type: 'rect' | 'text' | 'sticky' | 'input-field' | 'button' | 'table'
  relLeft: number
  relTop: number
  width: number
  height: number
  fill?: string
  stroke?: string
  strokeWeight?: number
  text?: string
  fontSize?: number
  // Table-only fields:
  showTitle?: boolean
  accentColor?: string
  formSchema?: {
    columns: Array<{ id: string; name: string; type: 'text' | 'number' | 'dropdown' | 'checkbox' | 'date'; headerColor?: string }>
    rows: Array<{ id: string; values: Record<string, string | number | boolean> }>
  }
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
  frameHeight: 520,
  objects: [
    // Center divider
    { type: 'rect', relLeft: 267, relTop: 52, width: 6, height: 460,
      fill: '#e2e8f0' },
    // Column headers
    { type: 'sticky', relLeft: 20, relTop: 52, width: 237, height: 50,
      fill: '#dcfce7', stroke: '#16a34a', strokeWeight: 2, text: 'Pros ✓', fontSize: 15 },
    { type: 'sticky', relLeft: 283, relTop: 52, width: 237, height: 50,
      fill: '#fee2e2', stroke: '#dc2626', strokeWeight: 2, text: 'Cons ✗', fontSize: 15 },
    // 4 blank rows — pros (left)
    { type: 'sticky', relLeft: 20, relTop: 114, width: 237, height: 86, fill: '#f0fdf4', text: '' },
    { type: 'sticky', relLeft: 20, relTop: 210, width: 237, height: 86, fill: '#f0fdf4', text: '' },
    { type: 'sticky', relLeft: 20, relTop: 306, width: 237, height: 86, fill: '#f0fdf4', text: '' },
    { type: 'sticky', relLeft: 20, relTop: 402, width: 237, height: 86, fill: '#f0fdf4', text: '' },
    // 4 blank rows — cons (right)
    { type: 'sticky', relLeft: 283, relTop: 114, width: 237, height: 86, fill: '#fef2f2', text: '' },
    { type: 'sticky', relLeft: 283, relTop: 210, width: 237, height: 86, fill: '#fef2f2', text: '' },
    { type: 'sticky', relLeft: 283, relTop: 306, width: 237, height: 86, fill: '#fef2f2', text: '' },
    { type: 'sticky', relLeft: 283, relTop: 402, width: 237, height: 86, fill: '#fef2f2', text: '' },
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

// ─── Form templates ──────────────────────────────────────────────────────────

const LOGIN_FORM: TemplateSpec = {
  id: 'login-form',
  frameTitle: 'Login',
  frameWidth: 340,
  frameHeight: 360,
  objects: [
    { type: 'text', relLeft: 28, relTop: 60, width: 284, height: 28,
      text: 'Log In', fontSize: 20, fill: '#1e293b' },
    { type: 'text', relLeft: 28, relTop: 104, width: 284, height: 20,
      text: 'Email', fontSize: 12, fill: '#64748b' },
    { type: 'input-field', relLeft: 28, relTop: 126, width: 284, height: 40,
      text: 'you@example.com' },
    { type: 'text', relLeft: 28, relTop: 182, width: 284, height: 20,
      text: 'Password', fontSize: 12, fill: '#64748b' },
    { type: 'input-field', relLeft: 28, relTop: 204, width: 284, height: 40,
      text: '••••••••' },
    { type: 'button', relLeft: 28, relTop: 268, width: 284, height: 44,
      fill: '#3b82f6', text: 'Sign In' },
  ],
}

const SIGNUP_FORM: TemplateSpec = {
  id: 'signup-form',
  frameTitle: 'Sign Up',
  frameWidth: 340,
  frameHeight: 450,
  objects: [
    { type: 'text', relLeft: 28, relTop: 60, width: 284, height: 28,
      text: 'Sign Up', fontSize: 20, fill: '#1e293b' },
    { type: 'text', relLeft: 28, relTop: 104, width: 284, height: 20,
      text: 'Full Name', fontSize: 12, fill: '#64748b' },
    { type: 'input-field', relLeft: 28, relTop: 126, width: 284, height: 40,
      text: 'Jane Doe' },
    { type: 'text', relLeft: 28, relTop: 182, width: 284, height: 20,
      text: 'Email', fontSize: 12, fill: '#64748b' },
    { type: 'input-field', relLeft: 28, relTop: 204, width: 284, height: 40,
      text: 'you@example.com' },
    { type: 'text', relLeft: 28, relTop: 260, width: 284, height: 20,
      text: 'Password', fontSize: 12, fill: '#64748b' },
    { type: 'input-field', relLeft: 28, relTop: 282, width: 284, height: 40,
      text: '••••••••' },
    { type: 'button', relLeft: 28, relTop: 346, width: 284, height: 44,
      fill: '#3b82f6', text: 'Create Account' },
  ],
}

const CONTACT_FORM: TemplateSpec = {
  id: 'contact-form',
  frameTitle: 'Contact Us',
  frameWidth: 340,
  frameHeight: 490,
  objects: [
    { type: 'text', relLeft: 28, relTop: 60, width: 284, height: 28,
      text: 'Contact Us', fontSize: 20, fill: '#1e293b' },
    { type: 'text', relLeft: 28, relTop: 104, width: 284, height: 20,
      text: 'Name', fontSize: 12, fill: '#64748b' },
    { type: 'input-field', relLeft: 28, relTop: 126, width: 284, height: 40,
      text: 'Your name' },
    { type: 'text', relLeft: 28, relTop: 182, width: 284, height: 20,
      text: 'Email', fontSize: 12, fill: '#64748b' },
    { type: 'input-field', relLeft: 28, relTop: 204, width: 284, height: 40,
      text: 'you@example.com' },
    { type: 'text', relLeft: 28, relTop: 260, width: 284, height: 20,
      text: 'Message', fontSize: 12, fill: '#64748b' },
    { type: 'input-field', relLeft: 28, relTop: 282, width: 284, height: 80,
      text: 'Write your message…' },
    { type: 'button', relLeft: 28, relTop: 386, width: 284, height: 44,
      fill: '#0d9488', text: 'Send Message' },
  ],
}

export const TEMPLATE_REGISTRY: Record<string, TemplateSpec> = {
  'pros-cons': PROS_CONS,
  swot: SWOT,
  'user-journey': USER_JOURNEY,
  retrospective: RETROSPECTIVE,
  'login-form': LOGIN_FORM,
  'signup-form': SIGNUP_FORM,
  'contact-form': CONTACT_FORM,
}
