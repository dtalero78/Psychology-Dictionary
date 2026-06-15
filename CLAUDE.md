# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Psychology Dictionary Lab — Expo React Native (iOS-first) + FastAPI backend + public web survey page. Target users are English-speaking US psychology students/researchers. Free tier: 1 project, 50 responses. Paid `com.psychologydictionary.pro.annual` ($79.99/yr): unlimited + .docx export. All paywall gating is enforced server-side.

## Repo Layout
- `mobile/` — Expo (React Native + Expo Router + NativeWind). iOS-first.
- `backend/` — FastAPI on Python 3.12 with SQLAlchemy 2 + Alembic.
- `web/` — Jinja2 templates served by FastAPI for the public survey participant page.
- `docs/` — `PRD.md`, `ENGINEERING.md`.

## Production
- API: `https://api.psychologydictionary.app` — **DigitalOcean App Platform** (basic-xxs tier), app id `75bf8482-fbfe-4a88-ad11-a40e672fe7a1`. NOT a Droplet; there is no Nginx/Let's Encrypt to manage. Auto-deploys from `main` on push.
- DB: managed Postgres attached to the App.
- File storage: **DigitalOcean Spaces bucket `bsl-fotos`** (NYC3), shared with other apps (kbnet, bsl-plataforma, bodytech). Always write keys under the `psydict/` prefix to avoid collision. Spaces access key is `psydict-uploads`, scoped to bsl-fotos readwrite.
- Manage env vars / triggers via `doctl apps spec get|update <app-id>`. Spec changes auto-trigger a deploy.

## Commands

### Mobile (`mobile/`)
- `npx expo start --clear` — Metro with clean cache. Default is dev-client scheme; press `s` in the Metro terminal to toggle to **Expo Go** mode if testing in Expo Go (the QR scheme differs).
- `npx tsc --noEmit` — type-check the whole app.
- Apple Sign In is **broken in Expo Go** (bundle-id mismatch `host.exp.Exponent`). Use email/password to test in Expo Go; Apple Sign In only works in real builds.

### Backend (`backend/`)
- `docker-compose up` — full local stack (Postgres + API).
- Or with venv directly: `venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000` (Postgres must already be running locally on 5432).
- `venv/bin/alembic upgrade head` — run migrations. **All schema changes go through Alembic — never modify tables manually**.
- No test suite exists yet; verify with the smoke pattern below or end-to-end through the mobile app.

### Deploy
- Backend: `git push origin main` triggers App Platform redeploy (~3-5 min). Watch with `doctl apps list-deployments <app-id>`.
- Mobile: `eas build --platform ios --profile production` then `eas submit`.

## Architecture invariants

### Postgres schema is `psydict`, not `public`
`backend/app/models/base.py` sets `MetaData(schema="psydict")` and `backend/app/database.py` sets `search_path TO psydict, public` on every connection. New migrations must include `schema=SCHEMA` (= `"psydict"`) in every `op.add_column`/`op.create_table`. Local devs running migrations against an empty DB may need `CREATE SCHEMA psydict;` first.

### API response envelope
Every endpoint returns `ApiResponse[T]` = `{ "data": T | None, "error": str | None }`. Mobile uses `unwrap()` in `mobile/src/api/client.ts`. Errors raise `HTTPException` server-side; the client interceptor surfaces `error.response.data.error || .detail`.

### Long-running Claude operations are async + polled
DO App Platform's gateway times out HTTPS requests at **~90 seconds**. APA report generation routinely takes 60-180s. The shipped pattern (commit `e99c43f`):

1. `POST /documents` inserts an `apa_documents` row with `status='pending'`, fires `asyncio.create_task(...)`, and returns the pending record immediately (HTTP 200 in <100ms).
2. The background task opens its **own** DB session (don't reuse the request-scoped session), runs Claude → `generate_pdf` → Spaces upload, then UPDATEs the row with `status='ready' | 'failed'` and `pdf_url` / `docx_url` / `error`.
3. Mobile polls `GET /documents/{id}` every 3-5s until `status !== 'pending'`. The mobile UI shows the polling result, and resumes polling on remount if a doc is still pending — so the user can navigate away and come back.

When adding any new operation > 30s, follow the same pattern. The `claude_service` functions are already `async`; reuse `aiTimeout(ms)` (mobile/src/api/client.ts) for client-side Claude calls so axios doesn't time out at 60s.

### Spaces upload always uses the prefix
`document_service._upload_to_spaces` prefixes every key with `psydict/` (declared as `SPACES_PREFIX = "psydict"`). Public URLs are virtual-host style: `https://bsl-fotos.nyc3.digitaloceanspaces.com/psydict/<key>`. The fallback when `SPACES_KEY` is unset writes to `/tmp/psydict/...` (must `mkdir parents=True`); App Platform's `/tmp` is ephemeral so the fallback is only useful for local dev.

### Mobile bootstrap must release the splash
`mobile/src/context/AuthContext.tsx` wraps the bootstrap in try/finally **and** sets an 8s safety timeout that flips `isLoading` to false unconditionally. Past incidents got us stuck on an infinite splash when SecureStore or `/auth/me` hung. Preserve this pattern in any future change to AuthContext.

### `mobile/components/ui.tsx` atoms use StyleSheet, NOT NativeWind classNames
NativeWind `className` props **silently fail** on iOS production builds (login rendered as a gray void in build #9). Atoms in `ui.tsx` (`Screen`, `Card`, `Button`, `H1`/`H2`/`H3`, `Pill`, etc.) use `StyleSheet.create()` with the color tokens in `theme.C`. Screens above the atoms can use `className`. If you add an atom, follow the StyleSheet pattern; if you migrate an atom to `className`, expect to debug an invisible UI on a real device.

### NativeWind requires Tailwind v3
`mobile/tailwind.config.js` content paths must include `./app/**`, `./src/**`, AND `./components/**` (omitting `components/` broke build #8). Do not upgrade to Tailwind v4 — incompatible with NativeWind 4.2.

### RevenueCat must skip Expo Go
`mobile/app/(app)/_layout.tsx` skips `Purchases.configure()` when `Constants.executionEnvironment === ExecutionEnvironment.StoreClient`. Don't remove that guard.

### Storage abstraction
`AuthContext` uses a `storage` wrapper that delegates to `expo-secure-store` on native and `localStorage` on web. Previously a `replace_all` refactor introduced infinite recursion (storage.getItem calling itself); always call `SecureStore.getItemAsync` directly from inside the wrapper.

## Conventions
- All models inherit `Base, TimestampMixin` from `backend/app/models/base.py`. UUID primary keys via `new_uuid` default. `created_at` / `updated_at` UTC.
- Backend prompts live in `backend/prompts/*.txt`. Always pass them with `cache_control` for prompt caching when calling Claude. Model id is `claude-sonnet-4-6` (do not switch without testing).
- Mobile API client: **only** `mobile/src/api/client.ts` (axios with interceptors). Do not `fetch()` directly.
- State management: React Context + hooks. No Redux, no Zustand.
- Stats and document generation always run on the backend — never on device.
- Public survey URL format: `https://api.psychologydictionary.app/s/{survey_token}`. No auth required for participants. Anonymous by default (ip stored as SHA-256 hash only).

## Don't break
- The async + polling pattern for any operation that might exceed 30s.
- `psydict` schema in MetaData/Alembic.
- The `psydict/` Spaces key prefix (do not pollute the bucket root).
- The 8s safety timeout in AuthContext.
- The StyleSheet implementation of `ui.tsx` atoms.
- The `--no-verify` style shortcuts on commits (we run pre-commit hooks for a reason).

## Versioned Expo docs
Per `mobile/AGENTS.md`: always check the exact docs for the SDK in use (currently SDK 54) at `https://docs.expo.dev/versions/v54.0.0/` before writing Expo-specific code. APIs across SDKs are not interchangeable.
