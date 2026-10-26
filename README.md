# AgroConnect Academy — Next.js (React) + MySQL · lot N1

Application complète de formation : catalogue, 18 formations (150 modules), comptes, quiz et exercices **corrigés par le serveur**, attestations vérifiables, certificat de parcours, page de vérification publique.
**Toute la configuration est dans `.env`.**

## Installation

```bash
npm install
cp .env.example .env          # puis remplir .env (MySQL, SESSION_SECRET, APP_URL…)
npm run db:migrate            # crée les tables dans la base MySQL du .env
npm run admin:create          # crée le premier administrateur (ADMIN_EMAIL, ADMIN_PASSWORD)
npm run dev                   # http://localhost:3000
```

Production : `npm run build` puis `npm start` (Node 20 ou plus), derrière HTTPS. La base MySQL peut être sur un autre serveur (`DB_HOST`, `DB_SSL=true`).

### Variables du fichier .env

| Variable | Rôle |
| --- | --- |
| `APP_URL` | Adresse publique exacte du site (sert à refuser les requêtes venant d'autres sites) |
| `SESSION_SECRET` | Secret de signature des sessions, 32 caractères au moins (obligatoire en production) |
| `SESSION_DAYS` | Durée d'une session |
| `ALLOW_REGISTRATION` | Création de compte par les apprenants |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_CONNECTION_LIMIT`, `DB_SSL` | Base MySQL 8 ou MariaDB 10.6+ |
| `CONTENT_DIR` | Dossier des fichiers de formation (par défaut `content`) |
| `RATE_*` | Limites de fréquence par heure |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Premier administrateur (retirer le mot de passe après création) |
| `CINETPAY_*`, `ADS_ENABLED` | Réservés aux lots N2 et N3 |

## Organisation du code

```
content/                 18 formations (JSON) — lues par le serveur, jamais servies directement
db/schema.sql            tables MySQL
scripts/                 migration, création de l'administrateur
src/lib/env.ts           lecture du .env
src/lib/content.ts       contenu sans corrigés, correction des quiz et exercices, codes d'attestation
src/lib/auth.ts          mots de passe (scrypt), sessions signées (HMAC), cookies
src/lib/academy.ts       toutes les règles (indépendantes de Next.js)
src/lib/http.ts          réponses JSON, utilisateur courant, protection des POST
src/lib/repo/            stockage : MySQL (mysql.ts) et mémoire pour les tests (memory.ts)
src/app/api/…            routes : /api/academy/v1/{session,course/[id],attempt,activity,progress,course-certificate}, /api/auth/{register,login,logout}
src/app/…                pages : catalogue, /formations/[id], /connexion, /verification
src/components/          AcademyPlayer (lecteur), liens de compte
src/academy/             moteur du lecteur (academy.js, academy.css)
tests/                   tests automatiques
```

## Sécurité en place

- Les bonnes réponses (quiz et exercices) ne quittent jamais le serveur avant correction.
- Le serveur seul décide de la réussite et délivre l'attestation : un « réussi » envoyé par le navigateur est ignoré.
- Une seule attestation active par compte, formation et module, **garantie par la base** (index unique sur une colonne générée).
- Mots de passe hachés avec scrypt ; session dans un cookie `HttpOnly`, `SameSite=Lax`, `Secure` en production, signé par HMAC.
- Requêtes POST acceptées uniquement en JSON et depuis `APP_URL` ; limites de fréquence en base (fonctionnent avec plusieurs serveurs).
- Requêtes SQL toujours préparées ; en-têtes de sécurité HTTP (next.config.mjs).

## Tests

```bash
npm test             # contenu, comptes, règles complètes (stockage en mémoire)
npm run test:mysql   # le MÊME scénario sur la vraie base MySQL du .env (après db:migrate, sur une base de test)
```

## État des tests au moment de la livraison

| Partie | Testé ? |
| --- | --- |
| Règles, contenu, correction des 150 quiz et 135 exercices, comptes, sessions, unicité des attestations, limites, protection des POST | Oui : 12 tests automatiques, tous réussis |
| Types TypeScript du code serveur, des routes, des scripts et des tests (mode strict) | Oui : aucune erreur |
| Routes d'API exécutées dans un vrai serveur Node, avec le lecteur dans Chromium (inscription, cookie, quiz, attestation, reprise, tentative de triche, certificat de parcours, déconnexion) | Oui, de bout en bout, avec le stockage en mémoire |
| Next.js (`next dev` / `next build`), pages React (types inclus) | **Non** : Next.js n'était pas installable (pas de réseau) |
| MySQL (`db:migrate`, `test:mysql`) | **Non** : pas de base MySQL disponible |

Première chose à faire : `npm install`, `npm run build`, `npm run db:migrate`, `npm test`, `npm run test:mysql`, et signaler toute erreur.

## Hébergement

- Serveur Node (VPS) ou plateforme compatible Next.js (Vercel, Netlify avec son support Next.js), avec une base MySQL accessible depuis l'hébergement.
- Les fichiers `content/*.json` sont inclus dans la version compilée (`outputFileTracingIncludes`).

## Lots suivants

- **N2 — Paiement** : formations payantes, CinetPay (MTN Mobile Money et Orange Money), vérification serveur, reçus, remboursements.
- **N3 — Publicité** : annonceurs, campagnes, trois emplacements hors leçon, mesure dédoublonnée, facturation.
- **N4 — Administration** : tableau de bord, apprenants, attestations (annulation), formations (publier, prix, contenu), journal, rôles formateur et commercial.

Les règles de ces lots existent déjà dans la version WordPress (implémentation de référence) et seront transposées.
