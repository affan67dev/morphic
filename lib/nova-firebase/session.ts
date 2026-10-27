import 'server-only'
import { novaFirebaseAdmin } from './server'
const duration = 5 * 24 * 60 * 60 * 1000
export function isTrustedOrigin(request: Request) {
  const origin = request.headers.get('origin')
  const expected = process.env.NOVA_PUBLIC_URL
  return (
    !!origin &&
    !!expected &&
    origin === expected &&
    request.headers.get('sec-fetch-site') !== 'cross-site'
  )
}
export async function createNovaSession(request: Request, idToken: string) {
  if (!isTrustedOrigin(request)) throw new Error('Invalid request origin.')
  const auth = novaFirebaseAdmin().auth
  const token = await auth.verifyIdToken(idToken, true)
  if (
    Date.now() / 1000 - token.auth_time > 300 ||
    token.auth_time > Date.now() / 1000 + 30
  )
    throw new Error('Sign in again before starting a session.')
  return auth.createSessionCookie(idToken, { expiresIn: duration })
}
export const sessionCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: duration / 1000
}
export async function revokeNovaSessions(uid: string) {
  await novaFirebaseAdmin().auth.revokeRefreshTokens(uid)
}
