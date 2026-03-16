# Closechain AI

## Overview

Closechain AI is a web application for General Contractors in interior construction to manage closeout packages and documents. It provides multi-project dashboard, subcontractor management (manual + CSV import), CSI-code-based auto-assignment of required closeout documents, file upload per document slot, progress tracking, GC approval flow, and a client portal.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Frontend**: React + Vite + Tailwind CSS + Radix UI
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Replit Auth (OpenID Connect with PKCE)
- **File Storage**: Replit Object Storage (GCS presigned URL flow)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/            # Express API server
│   └── closechain-ai/         # React + Vite frontend (served at /)
├── lib/
│   ├── api-spec/              # OpenAPI spec + Orval codegen config
│   ├── api-client-react/      # Generated React Query hooks
│   ├── api-zod/               # Generated Zod schemas from OpenAPI
│   ├── db/                    # Drizzle ORM schema + DB connection
│   ├── replit-auth-web/       # Replit Auth client-side library
│   └── object-storage-web/    # Object storage client-side library
├── scripts/
│   └── src/
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Schema

- **users** — Replit Auth user profiles (id, email, firstName, lastName, profileImageUrl)
- **projects** — GC projects with name, clientName, description, address, status (active/approved), clientPortalToken
- **subcontractors** — Linked to projects with vendorName, vendorCode, csiCode
- **document_slots** — Linked to subcontractors with documentType, status (not_submitted/uploaded/approved), filePath, fileName

## Key Features

- **CSI Division Auto-Assignment**: When adding a subcontractor with a CSI code (02-16), the system automatically creates required document slots based on the trade division
- **CSV Import**: Subcontractors can be bulk imported via CSV with columns: Vendor Name, Vendor Code, CSI Code
- **File Upload**: Uses presigned URLs via Object Storage for direct uploads
- **GC Approval Flow**: Approve a project to generate a client portal token/link
- **Client Portal**: Public read-only view of approved closeout packages at `/client-portal/:token`

## API Routes

All routes mounted at `/api`:
- `GET /auth/user` — Current user info
- `GET /login` — Begin Replit Auth login flow
- `GET /callback` — OIDC callback
- `GET /logout` — Logout
- `GET/POST /projects` — List/create projects
- `GET/PATCH/DELETE /projects/:projectId` — Get/update/delete project
- `POST /projects/:projectId/approve` — Approve project, generate client portal link
- `GET/POST /projects/:projectId/subcontractors` — List/create subcontractors
- `POST /projects/:projectId/subcontractors/import` — CSV import
- `DELETE /projects/:projectId/subcontractors/:subcontractorId`
- `GET/POST /projects/:projectId/subcontractors/:subcontractorId/documents` — List/add doc slots
- `PATCH/DELETE /documents/:documentSlotId` — Update/delete doc slot
- `GET /projects/:projectId/documents` — List all project documents (filterable)
- `GET /csi/divisions` — List all CSI divisions with required documents
- `GET /client-portal/:token` — Public client portal data
- `POST /storage/uploads/request-url` — Request presigned upload URL
- `GET /storage/objects/public/*` — Get public object
- `GET /storage/objects/*` — Get storage object (authed)

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Development Commands

- `pnpm run typecheck` — Full typecheck
- `pnpm --filter @workspace/api-server run dev` — API server
- `pnpm --filter @workspace/closechain-ai run dev` — Frontend
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API client
- `pnpm --filter @workspace/db run push` — Push DB schema changes
