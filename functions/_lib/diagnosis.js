function analyzeCompetitors(competitors) {
  if (!competitors || competitors.status !== "OK") {
    return {
      penalty: 0,
      strongCount: null,
      todo: "Competitor analysis is unavailable right now.",
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
      ? "There are few strong competitors nearby."
      : `There are ${strongCount} strong competitors nearby (rating 4.2+ and 200+ reviews).`;

  return { penalty, strongCount, todo };
}

export function buildDiagnosis(details, competitors) {
  const missing = [];
  const todos = [];
  const comp = analyzeCompetitors(competitors);

  const rules = [
    {
      id: "phone",
      weight: 30,
      isMissing: (d) => !d?.international_phone_number,
      todo: "Add a phone number to the listing.",
    },
    {
      id: "website",
      weight: 20,
      isMissing: (d) => !d?.website,
      todo: "Add a website to the listing.",
    },
    {
      id: "photos",
      weight: 10,
      isMissing: (d) => (d?.photos?.length ?? 0) < 5,
      todo: "Add more listing photos (target: at least 5).",
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
