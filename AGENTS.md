# AGENTS.md

Project: Live recruitment analytics dashboard for FY 2025–26. Pulls data from Google Sheets (published as CSV), processes it in a Netlify Function, and renders a boardroom-ready dashboard built with TanStack Start and React.

## Architecture

### Data Flow
1. Browser loads → `ConfigDialog` shown (override CSV URLs or use defaults)
2. On confirm → `fetch('/.netlify/functions/dashboard-data')` called
3. Netlify Function fetches both Google Sheets CSV URLs server-side (bypasses CORS)
4. CSV parsed; all KPIs/metrics computed in the function
5. JSON returned to client; React renders the full dashboard

### Key Files
- `src/routes/index.tsx` — Full dashboard: ConfigDialog, data fetching, all visual panels (~3600 LOC)
- `netlify/functions/dashboard-data.ts` — Serverless function: CSV fetch, parse, metric computation
- `netlify/functions/kpi-config.ts` — KPI configuration and thresholds
- `src/config.ts` — App-level config (e.g. default CSV URLs)
- `src/styles.css` — CSS custom properties design tokens (amber/teal/warm/brick/slate palette)
- `src/routes/__root.tsx` — Root layout with Google Fonts links

### Design System
All colours are CSS custom properties. **No Tailwind utilities in the dashboard** — all inline styles for pixel-precise control matching the design reference at `public/recruitment_dashboard.html`.

### Column Detection
The CSV parser uses `findCol()` with multiple candidate names to adapt to varied Google Sheet headings (e.g. "Business Unit" / "BU" / "Company" / "Division").

### Status Classification
Priority regex order: `joined > offer-drop > offer > drop > r1-reject > r2-reject > no-show > screen-reject > shortlisted`. Each applicant counted in exactly one category.

### Quarter Derivation
Falls back: explicit "Quarter" column → date parsing (Indian FY: Apr–Jun = Q1, Jul–Sep = Q2, Oct–Dec = Q3, Jan–Mar = Q4).

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | TanStack Start |
| Frontend | React 19, TanStack Router v1 |
| Build | Vite 7 |
| Styling | Tailwind CSS 4 (base only; dashboard uses inline styles) |
| Charts | Chart.js 4, react-chartjs-2 |
| Icons | lucide-react |
| State | @tanstack/react-store |
| Language | TypeScript 5.9 (strict mode) |
| Deployment | Netlify |

## Directory Structure

```
├── netlify/functions/
│   ├── dashboard-data.ts   # CSV fetch, parse, all metric computation
│   └── kpi-config.ts       # KPI thresholds and configuration
├── public/
│   ├── favicon.ico
│   ├── dashboard_preview.png
│   ├── dashboard_walkthrough.webp
│   ├── hero-bg.png
│   └── recruitment_dashboard.html  # Design reference
├── src/
│   ├── config.ts           # App config (default CSV URLs, etc.)
│   ├── router.tsx          # TanStack Router setup
│   ├── routeTree.gen.ts    # Auto-generated route tree
│   ├── styles.css          # Design tokens + Tailwind base
│   └── routes/
│       ├── __root.tsx      # Root layout: fonts, global styles
│       └── index.tsx       # Full dashboard (~3600 LOC)
├── check.js                # Dev utility: CSV column check
├── fix_file.js / fix_file.py  # Data repair scripts
├── test.js                 # Dev test script
├── validate_kpis.mjs       # KPI validation script
├── AGENTS.md
├── netlify.toml            # Build: vite build → dist/client; dev port 8888→3000
├── package.json
├── tsconfig.json           # ES2022, strict, @/* alias → src/*
└── vite.config.ts
```

## Routing

Routes live in `src/routes/`:
- `__root.tsx` — Root layout
- `index.tsx` — Dashboard at `/`

## Configuration Files

| File | Purpose |
|------|---------|
| `vite.config.ts` | TanStack Start, Netlify, Tailwind plugins |
| `tsconfig.json` | Strict TS, `@/*` → `src/*` |
| `netlify.toml` | Build command, publish dir, dev ports |
| `src/config.ts` | Default CSV URLs and app constants |

## Development Commands

```bash
npm run dev    # Vite dev server on port 3000 (Netlify dev on 8888)
npm run build  # Production build → dist/client
```

## Conventions

### Styling
- Dashboard panels: **inline styles only** (no Tailwind utilities)
- CSS custom properties for all colour tokens in `styles.css`
- Tailwind used only for global base/reset

### TypeScript
- Strict mode; `@/` path alias
- Type-only imports with `type` keyword

### State
- React hooks for local state
- `@tanstack/react-store` available for shared state

### Chart.js
Register components before use: `CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler`.
