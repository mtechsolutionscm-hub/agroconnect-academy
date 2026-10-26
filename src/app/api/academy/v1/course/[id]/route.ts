export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { json, currentUser } from '../../../../../../lib/http';
import { getCourse } from '../../../../../../lib/academy';
import { getRepo } from '../../../../../../lib/repo';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const repo = await getRepo();
  return json(await getCourse(repo, await currentUser(req, repo), id), { 'Cache-Control': 'private, max-age=300' });
}
