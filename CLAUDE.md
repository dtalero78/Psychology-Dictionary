# Psychology Dictionary: AI Tutor — Claude Code Instructions

## Project Overview
iOS app (Swift/SwiftUI) + Python backend (FastAPI) + web survey participant page.
Target: psychology students and researchers (English-speaking, US market).
App name: **Psychology Dictionary: AI Tutor**

## Repo Structure
```
/
├── ios/                  # Swift/SwiftUI iOS app
├── backend/              # Python FastAPI backend
├── web/                  # Survey participant web page
├── docs/                 # PRD, engineering specs, prompts
└── CLAUDE.md
```

## Tech Stack (non-negotiable)
- **iOS**: Swift, SwiftUI, MVVM, StoreKit 2, APNs
- **Backend**: Python 3.12, FastAPI, PostgreSQL, SQLAlchemy, Alembic
- **AI**: Claude API — model `claude-sonnet-4-6`, always use prompt caching
- **Stats**: scipy, statsmodels, numpy, pandas
- **Documents**: reportlab (PDF), python-docx (.docx)
- **Auth**: JWT (python-jose) + Sign in with Apple + Email/Password
- **Payments**: RevenueCat (iOS StoreKit 2 + backend webhooks)
- **Push**: APNs via `apns2` Python library
- **Hosting**: DigitalOcean Droplet + Nginx + Let's Encrypt SSL
- **Web**: FastAPI serving Jinja2 templates (no separate framework)

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

## iOS Conventions
- MVVM: Views observe `@ObservableObject` ViewModels
- Networking: single `APIClient` class with async/await
- Keychain for token storage — never UserDefaults for auth tokens
- All user-facing text in `Localizable.strings` (English only for v1)
- StoreKit 2 product ID: `com.psychologydictionary.annual` ($70/year)

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
- Do not use async Redux or complex state management — SwiftUI + MVVM is enough
- Do not use third-party HTTP libraries on iOS — use URLSession
- Do not store raw passwords — bcrypt only
- Do not run statistical analysis on the iOS device — always call backend
- Do not generate APA documents on device — always call backend
