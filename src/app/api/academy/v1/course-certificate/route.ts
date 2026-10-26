export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { json, currentUser, postGuard, readJson } from '../../../../../lib/http';
import { courseCertificate } from '../../../../../lib/academy';
import { getRepo } from '../../../../../lib/repo';

export async function POST(req: Request) {
  const blocked = postGuard(req);
  if (blocked) return blocked;
  const repo = await getRepo();
  const user = await currentUser(req, repo);
  const body = await readJson(req);
  return json(await courseCertificate(repo, user, body));
}
