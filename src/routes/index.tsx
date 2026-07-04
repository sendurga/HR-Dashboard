import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useCallback, useRef } from 'react'
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
    avgTimeToFill: number | null
  }
  funnel: { applied: number; shortlisted: number; interviewed: number; offered: number; joined: number }
  sourceEfficiency: { source: string; total: number; joined: number; rate: number }[]
  buPerformance: { bu: string; total: number; joined: number; rate: number }[]
  topRejectionReasons: { reason: string; count: number }[]
  leakage: { candidateDrops: number; r1Rejects: number; noShows: number; r2Rejects: number; offerDrops: number; screenRejects: number }
  quarterlyTrend: { quarter: string; applicants: number; joined: number }[]
  recruiterPerformance: { recruiter: string; applications: number; offers: number; joined: number; convRate: number; offerDropRate: number }[]
  topPositions: { position: string; apps: number; joined: number }[]
  vacancyByBU: { bu: string; total: number; filled: number; onHold: number; inProcess: number }[]
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
    }[]
  }[]
  topOfferDropReasons: { reason: string; count: number }[]
  timeToFillByBU: { bu: string; avgDays: number }[]
  hiringTimeline: {
    bu: string
    position: string
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
  lastUpdated: string
}

const DEFAULT_APPLICANTS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRJjDWZWvkAm7MVC5aA0vAjS3QMzbgc9CC8ZFJ8v5mHqXKLUBEO5N0xPWKl7MHUMEQ5yZ2_Omv0j42F/pub?gid=2138370345&single=true&output=csv'
const DEFAULT_VACANCIES = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRJjDWZWvkAm7MVC5aA0vAjS3QMzbgc9CC8ZFJ8v5mHqXKLUBEO5N0xPWKl7MHUMEQ5yZ2_Omv0j42F/pub?gid=608034954&single=true&output=csv'

// ─── Credential verification (obscured) ─────────────────────
// Credentials are stored as SHA-256 hex digests, never in plain text
const AUTH_KEY = 'hrd_authed'
const _H = '0dda3f73b1195b3b098999237ff2202d10f2b09538a5ec4c6aceb8e5375ea453' // username hash
const _P = '8e6f347ae1169d93d6f2b87118552d890c24c753edbc9ce76010c79904769e54' // password hash

async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─── Utility functions ───────────────────────────────────────

function pct(n: number) { return n.toFixed(1) + '%' }
function num(n: number) { return n.toLocaleString() }

// ─── Shared UI Components ────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
      color: 'var(--text-muted)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem'
    }}>
      {children}
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="glass-panel" style={style}>
      {children}
    </div>
  )
}

function PanelTitle({ title, badge }: { title: string; badge?: string }) {
  return (
    <div style={{
      fontFamily: "'Playfair Display', serif", fontSize: '1rem', fontWeight: 600,
      color: 'var(--text-primary)', marginBottom: '1.25rem', paddingBottom: '0.75rem',
      borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
    }}>
      {title}
      {badge && (
        <span style={{
          fontSize: '0.68rem', fontWeight: 500, color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif",
          background: 'var(--warm-50)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)'
        }}>{badge}</span>
      )}
    </div>
  )
}

// ─── Login Screen ────────────────────────────────────────────

function LoginScreen({ onAuth }: { onAuth: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [checking, setChecking] = useState(false)
  const userRef = useRef<HTMLInputElement>(null)

  useEffect(() => { userRef.current?.focus() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setChecking(true)
    try {
      const uh = await sha256(username.trim())
      const ph = await sha256(password)
      if (uh === _H && ph === _P) {
        sessionStorage.setItem(AUTH_KEY, '1')
        onAuth()
      } else {
        setError('Invalid credentials. Please try again.')
        setShake(true)
        setTimeout(() => setShake(false), 600)
        setPassword('')
      }
    } finally {
      setChecking(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(135deg, var(--navy-900) 0%, var(--navy-800) 40%, var(--navy-700) 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      {/* Subtle radial glow */}
      <div style={{
        position: 'absolute', top: '18%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 300, borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(212,168,67,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      {/* Diagonal pattern */}
      <div className="header-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.5 }} />

      <div style={{ position: 'relative', width: '100%', maxWidth: 420, animation: shake ? 'shake 0.5s ease' : undefined }}>
        <div style={{
          animation: 'fadeInUp 0.5s cubic-bezier(0.22,1,0.36,1) both',
          background: 'rgba(15,27,45,0.85)',
          border: '1px solid rgba(212,168,67,0.2)',
          borderRadius: 20, padding: '2.75rem 2.5rem',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(212,168,67,0.1)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 52, height: 52, borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(212,168,67,0.2), rgba(212,168,67,0.05))',
              border: '1px solid rgba(212,168,67,0.25)',
              marginBottom: '1.25rem', fontSize: '1.5rem',
            }}>📊</div>
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1.45rem', fontWeight: 600, color: '#FFFFFF',
              letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: '0.4rem',
            }}>Talent Acquisition Intelligence</div>
            <div style={{ fontSize: '0.76rem', color: 'rgba(180,190,210,0.6)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500 }}>
              FY 2025 – 26 · Strategic Dashboard
            </div>
          </div>
          <div style={{ height: 1, background: 'rgba(212,168,67,0.12)', marginBottom: '1.75rem' }} />
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'rgba(180,190,210,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.45rem' }}>Username</label>
              <input
                ref={userRef}
                className="login-input"
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setError('') }}
                placeholder="Enter your username"
                autoComplete="username"
                style={{
                  width: '100%', padding: '0.75rem 1rem',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(212,168,67,0.18)',
                  borderRadius: 10, fontSize: '0.88rem', color: '#E8ECF4',
                  fontFamily: "'Inter', sans-serif",
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'rgba(180,190,210,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.45rem' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="login-input"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  style={{
                    width: '100%', padding: '0.75rem 2.75rem 0.75rem 1rem',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(212,168,67,0.18)',
                    borderRadius: 10, fontSize: '0.88rem', color: '#E8ECF4',
                    fontFamily: "'Inter', sans-serif",
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  style={{
                    position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(180,190,210,0.5)', fontSize: '0.75rem', padding: 0,
                    transition: 'color 0.2s', fontFamily: "'Inter', sans-serif",
                  }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--gold)' }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.color = 'rgba(180,190,210,0.5)' }}
                >{showPass ? 'hide' : 'show'}</button>
              </div>
            </div>
            {error && (
              <div style={{
                marginBottom: '1.25rem', padding: '0.7rem 1rem',
                background: 'rgba(160,42,30,0.18)', border: '1px solid rgba(160,42,30,0.3)',
                borderRadius: 10, fontSize: '0.8rem', color: '#E8998F',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>⚠ {error}</div>
            )}
            <button
              type="submit"
              disabled={checking}
              style={{
                width: '100%', padding: '0.85rem',
                background: 'var(--gold)',
                border: 'none', borderRadius: 10,
                fontSize: '0.86rem', fontWeight: 700,
                color: 'var(--navy-900)', cursor: checking ? 'wait' : 'pointer',
                fontFamily: "'Inter', sans-serif",
                letterSpacing: '0.06em', textTransform: 'uppercase',
                transition: 'background 0.2s, transform 0.15s, box-shadow 0.2s',
                boxShadow: '0 4px 14px rgba(212,168,67,0.25)',
                opacity: checking ? 0.7 : 1,
              }}
              onMouseEnter={e => { if (!checking) { const b = e.target as HTMLButtonElement; b.style.background = '#E0B854'; b.style.transform = 'translateY(-1px)'; b.style.boxShadow = '0 6px 20px rgba(212,168,67,0.35)' } }}
              onMouseLeave={e => { const b = e.target as HTMLButtonElement; b.style.background = 'var(--gold)'; b.style.transform = 'translateY(0)'; b.style.boxShadow = '0 4px 14px rgba(212,168,67,0.25)' }}
            >{checking ? 'Verifying…' : 'Sign In →'}</button>
          </form>
          <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.68rem', color: 'rgba(180,190,210,0.3)', letterSpacing: '0.05em' }}>
            Confidential · Internal Access Only
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Config Dialog ───────────────────────────────────────────

function ConfigDialog({ onConfirm }: { onConfirm: (a: string, v: string) => void }) {
  const [applicants, setApplicants] = useState(DEFAULT_APPLICANTS)
  const [vacancies, setVacancies] = useState(DEFAULT_VACANCIES)
  const [useDefault, setUseDefault] = useState(true)

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(7,14,26,0.6)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'white', borderRadius: 20, padding: '2.5rem', maxWidth: 560, width: '100%',
        border: '1px solid var(--border)', boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
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
              <input value={applicants} onChange={e => setApplicants(e.target.value)} placeholder="https://docs.google.com/spreadsheets/..."
                style={{ width: '100%', padding: '0.6rem 0.85rem', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--text-primary)', outline: 'none', fontFamily: "'Inter', sans-serif", background: 'var(--warm-50)' }}
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>
                Vacancies CSV URL
              </div>
              <input value={vacancies} onChange={e => setVacancies(e.target.value)} placeholder="https://docs.google.com/spreadsheets/..."
                style={{ width: '100%', padding: '0.6rem 0.85rem', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--text-primary)', outline: 'none', fontFamily: "'Inter', sans-serif", background: 'var(--warm-50)' }}
              />
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            onClick={() => onConfirm(DEFAULT_APPLICANTS, DEFAULT_VACANCIES)}
            style={{ padding: '0.6rem 1.2rem', background: 'var(--warm-50)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.82rem', cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif" }}
          >Skip</button>
          <button
            onClick={() => onConfirm(useDefault ? DEFAULT_APPLICANTS : applicants, useDefault ? DEFAULT_VACANCIES : vacancies)}
            style={{ padding: '0.6rem 1.5rem', background: 'var(--navy-800)', border: 'none', borderRadius: 8, fontSize: '0.82rem', cursor: 'pointer', color: 'white', fontFamily: "'Inter', sans-serif", fontWeight: 600 }}
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
    </div>
  )
}

// ─── Funnel Components ───────────────────────────────────────

function FunnelBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pctVal = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="data-row" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '2px 0', borderRadius: 6 }}>
      <div style={{ width: 140, fontSize: '0.78rem', color: 'var(--text-secondary)', flexShrink: 0, fontWeight: 500 }}>{label}</div>
      <div style={{ flex: 1, height: 30, background: 'var(--warm-50)', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
        <div style={{ height: '100%', width: `${Math.max(pctVal, 1)}%`, background: color, borderRadius: 6, display: 'flex', alignItems: 'center', paddingLeft: '0.5rem', transition: 'width 0.8s ease' }}>
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.1rem 0 0.1rem 140px', fontSize: '0.68rem', color: 'var(--brick-400)', fontWeight: 500 }}>
      ▼ {label}
    </div>
  )
}

// ─── Indicator Helpers ───────────────────────────────────────

function getIndicatorStyle(rate: number, type: 'hiring' | 'dropRate'): React.CSSProperties {
  if (type === 'hiring') {
    if (rate >= 10) return { background: '#EDFBF5', color: '#1A6845' }
    if (rate >= 5) return { background: '#FEF3DC', color: '#9A5D0A' }
    return { background: '#FDEAE8', color: '#9A2A1E' }
  }
  if (rate >= 30) return { background: '#FDEAE8', color: '#9A2A1E' }
  if (rate >= 20) return { background: '#FEF3DC', color: '#9A5D0A' }
  return { background: '#EDFBF5', color: '#1A6845' }
}

function sourceColor(rate: number): string {
  if (rate >= 20) return 'var(--teal-400)'
  if (rate >= 10) return 'var(--amber-500)'
  if (rate >= 5) return 'var(--warm-500)'
  return 'var(--brick-400)'
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

// ─── Leakage / Vacancy Cards ─────────────────────────────────

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
    <div className="kpi-card-hover" style={{
      border: '1px solid var(--border)', borderRadius: 16, padding: '1.25rem', position: 'relative', overflow: 'hidden',
      background: 'var(--glass-bg)', backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 130,
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: c.border, borderRadius: '4px 0 0 4px' }} />
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.85rem', fontWeight: 700, lineHeight: 1, marginBottom: '0.35rem', color: c.numColor }}>{n.toLocaleString()}</div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{sub}</div>
    </div>
  )
}

function VacStat({ num: n, label, color }: { num: number; label: string; color: string }) {
  return (
    <div className="kpi-card-hover" style={{
      background: 'var(--warm-50)', border: '1px solid var(--border)', borderRadius: 12,
      padding: '0.9rem 1rem', textAlign: 'center',
    }}>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 700, lineHeight: 1, marginBottom: '0.25rem', color }}>{n.toLocaleString()}</div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>{label}</div>
    </div>
  )
}

// ─── Tab Definitions ─────────────────────────────────────────

const TABS = [
  { id: 'overview', label: '📊 Overview', icon: '📊' },
  { id: 'performance', label: '🏢 Performance', icon: '🏢' },
  { id: 'analytics', label: '📈 Analytics', icon: '📈' },
  { id: 'positions', label: '💼 Positions', icon: '💼' },
  { id: 'glossary', label: '📖 Glossary', icon: '📖' },
] as const

type TabId = typeof TABS[number]['id']

// ═══════════════════════════════════════════════════════════════
//  TAB 1: OVERVIEW — KPIs + Funnel + Source Efficiency
// ═══════════════════════════════════════════════════════════════

function OverviewTab({ data }: { data: DashboardData }) {
  const { kpis, funnel, sourceEfficiency } = data
  const maxSourceTotal = Math.max(...sourceEfficiency.map(s => s.total), 1)

  return (
    <div className="tab-content">
      {/* KPI Strip */}
      <SectionLabel>Executive KPIs</SectionLabel>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2.5rem',
      }}>
        {/* Total Applicants — hero card */}
        <div className="kpi-card-hover" style={{
          background: 'linear-gradient(135deg, var(--navy-800) 0%, var(--navy-700) 100%)',
          borderRadius: 16, padding: '1.5rem', position: 'relative', overflow: 'hidden',
          gridColumn: 'span 1',
        }}>
          <div className="header-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.3 }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 500, color: 'rgba(180,190,210,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Total Applicants</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.4rem', fontWeight: 700, color: 'var(--gold)', lineHeight: 1, marginBottom: '0.3rem' }}>{num(kpis.totalApplicants)}</div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(180,190,210,0.5)' }}>Across all business units</div>
          </div>
        </div>
        {/* Hiring Rate */}
        <KpiCard label="Hiring Rate" value={num(kpis.joined)} sub="Candidates joined" badge={pct(kpis.hiringRate)} badgeStyle={getIndicatorStyle(kpis.hiringRate, 'hiring')} />
        {/* Offer Acceptance Rate */}
        <KpiCard label="Offer Acceptance" value={pct(kpis.offerAcceptanceRate)} sub={`Of ${num(kpis.offersExtended)} offers extended`} badgeStyle={getIndicatorStyle(100 - kpis.offerAcceptanceRate, 'dropRate')} />
        {/* Avg Time to Fill */}
        <KpiCard label="Avg Time to Fill" value={kpis.avgTimeToFill !== null ? `${kpis.avgTimeToFill}` : '—'} sub={kpis.avgTimeToFill !== null ? 'Days average' : 'Date data unavailable'} />
        {/* Total Vacancies */}
        <KpiCard label="Total Vacancies" value={num(kpis.totalVacancies)} sub={`${num(kpis.filledVacancies)} closed · ${num(kpis.onHoldVacancies)} on hold`} />
        {/* Candidate Drops */}
        <KpiCard label="Candidate Drops" value={num(kpis.candidateDrops)} sub="Mid-pipeline attrition"
          badge={kpis.totalApplicants > 0 ? pct(kpis.candidateDrops / kpis.totalApplicants * 100) : '0%'}
          badgeStyle={{ background: '#FDEAE8', color: '#9A2A1E' }} />
      </div>

      {/* Funnel + Source */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <Panel>
          <PanelTitle title="Recruitment Funnel — Pipeline Conversion" badge={`${num(funnel.applied)} total applicants`} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <FunnelBar label="Applied" count={funnel.applied} total={funnel.applied} color="var(--navy-500)" />
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
                <tr key={s.source} className="data-row" style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.6rem 0', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)' }}>{s.source}</td>
                  <td style={{ padding: '0.6rem 0', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', width: 40 }}>{num(s.total)}</td>
                  <td style={{ padding: '0.6rem 0', width: 80 }}>
                    <div style={{ height: 5, borderRadius: 3, background: 'var(--amber-200)', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, background: 'var(--amber-400)', width: `${Math.min((s.total / maxSourceTotal) * 100, 100)}%` }} />
                    </div>
                  </td>
                  <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 600, fontSize: '0.78rem', color: sourceColor(s.rate) }}>{pct(s.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {sourceEfficiency.length > 0 && (
            <div style={{ marginTop: '1rem', padding: '0.85rem 1rem', background: 'var(--gold-light)', borderRadius: 10, borderLeft: '3px solid var(--gold)' }}>
              <div style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--amber-700)', marginBottom: '0.25rem' }}>⚡ Key Insight</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--amber-800)', lineHeight: 1.5 }}>
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
    </div>
  )
}

function KpiCard({ label, value, sub, badge, badgeStyle }: { label: string; value: string; sub: string; badge?: string; badgeStyle?: React.CSSProperties }) {
  return (
    <div className="kpi-card-hover" style={{
      background: 'white', borderRadius: 16, padding: '1.4rem 1.25rem', position: 'relative',
      border: '1px solid var(--border)',
    }}>
      {badge && (
        <span style={{ position: 'absolute', top: '1.2rem', right: '1.1rem', fontSize: '0.7rem', fontWeight: 600, padding: '3px 10px', borderRadius: 20, ...badgeStyle }}>{badge}</span>
      )}
      <div style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>{label}</div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.2rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, marginBottom: '0.3rem' }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sub}</div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  TAB 2: PERFORMANCE — BU + Leakage + Vacancy
// ═══════════════════════════════════════════════════════════════

function PerformanceTab({ data }: { data: DashboardData }) {
  const { kpis, buPerformance, leakage } = data
  const maxBUTotal = Math.max(...buPerformance.map(b => b.total), 1)

  return (
    <div className="tab-content">
      <SectionLabel>Business Unit Performance &amp; Pipeline Health</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', gap: '1.5rem' }}>
        <Panel>
          <PanelTitle title="Business Unit Performance" badge="applicants → joined" />
          {buPerformance.map((bu) => (
            <div key={bu.bu} className="data-row" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border)', borderRadius: 4 }}>
              <div style={{ width: 150, fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)', flexShrink: 0 }}>{bu.bu}</div>
              <div style={{ flex: 1, height: 22, background: 'var(--warm-50)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.max((bu.total / maxBUTotal) * 100, 2)}%`, background: buBarColor(bu.rate), borderRadius: 4, display: 'flex', alignItems: 'center', paddingLeft: '0.4rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'white', fontWeight: 600 }}>{num(bu.total)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', flexShrink: 0, width: 170, justifyContent: 'flex-end' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{num(bu.joined)}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Joined</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: rateColor(bu.rate) }}>{pct(bu.rate)}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Rate</div>
                </div>
                <div style={{ textAlign: 'center', width: 40 }}>
                  <div style={{
                    fontSize: '0.78rem', fontWeight: 600, color: (() => {
                      const ttf = data.timeToFillByBU?.find(t => t.bu === bu.bu)?.avgDays;
                      if (!ttf) return 'var(--text-muted)';
                      return ttf <= 30 ? 'var(--teal-500)' : ttf <= 60 ? 'var(--amber-600)' : 'var(--brick-500)';
                    })()
                  }}>
                    {(() => {
                      const ttf = data.timeToFillByBU?.find(t => t.bu === bu.bu)?.avgDays;
                      return ttf ? `${ttf}d` : '-';
                    })()}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Time</div>
                </div>
              </div>
            </div>
          ))}
        </Panel>

        <Panel>
          <PanelTitle title="Pipeline Leakage Points" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
            <LeakCard type="drop" num={leakage.candidateDrops} label="Candidate Drops" sub={kpis.totalApplicants > 0 ? pct(leakage.candidateDrops / kpis.totalApplicants * 100) + ' of pipeline' : ''} />
            <LeakCard type="reject" num={leakage.r1Rejects} label="R1 Rejects" sub="Post-interview rejection" />
            <LeakCard type="noshow" num={leakage.noShows} label="No-Shows" sub={kpis.totalApplicants > 0 ? pct(leakage.noShows / kpis.totalApplicants * 100) + ' attrition' : ''} />
            <LeakCard type="reject" num={leakage.r2Rejects} label="R2 Rejects" sub="Second-stage drop" />
            <LeakCard type="offerdrop" num={leakage.offerDrops} label="Offer Drops" sub={kpis.offersExtended > 0 ? pct(leakage.offerDrops / kpis.offersExtended * 100) + ' of all offers' : ''} />
            <LeakCard type="success" num={kpis.joined} label="Successful Joins" sub={kpis.totalApplicants > 0 ? pct(kpis.hiringRate) + ' overall rate' : ''} />
          </div>
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#FBF0EE', borderRadius: 10, borderLeft: '3px solid var(--brick-400)' }}>
            <div style={{ fontSize: '0.72rem', color: '#731B12', lineHeight: 1.5, fontWeight: 500 }}>
              ⚠ {num(kpis.screenRejects)} screen rejects + {num(leakage.candidateDrops)} candidate drops = {num(kpis.screenRejects + leakage.candidateDrops)} lost before interview
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
          <div style={{ marginTop: '1rem' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 500, letterSpacing: '0.05em' }}>FILL RATE</div>
            <div style={{ height: 10, background: 'var(--warm-50)', borderRadius: 5, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div style={{ height: '100%', width: `${kpis.fillRate}%`, background: 'linear-gradient(90deg, var(--teal-400), var(--gold))', borderRadius: 5, transition: 'width 0.8s ease' }} />
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
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  TAB 3: ANALYTICS — Quarterly Trend + Recruiter Performance
// ═══════════════════════════════════════════════════════════════

function AnalyticsTab({ data }: { data: DashboardData }) {
  const { kpis, quarterlyTrend, recruiterPerformance } = data

  const chartData = {
    labels: quarterlyTrend.map(q => q.quarter),
    datasets: [
      {
        label: 'Applicants',
        data: quarterlyTrend.map(q => q.applicants),
        backgroundColor: 'rgba(15, 27, 45, 0.6)',
        borderRadius: 6,
        borderSkipped: false as const,
      },
      {
        label: 'Joined',
        data: quarterlyTrend.map(q => q.joined),
        backgroundColor: 'rgba(46, 128, 112, 0.85)',
        borderRadius: 6,
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
      x: { grid: { display: false }, ticks: { color: '#8E8E9E', font: { size: 11, family: 'Inter' } as const } },
      y: { grid: { color: 'rgba(200,189,179,0.25)', lineWidth: 0.5 }, ticks: { color: '#8E8E9E', font: { size: 10, family: 'Inter' } as const }, border: { display: false } },
    },
  }

  return (
    <div className="tab-content">
      <SectionLabel>Quarterly Performance &amp; Recruiter Analytics</SectionLabel>

      {/* ── Quarterly Chart + Recruiter Matrix ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <Panel>
          <PanelTitle title="Quarterly Applicant vs. Joining Trend" />
          <div style={{ position: 'relative', height: 140 }}>
            <Bar data={chartData} options={chartOptions} />
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(15,27,45,0.6)', display: 'inline-block' }} /> Applicants
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(46,128,112,0.85)', display: 'inline-block' }} /> Joined
            </div>
          </div>
          {/* Quick Q stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', marginTop: '0.75rem' }}>
            {quarterlyTrend.map(q => (
              <div key={q.quarter} style={{ background: 'var(--warm-50)', borderRadius: 8, padding: '0.45rem 0.4rem', textAlign: 'center', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{q.quarter}</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.05rem', fontWeight: 700, color: 'var(--navy-800)', lineHeight: 1.1 }}>{num(q.applicants)}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--teal-500)', fontWeight: 600 }}>{num(q.joined)} joined</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelTitle title="Recruiter Performance Matrix" />
          {recruiterPerformance.length === 0 && (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>No recruiter data detected</div>
          )}
          {recruiterPerformance.slice(0, 3).map((r, i) => (
            <div key={r.recruiter} className="data-row" style={{ padding: '0.85rem 0', borderBottom: '1px solid var(--border)', borderRadius: 4 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{r.recruiter}</span>
                <span style={{
                  fontSize: '0.72rem', padding: '3px 12px', borderRadius: 20, border: '1px solid',
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
                  <div key={r.recruiter} style={{ background: 'var(--warm-50)', borderRadius: 12, padding: '0.85rem', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Offer Drop ({r.recruiter})</div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', color: r.offerDropRate < 25 ? 'var(--teal-500)' : 'var(--brick-400)', fontWeight: 700 }}>{pct(r.offerDropRate)}</div>
                  </div>
                ))}
              </div>
              {recruiterPerformance.length >= 2 && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--gold-light)', borderRadius: 10, borderLeft: '3px solid var(--gold)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--amber-800)', lineHeight: 1.5 }}>
                    {recruiterPerformance[1].recruiter} handles {pct(recruiterPerformance[1].applications / Math.max(kpis.totalApplicants, 1) * 100)} of pipeline volume — workload redistribution or capability investment recommended.
                  </div>
                </div>
              )}
            </>
          )}
        </Panel>
      </div>



      {/* ── Rejection & Offer Drop Reasons ── */}
      <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <Panel>
          <PanelTitle title="Top Rejection Reasons" badge="From 'Reason for Rejection' column" />
          {data.topRejectionReasons.length === 0 ? (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>No rejection reasons detected</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {data.topRejectionReasons.slice(0, 5).map(r => (
                <div key={r.reason} className="data-row" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '1.1rem', fontFamily: "'Playfair Display', serif", fontWeight: 700, color: 'var(--brick-500)', width: 30, textAlign: 'center' }}>{num(r.count)}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, flex: 1 }}>{r.reason}</div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <PanelTitle title="Top Offer Decline Reasons" badge="Candidates who dropped offers" />
          {!data.topOfferDropReasons || data.topOfferDropReasons.length === 0 ? (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>No offer decline reasons detected</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {data.topOfferDropReasons.map(r => (
                <div key={r.reason} className="data-row" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '1.1rem', fontFamily: "'Playfair Display', serif", fontWeight: 700, color: 'var(--amber-600)', width: 30, textAlign: 'center' }}>{num(r.count)}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, flex: 1 }}>{r.reason}</div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* ─── Hiring Timeline per Position per BU ─── */}
      {data.hiringTimelineByBU && data.hiringTimelineByBU.length > 0 ? (
        <HiringTimelineByBU data={data} />
      ) : (
        <Panel>
          <PanelTitle title="Hiring Timeline per Position per Business Unit" />
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>No hiring timeline data available</div>
        </Panel>
      )}
    </div>
  )
}

// ─── Hiring Timeline by BU (used inside AnalyticsTab) ────────

function HiringTimelineByBU({ data }: { data: DashboardData }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const timeline = data.hiringTimelineByBU || []
  const globalMax = Math.max(...timeline.flatMap(bu => bu.positions.map(p => p.total)), 1)

  const toggleBU = (bu: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(bu)) next.delete(bu)
      else next.add(bu)
      return next
    })
  }

  // Split BUs into two columns
  const mid = Math.ceil(timeline.length / 2)
  const columns = [timeline.slice(0, mid), timeline.slice(mid)]

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <SectionLabel>Hiring Timeline per Position per Business Unit</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'start' }}>
        {columns.map((col, ci) => (
          <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {col.map(bu => {
              const isOpen = expanded.has(bu.bu)
              const rate = bu.totalApplicants > 0 ? (bu.totalJoined / bu.totalApplicants) * 100 : 0
              return (
                <div key={bu.bu} style={{
                  border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden',
                  background: 'white', transition: 'box-shadow 0.2s',
                  boxShadow: isOpen ? '0 4px 16px rgba(0,0,0,0.06)' : 'none',
                }}>
                  {/* BU Header — clickable */}
                  <div
                    onClick={() => toggleBU(bu.bu)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.7rem 1rem', cursor: 'pointer',
                      background: isOpen
                        ? 'linear-gradient(135deg, var(--navy-800) 0%, var(--navy-700) 100%)'
                        : 'var(--warm-50)',
                      transition: 'background 0.25s',
                      userSelect: 'none',
                    }}
                  >
                    {/* Chevron */}
                    <span style={{
                      fontSize: '0.65rem', color: isOpen ? 'var(--gold)' : 'var(--text-muted)',
                      transition: 'transform 0.25s', display: 'inline-block',
                      transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                    }}>▶</span>

                    {/* BU Name */}
                    <span style={{
                      flex: 1, fontSize: '0.8rem', fontWeight: 600,
                      color: isOpen ? '#FFFFFF' : 'var(--text-primary)',
                      fontFamily: "'Playfair Display', serif",
                      letterSpacing: '-0.01em',
                    }}>{bu.bu}</span>

                    {/* Position count badge */}
                    <span style={{
                      fontSize: '0.62rem', fontWeight: 500,
                      color: isOpen ? 'rgba(180,190,210,0.7)' : 'var(--text-muted)',
                      background: isOpen ? 'rgba(255,255,255,0.08)' : 'var(--bg)',
                      padding: '2px 8px', borderRadius: 10,
                      border: `1px solid ${isOpen ? 'rgba(255,255,255,0.1)' : 'var(--border)'}`,
                    }}>
                      {bu.positions.length} position{bu.positions.length !== 1 ? 's' : ''}
                    </span>

                    {/* Summary stats */}
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexShrink: 0 }}>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 500,
                        color: isOpen ? 'rgba(180,190,210,0.6)' : 'var(--text-muted)',
                      }}>
                        {bu.totalApplicants} apps
                      </span>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 600,
                        color: isOpen ? 'var(--teal-300)' : 'var(--teal-500)',
                      }}>
                        {bu.totalJoined} joined
                      </span>
                      <span style={{
                        fontSize: '0.62rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                        ...(rate >= 10
                          ? { background: isOpen ? 'rgba(46,128,112,0.25)' : '#EDFBF5', color: isOpen ? '#6EDCC4' : '#1A6845' }
                          : rate >= 5
                            ? { background: isOpen ? 'rgba(212,168,67,0.2)' : '#FEF3DC', color: isOpen ? '#F0C75E' : '#9A5D0A' }
                            : { background: isOpen ? 'rgba(160,42,30,0.2)' : '#FDEAE8', color: isOpen ? '#E8998F' : '#9A2A1E' }
                        ),
                      }}>
                        {pct(rate)}
                      </span>
                    </div>
                  </div>

                  {/* Expanded position list */}
                  {isOpen && (
                    <div style={{ padding: '0.5rem 0.75rem 0.65rem' }}>
                      {/* Column headers */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0 0.25rem 0.35rem', marginBottom: '0.2rem',
                        borderBottom: '1px solid var(--border)',
                        fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.08em',
                      }}>
                        <span style={{ flex: 1, minWidth: 0 }}>Position</span>
                        <span style={{ width: 36, textAlign: 'right' }}>Apps</span>
                        <span style={{ width: 140 }}></span>
                        <span style={{ width: 32, textAlign: 'center' }}>✓</span>
                        <span style={{ width: 32, textAlign: 'center' }}>↓</span>
                        <span style={{ width: 36, textAlign: 'right' }}>Days</span>
                      </div>

                      {bu.positions.map(pos => {
                        const barW = globalMax > 0 ? (pos.total / globalMax) * 100 : 0
                        const joinedW = pos.total > 0 ? (pos.joined / pos.total) * 100 : 0
                        const offeredW = pos.total > 0 ? (pos.offered / pos.total) * 100 : 0
                        return (
                          <div key={pos.position} className="data-row" style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            padding: '0.2rem 0.25rem', borderRadius: 4, minHeight: 26,
                          }}>
                            {/* Position name — truncated */}
                            <div style={{
                              flex: 1, minWidth: 0, fontSize: '0.72rem', color: 'var(--text-secondary)',
                              fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }} title={pos.position}>
                              {pos.position}
                            </div>

                            {/* Count */}
                            <div style={{ width: 36, textAlign: 'right', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500, flexShrink: 0 }}>
                              {pos.total}
                            </div>

                            {/* Stacked bar */}
                            <div style={{
                              width: 140, height: 14, background: 'var(--warm-50)', borderRadius: 3,
                              overflow: 'hidden', position: 'relative', flexShrink: 0,
                            }}>
                              {/* Total bar (navy) */}
                              <div style={{
                                position: 'absolute', left: 0, top: 0, height: '100%',
                                width: `${Math.max(barW, 2)}%`,
                                background: 'rgba(15,27,45,0.12)', borderRadius: 3,
                              }} />
                              {/* Offered bar (amber) */}
                              <div style={{
                                position: 'absolute', left: 0, top: 0, height: '100%',
                                width: `${Math.max(barW * offeredW / 100, 0)}%`,
                                background: 'rgba(212,168,67,0.4)', borderRadius: 3,
                              }} />
                              {/* Joined bar (teal) */}
                              <div style={{
                                position: 'absolute', left: 0, top: 0, height: '100%',
                                width: `${Math.max(barW * joinedW / 100, 0)}%`,
                                background: 'var(--teal-400)', borderRadius: 3,
                                transition: 'width 0.5s ease',
                              }} />
                            </div>

                            {/* Joined count */}
                            <div style={{
                              width: 32, textAlign: 'center', fontSize: '0.68rem', fontWeight: 600,
                              color: pos.joined > 0 ? 'var(--teal-500)' : 'var(--text-muted)', flexShrink: 0,
                            }}>
                              {pos.joined}
                            </div>

                            {/* Dropped count */}
                            <div style={{
                              width: 32, textAlign: 'center', fontSize: '0.68rem', fontWeight: 500,
                              color: pos.dropped > 0 ? 'var(--brick-400)' : 'var(--text-muted)', flexShrink: 0,
                            }}>
                              {pos.dropped}
                            </div>

                            {/* Avg days */}
                            <div style={{
                              width: 36, textAlign: 'right', fontSize: '0.66rem', fontWeight: 500, flexShrink: 0,
                              color: pos.avgDays !== null
                                ? pos.avgDays <= 30 ? 'var(--teal-500)' : pos.avgDays <= 60 ? 'var(--amber-600)' : 'var(--brick-500)'
                                : 'var(--text-muted)',
                            }}>
                              {pos.avgDays !== null ? `${pos.avgDays}d` : '–'}
                            </div>
                          </div>
                        )
                      })}

                      {/* Legend */}
                      <div style={{
                        display: 'flex', gap: '1rem', justifyContent: 'flex-end',
                        marginTop: '0.4rem', paddingTop: '0.3rem', borderTop: '1px solid var(--border)',
                      }}>
                        {[
                          { color: 'rgba(15,27,45,0.12)', label: 'Applied' },
                          { color: 'rgba(212,168,67,0.4)', label: 'Offered' },
                          { color: 'var(--teal-400)', label: 'Joined' },
                        ].map(l => (
                          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color, display: 'inline-block' }} />
                            {l.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  TAB 4: POSITIONS — Top positions by pipeline volume
// ═══════════════════════════════════════════════════════════════

function PositionsTab({ data }: { data: DashboardData }) {
  const { topPositions } = data
  const maxTopApps = topPositions.length > 0 ? topPositions[0].apps : 1
  const top7 = topPositions.slice(0, 7)
  const bottom7 = topPositions.slice(7, 14)

  return (
    <div className="tab-content">
      <SectionLabel>Top Positions by Pipeline Volume</SectionLabel>
      <Panel>
        <PanelTitle title="Position-wise Applicant Flow &amp; Success Rate" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem' }}>
          {[top7, bottom7].map((group, gi) => (
            <div key={gi}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ flex: 1 }}>POSITION</span>
                <span style={{ width: 60, textAlign: 'right' }}>APPS</span>
                <span style={{ width: 60 }}></span>
                <span style={{ width: 40, textAlign: 'center' }}>JOINED</span>
              </div>
              {group.map(p => (
                <div key={p.position} className="data-row" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.45rem 0', borderBottom: '1px solid var(--border)', borderRadius: 4 }}>
                  <div style={{ flex: 1, fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 500 }}>{p.position}</div>
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

// ═══════════════════════════════════════════════════════════════
//  TAB 5: GLOSSARY — KPI Definitions
// ═══════════════════════════════════════════════════════════════

function GlossaryTab() {
  const glossaryItems = [
    { name: 'Total Applicants', def: 'The total count of all candidate applications received across all business units.', calc: 'Count of all valid rows in the Applicants sheet.' },
    { name: 'Hiring Rate', def: 'The percentage of total applicants who successfully joined the company.', calc: '(Joined ÷ Total Applicants) × 100' },
    { name: 'Offers Extended', def: 'The total number of candidates who reached the offer stage, including those who joined, dropped the offer, or are pending.', calc: 'Count of candidates with statuses indicating an offer.' },
    { name: 'Offer Acceptance Rate', def: 'The percentage of candidates who accepted their offers and joined.', calc: '(Joined ÷ Offers Extended) × 100' },
    { name: 'Offer Drop Rate', def: 'The percentage of candidates who rejected their offer after it was extended.', calc: '(Offer Drops ÷ Offers Extended) × 100' },
    { name: 'Candidate Drops', def: 'Candidates who withdrew from the recruitment process before reaching the offer stage.', calc: 'Count of candidates with "drop" statuses (mid-pipeline attrition).' },
    { name: 'Screen Rejects', def: 'Candidates who were rejected at the initial screening stage before any interview.', calc: 'Count of candidates with screen reject statuses.' },
    { name: 'Total Vacancies', def: 'The total number of open positions logged in the Vacancies sheet.', calc: 'Count of rows in the Vacancies sheet.' },
    { name: 'Fill Rate', def: 'The percentage of vacancies that have been successfully filled.', calc: '(Filled Vacancies ÷ Total Vacancies) × 100' },
    { name: 'Avg Time to Fill', def: 'The average number of days it takes to close a position after the application is received.', calc: 'Average of (Joining Date - Application Date) for all joined candidates in days.' },
  ]

  return (
    <div className="tab-content">
      <SectionLabel>Metric Definitions &amp; Derivations</SectionLabel>
      <Panel>
        <PanelTitle title="Dashboard Glossary" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
          {glossaryItems.map(item => (
            <div key={item.name} className="kpi-card-hover" style={{ background: 'white', padding: '1rem 1.2rem', borderRadius: 8, border: '1px solid var(--border)', borderLeft: '4px solid var(--navy-700)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--navy-900)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.6rem', lineHeight: 1.45 }}>{item.def}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--teal-600)', fontWeight: 500, padding: '0.3rem 0.5rem', background: '#F2F9F8', borderRadius: 4, display: 'inline-block' }}>
                <span style={{ color: 'var(--teal-800)', opacity: 0.7, marginRight: '4px' }}>ƒx</span>{item.calc}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  MAIN DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════════════════

function Dashboard() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(AUTH_KEY) === '1')
  const [showConfig, setShowConfig] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUrls, setLastUrls] = useState<{ a: string; v: string } | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [activeTab, setActiveTab] = useState<TabId>('overview')

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

  const handleSignOut = () => {
    sessionStorage.removeItem(AUTH_KEY)
    setAuthed(false)
    setData(null)
    setShowConfig(true)
    setLastUrls(null)
    setLastUpdated('')
    setError(null)
  }

  if (!authed) {
    return <LoginScreen onAuth={() => setAuthed(true)} />
  }

  const renderActiveTab = () => {
    if (!data) return null
    switch (activeTab) {
      case 'overview': return <OverviewTab data={data} />
      case 'performance': return <PerformanceTab data={data} />
      case 'analytics': return <AnalyticsTab data={data} />
      case 'positions': return <PositionsTab data={data} />
      case 'glossary': return <GlossaryTab />
    }
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: 'var(--bg)', color: 'var(--text-primary)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {showConfig && <ConfigDialog onConfirm={handleConfirm} />}

      {/* ─── Header ─── */}
      <div style={{
        background: 'linear-gradient(135deg, var(--navy-900) 0%, var(--navy-800) 60%, var(--navy-700) 100%)',
        padding: '2rem 3rem 1.5rem', position: 'relative', overflow: 'hidden',
        borderBottom: '3px solid var(--gold)',
      }}>
        <div className="header-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '0.78rem', color: 'rgba(180,190,210,0.6)', marginBottom: '0.35rem', fontWeight: 400, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              FY 2025 — 2026 · Talent Acquisition Intelligence
            </p>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.9rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
              Recruitment Strategic Dashboard
            </h1>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
            <div style={{
              background: 'var(--gold)', color: 'var(--navy-900)', padding: '0.45rem 1.25rem', borderRadius: 6,
              fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>
              Boardroom Ready · Q1–Q4
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              {lastUpdated && (
                <span style={{ fontSize: '0.72rem', color: 'rgba(180,190,210,0.5)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal-400)', animation: 'pulse 2s ease infinite' }} />
                  Live · {lastUpdated}
                </span>
              )}
              {!showConfig && (
                <button onClick={() => setShowConfig(true)} style={{ fontSize: '0.72rem', color: 'var(--gold)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: "'Inter', sans-serif" }}>Change source</button>
              )}
              {lastUrls && !loading && (
                <button onClick={() => fetchData(lastUrls.a, lastUrls.v)} style={{ fontSize: '0.72rem', color: 'var(--gold)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: "'Inter', sans-serif" }}>↻ Refresh</button>
              )}
              <button
                onClick={handleSignOut}
                style={{
                  fontSize: '0.72rem', color: 'rgba(180,190,210,0.5)',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6, cursor: 'pointer', padding: '4px 12px',
                  fontFamily: "'Inter', sans-serif", transition: 'all 0.2s',
                }}
                onMouseEnter={e => { const b = e.target as HTMLButtonElement; b.style.color = '#E8998F'; b.style.borderColor = 'rgba(160,42,30,0.4)' }}
                onMouseLeave={e => { const b = e.target as HTMLButtonElement; b.style.color = 'rgba(180,190,210,0.5)'; b.style.borderColor = 'rgba(255,255,255,0.1)' }}
              >Sign out</button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        {data && !loading && (
          <div style={{ position: 'relative', marginTop: '1.25rem' }}>
            <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 4 }}>
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: 1, padding: '0.6rem 1rem', borderRadius: 10, border: 'none',
                    background: activeTab === tab.id ? 'rgba(255,255,255,0.12)' : 'transparent',
                    fontFamily: "'Inter', sans-serif", fontSize: '0.8rem',
                    fontWeight: activeTab === tab.id ? 600 : 400,
                    color: activeTab === tab.id ? 'white' : 'rgba(180,190,210,0.5)',
                    cursor: 'pointer', transition: 'all 0.25s ease',
                    letterSpacing: '0.01em',
                  }}
                  onMouseEnter={e => { if (activeTab !== tab.id) (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.7)' }}
                  onMouseLeave={e => { if (activeTab !== tab.id) (e.target as HTMLElement).style.color = 'rgba(180,190,210,0.5)' }}
                >{tab.label}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Main Content ─── */}
      <div style={{ flex: 1, padding: '2rem 3rem', maxWidth: 1600 }}>
        {loading && <LoadingSpinner />}
        {error && (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <div style={{ color: 'var(--brick-500)', fontWeight: 600, marginBottom: '0.5rem' }}>Failed to load data</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{error}</div>
            <button onClick={() => lastUrls && fetchData(lastUrls.a, lastUrls.v)} style={{ padding: '0.5rem 1.25rem', background: 'var(--navy-800)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontFamily: "'Inter', sans-serif" }}>
              Retry
            </button>
          </div>
        )}
        {!loading && !error && data && renderActiveTab()}
      </div>

      {/* ─── Footer ─── */}
      <div style={{
        background: 'linear-gradient(135deg, var(--navy-900) 0%, var(--navy-800) 100%)',
        padding: '1.25rem 3rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <p style={{ fontSize: '0.72rem', color: 'rgba(180,190,210,0.4)', letterSpacing: '0.05em' }}>
          Confidential · FY 2025–2026 Talent Acquisition Intelligence · Internal Distribution Only
        </p>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '0.9rem', color: 'var(--gold)', letterSpacing: '0.05em' }}>TA Analytics</div>
      </div>
    </div>
  )
}
