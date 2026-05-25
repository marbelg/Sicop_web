import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const from = body.from ?? ''
  const to   = body.to ?? ''
  const full = body.full ?? false

  const params = new URLSearchParams()
  if (from && to) { params.set('from', from); params.set('to', to) }
  else if (full)  { params.set('full', 'true') }

  const url = `${req.nextUrl.origin}/api/sync${params.size ? '?' + params : ''}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
