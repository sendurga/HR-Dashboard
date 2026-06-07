import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

export const Route = createFileRoute('/')({
  component: Dashboard,
})

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
  funnel: { applied: number; shortlisted: number; interviewed: number; offered: number; joined: number }
  sourceEfficiency: { source: string; total: number; joined: number; rate: number }[]
  buPerformance: { bu: string; total: number; joined: number; rate: number }[]
  leakage: { candidateDrops: number; r1Rejects: number; noShows: number; r2Rejects: number; offerDrops: number; screenRejects: number }
  quarterlyTrend: { quarter: string; applicants: number; joined: number }[]
  recruiterPerformance: { recruiter: string; applications: number; offers: number; joined: number; convRate: number; offerDropRate: number }[]
  topPositions: { position: string; apps: number; joined: number }[]
  vacancyByBU: { bu: string; total: number; filled: number; onHold: number; inProcess: number }[]
  lastUpdated: string
}

const DEFAULT_APPLICANTS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRJjDWZWvkAm7MVC5aA0vAjS3QMzbgc9CC8ZFJ8v5mHqXKLUBEO5N0xPWKl7MHUMEQ5yZ2_Omv0j42F/pub?gid=2138370345&single=true&output=csv'
const DEFAULT_VACANCIES = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRJjDWZWvkAm7MVC5aA0vAjS3QMzbgc9CC8ZFJ8v5mHqXKLUBEO5N0xPWKl7MHUMEQ5yZ2_Omv0j42F/pub?gid=608034954&single=true&output=csv'

function pct(n: number) {
  return n.toFixed(1) + '%'
}
function num(n: number) {
  return n.toLocaleString()
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase',
      color: 'var(--text-muted)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem'
    }}>
      {children}
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
      padding: '1.5rem', overflow: 'hidden', ...style
    }}>
      {children}
    </div>
  )
}

function PanelTitle({ title, badge }: { title: string; badge?: string }) {
  return (
    <div style={{
      fontFamily: "'Playfair Display', serif", fontSize: '1rem', fontWeight: 500,
      color: 'var(--text-primary)', marginBottom: '1.25rem', paddingBottom: '0.75rem',
      borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
    }}>
      {title}
      {badge && (
        <span style={{
          fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-muted)', fontFamily: "'DM Sans', sans-serif",
          background: 'var(--warm-50)', padding: '2px 10px', borderRadius: 20, border: '1px solid var(--border)'
        }}>{badge}</span>
      )}
    </div>
  )
}

// Config dialog
function ConfigDialog({ onConfirm }: { onConfirm: (a: string, v: string) => void }) {
  const [applicants, setApplicants] = useState(DEFAULT_APPLICANTS)
  const [vacancies, setVacancies] = useState(DEFAULT_VACANCIES)
  const [useDefault, setUseDefault] = useState(true)

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(24,18,16,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 12, padding: '2.5rem', maxWidth: 560, width: '100%',
        border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.3)'
      }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
          Recruitment Dashboard
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.75rem', lineHeight: 1.6 }}>
          Connect your Google Sheets data to power this dashboard. Sheets must be published as CSV.
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={useDefault} onChange={e => setUseDefault(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--gold)' }} />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Use pre-configured data source (FY 2025–26)</span>
        </label>

        {!useDefault && (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>
                Applicants CSV URL
              </div>
              <input
                value={applicants}
                onChange={e => setApplicants(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/..."
                style={{
                  width: '100%', padding: '0.6rem 0.85rem', border: '1px solid var(--border)',
                  borderRadius: 6, fontSize: '0.8rem', color: 'var(--text-primary)', outline: 'none',
                  fontFamily: "'DM Sans', sans-serif", background: 'var(--warm-50)'
                }}
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>
                Vacancies CSV URL
              </div>
              <input
                value={vacancies}
                onChange={e => setVacancies(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/..."
                style={{
                  width: '100%', padding: '0.6rem 0.85rem', border: '1px solid var(--border)',
                  borderRadius: 6, fontSize: '0.8rem', color: 'var(--text-primary)', outline: 'none',
                  fontFamily: "'DM Sans', sans-serif", background: 'var(--warm-50)'
                }}
              />
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            onClick={() => onConfirm(DEFAULT_APPLICANTS, DEFAULT_VACANCIES)}
            style={{
              padding: '0.6rem 1.2rem', background: 'var(--warm-50)', border: '1px solid var(--border)',
              borderRadius: 6, fontSize: '0.82rem', cursor: 'pointer', color: 'var(--text-secondary)',
              fontFamily: "'DM Sans', sans-serif"
            }}
          >Skip</button>
          <button
            onClick={() => onConfirm(useDefault ? DEFAULT_APPLICANTS : applicants, useDefault ? DEFAULT_VACANCIES : vacancies)}
            style={{
              padding: '0.6rem 1.5rem', background: 'var(--slate-800)', border: 'none',
              borderRadius: 6, fontSize: '0.82rem', cursor: 'pointer', color: 'white',
              fontFamily: "'DM Sans', sans-serif", fontWeight: 600
            }}
          >Load Dashboard →</button>
        </div>
      </div>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
      <div style={{
        width: 40, height: 40, border: '3px solid var(--border)',
        borderTop: '3px solid var(--gold)', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Loading dashboard data…</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function FunnelBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pctVal = total > 0 ? (count / total) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{ width: 140, fontSize: '0.78rem', color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 30, background: 'var(--warm-50)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
        <div style={{ height: '100%', width: `${Math.max(pctVal, 1)}%`, background: color, borderRadius: 4, display: 'flex', alignItems: 'center', paddingLeft: '0.5rem', transition: 'width 0.8s ease' }}>
          {count > 0 && <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'white', whiteSpace: 'nowrap' }}>{num(count)}</span>}
        </div>
      </div>
      <div style={{ width: 40, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right', flexShrink: 0 }}>{num(count)}</div>
      <div style={{ width: 48, fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>{pct(pctVal)}</div>
    </div>
  )
}

function DropArrow({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.1rem 0 0.1rem 140px', fontSize: '0.68rem', color: '#C04A38', fontWeight: 500 }}>
      ▼ {label}
    </div>
  )
}

function getIndicatorStyle(rate: number, type: 'hiring' | 'dropRate'): { className: string; style: React.CSSProperties } {
  if (type === 'hiring') {
    if (rate >= 10) return { className: '', style: { background: '#EDFBF5', color: '#1A6845' } }
    if (rate >= 5) return { className: '', style: { background: '#FEF3DC', color: '#9A5D0A' } }
    return { className: '', style: { background: '#FDEAE8', color: '#9A2A1E' } }
  }
  if (rate >= 30) return { className: '', style: { background: '#FDEAE8', color: '#9A2A1E' } }
  if (rate >= 20) return { className: '', style: { background: '#FEF3DC', color: '#9A5D0A' } }
  return { className: '', style: { background: '#EDFBF5', color: '#1A6845' } }
}

function sourceColor(rate: number): string {
  if (rate >= 20) return '#2E8070'
  if (rate >= 10) return '#A34A1A'
  if (rate >= 5) return '#8A5F35'
  return '#9A3022'
}

function buBarColor(rate: number): string {
  if (rate >= 15) return 'var(--teal-400)'
  if (rate >= 8) return 'var(--amber-400)'
  return 'var(--brick-400)'
}

function rateColor(rate: number): string {
  if (rate >= 10) return 'var(--teal-500)'
  if (rate >= 5) return 'var(--amber-600)'
  return 'var(--brick-400)'
}

function DashboardContent({ data }: { data: DashboardData }) {
  const { kpis, funnel, sourceEfficiency, buPerformance, leakage, quarterlyTrend, recruiterPerformance, topPositions } = data
  const maxBUTotal = Math.max(...buPerformance.map(b => b.total), 1)
  const maxSourceTotal = Math.max(...sourceEfficiency.map(s => s.total), 1)
  const maxTopApps = topPositions.length > 0 ? topPositions[0].apps : 1

  const chartData = {
    labels: quarterlyTrend.map(q => q.quarter),
    datasets: [
      {
        label: 'Applicants',
        data: quarterlyTrend.map(q => q.applicants),
        backgroundColor: 'rgba(168, 128, 85, 0.75)',
        borderRadius: 4,
        borderSkipped: false as const,
      },
      {
        label: 'Joined',
        data: quarterlyTrend.map(q => q.joined),
        backgroundColor: 'rgba(46, 128, 112, 0.85)',
        borderRadius: 4,
        borderSkipped: false as const,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx: { dataset: { label: string }; parsed: { y: number } }) => ` ${ctx.dataset.label}: ${ctx.parsed.y}` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#998E80', font: { size: 12, family: 'DM Sans' } as const } },
      y: { grid: { color: 'rgba(200,189,179,0.3)', lineWidth: 0.5 }, ticks: { color: '#998E80', font: { size: 11, family: 'DM Sans' } as const }, border: { display: false } },
    },
  }

  const top7 = topPositions.slice(0, 7)
  const bottom7 = topPositions.slice(7, 14)

  return (
    <div style={{ paddingBottom: '2rem' }}>
      {/* KPI Strip */}
      <SectionLabel>Executive KPIs</SectionLabel>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1, background: 'var(--border)',
        border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: '2.5rem'
      }}>
        {/* Total Applicants - accent */}
        <div style={{ background: 'var(--slate-800)', padding: '1.4rem 1.25rem', position: 'relative' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--slate-300)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Total Applicants</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.2rem', fontWeight: 600, color: 'var(--gold)', lineHeight: 1, marginBottom: '0.3rem' }}>{num(kpis.totalApplicants)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--slate-300)' }}>Across all business units</div>
        </div>
        {/* Hiring Rate */}
        <div style={{ background: 'var(--surface)', padding: '1.4rem 1.25rem', position: 'relative' }}>
          <span style={{ position: 'absolute', top: '1.4rem', right: '1.25rem', fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 20, ...getIndicatorStyle(kpis.hiringRate, 'hiring').style }}>{pct(kpis.hiringRate)}</span>
          <div style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Hiring Rate</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.2rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1, marginBottom: '0.3rem' }}>{num(kpis.joined)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Candidates joined</div>
        </div>
        {/* Offer Drop Rate */}
        <div style={{ background: 'var(--surface)', padding: '1.4rem 1.25rem', position: 'relative' }}>
          <span style={{ position: 'absolute', top: '1.4rem', right: '1.25rem', fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 20, ...getIndicatorStyle(kpis.offerDropRate, 'dropRate').style }}>{pct(kpis.offerDropRate)}</span>
          <div style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Offer Drop Rate</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.2rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1, marginBottom: '0.3rem' }}>{num(leakage.offerDrops)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Of {num(kpis.offersExtended)} offers extended</div>
        </div>
        {/* Vacancies */}
        <div style={{ background: 'var(--surface)', padding: '1.4rem 1.25rem', position: 'relative' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Total Vacancies</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.2rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1, marginBottom: '0.3rem' }}>{num(kpis.totalVacancies)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{num(kpis.filledVacancies)} closed · {num(kpis.onHoldVacancies)} on hold</div>
        </div>
        {/* Fill Rate */}
        <div style={{ background: 'var(--surface)', padding: '1.4rem 1.25rem', position: 'relative' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Fill Rate</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.2rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1, marginBottom: '0.3rem' }}>{pct(kpis.fillRate)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Overall closure rate</div>
        </div>
        {/* Candidate Drops */}
        <div style={{ background: 'var(--surface)', padding: '1.4rem 1.25rem', position: 'relative' }}>
          <span style={{ position: 'absolute', top: '1.4rem', right: '1.25rem', fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#FDEAE8', color: '#9A2A1E' }}>
            {kpis.totalApplicants > 0 ? pct(kpis.candidateDrops / kpis.totalApplicants * 100) : '0%'}
          </span>
          <div style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Candidate Drops</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.2rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1, marginBottom: '0.3rem' }}>{num(kpis.candidateDrops)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mid-pipeline attrition</div>
        </div>
      </div>

      {/* Funnel + Source */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        <Panel>
          <PanelTitle title="Recruitment Funnel — Pipeline Conversion" badge={`${num(funnel.applied)} total applicants`} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <FunnelBar label="Applied" count={funnel.applied} total={funnel.applied} color="var(--slate-400)" />
            <DropArrow label={`Screen Shortlist Rate: ${funnel.applied > 0 ? pct(funnel.shortlisted / funnel.applied * 100) : '0%'}`} />
            <FunnelBar label="Screen Shortlisted" count={funnel.shortlisted} total={funnel.applied} color="var(--amber-400)" />
            <DropArrow label={`Interview Reach Rate: ${funnel.shortlisted > 0 ? pct(funnel.interviewed / funnel.shortlisted * 100) : '0%'}`} />
            <FunnelBar label="Reached Interview" count={funnel.interviewed} total={funnel.applied} color="var(--amber-500)" />
            <DropArrow label={`Offer Conversion: ${funnel.interviewed > 0 ? pct(funnel.offered / funnel.interviewed * 100) : '0%'}`} />
            <FunnelBar label="Extended Offers" count={funnel.offered} total={funnel.applied} color="var(--brick-400)" />
            <DropArrow label={`Offer Acceptance: ${funnel.offered > 0 ? pct(funnel.joined / funnel.offered * 100) : '0%'}`} />
            <FunnelBar label="Joined" count={funnel.joined} total={funnel.applied} color="var(--teal-400)" />
          </div>
        </Panel>

        <Panel>
          <PanelTitle title="Source Channel Efficiency" badge="by joining rate" />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {sourceEfficiency.map((s) => (
                <tr key={s.source} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.55rem 0', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)' }}>{s.source}</td>
                  <td style={{ padding: '0.55rem 0', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', width: 40 }}>{num(s.total)}</td>
                  <td style={{ padding: '0.55rem 0', width: 80 }}>
                    <div style={{ height: 5, borderRadius: 3, background: 'var(--amber-200)', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, background: 'var(--amber-400)', width: `${Math.min((s.total / maxSourceTotal) * 100, 100)}%` }} />
                    </div>
                  </td>
                  <td style={{ padding: '0.55rem 0', textAlign: 'right', fontWeight: 600, fontSize: '0.78rem', color: sourceColor(s.rate) }}>{pct(s.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {sourceEfficiency.length > 0 && (
            <div style={{ marginTop: '1rem', padding: '0.85rem 1rem', background: 'var(--gold-light)', borderRadius: 6, borderLeft: '3px solid var(--gold)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--amber-700)', marginBottom: '0.25rem' }}>⚡ Key Insight</div>
              <div style={{ fontSize: '0.73rem', color: 'var(--amber-800)', lineHeight: 1.5 }}>
                {(() => {
                  const top = [...sourceEfficiency].sort((a, b) => b.rate - a.rate)[0]
                  const bottom = [...sourceEfficiency].sort((a, b) => b.total - a.total)[0]
                  if (!top || !bottom) return 'Analyse source channels for optimal ROI.'
                  if (top.source === bottom.source) return `${top.source} is both the highest-volume and best-converting source at ${pct(top.rate)}.`
                  return `${bottom.source} drives the most applicants but ${top.source} yields ${(top.rate / Math.max(bottom.rate, 0.1)).toFixed(1)}× better conversion at ${pct(top.rate)}.`
                })()}
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* BU + Leakage + Vacancy */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        <Panel>
          <PanelTitle title="Business Unit Performance" badge="applicants → joined" />
          {buPerformance.map((bu) => (
            <div key={bu.bu} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 160, fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)', flexShrink: 0 }}>{bu.bu}</div>
              <div style={{ flex: 1, height: 22, background: 'var(--warm-50)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.max((bu.total / maxBUTotal) * 100, 2)}%`, background: buBarColor(bu.rate), borderRadius: 3, display: 'flex', alignItems: 'center', paddingLeft: '0.4rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'white', fontWeight: 600 }}>{num(bu.total)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', flexShrink: 0, width: 120, justifyContent: 'flex-end' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{num(bu.joined)}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Joined</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: rateColor(bu.rate) }}>{pct(bu.rate)}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Rate</div>
                </div>
              </div>
            </div>
          ))}
        </Panel>

        <Panel>
          <PanelTitle title="Pipeline Leakage Points" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem', gridAutoRows: 'minmax(140px, auto)' }}>
            <LeakCard type="drop" num={leakage.candidateDrops} label="Candidate Drops" sub={kpis.totalApplicants > 0 ? pct(leakage.candidateDrops / kpis.totalApplicants * 100) + ' of pipeline' : ''} />
            <LeakCard type="reject" num={leakage.r1Rejects} label="R1 Rejects" sub="Post-interview rejection" />
            <LeakCard type="noshow" num={leakage.noShows} label="No-Shows" sub={kpis.totalApplicants > 0 ? pct(leakage.noShows / kpis.totalApplicants * 100) + ' attrition' : ''} />
            <LeakCard type="reject" num={leakage.r2Rejects} label="R2 Rejects" sub="Second-stage drop" />
            <LeakCard type="offerdrop" num={leakage.offerDrops} label="Offer Drops" sub={kpis.offersExtended > 0 ? pct(leakage.offerDrops / kpis.offersExtended * 100) + ' of all offers' : ''} />
            <LeakCard type="success" num={kpis.joined} label="Successful Joins" sub={kpis.totalApplicants > 0 ? pct(kpis.hiringRate) + ' overall rate' : ''} />
          </div>
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#FBF0EE', borderRadius: 6, borderLeft: '3px solid #C04A38' }}>
            <div style={{ fontSize: '0.72rem', color: '#731B12', lineHeight: 1.5, fontWeight: 500 }}>
              ⚠ {num(leakage.screenRejects)} screen rejects + {num(leakage.candidateDrops)} candidate drops = {num(leakage.screenRejects + leakage.candidateDrops)} lost before interview
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelTitle title="Vacancy Tracker" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <VacStat num={kpis.totalVacancies} label="Total Open" color="var(--amber-600)" />
            <VacStat num={kpis.filledVacancies} label="Filled" color="var(--teal-500)" />
            <VacStat num={kpis.onHoldVacancies} label="On Hold" color="var(--brick-400)" />
            <VacStat num={kpis.inProcessVacancies} label="In Process" color="var(--warm-500)" />
          </div>
          <div style={{ marginTop: '1rem', position: 'relative' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 500, letterSpacing: '0.05em' }}>FILL RATE</div>
            <div style={{ height: 10, background: 'var(--warm-50)', borderRadius: 5, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div style={{ height: '100%', width: `${kpis.fillRate}%`, background: 'linear-gradient(90deg, var(--teal-400), var(--amber-400))', borderRadius: 5 }} />
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--teal-500)', fontWeight: 600, marginTop: '0.3rem' }}>{pct(kpis.fillRate)} overall closure rate</div>
          </div>
          {data.vacancyByBU.slice(0, 4).length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.05em', marginBottom: '0.5rem' }}>TOP BU FILL</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                {data.vacancyByBU.slice(0, 4).map(v => {
                  const fillPct = v.total > 0 ? v.filled / v.total : 0
                  return (
                    <div key={v.bu} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{v.bu}</span>
                      <span style={{ fontWeight: 600, color: fillPct >= 0.7 ? 'var(--teal-500)' : 'var(--amber-600)' }}>
                        {fillPct >= 0.7 ? 'High fill' : fillPct >= 0.4 ? 'Partial' : 'Low fill'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* Quarterly + Recruiter */}
      <SectionLabel>Quarterly Performance &amp; Recruiter Analytics</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        <Panel>
          <PanelTitle title="Quarterly Applicant vs. Joining Trend" />
          <div style={{ position: 'relative', height: 240 }}>
            <Bar data={chartData} options={chartOptions} />
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: '#998E80' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(168,128,85,0.75)', display: 'inline-block' }} /> Applicants
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: '#998E80' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(46,128,112,0.85)', display: 'inline-block' }} /> Joined
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelTitle title="Recruiter Performance Matrix" />
          {recruiterPerformance.length === 0 && (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>No recruiter data detected</div>
          )}
          {recruiterPerformance.slice(0, 3).map((r, i) => (
            <div key={r.recruiter} style={{ padding: '0.85rem 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{r.recruiter}</span>
                <span style={{
                  fontSize: '0.72rem', padding: '2px 10px', borderRadius: 20, border: '1px solid',
                  ...(i === 0
                    ? { background: '#EFF6F4', color: 'var(--teal-500)', borderColor: '#C8E8E2' }
                    : r.convRate >= 5
                    ? { background: '#FFF8EE', color: 'var(--amber-600)', borderColor: '#F9D5A0' }
                    : { background: '#FBF0EE', color: 'var(--brick-400)', borderColor: '#EBA99F' })
                }}>
                  {i === 0 ? 'Lead Performer' : r.convRate >= 5 ? 'Mid Performer' : 'Needs Support'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Applications <strong style={{ color: 'var(--text-secondary)' }}>{num(r.applications)}</strong></span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Offers <strong style={{ color: 'var(--text-secondary)' }}>{num(r.offers)}</strong></span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Joined <strong style={{ color: 'var(--text-secondary)' }}>{num(r.joined)}</strong></span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Conv. <strong style={{ color: rateColor(r.convRate) }}>{pct(r.convRate)}</strong></span>
              </div>
            </div>
          ))}
          {recruiterPerformance.length >= 2 && (
            <>
              <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {recruiterPerformance.slice(0, 2).map(r => (
                  <div key={r.recruiter} style={{ background: 'var(--warm-50)', borderRadius: 8, padding: '0.85rem', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Offer Drop ({r.recruiter})</div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', color: r.offerDropRate < 25 ? 'var(--teal-500)' : 'var(--brick-400)', fontWeight: 600 }}>{pct(r.offerDropRate)}</div>
                  </div>
                ))}
              </div>
              {recruiterPerformance.length >= 2 && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--gold-light)', borderRadius: 6, borderLeft: '3px solid var(--gold)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--amber-800)', lineHeight: 1.5 }}>
                    {recruiterPerformance[1].recruiter} handles {pct(recruiterPerformance[1].applications / Math.max(kpis.totalApplicants, 1) * 100)} of pipeline volume — workload redistribution or capability investment recommended.
                  </div>
                </div>
              )}
            </>
          )}
        </Panel>
      </div>

      {/* Top Positions */}
      <SectionLabel>Top Positions by Pipeline Volume</SectionLabel>
      <Panel>
        <PanelTitle title="Position-wise Applicant Flow &amp; Success Rate" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {[top7, bottom7].map((group, gi) => (
            <div key={gi}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.06em', marginBottom: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ flex: 1 }}>POSITION</span>
                <span style={{ width: 60, textAlign: 'right' }}>APPS</span>
                <span style={{ width: 60 }}></span>
                <span style={{ width: 40, textAlign: 'center' }}>JOINED</span>
              </div>
              {group.map(p => (
                <div key={p.position} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, fontSize: '0.78rem', color: 'var(--text-primary)' }}>{p.position}</div>
                  <div style={{ width: 32, textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{num(p.apps)}</div>
                  <div style={{ width: 60, height: 5, borderRadius: 3, background: 'var(--warm-50)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 3, width: `${(p.apps / maxTopApps) * 100}%`, background: p.joined >= 3 ? 'var(--teal-400)' : p.joined > 0 ? 'var(--amber-400)' : 'var(--brick-300)' }} />
                  </div>
                  <div style={{ width: 40, textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: 'var(--teal-500)' }}>{num(p.joined)}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

function LeakCard({ type, num: n, label, sub }: { type: string; num: number; label: string; sub: string }) {
  const colorMap: Record<string, { border: string; numColor: string }> = {
    drop: { border: 'var(--amber-400)', numColor: 'var(--amber-600)' },
    reject: { border: 'var(--brick-400)', numColor: 'var(--brick-500)' },
    noshow: { border: 'var(--slate-400)', numColor: 'var(--slate-500)' },
    offerdrop: { border: 'var(--brick-400)', numColor: 'var(--brick-500)' },
    success: { border: 'var(--teal-400)', numColor: 'var(--teal-500)' },
  }
  const c = colorMap[type] || colorMap.drop
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: '1.25rem 1.25rem 1.1rem', position: 'relative', overflow: 'hidden', background: 'rgba(255,255,255,0.96)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 140 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: c.border }} />
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.85rem', fontWeight: 600, lineHeight: 1, marginBottom: '0.35rem', color: c.numColor }}>{n.toLocaleString()}</div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '0.35rem' }}>{label}</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{sub}</div>
    </div>
  )
}

function VacStat({ num: n, label, color }: { num: number; label: string; color: string }) {
  return (
    <div style={{ background: 'var(--warm-50)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.9rem 1rem', textAlign: 'center' }}>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 600, lineHeight: 1, marginBottom: '0.25rem', color }}>{n.toLocaleString()}</div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>{label}</div>
    </div>
  )
}

function Dashboard() {
  const [showConfig, setShowConfig] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUrls, setLastUrls] = useState<{ a: string; v: string } | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>('')

  const fetchData = useCallback(async (applicantsUrl: string, vacanciesUrl: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (applicantsUrl !== DEFAULT_APPLICANTS) params.set('applicants', applicantsUrl)
      if (vacanciesUrl !== DEFAULT_VACANCIES) params.set('vacancies', vacanciesUrl)
      const url = `/.netlify/functions/dashboard-data${params.toString() ? '?' + params.toString() : ''}`
      const res = await fetch(url)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(err.error || res.statusText)
      }
      const json: DashboardData = await res.json()
      setData(json)
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const handleConfirm = (a: string, v: string) => {
    setShowConfig(false)
    setLastUrls({ a, v })
    fetchData(a, v)
  }

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!lastUrls) return
    const id = setInterval(() => fetchData(lastUrls.a, lastUrls.v), 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [lastUrls, fetchData])

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: 'var(--bg)', color: 'var(--text-primary)', minHeight: '100vh' }}>
      {showConfig && <ConfigDialog onConfirm={handleConfirm} />}

      {/* Header */}
      <div style={{ background: 'var(--slate-800)', padding: '2.5rem 3rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderBottom: '3px solid var(--gold)' }}>
        <div>
          <p style={{ fontSize: '0.85rem', color: 'var(--slate-300)', marginBottom: '0.35rem', fontWeight: 300, letterSpacing: '0.08em', textTransform: 'uppercase' }}>FY 2025 — 2026 · Talent Acquisition Intelligence</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.1rem', fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.02em', lineHeight: 1.15 }}>Recruitment Strategic Dashboard</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
          <div style={{ background: 'var(--gold)', color: 'var(--slate-800)', padding: '0.5rem 1.25rem', borderRadius: 2, fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Boardroom Ready · Q1–Q4
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {lastUpdated && <span style={{ fontSize: '0.72rem', color: 'var(--slate-400)' }}>Updated {lastUpdated}</span>}
            {!showConfig && (
              <button
                onClick={() => setShowConfig(true)}
                style={{ fontSize: '0.72rem', color: 'var(--gold)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >Change source</button>
            )}
            {lastUrls && !loading && (
              <button
                onClick={() => fetchData(lastUrls.a, lastUrls.v)}
                style={{ fontSize: '0.72rem', color: 'var(--gold)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >↻ Refresh</button>
            )}
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ padding: '2.5rem 3rem', maxWidth: 1600 }}>
        {loading && <LoadingSpinner />}
        {error && (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <div style={{ color: 'var(--brick-500)', fontWeight: 600, marginBottom: '0.5rem' }}>Failed to load data</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{error}</div>
            <button onClick={() => lastUrls && fetchData(lastUrls.a, lastUrls.v)} style={{ padding: '0.5rem 1.25rem', background: 'var(--slate-800)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem' }}>
              Retry
            </button>
          </div>
        )}
        {!loading && !error && data && <DashboardContent data={data} />}
      </div>

      {/* Footer */}
      <div style={{ background: 'var(--slate-800)', padding: '1.25rem 3rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem' }}>
        <p style={{ fontSize: '0.72rem', color: 'var(--slate-400)', letterSpacing: '0.05em' }}>Confidential · FY 2025–2026 Talent Acquisition Intelligence · Internal Distribution Only</p>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '0.9rem', color: 'var(--gold)', letterSpacing: '0.05em' }}>TA Analytics</div>
      </div>
    </div>
  )
}
