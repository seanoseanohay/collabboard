/**
 * Auth feature module.
 * Firebase Auth (Google + Email). Login required for MVP.
 */

export { useAuth } from './hooks/useAuth'
export { LoginPage } from './components/LoginPage'
export {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
  getAuthErrorMessage,
} from './api/authApi'
