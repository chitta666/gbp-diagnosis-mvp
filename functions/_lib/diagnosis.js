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

  let penalty = 0;
  for (const r of rules) {
    if (r.isMissing(details)) {
      missing.push(r.id);
      todos.push(r.todo);
      penalty += r.weight;
    }
  }

  const environment = [];
  if (comp.penalty > 0) environment.push(comp.todo);
  penalty += comp.penalty;

  return {
    version: "buildDiagnosis_v2",
    score: Math.max(0, 100 - penalty),
    todos,
    missing,
    penalty,
    breakdown: rules.map((r) => ({ id: r.id, weight: r.weight, missing: r.isMissing(details) })),
    competitorsAnalysis: comp,
    environment,
  };
}
