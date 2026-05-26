'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

const TIPO_LABELS: Record<string, string> = {
  CD: 'Contratación Directa',       CE: 'Contratación Especial',
  LA: 'Licitación Abreviada',       LD: 'Licitación Reducida',
  LE: 'Licitación Menor',           LI: 'Licitación Pública Internacional',
  LN: 'Licitación Pública Nacional',LY: 'Licitación Mayor',
  LP: 'Licitación Pública',         PE: 'Procedimientos Especiales',
  PP: 'Procedimiento por Principio',PX: 'Procedimiento por Excepción',
  SE: 'Subasta Inversa Electrónica',
  RE: 'Remate',
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

function fmtDateTime(s: string | null) {
  if (!s) return '—'
  const [y, m, d] = s.slice(0, 10).split('-')
  const time = s.slice(11, 16)
  return time && time !== '00:00' ? `${d}/${m}/${y} ${time}` : `${d}/${m}/${y}`
}

function Badge({ label, color, pulse }: { label: string; color: string; pulse?: boolean }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 4,
      background: color + '22', color, border: `1px solid ${color}44`,
      letterSpacing: '0.04em', display: 'inline-flex', alignItems: 'center', gap: 5,
    }}>
      {pulse && <span className="lf-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />}
      {label}
    </span>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #1E3A5F22' }}>
      <span style={{ fontSize: 12, color: '#64748B', width: 160, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#E2E8F0' }}>{value || '—'}</span>
    </div>
  )
}

export default function DetallePage() {
  const { numero } = useParams<{ numero: string }>()
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/licitaciones/${encodeURIComponent(numero)}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [numero])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0A1628', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}>
      Cargando...
    </div>
  )
  if (!data || data.error) return (
    <div style={{ minHeight: '100vh', background: '#0A1628', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}>
      No encontrado
    </div>
  )

  const estadoColor: Record<string, string> = {
    'En recepción': '#22C55E',
    'En análisis':  '#F59E0B',
    'Adjudicada':   '#9ED23A',
    'Desierta':     '#94A3B8',
  }

  // Compute real estado from dates if not already set
  const estadoReal = (() => {
    if (data.estado === 'Adjudicada' || data.estado === 'Desierta') return data.estado
    const cierre = data.fecha_cierre ? new Date(data.fecha_cierre) : null
    return cierre && cierre > new Date() ? 'En recepción' : 'En análisis'
  })()

  return (
    <div style={{ minHeight: '100vh', background: '#0A1628', color: '#E2E8F0', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#0F1F35', borderBottom: '1px solid #1E3A5F', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 13 }}>
          ← Volver
        </button>
        <div>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#9ED23A' }}>Licita</span>
          <span style={{ fontSize: 18, fontWeight: 800 }}>Fácil</span>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '32px auto', padding: '0 24px' }}>

        {/* Title card */}
        <div style={{ background: '#0F1F35', border: '1px solid #1E3A5F', borderRadius: 12, padding: '24px 28px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 12 }}>
                {data.tipo_procedimiento && (
                  <Badge label={`[${data.tipo_procedimiento}] ${TIPO_LABELS[data.tipo_procedimiento] ?? data.tipo_procedimiento}`} color="#378ADD" />
                )}
                <Badge label={estadoReal} color={estadoColor[estadoReal] ?? '#64748B'} pulse={estadoReal === 'En recepción'} />
                {data.nro_sicop && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 4,
                    background: '#9ED23A22', color: '#9ED23A', border: '1px solid #9ED23A44',
                    letterSpacing: '0.04em', fontFamily: 'monospace',
                  }}>
                    SICOP #{data.nro_sicop}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 11, color: '#475569', margin: '0 0 8px', fontFamily: 'monospace' }}>
                {data.numero_procedimiento}
              </p>
              <p style={{ fontSize: 17, fontWeight: 700, color: '#E2E8F0', lineHeight: 1.5, margin: 0 }}>
                {data.titulo ?? '—'}
              </p>
            </div>
            <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#9ED23A', margin: 0 }}>
                {fmtMonto(data.monto_estimado, data.currency)}
              </p>
            </div>
          </div>
        </div>

        <div className="lf-detail-grid">

          {/* Institución */}
          <div style={{ background: '#0F1F35', border: '1px solid #1E3A5F', borderRadius: 12, padding: '20px 24px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: '0 0 14px' }}>
              Institución
            </p>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#E2E8F0', margin: '0 0 12px', lineHeight: 1.4 }}>
              🏛 {data.nombre_institucion ?? data.institucion ?? '—'}
            </p>
            {data.unidad_compra && data.unidad_compra !== 'UNICO' && (
              <Row label="Departamento" value={data.unidad_compra} />
            )}
            {data.representante && <Row label="Representante" value={data.representante} />}
            {data.telefono && (
              <Row label="Teléfono" value={
                <a href={`tel:${data.telefono}`} style={{ color: '#378ADD', textDecoration: 'none' }}>
                  📞 {data.telefono}
                </a>
              } />
            )}
            {data.direccion && <Row label="Dirección" value={data.direccion} />}
            {data.canton && <Row label="Cantón" value={data.canton} />}
          </div>

          {/* Fechas y estado */}
          <div style={{ background: '#0F1F35', border: '1px solid #1E3A5F', borderRadius: 12, padding: '20px 24px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: '0 0 14px' }}>
              Fechas
            </p>
            {data.nro_sicop && (
              <Row label="N° SICOP" value={
                <span style={{ color: '#9ED23A', fontFamily: 'monospace', fontWeight: 700 }}>{data.nro_sicop}</span>
              } />
            )}
            <Row label="Publicado" value={fmtDateTime(data.fecha_publicacion)} />
            {data.fecha_cierre && (
              <Row label="Cierre ofertas" value={
                <span style={{ color: '#F59E0B', fontWeight: 600 }}>{fmtDateTime(data.fecha_cierre)}</span>
              } />
            )}
            {data.fecha_apertura && <Row label="Apertura" value={fmtDateTime(data.fecha_apertura)} />}
            {data.fecha_adj_firme && <Row label="Adjudicado" value={fmtDateTime(data.fecha_adj_firme)} />}

            <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: '20px 0 14px' }}>
              Participación
            </p>
            <Row label="Ofertas recibidas" value={
              <span style={{ color: '#9ED23A', fontWeight: 700 }}>{data.num_ofertas ?? 0}</span>
            } />
            {data.permite_recursos !== null && data.permite_recursos !== undefined && (
              <Row label="Permite recursos" value={data.permite_recursos ? 'Sí' : 'No'} />
            )}
          </div>
        </div>

        {/* Ganador */}
        {data.nombre_proveedor && (
          <div style={{ background: '#0F1F35', border: '1px solid #9ED23A44', borderRadius: 12, padding: '20px 24px', marginTop: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#9ED23A', textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: '0 0 12px' }}>
              🏆 Adjudicado a
            </p>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#E2E8F0', margin: '0 0 8px' }}>{data.nombre_proveedor}</p>
            <div style={{ display: 'flex', gap: 16 }}>
              {data.tipo_proveedor && <span style={{ fontSize: 12, color: '#64748B' }}>{data.tipo_proveedor}</span>}
              {data.tamaño_proveedor && <span style={{ fontSize: 12, color: '#64748B' }}>· {data.tamaño_proveedor}</span>}
              <span style={{ fontSize: 12, color: '#64748B' }}>· Cédula: {data.cedula_proveedor}</span>
            </div>
          </div>
        )}

        {/* Descripción */}
        {data.descripcion && (
          <div style={{ background: '#0F1F35', border: '1px solid #1E3A5F', borderRadius: 12, padding: '20px 24px', marginTop: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: '0 0 12px' }}>
              Descripción
            </p>
            <p style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.7, margin: 0 }}>{data.descripcion}</p>
          </div>
        )}

      </div>
    </div>
  )
}
