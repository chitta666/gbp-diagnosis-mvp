// functions/_lib/date.js
export function ymdTokyo(d = new Date()) {
  // 日本時間に寄せた日付（YYYY-MM-DD）
  const tokyo = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const y = tokyo.getFullYear();
  const m = String(tokyo.getMonth() + 1).padStart(2, "0");
  const day = String(tokyo.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}