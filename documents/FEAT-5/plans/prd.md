# PRD: FEAT-5 — Vercel Config Hardening (Preset-Independent Backend Build)

## Document Information

- **Ticket:** FEAT-5
- **Created:** 2026-11-03
- **Author:** Claude Code
- **Status:** Implemented
- **Builds on:** FEAT-4 (legacy `builds` + `routes` → `functions` + `rewrites`)

## Problem Statement

FEAT-4 moved `backend/vercel.json` to the current `functions` + `rewrites` schema. A
follow-up commit (`8a621aa`) then set `"buildCommand": "true"` to skip a redundant build.
The resulting config deploys only if the Vercel project's dashboard **Framework Preset**
happens to be NestJS. The file does not pin a preset, so whether the deploy works depends
on a dashboard setting that is not in the repo.

### Failure Mode 1 — "Other" preset: the deploy fails

With the "Other" preset and a build command set, Vercel requires a static output
directory. `"buildCommand": "true"` produces none:

```
Error: [STATIC_BUILD_NO_OUT_DIR] No Output Directory named "public" found after the
Build completed. Update vercel.json#outputDirectory to ensure the correct output
directory is generated.
```

This was reproduced locally with `vercel build`. The sibling `short-url` project, built
from this boilerplate, hit the same error in production on 2026-11-03.

The `/deploy-vercel` skill told users to pick **"Other"**, so following the boilerplate's
own instructions led to this failure.

### Failure Mode 2 — NestJS preset: the deploy works, but builds a dead function

Under the auto-detected NestJS preset, `vercel build` emits **two** functions:

| Function                   | Handler                | Reached?                                                 |
| -------------------------- | ---------------------- | -------------------------------------------------------- |
| `functions/api/index.func` | `backend/api/index.js` | Yes. The `rewrites` entry routes every request here      |
| `functions/index.func`     | `backend/src/main.js`  | No. The preset's catch-all route comes after the rewrite |

The second function is compiled and shipped on every deploy, and nothing ever calls it.

### Failure Mode 3 — Stale deployment guidance

`.claude/skills/deploy-vercel/SKILL.md` is what Claude follows when deploying a project
generated from this boilerplate. It still taught the pre-FEAT-4 setup and other outdated
facts:

- A legacy `builds` + `routes` example. Vercel recommends against `builds`, and `builds`
  cannot be combined with `functions`. A `routes` entry with a `methods` list silently
  404s any method it leaves out; `short-url` lost HEAD this way (link-preview crawlers got
  404s).
- "Framework Preset: Select 'Other'", which triggers Failure Mode 1.
- No mention of the required **Include source files outside of the Root Directory** setting.
- A health check at `/health`; the real route is `/api/health`.
- Setting a `CORS_ORIGIN` env var, which no code reads. Both entries use `origin: true`.
- A 10s Hobby timeout. Vercel's Hobby page lists a 300s maximum function duration.

`backend/vercel.json` also kept `"version": 2`. Vercel's reference lists `version` under
Legacy: "The `version` property should not be used anymore."

## Solution

### `backend/vercel.json`

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

### Deployment guidance

- Rewrite the backend section of `/deploy-vercel` around the config above.
- Add the dashboard setting, a local `vercel build` check, and post-deploy curls that the
  agent runs itself.
- Correct the health URL, CORS, timeout and troubleshooting entries.
- `CLAUDE.md` gets a short version of the same rules.
- `documents/FEAT-4/development/vercel-config.md` gets a "superseded" note. Its history is
  otherwise left intact.

## Implementation Decisions

- **Pin `framework: null` ("Other"), not `"nestjs"`.** "Other" builds only the function
  we route to. `"nestjs"` would keep the dead `src/main.ts` function. With the preset
  pinned in the file, the dashboard value no longer matters.
- **Non-empty `public/` with a single `.gitkeep`.** An empty directory fails with
  `STATIC_BUILD_EMPTY_OUT_DIR`. The placeholder must not be `index.html`, because it would
  shadow Swagger UI at `/`. It must not be `robots.txt` either, since a disallow rule could
  block link-preview crawlers. A dotfile matches no API route. Static files are checked
  before rewrites, so `/.gitkeep` is the only path not served by NestJS.
- **`$schema`.** Vercel ignores it at deploy time. It gives editors completion and
  validation, which would have caught FEAT-4's `includeFiles` array mistake.
- **Drop `version`.** It is legacy, and `version: 2` is the only value the current schema
  accepts anyway.
- **Keep `installCommand` and `includeFiles` unchanged.** FEAT-4's reasons still hold:
  `shared/dist` is gitignored and must be built, and `includeFiles` must be one string glob.

## Out of Scope

- `frontend/vercel.json` (`{ "framework": "nextjs" }`) is already current.
- No cron jobs. The boilerplate has no database to keep warm. A project that adds a
  Supabase Free-plan database can add `crons` (see the sibling `short-url` FEAT-6).
- Historical docs (FEAT-1, FEAT-4) are not rewritten.

## Acceptance Criteria

- `backend/vercel.json` validates against `https://openapi.vercel.sh/vercel.json`.
- `vercel build` succeeds with **both** `framework: null` and `framework: "nestjs"` in the
  project settings. Both produce exactly one function (`functions/api/index.func`) and one
  static file (`static/.gitkeep`).
- The built function, run outside the repo, serves:
  - `GET /api/health` → 200 JSON
  - `HEAD /api/health` → 200
  - `GET /` → Swagger UI
  - `GET /api-json` → OpenAPI JSON
  - unknown paths → 404 JSON
- `/deploy-vercel` no longer mentions `builds`, `routes`, `version`, `CORS_ORIGIN` or
  `/health`.

## References

- [vercel.json reference](https://vercel.com/docs/project-configuration/vercel-json): `builds`, `version` (Legacy), `framework` (`null` = Other), `functions`
- [Vercel Hobby plan](https://vercel.com/docs/plans/hobby): function maximum duration
- [Missing public directory](https://vercel.link/missing-public-directory)
- FEAT-4: `documents/FEAT-4/plans/prd.md`, `documents/FEAT-4/development/vercel-config.md`
