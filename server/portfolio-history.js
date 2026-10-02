async function recordHoldingsValue(collection, userId, holdings, quotes, now = new Date()) {
  const value = holdings.reduce((total, holding) => {
    const price = quotes.get(holding.symbol)?.quote.price ?? holding.price;
    return total + price * holding.shares;
  }, 0);
  if (!Number.isFinite(value) || value < 0) throw new Error("Invalid holdings value");
  const day = now.toISOString().slice(0, 10);
  // One point per UTC day. Refresh today's point without changing earlier days.
  await collection.updateOne({ _id: userId }, { $set: { [`points.${day}`]: value } }, { upsert: true });
  const saved = await collection.findOne({ _id: userId });
  return Object.entries(saved?.points || {})
    .filter(([date, amount]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(amount) && amount >= 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, value: amount }));
}

module.exports = { recordHoldingsValue };
