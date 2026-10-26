import { streamText, type ModelMessage } from 'ai'

import { createPublicErrorResponse, serializePublicError } from '@/lib/errors/public-error'
import { getModel } from '@/lib/utils/registry'

const buckets = new Map<string, { count: number; reset: number }>()
const MODEL = 'openai/gpt-oss-120b:free'

export async function handleNovaChat(req: Request): Promise<Response> {
  const origin = req.headers.get('origin')
  const allowedOrigins = new Set(['https://nova-morphic-test.vercel.app', 'https://nova-morphic-test-an26.vercel.app'])
  if (origin && !allowedOrigins.has(origin)) return Response.json({ error: 'Origin is not allowed.' }, { status: 403 })
  if (!process.env.OPENAI_COMPATIBLE_API_KEY) return Response.json({ error: 'Chat provider is not configured.', code: 'model_unavailable', type: 'general' }, { status: 503 })
  const ip = req.headers.get('x-vercel-forwarded-for') || req.headers.get('x-forwarded-for') || 'unknown'
  const now = Date.now()
  for (const [key, value] of buckets) if (value.reset < now) buckets.delete(key)
  const bucket = buckets.get(ip) || { count: 0, reset: now + 60000 }
  if (bucket.count >= 10 || buckets.size >= 5000) return Response.json({ error: 'Please wait a minute before sending more messages.', type: 'rate-limit', code: 'rate_limit', retryable: true }, { status: 429, headers: { 'Retry-After': '60' } })
  bucket.count += 1
  buckets.set(ip, bucket)
  try {
    const raw = await req.text()
    if (raw.length > 64000) return Response.json({ error: 'Message is too large.' }, { status: 413 })
    let body
    try { body = JSON.parse(raw) } catch { return Response.json({ error: 'Invalid chat request.' }, { status: 400 }) }
    const history = Array.isArray(body.messages) ? body.messages : body.message ? [body.message] : []
    if (!history.length || history.length > 100) return Response.json({ error: 'Send a message to begin.' }, { status: 400 })
    const messages: ModelMessage[] = []
    for (const item of history.slice(-20)) {
      if (!item || !['user', 'assistant'].includes(item.role) || !Array.isArray(item.parts)) return Response.json({ error: 'Invalid conversation format.' }, { status: 400 })
      if (item.parts.some((part: { type?: string }) => part.type === 'file')) return Response.json({ error: 'File analysis is not enabled in this chat yet.' }, { status: 400 })
      const text = item.parts.filter((part: { type?: string; text?: unknown }) => part.type === 'text' && typeof part.text === 'string').map((part: { text: string }) => part.text).join('\n')
      if (text.length > 12000) return Response.json({ error: 'Please shorten your message.' }, { status: 400 })
      if (text.trim()) messages.push({ role: item.role, content: text })
    }
    if (!messages.length || messages[messages.length - 1].role !== 'user' || JSON.stringify(messages).length > 45000) return Response.json({ error: 'Start a new chat or shorten this conversation.' }, { status: 400 })
    const result = streamText({
      model: getModel(`openai-compatible:${MODEL}`),
      system: 'You are NOVA, a helpful conversational assistant. Match the user’s language, including casual Hinglish. Keep default replies concise and useful. Do not claim to browse the web, generate images, access uploaded files, or remember across sessions. You currently provide text chat without web search.',
      messages,
      maxOutputTokens: 1600,
      maxRetries: 0,
      abortSignal: AbortSignal.any([req.signal, AbortSignal.timeout(56000)])
    })
    return result.toUIMessageStreamResponse({
      onError: error => serializePublicError(error, { fallbackMessage: 'The model could not finish. Please retry; free models may be busy.' }),
      headers: { 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' }
    })
  } catch (error) {
    return createPublicErrorResponse(error, { status: 502, fallbackMessage: 'Chat is temporarily unavailable. Please retry.' })
  }
}
