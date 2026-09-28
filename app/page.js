"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AllocationPanel,
  HoldingsTable,
  MetricCard,
  money,
  PerformancePanel,
  Sidebar
} from "./components/PortfolioDashboard";

const fallbackPortfolio = {
  owner: "Alex Morgan",
  totalValue: 128640.42,
  dailyChange: 1248.73,
  dailyChangePercent: 0.98,
  returns: 18.4,
  dividendYield: 1.84,
  riskScore: "Moderate",
  chart: [
    { month: "Oct", value: 102400 }, { month: "Nov", value: 106800 }, { month: "Dec", value: 105100 },
    { month: "Jan", value: 111400 }, { month: "Feb", value: 115600 }, { month: "Mar", value: 119300 },
    { month: "Apr", value: 117900 }, { month: "May", value: 122500 }, { month: "Jun", value: 126100 }, { month: "Now", value: 128640 }
  ],
  allocation: [
    { name: "Technology", value: 38, color: "#6D5DFB" }, { name: "ETFs", value: 26, color: "#33C58D" },
    { name: "Financials", value: 16, color: "#F0B34D" }, { name: "Healthcare", value: 12, color: "#F27E7E" }, { name: "Cash", value: 8, color: "#9AA4B2" }
  ],
  holdings: [
    { symbol: "AAPL", name: "Apple Inc.", shares: 82, price: 227.16, change: 1.21, allocation: 14.5 },
    { symbol: "VOO", name: "Vanguard S&P 500 ETF", shares: 74, price: 522.49, change: 0.72, allocation: 30.1 },
    { symbol: "MSFT", name: "Microsoft Corp.", shares: 54, price: 448.98, change: 1.48, allocation: 18.8 },
    { symbol: "JPM", name: "JPMorgan Chase & Co.", shares: 65, price: 202.14, change: -0.34, allocation: 10.2 }
  ]
};

export default function Dashboard({ startJoined = false }) {
  const router = useRouter();
  const [portfolio, setPortfolio] = useState(fallbackPortfolio);
  const [activeTab, setActiveTab] = useState("Overview");
  const [range, setRange] = useState("1Y");
  const [showAddForm, setShowAddForm] = useState(false);
  const [hasJoined, setHasJoined] = useState(startJoined);
  const [formError, setFormError] = useState("");
  const [isSavingHolding, setIsSavingHolding] = useState(false);
  const [quoteStatus, setQuoteStatus] = useState("Loading quotes…");

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/portfolio`, { headers: { "x-user-id": window.localStorage.getItem("userId") || "default" } })
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then(setPortfolio)
      .catch(() => {});
  }, []);

  const symbols = portfolio.holdings.map((holding) => holding.symbol).join(",");
  useEffect(() => {
    let isCurrent = true;
    async function refreshQuotes() {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/quotes?symbols=${encodeURIComponent(symbols)}`);
        if (!response.ok) throw new Error("Live quotes unavailable");
        const { quotes } = await response.json();
        if (!isCurrent) return;
        setPortfolio((current) => {
          const holdings = current.holdings.map((holding) => {
            const quote = quotes[holding.symbol];
            return quote ? { ...holding, price: quote.price, change: quote.change } : holding;
          });
          const valueChange = holdings.reduce((change, holding, index) =>
            change + (holding.price - current.holdings[index].price) * holding.shares, 0);
          const holdingsValue = holdings.reduce((sum, holding) => sum + holding.price * holding.shares, 0);
          return {
            ...current,
            holdings: holdings.map((holding) => ({
              ...holding,
              allocation: holdingsValue ? Number((holding.price * holding.shares / holdingsValue * 100).toFixed(1)) : 0
            })),
            totalValue: current.totalValue + valueChange
          };
        });
        setQuoteStatus(`Live prices · ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
      } catch {
        if (isCurrent) setQuoteStatus("Live quotes unavailable");
      }
    }

    refreshQuotes();
    const interval = setInterval(refreshQuotes, 60_000);
    return () => { isCurrent = false; clearInterval(interval); };
  }, [symbols]);

  const invested = useMemo(
    () => portfolio.holdings.reduce((sum, holding) => sum + holding.shares * holding.price, 0),
    [portfolio]
  );

  async function addHolding(event) {
    event.preventDefault();
    if (isSavingHolding) return;
    const form = new FormData(event.currentTarget);
    const symbol = String(form.get("symbol")).trim().toUpperCase();
    const holding = { symbol, averagePrice: Number(form.get("averagePrice")), shares: Number(form.get("shares")) };
    setFormError("");
    setIsSavingHolding(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/holdings`, { method: "POST", headers: { "Content-Type": "application/json", "x-user-id": window.localStorage.getItem("userId") || "default" }, body: JSON.stringify(holding) });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Could not save holding.");
      }
      setPortfolio(await response.json());
      setShowAddForm(false);
    } catch (error) {
      if (error.message !== "Failed to fetch") {
        setFormError(error.message || "Could not save holding.");
        return;
      }
      // Keep the dashboard usable when the optional API server is offline.
      // The average buy price is the best available price until a live quote arrives.
      setPortfolio((current) => {
        const existing = current.holdings.find((item) => item.symbol === symbol);
        const holdings = existing
          ? current.holdings.map((item) => item.symbol !== symbol ? item : {
              ...item,
              shares: item.shares + holding.shares,
              averagePrice: (((item.averagePrice ?? item.price) * item.shares) + holding.averagePrice * holding.shares) / (item.shares + holding.shares),
              price: (((item.averagePrice ?? item.price) * item.shares) + holding.averagePrice * holding.shares) / (item.shares + holding.shares)
            })
          : [...current.holdings, { symbol, name: symbol, shares: holding.shares, price: holding.averagePrice, averagePrice: holding.averagePrice, change: 0, allocation: 0 }];
        const value = holdings.reduce((sum, item) => sum + item.price * item.shares, 0);
        return {
          ...current,
          totalValue: current.totalValue + holding.averagePrice * holding.shares,
          holdings: holdings.map((item) => ({ ...item, allocation: value ? Number((item.price * item.shares / value * 100).toFixed(1)) : 0 }))
        };
      });
      setShowAddForm(false);
    } finally {
      setIsSavingHolding(false);
    }
  }

  if (!hasJoined) {
    return (
      <main className="landing-page">
        <div className="landing-orb landing-orb-one" />
        <div className="landing-orb landing-orb-two" />
        <nav className="landing-nav" aria-label="Main navigation">
          <a className="landing-brand" href="#top"><i>✦</i> My Finances </a>
          <span>Invest with clarity</span>
        </nav>
        <section className="landing-hero" id="top">
          <p className="landing-eyebrow">YOUR FINANCIAL COMPASS</p>
          <h1>See where your<br /><em>money can go.</em></h1>
          <p className="landing-copy">A calm, clear home for every investment decision you make.</p>
          <button className="join-button" type="button" onClick={() => router.push("/signup")}>Control Your Finances <span>→</span></button>
          {/* <p className="landing-note">Start building your portfolio today</p> */}
        </section>
        <div className="landing-stats" aria-label="Platform highlights">
          {/* <div><strong>$2.4B</strong><span>assets tracked</span></div>
          <div><strong>48k</strong><span>investors growing</span></div>
          <div><strong>4.9/5</strong><span>member rating</span></div> */}
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <Sidebar owner={portfolio.owner} activeTab={activeTab} onTabChange={setActiveTab}/>
      <section className="content">
        {activeTab !== "Overview" ? <div className="placeholder-page"><h1>{activeTab}</h1></div> : <>
        <header>
          <div><p className="eyebrow">WELCOME BACK</p><h1>Good morning, {portfolio.owner.split(" ")[0]}.</h1><p className="subhead">Here’s how your money is working for you.</p></div>
          <button className="add-button" type="button" onClick={() => { setFormError(""); setShowAddForm(true); }}>+ Add holdings</button>
        </header>
        {showAddForm && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAddForm(false); }}>
          <section className="add-dialog" role="dialog" aria-modal="true" aria-labelledby="add-title">
            <div className="panel-title"><div><h2 id="add-title">Add a holding</h2><p>Enter the details of your buy order.</p></div><button type="button" className="dialog-close" aria-label="Close" onClick={() => setShowAddForm(false)}>×</button></div>
            <form onSubmit={addHolding}>
              <label>Ticker symbol<input name="symbol" placeholder="e.g. AAPL" required maxLength={10} pattern="[A-Za-z0-9.\-]+" autoFocus /></label>
              <label>Average buy price<input name="averagePrice" type="number" min="0.01" step="0.01" placeholder="0.00" required /></label>
              <label>Shares purchased<input name="shares" type="number" min="0.000001" step="any" placeholder="0" required /></label>
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <div className="dialog-actions"><button type="button" className="cancel-button" onClick={() => setShowAddForm(false)}>Cancel</button><button type="submit" className="add-button" disabled={isSavingHolding}>{isSavingHolding ? "Saving…" : "Save holding"}</button></div>
            </form>
          </section>
        </div>}
        <div className="tabs"><button className="selected">{activeTab}</button><span>{quoteStatus} <i/></span></div>
        <section className="metrics">
          <MetricCard label="Portfolio value" value={money.format(portfolio.totalValue)} detail={`↑ ${money.format(portfolio.dailyChange)} today`} positive/>
          <MetricCard label="Total return" value={`+${portfolio.returns}%`} detail="Since inception" positive/>
          <MetricCard label="Dividend yield" value={`${portfolio.dividendYield}%`} detail="Est. $2,367 / year"/>
          <MetricCard label="Risk profile" value={portfolio.riskScore} detail="Well balanced"/>
        </section>
        <section className="grid-main">
          <PerformancePanel portfolio={portfolio} range={range} onRangeChange={setRange}/>
          <AllocationPanel allocation={portfolio.allocation}/>
        </section>
        <HoldingsTable holdings={portfolio.holdings} invested={invested}/>
        </>}
      </section>
    </main>
  );
}
