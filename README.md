# 📊 Talent Acquisition Intelligence Dashboard

> **Boardroom-ready live recruitment analytics.**  
> Pulls data directly from Google Sheets, processes all KPIs server-side in a Netlify Function, and renders a premium interactive multi-tab dashboard — zero manual exports required.

---

## Overview

A production-grade HR analytics dashboard that connects to live Google Sheets data (published as CSV), computes all pipeline metrics in a Netlify Serverless Function, and presents a fully interactive dashboard built with TanStack Start + React 19.

### What It Tracks

| Domain | Metrics |
|--------|---------|
| **Pipeline** | Total applicants, funnel conversion, screen shortlist rate, offer rate |
| **Hiring** | Joined count, hiring rate, offer acceptance rate, offer drop rate |
| **Vacancies** | Total open, filled, on-hold, in-process, fill rate % |
| **Business Units** | Per-BU applicants, joined, conversion rate, avg time-to-fill |
| **Recruiters** | Applications handled, offers made, joins, conversion %, offer drop % |
| **Sources** | Channel volume, joining rate — to identify best-performing pipelines |
| **Timeline** | Hiring speed per position per BU across 7 stages (Req → App → Screen → R1 → R2 → R3 → Offer → Hire) |
| **Leakage** | Candidate drops, R1/R2 rejects, no-shows, offer drops, screen rejects |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | TanStack Start v1 |
| Frontend | React 19, TanStack Router v1 |
| Build | Vite 7 |
| Styling | Tailwind CSS 4 + custom CSS design tokens |
| Charts | Chart.js 4 via react-chartjs-2 |
| Serverless | Netlify Functions (`@netlify/functions`) |
| Language | TypeScript 5.9 (strict mode) |
| Hosting | Netlify |

**Design System**: Amber/teal/warm/brick/slate palette with Playfair Display serif headings and Inter sans-serif body. All KPI cards use glassmorphism and micro-animations.

---

## Dashboard Tabs

### 📊 Overview
- Executive KPI strip — Total Applicants, Hiring Rate, Offer Acceptance %, Avg Time to Fill, Total Vacancies, Candidate Drops
- Recruitment funnel with conversion rates at every drop-off point
- Source channel efficiency table ranked by joining rate

### 🏢 Performance
- Business Unit performance bars (applicants → joined → time-to-fill)
- Pipeline leakage breakdown (candidate drops, R1/R2 rejects, no-shows, offer drops)
- Vacancy tracker with fill rate progress bar and BU-wise fill status

### 📈 Analytics
- **4 metric tiles**: Avg Pipeline Speed, Fastest Hire, Longest Pipeline, Positions Tracked
- Compact quarterly applicant vs. joining trend bar chart with Q1–Q4 stat cards
- Recruiter performance matrix with performance badges and offer-drop comparison
- **Hiring Timeline table** — per position per BU, average days across all 7 hiring stages with colour-coded pill badges and mini stacked progress bars
- Top rejection reasons and top offer decline reasons

### 💼 Positions
- Top 14 positions by applicant volume with joining success rate bars

### 📖 Glossary
Three sub-sections accessible via a sub-navigation bar:
- **KPI Definitions** — Icon + definition + formula badge cards, grouped into Pipeline Metrics and Vacancy Metrics
- **Status Rules** — Priority-ordered table showing which status keywords map to which category (colour-coded badges)
- **Column Aliases** — Reference tables for all accepted column header names in both Applicants and Vacancies sheets

---

## Architecture

```
Browser
  └─▶ Login screen (SHA-256 hashed credentials)
        └─▶ ConfigDialog — choose FY 2025-26 / FY 2026-27 / Custom URLs
              └─▶ GET /.netlify/functions/dashboard-data?applicants=...&vacancies=...
                    ├─▶ Fetch Applicants CSV (Google Sheets, server-side)
                    ├─▶ Fetch Vacancies CSV (Google Sheets, server-side)
                    ├─▶ Parse & classify all rows (kpi-config.ts)
                    ├─▶ Compute KPIs, funnels, timelines, leakage
                    └─▶ Return JSON → React renders full dashboard
```

### Key Files

```
├── src/
│   ├── config.ts                  # FY 2025-26 & FY 2026-27 CSV URLs
│   └── routes/
│       ├── __root.tsx             # Root layout, page title, Google Fonts
│       └── index.tsx              # Full dashboard UI — login, config, all 5 tabs
├── netlify/
│   └── functions/
│       ├── dashboard-data.ts      # Serverless fn: fetch → parse → compute → respond
│       └── kpi-config.ts          # Status patterns, column mappings, KPI formulas
├── netlify.toml                   # Build & dev server config
└── vite.config.ts                 # Vite + TanStack Start + Netlify plugin config
```

---

## Data Sources

Two Google Sheets tabs published as CSV (**File → Share → Publish to web → CSV**).

The dialog at first load lets you pick:
- **FY 2025–26** — pre-configured (hardcoded in `src/config.ts`)
- **FY 2026–27** — second pre-configured source (same config file)
- **Custom** — paste your own CSV URLs

### Applicants Sheet — Supported Column Names

| Field | Accepted Column Headers |
|-------|------------------------|
| Status | `Status`, `Current Status`, `Stage`, `Pipeline Stage`, `Recruitment Status` |
| Source | `Source`, `Source Channel`, `Channel`, `Source of Application` |
| Business Unit | `Business Unit`, `BU`, `Company`, `Division`, `Department`, `Entity` |
| Position | `Position`, `Role`, `Job Title`, `Designation`, `Opening`, `Vacancy` |
| Recruiter | `Recruiter`, `Assigned To`, `HR`, `RM`, `Talent Acquisition`, `SPOC` |
| Application Date | `Application Start Date`, `Date`, `Applied Date`, `Date of Application` |
| Quarter | `Quarter`, `Q`, `FY Quarter` *(or derived from application date — Indian FY)* |
| Joining Date | `Hired Date`, `Joining Date`, `Date of Joining`, `DOJ`, `Join Date`, `Onboarding Date` |
| Req. Date *(optional)* | `Requisition Date`, `Job Req Date`, `Req Date`, `Job Requisition` |
| Screening Date *(optional)* | `Screening Date`, `Screen Date`, `Profile Shared Date` |
| R1 Date *(optional)* | `1st Round Date`, `R1 Date`, `Round 1 Date`, `L1 Date`, `Interview 1 Date` |
| R2 Date *(optional)* | `2nd Round Date`, `R2 Date`, `Round 2 Date`, `L2 Date`, `Interview 2 Date` |
| R3 Date *(optional)* | `3rd Round Date`, `R3 Date`, `Round 3 Date`, `L3 Date`, `Interview 3 Date` |
| Offer Date *(optional)* | `Offer Date`, `Offer Extended Date`, `Date of Offer` |
| Rejection Reason *(optional)* | `Reason for Rejection`, `Rejection Reason`, `Reason` |

> Column names are matched **case-insensitively** and via partial match — `Business Unit` and `BU` both work.

### Vacancies Sheet — Supported Column Names

| Field | Accepted Column Headers |
|-------|------------------------|
| Vacancy Status | `Status`, `Vacancy Status`, `Position Status`, `Stage`, `Number of Positions Closed` |
| Business Unit | `Business Vertical`, `Business Unit`, `BU`, `Company`, `Division`, `Department` |

#### Vacancy Status Values

| Status Value | Maps To |
|-------------|---------|
| `Closed` / `Hired` / `Joined` / `Placed` | Filled |
| `Hold` / `Paused` / `Deferred` / `Frozen` | On Hold |
| `Active` / `Ongoing` / `Open` / `Live` / `0` | In Process |

---

## Status Classification

Each candidate's status is classified using priority-order regex matching — first match wins:

| Priority | Category | Matched Keywords / Patterns |
|----------|----------|-----------------------------|
| 1 | **Joined** | `join`, `onboard` |
| 2 | **Offer Drop** | `offer drop`, `drop offer` |
| 3 | **Offer** | `offer`, `offer extend`, `extended` |
| 4 | **Dropped** | `drop`, `candidate drop`, `not interested`, `withdrawn`, `declined` |
| 5 | **R1 Reject** | `r1 reject`, `round 1 reject`, `l1 reject`, `1st reject` |
| 6 | **R2 Reject** | `r2 reject`, `round 2 reject`, `l2 reject`, `2nd reject` |
| 7 | **No Show** | `no show`, `no-show`, `absent` |
| 8 | **Screen Reject** | `screen reject`, `profile reject`, `not shortlisted`, `rejected` |
| 9 | **Shortlisted** | `shortlist`, `screen pass`, `l1 pass`, `selected`, `profile shar` |

*To add new status keywords or change matching rules, edit `STATUS_PATTERNS` in [`netlify/functions/kpi-config.ts`](netlify/functions/kpi-config.ts).*

---

## Quarter Derivation (Indian Financial Year)

If no explicit `Quarter` column is present, quarters are derived from the Application Date:

| Quarter | Months |
|---------|--------|
| **Q1** | April – June |
| **Q2** | July – September |
| **Q3** | October – December |
| **Q4** | January – March |

---

## Local Development

### Prerequisites

- Node.js 18+
- [Netlify CLI](https://docs.netlify.com/cli/get-started/) — required to run the serverless function locally

```bash
npm install -g netlify-cli
```

### Run

```bash
# Clone and install
git clone https://github.com/senarkit/HR-Dashboard.git
cd HR-Dashboard
npm install

# Start with Netlify Dev (runs the function at /.netlify/functions/dashboard-data)
netlify dev
```

App is available at **http://localhost:8888**

> Running `npm run dev` alone (port 3000) works for UI development only — the data fetch will fail without the Netlify function proxy.

---

## Deployment

Push to GitHub and connect the repo to [Netlify](https://netlify.com). The `netlify.toml` handles the rest:

```toml
[build]
  command   = "vite build"
  publish   = "dist/client"

[dev]
  command    = "npm run dev"
  targetPort = 3000
  port       = 8888
```

No environment variables are required — Google Sheets CSV URLs are embedded in `src/config.ts` and fully configurable via the on-screen dialog at first load.

---

## Security

- The dashboard is gated by a **login screen with SHA-256 hashed credentials** — plaintext passwords are never stored or transmitted.
- Sessions are held in `sessionStorage` (cleared automatically on tab close).
- All CSV fetching is done **server-side** in the Netlify Function — the browser never makes cross-origin requests to Google Sheets.

---

## Customisation

| What to change | Where |
|----------------|-------|
| Add a new FY data source | `src/config.ts` + `ConfigDialog` in `src/routes/index.tsx` |
| Status keyword matching | `STATUS_PATTERNS` in `netlify/functions/kpi-config.ts` |
| Column name aliases | `COLUMN_CANDIDATES` / `VACANCY_COLUMN_CANDIDATES` in `netlify/functions/kpi-config.ts` |
| KPI formulas and thresholds | `KPI_FORMULAS` in `kpi-config.ts` |
| Colour palette / design tokens | `src/styles.css` |
| Dashboard layout & panels | `src/routes/index.tsx` |
| Default CSV URLs | `src/config.ts` |

---

## License

MIT — see [LICENSE](LICENSE)
