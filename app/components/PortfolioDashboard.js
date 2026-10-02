"use client";

import NavigationLink from "./NavigationLink";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { usePortfolio } from "./PortfolioProvider";

export const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const stockPrice = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function Sidebar({ owner }) {
  const pathname = usePathname();
  const [darkMode, setDarkMode] = useState(false);
  useEffect(() => {
    const saved = window.localStorage.getItem("darkMode") === "true";
    setDarkMode(saved);
    document.body.classList.toggle("dark-mode", saved);
  }, []);
  function toggleDarkMode() {
    const next = !darkMode;
    setDarkMode(next);
    window.localStorage.setItem("darkMode", String(next));
    document.body.classList.toggle("dark-mode", next);
  }
  const tabs = [
    { label: "Overview", icon: "\u2302", href: "/overview" },
    { label: "Budgeting", icon: "\u25c8", href: "/budgeting" },
    { label: "Goals", icon: "\u25ce", href: "/goals" }
  ];

  return (
    <aside className="sidebar">
      <NavigationLink className="brand brand-button" href="/overview" aria-label="Go to Overview"><i>{"\u2726"}</i><span>My Finances</span></NavigationLink>
      <nav>
        {tabs.map(({ label, icon, href }) => (
          <NavigationLink key={label} href={href} className={pathname === href ? "active" : ""} aria-current={pathname === href ? "page" : undefined}>
            <b>{icon}</b>{label}
          </NavigationLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="avatar">{owner.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div>
        <div><strong>{owner}</strong><small>Individual account</small></div>
        <span>{"\u2304"}</span>
      </div>
      <button className="theme-toggle" type="button" onClick={toggleDarkMode} aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"} title={darkMode ? "Light mode" : "Dark mode"} aria-pressed={darkMode}>
        <b>{darkMode ? "☀" : "☾"}</b>
      </button>
    </aside>
  );
}

export function MetricCard({ label, value, detail, positive }) {
  return (
    <article className="metric-card">
      <p>{label}</p><strong>{value}</strong>
      <span className={positive === false ? "negative" : positive ? "positive" : ""}>{detail}</span>
    </article>
  );
}

export function HoldingsTable({ holdings, invested, showAll = false }) {
  const { updateShares } = usePortfolio();
  const [editing, setEditing] = useState(null);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function saveShares(event) {
    event.preventDefault();
    if (isSaving) return;
    const rawShares = new FormData(event.currentTarget).get("shares");
    const shares = Number(rawShares);
    if (!String(rawShares).trim() || !Number.isFinite(shares) || shares < 0) {
      setFormError("Enter a valid share count of zero or more.");
      return;
    }
    setFormError("");
    setIsSaving(true);
    try {
      await updateShares(editing.symbol, shares);
      setEditing(null);
    } catch (error) {
      setFormError(error instanceof TypeError ? "Could not reach the server. Please try again." : error.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
    <article className="panel holdings">
      <div className="panel-title"><div><h2>{showAll ? "All holdings" : "Top holdings"}</h2><p>{money.format(invested)} across {holdings.length} positions</p></div>{!showAll && <NavigationLink href="/holdings" className="view-all">View all holdings {"\u2192"}</NavigationLink>}</div>
      <div className="holding-head"><span>ASSET</span><span>SHARES</span><span>LIVE PRICE</span><span>DAY</span><span>ALLOCATION</span></div>
      {holdings.map((holding, index) => (
        <div className="holding" key={holding.symbol}>
          <div className="asset"><em className={`logo logo-${index}`}>{holding.symbol.slice(0, 1)}</em><div><strong>{holding.symbol}</strong><span>{holding.name}</span></div></div>
          <span className="holding-shares">{holding.shares}<button type="button" className="edit-shares" aria-label={`Edit shares for ${holding.symbol}`} onClick={() => { setFormError(""); setEditing(holding); }}>Edit</button></span><span className="holding-price"><strong>{stockPrice.format(holding.price)}</strong><small>Avg. {stockPrice.format(holding.averagePrice ?? holding.price)}</small></span>
          <span className={holding.change < 0 ? "negative" : "positive"}>{holding.change > 0 ? "+" : ""}{holding.change}%</span>
          <span>{holding.allocation}%</span>
        </div>
      ))}
      {!holdings.length && <p className="subhead">No holdings yet. Add a stock from Overview to get started.</p>}
    </article>
    {editing && <div className="modal-backdrop" onMouseDown={(event) => { if (!isSaving && event.target === event.currentTarget) setEditing(null); }}>
      <section className="add-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-shares-title" onKeyDown={(event) => { if (event.key === "Escape" && !isSaving) setEditing(null); }}>
        <div className="panel-title"><div><h2 id="edit-shares-title">Edit {editing.symbol} shares</h2><p>Enter the total number of shares you own.</p></div><button type="button" className="dialog-close" aria-label="Close" disabled={isSaving} onClick={() => setEditing(null)}>{"\u00d7"}</button></div>
        <form onSubmit={saveShares}>
          <label>Shares owned<input name="shares" type="number" min="0" step="any" defaultValue={editing.shares} required autoFocus disabled={isSaving} /></label>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="dialog-actions"><button type="button" className="cancel-button" disabled={isSaving} onClick={() => setEditing(null)}>Cancel</button><button type="submit" className="add-button" disabled={isSaving}>{isSaving ? "Saving…" : "Save shares"}</button></div>
        </form>
      </section>
    </div>}
    </>
  );
}
