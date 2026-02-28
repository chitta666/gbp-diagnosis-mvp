export async function onRequest({ env }) {
  const kv = env.GBP_DIAG_KV; // Binding 名に合わせる
  if (!kv) return new Response("NO_KV_BINDING", { status: 500 });

  await kv.put("hello", "world");
  const v = await kv.get("hello");

  return new Response(JSON.stringify({ ok: true, v }, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}