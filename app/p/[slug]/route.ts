import { database } from '@/lib/builder/db'
import { type Files, previewHTML } from '@/lib/builder/files'
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!/^[0-9a-f-]{36}$/.test(slug))
    return new Response('Page not found', { status: 404 })
  try {
    const rows = await database().begin(async sql => {
      await sql`select set_config('nova.public_slug',${slug},true)`
      return sql`select v.files from nova_versions v join nova_publications p on p.version_id=v.id where p.slug=${slug}`
    })
    if (!rows[0])
      return new Response(
        '<h1>This page is no longer published.</h1><a href="/">Open NOVA</a>',
        { status: 404, headers: { 'Content-Type': 'text/html' } }
      )
    return new Response(previewHTML(rows[0].files as Files), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy':
          "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src https: data:; connect-src 'none'; base-uri 'none'; form-action 'none'",
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer'
      }
    })
  } catch {
    return new Response('This page is temporarily unavailable. Please retry.', {
      status: 503
    })
  }
}
