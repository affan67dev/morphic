# NOVA text chat

NOVA retains Morphic UI and uses `NOVA_CHAT_ONLY=true` for text-only, stateless streaming chat. It does not require a database or a search API. Conversation context is sent from the current browser session; no durable history is claimed.

## Server-to-server connection

NOVA's `OPENAI_COMPATIBLE_API_KEY` is a dedicated bridge credential, not the OpenRouter key. Its `OPENAI_COMPATIBLE_API_BASE_URL` points to the authenticated `/api/nova/v1` route on the existing ALEX Vercel project. The bridge uses that project's `OPENROUTER_API_KEY` in place; it never returns the key. The shared `NOVA_BRIDGE_TOKEN` is provisioned securely in Vercel, never in git or browser code.

The bridge is on `feat/nova-authenticated-bridge-20261026`, based on the previously deployed ALEX commit e0d836270ef64a8f227be1b5d3aa8fcf7e625a24. ALEX's other routes are unchanged. Keep this route when deploying future ALEX releases; deploying an older branch without it will break NOVA chat.

## Bounds

Only `openai/gpt-oss-120b:free` is allowed. Requests have bounded context, output and 52/56-second upstream/client deadlines. Paid model selection and arbitrary upstream URLs are rejected. The bridge is bearer-authenticated; NOVA does not send its credential to visitors. Per-IP and bridge rate limits are best-effort per warm function instance, not a globally durable quota. Add a durable limiter and user authentication before broad public rollout.

## Credentials and verification

If the bridge returns 503 `Model provider is not configured`, securely set or replace `OPENROUTER_API_KEY` in ALEX Vercel production settings and redeploy that project. No need to change NOVA's bridge credential. Never paste provider keys into chat or commit them.

Build success is not proof of a real model reply. Verify a message through the live NOVA browser interface and separately confirm errors end the loading state. File analysis, image generation and web search are not enabled by this text-chat integration.
