const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const crypto = require("crypto");
const { promisify } = require("util");
const { recordHoldingsValue } = require("./portfolio-history");

const scrypt = promisify(crypto.scrypt);

const app = express();
app.use(cors());
app.use(express.json());

let mongoClient;
let databaseStatus = "connecting";
let portfolioCollection;
let usersCollection;
let portfolioHistoryCollection;

// Temporary in-memory data: replace with MongoDB models when persistence is added.
// const portfolio = {
//   owner: "Alex Morgan",
//   totalValue: 128640.42,
//   dailyChange: 1248.73,
//   dailyChangePercent: 0.98,
//   returns: 18.4,
//   dividendYield: 1.84,
//   riskScore: "Moderate",
//   chart: [{ month: "Oct", value: 102400 }, { month: "Nov", value: 106800 }, { month: "Dec", value: 105100 }, { month: "Jan", value: 111400 }, { month: "Feb", value: 115600 }, { month: "Mar", value: 119300 }, { month: "Apr", value: 117900 }, { month: "May", value: 122500 }, { month: "Jun", value: 126100 }, { month: "Now", value: 128640 }],
//   allocation: [{ name: "Technology", value: 38, color: "#6D5DFB" }, { name: "ETFs", value: 26, color: "#33C58D" }, { name: "Financials", value: 16, color: "#F0B34D" }, { name: "Healthcare", value: 12, color: "#F27E7E" }, { name: "Cash", value: 8, color: "#9AA4B2" }],
//   holdings: [{ symbol: "AAPL", name: "Apple Inc.", shares: 82, price: 227.16, change: 1.21, allocation: 14.5 }, { symbol: "VOO", name: "Vanguard S&P 500 ETF", shares: 74, price: 522.49, change: 0.72, allocation: 30.1 }, { symbol: "MSFT", name: "Microsoft Corp.", shares: 54, price: 448.98, change: 1.48, allocation: 18.8 }, { symbol: "JPM", name: "JPMorgan Chase & Co.", shares: 65, price: 202.14, change: -0.34, allocation: 10.2 }]
// };

app.get("/api/health", (_req, res) => res.json({ status: "ok", database: databaseStatus }));
app.use("/api", (req, res, next) => {
  if (req.path === "/quotes" || databaseStatus === "connected") return next();
  res.status(503).json({ error: "The database is unavailable. Please try again shortly. If this continues, check the server's MongoDB connection and Atlas Network Access settings." });
});
app.post("/api/auth/signup", async (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return res.status(400).json({ error: "Enter a name, valid email, and password of at least 8 characters." });
  try {
    if (await usersCollection.findOne({ email })) return res.status(409).json({ error: "An account with that email already exists." });
    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = (await scrypt(password, salt, 64)).toString("hex");
    const userId = crypto.randomUUID();
    await usersCollection.insertOne({ _id: userId, name, email, passwordHash, salt, createdAt: new Date() });
    await portfolioCollection.insertOne({ _id: userId, owner: name, holdings: [], totalValue: 0, dailyChange: 0, dailyChangePercent: 0, returns: 0, dividendYield: 0, riskScore: "Moderate", chart: [], allocation: [] });
    res.status(201).json({ user: { id: userId, name, email } });
  } catch (error) {
    console.error("Signup failed:", error.name);
    res.status(500).json({ error: "Could not create your account right now. Please try again." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!/^\S+@\S+\.\S+$/.test(email) || !password) {
    return res.status(400).json({ error: "Enter a valid email and password." });
  }

  try {
    const user = await usersCollection.findOne({ email });
    const hasCredentials = user && typeof user.salt === "string" && typeof user.passwordHash === "string";
    const suppliedHash = await scrypt(password, hasCredentials ? user.salt : "invalid-account", 64);
    const savedHash = hasCredentials ? Buffer.from(user.passwordHash, "hex") : Buffer.alloc(64);
    if (!hasCredentials || savedHash.length !== suppliedHash.length || !crypto.timingSafeEqual(suppliedHash, savedHash)) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }

    res.json({ user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    console.error("Login failed:", error);
    res.status(500).json({ error: "Could not log in right now. Please try again." });
  }
});

function userIdFromRequest(req) { return typeof req.headers["x-user-id"] === "string" ? req.headers["x-user-id"] : "default"; }

app.get("/api/portfolio", async (req, res) => {
  try {
    const saved = await portfolioCollection.findOne({ _id: userIdFromRequest(req) });
    if (!saved) return res.status(404).json({ error: "Portfolio not found." });
    res.json({ ...saved, _id: undefined });
  } catch {
    res.status(500).json({ error: "Could not load portfolio." });
  }
});

app.patch("/api/portfolio/goal", async (req, res) => {
  const { amount, monthlyContribution } = req.body || {};
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000_000
    || typeof monthlyContribution !== "number" || !Number.isFinite(monthlyContribution)
    || monthlyContribution < 0 || monthlyContribution > 1_000_000_000) {
    return res.status(400).json({ error: "Enter a valid goal amount and monthly contribution." });
  }
  try {
    const result = await portfolioCollection.updateOne(
      { _id: userIdFromRequest(req) },
      { $set: { goal: { amount, monthlyContribution } } }
    );
    if (!result.matchedCount) return res.status(404).json({ error: "Portfolio not found." });
    res.json({ goal: { amount, monthlyContribution } });
  } catch {
    res.status(500).json({ error: "Could not save goal. Please try again." });
  }
});

const quoteCache = new Map();
const quoteCacheTtlMs = 60_000;
app.post("/api/portfolio/history", async (req, res) => {
  try {
    const userId = userIdFromRequest(req);
    const saved = await portfolioCollection.findOne({ _id: userId });
    if (!saved) return res.status(404).json({ error: "Portfolio not found." });
    const current = saved;
    const history = await recordHoldingsValue(portfolioHistoryCollection, userId, current.holdings, quoteCache);
    res.json({ history });
  } catch {
    res.status(500).json({ error: "Could not record holdings history." });
  }
});

app.get("/api/quotes", async (req, res) => {
  const symbols = [...new Set(String(req.query.symbols || "")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => /^[A-Z0-9.-]{1,10}$/.test(symbol)))];
  if (!symbols.length) return res.status(400).json({ error: "Provide at least one valid ticker symbol." });
  if (!process.env.FINNHUB_API_KEY) {
    return res.status(503).json({ error: "Live quotes are not configured. Add FINNHUB_API_KEY to the server environment." });
  }

  try {
    const quotes = await Promise.all(symbols.map(async (symbol) => {
      const cached = quoteCache.get(symbol);
      if (cached && Date.now() - cached.fetchedAt < quoteCacheTtlMs) return [symbol, cached.quote];

      const url = new URL("https://finnhub.io/api/v1/quote");
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("token", process.env.FINNHUB_API_KEY);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Quote provider returned ${response.status}.`);
      const quote = await response.json();
      if (!Number.isFinite(quote.c) || quote.c <= 0 || !Number.isFinite(quote.dp)) {
        if (cached) return [symbol, cached.quote];
        return [symbol, null];
      }
      const normalized = { price: quote.c, change: quote.dp, previousClose: quote.pc, timestamp: quote.t };
      quoteCache.set(symbol, { quote: normalized, fetchedAt: Date.now() });
      return [symbol, normalized];
    }));
    res.json({ quotes: Object.fromEntries(quotes), source: "Finnhub", fetchedAt: new Date().toISOString() });
  } catch (error) {
    res.status(502).json({ error: "Could not retrieve live stock quotes." });
  }
});

app.patch("/api/holdings/:symbol", async (req, res) => {
  const symbol = req.params.symbol.trim().toUpperCase();
  const shares = req.body.shares;
  if (!/^[A-Z0-9.-]{1,10}$/.test(symbol) || typeof shares !== "number" || !Number.isFinite(shares) || shares < 0) {
    return res.status(400).json({ error: "Enter a valid share count of zero or more." });
  }

  try {
    const userId = userIdFromRequest(req);
    const saved = await portfolioCollection.findOne({ _id: userId });
    if (!saved) return res.status(404).json({ error: "Portfolio not found." });
    const currentPortfolio = saved;
    const existing = currentPortfolio.holdings.find((holding) => holding.symbol === symbol);
    if (!existing) return res.status(404).json({ error: "This holding could not be found." });

    const holdings = currentPortfolio.holdings.map((holding) => holding.symbol === symbol ? { ...holding, shares } : { ...holding });
    const totalHoldingsValue = holdings.reduce((sum, holding) => sum + holding.price * holding.shares, 0);
    const updated = {
      ...currentPortfolio,
      totalValue: currentPortfolio.totalValue + (shares - existing.shares) * existing.price,
      holdings: holdings.map((holding) => ({
        ...holding,
        allocation: totalHoldingsValue ? Number((holding.price * holding.shares / totalHoldingsValue * 100).toFixed(1)) : 0
      }))
    };
    await portfolioCollection.replaceOne({ _id: userId }, { ...updated, _id: userId }, { upsert: true });
    res.json({ symbol, shares });
  } catch {
    res.status(500).json({ error: "Could not save share count. Please try again." });
  }
});

app.post("/api/holdings", async (req, res) => {
  const symbol = typeof req.body.symbol === "string" ? req.body.symbol.trim().toUpperCase() : "";
  const averagePrice = Number(req.body.averagePrice);
  const shares = Number(req.body.shares);
  const purchaseDate = req.body.purchaseDate;
  if (!/^[A-Z0-9.-]{1,10}$/.test(symbol) || !Number.isFinite(averagePrice) || averagePrice <= 0 || !Number.isFinite(shares) || shares <= 0) {
    return res.status(400).json({ error: "Enter a valid ticker, average buy price, and share count." });
  }
  if (typeof purchaseDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)
    || !Number.isFinite(Date.parse(purchaseDate)) || new Date(purchaseDate).toISOString().slice(0, 10) !== purchaseDate
    || purchaseDate < "1900-01-01" || purchaseDate > new Date().toISOString().slice(0, 10)) {
    return res.status(400).json({ error: "Choose a valid purchase date that is not in the future." });
  }

  try {
    const saved = await portfolioCollection.findOne({ _id: userIdFromRequest(req) });
    if (!saved) return res.status(404).json({ error: "Portfolio not found." });
    const source = saved;
    const currentPortfolio = { ...source, holdings: source.holdings.map((holding) => ({ ...holding })) };
    const existing = currentPortfolio.holdings.find((holding) => holding.symbol === symbol);
    if (existing) {
      const totalShares = existing.shares + shares;
      existing.averagePrice = ((existing.averagePrice ?? existing.price) * existing.shares + averagePrice * shares) / totalShares;
      existing.shares = totalShares;
      existing.purchases = [...(existing.purchases || []), { date: purchaseDate, shares, price: averagePrice }];
    } else {
      currentPortfolio.holdings.push({ symbol, name: symbol, shares, price: averagePrice, averagePrice, change: 0, allocation: 0, purchases: [{ date: purchaseDate, shares, price: averagePrice }] });
    }
    currentPortfolio.totalValue += (existing?.price ?? averagePrice) * shares;
    const holdingValues = currentPortfolio.holdings.map((holding) => holding.shares * holding.price);
    const totalHoldingsValue = holdingValues.reduce((sum, value) => sum + value, 0);
    currentPortfolio.holdings.forEach((holding, index) => {
      holding.allocation = totalHoldingsValue ? Number((holdingValues[index] / totalHoldingsValue * 100).toFixed(1)) : 0;
    });
    await portfolioCollection.replaceOne({ _id: userIdFromRequest(req) }, { ...currentPortfolio, _id: userIdFromRequest(req) }, { upsert: true });
    res.json(currentPortfolio);
  } catch (error) {
    console.error("Could not save holding:", error.name);
    res.status(500).json({ error: "Could not save holding. Please try again." });
  }
});

async function connectDatabase() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing from .env");
  if (!mongoClient) mongoClient = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
  await mongoClient.connect();
  const database = mongoClient.db("portfolio-analyzer");
  portfolioCollection = database.collection("portfolios");
  usersCollection = database.collection("users");
  portfolioHistoryCollection = database.collection("portfolio-history");
  databaseStatus = "connected";
  console.log("MongoDB connected.");
}

function startServer() {
  const port = process.env.PORT || 4000;
  const server = app.listen(port, () => console.log(`Portfolio API listening on http://localhost:${server.address().port}`));
  let retryTimer;
  let stopped = false;
  async function connect() {
    try {
      await connectDatabase();
    } catch (error) {
      databaseStatus = "unavailable";
      console.error(`MongoDB connection failed (${error.name}). Check MONGODB_URI and Atlas Network Access settings.`);
      if (!stopped) retryTimer = setTimeout(connect, 10000);
    }
  }
  server.on("close", () => {
    stopped = true;
    clearTimeout(retryTimer);
    mongoClient?.close().catch(() => {});
  });
  void connect();
  return server;
}

if (require.main === module) startServer();
module.exports = { app, startServer, connectDatabase };
