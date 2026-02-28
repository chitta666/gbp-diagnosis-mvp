function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

async function run() {
  const lat = document.getElementById("lat").value.trim();
  const lng = document.getElementById("lng").value.trim();

  const out = document.getElementById("out");
  out.innerHTML = "診断中...";

  const url = `/api/diagnose?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`;
  const res = await fetch(url);
  const text = await res.text();

  // 失敗時は生テキストを見せる（デバッグ最強）
  if (!res.ok) {
    out.innerHTML = `<div class="card"><h3>ERROR</h3><pre>${esc(text)}</pre></div>`;
    return;
  }

  const data = JSON.parse(text);

  out.innerHTML = `
    <div class="card">
      <h2>Score: ${esc(data.score)}</h2>
      <div><b>Penalty:</b> ${esc(data.penalty)}</div>
      <div style="margin-top:8px;"><b>TODO</b>
        <ul>${(data.todos ?? []).map(t => `<li>${esc(t)}</li>`).join("")}</ul>
      </div>
      <div><b>競合</b>: ${(data.competitorsAnalysis?.todo) ? esc(data.competitorsAnalysis.todo) : "なし"}</div>
    </div>
  `;
}

document.getElementById("run").addEventListener("click", () => {
  run().catch((e) => {
    document.getElementById("out").innerHTML =
      `<div class="card"><h3>CRASH</h3><pre>${esc(e?.stack || e?.message || String(e))}</pre></div>`;
  });
});