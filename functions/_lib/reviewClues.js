const THEME_GROUPS = [
  {
    key: "friendly_staff",
    label: "friendly staff",
    kind: "strength",
    keywords: ["friendly", "kind", "warm", "welcoming", "helpful"],
  },
  {
    key: "atmosphere",
    label: "the atmosphere",
    kind: "strength",
    keywords: ["atmosphere", "ambience", "cozy", "calm", "vibe", "beautiful interior"],
  },
  {
    key: "quality",
    label: "product quality",
    kind: "strength",
    keywords: ["delicious", "tasty", "great food", "quality", "excellent", "amazing"],
  },
  {
    key: "professionalism",
    label: "professional service",
    kind: "strength",
    keywords: ["professional", "knowledgeable", "skilled", "expert", "attentive"],
  },
  {
    key: "cleanliness",
    label: "a clean environment",
    kind: "strength",
    keywords: ["clean", "spotless", "neat", "organized", "tidy"],
  },
  {
    key: "slow_service",
    label: "slow service",
    kind: "friction",
    keywords: ["slow", "waited", "waiting", "long wait", "took forever", "late"],
  },
  {
    key: "confusing_process",
    label: "an unclear process",
    kind: "friction",
    keywords: ["confusing", "unclear", "hard to find", "hard to book", "hard to order", "complicated"],
  },
  {
    key: "rude_service",
    label: "unfriendly service",
    kind: "friction",
    keywords: ["rude", "unhelpful", "dismissive", "bad attitude", "unprofessional"],
  },
  {
    key: "noise_crowding",
    label: "noise or crowding",
    kind: "friction",
    keywords: ["noisy", "loud", "crowded", "busy", "packed"],
  },
  {
    key: "overpriced",
    label: "value concerns",
    kind: "friction",
    keywords: ["expensive", "overpriced", "pricey", "too much", "not worth"],
  },
];

function uniqueStrings(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function humanJoin(values) {
  const items = uniqueStrings(values);
  if (!items.length) return "";
  if (items.length === 1) return items[0];
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
      if (group.keywords.some((keyword) => text.includes(keyword))) {
        counts.set(group.key, (counts.get(group.key) || 0) + 1);
      }
    });
  });

  return counts;
}

function rankedThemes(kind, counts) {
  return THEME_GROUPS.filter((group) => group.kind === kind)
    .map((group) => ({
      ...group,
      count: counts.get(group.key) || 0,
    }))
    .filter((group) => group.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function hasTheme(groups, keys) {
  return groups.some((item) => keys.includes(item.key));
}

function buildUnderSignaledStrengths({ topStrengths, websiteMissing, missingPhotos }) {
  if (!topStrengths.length) return [];

  const labels = humanJoin(toPublicThemeLabels(topStrengths));
  const insights = [];

  if (missingPhotos > 0 && hasTheme(topStrengths, ["atmosphere", "quality", "cleanliness"])) {
    insights.push(
      `Customers seem to value ${labels}, but the listing still under-signals that strength in first-view photos.`
    );
  }

  if (websiteMissing && hasTheme(topStrengths, ["professionalism", "quality"])) {
    insights.push(
      `Customers seem to value ${labels}, but the listing still does not explain that strength clearly enough before the visit.`
    );
  }

  if (!insights.length && (websiteMissing || missingPhotos > 0)) {
    insights.push(
      `Customers seem to value ${labels}, but the listing may not be surfacing that strength clearly enough yet.`
    );
  }

  return uniqueStrings(insights).slice(0, 2);
}

function buildUnderestimatedFrictions({ topFrictions, topStrengths }) {
  const insights = [];

  if (topFrictions.some((item) => item.key === "confusing_process")) {
    insights.push(
      "Recent lower reviews suggest clarity may be a bigger choice friction than review volume right now."
    );
  }

  if (topFrictions.some((item) => item.key === "slow_service")) {
    insights.push(
      "Recent lower reviews suggest speed or wait-time friction may matter more than adding more visible proof right now."
    );
  }

  if (topFrictions.some((item) => item.key === "rude_service")) {
    insights.push(
      "Recent lower reviews suggest service consistency may be the bigger choice issue right now."
    );
  }

  if (topFrictions.some((item) => item.key === "overpriced") && topStrengths.length) {
    insights.push(
      "Recent lower reviews suggest value perception may be weakening customer choice even when the core experience is appreciated."
    );
  }

  return uniqueStrings(insights).slice(0, 2);
}

function buildVerificationGaps({
  topStrengths,
  websiteMissing,
  missingPhotos,
}) {
  const insights = [];

  if (websiteMissing && topStrengths.length) {
    insights.push(
      "Reviews suggest the business is credible, but the missing website still makes that proof slower to verify."
    );
  }

  if (missingPhotos > 0 && hasTheme(topStrengths, ["atmosphere", "quality", "cleanliness"])) {
    insights.push(
      "Reviews point to strengths that are not yet easy to verify visually in the listing."
    );
  }

  return uniqueStrings(insights).slice(0, 2);
}

function buildCompetitorChoiceEdges({ competitor, details, photoAnalysis }) {
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
      "The selected competitor appears easier to verify quickly because it links out to more business detail."
    );
  }

  if (competitorPhotos > myPhotos + 3) {
    edges.push(
      "The selected competitor appears easier to size up quickly because the visual proof is stronger."
    );
  }

  if (
    Number.isFinite(myReviewCount) &&
    Number.isFinite(competitorReviewCount) &&
    competitorReviewCount > myReviewCount + Math.max(20, Math.round(myReviewCount * 0.35))
  ) {
    edges.push(
      "The selected competitor may feel easier to trust at a glance because the review scale looks more established."
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
}) {
  if (underestimatedFrictions.length) {
    return "Remove the friction most likely to interrupt customer choice before pushing harder on acquisition.";
  }

  if (verificationGaps.length) {
    return "Make the existing proof easier to verify before asking customers to trust more.";
  }

  if (competitorChoiceEdges.length) {
    return "Close the easiest visible gap before comparing review momentum again.";
  }

  if (underSignaledStrengths.length) {
    return "Surface the strengths customers already value before adding more generic messaging.";
  }

  return "Keep the strongest proof visible and re-check whether one decision friction starts repeating.";
}

function buildPriorityAction({ topFrictions, topStrengths, websiteMissing, missingPhotos }) {
  if (topFrictions.some((item) => item.key === "confusing_process")) {
    return "Make booking, ordering, or first-step information easier to find before someone visits.";
  }

  if (topFrictions.some((item) => item.key === "slow_service")) {
    return "Reduce visible wait-time friction before trying to improve review volume.";
  }

  if (topFrictions.some((item) => item.key === "rude_service")) {
    return "Tighten service consistency before pushing harder on acquisition or comparison.";
  }

  if (websiteMissing) {
    return "Add an official website or business page so customers can verify key details more easily.";
  }

  if (missingPhotos > 0 && topStrengths.length) {
    return `Make ${topStrengths[0].label} easier to notice in photos and other first-view signals.`;
  }

  if (missingPhotos > 0) {
    return "Improve photo coverage so the strongest parts of the experience are easier to notice.";
  }

  if (topStrengths.length) {
    return `Make ${topStrengths[0].label} more obvious before the visit so the listing feels easier to choose.`;
  }

  return "Keep visible proof clear and re-check whether one friction theme starts repeating.";
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
}) {
  if (competitorChoiceEdges.length && (underSignaledStrengths.length || underestimatedFrictions.length)) {
    return "Recent visible reviews suggest this business has real strengths, but the selected competitor may still feel easier to choose quickly.";
  }

  if (verificationGaps.length) {
    return "Recent visible reviews suggest trust is present, but the listing still makes that proof too slow to verify.";
  }

  if (underestimatedFrictions.length && underSignaledStrengths.length) {
    return "Recent visible reviews suggest real strengths are landing, but the listing may still under-signal why this business is easy to choose.";
  }

  if (underestimatedFrictions.length) {
    return "Recent visible reviews suggest the bigger choice issue may be customer experience friction, not only profile basics.";
  }

  if (underSignaledStrengths.length) {
    return "Recent visible reviews suggest customers notice strengths that the listing is not surfacing clearly enough yet.";
  }

  if (topFrictions.length) {
    if (topStrengths.length) {
      return "Recent visible reviews suggest customers notice real strengths, but some decision friction is still showing up.";
    }

    return "Recent visible reviews suggest hesitation may be coming from customer experience friction, not just missing profile basics.";
  }

  if (topStrengths.length && (websiteMissing || missingPhotos > 0)) {
    return "Recent visible reviews suggest customers already see strengths, but those strengths may not be obvious enough before the visit.";
  }

  if (topStrengths.length) {
    return "Recent visible reviews suggest customers already notice clear strengths in this experience.";
  }

  return "Recent visible reviews do not yet show one dominant customer-choice theme.";
}

function toPublicThemeLabels(groups) {
  return groups.map((group) => group.label).slice(0, 2);
}

export function buildReviewClues({ reviews, details, photoAnalysis, competitor } = {}) {
  const sample = normalizeReviews(reviews);
  if (!sample.length) return null;

  const positiveReviews = sample.filter((review) => Number(review.rating) >= 4);
  const lowerReviews = sample.filter(
    (review) => Number.isFinite(review.rating) && Number(review.rating) <= 3
  );
  const allCounts = collectThemeCounts(sample);
  const positiveCounts = collectThemeCounts(positiveReviews);
  const lowerCounts = collectThemeCounts(lowerReviews);
  const topStrengths = rankedThemes(
    "strength",
    positiveReviews.length ? positiveCounts : allCounts
  ).slice(0, 2);
  const topFrictions = rankedThemes(
    "friction",
    lowerReviews.length ? lowerCounts : allCounts
  ).slice(0, 2);
  const websiteMissing = !details?.website;
  const missingPhotos = Number.isFinite(photoAnalysis?.missingPhotos)
    ? Number(photoAnalysis.missingPhotos)
    : 0;
  const underSignaledStrengths = buildUnderSignaledStrengths({
    topStrengths,
    websiteMissing,
    missingPhotos,
  });
  const underestimatedFrictions = buildUnderestimatedFrictions({
    topFrictions,
    topStrengths,
  });
  const verificationGaps = buildVerificationGaps({
    topStrengths,
    websiteMissing,
    missingPhotos,
  });
  const competitorChoiceEdges = buildCompetitorChoiceEdges({
    competitor,
    details,
    photoAnalysis,
  });
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
  });

  return {
    sampleBasis: "recent_visible_reviews",
    reviewCountInSample: sample.length,
    summary: buildSummary({
      topStrengths,
      topFrictions,
      underSignaledStrengths,
      underestimatedFrictions,
      verificationGaps,
      competitorChoiceEdges,
      websiteMissing,
      missingPhotos,
    }),
    strengths: toPublicThemeLabels(topStrengths),
    frictions: toPublicThemeLabels(topFrictions),
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
    }),
    choicePriorityReason,
    confidence: sample.length >= 4 ? "medium" : "low",
  };
}
