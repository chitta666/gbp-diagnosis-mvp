import assert from "node:assert/strict";
import { onRequest } from "../functions/api/feedback-summary.js";

const TOKEN = "feedback-summary-smoke-token";

function makeKv(records) {
  const store = new Map(Object.entries(records));
  return {
    async get(key) {
      return store.get(key) || null;
    },
  };
}

function feedbackRecord(id, overrides = {}) {
  return {
    id,
    createdAt: "2026-05-10T09:00:00.000Z",
    type: "useful",
    status: "new",
    email: "operator@example.com",
    message: [
      "普段の下準備時間: 45分",
      "Flowmetricでの作成時間: 12分",
      "削減できた目安: 33分",
      "そのまま使えた一文: 今週は競合との差分が縮まりました。",
      "書き直した箇所: 写真改善の表現",
      "まだ信頼しきれなかった点: レビュー根拠の件数",
    ].join("\n"),
    tags: ["value_benchmark", "time_saved"],
    context: {
      intent: "report_value_benchmark",
      page: "/?lang=ja&saved=abc",
      placeName: "カメリア",
      competitorName: "ニュースペイン館",
      savedListingId: "abc",
    },
    ...overrides,
  };
}

function makeEnv() {
  const primary = feedbackRecord("benchmark-1");
  const secondary = feedbackRecord("benchmark-2", {
    type: "confusing",
    email: "client@example.com",
    tags: ["trust_gap"],
    context: {
      intent: "general_feedback",
      placeName: "Other Store",
    },
    message: "The report still needs clearer evidence.",
  });

  return {
    FEEDBACK_ADMIN_TOKEN: TOKEN,
    KV: makeKv({
      "feedback:index": JSON.stringify([primary.id, secondary.id]),
      [`feedback:${primary.id}`]: JSON.stringify(primary),
      [`feedback:${secondary.id}`]: JSON.stringify(secondary),
    }),
  };
}

async function callFeedbackSummary(path, headers = {}) {
  const request = new Request(`https://example.test${path}`, { headers });
  const response = await onRequest({ request, env: makeEnv() });
  const payload = await response.json();
  return { response, payload };
}

async function assertUnauthorized() {
  const { response, payload } = await callFeedbackSummary("/api/feedback-summary");
  assert.equal(response.status, 401);
  assert.equal(payload.ok, false);
  assert.equal(payload.error, "UNAUTHORIZED");
}

async function assertBenchmarkSummary() {
  const { response, payload } = await callFeedbackSummary(
    "/api/feedback-summary?tag=value_benchmark&limit=10",
    { authorization: `Bearer ${TOKEN}` }
  );

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.returned, 1);
  assert.equal(payload.counts.byTag.value_benchmark, 1);
  assert.equal(payload.counts.byIntent.report_value_benchmark, 1);
  assert.equal(payload.benchmarkStats.records, 1);
  assert.equal(payload.benchmarkStats.withUsualPrepTime, 1);
  assert.equal(payload.benchmarkStats.withFlowmetricTime, 1);
  assert.equal(payload.benchmarkStats.withEstimatedMinutesSaved, 1);
  assert.equal(payload.benchmarkStats.withReusableClientSentence, 1);
  assert.equal(payload.benchmarkStats.withRewriteNeeds, 1);
  assert.equal(payload.benchmarkStats.withTrustGaps, 1);
  assert.deepEqual(payload.benchmarkStats.estimatedMinutesSaved, {
    count: 1,
    total: 33,
    average: 33,
    median: 33,
    min: 33,
    max: 33,
  });

  const [record] = payload.recent;
  assert.equal(record.email, "o***@example.com");
  assert.equal(record.context.placeName, "カメリア");
  assert.equal(record.context.competitorName, "ニュースペイン館");
  assert.equal(record.benchmark.usualPrepTime, "45分");
  assert.equal(record.benchmark.flowmetricTime, "12分");
  assert.equal(record.benchmark.estimatedMinutesSaved, "33分");
  assert.match(record.benchmark.reusableClientSentence, /競合との差分/);
  assert.match(record.benchmark.rewriteNeeds, /写真改善/);
  assert.match(record.benchmark.trustGaps, /レビュー根拠/);
}

async function assertIntentFilter() {
  const { response, payload } = await callFeedbackSummary(
    "/api/feedback-summary?intent=general_feedback",
    { "x-feedback-admin-token": TOKEN }
  );

  assert.equal(response.status, 200);
  assert.equal(payload.returned, 1);
  assert.equal(payload.benchmarkStats.records, 0);
  assert.equal(payload.recent[0].intent, "general_feedback");
  assert.equal(payload.recent[0].benchmark, null);
  assert.equal(payload.recent[0].email, "c***@example.com");
}

await assertUnauthorized();
await assertBenchmarkSummary();
await assertIntentFilter();

console.log("feedback-summary smoke passed");
