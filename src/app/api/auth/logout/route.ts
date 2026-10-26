export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { json, postGuard } from '../../../../lib/http';
import { clearSessionCookie } from '../../../../lib/auth';

export async function POST(req: Request) {
  const blocked = postGuard(req);
  if (blocked) return blocked;
  return json({ status: 200, body: { ok: true } }, { 'Set-Cookie': clearSessionCookie() });
}
