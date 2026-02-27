import * as comp from "../_lib/competitors.js";

export async function onRequest() {
  return new Response(
    JSON.stringify(
      {
        keys: Object.keys(comp),
        typeof_fetchCompetitors: typeof comp.fetchCompetitors,
        typeof_auto: typeof comp.fetchCompetitorsAutoRadius,
      },
      null,
      2
    ),
    { headers: { "content-type": "application/json" } }
  );
}