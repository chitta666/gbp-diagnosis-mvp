function resolveLang(value) {
  return String(value || "").trim().toLowerCase() === "ja" ? "ja" : "en";
}

function t(lang, en, ja) {
  return lang === "ja" ? ja : en;
}

const CATEGORY_LABELS = {
  en: {
    not_a_real_customer: "possible non-customer experience",
    conflict_of_interest: "possible conflict of interest",
    harassment_or_abuse: "possible harassment or abuse",
    factually_impossible_claim: "factually inconsistent claim",
    off_topic_or_irrelevant: "off-topic or irrelevant content",
    other: "other review concern",
  },
  ja: {
    not_a_real_customer: "実際の顧客ではない可能性",
    conflict_of_interest: "利害関係がある可能性",
    harassment_or_abuse: "嫌がらせ・攻撃的表現の可能性",
    factually_impossible_claim: "事実と整合しない主張",
    off_topic_or_irrelevant: "サービス体験と無関係な内容",
    other: "その他の懸念",
  },
};

const EVIDENCE_LABELS = {
  en: {
    crm_no_customer_record: "no matching customer record is documented",
    no_transaction_record: "no matching transaction record is documented",
    service_not_launched_yet: "the service timeline may not match the review date",
    timeline_documented: "a relevant timeline has been documented",
    supporting_screenshots_ready: "supporting screenshots are available",
    only_relevant_evidence_selected: "only directly relevant evidence is being included",
    other: "other supporting evidence is available",
  },
  ja: {
    crm_no_customer_record: "一致する顧客記録が確認できていない",
    no_transaction_record: "一致する取引記録が確認できていない",
    service_not_launched_yet: "サービス開始時期とレビュー日時が整合しない可能性がある",
    timeline_documented: "関連する時系列を整理済み",
    supporting_screenshots_ready: "補足スクリーンショットを用意済み",
    only_relevant_evidence_selected: "直接関係する証拠だけに絞れている",
    other: "その他の補足証拠がある",
  },
};

const ACTION_LABELS = {
  en: {
    flagged_in_gbp: "flagged in GBP",
    submitted_removal_request: "submitted a removal request",
    submitted_appeal: "submitted an appeal",
    posted_help_community: "posted in the Help Community",
    drafting_public_reply: "prepared a public reply",
  },
  ja: {
    flagged_in_gbp: "GBP 上で報告済み",
    submitted_removal_request: "削除申請を送信済み",
    submitted_appeal: "再審査を申請済み",
    posted_help_community: "Help Community に投稿済み",
    drafting_public_reply: "公開返信を準備済み",
  },
};

function cleanText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function optionalText(value) {
  const cleaned = cleanText(value);
  return cleaned || null;
}

function uniqueList(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(cleanText).filter(Boolean))];
}

function safeInt(value) {
  const num = Number(value);
  return Number.isInteger(num) ? num : null;
}

function nullableBoolean(value, fallback = null) {
  if (value === true || value === false) return value;
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return fallback;
  if (["true", "1", "yes", "y"].includes(raw)) return true;
  if (["false", "0", "no", "n"].includes(raw)) return false;
  return fallback;
}

function normalizeConfidence(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (["high", "medium", "low", "unknown"].includes(raw)) return raw;
  return "unknown";
}

function excerpt(text, max = 180) {
  const cleaned = cleanText(text);
  if (!cleaned) return "";
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trim()}…`;
}

function formatDate(value, lang) {
  const raw = cleanText(value);
  if (!raw) return null;
  const ts = Date.parse(raw);
  if (!Number.isFinite(ts)) return raw;
  return new Date(ts).toLocaleDateString(lang === "ja" ? "ja-JP" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function joinList(items, lang) {
  const list = uniqueList(items);
  if (!list.length) return "";
  if (lang === "ja") return list.join("、");
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;
}

function normalizeInput(input) {
  const lang = resolveLang(input?.lang);
  const evidenceItems = Array.isArray(input?.evidenceItems) ? input.evidenceItems : [];
  const categories = CATEGORY_LABELS.en;
  const actions = ACTION_LABELS.en;
  const suspectedCategories = uniqueList(input?.suspectedCategories).filter((item) => categories[item]);
  const actionsTaken = uniqueList(input?.actionsTaken).filter((item) => actions[item]);
  const checkedEvidence = new Set(
    evidenceItems
      .filter((item) => item?.checked === true)
      .map((item) => cleanText(item?.key))
      .filter(Boolean)
  );

  return {
    lang,
    businessName: optionalText(input?.businessName) || t(lang, "this business", "この店舗"),
    reviewText: optionalText(input?.reviewText) || "",
    reviewDate: optionalText(input?.reviewDate),
    reviewerName: optionalText(input?.reviewerName),
    reviewRating: safeInt(input?.reviewRating),
    businessLaunchDate: optionalText(input?.businessLaunchDate),
    serviceLaunchDate: optionalText(input?.serviceLaunchDate),
    desiredHelp: optionalText(input?.desiredHelp),
    suspectedCategories,
    evidenceItems: evidenceItems.map((item) => ({
      key: cleanText(item?.key),
      checked: item?.checked === true,
    })),
    actionsTaken,
    hasCustomerRecord: nullableBoolean(input?.hasCustomerRecord, checkedEvidence.has("crm_no_customer_record") ? false : null),
    hasPaymentRecord: nullableBoolean(input?.hasPaymentRecord, checkedEvidence.has("no_transaction_record") ? false : null),
    hasBookingRecord: nullableBoolean(input?.hasBookingRecord),
    reviewPredatesBusinessLaunch: nullableBoolean(input?.reviewPredatesBusinessLaunch),
    reviewPredatesServiceLaunch: nullableBoolean(
      input?.reviewPredatesServiceLaunch,
      checkedEvidence.has("service_not_launched_yet") ? true : null
    ),
    containsPersonalInfo: nullableBoolean(input?.containsPersonalInfo),
    containsThreatOrHarassment: nullableBoolean(
      input?.containsThreatOrHarassment,
      suspectedCategories.includes("harassment_or_abuse") ? true : null
    ),
    appearsConflictOfInterest: nullableBoolean(
      input?.appearsConflictOfInterest,
      suspectedCategories.includes("conflict_of_interest") ? true : null
    ),
    appearsFactuallyImpossible: nullableBoolean(
      input?.appearsFactuallyImpossible,
      suspectedCategories.includes("factually_impossible_claim") ? true : null
    ),
    isAppointmentOnlyBusiness: nullableBoolean(input?.isAppointmentOnlyBusiness),
    contentlessLowRatingClusterDetected: nullableBoolean(input?.contentlessLowRatingClusterDetected),
    reviewerIdentityMatchConfidence: normalizeConfidence(input?.reviewerIdentityMatchConfidence),
  };
}

function checkedEvidenceKeys(input) {
  return input.evidenceItems.filter((item) => item.checked).map((item) => item.key);
}

function evidenceSummary(input) {
  return checkedEvidenceKeys(input)
    .map((key) => EVIDENCE_LABELS[input.lang][key])
    .filter(Boolean);
}

function actionsSummary(input) {
  return input.actionsTaken.map((key) => ACTION_LABELS[input.lang][key]).filter(Boolean);
}

function issueSummary(input) {
  const labels = input.suspectedCategories
    .map((key) => CATEGORY_LABELS[input.lang][key])
    .filter(Boolean);

  if (!labels.length) {
    return t(
      input.lang,
      "The review may need a clearer issue category before it is escalated.",
      "エスカレーション前に、レビューの論点をもう少し明確にする必要があります。"
    );
  }

  return t(
    input.lang,
    `The main concern is ${joinList(labels, input.lang)}.`,
    `主な論点は ${joinList(labels, input.lang)} です。`
  );
}

function reviewSnapshotLine(input) {
  const bits = [];

  if (Number.isFinite(input.reviewRating)) {
    bits.push(t(input.lang, `${input.reviewRating}-star review`, `${input.reviewRating}つ星レビュー`));
  } else {
    bits.push(t(input.lang, "review", "レビュー"));
  }

  if (input.reviewDate) {
    bits.push(t(input.lang, `posted on ${formatDate(input.reviewDate, input.lang)}`, `投稿日 ${formatDate(input.reviewDate, input.lang)}`));
  }
  if (input.reviewerName) {
    bits.push(t(input.lang, `under the name ${input.reviewerName}`, `投稿者名 ${input.reviewerName}`));
  }

  return t(
    input.lang,
    `I am documenting a Google Business Profile ${bits.join(" ")} for ${input.businessName}.`,
    `${input.businessName} に関する Google ビジネスプロフィールの ${bits.join(" / ")} を整理しています。`
  );
}

function inconsistencyLines(input) {
  const lines = [];
  const evidence = new Set(checkedEvidenceKeys(input));
  const categories = new Set(input.suspectedCategories);

  if (categories.has("not_a_real_customer")) {
    if (evidence.has("crm_no_customer_record") || evidence.has("no_transaction_record")) {
      lines.push(
        t(
          input.lang,
          "I have not found a matching customer or transaction record in the documentation reviewed so far.",
          "確認できている資料の範囲では、一致する顧客記録または取引記録が見つかっていません。"
        )
      );
    } else {
      lines.push(
        t(
          input.lang,
          "At the moment, I cannot clearly match the review to a documented customer experience.",
          "現時点では、このレビューを記録済みの顧客体験と明確に結び付けられていません。"
        )
      );
    }
  }

  if (categories.has("factually_impossible_claim")) {
    if (evidence.has("service_not_launched_yet")) {
      lines.push(
        t(
          input.lang,
          "The review timing appears inconsistent with the service timeline currently documented.",
          "レビュー日時が、現在確認できているサービス開始時期と整合しないように見えます。"
        )
      );
    } else if (input.serviceLaunchDate || input.businessLaunchDate) {
      lines.push(
        t(
          input.lang,
          "The timing may be inconsistent with the current launch timeline.",
          "時期が現在の開始時期と整合しない可能性があります。"
        )
      );
    } else {
      lines.push(
        t(
          input.lang,
          "Some claims in the review may be inconsistent with the facts currently documented.",
          "レビュー内の一部主張が、現在確認できている事実と整合しない可能性があります。"
        )
      );
    }
  }

  if (categories.has("harassment_or_abuse")) {
    lines.push(
      t(
        input.lang,
        "The tone may be hostile or not focused on a normal service experience.",
        "表現が攻撃的で、通常のサービス体験への言及から外れている可能性があります。"
      )
    );
  }

  if (categories.has("off_topic_or_irrelevant")) {
    lines.push(
      t(
        input.lang,
        "The content may not be directly relevant to the service experience being reviewed.",
        "内容が、評価対象となるサービス体験と直接関係していない可能性があります。"
      )
    );
  }

  if (categories.has("conflict_of_interest")) {
    lines.push(
      t(
        input.lang,
        "There may be a conflict-related context here, although I cannot confirm that with certainty.",
        "利害関係がある文脈の可能性がありますが、現時点で断定はできません。"
      )
    );
  }

  return uniqueList(lines);
}

function desiredHelpLine(input) {
  return (
    input.desiredHelp ||
    t(
      input.lang,
      "Guidance on the clearest next step and how to present the facts concisely.",
      "次に取るべき対応と、事実を簡潔に伝えるための整理方法について助言がほしいです。"
    )
  );
}

function buildSummary(input) {
  const lines = [
    reviewSnapshotLine(input),
    t(
      input.lang,
      `Review text summary: "${excerpt(input.reviewText)}"`,
      `レビュー内容の要約: 「${excerpt(input.reviewText)}」`
    ),
    issueSummary(input),
  ];

  const inconsistencies = inconsistencyLines(input);
  if (inconsistencies.length) lines.push(inconsistencies[0]);

  const evidence = evidenceSummary(input);
  if (evidence.length) {
    lines.push(
      t(
        input.lang,
        `Current supporting evidence: ${joinList(evidence, input.lang)}.`,
        `現在確認できている補足証拠: ${joinList(evidence, input.lang)}。`
      )
    );
  } else {
    lines.push(
      t(
        input.lang,
        "Supporting evidence is still limited, so the explanation should stay narrow and factual.",
        "補足証拠はまだ限られているため、説明は狭く絞って事実ベースに保つのが安全です。"
      )
    );
  }

  lines.push(
    t(
      input.lang,
      `Requested help: ${desiredHelpLine(input)}`,
      `求めている支援: ${desiredHelpLine(input)}`
    )
  );

  return lines.join(" ");
}

function buildCommunityPost(input) {
  const evidence = evidenceSummary(input);
  const actions = actionsSummary(input);
  const lines = [
    t(
      input.lang,
      `I am looking for guidance on a Google Business Profile review for ${input.businessName}.`,
      `${input.businessName} に付いた Google ビジネスプロフィールのレビューについて、整理の仕方と次の対応について助言をいただきたいです。`
    ),
    reviewSnapshotLine(input),
    t(
      input.lang,
      `The review says: "${excerpt(input.reviewText, 220)}"`,
      `レビュー本文: 「${excerpt(input.reviewText, 220)}」`
    ),
    issueSummary(input),
  ];

  const inconsistencies = inconsistencyLines(input);
  if (inconsistencies.length) {
    lines.push(
      t(
        input.lang,
        `What appears inconsistent: ${joinList(inconsistencies, input.lang)}`,
        `整合しないように見える点: ${joinList(inconsistencies, input.lang)}`
      )
    );
  }

  if (evidence.length) {
    lines.push(
      t(
        input.lang,
        `What I can confirm: ${joinList(evidence, input.lang)}.`,
        `確認できている事実: ${joinList(evidence, input.lang)}。`
      )
    );
  } else {
    lines.push(
      t(
        input.lang,
        "What I can confirm so far is still limited, and I am trying to keep the explanation factual.",
        "現時点で確認できている事実はまだ限られているため、説明は事実ベースに絞ろうとしています。"
      )
    );
  }

  if (actions.length) {
    lines.push(
      t(
        input.lang,
        `Steps already taken: ${joinList(actions, input.lang)}.`,
        `すでに行った対応: ${joinList(actions, input.lang)}。`
      )
    );
  }

  lines.push(
    t(
      input.lang,
      `I would appreciate guidance on the right next step. ${desiredHelpLine(input)}`,
      `次に取るべき対応について助言をいただけると助かります。${desiredHelpLine(input)}`
    )
  );

  return lines.join("\n\n");
}

function buildPublicResponse(input) {
  const evidence = new Set(checkedEvidenceKeys(input));
  const lines = [
    t(
      input.lang,
      "Thank you for sharing your feedback. We take concerns seriously.",
      "ご意見をお寄せいただきありがとうございます。いただいた内容は真摯に受け止めています。"
    ),
  ];

  if (evidence.has("crm_no_customer_record") || evidence.has("no_transaction_record")) {
    lines.push(
      t(
        input.lang,
        "At the moment, we have not been able to match this review to a documented customer or transaction record under the details available to us.",
        "現時点で確認できている範囲では、このレビューに一致する顧客記録または取引記録を確認できていません。"
      )
    );
  } else if (evidence.has("service_not_launched_yet")) {
    lines.push(
      t(
        input.lang,
        "The timeline described here may not match the service availability we have documented.",
        "ご記載の時期は、こちらで確認できているサービス提供時期と一致しない可能性があります。"
      )
    );
  } else {
    lines.push(
      t(
        input.lang,
        "Some of the details in this review may not match the information we currently have on record.",
        "このレビュー内の一部内容は、現在確認できている記録と一致しない可能性があります。"
      )
    );
  }

  lines.push(
    t(
      input.lang,
      "If you interacted with us under a different name or through another channel, please contact us directly so we can review the situation carefully.",
      "別名義や別の連絡経路でのご利用であれば、状況を丁寧に確認したいため、直接ご連絡いただけますと幸いです。"
    )
  );
  lines.push(
    t(
      input.lang,
      "We want to resolve genuine concerns in a fair and professional way.",
      "正当なご懸念については、公平かつ丁寧に対応したいと考えています。"
    )
  );
  return lines.join(" ");
}

function buildGuidance(input) {
  const guidance = [];
  const evidence = new Set(checkedEvidenceKeys(input));

  if (!input.suspectedCategories.length) {
    guidance.push(
      t(
        input.lang,
        "Choose one primary issue type before you post or escalate.",
        "投稿やエスカレーションの前に、主な論点を1つ決めましょう。"
      )
    );
  }

  if (input.suspectedCategories.length > 2) {
    guidance.push(
      t(
        input.lang,
        "Narrow the explanation to one or two issue types so it stays credible.",
        "説明の信頼性を保つため、論点は 1〜2 個に絞りましょう。"
      )
    );
  }

  if (!evidence.size) {
    guidance.push(
      t(
        input.lang,
        "Add at least one direct piece of evidence before escalating.",
        "エスカレーション前に、直接確認できる証拠を少なくとも1つ追加しましょう。"
      )
    );
  }

  if (
    input.suspectedCategories.includes("not_a_real_customer") &&
    !evidence.has("crm_no_customer_record") &&
    !evidence.has("no_transaction_record")
  ) {
    guidance.push(
      t(
        input.lang,
        "Document whether a matching customer or transaction record exists.",
        "一致する顧客記録または取引記録があるかどうかを確認しておきましょう。"
      )
    );
  }

  if (
    input.suspectedCategories.includes("factually_impossible_claim") &&
    !evidence.has("service_not_launched_yet") &&
    !input.businessLaunchDate &&
    !input.serviceLaunchDate
  ) {
    guidance.push(
      t(
        input.lang,
        "Add a brief launch or event timeline if the claim depends on timing.",
        "時期の整合性が論点なら、簡単な開始時期や出来事の時系列を加えましょう。"
      )
    );
  }

  if (!input.actionsTaken.length) {
    guidance.push(
      t(
        input.lang,
        "Note whether you already flagged or appealed so you avoid duplicate explanations.",
        "重複説明を避けるため、すでに報告や再審査を行ったかを整理しておきましょう。"
      )
    );
  }

  guidance.push(
    t(
      input.lang,
      "Keep confirmed facts separate from anything you only suspect.",
      "確認できている事実と推測している内容は分けて書きましょう。"
    )
  );
  return uniqueList(guidance).slice(0, 4);
}

function triageActions(category) {
  if (category === "worth_pursuing_for_removal") {
    return [
      "collect_evidence",
      "submit_removal_request",
      "prepare_one_time_appeal",
      "prepare_help_community_post",
    ];
  }

  if (category === "unclear_case") {
    return [
      "collect_evidence",
      "submit_removal_request",
      "draft_public_response",
      "monitor_review_impact",
      "start_review_recovery_plan",
    ];
  }

  return [
    "draft_public_response",
    "monitor_review_impact",
    "start_review_recovery_plan",
    "avoid_over_investing_in_removal",
  ];
}

function buildTriageWarning(category, lang) {
  if (category === "worth_pursuing_for_removal") return null;
  if (category === "unclear_case") {
    return t(
      lang,
      "Removal may still be worth attempting, but prepare a public response and recovery plan in parallel.",
      "削除申請を試す価値はありますが、公開返信とレビュー回復策も並行して準備するのが安全です。"
    );
  }

  return t(
    lang,
    "This case may be difficult to remove even if it feels unfair. Repeated removal attempts may not be the best use of time.",
    "不当だと感じても、このケースは削除が難しい可能性があります。削除申請の繰り返しに時間を使いすぎないよう注意しましょう。"
  );
}

export function buildReviewDisputeTriage(rawInput) {
  const input = normalizeInput(rawInput);
  const strongReasons = [];
  const mixedReasons = [];

  if (input.containsPersonalInfo) {
    strongReasons.push(
      t(
        input.lang,
        "The review may expose personal or sensitive information.",
        "レビューに個人情報または機微情報が含まれている可能性があります。"
      )
    );
  }

  if (input.containsThreatOrHarassment) {
    strongReasons.push(
      t(
        input.lang,
        "The review may contain threats, harassment, or abusive language.",
        "レビューに脅迫・嫌がらせ・攻撃的表現が含まれている可能性があります。"
      )
    );
  }

  if (input.reviewPredatesBusinessLaunch) {
    strongReasons.push(
      t(
        input.lang,
        "The review appears inconsistent with the business launch timeline.",
        "レビュー時期が事業開始時期と整合していない可能性があります。"
      )
    );
  }

  if (input.reviewPredatesServiceLaunch) {
    strongReasons.push(
      t(
        input.lang,
        "The review appears inconsistent with the service launch timeline.",
        "レビュー時期がサービス開始時期と整合していない可能性があります。"
      )
    );
  }

  if (input.appearsFactuallyImpossible) {
    strongReasons.push(
      t(
        input.lang,
        "The review may describe something that appears factually impossible.",
        "レビュー内容に事実上ありえない可能性のある記述が含まれています。"
      )
    );
  }

  if (input.contentlessLowRatingClusterDetected) {
    strongReasons.push(
      t(
        input.lang,
        "A cluster of low-rating reviews without clear service detail may be present.",
        "サービス内容の具体性が乏しい低評価レビューが集中している可能性があります。"
      )
    );
  }

  if (input.hasCustomerRecord === false && input.hasPaymentRecord === false && input.hasBookingRecord === false) {
    strongReasons.push(
      t(
        input.lang,
        "No matching customer, payment, or booking record has been documented.",
        "一致する顧客・支払い・予約記録が確認できていません。"
      )
    );
  } else {
    if (input.hasCustomerRecord === false) {
      mixedReasons.push(
        t(
          input.lang,
          "A matching customer record has not been documented.",
          "一致する顧客記録が確認できていません。"
        )
      );
    }
    if (input.hasPaymentRecord === false) {
      mixedReasons.push(
        t(
          input.lang,
          "A matching payment or transaction record has not been documented.",
          "一致する支払い・取引記録が確認できていません。"
        )
      );
    }
    if (input.hasBookingRecord === false) {
      mixedReasons.push(
        t(
          input.lang,
          "A matching booking record has not been documented.",
          "一致する予約記録が確認できていません。"
        )
      );
    }
  }

  if (input.isAppointmentOnlyBusiness && input.hasBookingRecord === false) {
    strongReasons.push(
      t(
        input.lang,
        "The business appears appointment-only, but no matching booking record has been documented.",
        "予約制の事業のように見えますが、一致する予約記録が確認できていません。"
      )
    );
  }

  if (input.appearsConflictOfInterest) {
    mixedReasons.push(
      t(
        input.lang,
        "There may be a conflict-of-interest context, but direct proof is still limited.",
        "利害関係の可能性はありますが、直接的な証拠はまだ限定的です。"
      )
    );
  }

  if (input.reviewerIdentityMatchConfidence === "low") {
    mixedReasons.push(
      t(
        input.lang,
        "The reviewer identity does not match your records with high confidence.",
        "レビュアー情報が記録と一致する確度は低いようです。"
      )
    );
  }

  if (input.reviewerIdentityMatchConfidence === "unknown") {
    mixedReasons.push(
      t(
        input.lang,
        "The reviewer identity is still unclear from the available records.",
        "利用可能な記録だけではレビュアーの特定がまだ難しい状況です。"
      )
    );
  }

  const answeredCount = [
    input.hasCustomerRecord,
    input.hasPaymentRecord,
    input.hasBookingRecord,
    input.reviewPredatesBusinessLaunch,
    input.reviewPredatesServiceLaunch,
    input.containsPersonalInfo,
    input.containsThreatOrHarassment,
    input.appearsConflictOfInterest,
    input.appearsFactuallyImpossible,
    input.isAppointmentOnlyBusiness,
    input.contentlessLowRatingClusterDetected,
  ].filter((value) => value !== null).length;

  let category = "better_handled_with_response_and_recovery";
  let confidence = answeredCount >= 4 ? "medium" : "low";
  let reasons = [];

  if (strongReasons.length) {
    category = "worth_pursuing_for_removal";
    confidence =
      input.containsPersonalInfo ||
      input.containsThreatOrHarassment ||
      input.reviewPredatesBusinessLaunch ||
      input.reviewPredatesServiceLaunch ||
      strongReasons.length >= 2
        ? "high"
        : "medium";
    reasons = strongReasons;
  } else if (mixedReasons.length) {
    category = "unclear_case";
    confidence = mixedReasons.length >= 2 || answeredCount >= 4 ? "medium" : "low";
    reasons = mixedReasons;
  } else {
    reasons = [
      t(
        input.lang,
        "The review may feel unfair, but the current record does not show a strong removal signal.",
        "不当だと感じても、現在確認できている情報だけでは強い削除根拠は見えていません。"
      ),
    ];
  }

  return {
    category,
    confidence,
    reasons: uniqueList(reasons).slice(0, 4),
    recommendedActions: triageActions(category),
    warningMessage: buildTriageWarning(category, input.lang),
  };
}

export function buildReviewDisputeDrafts(rawInput) {
  const input = normalizeInput(rawInput);

  if (!input.reviewText) {
    return {
      ok: false,
      code: "BAD_INPUT",
      message: t(
        input.lang,
        "Paste the suspicious review text before generating drafts.",
        "下書きを生成する前に、問題のあるレビュー本文を貼り付けてください。"
      ),
    };
  }

  return {
    ok: true,
    summary: buildSummary(input),
    communityPost: buildCommunityPost(input),
    publicResponse: buildPublicResponse(input),
    guidance: buildGuidance(input),
  };
}
