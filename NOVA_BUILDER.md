# NOVA builder

The existing NOVA Vercel project serves the builder when NOVA_BUILDER=true. The previous Morphic code remains available with this flag disabled.

## Supported outputs

Self-contained HTML/CSS/JavaScript websites and browser apps, plus PWA source files. Native applications, npm/framework projects, payment processing, and arbitrary server code are not supported. PWA installation requires deployment, a linked manifest and service-worker registration; the embedded preview is not an installed app. Reference images are stored privately for review; they are not currently analyzed by the text-only model.

## Runtime

Better Auth email/password sessions use the same managed Neon Postgres database as workspaces and projects. Apply migrations/nova-builder.sql with an administrative connection; NOVA_DATABASE_URL must use the restricted nova_runtime role. Domain tables use owner-scoped row-level security. Immutable versions cannot be changed or deleted by the application role. Account/project deletion cascades through owned data. No SMTP recovery service or email verification has been configured.

NOVA_AUTH_SECRET and NOVA_DATABASE_URL are server-only Sensitive Vercel variables. NOVA_PUBLIC_URL defines the trusted origin. The existing server-only OpenAI-compatible bridge credentials are preserved. No provider credential is sent to clients. ALEX's authenticated model bridge requires an actual runtime OpenRouter key before generation can succeed.

## Jobs and previews

Requests reserve durable, idempotent jobs with five attempts per user per UTC day and thirty across NOVA. Worker leases permit at most three recovery attempts. File checkpoints survive refresh. Model output is strictly bounded, validated and limited to six supported files. Dependency-free projects do not require package installation; the activity explicitly reports this. JavaScript syntax is checked inside a temporary network-blocked Vercel Sandbox, never the API process. SDK authentication uses Vercel's deployment OIDC. Check project runs these real checks on saved files without calling a model.

The Next.js after worker runs within the function's 180-second limit. It is not an always-on queue: abandoned work resumes when an authenticated client reconnects and polls the job. Cancellation prevents committing a new version; temporary workers are stopped in cleanup or expire after 45 seconds. Last working versions remain available after failures.

Preview HTML uses a restrictive CSP and an opaque-origin sandbox iframe. Outbound fetches, frames and form submissions are blocked; HTTPS images are allowed. Publishing requires an explicit confirmation and publishes a pinned immutable version under /p/:slug. Later private edits do not automatically change that public version. Unpublish revokes the public record. Public output remains a sandboxed static website and cannot host backend services.

## Validation

Run `bun run test -- lib/builder/files.test.ts lib/nova/error.test.ts`, then `NOVA_BUILDER=true bun run build`. The database role and RLS policies also need live two-user acceptance tests after deployment. Provider failure is not a successful AI-generation test.
