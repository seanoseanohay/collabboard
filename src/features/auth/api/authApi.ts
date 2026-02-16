import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { getAuthInstance } from '@/shared/lib/firebase/config'

export async function signInWithGoogle(): Promise<void> {
  const auth = getAuthInstance()
  const provider = new GoogleAuthProvider()
  await signInWithPopup(auth, provider)
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<void> {
  const auth = getAuthInstance()
  await signInWithEmailAndPassword(auth, email, password)
}

export async function signUpWithEmail(
  email: string,
  password: string
): Promise<void> {
  const auth = getAuthInstance()
  await createUserWithEmailAndPassword(auth, email, password)
}

export async function signOutUser(): Promise<void> {
  const auth = getAuthInstance()
  await signOut(auth)
}

export function getAuthErrorMessage(err: {
  code: string
  message?: string
}): string {
  const code = err.code
  if (code === 'auth/user-not-found' || code === 'auth/wrong-password') {
    return 'Invalid email or password.'
  }
  if (code === 'auth/email-already-in-use') {
    return 'This email is already registered.'
  }
  if (code === 'auth/weak-password') {
    return 'Password must be at least 6 characters.'
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Sign-in was cancelled.'
  }
  return err.message ?? 'An error occurred.'
}
