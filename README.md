# Horizon Travel Agency Platform – Backend

Multi-tenant SaaS backend for Algerian travel agencies. Provides JWT authentication, agency isolation, content management, booking, installments, and super-admin controls.

## Quick Start
1. Copy `.env.example` to `.env` and fill in required secrets (JWT_SECRET, ENCRYPTION_KEY).
2. `npm install`
3. `npm start` (runs on port 3000 by default)

## API Documentation
See `server/routes/` for endpoint definitions. Public content at `/api/content/:agencyId/:type`.

## Security
- JWT in httpOnly, SameSite=Strict cookies (HS512)
- CORS whitelist
- Rate limiting on auth
- AES-256-GCM for passport data
- RLS enforced via tenant middleware

## Deployment
Set `NODE_ENV=production` and use PostgreSQL (migration scripts included).
