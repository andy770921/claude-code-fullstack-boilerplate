# Implementation Plan: Remove `@repo/shared` `paths` Alias from Frontend

## Overview

`frontend/tsconfig.json` currently declares `paths: { "@repo/shared": ["../shared/src/index.ts"] }`. That alias forces TypeScript to resolve the package straight at the `.ts` source, completely bypassing `shared/package.json`. It hides the bug fixed in `shared-package-build.md`: as long as the alias was in place, the FE compiled fine even though `shared/package.json` was misconfigured.

Now that `@repo/shared` produces a real `dist/`, the FE should resolve it the same way Node does in the lambda.

## Files to Modify

### Frontend

- `frontend/tsconfig.json`
  - Remove the `@repo/shared` entry from `compilerOptions.paths`. Keep the `@/*` alias for app-internal imports.

## Step-by-Step Implementation

### Step 1: Edit `frontend/tsconfig.json`

**File:** `frontend/tsconfig.json`

**Before:**

```json
"paths": {
  "@/*": ["./src/*"],
  "@repo/shared": ["../shared/src/index.ts"]
}
```

**After:**

```json
"paths": {
  "@/*": ["./src/*"]
}
```

**Rationale:**
- TypeScript should follow `@repo/shared`'s `package.json` (`main`/`types`/`exports`) the same way Next, Nest, Node, and Vercel's lambda runtime do.
- Keeping the alias means a misconfigured `shared/package.json` is invisible from FE land — exactly how the Vercel `SyntaxError` slipped through last time.
- The `@/*` app alias is unrelated and stays.

## Testing Steps

1. From `frontend/`: `npx tsc --noEmit`. Compilation should succeed; `@repo/shared` resolves through `shared/dist/index.d.ts`.
2. From `frontend/`: `npm run build`. Next build should succeed.
3. Hover any `import { HealthResponse } from '@repo/shared'` — "Go to Definition" should land on `shared/dist/index.d.ts` (and, with `declarationMap` from `shared-package-build.md` Step 2, jump on to `shared/src/types/health.ts`).

## Dependencies

- Depends on: `shared-package-build.md` (the FE will fail to type-check if `shared/dist/` does not exist yet).
- Must complete before: a Vercel deploy of the FE workspace, if/when one is added.

## Notes

- If at some point we want shared *internal* imports (e.g. `@repo/shared/types/health`), do that via `package.json#exports` — don't reintroduce a TS alias.
