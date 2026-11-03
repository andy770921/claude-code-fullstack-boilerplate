# Implementation: Preset-Independent `backend/vercel.json`

## Document Information

- **Ticket:** FEAT-5
- **Created:** 2026-11-03
- **Author:** Claude Code
- **PRD:** [../plans/prd.md](../plans/prd.md)

## Changes

| File                                            | Change                                                                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `backend/vercel.json`                           | Drop `version`; add `$schema`, `framework: null`, `outputDirectory: "public"`; `buildCommand` writes `public/.gitkeep` |
| `.claude/skills/deploy-vercel/SKILL.md`         | Rewrite the backend config section, dashboard steps, post-deploy checks and troubleshooting                            |
| `CLAUDE.md`                                     | Deployment rules for `backend/vercel.json`; corrected Hobby function duration                                          |
| `documents/FEAT-4/development/vercel-config.md` | "Superseded" note pointing here                                                                                        |

No application code changes.

## `backend/vercel.json`

Before (`8a621aa`):

```json
{
  "version": 2,
  "installCommand": "cd .. && npm install --include=dev && cd shared && npm run build",
  "buildCommand": "true",
  "functions": {
    "api/index.ts": {
      "includeFiles": "../shared/**/*"
    }
  },
  "rewrites": [{ "source": "/(.*)", "destination": "/api/index.ts" }]
}
```

After:

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

## Verification Performed

All runs used Vercel CLI 65.10.0 and Node 22.x settings, in a throwaway clone of this repo.

### 1. Schema

The new file validates against `https://openapi.vercel.sh/vercel.json` (ajv). As a
negative control, an `includeFiles` array and a cron path without a leading `/` are both
rejected.

### 2. `vercel build` under both dashboard presets

| Config | Preset in project settings | Result                                                                            |
| ------ | -------------------------- | --------------------------------------------------------------------------------- |
| Before | Other (`null`)             | **Fails**: `STATIC_BUILD_NO_OUT_DIR`                                              |
| Before | NestJS                     | Succeeds, **2 functions**: `api/index.func` + unused `index.func` (`src/main.js`) |
| After  | Other (`null`)             | Succeeds: 1 function (`api/index.func`), static = `.gitkeep`                      |
| After  | NestJS                     | Same output as the row above                                                      |

An empty `public/` (`"buildCommand": "mkdir -p public"`) fails with
`STATIC_BUILD_EMPTY_OUT_DIR`. That was checked on the sibling `short-url` project, which
uses the same layout.

The generated `config.json` routes start with `handle: filesystem`, followed by
`^(?:/(.*))$ → /api/index.ts`. Static files are checked first, then everything else is
rewritten to the function. The rewrite has no method filter, so HEAD is included.

### 3. Built function, run outside the repo

The function bundle was copied to a directory with no ancestor `node_modules`, so Node
could not fall back to the repo's packages. Files listed in `.vc-config.json`
`filePathMap` were copied in, mirroring what a deploy uploads. The handler was then
served with Node's `http` module:

| Request             | Result                                         |
| ------------------- | ---------------------------------------------- |
| `GET /api/health`   | `200` `{"status":"ok","timestamp":"…"}`        |
| `HEAD /api/health`  | `200`                                          |
| `GET /`             | `200` Swagger UI (`Backend API Documentation`) |
| `GET /api-json`     | `200` OpenAPI JSON                             |
| `GET /package.json` | `404` JSON. No source files are exposed        |
| `GET /zzzzzz`       | `404` JSON                                     |
| `HEAD /zzzzzz`      | `404`                                          |

There were no module resolution errors. The backend imports `@repo/shared` for types
only, so nothing from `shared` is required at runtime today. `includeFiles` stays so
that adding runtime exports to `shared` keeps working.

The live deployment (`claude-code-boilerplate-backend.vercel.app`, still on the old
config) returns the same results for these paths, except that `/.gitkeep` now exists.

## Rollout

1. Backend project → Settings → Build and Deployment: confirm **Include source files
   outside of the Root Directory in the Build Step** is enabled.
2. Push to `main`. A failed build is not promoted; production keeps the previous
   deployment.
3. Verify production:

   ```bash
   B=https://claude-code-boilerplate-backend.vercel.app
   curl -i "$B/api/health"                     # 200 JSON
   curl -I "$B/api/health"                     # 200
   curl -s "$B/" | grep '<title>'              # Backend API Documentation
   curl -s -o /dev/null -w '%{http_code}\n' "$B/.gitkeep"  # 200 → new config is live
   ```

4. If anything is wrong, use Instant Rollback to the previous deployment.

## Reproducing the Checks

```bash
git clone . /tmp/vercel-check && cd /tmp/vercel-check
mkdir -p .vercel && echo '{"projectId":"prj_local","orgId":"team_local","settings":{"rootDirectory":"backend","framework":null,"nodeVersion":"22.x","sourceFilesOutsideRootDirectory":true}}' > .vercel/project.json
npx vercel build --yes
ls -a .vercel/output/functions .vercel/output/static
```

Set `"framework":"nestjs"` and rebuild to confirm the output does not change. `vercel
build` needs no login when `.vercel/project.json` is written by hand.
