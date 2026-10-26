import { headers } from 'next/headers'

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { drizzle } from 'drizzle-orm/postgres-js'

import * as schema from './auth-schema'
import { database } from './db'
function createBuilderAuth() {
  if (!process.env.NOVA_AUTH_SECRET)
    throw new Error('Sign-in is temporarily unavailable.')
  return betterAuth({
    appName: 'NOVA',
    basePath: '/api/builder/auth',
    baseURL:
      process.env.NOVA_PUBLIC_URL || 'https://nova-morphic-test.vercel.app',
    secret: process.env.NOVA_AUTH_SECRET,
    database: drizzleAdapter(drizzle(database(), { schema }), {
      provider: 'pg',
      schema
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128
    },
    user: { deleteUser: { enabled: true } },
    session: { expiresIn: 60 * 60 * 24 * 7, cookieCache: { enabled: false } },
    advanced: {
      cookiePrefix: 'nova-builder',
      useSecureCookies: process.env.NODE_ENV === 'production'
    },
    trustedOrigins: [
      'https://nova-morphic-test.vercel.app',
      'https://nova-morphic-test-an26.vercel.app',
      ...(process.env.NODE_ENV === 'development'
        ? ['http://localhost:3000']
        : [])
    ],
    rateLimit: { enabled: true, window: 60, max: 15 }
  })
}
let instance: ReturnType<typeof createBuilderAuth> | undefined
export function builderAuth() {
  return (instance ||= createBuilderAuth())
}
export async function builderUser() {
  return (
    (await builderAuth().api.getSession({ headers: await headers() }))?.user ||
    null
  )
}
export type BuilderUser = {
  id: string
  name: string
  email: string
  image?: string | null
}
