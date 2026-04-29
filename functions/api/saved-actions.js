import { resolveRequestLanguage } from "../_lib/i18n.js";
import {
  appendSavedListingAction,
  publicSavedListing,
  updateSavedListingAction,
} from "../_lib/savedListings.js";

const ACTION_STATUSES = new Set(["planned", "done", "skipped"]);

function t(lang, en, ja) {
  return lang === "ja" ? ja : en;
}

export async function onRequest({ request, env }) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, PATCH, OPTIONS",
    "access-control-allow-headers": "content-type",
  };

  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj, null, 2), { status, headers });

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  const origin = new URL(request.url).origin;
  const { lang } = resolveRequestLanguage({ request, fallback: "en" });
  const KV = env?.KV;

  if (!KV) {
    return json(
      {
        ok: false,
        error: "NO_KV_BINDING",
        message: t(
          lang,
          "KV binding is not configured.",
          "KV バインディングが設定されていません。"
        ),
      },
      500
    );
  }

  if (!["POST", "PATCH"].includes(request.method)) {
    return json(
      {
        ok: false,
        error: "METHOD_NOT_ALLOWED",
        message: t(lang, "Method not allowed.", "許可されていないメソッドです。"),
      },
      405
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(
      {
        ok: false,
        error: "INVALID_JSON",
        message: t(lang, "Invalid JSON body.", "JSON の形式が正しくありません。"),
      },
      400
    );
  }

  const id = String(body?.id || "").trim();
  if (!id) {
    return json(
      {
        ok: false,
        error: "ID_REQUIRED",
        message: t(lang, "saved listing id is required.", "保存済み店舗の id が必要です。"),
      },
      400
    );
  }

  if (request.method === "POST") {
    const action = body?.action || {};
    if (!String(action?.label || action?.body || "").trim()) {
      return json(
        {
          ok: false,
          error: "ACTION_REQUIRED",
          message: t(
            lang,
            "Action label or body is required.",
            "アクションの見出しまたは本文が必要です。"
          ),
        },
        400
      );
    }

    const result = await appendSavedListingAction({ KV, id, action });
    if (!result) {
      return json(
        {
          ok: false,
          error: "NOT_FOUND",
          message: t(lang, "Saved listing not found.", "保存済み店舗が見つかりません。"),
        },
        404
      );
    }

    return json({
      ok: true,
      action: result.action,
      savedListing: publicSavedListing(result.record, { origin, lang }),
      message: t(lang, "Action saved.", "アクションを保存しました。"),
    });
  }

  if (request.method === "PATCH") {
    const actionId = String(body?.actionId || "").trim();
    const status = String(body?.status || "").trim().toLowerCase();

    if (!actionId || !ACTION_STATUSES.has(status)) {
      return json(
        {
          ok: false,
          error: "ACTION_ID_AND_STATUS_REQUIRED",
          message: t(
            lang,
            "actionId and a valid status are required.",
            "actionId と有効なステータスが必要です。"
          ),
        },
        400
      );
    }

    const result = await updateSavedListingAction({
      KV,
      id,
      actionId,
      status,
      note: body?.note,
    });

    if (!result) {
      return json(
        {
          ok: false,
          error: "NOT_FOUND",
          message: t(lang, "Saved action not found.", "保存済みアクションが見つかりません。"),
        },
        404
      );
    }

    return json({
      ok: true,
      action: result.action,
      savedListing: publicSavedListing(result.record, { origin, lang }),
      message: t(lang, "Action updated.", "アクションを更新しました。"),
    });
  }

  return json(
    {
      ok: false,
      error: "METHOD_NOT_ALLOWED",
      message: t(lang, "Method not allowed.", "許可されていないメソッドです。"),
    },
    405
  );
}
