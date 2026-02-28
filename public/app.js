function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

async function run() {
  const lat = document.getElementById("lat").value.trim();
  const lng = document.getElementById("lng").value.trim();
  const out = document.getElementById("out");

  if (!lat || !lng) {
    out.innerHTML = `<pre>lat/lng が空</pre>`;
    return;
  }

  const url = `/api/diagnose?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`;
  const res = await fetch(url);
  const text = await res.text();

  out.innerHTML = `
    <pre>HTTP ${res.status} ${res.ok ? "OK" : "NG"}</pre>
    <pre>URL: ${esc(url)}</pre>
    <pre>${esc(text)}</pre>
  `;
}

document.getElementById("run").addEventListener("click", () => {
  run().catch((e) => {
    document.getElementById("out").innerHTML =
      `<pre>CRASH:\n${esc(e?.stack || e?.message || String(e))}</pre>`;
  });
});