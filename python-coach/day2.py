import csv

def monthly_payment(principal: float, annual_rate: float, years: int) -> float:
    r = annual_rate / 12
    n = years * 12
    if r == 0:
        return principal / n
    return principal * r * (1 + r) ** n / ((1 + r) ** n - 1)

# ===== 設定（ここだけ触ればOK）=====
PRINCIPAL = 40_000_000
YEARS = 35
RATES = [0.008, 0.015, 0.025]
# ===================================

rows = []
for rate in RATES:
    pay = monthly_payment(PRINCIPAL, rate, YEARS)
    total = pay * 12 * YEARS
    interest = total - PRINCIPAL

    rows.append({
        "annual_rate_percent": round(rate * 100, 3),
        "monthly_payment_yen": round(pay),
        "total_payment_yen": round(total),
        "interest_total_yen": round(interest),
    })

# 表表示（ターミナル）
print(f"元本 {PRINCIPAL:,.0f} 円 / 年数 {YEARS} 年")
print(f"{'年利(%)':>8} {'月返済(円)':>12} {'総返済(円)':>12} {'利息総額(円)':>14}")
for r in rows:
    print(f"{r['annual_rate_percent']:8.3f} {r['monthly_payment_yen']:12,} {r['total_payment_yen']:12,} {r['interest_total_yen']:14,}")

# CSV出力
out_path = "results.csv"
with open(out_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)

print(f"\nSaved: {out_path}")
