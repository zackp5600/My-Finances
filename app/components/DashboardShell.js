"use client";

import { Sidebar } from "./PortfolioDashboard";
import { usePortfolio } from "./PortfolioProvider";

export default function DashboardShell({ children }) {
  const { portfolio } = usePortfolio();
  return (
    <main className="shell">
      <Sidebar owner={portfolio.owner} />
      <section className="content">{children}</section>
    </main>
  );
}
