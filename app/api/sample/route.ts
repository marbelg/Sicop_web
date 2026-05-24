import { NextRequest, NextResponse } from 'next/server'
import { unzipSync } from 'fflate'

const SICOP_BASE = 'https://www.sicop.go.cr'
const PORTAL_URL = `${SICOP_BASE}/moduloPcont/pcont/rp/CE_MOD_DATOSABIERTOSVIEW.jsp`
const ENDPOINT = '/moduloPcont/servlet/cont/rp/CE_DA_SC_CONTROLLER_JSON.java'

function today() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2,'0')}${String(d.getMonth()+1).padStart(2,'0')}${d.getFullYear()}`
}
function monthAgo() {
  const d = new Date(); d.setMonth(d.getMonth()-1)
  return `${String(d.getDate()).padStart(2,'0')}${String(d.getMonth()+1).padStart(2,'0')}${d.getFullYear()}`
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get session
  const pageRes = await fetch(PORTAL_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const cookies = pageRes.headers.get('set-cookie') ?? ''
  const sessionId = cookies.match(/JSESSIONID=([^;]+)/)?.[1] ?? ''

  // Step 1: create
  const createRes = await fetch(`${SICOP_BASE}${ENDPOINT}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie': `JSESSIONID=${sessionId}`,
      'Referer': PORTAL_URL,
      'User-Agent': 'Mozilla/5.0',
    },
    body: `bgnYmd=${monthAgo()}&endYmd=${today()}&instNmSC=&instCdSC=&proceTypeSC=&cmd=create`,
  })
  const filename = (await createRes.text()).trim()

  // Step 2: download
  const fileRes = await fetch(`${SICOP_BASE}${ENDPOINT}?cmd=download&fileZipName=${encodeURIComponent(filename)}`, {
    headers: { 'Cookie': `JSESSIONID=${sessionId}`, 'Referer': PORTAL_URL, 'User-Agent': 'Mozilla/5.0' },
  })
  const buffer = Buffer.from(await fileRes.arrayBuffer())

  // Unzip and parse
  const unzipped = unzipSync(new Uint8Array(buffer))
  const jsonText = new TextDecoder().decode(Object.values(unzipped)[0])
  const parsed = JSON.parse(jsonText)
  const rows: any[] = Array.isArray(parsed) ? parsed : (parsed[Object.keys(parsed).find(k => Array.isArray(parsed[k]))!] ?? [])

  // Return keys of first row + 2 sample rows
  const sample = rows.slice(0, 2)
  return NextResponse.json({
    total: rows.length,
    fields: sample[0] ? Object.keys(sample[0]) : [],
    sample,
  })
}
