import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ScatterController,
  Filler
} from 'chart.js'
import { Bar, Line, Scatter } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, ScatterController, Filler)

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
      reqDate: string | null
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

import { DEFAULT_APPLICANTS_CSV_URL, DEFAULT_VACANCIES_CSV_URL, FY2627_APPLICANTS_CSV_URL, FY2627_VACANCIES_CSV_URL } from '@/config'

const DEFAULT_APPLICANTS = DEFAULT_APPLICANTS_CSV_URL
const DEFAULT_VACANCIES = DEFAULT_VACANCIES_CSV_URL

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

function PanelTitle({ title, badge, tooltip, wideTooltip }: { title: string; badge?: string; tooltip?: string; wideTooltip?: boolean }) {
  return (
    <div style={{
      fontFamily: "'Playfair Display', serif", fontSize: '1rem', fontWeight: 600,
      color: 'var(--text-primary)', marginBottom: '1.25rem', paddingBottom: '0.75rem',
      borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {title}
        {tooltip && <InfoTooltip text={tooltip} wide={wideTooltip} />}
      </span>
      {badge && (
        <span style={{
          fontSize: '0.68rem', fontWeight: 500, color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif",
          background: 'var(--warm-50)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)'
        }}>{badge}</span>
      )}
    </div>
  )
}

// ─── InfoTooltip ─────────────────────────────────────────────

function InfoTooltip({ text, wide }: { text: string; wide?: boolean }) {
  return (
    <span className="info-tooltip-wrap" style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}>
      <span className="info-tooltip-icon">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="rgba(148,74,0,0.08)"/>
          <line x1="8" y1="7" x2="8" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="8" cy="5" r="0.8" fill="currentColor"/>
        </svg>
      </span>
      <span className="info-tooltip-box" style={wide ? { width: 300 } : {}}>{text}</span>
    </span>
  )
}

// ─── Date helper ─────────────────────────────────────────────

function addDaysToDate(isoBase: string | null, days: number | null): string | null {
  if (!isoBase || days === null) return null
  const d = new Date(isoBase)
  if (isNaN(d.getTime())) return null
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
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
    <div className="dashboard-login-container" style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'var(--background)'
    }}>
      {/* Left Marketing Panel - Hero Image */}
      <div className="hero-bg dashboard-login-hero" style={{
        position: 'relative',
        flexDirection: 'column',
        justifyContent: 'flex-end', padding: '4rem',
        borderRight: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(7,20,37,0.3) 0%, rgba(7,20,37,0.9) 100%)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 64, height: 64, borderRadius: 16,
            background: 'linear-gradient(135deg, var(--primary) 0%, #B88A2E 100%)',
            boxShadow: '0 12px 32px rgba(212,168,67,0.35), inset 0 2px 4px rgba(255,255,255,0.3)',
            marginBottom: '1.5rem', position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.4) 0%, transparent 60%)' }} />
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative', zIndex: 1, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}>
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          </div>
          <h1 style={{ fontFamily: "'Inter', sans-serif", fontSize: '3rem', fontWeight: 700, color: '#FFFFFF', lineHeight: 1.1, marginBottom: '1rem', letterSpacing: '-0.02em' }}>
            Talent Analytics - Recruitment
          </h1>
          <p style={{ fontSize: '1.2rem', color: 'rgba(255, 255, 255, 0.85)', maxWidth: 500, lineHeight: 1.5 }}>
            Executive-grade talent acquisition analytics. Monitor pipeline health, track conversions, and identify bottlenecks in real time.
          </p>
        </div>
      </div>

      {/* Right Login Panel */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--surface-container-lowest)', position: 'relative'
      }}>
        {/* Subtle radial glow */}
        <div style={{
          position: 'absolute', top: '10%', right: '10%',
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(212,168,67,0.05) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', width: '100%', maxWidth: 420, animation: shake ? 'shake 0.5s ease' : undefined, padding: '0 2rem' }}>
          <div style={{ animation: 'fadeInUp 0.6s cubic-bezier(0.22,1,0.36,1) both' }}>
            <div style={{ marginBottom: '2.5rem' }}>
              <div style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: '1.75rem', fontWeight: 600, color: 'var(--on-surface)',
                letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: '0.5rem',
              }}>Welcome back</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Please enter your credentials to access the dashboard.
              </div>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Username</label>
                <input
                  ref={userRef}
                  className="login-input"
                  type="text"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError('') }}
                  placeholder="Enter your username"
                  autoComplete="username"
                  style={{
                    width: '100%', padding: '0.85rem 1rem',
                    background: 'var(--surface-container)',
                    border: '1px solid var(--outline-variant)',
                    borderRadius: 8, fontSize: '0.9rem', color: 'var(--on-surface)',
                    fontFamily: "'Inter', sans-serif",
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="login-input"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError('') }}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    style={{
                      width: '100%', padding: '0.85rem 2.75rem 0.85rem 1rem',
                      background: 'var(--surface-container)',
                      border: '1px solid var(--outline-variant)',
                      borderRadius: 8, fontSize: '0.9rem', color: 'var(--on-surface)',
                      fontFamily: "'Inter', sans-serif",
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(p => !p)}
                    style={{
                      position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', fontSize: '0.8rem', padding: 0,
                      transition: 'color 0.2s', fontFamily: "'Inter', sans-serif",
                    }}
                    onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--primary)' }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text-muted)' }}
                  >{showPass ? 'Hide' : 'Show'}</button>
                </div>
              </div>
              {error && (
                <div style={{
                  marginBottom: '1.5rem', padding: '0.8rem 1rem',
                  background: 'var(--error-container)', border: '1px solid var(--error)',
                  borderRadius: 8, fontSize: '0.85rem', color: 'var(--on-error-container)',
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                }}>⚠ {error}</div>
              )}
              <button
                type="submit"
                disabled={checking}
                style={{
                  width: '100%', padding: '1rem',
                  background: 'var(--primary)',
                  border: 'none', borderRadius: 8,
                  fontSize: '0.9rem', fontWeight: 700,
                  color: 'var(--on-primary)', cursor: checking ? 'wait' : 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  transition: 'background 0.2s, transform 0.15s, box-shadow 0.2s',
                  boxShadow: '0 4px 14px rgba(212,168,67,0.15)',
                  opacity: checking ? 0.8 : 1,
                }}
                onMouseEnter={e => { if (!checking) { const b = e.target as HTMLButtonElement; b.style.background = 'var(--primary-fixed)'; b.style.transform = 'translateY(-1px)'; b.style.boxShadow = '0 6px 20px rgba(212,168,67,0.25)' } }}
                onMouseLeave={e => { const b = e.target as HTMLButtonElement; b.style.background = 'var(--primary)'; b.style.transform = 'translateY(0)'; b.style.boxShadow = '0 4px 14px rgba(212,168,67,0.15)' }}
              >{checking ? 'Verifying…' : 'Access Dashboard →'}</button>
            </form>
            <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.75rem', color: 'var(--outline)', letterSpacing: '0.02em' }}>
              Confidential · Authorized Personnel Only
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Config Dialog ───────────────────────────────────────────

type FYMode = 'fy2526' | 'fy2627' | 'custom'

function ConfigDialog({ onConfirm }: { onConfirm: (a: string, v: string) => void }) {
  const [mode, setMode] = useState<FYMode>('fy2526')
  const [applicants, setApplicants] = useState('')
  const [vacancies, setVacancies] = useState('')

  const getFinalUrls = () => {
    if (mode === 'fy2526') return { a: DEFAULT_APPLICANTS, v: DEFAULT_VACANCIES }
    if (mode === 'fy2627') return { a: FY2627_APPLICANTS_CSV_URL, v: FY2627_VACANCIES_CSV_URL }
    return { a: applicants, v: vacancies }
  }

  const RadioOpt = ({ value, label, sub }: { value: FYMode; label: string; sub: string }) => (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: '0.65rem', marginBottom: '0.75rem',
      cursor: 'pointer', padding: '0.75rem 1rem',
      borderRadius: 10, border: `1.5px solid ${mode === value ? 'var(--gold)' : 'var(--border)'}`,
      background: mode === value ? 'var(--gold-light)' : 'var(--warm-50)',
      transition: 'all 0.15s ease',
    }}>
      <input type="radio" name="fy" value={value} checked={mode === value} onChange={() => setMode(value)}
        style={{ marginTop: 2, accentColor: 'var(--gold)', flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{sub}</div>
      </div>
    </label>
  )

  const { a: finalA, v: finalV } = getFinalUrls()

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(7,14,26,0.6)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'var(--surface-container-lowest)', borderRadius: 20, padding: '2.5rem', maxWidth: 560, width: '100%',
        border: '1px solid var(--border)', boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
          Recruitment Dashboard
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.75rem', lineHeight: 1.6 }}>
          Select a data source to power this dashboard. Sheets must be published as CSV.
        </div>

        <RadioOpt value="fy2526" label="FY 2025–26" sub="Pre-configured data source" />
        <RadioOpt value="fy2627" label="FY 2026–27" sub="Current year data source" />
        <RadioOpt value="custom" label="Custom URLs" sub="Provide your own Google Sheets CSV links" />

        {mode === 'custom' && (
          <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>Applicants CSV URL</div>
              <input value={applicants} onChange={e => setApplicants(e.target.value)} placeholder="https://docs.google.com/spreadsheets/..."
                style={{ width: '100%', padding: '0.6rem 0.85rem', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--text-primary)', outline: 'none', fontFamily: "'Inter', sans-serif", background: 'var(--warm-50)', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>Vacancies CSV URL</div>
              <input value={vacancies} onChange={e => setVacancies(e.target.value)} placeholder="https://docs.google.com/spreadsheets/..."
                style={{ width: '100%', padding: '0.6rem 0.85rem', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--text-primary)', outline: 'none', fontFamily: "'Inter', sans-serif", background: 'var(--warm-50)', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button
            onClick={() => onConfirm(DEFAULT_APPLICANTS, DEFAULT_VACANCIES)}
            style={{ padding: '0.6rem 1.2rem', background: 'var(--warm-50)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.82rem', cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif" }}
          >Skip</button>
          <button
            onClick={() => onConfirm(finalA, finalV)}
            disabled={mode === 'custom' && (!applicants.trim() || !vacancies.trim())}
            style={{ padding: '0.6rem 1.5rem', background: 'var(--navy-800)', border: 'none', borderRadius: 8, fontSize: '0.82rem', cursor: 'pointer', color: 'white', fontFamily: "'Inter', sans-serif", fontWeight: 600, opacity: mode === 'custom' && (!applicants.trim() || !vacancies.trim()) ? 0.5 : 1 }}
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
  const { kpis, funnel, sourceEfficiency, leakage } = data
  const maxSourceTotal = Math.max(...sourceEfficiency.map(s => s.total), 1)

  return (
    <div className="tab-content">
      {/* KPI Strip */}
      <SectionLabel>Executive KPIs</SectionLabel>
      <div className="dashboard-kpi-grid" style={{ marginBottom: '2.5rem' }}>
        {/* Total Applicants — hero card */}
        <div className="kpi-card-hover" style={{
          background: 'linear-gradient(135deg, #041627 0%, #1a2b3c 100%)',
          borderRadius: 16, padding: '1.5rem', position: 'relative', overflow: 'hidden',
          gridColumn: 'span 1',
          boxShadow: '0 8px 28px rgba(4,22,39,0.2)',
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
      <div className="dashboard-grid-2">
        <Panel>
          <PanelTitle 
            title="Recruitment Funnel — Pipeline Conversion" 
            badge={`${num(funnel.applied)} total applicants`} 
            wideTooltip
            tooltip={`Applied: All rows in the Applicants sheet.

Screen Shortlisted: Reached at least the screening stage.

Reached Interview: Reached any interview stage (R1, Tech, etc).
*Note: 'Interview No Shows' are explicitly excluded here.

Extended Offers: Reached the offer stage.

Joined: Accepted offer and joined.

*Evaluated primarily using the 'Highest Stage Reached' column.`} 
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <FunnelBar label="Applied" count={funnel.applied} total={funnel.applied} color="var(--navy-500)" />
            <DropArrow label={`Screen Shortlist Rate: ${pct(funnel.shortlisted / Math.max(funnel.applied,1) * 100)}`} />
            <FunnelBar label="Screen Shortlisted" count={funnel.shortlisted} total={funnel.applied} color="var(--amber-400)" />
            <DropArrow label={`Interview Reach Rate: ${pct(funnel.interviewed / Math.max(funnel.shortlisted,1) * 100)}`} />
            <FunnelBar label="Reached Interview" count={funnel.interviewed} total={funnel.applied} color="var(--amber-500)" />
            <DropArrow label={`Offer Conversion: ${pct(funnel.offered / Math.max(funnel.interviewed,1) * 100)}`} />
            <FunnelBar label="Extended Offers" count={funnel.offered} total={funnel.applied} color="var(--brick-400)" />
            <DropArrow label={`Offer Acceptance: ${pct(funnel.joined / Math.max(funnel.offered,1) * 100)}`} />
            <FunnelBar label="Joined" count={funnel.joined} total={funnel.applied} color="var(--teal-400)" />
          </div>
          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border)', fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', gap: '1.5rem' }}>
            <span>↩ Screen/Interview Drops: <strong style={{ color: 'var(--brick-500)' }}>{num(funnel.shortlisted - funnel.interviewed - leakage.noShows)}</strong></span>
            <span>🚫 Interview No Shows: <strong style={{ color: 'var(--brick-500)' }}>{num(leakage.noShows)}</strong></span>
          </div>
        </Panel>

        <Panel>
          <PanelTitle title="Source Channel Efficiency" badge="by joining rate" wideTooltip tooltip={`Source: Pulled from the 'Source' column in the Applicants sheet.

Joining Rate: (Joined ÷ Total applicants from that source) × 100.

Use this to identify which channels yield the best quality hires, not just volume.

*Higher rate = more efficient channel for your hiring pipeline.`} />
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
    <div className="kpi-card-hover glass-panel" style={{
      borderRadius: 16, padding: '1.4rem 1.25rem', position: 'relative',
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
  const { kpis, buPerformance, leakage, funnel } = data
  const maxBUTotal = Math.max(...buPerformance.map(b => b.total), 1)

  return (
    <div className="tab-content">
      <SectionLabel>Business Unit Performance &amp; Pipeline Health</SectionLabel>
      <div className="dashboard-grid-3">
        <Panel>
          <PanelTitle title="Business Unit Performance" badge="applicants → joined" wideTooltip tooltip={`Business Unit: Pulled from the BU/Company column in the Applicants sheet.

Total: Total applicants tagged to this BU.

Joined: Total candidates who accepted and joined this BU.

Rate: (Joined ÷ Total applicants) × 100.

Time: Average Time to Fill for this BU (if available).

*Use this to spot which business units are scaling efficiently vs struggling.`} />
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
          <PanelTitle title="Pipeline Leakage Points" wideTooltip tooltip={`Candidate Drops: Candidates who dropped out after being shortlisted, but before the interview stage.

R1/R2 Rejects: Rejected after the first or second interview round.

No-Shows: Scheduled for an interview but did not attend.

Offer Drops: Received an offer but did not join.

*Use this to identify exactly where candidates are exiting your pipeline.`} />
          <div className="dashboard-grid-2-small">
            <LeakCard type="drop" num={leakage.candidateDrops} label="Candidate Drops" sub={kpis.totalApplicants > 0 ? pct(leakage.candidateDrops / kpis.totalApplicants * 100) + ' of pipeline' : ''} />
            <LeakCard type="reject" num={leakage.r1Rejects} label="R1 Rejects" sub="Post-interview rejection" />
            <LeakCard type="noshow" num={leakage.noShows} label="No-Shows" sub={kpis.totalApplicants > 0 ? pct(leakage.noShows / kpis.totalApplicants * 100) + ' attrition' : ''} />
            <LeakCard type="reject" num={leakage.r2Rejects} label="R2 Rejects" sub="Second-stage drop" />
            <LeakCard type="offerdrop" num={leakage.offerDrops} label="Offer Drops" sub={kpis.offersExtended > 0 ? pct(leakage.offerDrops / kpis.offersExtended * 100) + ' of all offers' : ''} />
            <LeakCard type="success" num={kpis.joined} label="Successful Joins" sub={kpis.totalApplicants > 0 ? pct(kpis.hiringRate) + ' overall rate' : ''} />
          </div>
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#FBF0EE', borderRadius: 10, borderLeft: '3px solid var(--brick-400)' }}>
            <div style={{ fontSize: '0.72rem', color: '#731B12', lineHeight: 1.5, fontWeight: 500 }}>
              ⚠ {num(kpis.totalApplicants - funnel.shortlisted)} candidates ({pct((kpis.totalApplicants - funnel.shortlisted) / Math.max(kpis.totalApplicants, 1) * 100)}) were lost before reaching the shortlisting/interview stage.
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelTitle title="Vacancy Tracker" />
          <div className="dashboard-grid-2-sm">
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
//  TAB 3: ANALYTICS
// ═══════════════════════════════════════════════════════════════

function AnalyticsTab({ data }: { data: DashboardData }) {
  const { kpis, quarterlyTrend, recruiterPerformance } = data

  // Bar chart (compact, avoids tall line chart)
  const chartData = {
    labels: quarterlyTrend.map(q => q.quarter),
    datasets: [
      {
        label: 'Applicants',
        data: quarterlyTrend.map(q => q.applicants),
        backgroundColor: 'rgba(180,83,9,0.18)',
        borderColor: 'rgba(180,83,9,0.75)',
        borderWidth: 1.5,
        borderRadius: 4,
      },
      {
        label: 'Joined',
        data: quarterlyTrend.map(q => q.joined),
        backgroundColor: 'rgba(16,185,129,0.2)',
        borderColor: 'rgba(16,185,129,0.75)',
        borderWidth: 1.5,
        borderRadius: 4,
      },
    ],
  }
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#041627',
        titleColor: 'rgba(210,228,251,0.75)',
        bodyColor: '#FFFFFF',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        callbacks: { label: (ctx: { dataset: { label: string }; parsed: { y: number } }) => ` ${ctx.dataset.label}: ${ctx.parsed.y}` },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#74777d', font: { size: 11, family: 'Inter' } as const } },
      y: { grid: { color: 'rgba(26,43,60,0.06)', lineWidth: 0.5 }, ticks: { color: '#74777d', font: { size: 10, family: 'Inter' } as const }, border: { display: false } },
    },
  }

  const maxApps = Math.max(...recruiterPerformance.map(r => r.applications), 1)

  return (
    <div className="tab-content">

      {/* 2 — Gantt Timeline Plot */}
      <div style={{ marginBottom: '1.5rem' }}>
        <PositionTimelinePlot data={data} />
      </div>

      {/* Grid container for 3 and 4 */}
      <div className="dashboard-analytics-grid" style={{ marginBottom: '1.5rem', alignItems: 'stretch' }}>
        
        {/* 3 — Quarterly Trend */}
        <Panel style={{ height: '100%' }}>
          <PanelTitle
            title="Quarterly Applicant vs. Joining Trend"
            tooltip="Quarterly breakdown of pipeline volume (applicants) vs. successful joins. Indian FY: Q1=Apr–Jun, Q2=Jul–Sep, Q3=Oct–Dec, Q4=Jan–Mar."
          />
          {/* Bar chart */}
          <div style={{ position: 'relative', height: 150 }}>
            <Bar data={chartData} options={chartOptions} />
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: '1rem', margin: '0.6rem 0', justifyContent: 'flex-end' }}>
            {[{ color: 'rgba(180,83,9,0.65)', label: 'Applicants' }, { color: 'rgba(16,185,129,0.65)', label: 'Joined' }].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color, display: 'inline-block' }} />
                {l.label}
              </div>
            ))}
          </div>
          {/* Q strip — full width below chart */}
          <div style={{ display: 'flex', borderTop: '1px solid var(--border)', paddingTop: '0.65rem' }}>
            {quarterlyTrend.map((q, i) => {
              const convRate = q.applicants > 0 ? ((q.joined / q.applicants) * 100).toFixed(1) : '0.0'
              const isLast = i === quarterlyTrend.length - 1
              const convColor = parseFloat(convRate) >= 10 ? 'var(--teal-600)' : parseFloat(convRate) >= 5 ? 'var(--amber-600)' : 'var(--brick-400)'
              return (
                <div key={q.quarter} style={{ flex: 1, padding: '0 0.5rem', borderRight: !isLast ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>{q.quarter}</div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{num(q.applicants)}</div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--teal-600)', fontWeight: 600, marginTop: 2 }}>{num(q.joined)} joined</div>
                  <div style={{ fontSize: '0.58rem', color: convColor, fontWeight: 600, marginTop: 1 }}>{convRate}% conv.</div>
                </div>
              )
            })}
          </div>
        </Panel>

        {/* 4 — Recruiter Performance (compact table) */}
        <Panel style={{ height: '100%' }}>
          <PanelTitle
            title="Recruiter Performance Matrix"
            tooltip="Conversion Rate = Joined ÷ Applications handled. Offer Drop Rate = Offer drops ÷ Total offers extended by that recruiter."
          />
          {recruiterPerformance.length === 0 && (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>No recruiter data detected</div>
          )}
          {recruiterPerformance.length > 0 && (
            <>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 52px 44px 44px 80px 52px', gap: '0.25rem', padding: '0.3rem 0.4rem', marginBottom: '0.2rem', borderBottom: '1px solid var(--border)' }}>
                {['Recruiter', 'Apps', 'Offers', 'Joined', 'Conv. Rate', 'Drop%'].map((h, i) => (
                  <div key={h} style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: i > 0 ? 'center' : 'left' }}>
                    {h === 'Conv. Rate' ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>{h} <InfoTooltip text="(Joined ÷ Applications) × 100" /></span>
                     : h === 'Drop%' ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>{h} <InfoTooltip text="Offer Drop Rate: (Offer drops ÷ Offers extended) × 100" /></span>
                     : h}
                  </div>
                ))}
              </div>
              {recruiterPerformance.map((r, i) => (
                <div key={r.recruiter} className="data-row" style={{ display: 'grid', gridTemplateColumns: '1fr 52px 44px 44px 80px 52px', gap: '0.25rem', padding: '0.35rem 0.4rem', borderBottom: '1px solid var(--border)', alignItems: 'center', borderRadius: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                    <span style={{
                      fontSize: '0.55rem', padding: '1px 5px', borderRadius: 8, fontWeight: 600, flexShrink: 0,
                      ...(i === 0 ? { background: '#EDFBF5', color: 'var(--teal-600)' } : r.convRate >= 5 ? { background: '#FFF8EE', color: 'var(--amber-600)' } : { background: '#FBF0EE', color: 'var(--brick-400)' })
                    }}>{i === 0 ? '★ Lead' : r.convRate >= 5 ? 'Mid' : 'Low'}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.recruiter}</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textAlign: 'center' }}>{num(r.applications)}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textAlign: 'center' }}>{num(r.offers)}</div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--teal-600)', textAlign: 'center' }}>{num(r.joined)}</div>
                  {/* Mini bar for conv rate */}
                  <div style={{ position: 'relative', height: 18, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ flex: 1, height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min((r.applications / maxApps) * 100, 100)}%`, background: rateColor(r.convRate), borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: rateColor(r.convRate), flexShrink: 0, width: 32, textAlign: 'right' }}>{pct(r.convRate)}</span>
                  </div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 500, color: r.offerDropRate < 20 ? 'var(--teal-600)' : r.offerDropRate < 35 ? 'var(--amber-600)' : 'var(--brick-400)', textAlign: 'center' }}>{pct(r.offerDropRate)}</div>
                </div>
              ))}
              {/* Insight note */}
              {recruiterPerformance.length >= 2 && (
                <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.85rem', background: 'var(--gold-light)', borderRadius: 8, borderLeft: '3px solid var(--gold)', fontSize: '0.7rem', color: 'var(--amber-800)', lineHeight: 1.5 }}>
                  ⚡ {recruiterPerformance[0].recruiter} leads with {pct(recruiterPerformance[0].convRate)} conversion. Pipeline volume skewed toward {recruiterPerformance.sort((a, b) => b.applications - a.applications)[0].recruiter} ({pct(recruiterPerformance.sort((a, b) => b.applications - a.applications)[0].applications / Math.max(kpis.totalApplicants, 1) * 100)} of all applications).
                </div>
              )}
            </>
          )}
        </Panel>
      </div>

      {/* 5 — Rejection & Offer Drop Reasons (conditional, compact, bottom) */}
      {(data.topRejectionReasons.length > 0 || data.topOfferDropReasons.length > 0) && (
        <div style={{ marginBottom: '1.5rem' }}>
          <SectionLabel>Pipeline Drop Analysis</SectionLabel>
          <div className="dashboard-drop-grid" style={{ alignItems: 'stretch' }}>
            {data.topRejectionReasons.length > 0 && (
              <Panel style={{ height: '100%' }}>
                <PanelTitle
                  title="Top Rejection Reasons"
                  tooltip="Reasons captured from the 'Reason' column for candidates who were rejected at screen, R1, R2, or dropped mid-pipeline."
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {data.topRejectionReasons.slice(0, 6).map((r, i) => {
                    const maxCount = data.topRejectionReasons[0].count
                    return (
                      <div key={r.reason} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: 16, fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, flexShrink: 0, textAlign: 'right' }}>{i + 1}</div>
                        <div style={{ flex: 1, fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }} title={r.reason}>{r.reason}</div>
                        <div style={{ width: 60, height: 5, background: '#F1F5F9', borderRadius: 3, flexShrink: 0 }}>
                          <div style={{ height: '100%', width: `${(r.count / maxCount) * 100}%`, background: 'var(--brick-400)', borderRadius: 3 }} />
                        </div>
                        <div style={{ width: 22, fontSize: '0.68rem', fontWeight: 600, color: 'var(--brick-500)', textAlign: 'right', flexShrink: 0 }}>{r.count}</div>
                      </div>
                    )
                  })}
            </div>
          </Panel>
        )}
        {data.topOfferDropReasons.length > 0 && (
          <Panel style={{ height: '100%' }}>
            <PanelTitle
              title="Top Offer Decline Reasons"
              tooltip="Reasons captured from the 'Reason' column for candidates who dropped after an offer was extended to them."
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {data.topOfferDropReasons.slice(0, 6).map((r, i) => {
                    const maxCount = data.topOfferDropReasons[0].count
                    return (
                      <div key={r.reason} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: 16, fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, flexShrink: 0, textAlign: 'right' }}>{i + 1}</div>
                        <div style={{ flex: 1, fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }} title={r.reason}>{r.reason}</div>
                        <div style={{ width: 60, height: 5, background: '#F1F5F9', borderRadius: 3, flexShrink: 0 }}>
                          <div style={{ height: '100%', width: `${(r.count / maxCount) * 100}%`, background: 'var(--amber-500)', borderRadius: 3 }} />
                        </div>
                        <div style={{ width: 22, fontSize: '0.68rem', fontWeight: 600, color: 'var(--amber-600)', textAlign: 'right', flexShrink: 0 }}>{r.count}</div>
                      </div>
                    )
                  })}
                </div>
              </Panel>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Position Timeline Gantt ─────────────────────────────────

function PositionTimelinePlot({ data }: { data: DashboardData }) {
  const [selectedBU, setSelectedBU] = useState<string>('AL Circle')
  const [searchQuery, setSearchQuery] = useState('')

  const timelineData = data.hiringTimelineByBU || []
  const allBUs = timelineData.map(b => b.bu)

  const baseData = timelineData.find(b => b.bu === selectedBU)?.positions.map(p => ({ bu: selectedBU, ...p })) || []
  
  const filteredData = baseData.filter(p => p.position.toLowerCase().includes(searchQuery.toLowerCase()))

  // Max/Min days across all stage points for X axis scale
  let maxDays = 10
  let minDays = 0
  filteredData.forEach(p => {
    Object.values(p.avgStages || {}).forEach(val => {
      if (val !== null && val > maxDays) maxDays = val
      if (val !== null && val < minDays) minDays = val
    })
  })
  
  const range = maxDays - minDays || 1;

  const STAGES = [
    { key: 'jdReceived', label: 'JD Received', shortLabel: 'JD', color: '#6366F1', tooltipDef: 'When the Job Description was received (days from Req Date)' },
    { key: 'reqStart', label: 'Req Start', shortLabel: 'Req↑', color: '#94A3B8', tooltipDef: 'When recruiter started working on the position (days from Job Requisition Date)' },
    { key: 'appStart', label: 'App Start', shortLabel: 'Apps', color: '#FBBF24', tooltipDef: 'When recruiter first shared profiles to hiring manager (days from Req Date)' },
    { key: 'screen', label: 'Screening', shortLabel: 'Scrn', color: '#F59E0B', tooltipDef: 'Average screening/shortlist feedback date (days from Req Date)' },
    { key: 'r1', label: 'Round 1', shortLabel: 'R1', color: '#F97316', tooltipDef: 'Average Round 1 interview date (days from Req Date)' },
    { key: 'r2', label: 'Round 2', shortLabel: 'R2', color: '#EA580C', tooltipDef: 'Average Round 2 interview date (days from Req Date)' },
    { key: 'r3', label: 'Round 3', shortLabel: 'R3', color: '#DC2626', tooltipDef: 'Average Round 3 interview date (days from Req Date)' },
    // { key: 'task', label: 'Task Round', shortLabel: 'Task', color: '#7C3AED', tooltipDef: 'Average task/assignment round date (days from Req Date)' }, // on request from user
    { key: 'offer', label: 'Offer', shortLabel: 'Offer', color: '#10B981', tooltipDef: 'Average offer date (days from Req Date). Green = best outcome milestone.' },
  ] as const

  return (
    <Panel>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Open Positions Timeline</span>
          <InfoTooltip
            text="Each row = one position. Milestones show average days from Job Requisition Date (Day 0) to each hiring stage. Hover a dot to see stage name, days, and estimated actual date."
            wide
          />
          <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--text-muted)', background: 'var(--warm-50)', padding: '2px 10px', borderRadius: 20, border: '1px solid var(--border)' }}>
            Avg days from Req Date
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search position..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ padding: '0.35rem 0.75rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.78rem', outline: 'none', background: 'var(--warm-50)', color: 'var(--text-primary)', width: 180 }}
          />
          <select
            value={selectedBU}
            onChange={e => setSelectedBU(e.target.value)}
            style={{ padding: '0.35rem 0.75rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.78rem', outline: 'none', background: 'var(--warm-50)', color: 'var(--text-primary)', cursor: 'pointer' }}
          >
            {allBUs.map(bu => <option key={bu} value={bu}>{bu}</option>)}
          </select>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
        {STAGES.map(s => (
          <div key={s.key} className="info-tooltip-wrap" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', color: 'var(--text-secondary)', cursor: 'help' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: s.color, display: 'inline-block', flexShrink: 0 }} />
            <span>{s.label}</span>
            <span className="info-tooltip-box" style={{ width: 200 }}>{s.tooltipDef}</span>
          </div>
        ))}
        {/* Job Req Date legend entry */}
        <div className="info-tooltip-wrap" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', color: 'var(--text-secondary)', cursor: 'help' }}>
          <span style={{ width: 9, height: 9, background: '#334155', display: 'inline-block', flexShrink: 0, borderRadius: 2, transform: 'rotate(45deg)' }} />
          <span>Job Req Date</span>
          <span className="info-tooltip-box" style={{ width: 200 }}>Day 0 — the date the recruiter received the job requisition. All other milestones are measured from this point.</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.65rem', color: 'var(--text-muted)' }}>
          <InfoTooltip text="Day 0 = Job Requisition Date — the date the recruiter received the job requirements from the hiring manager. All milestones are measured from this date." wide />
          <span>Day 0 = Req Date</span>
        </div>
      </div>

      {/* Axis header */}
      <div style={{ display: 'flex', marginBottom: '0.35rem', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
        <div style={{ width: 160, flexShrink: 0 }} />
        <div style={{ flex: 1, position: 'relative', height: 14 }}>
          {minDays < 0 ? (
            // When JD Received is before Req Date: show JD zone label + positive ticks only
            <>
              <div style={{ position: 'absolute', left: 0, fontSize: '0.6rem', color: '#6366F1', fontWeight: 600 }}>← JD</div>
              <div style={{ position: 'absolute', left: `${((0 - minDays) / range) * 100}%`, transform: 'translateX(-50%)', fontWeight: 700, color: 'var(--text-primary)' }}>Day 0</div>
              {[0.25, 0.5, 0.75, 1].map((frac, i) => {
                const val = minDays + range * frac;
                if (val <= 0) return null;
                return <div key={i} style={{ position: 'absolute', left: `${frac * 100}%`, transform: i === 3 ? 'translateX(-100%)' : 'translateX(-50%)' }}>{Math.round(val)}d</div>;
              })}
            </>
          ) : (
            [0, 0.25, 0.5, 0.75, 1].map((frac, i) => (
              <div key={i} style={{ position: 'absolute', left: `${frac * 100}%`, transform: i === 4 ? 'translateX(-100%)' : i > 0 ? 'translateX(-50%)' : undefined }}>
                {i === 0 ? 'Day 0' : `${Math.round(maxDays * frac)}d`}
              </div>
            ))
          )}
        </div>
        <div style={{ width: 46, flexShrink: 0 }} />
      </div>

      {/* Gantt rows */}
      <div style={{ paddingTop: '2.5rem', marginTop: '-2rem' }}>
        <div style={{ paddingTop: '0.5rem' }}>
          {filteredData.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No date data available for this business unit</div>
          )}
          {filteredData.map((pos, rowIdx) => {
            // Find first and last available milestone for the track bar
            const vals = STAGES.map(s => pos.avgStages?.[s.key as keyof typeof pos.avgStages] ?? null).filter((v): v is number => v !== null)
            const firstVal = vals.length > 0 ? Math.min(...vals) : null
            const lastVal = vals.length > 0 ? Math.max(...vals) : null

            return (
              <div key={rowIdx} className="gantt-row">
                {/* Position label */}
                <div style={{ width: 160, flexShrink: 0, paddingRight: '0.75rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={pos.position}>
                    {pos.position}
                  </div>
                  {selectedBU === 'All' && <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{pos.bu}</div>}
                </div>

                {/* Track */}
                <div className="gantt-track" style={{ position: 'relative' }}>
                  {/* Gray connector bar between first and last milestone */}
                  {firstVal !== null && lastVal !== null && (
                    <div className="gantt-connector" style={{
                      left: `${((firstVal - minDays) / range) * 100}%`,
                      width: `${((lastVal - firstVal) / range) * 100}%`,
                      background: 'rgba(15,23,42,0.08)',
                    }} />
                  )}

                  {/* Day 0 vertical rule — only shown when JD Received is before Req Date (negative days) */}
                  {minDays < 0 && (
                    <div style={{
                      position: 'absolute',
                      left: `${((0 - minDays) / range) * 100}%`,
                      top: 0,
                      bottom: 0,
                      width: 0,
                      borderLeft: '1.5px dashed rgba(15,23,42,0.3)',
                      pointerEvents: 'none',
                    }} />
                  )}

                  {/* Job Req Date dot — fixed at Day 0 on every row */}
                  {pos.reqDate && (() => {
                    const reqLeftPct = ((0 - minDays) / range) * 100;
                    const reqDateFormatted = new Date(pos.reqDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                    return (
                      <div
                        className="info-tooltip-wrap gantt-milestone"
                        style={{
                          left: `${reqLeftPct}%`,
                          background: '#334155',
                          width: 11,
                          height: 11,
                          borderRadius: 2,
                          transform: 'translateX(-50%) rotate(45deg)',
                          border: '2px solid #fff',
                          boxShadow: '0 0 0 1.5px #334155',
                          zIndex: 10,
                        }}
                        title={`Job Req Date: ${reqDateFormatted}`}
                      >
                        <span className="info-tooltip-box" style={{ width: 190, bottom: 'calc(100% + 10px)', transform: 'translateX(-50%) rotate(-45deg)' }}>
                          <strong style={{ display: 'block', marginBottom: 2 }}>Job Req Date</strong>
                          {reqDateFormatted} · Day 0
                        </span>
                      </div>
                    );
                  })()}

                  {/* Milestone dots */}
                  {(() => {
                    const validStages = STAGES
                      .map(s => ({ ...s, val: pos.avgStages?.[s.key as keyof typeof pos.avgStages] }))
                      .filter(s => s.val !== null && s.val !== undefined)
                      .sort((a, b) => (a.val as number) - (b.val as number));

                    return validStages.map((s, i) => {
                      const val = s.val as number;
                      const leftPct = ((val - minDays) / range) * 100;

                      // Compute actual calendar date for this milestone
                      const actualDate = pos.reqDate
                        ? new Date(new Date(pos.reqDate).getTime() + val * 86400000)
                            .toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                        : null;

                      let tooltipBody: string;
                      if (s.key === 'jdReceived') {
                        // JD Received: show actual date only — no day-delta
                        tooltipBody = actualDate ?? 'Date unavailable';
                      } else if (i === 0) {
                        tooltipBody = `Day ${Math.max(0, val)} from Req Date`;
                      } else {
                        const prevVal = validStages[i - 1].val as number;
                        const prevLabel = validStages[i - 1].label;
                        tooltipBody = `${val - prevVal}d from ${prevLabel}`;
                      }

                      return (
                        <div
                          key={s.key}
                          className="info-tooltip-wrap gantt-milestone"
                          style={{ left: `${leftPct}%`, background: s.color }}
                          title={`${s.label}: ${tooltipBody}`}
                        >
                          <span className="info-tooltip-box" style={{ width: 180, bottom: 'calc(100% + 8px)' }}>
                            <strong style={{ display: 'block', marginBottom: 2 }}>{s.label}</strong>
                            {tooltipBody}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Avg fill days */}
                <div style={{ width: 46, flexShrink: 0, textAlign: 'right', paddingLeft: '0.5rem', fontSize: '0.65rem', fontWeight: 600, color: pos.avgDays !== null ? (pos.avgDays <= 30 ? 'var(--teal-600)' : pos.avgDays <= 60 ? 'var(--amber-600)' : 'var(--brick-500)') : 'var(--text-muted)' }}>
                  {pos.avgDays !== null ? `${pos.avgDays}d` : '—'}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Panel>
  )
}

// ─── Hiring Timeline Accordion by BU ────────────────────────

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

  if (timeline.length === 0) return null

  const mid = Math.ceil(timeline.length / 2)
  const columns = [timeline.slice(0, mid), timeline.slice(mid)]

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', alignItems: 'start' }}>
        {columns.map((col, ci) => (
          <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {col.map(bu => {
              const isOpen = expanded.has(bu.bu)
              const rate = bu.totalApplicants > 0 ? (bu.totalJoined / bu.totalApplicants) * 100 : 0
              return (
                <div key={bu.bu} style={{
                  border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden',
                  background: 'var(--surface-container-low)', transition: 'box-shadow 0.2s',
                  boxShadow: isOpen ? '0 4px 16px rgba(15,23,42,0.07)' : 'none',
                }}>
                  {/* BU Header */}
                  <div
                    onClick={() => toggleBU(bu.bu)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.6rem',
                      padding: '0.6rem 0.85rem', cursor: 'pointer',
                      background: isOpen ? '#041627' : 'var(--warm-50)',
                      transition: 'background 0.2s',
                      userSelect: 'none',
                    }}
                  >
                    <span style={{ fontSize: '0.6rem', color: isOpen ? 'var(--gold)' : 'var(--text-muted)', transition: 'transform 0.2s', display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'none', flexShrink: 0 }}>▶</span>
                    <span style={{ flex: 1, fontSize: '0.78rem', fontWeight: 600, color: isOpen ? '#FFFFFF' : 'var(--text-primary)', fontFamily: "'Playfair Display', serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bu.bu}</span>
                    <span style={{ fontSize: '0.6rem', fontWeight: 500, color: isOpen ? 'rgba(180,190,210,0.6)' : 'var(--text-muted)', background: isOpen ? 'rgba(255,255,255,0.07)' : 'var(--bg)', padding: '1px 7px', borderRadius: 8, border: `1px solid ${isOpen ? 'rgba(255,255,255,0.1)' : 'var(--border)'}`, flexShrink: 0 }}>
                      {bu.positions.length}p
                    </span>
                    <span style={{ fontSize: '0.6rem', color: isOpen ? 'rgba(180,190,210,0.6)' : 'var(--text-muted)', flexShrink: 0 }}>{bu.totalApplicants}↓</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: isOpen ? 'var(--teal-300)' : 'var(--teal-600)', flexShrink: 0 }}>{bu.totalJoined}✓</span>
                    <span style={{
                      fontSize: '0.58rem', fontWeight: 700, padding: '1px 7px', borderRadius: 8, flexShrink: 0,
                      ...(rate >= 10 ? { background: isOpen ? 'rgba(16,185,129,0.2)' : '#EDFBF5', color: isOpen ? '#6EE7B7' : '#065F46' }
                        : rate >= 5 ? { background: isOpen ? 'rgba(180,83,9,0.2)' : '#FEF3C7', color: isOpen ? '#FDE68A' : '#92400E' }
                        : { background: isOpen ? 'rgba(239,68,68,0.2)' : '#FEE2E2', color: isOpen ? '#FCA5A5' : '#991B1B' })
                    }}>
                      {pct(rate)}
                    </span>
                  </div>

                  {/* Expanded position table */}
                  {isOpen && (
                    <div style={{ padding: '0.5rem 0.75rem 0.6rem', background: 'var(--surface)' }}>
                      {/* Column headers with tooltips */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0 0.2rem 0.3rem', marginBottom: '0.15rem', borderBottom: '1px solid var(--border)', fontSize: '0.58rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        <span style={{ flex: 1, minWidth: 0 }}>Position</span>
                        <span style={{ width: 30, textAlign: 'right' }}>Apps</span>
                        <span style={{ width: 120 }} />
                        <span style={{ width: 26, textAlign: 'center', display: 'inline-flex', justifyContent: 'center' }}>
                          <span className="info-tooltip-wrap">
                            <span style={{ cursor: 'help', textDecoration: 'underline dotted' }}>Jnd</span>
                            <span className="info-tooltip-box">Joined: Candidates who successfully joined for this position.</span>
                          </span>
                        </span>
                        <span style={{ width: 26, textAlign: 'center', display: 'inline-flex', justifyContent: 'center' }}>
                          <span className="info-tooltip-wrap">
                            <span style={{ cursor: 'help', textDecoration: 'underline dotted' }}>Drp</span>
                            <span className="info-tooltip-box">Dropped: Candidates who withdrew or were rejected at any stage of this position's pipeline.</span>
                          </span>
                        </span>
                        <span style={{ width: 32, textAlign: 'right', display: 'inline-flex', justifyContent: 'flex-end' }}>
                          <span className="info-tooltip-wrap">
                            <span style={{ cursor: 'help', textDecoration: 'underline dotted' }}>Days</span>
                            <span className="info-tooltip-box">Avg Days to Fill: Average calendar days from application date to joining date for candidates who joined this position.</span>
                          </span>
                        </span>
                      </div>

                      {bu.positions.map(pos => {
                        const barW = globalMax > 0 ? (pos.total / globalMax) * 100 : 0
                        const joinedW = pos.total > 0 ? (pos.joined / pos.total) * 100 : 0
                        const offeredW = pos.total > 0 ? (pos.offered / pos.total) * 100 : 0
                        return (
                          <div key={pos.position} className="data-row" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.18rem 0.2rem', borderRadius: 3, minHeight: 24 }}>
                            <div style={{ flex: 1, minWidth: 0, fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={pos.position}>
                              {pos.position}
                            </div>
                            <div style={{ width: 30, textAlign: 'right', fontSize: '0.67rem', color: 'var(--text-muted)', fontWeight: 500, flexShrink: 0 }}>{pos.total}</div>
                            {/* Stacked bar */}
                            <div style={{ width: 120, height: 12, background: 'var(--warm-50)', borderRadius: 3, overflow: 'hidden', position: 'relative', flexShrink: 0, border: '1px solid var(--glass-border)' }}>
                              <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.max(barW, 2)}%`, background: 'rgba(15,23,42,0.08)', borderRadius: 3 }} />
                              <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.max(barW * offeredW / 100, 0)}%`, background: 'rgba(251,191,36,0.45)', borderRadius: 3 }} />
                              <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.max(barW * joinedW / 100, 0)}%`, background: 'var(--teal-400)', borderRadius: 3, transition: 'width 0.4s ease' }} />
                            </div>
                            <div style={{ width: 26, textAlign: 'center', fontSize: '0.65rem', fontWeight: 600, color: pos.joined > 0 ? 'var(--teal-600)' : 'var(--text-muted)', flexShrink: 0 }}>{pos.joined}</div>
                            <div style={{ width: 26, textAlign: 'center', fontSize: '0.65rem', fontWeight: 500, color: pos.dropped > 0 ? 'var(--brick-400)' : 'var(--text-muted)', flexShrink: 0 }}>{pos.dropped}</div>
                            <div style={{ width: 32, textAlign: 'right', fontSize: '0.63rem', fontWeight: 600, flexShrink: 0, color: pos.avgDays !== null ? (pos.avgDays <= 30 ? 'var(--teal-600)' : pos.avgDays <= 60 ? 'var(--amber-600)' : 'var(--brick-500)') : 'var(--text-muted)' }}>
                              {pos.avgDays !== null ? `${pos.avgDays}d` : '–'}
                            </div>
                          </div>
                        )
                      })}

                      {/* Mini legend */}
                      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.3rem', paddingTop: '0.25rem', borderTop: '1px solid var(--border)' }}>
                        {[{ color: 'rgba(15,23,42,0.08)', label: 'Applied' }, { color: 'rgba(251,191,36,0.45)', label: 'Offered' }, { color: 'var(--teal-400)', label: 'Joined' }].map(l => (
                          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.57rem', color: 'var(--text-muted)' }}>
                            <span style={{ width: 7, height: 7, borderRadius: 2, background: l.color, display: 'inline-block', border: '1px solid var(--glass-border)' }} />
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

// Compact position KPI box
function PosKPIBox({ icon, label, value, sub, accent }: { icon: string; label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="kpi-card-hover" style={{
      border: '1px solid var(--border)', borderRadius: 16, padding: '1.25rem',
      position: 'relative', overflow: 'hidden',
      background: 'var(--glass-bg)', backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 110,
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: accent, borderRadius: '4px 0 0 4px' }} />
      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '0.4rem' }}>{icon} {label}</div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', fontWeight: 700, lineHeight: 1.2, color: 'var(--text-primary)', marginBottom: '0.3rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }} title={value}>{value}</div>
      <div style={{ fontSize: '0.68rem', color: accent, fontWeight: 600 }}>{sub}</div>
    </div>
  )
}

function PositionsTab({ data }: { data: DashboardData }) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<'total' | 'joined' | 'dropRate' | 'conversionRate' | 'avgDays'>('total')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  const allPositions = data.hiringTimelineByBU.flatMap(bu =>
    bu.positions.map(p => ({
      bu: bu.bu,
      position: p.position,
      total: p.total,
      offered: p.offered,
      joined: p.joined,
      dropped: p.dropped,
      avgDays: p.avgDays,
      conversionRate: p.total > 0 ? (p.joined / p.total) * 100 : 0,
      dropRate: p.total > 0 ? (p.dropped / p.total) * 100 : 0,
    }))
  )

  const filteredPositions = allPositions
    .filter(p =>
      p.position.toLowerCase().includes(search.toLowerCase()) ||
      p.bu.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const av = a[sortKey] ?? 0
      const bv = b[sortKey] ?? 0
      return sortDir === 'desc' ? (bv as number) - (av as number) : (av as number) - (bv as number)
    })

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }
  const SortIcon = ({ k }: { k: typeof sortKey }) => (
    <span style={{ fontSize: '0.55rem', opacity: sortKey === k ? 1 : 0.3, marginLeft: 2 }}>
      {sortKey === k ? (sortDir === 'desc' ? '▼' : '▲') : '▼'}
    </span>
  )

  const filledPos = allPositions.filter(p => p.avgDays !== null && p.avgDays > 0)
  const eligibleDrops = allPositions.filter(p => p.total >= 5)
  const mostSourced = allPositions.reduce((max, p) => p.total > (max?.total || 0) ? p : max, allPositions[0] || null)
  const fastestClosing = filledPos.reduce((min, p) => (p.avgDays! < (min?.avgDays || Infinity)) ? p : min, filledPos[0] || null)
  const highestDrop = eligibleDrops.reduce((max, p) => p.dropRate > (max?.dropRate || 0) ? p : max, eligibleDrops[0] || null)
  const bestConversion = eligibleDrops.reduce((max, p) => p.conversionRate > (max?.conversionRate || 0) ? p : max, eligibleDrops[0] || null)

  // Scatter chart
  const scatterData = {
    datasets: [{
      label: 'Positions',
      data: filledPos.map(p => ({ x: p.avgDays, y: p.total, position: p.position, joined: p.joined })),
      backgroundColor: 'rgba(212,168,67,0.55)',
      borderColor: 'rgba(212,168,67,0.9)',
      borderWidth: 1, pointRadius: 5, pointHoverRadius: 8,
    }]
  }
  const scatterOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx: any) => { const r = ctx.raw; return `${r.position}: ${r.y} Apps, ${r.x}d, ${r.joined} Joined` } } }
    },
    scales: {
      x: { title: { display: true, text: 'Avg Days to Fill', color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(15,23,42,0.06)' }, ticks: { color: '#94a3b8', font: { size: 10 } } },
      y: { title: { display: true, text: 'Total Applicants', color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(15,23,42,0.06)' }, ticks: { color: '#94a3b8', font: { size: 10 } } }
    }
  }

  // Pipeline Efficiency by Role — top 8 positions by volume
  const top8Eff = [...allPositions].sort((a, b) => b.total - a.total).slice(0, 8)
  const maxTotalEff = Math.max(...top8Eff.map(p => p.total), 1)

  const thStyle = (k: typeof sortKey): React.CSSProperties => ({
    padding: '0.35rem 0.5rem', fontSize: '0.58rem', fontWeight: 700,
    color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em',
    cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
    borderBottom: sortKey === k ? '2px solid var(--gold)' : '2px solid var(--border)',
  })

  return (
    <div className="tab-content">

      <SectionLabel>Position Intelligence</SectionLabel>

      {/* Compact KPI boxes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
        <PosKPIBox icon="🔥" label="Most Sourced" value={mostSourced?.position ?? 'N/A'} sub={mostSourced ? `${num(mostSourced.total)} applicants` : '—'} accent="var(--amber-500)" />
        <PosKPIBox icon="⚡" label="Fastest Close" value={fastestClosing?.position ?? 'N/A'} sub={fastestClosing ? `${fastestClosing.avgDays}d avg` : '—'} accent="var(--teal-500)" />
        <PosKPIBox icon="⚠️" label="Highest Drop" value={highestDrop?.position ?? 'N/A'} sub={highestDrop ? `${pct(highestDrop.dropRate)} drop` : '—'} accent="var(--brick-400)" />
        <PosKPIBox icon="🏆" label="Best Conversion" value={bestConversion?.position ?? 'N/A'} sub={bestConversion ? `${pct(bestConversion.conversionRate)} hired` : '—'} accent="var(--teal-600)" />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.1rem', marginBottom: '1.25rem' }}>

        {/* Scatter */}
        <Panel>
          <PanelTitle title="Time to Fill vs. Volume" tooltip="Roles in top-right quadrant: high volume, slow to fill — review bottleneck." />
          <div style={{ height: 260 }}>
            <Scatter data={scatterData} options={scatterOptions} />
          </div>
        </Panel>

        {/* Pipeline Efficiency by Role */}
        {top8Eff.length >= 2 && (
          <Panel>
            <PanelTitle
              title="Pipeline Efficiency by Role"
              tooltip="Top roles by applicant volume. Each bar shows what fraction of applicants reached Offer stage (amber) and Joined (teal). Conv% = Joined ÷ Applied. Roles with high volume but low teal fill are pipeline bottlenecks."
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {top8Eff.map((p, i) => {
                const offerPct   = p.total > 0 ? (p.offered / p.total) * 100 : 0
                const joinPct    = p.total > 0 ? (p.joined  / p.total) * 100 : 0
                const volPct     = (p.total / maxTotalEff) * 100
                const convColor  = joinPct >= 15 ? 'var(--teal-600)' : joinPct >= 7 ? 'var(--amber-600)' : 'var(--brick-500)'
                const convBg     = joinPct >= 15 ? '#EDFBF5' : joinPct >= 7 ? '#FEF3DC' : '#FDEAE8'
                const rank = i + 1
                return (
                  <div key={p.position} style={{ display: 'grid', gridTemplateColumns: '20px 1fr 160px 52px 40px', gap: '0.4rem', alignItems: 'center' }}>
                    {/* Rank */}
                    <div style={{ fontSize: '0.58rem', fontWeight: 700, color: rank <= 3 ? 'var(--amber-600)' : 'var(--text-muted)', textAlign: 'right' }}>{rank}</div>
                    {/* Role name */}
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }} title={`${p.position} · ${p.bu}`}>
                      {p.position}
                      <span style={{ marginLeft: 4, fontSize: '0.57rem', fontWeight: 500, color: 'var(--text-muted)', background: 'var(--warm-50)', border: '1px solid var(--border)', borderRadius: 4, padding: '0 4px' }}>{p.bu}</span>
                    </div>
                    {/* Stacked funnel bar */}
                    <div style={{ position: 'relative', height: 14, borderRadius: 4, background: 'rgba(15,23,42,0.06)', overflow: 'hidden' }}>
                      {/* Volume fill (ghost) */}
                      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${volPct}%`, background: 'rgba(15,23,42,0.07)', borderRadius: 4 }} />
                      {/* Offer fill */}
                      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${offerPct}%`, background: 'rgba(251,191,36,0.5)', borderRadius: 4, transition: 'width 0.4s' }} />
                      {/* Joined fill */}
                      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${joinPct}%`, background: 'var(--teal-400)', borderRadius: 4, transition: 'width 0.4s' }} />
                    </div>
                    {/* Apps count */}
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textAlign: 'right', fontWeight: 500 }}>{num(p.total)} apps</div>
                    {/* Conv rate badge */}
                    <div style={{ fontSize: '0.6rem', fontWeight: 700, color: convColor, background: convBg, borderRadius: 5, padding: '1px 5px', textAlign: 'center', whiteSpace: 'nowrap' }}>{pct(joinPct)}</div>
                  </div>
                )
              })}
              {/* Legend */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border)' }}>
                {[
                  { color: 'rgba(251,191,36,0.5)', label: 'Reached Offer' },
                  { color: 'var(--teal-400)', label: 'Joined' },
                ].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color, display: 'inline-block' }} />
                    {l.label}
                  </div>
                ))}
                <span style={{ marginLeft: 'auto', fontSize: '0.6rem', color: 'var(--text-muted)' }}>Bar width = volume vs. top role · Conv% = Joined ÷ Applied</span>
              </div>
            </div>
          </Panel>
        )}
      </div>

      {/* Compact table */}
      <Panel>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: "'Playfair Display', serif", fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Position Pipeline Breakdown
            <InfoTooltip wide text={`Apps: Total applicants who applied for this role across all sources.

Joined: Candidates who accepted the offer and onboarded. Count of 'Joined' status rows.

Drop%: Mid-pipeline attrition. Formula: (Dropped ÷ Apps) × 100. Includes withdrawals and rejections before the offer stage.

Conv: Hiring conversion rate. Formula: (Joined ÷ Apps) × 100. Higher = more efficient pipeline for this role.

Days: Avg days to fill. Average of (Joining Date − Application Date) for joined candidates. Blank if no date data.`} />
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', color: 'var(--text-muted)', pointerEvents: 'none' }}>🔍</span>
              <input
                type="text"
                placeholder="Search role or BU..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ padding: '0.32rem 1.75rem 0.32rem 1.6rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-container)', color: 'var(--text-primary)', fontSize: '0.72rem', width: 180, outline: 'none', fontFamily: "'Inter', sans-serif" }}
              />
              {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.65rem', color: 'var(--text-muted)', padding: 0 }}>✕</button>}
            </div>
            <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--text-muted)', background: 'var(--warm-50)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{filteredPositions.length} / {allPositions.length} roles</span>
          </div>
        </div>
        <div style={{ overflowX: 'auto', maxHeight: 340, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-container-low)', zIndex: 1 }}>
              <tr>
                <th style={{ ...thStyle('total'), textAlign: 'left' }} onClick={() => handleSort('total')}>Role / BU</th>
                <th style={{ ...thStyle('total'), textAlign: 'right' }} onClick={() => handleSort('total')}>Apps <SortIcon k="total" /></th>
                <th style={{ ...thStyle('joined'), textAlign: 'right' }} onClick={() => handleSort('joined')}>Joined <SortIcon k="joined" /></th>
                <th style={{ ...thStyle('dropRate'), textAlign: 'right' }} onClick={() => handleSort('dropRate')}>Drop% <SortIcon k="dropRate" /></th>
                <th style={{ ...thStyle('conversionRate') }} onClick={() => handleSort('conversionRate')}>Conv <SortIcon k="conversionRate" /></th>
                <th style={{ ...thStyle('avgDays'), textAlign: 'right' }} onClick={() => handleSort('avgDays')}>Days <SortIcon k="avgDays" /></th>
              </tr>
            </thead>
            <tbody>
              {filteredPositions.map((p, i) => (
                <tr key={i} className="data-row" style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.28rem 0.5rem', maxWidth: 200 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.position}>{p.position}</div>
                    <span style={{ fontSize: '0.58rem', background: 'var(--warm-50)', border: '1px solid var(--border)', borderRadius: 6, padding: '0 5px', color: 'var(--text-muted)', fontWeight: 600 }}>{p.bu}</span>
                  </td>
                  <td style={{ padding: '0.28rem 0.5rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>{num(p.total)}</td>
                  <td style={{ padding: '0.28rem 0.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--teal-600)' }}>{num(p.joined)}</td>
                  <td style={{ padding: '0.28rem 0.5rem', textAlign: 'right', fontWeight: 600, color: p.dropRate > 60 ? 'var(--brick-400)' : p.dropRate > 40 ? 'var(--amber-600)' : 'var(--text-muted)' }}>{pct(p.dropRate)}</td>
                  <td style={{ padding: '0.28rem 0.5rem', minWidth: 80 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ flex: 1, height: 5, background: 'var(--warm-50)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(p.conversionRate, 100)}%`, background: p.conversionRate >= 10 ? 'var(--teal-400)' : p.conversionRate > 0 ? 'var(--amber-400)' : 'var(--brick-300)', borderRadius: 3, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', flexShrink: 0, width: 30, textAlign: 'right' }}>{pct(p.conversionRate)}</span>
                    </div>
                  </td>
                  <td style={{ padding: '0.28rem 0.5rem', textAlign: 'right', fontWeight: 600, fontSize: '0.68rem', color: p.avgDays !== null ? (p.avgDays <= 30 ? 'var(--teal-600)' : p.avgDays <= 60 ? 'var(--amber-600)' : 'var(--brick-500)') : 'var(--text-muted)' }}>
                    {p.avgDays !== null ? `${p.avgDays}d` : '—'}
                  </td>
                </tr>
              ))}
              {filteredPositions.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No positions match your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  TAB 5: GLOSSARY — KPI Definitions
// ═══════════════════════════════════════════════════════════════

function GlossaryTab() {
  const [activeSection, setActiveSection] = useState<'kpis' | 'status' | 'columns'>('kpis')

  const kpiGroups = [
    {
      label: 'Pipeline Metrics',
      color: 'var(--amber-500)',
      items: [
        { icon: '👥', name: 'Total Applicants', def: 'All candidate applications received across every business unit.', calc: 'Count of all rows in Applicants sheet' },
        { icon: '✅', name: 'Hiring Rate', def: 'Percentage of applicants who successfully joined the company.', calc: '(Joined ÷ Total Applicants) × 100' },
        { icon: '📋', name: 'Offers Extended', def: 'Candidates who reached the offer stage — joined, dropped, or pending.', calc: 'Count of offer / join / offer-drop statuses' },
        { icon: '🤝', name: 'Offer Acceptance Rate', def: 'Percentage of candidates who accepted their offer and joined.', calc: '(Joined ÷ Offers Extended) × 100' },
        { icon: '⚡', name: 'Offer Drop Rate', def: 'Percentage of candidates who declined their offer post-extension.', calc: '(Offer Drops ÷ Offers Extended) × 100' },
        { icon: '🚪', name: 'Candidate Drops', def: 'Candidates who withdrew mid-pipeline before the offer stage.', calc: 'Count of drop statuses (not offer-stage)' },
        { icon: '🔍', name: 'Screen Rejects', def: 'Candidates rejected at initial screening, before any interview.', calc: 'Count of screen-reject status rows' },
        { icon: '⏱️', name: 'Avg Time to Fill', def: 'Average days to close a position from requisition to joining.', calc: 'Avg (Joining Date − Req Date) for joined candidates' },
      ],
    },
    {
      label: 'Vacancy Metrics',
      color: 'var(--teal-500)',
      items: [
        { icon: '📌', name: 'Total Vacancies', def: 'Total open positions logged in the Vacancies sheet.', calc: 'Count of all rows in Vacancies sheet' },
        { icon: '🎯', name: 'Fill Rate', def: 'Percentage of vacancies successfully filled/closed.', calc: '(Filled Vacancies ÷ Total Vacancies) × 100' },
        { icon: '🟢', name: 'Filled', def: 'Positions that have been hired for and closed.', calc: 'Status matches: Closed / Hired / Joined / Placed' },
        { icon: '⏸️', name: 'On Hold', def: 'Positions paused, deferred, or frozen by the business.', calc: 'Status matches: Hold / Paused / Deferred / Frozen' },
        { icon: '🔄', name: 'In Process', def: 'Positions actively being recruited for right now.', calc: 'Status matches: Active / Ongoing / Open / Live' },
      ],
    },
  ]

  const statusRows = [
    { p: 1, cat: 'Joined', color: '#EDFBF5', text: '#1A6845', keywords: 'join, onboard' },
    { p: 2, cat: 'Offer Drop', color: '#FEF0E6', text: '#9A3A10', keywords: 'offer drop, drop offer' },
    { p: 3, cat: 'Offer', color: '#FEF3DC', text: '#9A5D0A', keywords: 'offer, offer extend, extended' },
    { p: 4, cat: 'Dropped', color: '#FEF3DC', text: '#9A5D0A', keywords: 'drop, candidate drop, withdrawn, declined, not interested' },
    { p: 5, cat: 'R1 Reject', color: '#FDEAE8', text: '#9A2A1E', keywords: 'r1 reject, round 1 reject, l1 reject, 1st reject' },
    { p: 6, cat: 'R2 Reject', color: '#FDEAE8', text: '#9A2A1E', keywords: 'r2 reject, round 2 reject, l2 reject, 2nd reject' },
    { p: 7, cat: 'No Show', color: '#EEF2F7', text: '#3D5A80', keywords: 'no-show, no show, absent' },
    { p: 8, cat: 'Screen Reject', color: '#FDEAE8', text: '#9A2A1E', keywords: 'screen reject, profile reject, not shortlisted, rejected' },
    { p: 9, cat: 'Shortlisted', color: '#EEF9F5', text: '#1A6845', keywords: 'shortlist, screen pass, l1 pass, selected, profile shar' },
  ]

  const colGroups = [
    {
      sheet: 'Applicants',
      rows: [
        { field: 'Status', aliases: 'Status · Current Status · Stage · Pipeline Stage' },
        { field: 'Source', aliases: 'Source · Source Channel · Channel · Source of Application' },
        { field: 'Business Unit', aliases: 'Business Unit · BU · Company · Division · Department · Entity' },
        { field: 'Position', aliases: 'Position · Role · Job Title · Designation · Opening · Vacancy' },
        { field: 'Recruiter', aliases: 'Recruiter · Assigned To · HR · RM · Talent Acquisition · SPOC' },
        { field: 'Application Date', aliases: 'Application Start · Date · Applied Date · Date of Application' },
        { field: 'Quarter', aliases: 'Quarter · Q · FY Quarter  (or derived from date: Indian FY)' },
        { field: 'Joining Date', aliases: 'Hired Date · Joining Date · DOJ · Join Date · Onboarding Date' },
        { field: 'Req. Date', aliases: 'Requisition Date · Job Req Date · Req Date · Job Requisition' },
      ],
    },
    {
      sheet: 'Vacancies',
      rows: [
        { field: 'Status', aliases: 'Status · Number of Positions Closed · Vacancy Status · Stage' },
        { field: 'Business Unit', aliases: 'Business Vertical · Business Unit · BU · Company · Division' },
      ],
    },
  ]

  const tabs = [
    { id: 'kpis' as const, label: '📐 KPI Definitions' },
    { id: 'status' as const, label: '🏷️ Status Rules' },
    { id: 'columns' as const, label: '📋 Column Aliases' },
  ]

  return (
    <div className="tab-content">
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #041627 0%, #0d2137 100%)',
        borderRadius: 16, padding: '2rem 2.5rem', marginBottom: '1.5rem',
        border: '1px solid rgba(212,168,67,0.2)', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,168,67,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', fontWeight: 700, color: 'var(--gold)', marginBottom: '0.4rem' }}>
          Glossary &amp; Reference
        </div>
        <div style={{ fontSize: '0.85rem', color: 'rgba(180,200,220,0.7)', maxWidth: 560 }}>
          Definitions, formulas, status classification rules, and column name aliases used throughout the dashboard.
        </div>
      </div>

      {/* Sub-nav */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveSection(t.id)} style={{
            padding: '0.55rem 1.25rem', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontFamily: "'Inter', sans-serif", fontSize: '0.8rem', fontWeight: 600,
            background: activeSection === t.id ? 'var(--primary)' : 'var(--warm-50)',
            color: activeSection === t.id ? 'var(--on-primary)' : 'var(--text-secondary)',
            transition: 'all 0.15s ease',
            boxShadow: activeSection === t.id ? '0 4px 12px rgba(212,168,67,0.2)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {/* KPI Definitions */}
      {activeSection === 'kpis' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {kpiGroups.map(group => (
            <div key={group.label}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ width: 3, height: 20, background: group.color, borderRadius: 2 }} />
                <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{group.label}</div>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.85rem' }}>
                {group.items.map(item => (
                  <div key={item.name} className="kpi-card-hover glass-panel" style={{ padding: '1.1rem 1.25rem', borderRadius: 12, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: group.color, borderRadius: '3px 0 0 3px' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.03em' }}>{item.name}</div>
                    </div>
                    <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.65rem' }}>{item.def}</div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 6, padding: '0.25rem 0.6rem' }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--teal-600)', fontWeight: 700, fontFamily: 'monospace' }}>ƒx</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--teal-700)', fontWeight: 500 }}>{item.calc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Status Classification */}
      {activeSection === 'status' && (
        <Panel>
          <PanelTitle title="Status Classification Rules" tooltip="Priority order: first match wins. Edit STATUS_PATTERNS in kpi-config.ts to change." />
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
            Each candidate's status column is matched top-to-bottom. The <strong>first</strong> matching rule wins — so Joined is checked before Offer Drop, Offer before Dropped, etc.
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '0.6rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '0.65rem', width: 40 }}>#</th>
                  <th style={{ textAlign: 'left', padding: '0.6rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '0.65rem', width: 120 }}>Category</th>
                  <th style={{ textAlign: 'left', padding: '0.6rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '0.65rem' }}>Matched Keywords / Patterns</th>
                </tr>
              </thead>
              <tbody>
                {statusRows.map(row => (
                  <tr key={row.p} className="data-row" style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-muted)', fontWeight: 700, fontFamily: 'monospace' }}>{row.p}</td>
                    <td style={{ padding: '0.65rem 0.75rem' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, background: row.color, color: row.text, fontSize: '0.72rem', fontWeight: 600 }}>{row.cat}</span>
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: 1.6 }}>{row.keywords}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: '1.25rem', padding: '0.85rem 1rem', background: 'var(--gold-light)', borderRadius: 10, borderLeft: '3px solid var(--gold)', fontSize: '0.73rem', color: 'var(--amber-800)', lineHeight: 1.6 }}>
            💡 To add new keywords or tweak matching rules, edit <code style={{ background: 'rgba(0,0,0,0.07)', padding: '1px 5px', borderRadius: 3 }}>STATUS_PATTERNS</code> in <code style={{ background: 'rgba(0,0,0,0.07)', padding: '1px 5px', borderRadius: 3 }}>netlify/functions/kpi-config.ts</code>. Redeploy for changes to take effect.
          </div>
        </Panel>
      )}

      {/* Column Aliases */}
      {activeSection === 'columns' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {colGroups.map(group => (
            <Panel key={group.sheet}>
              <PanelTitle title={`${group.sheet} Sheet — Column Name Aliases`} badge="case-insensitive + partial match" />
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.65rem', width: 140 }}>Field</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.65rem' }}>Accepted Column Headers (any of these)</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map(r => (
                    <tr key={r.field} className="data-row" style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.75rem' }}>{r.field}</td>
                      <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: 1.7 }}>{r.aliases}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          ))}
          <div style={{ padding: '0.85rem 1.25rem', background: 'var(--warm-50)', borderRadius: 10, border: '1px solid var(--border)', fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            📌 Column names are matched <strong>case-insensitively</strong> and by <strong>partial substring</strong> — e.g. a column named <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: 3 }}>Business Unit Name</code> will still match the "Business Unit" field. Add more aliases in <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: 3 }}>COLUMN_CANDIDATES</code> in kpi-config.ts.
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  MAIN DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════════════════

function Dashboard() {
  const [authed, setAuthed] = useState(() => typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(AUTH_KEY) === '1' : false)
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
      <div className="dashboard-main-header" style={{
        background: 'linear-gradient(135deg, #041627 0%, #0d2137 55%, #1a2b3c 100%)',
        position: 'relative', overflow: 'hidden',
        borderBottom: '3px solid var(--secondary)',
        boxShadow: '0 4px 24px rgba(4, 22, 39, 0.18)',
      }}>
        <div className="header-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.6 }} />
        <div className="dashboard-header" style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Logo icon */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 48, height: 48, borderRadius: 12, flexShrink: 0,
              background: 'linear-gradient(135deg, #944a00 0%, #e67e22 100%)',
              boxShadow: '0 6px 20px rgba(148,74,0,0.4)',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: '0.7rem', color: 'rgba(180,200,222,0.65)', marginBottom: '0.2rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Talent Acquisition · Live Intelligence
              </p>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.75rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                Recruitment Strategic Dashboard
              </h1>
            </div>
          </div>
          <div className="dashboard-header-right">
            <div style={{
              background: 'linear-gradient(135deg, #944a00, #e67e22)',
              color: '#FFFFFF', padding: '0.4rem 1.1rem', borderRadius: 20,
              fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              boxShadow: '0 3px 12px rgba(148,74,0,0.35)',
            }}>
              Executive View · Real-Time
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              {lastUpdated && (
                <span style={{ fontSize: '0.7rem', color: 'rgba(180,200,222,0.65)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399', animation: 'pulse 2s ease infinite', boxShadow: '0 0 6px rgba(52,211,153,0.6)' }} />
                  Live · {lastUpdated}
                </span>
              )}
              {!showConfig && (
                <button onClick={() => setShowConfig(true)} style={{ fontSize: '0.7rem', color: 'rgba(255,183,131,0.8)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: "'Inter', sans-serif" }}>Change source</button>
              )}
              {lastUrls && !loading && (
                <button onClick={() => fetchData(lastUrls.a, lastUrls.v)} style={{ fontSize: '0.7rem', color: 'rgba(255,183,131,0.8)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: "'Inter', sans-serif" }}>↻ Refresh</button>
              )}
              <button
                onClick={handleSignOut}
                style={{
                  fontSize: '0.7rem', color: 'rgba(180,200,222,0.6)',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 6, cursor: 'pointer', padding: '4px 12px',
                  fontFamily: "'Inter', sans-serif", transition: 'all 0.2s',
                }}
                onMouseEnter={e => { const b = e.target as HTMLButtonElement; b.style.color = '#fca5a5'; b.style.borderColor = 'rgba(252,165,165,0.3)' }}
                onMouseLeave={e => { const b = e.target as HTMLButtonElement; b.style.color = 'rgba(180,200,222,0.6)'; b.style.borderColor = 'rgba(255,255,255,0.12)' }}
              >Sign out</button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        {data && !loading && (
          <div style={{ position: 'relative', marginTop: '1.25rem' }}>
            <div className="dashboard-tabs" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: 1, padding: '0.55rem 1rem', borderRadius: 8, border: 'none',
                    background: activeTab === tab.id
                      ? 'linear-gradient(135deg, #944a00, #e67e22)'
                      : 'transparent',
                    boxShadow: activeTab === tab.id ? '0 3px 12px rgba(148,74,0,0.35)' : 'none',
                    fontFamily: "'Inter', sans-serif", fontSize: '0.8rem',
                    fontWeight: activeTab === tab.id ? 600 : 500,
                    color: activeTab === tab.id ? '#FFFFFF' : 'rgba(180,200,222,0.6)',
                    cursor: 'pointer', transition: 'all 0.22s ease',
                    letterSpacing: '0.01em',
                  }}
                  onMouseEnter={e => { if (activeTab !== tab.id) (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.85)' }}
                  onMouseLeave={e => { if (activeTab !== tab.id) (e.target as HTMLElement).style.color = 'rgba(180,200,222,0.6)' }}
                >{tab.label}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Main Content ─── */}
      <div className="dashboard-main-content" style={{ flex: 1, maxWidth: 1600 }}>
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
      <div className="dashboard-footer-bar" style={{
        background: '#041627',
        borderTop: '2px solid rgba(148,74,0,0.4)',
      }}>
        <p style={{ fontSize: '0.7rem', color: 'rgba(180,200,222,0.45)', letterSpacing: '0.06em' }}>
          Confidential · Talent Acquisition Intelligence · Internal Distribution Only
        </p>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '0.9rem', color: 'rgba(255,183,131,0.7)', letterSpacing: '0.08em', fontWeight: 600 }}>TA Analytics</div>
      </div>
    </div>
  )
}
