# PRD: FEAT-4 — Vercel Deployment Hardening (Shared Build & Routing)

## Problem Statement

The boilerplate runs cleanly with `npm run dev`, but a deploy of the `backend`
workspace to Vercel hits failure modes that are invisible locally. FEAT-4 is the
umbrella ticket that makes the boilerplate Vercel-deploy-ready in one pass.

### Failure Mode 1 — Runtime crash on any route that imports `@repo/shared`

Vercel's lambda evaluates the file referenced by `shared/package.json#main`, which
currently points at `src/index.ts`. Node 20 cannot parse TypeScript `export`
syntax, so the function dies with:

```
/var/task/shared/src/index.ts:1
export * from './constants/cart';
SyntaxError: Unexpected token 'export'
```

Three things compound to produce this:

- `shared/package.json` declares `main: "src/index.ts"`, `types: "src/index.ts"`,
  and `build: "tsc --noEmit"` (no `dist/` is ever produced).
- `frontend/tsconfig.json` declares `paths: { "@repo/shared": ["../shared/src/index.ts"] }`,
  which masks the package metadata for the FE so the bug is invisible there.
- `backend/vercel.json` uses legacy `builds` + `routes`, where `@vercel/nft`
  cannot reliably trace files reached through the workspace symlink, so even if
  `dist/` existed it would not be bundled.

### Failure Mode 2 — Swagger UI renders blank in production

`SwaggerModule.setup('/')` from `@nestjs/swagger@11` emits HTML with relative
asset URLs that `@vercel/nft` cannot trace into the lambda. Symptom, root cause
analysis, alternatives, and the chosen fix (a CDN-backed UI shell) all live with
the original Swagger feature documentation:

- Concept: `documents/FEAT-3/plans/add-swagger.md` (FEAT-4 addendum at the bottom).
- Implementation: `documents/FEAT-3/development/add-swagger.md` (FEAT-4 addendum
  at the bottom — includes the `backend/src/common/swagger-cdn.ts` source).

This PRD does not duplicate that material; it just notes that the Swagger fix is
landed under the FEAT-4 umbrella because both failures only show up at deploy
time and need to be released together.

Both failure modes were resolved upstream in the sister `bread` repo (commits
`d7030c7` / `b9ba397` for the shared package fix; `addc10b` for the Swagger CDN
shell). FEAT-4 ports those fixes back into this boilerplate so future projects do
not relearn them.

## Solution Overview

Two workstreams owned directly by this PRD:

1. Build `@repo/shared` into `dist/` and point package metadata at the compiled
   JS. Stop bypassing it via FE tsconfig `paths`.
2. Rewrite `backend/vercel.json` to the modern `functions` + `rewrites` schema,
   build `shared` during `installCommand`, and ship the `shared/**/*` tree into
   the lambda via `includeFiles`.

Plus one Swagger workstream documented in the FEAT-3 addendum:

3. Replace `SwaggerModule.setup('/')` with a CDN-backed UI shell so the docs page
   uses one code path locally and on Vercel. (Details in the FEAT-3 addendum;
   listed here only because the code change ships in the same PR.)

The local dev experience does not change; only the build artifacts and request-time
HTML do.

## User Stories

1. As a backend developer, when I deploy this boilerplate to Vercel, every
   route — including ones that import `@repo/shared` — must respond `200` with a
   real JSON payload, not a `SyntaxError`.
2. As a future maintainer, I should not have to keep `@repo/shared`'s `paths`
   alias in `frontend/tsconfig.json` working in lockstep with
   `shared/package.json` — TypeScript should resolve the package the same way
   Node does.
3. As an API consumer, when I open the deployed backend URL, the Swagger UI
   must render and let me try endpoints, just like it does on
   `http://localhost:3000`. *(Implementation tracked under FEAT-3.)*
4. As a reviewer, I should be able to spot Vercel-specific failure modes from
   `documents/` without re-running a deploy.

## Implementation Decisions

### Modules

- **`@repo/shared` build pipeline** — `documents/FEAT-4/development/shared-package-build.md`
  - Real `tsc` build into `shared/dist/` (was `tsc --noEmit`).
  - `package.json#main` / `types` / `exports` point at `dist/index.js` / `dist/index.d.ts`.
  - `shared/.gitignore` holds `dist/` to keep the workspace self-contained.
  - `shared/tsconfig.json` enables `declarationMap` and excludes `dist`.
  - `typescript` declared on the workspace so `tsc` is hoisted into
    `shared/node_modules/.bin/`.

- **Frontend module resolution** — `documents/FEAT-4/development/frontend-tsconfig.md`
  - Drop the `@repo/shared` alias in `frontend/tsconfig.json#compilerOptions.paths`
    so the FE goes through `package.json#exports` like every other consumer.

- **Backend Vercel config** — `documents/FEAT-4/development/vercel-config.md`
  - `vercel.json` switches to `version: 2` + `functions` + `rewrites`.
  - `installCommand` runs `npm install` at the repo root, then
    `(cd shared && npm run build)` so `shared/dist/` exists before tracing.
  - `functions["api/index.ts"].includeFiles` is the **string** glob
    `"../shared/**/*"` (Vercel's schema rejects an array in this field).

- **Swagger CDN shell** — owned by FEAT-3; see
  `documents/FEAT-3/development/add-swagger.md` (FEAT-4 addendum) for the
  `backend/src/common/swagger-cdn.ts` helper and the entry-point edits.

### Architecture

- **Compile boundary at the workspace edge.** Consumers always import
  `@repo/shared` via package metadata, never via TS `paths`. This makes the
  resolution behaviour identical for `tsc`, Next, Nest's `tsc`-based build,
  Jest, and Node at runtime in the lambda.
- **Modern `vercel.json` only.** Legacy `builds` + `routes` is incompatible with
  `includeFiles` and traces monorepo symlinks unreliably. The new schema is
  required for the lambda to actually contain `shared/dist/`.

### APIs/Interfaces

- No public API of `@repo/shared` changes. Consumers keep importing
  `import { HealthResponse } from '@repo/shared'`.
- No backend route signatures change. `GET /api/health` still returns
  `HealthResponse`.
- The new `setupSwaggerCdn(app, document)` helper is internal to the backend
  workspace and documented in the FEAT-3 addendum.

### Trade-offs

- **Build step order matters.** `installCommand` must build `shared` before
  Vercel runs the `buildCommand` for `backend`, otherwise `nest build` will fail
  to resolve `@repo/shared` types. Documented in the install command itself.
- **Removing the FE `paths` alias** means the FE relies on `shared/dist/`
  existing. Locally this works because `npm install` symlinks the workspace and
  `npm run build` (root) builds `shared` first. We should not run FE-only
  builds without first building `shared`; the existing turborepo wiring already
  enforces this.

## Testing Strategy

- **Local sanity:** `npm run dev` from repo root. Verify:
  - `http://localhost:3000/api/health` returns `{ status: 'ok', timestamp: ... }`.
  - `http://localhost:3001/` (FE) renders and `useHealth` succeeds.
  - Swagger-specific checks live in the FEAT-3 addendum.
- **Build correctness:** `npm run build` from repo root. Verify:
  - `shared/dist/index.js` and `shared/dist/index.d.ts` are produced.
  - `backend/dist/` builds without TS errors against `@repo/shared` resolved
    through `dist/`.
  - `frontend/.next/` builds with the `paths` alias removed.
- **Vercel deploy:** push to a Vercel preview environment; verify:
  - `GET /api/health` returns `200` with real JSON (no `SyntaxError`). This is
    the FEAT-4-owned acceptance check.
  - `GET /` and `GET /api-json` checks live in the FEAT-3 addendum.

No new automated tests; this is a deployment-shape change, not a feature.

## Out of Scope

- Authentication for Swagger UI in production.
- API versioning (`/api/v1`, `/api/v2`).
- Switching `@repo/shared` to ESM-only output.
- Changes to the FE `useHealth` query, `apiClient`, or any business logic.
- Alternative Swagger fixes (Option A — bundling `swagger-ui-dist` into the
  lambda) — discussed and rejected in the FEAT-3 addendum.

## Status

- [x] Planning
- [ ] In Development
- [ ] Complete

## References

- `documents/FEAT-3/plans/add-swagger.md` and
  `documents/FEAT-3/development/add-swagger.md` — Swagger feature, with FEAT-4
  addendums covering the Vercel blank-page fix.
- `bread` repo commits: `d7030c7`, `b9ba397` (shared package fix), `addc10b`
  (Swagger CDN shell).
- Vercel docs: `functions[*].includeFiles`, `installCommand`.
