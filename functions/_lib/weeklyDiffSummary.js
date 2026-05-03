function isJapanese(lang = "en") {
  return String(lang || "").toLowerCase().startsWith("ja");
}

function text(lang, en, ja) {
  return isJapanese(lang) ? ja : en;
}

function uniqueStrings(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function numberOrNull(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

function roundedDelta(current, previous, digits = 0) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  const factor = 10 ** digits;
  return Math.round((Number(current) - Number(previous)) * factor) / factor;
}

function metricTone(delta, { higherIsBetter = true } = {}) {
  if (!Number.isFinite(delta) || delta === 0) return "neutral";
  const good = higherIsBetter ? delta > 0 : delta < 0;
  return good ? "positive" : "warning";
}

function pointInTimeTone(value, { nonNegativeIsGood = true } = {}) {
  if (!Number.isFinite(value) || value === 0) return "neutral";
  const good = nonNegativeIsGood ? value >= 0 : value <= 0;
  return good ? "positive" : "warning";
}

function latestCheckAgeDays(record) {
  const raw = record?.lastCheckedAt ?? record?.latestMetrics?.capturedAt ?? null;
  const ts = Date.parse(String(raw || ""));
  if (!Number.isFinite(ts)) return null;
  return (Date.now() - ts) / (24 * 60 * 60 * 1000);
}

function hasPreviousMetrics(record) {
  const latestAt = record?.latestMetrics?.capturedAt ?? null;
  const previousAt = record?.previousMetrics?.capturedAt ?? null;
  return Boolean(latestAt && previousAt && String(latestAt) !== String(previousAt));
}

function metric({ key, label, current, previous = null, delta = null, tone = "neutral" }) {
  return {
    key,
    label,
    current: numberOrNull(current),
    previous: numberOrNull(previous),
    delta: numberOrNull(delta),
    tone,
  };
}

function firstFinite(...values) {
  return values.find((value) => Number.isFinite(value));
}

function periodLabel(record, lang) {
  const latest = record?.latestMetrics?.capturedAt ?? record?.lastCheckedAt ?? null;
  const previous = record?.previousMetrics?.capturedAt ?? null;
  const formatter = new Intl.DateTimeFormat(isJapanese(lang) ? "ja-JP" : "en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  function format(value) {
    const ts = Date.parse(String(value || ""));
    if (!Number.isFinite(ts)) return null;
    return formatter.format(new Date(ts));
  }

  const fromLabel = format(previous);
  const toLabel = format(latest);
  return {
    from: previous,
    to: latest,
    label: fromLabel && toLabel ? `${fromLabel} -> ${toLabel}` : toLabel || null,
  };
}

function reviewThemeMonitoringNote(reviewThemeMonitoring) {
  if (!reviewThemeMonitoring?.notableShift) return null;
  if (reviewThemeMonitoring.status === "ready") return reviewThemeMonitoring.notableShift;
  if (
    reviewThemeMonitoring.status === "collecting_history" &&
    Number(reviewThemeMonitoring.ownSnapshotCount) > 0
  ) {
    return reviewThemeMonitoring.notableShift;
  }
  return null;
}

function defaultCollectingSummary({
  record,
  lang,
  status = "collecting_history",
  reviewThemeMonitoring = null,
}) {
  const noCompetitor = status === "no_competitor";
  const themeNote = reviewThemeMonitoringNote(reviewThemeMonitoring);
  return {
    status,
    tone: "collecting",
    period: periodLabel(record, lang),
    headline: noCompetitor
      ? text(lang, "Choose a competitor to start weekly comparison", "週次比較を始めるには競合を選んでください")
      : text(lang, "Collecting weekly comparison history", "週次比較の履歴を収集中です"),
    clientSummary: [
      noCompetitor
        ? text(
            lang,
            "A weekly client update needs a selected competitor before momentum can be compared.",
            "週次のクライアント報告には、比較対象の競合選択が必要です。"
          )
        : text(
            lang,
            "Today's baseline is still usable: competitor choice, visible proof gaps, and the first recommended task are ready for the client update.",
            "今日の基準値も、競合選定・見える根拠差・最初の推奨タスクとしてクライアント報告に使えます。"
          ),
      themeNote,
    ],
    metrics: [],
    notableChange: null,
    nextAction: noCompetitor
      ? text(lang, "Select the competitor this client actually cares about.", "このクライアントにとって本当に比較したい競合を選んでください。")
      : text(
          lang,
          "Reopen this saved listing next week to turn today's baseline into actual movement.",
          "保存済み店舗を次週もう一度開いて、今日の基準値を実際の変化に変えてください。"
        ),
    confidence: "low",
  };
}

export function buildWeeklyDiffSummary(
  record,
  {
    lang = "en",
    reviewThemeMonitoring = null,
    changeSummary = null,
    reviewDropSignal = null,
    weeklyReport = null,
  } = {}
) {
  if (!record?.competitorPlaceId) {
    return defaultCollectingSummary({
      record,
      lang,
      status: "no_competitor",
      reviewThemeMonitoring,
    });
  }

  const latest = record?.latestMetrics ?? null;
  const previous = record?.previousMetrics ?? null;
  if (!latest || !hasPreviousMetrics(record)) {
    return defaultCollectingSummary({ record, lang, reviewThemeMonitoring });
  }

  const reviewDelta = roundedDelta(latest?.reviewCount, previous?.reviewCount, 0);
  const ratingDelta = roundedDelta(latest?.rating, previous?.rating, 1);
  const photoDelta = roundedDelta(latest?.photoCount, previous?.photoCount, 0);
  const totalReviewGap = firstFinite(weeklyReport?.totalDiff, record?.compareTotalDiff);
  const weeklyMomentumGap = firstFinite(weeklyReport?.weeklyGainDiff, record?.compareDeltaDiff);
  const checkAgeDays = latestCheckAgeDays(record);
  const stale = Number.isFinite(checkAgeDays) && checkAgeDays > 10;
  const themeWorsening =
    reviewThemeMonitoring?.trend === "worsening" ||
    reviewThemeMonitoring?.gapDirection === "widening";
  const themeImproving =
    reviewThemeMonitoring?.trend === "improving" ||
    reviewThemeMonitoring?.gapDirection === "narrowing";
  const materialReviewDrop =
    reviewDropSignal?.visible === true ||
    (Number.isFinite(reviewDelta) && reviewDelta <= -2);
  const positiveMovement =
    [reviewDelta, ratingDelta, photoDelta].some((value) => Number.isFinite(value) && value > 0) &&
    !(Number.isFinite(weeklyMomentumGap) && weeklyMomentumGap < 0);

  const metrics = [
    metric({
      key: "reviews",
      label: text(lang, "Reviews", "レビュー"),
      current: latest?.reviewCount,
      previous: previous?.reviewCount,
      delta: reviewDelta,
      tone: metricTone(reviewDelta),
    }),
    metric({
      key: "rating",
      label: text(lang, "Rating", "評価"),
      current: latest?.rating,
      previous: previous?.rating,
      delta: ratingDelta,
      tone: metricTone(ratingDelta),
    }),
    metric({
      key: "photos",
      label: text(lang, "Photos", "写真"),
      current: latest?.photoCount,
      previous: previous?.photoCount,
      delta: photoDelta,
      tone: metricTone(photoDelta),
    }),
    metric({
      key: "competitor_review_gap",
      label: text(lang, "Review gap vs competitor", "競合とのレビュー差"),
      current: totalReviewGap,
      tone: pointInTimeTone(totalReviewGap),
    }),
    metric({
      key: "weekly_momentum_gap",
      label: text(lang, "Weekly review momentum", "週間レビュー勢い差"),
      current: weeklyMomentumGap,
      tone: pointInTimeTone(weeklyMomentumGap),
    }),
  ].filter((item) =>
    Number.isFinite(item.current) ||
    Number.isFinite(item.previous) ||
    Number.isFinite(item.delta)
  );

  let tone = "neutral";
  let headline = text(lang, "No major weekly change", "今週の大きな変化はありません");
  let notableChange = changeSummary?.lines?.[0] || null;
  let nextAction = text(
    lang,
    "Keep monitoring this listing and use the current comparison in the next client update.",
    "この比較を次回定例の材料にしつつ、継続して確認してください。"
  );

  if (stale) {
    tone = "collecting";
    headline = text(lang, "Needs a fresh weekly check", "最新の週次確認が必要です");
    notableChange = text(
      lang,
      "This saved listing has not been refreshed recently.",
      "この保存済み店舗は最近更新されていません。"
    );
    nextAction = text(lang, "Open the latest report and refresh this listing before client reporting.", "クライアント報告前に最新レポートを開いて更新してください。");
  } else if (Number.isFinite(ratingDelta) && ratingDelta < 0) {
    tone = "warning";
    headline = text(lang, "Rating slipped since the last check", "前回確認から評価が下がっています");
    notableChange = text(lang, `Rating changed by ${ratingDelta}.`, `評価が ${ratingDelta} 変化しました。`);
    nextAction = text(lang, "Review recent low-rated feedback and prepare one recovery action for the client.", "直近の低評価レビューを確認し、クライアント向けに回復施策を1つ用意してください。");
  } else if (materialReviewDrop) {
    tone = "warning";
    headline = text(lang, "Review count dropped since the last check", "前回確認からレビュー数が減っています");
    notableChange = reviewDropSignal?.reason || text(lang, `Reviews changed by ${reviewDelta}.`, `レビューが ${reviewDelta} 件変化しました。`);
    nextAction = text(lang, "Confirm whether reviews disappeared and run one fresh review request push.", "レビュー減少が続いているか確認し、新しいレビュー依頼を1回実施してください。");
  } else if (Number.isFinite(weeklyMomentumGap) && weeklyMomentumGap < 0) {
    tone = "warning";
    headline = text(lang, "Competitor gained review momentum this week", "今週は競合のレビュー増加ペースが強めです");
    notableChange = text(
      lang,
      `Competitor momentum is ahead by ${Math.abs(weeklyMomentumGap)} review(s).`,
      `競合のレビュー増加ペースが ${Math.abs(weeklyMomentumGap)} 件分上回っています。`
    );
    nextAction = text(lang, "Add fresh proof this week: new photos plus one review request push.", "今週は新しい写真追加とレビュー依頼を1回実施してください。");
  } else if (Number.isFinite(totalReviewGap) && totalReviewGap < 0) {
    tone = "warning";
    headline = text(lang, "Competitor still leads in review volume", "競合がレビュー総数でまだ先行しています");
    notableChange = text(lang, `Current review gap is ${totalReviewGap}.`, `現在のレビュー差は ${totalReviewGap} 件です。`);
    nextAction = text(lang, "Use photos and review requests to close the easiest visible proof gap.", "写真とレビュー依頼で、まず見た目に分かる根拠差を埋めてください。");
  } else if (themeWorsening) {
    tone = "warning";
    headline = text(lang, "Review themes need attention", "レビュー傾向に注意が必要です");
    notableChange = reviewThemeMonitoring?.notableShift || notableChange;
    nextAction = reviewThemeMonitoring?.nextAction || nextAction;
  } else if (themeImproving) {
    tone = "positive";
    headline = text(lang, "Review themes moved in the right direction", "レビュー傾向が良い方向に動いています");
    notableChange = reviewThemeMonitoring?.notableShift || notableChange;
    nextAction = reviewThemeMonitoring?.nextAction || text(
      lang,
      "Use this as proof of progress in the next client update.",
      "次回定例で、見える改善の根拠として共有してください。"
    );
  } else if (positiveMovement) {
    tone = "positive";
    headline = text(lang, "Visible proof improved this week", "今週は見える根拠が改善しています");
    notableChange = changeSummary?.lines?.find((line) => !/unchanged|変化なし/i.test(line)) || notableChange;
    nextAction = text(lang, "Mention the visible progress in the next client update and keep the same action cadence.", "次回定例で見える進捗として共有し、同じ改善ペースを続けてください。");
  }

  const clientSummary = uniqueStrings([
    notableChange,
    Number.isFinite(weeklyMomentumGap)
      ? weeklyMomentumGap < 0
        ? text(lang, "Competitor review momentum is stronger right now.", "現時点では競合のレビュー増加ペースが強めです。")
        : weeklyMomentumGap > 0
          ? text(lang, "This listing is gaining reviews faster than the competitor.", "この店舗は競合よりレビュー増加ペースで上回っています。")
          : text(lang, "Weekly review momentum is close to the competitor.", "週間レビュー増加ペースは競合とほぼ同水準です。")
      : null,
    reviewThemeMonitoring?.status === "ready" && reviewThemeMonitoring?.notableShift
      ? reviewThemeMonitoring.notableShift
      : reviewThemeMonitoringNote(reviewThemeMonitoring),
  ]).slice(0, 3);

  return {
    status: stale ? "stale" : "ready",
    tone,
    period: periodLabel(record, lang),
    headline,
    clientSummary: clientSummary.length
      ? clientSummary
      : [text(lang, "No major movement stands out since the previous saved check.", "前回の保存確認から大きな変化は目立っていません。")],
    metrics,
    notableChange,
    nextAction,
    confidence:
      weeklyReport?.status === "ready" && reviewThemeMonitoring?.confidence === "medium"
        ? "high"
        : weeklyReport?.status === "ready" || reviewThemeMonitoring?.status === "ready"
          ? "medium"
          : "low",
  };
}
