import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

async function getUser(req: NextRequest) {
  const token = req.cookies.get('lf_token')?.value
  if (!token) return null
  return verifyToken(token)
}

// GET — list user's keywords + matching licitaciones
// Accepts ?kw=word1,word2 for anonymous use (keywords from localStorage)
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  const sql = getDb()

  let terms: string[]

  if (user) {
    const keywords = await sql`
      select keyword from radar_keywords
      where user_id = ${user.userId}
      order by created_at desc
    `
    terms = keywords.map((k: any) => k.keyword)
  } else {
    const kwParam = req.nextUrl.searchParams.get('kw') ?? ''
    terms = kwParam.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  }

  if (terms.length === 0) {
    return NextResponse.json({ keywords: [], hits: [] })
  }
  // Build a single regex pattern: "word1|word2|word3" for PostgreSQL ~* operator
  const pattern = terms.map((t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')

  // Search licitaciones matching any keyword — active + closed within last 30 days, not yet adjudicated
  const hits = await sql`
    select
      l.id, l.numero_procedimiento, l.titulo, l.tipo_procedimiento,
      l.monto_estimado, l.currency, l.fecha_publicacion,
      coalesce(c.fecha_cierre, l.fecha_cierre) as fecha_cierre,
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
      coalesce(c.fecha_cierre, l.fecha_cierre) > now() - interval '30 days'
      and af.numero_procedimiento is null
      and (
        l.titulo          ~* ${pattern}
        or l.descripcion  ~* ${pattern}
        or c.descripcion  ~* ${pattern}
        or c.nombre_unidad_compra ~* ${pattern}
      )
    order by coalesce(c.fecha_cierre, l.fecha_cierre) desc nulls last
    limit 50
  `

  return NextResponse.json({ keywords: terms, hits })
}

// POST — add keyword
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { keyword } = await req.json()
  if (!keyword?.trim()) return NextResponse.json({ error: 'Keyword vacía' }, { status: 400 })

  const sql = getDb()
  await sql`
    insert into radar_keywords (user_id, keyword)
    values (${user.userId}, ${keyword.trim().toLowerCase()})
    on conflict (user_id, keyword) do nothing
  `
  return NextResponse.json({ ok: true })
}

// DELETE — remove keyword
export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { keyword } = await req.json()
  const sql = getDb()
  await sql`
    delete from radar_keywords
    where user_id = ${user.userId} and keyword = ${keyword}
  `
  return NextResponse.json({ ok: true })
}
