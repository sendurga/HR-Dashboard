# KPI Validation Learnings — HR Dashboard FY 2025-26

## 1. Bug Found & Fixed: Total Applicants Inflated by CSV Parser

### Root Cause
`dashboard-data.ts` originally used a two-function CSV approach:
```
parseCSVLine(line)  →  splits one line by commas
parseCSV(text)      →  splits entire text by \n, then calls parseCSVLine per line
```
The bug was in `parseCSV`: it called `text.split('\n')` **before** checking for quotation marks. Any cell value containing a literal newline (e.g. an email address with an accidental Enter in the Google Sheet) would be split into two rows.

### Real-World Impact
Two candidate rows in the live Google Sheet had embedded newlines inside a quoted email cell:
- **Swapnanil Rudra** — email field: `"swapna.kunal12@gmail.com\n"`
- **Kritish Kumar Nayak** — email field: `"khitishkumarnayak90@gmail.com \n"`

Each created one phantom orphan row, inflating Total Applicants by **+2** (663 shown vs 661 actual). The orphan rows also had misaligned column data, silently corrupting BU, recruiter, and status metrics for those two candidates.

### Fix Applied
Replaced both functions with a single character-by-character `parseCSV` that only treats `\n` as a row break when **outside** quotes. File: `netlify/functions/dashboard-data.ts`.

---

## 2. KPI Validation Checklist

### 2a. Row Count
- Compare fixed vs buggy parser row count. Any diff = embedded newlines in the sheet.

### 2b. Hiring Funnel Monotonicity
```
Applied ≥ Shortlisted ≥ Interviewed ≥ Offered ≥ Joined
```
A violation means status classification logic has a bug.

### 2c. Status Coverage — Known Gaps
Every row must match at least one `STATUS_PATTERNS` entry. Rows matching nothing are counted in `totalApplicants` but contribute to zero funnel metrics.

| Status text in sheet | Pattern that catches it |
|---|---|
| `Candidate Joined` | `/\bjoin/i` ✅ |
| `R1 Reject` | `/r1.*reject/i` ✅ |
| `R2 Reject` | `/r2.*reject/i` ✅ |
| `Screen Reject` | `/screen.*reject/i` ✅ |
| `Offer Drop` | `/offer.*drop/i` ✅ |
| `Candidate Drop` | `/\bdrop\b/i` ✅ |
| `No Show` | `/no.?show/i` ✅ |
| `On Hold` | ⚠️ **No pattern** → uncategorized |
| `Panel Drop` | ⚠️ **No pattern** → uncategorized |
| `R1 Select` | ⚠️ **No pattern** → uncategorized |

> **Action needed**: Add `On Hold`, `Panel Drop`, `R1 Select` to `STATUS_PATTERNS` in `kpi-config.ts`. Until then, these rows bloat `totalApplicants` without contributing to shortlisted/interviewed counts, making the funnel look leaky.

### 2d. Offer Arithmetic
```
pending = offered - joined - offerDrops   (must be >= 0)
```
If negative, a candidate is double-counted in both `joined` and `offerDrops`.

### 2e. Vacancy Status Sum
```
filledVacancies + onHoldVacancies + inProcessVacancies = totalVacancies
```
The vacancy sheet uses the **"Number of Positions Closed"** column (values: `1`, `0`, `Hold`, `In Process`) — not a dedicated Status column. `findCol` resolves this via:
```typescript
['status', 'vacancy status', 'position status', 'stage', 'number of positions closed']
```

### 2f. Quarterly Trend Sums
```
sum(Q1..Q4 applicants) = totalApplicants
sum(Q1..Q4 joined)     = joined
```
Quarter derived from explicit `Quarter` column; falls back to `Application Start Date` using Indian FY (Apr–Jun = Q1, Jul–Sep = Q2, Oct–Dec = Q3, Jan–Mar = Q4).

### 2g. Source / BU / Recruiter Aggregations
```
sum(sourceMap.total) = totalApplicants
sum(buMap.total)     = totalApplicants
sum(recMap.joined)   = joined
```

### 2h. Time to Fill
- Computed as `joinDate − reqDate` (days) for joined candidates only.
- Guarded: only included if `0 < days < 365`.
- Returns `null` if no valid date pairs found.
- **Risk**: If `reqDate` column is missing or misnamed, TTF silently returns `null` with no error.

---

## 3. Column Detection Risks

`findCol()` does exact-match first, then partial-match, then falls back to `candidates[0]` — silently — even if that column doesn't exist. This causes all values for that field to be `''` with no error thrown.

Most fragile columns (names vary across sheets):

| Field | Candidate list |
|---|---|
| `status` | `status`, `current status`, `stage`, `final status` |
| `applicationDate` | `application start`, `application start date`, `date` |
| `businessUnit` | `business unit`, `bu`, `company`, `division` |
| `reqDate` | `requisition date`, `job req date`, `req date` |

**Recommendation**: Log a server-side warning when `findCol` falls through to its default fallback.

---

## 4. Validation Script

Created at `d:\GitHub\HR-Dashboard\validate_kpis.mjs`. Run with `node validate_kpis.mjs`.

Validates: row count (buggy vs fixed), funnel monotonicity, uncategorized statuses, offer arithmetic, vacancy sums, quarterly/source/BU/recruiter aggregation sums, and time-to-fill.

---

## 5. Open Issues Summary

| # | Issue | Severity | Status |
|---|---|---|---|
| 1 | `On Hold`, `Panel Drop`, `R1 Select` statuses uncategorized | Medium | ❌ Open |
| 2 | `findCol` silently falls back to wrong column | Medium | ❌ Open |
| 3 | Embedded newlines in sheet inflate row count | High | ✅ Fixed |
| 5 | `Screen Reject` not counted as shortlisted | Info | ✅ Intentional |
| 6 | Decoupled funnel logic for Highest Stage Reached | High | ✅ Fixed |

---

## 6. Funnel Accuracy: Highest Stage Reached vs. Status

### Root Cause
Originally, the Recruitment Funnel (Applied → Shortlisted → Interviewed → Offered → Joined) was implicitly calculated using the candidate's current `Status`. This caused pipeline leakage metrics to be slightly inaccurate because a `Status` of "Dropped" or "On Hold" obscured *how far* the candidate had actually progressed before dropping. 

### The Fix: Decoupling the Funnel
The funnel logic was decoupled to use the `Highest Stage Reached` column (falling back to `Status` if missing). This ensures that a candidate who dropped at the offer stage is still correctly counted in the Shortlisted, Interviewed, and Offered buckets.

### Regex Traps & Numbered Prefixes
When parsing `Highest Stage Reached`, the raw data contained numbered prefixes and exact string formats (e.g. `2. Screened`, `5. Interviewed`, `6. Offered`).
1. **Word Boundaries Failed:** The pattern `\boffer\b` completely failed to match "6. Offered" because `\b` expects a word boundary after the 'r', but "Offered" continues with 'e'. This resulted in valid offers being excluded.
2. **Missing Stage Identifiers:** There was no regex for `Assessment` or `Task`, causing them to silently fail categorization and drop out of the "Shortlisted" bucket.
3. **No-Show Ambiguity:** A candidate whose Status is "No Show" but whose Highest Stage is "5. Interviewed" was incorrectly inflating the "Reached Interview" number, despite never attending.
4. **The Solution:** 
   - Relaxed word boundaries (`/offer/i`, `/interview/i`, `/\bjoin/i`).
   - Added robust numbered prefix fallback rules (`/^[34567]\./` for Shortlisted, `/^[4567]\./` for Interviewed) which guarantees correct funnel binning even if the recruiter invents a new text label for a stage, as long as it retains its ordered prefix number.
   - Forcefully set `stageIsInterview = false` if the candidate's actual `Status` evaluates to `isNoShow`, ensuring they strictly remain in the Shortlisted bucket.
