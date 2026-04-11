import { saveFeedback } from "../_lib/feedback.js";

export async function onRequest({ request, env }) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
  };

  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj, null, 2), { status, headers });

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...headers,
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type",
      },
    });
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }

  const KV = env?.KV;
  if (!KV) {
    return json({ ok: false, error: "NO_KV_BINDING" }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "INVALID_JSON" }, 400);
  }

  try {
    const result = await saveFeedback({ KV, payload: body, request });
    if (!result.ok) {
      return json(result, 400);
    }
    return json(result);
  } catch (error) {
    console.error("feedback submit failed", error);
    return json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        message: "Could not send feedback right now.",
      },
      500
    );
  }
}
