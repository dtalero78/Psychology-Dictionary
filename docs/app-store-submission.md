# Psychology Dictionary Lab — App Store Submission Checklist

> Everything you need to paste into App Store Connect to submit Build #12 for review.
> Updated: 2026-06-15.

---

## 1. URLs (live on production after this commit deploys)

| Field in ASC | URL |
|---|---|
| **Privacy Policy URL** *(required)* | `https://api.psychologydictionary.app/privacy` |
| **Terms of Use (EULA) URL** *(required for auto-renewing sub)* | `https://api.psychologydictionary.app/terms` |
| **Support URL** *(required)* | `https://api.psychologydictionary.app/support` |
| **Marketing URL** *(optional)* | leave blank or `https://api.psychologydictionary.app/support` |

---

## 2. App Store listing content

### Name (already set)
```
Psychology Dictionary Lab
```

### Subtitle (max 30 chars)
```
Research, redesigned for iOS
```

### Promotional Text (max 170 chars — editable later without resubmitting)
```
Design rigorous psychology research from your phone. Eight guided steps, real statistical tests, full APA 7th edition papers — generated in minutes.
```

### Description (max 4000 chars)
```
Psychology Dictionary Lab is the modern research companion for psychology students, graduate researchers, and educators. Walk through a structured eight-step wizard that turns a vague research question into a publication-ready study design — and a complete APA 7th edition paper — without leaving your iPhone.

WHAT YOU CAN DO

• Design a study in eight guided steps
  Topic, variables, hypothesis, sample, method, instruments, analysis plan, ethics. Each step offers AI-generated suggestions you can accept, edit, or rewrite.

• Run real statistical tests
  Independent and paired t-tests (Welch), one-way ANOVA, Pearson and Spearman correlations, multiple regression, chi-square. Every result includes the appropriate effect size (Cohen's d, η², Cramer's V, Pearson r) and a 95% confidence interval — computed with scipy and statsmodels.

• Collect survey responses anonymously
  Send a survey link to your participants. Responses arrive instantly. Participant IPs are one-way hashed for fraud prevention; no names, emails, or trackers are stored.

• Generate full APA 7th edition papers
  Abstract, introduction, method, results, discussion, references — all written for you from your project content, ready to export as PDF (Pro: also Word .docx).

WHO IT'S FOR

• Undergraduate students writing their first research methods paper
• Graduate students preparing thesis pilot studies
• Educators demonstrating the full research cycle in class
• Independent researchers iterating on small-sample studies

PRIVACY-FIRST

We collect the minimum data needed to run the service. No third-party analytics. No advertising trackers. Survey participants stay anonymous unless YOU explicitly ask them otherwise. Read the full Privacy Policy in-app.

FREE TIER

One research project, up to 50 survey responses, full statistical analysis, PDF export of APA papers.

PRO ($79.99/year)

Unlimited projects, unlimited survey responses, Word (.docx) export, priority email support.

— — —

Subscriptions auto-renew annually unless cancelled at least 24 hours before the period ends. Manage or cancel anytime in iOS Settings → your name → Subscriptions. Terms: https://api.psychologydictionary.app/terms · Privacy: https://api.psychologydictionary.app/privacy
```

### Keywords (max 100 chars total, comma-separated, no spaces around commas)
```
psychology,research,APA,statistics,survey,thesis,t-test,ANOVA,methods,wizard,grad,student,paper
```

### Category
- **Primary**: Education
- **Secondary**: Reference

### Age Rating
Run the questionnaire in ASC; expected result is **4+** (no objectionable content). Answer "No" to all sensitive-content questions.

---

## 3. App Privacy questionnaire (Data Collection)

App Store Connect → App Privacy. Click **"Get Started"** and answer:

### Data Collection: YES, we collect data.

Add **each** of the following data types (with the exact ASC checkbox names):

#### Contact Info → Email Address
- Linked to user: **YES**
- Used for tracking: **NO**
- Purposes: *App Functionality* (authentication), *Account Management*

#### Identifiers → User ID
- Linked to user: **YES**
- Used for tracking: **NO**
- Purposes: *App Functionality*
- *(This is our internal UUID and, if Apple Sign In, the opaque apple_sub.)*

#### Purchases → Purchase History
- Linked to user: **YES**
- Used for tracking: **NO**
- Purposes: *App Functionality* (Pro subscription verification)

#### User Content → Other User Content
- Linked to user: **YES**
- Used for tracking: **NO**
- Purposes: *App Functionality*
- *(Research project content, survey configurations, generated APA papers.)*

#### Diagnostics → Performance Data
- Linked to user: **NO**
- Used for tracking: **NO**
- Purposes: *App Functionality* (server log timestamps & status codes)

### Survey participant data ("third-party" responses)

ASC's privacy form is scoped to the iOS app user, not third parties who respond to a survey hosted on our web. You do NOT need to declare participant survey responses here — they are collected via web from non-app users and our backend (which is separately documented in the Privacy Policy URL).

### Tracking: NO

Answer **"No, we do not use third-party SDKs that track"** when asked.

---

## 4. In-App Purchase setup

Before submitting the app, configure the IAP in **App Store Connect → Features → In-App Purchases**:

1. **Create Subscription Group**: `psydict-pro` (display name: "Psychology Dictionary Lab Pro")
2. **Add Auto-Renewable Subscription**:
   - Product ID: `com.psychologydictionary.pro.annual`
   - Reference Name: `Pro Annual`
   - Duration: 1 Year
   - Price: USD $79.99 (Tier 80 or equivalent)
3. **Localized Display Name** (English): `Pro Annual`
4. **Localized Description**: `Unlimited projects, unlimited survey responses, Word document export, and priority support.`
5. **Review Information**:
   - Screenshot: a paywall screenshot from the app (from Settings tab)
   - Review notes: `Test by tapping "Upgrade to Pro" in Settings. Sandbox account: ${use Apple's sandbox tester account}.`
6. Submit the IAP for review **with the app's build** (toggle the IAP into the build's submission).

---

## 5. Build & Version

- **Build**: #12 (commit `e290e28`, version 1.0.0) — already uploaded.
- **Copyright**: `© 2026 Daniel Talero`
- **Version Release**: Manual release after approval (recommended for first submission so you can verify everything before going live).
- **What's New in This Version**: leave blank or `Initial release.`

---

## 6. App Review Information (Notes for Apple)

Paste this into the App Review Information notes field:

```
DEMO ACCOUNT (email / password):
  danieltest@example.com
  Bienvenido2026

This is a research-design and statistics app for psychology students and researchers.

KEY FLOWS TO TEST:

1. Sign in with the demo account above (email/password). Apple Sign In is also implemented; it works in App Store builds.

2. Tap "New Project" on the dashboard. Enter any title. The app navigates to a guided research design wizard with 8 steps (Topic → Ethics). Tap each step's "Generate" button to see AI-assisted suggestions from Anthropic Claude.

3. From a project, tap "Surveys" to create a participant survey. Tap "Share" to see the public survey URL (the URL is also viewable at https://api.psychologydictionary.app/s/{token} from any browser).

4. Tap "Analysis" to run statistical tests. The demo account has no real data; use the "Enter data" mode and paste sample numbers (e.g. group 1: 3,4,5,4,3 and group 2: 2,3,2,3,2 for an independent t-test).

5. Tap "APA Report" → "Generate APA Report". The first APA generation takes 60–120 seconds because the backend runs an async Claude call and the mobile client polls for completion. A spinner with "Generating…" is shown while polling.

PAYWALL:
The free tier permits 1 project and 50 survey responses. Tap Settings → "Upgrade to Pro" to see the paywall and exercise the StoreKit flow.

SUBSCRIPTION:
Pro is an auto-renewing $79.99/year subscription with product id com.psychologydictionary.pro.annual. Restore Purchases is implemented in Settings.

PRIVACY:
We do not collect survey participants' personal information. Participant IPs are one-way hashed for fraud prevention only. Privacy Policy: https://api.psychologydictionary.app/privacy

If anything is unclear or you have trouble accessing the demo account, please email support@psychologydictionary.app and we'll respond within hours.

Thank you for reviewing!
— Daniel
```

### Contact Information
- **First name**: Daniel
- **Last name**: Talero
- **Phone number**: (your real number)
- **Email**: support@psychologydictionary.app *(or your personal address)*

### Attachment
- Attach a single PDF or PNG that shows what a generated APA paper looks like (optional but helps reviewers understand the value).

---

## 7. Screenshots (PENDING — needs your action)

Apple requires **at least 3, max 10** screenshots per device size you target. We need:

- **6.7" iPhone display** (iPhone 15 Pro Max / 16 Pro Max): 1290 × 2796 px — *MANDATORY*
- **6.5" iPhone display** (iPhone 11 Pro Max): 1284 × 2778 px — recommended (Apple will accept the 6.7" set if you don't provide 6.5")

**3 options to get them**:

| Option | Effort | Quality |
|---|---|---|
| **(a) TestFlight on your iPhone** — take native screenshots: dashboard, wizard step 3, survey detail, analysis result, APA report | 10 min | Authentic |
| **(b) Xcode iOS simulator** | Requires Xcode install (~10 GB) | Authentic |
| **(c) Designer mockups** — composed in Remotion (we already have the patterns) | 30 min | Polished marketing |

Recommended: **(a)** for fastest review approval — Apple prefers authentic device screenshots. I can help compose marketing overlays later for ads.

### App Preview Video
The 39-second 1080×1920 vertical video at `~/Desktop/psydict-tutorial.mp4` is App-Store-compliant and can be uploaded as the **App Preview** for the 6.7" iPhone slot.

---

## 8. Submission steps in App Store Connect

1. Open https://appstoreconnect.apple.com/apps/6771453318
2. **App Information** → set Subtitle, Category, Privacy Policy URL.
3. **Pricing and Availability** → Free (with IAP), choose countries (recommend "All countries").
4. **App Privacy** → run the questionnaire per §3 above.
5. **Version 1.0** (left sidebar) → fill in:
   - Promotional Text, Description, Keywords (§2)
   - Support URL, Marketing URL (§1)
   - Screenshots + App Preview video (§7)
   - Build #12 (Build section → Select Build → choose 1.0.0 (12))
   - App Review Information (§6)
   - Version Release: Manual
6. **In-App Purchases** → create the subscription per §4 and **add it to this version's submission**.
7. Click **Add for Review** → **Submit to App Review**.

Typical review turnaround: 24-48 hours. We'll get an email when it's approved or rejected.

---

## 9. Pending manual actions (you, before submission)

- [ ] Verify the 3 URLs in §1 are live (after the next backend deploy).
- [ ] Take 4-5 screenshots from TestFlight on your iPhone (§7 option a).
- [ ] Create the IAP subscription product in ASC (§4).
- [ ] Paste webhook secret in RevenueCat dashboard (carry-over).
- [ ] Rotate Anthropic + RevenueCat keys (carry-over).
- [ ] Click through ASC submission flow (§8).
