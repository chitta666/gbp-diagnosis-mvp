const CATEGORY_LABELS = {
  not_a_real_customer: "possible non-customer experience",
  conflict_of_interest: "possible conflict of interest",
  harassment_or_abuse: "possible harassment or abuse",
  factually_impossible_claim: "factually inconsistent claim",
  off_topic_or_irrelevant: "off-topic or irrelevant content",
  other: "other review concern",
};

const EVIDENCE_LABELS = {
  crm_no_customer_record: "no matching customer record is documented",
  no_transaction_record: "no matching transaction record is documented",
  service_not_launched_yet: "the service timeline may not match the review date",
  timeline_documented: "a relevant timeline has been documented",
  supporting_screenshots_ready: "supporting screenshots are available",
  only_relevant_evidence_selected: "only directly relevant evidence is being included",
  other: "other supporting evidence is available",
};

const ACTION_LABELS = {
  flagged_in_gbp: "flagged in GBP",
  submitted_removal_request: "submitted a removal request",
  submitted_appeal: "submitted an appeal",
  posted_help_community: "posted in the Help Community",
  drafting_public_reply: "prepared a public reply",
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

function excerpt(text, max = 180) {
  const cleaned = cleanText(text);
  if (!cleaned) return "";
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trim()}…`;
}

function formatDate(value) {
  const raw = cleanText(value);
  if (!raw) return null;
  const ts = Date.parse(raw);
  if (!Number.isFinite(ts)) return raw;
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function joinEnglishList(items) {
  const list = uniqueList(items);
  if (!list.length) return "";
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;
}

function normalizeInput(input) {
  const evidenceItems = Array.isArray(input?.evidenceItems) ? input.evidenceItems : [];

  return {
    businessName: optionalText(input?.businessName) || "this business",
    reviewText: optionalText(input?.reviewText) || "",
    reviewDate: optionalText(input?.reviewDate),
    reviewerName: optionalText(input?.reviewerName),
    reviewRating: safeInt(input?.reviewRating),
    businessLaunchDate: optionalText(input?.businessLaunchDate),
    serviceLaunchDate: optionalText(input?.serviceLaunchDate),
    desiredHelp: optionalText(input?.desiredHelp),
    suspectedCategories: uniqueList(input?.suspectedCategories).filter(
      (item) => CATEGORY_LABELS[item]
    ),
    evidenceItems: evidenceItems.map((item) => ({
      key: cleanText(item?.key),
      checked: item?.checked === true,
    })),
    actionsTaken: uniqueList(input?.actionsTaken).filter((item) => ACTION_LABELS[item]),
  };
}

function checkedEvidenceKeys(input) {
  return input.evidenceItems.filter((item) => item.checked).map((item) => item.key);
}

function evidenceSummary(input) {
  return checkedEvidenceKeys(input)
    .map((key) => EVIDENCE_LABELS[key])
    .filter(Boolean);
}

function actionsSummary(input) {
  return input.actionsTaken.map((key) => ACTION_LABELS[key]).filter(Boolean);
}

function issueSummary(input) {
  const labels = input.suspectedCategories
    .map((key) => CATEGORY_LABELS[key])
    .filter(Boolean);

  if (!labels.length) {
    return "The review may need a clearer issue category before it is escalated.";
  }

  return `The main concern is ${joinEnglishList(labels)}.`;
}

function reviewSnapshotLine(input) {
  const bits = [];

  if (Number.isFinite(input.reviewRating)) bits.push(`${input.reviewRating}-star review`);
  else bits.push("review");

  if (input.reviewDate) bits.push(`posted on ${formatDate(input.reviewDate)}`);
  if (input.reviewerName) bits.push(`under the name ${input.reviewerName}`);

  return `I am documenting a Google Business Profile ${bits.join(" ")} for ${input.businessName}.`;
}

function inconsistencyLines(input) {
  const lines = [];
  const evidence = new Set(checkedEvidenceKeys(input));
  const categories = new Set(input.suspectedCategories);

  if (categories.has("not_a_real_customer")) {
    if (evidence.has("crm_no_customer_record") || evidence.has("no_transaction_record")) {
      lines.push("I have not found a matching customer or transaction record in the documentation reviewed so far.");
    } else {
      lines.push("At the moment, I cannot clearly match the review to a documented customer experience.");
    }
  }

  if (categories.has("factually_impossible_claim")) {
    if (evidence.has("service_not_launched_yet")) {
      lines.push("The review timing appears inconsistent with the service timeline currently documented.");
    } else if (input.serviceLaunchDate || input.businessLaunchDate) {
      lines.push("The timing may be inconsistent with the current launch timeline.");
    } else {
      lines.push("Some claims in the review may be inconsistent with the facts currently documented.");
    }
  }

  if (categories.has("harassment_or_abuse")) {
    lines.push("The tone may be hostile or not focused on a normal service experience.");
  }

  if (categories.has("off_topic_or_irrelevant")) {
    lines.push("The content may not be directly relevant to the service experience being reviewed.");
  }

  if (categories.has("conflict_of_interest")) {
    lines.push("There may be a conflict-related context here, although I cannot confirm that with certainty.");
  }

  return uniqueList(lines);
}

function desiredHelpLine(input) {
  return input.desiredHelp || "Guidance on the clearest next step and how to present the facts concisely.";
}

function buildSummary(input) {
  const lines = [
    reviewSnapshotLine(input),
    `Review text summary: "${excerpt(input.reviewText)}"`,
    issueSummary(input),
  ];

  const inconsistencies = inconsistencyLines(input);
  if (inconsistencies.length) lines.push(inconsistencies[0]);

  const evidence = evidenceSummary(input);
  if (evidence.length) {
    lines.push(`Current supporting evidence: ${joinEnglishList(evidence)}.`);
  } else {
    lines.push("Supporting evidence is still limited, so the explanation should stay narrow and factual.");
  }

  lines.push(`Requested help: ${desiredHelpLine(input)}`);
  return lines.join(" ");
}

function buildCommunityPost(input) {
  const evidence = evidenceSummary(input);
  const actions = actionsSummary(input);
  const lines = [
    `I am looking for guidance on a Google Business Profile review for ${input.businessName}.`,
    reviewSnapshotLine(input),
    `The review says: "${excerpt(input.reviewText, 220)}"`,
    issueSummary(input),
  ];

  const inconsistencies = inconsistencyLines(input);
  if (inconsistencies.length) {
    lines.push(`What appears inconsistent: ${joinEnglishList(inconsistencies)}`);
  }

  if (evidence.length) {
    lines.push(`What I can confirm: ${joinEnglishList(evidence)}.`);
  } else {
    lines.push("What I can confirm so far is still limited, and I am trying to keep the explanation factual.");
  }

  if (actions.length) {
    lines.push(`Steps already taken: ${joinEnglishList(actions)}.`);
  }

  lines.push(`I would appreciate guidance on the right next step. ${desiredHelpLine(input)}`);
  return lines.join("\n\n");
}

function buildPublicResponse(input) {
  const evidence = new Set(checkedEvidenceKeys(input));
  const lines = ["Thank you for sharing your feedback. We take concerns seriously."];

  if (evidence.has("crm_no_customer_record") || evidence.has("no_transaction_record")) {
    lines.push(
      "At the moment, we have not been able to match this review to a documented customer or transaction record under the details available to us."
    );
  } else if (evidence.has("service_not_launched_yet")) {
    lines.push(
      "The timeline described here may not match the service availability we have documented."
    );
  } else {
    lines.push(
      "Some of the details in this review may not match the information we currently have on record."
    );
  }

  lines.push(
    "If you interacted with us under a different name or through another channel, please contact us directly so we can review the situation carefully."
  );
  lines.push("We want to resolve genuine concerns in a fair and professional way.");
  return lines.join(" ");
}

function buildGuidance(input) {
  const guidance = [];
  const evidence = new Set(checkedEvidenceKeys(input));

  if (!input.suspectedCategories.length) {
    guidance.push("Choose one primary issue type before you post or escalate.");
  }

  if (input.suspectedCategories.length > 2) {
    guidance.push("Narrow the explanation to one or two issue types so it stays credible.");
  }

  if (!evidence.size) {
    guidance.push("Add at least one direct piece of evidence before escalating.");
  }

  if (
    input.suspectedCategories.includes("not_a_real_customer") &&
    !evidence.has("crm_no_customer_record") &&
    !evidence.has("no_transaction_record")
  ) {
    guidance.push("Document whether a matching customer or transaction record exists.");
  }

  if (
    input.suspectedCategories.includes("factually_impossible_claim") &&
    !evidence.has("service_not_launched_yet") &&
    !input.businessLaunchDate &&
    !input.serviceLaunchDate
  ) {
    guidance.push("Add a brief launch or event timeline if the claim depends on timing.");
  }

  if (!input.actionsTaken.length) {
    guidance.push("Note whether you already flagged or appealed so you avoid duplicate explanations.");
  }

  guidance.push("Keep confirmed facts separate from anything you only suspect.");
  return uniqueList(guidance).slice(0, 4);
}

export function buildReviewDisputeDrafts(rawInput) {
  const input = normalizeInput(rawInput);

  if (!input.reviewText) {
    return {
      ok: false,
      code: "BAD_INPUT",
      message: "Paste the suspicious review text before generating drafts.",
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
