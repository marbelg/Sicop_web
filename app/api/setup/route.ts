import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sql = getDb()
  const results: string[] = []

  const statements = [
    `create table if not exists licitaciones (
      id                    serial primary key,
      numero_procedimiento  text unique not null,
      titulo                text,
      institucion           text,
      tipo_procedimiento    text,
      monto_estimado        numeric,
      currency              text default 'CRC',
      fecha_publicacion     date,
      fecha_cierre          date,
      estado                text,
      descripcion           text,
      raw                   jsonb,
      score                 numeric default 0,
      keywords              text[],
      created_at            timestamptz default now(),
      updated_at            timestamptz default now()
    )`,
    `create table if not exists adjudicaciones (
      id                    serial primary key,
      numero_procedimiento  text,
      proveedor             text,
      cedula_proveedor      text,
      monto_adjudicado      numeric,
      fecha_adjudicacion    date,
      institucion           text,
      raw                   jsonb,
      created_at            timestamptz default now()
    )`,
    `create table if not exists import_logs (
      id              serial primary key,
      dataset         text,
      filename        text,
      rows_inserted   int default 0,
      rows_updated    int default 0,
      rows_skipped    int default 0,
      error           text,
      created_at      timestamptz default now()
    )`,
    `create index if not exists idx_licitaciones_estado       on licitaciones(estado)`,
    `create index if not exists idx_licitaciones_fecha_cierre on licitaciones(fecha_cierre)`,
    `create index if not exists idx_licitaciones_institucion  on licitaciones(institucion)`,
    `create index if not exists idx_licitaciones_score        on licitaciones(score desc)`,
    `create index if not exists idx_adjudicaciones_proveedor  on adjudicaciones(cedula_proveedor)`,
    `create index if not exists idx_adjudicaciones_inst       on adjudicaciones(institucion)`,
  ]

  for (const stmt of statements) {
    try {
      await sql.unsafe(stmt)
      const name = stmt.match(/(?:table|index)\s+(?:if not exists\s+)?(\w+)/i)?.[1] ?? '?'
      results.push(`✓ ${name}`)
    } catch (e: any) {
      results.push(`✗ ${e.message}`)
    }
  }

  return NextResponse.json({ ok: true, results })
}
