# Efí Pix Automático — where to research the working implementation

Sparta will use this for lojista/loja billing (subscriptions charged via recurring
Pix). Don't build from scratch — a working implementation of the same flow is already
live and battle-tested in another project's homolog environment. Use it as the
reference before writing any Sparta-specific code.

## Where it lives

- **Repo:** `trampai-api`, path on this machine: `/config/workspace/trampai/trampai-api`
  (remote: `git@github.com:trampai-go/trampai-api.git`).
- **Stack there:** Directus (CMS/data store) + Hono (Node/TypeScript service that talks
  to Efí and Redis/BullMQ). Sparta is Fastify + Prisma + `better-auth` — different
  framework, same flow logic. Port the *logic*, not the files verbatim.
- **Status:** working in **homolog** (staging on Coolify) — real Pix Automático
  authorization, real recurring debit already confirmed against a real bank account
  (see checklist below). Not yet promoted to that repo's `main`/production at time of
  writing.

## Read these two docs first (already written, don't re-derive)

1. **`/config/workspace/trampai/trampai-api/docs/efi-pix-automatico-portable-guide.md`**
   — the stack-agnostic integration guide: what to rebuild (OAuth+mTLS client, webhook
   receiver, queue/worker upsert, data model, env vars, order of operations). Written
   specifically to be ported to a different stack — start here.
2. **`/config/workspace/trampai/trampai-api/deploy/efi-mtls.md`** — the reverse-proxy
   mTLS setup, including the Traefik/Coolify-specific gotchas (dedicated subdomain
   requirement, leaf-cert fingerprint pinning instead of CA verification, the
   `EFI_WEBHOOK_CERT_FINGERPRINT` discovery trick). This is the part most likely to eat
   time if skipped — read in full before touching Sparta's infra/DNS.

## Then read the real-world battle scars

**`/config/workspace/trampai/trampai-api/deploy/pix-testing-checklist.md`** — running
log of what was actually tested against real money, in order, with the exact bugs hit
and fixes applied. Notably:

- CobR (recurring charge) creation rejected the first body sent — three schema
  differences from the immediate-charge (`cob`) endpoint (`recebedor` block required,
  `ajusteDiaUtil`, no `chave` field, minimum lead time is 3 calendar days not 2).
- Webhook never arrived on the first real debit — two infra bugs, both already fixed
  and documented: webhooks were never actually registered against the real URL, and
  the dedicated webhook subdomain (`efi-webhook-homolog.trampai.com.br`) was missing
  Traefik's `tls.certresolver` label, so Traefik served a self-signed cert and Efí
  rejected registration with `DEPTH_ZERO_SELF_SIGNED_CERT`.
- Cancellation, bank-side rejection, and failed-charge retry flows are listed as
  **not yet exercised** — don't assume they're proven even though the happy path is.

## Live reference environment

- Webhook subdomain in homolog: `efi-webhook-homolog.trampai.com.br` (Traefik-routed,
  mTLS-pinned per the setup in `deploy/efi-mtls.md`) — an example of a real working
  Traefik config to copy the pattern from, not a Sparta endpoint.
- Source code for the actual client/webhook/registration logic:
  - `hono/src/lib/efi.ts` — Efí API client (OAuth + mTLS agent, all endpoint calls)
  - `hono/src/routes/webhook-efi.ts` — webhook receiver (HMAC + cert fingerprint checks)
  - `hono/src/lib/hmac.ts` — `validateEfiWebhook` / `validateEfiClientCert`
  - `hono/scripts/register-efi-webhooks.ts` — one-time webhook registration script

## What's genuinely Sparta-specific (not covered by the reference)

- **Directus integration**: trampai-api's Directus usage (schema-as-code snapshots,
  `external_reference` linking convention) is described in that repo's own
  `CLAUDE.md` and `directus/schema/README.md` — read those separately when wiring
  lojista/loja profiles into Directus, since Sparta's current stack (Prisma) has no
  Directus dependency yet.
- **Data model for lojista/loja** — the reference's `external_reference`
  (`{entity_type}:{entity_id}`) convention is worth reusing to link a recurrence/charge
  to a `loja` record, but the entity types and relations are Sparta's own design.
