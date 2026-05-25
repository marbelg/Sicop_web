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

function fmtMonto(n: number | null, currency: string) {
  if (!n) return null
  return new Intl.NumberFormat('es-CR', {
    style: 'currency', currency: currency === 'USD' ? 'USD' : 'CRC',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
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

export default function Home() {
  const router = useRouter()
  const [q, setQ]             = useState('')
  const [tipo, setTipo]       = useState('')
  const [estado, setEstado]   = useState('')
  const [page, setPage]       = useState(1)
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ q, tipo, estado, page: String(page) })
    const res = await fetch(`/api/licitaciones?${params}`)
    setData(await res.json())
    setLoading(false)
  }, [q, tipo, estado, page])

  useEffect(() => { load() }, [load])

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0

  return (
    <div style={{ minHeight: '100vh', background: '#0A1628', color: '#E2E8F0', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#0F1F35', borderBottom: '1px solid #1E3A5F', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#9ED23A' }}>Licita</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#E2E8F0' }}>Fácil</span>
        </div>
        <div style={{ flex: 1, maxWidth: 520 }}>
          <input
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1) }}
            placeholder="Buscar licitaciones..."
            style={{
              width: '100%', padding: '8px 14px', borderRadius: 8,
              border: '1px solid #1E3A5F', background: '#0A1628',
              color: '#E2E8F0', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const,
            }}
          />
        </div>
        <a href="/import" style={{ fontSize: 13, color: '#64748B', textDecoration: 'none' }}>⟳ Sincronizar</a>
      </div>

      <div style={{ display: 'flex', maxWidth: 1200, margin: '0 auto', padding: '24px 16px', gap: 24 }}>

        {/* Sidebar */}
        <div style={{ width: 220, flexShrink: 0 }}>

          {/* Estado filter */}
          <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 8, marginTop: 0 }}>Estado</p>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 3, marginBottom: 20 }}>
            {[
              { v: '', l: 'Todos' },
              { v: 'Activa', l: 'Activa' },
              { v: 'Adjudicada', l: 'Adjudicada' },
              { v: 'Desierta', l: 'Desierta' },
            ].map(opt => (
              <button key={opt.v} onClick={() => { setEstado(opt.v); setPage(1) }} style={{
                textAlign: 'left' as const, padding: '6px 10px', borderRadius: 6, border: 'none',
                cursor: 'pointer', background: estado === opt.v ? '#1E3A5F' : 'transparent',
                color: estado === opt.v ? '#9ED23A' : '#94A3B8', fontSize: 13,
              }}>
                {opt.v && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: ESTADO_COLORS[opt.v] ?? '#64748B', marginRight: 6 }} />}
                {opt.l}
              </button>
            ))}
          </div>

          {/* Tipo filter */}
          <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 8, marginTop: 0 }}>Tipo</p>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 3 }}>
            {[{ v: '', l: 'Todos', n: null }, ...(data?.tipos ?? []).map((t: any) => ({
              v: t.tipo_procedimiento,
              l: t.tipo_procedimiento,
              n: t.n,
            }))].map(opt => (
              <button key={opt.v} onClick={() => { setTipo(opt.v); setPage(1) }} style={{
                textAlign: 'left' as const, padding: '6px 10px', borderRadius: 6, border: 'none',
                cursor: 'pointer', background: tipo === opt.v ? '#1E3A5F' : 'transparent',
                color: tipo === opt.v ? '#9ED23A' : '#94A3B8', fontSize: 12,
              }}>
                {opt.v
                  ? `[${opt.v}] ${TIPO_LABELS[opt.v] ?? opt.v} (${opt.n})`
                  : 'Todos'
                }
              </button>
            ))}
          </div>

          <div style={{ marginTop: 20, padding: '14px 16px', background: '#0F1F35', borderRadius: 8, border: '1px solid #1E3A5F' }}>
            <p style={{ fontSize: 26, fontWeight: 800, color: '#9ED23A', margin: 0 }}>{data?.total?.toLocaleString() ?? '—'}</p>
            <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 0' }}>licitaciones</p>
          </div>
        </div>

        {/* Main list */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center' as const, padding: 60, color: '#64748B' }}>Cargando...</div>
          ) : data?.rows?.length === 0 ? (
            <div style={{ textAlign: 'center' as const, padding: 60, color: '#64748B' }}>No se encontraron resultados</div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                {(data?.rows ?? []).map((row: any) => (
                  <div
                    key={row.id}
                    onClick={() => router.push(`/licitacion/${encodeURIComponent(row.numero_procedimiento)}`)}
                    style={{ background: '#0F1F35', border: '1px solid #1E3A5F', borderRadius: 10, padding: '16px 20px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#378ADD')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#1E3A5F')}
                  >
                    {/* Top row: badges + monto */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const, marginBottom: 8 }}>
                          {row.tipo_procedimiento && (
                            <Badge
                              label={`[${row.tipo_procedimiento}] ${TIPO_LABELS[row.tipo_procedimiento] ?? row.tipo_procedimiento}`}
                              color={TIPO_COLORS[row.tipo_procedimiento] ?? '#64748B'}
                            />
                          )}
                          <Badge label={row.estado ?? 'Activa'} color={ESTADO_COLORS[row.estado] ?? '#378ADD'} />
                          <span style={{ fontSize: 11, color: '#334155', fontFamily: 'monospace' }}>{row.numero_procedimiento}</span>
                        </div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: '#E2E8F0', lineHeight: 1.5, margin: 0 }}>
                          {row.titulo?.slice(0, 180) ?? '—'}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                        {fmtMonto(row.monto_estimado, row.currency) && (
                          <p style={{ fontSize: 16, fontWeight: 800, color: '#9ED23A', margin: 0 }}>
                            {fmtMonto(row.monto_estimado, row.currency)}
                          </p>
                        )}
                        <p style={{ fontSize: 11, color: '#64748B', margin: '3px 0 0' }}>
                          Pub. {fmtDate(row.fecha_publicacion) ?? '—'}
                        </p>
                        {row.fecha_cierre && (
                          <p style={{ fontSize: 11, fontWeight: 600, color: '#F59E0B', margin: '2px 0 0' }}>
                            Cierre {fmtDate(row.fecha_cierre)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bottom: institución */}
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
                      {(row.nombre_institucion || row.institucion) && (
                        <span style={{ fontSize: 12, color: '#64748B' }}>
                          🏛 {row.nombre_institucion || row.institucion}
                        </span>
                      )}
                      {row.unidad_compra && row.unidad_compra !== 'UNICO' && (
                        <span style={{ fontSize: 12, color: '#475569' }}>· {row.unidad_compra}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center' as const, alignItems: 'center', gap: 8, marginTop: 24 }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #1E3A5F', background: 'transparent', color: page === 1 ? '#1E3A5F' : '#94A3B8', cursor: page === 1 ? 'default' : 'pointer' }}>
                    ‹ Anterior
                  </button>
                  <span style={{ padding: '8px 12px', color: '#64748B', fontSize: 13 }}>{page} / {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #1E3A5F', background: 'transparent', color: page === totalPages ? '#1E3A5F' : '#94A3B8', cursor: page === totalPages ? 'default' : 'pointer' }}>
                    Siguiente ›
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
