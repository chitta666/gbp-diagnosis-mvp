import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { adminTokenMissingHelp, printCliError } from "./_admin-token-help.mjs";

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i];
    if (!part.startsWith("--")) continue;

    const keyValue = part.slice(2).split("=");
    const key = keyValue[0];
    if (!key) continue;

    if (keyValue.length > 1) {
      args[key] = keyValue.slice(1).join("=");
      continue;
    }

    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }

    args[key] = next;
    i += 1;
  }

  return args;
}

function normalizeOrigin(origin) {
  return String(origin || "").trim().replace(/\/$/, "");
}

function addParam(url, key, value) {
  const clean = String(value || "").trim();
  if (clean) url.searchParams.set(key, clean);
}

function numberOrZero(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function roundedRate(value) {
  if (!Number.isFinite(Number(value))) return null;
  return Math.round(Number(value) * 100) / 100;
}

function formatRate(value) {
  if (value == null || !Number.isFinite(Number(value))) return "n/a";
  return `${Math.round(Number(value) * 100)}%`;
}

function formatMinuteStats(stats = {}) {
  if (!stats.count) return "none";
  return [
    `count:${stats.count}`,
    `total:${stats.total}m`,
    `avg:${stats.average}m`,
    `median:${stats.median}m`,
    `min:${stats.min}m`,
    `max:${stats.max}m`,
  ].join(", ");
}

function normalizeFormat(value) {
  const format = String(value || "").trim().toLowerCase();
  return ["text", "markdown", "json"].includes(format) ? format : "text";
}

function compactText(value, max = 180) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3)).trim()}...`;
}

function compactRecord(record) {
  const benchmark = record?.benchmark || {};
  return {
    createdAt: record?.createdAt || null,
    intent: record?.intent || record?.context?.intent || null,
    placeName: record?.context?.placeName || null,
    competitorName: record?.context?.competitorName || null,
    estimatedMinutesSaved: benchmark.estimatedMinutesSaved || null,
    reusableClientSentence: compactText(benchmark.reusableClientSentence),
    rewriteNeeds: compactText(benchmark.rewriteNeeds),
    trustGaps: compactText(benchmark.trustGaps),
  };
}

function collectBenchmarkNotes(records = [], field, limit = 3) {
  return records
    .map((record) => compactRecord(record))
    .filter((record) => record[field])
    .slice(0, limit)
    .map((record) => ({
      createdAt: record.createdAt,
      placeName: record.placeName,
      competitorName: record.competitorName,
      value: record[field],
    }));
}

function buildValueDecision({ benchmarkRecords, savedStats, totalFunnel, fieldCoverage }) {
  const savedCount = numberOrZero(savedStats.count);
  const averageSavedMinutes = numberOrZero(savedStats.average);
  const submittedPerClick = Number(totalFunnel.submittedPerClick);
  const reusableSentences = numberOrZero(fieldCoverage.withReusableClientSentence);
  const clicked = numberOrZero(totalFunnel.clicked);
  const submitted = numberOrZero(totalFunnel.submitted);
  const hasSubmitRate = Number.isFinite(submittedPerClick);

  const targets = {
    minimumBenchmarkRecords: 3,
    minimumAverageSavedMinutes: 20,
    strongBenchmarkRecords: 5,
    strongAverageSavedMinutes: 30,
    minimumSubmittedPerClick: 0.35,
    minimumReusableClientSentences: 3,
  };

  const blockers = [];
  const strengths = [];

  if (benchmarkRecords < targets.minimumBenchmarkRecords) {
    blockers.push(
      `Need ${targets.minimumBenchmarkRecords - benchmarkRecords} more structured benchmark record(s).`
    );
  } else {
    strengths.push("Minimum structured benchmark sample reached.");
  }

  if (savedCount < targets.minimumBenchmarkRecords) {
    blockers.push(`Need ${targets.minimumBenchmarkRecords - savedCount} more usable time-saved record(s).`);
  } else if (averageSavedMinutes < targets.minimumAverageSavedMinutes) {
    blockers.push(`Average saved time is ${averageSavedMinutes}m; target is at least ${targets.minimumAverageSavedMinutes}m.`);
  } else {
    strengths.push(`Average saved time is ${averageSavedMinutes}m.`);
  }

  if (clicked === 0) {
    blockers.push("No benchmark CTA clicks yet.");
  } else if (submitted === 0) {
    blockers.push("Benchmark CTA has clicks but no submissions yet.");
  } else if (hasSubmitRate && submittedPerClick < targets.minimumSubmittedPerClick) {
    blockers.push(
      `Benchmark submit rate is ${formatRate(submittedPerClick)}; target is at least ${formatRate(
        targets.minimumSubmittedPerClick
      )}.`
    );
  } else {
    strengths.push(`Benchmark submit rate is ${formatRate(submittedPerClick)}.`);
  }

  if (reusableSentences < targets.minimumReusableClientSentences) {
    blockers.push(
      `Need ${targets.minimumReusableClientSentences - reusableSentences} more reusable client sentence(s).`
    );
  } else {
    strengths.push("Enough reusable client-language proof exists.");
  }

  let status = "not_enough_signal";
  if (
    benchmarkRecords >= targets.strongBenchmarkRecords &&
    savedCount >= targets.strongBenchmarkRecords &&
    averageSavedMinutes >= targets.strongAverageSavedMinutes &&
    (!hasSubmitRate || submittedPerClick >= targets.minimumSubmittedPerClick) &&
    reusableSentences >= targets.minimumReusableClientSentences
  ) {
    status = "strong";
  } else if (
    benchmarkRecords >= targets.minimumBenchmarkRecords &&
    savedCount >= targets.minimumBenchmarkRecords &&
    averageSavedMinutes >= targets.minimumAverageSavedMinutes &&
    (!hasSubmitRate || submittedPerClick >= targets.minimumSubmittedPerClick)
  ) {
    status = reusableSentences >= targets.minimumReusableClientSentences ? "promising" : "needs_proof_copy";
  } else if (benchmarkRecords > 0 || submitted > 0 || clicked > 0) {
    status = "collecting";
  }

  return {
    target: "¥2,980/mo Pro beta value",
    status,
    targets,
    metrics: {
      benchmarkRecords,
      savedCount,
      averageSavedMinutes,
      submittedPerClick: roundedRate(submittedPerClick),
      reusableClientSentences: reusableSentences,
    },
    blockers,
    strengths,
  };
}

function buildRecommendationList({ benchmarkRecords, savedStats, totalFunnel, fieldCoverage }) {
  const clicked = numberOrZero(totalFunnel.clicked);
  const submitted = numberOrZero(totalFunnel.submitted);
  const rate = Number(totalFunnel.submittedPerClick);
  const recommendations = [];

  if (clicked === 0) {
    recommendations.push(
      "Drive 3-5 report viewers to the benchmark CTA; there is no proof yet that users are seeing the value check."
    );
  } else if (submitted === 0) {
    recommendations.push(
      "Clicks exist but submissions are zero; reduce modal friction or ask the benchmark questions directly after a report walkthrough."
    );
  } else if (Number.isFinite(rate) && rate < 0.35) {
    recommendations.push(
      "Benchmark submissions are below the 35% working threshold; tighten the CTA copy and shorten the first required response."
    );
  } else {
    recommendations.push(
      "Keep collecting benchmark responses; the click-to-submit path is producing usable signal."
    );
  }

  if (!benchmarkRecords) {
    recommendations.push(
      "Collect at least 3 structured benchmark records before treating the ¥2,980/mo value hypothesis as validated."
    );
  } else if (numberOrZero(savedStats.count) < benchmarkRecords) {
    recommendations.push(
      "Some benchmark records are missing usable time-saved fields; keep the template focused on before time, after time, and reusable client sentence."
    );
  }

  if (savedStats.average && savedStats.average < 20) {
    recommendations.push(
      "Average time saved is under 20 minutes; improve report reuse and client-ready wording before raising confidence."
    );
  }

  if (fieldCoverage.withTrustGaps > 0 || fieldCoverage.withRewriteNeeds > 0) {
    recommendations.push(
      "Prioritize the repeated trust gaps and rewrite needs from benchmark feedback before adding new feature surface."
    );
  }

  return recommendations;
}

export function buildValueSummary({ feedbackPayload = {}, eventsPayload = {}, generatedAt = new Date().toISOString() } = {}) {
  const benchmarkStats = feedbackPayload.benchmarkStats || {};
  const savedStats = benchmarkStats.estimatedMinutesSaved || {};
  const totalFunnel = eventsPayload.benchmarkFunnel?.total || {};
  const clicked = numberOrZero(totalFunnel.clicked);
  const submitted = numberOrZero(totalFunnel.submitted);
  const benchmarkRecords = numberOrZero(benchmarkStats.records);
  const recentRecords = Array.isArray(feedbackPayload.recent) ? feedbackPayload.recent : [];

  const fieldCoverage = {
    withUsualPrepTime: numberOrZero(benchmarkStats.withUsualPrepTime),
    withFlowmetricTime: numberOrZero(benchmarkStats.withFlowmetricTime),
    withEstimatedMinutesSaved: numberOrZero(benchmarkStats.withEstimatedMinutesSaved),
    withReusableClientSentence: numberOrZero(benchmarkStats.withReusableClientSentence),
    withRewriteNeeds: numberOrZero(benchmarkStats.withRewriteNeeds),
    withTrustGaps: numberOrZero(benchmarkStats.withTrustGaps),
  };

  const signal =
    benchmarkRecords >= 3 && numberOrZero(savedStats.count) >= 3
      ? "measurable"
      : benchmarkRecords > 0 || submitted > 0
        ? "early"
        : clicked > 0
          ? "attention"
          : "thin";

  const summary = {
    generatedAt,
    signal,
    events: {
      returned: numberOrZero(eventsPayload.returned),
      scanned: numberOrZero(eventsPayload.scanned),
      days: numberOrZero(eventsPayload.days),
      benchmarkFunnel: {
        beta: eventsPayload.benchmarkFunnel?.beta || {},
        report: eventsPayload.benchmarkFunnel?.report || {},
        total: {
          clicked,
          submitted,
          submittedPerClick: roundedRate(totalFunnel.submittedPerClick),
        },
      },
    },
    feedback: {
      returned: numberOrZero(feedbackPayload.returned),
      scanned: numberOrZero(feedbackPayload.scanned),
      benchmarkRecords,
      estimatedMinutesSaved: savedStats,
      fieldCoverage,
    },
    recentProof: recentRecords.map(compactRecord).filter((record) => record.estimatedMinutesSaved).slice(0, 3),
    openQuestions: {
      rewriteNeeds: collectBenchmarkNotes(recentRecords, "rewriteNeeds"),
      trustGaps: collectBenchmarkNotes(recentRecords, "trustGaps"),
    },
  };

  summary.decision = buildValueDecision({
    benchmarkRecords,
    savedStats,
    totalFunnel: summary.events.benchmarkFunnel.total,
    fieldCoverage,
  });

  summary.recommendations = buildRecommendationList({
    benchmarkRecords,
    savedStats,
    totalFunnel: summary.events.benchmarkFunnel.total,
    fieldCoverage,
  });

  return summary;
}

export function formatValueSummary(summary) {
  const total = summary.events.benchmarkFunnel.total;
  const decision = summary.decision || {};
  const decisionMetrics = decision.metrics || {};
  const lines = [
    `value summary generatedAt=${summary.generatedAt}`,
    `value proof: ${summary.signal}`,
    `value decision: ${decision.status || "unknown"} (${decision.target || "value target"}; records ${
      decisionMetrics.benchmarkRecords || 0
    }/${decision.targets?.minimumBenchmarkRecords || 3}; avgSaved=${decisionMetrics.averageSavedMinutes || 0}m; submitRate=${formatRate(
      decisionMetrics.submittedPerClick
    )})`,
    `benchmark funnel: clicked=${total.clicked || 0} submitted=${total.submitted || 0} rate=${formatRate(
      total.submittedPerClick
    )}`,
    `benchmark feedback: records=${summary.feedback.benchmarkRecords || 0} saved=${formatMinuteStats(
      summary.feedback.estimatedMinutesSaved
    )}`,
    [
      `field coverage: usualPrep=${summary.feedback.fieldCoverage.withUsualPrepTime || 0}`,
      `flowmetricTime=${summary.feedback.fieldCoverage.withFlowmetricTime || 0}`,
      `reusableSentence=${summary.feedback.fieldCoverage.withReusableClientSentence || 0}`,
      `rewriteNeeds=${summary.feedback.fieldCoverage.withRewriteNeeds || 0}`,
      `trustGaps=${summary.feedback.fieldCoverage.withTrustGaps || 0}`,
    ].join(", "),
    "",
    "next actions:",
  ];

  summary.recommendations.forEach((item, index) => {
    lines.push(`${index + 1}. ${item}`);
  });

  if (Array.isArray(decision.blockers) && decision.blockers.length) {
    lines.push("", "decision gaps:");
    decision.blockers.forEach((item) => lines.push(`- ${item}`));
  }

  if (summary.recentProof.length) {
    lines.push("", "recent proof:");
    summary.recentProof.forEach((record) => {
      const context = [record.placeName, record.competitorName ? `vs ${record.competitorName}` : ""]
        .filter(Boolean)
        .join(" ");
      lines.push(`- ${context || record.intent || "benchmark record"} | saved=${record.estimatedMinutesSaved}`);
      if (record.reusableClientSentence) lines.push(`  reusable: ${record.reusableClientSentence}`);
    });
  }

  const gaps = [...summary.openQuestions.trustGaps, ...summary.openQuestions.rewriteNeeds].slice(0, 5);
  if (gaps.length) {
    lines.push("", "open questions:");
    gaps.forEach((item) => {
      const context = [item.placeName, item.competitorName ? `vs ${item.competitorName}` : ""]
        .filter(Boolean)
        .join(" ");
      lines.push(`- ${context || item.createdAt || "benchmark"}: ${item.value}`);
    });
  }

  return lines.join("\n");
}

function markdownCell(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
}

function markdownList(items = [], fallback = "- none") {
  if (!Array.isArray(items) || !items.length) return fallback;
  return items.map((item) => `- ${item}`).join("\n");
}

export function formatValueSummaryMarkdown(summary) {
  const total = summary.events.benchmarkFunnel.total;
  const decision = summary.decision || {};
  const metrics = decision.metrics || {};
  const lines = [
    `# Flowmetric Value Summary`,
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    `## Decision`,
    "",
    `| Field | Value |`,
    `| --- | --- |`,
    `| Value proof | ${markdownCell(summary.signal)} |`,
    `| Decision status | ${markdownCell(decision.status || "unknown")} |`,
    `| Target | ${markdownCell(decision.target || "value target")} |`,
    `| Benchmark records | ${markdownCell(`${metrics.benchmarkRecords || 0}/${decision.targets?.minimumBenchmarkRecords || 3}`)} |`,
    `| Average saved time | ${markdownCell(`${metrics.averageSavedMinutes || 0}m`)} |`,
    `| Benchmark submit rate | ${markdownCell(formatRate(metrics.submittedPerClick))} |`,
    `| Reusable client sentences | ${markdownCell(metrics.reusableClientSentences || 0)} |`,
    "",
    `## Funnel`,
    "",
    `| Metric | Value |`,
    `| --- | --- |`,
    `| Clicked | ${markdownCell(total.clicked || 0)} |`,
    `| Submitted | ${markdownCell(total.submitted || 0)} |`,
    `| Submitted per click | ${markdownCell(formatRate(total.submittedPerClick))} |`,
    "",
    `## Feedback`,
    "",
    `| Metric | Value |`,
    `| --- | --- |`,
    `| Benchmark records | ${markdownCell(summary.feedback.benchmarkRecords || 0)} |`,
    `| Estimated minutes saved | ${markdownCell(formatMinuteStats(summary.feedback.estimatedMinutesSaved))} |`,
    `| Usual prep fields | ${markdownCell(summary.feedback.fieldCoverage.withUsualPrepTime || 0)} |`,
    `| Flowmetric time fields | ${markdownCell(summary.feedback.fieldCoverage.withFlowmetricTime || 0)} |`,
    `| Reusable sentence fields | ${markdownCell(summary.feedback.fieldCoverage.withReusableClientSentence || 0)} |`,
    `| Rewrite needs fields | ${markdownCell(summary.feedback.fieldCoverage.withRewriteNeeds || 0)} |`,
    `| Trust gaps fields | ${markdownCell(summary.feedback.fieldCoverage.withTrustGaps || 0)} |`,
    "",
    `## Next Actions`,
    "",
    markdownList(summary.recommendations),
  ];

  if (Array.isArray(decision.blockers) && decision.blockers.length) {
    lines.push("", "## Decision Gaps", "", markdownList(decision.blockers));
  }

  if (Array.isArray(decision.strengths) && decision.strengths.length) {
    lines.push("", "## Strengths", "", markdownList(decision.strengths));
  }

  if (summary.recentProof.length) {
    lines.push("", "## Recent Proof", "");
    summary.recentProof.forEach((record) => {
      const context = [record.placeName, record.competitorName ? `vs ${record.competitorName}` : ""]
        .filter(Boolean)
        .join(" ");
      lines.push(`- ${context || record.intent || "benchmark record"}: saved ${record.estimatedMinutesSaved}`);
      if (record.reusableClientSentence) lines.push(`  - reusable: ${record.reusableClientSentence}`);
    });
  }

  const gaps = [...summary.openQuestions.trustGaps, ...summary.openQuestions.rewriteNeeds].slice(0, 5);
  if (gaps.length) {
    lines.push("", "## Open Questions", "");
    gaps.forEach((item) => {
      const context = [item.placeName, item.competitorName ? `vs ${item.competitorName}` : ""]
        .filter(Boolean)
        .join(" ");
      lines.push(`- ${context || item.createdAt || "benchmark"}: ${item.value}`);
    });
  }

  return `${lines.join("\n")}\n`;
}

async function fetchJsonEndpoint({ origin, token, endpoint, params = {} }) {
  const url = new URL(`${origin}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => addParam(url, key, value));

  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  const text = await response.text();
  let payload = null;

  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }

  if (!response.ok || !payload || typeof payload !== "object") {
    const details = payload ? JSON.stringify(payload, null, 2) : text;
    throw new Error(`${endpoint} request failed (${response.status}).\n${details}`);
  }

  return payload;
}

async function writeOutputIfRequested(outputPath, payload) {
  if (!outputPath) return;
  const fullPath = path.resolve(outputPath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function writeTextOutputIfRequested(outputPath, text) {
  if (!outputPath) return;
  const fullPath = path.resolve(outputPath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, text.endsWith("\n") ? text : `${text}\n`, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const origin = normalizeOrigin(
    args.origin || process.env.VALUE_SUMMARY_ORIGIN || "https://gbp-diagnosis-mvp.pages.dev"
  );
  const token = String(args.token || process.env.FEEDBACK_ADMIN_TOKEN || "").trim();
  const outputPath = String(args.output || process.env.VALUE_SUMMARY_OUTPUT || "").trim();
  const markdownOutputPath = String(
    args["markdown-output"] || process.env.VALUE_SUMMARY_MARKDOWN_OUTPUT || ""
  ).trim();
  const format = normalizeFormat(args.format || process.env.VALUE_SUMMARY_FORMAT || "text");

  if (!origin) {
    throw new Error("Set --origin or VALUE_SUMMARY_ORIGIN before running value summary.");
  }

  if (!token) {
    throw new Error(
      adminTokenMissingHelp(
        "value summary",
        "npm run value:summary -- --days 7"
      )
    );
  }

  const days = args.days || "7";
  const limit = args.limit || "100";
  const [feedbackPayload, eventsPayload] = await Promise.all([
    fetchJsonEndpoint({
      origin,
      token,
      endpoint: "/api/feedback-summary",
      params: {
        tag: "value_benchmark",
        limit,
      },
    }),
    fetchJsonEndpoint({
      origin,
      token,
      endpoint: "/api/events-summary",
      params: {
        days,
        limit,
      },
    }),
  ]);

  const summary = buildValueSummary({ feedbackPayload, eventsPayload });
  await writeOutputIfRequested(outputPath, summary);
  await writeTextOutputIfRequested(markdownOutputPath, formatValueSummaryMarkdown(summary));

  if (format === "json") {
    console.log(JSON.stringify(summary, null, 2));
  } else if (format === "markdown") {
    console.log(formatValueSummaryMarkdown(summary).trimEnd());
  } else {
    console.log(formatValueSummary(summary));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    printCliError(error);
    process.exit(1);
  });
}
