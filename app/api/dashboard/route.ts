import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const sql = getDb()

  const [stats, topInstituciones, topOferentes, porTipo] = await Promise.all([
    sql`
      select
        count(*)::int as total,
        count(*) filter (where af.numero_procedimiento is null)::int as activas,
        count(*) filter (where af.numero_procedimiento is not null and not af.desierto)::int as adjudicadas,
        count(*) filter (where af.numero_procedimiento is not null and af.desierto)::int as desiertas,
        coalesce(sum(l.monto_estimado) filter (where l.currency = 'CRC'), 0)::numeric as monto_total_crc,
        coalesce(sum(l.monto_estimado) filter (where l.currency = 'USD'), 0)::numeric as monto_total_usd
      from licitaciones l
      left join adjudicaciones_firme af on af.numero_procedimiento = l.numero_procedimiento
    `,
    sql`
      select
        coalesce(i.nombre_institucion, l.institucion) as nombre,
        count(*)::int as total,
        count(*) filter (where af.numero_procedimiento is not null and not af.desierto)::int as adjudicadas
      from licitaciones l
      left join instituciones i on i.cedula = l.institucion
      left join adjudicaciones_firme af on af.numero_procedimiento = l.numero_procedimiento
      where l.institucion is not null
      group by coalesce(i.nombre_institucion, l.institucion)
      order by total desc
      limit 10
    `,
    sql`
      select
        coalesce(p.nombre_proveedor, o.cedula_proveedor) as nombre,
        o.cedula_proveedor,
        count(*)::int as total_ofertas,
        count(distinct o.numero_procedimiento)::int as licitaciones
      from ofertas o
      left join proveedores p on p.cedula_proveedor = o.cedula_proveedor
      group by o.cedula_proveedor, p.nombre_proveedor
      order by total_ofertas desc
      limit 10
    `,
    sql`
      select
        l.tipo_procedimiento,
        count(*)::int as total,
        count(*) filter (where af.numero_procedimiento is not null and not af.desierto)::int as adjudicadas
      from licitaciones l
      left join adjudicaciones_firme af on af.numero_procedimiento = l.numero_procedimiento
      where l.tipo_procedimiento is not null
      group by l.tipo_procedimiento
      order by total desc
    `,
  ])

  return NextResponse.json({ stats: stats[0], topInstituciones, topOferentes, porTipo })
}
