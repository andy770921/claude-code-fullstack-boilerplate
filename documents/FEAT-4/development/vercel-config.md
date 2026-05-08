# Implementation Plan: Modernize `backend/vercel.json`

## Overview

The current `backend/vercel.json` uses the legacy `builds` + `routes` schema. In that mode, `@vercel/nft` traces the lambda's file dependencies through the `node_modules` symlink to `../shared/`, which is unreliable in a monorepo workspace setup. Even after `@repo/shared` is built into `dist/`, the lambda often does not contain those files at runtime.

Migrate to the modern `version: 2` schema with `functions` + `rewrites`, build `shared/` during `installCommand`, and use `includeFiles` to ship the `shared/**/*` tree into the lambda.

## Files to Modify

### Backend

- `backend/vercel.json` — full rewrite.

## Step-by-Step Implementation

### Step 1: Rewrite `backend/vercel.json`

**File:** `backend/vercel.json`

**Before:**

```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/index.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "api/index.ts",
      "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    }
  ]
}
```

**After:**

```json
{
  "version": 2,
  "installCommand": "cd .. && npm install && cd shared && npm run build",
  "buildCommand": "npm run build",
  "functions": {
    "api/index.ts": {
      "includeFiles": "../shared/**/*"
    }
  },
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/api/index.ts"
    }
  ]
}
```

**Key points:**
- `installCommand` runs at the repo root: install all workspaces, then explicitly build `shared/` so `shared/dist/` exists before tracing.
- `buildCommand` is the per-workspace `nest build` (Vercel runs it from `backend/`).
- `functions["api/index.ts"].includeFiles` is a **single string**, not an array. The Vercel JSON schema rejects arrays here; this was a real footgun in the sister repo.
- The glob `"../shared/**/*"` is relative to the function file (`backend/api/index.ts`), which is why the path goes up one level to `../shared/`.
- `rewrites` replaces `routes`. Same effect: every path goes through the single function.

### Step 2: Confirm Vercel project root

In the Vercel project settings, the **root directory** for this deployment must be `backend/`. The relative paths in `installCommand` and `includeFiles` assume that.

## Testing Steps

1. Push the branch to a Vercel preview environment.
2. Watch the deploy log:
   - "Installing dependencies" should run at the repo root and succeed.
   - "Building" should produce `shared/dist/index.js` before `nest build` runs.
   - The function bundle should list files under `shared/dist/` in the trace.
3. Hit `https://<preview>.vercel.app/api/health`. Expect `200` with `{ status: 'ok', timestamp: ... }` — **not** a `SyntaxError` traceback.
4. Hit `https://<preview>.vercel.app/api-json`. Expect the OpenAPI document.
5. Hit `https://<preview>.vercel.app/`. Expect the Swagger UI (covered in the FEAT-4 addendum at `documents/FEAT-3/development/add-swagger.md`).

## Dependencies

- Depends on: `shared-package-build.md` (otherwise `installCommand` has nothing to build).
- Must complete before: any production traffic. Hold off on promoting until preview is green.

## Notes

- If the deploy log shows `cd: shared: No such file or directory`, the project root is set to the wrong workspace. Set it back to `backend/`.
- If `includeFiles` is rejected at deploy time with a schema error, double-check it's a string not an array — Vercel's error message is unhelpful here.
- Do **not** keep both `builds` and `functions`. Vercel ignores `functions` when `builds` is present.
