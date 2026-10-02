# My Finances

A prototype for an individual to understand there financial position and ways to improve and reach financial goals

## Stack

- Next.js + React for the dashboard
- Express for the API
- MongoDB stores accounts, portfolios, and holdings history.

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:3000`. The API is available at `http://localhost:4000/api/portfolio`.

Set `MONGODB_URI` in `.env` to a running local MongoDB instance or your Atlas connection string. For Atlas, add your current IP address under Network Access. `npm run dev` starts both the website and API; `npm run dev:web` starts only the website. The API stays reachable and retries every ten seconds if MongoDB cannot connect; account and portfolio requests return an explicit database-unavailable error until it connects. Check `http://localhost:4000/api/health` for the database status.

Development uses Turbopack to compile routes. The first visit to each route can still pause while Next.js compiles it; automatic link prefetching runs in production. To check navigation speed without development compilation, run `npm run build`, then `npm start`. Run `npm run dev:api` in another terminal if you also need account creation and portfolio persistence.

The landing page loads independently of the dashboard. Dashboard routes share a persistent sidebar and portfolio state, so switching sections does not reset the theme or refetch the portfolio. Charts load separately on Overview, and links prefetch their destination pages in production.

## Live holding quotes

The dashboard gets US stock quotes from Finnhub and refreshes them once a minute. Create a free Finnhub API key, copy `.env.example` to `.env`, and set `FINNHUB_API_KEY` there. Restart the dev server after adding the key. The key stays on the Express server; the browser calls the local quotes endpoint. Without a key, the dashboard keeps its sample prices and shows that live quotes are unavailable.

## Holdings charts

The allocation donut uses each holding's share count and current price. Add holdings with a purchase date (today or earlier); each buy is saved separately, including repeat purchases of the same ticker. The chart's green Amount invested line starts at the first dated purchase and adds each buy's shares times buy price. Legacy holdings without purchase dates do not contribute to this line. Editing the current share count does not rewrite past purchases.

The purple Holdings value line records one snapshot per UTC day in MongoDB's `portfolio-history` collection, using the most recently fetched quote or the saved price if no quote is available. Today's snapshot refreshes when holdings or prices change; previous days stay unchanged. Date range buttons filter the combined purchase and snapshot timeline. Historical market values are not inferred from purchase dates. Share additions and edits affect the value, so this chart does not represent investment returns.

Overview opens on a Live view that plots portfolio values actually observed from Finnhub quote refreshes, about once per minute. Today's observed points are kept in this browser and reset when the holdings or share counts change. The Live chart waits for real quote changes, so it can show only one point shortly after opening or remain flat when prices do not move. The longer ranges continue to use daily recorded values.

Run the chart checks with `node --test tests/portfolio-charts.test.mjs`.

## Portfolio goals

The Goals page saves a portfolio value target and optional monthly contribution with the account. It shows the current dollar gap and an illustrative time range using 4% and 8% annual growth compounded monthly, with contributions at the end of each month. These are assumptions, not expected returns; fees, taxes, inflation, and market losses are not modeled.

## Next steps

Add session authentication and transactions.

Repository: Portfolio-Analizer.
