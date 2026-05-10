# GBP Diagnosis

Google Maps / Google Business Profile analysis tool for Local SEO agencies.

Public beta:
- [https://gbp-diagnosis-mvp.pages.dev](https://gbp-diagnosis-mvp.pages.dev)

## What it does

- Analyze a Google Maps / GBP listing
- Compare review momentum against a nearby competitor
- Generate a weekly report from saved daily snapshots
- Compare photo coverage and recommend missing photo types
- Export a client-ready PDF report
- Save listings and reopen the latest report quickly with a deep link

## Current audience

Primary:
- Local SEO agencies

Secondary:
- freelance local SEO consultants
- small marketing agencies

## Public beta scope

This repo is intentionally lightweight.

Current beta priorities:
- keep the public beta stable
- collect real user feedback
- improve repeat usage signals
- avoid speculative scope creep

## Core flows

### 1. Analyze a listing

Enter a business name and address, then run the analysis.

The app returns:
- score / report view
- review comparison
- weekly report
- photo comparison
- recommended actions
- PDF export

### 2. Save a listing for quick return

After running an analysis:
1. enter an email address
2. click `Save Current Listing`
3. the app stores the listing + competitor pairing in KV
4. reopen it later from `Saved Listings`
5. use the deep link to jump straight to the latest report

### 3. Open a saved report

Saved listings can be reopened from the UI or via a deep link:

- `/?saved=<saved-listing-id>`

That deep link loads the latest report for the saved listing.

## Local development

### Requirements

- Node.js
- npm
- Wrangler
- a Google Maps API key with Places access

### Install

```bash
npm install
```

### Local env

Create `.dev.vars` from `.dev.vars.example` and fill in the required values.

```bash
cp .dev.vars.example .dev.vars
```

### Run locally

```bash
npm run dev
```

Default dev command:

```bash
wrangler pages dev public --compatibility-date=2025-01-01 --local
```

## Environment variables

Required:
- `GOOGLE_MAPS_API_KEY`

Optional for lightweight saved-listing management:
- `APP_BASE_URL`
- `HEALTHCHECK_SECRET`
- `HEALTHCHECK_QUERY`
- `HEALTHCHECK_SNAPSHOT_PLACE_ID`
- `HEALTH_ALERT_EMAIL`

Optional only if email notification is re-enabled later:
- `NOTIFICATION_SECRET`
- `MAILCHANNELS_API_KEY`
- `MAIL_FROM_EMAIL`
- `MAIL_FROM_NAME`
- `MAIL_REPLY_TO`
- `MAILCHANNELS_API_URL`

## Security notes

Current public beta direction: repeat usage should come from in-product value, not email delivery.


### Notification auth

The notification endpoint is not part of the current public beta scope. If it is re-enabled later:
- `/api/process-saved-listings` must remain `POST` only
- authentication must be sent in the `Authorization: Bearer ...` header
- do not pass secrets in the query string

### Mail delivery requirements

Email is intentionally out of scope for the current beta. If it is re-enabled later, it should not be considered production-ready unless the following are in place:
- MailChannels Email API account
- `MAILCHANNELS_API_KEY` configured
- sender domain aligned with your chosen `MAIL_FROM_EMAIL`
- SPF configured for MailChannels
- DKIM configured
- DMARC configured
- Domain Lockdown configured in MailChannels

Without those, mail can appear to send but fail to land reliably.

### Google Maps API key guidance

This app uses Google Maps web service calls from server-side Pages Functions.

Recommended setup:
- keep the key only in env, never client-side
- use a separate key for this app
- restrict the key to only the required Google Maps / Places APIs
- use IP restrictions if your infrastructure allows it
- if fixed egress IP restriction is impractical, document that risk and rely on separate keys, API restrictions, and usage monitoring

## Saved listings / quick-return architecture

### Storage

Saved listings are stored in KV.

Current model:
- saved listing record
- email -> saved listing index
- place -> competitor pairing
- daily snapshots

### Optional internal processing

There is still an internal background-processing endpoint in the codebase, but it is not part of the current public beta commitment.

If email notification is re-enabled later, that processing path should be treated as a separate scoped feature with its own deploy gate.

## API endpoints

Existing / important endpoints:
- `/api/diagnose`
- `/api/compare`
- `/api/weekly-report`
- `/api/run-daily`
- `/api/saved-listings`
- `/api/saved-report`
- `/api/process-saved-listings`
- `/api/health-check`
- `/api/health-status`

## Minimal health monitoring

The public beta includes a small core-flow health check so we can catch cases where the site loads but Google Places is failing.

Current monitored checks:
- `/`
- `/api/kv-test`
- `/api/resolve?query=...`
- `/api/diagnose?q=...`
- `/api/snapshot?placeId=...`

The health check does not only look at HTTP 200. It also records:
- `ok`
- `code`
- `upstreamStatus`
- `message`

Examples of failures it classifies:
- `BILLING_NOT_ENABLED`
- `PLACES_API_DISABLED`
- `API_DENIED`
- `5xx` responses
- repeated `resolve` / `snapshot` failures

### Post-deploy smoke check

Run this after a deploy:

```bash
HEALTHCHECK_BASE_URL="https://gbp-diagnosis-mvp.pages.dev" \
HEALTHCHECK_SECRET="replace-this-with-the-shared-secret" \
npm run smoke
```

This calls `POST /api/health-check` with `mode=smoke` and exits non-zero when the core flow is unhealthy.

There is also a manual GitHub Actions helper:
- `.github/workflows/post-deploy-smoke.yml`

### Periodic health check

The repo includes a scheduled GitHub Actions workflow:
- `.github/workflows/periodic-health-check.yml`

It runs:

```bash
npm run health:prod
```

or the same CLI with workflow-specific inputs, and stores the raw JSON result as an artifact while the endpoint keeps the latest runs in KV.

Required GitHub Actions secret:
- `HEALTHCHECK_SECRET`

Optional GitHub Actions variable:
- `HEALTH_ALERT_EMAIL`

### Health status / record

The latest health result is stored in KV and can be read from:
- `GET /api/health-status`

This endpoint also requires:
- `Authorization: Bearer <HEALTHCHECK_SECRET>`

### Feedback summary

Beta feedback is stored in KV and can be summarized from:
- `GET /api/feedback-summary`

This endpoint requires:
- `Authorization: Bearer <FEEDBACK_ADMIN_TOKEN>`

Useful benchmark filters:
- `/api/feedback-summary?tag=value_benchmark`
- `/api/feedback-summary?intent=report_value_benchmark`
- `/api/feedback-summary?intent=beta_value_benchmark`

Local CLI:
- `FEEDBACK_ADMIN_TOKEN=... npm run feedback:summary -- --tag value_benchmark`
- `FEEDBACK_ADMIN_TOKEN=... npm run feedback:summary -- --intent report_value_benchmark --limit 20`

The response includes `benchmarkStats` for beta value checks, including records with usable
prep-time fields and estimated minutes saved totals / averages.

Local smoke test:
- `npm run feedback:smoke`

### Email alerts

When mail is configured, `/api/health-check` can send alert mail for unhealthy runs.

Required for alerts:
- `MAILCHANNELS_API_KEY`
- `MAIL_FROM_EMAIL`

Default alert target:
- `contact@getflowmetric.com`

For setup details, see [docs/CORE_HEALTH_MONITORING.md](./docs/CORE_HEALTH_MONITORING.md).

## Known beta limitations

- saved listing access is email-based and intentionally lightweight for beta
- there is no full account system yet
- email notification is currently out of scope for the public beta
- PDF / mobile polish is still improving
- GitHub Issues is currently the main feedback / bug-report intake

## Feedback

Bug reports / feedback:
- [GitHub Issues](https://github.com/chitta666/gbp-diagnosis-mvp/issues/new/choose)

## Release Process

- Use [docs/DEPLOY_GATE_CHECKLIST.md](./docs/DEPLOY_GATE_CHECKLIST.md) before any production deploy.

## Deployment

Current deploy command:

```bash
npm run deploy
```

Before deploying:
- protect the verified production baseline
- verify new UI flows locally or in preview
- avoid shipping unverified changes directly to production
