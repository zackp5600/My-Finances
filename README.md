# Northstar Portfolio Analyzer

A prototype for an individual investor to understand allocation, performance, income, and risk in one place.

## Stack

- Next.js + React for the dashboard
- Express for the API
- MongoDB is deliberately **not configured yet**; the API serves mock portfolio data for this prototype.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The API is available at `http://localhost:4000/api/portfolio`.

## Live holding quotes

The dashboard gets US stock quotes from Finnhub and refreshes them once a minute. Create a free Finnhub API key, copy `.env.example` to `.env`, and set `FINNHUB_API_KEY` there. Restart the dev server after adding the key. The key stays on the Express server; the browser calls the local quotes endpoint. Without a key, the dashboard keeps its sample prices and shows that live quotes are unavailable.

## Next steps

Add authentication and a MongoDB data layer when you are ready to store portfolios, transactions, and saved goals.

Repository: Portfolio-Analizer.
