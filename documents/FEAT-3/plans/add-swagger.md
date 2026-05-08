# FEAT-3: Add Swagger API Documentation to NestJS Backend

## Overview

This feature adds comprehensive Swagger/OpenAPI documentation to the NestJS backend, making API documentation accessible at the root URL (localhost:3000 or the deployed Vercel URL).

## Requirements

### Functional Requirements

1. **Swagger UI at Root Path**
   - The backend homepage (`/`) must display an interactive Swagger UI
   - Must work in both local development and production (Vercel deployment)

2. **API Documentation**
   - Document all existing API endpoints:
     - `GET /api/health` - Health check endpoint
   - Include detailed request/response schemas
   - Display example responses

3. **OpenAPI Specification**
   - Generate and serve OpenAPI JSON specification at `/api-json`
   - Follow OpenAPI 3.0 standard

4. **Maintain Frontend Compatibility**
   - Ensure frontend can continue calling backend APIs without breaking changes
   - Update routing configuration to align backend and frontend URL structures

### Non-Functional Requirements

1. **Performance**
   - Minimal impact on application startup time
   - Accept ~200-300ms additional cold start time in serverless environment

2. **Maintainability**
   - Use decorators for inline API documentation
   - Documentation stays synchronized with code changes
   - Follow NestJS best practices

3. **Type Safety**
   - Leverage existing shared types from `@repo/shared`
   - Create DTOs that implement shared interfaces
   - Maintain type safety across frontend and backend

## Current State Analysis

### Backend Architecture
- **Framework**: NestJS 11.0.0
- **Endpoints**: 1 route without `/api` prefix
  - `GET /health` → Returns `HealthResponse` object
- **Shared Types**: TypeScript interfaces in `@repo/shared` package
- **Deployment**: Dual setup
  - Local development: Traditional NestJS server (port 3000)
  - Production: Vercel serverless functions

### Frontend Integration
- **API Client**: Calls `/api/health` (expects `/api` prefix)
- **Next.js Rewrite**: Currently strips `/api` prefix for local development
  - Pattern: `/api/:path*` → `backend/:path*`
  - Example: Frontend `/api/health` → Backend `/health`
- **Mismatch**: Frontend expects `/api` prefix, but backend doesn't use it

### Key Challenge
The root path (`/`) is currently occupied by the hello message endpoint, but Swagger UI needs to be served at this location for maximum discoverability.

## Proposed Solution

### Architecture Changes

#### 1. Route Restructuring
Reorganize backend routes to follow industry standards:

**Before:**
```
GET /         → (Not used)
GET /health   → Health check
```

**After:**
```
GET /              → Swagger UI
GET /api/health    → Health check
GET /api-json      → OpenAPI specification (auto-generated)
```

**Benefits:**
- Root path freed for documentation (industry standard)
- All API endpoints under consistent `/api` prefix
- Aligns with REST API best practices
- Matches frontend architectural expectations

#### 2. Frontend Configuration Update
Update Next.js rewrite to preserve `/api` prefix:

**Before:**
```typescript
destination: `${BACKEND_URL}/:path*`  // strips /api
```

**After:**
```typescript
destination: `${BACKEND_URL}/api/:path*`  // preserves /api
```

**Benefits:**
- Consistent URL structure in all environments
- Removes "magic" prefix transformation
- More transparent and maintainable

#### 3. DTO Pattern Implementation
Create Data Transfer Object (DTO) classes for Swagger documentation:

**Strategy: Hybrid Approach**
- DTOs implement existing shared interfaces from `@repo/shared`
- Add `@ApiProperty` decorators for Swagger metadata
- Use DTOs as return types in controllers and services

**Example:**
```typescript
export class HealthResponseDto implements HealthResponse {
  @ApiProperty({
    enum: ['ok', 'error'],
    example: 'ok',
    description: 'Health check status'
  })
  status: 'ok' | 'error';

  @ApiProperty({
    example: '2026-03-24T10:30:00.000Z',
    description: 'ISO timestamp'
  })
  timestamp: string;
}
```

**Benefits:**
- Preserves shared types (no breaking changes for frontend)
- Rich Swagger metadata via decorators
- Foundation for future request validation with `class-validator`
- Type safety maintained across the stack

### Technology Stack

#### New Dependencies
- **@nestjs/swagger** (^11.2.6): Official NestJS OpenAPI integration compatible with NestJS 11
- **swagger-ui-express** (peer dependency): Swagger UI rendering
- **@types/swagger-ui-express** (^4.1.6, dev): TypeScript type definitions

#### Swagger Configuration
```typescript
const config = new DocumentBuilder()
  .setTitle('NestJS Backend API')
  .setDescription('API documentation for fullstack boilerplate')
  .setVersion('1.0')
  .addTag('api')
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('/', app, document);
```

**Configuration applies to:**
- `backend/src/main.ts` - Local development server
- `backend/api/index.ts` - Vercel serverless handler

### Implementation Components

#### Backend Changes

1. **Controller Decorators**
   - `@Controller('api')` - Add route prefix
   - `@ApiTags('api')` - Group endpoints in Swagger
   - `@ApiOperation()` - Describe endpoint purpose
   - `@ApiResponse()` - Document response schemas

2. **DTO Creation**
   - Create `backend/src/dto/` directory
   - Define DTO classes with Swagger decorators
   - Barrel export from `dto/index.ts` (optional)

3. **Service Updates**
   - Update return types to use DTOs
   - No runtime logic changes required

4. **Swagger Setup**
   - Configure in both entry points (local + serverless)
   - Identical configuration for consistency

#### Frontend Changes

1. **Next.js Configuration**
   - Update rewrite rule to preserve `/api` prefix
   - No changes to API client code (already uses `/api/health`)

### Deployment Considerations

#### Local Development
- Swagger UI accessible at `http://localhost:3000/`
- APIs accessible at `http://localhost:3000/api/*`
- OpenAPI spec at `http://localhost:3000/api-json`

#### Vercel Production
- Swagger UI accessible at backend URL root
- All routes handled by single serverless function
- Cold start increases by ~200-300ms (acceptable)
- No file system dependencies (Swagger UI served in-memory)

## Trade-offs and Decisions

### Decision 1: Move APIs Under `/api` Prefix
**Chosen Approach:** Restructure all endpoints under `/api` prefix

**Alternatives Considered:**
- Option A: Keep routes as-is, serve Swagger at `/docs`
- Option B: Serve Swagger at `/swagger` or `/api-docs`

**Rationale for Decision:**
- ✅ Industry standard (GitHub, Stripe, Twilio all use this pattern)
- ✅ Aligns with existing frontend architecture
- ✅ More discoverable (documentation at root)
- ✅ Better separation of concerns
- ⚠️ Requires frontend configuration update (minimal impact)

### Decision 2: Hybrid DTO Strategy
**Chosen Approach:** DTOs implement shared interfaces

**Alternatives Considered:**
- Option A: Pure interfaces (doesn't work - decorators need classes)
- Option B: Replace shared interfaces with DTOs (breaking change)
- Option C: Duplicate documentation in controller decorators (verbose)

**Rationale for Decision:**
- ✅ Preserves existing shared types
- ✅ No breaking changes for frontend
- ✅ Rich metadata via decorators
- ✅ Foundation for future validation
- ⚠️ Slight duplication (acceptable tradeoff)

### Decision 3: Enable Swagger in All Environments
**Chosen Approach:** Deploy Swagger to production

**Alternatives Considered:**
- Option A: Development only (conditional setup)
- Option B: Separate documentation deployment

**Rationale for Decision:**
- ✅ Always-available documentation
- ✅ Consistent developer experience
- ✅ Useful for frontend developers and API consumers
- ⚠️ Minor performance impact (~200-300ms cold start)
- ⚠️ Can disable later if needed

## Success Criteria

The implementation will be considered successful when:

1. ✅ **Root URL displays Swagger UI**
   - Accessible at `http://localhost:3000/` (local)
   - Accessible at deployed Vercel URL (production)

2. ✅ **All APIs documented**
   - `GET /api/health` endpoint documented with HealthResponse schema
   - Schemas match actual implementations

3. ✅ **OpenAPI specification available**
   - JSON spec accessible at `/api-json`
   - Follows OpenAPI 3.0 standard

4. ✅ **Frontend integration works**
   - Existing `apiClient.health.get()` continues working
   - No breaking changes for frontend

5. ✅ **Consistent across environments**
   - Works identically in local dev and production
   - No environment-specific workarounds needed

6. ✅ **Interactive testing possible**
   - Swagger UI "Try it out" feature works
   - Can test endpoints directly from documentation

## Future Enhancements

### Short-term (Next Sprint)
- Add request validation using `class-validator`
- Document error responses (400, 404, 500)
- Add authentication documentation when auth is implemented

### Medium-term (Next Quarter)
- API versioning (`/api/v1`, `/api/v2`)
- Environment-conditional Swagger (disable in production if needed)
- Custom Swagger theme matching brand colors
- Add examples for all endpoints

### Long-term (Next 6 Months)
- Automated API testing based on OpenAPI spec
- Client SDK generation from OpenAPI spec
- API changelog generation
- Performance monitoring and analytics

## References

- [NestJS OpenAPI Documentation](https://docs.nestjs.com/openapi/introduction)
- [OpenAPI Specification 3.0](https://swagger.io/specification/)
- [Swagger UI Documentation](https://swagger.io/tools/swagger-ui/)
- [NestJS Best Practices](https://docs.nestjs.com/techniques/documentation)

## Ticket Information

- **Ticket ID**: FEAT-3
- **Type**: Feature
- **Priority**: High
- **Estimated Effort**: 2-3 hours
- **Dependencies**: None

---

## Addendum (FEAT-4): Vercel Failure Mode and CDN Shell

The original FEAT-3 plan is correct for local development, but `SwaggerModule.setup('/')`
breaks once the backend is deployed to Vercel. Capturing the failure mode and the chosen
fix here so the next person reading the FEAT-3 plan does not repeat the discovery.

### Symptom

- Local `npm run dev`: `http://localhost:3000/` renders Swagger UI normally.
- Vercel deploy: the same URL returns `200` and the HTML loads, but the page is blank.
  `<div id="swagger-ui">` never gets populated; the browser console shows `404`s for
  `./swagger-ui.css`, `./swagger-ui-bundle.js`, and `./swagger-ui-standalone-preset.js`.

### Root Cause

`SwaggerModule.setup` from `@nestjs/swagger@11` emits HTML with **relative** asset URLs.
Locally Express serves those files from `node_modules/swagger-ui-dist`. On Vercel,
`@vercel/nft` traces lambda dependencies statically; the runtime `fs` reads
`SwaggerModule` performs are not visible to the tracer, the assets are missing from
the lambda, and the `<script>` tags 404. `window.SwaggerUIBundle` therefore never
registers, and the UI bootstrap script silently no-ops.

Patching `customCssUrl` / `customJs` on `SwaggerModule.setup` is **not** a fix:
`@nestjs/swagger@11` does not actually inject those overrides into the produced HTML.
Verified during the FIX-5/bread-repo investigation.

### Fix (Option B, chosen)

Replace `SwaggerModule.setup('/')` with a small CDN-backed UI shell that registers
two routes directly on the HTTP adapter:

- `GET /api-json` — returns the OpenAPI document produced by
  `SwaggerModule.createDocument(...)`.
- `GET /` — returns a fixed HTML shell whose `<link>` and `<script>` tags load
  Swagger UI assets from `cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14`.

The HTML shell is identical in dev and prod, so the "works locally / blank in prod"
failure mode disappears. The full implementation — including the
`backend/src/common/swagger-cdn.ts` source and the entry-point edits — lives in
the addendum at the bottom of `documents/FEAT-3/development/add-swagger.md`.

### Alternative Considered (Option A)

Copy `swagger-ui-dist` into the lambda via `vercel.json#functions[*].includeFiles`,
keeping `SwaggerModule.setup` on the Nest side. Rejected because:

- Adds ~2 MB to every cold start.
- Re-introduces a dev/prod divergence (locally Express serves the files; in prod the
  lambda serves them from the bundled tree).
- Still leaves the relative-URL HTML emitted by `SwaggerModule.setup` as the source
  of truth, which makes future swagger-ui upgrades brittle.

The CDN shell is a smaller diff and produces a single code path everywhere.

### Cross-References

- FEAT-4 PRD (deployment hardening umbrella): `documents/FEAT-4/plans/prd.md`
- Implementation: see the addendum in `documents/FEAT-3/development/add-swagger.md`
- Vercel config dependency: `documents/FEAT-4/development/vercel-config.md`
