import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const sql = getDb()
  const rows = await sql`
    select dataset, filename, rows_inserted, rows_updated, rows_skipped, created_at
    from import_logs
    order by created_at desc
    limit 80
  `
  return NextResponse.json(rows)
}
