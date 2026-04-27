# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start server with hot-reload (tsx --watch)

# Linting
npx eslint .         # Run ESLint

# Prisma
npx prisma migrate dev        # Create and apply a migration
npx prisma migrate deploy     # Apply pending migrations (production)
npx prisma generate           # Regenerate Prisma client after schema changes
npx prisma studio             # Open Prisma Studio (DB GUI)
```

No test suite is configured yet.

## Environment

Requires a `DATABASE_URL` env var pointing to a PostgreSQL database. The server runs on port `8080` by default (overridable via `PORT`).

## Architecture

**Framework stack:** Fastify + Zod (via `fastify-type-provider-zod`) for type-safe request/response validation. All routes use `ZodTypeProvider` and define schemas inline.

**Authentication:** `better-auth` with email/password, backed by Prisma. All auth routes live under `/api/auth/*` and are proxied to `better-auth`'s handler in `src/index.ts`. The session is retrieved via `auth.api.getSession()` inside route handlers.

**Database:** Prisma 7 with the `@prisma/adapter-pg` driver adapter (connection pooling via `pg.Pool`). The generated client lives in `src/generated/prisma/` (not `node_modules`). After any schema change, run `prisma generate`.

**Request flow:**
1. Route defined in `src/routes/<feature>.ts` — handles auth, delegates to use case
2. Use case class in `src/usecases/<Name>.ts` — contains business logic and Prisma calls
3. Zod schemas in `src/schemas/index.ts` — shared between route validation and response serialization

**Error handling:** Custom error classes in `src/errors/index.ts` (e.g., `NotFoundError`). Routes catch these and map them to HTTP status codes manually.

**API docs:** Swagger/OpenAPI served at `/docs` via `@scalar/fastify-api-reference`, with two sources: the app's own OpenAPI spec (`/swagger.json`) and `better-auth`'s generated schema.

## Key conventions

- Import paths use `.js` extensions (ESM `"type": "module"` project).
- Imports must be sorted — enforced by `eslint-plugin-simple-import-sort`.
- All timestamps use `@db.Timestamptz()` in Prisma for timezone-aware storage.
- Only one `WorkoutPlan` can be active per user at a time — `CreateWorkoutPlan` deactivates the previous one in a transaction.
