# Flowmetric AI Agent API Guide

This guide describes how coding agents, internal automations, or end-user assistants should operate Flowmetric without depending on fragile browser UI automation.

Machine-readable contract:

- `/openapi.json`
- `/llms.txt`

## Agent Operating Rules

- Prefer read-only calls before state-changing calls.
- Do not treat `setup_required`, `collecting_daily_data`, or `collecting_history` as failures. They are normal beta lifecycle states.
- Do not expose `FEEDBACK_ADMIN_TOKEN` or `HEALTHCHECK_SECRET` in logs, screenshots, PR text, or public comments.
- Confirm with a human before deleting saved listings or marking client-facing actions as done.
- Do not scrape the human UI when an API route exists.

## Core Workflow

1. Resolve and analyze a listing:

```bash
curl -sS "https://gbp-diagnosis-mvp.pages.dev/api/diagnose?q=Blue%20Bottle%20Coffee%20Shibuya%20Tokyo&lang=en"
```

2. Save a listing and competitor pairing:

```bash
curl -sS \
  -X POST \
  -H "content-type: application/json" \
  "https://gbp-diagnosis-mvp.pages.dev/api/saved-listings?lang=en" \
  --data '{
    "email": "operator@example.com",
    "placeId": "PRIMARY_PLACE_ID",
    "competitorPlaceId": "COMPETITOR_PLACE_ID",
    "name": "Client location",
    "competitorName": "Competitor location",
    "preferredLanguage": "en"
  }'
```

3. Reopen the latest saved report:

```bash
curl -sS "https://gbp-diagnosis-mvp.pages.dev/api/saved-report?id=SAVED_LISTING_ID&lang=en"
```

4. Read weekly comparison status:

```bash
curl -sS "https://gbp-diagnosis-mvp.pages.dev/api/weekly-report?my=PRIMARY_PLACE_ID&competitor=COMPETITOR_PLACE_ID&lang=en"
```

5. Add an operator action:

```bash
curl -sS \
  -X POST \
  -H "content-type: application/json" \
  "https://gbp-diagnosis-mvp.pages.dev/api/saved-actions?lang=en" \
  --data '{
    "id": "SAVED_LISTING_ID",
    "action": {
      "label": "Add proof photos",
      "body": "Add five photos that prove the most mentioned service and reduce the competitor proof gap.",
      "status": "planned",
      "source": "weekly_task"
    }
  }'
```

## Error Handling

Common response fields:

- `ok`: boolean success state.
- `code` or `error`: machine-readable failure code.
- `message`: human-readable explanation.
- `hint`: recovery guidance when available.
- `upstreamStatus`: Google Places status when relevant.
- `upstreamErrorMessage`: upstream detail when available.

Recommended behavior:

- `BAD_INPUT`: change the request input before retrying.
- `PLACE_NOT_FOUND`: ask for a more specific business name and address.
- `OVER_QUERY_LIMIT`: stop and retry later.
- `BILLING_NOT_ENABLED`, `PLACES_API_DISABLED`, `API_DENIED`: escalate to an operator.
- `UPSTREAM_TEMPORARY`, `GOOGLE_FETCH_FAILED`, `5xx`: retry once after a short delay, then escalate.

## Protected Operations

These endpoints require bearer tokens and should be used only in trusted automations:

- `GET /api/feedback-summary` with `FEEDBACK_ADMIN_TOKEN`
- `GET /api/events-summary` with `FEEDBACK_ADMIN_TOKEN`
- `POST /api/health-check` with `HEALTHCHECK_SECRET`
- `GET /api/health-status` with `HEALTHCHECK_SECRET`

Example:

```bash
curl -sS \
  -H "Authorization: Bearer $FEEDBACK_ADMIN_TOKEN" \
  "https://gbp-diagnosis-mvp.pages.dev/api/events-summary?days=7"
```

## Current Gaps

- No scoped per-agent token model yet.
- No dry-run mode for mutation endpoints yet.
- Some public beta mutation endpoints are intentionally lightweight and should be called only by trusted first-party clients or supervised agents.
