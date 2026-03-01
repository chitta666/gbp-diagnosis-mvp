export async function onRequest({ env }) {
  const kv = env.KV; // Binding Name が KV の想定

  if (!kv) return new Response("NO_KV_BINDING", { status: 500 });

  const key = "ping";
  const value = String(Date.now());

  await kv.put(key, value);
  const v = await kv.get(key);

  return Response.json({ ok: true, v });
}