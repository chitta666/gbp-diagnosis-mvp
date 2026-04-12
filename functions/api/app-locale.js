import { resolveRequestLanguage } from "../_lib/i18n.js";

export async function onRequest({ request }) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
  };

  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj, null, 2), { status, headers });

  const locale = resolveRequestLanguage({ request, fallback: "en" });

  return json({
    ok: true,
    lang: locale.lang,
    source: locale.source,
  });
}
