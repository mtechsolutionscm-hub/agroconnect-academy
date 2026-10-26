import { NextResponse } from 'next/server';
import { registerUser } from '../../../../lib/auth';
import { env } from '../../../../lib/env';
import { jsonError, setSessionCookie, isSameOrigin } from '../../../../lib/http';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError('Origine refusée', 403);
  if (!env.allowRegistration) return jsonError('Les inscriptions sont désactivées', 403);
  const body = await request.json().catch(() => null);
  if (!body || typeof body.email !== 'string' || typeof body.password !== 'string' || typeof body.name !== 'string') return jsonError('Nom, e-mail et mot de passe requis', 400);
  try {
    const user = await registerUser(body.name, body.email, body.password);
    const response = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } }, { status: 201 });
    setSessionCookie(response, user.id);
    return response;
  } catch (error) {
    console.error('Register error', error);
    return jsonError('Inscription impossible. Vérifiez les données ou réessayez.', 400);
  }
}
