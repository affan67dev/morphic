'use client'
import { getApps, initializeApp } from 'firebase/app'
import {
  getAuth,
  browserSessionPersistence,
  setPersistence
} from 'firebase/auth'

export async function firebaseClientAuth() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  }
  if (
    !config.apiKey ||
    !config.authDomain ||
    config.projectId !== 'nova-db049' ||
    !config.appId ||
    !config.storageBucket
  )
    throw new Error('Firebase web configuration is incomplete.')
  const app =
    getApps().find(a => a.name === 'nova-firebase') ||
    initializeApp(config, 'nova-firebase')
  const auth = getAuth(app)
  await setPersistence(auth, browserSessionPersistence)
  return auth
}
