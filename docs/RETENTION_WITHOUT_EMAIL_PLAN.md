# Retention Plan Without Email

## Purpose

This document defines the current retention direction for the public beta.

The goal is to increase repeat usage **without depending on email notifications**.

## Current Decision

For now, email notification is **not launch-critical** and is intentionally deprioritized.

Reasoning:
- the beta still needs stronger in-product return value
- email adds deliverability, auth, DNS, and ops overhead
- we should first prove that users want to come back because the product itself is useful
- return loops should be built around `saved listings`, `latest changes`, and `weekly delta`, not forced reminders first

## Product Principle

Before adding outbound notification, the app should answer this clearly:

- Why would a user open this again next week?

The answer should come from the product itself.

## MVP

### Goal
Create a simple in-product reason to return.

### Scope
- `saved listings`
- `Open Latest Report`
- `Last checked / Last updated`
- `What changed since last time`
- `Weekly delta summary`
- better role separation between `saved listings` and `history`

### User value
- users do not need to search from scratch every time
- saved listings become a lightweight monitoring surface
- the app shows whether anything changed since the last visit
- weekly change becomes visible inside the product, not only through notification

## Next

### Goal
Turn repeat usage into a clearer workflow.

### Scope
- `saved listings dashboard`
- `status summary` for each saved listing
- `priority badge` such as `Needs attention`, `Stable`, `Opportunity`
- `action log`
- `impact timeline`
- stronger return-loop copy in the UI

### Product idea
A saved listing should feel less like a bookmark and more like a living status card.

## Later

### Goal
Turn repeat usage into monetizable monitoring.

### Scope
- `multi-listing monitoring`
- `monthly summary`
- `competitor trend tracking`
- `client-ready dashboard`
- lightweight in-product alerts
- paid beta based on monitoring and agency workflow

## What This Means for Infra

If email notification is out of scope for now:
- keep `GOOGLE_MAPS_API_KEY`
- do not treat `MAILCHANNELS_API_KEY` as required
- do not treat `MAIL_FROM_EMAIL` or `MAIL_REPLY_TO` as required
- `NOTIFICATION_SECRET` is not required unless `/api/process-saved-listings` remains active for internal use

## PM Note

This is not a permanent rejection of email.

Email should be reconsidered later only if:
- users ask for automatic delivery
- repeat usage is already visible
- agencies want weekly summaries pushed to them
- a paid beta requires it

Until then, the product should earn re-entry on its own.
