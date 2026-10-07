# VECTRA Academy LMS — Implementation Status

Last updated: 2026-10-07

Stack: **Express + TypeScript** Shopify App Proxy (`apps/lms`) + Shopify theme Liquid. MongoDB + R2 for LMS data. Not Next.js.

Storefront entry: `/marketplace/lms/*` → Shopify `/pages/lms-*` (see root README + `snippets/vectra-redirects.liquid`).

## Plan todos

| ID | Scope | Status |
|----|-------|--------|
| **P0** | Express app scaffold + App Proxy + Mongo/R2 env | **Done** |
| **P1** | Participants / fields / roles APIs + theme wire | **Done** |
| **P2** | Learner invite/import + Shopify Customer link | **Done** |
| **P3** | SCORM upload, content, player, progress | **Done** |
| **P4** | Assignments + learner dashboard/my-courses/profile | **Done** |
| **P5** | Overview stats, reports CSV, reminders job | **Done** |
| **P6** | Header Academy link, page docs, production gates | **Done** |
| **P7** | Marketplace URL nesting (`/marketplace/lms/*`) | **Done** |

## How to run

```bash
cd apps/lms
cp .env.example .env
npm install
npm run dev
```

## Remaining optional follow-ups

1. Embedded Shopify Admin OAuth / Polaris shell (APIs already exist).
2. Webhooks to sync customer tags into staffProfiles.
3. Rate limiting / malware scan on SCORM ZIPs.
4. Shopify Admin URL redirects mirroring the Marketplace LMS map (301s).
