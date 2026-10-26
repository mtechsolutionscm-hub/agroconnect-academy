import { formationIds, loadCourse } from '../lib/content';

export const dynamic = 'force-dynamic';

export default function Catalogue() {
  const items = formationIds().map((id) => ({ id, c: loadCourse(id) })).filter((x) => x.c);
  return (
    <>
      <h1>Formations</h1>
      <ul className="catalog">
        {items.map(({ id, c }) => (
          <li key={id}>
            <a href={`/formations/${id}`}>
              <strong>{c!.title}</strong>
              <small>{c!.modules.length} modules{c!.lead ? ` · ${String(c!.lead)}` : ''}</small>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
