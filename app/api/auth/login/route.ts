import { NextRequest, NextResponse } from 'next/server'
import { compare } from 'bcryptjs'
import { getDb } from '@/lib/db'
import { signToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  if (!email?.trim() || !password?.trim()) {
    return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 })
  }

  const sql = getDb()
  const rows = await sql`select * from users where email = ${email.trim().toLowerCase()}`
  const user = rows[0] as any

  if (!user) {
    return NextResponse.json({ error: 'Correo o contraseña incorrectos' }, { status: 401 })
  }

  const valid = await compare(password, user.password_hash)
  if (!valid) {
    return NextResponse.json({ error: 'Correo o contraseña incorrectos' }, { status: 401 })
  }

  const token = await signToken({ userId: user.id, nombre: user.nombre, email: user.email, empresa: user.empresa })

  const res = NextResponse.json({ ok: true, user: { nombre: user.nombre, email: user.email, empresa: user.empresa } })
  res.cookies.set('lf_token', token, { httpOnly: true, maxAge: 60 * 60 * 24 * 30, path: '/', sameSite: 'lax' })
  return res
}
