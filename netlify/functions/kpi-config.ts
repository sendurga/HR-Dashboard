/**
 * ============================================================
 *  KPI FORMULA BOOK — Recruitment Dashboard FY 2025-26
 * ============================================================
 *
 *  This file defines ALL metric formulas, status classifications,
 *  and column mappings used by the dashboard.
 *
 *  HOW TO READ THIS FILE:
 *  - Each section has a clear header and plain-English comments
 *  - Status keywords are simple text patterns (case-insensitive)
 *  - KPI formulas are described in English alongside the code
 *
 *  HOW TO MAKE CHANGES:
 *  - To change what counts as "Joined": edit STATUS_KEYWORDS.joined
 *  - To add a new source column name: add it to COLUMN_CANDIDATES
 *  - To change a KPI formula: edit the corresponding function in KPI_FORMULAS
 *
 *  IMPORTANT: After making changes, redeploy the site for them to take effect.
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  SECTION 1: STATUS CLASSIFICATION KEYWORDS
// ─────────────────────────────────────────────────────────────
//
//  Each status is matched using keyword patterns (regex).
//  The system checks a candidate's "status" column against
//  these patterns to classify them.
//
//  PRIORITY ORDER (first match wins):
//  Joined → Offer Drop → Offer → Dropped → R1 Reject →
//  R2 Reject → No-Show → Screen Reject → Shortlisted
// ─────────────────────────────────────────────────────────────

export const STATUS_PATTERNS = {

  /** Candidate has successfully joined the company */
  joined: [/\bjoin/i, /\bonboard/i],

  /** Candidate received an offer (but hasn't joined or dropped yet) */
  offer: [/\boffer\b/i, /offer extend/i, /extended/i],

  /** Candidate received offer but then dropped out */
  offerDrop: [/offer.*drop/i, /drop.*offer/i],

  /** Candidate was shortlisted / passed initial screening */
  shortlisted: [/shortlist/i, /screen pass/i, /l1 pass/i, /selected/i, /profile shar/i],

  /** Candidate reached the interview stage */
  interview: [/interview/i, /l1/i, /l2/i, /r1/i, /r2/i, /technical/i, /hr round/i],

  /** Candidate rejected after Round 1 interview */
  r1Reject: [/r1.*reject/i, /round.?1.*reject/i, /l1.*reject/i, /1st.*reject/i],

  /** Candidate rejected after Round 2 interview */
  r2Reject: [/r2.*reject/i, /round.?2.*reject/i, /l2.*reject/i, /2nd.*reject/i],

  /** Candidate did not show up for interview */
  noShow: [/no.?show/i, /absent/i],

  /** Candidate dropped out mid-pipeline (not offer stage) */
  dropped: [/\bdrop\b/i, /candidate.*drop/i, /not interest/i, /withdrawn/i, /declined/i],

  /** Candidate rejected at initial screening stage */
  screenReject: [/screen.*reject/i, /profile reject/i, /not shortlist/i, /rejected/i],
}


// ─────────────────────────────────────────────────────────────
//  SECTION 2: VACANCY STATUS CLASSIFICATION
// ─────────────────────────────────────────────────────────────
//
//  These patterns classify each vacancy row into one of
//  three buckets: Filled, On Hold, or In Process.
// ─────────────────────────────────────────────────────────────

export const VACANCY_PATTERNS = {

  /** Vacancy has been filled / closed / candidate placed */
  filled: [/^1$/, /fill(ed)?/i, /close(d)?/i, /hired?/i, /placed?/i, /joined?/i, /onboard(ed|ing)?/i, /accepted/i, /offer.*accepted/i, /position.*filled/i],

  /** Vacancy is temporarily paused */
  onHold: [/hold/i, /pause(d)?/i, /defer(red)?/i, /suspend(ed)?/i, /frozen/i, /postponed/i],

  /** Vacancy is actively being recruited for */
  inProcess: [/^0$/, /process/i, /progress/i, /open/i, /active/i, /ongoing/i, /live/i, /available/i, /recruiting/i, /in progress/i],
}


// ─────────────────────────────────────────────────────────────
//  SECTION 3: COLUMN NAME CANDIDATES
// ─────────────────────────────────────────────────────────────
//
//  Google Sheets columns can have different names.
//  For each field we need, list all possible column headers.
//  The system tries each name in order and uses the first match.
//
//  To support a new column name, simply add it to the list.
// ─────────────────────────────────────────────────────────────

export const COLUMN_CANDIDATES = {

  /** The candidate's current recruitment status */
  status: ['status', 'current status', 'stage', 'pipeline stage', 'recruitment status'],

  /** How the candidate found/applied for the role */
  source: ['source', 'source channel', 'channel', 'source of application'],

  /** Which business unit the position belongs to */
  businessUnit: ['business unit', 'bu', 'company', 'division', 'department', 'entity'],

  /** The job title / position name */
  position: ['position', 'role', 'job title', 'designation', 'opening', 'vacancy'],

  /** The recruiter handling this candidate */
  recruiter: ['recruiter', 'assigned to', 'hr', 'rm', 'talent acquisition', 'spoc'],

  /** Date the application was received */
  applicationDate: ['application start', 'application start date', 'date', 'application date', 'applied date', 'date of application', 'received date'],

  /** Which financial quarter this falls in */
  quarter: ['quarter', 'q', 'fy quarter'],

  /** Date the candidate joined (for time-to-fill calculation) */
  joiningDate: ['hired date', 'joining date', 'date of joining', 'doj', 'join date', 'onboarding date'],

  /** Job requisition start date */
  requisitionDate: ['requisition date', 'job requisition date', 'req date', 'job req date', 'requisition start', 'job requisition'],

  /** Screening completion date */
  screeningDate: ['screening date', 'screen date', 'screening pass date', 'profile shared date', 'screened date'],

  /** Round 1 interview date */
  r1Date: ['1st round date', 'r1 date', 'round 1 date', 'l1 date', 'interview 1 date', 'first round date'],

  /** Round 2 interview date */
  r2Date: ['2nd round date', 'r2 date', 'round 2 date', 'l2 date', 'interview 2 date', 'second round date'],

  /** Round 3 interview date */
  r3Date: ['3rd round date', 'r3 date', 'round 3 date', 'l3 date', 'interview 3 date', 'third round date'],

  /** Offer extension date */
  offerDate: ['offer date', 'offer extended date', 'date of offer', 'offered date'],
}

/** Column candidates for the Vacancies sheet */
export const VACANCY_COLUMN_CANDIDATES = {
  status: ['number of positions closed', 'status', 'vacancy status', 'position status', 'stage'],
  businessUnit: ['business vertical', 'business unit', 'bu', 'company', 'division', 'department', 'entity'],
}


// ─────────────────────────────────────────────────────────────
//  SECTION 4: KPI FORMULA DEFINITIONS
// ─────────────────────────────────────────────────────────────
//
//  Each KPI has:
//  - name:        Display name on the dashboard
//  - formula:     Plain English description of the calculation
//  - unit:        The unit of measurement (%, count, days)
//  - compute():   The actual calculation function
//
//  To change a formula, edit the "compute" function.
//  The "formula" string is just for documentation.
// ─────────────────────────────────────────────────────────────

export const KPI_FORMULAS = {

  totalApplicants: {
    name: 'Total Applicants',
    formula: 'Count of all non-empty rows in Applicants sheet',
    unit: 'count',
    compute: (counts: KPICounts) => counts.totalApplicants,
  },

  joined: {
    name: 'Joined',
    formula: 'Count of candidates whose status matches "joined" or "onboard"',
    unit: 'count',
    compute: (counts: KPICounts) => counts.joined,
  },

  hiringRate: {
    name: 'Hiring Rate',
    formula: 'Joined ÷ Total Applicants × 100',
    unit: '%',
    compute: (counts: KPICounts) =>
      counts.totalApplicants > 0
        ? (counts.joined / counts.totalApplicants) * 100
        : 0,
  },

  offersExtended: {
    name: 'Offers Extended',
    formula: 'Count of candidates who reached offer stage (includes joined + offer drops + pending offers)',
    unit: 'count',
    compute: (counts: KPICounts) => counts.offered,
  },

  offerDropRate: {
    name: 'Offer Drop Rate',
    formula: 'Offer Drops ÷ Offers Extended × 100',
    unit: '%',
    compute: (counts: KPICounts) =>
      counts.offered > 0
        ? (counts.offerDrops / counts.offered) * 100
        : 0,
  },

  offerAcceptanceRate: {
    name: 'Offer Acceptance Rate',
    formula: 'Joined ÷ Offers Extended × 100',
    unit: '%',
    compute: (counts: KPICounts) =>
      counts.offered > 0
        ? (counts.joined / counts.offered) * 100
        : 0,
  },

  candidateDrops: {
    name: 'Candidate Drops',
    formula: 'Count of candidates who withdrew mid-pipeline (not at offer stage)',
    unit: 'count',
    compute: (counts: KPICounts) => counts.candidateDrops,
  },

  fillRate: {
    name: 'Fill Rate',
    formula: 'Filled Vacancies ÷ Total Vacancies × 100 (falls back to Joined ÷ Total Vacancies if no vacancy status data)',
    unit: '%',
    compute: (counts: KPICounts) => {
      if (counts.totalVacancies <= 0) return 0
      const vacancyFillRate = (counts.filledVacancies / counts.totalVacancies) * 100
      const joinFallbackRate = (counts.joined / counts.totalVacancies) * 100
      return vacancyFillRate > 0 ? vacancyFillRate : joinFallbackRate
    },
  },

  screenRejects: {
    name: 'Screen Rejects',
    formula: 'Count of candidates rejected at initial screening (before interview)',
    unit: 'count',
    compute: (counts: KPICounts) => counts.screenRejects,
  },
}

/**
 * Input counts used by KPI formula computations.
 * These are the raw tallies from processing the spreadsheet.
 */
export interface KPICounts {
  totalApplicants: number
  joined: number
  offered: number
  offerDrops: number
  candidateDrops: number
  screenRejects: number
  totalVacancies: number
  filledVacancies: number
}


// ─────────────────────────────────────────────────────────────
//  SECTION 5: QUARTER DERIVATION (Indian Financial Year)
// ─────────────────────────────────────────────────────────────
//
//  Indian FY quarters:
//    Q1 = April – June
//    Q2 = July – September
//    Q3 = October – December
//    Q4 = January – March
//
//  The system first checks for an explicit "Quarter" column.
//  If not found, it parses the application date to derive the quarter.
// ─────────────────────────────────────────────────────────────

export const FY_QUARTERS = {
  Q1: { months: [4, 5, 6], label: 'Apr – Jun' },
  Q2: { months: [7, 8, 9], label: 'Jul – Sep' },
  Q3: { months: [10, 11, 12], label: 'Oct – Dec' },
  Q4: { months: [1, 2, 3], label: 'Jan – Mar' },
}

/**
 * Determines the FY quarter from a month number (1-12).
 * Returns 'Q1' if month is invalid.
 */
export function monthToQuarter(month: number): string {
  if (month >= 4 && month <= 6) return 'Q1'
  if (month >= 7 && month <= 9) return 'Q2'
  if (month >= 10 && month <= 12) return 'Q3'
  if (month >= 1 && month <= 3) return 'Q4'
  return 'Q1' // fallback
}


// ─────────────────────────────────────────────────────────────
//  SECTION 6: DISPLAY THRESHOLDS
// ─────────────────────────────────────────────────────────────
//
//  These thresholds control the color-coding of KPI indicators
//  on the dashboard (green/amber/red badges).
// ─────────────────────────────────────────────────────────────

export const THRESHOLDS = {
  hiringRate: {
    good: 10,    // >= 10% → green
    warn: 5,     // >= 5%  → amber
                 // < 5%   → red
  },
  offerDropRate: {
    bad: 30,     // >= 30% → red
    warn: 20,    // >= 20% → amber
                 // < 20%  → green
  },
  sourceEfficiency: {
    high: 20,    // >= 20% joining rate → teal
    medium: 10,  // >= 10% → amber
    low: 5,      // >= 5%  → warm
                 // < 5%   → brick/red
  },
  buPerformance: {
    high: 15,    // >= 15% → teal
    medium: 8,   // >= 8%  → amber
                 // < 8%   → brick/red
  },
}

/** Number of top positions to display on the dashboard */
export const TOP_POSITIONS_LIMIT = 14
