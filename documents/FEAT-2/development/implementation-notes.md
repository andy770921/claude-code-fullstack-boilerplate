# FEAT-2: Implementation Notes

Records the differences between actual implementation and original plan, and the final state after simplification and refactoring.

---

## Final File List

### Added

| Path                                                         | Description                                              |
| ------------------------------------------------------------ | -------------------------------------------------------- |
| `shared/src/types/health.ts`                                 | `HealthResponse` type                                    |
| `shared/src/types/api.ts`                                    | `ApiResponse<T>` generic                                 |
| `shared/src/index.ts`                                        | barrel export                                            |
| `shared/package.json`                                        | `@repo/shared` workspace                                 |
| `shared/tsconfig.json`                                       | TypeScript configuration                                 |
| `frontend/src/app/layout.tsx`                                | Root layout, wraps Providers                             |
| `frontend/src/app/page.tsx`                                  | Home page, calls `useHealth()`                           |
| `frontend/src/app/providers.tsx`                             | `TanStackQueryProvider` wrapper                          |
| `frontend/src/constants/common.ts`                           | `HTTP_STATUS_CODE`                                       |
| `frontend/src/queries/use-health.ts`                         | `useHealth()` hook                                       |
| `frontend/src/lib/api-client.ts`                             | Named API client                                         |
| `frontend/src/utils/fetchers/fetchers.ts`                    | `fetchApi` + `streamingFetchApi`                         |
| `frontend/src/utils/fetchers/fetchers.utils.ts`              | `FetchOptions`, `getFetchQueryOptions`, `parseErrorBody` |
| `frontend/src/utils/fetchers/fetchers.error.ts`              | `ApiResponseError`                                       |
| `frontend/src/utils/fetchers/fetchers.client.ts`             | client-side `defaultFetchFn`, `streamingFetchFn`         |
| `frontend/src/vendors/tanstack-query/provider.tsx`           | `TanStackQueryProvider`, configures global `queryFn`     |
| `frontend/src/vendors/tanstack-query/provider.utils.ts`      | `stringifyQueryKey`                                      |
| `frontend/src/vendors/tanstack-query/provider.utils.spec.ts` | `stringifyQueryKey` unit tests                           |
| `frontend/next.config.ts`                                    | Next.js config, `/api/*` rewrite → backend               |
| `frontend/vercel.json`                                       | `{ "framework": "nextjs" }`                              |

### Deleted (Vite Related)

- `frontend/index.html`
- `frontend/vite.config.ts`
- `frontend/tsconfig.node.json`
- `frontend/.eslintrc.cjs`
- `frontend/src/App.tsx`, `App.css`, `App.test.tsx`, `main.tsx`, `setupTests.ts`
- `frontend/package-lock.json` (now managed by root `package-lock.json`)
- `backend/.eslintrc.js` (merged into root `.eslintrc.js`)

---

## Differences from Plan

### 1. `fetchers.ts`: AbortController Replaces Promise.race Timeout Mechanism

**Plan (RFC-C)**: Use `Promise.race([fetchPromise, timeoutPromise])` for timeout implementation.

**Actual**: Changed to use `AbortController`.

```typescript
// Final implementation
const controller = new AbortController();
const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => controller.abort(), timeout);
try {
  const rawResponse = await fetch(url, {
    ...getFetchQueryOptions(options),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);
  // ...
} catch (error) {
  clearTimeout(timeoutId);
  if (error instanceof DOMException && error.name === 'AbortError') {
    throw new ApiResponseError(timeoutResponse, timeoutErrorBody, 'Request timeout');
  }
  throw error;
}
```

**Reasons**:

- In the `Promise.race` version, after timeout, the `fetch` promise continues executing, causing connection leaks. This is especially problematic for `streamingFetchApi` with long-lived connections.
- `AbortController` actively cancels the underlying connection.
- Removed meaningless `try { ... } catch (error) { throw error; }` wrappers in both functions (previously had `// eslint-disable-next-line no-useless-catch` comments to suppress warnings).
- Added explicit type `ReturnType<typeof setTimeout>` to `timeoutId`.

### 2. `fetchers.utils.ts`: `parseErrorBody` Removes `.clone()` and Type Lies

**Plan**: Implementation details were not explicitly specified.

**Actual Changes**:

```typescript
// Before
let errorBody: TErrorBody | string = '' as TErrorBody;
// ...
errorBody = (await response.clone().json()) as TErrorBody;
// ...
errorBody = (await response.clone().text()) as TErrorBody;
// ...
errorBody = '' as TErrorBody;

// After
let errorBody: TErrorBody | string = '';
// ...
errorBody = (await response.json()) as TErrorBody;
// ...
errorBody = await response.text();
// ...
errorBody = '';
```

**Reasons**:

- `'' as TErrorBody` is a type lie — callers expect to receive `TErrorBody`, but actually get an empty string, causing runtime crashes when accessing `.error.message`. Since the return type is already `TErrorBody | string`, directly assigning `''` is completely legal.
- When `parseErrorBody` is called in `streamingFetchApi`, the response body hasn't been read yet, so `.clone()` is unnecessary; reading the original response directly is sufficient.

### 3. `fetchers.client.ts`: `baseUrl` Changed to Point to Backend

**Plan (RFC-C)**: `baseUrl = window.location.origin` (i.e., `http://localhost:3001`), with Next.js rewrite forwarding `/api/*` to backend.

**Actual**:

```typescript
// Before (planned version)
const baseUrl = window.location.origin;

// After (actual)
const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
```

**Reasons**:

- `window.location.origin` points to the Next.js frontend (`:3001`). `defaultFetchFn('health')` generates URL `/health`, but Next.js rewrite only applies to `/api/*`, so `/health` hits the Next.js server directly, returning 404.
- Changed baseUrl to point directly to backend (`:3000`), so `queryKey: ['health']` → `stringifyQueryKey` → `'health'` → `http://localhost:3000/health` correctly reaches backend.
- Default value `'http://localhost:3000'` is consistent with the rewrite destination in `next.config.ts`:

  ```typescript
  // next.config.ts
  destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/:path*`;
  ```

- Backend has enabled `origin: true` CORS, allowing cross-origin requests from `:3001`, so there are no CORS issues.

### 4. `use-health.ts`: Uses `useQuery<HealthResponse>` Type Parameter

**Plan (RFC-C)**:

```typescript
export function useHealth() {
  return useQuery({ queryKey: ['health'] });
}
```

**Actual**:

```typescript
import type { HealthResponse } from '@repo/shared';

export function useHealth() {
  return useQuery<HealthResponse>({
    queryKey: ['health'],
  });
}
```

**Reason**: Without an explicit `queryFn`, TanStack Query cannot infer the shape of `data` from types, and `data` becomes `unknown`. When `page.tsx` tries to access `data.status` and `data.timestamp`, it causes TypeScript compilation errors. Adding the type parameter allows `data` to be correctly inferred as `HealthResponse`.

### 5. ESLint: Unified to Root `.eslintrc.js`

**Plan**: Not explicitly specified.

**Actual**:

- Deleted `backend/.eslintrc.js` and `frontend/.eslintrc.cjs`.
- All ESLint configuration centralized in root `.eslintrc.js`, using `overrides` to apply TypeScript, Next.js, and Backend rules separately by path.
- All ESLint-related packages (`@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-config-next`, etc.) installed in root `node_modules`.

---

## Routing Architecture (Final)

```
Browser (localhost:3001)
  └─ useQuery({ queryKey: ['health'] })
       └─ global queryFn: defaultFetchFn(stringifyQueryKey(['health']))
            └─ defaultFetchFn('health')
                 └─ baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'
                      └─ fetch('http://localhost:3000/health')  ← Direct to Backend
                           └─ NestJS GET /health → { status: 'ok', timestamp: '...' }
```

The `/api/health` path in `api-client.ts` (using Next.js rewrite) is preserved for direct call scenarios that don't go through the global queryFn.

---

## Verification Checklist

- [x] `npm install` — No errors
- [x] `npx tsc --noEmit -p frontend/tsconfig.json` — Passed
- [ ] `npm run dev` — FE `:3001`, BE `:3000` both start
- [ ] Browse `http://localhost:3001` — Shows backend health status
- [ ] `npm run build` — Both apps build successfully
- [ ] `npm run lint` — No errors
- [ ] `npm run test` — `provider.utils.spec.ts` passes
