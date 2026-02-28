function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

async function run() {
  const lat = document.getElementById("lat").value.trim();
  const lng = document.getElementById("lng").value.trim();
　const compMsg = data.competitorsAnalysis?.todo ?? "なし";
  const out = document.getElementById("out");
  out.innerHTML = "診断中...";

  const url = `/api/diagnose?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`;
  const res = await fetch(url);
  const text = await res.text();

if (!lat || !lng) {
  out.innerHTML = `<div class="card"><h3>ERROR</h3><pre>lat/lng が空</pre></div>`;
  return;
}

let data;
try {
  data = JSON.parse(text);
} catch {
  out.innerHTML = `<div class="card"><h3>INVALID JSON</h3><pre>${esc(text)}</pre></div>`;
  return;
}
}

document.getElementById("run").addEventListener("click", () => {
  run().catch((e) => {
    document.getElementById("out").innerHTML =
      `<div class="card"><h3>CRASH</h3><pre>${esc(e?.stack || e?.message || String(e))}</pre></div>`;
  });
});