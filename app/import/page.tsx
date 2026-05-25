'use client'
import { useState, useEffect } from 'react'

const DATASETS = [
  'solicitudes', 'carteles', 'ofertas', 'adjudicaciones_firme',
  'contratos', 'ordenes_pedido', 'instituciones', 'proveedores',
]

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '10px 8px', background: '#0A1628', borderRadius: 8 }}>
      <p style={{ fontSize: 20, fontWeight: 800, color, margin: 0 }}>{value.toLocaleString()}</p>
      <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0' }}>{label}</p>
    </div>
  )
}

export default function ImportPage() {
  const [loading, setLoading]   = useState(false)
  const [results, setResults]   = useState<any[] | null>(null)
  const [logs, setLogs]         = useState<any[]>([])
  const [range, setRange]       = useState('')
  const [from, setFrom]         = useState('')
  const [to, setTo]             = useState('')
  const [mode, setMode]         = useState<'full' | 'range'>('full')

  useEffect(() => { fetchLogs() }, [])

  async function fetchLogs() {
    const res = await fetch('/api/sync-logs')
    if (res.ok) setLogs(await res.json())
  }

  async function runSync() {
    setLoading(true)
    setResults(null)
    try {
      const body = mode === 'range' ? { from, to } : { full: true }
      const res  = await fetch('/api/trigger-sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      setResults(data.results ?? [])
      setRange(data.range ?? '')
      fetchLogs()
    } finally {
      setLoading(false)
    }
  }

  const canRun = mode === 'full' || (from.length === 8 && to.length === 8)

  return (
    <div style={{ minHeight: '100vh', background: '#0A1628', color: '#E2E8F0', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#0F1F35', borderBottom: '1px solid #1E3A5F', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <a href="/" style={{ color: '#64748B', textDecoration: 'none', fontSize: 13 }}>← Volver</a>
        <div>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#9ED23A' }}>Licita</span>
          <span style={{ fontSize: 18, fontWeight: 800 }}>Fácil</span>
        </div>
        <span style={{ fontSize: 14, color: '#64748B' }}>/ Sincronización SICOP</span>
      </div>

      <div style={{ maxWidth: 900, margin: '32px auto', padding: '0 24px' }}>

        {/* Sync controls */}
        <div style={{ background: '#0F1F35', border: '1px solid #1E3A5F', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <p style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>Sincronizar datos desde SICOP</p>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['full', 'range'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                padding: '7px 16px', borderRadius: 6, border: '1px solid #1E3A5F', cursor: 'pointer', fontSize: 13,
                background: mode === m ? '#1E3A5F' : 'transparent', color: mode === m ? '#9ED23A' : '#64748B',
              }}>
                {m === 'full' ? 'Último mes' : 'Rango específico'}
              </button>
            ))}
          </div>

          {mode === 'range' && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 11, color: '#64748B', margin: '0 0 4px' }}>Desde (DDMMAAAA)</p>
                <input value={from} onChange={e => setFrom(e.target.value)} placeholder="01042026"
                  style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #1E3A5F', background: '#0A1628', color: '#E2E8F0', fontSize: 14, width: 120 }} />
              </div>
              <div>
                <p style={{ fontSize: 11, color: '#64748B', margin: '0 0 4px' }}>Hasta (DDMMAAAA)</p>
                <input value={to} onChange={e => setTo(e.target.value)} placeholder="30042026"
                  style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #1E3A5F', background: '#0A1628', color: '#E2E8F0', fontSize: 14, width: 120 }} />
              </div>
            </div>
          )}

          <button onClick={runSync} disabled={loading || !canRun} style={{
            padding: '12px 32px', borderRadius: 8, border: 'none', cursor: loading || !canRun ? 'not-allowed' : 'pointer',
            background: loading || !canRun ? '#1E3A5F' : '#9ED23A', color: loading || !canRun ? '#64748B' : '#0A1628',
            fontWeight: 700, fontSize: 14,
          }}>
            {loading ? 'Sincronizando...' : 'Sincronizar ahora'}
          </button>
          {loading && <p style={{ fontSize: 12, color: '#64748B', marginTop: 8 }}>Esto puede tardar 1-2 minutos...</p>}
        </div>

        {/* Results */}
        {results && (
          <div style={{ background: '#0F1F35', border: '1px solid #1E3A5F', borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#9ED23A', margin: '0 0 16px' }}>
              Resultado — rango {range}
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1E3A5F' }}>
                  {['Dataset', 'Total SICOP', 'Nuevos', 'Actualizados', 'Omitidos', 'Estado'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left' as const, color: '#64748B', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r: any) => (
                  <tr key={r.dataset} style={{ borderBottom: '1px solid #0A1628' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{r.dataset}</td>
                    <td style={{ padding: '10px 12px', color: '#94A3B8' }}>{r.total?.toLocaleString() ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#9ED23A' }}>{r.inserted?.toLocaleString() ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#378ADD' }}>{r.updated?.toLocaleString() ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#64748B' }}>{r.skipped?.toLocaleString() ?? '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {r.error
                        ? <span style={{ color: '#F87171', fontSize: 11 }}>❌ {r.error.slice(0, 50)}</span>
                        : r.firstError
                          ? <span style={{ color: '#F59E0B', fontSize: 11 }}>⚠ {r.firstError.slice(0, 50)}</span>
                          : <span style={{ color: '#9ED23A', fontSize: 11 }}>✓ OK</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Sync history */}
        {logs.length > 0 && (
          <div style={{ background: '#0F1F35', border: '1px solid #1E3A5F', borderRadius: 12, padding: 24 }}>
            <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px' }}>Historial de sincronizaciones</p>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1E3A5F' }}>
                  {['Fecha', 'Dataset', 'Nuevos', 'Actualizados', 'Omitidos'].map(h => (
                    <th key={h} style={{ padding: '6px 12px', textAlign: 'left' as const, color: '#64748B' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((l: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid #0A162855' }}>
                    <td style={{ padding: '8px 12px', color: '#64748B' }}>{new Date(l.created_at).toLocaleString('es-CR')}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{l.dataset}</td>
                    <td style={{ padding: '8px 12px', color: '#9ED23A' }}>{l.rows_inserted?.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', color: '#378ADD' }}>{l.rows_updated?.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', color: '#64748B' }}>{l.rows_skipped?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
