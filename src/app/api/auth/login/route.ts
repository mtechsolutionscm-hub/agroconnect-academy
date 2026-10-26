export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { json, postGuard, readJson, who } from '../../../../lib/http';
import { login } from '../../../../lib/academy';
import { createSessionToken, sessionCookie } from '../../../../lib/auth';
import { getRepo } from '../../../../lib/repo';

export async function POST(req: Request) {
  const blocked = postGuard(req);
  if (blocked) return blocked;
  const repo = await getRepo();
  const res = await login(repo, who(req, null), await readJson(req));
  return json(res, res.user ? { 'Set-Cookie': sessionCookie(createSessionToken(res.user.id)) } : {});
}
