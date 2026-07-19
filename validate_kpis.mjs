// validate_kpis.mjs — Run: node validate_kpis.mjs
// Fetches the live CSV and validates every KPI computed by dashboard-data.ts

const APPS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRJjDWZWvkAm7MVC5aA0vAjS3QMzbgc9CC8ZFJ8v5mHqXKLUBEO5N0xPWKl7MHUMEQ5yZ2_Omv0j42F/pub?gid=2138370345&single=true&output=csv'
const VACS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRJjDWZWvkAm7MVC5aA0vAjS3QMzbgc9CC8ZFJ8v5mHqXKLUBEO5N0xPWKl7MHUMEQ5yZ2_Omv0j42F/pub?gid=608034954&single=true&output=csv'

// ─── CSV Parser (fixed — handles quoted newlines) ─────────────
function parseCSV(text) {
  text = text.replace(/\r/g, '')
  const rows = []
  let current = [], val = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQ && text[i+1] === '"') { val += '"'; i++ } else inQ = !inQ
    } else if (ch === ',' && !inQ) { current.push(val); val = '' }
    else if (ch === '\n' && !inQ) { current.push(val); rows.push(current); current = []; val = '' }
    else val += ch
  }
  if (val !== '' || current.length > 0) { current.push(val); rows.push(current) }
  const valid = rows.filter(r => r.some(c => c.trim()))
  if (valid.length < 2) return []
  const headers = valid[0].map(h => h.trim().toLowerCase().replace(/\s+/g, ' '))
  return valid.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i]||'').trim()])))
}

// ─── Old buggy parser (split on \n) ──────────────────────────
function parseCSV_buggy(text) {
  const lines = text.replace(/\r/g,'').trim().split('\n')
  if (lines.length < 2) return []
  const splitLine = l => { const r=[]; let c='',q=false; for(const ch of l){if(ch==='"'){q=!q}else if(ch===','&&!q){r.push(c);c=''}else c+=ch}; r.push(c); return r }
  const headers = splitLine(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g,' '))
  return lines.slice(1).filter(l=>l.trim()).map(l => { const v=splitLine(l); return Object.fromEntries(headers.map((h,i)=>[h,(v[i]||'').trim()])) })
}

// ─── Status patterns (from kpi-config.ts) ────────────────────
const P = {
  joined:      [/\bjoin/i, /\bonboard/i],
  offer:       [/\boffer\b/i, /offer extend/i, /extended/i],
  offerDrop:   [/offer.*drop/i, /drop.*offer/i],
  shortlisted: [/shortlist/i, /screen pass/i, /l1 pass/i, /selected/i, /profile shar/i],
  interview:   [/interview/i, /l1/i, /l2/i, /r1/i, /r2/i, /technical/i, /hr round/i],
  r1Reject:    [/r1.*reject/i, /round.?1.*reject/i, /l1.*reject/i, /1st.*reject/i],
  r2Reject:    [/r2.*reject/i, /round.?2.*reject/i, /l2.*reject/i, /2nd.*reject/i],
  noShow:      [/no.?show/i, /absent/i],
  dropped:     [/\bdrop\b/i, /candidate.*drop/i, /not interest/i, /withdrawn/i, /declined/i],
  screenReject:[/screen.*reject/i, /profile reject/i, /not shortlist/i, /rejected/i],
}
const VAC_P = {
  filled:    [/^1$/, /fill(ed)?/i, /close(d)?/i, /hired?/i, /placed?/i, /joined?/i, /onboard(ed|ing)?/i, /accepted/i, /offer.*accepted/i, /position.*filled/i],
  onHold:    [/hold/i, /pause(d)?/i, /defer(red)?/i, /suspend(ed)?/i, /frozen/i, /postponed/i],
}
const match = (s, ps) => ps.some(p => p.test(s))
const findCol = (keys, cands) => { for (const c of cands) { const lc=c.toLowerCase(); if(keys.includes(lc))return lc; const p=keys.find(k=>k.includes(lc)); if(p)return p } return cands[0].toLowerCase() }

// ─── Compute all KPIs ─────────────────────────────────────────
function compute(apps, vacs) {
  const sample = apps[0] || {}
  const keys = Object.keys(sample)
  const statusKey = findCol(keys, ['status','current status','stage','pipeline stage','recruitment status'])
  const sourceKey = findCol(keys, ['source','source channel','channel','source of application'])
  const buKey     = findCol(keys, ['business unit','bu','company','division','department','entity'])
  const posKey    = findCol(keys, ['position','role','job title','designation','opening','vacancy'])
  const recKey    = findCol(keys, ['recruiter','assigned to','hr','rm','talent acquisition','spoc'])
  const dateKey   = findCol(keys, ['application start','application start date','date','application date','applied date','date of application','received date','application'])
  const qKey      = findCol(keys, ['quarter','q','fy quarter'])
  const jdKey     = findCol(keys, ['hired date','joining date','date of joining','doj','join date','onboarding date','joined'])
  const rqKey     = findCol(keys, ['requisition date','job requisition date','job req date','job requisition','req date'])

  let shortlisted=0, interviewed=0, offered=0, joined=0
  let candidateDrops=0, r1=0, r2=0, noShows=0, offerDrops=0, screenRejects=0
  const ttf=[]
  const sourceMap={}, buMap={}, recMap={}, posMap={}, qMap={}
  let uncategorized=0, uncategorizedRows=[]

  const parseDate = s => {
    if(!s)return null; s=s.trim()
    const iso=s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/)
    if(iso){ const d=new Date(+iso[1],+iso[2]-1,+iso[3]); if(!isNaN(d))return d }
    const dm=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/)
    if(dm){ let [,a,b,c]=[...dm].map(Number); if(c<100)c+=2000; if(a>12){/*dd/mm*/}else if(b>12){[a,b]=[b,a]} const d=new Date(c,b-1,a); if(!isNaN(d))return d }
    const fb=new Date(s); return isNaN(fb)?null:fb
  }
  const mqtr = m => m>=4&&m<=6?'Q1':m>=7&&m<=9?'Q2':m>=10&&m<=12?'Q3':'Q4'
  const getQ = (ds,qs) => { if(qs){ const q=qs.trim().toUpperCase(); if(/^Q[1-4]$/.test(q))return q; if(/^[1-4]$/.test(q))return'Q'+q } if(!ds)return'Q1'; const d=parseDate(ds); if(!d)return'Q1'; return mqtr(d.getMonth()+1) }

  for (const row of apps) {
    const status = (row[statusKey]||'').trim()
    const src    = (row[sourceKey]||'Unknown').trim()||'Unknown'
    const bu     = (row[buKey]||'Unknown').trim()||'Unknown'
    const pos    = (row[posKey]||'Unknown').trim()||'Unknown'
    const rec    = (row[recKey]||'Unknown').trim()||'Unknown'
    const q      = getQ(row[dateKey]||'', row[qKey]||'')

    if(!qMap[q])qMap[q]={apps:0,joined:0}; qMap[q].apps++
    if(!sourceMap[src])sourceMap[src]={total:0,joined:0}; sourceMap[src].total++
    if(!buMap[bu])buMap[bu]={total:0,joined:0}; buMap[bu].total++
    if(!recMap[rec])recMap[rec]={apps:0,offers:0,joined:0,drops:0}; recMap[rec].apps++
    if(!posMap[pos])posMap[pos]={apps:0,joined:0}; posMap[pos].apps++

    const isJoin = match(status, P.joined)
    const isOD   = match(status, P.offerDrop)
    const isOff  = !isJoin && !isOD && match(status, P.offer)
    const isDrop = !isJoin && !isOff && !isOD && match(status, P.dropped)
    const isR1   = match(status, P.r1Reject)
    const isR2   = match(status, P.r2Reject)
    const isNS   = match(status, P.noShow)
    const isSR   = !isR1 && !isR2 && match(status, P.screenReject)
    const isShort = match(status,P.shortlisted)||isOff||isJoin||isOD||isR1||isR2||isNS
    const isInt   = match(status,P.interview)||isOff||isJoin||isOD||isR1||isR2

    if (isJoin) {
      joined++; shortlisted++; interviewed++; offered++
      sourceMap[src].joined++; buMap[bu].joined++; posMap[pos].joined++
      recMap[rec].joined++; recMap[rec].offers++; qMap[q].joined++
      const rqd=parseDate(row[rqKey]||''), jd=parseDate(row[jdKey]||'')
      if(rqd&&jd&&jd>rqd){ const d=Math.round((jd-rqd)/86400000); if(d>0&&d<365)ttf.push(d) }
    } else if (isOD) {
      offerDrops++; offered++; shortlisted++; interviewed++
      recMap[rec].offers++; recMap[rec].drops++
    } else if (isOff) {
      offered++; shortlisted++; interviewed++; recMap[rec].offers++
    } else if (isDrop) {
      candidateDrops++
      if(isShort)shortlisted++
      if(isInt)interviewed++
    } else if (isR1) { r1++; shortlisted++; interviewed++
    } else if (isR2) { r2++; shortlisted++; interviewed++
    } else if (isNS) { noShows++; shortlisted++
    } else if (isSR) { screenRejects++ // NOT shortlisted
    } else if (isShort) { shortlisted++
    } else {
      uncategorized++
      uncategorizedRows.push({name:Object.values(row)[0], status})
    }
  }

  const vacKeys = Object.keys(vacs[0]||{})
  const vsKey = findCol(vacKeys, ['status','vacancy status','position status','stage','number of positions closed'])
  const vbKey = findCol(vacKeys, ['business vertical','business unit','bu','company','division','department','entity'])
  let filled=0, onHold=0, inProc=0
  for(const v of vacs){
    const s=(v[vsKey]||'').trim().toLowerCase()
    if(match(s,VAC_P.filled))filled++
    else if(match(s,VAC_P.onHold))onHold++
    else inProc++
  }

  const total=apps.length
  return {
    // KPIs
    totalApplicants: total,
    joined, shortlisted, interviewed, offered,
    candidateDrops, r1Rejects:r1, r2Rejects:r2, noShows, offerDrops, screenRejects,
    hiringRate: total>0?(joined/total*100):0,
    offerDropRate: offered>0?(offerDrops/offered*100):0,
    offerAcceptanceRate: offered>0?(joined/offered*100):0,
    totalVacancies: vacs.length, filledVacancies:filled, onHoldVacancies:onHold, inProcessVacancies:inProc,
    fillRate: vacs.length>0?(filled/vacs.length*100):0,
    avgTimeToFill: ttf.length>0?Math.round(ttf.reduce((a,b)=>a+b,0)/ttf.length):null,
    funnelSum: shortlisted+interviewed+offered+joined,
    // Audit
    leakageSum: candidateDrops+r1+r2+noShows+offerDrops+screenRejects,
    uncategorized, uncategorizedRows,
    // Checks
    pipelineCheck: shortlisted<=total && interviewed<=shortlisted && offered<=interviewed && joined<=offered,
    sourceMap, buMap, recMap, posMap, qMap,
    ttfCount: ttf.length,
  }
}

// ─── Run ──────────────────────────────────────────────────────
const [appsText, vacsText] = await Promise.all([fetch(APPS_URL).then(r=>r.text()), fetch(VACS_URL).then(r=>r.text())])

const apps_fixed  = parseCSV(appsText)
const apps_buggy  = parseCSV_buggy(appsText)
const vacs        = parseCSV(vacsText)
const kpi         = compute(apps_fixed, vacs)

const ok  = s => `  ✅ ${s}`
const err = s => `  ❌ ${s}`
const warn = s => `  ⚠️  ${s}`

console.log('\n══════════════════════════════════════════')
console.log('  KPI VALIDATION REPORT')
console.log('══════════════════════════════════════════')

// 1. Row count / parse fix
const rowDiff = apps_buggy.length - apps_fixed.length
if(rowDiff > 0) {
  console.log(err(`Total Applicants: buggy parser inflated count by +${rowDiff} (was ${apps_buggy.length}, now ${apps_fixed.length})`))
} else {
  console.log(ok(`Total Applicants row count matches (${apps_fixed.length} rows)`))
}

// 2. Funnel monotonicity — each stage must be ≤ previous
console.log('\n── Hiring Funnel ──────────────────────────')
const {totalApplicants, shortlisted, interviewed, offered, joined} = kpi
console.log(`  Applied=${totalApplicants}, Shortlisted=${shortlisted}, Interviewed=${interviewed}, Offered=${offered}, Joined=${joined}`)
if(!kpi.pipelineCheck) {
  if(shortlisted > totalApplicants) console.log(err('Shortlisted > Total Applicants — impossible'))
  if(interviewed > shortlisted)     console.log(err('Interviewed > Shortlisted — impossible'))
  if(offered > interviewed)         console.log(err('Offered > Interviewed — impossible'))
  if(joined > offered)              console.log(err('Joined > Offered — impossible'))
} else {
  console.log(ok('Funnel is monotonically decreasing'))
}

// 3. Leakage sanity — all statuses should account for everyone
console.log('\n── Status Coverage ────────────────────────')
const accounted = joined + kpi.offerDrops + (offered - joined - kpi.offerDrops) + kpi.candidateDrops + kpi.r1Rejects + kpi.r2Rejects + kpi.noShows + kpi.screenRejects + kpi.uncategorized
// More useful: check if uncategorized > 0
if(kpi.uncategorized > 0) {
  console.log(warn(`${kpi.uncategorized} rows had status that matched NO pattern at all:`))
  kpi.uncategorizedRows.slice(0,10).forEach(r => console.log(`     "${r.status}" — ${r.name}`))
} else {
  console.log(ok('All rows matched at least one status pattern'))
}

// 4. KPI formulae
console.log('\n── KPI Formula Checks ─────────────────────')
const hr = kpi.hiringRate.toFixed(1)
console.log(kpi.hiringRate>=0 && kpi.hiringRate<=100 ? ok(`Hiring Rate ${hr}% (joined ${joined} / total ${totalApplicants})`) : err(`Hiring Rate out of range: ${hr}%`))

const odr = kpi.offerDropRate.toFixed(1)
console.log(kpi.offerDropRate>=0 && kpi.offerDropRate<=100 ? ok(`Offer Drop Rate ${odr}% (drops ${kpi.offerDrops} / offered ${offered})`) : err(`Offer Drop Rate out of range: ${odr}%`))

const oar = kpi.offerAcceptanceRate.toFixed(1)
console.log(kpi.offerAcceptanceRate>=0 && kpi.offerAcceptanceRate<=100 ? ok(`Offer Acceptance Rate ${oar}% (joined ${joined} / offered ${offered})`) : err(`Offer Acceptance out of range: ${oar}%`))

// OAR + ODR should ≈ 100% (joined+drops = offered, pending offers explain any remainder)
const pending = offered - joined - kpi.offerDrops
if(pending < 0) console.log(err(`Offer arithmetic broken: joined(${joined}) + drops(${kpi.offerDrops}) > offered(${offered})`))
else console.log(ok(`Offer arithmetic consistent — pending offers: ${pending}`))

// 5. Vacancies
console.log('\n── Vacancy Checks ─────────────────────────')
const {totalVacancies, filledVacancies, onHoldVacancies, inProcessVacancies} = kpi
const vacSum = filledVacancies + onHoldVacancies + inProcessVacancies
if(vacSum !== totalVacancies) console.log(err(`Vacancy status counts don't sum: ${filledVacancies}+${onHoldVacancies}+${inProcessVacancies}=${vacSum} ≠ total ${totalVacancies}`))
else console.log(ok(`Vacancies sum correctly: ${filledVacancies} filled + ${onHoldVacancies} on-hold + ${inProcessVacancies} in-process = ${totalVacancies}`))
console.log(ok(`Fill Rate: ${kpi.fillRate.toFixed(1)}%`))

// 6. Time to Fill
console.log('\n── Time to Fill ────────────────────────────')
if(kpi.avgTimeToFill === null) {
  console.log(warn('avgTimeToFill is null — no reqDate+joinDate pairs found. Likely missing dates in sheet.'))
} else if(kpi.avgTimeToFill < 0 || kpi.avgTimeToFill > 365) {
  console.log(err(`avgTimeToFill ${kpi.avgTimeToFill} days is out of expected range (0–365)`))
} else {
  console.log(ok(`avgTimeToFill = ${kpi.avgTimeToFill} days (from ${kpi.ttfCount} joined candidates with date data)`))
}

// 7. Quarterly trend — sum should equal total
console.log('\n── Quarterly Trend ────────────────────────')
const qTotal = Object.values(kpi.qMap).reduce((s,v)=>s+v.apps,0)
const qJoined = Object.values(kpi.qMap).reduce((s,v)=>s+v.joined,0)
if(qTotal !== totalApplicants) console.log(err(`Q trend apps sum ${qTotal} ≠ totalApplicants ${totalApplicants}`))
else console.log(ok(`Quarterly apps sum = ${qTotal} ✓`))
if(qJoined !== joined) console.log(err(`Q trend joined sum ${qJoined} ≠ joined ${joined}`))
else console.log(ok(`Quarterly joined sum = ${qJoined} ✓`))
console.log('  Distribution:', Object.entries(kpi.qMap).map(([q,v])=>`${q}:${v.apps}`).join(', '))

// 8. Source efficiency — total should equal totalApplicants
console.log('\n── Source Efficiency ───────────────────────')
const srcTotal = Object.values(kpi.sourceMap).reduce((s,v)=>s+v.total,0)
if(srcTotal !== totalApplicants) console.log(err(`Source totals sum ${srcTotal} ≠ totalApplicants ${totalApplicants}`))
else console.log(ok(`Source totals sum = ${srcTotal} ✓`))

// 9. BU performance — total should equal totalApplicants
console.log('\n── BU Performance ──────────────────────────')
const buTotal = Object.values(kpi.buMap).reduce((s,v)=>s+v.total,0)
if(buTotal !== totalApplicants) console.log(err(`BU totals sum ${buTotal} ≠ totalApplicants ${totalApplicants}`))
else console.log(ok(`BU totals sum = ${buTotal} ✓`))

// 10. Recruiter — joined sum
console.log('\n── Recruiter Performance ───────────────────')
const recJoined = Object.values(kpi.recMap).reduce((s,v)=>s+v.joined,0)
if(recJoined !== joined) console.log(err(`Recruiter joined sum ${recJoined} ≠ joined ${joined}`))
else console.log(ok(`Recruiter joined sums correctly to ${recJoined}`))
const recOffers = Object.values(kpi.recMap).reduce((s,v)=>s+v.offers,0)
// offers in recMap = joined + offerDrops + pending offers — should equal kpi.offered
if(recOffers !== offered) console.log(warn(`Recruiter offers sum ${recOffers} ≠ offered ${offered} (Unknown recruiter rows skipped in display)`))
else console.log(ok(`Recruiter offer sums correctly to ${recOffers}`))

console.log('\n══════════════════════════════════════════\n')
