import type { Handler } from '@netlify/functions'

const DEFAULT_APPLICANTS_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRJjDWZWvkAm7MVC5aA0vAjS3QMzbgc9CC8ZFJ8v5mHqXKLUBEO5N0xPWKl7MHUMEQ5yZ2_Omv0j42F/pub?gid=2138370345&single=true&output=csv'
const DEFAULT_VACANCIES_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRJjDWZWvkAm7MVC5aA0vAjS3QMzbgc9CC8ZFJ8v5mHqXKLUBEO5N0xPWKl7MHUMEQ5yZ2_Omv0j42F/pub?gid=608034954&single=true&output=csv'

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, '').trim().split('\n')
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, ' '))
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = (values[idx] || '').trim() })
    rows.push(row)
  }
  return rows
}

function matchStatus(status: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(status))
}

const IS_JOINED = [/\bjoin/i, /\bonboard/i]
const IS_OFFER = [/\boffer\b/i, /offer extend/i, /extended/i]
const IS_OFFER_DROP = [/offer.*drop/i, /drop.*offer/i]
const IS_SHORTLISTED = [/shortlist/i, /screen pass/i, /l1 pass/i, /selected/i, /profile shar/i]
const IS_INTERVIEW = [/interview/i, /l1/i, /l2/i, /r1/i, /r2/i, /technical/i, /hr round/i]
const IS_R1_REJECT = [/r1.*reject/i, /round.?1.*reject/i, /l1.*reject/i, /1st.*reject/i]
const IS_R2_REJECT = [/r2.*reject/i, /round.?2.*reject/i, /l2.*reject/i, /2nd.*reject/i]
const IS_NO_SHOW = [/no.?show/i, /absent/i]
const IS_DROPPED = [/\bdrop\b/i, /candidate.*drop/i, /not interest/i, /withdrawn/i, /declined/i]
const IS_SCREEN_REJECT = [/screen.*reject/i, /profile reject/i, /not shortlist/i, /rejected/i]

const VACANCY_FILLED = [/fill(ed)?/i, /close(d)?/i, /hired?/i, /placed?/i, /joined?/i, /onboard(ed|ing)?/i, /accepted/i, /offer.*accepted/i, /position.*filled/i]
const VACANCY_ON_HOLD = [/hold/i, /pause(d)?/i, /defer(red)?/i, /suspend(ed)?/i, /frozen/i, /postponed/i]
const VACANCY_IN_PROCESS = [/process/i, /progress/i, /open/i, /active/i, /ongoing/i, /live/i, /available/i, /recruiting/i, /in progress/i]

function getQuarter(dateStr: string, quarter: string): string {
  if (quarter) {
    const q = quarter.trim().toUpperCase()
    if (/^Q[1-4]$/.test(q)) return q
    if (/^[1-4]$/.test(q)) return 'Q' + q
  }
  if (!dateStr) return 'Q1'
  // Try to parse date — Indian FY: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
  const dateFormats = [
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,  // DD/MM/YYYY or MM/DD/YYYY
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,     // YYYY-MM-DD
  ]
  let month = -1
  for (const fmt of dateFormats) {
    const m = dateStr.match(fmt)
    if (m) {
      // Try both DD/MM and MM/DD
      const a = parseInt(m[1]), b = parseInt(m[2])
      if (a > 12) { month = b } // a is day
      else if (b > 12) { month = a } // b is day
      else { month = b } // assume DD/MM/YYYY (common in India)
      break
    }
  }
  if (month < 1 || month > 12) return 'Q1'
  if (month >= 4 && month <= 6) return 'Q1'
  if (month >= 7 && month <= 9) return 'Q2'
  if (month >= 10 && month <= 12) return 'Q3'
  return 'Q4' // Jan-Mar
}

interface DashboardData {
  kpis: {
    totalApplicants: number
    joined: number
    hiringRate: number
    offersExtended: number
    offerDropRate: number
    candidateDrops: number
    totalVacancies: number
    filledVacancies: number
    onHoldVacancies: number
    inProcessVacancies: number
    fillRate: number
  }
  funnel: {
    applied: number
    shortlisted: number
    interviewed: number
    offered: number
    joined: number
  }
  sourceEfficiency: { source: string; total: number; joined: number; rate: number }[]
  buPerformance: { bu: string; total: number; joined: number; rate: number }[]
  leakage: {
    candidateDrops: number
    r1Rejects: number
    noShows: number
    r2Rejects: number
    offerDrops: number
    screenRejects: number
  }
  quarterlyTrend: { quarter: string; applicants: number; joined: number }[]
  recruiterPerformance: { recruiter: string; applications: number; offers: number; joined: number; convRate: number; offerDropRate: number }[]
  topPositions: { position: string; apps: number; joined: number }[]
  vacancyByBU: { bu: string; total: number; filled: number; onHold: number; inProcess: number }[]
  lastUpdated: string
}

function computeDashboard(applicants: Record<string, string>[], vacancies: Record<string, string>[]): DashboardData {
  // Filter out completely empty rows
  const apps = applicants.filter(r => Object.values(r).some(v => v !== ''))

  // Detect key column names by sampling the first row
  const sample = apps[0] || {}
  const allKeys = Object.keys(sample)

  // Helper to find best column
  const findCol = (...candidates: string[]) => {
    for (const c of candidates) {
      const lc = c.toLowerCase()
      if (allKeys.includes(lc)) return lc
      const partial = allKeys.find(k => k.includes(lc))
      if (partial) return partial
    }
    return candidates[0].toLowerCase()
  }

  const statusKey = findCol('status', 'current status', 'stage', 'pipeline stage', 'recruitment status')
  const sourceKey = findCol('source', 'source channel', 'channel', 'source of application')
  const buKey = findCol('business unit', 'bu', 'company', 'division', 'department', 'entity')
  const posKey = findCol('position', 'role', 'job title', 'designation', 'opening', 'vacancy')
  const recruiterKey = findCol('recruiter', 'assigned to', 'hr', 'rm', 'talent acquisition', 'spoc')
  const dateKey = findCol('date', 'application date', 'applied date', 'date of application', 'received date')
  const quarterKey = findCol('quarter', 'q', 'fy quarter')

  // Compute pipeline stages
  let totalApplicants = apps.length
  let shortlisted = 0, interviewed = 0, offered = 0, joined = 0
  let candidateDrops = 0, r1Rejects = 0, r2Rejects = 0, noShows = 0, offerDrops = 0, screenRejects = 0

  const sourceMap: Record<string, { total: number; joined: number }> = {}
  const buMap: Record<string, { total: number; joined: number }> = {}
  const recruiterMap: Record<string, { apps: number; offers: number; joined: number; offerDrops: number }> = {}
  const posMap: Record<string, { apps: number; joined: number }> = {}
  const quarterMap: Record<string, { applicants: number; joined: number }> = {}

  for (const row of apps) {
    const status = (row[statusKey] || '').trim()
    const source = (row[sourceKey] || 'Unknown').trim() || 'Unknown'
    const bu = (row[buKey] || 'Unknown').trim() || 'Unknown'
    const position = (row[posKey] || 'Unknown').trim() || 'Unknown'
    const recruiter = (row[recruiterKey] || 'Unknown').trim() || 'Unknown'
    const dateStr = row[dateKey] || ''
    const quarterStr = row[quarterKey] || ''
    const quarter = getQuarter(dateStr, quarterStr)

    // Quarter tracking
    if (!quarterMap[quarter]) quarterMap[quarter] = { applicants: 0, joined: 0 }
    quarterMap[quarter].applicants++

    // Source tracking
    if (!sourceMap[source]) sourceMap[source] = { total: 0, joined: 0 }
    sourceMap[source].total++

    // BU tracking
    if (!buMap[bu]) buMap[bu] = { total: 0, joined: 0 }
    buMap[bu].total++

    // Position tracking
    if (!posMap[position]) posMap[position] = { apps: 0, joined: 0 }
    posMap[position].apps++

    // Recruiter tracking
    if (!recruiterMap[recruiter]) recruiterMap[recruiter] = { apps: 0, offers: 0, joined: 0, offerDrops: 0 }
    recruiterMap[recruiter].apps++

    // Status classification (order matters — most specific first)
    const isJoin = matchStatus(status, IS_JOINED)
    const isOfferDrop = matchStatus(status, IS_OFFER_DROP)
    const isOffer = !isJoin && !isOfferDrop && matchStatus(status, IS_OFFER)
    const isDrop = !isJoin && !isOffer && !isOfferDrop && matchStatus(status, IS_DROPPED)
    const isR1 = matchStatus(status, IS_R1_REJECT)
    const isR2 = matchStatus(status, IS_R2_REJECT)
    const isNoShow = matchStatus(status, IS_NO_SHOW)
    const isScreenReject = !isR1 && !isR2 && matchStatus(status, IS_SCREEN_REJECT)
    const isShort = matchStatus(status, IS_SHORTLISTED) || isOffer || isJoin || isOfferDrop || isR1 || isR2 || isNoShow
    const isInterview = matchStatus(status, IS_INTERVIEW) || isOffer || isJoin || isOfferDrop || isR1 || isR2

    if (isJoin) {
      joined++; shortlisted++; interviewed++; offered++
      sourceMap[source].joined++
      buMap[bu].joined++
      posMap[position].joined++
      recruiterMap[recruiter].joined++
      quarterMap[quarter].joined++
    } else if (isOfferDrop) {
      offerDrops++; offered++; shortlisted++; interviewed++
      recruiterMap[recruiter].offers++
      recruiterMap[recruiter].offerDrops++
    } else if (isOffer) {
      offered++; shortlisted++; interviewed++
      recruiterMap[recruiter].offers++
    } else if (isDrop) {
      candidateDrops++
      if (isShort) shortlisted++
      if (isInterview) interviewed++
    } else if (isR1) {
      r1Rejects++; shortlisted++; interviewed++
    } else if (isR2) {
      r2Rejects++; shortlisted++; interviewed++
    } else if (isNoShow) {
      noShows++; shortlisted++
    } else if (isScreenReject) {
      screenRejects++; shortlisted++
    } else if (isShort) {
      shortlisted++
    }
  }

  const offersExtended = offered
  const offerDropRate = offersExtended > 0 ? (offerDrops / offersExtended) * 100 : 0
  const hiringRate = totalApplicants > 0 ? (joined / totalApplicants) * 100 : 0

  // Source efficiency
  const sourceEfficiency = Object.entries(sourceMap)
    .map(([source, d]) => ({ source, total: d.total, joined: d.joined, rate: d.total > 0 ? (d.joined / d.total) * 100 : 0 }))
    .sort((a, b) => b.rate - a.rate)

  // BU performance
  const buPerformance = Object.entries(buMap)
    .map(([bu, d]) => ({ bu, total: d.total, joined: d.joined, rate: d.total > 0 ? (d.joined / d.total) * 100 : 0 }))
    .sort((a, b) => b.total - a.total)

  // Quarterly trend
  const quarterlyTrend = ['Q1', 'Q2', 'Q3', 'Q4'].map(q => ({
    quarter: q,
    applicants: quarterMap[q]?.applicants || 0,
    joined: quarterMap[q]?.joined || 0,
  }))

  // Recruiter performance
  const recruiterPerformance = Object.entries(recruiterMap)
    .filter(([name]) => name !== 'Unknown')
    .map(([recruiter, d]) => ({
      recruiter,
      applications: d.apps,
      offers: d.offers,
      joined: d.joined,
      convRate: d.apps > 0 ? (d.joined / d.apps) * 100 : 0,
      offerDropRate: d.offers > 0 ? (d.offerDrops / d.offers) * 100 : 0,
    }))
    .sort((a, b) => b.joined - a.joined)

  // Top positions
  const topPositions = Object.entries(posMap)
    .filter(([p]) => p !== 'Unknown')
    .map(([position, d]) => ({ position, apps: d.apps, joined: d.joined }))
    .sort((a, b) => b.apps - a.apps)
    .slice(0, 14)

  // Vacancies
  const vacs = vacancies.filter(r => Object.values(r).some(v => v !== ''))
  const vacSample = vacs[0] || {}
  const vacKeys = Object.keys(vacSample)
  const findVacCol = (...candidates: string[]) => {
    for (const c of candidates) {
      const lc = c.toLowerCase()
      if (vacKeys.includes(lc)) return lc
      const partial = vacKeys.find(k => k.includes(lc))
      if (partial) return partial
    }
    return candidates[0].toLowerCase()
  }

  const vacStatusKey = findVacCol('status', 'vacancy status', 'position status', 'stage')
  const vacBUKey = findVacCol('business unit', 'bu', 'company', 'division', 'department', 'entity')

  let totalVacancies = vacs.length
  let filledVacancies = 0, onHoldVacancies = 0, inProcessVacancies = 0
  const vacBUMap: Record<string, { total: number; filled: number; onHold: number; inProcess: number }> = {}

  for (const row of vacs) {
    const status = (row[vacStatusKey] || '').trim().toLowerCase()
    const bu = (row[vacBUKey] || 'Unknown').trim() || 'Unknown'
    if (!vacBUMap[bu]) vacBUMap[bu] = { total: 0, filled: 0, onHold: 0, inProcess: 0 }
    vacBUMap[bu].total++

    if (matchStatus(status, VACANCY_FILLED)) {
      filledVacancies++; vacBUMap[bu].filled++
    } else if (matchStatus(status, VACANCY_ON_HOLD)) {
      onHoldVacancies++; vacBUMap[bu].onHold++
    } else if (matchStatus(status, VACANCY_IN_PROCESS) || !status) {
      inProcessVacancies++; vacBUMap[bu].inProcess++
    } else {
      inProcessVacancies++; vacBUMap[bu].inProcess++
    }
  }

  const vacancyFillRate = totalVacancies > 0 ? (filledVacancies / totalVacancies) * 100 : 0
  const joinFallbackRate = totalVacancies > 0 ? (joined / totalVacancies) * 100 : 0
  const fillRate = vacancyFillRate > 0 ? vacancyFillRate : joinFallbackRate

  const vacancyByBU = Object.entries(vacBUMap)
    .filter(([bu]) => bu !== 'Unknown')
    .map(([bu, d]) => ({ bu, ...d }))
    .sort((a, b) => b.total - a.total)

  return {
    kpis: {
      totalApplicants,
      joined,
      hiringRate,
      offersExtended,
      offerDropRate,
      candidateDrops,
      totalVacancies,
      filledVacancies,
      onHoldVacancies,
      inProcessVacancies,
      fillRate,
    },
    funnel: { applied: totalApplicants, shortlisted, interviewed, offered, joined },
    sourceEfficiency,
    buPerformance,
    leakage: { candidateDrops, r1Rejects, r2Rejects, noShows, offerDrops, screenRejects },
    quarterlyTrend,
    recruiterPerformance,
    topPositions,
    vacancyByBU,
    lastUpdated: new Date().toISOString(),
  }
}

export const handler: Handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=300', // cache 5 min
  }

  try {
    const params = new URLSearchParams(event.queryStringParameters as Record<string, string> || {})
    const applicantsUrl = params.get('applicants') || DEFAULT_APPLICANTS_URL
    const vacanciesUrl = params.get('vacancies') || DEFAULT_VACANCIES_URL

    const [appsRes, vacsRes] = await Promise.all([
      fetch(applicantsUrl),
      fetch(vacanciesUrl),
    ])

    if (!appsRes.ok || !vacsRes.ok) {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch CSV data', applicantsStatus: appsRes.status, vacanciesStatus: vacsRes.status }),
      }
    }

    const [appsText, vacsText] = await Promise.all([appsRes.text(), vacsRes.text()])
    const applicants = parseCSV(appsText)
    const vacancies = parseCSV(vacsText)
    const data = computeDashboard(applicants, vacancies)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data),
    }
  } catch (err) {
    console.error('dashboard-data error:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: String(err) }),
    }
  }
}
