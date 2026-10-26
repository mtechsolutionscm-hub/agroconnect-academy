export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { json, currentUser } from '../../../../../lib/http';
import { progress } from '../../../../../lib/academy';
import { getRepo } from '../../../../../lib/repo';

export async function GET(req: Request) {
  const repo = await getRepo();
  const formation = new URL(req.url).searchParams.get('formation') || '';
  return json(await progress(repo, await currentUser(req, repo), formation));
}
