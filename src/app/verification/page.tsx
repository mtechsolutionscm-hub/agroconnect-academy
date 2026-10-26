import { verify } from '../../lib/academy';
import { getRepo } from '../../lib/repo';

export const dynamic = 'force-dynamic';

export default async function Verification({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const sp = await searchParams;
  const code = String(sp.code || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 40);
  const res = code ? await verify(await getRepo(), code) : null;
  return (
    <>
      <h1>Vérifier une attestation</h1>
      <form className="form" method="get">
        <label>Code de vérification<input name="code" defaultValue={code} placeholder="ACA-F14-M3-XXXXXX" maxLength={40} /></label>
        <button type="submit">Vérifier</button>
      </form>
      {code && !res && <p role="alert"><strong>Code introuvable.</strong> Vérifiez la saisie.</p>}
      {res && (
        <section className="aca-section">
          <p className="aca-result-big">{res.status === 'active' ? 'Attestation authentique' : 'Attestation annulée'}</p>
          <p>{res.name} — {res.module}</p>
          <p>{res.formation} · {new Date(res.issuedAt).toLocaleDateString('fr-FR')}</p>
        </section>
      )}
    </>
  );
}
