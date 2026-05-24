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
      l.id, l.numero_procedimiento, l.titulo, l.institucion, l.tipo_procedimiento,
      l.monto_estimado, l.currency, l.fecha_publicacion, l.estado, l.score,
      coalesce(c.fecha_cierre, l.fecha_cierre) as fecha_cierre,
      coalesce(c.nombre_unidad_compra, l.institucion) as nombre_institucion
    from licitaciones l
    left join carteles c on c.nro_procedimiento = l.numero_procedimiento
    where
      (${q} = '' or l.titulo ilike ${'%' + q + '%'} or l.descripcion ilike ${'%' + q + '%'})
      and (${tipo} = '' or l.tipo_procedimiento = ${tipo})
    order by l.fecha_publicacion desc nulls last
    limit ${limit} offset ${offset}
  `

  const countRows = await sql`
    select count(*)::int as n from licitaciones l
    where
      (${q} = '' or l.titulo ilike ${'%' + q + '%'} or l.descripcion ilike ${'%' + q + '%'})
      and (${tipo} = '' or l.tipo_procedimiento = ${tipo})
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
