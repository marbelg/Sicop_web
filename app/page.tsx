'use client'
import { useState, useEffect, useCallback } from 'react'

const TIPO_LABELS: Record<string, string> = {
  LD: 'Licitación Directa',
  LP: 'Licitación Pública',
  LA: 'Licitación Abreviada',
  CD: 'Contratación Directa',
  LM: 'Licitación Menor',
  PE: 'Procedimiento Especial',
}

function fmtMonto(n: number | null, currency: string) {
  if (!n) return '—'
  return new Intl.NumberFormat('es-CR', {
    style: 'currency', currency: currency === 'USD' ? 'USD' : 'CRC',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
}

function fmtDate(s: string | null) {
  if (!s) return '—'
  const [y, m, d] = s.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function TipoBadge({ tipo }: { tipo: string }) {
  const colors: Record<string, string> = {
    LP: '#378ADD', LA: '#9ED23A', LD: '#F59E0B', CD: '#94A3B8', LM: '#A78BFA',
  }
  const color = colors[tipo] ?? '#64748B'
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
      background: color + '22', color, border: `1px solid ${color}44`,
      letterSpacing: '0.05em', textTransform: 'uppercase' as const,
    }}>
      {TIPO_LABELS[tipo] ?? tipo}
    </span>
  )
}

export default function Home() {
  const [q, setQ]             = useState('')
  const [tipo, setTipo]       = useState('')
  const [page, setPage]       = useState(1)
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ q, tipo, page: String(page) })
    const res = await fetch(`/api/licitaciones?${params}`)
    setData(await res.json())
    setLoading(false)
  }, [q, tipo, page])

  useEffect(() => { load() }, [load])

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0

  return (
    <div style={{ minHeight: '100vh', background: '#0A1628', color: '#E2E8F0', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#0F1F35', borderBottom: '1px solid #1E3A5F', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#9ED23A' }}>Licita</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#E2E8F0' }}>Fácil</span>
        </div>
        <div style={{ flex: 1, maxWidth: 500 }}>
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
        <a href="/import" style={{ fontSize: 13, color: '#64748B', textDecoration: 'none' }}>Importar datos</a>
      </div>

      <div style={{ display: 'flex', maxWidth: 1200, margin: '0 auto', padding: '24px 16px', gap: 24 }}>

        {/* Sidebar */}
        <div style={{ width: 210, flexShrink: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 10, marginTop: 0 }}>Tipo</p>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
            {[{ v: '', l: 'Todos' }, ...(data?.tipos ?? []).map((t: any) => ({
              v: t.tipo_procedimiento,
              l: `${TIPO_LABELS[t.tipo_procedimiento] ?? t.tipo_procedimiento} (${t.n})`
            }))].map(opt => (
              <button key={opt.v} onClick={() => { setTipo(opt.v); setPage(1) }} style={{
                textAlign: 'left' as const, padding: '7px 10px', borderRadius: 6, border: 'none',
                cursor: 'pointer', background: tipo === opt.v ? '#1E3A5F' : 'transparent',
                color: tipo === opt.v ? '#9ED23A' : '#94A3B8', fontSize: 13,
              }}>
                {opt.l}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 24, padding: '16px', background: '#0F1F35', borderRadius: 8, border: '1px solid #1E3A5F' }}>
            <p style={{ fontSize: 24, fontWeight: 800, color: '#9ED23A', margin: 0 }}>{data?.total?.toLocaleString() ?? '—'}</p>
            <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 0' }}>solicitudes en DB</p>
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
                  <div key={row.id}
                    style={{ background: '#0F1F35', border: '1px solid #1E3A5F', borderRadius: 10, padding: '16px 20px', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#378ADD')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#1E3A5F')}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' as const }}>
                          {row.tipo_procedimiento && <TipoBadge tipo={row.tipo_procedimiento} />}
                          <span style={{ fontSize: 11, color: '#475569' }}>{row.numero_procedimiento}</span>
                        </div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: '#E2E8F0', lineHeight: 1.5, margin: 0 }}>
                          {row.titulo?.slice(0, 200) ?? '—'}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                        <p style={{ fontSize: 15, fontWeight: 700, color: '#9ED23A', margin: 0 }}>
                          {fmtMonto(row.monto_estimado, row.currency)}
                        </p>
                        <p style={{ fontSize: 11, color: '#64748B', margin: '3px 0 0' }}>
                          {fmtDate(row.fecha_publicacion)}
                        </p>
                      </div>
                    </div>
                    {row.institucion && (
                      <p style={{ fontSize: 12, color: '#64748B', margin: '6px 0 0' }}>
                        🏛 {row.institucion}
                      </p>
                    )}
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
