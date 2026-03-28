const HEALTH_LAST_KEY = "health:core:last";
const HEALTH_HISTORY_INDEX_KEY = "health:core:history:index";
const HEALTH_ALERT_KEY = "health:core:last-alert";

function safeJson(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function readJson(KV, key, fallback = null) {
  if (!KV) return fallback;
  const raw = await KV.get(key);
  return raw ? safeJson(raw, fallback) : fallback;
}

function authToken(request) {
  const header = request.headers.get("authorization") || "";
  const bearer = header.match(/^Bearer\s+(.+)$/i);
  if (bearer?.[1]) return bearer[1].trim();

  const direct = request.headers.get("x-healthcheck-secret");
  return direct ? direct.trim() : "";
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "authorization, x-healthcheck-secret",
    },
  });
}

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "authorization, x-healthcheck-secret",
      },
    });
  }

  if (request.method !== "GET") {
    return jsonResponse({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }

  const secret = env?.HEALTHCHECK_SECRET || env?.NOTIFICATION_SECRET || "";
  if (!secret) {
    return jsonResponse(
      {
        ok: false,
        error: "HEALTHCHECK_SECRET_NOT_CONFIGURED",
      },
      500
    );
  }

  const token = authToken(request);
  if (token !== secret) {
    return jsonResponse({ ok: false, error: "UNAUTHORIZED" }, 401);
  }

  const KV = env?.KV;
  const last = await readJson(KV, HEALTH_LAST_KEY, null);
  const alert = await readJson(KV, HEALTH_ALERT_KEY, null);
  const historyKeys = await readJson(KV, HEALTH_HISTORY_INDEX_KEY, []);

  return jsonResponse({
    ok: true,
    last,
    alert,
    historyKeys: Array.isArray(historyKeys) ? historyKeys : [],
  });
}

