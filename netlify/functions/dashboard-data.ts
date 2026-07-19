import type { Handler } from '@netlify/functions'
import {
  STATUS_PATTERNS,
  VACANCY_PATTERNS,
  COLUMN_CANDIDATES,
  VACANCY_COLUMN_CANDIDATES,
  KPI_FORMULAS,
  monthToQuarter,
  TOP_POSITIONS_LIMIT,
  type KPICounts,
} from './kpi-config'

import { DEFAULT_APPLICANTS_CSV_URL, DEFAULT_VACANCIES_CSV_URL } from '../../src/config'

const DEFAULT_APPLICANTS_URL = DEFAULT_APPLICANTS_CSV_URL
const DEFAULT_VACANCIES_URL = DEFAULT_VACANCIES_CSV_URL

// ─── CSV Parsing ─────────────────────────────────────────────

function parseCSV(text: string): Record<string, string>[] {
  text = text.replace(/\r/g, '')
  const rows: string[][] = []
  let current: string[] = []
  let currentValue = ''
  let inQuotes = false
  
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        currentValue += '"'
        i++ // Skip escaped quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      current.push(currentValue)
      currentValue = ''
    } else if (ch === '\n' && !inQuotes) {
      current.push(currentValue)
      rows.push(current)
      current = []
      currentValue = ''
    } else {
      currentValue += ch
    }
  }
  if (currentValue !== '' || current.length > 0) {
    current.push(currentValue)
    rows.push(current)
  }

  const validRows = rows.filter(row => row.some(cell => cell.trim() !== ''))
  if (validRows.length < 2) return []

  const headers = validRows[0].map(h => h.trim().toLowerCase().replace(/\s+/g, ' '))
  const result: Record<string, string>[] = []

  for (let i = 1; i < validRows.length; i++) {
    const rowData = validRows[i]
    const rowObj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      rowObj[h] = (rowData[idx] || '').trim()
    })
    result.push(rowObj)
  }
  
  return result
}

// ─── Helpers ─────────────────────────────────────────────────

function matchStatus(status: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(status))
}

/**
 * Tries to parse a date string into a Date object.
 * Supports DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, and various separators.
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null
  const s = dateStr.trim()

  // YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/)
  if (isoMatch) {
    const d = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]))
    if (!isNaN(d.getTime())) return d
  }

  // DD/MM/YYYY or DD-MM-YYYY (common in India)
  const ddmmMatch = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/)
  if (ddmmMatch) {
    let day = parseInt(ddmmMatch[1])
    let month = parseInt(ddmmMatch[2])
    let year = parseInt(ddmmMatch[3])
    if (year < 100) year += 2000
    // If first number > 12, it must be the day (DD/MM/YYYY)
    if (day > 12) {
      // day is indeed day, month is month
    } else if (month > 12) {
      // month > 12 means first is month (MM/DD/YYYY)
      const tmp = day; day = month; month = tmp
    }
    // else assume DD/MM/YYYY (Indian convention)
    const d = new Date(year, month - 1, day)
    if (!isNaN(d.getTime())) return d
  }

  // Fallback: try native Date.parse
  const fallback = new Date(s)
  if (!isNaN(fallback.getTime())) return fallback

  return null
}

function getQuarter(dateStr: string, quarter: string): string {
  if (quarter) {
    const q = quarter.trim().toUpperCase()
    if (/^Q[1-4]$/.test(q)) return q
    if (/^[1-4]$/.test(q)) return 'Q' + q
  }
  if (!dateStr) return 'Q1'
  const parsed = parseDate(dateStr)
  if (!parsed) return 'Q1'
  const month = parsed.getMonth() + 1 // 1-indexed
  if (month < 1 || month > 12) return 'Q1'
  return monthToQuarter(month)
}

/**
 * Finds the best matching column name from the available keys.
 * Tries exact match first, then partial match.
 */
function findCol(allKeys: string[], candidates: string[]): string {
  for (const c of candidates) {
    const lc = c.toLowerCase()
    if (allKeys.includes(lc)) return lc
    const partial = allKeys.find(k => k.includes(lc))
    if (partial) return partial
  }
  console.warn(`[HR-Dashboard] Warning: Column not found for candidates: ${candidates.join(', ')}. Falling back to "${candidates[0]}".`)
  return candidates[0].toLowerCase()
}

// ─── Types ───────────────────────────────────────────────────

interface DashboardData {
  kpis: {
    totalApplicants: number
    joined: number
    hiringRate: number
    offersExtended: number
    offerDropRate: number
    offerAcceptanceRate: number
    candidateDrops: number
    screenRejects: number
    totalVacancies: number
    filledVacancies: number
    onHoldVacancies: number
    inProcessVacancies: number
    fillRate: number
    avgTimeToFill: number | null  // days, null if date data unavailable
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
  topRejectionReasons: { reason: string; count: number }[]
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
  topOfferDropReasons: { reason: string; count: number }[]
  timeToFillByBU: { bu: string; avgDays: number }[]
  hiringTimeline: {
    bu: string
    position: string
    candidateCount: number
    totalDays: number
    stages: {
      reqToApp: number
      appToScreen: number
      screenToR1: number
      r1ToR2: number
      r2ToR3: number
      r3ToOffer: number
      offerToHire: number
    }
  }[]
  hiringTimelineByBU: {
    bu: string
    totalApplicants: number
    totalJoined: number
    positions: {
      position: string
      total: number
      joined: number
      offered: number
      dropped: number
      avgDays: number | null
      avgStages: {
        jdReceived: number | null
        reqStart: number | null
        appStart: number | null
        screen: number | null
        r1: number | null
        r2: number | null
        r3: number | null
        task: number | null
        offer: number | null
      }
    }[]
  }[]
  lastUpdated: string
}

// ─── Dashboard Computation ───────────────────────────────────

function computeDashboard(applicants: Record<string, string>[], vacancies: Record<string, string>[]): DashboardData {
  // Filter out completely empty rows
  const apps = applicants.filter(r => Object.values(r).some(v => v !== ''))

  // Detect key column names by sampling the first row
  const sample = apps[0] || {}
  const allKeys = Object.keys(sample)

  // Resolve column names using config candidates
  const highestStageKey = findCol(allKeys, COLUMN_CANDIDATES.highestStage || ['highest stage reached', 'highest stage', 'max stage'])
  const statusKey = findCol(allKeys, COLUMN_CANDIDATES.status)
  const sourceKey = findCol(allKeys, COLUMN_CANDIDATES.source)
  const buKey = findCol(allKeys, COLUMN_CANDIDATES.businessUnit)
  const posKey = findCol(allKeys, COLUMN_CANDIDATES.position)
  const recruiterKey = findCol(allKeys, COLUMN_CANDIDATES.recruiter)
  const dateKey = findCol(allKeys, COLUMN_CANDIDATES.applicationDate)
  const quarterKey = findCol(allKeys, COLUMN_CANDIDATES.quarter)
  const joinDateKey = findCol(allKeys, COLUMN_CANDIDATES.joiningDate)
  const reasonKey = findCol(allKeys, ['reason for rejection', 'rejection reason', 'reason'])
  const jdReceivedDateKey = findCol(allKeys, COLUMN_CANDIDATES.jdReceivedDate)
  const reqDateKey = findCol(allKeys, COLUMN_CANDIDATES.requisitionDate)
  const reqStartDateKey = findCol(allKeys, COLUMN_CANDIDATES.requisitionStartDate)
  const screenDateKey = findCol(allKeys, COLUMN_CANDIDATES.screeningDate)
  const r1DateKey = findCol(allKeys, COLUMN_CANDIDATES.r1Date)
  const r2DateKey = findCol(allKeys, COLUMN_CANDIDATES.r2Date)
  const r3DateKey = findCol(allKeys, COLUMN_CANDIDATES.r3Date)
  const taskDateKey = findCol(allKeys, COLUMN_CANDIDATES.taskDate)
  const offerDateKey = findCol(allKeys, COLUMN_CANDIDATES.offerDate)

  // Compute pipeline stages
  const totalApplicants = apps.length
  let shortlisted = 0, interviewed = 0, offered = 0, joined = 0
  let candidateDrops = 0, r1Rejects = 0, r2Rejects = 0, noShows = 0, offerDrops = 0, screenRejects = 0
  const timeToFillDays: number[] = [] // collect days-to-fill for joined candidates

  const sourceMap: Record<string, { total: number; joined: number }> = {}
  const buMap: Record<string, { total: number; joined: number }> = {}
  const buPositionMap: Record<string, Record<string, { 
    total: number; joined: number; offered: number; dropped: number; days: number[];
    reqDates: Date[];
    stages: { jdReceived: number[]; reqStart: number[]; appStart: number[]; screen: number[]; r1: number[]; r2: number[]; r3: number[]; task: number[]; offer: number[]; }
  }>> = {}
  const recruiterMap: Record<string, { apps: number; offers: number; joined: number; offerDrops: number }> = {}
  const posMap: Record<string, { apps: number; joined: number }> = {}
  const quarterMap: Record<string, { applicants: number; joined: number }> = {}
  const rejectReasonMap: Record<string, number> = {}
  const offerDropReasonMap: Record<string, number> = {}
  const timeToFillByBUMap: Record<string, number[]> = {}

  for (const row of apps) {
    const highestStage = (row[highestStageKey] || '').trim()
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
    if (!buPositionMap[bu]) buPositionMap[bu] = {}
    if (!buPositionMap[bu][position]) buPositionMap[bu][position] = { 
      total: 0, joined: 0, offered: 0, dropped: 0, days: [], reqDates: [],
      stages: { jdReceived: [], reqStart: [], appStart: [], screen: [], r1: [], r2: [], r3: [], task: [], offer: [] }
    }
    buPositionMap[bu][position].total++

    const reqDate = parseDate(row[reqDateKey] || '')
    if (reqDate) {
      buPositionMap[bu][position].reqDates.push(reqDate)
      const getDiff = (key: string) => {
        const d = parseDate(row[key] || '')
        if (d) return Math.round((d.getTime() - reqDate.getTime()) / (1000 * 60 * 60 * 24))
        return null
      }
      
      const jdReceived = getDiff(jdReceivedDateKey)
      if (jdReceived !== null) buPositionMap[bu][position].stages.jdReceived.push(jdReceived)
      
      const reqStart = getDiff(reqStartDateKey)
      if (reqStart !== null) buPositionMap[bu][position].stages.reqStart.push(reqStart)
      
      const appStart = getDiff(dateKey)
      if (appStart !== null) buPositionMap[bu][position].stages.appStart.push(appStart)

      const screen = getDiff(screenDateKey)
      if (screen !== null) buPositionMap[bu][position].stages.screen.push(screen)

      const r1 = getDiff(r1DateKey)
      if (r1 !== null) buPositionMap[bu][position].stages.r1.push(r1)

      const r2 = getDiff(r2DateKey)
      if (r2 !== null) buPositionMap[bu][position].stages.r2.push(r2)

      const r3 = getDiff(r3DateKey)
      if (r3 !== null) buPositionMap[bu][position].stages.r3.push(r3)

      const task = getDiff(taskDateKey)
      if (task !== null) buPositionMap[bu][position].stages.task.push(task)

      const offer = getDiff(offerDateKey)
      if (offer !== null) buPositionMap[bu][position].stages.offer.push(offer)
    }

    // Position tracking
    if (!posMap[position]) posMap[position] = { apps: 0, joined: 0 }
    posMap[position].apps++

    // Recruiter tracking
    if (!recruiterMap[recruiter]) recruiterMap[recruiter] = { apps: 0, offers: 0, joined: 0, offerDrops: 0 }
    recruiterMap[recruiter].apps++

    // ──────────────────────────────────────────────────────────
    //  Status classification (priority order — first match wins)
    //  See kpi-config.ts STATUS_PATTERNS for keyword definitions
    // ──────────────────────────────────────────────────────────
    const stageToEvaluate = highestStage ? highestStage : status
    
    const isJoin = matchStatus(stageToEvaluate, STATUS_PATTERNS.joined)
    let isOfferDrop = matchStatus(status, STATUS_PATTERNS.offerDrop)
    const isOffer = !isJoin && !isOfferDrop && matchStatus(stageToEvaluate, STATUS_PATTERNS.offer)
    
    // Evaluate if dropped based on stage containing (Candidate Drop) or fallback to status if needed
    const stageIsDrop = matchStatus(stageToEvaluate, STATUS_PATTERNS.dropped)
    if (!isOfferDrop && isOffer && matchStatus(status, STATUS_PATTERNS.dropped)) {
      isOfferDrop = true
    }
    const isDrop = !isJoin && !isOffer && !isOfferDrop && stageIsDrop
    
    const isR1 = matchStatus(status, STATUS_PATTERNS.r1Reject)
    const isR2 = matchStatus(status, STATUS_PATTERNS.r2Reject)
    const isNoShow = matchStatus(stageToEvaluate, STATUS_PATTERNS.noShow)
    const isScreenReject = !isR1 && !isR2 && matchStatus(status, STATUS_PATTERNS.screenReject)
    
    const stageIsOffer = isOffer || isJoin || isOfferDrop
    const stageIsR1 = matchStatus(stageToEvaluate, STATUS_PATTERNS.r1Reject) || isR1
    const stageIsR2 = matchStatus(stageToEvaluate, STATUS_PATTERNS.r2Reject) || isR2
    let stageIsInterview = matchStatus(stageToEvaluate, STATUS_PATTERNS.interview) || stageIsOffer || stageIsR1 || stageIsR2
    
    // Explicitly exclude No-Shows from the Interviewed count.
    // Even if their Highest Stage says 'Interviewed', a No-Show means they never actually attended.
    if (isNoShow) {
      stageIsInterview = false
    }

    const stageIsNoShow = matchStatus(stageToEvaluate, STATUS_PATTERNS.noShow)
    const stageIsShort = matchStatus(stageToEvaluate, STATUS_PATTERNS.shortlisted) || stageIsInterview || stageIsNoShow || isNoShow

    if (stageIsShort) shortlisted++
    if (stageIsInterview) interviewed++
    if (stageIsOffer) {
      offered++
      recruiterMap[recruiter].offers++
      buPositionMap[bu][position].offered++
    }

    if (isDrop || isR1 || isR2 || isScreenReject || isOfferDrop) {
      const reason = (row[reasonKey] || '').trim()
      if (reason && reason !== '-' && reason.toLowerCase() !== 'na' && reason.length > 2) {
        if (isOfferDrop) {
          offerDropReasonMap[reason] = (offerDropReasonMap[reason] || 0) + 1
        } else {
          rejectReasonMap[reason] = (rejectReasonMap[reason] || 0) + 1
        }
      }
    }

    if (isJoin) {
      joined++
      sourceMap[source].joined++
      buMap[bu].joined++
      posMap[position].joined++
      recruiterMap[recruiter].joined++
      quarterMap[quarter].joined++
      buPositionMap[bu][position].joined++

      // Compute time-to-fill for this joined candidate (from Day 0 = reqDate)
      const joinDate = parseDate(row[joinDateKey] || '')
      if (reqDate && joinDate && joinDate > reqDate) {
        const diffMs = joinDate.getTime() - reqDate.getTime()
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
        if (diffDays > 0 && diffDays < 365) {
          timeToFillDays.push(diffDays)
          if (!timeToFillByBUMap[bu]) timeToFillByBUMap[bu] = []
          timeToFillByBUMap[bu].push(diffDays)
          buPositionMap[bu][position].days.push(diffDays)
        }
      }
    } else if (isOfferDrop) {
      offerDrops++
      recruiterMap[recruiter].offerDrops++
      buPositionMap[bu][position].dropped++
    } else if (isDrop) {
      if (stageIsShort && !stageIsInterview) {
        candidateDrops++
      }
      buPositionMap[bu][position].dropped++
    } else if (isR1) {
      r1Rejects++
    } else if (isR2) {
      r2Rejects++
    } else if (isNoShow) {
      noShows++
    } else if (isScreenReject) {
      screenRejects++
    }
  }

  // ──────────────────────────────────────────────────────────
  //  Compute KPI values using formulas from kpi-config.ts
  // ──────────────────────────────────────────────────────────

  // Process vacancies first to get vacancy counts
  const vacs = vacancies.filter(r => Object.values(r).some(v => v !== ''))
  const vacSample = vacs[0] || {}
  const vacKeys = Object.keys(vacSample)
  const vacStatusKey = findCol(vacKeys, VACANCY_COLUMN_CANDIDATES.status)
  const vacBUKey = findCol(vacKeys, VACANCY_COLUMN_CANDIDATES.businessUnit)

  const totalVacancies = vacs.length
  let filledVacancies = 0, onHoldVacancies = 0, inProcessVacancies = 0
  const vacBUMap: Record<string, { total: number; filled: number; onHold: number; inProcess: number }> = {}

  for (const row of vacs) {
    const status = (row[vacStatusKey] || '').trim().toLowerCase()
    const bu = (row[vacBUKey] || 'Unknown').trim() || 'Unknown'
    if (!vacBUMap[bu]) vacBUMap[bu] = { total: 0, filled: 0, onHold: 0, inProcess: 0 }
    vacBUMap[bu].total++

    if (matchStatus(status, VACANCY_PATTERNS.filled)) {
      filledVacancies++; vacBUMap[bu].filled++
    } else if (matchStatus(status, VACANCY_PATTERNS.onHold)) {
      onHoldVacancies++; vacBUMap[bu].onHold++
    } else if (matchStatus(status, VACANCY_PATTERNS.inProcess) || !status) {
      inProcessVacancies++; vacBUMap[bu].inProcess++
    } else {
      inProcessVacancies++; vacBUMap[bu].inProcess++
    }
  }

  // Hiring timeline grouped by BU
  const hiringTimelineByBU = Object.entries(buPositionMap)
    .filter(([bu]) => bu !== 'Unknown')
    .map(([bu, positions]) => {
      const posArr = Object.entries(positions)
        .filter(([pos]) => pos !== 'Unknown')
        .map(([position, d]) => {
          // Earliest req date for this position (base for computing actual milestone dates in the UI)
          const earliestReqDate = d.reqDates.length > 0
            ? new Date(Math.min(...d.reqDates.map(r => r.getTime())))
            : null
          const reqDateStr = earliestReqDate ? earliestReqDate.toISOString().slice(0, 10) : null
          return {
            position,
            total: d.total,
            joined: d.joined,
            offered: d.offered,
            dropped: d.dropped,
            reqDate: reqDateStr,
            avgDays: d.days.length > 0 ? Math.round(d.days.reduce((a, b) => a + b, 0) / d.days.length) : null,
            avgStages: {
              jdReceived: d.stages.jdReceived.length > 0 ? Math.round(d.stages.jdReceived.reduce((a, b) => a + b, 0) / d.stages.jdReceived.length) : null,
              reqStart: d.stages.reqStart.length > 0 ? Math.round(d.stages.reqStart.reduce((a, b) => a + b, 0) / d.stages.reqStart.length) : null,
              appStart: d.stages.appStart.length > 0 ? Math.round(d.stages.appStart.reduce((a, b) => a + b, 0) / d.stages.appStart.length) : null,
              screen: d.stages.screen.length > 0 ? Math.round(d.stages.screen.reduce((a, b) => a + b, 0) / d.stages.screen.length) : null,
              r1: d.stages.r1.length > 0 ? Math.round(d.stages.r1.reduce((a, b) => a + b, 0) / d.stages.r1.length) : null,
              r2: d.stages.r2.length > 0 ? Math.round(d.stages.r2.reduce((a, b) => a + b, 0) / d.stages.r2.length) : null,
              r3: d.stages.r3.length > 0 ? Math.round(d.stages.r3.reduce((a, b) => a + b, 0) / d.stages.r3.length) : null,
              task: d.stages.task.length > 0 ? Math.round(d.stages.task.reduce((a, b) => a + b, 0) / d.stages.task.length) : null,
              offer: d.stages.offer.length > 0 ? Math.round(d.stages.offer.reduce((a, b) => a + b, 0) / d.stages.offer.length) : null,
            }
          }
        })
        .sort((a, b) => b.total - a.total)
      return {
        bu,
        totalApplicants: posArr.reduce((s, p) => s + p.total, 0),
        totalJoined: posArr.reduce((s, p) => s + p.joined, 0),
        positions: posArr,
      }
    })
    .sort((a, b) => b.totalApplicants - a.totalApplicants)

  // Build KPI counts object for formula computation
  const kpiCounts: KPICounts = {
    totalApplicants,
    joined,
    offered,
    offerDrops,
    candidateDrops,
    screenRejects,
    totalVacancies,
    filledVacancies,
  }

  const offersExtended = KPI_FORMULAS.offersExtended.compute(kpiCounts)
  const hiringRate = KPI_FORMULAS.hiringRate.compute(kpiCounts)
  const offerDropRate = KPI_FORMULAS.offerDropRate.compute(kpiCounts)
  const offerAcceptanceRate = KPI_FORMULAS.offerAcceptanceRate ? KPI_FORMULAS.offerAcceptanceRate.compute(kpiCounts) : 0
  const fillRate = KPI_FORMULAS.fillRate.compute(kpiCounts)

  // Avg Time to Fill (days) — only if we have date data for joined candidates
  const avgTimeToFill = timeToFillDays.length > 0
    ? Math.round(timeToFillDays.reduce((a, b) => a + b, 0) / timeToFillDays.length)
    : null

  if (avgTimeToFill === null && joined > 0) {
    console.warn(`[HR-Dashboard] Warning: TTF is null but ${joined} candidates joined. 'reqDate' or 'joinDate' may be missing.`)
  }

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
    .slice(0, TOP_POSITIONS_LIMIT)

  const topRejectionReasons = Object.entries(rejectReasonMap)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const topOfferDropReasons = Object.entries(offerDropReasonMap)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const vacancyByBU = Object.entries(vacBUMap)
    .filter(([bu]) => bu !== 'Unknown')
    .map(([bu, d]) => ({ bu, ...d }))
    .sort((a, b) => b.total - a.total)

  const timeToFillByBU = Object.entries(timeToFillByBUMap)
    .filter(([bu]) => bu !== 'Unknown')
    .map(([bu, days]) => ({ bu, avgDays: Math.round(days.reduce((a, b) => a + b, 0) / days.length) }))
    .sort((a, b) => b.avgDays - a.avgDays)

  return {
    kpis: {
      totalApplicants,
      joined,
      hiringRate,
      offersExtended,
      offerDropRate,
      candidateDrops,
      screenRejects,
      totalVacancies,
      filledVacancies,
      onHoldVacancies,
      inProcessVacancies,
      fillRate,
      avgTimeToFill,
      offerAcceptanceRate,
    },
    funnel: { applied: totalApplicants, shortlisted, interviewed, offered, joined },
    sourceEfficiency,
    buPerformance,
    topRejectionReasons,
    leakage: { candidateDrops, r1Rejects, r2Rejects, noShows, offerDrops, screenRejects },
    quarterlyTrend,
    recruiterPerformance,
    topPositions,
    vacancyByBU,
    topOfferDropReasons,
    timeToFillByBU,
    hiringTimelineByBU,
    lastUpdated: new Date().toISOString(),
  }
}

// ─── Netlify Function Handler ────────────────────────────────

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
