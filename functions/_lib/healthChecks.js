export const DEFAULT_HEALTHCHECK_QUERY = "Starbucks Coffee Shibuya Tsutaya Tokyo";
export const DEFAULT_HEALTHCHECK_SNAPSHOT_PLACE_ID = "ChIJiXocb7WNGGAReVVBhRwWLoQ";

const MONITORED_CODES = new Set([
  "BILLING_NOT_ENABLED",
  "PLACES_API_DISABLED",
  "API_DENIED",
  "OVER_QUERY_LIMIT",
]);

const IMMEDIATE_ALERT_CHECKS = new Set(["site", "kv-test", "diagnose"]);
const STREAK_ALERT_CHECKS = new Set(["resolve", "snapshot"]);

function trimOrigin(origin) {
  return String(origin || "").replace(/\/$/, "");
}

function toErrorMessage(error) {
  return error?.message || String(error);
}

async function fetchTarget(fetchImpl, url) {
  try {
    const response = await fetchImpl(url, {
      headers: {
        accept: "application/json,text/html;q=0.9,*/*;q=0.8",
      },
    });

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    let body = null;

    if (
      contentType.includes("application/json") ||
      text.trim().startsWith("{") ||
      text.trim().startsWith("[")
    ) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }

    return {
      ok: true,
      httpStatus: response.status,
      contentType,
      text,
      body,
    };
  } catch (error) {
    return {
      ok: false,
      httpStatus: 0,
      contentType: "",
      text: "",
      body: null,
      fetchError: toErrorMessage(error),
    };
  }
}

function extractCode(body) {
  if (!body || typeof body !== "object") return null;
  return body.code || body.error || null;
}

function extractMessage(body, fallback = null) {
  if (!body || typeof body !== "object") return fallback;
  if (typeof body.message === "string" && body.message.trim()) return body.message.trim();
  if (typeof body.error === "string" && body.error.trim() && !body.code) return body.error.trim();
  return fallback;
}

function extractUpstreamStatus(body) {
  if (!body || typeof body !== "object") return null;
  return body.upstreamStatus || null;
}

function buildCheckResult({
  name,
  url,
  ok,
  httpStatus,
  code = null,
  upstreamStatus = null,
  message = null,
  observed = {},
  skipped = false,
}) {
  return {
    name,
    url,
    ok,
    skipped,
    httpStatus,
    code,
    upstreamStatus,
    message,
    observed,
    consecutiveFailures: 0,
  };
}

async function runSiteCheck({ origin, fetchImpl }) {
  const url = `${origin}/`;
  const result = await fetchTarget(fetchImpl, url);
  const expectedMarkers = [
    "Flowmetric",
    "Client-ready Google Business Profile weekly reports",
    "saved listings",
  ];
  const matchedMarkers = expectedMarkers.filter((marker) =>
    result.text.includes(marker)
  );
  const containsExpectedMarker = matchedMarkers.length >= 2;

  if (!result.ok) {
    return buildCheckResult({
      name: "site",
      url,
      ok: false,
      httpStatus: 0,
      code: "FETCH_FAILED",
      message: result.fetchError,
    });
  }

  if (result.httpStatus !== 200 || !containsExpectedMarker) {
    return buildCheckResult({
      name: "site",
      url,
      ok: false,
      httpStatus: result.httpStatus,
      code: "SITE_UNHEALTHY",
      message:
        result.httpStatus !== 200
          ? `Expected 200 from /. Received ${result.httpStatus}.`
          : "Landing page did not include the expected product marker text.",
      observed: {
        containsExpectedMarker,
        matchedMarkers,
      },
    });
  }

  return buildCheckResult({
    name: "site",
    url,
    ok: true,
    httpStatus: result.httpStatus,
    observed: {
      containsExpectedMarker,
      matchedMarkers,
    },
  });
}

async function runKvTestCheck({ origin, fetchImpl }) {
  const url = `${origin}/api/kv-test`;
  const result = await fetchTarget(fetchImpl, url);
  const body = result.body;
  const ok = result.ok && result.httpStatus === 200 && body?.ok === true && typeof body?.v === "string";

  return buildCheckResult({
    name: "kv-test",
    url,
    ok,
    httpStatus: result.httpStatus,
    code: ok ? null : extractCode(body) || (result.ok ? "KV_TEST_FAILED" : "FETCH_FAILED"),
    upstreamStatus: extractUpstreamStatus(body),
    message: ok ? null : extractMessage(body, result.fetchError || "KV health check failed."),
    observed: {
      ok: body?.ok ?? null,
      value: body?.v ?? null,
    },
  });
}

async function runResolveCheck({ origin, fetchImpl, query }) {
  const url = `${origin}/api/resolve?query=${encodeURIComponent(query)}`;
  const result = await fetchTarget(fetchImpl, url);
  const body = result.body;
  const ok =
    result.ok &&
    result.httpStatus === 200 &&
    typeof body?.placeId === "string" &&
    body.placeId.trim().length > 0;

  return buildCheckResult({
    name: "resolve",
    url,
    ok,
    httpStatus: result.httpStatus,
    code: ok ? null : extractCode(body) || (result.ok ? "RESOLVE_FAILED" : "FETCH_FAILED"),
    upstreamStatus: extractUpstreamStatus(body),
    message: ok ? null : extractMessage(body, result.fetchError || "Resolve health check failed."),
    observed: {
      placeId: body?.placeId ?? null,
      name: body?.name ?? null,
    },
  });
}

async function runDiagnoseCheck({ origin, fetchImpl, query }) {
  const url = `${origin}/api/diagnose?q=${encodeURIComponent(query)}`;
  const result = await fetchTarget(fetchImpl, url);
  const body = result.body;
  const score = body?.diagnosis?.score;
  const ok =
    result.ok &&
    result.httpStatus === 200 &&
    body?.ok === true &&
    Number.isFinite(score) &&
    typeof body?.placeId === "string";

  return buildCheckResult({
    name: "diagnose",
    url,
    ok,
    httpStatus: result.httpStatus,
    code: ok ? null : extractCode(body) || (result.ok ? "DIAGNOSE_FAILED" : "FETCH_FAILED"),
    upstreamStatus: extractUpstreamStatus(body),
    message: ok ? null : extractMessage(body, result.fetchError || "Diagnose health check failed."),
    observed: {
      placeId: body?.placeId ?? null,
      score: Number.isFinite(score) ? score : null,
    },
  });
}

async function runSnapshotCheck({ origin, fetchImpl, placeId }) {
  const url = `${origin}/api/snapshot?placeId=${encodeURIComponent(placeId)}`;
  const result = await fetchTarget(fetchImpl, url);
  const body = result.body;
  const ok =
    result.ok &&
    result.httpStatus === 200 &&
    body?.ok === true &&
    typeof body?.storedKey === "string" &&
    body.storedKey.trim().length > 0;

  return buildCheckResult({
    name: "snapshot",
    url,
    ok,
    httpStatus: result.httpStatus,
    code: ok ? null : extractCode(body) || (result.ok ? "SNAPSHOT_FAILED" : "FETCH_FAILED"),
    upstreamStatus: extractUpstreamStatus(body),
    message: ok ? null : extractMessage(body, result.fetchError || "Snapshot health check failed."),
    observed: {
      placeId: body?.placeId ?? null,
      storedKey: body?.storedKey ?? null,
    },
  });
}

export async function runHealthChecks({
  origin,
  fetchImpl = fetch,
  query = DEFAULT_HEALTHCHECK_QUERY,
  snapshotPlaceId = DEFAULT_HEALTHCHECK_SNAPSHOT_PLACE_ID,
} = {}) {
  const cleanOrigin = trimOrigin(origin);
  const startedAt = new Date().toISOString();

  const site = await runSiteCheck({ origin: cleanOrigin, fetchImpl });
  const kvTest = await runKvTestCheck({ origin: cleanOrigin, fetchImpl });
  const resolve = await runResolveCheck({ origin: cleanOrigin, fetchImpl, query });
  const diagnose = await runDiagnoseCheck({ origin: cleanOrigin, fetchImpl, query });
  const derivedSnapshotPlaceId = resolve.ok
    ? resolve.observed.placeId || snapshotPlaceId
    : snapshotPlaceId;
  const snapshot = derivedSnapshotPlaceId
    ? await runSnapshotCheck({
        origin: cleanOrigin,
        fetchImpl,
        placeId: derivedSnapshotPlaceId,
      })
    : buildCheckResult({
        name: "snapshot",
        url: `${cleanOrigin}/api/snapshot`,
        ok: false,
        skipped: true,
        httpStatus: 0,
        code: "SNAPSHOT_NOT_CONFIGURED",
        message: "No snapshot placeId was configured for the health check.",
      });

  const checks = [site, kvTest, resolve, diagnose, snapshot];

  return {
    ok: checks.every((check) => check.ok || check.skipped),
    origin: cleanOrigin,
    query,
    snapshotPlaceId: derivedSnapshotPlaceId,
    startedAt,
    finishedAt: new Date().toISOString(),
    checks,
  };
}

export function withFailureStreaks(result, previous = null) {
  const previousChecks = new Map(
    Array.isArray(previous?.checks) ? previous.checks.map((check) => [check.name, check]) : []
  );

  const checks = result.checks.map((check) => {
    if (check.ok || check.skipped) {
      return {
        ...check,
        consecutiveFailures: 0,
      };
    }

    const prev = previousChecks.get(check.name);
    const prevFailures =
      prev && !prev.ok && !prev.skipped ? Number(prev.consecutiveFailures || 0) : 0;

    return {
      ...check,
      consecutiveFailures: prevFailures + 1,
    };
  });

  return {
    ...result,
    ok: checks.every((check) => check.ok || check.skipped),
    checks,
  };
}

function isImmediateFailure(check) {
  if (check.ok || check.skipped) return false;
  if (check.httpStatus >= 500) return true;
  if (MONITORED_CODES.has(check.code)) return true;
  return IMMEDIATE_ALERT_CHECKS.has(check.name);
}

function isStreakFailure(check) {
  if (check.ok || check.skipped) return false;
  return STREAK_ALERT_CHECKS.has(check.name) && Number(check.consecutiveFailures || 0) >= 2;
}

export function summarizeHealthResult(result) {
  const failingChecks = result.checks.filter((check) => !check.ok && !check.skipped);
  const alertableChecks = failingChecks.filter(
    (check) => isImmediateFailure(check) || isStreakFailure(check)
  );

  return {
    failingChecks,
    alertableChecks,
    criticalCodes: alertableChecks.map((check) => check.code).filter(Boolean),
  };
}

export function shouldAlertFromHealthResult(result) {
  return summarizeHealthResult(result).alertableChecks.length > 0;
}
