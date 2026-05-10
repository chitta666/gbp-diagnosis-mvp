import assert from "node:assert/strict";
import { buildValueSummary, formatValueSummary } from "./value-summary.mjs";

const feedbackPayload = {
  returned: 2,
  scanned: 3,
  benchmarkStats: {
    records: 2,
    withUsualPrepTime: 2,
    withFlowmetricTime: 2,
    withEstimatedMinutesSaved: 2,
    withReusableClientSentence: 2,
    withRewriteNeeds: 1,
    withTrustGaps: 1,
    estimatedMinutesSaved: {
      count: 2,
      total: 55,
      average: 27.5,
      median: 27.5,
      min: 20,
      max: 35,
    },
  },
  recent: [
    {
      createdAt: "2026-05-10T09:00:00.000Z",
      intent: "report_value_benchmark",
      context: {
        placeName: "Coffee Sample",
        competitorName: "Nearby Cafe",
      },
      benchmark: {
        estimatedMinutesSaved: "35分",
        reusableClientSentence: "差分と次タスクをそのまま定例に使えた。",
        rewriteNeeds: "写真改善の提案をもう少し具体化したい。",
        trustGaps: "レビュー根拠の表示がもっと欲しい。",
      },
    },
    {
      createdAt: "2026-05-10T10:00:00.000Z",
      intent: "beta_value_benchmark",
      context: {
        placeName: "Hair Sample",
      },
      benchmark: {
        estimatedMinutesSaved: "20分",
        reusableClientSentence: "週次確認の説明が短くなった。",
      },
    },
  ],
};

const eventsPayload = {
  returned: 4,
  scanned: 4,
  days: 7,
  benchmarkFunnel: {
    beta: {
      clicked: 1,
      submitted: 1,
      submittedPerClick: 1,
    },
    report: {
      clicked: 3,
      submitted: 1,
      submittedPerClick: 0.3333333333,
    },
    total: {
      clicked: 4,
      submitted: 2,
      submittedPerClick: 0.5,
    },
  },
};

const summary = buildValueSummary({
  feedbackPayload,
  eventsPayload,
  generatedAt: "2026-05-10T12:00:00.000Z",
});

assert.equal(summary.signal, "early");
assert.equal(summary.decision.status, "collecting");
assert.equal(summary.decision.metrics.benchmarkRecords, 2);
assert.equal(summary.decision.metrics.averageSavedMinutes, 27.5);
assert.equal(summary.decision.metrics.submittedPerClick, 0.5);
assert.match(summary.decision.blockers.join("\n"), /Need 1 more structured benchmark/);
assert.equal(summary.events.benchmarkFunnel.total.clicked, 4);
assert.equal(summary.events.benchmarkFunnel.total.submitted, 2);
assert.equal(summary.events.benchmarkFunnel.total.submittedPerClick, 0.5);
assert.equal(summary.feedback.benchmarkRecords, 2);
assert.equal(summary.feedback.estimatedMinutesSaved.total, 55);
assert.equal(summary.recentProof.length, 2);
assert.equal(summary.openQuestions.trustGaps.length, 1);
assert.equal(summary.openQuestions.rewriteNeeds.length, 1);
assert.match(summary.recommendations.join("\n"), /Keep collecting benchmark responses/);

const rendered = formatValueSummary(summary);
assert.match(rendered, /value proof: early/);
assert.match(rendered, /value decision: collecting/);
assert.match(rendered, /benchmark funnel: clicked=4 submitted=2 rate=50%/);
assert.match(rendered, /saved=count:2, total:55m/);
assert.match(rendered, /Coffee Sample vs Nearby Cafe/);

const emptySummary = buildValueSummary({
  feedbackPayload: {
    benchmarkStats: {
      records: 0,
      estimatedMinutesSaved: {},
    },
    recent: [],
  },
  eventsPayload: {
    benchmarkFunnel: {
      total: {
        clicked: 0,
        submitted: 0,
      },
    },
  },
  generatedAt: "2026-05-10T12:00:00.000Z",
});

assert.equal(emptySummary.signal, "thin");
assert.equal(emptySummary.decision.status, "not_enough_signal");
assert.match(emptySummary.recommendations.join("\n"), /Drive 3-5 report viewers/);

const strongSummary = buildValueSummary({
  feedbackPayload: {
    benchmarkStats: {
      records: 5,
      withUsualPrepTime: 5,
      withFlowmetricTime: 5,
      withEstimatedMinutesSaved: 5,
      withReusableClientSentence: 4,
      withRewriteNeeds: 0,
      withTrustGaps: 0,
      estimatedMinutesSaved: {
        count: 5,
        total: 165,
        average: 33,
        median: 30,
        min: 25,
        max: 45,
      },
    },
    recent: [],
  },
  eventsPayload: {
    benchmarkFunnel: {
      total: {
        clicked: 8,
        submitted: 4,
        submittedPerClick: 0.5,
      },
    },
  },
  generatedAt: "2026-05-10T12:00:00.000Z",
});

assert.equal(strongSummary.signal, "measurable");
assert.equal(strongSummary.decision.status, "strong");
assert.equal(strongSummary.decision.blockers.length, 0);

console.log("value-summary smoke passed");
