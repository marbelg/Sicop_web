import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { getDb } from '@/lib/db'
import { signToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { nombre, email, empresa, password } = await req.json()

  if (!nombre?.trim() || !email?.trim() || !password?.trim()) {
    return NextResponse.json({ error: 'Nombre, email y contraseña son requeridos' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
  }

  const sql = getDb()
  const existing = await sql`select id from users where email = ${email.trim().toLowerCase()}`
  if (existing.length > 0) {
    return NextResponse.json({ error: 'Ya existe una cuenta con ese correo' }, { status: 409 })
  }

  const password_hash = await hash(password, 10)
  const rows = await sql`
    insert into users (nombre, email, empresa, password_hash)
    values (${nombre.trim()}, ${email.trim().toLowerCase()}, ${empresa?.trim() ?? null}, ${password_hash})
    returning id, nombre, email, empresa
  `
  const user = rows[0] as any
  const token = await signToken({ userId: user.id, nombre: user.nombre, email: user.email, empresa: user.empresa })

  const res = NextResponse.json({ ok: true, user: { nombre: user.nombre, email: user.email, empresa: user.empresa } })
  res.cookies.set('lf_token', token, { httpOnly: true, maxAge: 60 * 60 * 24 * 30, path: '/', sameSite: 'lax' })
  return res
}
