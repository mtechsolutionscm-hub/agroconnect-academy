import { formationIds, loadCourse } from '../lib/content';

export const dynamic = 'force-dynamic';

export default function Catalogue() {
  const items = formationIds().map((id) => ({ id, c: loadCourse(id) })).filter((x) => x.c);
  return <main><p>AGROCONNECT ACADEMY</p><h1>Formations agricoles</h1><p>Apprendre, pratiquer et progresser.</p><ul>{items.map(({id,c}: any) => <li key={id}><a href={`/formations/${id}`}>{c.title ?? c.name ?? id}</a></li>)}</ul><p><a href="/connexion">Connexion</a> · <a href="/verification">Vérifier une attestation</a></p></main>;
}
