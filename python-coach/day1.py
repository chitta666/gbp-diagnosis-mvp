def monthly_payment(principal: float, annual_rate: float, years: int) -> float:
    r = annual_rate / 12
    n = years * 12
    if r == 0:
        return principal / n
    return principal * r * (1 + r) ** n / ((1 + r) ** n - 1)


p = 40_000_000
years = 35

for rate in [0.008, 0.015, 0.025]:
    pay = monthly_payment(p, rate, years)
    total = pay * 12 * years
    interest = total - p
    print(f"年利 {rate*100:.1f}%")
    print(f"  月返済: {pay:,.0f} 円")
    print(f"  総返済: {total:,.0f} 円")
    print(f"  利息総額: {interest:,.0f} 円")
    print()
