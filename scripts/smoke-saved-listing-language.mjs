import assert from "node:assert/strict";
import { publicSavedListing } from "../functions/_lib/savedListings.js";

const japanesePattern = /[ぁ-んァ-ヶ一-龯]/;

const record = {
  id: "saved-language-smoke",
  placeId: "my-place",
  competitorPlaceId: "competitor-place",
  name: "Sample Cafe",
  address: "Tokyo",
  analysisMissing: ["website"],
  latestMetrics: {
    rating: 3.9,
    reviewCount: 50,
    photoCount: 12,
    capturedAt: "2026-05-16T00:00:00.000Z",
  },
  previousMetrics: {
    rating: 3.9,
    reviewCount: 50,
    photoCount: 12,
    capturedAt: "2026-05-10T00:00:00.000Z",
  },
  lastCheckedAt: "2026-05-16T00:00:00.000Z",
  reviewThemeHistory: {
    own: [
      {
        placeId: "my-place",
        comparedAgainstPlaceId: "competitor-place",
        capturedAt: "2026-05-16T00:00:00.000Z",
        sampleReviewCount: 3,
        frictions: {
          en: ["value concerns"],
          ja: ["価格への不満"],
        },
        verificationGaps: {
          en: ["Reviews show trust proof, but the reason to choose this business is not clear enough."],
          ja: ["レビューでは信頼感が見えていますが、選ばれる理由がまだ十分に見えていません。"],
        },
        priorityAction: {
          en: "Before discounting, add the value, outcome, and reason to choose you where customers can see it.",
          ja: "値下げより先に、価格に含まれる内容・得られる結果・納得できる理由を見える場所に追加してください。",
        },
      },
      {
        placeId: "my-place",
        comparedAgainstPlaceId: "competitor-place",
        capturedAt: "2026-05-10T00:00:00.000Z",
        sampleReviewCount: 2,
        frictions: ["商品・サービスへの不満"],
      },
    ],
    competitor: [],
  },
};

const listing = publicSavedListing(record, {
  origin: "https://example.com",
  lang: "en",
});

assert.equal(listing.statusSummary.label, "Needs attention");
assert.equal(listing.statusSummary.reason, "Website missing");
assert.equal(
  listing.ratingMilestoneProgress.supportingCopy,
  "Unchanged since last check"
);
assert.equal(
  listing.ratingMilestoneProgress.note,
  "Estimate based on current displayed rating and total reviews"
);
assert.equal(
  listing.reviewThemeMonitoring.beforeAfter.previous,
  "Friction: quality issues"
);
assert.equal(
  listing.reviewThemeMonitoring.beforeAfter.latest,
  "Newly visible friction: value concerns"
);
assert.doesNotMatch(
  JSON.stringify({
    statusSummary: listing.statusSummary,
    changeSummary: listing.changeSummary,
    ratingMilestoneProgress: listing.ratingMilestoneProgress,
    reviewThemeMonitoring: listing.reviewThemeMonitoring,
  }),
  japanesePattern
);

console.log("saved-listing language smoke passed");
