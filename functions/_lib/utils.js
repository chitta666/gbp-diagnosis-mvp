export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}

export async function fetchJson(u) {
  const res = await fetch(u);

  const ct = res.headers.get("content-type") || "";
  const text = await res.text();

  console.log("FETCH_STATUS:", res.status);
  console.log("FETCH_CT:", ct);
  console.log("FETCH_BODY_HEAD:", text.slice(0, 200));

  if (!res.ok) {
    throw new Error(`FETCH_FAILED status=${res.status}`);
  }

  if (!ct.includes("application/json")) {
    throw new Error(`NOT_JSON content-type=${ct}`);
  }

  return JSON.parse(text);
}

export function looksLikeUrl(s) {
  return /^https?:\/\//i.test(s);
}

export async function expandUrl(u) {
  try {
    const res = await fetch(u, { redirect: "follow" });
    return res.url || u;
  } catch {
    return u;
  }
}