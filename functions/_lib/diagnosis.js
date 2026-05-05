function isJapanese(lang = "en") {
  return String(lang || "").toLowerCase().startsWith("ja");
}

function diagnosisCopy(lang = "en") {
  const ja = isJapanese(lang);

  return {
    competitorUnavailable: ja
      ? "競合分析は現在利用できません。"
      : "Competitor analysis is unavailable right now.",
    fewStrongCompetitorsNearby: ja
      ? "近隣に強い競合はあまり見当たりません。"
      : "There are few strong competitors nearby.",
    strongCompetitorsNearby: ({ count }) =>
      ja
        ? `近隣に強い競合が${count}件あります（評価4.2以上・レビュー200件以上）。`
        : `There are ${count} strong competitors nearby (rating 4.2+ and 200+ reviews).`,
    addPhone: ja
      ? "電話番号を掲載してください。"
      : "Add a phone number to the listing.",
    addWebsite: ja
      ? "公式サイトまたは事業ページを掲載してください（例: ホームページ、予約ページ、メニュー/サービスページ）。"
      : "Add an official website or business page to the listing (for example, your homepage, booking page, or menu/services page).",
    addPhotos: ja
      ? "写真を追加してください（目安: 5枚以上）。"
      : "Add more listing photos (target: at least 5).",
  };
}

function analyzeCompetitors(competitors, lang = "en") {
  const copy = diagnosisCopy(lang);

  if (!competitors || competitors.status !== "OK") {
    return {
      penalty: 0,
      strongCount: null,
      todo: copy.competitorUnavailable,
    };
  }

  const list = competitors.results ?? [];
  const strongCount = list.filter((p) => (p.rating ?? 0) >= 4.2 && (p.user_ratings_total ?? 0) >= 200).length;

  let penalty = 0;
  if (strongCount === 1) penalty = 5;
  else if (strongCount === 2) penalty = 10;
  else if (strongCount === 3) penalty = 15;
  else if (strongCount >= 4) penalty = 20;

  const todo =
    penalty === 0
      ? copy.fewStrongCompetitorsNearby
      : copy.strongCompetitorsNearby({ count: strongCount });

  return { penalty, strongCount, todo };
}

function reviewBasePenalty(totalReviewCount) {
  if (!Number.isFinite(totalReviewCount)) return 0;
  if (totalReviewCount < 20) return 20;
  if (totalReviewCount < 50) return 12;
  if (totalReviewCount < 100) return 6;
  return 0;
}

function ratingPenalty(rating) {
  if (!Number.isFinite(rating)) return 0;
  if (rating < 3.8) return 25;
  if (rating < 4.0) return 18;
  if (rating < 4.2) return 12;
  if (rating < 4.5) return 6;
  return 0;
}

function commercialLevel(score) {
  if (score >= 82) return "strong";
  if (score >= 65) return "watch";
  return "risk";
}

function commercialHealthLabel(level, lang = "en") {
  const ja = isJapanese(lang);
  if (level === "strong") return ja ? "商業面は安定" : "Commercially steady";
  if (level === "watch") return ja ? "商業面は要観察" : "Commercial watch";
  return ja ? "商業面は要改善" : "Commercial risk";
}

function buildCommercialHealth({ details, competitorsAnalysis, lang = "en" } = {}) {
  const ja = isJapanese(lang);
  const reviewCount = Number.isFinite(details?.user_ratings_total)
    ? Number(details.user_ratings_total)
    : null;
  const rating = Number.isFinite(details?.rating) ? Number(details.rating) : null;
  const reviewPenalty = reviewBasePenalty(reviewCount);
  const ratePenalty = ratingPenalty(rating);
  const competitorPenalty = Number.isFinite(competitorsAnalysis?.penalty)
    ? Number(competitorsAnalysis.penalty)
    : 0;
  const penalty = reviewPenalty + ratePenalty + competitorPenalty;
  const score = Math.max(0, 100 - penalty);
  const level = commercialLevel(score);
  const risks = [];

  if (ratePenalty > 0 && Number.isFinite(rating)) {
    risks.push(
      ja
        ? `評価 ${rating.toFixed(1)} のため、比較時の選ばれやすさに影響する可能性があります。`
        : `Rating is ${rating.toFixed(1)}, which can affect choice in side-by-side comparison.`
    );
  }

  if (reviewPenalty > 0 && Number.isFinite(reviewCount)) {
    risks.push(
      ja
        ? `総レビュー数が ${reviewCount} 件のため、見える信頼材料はまだ薄めです。`
        : `Total review count is ${reviewCount}, so visible trust proof is still thin.`
    );
  }

  if (competitorPenalty > 0 && competitorsAnalysis?.todo) {
    risks.push(competitorsAnalysis.todo);
  }

  const summary =
    risks[0] ||
    (ja
      ? "評価・レビュー規模・競合環境に大きな商業リスクは目立っていません。"
      : "Rating, review scale, and competitor context do not show a major commercial risk right now.");

  return {
    score,
    level,
    label: commercialHealthLabel(level, lang),
    summary,
    risks,
    components: {
      rating,
      reviewCount,
      ratingPenalty: ratePenalty,
      reviewBasePenalty: reviewPenalty,
      competitorPenalty,
    },
  };
}

export function buildDiagnosis(details, competitors, { lang = "en" } = {}) {
  const copy = diagnosisCopy(lang);
  const missing = [];
  const todos = [];
  const comp = analyzeCompetitors(competitors, lang);

  const rules = [
    {
      id: "phone",
      weight: 30,
      isMissing: (d) => !d?.international_phone_number,
      todo: copy.addPhone,
    },
    {
      id: "website",
      weight: 20,
      isMissing: (d) => !d?.website,
      todo: copy.addWebsite,
    },
    {
      id: "photos",
      weight: 10,
      isMissing: (d) => (d?.photos?.length ?? 0) < 5,
      todo: copy.addPhotos,
    },
  ];

  let profilePenalty = 0;
  for (const r of rules) {
    if (r.isMissing(details)) {
      missing.push(r.id);
      todos.push(r.todo);
      profilePenalty += r.weight;
    }
  }

  const environment = [];
  if (comp.penalty > 0) environment.push(comp.todo);
  const profileCompletenessScore = Math.max(0, 100 - profilePenalty);
  const commercialHealth = buildCommercialHealth({
    details,
    competitorsAnalysis: comp,
    lang,
  });

  return {
    version: "buildDiagnosis_v3",
    score: profileCompletenessScore,
    profileCompletenessScore,
    profileCompletenessPenalty: profilePenalty,
    todos,
    missing,
    penalty: profilePenalty,
    breakdown: rules.map((r) => ({ id: r.id, weight: r.weight, missing: r.isMissing(details) })),
    competitorsAnalysis: comp,
    commercialHealth,
    environment,
  };
}
