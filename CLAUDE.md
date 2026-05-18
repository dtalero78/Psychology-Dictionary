# Psychology Dictionary: AI Tutor — Claude Code Instructions

## Project Overview
Expo React Native app + Python backend (FastAPI) + web survey participant page.
Target: psychology students and researchers (English-speaking, US market).
App name: **Psychology Dictionary: AI Tutor**

## Repo Structure
```
/
├── mobile/               # Expo React Native app (iOS-first)
├── backend/              # Python FastAPI backend
├── web/                  # Survey participant web page (Jinja2 templates)
├── docs/                 # PRD, engineering specs, prompts
└── CLAUDE.md
```

## Tech Stack (non-negotiable)
- **Mobile**: Expo (React Native), TypeScript, Expo Router, NativeWind
- **Mobile Auth**: expo-apple-authentication + JWT stored in expo-secure-store
- **Mobile Payments**: react-native-purchases (RevenueCat SDK)
- **Mobile Push**: expo-notifications (APNs under the hood)
- **Backend**: Python 3.12, FastAPI, PostgreSQL, SQLAlchemy, Alembic
- **AI**: Claude API — model `claude-sonnet-4-6`, always use prompt caching
- **Stats**: scipy, statsmodels, numpy, pandas
- **Documents**: reportlab (PDF), python-docx (.docx)
- **Auth**: JWT (python-jose) + Sign in with Apple + Email/Password
- **Payments**: RevenueCat (mobile SDK + backend webhooks)
- **Push**: APNs via `apns2` Python library (backend sends, Expo receives)
- **Hosting**: DigitalOcean Droplet + Nginx + Let's Encrypt SSL
- **Web**: FastAPI serving Jinja2 templates (no separate framework)
- **Local dev**: Docker Compose (PostgreSQL + FastAPI)

## Claude API Rules
- Always use `claude-sonnet-4-6` model ID
- Always include `cache_control` on system prompts (prompt caching)
- Each research design step has its own prompt file in `backend/prompts/`
- Never hardcode API keys — use environment variables

## Backend Conventions
- All endpoints return `{"data": ..., "error": null}` or `{"data": null, "error": "..."}`
- UUID primary keys everywhere
- Timestamps: `created_at`, `updated_at` on all models (UTC)
- Alembic for all schema changes — never modify tables manually
- Environment variables via `.env` file (never commit)

## Mobile Conventions (Expo React Native)
- Expo Router for file-based navigation
- NativeWind for styling (Tailwind classes)
- expo-secure-store for JWT storage — never AsyncStorage for auth tokens
- Single `api.ts` client with axios + interceptors for auth headers
- RevenueCat product ID: `com.psychologydictionary.annual` ($70/year)
- No Redux — React Context + hooks is sufficient
- No Alamofire equivalent — axios only

## Monetization Logic
- **Free tier**: 1 project maximum, 50 survey responses maximum
- **Paid ($70/year)**: unlimited projects, unlimited responses, .docx export
- Gate check happens on backend — never trust client-side only

## Business Rules
- Survey response pages are public (no auth required for participants)
- Survey links format: `https://api.psychologydictionary.app/s/{survey_token}`
- All participant data stored anonymously by default (no PII unless researcher opts in)
- APA format: 7th edition
- Statistical significance threshold: p < 0.05 (configurable per project)

## Do Not
- Do not use Redux or complex state management — React Context + hooks is enough
- Do not use fetch directly — use the shared axios `api.ts` client
- Do not store raw passwords — bcrypt only
- Do not run statistical analysis on device — always call backend
- Do not generate APA documents on device — always call backend
- Do not use Next.js or any web framework in `mobile/` — Expo only
