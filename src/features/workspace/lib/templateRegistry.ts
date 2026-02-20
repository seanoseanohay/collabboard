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

function makeId() { return crypto.randomUUID() }

const SWOT: TemplateSpec = {
  id: 'swot',
  frameTitle: 'SWOT Analysis',
  frameWidth: 620,
  frameHeight: 500,
  objects: [
    {
      type: 'table',
      relLeft: 20, relTop: 52, width: 280, height: 210,
      text: 'Strengths', showTitle: true, accentColor: '#16a34a',
      formSchema: {
        columns: [{ id: 'col1', name: 'Item', type: 'text' }],
        rows: [
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
        ],
      },
    },
    {
      type: 'table',
      relLeft: 320, relTop: 52, width: 280, height: 210,
      text: 'Weaknesses', showTitle: true, accentColor: '#dc2626',
      formSchema: {
        columns: [{ id: 'col1', name: 'Item', type: 'text' }],
        rows: [
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
        ],
      },
    },
    {
      type: 'table',
      relLeft: 20, relTop: 278, width: 280, height: 210,
      text: 'Opportunities', showTitle: true, accentColor: '#2563eb',
      formSchema: {
        columns: [{ id: 'col1', name: 'Item', type: 'text' }],
        rows: [
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
        ],
      },
    },
    {
      type: 'table',
      relLeft: 320, relTop: 278, width: 280, height: 210,
      text: 'Threats', showTitle: true, accentColor: '#ca8a04',
      formSchema: {
        columns: [{ id: 'col1', name: 'Item', type: 'text' }],
        rows: [
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
          { id: makeId(), values: { col1: '' } },
        ],
      },
    },
  ],
}

// ─── User Journey ─────────────────────────────────────────────────────────────

const USER_JOURNEY: TemplateSpec = {
  id: 'user-journey',
  frameTitle: 'User Journey Map',
  frameWidth: 980,
  frameHeight: 420,
  objects: [
    {
      type: 'table',
      relLeft: 20, relTop: 52, width: 940, height: 360,
      text: 'User Journey', showTitle: false,
      formSchema: {
        columns: [
          { id: 'phase', name: 'Phase', type: 'text' },
          { id: 'awareness', name: 'Awareness', type: 'text', headerColor: '#dbeafe' },
          { id: 'consideration', name: 'Consideration', type: 'text', headerColor: '#dbeafe' },
          { id: 'decision', name: 'Decision', type: 'text', headerColor: '#dbeafe' },
          { id: 'retention', name: 'Retention', type: 'text', headerColor: '#dbeafe' },
          { id: 'advocacy', name: 'Advocacy', type: 'text', headerColor: '#dbeafe' },
        ],
        rows: [
          { id: makeId(), values: { phase: 'Actions', awareness: '', consideration: '', decision: '', retention: '', advocacy: '' } },
          { id: makeId(), values: { phase: 'Tasks', awareness: '', consideration: '', decision: '', retention: '', advocacy: '' } },
          { id: makeId(), values: { phase: 'Feelings', awareness: '', consideration: '', decision: '', retention: '', advocacy: '' } },
          { id: makeId(), values: { phase: 'Pain Points', awareness: '', consideration: '', decision: '', retention: '', advocacy: '' } },
          { id: makeId(), values: { phase: 'Opportunities', awareness: '', consideration: '', decision: '', retention: '', advocacy: '' } },
        ],
      },
    },
  ],
}

// ─── Retrospective ────────────────────────────────────────────────────────────

const RETROSPECTIVE: TemplateSpec = {
  id: 'retrospective',
  frameTitle: 'Retrospective',
  frameWidth: 740,
  frameHeight: 420,
  objects: [
    {
      type: 'table',
      relLeft: 20, relTop: 52, width: 700, height: 360,
      text: 'Retrospective', showTitle: false,
      formSchema: {
        columns: [
          { id: 'col1', name: '✓ What Went Well', type: 'text', headerColor: '#dcfce7' },
          { id: 'col2', name: "✗ What Didn't", type: 'text', headerColor: '#fee2e2' },
          { id: 'col3', name: '→ Action Items', type: 'text', headerColor: '#dbeafe' },
        ],
        rows: [
          { id: makeId(), values: { col1: '', col2: '', col3: '' } },
          { id: makeId(), values: { col1: '', col2: '', col3: '' } },
          { id: makeId(), values: { col1: '', col2: '', col3: '' } },
          { id: makeId(), values: { col1: '', col2: '', col3: '' } },
          { id: makeId(), values: { col1: '', col2: '', col3: '' } },
        ],
      },
    },
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
