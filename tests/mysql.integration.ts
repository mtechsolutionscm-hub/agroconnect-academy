/**
 * Même scénario que les tests en mémoire, sur la VRAIE base MySQL du fichier .env.
 * À lancer sur une base de test après npm run db:migrate :  npm run test:mysql
 */
import { test } from 'node:test';
import { mysqlRepo } from '../src/lib/repo/mysql';
import { runScenario } from './scenario';

test('règles de l’Academy sur MySQL', async () => {
  await runScenario(mysqlRepo(), (s) => console.log('  ✓ ' + s));
  process.exit(0);
});
