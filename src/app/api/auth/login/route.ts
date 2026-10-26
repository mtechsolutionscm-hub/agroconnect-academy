import { NextResponse } from 'next/server';
import { authenticate } from '../../../../lib/auth';
import { jsonError, setSessionCookie } from '../../../../lib/http';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') return jsonError('E-mail et mot de passe requis', 400);
  try {
    const user = await authenticate(body.email, body.password);
    if (!user) return jsonError('Identifiants invalides', 401);
    const response = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    setSessionCookie(response, user.id);
    return response;
  } catch (error) {
    console.error('Login error', error);
    return jsonError('Service temporairement indisponible', 503);
  }
}
