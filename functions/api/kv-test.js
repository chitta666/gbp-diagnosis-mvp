export async function onRequest({ env }) {
  const kv = env?.GBP_DIAG_KV;
  if (!kv) return new Response("NO_KV_BINDING", { status: 500 });

  await kv.put("ping", String(Date.now()));
  const v = await kv.get("ping");

  return new Response(JSON.stringify({ ok: true, v }, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
