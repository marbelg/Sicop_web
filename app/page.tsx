'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const TIPO_LABELS: Record<string, string> = {
  CD: 'Contratación Directa',        CE: 'Contratación Especial',
  LA: 'Licitación Abreviada',        LD: 'Licitación Reducida',
  LE: 'Licitación Menor',            LI: 'Licitación Pública Internacional',
  LN: 'Licitación Pública Nacional', LY: 'Licitación Mayor',
  LP: 'Licitación Pública',          PE: 'Procedimientos Especiales',
  PP: 'Procedimiento por Principio', PX: 'Procedimiento por Excepción',
  SE: 'Subasta Inversa Electrónica',
  RE: 'Remate',
}
const TIPO_COLORS: Record<string, string> = {
  LP: '#378ADD', LN: '#378ADD', LI: '#378ADD',
  LA: '#9ED23A', LE: '#9ED23A', LY: '#9ED23A', LD: '#9ED23A',
  CD: '#F59E0B', CE: '#F59E0B',
  PX: '#A78BFA', PP: '#A78BFA', PE: '#A78BFA',
  SE: '#F472B6',
  RE: '#FB923C',
}
const ESTADO_COLORS: Record<string, string> = {
  'En recepción': '#22C55E',
  'En análisis':  '#F59E0B',
  'Adjudicada':   '#9ED23A',
  'Desierta':     '#94A3B8',
}

const MONTO_PRESETS = [
  { label: 'Todos',  min: 0,           max: 0 },
  { label: '≤ 1M',  min: 0,           max: 1_000_000 },
  { label: '≤ 5M',  min: 0,           max: 5_000_000 },
  { label: '≤ 20M', min: 0,           max: 20_000_000 },
  { label: '≤ 100M',min: 0,           max: 100_000_000 },
  { label: '> 100M',min: 100_000_001, max: 0 },
]

function fmtMonto(n: number | null | undefined, currency?: string) {
  if (!n) return null
  return new Intl.NumberFormat('es-CR', {
    style: 'currency', currency: currency === 'USD' ? 'USD' : 'CRC',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
}
function fmtMontoShort(n: number) {
  if (n >= 1_000_000_000) return `₡${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `₡${(n / 1_000_000).toFixed(0)}M`
  return `₡${n.toLocaleString('es-CR')}`
}
function fmtDate(s: string | null) {
  if (!s) return null
  const [y, m, d] = s.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function Badge({ label, color, pulse }: { label: string; color: string; pulse?: boolean }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
      background: color + '22', color, border: `1px solid ${color}44`,
      letterSpacing: '0.04em', whiteSpace: 'nowrap' as const,
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      {pulse && <span className="lf-pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />}
      {label}
    </span>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: '#0F1F35', border: '1px solid #1E3A5F', borderRadius: 10, padding: '14px 18px', flex: 1, minWidth: 110 }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: '0 0 6px' }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 800, color: color ?? '#E2E8F0', margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: 10, color: '#475569', margin: '3px 0 0' }}>{sub}</p>}
    </div>
  )
}

type Section = 'dashboard' | 'list' | 'instituciones' | 'oferentes' | 'categorias' | 'radar'
type Sort    = 'fecha_desc' | 'monto_asc' | 'monto_desc'
type AuthMode = 'login' | 'registro'

interface AuthUser { nombre: string; email: string; empresa?: string }

export default function Home() {
  const router = useRouter()

  // ── Global filters (affect dashboard stats + list) ──
  const [gMontoMin, setGMontoMin]   = useState(0)
  const [gMontoMax, setGMontoMax]   = useState(0)
  const [gEstado, setGEstado]       = useState('')
  const [customMin, setCustomMin]   = useState('')
  const [customMax, setCustomMax]   = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const activePreset = MONTO_PRESETS.find(p => p.min === gMontoMin && p.max === gMontoMax)

  // ── Dashboard data ──
  const [dash, setDash] = useState<any>(null)
  const [dashLoading, setDashLoading] = useState(true)

  // ── List-level filters ──
  const [q, setQ]                   = useState('')
  const [tipo, setTipo]             = useState('')
  const [sort, setSort]             = useState<Sort>('fecha_desc')
  const [inst, setInst]             = useState('')
  const [proveedor, setProveedor]   = useState('')
  const [proveedorLabel, setProveedorLabel] = useState('')
  const [page, setPage]             = useState(1)
  const [data, setData]             = useState<any>(null)
  const [loading, setLoading]       = useState(true)

  const [section, setSection]       = useState<Section>('dashboard')
  const [showFilters, setShowFilters] = useState(false)

  // ── Auth & Radar ──
  const [user, setUser]             = useState<AuthUser | null>(null)
  const [showAuth, setShowAuth]     = useState(false)
  const [authMode, setAuthMode]     = useState<AuthMode>('login')
  const [authForm, setAuthForm]     = useState({ nombre: '', email: '', empresa: '', password: '' })
  const [authError, setAuthError]   = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [radarKeywords, setRadarKeywords] = useState<string[]>([])
  const [radarHits, setRadarHits]   = useState<any[]>([])
  const [radarInput, setRadarInput] = useState('')
  const [radarLoading, setRadarLoading] = useState(false)

  // Check session on mount
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => { if (d?.user) setUser(d.user) }).catch(() => {})
  }, [])

  // Load radar keywords from localStorage for anonymous users on mount
  useEffect(() => {
    if (!user) {
      try {
        const saved = JSON.parse(localStorage.getItem('radar_kw') ?? '[]')
        if (Array.isArray(saved)) setRadarKeywords(saved)
      } catch {}
    }
  }, [user])

  // Search whenever radar keywords change (for both logged and anonymous)
  useEffect(() => {
    if (section !== 'radar' || radarKeywords.length === 0) { setRadarHits([]); return }
    setRadarLoading(true)
    const url = user
      ? '/api/radar'
      : `/api/radar?kw=${encodeURIComponent(radarKeywords.join(','))}`
    fetch(url).then(r => r.json()).then(d => {
      setRadarHits(d.hits ?? [])
      setRadarLoading(false)
    })
  }, [section, radarKeywords, user])

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setAuthError(''); setAuthLoading(true)
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/registro'
    const body = authMode === 'login'
      ? { email: authForm.email, password: authForm.password }
      : authForm
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    setAuthLoading(false)
    if (!res.ok) { setAuthError(data.error ?? 'Error'); return }
    setUser(data.user)
    setShowAuth(false)
    setAuthForm({ nombre: '', email: '', empresa: '', password: '' })
    setSection('radar')
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null); setRadarKeywords([]); setRadarHits([])
  }

  async function addKeyword() {
    const kw = radarInput.trim().toLowerCase()
    if (!kw || radarKeywords.includes(kw)) return
    setRadarInput('')
    if (user) {
      await fetch('/api/radar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyword: kw }) })
    } else {
      const updated = [...radarKeywords, kw]
      localStorage.setItem('radar_kw', JSON.stringify(updated))
      setRadarKeywords(updated)
    }
    if (user) {
      const d = await fetch('/api/radar').then(r => r.json())
      setRadarKeywords(d.keywords ?? [])
    }
  }

  async function removeKeyword(kw: string) {
    if (user) {
      await fetch('/api/radar', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyword: kw }) })
      const d = await fetch('/api/radar').then(r => r.json())
      setRadarKeywords(d.keywords ?? [])
    } else {
      const updated = radarKeywords.filter(k => k !== kw)
      localStorage.setItem('radar_kw', JSON.stringify(updated))
      setRadarKeywords(updated)
    }
  }

  // Fetch dashboard whenever global filters change
  useEffect(() => {
    setDashLoading(true)
    const params = new URLSearchParams()
    if (gMontoMin) params.set('montoMin', String(gMontoMin))
    if (gMontoMax) params.set('montoMax', String(gMontoMax))
    if (gEstado)   params.set('estado', gEstado)
    fetch(`/api/dashboard?${params}`).then(r => r.json()).then(d => { setDash(d); setDashLoading(false) })
  }, [gMontoMin, gMontoMax, gEstado])

  // Fetch list whenever any filter changes
  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ q, tipo, estado: gEstado, inst, proveedor, sort, page: String(page) })
    if (gMontoMin) params.set('montoMin', String(gMontoMin))
    if (gMontoMax) params.set('montoMax', String(gMontoMax))
    const res = await fetch(`/api/licitaciones?${params}`)
    setData(await res.json())
    setLoading(false)
  }, [q, tipo, gEstado, inst, proveedor, sort, gMontoMin, gMontoMax, page])

  useEffect(() => { load() }, [load])

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0
  const stats = dash?.stats

  function applyPreset(p: typeof MONTO_PRESETS[0]) {
    setGMontoMin(p.min); setGMontoMax(p.max)
    setCustomMin(''); setCustomMax(''); setShowCustom(false)
    setPage(1)
  }

  function applyCustom() {
    const mn = parseFloat(customMin) || 0
    const mx = parseFloat(customMax) || 0
    setGMontoMin(mn); setGMontoMax(mx); setPage(1)
  }

  function goToList(filters: { inst?: string; proveedor?: string; proveedorLabel?: string; tipo?: string }) {
    if (filters.inst !== undefined)      { setInst(filters.inst); setProveedor(''); setProveedorLabel('') }
    if (filters.proveedor !== undefined) { setProveedor(filters.proveedor); setProveedorLabel(filters.proveedorLabel ?? ''); setInst('') }
    if (filters.tipo !== undefined)      setTipo(filters.tipo)
    setPage(1); setSection('list')
  }

  const globalFiltered = gMontoMin > 0 || gMontoMax > 0 || gEstado !== ''

  return (
    <div style={{ minHeight: '100vh', background: '#0A1628', color: '#E2E8F0', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div className="lf-header" style={{ background: '#0F1F35', borderBottom: '1px solid #1E3A5F', padding: '12px 24px' }}>
        <button onClick={() => setSection('dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', gap: 0, flexShrink: 0 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#9ED23A' }}>Licita</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#E2E8F0' }}>Fácil</span>
        </button>
        <div className="lf-header-search">
          <input
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1); setSection('list') }}
            placeholder="Buscar por título, número de procedimiento..."
            style={{ width: '100%', padding: '7px 14px', borderRadius: 8, border: '1px solid #1E3A5F', background: '#0A1628', color: '#E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }}
          />
        </div>
        <a href="/import" style={{ fontSize: 12, color: '#64748B', textDecoration: 'none', whiteSpace: 'nowrap' as const }}>⟳ Sincronizar</a>
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button onClick={() => setSection('radar')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#9ED23A', fontWeight: 700, whiteSpace: 'nowrap' as const }}>
              📡 {user.nombre.split(' ')[0]}
            </button>
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#475569' }}>Salir</button>
          </div>
        ) : (
          <button onClick={() => { setShowAuth(true); setAuthMode('login') }}
            style={{ background: '#9ED23A', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, color: '#0A1628', cursor: 'pointer', whiteSpace: 'nowrap' as const, flexShrink: 0 }}>
            Entrar
          </button>
        )}
      </div>

      {/* ── GLOBAL FILTER BAR ── */}
      <div className="lf-filterbar" style={{ background: '#0F1F35', borderBottom: '1px solid #1E3A5F55', padding: '10px 24px' }}>

        {/* Monto presets */}
        <div className="lf-filterbar-presets" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.06em', whiteSpace: 'nowrap' as const }}>Monto</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {MONTO_PRESETS.map(p => {
              const active = activePreset?.label === p.label
              return (
                <button key={p.label} onClick={() => applyPreset(p)} style={{
                  padding: '4px 10px', borderRadius: 6, border: `1px solid ${active ? '#F59E0B' : '#1E3A5F'}`,
                  background: active ? '#F59E0B22' : 'transparent',
                  color: active ? '#F59E0B' : '#94A3B8', fontSize: 12, cursor: 'pointer', fontWeight: active ? 700 : 400,
                }}>
                  {p.label}
                </button>
              )
            })}
            <button onClick={() => setShowCustom(v => !v)} style={{
              padding: '4px 10px', borderRadius: 6, border: `1px solid ${showCustom ? '#F59E0B' : '#1E3A5F'}`,
              background: showCustom ? '#F59E0B22' : 'transparent',
              color: showCustom ? '#F59E0B' : '#94A3B8', fontSize: 12, cursor: 'pointer',
            }}>
              Rango
            </button>
          </div>
        </div>

        {/* Custom range inputs */}
        {showCustom && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input value={customMin} onChange={e => setCustomMin(e.target.value)} placeholder="Mín" type="number"
              style={{ width: 100, padding: '4px 8px', borderRadius: 6, border: '1px solid #1E3A5F', background: '#0A1628', color: '#E2E8F0', fontSize: 12, outline: 'none' }} />
            <span style={{ color: '#475569', fontSize: 12 }}>—</span>
            <input value={customMax} onChange={e => setCustomMax(e.target.value)} placeholder="Máx" type="number"
              style={{ width: 100, padding: '4px 8px', borderRadius: 6, border: '1px solid #1E3A5F', background: '#0A1628', color: '#E2E8F0', fontSize: 12, outline: 'none' }} />
            <button onClick={applyCustom} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: '#F59E0B', color: '#000', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
              Aplicar
            </button>
          </div>
        )}

        {/* Divisor */}
        <div className="lf-filterbar-divider" />

        {/* Estado */}
        <div className="lf-filterbar-estado" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.06em', whiteSpace: 'nowrap' as const }}>Estado</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { v: '', l: 'Todas' },
              { v: 'En recepción', l: 'En recepción' },
              { v: 'En análisis',  l: 'En análisis' },
              { v: 'Adjudicada',   l: 'Adjudicadas' },
              { v: 'Desierta',     l: 'Desiertas' },
            ].map(opt => {
              const active = gEstado === opt.v
              const color  = opt.v ? (ESTADO_COLORS[opt.v] ?? '#64748B') : '#64748B'
              return (
                <button key={opt.v} onClick={() => { setGEstado(opt.v); setPage(1) }} style={{
                  padding: '4px 10px', borderRadius: 6, border: `1px solid ${active ? color : '#1E3A5F'}`,
                  background: active ? color + '22' : 'transparent',
                  color: active ? color : '#94A3B8', fontSize: 12, cursor: 'pointer', fontWeight: active ? 700 : 400,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  {opt.v && <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />}
                  {opt.l}
                </button>
              )
            })}
          </div>
        </div>

        {/* Clear all */}
        {globalFiltered && (
          <button onClick={() => { setGMontoMin(0); setGMontoMax(0); setGEstado(''); setCustomMin(''); setCustomMax(''); setShowCustom(false); setPage(1) }}
            style={{ marginLeft: 'auto', fontSize: 11, color: '#F59E0B', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
            ✕ Limpiar filtros
          </button>
        )}

        {/* Active filter summary */}
        {globalFiltered && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600 }}>
              {gEstado && `${gEstado}s`}
              {gEstado && (gMontoMin || gMontoMax) && ' · '}
              {gMontoMin > 0 && `desde ${fmtMontoShort(gMontoMin)}`}
              {gMontoMin > 0 && gMontoMax > 0 && ' '}
              {gMontoMax > 0 && `hasta ${fmtMontoShort(gMontoMax)}`}
            </span>
          </div>
        )}
      </div>

      <div className="lf-page-inner" style={{ maxWidth: 1280, margin: '0 auto', padding: '18px 16px' }}>

        {/* Stats row */}
        <div className="lf-stats" style={{ marginBottom: 18 }}>
          <StatCard label="Total" value={dashLoading ? '…' : (stats?.total?.toLocaleString() ?? '—')} />
          <StatCard label="En recepción" value={dashLoading ? '…' : (stats?.en_recepcion?.toLocaleString() ?? '—')} color="#22C55E" sub="plazo abierto" />
          <StatCard label="En análisis" value={dashLoading ? '…' : (stats?.en_analisis?.toLocaleString() ?? '—')} color="#F59E0B" sub="plazo cerrado" />
          <StatCard label="Adjudicadas" value={dashLoading ? '…' : (stats?.adjudicadas?.toLocaleString() ?? '—')} color="#9ED23A" />
          <StatCard label="Desiertas" value={dashLoading ? '…' : (stats?.desiertas?.toLocaleString() ?? '—')} color="#94A3B8" />
          {Number(stats?.monto_total_crc) > 0 && (
            <StatCard label="Presupuesto CRC" value={dashLoading ? '…' : fmtMontoShort(Number(stats.monto_total_crc))} color="#F59E0B" sub="monto estimado" />
          )}
          {Number(stats?.monto_total_usd) > 0 && (
            <StatCard label="Presupuesto USD" value={dashLoading ? '…' : `$${(Number(stats.monto_total_usd) / 1_000_000).toFixed(1)}M`} color="#F59E0B" sub="monto estimado" />
          )}
        </div>

        {/* Tabs */}
        <div className="lf-tabs" style={{ marginBottom: 18 }}>
          {([
            { id: 'dashboard',     label: 'Dashboard' },
            { id: 'list',          label: 'Licitaciones' },
            { id: 'instituciones', label: 'Top Instituciones' },
            { id: 'oferentes',     label: 'Top Oferentes' },
            { id: 'categorias',    label: 'Por Categoría' },
            { id: 'radar',         label: '📡 Radar' },
          ] as { id: Section; label: string }[]).map(tab => (
            <button key={tab.id} onClick={() => setSection(tab.id)} style={{
              padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: 'transparent',
              color: section === tab.id ? '#9ED23A' : '#64748B',
              borderBottom: section === tab.id ? '2px solid #9ED23A' : '2px solid transparent',
              marginBottom: -1,
            }}>{tab.label}</button>
          ))}
        </div>

        {/* ══ DASHBOARD ══ */}
        {section === 'dashboard' && (
          <div>
            {dashLoading ? (
              <div style={{ textAlign: 'center' as const, padding: 60, color: '#64748B' }}>Cargando...</div>
            ) : (
              <>
                <div className="lf-dash-grid">
                  {/* Top Instituciones mini */}
                  <div style={{ background: '#0F1F35', border: '1px solid #1E3A5F', borderRadius: 12, padding: '18px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: 0 }}>Top Instituciones</p>
                      <button onClick={() => setSection('instituciones')} style={{ fontSize: 11, color: '#378ADD', background: 'none', border: 'none', cursor: 'pointer' }}>Ver todas →</button>
                    </div>
                    {(dash?.topInstituciones ?? []).slice(0, 6).map((item: any, i: number) => {
                      const maxT = dash?.topInstituciones?.[0]?.total ?? 1
                      return (
                        <div key={i} onClick={() => goToList({ inst: item.nombre })}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < 5 ? '1px solid #0A162833' : 'none', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                        >
                          <span style={{ fontSize: 11, color: '#334155', width: 18, fontWeight: 700, flexShrink: 0 }}>#{i + 1}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 12, color: '#E2E8F0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{item.nombre}</p>
                            <div style={{ height: 3, background: '#0A1628', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${(item.total / maxT) * 100}%`, background: '#378ADD', borderRadius: 2 }} />
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0' }}>{item.total.toLocaleString()}</span>
                            <span style={{ fontSize: 10, color: '#9ED23A', marginLeft: 6 }}>{item.adjudicadas} adj.</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Top Oferentes mini */}
                  <div style={{ background: '#0F1F35', border: '1px solid #1E3A5F', borderRadius: 12, padding: '18px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: 0 }}>Top Oferentes</p>
                      <button onClick={() => setSection('oferentes')} style={{ fontSize: 11, color: '#378ADD', background: 'none', border: 'none', cursor: 'pointer' }}>Ver todos →</button>
                    </div>
                    {(dash?.topOferentes ?? []).slice(0, 6).map((of: any, i: number) => {
                      const maxO = dash?.topOferentes?.[0]?.total_ofertas ?? 1
                      return (
                        <div key={i} onClick={() => goToList({ proveedor: of.cedula_proveedor, proveedorLabel: of.nombre })}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < 5 ? '1px solid #0A162833' : 'none', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                        >
                          <span style={{ fontSize: 11, color: '#334155', width: 18, fontWeight: 700, flexShrink: 0 }}>#{i + 1}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 12, color: '#E2E8F0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{of.nombre}</p>
                            <div style={{ height: 3, background: '#0A1628', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${(of.total_ofertas / maxO) * 100}%`, background: '#F59E0B', borderRadius: 2 }} />
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B' }}>{of.total_ofertas.toLocaleString()}</span>
                            <span style={{ fontSize: 10, color: '#64748B', marginLeft: 4 }}>ofertas</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Por categoría grid */}
                <div style={{ background: '#0F1F35', border: '1px solid #1E3A5F', borderRadius: 12, padding: '18px 20px' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: '0 0 14px' }}>Por Categoría</p>
                  <div className="lf-cat-grid">
                    {(dash?.porTipo ?? []).map((cat: any) => {
                      const total  = dash?.stats?.total ?? 1
                      const pct    = ((cat.total / total) * 100).toFixed(1)
                      const adjPct = cat.total > 0 ? Math.round((cat.adjudicadas / cat.total) * 100) : 0
                      const color  = TIPO_COLORS[cat.tipo_procedimiento] ?? '#64748B'
                      return (
                        <div key={cat.tipo_procedimiento} onClick={() => goToList({ tipo: cat.tipo_procedimiento })}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#0A1628', borderRadius: 8, cursor: 'pointer', border: '1px solid transparent' }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
                        >
                          <Badge label={`[${cat.tipo_procedimiento}]`} color={color} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 11, color: '#94A3B8', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{TIPO_LABELS[cat.tipo_procedimiento] ?? cat.tipo_procedimiento}</p>
                          </div>
                          <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0' }}>{cat.total.toLocaleString()}</span>
                            <span style={{ fontSize: 10, color: '#64748B', marginLeft: 4 }}>({pct}%)</span>
                            <span style={{ fontSize: 10, color: '#9ED23A', marginLeft: 6 }}>{adjPct}% adj.</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ LICITACIONES LIST ══ */}
        {section === 'list' && (
          <div className="lf-list-layout">
            {/* Mobile filter toggle */}
            <button className="lf-mobile-filter-toggle" onClick={() => setShowFilters(f => !f)}>
              {showFilters ? '✕ Cerrar filtros' : '⚙ Mostrar filtros'}
            </button>
            {/* Sidebar */}
            <div className={`lf-sidebar${showFilters ? ' lf-sidebar-open' : ''}`} style={{ flexShrink: 0 }}>

              {/* Active entity filter */}
              {(inst || proveedor) && (
                <div style={{ background: '#1E3A5F', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#9ED23A', margin: '0 0 4px', textTransform: 'uppercase' as const }}>
                    {inst ? 'Institución' : 'Oferente'}
                  </p>
                  <p style={{ fontSize: 12, color: '#E2E8F0', margin: '0 0 6px', lineHeight: 1.4 }}>{inst || proveedorLabel || proveedor}</p>
                  <button onClick={() => { setInst(''); setProveedor(''); setProveedorLabel(''); setPage(1) }}
                    style={{ fontSize: 11, color: '#F59E0B', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    ✕ Limpiar
                  </button>
                </div>
              )}

              {/* Sort */}
              <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: '0 0 6px' }}>Ordenar por</p>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 2, marginBottom: 18 }}>
                {([
                  { v: 'fecha_desc', l: 'Fecha (más reciente)' },
                  { v: 'monto_desc', l: 'Monto (mayor primero)' },
                  { v: 'monto_asc',  l: 'Monto (menor primero)' },
                ] as const).map(opt => (
                  <button key={opt.v} onClick={() => { setSort(opt.v); setPage(1) }} style={{
                    textAlign: 'left' as const, padding: '5px 10px', borderRadius: 6, border: 'none',
                    cursor: 'pointer', background: sort === opt.v ? '#1E3A5F' : 'transparent',
                    color: sort === opt.v ? '#9ED23A' : '#94A3B8', fontSize: 12,
                  }}>
                    {sort === opt.v ? '› ' : '  '}{opt.l}
                  </button>
                ))}
              </div>

              {/* Tipo */}
              <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: '0 0 6px' }}>Tipo</p>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 2 }}>
                {[{ v: '', l: 'Todos', n: null }, ...(data?.tipos ?? []).map((t: any) => ({ v: t.tipo_procedimiento, l: t.tipo_procedimiento, n: t.n }))].map(opt => (
                  <button key={opt.v} onClick={() => { setTipo(opt.v); setPage(1) }} style={{
                    textAlign: 'left' as const, padding: '5px 10px', borderRadius: 6, border: 'none',
                    cursor: 'pointer', background: tipo === opt.v ? '#1E3A5F' : 'transparent',
                    color: tipo === opt.v ? '#9ED23A' : '#94A3B8', fontSize: 11,
                  }}>
                    {opt.v
                      ? <><span style={{ color: TIPO_COLORS[opt.v] ?? '#64748B', fontWeight: 700 }}>[{opt.v}]</span> {TIPO_LABELS[opt.v] ?? opt.v} <span style={{ color: '#475569' }}>({opt.n})</span></>
                      : 'Todos'
                    }
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 16, padding: '12px 14px', background: '#0F1F35', borderRadius: 8, border: '1px solid #1E3A5F' }}>
                <p style={{ fontSize: 22, fontWeight: 800, color: '#9ED23A', margin: 0 }}>{data?.total?.toLocaleString() ?? '—'}</p>
                <p style={{ fontSize: 10, color: '#64748B', margin: '3px 0 0' }}>resultados</p>
              </div>
            </div>

            {/* List */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {loading ? (
                <div style={{ textAlign: 'center' as const, padding: 60, color: '#64748B' }}>Cargando...</div>
              ) : data?.rows?.length === 0 ? (
                <div style={{ textAlign: 'center' as const, padding: 60, color: '#64748B' }}>No se encontraron resultados</div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                    {(data?.rows ?? []).map((row: any) => (
                      <div key={row.id}
                        onClick={() => router.push(`/licitacion/${encodeURIComponent(row.numero_procedimiento)}`)}
                        style={{ background: '#0F1F35', border: '1px solid #1E3A5F', borderRadius: 10, padding: '14px 18px', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = '#378ADD')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = '#1E3A5F')}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const, marginBottom: 6 }}>
                              {row.tipo_procedimiento && (
                                <Badge label={`[${row.tipo_procedimiento}] ${TIPO_LABELS[row.tipo_procedimiento] ?? row.tipo_procedimiento}`} color={TIPO_COLORS[row.tipo_procedimiento] ?? '#64748B'} />
                              )}
                              <Badge label={row.estado ?? 'En análisis'} color={ESTADO_COLORS[row.estado] ?? '#F59E0B'} pulse={row.estado === 'En recepción'} />
                              <span style={{ fontSize: 10, color: '#334155', fontFamily: 'monospace' }}>{row.numero_procedimiento}</span>
                            </div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0', lineHeight: 1.5, margin: 0 }}>
                              {row.titulo?.slice(0, 200) ?? '—'}
                            </p>
                            <div style={{ marginTop: 7, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
                              {(row.nombre_institucion || row.institucion) && (
                                <span onClick={e => { e.stopPropagation(); goToList({ inst: row.nombre_institucion || row.institucion }) }}
                                  style={{ fontSize: 11, color: '#64748B', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: '#1E3A5F' }}>
                                  🏛 {row.nombre_institucion || row.institucion}
                                </span>
                              )}
                              {row.unidad_compra && row.unidad_compra !== 'UNICO' && (
                                <span style={{ fontSize: 11, color: '#475569' }}>· {row.unidad_compra}</span>
                              )}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                            {fmtMonto(row.monto_estimado, row.currency) && (
                              <p style={{ fontSize: 15, fontWeight: 800, color: '#9ED23A', margin: 0 }}>{fmtMonto(row.monto_estimado, row.currency)}</p>
                            )}
                            <p style={{ fontSize: 10, color: '#64748B', margin: '2px 0 0' }}>Pub. {fmtDate(row.fecha_publicacion) ?? '—'}</p>
                            {row.fecha_cierre && (
                              <p style={{ fontSize: 10, fontWeight: 600, color: '#F59E0B', margin: '2px 0 0' }}>Cierre {fmtDate(row.fecha_cierre)}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center' as const, alignItems: 'center', gap: 8, marginTop: 20 }}>
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #1E3A5F', background: 'transparent', color: page === 1 ? '#1E3A5F' : '#94A3B8', cursor: page === 1 ? 'default' : 'pointer', fontSize: 13 }}>
                        ‹ Anterior
                      </button>
                      <span style={{ color: '#64748B', fontSize: 12 }}>{page} / {totalPages}</span>
                      <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #1E3A5F', background: 'transparent', color: page === totalPages ? '#1E3A5F' : '#94A3B8', cursor: page === totalPages ? 'default' : 'pointer', fontSize: 13 }}>
                        Siguiente ›
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ══ TOP INSTITUCIONES ══ */}
        {section === 'instituciones' && (
          <div style={{ maxWidth: 820 }}>
            <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>Haz clic para ver las licitaciones de esa institución</p>
            {dashLoading ? <div style={{ padding: 60, textAlign: 'center' as const, color: '#64748B' }}>Cargando...</div> : (
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                {(dash?.topInstituciones ?? []).map((item: any, i: number) => {
                  const pct    = dash?.topInstituciones?.[0]?.total > 0 ? (item.total / dash.topInstituciones[0].total) * 100 : 0
                  const adjPct = item.total > 0 ? Math.round((item.adjudicadas / item.total) * 100) : 0
                  return (
                    <div key={i} onClick={() => goToList({ inst: item.nombre })}
                      style={{ background: '#0F1F35', border: '1px solid #1E3A5F', borderRadius: 10, padding: '14px 18px', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = '#378ADD')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = '#1E3A5F')}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: '#1E3A5F66', width: 28 }}>#{i + 1}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0' }}>{item.nombre}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 20, flexShrink: 0, textAlign: 'right' as const }}>
                          <div><p style={{ fontSize: 18, fontWeight: 800, color: '#E2E8F0', margin: 0 }}>{item.total.toLocaleString()}</p><p style={{ fontSize: 10, color: '#64748B', margin: 0 }}>total</p></div>
                          <div><p style={{ fontSize: 18, fontWeight: 800, color: '#9ED23A', margin: 0 }}>{item.adjudicadas.toLocaleString()}</p><p style={{ fontSize: 10, color: '#64748B', margin: 0 }}>adj.</p></div>
                          <div><p style={{ fontSize: 18, fontWeight: 800, color: '#378ADD', margin: 0 }}>{adjPct}%</p><p style={{ fontSize: 10, color: '#64748B', margin: 0 }}>tasa</p></div>
                        </div>
                      </div>
                      <div style={{ height: 4, background: '#0A1628', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: '#378ADD', borderRadius: 2 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ TOP OFERENTES ══ */}
        {section === 'oferentes' && (
          <div style={{ maxWidth: 820 }}>
            <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>Haz clic para ver las licitaciones donde ofertó</p>
            {dashLoading ? <div style={{ padding: 60, textAlign: 'center' as const, color: '#64748B' }}>Cargando...</div> : (
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                {(dash?.topOferentes ?? []).map((of: any, i: number) => {
                  const pct = dash?.topOferentes?.[0]?.total_ofertas > 0 ? (of.total_ofertas / dash.topOferentes[0].total_ofertas) * 100 : 0
                  return (
                    <div key={i} onClick={() => goToList({ proveedor: of.cedula_proveedor, proveedorLabel: of.nombre })}
                      style={{ background: '#0F1F35', border: '1px solid #1E3A5F', borderRadius: 10, padding: '14px 18px', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = '#F59E0B')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = '#1E3A5F')}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: '#1E3A5F66', width: 28 }}>#{i + 1}</span>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0', margin: 0 }}>{of.nombre}</p>
                            <p style={{ fontSize: 10, color: '#475569', margin: '2px 0 0', fontFamily: 'monospace' }}>{of.cedula_proveedor}</p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 20, flexShrink: 0, textAlign: 'right' as const }}>
                          <div><p style={{ fontSize: 18, fontWeight: 800, color: '#F59E0B', margin: 0 }}>{of.total_ofertas.toLocaleString()}</p><p style={{ fontSize: 10, color: '#64748B', margin: 0 }}>ofertas</p></div>
                          <div><p style={{ fontSize: 18, fontWeight: 800, color: '#E2E8F0', margin: 0 }}>{of.licitaciones.toLocaleString()}</p><p style={{ fontSize: 10, color: '#64748B', margin: 0 }}>licitaciones</p></div>
                        </div>
                      </div>
                      <div style={{ height: 4, background: '#0A1628', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: '#F59E0B', borderRadius: 2 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ CATEGORIAS ══ */}
        {section === 'categorias' && (
          <div style={{ maxWidth: 820 }}>
            <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>Haz clic en una categoría para ver sus licitaciones</p>
            {dashLoading ? <div style={{ padding: 60, textAlign: 'center' as const, color: '#64748B' }}>Cargando...</div> : (
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                {(dash?.porTipo ?? []).map((cat: any) => {
                  const total  = dash?.stats?.total ?? 1
                  const pct    = ((cat.total / total) * 100).toFixed(1)
                  const adjPct = cat.total > 0 ? Math.round((cat.adjudicadas / cat.total) * 100) : 0
                  const color  = TIPO_COLORS[cat.tipo_procedimiento] ?? '#64748B'
                  return (
                    <div key={cat.tipo_procedimiento} onClick={() => goToList({ tipo: cat.tipo_procedimiento })}
                      style={{ background: '#0F1F35', border: '1px solid #1E3A5F', borderRadius: 10, padding: '14px 18px', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = '#1E3A5F')}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Badge label={`[${cat.tipo_procedimiento}]`} color={color} />
                          <span style={{ fontSize: 13, color: '#E2E8F0' }}>{TIPO_LABELS[cat.tipo_procedimiento] ?? cat.tipo_procedimiento}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 20, flexShrink: 0, textAlign: 'right' as const }}>
                          <div><p style={{ fontSize: 18, fontWeight: 800, color: '#E2E8F0', margin: 0 }}>{cat.total.toLocaleString()}</p><p style={{ fontSize: 10, color: '#64748B', margin: 0 }}>total ({pct}%)</p></div>
                          <div><p style={{ fontSize: 18, fontWeight: 800, color: '#9ED23A', margin: 0 }}>{cat.adjudicadas.toLocaleString()}</p><p style={{ fontSize: 10, color: '#64748B', margin: 0 }}>adj. ({adjPct}%)</p></div>
                        </div>
                      </div>
                      <div style={{ height: 4, background: '#0A1628', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ RADAR ══ */}
        {section === 'radar' && (
          <div>
            {/* Light invite banner — only for anonymous users */}
            {!user && (
              <div style={{ background: '#9ED23A11', border: '1px solid #9ED23A33', borderRadius: 10, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' as const }}>
                <p style={{ fontSize: 13, color: '#9ED23A', margin: 0 }}>
                  💡 <strong>Tip:</strong> Creá una cuenta gratis para que tus palabras clave se guarden entre sesiones.
                </p>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => { setShowAuth(true); setAuthMode('registro') }}
                    style={{ background: '#9ED23A', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 700, color: '#0A1628', cursor: 'pointer' }}>
                    Registrarme
                  </button>
                  <button onClick={() => { setShowAuth(true); setAuthMode('login') }}
                    style={{ background: 'transparent', border: '1px solid #9ED23A44', borderRadius: 6, padding: '5px 14px', fontSize: 12, color: '#9ED23A', cursor: 'pointer' }}>
                    Ya tengo cuenta
                  </button>
                </div>
              </div>
            )}

            {/* Keyword input — available for everyone */}
            <div style={{ background: '#0F1F35', border: '1px solid #1E3A5F', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: '0 0 14px' }}>
                Palabras clave del Radar {user && <span style={{ color: '#475569', fontWeight: 400, textTransform: 'none' as const }}>— guardadas en tu cuenta</span>}
              </p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' as const }}>
                {radarKeywords.map(kw => (
                  <span key={kw} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#9ED23A22', color: '#9ED23A', border: '1px solid #9ED23A44', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>
                    {kw}
                    <button onClick={() => removeKeyword(kw)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ED23A', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                  </span>
                ))}
                {radarKeywords.length === 0 && (
                  <span style={{ fontSize: 13, color: '#475569' }}>Agregá palabras clave para empezar — ej: limpieza, software, vigilancia</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={radarInput}
                  onChange={e => setRadarInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addKeyword()}
                  placeholder="Ej: limpieza, seguridad, software..."
                  style={{ flex: 1, padding: '8px 14px', borderRadius: 8, border: '1px solid #1E3A5F', background: '#0A1628', color: '#E2E8F0', fontSize: 13, outline: 'none' }}
                />
                <button onClick={addKeyword}
                  style={{ background: '#9ED23A', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, color: '#0A1628', cursor: 'pointer' }}>
                  + Agregar
                </button>
              </div>
            </div>

            {/* Results */}
            {radarKeywords.length > 0 && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
                    {radarLoading ? 'Buscando...' : `${radarHits.length} licitaciones encontradas — activas o cerradas en los últimos 30 días`}
                  </p>
                </div>
                {!radarLoading && radarHits.map((row: any) => {
                  const estadoColor: Record<string, string> = { 'En recepción': '#22C55E', 'En análisis': '#F59E0B', 'Adjudicada': '#9ED23A', 'Desierta': '#94A3B8' }
                  const color = estadoColor[row.estado] ?? '#64748B'
                  return (
                    <div key={row.id} onClick={() => router.push(`/licitacion/${encodeURIComponent(row.numero_procedimiento)}`)}
                      style={{ background: '#0F1F35', border: '1px solid #1E3A5F', borderRadius: 10, padding: '14px 18px', marginBottom: 8, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 6 }}>
                            <Badge label={row.estado} color={color} pulse={row.estado === 'En recepción'} />
                            {row.tipo_procedimiento && <Badge label={row.tipo_procedimiento} color="#378ADD" />}
                          </div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0', margin: '0 0 4px', lineHeight: 1.4 }}>{row.titulo}</p>
                          <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>{row.nombre_institucion ?? row.institucion}</p>
                        </div>
                        <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                          {row.monto_estimado ? (
                            <p style={{ fontSize: 14, fontWeight: 700, color: '#9ED23A', margin: '0 0 4px' }}>
                              {fmtMonto(row.monto_estimado, row.currency)}
                            </p>
                          ) : null}
                          {row.fecha_cierre && (
                            <p style={{ fontSize: 11, color: '#64748B', margin: 0 }}>
                              Cierre: {fmtDate(row.fecha_cierre)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}

      </div>

      {/* ══ AUTH MODAL ══ */}
      {showAuth && (
        <div onClick={() => setShowAuth(false)} style={{ position: 'fixed', inset: 0, background: '#00000088', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0F1F35', border: '1px solid #1E3A5F', borderRadius: 14, padding: '32px 28px', width: '100%', maxWidth: 400 }}>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#E2E8F0', margin: '0 0 6px' }}>
              {authMode === 'login' ? 'Entrar' : 'Crear cuenta'}
            </p>
            <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 24px' }}>
              {authMode === 'login' ? 'Para acceder a tu RadarLicitario' : 'Gratis, solo para guardar tu Radar'}
            </p>
            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
              {authMode === 'registro' && (
                <>
                  <input value={authForm.nombre} onChange={e => setAuthForm(f => ({ ...f, nombre: e.target.value }))}
                    placeholder="Nombre completo" required
                    style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #1E3A5F', background: '#0A1628', color: '#E2E8F0', fontSize: 13, outline: 'none' }} />
                  <input value={authForm.empresa} onChange={e => setAuthForm(f => ({ ...f, empresa: e.target.value }))}
                    placeholder="Empresa (opcional)"
                    style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #1E3A5F', background: '#0A1628', color: '#E2E8F0', fontSize: 13, outline: 'none' }} />
                </>
              )}
              <input value={authForm.email} onChange={e => setAuthForm(f => ({ ...f, email: e.target.value }))}
                placeholder="Correo electrónico" type="email" required
                style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #1E3A5F', background: '#0A1628', color: '#E2E8F0', fontSize: 13, outline: 'none' }} />
              <input value={authForm.password} onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Contraseña (mín. 6 caracteres)" type="password" required
                style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #1E3A5F', background: '#0A1628', color: '#E2E8F0', fontSize: 13, outline: 'none' }} />
              {authError && <p style={{ fontSize: 12, color: '#F87171', margin: 0 }}>{authError}</p>}
              <button type="submit" disabled={authLoading}
                style={{ background: '#9ED23A', border: 'none', borderRadius: 8, padding: '11px', fontSize: 14, fontWeight: 700, color: '#0A1628', cursor: 'pointer', opacity: authLoading ? 0.7 : 1 }}>
                {authLoading ? 'Procesando...' : authMode === 'login' ? 'Entrar' : 'Crear cuenta'}
              </button>
            </form>
            <p style={{ fontSize: 12, color: '#64748B', textAlign: 'center' as const, margin: '16px 0 0' }}>
              {authMode === 'login' ? '¿No tenés cuenta? ' : '¿Ya tenés cuenta? '}
              <button onClick={() => { setAuthMode(authMode === 'login' ? 'registro' : 'login'); setAuthError('') }}
                style={{ background: 'none', border: 'none', color: '#9ED23A', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0 }}>
                {authMode === 'login' ? 'Registrate gratis' : 'Entrá aquí'}
              </button>
            </p>
          </div>
        </div>
      )}

    </div>
  )
}
