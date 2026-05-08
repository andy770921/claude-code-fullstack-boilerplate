# Implementation Plan: `@repo/shared` Build Pipeline

## Overview

Stop shipping the raw `shared/src/*.ts` tree to consumers. Compile to `shared/dist/`, point package metadata there, and let module resolution work the same way for Node, Next, Nest, Jest, and the Vercel lambda runtime.

## Files to Modify

### Shared Workspace

- `shared/package.json`
  - Repoint `main` and `types` from `src/index.ts` to compiled output under `dist/`.
  - Add `exports` map so modern resolvers honor it.
  - Replace `build: "tsc --noEmit"` with a real `tsc` build.
  - Add `dev: "tsc --watch"` so iterative work in `shared/` is picked up by FE/BE running `npm run dev`.

- `shared/tsconfig.json`
  - Enable `declarationMap` so editors can jump to the original `.ts` source.
  - Add `exclude: ["dist"]` so emitted files do not feed back into the next build.

- `shared/.gitignore` *(new file)*
  - Single line: `dist/`
  - Root `.gitignore` already covers it; this file keeps the workspace self-contained for anyone copying it elsewhere.

## Step-by-Step Implementation

### Step 1: Rewrite `shared/package.json`

**File:** `shared/package.json`

**Changes:**

```json
{
  "name": "@repo/shared",
  "version": "1.0.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "lint": "eslint src"
  },
  "devDependencies": {
    "typescript": "^5.7.3"
  }
}
```

**Rationale:**
- `main`/`types` must resolve to compiled JS/d.ts. The Vercel lambda is plain Node — it cannot parse `export ... from './foo'` written in TypeScript.
- `exports` blocks deep imports and makes the package boundary explicit.
- `tsc --noEmit` was the entire bug: nothing was ever produced under `dist/`.
- `typescript` must be declared on this workspace explicitly. npm workspaces only hoist a `tsc` binary into a workspace's `node_modules/.bin/` if that workspace declares the dep; otherwise `npm run build` fails with `sh: tsc: command not found`. Match the version pin used by `backend/` and `frontend/` (`^5.7.3` today) to avoid drift.

### Step 2: Update `shared/tsconfig.json`

**File:** `shared/tsconfig.json`

**Changes:**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "node",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["dist"]
}
```

**Rationale:**
- `declarationMap` keeps "Go to Definition" jumping into the original `.ts` source instead of the generated `.d.ts`.
- `exclude: ["dist"]` prevents `tsc` from recursively compiling its own output once it exists.

### Step 3: Add `shared/.gitignore`

**File:** `shared/.gitignore` *(new)*

**Content:**

```
dist/
```

**Rationale:** Optional, but makes the workspace portable.

## Testing Steps

1. From repo root: `npm install` (no-op if already installed).
2. From repo root: `npm run build`.
3. Verify `shared/dist/index.js` and `shared/dist/index.d.ts` exist.
4. From `backend/`: `npm run build`. The Nest build must succeed; `@repo/shared` now resolves through compiled JS.
5. From `frontend/`: `npm run build`. Next must succeed; combined with Step 1 of `frontend-tsconfig.md`, FE no longer goes through the TS source file directly.
6. Quick smoke: `node -e "console.log(require('@repo/shared'))"` from `backend/` should print the exported names without a `SyntaxError`.

## Dependencies

- Must complete before: `vercel-config.md` (Vercel `installCommand` builds `shared/` and bundles `dist/`).
- Depends on: nothing.

## Notes

- After updating `package.json`, run `npm install` from the repo root once so the new `typescript` entry is materialized into `shared/node_modules/.bin/tsc`. Without that, `npm run build -w shared` fails with `tsc: command not found`.
- Do **not** delete `shared/src/`. `dist/` is build output; `src/` is the source of truth.
