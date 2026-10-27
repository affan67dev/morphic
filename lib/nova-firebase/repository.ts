import 'server-only'
import { FieldValue } from 'firebase-admin/firestore'
import { novaFirebaseAdmin } from './server'

const allowed = new Set([
  'profiles',
  'workspaces',
  'projects',
  'conversations',
  'builds'
])
function segment(value: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(value))
    throw new Error('Invalid identifier')
  return value
}
export function userRecord(owner: string, collection: string, id: string) {
  if (!allowed.has(collection)) throw new Error('Unsupported collection')
  return novaFirebaseAdmin()
    .db.collection('users')
    .doc(segment(owner))
    .collection(collection)
    .doc(segment(id))
}
export async function getUserRecord(
  owner: string,
  collection: string,
  id: string
) {
  const doc = await userRecord(owner, collection, id).get()
  return doc.exists ? doc.data() : null
}
export async function saveUserRecord(
  owner: string,
  collection: string,
  id: string,
  fields: Record<string, unknown>
) {
  if ('ownerId' in fields && fields.ownerId !== owner)
    throw new Error('Invalid owner')
  await userRecord(owner, collection, id).set(
    { ...fields, ownerId: owner, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  )
}
export async function savePrivateFile(
  owner: string,
  project: string,
  version: string,
  filename: string,
  data: Buffer,
  type: string
) {
  if (
    ![
      'text/html',
      'text/css',
      'application/javascript',
      'application/json',
      'text/plain'
    ].includes(type) ||
    data.length > 1024 * 1024
  )
    throw new Error('Unsupported file')
  const bucket = process.env.FIREBASE_STORAGE_BUCKET
  if (!bucket) throw new Error('Storage is not configured')
  const path = `users/${segment(owner)}/projects/${segment(project)}/versions/${segment(version)}/${segment(filename.replace(/\./g, '_'))}`
  await novaFirebaseAdmin()
    .storage.bucket(bucket)
    .file(path)
    .save(data, {
      contentType: type,
      metadata: { cacheControl: 'private, no-store' },
      preconditionOpts: { ifGenerationMatch: 0 }
    })
  return path
}
