import { fetchCompetitorsAutoRadius } from "../_lib/competitors.js";
import { buildDiagnosis } from "../_lib/diagnosis.js";

export async function onRequest({ request, env }) {
  return new Response(
    JSON.stringify(
      {
        typeof_fetch: typeof fetch,
        typeof_autoRadius: typeof fetchCompetitorsAutoRadius,
        typeof_buildDiagnosis: typeof buildDiagnosis,
        has_key: !!env?.GOOGLE_MAPS_API_KEY,
        url: request.url,
      },
      null,
      2
    ),
    { headers: { "content-type": "application/json" } }
  );
}