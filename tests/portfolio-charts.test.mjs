import assert from "node:assert/strict";
import test from "node:test";
import { appendLiveQuote, holdingsAllocation, historyForRange, purchaseTimeline } from "../app/components/portfolio-charts.mjs";
import historyModule from "../server/portfolio-history.js";

test("allocation reflects share edits and live prices and includes every position", () => {
  const holdings = [{ symbol: "AAPL", shares: 2, price: 50 }, { symbol: "MSFT", shares: 1, price: 100 }];
  assert.deepEqual(holdingsAllocation(holdings).map((item) => item.percent), [50, 50]);
  holdings[0].shares = 6;
  assert.deepEqual(holdingsAllocation(holdings).map((item) => item.percent), [75, 25]);
  holdings[1].price = 300;
  assert.deepEqual(holdingsAllocation(holdings).map((item) => item.percent), [50, 50]);
  assert.equal(holdingsAllocation(Array.from({ length: 8 }, (_, i) => ({ symbol: `S${i}`, shares: 1, price: 10 }))).length, 8);
  assert.deepEqual(holdingsAllocation([]), []);
  assert.deepEqual(holdingsAllocation([{ symbol: "ZERO", shares: 0, price: 10 }]), []);
});

test("live chart keeps observed price changes without inventing intermediate points", () => {
  const now = new Date("2026-09-29T15:00:00Z");
  const first = { timestamp: Date.parse("2026-09-29T14:00:00Z"), value: 100 };
  const second = { timestamp: Date.parse("2026-09-29T14:01:00Z"), value: 101 };
  assert.deepEqual(appendLiveQuote([], first, now), [first]);
  assert.deepEqual(appendLiveQuote([first], { timestamp: second.timestamp, value: 100 }, now), [first]);
  assert.deepEqual(appendLiveQuote([first], second, now), [first, second]);
  assert.deepEqual(appendLiveQuote([first, second], { timestamp: first.timestamp, value: 99 }, now), [first, second]);
  assert.deepEqual(appendLiveQuote([first], { timestamp: Date.parse("2026-09-28T14:00:00Z"), value: 99 }, now), [first]);
});

test("range buttons filter real dates, including month-end and leap-year boundaries", () => {
  const history = ["2024-01-01", "2025-03-31", "2025-09-30", "2025-12-31", "2026-02-27", "2026-02-28", "2026-03-31"].map((date) => ({ date, value: 10 }));
  const now = new Date("2026-03-31T15:00:00Z");
  assert.equal(historyForRange(history, "1M", now).length, 2);
  assert.equal(historyForRange(history, "3M", now).length, 4);
  assert.equal(historyForRange(history, "6M", now).length, 5);
  assert.equal(historyForRange(history, "1Y", now).length, 6);
  assert.equal(historyForRange(history, "ALL", now).length, 7);
  assert.equal(historyForRange([{ date: "2024-02-28" }, { date: "2024-02-29" }], "1M", new Date("2024-03-31")).length, 1);
  assert.deepEqual(historyForRange([], "1M", now), []);
});

test("daily history uses current quotes, preserves previous days, and isolates users", async () => {
  const documents = new Map();
  const collection = {
    async updateOne({ _id }, { $set }, { upsert }) {
      assert.equal(upsert, true);
      const saved = documents.get(_id) || { points: {} };
      for (const [path, amount] of Object.entries($set)) saved.points[path.slice(7)] = amount;
      documents.set(_id, saved);
    },
    async findOne({ _id }) { return documents.get(_id); }
  };
  const { recordHoldingsValue } = historyModule;
  const holdings = [{ symbol: "AAPL", shares: 2, price: 20 }];
  const quotes = new Map();
  assert.deepEqual(await recordHoldingsValue(collection, "alice", holdings, quotes, new Date("2026-09-27")), [{ date: "2026-09-27", value: 40 }]);
  quotes.set("AAPL", { quote: { price: 25 } });
  await recordHoldingsValue(collection, "alice", holdings, quotes, new Date("2026-09-28"));
  holdings[0].shares = 3.5;
  const history = await recordHoldingsValue(collection, "alice", holdings, quotes, new Date("2026-09-28T20:00:00Z"));
  assert.deepEqual(history, [{ date: "2026-09-27", value: 40 }, { date: "2026-09-28", value: 87.5 }]);
  assert.deepEqual(await recordHoldingsValue(collection, "bob", [], quotes, new Date("2026-09-28")), [{ date: "2026-09-28", value: 0 }]);
  holdings[0].shares = 0;
  assert.equal((await recordHoldingsValue(collection, "alice", holdings, quotes, new Date("2026-09-28")))[1].value, 0);
  assert.equal(documents.get("alice").points["2026-09-27"], 40);
});

test("dated buys extend the chart without inventing historical market values", () => {
  const holdings = [{ symbol: "AAPL", purchases: [
    { date: "2026-06-15", shares: 2, price: 100 },
    { date: "2026-03-01", shares: 1, price: 80 }
  ] }, { symbol: "MSFT", purchases: [{ date: "2026-06-15", shares: 0.5, price: 200 }] },
  { symbol: "LEGACY", shares: 50, price: 10 }];
  const snapshots = [{ date: "2026-09-28", value: 950 }, { date: "2026-09-29", value: 960 }];
  const history = purchaseTimeline(snapshots, holdings, new Date("2026-09-29"));
  assert.deepEqual(history.map(({ date, invested, value }) => ({ date, invested, value })), [
    { date: "2026-02-28", invested: 0, value: undefined },
    { date: "2026-03-01", invested: 80, value: undefined },
    { date: "2026-06-15", invested: 380, value: undefined },
    { date: "2026-09-28", invested: 380, value: 950 },
    { date: "2026-09-29", invested: 380, value: 960 }
  ]);
  assert.ok(history.every((point) => point.timestamp === Date.parse(point.date)));
  const range = historyForRange(history, "1M", new Date("2026-09-29"));
  assert.equal(range[0].date, "2026-08-29");
  assert.equal(range[0].invested, 380);
  assert.equal(range[0].value, undefined);
  // Editing shares does not rewrite the purchase ledger.
  holdings[0].shares = 0;
  assert.equal(purchaseTimeline(snapshots, holdings, new Date("2026-09-29")).at(-1).invested, 380);
});

test("same-day buys are visible and invalid or future purchases are excluded", () => {
  const today = new Date("2026-09-29");
  const history = purchaseTimeline([], [{ purchases: [
    { date: "2026-09-29", shares: 2, price: 25 },
    { date: "2026-09-30", shares: 1, price: 100 },
    { date: "2026-02-30", shares: 1, price: 100 },
    { date: "2026-09-29", shares: -1, price: 100 }
  ] }], today);
  assert.deepEqual(history.map(({ date, invested }) => ({ date, invested })), [
    { date: "2026-09-28", invested: 0 }, { date: "2026-09-29", invested: 50 }
  ]);
  assert.deepEqual(purchaseTimeline([], [], today), []);
});
