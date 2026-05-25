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
}

const TIPO_COLORS: Record<string, string> = {
  LP: '#378ADD', LN: '#378ADD', LI: '#378ADD',
  LA: '#9ED23A', LE: '#9ED23A', LY: '#9ED23A', LD: '#9ED23A',
  CD: '#F59E0B', CE: '#F59E0B',
  PX: '#A78BFA', PP: '#A78BFA', PE: '#A78BFA',
  SE: '#F472B6',
}

const ESTADO_COLORS: Record<string, string> = {
  Adjudicada: '#9ED23A', Desierta: '#94A3B8', Activa: '#378ADD',
}

function fmtMonto(n: number | null | undefined, currency?: string) {
  if (!n) return null
  return new Intl.NumberFormat('es-CR', {
    style: 'currency', currency: currency === 'USD' ? 'USD' : 'CRC',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
}

function fmtMontoShort(n: number) {
  if (n >= 1_000_000_000) return `₡${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `₡${(n / 1_000_000).toFixed(0)}M`
  return `₡${n.toLocaleString('es-CR')}`
}

function fmtDate(s: string | null) {
  if (!s) return null
  const [y, m, d] = s.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
      background: color + '22', color, border: `1px solid ${color}44`,
      letterSpacing: '0.04em', whiteSpace: 'nowrap' as const,
    }}>{label}</span>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: '#0F1F35', border: '1px solid #1E3A5F', borderRadius: 10, padding: '16px 20px', flex: 1 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: '0 0 8px' }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 800, color: color ?? '#E2E8F0', margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#475569', margin: '4px 0 0' }}>{sub}</p>}
    </div>
  )
}

export default function Home() {
  const router = useRouter()

  // Dashboard data
  const [dash, setDash] = useState<any>(null)

  // List filters
  const [q, setQ]             = useState('')
  const [tipo, setTipo]       = useState('')
  const [estado, setEstado]   = useState('')
  const [montoMin, setMontoMin] = useState('')
  const [montoMax, setMontoMax] = useState('')
  const [page, setPage]       = useState(1)
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Active section: 'list' | 'instituciones' | 'oferentes' | 'categorias'
  const [section, setSection] = useState<'list' | 'instituciones' | 'oferentes' | 'categorias'>('list')

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(setDash)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ q, tipo, estado, page: String(page) })
    if (montoMin) params.set('montoMin', montoMin)
    if (montoMax) params.set('montoMax', montoMax)
    const res = await fetch(`/api/licitaciones?${params}`)
    setData(await res.json())
    setLoading(false)
  }, [q, tipo, estado, montoMin, montoMax, page])

  useEffect(() => { load() }, [load])

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0
  const stats = dash?.stats

  return (
    <div style={{ minHeight: '100vh', background: '#0A1628', color: '#E2E8F0', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#0F1F35', borderBottom: '1px solid #1E3A5F', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#9ED23A' }}>Licita</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#E2E8F0' }}>Fácil</span>
        </div>
        <div style={{ flex: 1, maxWidth: 480 }}>
          <input
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1); setSection('list') }}
            placeholder="Buscar licitaciones por título, número o descripción..."
            style={{
              width: '100%', padding: '7px 14px', borderRadius: 8,
              border: '1px solid #1E3A5F', background: '#0A1628',
              color: '#E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const,
            }}
          />
        </div>
        <a href="/import" style={{ fontSize: 12, color: '#64748B', textDecoration: 'none', whiteSpace: 'nowrap' as const }}>⟳ Sincronizar</a>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 16px' }}>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' as const }}>
          <StatCard label="Total licitaciones" value={(stats?.total ?? '—').toLocaleString?.()} color="#E2E8F0" />
          <StatCard label="Activas" value={(stats?.activas ?? '—').toLocaleString?.()} color="#378ADD" />
          <StatCard label="Adjudicadas" value={(stats?.adjudicadas ?? '—').toLocaleString?.()} color="#9ED23A" />
          <StatCard label="Desiertas" value={(stats?.desiertas ?? '—').toLocaleString?.()} color="#94A3B8" />
          {stats?.monto_total_crc > 0 && (
            <StatCard label="Presupuesto CRC" value={fmtMontoShort(Number(stats.monto_total_crc))} color="#F59E0B" sub="monto estimado total" />
          )}
          {stats?.monto_total_usd > 0 && (
            <StatCard label="Presupuesto USD" value={`$${(Number(stats.monto_total_usd) / 1_000_000).toFixed(1)}M`} color="#F59E0B" sub="monto estimado total" />
          )}
        </div>

        {/* Section tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #1E3A5F', paddingBottom: 0 }}>
          {([
            { id: 'list', label: 'Licitaciones' },
            { id: 'instituciones', label: 'Top Instituciones' },
            { id: 'oferentes', label: 'Top Oferentes' },
            { id: 'categorias', label: 'Por Categoría' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setSection(tab.id)}
              style={{
                padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: 'transparent',
                color: section === tab.id ? '#9ED23A' : '#64748B',
                borderBottom: section === tab.id ? '2px solid #9ED23A' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* SECTION: Licitaciones list */}
        {section === 'list' && (
          <div style={{ display: 'flex', gap: 20 }}>

            {/* Sidebar filters */}
            <div style={{ width: 210, flexShrink: 0 }}>

              {/* Estado */}
              <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: '0 0 6px' }}>Estado</p>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 2, marginBottom: 18 }}>
                {[
                  { v: '', l: 'Todos' },
                  { v: 'Activa', l: 'Activa' },
                  { v: 'Adjudicada', l: 'Adjudicada' },
                  { v: 'Desierta', l: 'Desierta' },
                ].map(opt => (
                  <button key={opt.v} onClick={() => { setEstado(opt.v); setPage(1) }} style={{
                    textAlign: 'left' as const, padding: '5px 10px', borderRadius: 6, border: 'none',
                    cursor: 'pointer', background: estado === opt.v ? '#1E3A5F' : 'transparent',
                    color: estado === opt.v ? '#9ED23A' : '#94A3B8', fontSize: 13,
                  }}>
                    {opt.v && <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: ESTADO_COLORS[opt.v] ?? '#64748B', marginRight: 6 }} />}
                    {opt.l}
                  </button>
                ))}
              </div>

              {/* Monto filter */}
              <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: '0 0 6px' }}>Monto (CRC)</p>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, marginBottom: 18 }}>
                <input
                  value={montoMin}
                  onChange={e => { setMontoMin(e.target.value); setPage(1) }}
                  placeholder="Mínimo"
                  type="number"
                  style={{
                    padding: '6px 10px', borderRadius: 6, border: '1px solid #1E3A5F',
                    background: '#0A1628', color: '#E2E8F0', fontSize: 12, width: '100%',
                    boxSizing: 'border-box' as const, outline: 'none',
                  }}
                />
                <input
                  value={montoMax}
                  onChange={e => { setMontoMax(e.target.value); setPage(1) }}
                  placeholder="Máximo"
                  type="number"
                  style={{
                    padding: '6px 10px', borderRadius: 6, border: '1px solid #1E3A5F',
                    background: '#0A1628', color: '#E2E8F0', fontSize: 12, width: '100%',
                    boxSizing: 'border-box' as const, outline: 'none',
                  }}
                />
                {(montoMin || montoMax) && (
                  <button onClick={() => { setMontoMin(''); setMontoMax(''); setPage(1) }} style={{
                    fontSize: 11, color: '#F59E0B', background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left' as const, padding: '2px 0',
                  }}>✕ Limpiar filtro</button>
                )}
              </div>

              {/* Tipo */}
              <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: '0 0 6px' }}>Tipo</p>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 2 }}>
                {[{ v: '', l: 'Todos', n: null }, ...(data?.tipos ?? []).map((t: any) => ({
                  v: t.tipo_procedimiento, l: t.tipo_procedimiento, n: t.n,
                }))].map(opt => (
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

              <div style={{ marginTop: 18, padding: '12px 14px', background: '#0F1F35', borderRadius: 8, border: '1px solid #1E3A5F' }}>
                <p style={{ fontSize: 24, fontWeight: 800, color: '#9ED23A', margin: 0 }}>{data?.total?.toLocaleString() ?? '—'}</p>
                <p style={{ fontSize: 11, color: '#64748B', margin: '3px 0 0' }}>resultados</p>
              </div>
            </div>

            {/* Licitaciones list */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {loading ? (
                <div style={{ textAlign: 'center' as const, padding: 60, color: '#64748B' }}>Cargando...</div>
              ) : data?.rows?.length === 0 ? (
                <div style={{ textAlign: 'center' as const, padding: 60, color: '#64748B' }}>No se encontraron resultados</div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                    {(data?.rows ?? []).map((row: any) => (
                      <div
                        key={row.id}
                        onClick={() => router.push(`/licitacion/${encodeURIComponent(row.numero_procedimiento)}`)}
                        style={{ background: '#0F1F35', border: '1px solid #1E3A5F', borderRadius: 10, padding: '14px 18px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = '#378ADD')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = '#1E3A5F')}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const, marginBottom: 6 }}>
                              {row.tipo_procedimiento && (
                                <Badge
                                  label={`[${row.tipo_procedimiento}] ${TIPO_LABELS[row.tipo_procedimiento] ?? row.tipo_procedimiento}`}
                                  color={TIPO_COLORS[row.tipo_procedimiento] ?? '#64748B'}
                                />
                              )}
                              <Badge label={row.estado ?? 'Activa'} color={ESTADO_COLORS[row.estado] ?? '#378ADD'} />
                              <span style={{ fontSize: 10, color: '#334155', fontFamily: 'monospace' }}>{row.numero_procedimiento}</span>
                            </div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0', lineHeight: 1.5, margin: 0 }}>
                              {row.titulo?.slice(0, 200) ?? '—'}
                            </p>
                            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
                              {(row.nombre_institucion || row.institucion) && (
                                <span style={{ fontSize: 11, color: '#64748B' }}>
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
                              <p style={{ fontSize: 15, fontWeight: 800, color: '#9ED23A', margin: 0 }}>
                                {fmtMonto(row.monto_estimado, row.currency)}
                              </p>
                            )}
                            <p style={{ fontSize: 10, color: '#64748B', margin: '2px 0 0' }}>
                              Pub. {fmtDate(row.fecha_publicacion) ?? '—'}
                            </p>
                            {row.fecha_cierre && (
                              <p style={{ fontSize: 10, fontWeight: 600, color: '#F59E0B', margin: '2px 0 0' }}>
                                Cierre {fmtDate(row.fecha_cierre)}
                              </p>
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
                      <span style={{ padding: '7px 12px', color: '#64748B', fontSize: 12 }}>{page} / {totalPages}</span>
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

        {/* SECTION: Top Instituciones */}
        {section === 'instituciones' && (
          <div style={{ maxWidth: 780 }}>
            <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>
              Instituciones con mayor número de licitaciones publicadas
            </p>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
              {(dash?.topInstituciones ?? []).map((inst: any, i: number) => {
                const pct = dash?.topInstituciones?.[0]?.total > 0
                  ? (inst.total / dash.topInstituciones[0].total) * 100
                  : 0
                const adjPct = inst.total > 0 ? Math.round((inst.adjudicadas / inst.total) * 100) : 0
                return (
                  <div key={i} style={{ background: '#0F1F35', border: '1px solid #1E3A5F', borderRadius: 10, padding: '14px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: '#1E3A5F', width: 28, flexShrink: 0 }}>#{i + 1}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0' }}>{inst.nombre}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 16, flexShrink: 0, textAlign: 'right' as const }}>
                        <div>
                          <p style={{ fontSize: 18, fontWeight: 800, color: '#E2E8F0', margin: 0 }}>{inst.total.toLocaleString()}</p>
                          <p style={{ fontSize: 10, color: '#64748B', margin: 0 }}>total</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 18, fontWeight: 800, color: '#9ED23A', margin: 0 }}>{inst.adjudicadas.toLocaleString()}</p>
                          <p style={{ fontSize: 10, color: '#64748B', margin: 0 }}>adjudicadas</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 18, fontWeight: 800, color: '#378ADD', margin: 0 }}>{adjPct}%</p>
                          <p style={{ fontSize: 10, color: '#64748B', margin: 0 }}>tasa adj.</p>
                        </div>
                      </div>
                    </div>
                    <div style={{ height: 4, background: '#0A1628', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: '#378ADD', borderRadius: 2 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* SECTION: Top Oferentes */}
        {section === 'oferentes' && (
          <div style={{ maxWidth: 780 }}>
            <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>
              Proveedores con mayor número de ofertas presentadas
            </p>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
              {(dash?.topOferentes ?? []).map((of: any, i: number) => {
                const pct = dash?.topOferentes?.[0]?.total_ofertas > 0
                  ? (of.total_ofertas / dash.topOferentes[0].total_ofertas) * 100
                  : 0
                return (
                  <div key={i} style={{ background: '#0F1F35', border: '1px solid #1E3A5F', borderRadius: 10, padding: '14px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: '#1E3A5F', width: 28, flexShrink: 0 }}>#{i + 1}</span>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0', margin: 0 }}>{of.nombre}</p>
                          <p style={{ fontSize: 10, color: '#475569', margin: '2px 0 0', fontFamily: 'monospace' }}>{of.cedula_proveedor}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 16, flexShrink: 0, textAlign: 'right' as const }}>
                        <div>
                          <p style={{ fontSize: 18, fontWeight: 800, color: '#F59E0B', margin: 0 }}>{of.total_ofertas.toLocaleString()}</p>
                          <p style={{ fontSize: 10, color: '#64748B', margin: 0 }}>ofertas</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 18, fontWeight: 800, color: '#E2E8F0', margin: 0 }}>{of.licitaciones.toLocaleString()}</p>
                          <p style={{ fontSize: 10, color: '#64748B', margin: 0 }}>licitaciones</p>
                        </div>
                      </div>
                    </div>
                    <div style={{ height: 4, background: '#0A1628', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: '#F59E0B', borderRadius: 2 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* SECTION: Categorías */}
        {section === 'categorias' && (
          <div style={{ maxWidth: 780 }}>
            <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>
              Distribución de licitaciones por tipo de procedimiento
            </p>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
              {(dash?.porTipo ?? []).map((cat: any, i: number) => {
                const total = dash?.stats?.total ?? 1
                const pct = Math.round((cat.total / total) * 100 * 10) / 10
                const adjPct = cat.total > 0 ? Math.round((cat.adjudicadas / cat.total) * 100) : 0
                const color = TIPO_COLORS[cat.tipo_procedimiento] ?? '#64748B'
                return (
                  <div
                    key={i}
                    style={{ background: '#0F1F35', border: '1px solid #1E3A5F', borderRadius: 10, padding: '14px 18px', cursor: 'pointer' }}
                    onClick={() => { setTipo(cat.tipo_procedimiento); setSection('list'); setPage(1) }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#1E3A5F')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Badge label={`[${cat.tipo_procedimiento}]`} color={color} />
                        <span style={{ fontSize: 13, color: '#E2E8F0' }}>{TIPO_LABELS[cat.tipo_procedimiento] ?? cat.tipo_procedimiento}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 16, flexShrink: 0, textAlign: 'right' as const }}>
                        <div>
                          <p style={{ fontSize: 18, fontWeight: 800, color: '#E2E8F0', margin: 0 }}>{cat.total.toLocaleString()}</p>
                          <p style={{ fontSize: 10, color: '#64748B', margin: 0 }}>total ({pct}%)</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 18, fontWeight: 800, color: '#9ED23A', margin: 0 }}>{cat.adjudicadas.toLocaleString()}</p>
                          <p style={{ fontSize: 10, color: '#64748B', margin: 0 }}>adj. ({adjPct}%)</p>
                        </div>
                      </div>
                    </div>
                    <div style={{ height: 4, background: '#0A1628', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
