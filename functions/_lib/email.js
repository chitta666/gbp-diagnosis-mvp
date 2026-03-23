function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

export function buildWeeklyEmail({
  listingName,
  insight,
  summaryLines,
  deepLink,
  weekAgo,
  today,
}) {
  const safeLines = Array.isArray(summaryLines)
    ? summaryLines.filter(Boolean).slice(0, 4)
    : [];
  const subject = `Your weekly GBP report is ready: ${listingName}`;
  const text = [
    `${listingName}`,
    `Report period: ${weekAgo} -> ${today}`,
    "",
    insight,
    "",
    ...safeLines.map((line) => `- ${line}`),
    "",
    `Open report: ${deepLink}`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6;">
      <h2 style="margin:0 0 12px;">${escapeHtml(listingName)}</h2>
      <p style="margin:0 0 12px;color:#4b5563;">Report period: ${escapeHtml(weekAgo)} -> ${escapeHtml(today)}</p>
      <p style="margin:0 0 12px;">${escapeHtml(insight)}</p>
      <ul style="padding-left:18px;margin:0 0 16px;">
        ${safeLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
      </ul>
      <p style="margin:0;">
        <a href="${escapeHtml(deepLink)}" style="display:inline-block;padding:10px 14px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">Open report</a>
      </p>
    </div>
  `;

  return { subject, text, html };
}

export async function sendEmailNotification({ env, to, subject, text, html }) {
  const fromEmail = env?.MAIL_FROM_EMAIL;
  const apiKey = env?.MAILCHANNELS_API_KEY;

  if (!fromEmail) {
    return {
      ok: false,
      skipped: true,
      reason: "MAIL_FROM_EMAIL_NOT_CONFIGURED",
    };
  }

  if (!apiKey) {
    return {
      ok: false,
      skipped: true,
      reason: "MAILCHANNELS_API_KEY_NOT_CONFIGURED",
    };
  }

  const endpoint = env?.MAILCHANNELS_API_URL || "https://api.mailchannels.net/tx/v1/send";
  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: {
      email: fromEmail,
      name: env?.MAIL_FROM_NAME || "GBP Diagnosis",
    },
    subject,
    content: [
      { type: "text/plain", value: text },
      { type: "text/html", value: html },
    ],
  };

  if (env?.MAIL_REPLY_TO) {
    payload.reply_to = {
      email: env.MAIL_REPLY_TO,
      name: env?.MAIL_FROM_NAME || "GBP Diagnosis",
    };
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    return {
      ok: false,
      skipped: false,
      status: res.status,
      message: await res.text(),
    };
  }

  return { ok: true, skipped: false };
}
