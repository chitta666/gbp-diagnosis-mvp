import assert from "node:assert/strict";
import { buildReviewClues } from "../functions/_lib/reviewClues.js";

const baseDetails = {
  website: "https://example.com",
  user_ratings_total: 80,
};

const basePhotoAnalysis = {
  myPhotos: 8,
  missingPhotos: 0,
};

function build(reviews, overrides = {}) {
  return buildReviewClues({
    reviews,
    details: overrides.details || baseDetails,
    photoAnalysis: overrides.photoAnalysis || basePhotoAnalysis,
    competitor: overrides.competitor,
    lang: "ja",
  });
}

function assertCleanlinessAction() {
  const clues = build([
    { rating: 2, text: "店内が汚いし、トイレも清潔ではありませんでした。" },
    { rating: 5, text: "仕上がりは良く、スタッフも親切でした。" },
    { rating: 4, text: "サービスは良かったです。" },
  ]);

  assert.deepEqual(clues.frictions.slice(0, 1), ["清潔感への不満"]);
  assert.match(clues.priorityAction, /清潔感/);
}

function assertPriceAction() {
  const clues = build([
    { rating: 2, text: "価格が高すぎて、内容に対してコスパが悪いです。" },
    { rating: 5, text: "スタッフは親切でサービスは良かったです。" },
    { rating: 4, text: "プロらしい対応でした。" },
  ]);

  assert.deepEqual(clues.frictions.slice(0, 1), ["価格への不満"]);
  assert.match(clues.priorityAction, /価格/);
}

function assertWeakCompetitorContextSuppressed() {
  const clues = build(
    [
      { rating: 5, text: "スタッフが親切でプロらしい対応でした。" },
      { rating: 2, text: "価格が高く、対応も悪かったです。" },
    ],
    {
      details: {
        ...baseDetails,
        user_ratings_total: 38,
      },
      competitor: {
        name: "Unrelated bar",
        user_ratings_total: 200,
        photoCount: 20,
        type_match_score: 0,
        competitive_fit_score: 2.7,
        comparable_types: ["bar", "restaurant"],
      },
    }
  );

  assert.deepEqual(clues.competitorChoiceEdges, []);
}

function assertUsableCompetitorContextStillWorks() {
  const clues = build(
    [
      { rating: 5, text: "スタッフが親切でプロらしい対応でした。" },
      { rating: 4, text: "サービスが良かったです。" },
    ],
    {
      details: {
        ...baseDetails,
        user_ratings_total: 20,
      },
      competitor: {
        name: "Comparable salon",
        user_ratings_total: 120,
        photoCount: 20,
        type_match_score: 4,
        competitive_fit_score: 8,
        comparable_types: ["hair_care", "beauty_salon"],
      },
    }
  );

  assert.ok(clues.competitorChoiceEdges.length > 0);
}

assertCleanlinessAction();
assertPriceAction();
assertWeakCompetitorContextSuppressed();
assertUsableCompetitorContextStillWorks();

console.log("review-clues action alignment smoke passed");
