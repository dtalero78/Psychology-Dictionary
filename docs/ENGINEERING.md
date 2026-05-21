# Engineering Requirements
## Psychology Dictionary Lab

**Version**: 1.0  
**Date**: 2026-05-18

---

## 1. System Architecture

```
┌─────────────────────┐     HTTPS/REST      ┌──────────────────────────┐
│   iOS App (Swift)   │ ◄──────────────────► │  FastAPI Backend (Python) │
│   SwiftUI / MVVM    │                      │  PostgreSQL / DigitalOcean│
└─────────────────────┘                      └──────────┬───────────────┘
                                                        │
         ┌──────────────────────────────────────────────┤
         │                    │                         │
         ▼                    ▼                         ▼
  ┌─────────────┐    ┌────────────────┐      ┌──────────────────┐
  │ Claude API  │    │  scipy/numpy   │      │  APNs (Apple)    │
  │ Sonnet 4.6  │    │  statsmodels   │      │  Push Notifs     │
  └─────────────┘    └────────────────┘      └──────────────────┘

┌─────────────────────┐     HTTPS           ┌──────────────────────────┐
│  Participant Browser│ ◄──────────────────► │  FastAPI (Jinja2 templates│
│  (any device)       │                      │  Survey response pages)   │
└─────────────────────┘                      └──────────────────────────┘
```

---

## 2. Backend Stack

| Layer | Technology | Version |
|---|---|---|
| Language | Python | 3.12 |
| Framework | FastAPI | 0.111+ |
| ORM | SQLAlchemy | 2.0 |
| Migrations | Alembic | latest |
| Database | PostgreSQL | 16 |
| Auth tokens | python-jose (JWT) | latest |
| Password hashing | bcrypt (passlib) | latest |
| AI | anthropic SDK | latest |
| Statistics | scipy, statsmodels, numpy, pandas | latest stable |
| PDF generation | reportlab | latest |
| Word generation | python-docx | latest |
| Push notifications | apns2 | latest |
| Web templates | Jinja2 (via FastAPI) | built-in |
| HTTP server | uvicorn + gunicorn | latest |
| Task queue | None in v1 (async FastAPI is sufficient) | — |
| Caching | None in v1 | — |

### 2.1 Database Schema (core tables)

```sql
users               — id, email, apple_sub, hashed_password, plan, created_at
projects            — id, user_id, title, status, steps_json, created_at
instruments         — id, name, construct, items_json, scoring_json, apa_ref
surveys             — id, project_id, token, status, config_json, created_at
survey_responses    — id, survey_id, answers_json, completed_at
analyses            — id, project_id, test_type, input_json, result_json
apa_documents       — id, project_id, content_json, pdf_url, docx_url
subscriptions       — id, user_id, provider, product_id, expires_at, status
```

### 2.2 API Structure

```
/auth
  POST /auth/register
  POST /auth/login
  POST /auth/apple
  POST /auth/refresh

/projects
  GET    /projects
  POST   /projects
  GET    /projects/{id}
  PUT    /projects/{id}
  DELETE /projects/{id}

/projects/{id}/steps
  PUT /projects/{id}/steps/{step_number}   — saves step data + triggers Claude

/instruments
  GET /instruments                          — list with filters (construct, name)
  GET /instruments/{id}

/surveys
  POST   /surveys                           — create from project
  GET    /surveys/{id}
  GET    /surveys/{id}/responses
  DELETE /surveys/{id}

/s/{token}                                  — PUBLIC: participant survey page (HTML)
POST /s/{token}/respond                     — PUBLIC: submit response

/analysis
  POST /analysis                            — run statistical test, return results

/documents
  POST /documents                           — generate APA draft
  GET  /documents/{id}/pdf                  — download PDF
  GET  /documents/{id}/docx                 — download .docx (paid only)

/subscriptions
  POST /subscriptions/verify                — verify RevenueCat receipt
  GET  /subscriptions/status
```

---

## 3. iOS Stack

| Layer | Technology |
|---|---|
| Language | Swift 5.10 |
| UI framework | SwiftUI |
| Architecture | MVVM (`@ObservableObject` + `@StateObject`) |
| Networking | URLSession + async/await (no Alamofire) |
| Keychain | Security framework (no third-party) |
| Auth | AuthenticationServices (Sign in with Apple) |
| Payments | StoreKit 2 |
| Push | UserNotifications + APNs |
| PDF preview | PDFKit |
| QR generation | CoreImage CIFilter |
| Share sheet | UIActivityViewController |
| Min iOS | iOS 17.0 |
| Xcode | 16+ |

### 3.1 App Structure

```
ios/
├── PsychologyDictionary/
│   ├── App/
│   │   └── PsychologyDictionaryApp.swift
│   ├── Core/
│   │   ├── Network/APIClient.swift
│   │   ├── Auth/AuthManager.swift
│   │   ├── Store/StoreManager.swift          — StoreKit 2
│   │   └── Push/PushManager.swift
│   ├── Features/
│   │   ├── Auth/                             — Login, Register, Apple Sign In
│   │   ├── Dashboard/                        — Project list
│   │   ├── Research/
│   │   │   ├── Step1_Topic/
│   │   │   ├── Step2_Question/
│   │   │   ├── Step3_Hypothesis/
│   │   │   ├── Step4_Variables/
│   │   │   ├── Step5_Method/
│   │   │   ├── Step6_Instruments/
│   │   │   ├── Step7_Analysis/
│   │   │   └── Step8_Limitations/
│   │   ├── Survey/                           — Builder, distribution, QR
│   │   ├── Responses/                        — Dashboard, live count
│   │   ├── Analysis/                         — Results display
│   │   └── Document/                         — APA viewer, export
│   └── Resources/
│       ├── Localizable.strings
│       └── Assets.xcassets
```

### 3.2 StoreKit 2

- Product ID: `com.psychologydictionary.pro.annual` — $79.99/year
- Verification on backend (POST /subscriptions/verify with RevenueCat)
- `StoreManager` checks entitlement before any paid action
- Restore purchases on Settings screen

---

## 4. AI Integration (Claude API)

### 4.1 Model
- Model: `claude-sonnet-4-6`
- Always use prompt caching (`cache_control: {"type": "ephemeral"}`) on system prompts
- Prompts live in `backend/prompts/` as `.txt` files, loaded at startup

### 4.2 Prompt Files

```
backend/prompts/
├── system_base.txt          — base system prompt (APA 7th edition rules, psychology context)
├── step1_topic.txt          — topic → researchable phenomena
├── step2_question.txt       — topic → research question
├── step3_hypothesis.txt     — question + variables → directional/non-directional hypothesis
├── step4_variables.txt      — hypothesis → IV, DV, covariates, operationalization
├── step5_method.txt         — variables → design recommendation with justification
├── step6_instrument.txt     — variable → instrument recommendation or custom builder
├── step7_analysis.txt       — design + data → statistical test recommendation
├── step7_interpret.txt      — test results → APA interpretation paragraph
├── step8_limitations.txt    — full project → threats to validity
└── apa_document.txt         — full project → complete APA 7th edition draft
```

### 4.3 Cost Control
- Cache system prompt + step history on every call (reduces token cost ~80%)
- APA document generation is the most expensive call (~4,000 output tokens) — only triggered on explicit user action
- No streaming in v1 — full response then render

---

## 5. Statistical Analysis

All computation runs on the backend via scipy/statsmodels.

| Test | scipy function | Effect size |
|---|---|---|
| Independent t-test | `scipy.stats.ttest_ind` | Cohen's d |
| Paired t-test | `scipy.stats.ttest_rel` | Cohen's d |
| One-way ANOVA | `scipy.stats.f_oneway` | η² (eta-squared) |
| Pearson correlation | `scipy.stats.pearsonr` | r |
| Spearman correlation | `scipy.stats.spearmanr` | r |
| Multiple regression | `statsmodels.OLS` | R² |
| Chi-square | `scipy.stats.chi2_contingency` | Cramér's V |

Input: JSON array of data columns  
Output: `{statistic, p_value, effect_size, effect_label, ci_95, interpretation_apa}`

---

## 6. Document Generation

### PDF (reportlab)
- APA 7th edition margins: 1 inch all sides
- Font: Times New Roman 12pt
- Running head, page numbers, proper heading levels (Heading 1–3)
- Generated server-side, stored on DigitalOcean Spaces (or local volume), URL returned to iOS

### .docx (python-docx)
- Same structure as PDF
- Editable — student can open in Word and modify before submission
- Paid tier only

---

## 7. Push Notifications (APNs)

- Backend holds APNs device token per user (stored in `users` table)
- Trigger: new survey response received → `POST /s/{token}/respond` → send APNs notification
- Payload: `{"aps": {"alert": "New response received", "badge": N, "sound": "default"}}`
- Use APNs HTTP/2 provider API via `apns2` Python library
- APNs certificate stored as environment variable (p8 key file)

---

## 8. Infrastructure (DigitalOcean)

| Component | Spec |
|---|---|
| Droplet | Basic — 2 vCPU, 4GB RAM, 80GB SSD |
| OS | Ubuntu 24.04 LTS |
| Web server | Nginx (reverse proxy to uvicorn) |
| Process manager | systemd (gunicorn workers) |
| SSL | Let's Encrypt (certbot) |
| Database | PostgreSQL 16 (same droplet, v1) |
| File storage | DigitalOcean Spaces (PDF/docx files) |
| Domain | psychologydictionary.app (or similar) |
| Backups | DigitalOcean automated weekly backups |

### Environment Variables (never commit)
```
DATABASE_URL
SECRET_KEY
ANTHROPIC_API_KEY
APPLE_TEAM_ID
APPLE_KEY_ID
APPLE_PRIVATE_KEY
APNS_CERT_PATH
REVENUECAT_API_KEY
SPACES_KEY
SPACES_SECRET
SPACES_BUCKET
```

---

## 9. Security

- HTTPS everywhere (no HTTP endpoints in production)
- JWT tokens expire in 7 days, refresh tokens 30 days
- bcrypt rounds: 12
- All DB queries via SQLAlchemy ORM (no raw SQL → no injection)
- Survey response endpoints rate-limited: 100 req/min per IP (slowapi)
- Participant data: no PII stored unless researcher explicitly adds name/email field
- GDPR: `DELETE /users/me` cascades and hard-deletes all user data

---

## 10. Development Setup

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in values
alembic upgrade head
uvicorn main:app --reload

# iOS
open ios/PsychologyDictionary.xcodeproj
# Set DEVELOPMENT_TEAM in Signing & Capabilities
# Run on simulator or device
```

---

## 11. Definition of Done (per feature)

- [ ] Backend endpoint tested with curl / Postman
- [ ] Alembic migration created for any schema change
- [ ] iOS ViewModel unit-testable (no SwiftUI dependency in VM logic)
- [ ] Free/paid gate tested both paths
- [ ] No API keys in source code
