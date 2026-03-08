# Formation Paris Sportif Monorepo

Architecture actuelle:
- `EucAnalysTips (App)/api`: backend unique (NestJS + Prisma + PostgreSQL + Redis)
- `EucAnalysTips (App)/app`: frontend App EucAnalypTips (Next.js)
- `EucalypTips (Site)/web`: frontend Site EucalypTips (Next.js)
- `EucAnalysTips (App)/mobile`: app mobile Expo
- `EucAnalysTips (App)/widget`: widget public embarquable
- `packages/types`: types partages
- `packages/sdk`: client API type
- `packages/ui`: composants UI partages

## Direction produit retenue
- Backend metier unique: `@app/api`
- Deux frontends autonomes: app et site
- Comptes communs (meme base utilisateurs / memes identifiants)
- Pas de SSO impose: chaque frontend gere sa session localement
- `@site/api` est deprecie (placeholder historique, non utilise en prod)

## Quick Start

1. Installer les dependances

```bash
npm install
```

2. Copier les variables d environnement

```bash
cp .env.example .env
cp "EucAnalysTips (App)/api/.env.example" "EucAnalysTips (App)/api/.env"
cp "EucAnalysTips (App)/app/.env.example" "EucAnalysTips (App)/app/.env"
cp "EucalypTips (Site)/web/.env.example" "EucalypTips (Site)/web/.env.local"
```

3. Demarrer PostgreSQL + Redis

```bash
npm run db:up
```

4. Prisma

```bash
npm run db:generate
npm run db:migrate
```

5. Lancer les services

```bash
npm run dev:api
npm run dev:app
npm run dev:web
```

## Auth (cross-domain bearer-first)

Endpoints principaux:
- `POST /v1/auth/register` -> `{ success: true, pendingVerification: true }`
- `POST /v1/auth/verify-email`
- `POST /v1/auth/login` -> `{ success, accessToken, refreshToken, user }`
- `POST /v1/auth/refresh` -> accepte `refreshToken` en body (rotation)
- `POST /v1/auth/logout` -> accepte `refreshToken` en body (revocation)
- `GET /v1/me` -> Bearer token
- `POST /v1/auth/forgot-password`
- `POST /v1/auth/reset-password`

Notes:
- Les cookies HttpOnly restent poses en compatibilite locale, mais le mode principal est Bearer + refresh token.
- Les liens email (`verify`, `reset`) acceptent un `redirectBaseUrl` valide (allowlist).

## Variables API importantes
- `APP_WEB_BASE_URL`
- `SITE_WEB_BASE_URL`
- `API_CORS_ORIGINS` (allowlist CORS stricte)
- `AUTH_REDIRECT_ALLOWLIST` (allowlist redirections emails)

## Scripts utiles
- `npm run dev:api`
- `npm run dev:app`
- `npm run dev:web`
- `npm run dev:site-api` -> affiche un message de deprecation

## Build de verification

```bash
npm run build --workspace @nouveau/types
npm run build --workspace @nouveau/sdk
npm run build --workspace @app/api
npm run build --workspace @app/eucanalyptips
npm run build --workspace @site/web
```


## Deploiement
- Voir [DEPLOYMENT.md](./DEPLOYMENT.md) pour le runbook production (API unique + App + Site).


- Setup hebergeur rapide sans domaine: [DEPLOYMENT_VERCEL_RAILWAY.md](./DEPLOYMENT_VERCEL_RAILWAY.md)

