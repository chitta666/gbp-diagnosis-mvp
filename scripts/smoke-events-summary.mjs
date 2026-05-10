import assert from "node:assert/strict";
import { onRequest } from "../functions/api/events-summary.js";

const TOKEN = "events-summary-smoke-token";

function todayKey(suffix) {
  return `event:${new Date().toISOString().slice(0, 10)}:${suffix}`;
}

function makeKv(records) {
  const store = new Map(Object.entries(records));
  return {
    async get(key) {
      return store.get(key) || null;
    },
    async list({ prefix, cursor, limit = 1000 }) {
      const allKeys = Array.from(store.keys())
        .filter((key) => key.startsWith(prefix))
        .sort();
      const start = cursor ? Number(cursor) : 0;
      const selected = allKeys.slice(start, start + limit);
      const next = start + selected.length;
      return {
        keys: selected.map((name) => ({ name })),
        list_complete: next >= allKeys.length,
        cursor: next >= allKeys.length ? undefined : String(next),
      };
    },
  };
}

function eventRecord(event, overrides = {}) {
  return {
    event,
    flowId: "flow123",
    page: "report",
    lang: "ja",
    source: "feedback_modal",
    path: "/",
    candidateCount: 0,
    savedListingCount: 1,
    savedListingLimit: 3,
    freeLimitReached: false,
    intent: "report_value_benchmark",
    feedbackType: "useful_result",
    hasFeedbackEmail: false,
    hasSavedListing: true,
    hasCompetitor: true,
    hasPlaceId: true,
    hasRecommendedCompetitor: true,
    hasSelectedCompetitor: true,
    sameAsRecommended: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeEnv() {
  const records = {
    [todayKey("001")]: JSON.stringify(
      eventRecord("beta_benchmark_feedback_clicked", {
        source: "beta_validation",
        intent: "beta_value_benchmark",
        hasSavedListing: false,
        hasCompetitor: false,
      })
    ),
    [todayKey("002")]: JSON.stringify(
      eventRecord("beta_benchmark_feedback_submitted", {
        intent: "beta_value_benchmark",
        hasSavedListing: false,
        hasCompetitor: false,
      })
    ),
    [todayKey("003")]: JSON.stringify(eventRecord("report_benchmark_feedback_clicked")),
    [todayKey("004")]: JSON.stringify(
      eventRecord("diagnosis_completed", {
        source: "diagnose",
        intent: null,
        feedbackType: "unknown",
      })
    ),
  };

  return {
    FEEDBACK_ADMIN_TOKEN: TOKEN,
    KV: makeKv(records),
  };
}

async function callEventsSummary(path, headers = {}) {
  const request = new Request(`https://example.test${path}`, { headers });
  const response = await onRequest({ request, env: makeEnv() });
  const payload = await response.json();
  return { response, payload };
}

async function assertUnauthorized() {
  const { response, payload } = await callEventsSummary("/api/events-summary");
  assert.equal(response.status, 401);
  assert.equal(payload.ok, false);
  assert.equal(payload.error, "UNAUTHORIZED");
}

async function assertSummary() {
  const { response, payload } = await callEventsSummary("/api/events-summary?days=1", {
    authorization: `Bearer ${TOKEN}`,
  });

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.scanned, 4);
  assert.equal(payload.returned, 4);
  assert.equal(payload.counts.byEvent.beta_benchmark_feedback_clicked, 1);
  assert.equal(payload.counts.byEvent.beta_benchmark_feedback_submitted, 1);
  assert.equal(payload.counts.byEvent.report_benchmark_feedback_clicked, 1);
  assert.equal(payload.counts.byIntent.beta_value_benchmark, 2);
  assert.equal(payload.counts.byIntent.report_value_benchmark, 1);
  assert.equal(payload.benchmarkFunnel.beta.clicked, 1);
  assert.equal(payload.benchmarkFunnel.beta.submitted, 1);
  assert.equal(payload.benchmarkFunnel.beta.submittedPerClick, 1);
  assert.equal(payload.benchmarkFunnel.report.clicked, 1);
  assert.equal(payload.benchmarkFunnel.report.submitted, 0);
  assert.equal(payload.benchmarkFunnel.report.submittedPerClick, 0);
  assert.equal(payload.benchmarkFunnel.total.clicked, 2);
  assert.equal(payload.benchmarkFunnel.total.submitted, 1);
  assert.equal(payload.benchmarkFunnel.total.submittedPerClick, 0.5);
}

async function assertEventFilter() {
  const { response, payload } = await callEventsSummary(
    "/api/events-summary?days=1&event=diagnosis_completed",
    { "x-feedback-admin-token": TOKEN }
  );

  assert.equal(response.status, 200);
  assert.equal(payload.returned, 1);
  assert.equal(payload.counts.byEvent.diagnosis_completed, 1);
  assert.equal(payload.benchmarkFunnel.total.clicked, 0);
}

await assertUnauthorized();
await assertSummary();
await assertEventFilter();

console.log("events-summary smoke passed");
