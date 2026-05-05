const THEME_GROUPS = [
  {
    key: "friendly_staff",
    label: {
      en: "friendly staff",
      ja: "スタッフの親切さ",
    },
    kind: "strength",
    keywords: [
      "friendly",
      "kind",
      "warm",
      "welcoming",
      "helpful",
      "staff",
      "service",
      "customer service",
      "hospitality",
      "explained",
      "guided",
      "親切",
      "丁寧",
      "優しい",
      "フレンドリー",
      "感じがいい",
      "対応が良い",
      "接客",
      "対応",
      "店員",
      "スタッフ",
      "サービス",
      "案内",
      "説明",
      "気遣い",
      "笑顔",
    ],
  },
  {
    key: "atmosphere",
    label: {
      en: "the atmosphere",
      ja: "雰囲気",
    },
    kind: "strength",
    keywords: [
      "atmosphere",
      "ambience",
      "cozy",
      "calm",
      "vibe",
      "beautiful interior",
      "interior",
      "decor",
      "space",
      "environment",
      "comfortable",
      "雰囲気",
      "居心地",
      "落ち着く",
      "おしゃれ",
      "素敵",
      "店内",
      "空間",
      "内装",
      "席",
      "静か",
      "快適",
      "景色",
      "眺め",
    ],
  },
  {
    key: "quality",
    label: {
      en: "product quality",
      ja: "商品・サービスの質",
    },
    kind: "strength",
    keywords: [
      "delicious",
      "tasty",
      "great food",
      "quality",
      "excellent",
      "amazing",
      "food",
      "dish",
      "meal",
      "menu",
      "ramen",
      "noodle",
      "soup",
      "coffee",
      "drink",
      "cut",
      "haircut",
      "finish",
      "treatment",
      "美味しい",
      "おいしい",
      "うまい",
      "美味",
      "味",
      "料理",
      "食事",
      "メニュー",
      "ラーメン",
      "麺",
      "スープ",
      "ご飯",
      "肉",
      "寿司",
      "カレー",
      "コーヒー",
      "飲み物",
      "品質",
      "クオリティ",
      "素晴らしい",
      "仕上がり",
      "カット",
      "カラー",
      "施術",
    ],
  },
  {
    key: "professionalism",
    label: {
      en: "professional service",
      ja: "プロらしい対応",
    },
    kind: "strength",
    keywords: [
      "professional",
      "knowledgeable",
      "skilled",
      "expert",
      "attentive",
      "skill",
      "technique",
      "experienced",
      "プロ",
      "知識",
      "技術",
      "上手",
      "的確",
      "しっかり",
      "腕",
      "経験",
      "安心",
    ],
  },
  {
    key: "cleanliness",
    label: {
      en: "a clean environment",
      ja: "清潔感",
    },
    kind: "strength",
    keywords: [
      "clean",
      "spotless",
      "neat",
      "organized",
      "tidy",
      "cleanliness",
      "sanitary",
      "well kept",
      "清潔",
      "きれい",
      "綺麗",
      "清掃",
      "清潔感",
      "衛生",
      "整って",
    ],
  },
  {
    key: "value",
    label: {
      en: "good value",
      ja: "価格納得感",
    },
    kind: "strength",
    keywords: [
      "good value",
      "worth it",
      "worth every penny",
      "reasonable price",
      "affordable",
      "great price",
      "cheap",
      "fair price",
      "fair pricing",
      "inexpensive",
      "reasonable",
      "リーズナブル",
      "良心的",
      "お得",
      "価格以上",
      "値段以上",
      "コスパが良い",
      "コスパいい",
      "コスパ良い",
      "コスパいい",
      "安い",
      "割安",
      "納得",
    ],
  },
  {
    key: "slow_service",
    label: {
      en: "slow service",
      ja: "対応の遅さ",
    },
    kind: "friction",
    keywords: [
      "slow",
      "waited",
      "waiting",
      "long wait",
      "took forever",
      "late",
      "line",
      "queue",
      "delay",
      "遅い",
      "待った",
      "待ち時間",
      "時間がかかる",
      "提供が遅い",
      "行列",
      "並ぶ",
      "遅れ",
    ],
  },
  {
    key: "confusing_process",
    label: {
      en: "an unclear process",
      ja: "分かりにくい導線",
    },
    kind: "friction",
    keywords: [
      "confusing",
      "unclear",
      "hard to find",
      "hard to book",
      "hard to order",
      "complicated",
      "unclear menu",
      "unclear pricing",
      "reservation",
      "booking",
      "分かりにくい",
      "わかりにくい",
      "見つけにくい",
      "予約しづらい",
      "注文しづらい",
      "複雑",
      "案内不足",
      "説明不足",
      "導線",
    ],
  },
  {
    key: "rude_service",
    label: {
      en: "unfriendly service",
      ja: "対応の悪さ",
    },
    kind: "friction",
    keywords: [
      "rude",
      "unhelpful",
      "dismissive",
      "bad attitude",
      "unprofessional",
      "bad service",
      "poor service",
      "staff",
      "service",
      "customer service",
      "不親切",
      "失礼",
      "態度が悪い",
      "無愛想",
      "感じが悪い",
      "接客",
      "対応",
      "店員",
      "スタッフ",
      "サービス",
    ],
  },
  {
    key: "noise_crowding",
    label: {
      en: "noise or crowding",
      ja: "騒がしさ・混雑",
    },
    kind: "friction",
    keywords: [
      "noisy",
      "loud",
      "crowded",
      "busy",
      "packed",
      "line",
      "queue",
      "cramped",
      "small space",
      "うるさい",
      "騒がしい",
      "混んで",
      "混雑",
      "人が多い",
      "行列",
      "並ぶ",
      "狭い",
      "席",
      "店内",
    ],
  },
  {
    key: "overpriced",
    label: {
      en: "value concerns",
      ja: "価格への不満",
    },
    kind: "friction",
    keywords: [
      "expensive",
      "overpriced",
      "pricey",
      "too much",
      "not worth",
      "cost",
      "pricing",
      "price",
      "expensive for",
      "poor value",
      "高い",
      "割高",
      "高すぎる",
      "高め",
      "コスパ",
      "値段",
      "価格",
      "料金",
      "費用",
    ],
  },
  {
    key: "poor_quality",
    label: {
      en: "quality issues",
      ja: "商品・サービスへの不満",
    },
    kind: "friction",
    keywords: [
      "bad food",
      "bland",
      "cold food",
      "poor quality",
      "sloppy",
      "botched",
      "terrible cut",
      "first time and last time",
      "food",
      "dish",
      "meal",
      "menu",
      "taste",
      "flavor",
      "ramen",
      "noodle",
      "soup",
      "cut",
      "haircut",
      "finish",
      "まずい",
      "微妙",
      "雑",
      "失敗",
      "下手",
      "期待外れ",
      "仕上がりが悪い",
      "味が薄い",
      "美味しくない",
      "味",
      "料理",
      "食事",
      "メニュー",
      "ラーメン",
      "麺",
      "スープ",
      "冷め",
      "ぬるい",
    ],
  },
  {
    key: "dirty",
    label: {
      en: "cleanliness concerns",
      ja: "清潔感への不満",
    },
    kind: "friction",
    keywords: [
      "dirty",
      "unclean",
      "messy",
      "smelly",
      "gross",
      "toilet",
      "bathroom",
      "dusty",
      "sticky",
      "汚い",
      "不衛生",
      "臭い",
      "におい",
      "散らか",
      "ベタベタ",
      "汚れ",
      "ほこり",
      "埃",
      "トイレ",
      "清潔",
    ],
  },
];

const CAVEAT_FRICTION_KEYWORDS = {
  slow_service: [
    "long wait",
    "took forever",
    "waited",
    "waiting",
    "delay",
    "待ち時間",
    "長い時間",
    "時間がかかる",
    "提供が遅い",
    "行列",
    "並ぶ",
  ],
  confusing_process: [
    "confusing",
    "unclear",
    "hard to find",
    "hard to book",
    "hard to order",
    "分かりにくい",
    "わかりにくい",
    "予約しづらい",
    "注文しづらい",
    "案内不足",
    "説明不足",
  ],
  rude_service: [
    "rude",
    "unhelpful",
    "dismissive",
    "bad attitude",
    "unprofessional",
    "bad service",
    "poor service",
    "不親切",
    "失礼",
    "態度が悪い",
    "無愛想",
    "感じが悪い",
  ],
  noise_crowding: [
    "noisy",
    "loud",
    "crowded",
    "packed",
    "cramped",
    "small space",
    "うるさい",
    "騒がしい",
    "混雑",
    "人が多い",
    "狭い",
    "行列",
    "並ぶ",
  ],
  overpriced: [
    "expensive",
    "overpriced",
    "pricey",
    "too much",
    "not worth",
    "poor value",
    "高い",
    "割高",
    "高すぎる",
    "高め",
    "もう少し安",
    "安ければ",
    "値段はもう少し",
    "価格はもう少し",
    "料金はもう少し",
  ],
  poor_quality: [
    "bad food",
    "bland",
    "cold food",
    "poor quality",
    "sloppy",
    "botched",
    "terrible cut",
    "まずい",
    "微妙",
    "雑",
    "失敗",
    "下手",
    "期待外れ",
    "仕上がりが悪い",
    "味が薄い",
    "美味しくない",
    "冷め",
    "ぬるい",
  ],
  dirty: [
    "dirty",
    "unclean",
    "messy",
    "smelly",
    "gross",
    "dusty",
    "sticky",
    "汚い",
    "不衛生",
    "臭い",
    "におい",
    "散らか",
    "ベタベタ",
    "汚れ",
    "ほこり",
    "埃",
  ],
};

function isJapanese(lang = "en") {
  return String(lang || "").toLowerCase().startsWith("ja");
}

function themeLabel(group, lang = "en") {
  return isJapanese(lang) ? group?.label?.ja : group?.label?.en;
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

function humanJoin(values, lang = "en") {
  const items = uniqueStrings(values);
  if (!items.length) return "";
  if (items.length === 1) return items[0];

  if (isJapanese(lang)) {
    if (items.length === 2) return `${items[0]}と${items[1]}`;
    return `${items.slice(0, -1).join("、")}、${items[items.length - 1]}`;
  }

  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function normalizeReviews(reviews) {
  return (Array.isArray(reviews) ? reviews : [])
    .map((review) => ({
      rating: Number.isFinite(review?.rating) ? Number(review.rating) : null,
      text: String(review?.text || "").trim(),
      time: Number.isFinite(review?.time) ? Number(review.time) : null,
    }))
    .filter((review) => review.text);
}

function collectThemeCounts(reviews) {
  const counts = new Map();

  reviews.forEach((review) => {
    const text = review.text.toLowerCase();
    THEME_GROUPS.forEach((group) => {
      if (group.keywords.some((keyword) => text.includes(String(keyword).toLowerCase()))) {
        counts.set(group.key, (counts.get(group.key) || 0) + 1);
      }
    });
  });

  return counts;
}

function rankedThemes(kind, counts, lang = "en") {
  const locale = isJapanese(lang) ? "ja" : "en";

  return THEME_GROUPS.filter((group) => group.kind === kind)
    .map((group) => ({
      ...group,
      displayLabel: themeLabel(group, lang),
      count: counts.get(group.key) || 0,
    }))
    .filter((group) => group.count > 0)
    .sort((a, b) => b.count - a.count || a.displayLabel.localeCompare(b.displayLabel, locale));
}

function hasTheme(groups, keys) {
  return groups.some((item) => keys.includes(item.key));
}

function countThemes(counts, keys) {
  return (Array.isArray(keys) ? keys : []).reduce(
    (sum, key) => sum + (Number(counts?.get(key)) || 0),
    0
  );
}

function mergeThemeCounts(...maps) {
  const merged = new Map();

  maps.forEach((map) => {
    if (!(map instanceof Map)) return;
    map.forEach((count, key) => {
      merged.set(key, (merged.get(key) || 0) + (Number(count) || 0));
    });
  });

  return merged;
}

function collectCaveatFrictionCounts(reviews) {
  const counts = new Map();

  reviews.forEach((review) => {
    const text = review.text.toLowerCase();
    Object.entries(CAVEAT_FRICTION_KEYWORDS).forEach(([key, keywords]) => {
      if (keywords.some((keyword) => text.includes(String(keyword).toLowerCase()))) {
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    });
  });

  return counts;
}

function inferListingCategory(types) {
  const normalized = (Array.isArray(types) ? types : []).map((type) =>
    String(type || "").toLowerCase()
  );

  if (
    normalized.some((type) =>
      [
        "lodging",
        "hotel",
      ].includes(type)
    )
  ) {
    return "lodging";
  }

  if (
    normalized.some((type) =>
      [
        "restaurant",
        "cafe",
        "bar",
        "meal_takeaway",
        "meal_delivery",
        "bakery",
        "food",
      ].includes(type)
    )
  ) {
    return "food";
  }

  if (
    normalized.some((type) =>
      [
        "hair_care",
        "beauty_salon",
        "spa",
        "nail_salon",
      ].includes(type)
    )
  ) {
    return "beauty";
  }

  if (
    normalized.some((type) =>
      [
        "dentist",
        "doctor",
        "hospital",
        "physiotherapist",
        "health",
      ].includes(type)
    )
  ) {
    return "medical";
  }

  return "general";
}

function productServiceAxisLabel(types, lang = "en") {
  const category = inferListingCategory(types);

  if (category === "food") {
    return isJapanese(lang) ? "味・商品力" : "Taste / Product";
  }

  if (category === "beauty") {
    return isJapanese(lang) ? "技術・仕上がり" : "Technique / Finish";
  }

  if (category === "lodging") {
    return isJapanese(lang) ? "滞在・設備" : "Stay / Facility";
  }

  if (category === "medical") {
    return isJapanese(lang) ? "施術・診療の質" : "Treatment Quality";
  }

  return isJapanese(lang) ? "商品・サービス" : "Product / Service";
}

function buildReviewAxisDefinitions(details, lang = "en") {
  const category = inferListingCategory(details?.types);
  const productPositiveKeys =
    category === "beauty" || category === "medical" || category === "lodging"
      ? ["quality", "professionalism"]
      : ["quality"];
  const atmosphereLabel =
    category === "lodging"
      ? isJapanese(lang) ? "館内・雰囲気" : "Property / Atmosphere"
      : isJapanese(lang) ? "雰囲気" : "Atmosphere";
  const priceLabel =
    category === "lodging"
      ? isJapanese(lang) ? "価格・納得感" : "Value / Price"
      : isJapanese(lang) ? "価格" : "Price";

  return [
    {
      key: "service",
      label: isJapanese(lang) ? "接客" : "Service",
      positiveKeys: ["friendly_staff"],
      negativeKeys: ["slow_service", "rude_service", "confusing_process"],
    },
    {
      key: "atmosphere",
      label: atmosphereLabel,
      positiveKeys: ["atmosphere"],
      negativeKeys: ["noise_crowding"],
    },
    {
      key: "product_service",
      label: productServiceAxisLabel(details?.types, lang),
      positiveKeys: productPositiveKeys,
      negativeKeys: ["poor_quality"],
    },
    {
      key: "price",
      label: priceLabel,
      positiveKeys: ["value"],
      negativeKeys: ["overpriced"],
    },
    {
      key: "cleanliness",
      label: isJapanese(lang) ? "清潔感" : "Cleanliness",
      positiveKeys: ["cleanliness"],
      negativeKeys: ["dirty"],
    },
  ];
}

function axisSignalScore({ positiveCounts, lowerCounts }, axis) {
  const positive = countThemes(positiveCounts, axis?.positiveKeys);
  const negative = countThemes(lowerCounts, axis?.negativeKeys);

  return {
    positive,
    negative,
    total: positive + negative,
    score: positive - negative * 1.25,
  };
}

function axisStatus({ mine, competitor }) {
  if (!mine.total && !competitor.total) return "no_signal";

  const diff = mine.score - competitor.score;
  if (diff >= 1) return "ahead";
  if (diff <= -1) return "behind";
  if (mine.negative > 0 || competitor.negative > 0) return "mixed";
  return "close";
}

function axisSummary({ axis, status, competitorName }, lang = "en") {
  if (status === "ahead") {
    return isJapanese(lang)
      ? `直近レビューでは${axis.label}の前向きシグナルは自店舗のほうが強めです。`
      : `Recent visible reviews suggest your ${axis.label.toLowerCase()} signal is stronger than ${competitorName}.`;
  }

  if (status === "behind") {
    return isJapanese(lang)
      ? `直近レビューでは${competitorName}のほうが${axis.label}で強く見えます。`
      : `Recent visible reviews suggest ${competitorName} looks stronger on ${axis.label.toLowerCase()}.`;
  }

  if (status === "mixed") {
    return isJapanese(lang)
      ? `直近レビューでは${axis.label}は割れていて、優劣を断言しにくい状態です。`
      : `Recent visible reviews on ${axis.label.toLowerCase()} are mixed, so the gap is not cleanly one-sided.`;
  }

  if (status === "close") {
    return isJapanese(lang)
      ? `直近レビューでは${axis.label}に大きな差はまだ見えていません。`
      : `Recent visible reviews do not yet show a clear gap on ${axis.label.toLowerCase()}.`;
  }

  return isJapanese(lang)
    ? `直近レビューだけでは${axis.label}は主要な比較軸としてまだ十分見えていません。`
    : `${axis.label} is not yet a strong comparison axis in the recent visible review sample.`;
}

function formatAxisSignalBreakdown(signal, lang = "en") {
  const positive = Number.isFinite(signal?.positive) ? Number(signal.positive) : 0;
  const negative = Number.isFinite(signal?.negative) ? Number(signal.negative) : 0;

  if (isJapanese(lang)) {
    return `前向き ${positive} 件 / 不満 ${negative} 件`;
  }

  return `${positive} positive / ${negative} friction`;
}

function axisEvidence({ mine, competitor }, lang = "en") {
  if (isJapanese(lang)) {
    return `このサンプル内の言及量: 自店舗 ${formatAxisSignalBreakdown(
      mine,
      lang
    )}、競合 ${formatAxisSignalBreakdown(competitor, lang)}。`;
  }

  return `Signals in this sample: you ${formatAxisSignalBreakdown(
    mine,
    lang
  )}; competitor ${formatAxisSignalBreakdown(competitor, lang)}.`;
}

function buildReviewComparisonSummary({ axes, competitorName }, lang = "en") {
  const wins = axes.filter((axis) => axis.status === "ahead").map((axis) => axis.label);
  const losses = axes.filter((axis) => axis.status === "behind").map((axis) => axis.label);

  if (wins.length && losses.length) {
    return isJapanese(lang)
      ? `${competitorName}と比べると、${humanJoin(wins, lang)}は勝ち筋ですが、${humanJoin(
          losses,
          lang
        )}は負け筋です。`
      : `Against ${competitorName}, ${humanJoin(wins, lang)} look like current strengths, while ${humanJoin(
          losses,
          lang
        )} look weaker.`;
  }

  if (losses.length) {
    return isJapanese(lang)
      ? `${competitorName}と比べると、${humanJoin(losses, lang)}がいまの負け筋です。`
      : `Against ${competitorName}, ${humanJoin(losses, lang)} look like the main weaker spots right now.`;
  }

  if (wins.length) {
    return isJapanese(lang)
      ? `${competitorName}と比べても、${humanJoin(wins, lang)}はすでに勝ち筋として見えています。`
      : `Even against ${competitorName}, ${humanJoin(wins, lang)} already look like strengths.`;
  }

  return isJapanese(lang)
    ? `${competitorName}と比べても、直近レビューだけでは優劣を強く断言できる軸はまだ多くありません。`
    : `Even against ${competitorName}, the recent visible reviews do not yet show many clear win-or-lose axes.`;
}

function buildReviewScaleCaution({ details, sample }, lang = "en") {
  const totalReviewCount = Number.isFinite(details?.user_ratings_total)
    ? Number(details.user_ratings_total)
    : null;
  const sampleReviewCount = Array.isArray(sample) ? sample.length : 0;

  if (Number.isFinite(totalReviewCount) && totalReviewCount < 20) {
    return {
      level: "high",
      totalReviewCount,
      sampleReviewCount,
      message: isJapanese(lang)
        ? `総レビュー数が ${totalReviewCount} 件と少ないため、レビュー傾向は断定ではなく方向性として扱ってください。レポート提出時は、新規レビュー獲得とセットで補強する前提にしてください。`
        : `The total review base is small (${totalReviewCount} total), so treat review themes as directional rather than conclusive. Pair this report with a fresh review acquisition push.`,
      nextProof: isJapanese(lang)
        ? "次回までに新しいレビューを増やし、同じ競合で再チェックしてください。"
        : "Collect fresh reviews before the next check, then compare the same competitor again.",
    };
  }

  if (Number.isFinite(totalReviewCount) && totalReviewCount < 50) {
    return {
      level: "medium",
      totalReviewCount,
      sampleReviewCount,
      message: isJapanese(lang)
        ? `総レビュー数がまだ ${totalReviewCount} 件のため、レビュー軸は初期シグナルとして扱ってください。継続的なレビュー獲得で判断材料を厚くする必要があります。`
        : `The review base is still early (${totalReviewCount} total), so use these review axes as an early signal until more fresh reviews are collected.`,
      nextProof: isJapanese(lang)
        ? "レビュー依頼を継続し、次回レポートで同じ軸が繰り返し出るか確認してください。"
        : "Keep review requests active and confirm whether the same themes repeat in the next report.",
    };
  }

  if (sampleReviewCount > 0 && sampleReviewCount < 4) {
    return {
      level: "sample",
      totalReviewCount,
      sampleReviewCount,
      message: isJapanese(lang)
        ? `直近で見えているレビュー本文が ${sampleReviewCount} 件だけなので、まだトレンドとしては言い切らないでください。`
        : `Only ${sampleReviewCount} recent visible review text sample${
            sampleReviewCount === 1 ? " is" : "s are"
          } available, so avoid calling this a trend yet.`,
      nextProof: isJapanese(lang)
        ? "次回チェックで表示レビュー本文を増やしてから、傾向として扱ってください。"
        : "Use the next check to gather more visible review text before framing this as a trend.",
    };
  }

  return null;
}

function buildReviewComparisonAxes({
  details,
  competitor,
  sample,
  positiveCounts,
  lowerCounts,
  competitorSample,
  competitorPositiveCounts,
  competitorLowerCounts,
  lang = "en",
} = {}) {
  if (!competitor || !competitorSample.length) return null;

  const axes = buildReviewAxisDefinitions(details, lang).map((axis) => {
    const mine = axisSignalScore({ positiveCounts, lowerCounts }, axis);
    const theirs = axisSignalScore(
      {
        positiveCounts: competitorPositiveCounts,
        lowerCounts: competitorLowerCounts,
      },
      axis
    );
    const status = axisStatus({ mine, competitor: theirs });

    return {
      key: axis.key,
      label: axis.label,
      status,
      summary: axisSummary({
        axis,
        status,
        competitorName: competitor?.name || (isJapanese(lang) ? "競合" : "the competitor"),
      }, lang),
      evidence: axisEvidence({ mine, competitor: theirs }, lang),
      mySignalCount: mine.total,
      competitorSignalCount: theirs.total,
    };
  });

  return {
    summary: buildReviewComparisonSummary({
      axes,
      competitorName: competitor?.name || (isJapanese(lang) ? "競合" : "the competitor"),
    }, lang),
    axes,
    note: isJapanese(lang)
      ? `自店舗の直近表示レビュー ${sample.length} 件と、競合の直近表示レビュー ${competitorSample.length} 件をもとにしています。`
      : `Based on ${sample.length} recent visible reviews for this listing and ${competitorSample.length} for the competitor.`,
  };
}

function buildGoogleComparisonSignals({ details, competitor, photoAnalysis }, lang = "en") {
  const signals = [];
  const myPhotos = Number.isFinite(photoAnalysis?.myPhotos) ? Number(photoAnalysis.myPhotos) : 0;
  const competitorPhotos = Number.isFinite(competitor?.photoCount)
    ? Number(competitor.photoCount)
    : Array.isArray(competitor?.photos)
      ? competitor.photos.length
      : 0;
  const myReviewCount = Number.isFinite(details?.user_ratings_total)
    ? Number(details.user_ratings_total)
    : null;
  const competitorReviewCount = Number.isFinite(competitor?.user_ratings_total)
    ? Number(competitor.user_ratings_total)
    : Number.isFinite(competitor?.reviewCount)
      ? Number(competitor.reviewCount)
      : null;

  if (!details?.website && competitor?.website) {
    signals.push(
      isJapanese(lang)
        ? "競合は Web サイト導線があり、来店前の確認がしやすく見えます。"
        : "The competitor has a website link, so it is easier to verify key details before a visit."
    );
  } else if (details?.website && !competitor?.website) {
    signals.push(
      isJapanese(lang)
        ? "こちらは Web サイト導線があるぶん、来店前の確認では先に立てています。"
        : "This listing has a website link, which is a visible proof advantage before the visit."
    );
  }

  if (competitorPhotos > myPhotos + 3) {
    signals.push(
      isJapanese(lang)
        ? `競合は写真が ${competitorPhotos - myPhotos} 枚以上多く、一覧で判断しやすく見えます。`
        : `The competitor shows at least ${competitorPhotos - myPhotos} more photos, which strengthens first-view proof.`
    );
  } else if (myPhotos > competitorPhotos + 3) {
    signals.push(
      isJapanese(lang)
        ? `こちらは写真が ${myPhotos - competitorPhotos} 枚以上多く、一覧での見える根拠は優位です。`
        : `This listing shows at least ${myPhotos - competitorPhotos} more photos, which helps first-view proof.`
    );
  }

  if (
    Number.isFinite(myReviewCount) &&
    Number.isFinite(competitorReviewCount) &&
    competitorReviewCount > myReviewCount + Math.max(20, Math.round(myReviewCount * 0.35))
  ) {
    signals.push(
      isJapanese(lang)
        ? "競合は総レビュー規模でも先行していて、ひと目の信頼感で有利です。"
        : "The competitor also has a larger visible review base, which helps trust at a glance."
    );
  } else if (
    Number.isFinite(myReviewCount) &&
    Number.isFinite(competitorReviewCount) &&
    myReviewCount > competitorReviewCount + Math.max(20, Math.round(competitorReviewCount * 0.35))
  ) {
    signals.push(
      isJapanese(lang)
        ? "こちらは総レビュー規模で先行していて、見える信頼感は維持できています。"
        : "This listing has the larger visible review base, so the trust signal is still solid at a glance."
    );
  }

  return uniqueStrings(signals).slice(0, 3);
}

function buildUnderSignaledStrengths({ topStrengths, websiteMissing, missingPhotos }, lang = "en") {
  if (!topStrengths.length) return [];

  const labels = humanJoin(toPublicThemeLabels(topStrengths, lang), lang);
  const insights = [];

  if (missingPhotos > 0 && hasTheme(topStrengths, ["atmosphere", "quality", "cleanliness"])) {
    insights.push(
      isJapanese(lang)
        ? `レビューでは${labels}が評価されていますが、その強みが一覧の写真だけではまだ十分に伝わっていません。`
        : `Customers seem to value ${labels}, but the listing still under-signals that strength in first-view photos.`
    );
  }

  if (websiteMissing && hasTheme(topStrengths, ["professionalism", "quality"])) {
    insights.push(
      isJapanese(lang)
        ? `レビューでは${labels}が評価されていますが、来店前にその強みを確認できる情報がまだ足りません。`
        : `Customers seem to value ${labels}, but the listing still does not explain that strength clearly enough before the visit.`
    );
  }

  if (!insights.length && (websiteMissing || missingPhotos > 0)) {
    insights.push(
      isJapanese(lang)
        ? `レビューでは${labels}が評価されていますが、その強みが一覧上ではまだ十分に見えていません。`
        : `Customers seem to value ${labels}, but the listing may not be surfacing that strength clearly enough yet.`
    );
  }

  return uniqueStrings(insights).slice(0, 2);
}

function buildUnderestimatedFrictions({ topFrictions, topStrengths }, lang = "en") {
  const insights = [];

  if (topFrictions.some((item) => item.key === "confusing_process")) {
    insights.push(
      isJapanese(lang)
        ? "最近の低評価レビューを見ると、いまはレビュー数よりも分かりやすさの問題のほうが大きい可能性があります。"
        : "Recent lower reviews suggest clarity may be a bigger choice friction than review volume right now."
    );
  }

  if (topFrictions.some((item) => item.key === "slow_service")) {
    insights.push(
      isJapanese(lang)
        ? "最近の低評価レビューを見ると、いまは見える根拠を増やすより待ち時間やスピードの問題を減らすほうが効きそうです。"
        : "Recent lower reviews suggest speed or wait-time friction may matter more than adding more visible proof right now."
    );
  }

  if (topFrictions.some((item) => item.key === "rude_service")) {
    insights.push(
      isJapanese(lang)
        ? "最近の低評価レビューを見ると、いまはサービス対応のばらつきが選ばれにくさにつながっている可能性があります。"
        : "Recent lower reviews suggest service consistency may be the bigger choice issue right now."
    );
  }

  if (topFrictions.some((item) => item.key === "overpriced") && topStrengths.length) {
    insights.push(
      isJapanese(lang)
        ? "最近の低評価レビューを見ると、体験自体は評価されていても価格に対する納得感が選ばれやすさを弱めている可能性があります。"
        : "Recent lower reviews suggest value perception may be weakening customer choice even when the core experience is appreciated."
    );
  }

  return uniqueStrings(insights).slice(0, 2);
}

function buildVerificationGaps({ topStrengths, websiteMissing, missingPhotos }, lang = "en") {
  const insights = [];

  if (websiteMissing && topStrengths.length) {
    insights.push(
      isJapanese(lang)
        ? "レビューでは信頼感が見えていますが、Webサイトがないため、その根拠を来店前に確認しづらい状態です。"
        : "Reviews suggest the business is credible, but the missing website still makes that proof slower to verify."
    );
  }

  if (missingPhotos > 0 && hasTheme(topStrengths, ["atmosphere", "quality", "cleanliness"])) {
    insights.push(
      isJapanese(lang)
        ? "レビューで評価されている強みが、店舗情報上ではまだ視覚的に確認しづらい状態です。"
        : "Reviews point to strengths that are not yet easy to verify visually in the listing."
    );
  }

  return uniqueStrings(insights).slice(0, 2);
}

function buildCompetitorChoiceEdges({ competitor, details, photoAnalysis }, lang = "en") {
  if (!competitor) return [];

  const myPhotos = Number.isFinite(photoAnalysis?.myPhotos) ? Number(photoAnalysis.myPhotos) : 0;
  const competitorPhotos = Number.isFinite(competitor?.photoCount)
    ? Number(competitor.photoCount)
    : Array.isArray(competitor?.photos)
      ? competitor.photos.length
      : 0;
  const myReviewCount = Number.isFinite(details?.user_ratings_total)
    ? Number(details.user_ratings_total)
    : null;
  const competitorReviewCount = Number.isFinite(competitor?.user_ratings_total)
    ? Number(competitor.user_ratings_total)
    : Number.isFinite(competitor?.reviewCount)
      ? Number(competitor.reviewCount)
      : null;
  const edges = [];

  if (!details?.website && competitor?.website) {
    edges.push(
      isJapanese(lang)
        ? "選択中の競合は、Webサイトへの導線があるぶん、事前に内容を確認しやすく見えます。"
        : "The selected competitor appears easier to verify quickly because it links out to more business detail."
    );
  }

  if (competitorPhotos > myPhotos + 3) {
    edges.push(
      isJapanese(lang)
        ? "選択中の競合は、写真が多いぶん、初見で判断しやすく見えます。"
        : "The selected competitor appears easier to size up quickly because the visual proof is stronger."
    );
  }

  if (
    Number.isFinite(myReviewCount) &&
    Number.isFinite(competitorReviewCount) &&
    competitorReviewCount > myReviewCount + Math.max(20, Math.round(myReviewCount * 0.35))
  ) {
    edges.push(
      isJapanese(lang)
        ? "選択中の競合は、レビュー規模が大きいぶん、ひと目で信頼されやすく見える可能性があります。"
        : "The selected competitor may feel easier to trust at a glance because the review scale looks more established."
    );
  }

  return uniqueStrings(edges).slice(0, 2);
}

function buildBlindSpots({
  underSignaledStrengths,
  underestimatedFrictions,
  verificationGaps,
  competitorChoiceEdges,
}) {
  const candidates = [
    underSignaledStrengths[0],
    underestimatedFrictions[0],
    verificationGaps[0],
    competitorChoiceEdges[0],
  ];

  return uniqueStrings(candidates).slice(0, 2);
}

function buildChoicePriorityReason({
  underSignaledStrengths,
  underestimatedFrictions,
  verificationGaps,
  competitorChoiceEdges,
}, lang = "en") {
  if (underestimatedFrictions.length) {
    return isJapanese(lang)
      ? "集客を強める前に、顧客の意思決定を止めている問題を先に減らしてください。"
      : "Remove the friction most likely to interrupt customer choice before pushing harder on acquisition.";
  }

  if (verificationGaps.length) {
    return isJapanese(lang)
      ? "さらに信頼を求める前に、いまある根拠をもっと確認しやすくしてください。"
      : "Make the existing proof easier to verify before asking customers to trust more.";
  }

  if (competitorChoiceEdges.length) {
    return isJapanese(lang)
      ? "レビューの勢いを見直す前に、見た目で分かる競合差を先に埋めてください。"
      : "Close the easiest visible gap before comparing review momentum again.";
  }

  if (underSignaledStrengths.length) {
    return isJapanese(lang)
      ? "一般的な訴求を足す前に、すでに評価されている強みをもっと前に出してください。"
      : "Surface the strengths customers already value before adding more generic messaging.";
  }

  return isJapanese(lang)
    ? "強みが伝わる見える根拠を保ちつつ、繰り返し出る問題がないか見ていきましょう。"
    : "Keep the strongest proof visible and re-check whether one decision friction starts repeating.";
}

function buildPriorityAction({ topFrictions, topStrengths, websiteMissing, missingPhotos }, lang = "en") {
  if (topFrictions.some((item) => item.key === "confusing_process")) {
    return isJapanese(lang)
      ? "予約・注文・最初の一歩がもっと分かりやすく見えるようにしてください。"
      : "Make booking, ordering, or first-step information easier to find before someone visits.";
  }

  if (topFrictions.some((item) => item.key === "slow_service")) {
    return isJapanese(lang)
      ? "レビュー数を増やす前に、待ち時間やスピードの問題を見えにくくしてください。"
      : "Reduce visible wait-time friction before trying to improve review volume.";
  }

  if (topFrictions.some((item) => item.key === "rude_service")) {
    return isJapanese(lang)
      ? "集客や比較施策を強める前に、接客品質のばらつきを整えてください。"
      : "Tighten service consistency before pushing harder on acquisition or comparison.";
  }

  if (websiteMissing) {
    return isJapanese(lang)
      ? "お客様が基本情報を確認しやすいように、公式サイトや事業ページを追加してください。"
      : "Add an official website or business page so customers can verify key details more easily.";
  }

  if (missingPhotos > 0 && topStrengths.length) {
    const leadStrength = themeLabel(topStrengths[0], lang);
    return isJapanese(lang)
      ? `${leadStrength}がひと目で伝わる写真や第一印象の要素を増やしてください。`
      : `Make ${leadStrength} easier to notice in photos and other first-view signals.`;
  }

  if (missingPhotos > 0) {
    return isJapanese(lang)
      ? "強みがひと目で伝わるように、写真の見せ方を改善してください。"
      : "Improve photo coverage so the strongest parts of the experience are easier to notice.";
  }

  if (topStrengths.length) {
    const leadStrength = themeLabel(topStrengths[0], lang);
    return isJapanese(lang)
      ? `${leadStrength}が来店前から分かるように、見せ方を強めてください。`
      : `Make ${leadStrength} more obvious before the visit so the listing feels easier to choose.`;
  }

  return isJapanese(lang)
    ? "強みが伝わる見える根拠を保ちつつ、繰り返し出る問題がないか確認してください。"
    : "Keep visible proof clear and re-check whether one friction theme starts repeating.";
}

function buildSummary({
  topStrengths,
  topFrictions,
  underSignaledStrengths,
  underestimatedFrictions,
  verificationGaps,
  competitorChoiceEdges,
  websiteMissing,
  missingPhotos,
}, lang = "en") {
  if (competitorChoiceEdges.length && (underSignaledStrengths.length || underestimatedFrictions.length)) {
    return isJapanese(lang)
      ? "最近見えているレビューでは強みは伝わっていますが、選択中の競合のほうが短時間で選びやすく見える可能性があります。"
      : "Recent visible reviews suggest this business has real strengths, but the selected competitor may still feel easier to choose quickly.";
  }

  if (verificationGaps.length) {
    return isJapanese(lang)
      ? "最近見えているレビューでは信頼感はありますが、その根拠を店舗情報上ですぐ確認しづらい状態です。"
      : "Recent visible reviews suggest trust is present, but the listing still makes that proof too slow to verify.";
  }

  if (underestimatedFrictions.length && underSignaledStrengths.length) {
    return isJapanese(lang)
      ? "最近見えているレビューでは強みは届いていますが、なぜ選びやすいのかが店舗情報上ではまだ伝わりきっていません。"
      : "Recent visible reviews suggest real strengths are landing, but the listing may still under-signal why this business is easy to choose.";
  }

  if (underestimatedFrictions.length) {
    return isJapanese(lang)
      ? "最近見えているレビューでは、問題は基本情報だけでなく体験上のつまずきにある可能性があります。"
      : "Recent visible reviews suggest the bigger choice issue may be customer experience friction, not only profile basics.";
  }

  if (underSignaledStrengths.length) {
    return isJapanese(lang)
      ? "最近見えているレビューでは強みが評価されていますが、その強みが店舗情報上でまだ十分に見えていません。"
      : "Recent visible reviews suggest customers notice strengths that the listing is not surfacing clearly enough yet.";
  }

  if (topFrictions.length) {
    if (topStrengths.length) {
      return isJapanese(lang)
        ? "最近見えているレビューでは強みも感じられていますが、意思決定を止める問題もまだ残っています。"
        : "Recent visible reviews suggest customers notice real strengths, but some decision friction is still showing up.";
    }

    return isJapanese(lang)
      ? "最近見えているレビューでは、ためらいの主因は基本情報の不足だけでなく体験上のつまずきにありそうです。"
      : "Recent visible reviews suggest hesitation may be coming from customer experience friction, not just missing profile basics.";
  }

  if (topStrengths.length && (websiteMissing || missingPhotos > 0)) {
    return isJapanese(lang)
      ? "最近見えているレビューでは強みは伝わっていますが、来店前にはその強みがまだ十分に見えていません。"
      : "Recent visible reviews suggest customers already see strengths, but those strengths may not be obvious enough before the visit.";
  }

  if (topStrengths.length) {
    return isJapanese(lang)
      ? "最近見えているレビューでは、この体験の強みがすでにしっかり伝わっています。"
      : "Recent visible reviews suggest customers already notice clear strengths in this experience.";
  }

  return isJapanese(lang)
    ? "最近見えているレビューだけでは、顧客視点の主要テーマはまだはっきりしていません。"
    : "Recent visible reviews do not yet show one dominant customer-choice theme.";
}

function toPublicThemeLabels(groups, lang = "en") {
  return groups.map((group) => themeLabel(group, lang)).slice(0, 2);
}

export function buildReviewClues({ reviews, details, photoAnalysis, competitor, lang = "en" } = {}) {
  const sample = normalizeReviews(reviews);
  if (!sample.length) return null;

  const positiveReviews = sample.filter((review) => Number(review.rating) >= 4);
  const lowerReviews = sample.filter(
    (review) => Number.isFinite(review.rating) && Number(review.rating) <= 3
  );
  const allCounts = collectThemeCounts(sample);
  const positiveCounts = collectThemeCounts(positiveReviews);
  const lowerCounts = mergeThemeCounts(
    collectThemeCounts(lowerReviews),
    collectCaveatFrictionCounts(sample)
  );
  const competitorSample = normalizeReviews(competitor?.reviews);
  const competitorPositiveReviews = competitorSample.filter((review) => Number(review.rating) >= 4);
  const competitorLowerReviews = competitorSample.filter(
    (review) => Number.isFinite(review.rating) && Number(review.rating) <= 3
  );
  const competitorPositiveCounts = collectThemeCounts(competitorPositiveReviews);
  const competitorLowerCounts = mergeThemeCounts(
    collectThemeCounts(competitorLowerReviews),
    collectCaveatFrictionCounts(competitorSample)
  );
  const topStrengths = rankedThemes(
    "strength",
    positiveReviews.length ? positiveCounts : allCounts,
    lang
  ).slice(0, 2);
  const topFrictions = rankedThemes(
    "friction",
    lowerCounts.size ? lowerCounts : allCounts,
    lang
  ).slice(0, 2);
  const websiteMissing = !details?.website;
  const missingPhotos = Number.isFinite(photoAnalysis?.missingPhotos)
    ? Number(photoAnalysis.missingPhotos)
    : 0;
  const underSignaledStrengths = buildUnderSignaledStrengths({
    topStrengths,
    websiteMissing,
    missingPhotos,
  }, lang);
  const underestimatedFrictions = buildUnderestimatedFrictions({
    topFrictions,
    topStrengths,
  }, lang);
  const verificationGaps = buildVerificationGaps({
    topStrengths,
    websiteMissing,
    missingPhotos,
  }, lang);
  const competitorChoiceEdges = buildCompetitorChoiceEdges({
    competitor,
    details,
    photoAnalysis,
  }, lang);
  const blindSpots = buildBlindSpots({
    underSignaledStrengths,
    underestimatedFrictions,
    verificationGaps,
    competitorChoiceEdges,
  });
  const choicePriorityReason = buildChoicePriorityReason({
    underSignaledStrengths,
    underestimatedFrictions,
    verificationGaps,
    competitorChoiceEdges,
  }, lang);
  const comparison = buildReviewComparisonAxes({
    details,
    competitor,
    sample,
    positiveCounts,
    lowerCounts,
    competitorSample,
    competitorPositiveCounts,
    competitorLowerCounts,
    lang,
  });
  const googleSignals = buildGoogleComparisonSignals({
    details,
    competitor,
    photoAnalysis,
  }, lang);
  const reviewScaleCaution = buildReviewScaleCaution({ details, sample }, lang);
  const comparisonNote = [comparison?.note, reviewScaleCaution?.message]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(" ");

  return {
    sampleBasis: "recent_visible_reviews",
    reviewCountInSample: sample.length,
    totalReviewCount: Number.isFinite(details?.user_ratings_total)
      ? Number(details.user_ratings_total)
      : null,
    reviewScaleCaution,
    competitorContextPlaceId: competitor?.place_id ?? competitor?.placeId ?? null,
    competitorContextName: competitor?.name ?? null,
    summary: buildSummary({
      topStrengths,
      topFrictions,
      underSignaledStrengths,
      underestimatedFrictions,
      verificationGaps,
      competitorChoiceEdges,
      websiteMissing,
      missingPhotos,
    }, lang),
    strengths: toPublicThemeLabels(topStrengths, lang),
    frictions: toPublicThemeLabels(topFrictions, lang),
    blindSpots,
    underSignaledStrengths,
    underestimatedFrictions,
    verificationGaps,
    competitorChoiceEdges,
    priorityAction: buildPriorityAction({
      topFrictions,
      topStrengths,
      websiteMissing,
      missingPhotos,
    }, lang),
    choicePriorityReason,
    comparisonSummary: comparison?.summary ?? null,
    comparisonAxes: Array.isArray(comparison?.axes) ? comparison.axes : [],
    comparisonNote: comparisonNote || null,
    googleSignals,
    confidence: reviewScaleCaution ? "low" : sample.length >= 4 ? "medium" : "low",
  };
}
