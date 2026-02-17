import '@testing-library/jest-dom'

jest.mock('@/shared/lib/firebase/config', () => ({
  getFirebaseApp: () => ({}),
  getAuthInstance: () => ({}),
  getDatabaseInstance: () => ({}),
}))

jest.mock('firebase/auth', () => ({
  getAuth: () => ({}),
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    setTimeout(() => cb(null), 0)
    return () => {}
  },
  signInWithPopup: jest.fn(),
  GoogleAuthProvider: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
}))

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
}))

jest.mock('firebase/database', () => ({
  getDatabase: jest.fn(() => ({})),
}))

jest.mock('@/features/workspace/components/FabricCanvas', () => ({
  FabricCanvas: () =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock factory
    require('react').createElement('div', { 'data-testid': 'fabric-canvas-mock' }),
}))
