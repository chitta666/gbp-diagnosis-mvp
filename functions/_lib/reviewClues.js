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

function buildBlindSpots({ topStrengths, topFrictions, websiteMissing, missingPhotos }) {
  const blindSpots = [];

  if (
    missingPhotos > 0 &&
    topStrengths.some((item) => item.key === "atmosphere" || item.key === "quality")
  ) {
    blindSpots.push(
      "Customers mention strengths that may still be under-signaled in first-view photos."
    );
  }

  if (
    websiteMissing &&
    topFrictions.some((item) => item.key === "confusing_process" || item.key === "overpriced")
  ) {
    blindSpots.push(
      "A clearer website, booking page, or menu/services page could reduce hesitation before someone visits."
    );
  }

  if (
    websiteMissing &&
    topStrengths.some((item) => item.key === "professionalism" || item.key === "quality")
  ) {
    blindSpots.push(
      "Reviews suggest the service is credible, but the missing website still makes that proof harder to verify quickly."
    );
  }

  return uniqueStrings(blindSpots).slice(0, 2);
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

function buildSummary({ topStrengths, topFrictions, websiteMissing, missingPhotos }) {
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

export function buildReviewClues({ reviews, details, photoAnalysis } = {}) {
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
  const blindSpots = buildBlindSpots({
    topStrengths,
    topFrictions,
    websiteMissing,
    missingPhotos,
  });

  return {
    sampleBasis: "recent_visible_reviews",
    reviewCountInSample: sample.length,
    summary: buildSummary({
      topStrengths,
      topFrictions,
      websiteMissing,
      missingPhotos,
    }),
    strengths: toPublicThemeLabels(topStrengths),
    frictions: toPublicThemeLabels(topFrictions),
    blindSpots,
    priorityAction: buildPriorityAction({
      topFrictions,
      topStrengths,
      websiteMissing,
      missingPhotos,
    }),
    confidence: sample.length >= 4 ? "medium" : "low",
  };
}
