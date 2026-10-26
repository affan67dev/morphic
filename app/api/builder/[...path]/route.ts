import { builderAuth } from '@/lib/builder/auth'
import { dispatch } from '@/lib/builder/service'
export const maxDuration = 180
async function handle(
  req: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params
  if (path[0] === 'auth') return builderAuth().handler(req)
  return dispatch(req, path)
}
export const GET = handle
export const POST = handle
export const PATCH = handle
export const DELETE = handle
