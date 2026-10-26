/**
 * Serveur de test : exécute les VRAIES routes de l'application (src/app/api/…) avec le stockage en mémoire,
 * sans Next.js, pour les tests de bout en bout dans un navigateur.  PORT=4100 ACADEMY_REPO=memory tsx tests/harness/server.ts
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as sessionR from '../../src/app/api/academy/v1/session/route';
import * as courseR from '../../src/app/api/academy/v1/course/[id]/route';
import * as attemptR from '../../src/app/api/academy/v1/attempt/route';
import * as activityR from '../../src/app/api/academy/v1/activity/route';
import * as progressR from '../../src/app/api/academy/v1/progress/route';
import * as courseCertR from '../../src/app/api/academy/v1/course-certificate/route';
import * as registerR from '../../src/app/api/auth/register/route';
import * as loginR from '../../src/app/api/auth/login/route';
import * as logoutR from '../../src/app/api/auth/logout/route';

const port = Number(process.env.PORT || 4100);
process.env.APP_URL = `http://localhost:${port}`;
const root = process.cwd();
const page = (f: string) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/academy.css"></head><body>
<div id="p"></div><script src="/academy.js"></script><script>
window.player = window.AgroConnectAcademy.mount(document.getElementById('p'), { formation: '${f}',
  config: { server: true, restUrl: '/api/academy/v1/', sessionUrl: '/api/academy/v1/session', loginUrl: '/connexion', credentials: 'same-origin' } });
</script></body></html>`;

createServer(async (req, res) => {
  const url = new URL(req.url || '/', process.env.APP_URL);
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const request = new Request(url, { method: req.method, headers: req.headers as Record<string, string>, body: ['GET', 'HEAD'].includes(req.method || '') ? undefined : Buffer.concat(chunks) });
  let response: Response | null = null;
  const p = url.pathname, m = req.method;
  try {
    if (p === '/api/academy/v1/session' && m === 'GET') response = await sessionR.GET(request);
    else if (p.startsWith('/api/academy/v1/course/') && m === 'GET') response = await courseR.GET(request, { params: Promise.resolve({ id: decodeURIComponent(p.split('/').pop() || '') }) });
    else if (p === '/api/academy/v1/attempt' && m === 'POST') response = await attemptR.POST(request);
    else if (p === '/api/academy/v1/activity' && m === 'POST') response = await activityR.POST(request);
    else if (p === '/api/academy/v1/progress' && m === 'GET') response = await progressR.GET(request);
    else if (p === '/api/academy/v1/course-certificate' && m === 'POST') response = await courseCertR.POST(request);
    else if (p === '/api/auth/register' && m === 'POST') response = await registerR.POST(request);
    else if (p === '/api/auth/login' && m === 'POST') response = await loginR.POST(request);
    else if (p === '/api/auth/logout' && m === 'POST') response = await logoutR.POST(request);
    else if (p === '/academy.js' || p === '/academy.css') response = new Response(readFileSync(join(root, 'src/academy', p.slice(1))), { headers: { 'Content-Type': p.endsWith('.js') ? 'text/javascript' : 'text/css' } });
    else if (p.startsWith('/formation/')) response = new Response(page(p.split('/').pop() || 'f14'), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    else if (p.startsWith('/content/')) response = new Response('interdit', { status: 404 }); // les contenus ne sont jamais servis directement
    else response = new Response('introuvable', { status: 404 });
  } catch (e) {
    console.error(e);
    response = new Response('erreur', { status: 500 });
  }
  res.statusCode = response.status;
  response.headers.forEach((v, k) => res.setHeader(k, v));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, () => console.log('prêt sur ' + port));
