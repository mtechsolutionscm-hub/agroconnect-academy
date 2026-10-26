export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { json, currentUser } from '../../../../../lib/http';
import { session } from '../../../../../lib/academy';

export async function GET(req: Request) {
  return json(session(await currentUser(req)));
}
