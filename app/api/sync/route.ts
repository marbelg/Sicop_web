import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { unzipSync } from 'fflate'

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
  const numero = row.NUMERO_PROCEDIMIENTO
  if (!numero) return null

  const parseDate = (v: any) => {
    if (!v) return null
    const s = String(v).trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      const [d, m, y] = s.split('/'); return `${y}-${m}-${d}`
    }
    return null
  }

  const parseAmt = (v: any) => {
    if (v == null || v === '') return null
    const n = parseFloat(String(v).replace(/[^0-9.]/g, ''))
    return isNaN(n) ? null : n
  }

  return {
    numero_procedimiento: String(numero).trim(),
    titulo:            row.JUST_PROCEDENCIA ? String(row.JUST_PROCEDENCIA).slice(0, 500) : null,
    institucion:       row.CEDULA_INSTITUCION ? String(row.CEDULA_INSTITUCION) : null,
    tipo_procedimiento:row.TIPO_PROCEDIMIENTO ? String(row.TIPO_PROCEDIMIENTO) : null,
    monto_estimado:    parseAmt(row.PRESUPUESTO),
    currency:          row.MONEDA ?? 'CRC',
    fecha_publicacion: parseDate(row.FECHA_TRAMITE),
    fecha_cierre:      null,
    estado:            'Activo',
    descripcion:       row.FINALIDAD_PUBLICA ? String(row.FINALIDAD_PUBLICA).slice(0, 1000) : null,
    raw:               row,
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

  // Step 1: POST returns the filename of the ZIP, not the file itself
  const filename = (await res.text()).trim()
  if (!filename.endsWith('.zip')) throw new Error(`Unexpected response: ${filename.slice(0, 100)}`)

  // Step 2: GET same endpoint with cmd=download&fileZipName=
  const fileUrl = `${SICOP_BASE}${dataset.endpoint}?cmd=download&fileZipName=${encodeURIComponent(filename)}`
  const fileRes = await fetch(fileUrl, {
    headers: {
      'Cookie': `JSESSIONID=${sessionId}`,
      'Referer': PORTAL_URL,
      'User-Agent': 'Mozilla/5.0',
    },
  })
  if (!fileRes.ok) throw new Error(`ZIP download failed: HTTP ${fileRes.status} for ${filename}`)

  const buffer = Buffer.from(await fileRes.arrayBuffer())
  let rows: any[] = []
  let jsonText = ''

  // Extract JSON from ZIP
  try {
    const unzipped = unzipSync(new Uint8Array(buffer))
    const firstFile = Object.values(unzipped)[0]
    if (!firstFile) throw new Error('Empty ZIP')
    jsonText = new TextDecoder().decode(firstFile)
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
    throw new Error(`Cannot parse JSON from ${dataset.name}: ${jsonText.slice(0, 120)}`)
  }

  let inserted = 0, updated = 0, skipped = 0, batchErrors: string[] = []
  const BATCH = 100

  const normalized = rows.map(row => {
    const norm = dataset.normalizer(row)
    if (!norm) return null
    // Exclude raw from batch to keep payload small; store separately
    const { raw, ...rest } = norm as any
    return { ...rest, keywords: extractKeywords(norm) }
  }).filter(Boolean) as any[]

  skipped += rows.length - normalized.length

  for (let i = 0; i < normalized.length; i += BATCH) {
    const batch = normalized.slice(i, i + BATCH)
    try {
      const result = await sql`
        insert into licitaciones
          (numero_procedimiento, titulo, institucion, tipo_procedimiento, monto_estimado,
           currency, fecha_publicacion, fecha_cierre, estado, descripcion, keywords)
        select
          r->>'numero_procedimiento',
          r->>'titulo',
          r->>'institucion',
          r->>'tipo_procedimiento',
          (r->>'monto_estimado')::numeric,
          coalesce(r->>'currency', 'CRC'),
          (r->>'fecha_publicacion')::date,
          (r->>'fecha_cierre')::date,
          r->>'estado',
          r->>'descripcion',
          array(select jsonb_array_elements_text(r->'keywords'))
        from jsonb_array_elements(${JSON.stringify(batch)}::jsonb) r
        on conflict (numero_procedimiento) do update set
          titulo             = excluded.titulo,
          institucion        = excluded.institucion,
          tipo_procedimiento = excluded.tipo_procedimiento,
          monto_estimado     = excluded.monto_estimado,
          fecha_cierre       = excluded.fecha_cierre,
          estado             = excluded.estado,
          keywords           = excluded.keywords,
          updated_at         = now()
        returning (xmax = 0) as is_insert
      `
      for (const r of result) {
        if ((r as any).is_insert) inserted++; else updated++
      }
    } catch (e: any) {
      batchErrors.push(e.message?.slice(0, 100))
      skipped += batch.length
    }
  }

  await sql`
    insert into import_logs (dataset, filename, rows_inserted, rows_updated, rows_skipped)
    values (${dataset.name}, ${'auto-sync'}, ${inserted}, ${updated}, ${skipped})
  `

  return { dataset: dataset.name, total: rows.length, inserted, updated, skipped, firstError: batchErrors[0] ?? null }
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
    const full = req.nextUrl.searchParams.get('full') === 'true'
    const countRows = await sql`select count(*)::int as n from licitaciones`
    const total = (countRows?.[0] as any)?.n ?? 0
    const startDate = (total === 0 || full)
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
