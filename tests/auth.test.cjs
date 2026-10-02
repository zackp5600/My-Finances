const { test } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { MongoClient } = require("mongodb");
const { app, startServer, connectDatabase } = require("../server/index");

test("account API handles database outages and signup responses", async (t) => {
  const savedUri = process.env.MONGODB_URI;
  const savedPort = process.env.PORT;
  delete process.env.MONGODB_URI;
  process.env.PORT = "0";
  let server = startServer();
  await once(server, "listening");
  let baseUrl = `http://127.0.0.1:${server.address().port}`;
  const credentials = { name: "Test Investor", email: "test@example.com", password: "test-password-123" };
  let userId = "default";
  const post = (path, body = credentials) => fetch(`${baseUrl}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-user-id": userId }, body: JSON.stringify(body)
  });

  try {
    await t.test("API stays reachable when MongoDB is unavailable", async () => {
      const health = await fetch(`${baseUrl}/api/health`);
      assert.equal(health.status, 200);
      assert.equal((await health.json()).database, "unavailable");
      for (const path of ["/api/auth/signup", "/api/auth/login"]) {
        const response = await post(path);
        assert.equal(response.status, 503);
        assert.match((await response.json()).error, /database is unavailable/);
      }
    });
    await new Promise((resolve) => server.close(resolve));

    const users = new Map();
    const portfolios = new Map();
    let failWrites = false;
    let failPortfolioWrites = false;
    const collections = {
      users: {
        findOne: async ({ email }) => users.get(email),
        insertOne: async (user) => {
          if (failWrites) throw new Error("Simulated database outage");
          users.set(user.email, user);
        }
      },
      portfolios: {
        insertOne: async (portfolio) => portfolios.set(portfolio._id, portfolio),
        findOne: async ({ _id }) => portfolios.get(_id),
        updateOne: async ({ _id }, { $set }) => {
          if (failPortfolioWrites) throw new Error("Simulated write failure");
          const current = portfolios.get(_id);
          if (!current) return { matchedCount: 0 };
          portfolios.set(_id, { ...current, ...$set });
          return { matchedCount: 1 };
        },
        replaceOne: async ({ _id }, portfolio) => {
          if (failPortfolioWrites) throw new Error("Simulated write failure");
          portfolios.set(_id, portfolio);
        }
      }
    };
    t.mock.method(MongoClient.prototype, "connect", async function () { return this; });
    t.mock.method(MongoClient.prototype, "db", () => ({ collection: (name) => collections[name] || {} }));
    process.env.MONGODB_URI = "mongodb://127.0.0.1:27017";
    await connectDatabase();
    server = app.listen(0);
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    await t.test("signup stores hashed credentials and creates a portfolio", async () => {
      const response = await post("/api/auth/signup");
      assert.equal(response.status, 201);
      const { user } = await response.json();
      userId = user.id;
      assert.equal(user.email, credentials.email);
      assert.equal(portfolios.get(user.id).owner, credentials.name);
      assert.notEqual(users.get(user.email).passwordHash, credentials.password);
      assert.equal(user.passwordHash, undefined);
      const login = await post("/api/auth/login");
      assert.equal(login.status, 200);
      assert.equal((await login.json()).user.id, user.id);
      const duplicate = await post("/api/auth/signup");
      assert.equal(duplicate.status, 409);
    });

    await t.test("holding purchases retain dates and prices across repeat buys and reloads", async () => {
      const buy = { symbol: "AAPL", averagePrice: 100, shares: 2, purchaseDate: "2024-06-15" };
      const first = await post("/api/holdings", buy);
      assert.equal(first.status, 200);
      assert.deepEqual((await first.json()).holdings[0].purchases, [{ date: buy.purchaseDate, shares: 2, price: 100 }]);
      portfolios.get(userId).holdings[0].price = 150;
      portfolios.get(userId).totalValue = 300;
      const second = await post("/api/holdings", { ...buy, averagePrice: 200, shares: 1, purchaseDate: "2024-01-31" });
      assert.equal(second.status, 200);
      const updated = await second.json();
      assert.equal(updated.holdings[0].shares, 3);
      assert.equal(updated.holdings[0].price, 150);
      assert.equal(updated.totalValue, 450);
      assert.equal(updated.holdings[0].purchases.length, 2);
      const reloaded = await fetch(`${baseUrl}/api/portfolio`, { headers: { "x-user-id": userId } });
      assert.deepEqual((await reloaded.json()).holdings[0].purchases, updated.holdings[0].purchases);
    });

    await t.test("portfolio goals are saved per account and returned with the portfolio", async () => {
      const response = await fetch(`${baseUrl}/api/portfolio/goal`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        body: JSON.stringify({ amount: 100000, monthlyContribution: 500 })
      });
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).goal, { amount: 100000, monthlyContribution: 500 });
      const portfolio = await fetch(`${baseUrl}/api/portfolio`, { headers: { "x-user-id": userId } });
      assert.deepEqual((await portfolio.json()).goal, { amount: 100000, monthlyContribution: 500 });

      const invalid = await fetch(`${baseUrl}/api/portfolio/goal`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        body: JSON.stringify({ amount: -1, monthlyContribution: 500 })
      });
      assert.equal(invalid.status, 400);
    });

    await t.test("holding API rejects missing, impossible, and future purchase dates", async () => {
      for (const purchaseDate of [undefined, "", "2024-02-30", "2023-02-29", "2024-13-01", "2999-01-01", "1899-12-31"]) {
        const response = await post("/api/holdings", { symbol: "AAPL", averagePrice: 100, shares: 1, purchaseDate });
        assert.equal(response.status, 400);
        assert.match((await response.json()).error, /purchase date/);
      }
    });

    await t.test("failed holding writes return JSON without changing the saved purchases", async () => {
      const before = structuredClone(portfolios.get(userId));
      failPortfolioWrites = true;
      const response = await post("/api/holdings", { symbol: "AAPL", averagePrice: 100, shares: 1, purchaseDate: "2024-02-29" });
      assert.equal(response.status, 500);
      assert.match((await response.json()).error, /Could not save holding/);
      assert.deepEqual(portfolios.get(userId), before);
      failPortfolioWrites = false;
    });

    await t.test("a failed signup write returns JSON and keeps the API running", async () => {
      failWrites = true;
      const response = await post("/api/auth/signup", { ...credentials, email: "other@example.com" });
      assert.equal(response.status, 500);
      assert.match((await response.json()).error, /Could not create your account/);
      assert.equal((await fetch(`${baseUrl}/api/health`)).status, 200);
    });
  } finally {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    t.mock.restoreAll();
    if (savedUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = savedUri;
    if (savedPort === undefined) delete process.env.PORT;
    else process.env.PORT = savedPort;
  }
});
