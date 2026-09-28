const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGODB_URI || "");
let portfolioCollection;
let usersCollection;

// Temporary in-memory data: replace with MongoDB models when persistence is added.
const portfolio = {
  owner: "Alex Morgan",
  totalValue: 128640.42,
  dailyChange: 1248.73,
  dailyChangePercent: 0.98,
  returns: 18.4,
  dividendYield: 1.84,
  riskScore: "Moderate",
  chart: [{ month: "Oct", value: 102400 }, { month: "Nov", value: 106800 }, { month: "Dec", value: 105100 }, { month: "Jan", value: 111400 }, { month: "Feb", value: 115600 }, { month: "Mar", value: 119300 }, { month: "Apr", value: 117900 }, { month: "May", value: 122500 }, { month: "Jun", value: 126100 }, { month: "Now", value: 128640 }],
  allocation: [{ name: "Technology", value: 38, color: "#6D5DFB" }, { name: "ETFs", value: 26, color: "#33C58D" }, { name: "Financials", value: 16, color: "#F0B34D" }, { name: "Healthcare", value: 12, color: "#F27E7E" }, { name: "Cash", value: 8, color: "#9AA4B2" }],
  holdings: [{ symbol: "AAPL", name: "Apple Inc.", shares: 82, price: 227.16, change: 1.21, allocation: 14.5 }, { symbol: "VOO", name: "Vanguard S&P 500 ETF", shares: 74, price: 522.49, change: 0.72, allocation: 30.1 }, { symbol: "MSFT", name: "Microsoft Corp.", shares: 54, price: 448.98, change: 1.48, allocation: 18.8 }, { symbol: "JPM", name: "JPMorgan Chase & Co.", shares: 65, price: 202.14, change: -0.34, allocation: 10.2 }]
};

app.get("/api/health", (_req, res) => res.json({ status: "ok", database: portfolioCollection ? "connected" : "not configured" }));
app.post("/api/auth/signup", async (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return res.status(400).json({ error: "Enter a name, valid email, and password of at least 8 characters." });
  if (await usersCollection.findOne({ email })) return res.status(409).json({ error: "An account with that email already exists." });
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = crypto.scryptSync(password, salt, 64).toString("hex");
  const userId = crypto.randomUUID();
  await usersCollection.insertOne({ _id: userId, name, email, passwordHash, salt, createdAt: new Date() });
  await portfolioCollection.insertOne({ _id: userId, owner: name, holdings: [], totalValue: 0, dailyChange: 0, dailyChangePercent: 0, returns: 0, dividendYield: 0, riskScore: "Moderate", chart: [], allocation: [] });
  res.status(201).json({ user: { id: userId, name, email } });
});

function userIdFromRequest(req) { return typeof req.headers["x-user-id"] === "string" ? req.headers["x-user-id"] : "default"; }

app.get("/api/portfolio", async (req, res) => {
  try {
    const saved = await portfolioCollection.findOne({ _id: userIdFromRequest(req) });
    res.json(saved ? { ...portfolio, ...saved, _id: undefined } : portfolio);
  } catch {
    res.status(500).json({ error: "Could not load portfolio." });
  }
});

const quoteCache = new Map();
const quoteCacheTtlMs = 60_000;
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

app.post("/api/holdings", async (req, res) => {
  const symbol = typeof req.body.symbol === "string" ? req.body.symbol.trim().toUpperCase() : "";
  const averagePrice = Number(req.body.averagePrice);
  const shares = Number(req.body.shares);
  if (!/^[A-Z0-9.-]{1,10}$/.test(symbol) || !Number.isFinite(averagePrice) || averagePrice <= 0 || !Number.isFinite(shares) || shares <= 0) {
    return res.status(400).json({ error: "Enter a valid ticker, average buy price, and share count." });
  }

  const saved = await portfolioCollection.findOne({ _id: userIdFromRequest(req) });
  const currentPortfolio = saved ? { ...portfolio, ...saved } : portfolio;
  const existing = currentPortfolio.holdings.find((holding) => holding.symbol === symbol);
  if (existing) {
    const totalShares = existing.shares + shares;
    existing.averagePrice = ((existing.averagePrice ?? existing.price) * existing.shares + averagePrice * shares) / totalShares;
    existing.price = existing.averagePrice;
    existing.shares = totalShares;
  } else {
    currentPortfolio.holdings.push({ symbol, name: symbol, shares, price: averagePrice, averagePrice, change: 0, allocation: 0 });
  }
  currentPortfolio.totalValue += averagePrice * shares;
  const holdingValues = currentPortfolio.holdings.map((holding) => holding.shares * holding.price);
  const totalHoldingsValue = holdingValues.reduce((sum, value) => sum + value, 0);
  currentPortfolio.holdings.forEach((holding, index) => {
    holding.allocation = totalHoldingsValue ? Number((holdingValues[index] / totalHoldingsValue * 100).toFixed(1)) : 0;
  });
  await portfolioCollection.replaceOne({ _id: userIdFromRequest(req) }, { ...currentPortfolio, _id: userIdFromRequest(req) }, { upsert: true });
  res.json(currentPortfolio);
});

async function startServer() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing from .env");
  await mongoClient.connect();
  const database = mongoClient.db("portfolio-analyzer");
  portfolioCollection = database.collection("portfolios");
  usersCollection = database.collection("users");
  app.listen(process.env.PORT || 4000, () => console.log("Portfolio API listening on http://localhost:4000"));
}

startServer().catch((error) => { console.error("MongoDB connection failed:", error); process.exit(1); });
