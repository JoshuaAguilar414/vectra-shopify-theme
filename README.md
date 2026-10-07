# VECTRA Shopify Theme + Academy LMS

Shopify Online Store theme for VECTRA International, plus **VECTRA Academy LMS** powered by:

- Theme Liquid UI (VECTRA branding) under Marketplace URLs
- Shopify Customer Accounts (auth)
- Express Shopify app in [`apps/lms`](apps/lms) (App Proxy API: roster, SCORM, assignments, reports, reminders)
- MongoDB + R2 (or local disk) for LMS domain data and SCORM packages

This is **not** a Next.js app. The storefront is the Shopify theme; the LMS API is Express.

## Architecture

```
/marketplace/lms/*  →  (redirect)  /pages/lms-*  →  Theme Liquid
Theme JS            →  /apps/lms/api/* (App Proxy)  →  apps/lms  →  MongoDB + R2
```

Staff: customer tags `lms-admin` or `lms-coordinator`  
Learners: logged-in customers linked in `learnerProfiles`

## Public LMS URLs

Pretty paths redirect to Shopify pages (client fallback in [`snippets/vectra-redirects.liquid`](snippets/vectra-redirects.liquid)). Mirror the same map in **Shopify Admin → Navigation → URL redirects** for real 301s.

| Pretty path | Shopify page handle |
|-------------|---------------------|
| `/marketplace/lms` | `lms-dashboard` |
| `/marketplace/lms/dashboard` | `lms-dashboard` |
| `/marketplace/lms/my-courses` | `lms-my-courses` |
| `/marketplace/lms/profile` | `lms-profile` |
| `/marketplace/lms/learn` | `lms-learn` |
| `/marketplace/lms/admin` | `lms-admin` |
| `/marketplace/lms/participants` | `lms-participants` |
| `/marketplace/lms/users` | `lms-users` |
| `/marketplace/lms/courses` | `lms-courses` |
| `/marketplace/lms/reports` | `lms-reports` |
| `/marketplace/lms/settings` | `lms-settings` |

API stays at `/apps/lms/api/*`.

## Run LMS API (local)

```bash
cd apps/lms
cp .env.example .env
# set MONGODB_URI, LMS_DEV_BYPASS=true, SHOPIFY_API_SECRET (any long string in bypass)
npm install
npm run dev
```

Health: http://localhost:3456/health

In the browser console on theme pages (or a theme snippet), for local testing:

```js
window.VECTRA_LMS_API_BASE = 'http://localhost:3456/apps/lms/api';
window.VECTRA_LMS_HEADERS = {
  'X-LMS-Shop': 'vectra-dev.myshopify.com',
  'X-LMS-Staff': 'true'
};
```

## Create Shopify Pages

| Handle | Template | Pretty URL |
|--------|----------|------------|
| `lms-admin` | `page.lms-admin` | `/marketplace/lms/admin` |
| `lms-participants` | `page.lms-participants` | `/marketplace/lms/participants` |
| `lms-users` | `page.lms-users` | `/marketplace/lms/users` |
| `lms-courses` | `page.lms-courses` | `/marketplace/lms/courses` |
| `lms-reports` | `page.lms-reports` | `/marketplace/lms/reports` |
| `lms-settings` | `page.lms-settings` | `/marketplace/lms/settings` |
| `lms-dashboard` | `page.lms-dashboard` | `/marketplace/lms` |
| `lms-my-courses` | `page.lms-my-courses` | `/marketplace/lms/my-courses` |
| `lms-profile` | `page.lms-profile` | `/marketplace/lms/profile` |
| `lms-learn` | `page.lms-learn` | `/marketplace/lms/learn` |

Then `shopify theme dev` / push the theme. Configure App Proxy in Partner Dashboard / `apps/lms/shopify.app.toml` so store `/apps/lms` maps to the app `/proxy`.

## Features implemented

- Participants roster CRUD + CSV/XLSX import + bulk delete
- Field definitions + roles
- Learner invite / import (Shopify Customer create/link) + status
- Course SCORM 1.2 upload / replace / delete + content serving
- Assign / unassign / bulk assign
- Learner dashboard, my courses, SCORM player + progress commit
- Reports + CSV export
- Overview stats
- Reminder job `POST /jobs/reminders` with `CRON_SECRET`

Docs: [`docs/lms`](docs/lms) · App status: [`apps/lms/STATUS.md`](apps/lms/STATUS.md)
