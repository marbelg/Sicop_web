import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

function normalizeRow(row: Record<string, any>) {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const found = Object.keys(row).find(rk => rk.toLowerCase().replace(/\s/g, '_') === k.toLowerCase())
      if (found && row[found] !== undefined && row[found] !== '') return String(row[found]).trim()
    }
    return null
  }

  const parseDate = (v: string | null) => {
    if (!v) return null
    // DD/MM/YYYY or YYYY-MM-DD
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
      const [d, m, y] = v.split('/')
      return `${y}-${m}-${d}`
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10)
    return null
  }

  const parseAmount = (v: string | null) => {
    if (!v) return null
    const n = parseFloat(v.replace(/[^0-9.]/g, ''))
    return isNaN(n) ? null : n
  }

  const numero = get('numero_procedimiento', 'numero', 'expediente', 'cod_procedimiento')
  if (!numero) return null

  return {
    numero_procedimiento: numero,
    titulo:               get('titulo', 'nombre_procedimiento', 'descripcion_procedimiento', 'nombre'),
    institucion:          get('institucion', 'nombre_institucion', 'entidad', 'organo'),
    tipo_procedimiento:   get('tipo_procedimiento', 'tipo', 'modalidad'),
    monto_estimado:       parseAmount(get('monto_estimado', 'monto', 'presupuesto', 'valor')),
    currency:             get('moneda', 'currency') ?? 'CRC',
    fecha_publicacion:    parseDate(get('fecha_publicacion', 'fecha_inicio', 'fecha')),
    fecha_cierre:         parseDate(get('fecha_cierre', 'fecha_fin', 'fecha_apertura')),
    estado:               get('estado', 'estado_procedimiento'),
    descripcion:          get('descripcion', 'objeto'),
    raw:                  JSON.stringify(row),
  }
}

function extractKeywords(row: ReturnType<typeof normalizeRow>) {
  if (!row) return []
  const text = [row.titulo, row.descripcion, row.tipo_procedimiento].filter(Boolean).join(' ').toLowerCase()
  const stopwords = new Set(['de','la','el','en','y','a','que','los','las','con','para','por','del','un','una','se','al'])
  return [...new Set(
    text.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !stopwords.has(w))
  )].slice(0, 20)
}

export async function POST(req: NextRequest) {
  try {
    const sql = getDb()
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const filename = file.name.toLowerCase()

    let rows: Record<string, any>[] = []

    if (filename.endsWith('.csv')) {
      const text = buffer.toString('utf8')
      const result = Papa.parse(text, { header: true, skipEmptyLines: true })
      rows = result.data as Record<string, any>[]
    } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
    } else {
      return NextResponse.json({ error: 'Formato no soportado. Use CSV o Excel.' }, { status: 400 })
    }

    let inserted = 0, updated = 0, skipped = 0

    for (const row of rows) {
      const norm = normalizeRow(row)
      if (!norm) { skipped++; continue }

      const keywords = extractKeywords(norm)

      try {
        const res = await sql`
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
        if (res[0]?.is_insert) inserted++; else updated++
      } catch {
        skipped++
      }
    }

    await sql`
      insert into import_logs (dataset, filename, rows_inserted, rows_updated, rows_skipped)
      values ('manual', ${file.name}, ${inserted}, ${updated}, ${skipped})
    `

    return NextResponse.json({ total: rows.length, inserted, updated, skipped })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
