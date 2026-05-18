# Product Requirements Document
## Psychology Dictionary: AI Tutor

**Version**: 1.0  
**Date**: 2026-05-18  
**Status**: Active

---

## 1. Problem

Psychology courses at US universities (SJSU, GVSU, and hundreds of others) require students to independently design empirical research studies: formulate hypotheses, select variables, choose a methodology, build data collection instruments, run statistical analyses, and write APA-format reports. Students do this with little scaffolding, resulting in poorly designed studies, incorrect statistical choices, and APA formatting errors that cost them grades.

No tool today guides a psychology student through the full research design pipeline end-to-end.

---

## 2. Solution

**Psychology Dictionary: AI Tutor** is an iOS app that walks students and researchers through every phase of empirical research design using a structured, AI-powered wizard. The app combines validated academic templates with Claude AI to generate hypotheses, operationalize variables, recommend and build measurement instruments, run statistical analyses, and produce a complete APA 7th edition draft document ready to submit.

---

## 3. Target Users

| User | Description |
|---|---|
| **Primary** | Undergraduate/graduate psychology students at US universities |
| **Secondary** | Practicing psychologists and researchers needing quick study design support |

**Market**: English-speaking, US-focused. Aware of APA standards. Familiar with terms like IV/DV, t-test, Likert scale.

---

## 4. Research Design Workflow (Core Feature)

The app guides users through 8 sequential steps. Each step uses Claude AI to generate content based on user input and prior steps.

| Step | Feature | AI Role |
|---|---|---|
| 1 | **Topic** | Suggests researchable psychological phenomena from a keyword |
| 2 | **Research Question** | Converts a topic into a formal research question |
| 3 | **Hypothesis** | Generates directional and non-directional hypotheses |
| 4 | **Variables** | Identifies IV, DV, covariates; operationalizes each variable |
| 5 | **Method** | Recommends experimental, correlational, or quasi-experimental design with justification |
| 6 | **Instrument** | Builds custom survey or selects from validated instrument bank |
| 7 | **Analysis** | Recommends and **executes** appropriate statistical test; interprets results in APA language |
| 8 | **Limitations** | Identifies threats to internal and external validity |

---

## 5. Validated Instrument Bank

- Library of 50+ psychometrically validated scales
- Examples: GAD-7, PHQ-9, Big Five Inventory (BFI), Rosenberg Self-Esteem Scale, Beck Depression Inventory, UCLA Loneliness Scale, PSS-10, STAI, PCL-5
- Each instrument includes: full item text, response format, scoring instructions, interpretation guidelines, and APA 7th edition reference
- AI recommends the appropriate instrument based on the operationalized variable
- Researchers can also build fully custom instruments

---

## 6. Survey Distribution & Data Collection

- Researcher creates survey inside the app
- App generates a unique web link (`https://api.psychologydictionary.app/s/{token}`) and QR code
- Participants open link in any browser (iOS, Android, desktop) — no app required
- Responses stored anonymously by default
- Researcher receives real-time push notification on iPhone for each response
- Dashboard shows response count, completion rate, and basic demographics

---

## 7. Statistical Analysis

The app **executes** analyses on the backend (Python/scipy), not just recommends them.

| Test | When Suggested |
|---|---|
| Independent samples t-test | 2 groups, continuous DV |
| Paired samples t-test | Pre/post, same group |
| One-way ANOVA | 3+ groups, continuous DV |
| Pearson/Spearman correlation | Relationship between two continuous variables |
| Multiple regression | Predicting DV from multiple IVs |
| Chi-square | Categorical variables |

Results are returned with: test statistic, p-value, effect size (Cohen's d, η², r), confidence intervals, and an AI-generated APA-format interpretation paragraph.

---

## 8. APA Document Generation

- Claude generates a complete APA 7th edition draft from all project data
- Sections: Title Page, Abstract, Introduction, Method, Results, Discussion, References, Appendices
- Exported as **PDF** and **.docx** (Word)
- Free tier: view draft in-app only
- Paid tier: export PDF + .docx

---

## 9. Monetization

| Plan | Price | Limits |
|---|---|---|
| **Free** | $0 | 1 project, 50 survey responses, in-app APA preview only |
| **Pro Annual** | $70/year | Unlimited projects, unlimited responses, PDF + .docx export, all statistical tests |

- Payment via Apple StoreKit 2 (in-app purchase)
- No monthly plan in v1
- Gate enforced on backend — client cannot bypass

---

## 10. Authentication

- Sign in with Apple (required by App Store guidelines)
- Email/Password (for access from non-Apple devices)
- Survey participants do not require accounts

---

## 11. Data & Privacy

- All data stored on DigitalOcean (US region)
- Survey participant responses anonymized by default
- FERPA-ready: no sharing of student data with institutions
- GDPR: account deletion removes all associated data
- No HIPAA certification in v1
- Researcher is responsible for obtaining participant informed consent (app provides consent form template)

---

## 12. Platform

| Component | Platform |
|---|---|
| Researcher app | iOS (iPhone), SwiftUI |
| Survey participant | Any web browser via link |
| Backend API | DigitalOcean, Python/FastAPI |

Android and iPad not in v1 scope.

---

## 13. Non-Goals (v1)

- Android app
- Collaboration / multi-researcher projects
- Integration with SPSS, R, jamovi
- IRB submission assistance
- Literature review / citation search
- In-app messaging between researcher and participants
- HIPAA certification

---

## 14. Success Metrics

| Metric | Target (6 months post-launch) |
|---|---|
| App Store downloads | 2,000+ |
| Free-to-paid conversion | ≥ 8% |
| Projects completed (all 8 steps) | ≥ 40% of started projects |
| APA documents exported | ≥ 500 |
| App Store rating | ≥ 4.5 stars |
