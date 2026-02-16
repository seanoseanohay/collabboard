/**
 * Environment variable validation.
 * Fail fast if required vars missing in production.
 */
export const env = {
  get firebaseApiKey() {
    return import.meta.env.VITE_FIREBASE_API_KEY ?? ''
  },
  get firebaseAuthDomain() {
    return import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? ''
  },
  get firebaseDatabaseUrl() {
    return import.meta.env.VITE_FIREBASE_DATABASE_URL ?? ''
  },
  get firebaseProjectId() {
    return import.meta.env.VITE_FIREBASE_PROJECT_ID ?? ''
  },
  get firebaseStorageBucket() {
    return import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? ''
  },
  get firebaseMessagingSenderId() {
    return import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? ''
  },
  get firebaseAppId() {
    return import.meta.env.VITE_FIREBASE_APP_ID ?? ''
  },
  get isDev() {
    return import.meta.env.DEV
  },
} as const
