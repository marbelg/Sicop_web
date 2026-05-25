import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  const sql = getDb()
  const { numero: rawNumero } = await params
  const numero = decodeURIComponent(rawNumero)

  const rows = await sql`
    select
      l.id, l.numero_procedimiento, l.titulo, l.descripcion, l.institucion,
      l.tipo_procedimiento, l.monto_estimado, l.currency,
      l.fecha_publicacion, l.keywords,
      coalesce(c.fecha_cierre, l.fecha_cierre)   as fecha_cierre,
      c.nro_sicop,
      c.nombre_unidad_compra                      as unidad_compra,
      c.fecha_apertura,
      i.nombre_institucion,
      i.telefono,
      i.direccion,
      i.canton,
      i.representante,
      case
        when af.numero_procedimiento is not null and af.desierto then 'Desierta'
        when af.numero_procedimiento is not null then 'Adjudicada'
        else 'Activa'
      end                                         as estado,
      af.fecha_adj_firme,
      af.permite_recursos,
      ct.cedula_proveedor,
      p.nombre_proveedor,
      p.tipo_proveedor,
      p.tamaño_proveedor,
      (select count(*)::int from ofertas o where o.numero_procedimiento = l.numero_procedimiento) as num_ofertas
    from licitaciones l
    left join carteles c           on c.nro_procedimiento  = l.numero_procedimiento
    left join instituciones i      on i.cedula             = l.institucion
    left join adjudicaciones_firme af on af.numero_procedimiento = l.numero_procedimiento
    left join contratos ct         on ct.numero_procedimiento = l.numero_procedimiento
    left join proveedores p        on p.cedula_proveedor   = ct.cedula_proveedor
    where l.numero_procedimiento = ${numero}
    limit 1
  `

  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(rows[0])
}
