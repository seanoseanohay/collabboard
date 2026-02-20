/**
 * Auth feature module.
 * Supabase Auth (GitHub + Email). Login required for MVP.
 */

export { useAuth } from './hooks/useAuth'
export { LoginPage } from './components/LoginPage'
export {
  signInWithGithub,
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
  getAuthErrorMessage,
} from './api/authApi'
