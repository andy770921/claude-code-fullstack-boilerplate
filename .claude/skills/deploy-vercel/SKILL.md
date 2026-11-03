---
description: Deploy frontend and/or backend to Vercel with step-by-step guidance
---

# Deploy to Vercel

Guide the user through deploying this fullstack application to Vercel. Both frontend (Next.js) and backend (NestJS) are configured for Vercel deployment.

## TICKET Resolution

**If `$ARGUMENTS` is empty or not provided:**
1. Scan the `documents/` folder for existing FEAT-X folders
2. Find the highest number X in FEAT-X folders
3. Use `FEAT-{X+1}` as the new TICKET
4. Example: If FEAT-1, FEAT-2 exist → use FEAT-3

**If `$ARGUMENTS` is provided:**
- If folder exists → extend existing documents
- If folder doesn't exist → create new folder

**Prefix rules:**
- Deployment → `FEAT-X` (or use existing ticket if deploying a feature)

## Overview

| App | Type | Config | URL Pattern |
|-----|------|--------|-------------|
| Frontend | Static/SSR | `frontend/vercel.json` | `your-app.vercel.app` |
| Backend | Serverless | `backend/vercel.json` + `api/index.ts` | `your-api.vercel.app` |

## Process

### Step 1: Determine Deployment Target

Ask the user: "What would you like to deploy?"
1. Frontend only
2. Backend only
3. Both frontend and backend

### Step 2: Prerequisites Check

Verify with user:
- [ ] Vercel account created at https://vercel.com
- [ ] Git repository pushed to GitHub/GitLab/Bitbucket
- [ ] Vercel CLI installed (optional): `npm i -g vercel`

### Step 3: Deploy Based on Selection

---

## Frontend Deployment

### Configuration
The frontend is pre-configured in `frontend/vercel.json`:
```json
{
  "framework": "nextjs"
}
```

### Deployment Steps

#### Option A: Vercel Dashboard (Recommended for first deploy)

1. **Go to Vercel**
   - Visit https://vercel.com/new
   - Click "Import Project"

2. **Import Repository**
   - Connect your Git provider (GitHub/GitLab/Bitbucket)
   - Select this repository

3. **Configure Project**
   - **Project Name**: Choose a name (e.g., `my-app-frontend`)
   - **Root Directory**: Click "Edit" → Enter `frontend`
   - **Framework Preset**: Should auto-detect as "Next.js"
   - **Build Command**: `next build` (auto-filled)
   - **Output Directory**: `.next` (auto-filled)

4. **Environment Variables** (if needed)
   - Add any `NEXT_PUBLIC_*` environment variables
   - Example: `NEXT_PUBLIC_API_URL` = `https://your-api.vercel.app`

5. **Deploy**
   - Click "Deploy"
   - Wait for build to complete (~1-2 minutes)

#### Option B: Vercel CLI

```bash
cd frontend
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? Select your account
# - Link to existing project? No (first time)
# - Project name? my-app-frontend
# - Directory? ./
# - Override settings? No
```

### Post-Deployment
- Note the deployment URL (e.g., `https://my-app-frontend.vercel.app`)
- Set up custom domain in Project Settings → Domains (optional)

---

## Backend Deployment

### Configuration
The backend uses serverless functions via:
- `backend/vercel.json` - Install, build, function and rewrite config
- `backend/api/index.ts` - NestJS serverless handler

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": null,
  "installCommand": "cd .. && npm install --include=dev && cd shared && npm run build",
  "buildCommand": "mkdir -p public && touch public/.gitkeep",
  "outputDirectory": "public",
  "functions": {
    "api/index.ts": {
      "includeFiles": "../shared/**/*"
    }
  },
  "rewrites": [{ "source": "/(.*)", "destination": "/api/index.ts" }]
}
```

| Key | Why |
|-----|-----|
| `framework: null` | Pins the "Other" preset so the build doesn't depend on the dashboard. Under the auto-detected NestJS preset, Vercel also builds an unused second function from `src/main.ts` |
| `installCommand` | Installs from the monorepo root so the `@repo/shared` workspace link resolves, then builds `shared/dist` (gitignored) |
| `buildCommand` + `outputDirectory` | The "Other" preset requires a **non-empty** static output directory. `"true"` fails with `STATIC_BUILD_NO_OUT_DIR`, and an empty `public/` fails with `STATIC_BUILD_EMPTY_OUT_DIR`. `.gitkeep` is the only static file. Never add `public/index.html`: it would shadow Swagger UI at `/` |
| `includeFiles` | Ships `../shared/**/*` with the function. Must be a single string glob, not an array |
| `rewrites` | Sends every path and **every HTTP method** (including HEAD) to NestJS |

Do **not** use the legacy `builds` / `routes` / `version` properties. Vercel recommends
against them, and `builds` cannot be combined with `functions`. A `routes` entry with a
`methods` list also silently 404s any method it leaves out, such as HEAD.

### Important Limitations

| Limitation | Details | Workaround |
|------------|---------|------------|
| Cold Starts | First request ~1-2s slower | Use cron to keep warm |
| Timeout | Max 300s on Hobby; configurable higher on Pro | Split long operations |
| No WebSockets | Not supported | Use polling or Pusher/Ably |
| No Persistent Connections | Serverless is stateless | Use external DB connection pooling |
| Memory | 1024MB default | Increase in vercel.json if needed |

### Deployment Steps

#### Option A: Vercel Dashboard

1. **Go to Vercel**
   - Visit https://vercel.com/new
   - Click "Import Project"

2. **Import Repository** (same repo, new project)
   - Select the same repository
   - This creates a SEPARATE project for backend

3. **Configure Project**
   - **Project Name**: Choose a name (e.g., `my-app-api`)
   - **Root Directory**: Click "Edit" → Enter `backend`
   - **Framework Preset**: Any value works; `vercel.json` pins it to "Other"
   - Leave build settings as default (`vercel.json` overrides them)
   - **Required**: Settings → Build and Deployment → enable **Include source files outside
     of the Root Directory in the Build Step**. `installCommand` runs `cd ..`, so the build
     fails without it

4. **Environment Variables**
   - `NODE_ENV` = `production`
   - Add database URLs, API keys, etc.
   - CORS needs no variable: both `src/main.ts` and `api/index.ts` use `origin: true`

5. **Deploy**
   - Click "Deploy"
   - Wait for build (~2-3 minutes)

#### Option B: Vercel CLI

```bash
cd backend
vercel

# Follow prompts similar to frontend
```

### Post-Deployment
Run these yourself and report the results:

```bash
curl -i https://your-api.vercel.app/api/health      # 200 JSON
curl -I https://your-api.vercel.app/api/health      # HEAD → 200 (not x-vercel-error: NOT_FOUND)
curl -s https://your-api.vercel.app/ | grep '<title>' # Swagger UI, served by NestJS
curl -i https://your-api.vercel.app/api-json        # 200 OpenAPI JSON
```

- Check logs: Vercel Dashboard → Project → Deployments → Functions tab

### Verify a `vercel.json` change locally before pushing
`vercel build` needs no login when the project settings are written by hand. Run it in a
throwaway clone so `.vercel/` and root `node_modules` stay out of the working tree:

```bash
git clone . /tmp/vercel-check && cd /tmp/vercel-check
mkdir -p .vercel && echo '{"projectId":"prj_local","orgId":"team_local","settings":{"rootDirectory":"backend","framework":null,"nodeVersion":"22.x","sourceFilesOutsideRootDirectory":true}}' > .vercel/project.json
npx vercel build --yes
```

Expect `.vercel/output/` with exactly one function (`functions/api/index.func`) and one
static file (`static/.gitkeep`). Change `"framework"` to `"nestjs"` and rebuild to confirm
the output is identical whatever the dashboard preset is.

---

## Step 4: Connect Frontend to Backend

After both are deployed:

1. **Set Frontend Environment Variable**
   - Go to Frontend project in Vercel
   - Settings → Environment Variables
   - Add: `NEXT_PUBLIC_API_URL` = `https://your-api.vercel.app`
   - Redeploy frontend

2. **Backend CORS**
   - Nothing to set: the backend allows all origins (`origin: true`)
   - To restrict it, read an env var in **both** `src/main.ts` and `api/index.ts`. The
     serverless entry does not run `main.ts`

3. **Frontend API calls** are routed through `src/lib/api-client.ts`:
   ```typescript
   // api-client.ts reads NEXT_PUBLIC_API_URL automatically
   // All API calls go through apiClient.{resource}.{method}()
   // Next.js rewrites /api/* → backend in development
   ```

---

## Step 5: Document Deployment

**Determine TICKET:**
- If `$ARGUMENTS` provided → use `$ARGUMENTS`
- If empty → auto-generate next `FEAT-X` number

Create deployment record at: `documents/{TICKET}/development/deployment-vercel.md`

```markdown
# Vercel Deployment: [Date]

## Deployed Applications

### Frontend
- **URL**: https://[your-frontend].vercel.app
- **Project**: [project-name]
- **Root Directory**: frontend
- **Environment Variables**:
  - NEXT_PUBLIC_API_URL: [backend-url]

### Backend
- **URL**: https://[your-api].vercel.app
- **Project**: [project-name]
- **Root Directory**: backend
- **Environment Variables**:
  - NODE_ENV: production
  - [other secrets...]

## Deployment Checklist
- [ ] Frontend deployed
- [ ] Backend deployed
- [ ] "Include source files outside of the Root Directory" enabled (backend)
- [ ] Environment variables set
- [ ] Health check passing
- [ ] Custom domain configured (optional)

## Notes
[Any deployment-specific notes]
```

---

## Troubleshooting

### Common Issues

#### `STATIC_BUILD_NO_OUT_DIR` / `STATIC_BUILD_EMPTY_OUT_DIR`
- `buildCommand` must leave a non-empty `public/` (it writes `public/.gitkeep`), and
  `outputDirectory` must be `public`. Don't set `buildCommand` back to `"true"`

#### Build fails at `cd ..` / cannot find `../shared`
- Enable **Include source files outside of the Root Directory in the Build Step**

#### "Cannot find module '@repo/shared'" at runtime
- `functions["api/index.ts"].includeFiles` must be the string `"../shared/**/*"`, not an array
- `installCommand` must build `shared` (its `dist/` is gitignored)

#### CORS errors
- Both `src/main.ts` and `api/index.ts` call `app.enableCors()`. Vercel only runs
  `api/index.ts`, so change both

#### Cold start too slow
- Keep functions warm with external cron service
- Consider Edge Functions for faster cold starts

#### Build timeout
- Increase memory in vercel.json: `"functions": { "api/index.ts": { "memory": 1024 } }`
- Split large builds

#### 404 on API routes, or only on HEAD requests
- Check `vercel.json` has the catch-all `rewrites` entry to `/api/index.ts`
- A `404` with header `x-vercel-error: NOT_FOUND` never reached NestJS. Usually a legacy
  `routes` entry with a `methods` list is back; replace it with `rewrites`
- Check that `api/index.ts` is being built (`vercel build` output has `functions/api/index.func`)

### Vercel Logs
```bash
# View logs via CLI
vercel logs your-project.vercel.app

# Or in dashboard:
# Project → Deployments → [Latest] → Functions → View Logs
```

---

## References

- [Vercel NestJS Documentation](https://vercel.com/docs/frameworks/backend/nestjs)
- [Vercel Next.js Documentation](https://vercel.com/docs/frameworks/nextjs)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Vercel Serverless Functions](https://vercel.com/docs/concepts/functions/serverless-functions)
- [vercel.json reference](https://vercel.com/docs/project-configuration/vercel-json) (`builds`, `routes` and `version` are legacy)
- [Vercel Hobby plan limits](https://vercel.com/docs/plans/hobby)
- Project history: `documents/FEAT-4` (move to `functions` + `rewrites`), `documents/FEAT-5` (framework pin + output directory)

## Notes
- Always inform user which TICKET number is being used
