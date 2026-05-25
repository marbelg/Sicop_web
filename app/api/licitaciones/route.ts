import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

const VALID_SORTS = new Set(['fecha_desc', 'monto_asc', 'monto_desc'])

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q         = searchParams.get('q') ?? ''
  const tipo      = searchParams.get('tipo') ?? ''
  const estado    = searchParams.get('estado') ?? ''
  const inst      = searchParams.get('inst') ?? ''
  const proveedor = searchParams.get('proveedor') ?? ''
  const sort      = VALID_SORTS.has(searchParams.get('sort') ?? '') ? searchParams.get('sort')! : 'fecha_desc'
  const montoMin  = parseFloat(searchParams.get('montoMin') ?? '0') || 0
  const montoMax  = parseFloat(searchParams.get('montoMax') ?? '0') || 0
  const page      = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit     = 20
  const offset    = (page - 1) * limit
  const likeQ     = '%' + q + '%'
  const likeI     = '%' + inst + '%'

  const sql = getDb()

  // Estado real SICOP (4 states):
  //   En recepción → sin adjudicación + fecha_cierre futura
  //   En análisis  → sin adjudicación + fecha_cierre pasada o sin fecha
  //   Adjudicada   → adjudicación firme, no desierta
  //   Desierta     → adjudicación firme, desierta

  const rows = await sql`
    select
      l.id, l.numero_procedimiento, l.titulo, l.institucion, l.tipo_procedimiento,
      l.monto_estimado, l.currency, l.fecha_publicacion,
      coalesce(c.fecha_cierre, l.fecha_cierre) as fecha_cierre,
      c.nombre_unidad_compra as unidad_compra,
      i.nombre_institucion,
      case
        when af.numero_procedimiento is not null and af.desierto    then 'Desierta'
        when af.numero_procedimiento is not null                    then 'Adjudicada'
        when coalesce(c.fecha_cierre, l.fecha_cierre) > now()      then 'En recepción'
        else 'En análisis'
      end as estado
    from licitaciones l
    left join carteles c on c.nro_procedimiento = l.numero_procedimiento
    left join adjudicaciones_firme af on af.numero_procedimiento = l.numero_procedimiento
    left join instituciones i on i.cedula = l.institucion
    where
      (${q} = '' or l.titulo ilike ${likeQ} or l.descripcion ilike ${likeQ} or l.numero_procedimiento ilike ${likeQ})
      and (${tipo} = '' or l.tipo_procedimiento = ${tipo})
      and (${inst} = '' or coalesce(i.nombre_institucion, l.institucion) ilike ${likeI})
      and (${montoMin}::float8 = 0 or l.monto_estimado >= ${montoMin}::float8)
      and (${montoMax}::float8 = 0 or l.monto_estimado <= ${montoMax}::float8)
      and (${estado} = '' or
        case
          when af.numero_procedimiento is not null and af.desierto   then 'Desierta'
          when af.numero_procedimiento is not null                   then 'Adjudicada'
          when coalesce(c.fecha_cierre, l.fecha_cierre) > now()     then 'En recepción'
          else 'En análisis'
        end = ${estado})
      and (${proveedor} = '' or exists (
        select 1 from ofertas o2
        where o2.numero_procedimiento = l.numero_procedimiento and o2.cedula_proveedor = ${proveedor}
      ))
    order by
      case when ${sort} = 'monto_asc'  then l.monto_estimado end asc  nulls last,
      case when ${sort} = 'monto_desc' then l.monto_estimado end desc nulls last,
      case when ${sort} = 'fecha_desc' then l.fecha_publicacion end desc nulls last
    limit ${limit} offset ${offset}
  `

  const countRows = await sql`
    select count(*)::int as n from licitaciones l
    left join carteles c on c.nro_procedimiento = l.numero_procedimiento
    left join adjudicaciones_firme af on af.numero_procedimiento = l.numero_procedimiento
    left join instituciones i on i.cedula = l.institucion
    where
      (${q} = '' or l.titulo ilike ${likeQ} or l.descripcion ilike ${likeQ} or l.numero_procedimiento ilike ${likeQ})
      and (${tipo} = '' or l.tipo_procedimiento = ${tipo})
      and (${inst} = '' or coalesce(i.nombre_institucion, l.institucion) ilike ${likeI})
      and (${montoMin}::float8 = 0 or l.monto_estimado >= ${montoMin}::float8)
      and (${montoMax}::float8 = 0 or l.monto_estimado <= ${montoMax}::float8)
      and (${estado} = '' or
        case
          when af.numero_procedimiento is not null and af.desierto   then 'Desierta'
          when af.numero_procedimiento is not null                   then 'Adjudicada'
          when coalesce(c.fecha_cierre, l.fecha_cierre) > now()     then 'En recepción'
          else 'En análisis'
        end = ${estado})
      and (${proveedor} = '' or exists (
        select 1 from ofertas o2
        where o2.numero_procedimiento = l.numero_procedimiento and o2.cedula_proveedor = ${proveedor}
      ))
  `
  const total = (countRows[0] as any).n

  const tipos = await sql`
    select tipo_procedimiento, count(*)::int as n
    from licitaciones
    where tipo_procedimiento is not null
    group by tipo_procedimiento
    order by n desc
    limit 15
  `

  return NextResponse.json({ rows, total, page, limit, tipos })
}
