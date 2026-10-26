import { NextResponse } from 'next/server';
import { currentUser } from '../../../../../lib/http';
export async function GET(request: Request) {
  const user = await currentUser(request);
  return NextResponse.json({ authenticated: !!user, user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null });
}
