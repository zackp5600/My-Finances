"use client";

import { HoldingsTable } from "../../components/PortfolioDashboard";
import { usePortfolio } from "../../components/PortfolioProvider";

export default function HoldingsPage() {
  const { portfolio, quoteStatus } = usePortfolio();
  const invested = portfolio.holdings.reduce((sum, holding) => sum + holding.shares * holding.price, 0);
  return <>
    <header><div><p className="eyebrow">YOUR PORTFOLIO</p><h1>My Holdings</h1><p className="subhead">Manage the shares you own in each stock.</p></div></header>
    <div className="tabs"><button className="selected">Holdings</button><span>{quoteStatus} <i /></span></div>
    <HoldingsTable holdings={portfolio.holdings} invested={invested} showAll />
  </>;
}
