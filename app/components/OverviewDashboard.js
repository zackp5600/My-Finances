"use client";

import { useMemo, useState } from "react";
import { HoldingsTable, MetricCard, money } from "./PortfolioDashboard";
import { AllocationPanel, PerformancePanel } from "./ChartPanels";
import { usePortfolio } from "./PortfolioProvider";

export default function OverviewDashboard() {
  const { portfolio, setPortfolio, quoteStatus, history, liveHistory, historyStatus } = usePortfolio();
  const [range, setRange] = useState("LIVE");
  const [showAddForm, setShowAddForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSavingHolding, setIsSavingHolding] = useState(false);
  const invested = useMemo(
    () => portfolio.holdings.reduce((sum, holding) => sum + holding.shares * holding.price, 0),
    [portfolio]
  );

  async function addHolding(event) {
    event.preventDefault();
    if (isSavingHolding) return;
    const form = new FormData(event.currentTarget);
    const symbol = String(form.get("symbol")).trim().toUpperCase();
    const holding = { symbol, averagePrice: Number(form.get("averagePrice")), shares: Number(form.get("shares")), purchaseDate: String(form.get("purchaseDate")) };
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
              purchases: [...(item.purchases || []), { date: holding.purchaseDate, shares: holding.shares, price: holding.averagePrice }]
            })
          : [...current.holdings, { symbol, name: symbol, shares: holding.shares, price: holding.averagePrice, averagePrice: holding.averagePrice, change: 0, allocation: 0, purchases: [{ date: holding.purchaseDate, shares: holding.shares, price: holding.averagePrice }] }];
        const value = holdings.reduce((sum, item) => sum + item.price * item.shares, 0);
        return {
          ...current,
          totalValue: current.totalValue + (existing?.price ?? holding.averagePrice) * holding.shares,
          holdings: holdings.map((item) => ({ ...item, allocation: value ? Number((item.price * item.shares / value * 100).toFixed(1)) : 0 }))
        };
      });
      setShowAddForm(false);
    } finally {
      setIsSavingHolding(false);
    }
  }

  return (
    <>
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
            <label>Purchase date<input name="purchaseDate" type="date" min="1900-01-01" max={new Date().toISOString().slice(0, 10)} defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
            {formError && <p className="form-error" role="alert">{formError}</p>}
            <div className="dialog-actions"><button type="button" className="cancel-button" onClick={() => setShowAddForm(false)}>Cancel</button><button type="submit" className="add-button" disabled={isSavingHolding}>{isSavingHolding ? "Saving…" : "Save holding"}</button></div>
          </form>
        </section>
      </div>}
      <div className="tabs"><button className="selected">Overview</button><span>{quoteStatus} <i/></span></div>
      <section className="metrics">
        <MetricCard label="Portfolio value" value={money.format(portfolio.totalValue)} detail={`↑ ${money.format(portfolio.dailyChange)} today`} positive/>
        <MetricCard label="Total return" value={`+${portfolio.returns}%`} detail="Since inception" positive/>
        <MetricCard label="Dividend yield" value={`${portfolio.dividendYield}%`} detail="Est. $2,367 / year"/>
        <MetricCard label="Risk profile" value={portfolio.riskScore} detail="Well balanced"/>
      </section>
      <section className="grid-main">
        <PerformancePanel holdings={portfolio.holdings} history={history} liveHistory={liveHistory} quoteStatus={quoteStatus} historyStatus={historyStatus} range={range} onRangeChange={setRange}/>
        <AllocationPanel holdings={portfolio.holdings}/>
      </section>
      <HoldingsTable holdings={portfolio.holdings} invested={invested}/>
    </>
  );
}
