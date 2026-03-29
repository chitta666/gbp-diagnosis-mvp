# Core Health Monitoring

Public beta 向けの最小監視です。目的は「サイトは開くが diagnose が壊れている」を数時間以内に検知することです。

## What It Checks

- `GET /`
- `GET /api/kv-test`
- `GET /api/resolve?query=...`
- `GET /api/diagnose?q=...`
- `GET /api/snapshot?placeId=...`

判定は HTTP 200 だけではなく、各 check の次を見ます。

- `ok`
- `code`
- `upstreamStatus`
- `message`

代表的に分類したい異常:

- `BILLING_NOT_ENABLED`
- `PLACES_API_DISABLED`
- `API_DENIED`
- `OVER_QUERY_LIMIT`
- `5xx`
- `resolve` / `snapshot` の連続失敗

## Environment Variables

Required:

- `GOOGLE_MAPS_API_KEY`
- `HEALTHCHECK_SECRET`

Recommended:

- `HEALTHCHECK_QUERY`
- `HEALTHCHECK_SNAPSHOT_PLACE_ID`
- `HEALTH_ALERT_EMAIL`

For local `wrangler pages dev`, add these to `.dev.vars`. Shell-only env injection is not enough for Pages Functions bindings.

Optional for email alerts:

- `MAILCHANNELS_API_KEY`
- `MAIL_FROM_EMAIL`
- `MAIL_FROM_NAME`
- `MAIL_REPLY_TO`
- `MAILCHANNELS_API_URL`

## Post-Deploy Smoke Check

Production deploy の直後はこれを実行します。

```bash
HEALTHCHECK_BASE_URL="https://gbp-diagnosis-mvp.pages.dev" \
HEALTHCHECK_SECRET="replace-this-with-the-shared-secret" \
npm run smoke
```

動作:

- `POST /api/health-check` を `mode=smoke` で呼ぶ
- unhealthy なら exit code `1`
- 結果は `checks[].code / upstreamStatus / message` まで出る

GitHub Actions:

- `.github/workflows/post-deploy-smoke.yml`

## Periodic Health Check

GitHub Actions:

- `.github/workflows/periodic-health-check.yml`

デフォルト:

- 15 分ごと
- `npm run health:prod`
- 結果 JSON を artifact に保存
- unhealthy なら workflow failed

`/api/health-check` 側は latest result を KV に保存します。

### Required GitHub Secret

- `HEALTHCHECK_SECRET`

### Optional GitHub Variable

- `HEALTH_ALERT_EMAIL`

## Health Status Endpoint

最新の監視結果と履歴キーはここで見られます。

```bash
curl -sS \
  -H "Authorization: Bearer $HEALTHCHECK_SECRET" \
  "https://gbp-diagnosis-mvp.pages.dev/api/health-status"
```

KV keys:

- `health:core:last`
- `health:core:last-alert`
- `health:core:history:index`
- `health:core:run:<startedAt>`

## Alert Behavior

Immediate alert:

- `site`
- `kv-test`
- `diagnose`
- monitored Google Places codes
- any `5xx`

Streak-based alert:

- `resolve`
- `snapshot`

連続 2 回失敗した時に alertable になります。

## Recommended Beta Setup

1. Cloudflare production env に `HEALTHCHECK_SECRET` を入れる
2. 必要なら `HEALTHCHECK_QUERY` と `HEALTHCHECK_SNAPSHOT_PLACE_ID` を固定する
3. MailChannels を使うなら `MAIL_*` と `HEALTH_ALERT_EMAIL=contact@getflowmetric.com` を入れる
4. GitHub Actions secret に `HEALTHCHECK_BASE_URL` と同じ `HEALTHCHECK_SECRET` を入れる
5. deploy 後は `npm run smoke`

このセットで、

- deploy 直後に core flow を確認できる
- 15 分ごとの check で数時間以内に異常へ気づける
- `code / upstreamStatus / message` で故障種別を切り分けられる
