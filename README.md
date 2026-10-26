# AgroConnect Academy

Application Next.js 15 / React 19 with server-side API routes, MySQL storage, course content, and tests.

## Requirements
- Node.js 20+
- MySQL 8+ or MariaDB 10.6+
- Configure environment variables from `.env.example` in the deployment platform. Never commit real secrets.

## Local development
```bash
npm install
cp .env.example .env
npm run dev
```

## Checks
```bash
npm run typecheck
npm test
npm run build
```

GitHub Actions runs type-checking, tests, and a production Next.js build on pushes and pull requests to `main`.

Deploy the full Next.js application to a platform that supports server-side Next.js routes (for example Vercel); do not export as static if API routes and sessions are required.
