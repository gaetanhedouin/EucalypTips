# Setup Rapide Sans Domaine (Vercel + Railway)

Ce guide te permet de deployer maintenant avec des URLs temporaires:
- API sur Railway
- App sur Vercel
- Site sur Vercel

Tu pourras brancher tes vrais domaines plus tard sans refonte.

## 0) Preparer le repo GitHub

Vercel et Railway se branchent le plus simplement a GitHub.

Depuis la racine du projet:

```bash
git init
git add .
git commit -m "chore: deploy setup"
```

Ensuite cree un repo GitHub et pousse le code.

## 1) Railway - Deployer l API

1. Cree un compte Railway puis `New Project`.
2. Ajoute un service `Deploy from GitHub Repo` en pointant sur ce repo.
3. Dans le service API Railway, configure:
   - Root Directory: `EucAnalysTips (App)/api`
   - Build Command: `npm run build`
   - Start Command: `npm run start`

4. Dans le meme projet Railway, ajoute:
   - `PostgreSQL`
   - `Redis`

5. Copie les URLs de connexion vers les variables du service API:
   - `DATABASE_URL`
   - `REDIS_URL`

6. Ajoute aussi ces variables API:
   - `NODE_ENV=production`
   - `JWT_SECRET=<long-secret>`
   - `JWT_EXPIRES_IN=15m`
   - `SEED_DEMO_DATA=false`
   - `EMAIL_MODE=mock` (temporaire pour demarrer vite)
   - `SMTP_FROM=no-reply@eucanalyptips.local`
   - `SPORTS_RESULTS_MODE=mock`

7. Deploie et recupere l URL Railway de l API (ex: `https://api-production-xxxx.up.railway.app`).

8. Lance la migration Prisma sur Railway (une fois):
   - Soit via Railway shell/console:

```bash
npm run prisma:migrate:deploy
```

## 2) Vercel - Deployer l App

1. Cree un projet Vercel depuis le meme repo GitHub.
2. Configure:
   - Root Directory: `EucAnalysTips (App)/app`
   - Build Command: `npm run build`
   - Install Command: `npm install`
   - Output: automatique Next.js

3. Variables Vercel (App):
   - `NEXT_PUBLIC_API_BASE_URL=<url-api-railway>`
   - `NEXT_PUBLIC_GEMINI_API_KEY=` (laisser vide si pas encore de cle)

4. Deploie et recupere l URL Vercel App (ex: `https://eucanalyptips-app.vercel.app`).

## 3) Vercel - Deployer le Site

1. Cree un 2e projet Vercel sur le meme repo.
2. Configure:
   - Root Directory: `EucalypTips (Site)/web`
   - Build Command: `npm run build`
   - Install Command: `npm install`

3. Variables Vercel (Site):
   - `NEXT_PUBLIC_SITE_API_BASE_URL=<url-api-railway>`
   - `NEXT_PUBLIC_API_BASE_URL=<url-api-railway>`
   - `NEXT_PUBLIC_NOTION_FOOTBALL_URL=<url notion>`
   - `NEXT_PUBLIC_NOTION_BASKETBALL_URL=<url notion>`
   - `NEXT_PUBLIC_NOTION_TENNIS_URL=<url notion>`

4. Deploie et recupere l URL Vercel Site (ex: `https://eucalyptips-site.vercel.app`).

## 4) Rebrancher CORS/API vers tes vraies URLs deployees

Retourne dans les variables du service API Railway et mets:

- `APP_WEB_BASE_URL=<url-vercel-app>`
- `SITE_WEB_BASE_URL=<url-vercel-site>`
- `API_CORS_ORIGINS=<url-vercel-app>,<url-vercel-site>`
- `AUTH_REDIRECT_ALLOWLIST=<url-vercel-app>,<url-vercel-site>`

Redeploie le service API Railway.

## 5) Tests finaux

1. `GET <url-api>/v1/health` -> OK.
2. Inscription depuis App -> lien mock affiche en UI (EMAIL_MODE=mock).
3. Verification email -> login App OK.
4. Login avec le meme compte sur Site -> OK.
5. `GET /v1/me` depuis App et Site -> OK.
6. Refresh token auto -> pas de deconnexion immediate.

## 6) Passage en mode production reel (apres)

1. Acheter/brancher domaines custom dans Vercel + Railway.
2. Mettre `EMAIL_MODE=smtp` et renseigner `SMTP_HOST/PORT/USER/PASS`.
3. Mettre `SPORTS_RESULTS_MODE=api` + `SPORTSDB_API_KEY`.
4. Mettre a jour `APP_WEB_BASE_URL`, `SITE_WEB_BASE_URL`, `API_CORS_ORIGINS`, `AUTH_REDIRECT_ALLOWLIST`.

## Notes techniques

- Les scripts `prebuild` des packages ont ete ajoutes pour builder automatiquement `packages/types/sdk/ui` en deploy monorepo.
- Le setup fonctionne meme si App et Site sont deployes comme deux projets Vercel separes.
