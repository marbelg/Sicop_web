import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import AdmZip from 'adm-zip'

const SICOP_BASE = 'https://www.sicop.go.cr'
const PORTAL_URL = `${SICOP_BASE}/moduloPcont/pcont/rp/CE_MOD_DATOSABIERTOSVIEW.jsp`

// Format date as DDMMYYYY (SICOP format)
function fmtSicop(d: Date) {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}${mm}${yyyy}`
}

// Each dataset: endpoint + body builder + row normalizer
const DATASETS = [
  {
    name: 'solicitudes',
    endpoint: '/moduloPcont/servlet/cont/rp/CE_DA_SC_CONTROLLER_JSON.java',
    body: (start: string, end: string) =>
      `bgnYmd=${start}&endYmd=${end}&instNmSC=&instCdSC=&proceTypeSC=&cmd=create`,
    table: 'licitaciones',
    normalizer: normalizeSC,
  },
  // More datasets will be added here as we discover their endpoints
]

function normalizeSC(row: any) {
  const numero = row.numero_procedimiento || row.numeroProcedimiento || row.NUM_PROCEDIMIENTO ||
                 row.CD_PROCEDURE || row.cdProcedure || row.numProcedimiento
  if (!numero) return null

  const parseDate = (v: any) => {
    if (!v) return null
    const s = String(v).trim()
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      const [d, m, y] = s.split('/')
      return `${y}-${m}-${d}`
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
    return null
  }

  const parseAmt = (v: any) => {
    if (v == null || v === '') return null
    const n = parseFloat(String(v).replace(/[^0-9.]/g, ''))
    return isNaN(n) ? null : n
  }

  const get = (...keys: string[]) => {
    for (const k of keys) {
      const found = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase())
      if (found !== undefined && row[found] !== '' && row[found] != null) return String(row[found]).trim()
    }
    return null
  }

  return {
    numero_procedimiento: String(numero).trim(),
    titulo:            get('nombre_procedimiento','nombreProcedimiento','NM_PROCEDURE','titulo','nombre'),
    institucion:       get('nombre_institucion','nombreInstitucion','NM_INST','institucion'),
    tipo_procedimiento:get('tipo_procedimiento','tipoProcedimiento','DS_PROCEDURE_TYPE','tipo'),
    monto_estimado:    parseAmt(get('monto_estimado','montoEstimado','AMT_ESTIMATED','monto')),
    currency:          get('moneda','currency','DS_CURRENCY') ?? 'CRC',
    fecha_publicacion: parseDate(get('fecha_publicacion','fechaPublicacion','DT_PUBLICATION','fecha_inicio')),
    fecha_cierre:      parseDate(get('fecha_cierre','fechaCierre','DT_CLOSE','fecha_apertura')),
    estado:            get('estado','estadoProcedimiento','DS_STATUS','estado_procedimiento'),
    descripcion:       get('descripcion','objeto','DS_DESCRIPTION'),
    raw:               JSON.stringify(row),
  }
}

function extractKeywords(norm: ReturnType<typeof normalizeSC>) {
  if (!norm) return []
  const text = [norm.titulo, norm.descripcion, norm.tipo_procedimiento].filter(Boolean).join(' ').toLowerCase()
  const stop = new Set(['de','la','el','en','y','a','que','los','las','con','para','por','del','un','una','se','al','por','las'])
  return [...new Set(text.replace(/[^\w\s]/g,' ').split(/\s+/).filter(w => w.length > 3 && !stop.has(w)))].slice(0, 20)
}

async function fetchSession(): Promise<string> {
  const res = await fetch(PORTAL_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const cookies = res.headers.get('set-cookie') || ''
  const match = cookies.match(/JSESSIONID=([^;]+)/)
  return match ? match[1] : ''
}

async function syncDataset(
  dataset: typeof DATASETS[0],
  sessionId: string,
  startDate: string,
  endDate: string,
  sql: ReturnType<typeof import('@/lib/db')['getDb']>
) {
  const body = dataset.body(startDate, endDate)
  const res = await fetch(`${SICOP_BASE}${dataset.endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie': `JSESSIONID=${sessionId}`,
      'Referer': PORTAL_URL,
      'User-Agent': 'Mozilla/5.0',
    },
    body,
  })

  if (!res.ok) throw new Error(`HTTP ${res.status} for ${dataset.name}`)

  const buffer = Buffer.from(await res.arrayBuffer())
  let rows: any[] = []
  let jsonText = ''

  // Try ZIP extraction first, fall back to raw text
  try {
    const zip = new AdmZip(buffer)
    const entries = zip.getEntries()
    // Pick first entry that looks like data (json, txt, or no extension)
    const entry = entries[0]
    if (!entry) throw new Error('Empty ZIP')
    jsonText = zip.readAsText(entry)
  } catch {
    jsonText = buffer.toString('utf8')
  }

  try {
    const parsed = JSON.parse(jsonText)
    if (Array.isArray(parsed)) rows = parsed
    else {
      const key = Object.keys(parsed).find(k => Array.isArray(parsed[k]))
      rows = key ? parsed[key] : []
    }
  } catch {
    throw new Error(`Cannot parse response from ${dataset.name}: ${jsonText.slice(0, 120)}`)
  }

  let inserted = 0, updated = 0, skipped = 0

  for (const row of rows) {
    const norm = dataset.normalizer(row)
    if (!norm) { skipped++; continue }
    const keywords = extractKeywords(norm)

    try {
      const result = await sql`
        insert into licitaciones
          (numero_procedimiento, titulo, institucion, tipo_procedimiento, monto_estimado,
           currency, fecha_publicacion, fecha_cierre, estado, descripcion, raw, keywords)
        values
          (${norm.numero_procedimiento}, ${norm.titulo}, ${norm.institucion},
           ${norm.tipo_procedimiento}, ${norm.monto_estimado}, ${norm.currency},
           ${norm.fecha_publicacion}, ${norm.fecha_cierre}, ${norm.estado},
           ${norm.descripcion}, ${norm.raw}::jsonb, ${keywords})
        on conflict (numero_procedimiento) do update set
          titulo             = excluded.titulo,
          institucion        = excluded.institucion,
          tipo_procedimiento = excluded.tipo_procedimiento,
          monto_estimado     = excluded.monto_estimado,
          fecha_cierre       = excluded.fecha_cierre,
          estado             = excluded.estado,
          raw                = excluded.raw,
          keywords           = excluded.keywords,
          updated_at         = now()
        returning (xmax = 0) as is_insert
      `
      if (result[0]?.is_insert) inserted++; else updated++
    } catch { skipped++ }
  }

  await sql`
    insert into import_logs (dataset, filename, rows_inserted, rows_updated, rows_skipped)
    values (${dataset.name}, ${'auto-sync'}, ${inserted}, ${updated}, ${skipped})
  `

  return { dataset: dataset.name, total: rows.length, inserted, updated, skipped }
}

export async function GET(req: NextRequest) {
  // Protect cron endpoint
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sql = getDb()
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    // On first run use last 90 days to catch up
    const countRows = await sql`select count(*)::int as n from licitaciones`
    const total = (countRows?.[0] as any)?.n ?? 0
    const startDate = total === 0
      ? fmtSicop(new Date(today.getFullYear(), today.getMonth() - 3, 1))
      : fmtSicop(yesterday)
    const endDate = fmtSicop(today)

    const sessionId = await fetchSession()
    const results = []
    for (const dataset of DATASETS) {
      try {
        const r = await syncDataset(dataset, sessionId, startDate, endDate, sql)
        results.push(r)
      } catch (e: any) {
        results.push({ dataset: dataset.name, error: e.message })
      }
    }
    return NextResponse.json({ ok: true, range: `${startDate}→${endDate}`, results })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message, stack: e.stack?.split('\n').slice(0,3) }, { status: 500 })
  }
}
