import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q      = searchParams.get('q') ?? ''
  const tipo   = searchParams.get('tipo') ?? ''
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit  = 20
  const offset = (page - 1) * limit

  const sql = getDb()

  const rows = await sql`
    select
      id, numero_procedimiento, titulo, institucion, tipo_procedimiento,
      monto_estimado, currency, fecha_publicacion, fecha_cierre, estado, score
    from licitaciones
    where
      (${q} = '' or titulo ilike ${'%' + q + '%'} or descripcion ilike ${'%' + q + '%'})
      and (${tipo} = '' or tipo_procedimiento = ${tipo})
    order by fecha_publicacion desc nulls last
    limit ${limit} offset ${offset}
  `

  const countRows = await sql`
    select count(*)::int as n from licitaciones
    where
      (${q} = '' or titulo ilike ${'%' + q + '%'} or descripcion ilike ${'%' + q + '%'})
      and (${tipo} = '' or tipo_procedimiento = ${tipo})
  `
  const total = (countRows[0] as any).n

  const tipos = await sql`
    select tipo_procedimiento, count(*)::int as n
    from licitaciones
    where tipo_procedimiento is not null
    group by tipo_procedimiento
    order by n desc
    limit 10
  `

  return NextResponse.json({ rows, total, page, limit, tipos })
}
