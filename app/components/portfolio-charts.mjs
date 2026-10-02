const colors = ["#6D5DFB", "#33C58D", "#F0B34D", "#F27E7E", "#5799DA", "#BC73CF", "#9AA4B2"];

export function holdingsAllocation(holdings) {
  const positions = holdings.map((holding) => ({ name: holding.symbol, value: holding.price * holding.shares }))
    .filter((holding) => Number.isFinite(holding.value) && holding.value > 0);
  const total = positions.reduce((sum, holding) => sum + holding.value, 0);
  return positions.map((holding, index) => ({ ...holding, percent: holding.value / total * 100, color: colors[index % colors.length] }));
}

// Keep only prices actually observed while the dashboard is open. Repeated
// unchanged quotes do not create artificial movement in the live chart.
export function appendLiveQuote(points, sample, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const recent = points.filter((point) => Number.isFinite(point.timestamp)
    && Number.isFinite(new Date(point.timestamp).getTime())
    && new Date(point.timestamp).toISOString().slice(0, 10) === today
    && Number.isFinite(point.value) && point.value >= 0);
  if (!Number.isFinite(sample.timestamp) || !Number.isFinite(sample.value) || sample.value < 0
    || !Number.isFinite(new Date(sample.timestamp).getTime())
    || new Date(sample.timestamp).toISOString().slice(0, 10) !== today) return recent;
  const last = recent.at(-1);
  if (last && (sample.timestamp <= last.timestamp || Math.abs(sample.value - last.value) < 0.005)) return recent;
  return [...recent, sample].slice(-400);
}

export function historyForRange(history, range, now = new Date()) {
  const cutoff = new Date(now);
  if (range === "ALL") return history;
  const months = { "1M": 1, "3M": 3, "6M": 6, "1Y": 12 }[range];
  if (!months) return history;
  // Clamp month-end dates so March 31 minus one month lands in February.
  cutoff.setUTCDate(1);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0)).getUTCDate();
  cutoff.setUTCDate(Math.min(now.getUTCDate(), lastDay));
  cutoff.setUTCHours(0, 0, 0, 0);
  const filtered = history.filter((point) => Date.parse(point.date) >= cutoff.getTime());
  const previous = history.filter((point) => Date.parse(point.date) < cutoff.getTime()).at(-1);
  // Carry invested capital into the selected range when the buy was earlier.
  if (previous && Number.isFinite(previous.invested) && filtered.length && Date.parse(filtered[0].date) > cutoff.getTime()) {
    filtered.unshift({ date: cutoff.toISOString().slice(0, 10), timestamp: cutoff.getTime(), invested: previous.invested });
  }
  return filtered;
}

// Purchases describe invested capital; snapshots describe observed market value.
// Keep the two series separate because a purchase date alone cannot provide a
// historical market price. Legacy holdings without dates contribute no purchases.
export function purchaseTimeline(history, holdings, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const purchases = holdings.flatMap((holding) => holding.purchases || [])
    .filter(({ date, shares, price }) => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
      && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date
      && date <= today && Number.isFinite(shares) && shares > 0 && Number.isFinite(price) && price > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!purchases.length) return history.map((point) => ({ ...point, timestamp: Date.parse(point.date) }));
  const points = new Map(history.map((point) => [point.date, { ...point }]));
  for (const purchase of purchases) {
    if (!points.has(purchase.date)) points.set(purchase.date, { date: purchase.date });
  }
  // Show the first purchase as a step up from zero, including same-day buys.
  const beforeFirst = new Date(Date.parse(purchases[0].date) - 86400000).toISOString().slice(0, 10);
  if (!points.has(beforeFirst)) points.set(beforeFirst, { date: beforeFirst });
  if (!points.has(today)) points.set(today, { date: today });
  let invested = 0;
  let index = 0;
  return [...points.values()].sort((a, b) => a.date.localeCompare(b.date)).map((point) => {
    while (index < purchases.length && purchases[index].date <= point.date) {
      invested += purchases[index].shares * purchases[index].price;
      index++;
    }
    return { ...point, invested, timestamp: Date.parse(point.date) };
  });
}
