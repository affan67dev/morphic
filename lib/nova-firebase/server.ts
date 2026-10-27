import 'server-only'
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp
} from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

export function novaFirebaseAdmin() {
  const projectId = process.env.FIREBASE_PROJECT_ID
  if (projectId !== 'nova-db049')
    throw new Error('NOVA Firebase project is not configured.')
  const email = process.env.FIREBASE_CLIENT_EMAIL,
    key = process.env.FIREBASE_PRIVATE_KEY
  if (!!email !== !!key)
    throw new Error('Incomplete Firebase server credentials.')
  const app =
    getApps().find(a => a.name === 'nova-firebase') ||
    initializeApp(
      {
        projectId,
        credential:
          email && key
            ? cert({
                projectId,
                clientEmail: email,
                privateKey: key.replace(/\\n/g, '\n')
              })
            : applicationDefault()
      },
      'nova-firebase'
    )
  return { auth: getAuth(app), db: getFirestore(app), storage: getStorage(app) }
}
export async function verifyNovaSession(cookie: string) {
  if (!cookie) throw new Error('Authentication required.')
  return novaFirebaseAdmin().auth.verifySessionCookie(cookie, true)
}
