# VECTRA Academy LMS (Shopify app)

Express + TypeScript Shopify app (not Next.js) that powers VECTRA Academy via a Shopify **app proxy**. Theme pages call `/apps/lms/api/*`, which Shopify proxies to this service at `/proxy/api/*`.

Public storefront LMS paths are nested under Marketplace and redirect to Shopify pages:

- `/marketplace/lms` → `/pages/lms-dashboard`
- `/marketplace/lms/learn?assignment=…` → `/pages/lms-learn?assignment=…`
- (full map in repo root `README.md` and `snippets/vectra-redirects.liquid`)

Learner launch URLs returned by this API use `/marketplace/lms/learn?...`.

## Requirements

- Node.js 20+
- MongoDB
- Shopify Partner app with app proxy configured (see `shopify.app.toml`)

## Quick start (local)

```bash
cd apps/lms
cp .env.example .env
# set MONGODB_URI, LMS_DEV_BYPASS=true
npm install
npm run dev
```

Health check: [http://localhost:3456/health](http://localhost:3456/health)

### Dev bypass (no Shopify signature)

When `LMS_DEV_BYPASS=true`, send:

| Header | Purpose |
|--------|---------|
| `X-LMS-Shop` | Shop domain (e.g. `vectra-dev.myshopify.com`) |
| `X-LMS-Customer-Id` | Optional Shopify customer id |
| `X-LMS-Staff` | `true` for staff endpoints |
| `X-LMS-Customer-Tags` | Optional `lms-admin,lms-coordinator` |

Example:

```bash
curl -H "X-LMS-Shop: dev.myshopify.com" -H "X-LMS-Staff: true" \
  http://localhost:3456/proxy/api/participants
```

Theme local override:

```html
<script>window.VECTRA_LMS_API_BASE = 'http://localhost:3456/proxy/api';</script>
```

## App proxy

`shopify.app.toml`:

```toml
[app_proxy]
url = "https://YOUR_APP_HOST/proxy"
subpath = "lms"
prefix = "apps"
```

Storefront path: `/apps/lms/api/...` → app `/proxy/api/...`.

HMAC signature verification uses `SHOPIFY_API_SECRET`.

## Authz

- **Staff:** `staffProfiles` for the customer, or tags `lms-admin` / `lms-coordinator` (or bypass `X-LMS-Staff`)
- **Learners:** `learnerProfiles` linked by `shopifyCustomerId` (auto-link by email when possible)
- **Reminders:** `POST /jobs/reminders` with header `X-Cron-Secret: $CRON_SECRET`

## API surface

| Method | Path | Access |
|--------|------|--------|
| GET | `/health` | public |
| GET/POST | `/proxy/api/participants` | staff / admin |
| POST | `/proxy/api/participants/import` | admin |
| GET/POST | `/proxy/api/fields` | staff |
| GET | `/proxy/api/roles` | staff |
| GET/POST | `/proxy/api/users` | staff |
| GET/POST | `/proxy/api/courses` | staff (multipart SCORM) |
| GET/POST | `/proxy/api/assignments` | staff |
| GET | `/proxy/api/reports` (+ `/csv`) | staff |
| GET | `/proxy/api/dashboard` | staff |
| GET/PATCH | `/proxy/api/profile` | learner |
| GET | `/proxy/api/learn` | learner |
| GET | `/proxy/api/learn/:assignmentId` | learner |
| POST | `/proxy/api/progress` | learner |
| GET | `/proxy/content/:courseId/*` | authenticated |
| POST | `/jobs/reminders` | cron secret |

## Storage

- Default: local `./storage/courses`
- Optional Cloudflare R2 via `R2_*` env vars

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Watch mode (`tsx`) |
| `npm start` | Production-style start |
| `npm run typecheck` | `tsc --noEmit` |

See `STATUS.md` for scaffold progress vs the Shopify LMS plan.
