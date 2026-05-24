import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const sql = neon(process.env.DATABASE_URL)
const schema = readFileSync(join(__dir, '../lib/schema.sql'), 'utf8')

// Split on semicolons, skip empty statements
const statements = schema.split(';').map(s => s.trim()).filter(Boolean)

for (const stmt of statements) {
  try {
    await sql.unsafe(stmt)
    const match = stmt.match(/create (table|index)[^(]+([\w]+)/i)
    if (match) console.log(`✓ ${match[0].trim()}`)
  } catch (e) {
    console.error(`✗ Error:`, e.message)
  }
}

console.log('\nDone.')
