"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
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
    { label: "Holdings", icon: "\u25c8", href: "/holdings" },
    { label: "Activity", icon: "\u2197", href: "/activity" },
    { label: "Insights", icon: "\u25cc", href: "/insights" }
  ];

  return (
    <aside className="sidebar">
      <Link className="brand brand-button" href="/overview" aria-label="Go to Overview"><i>{"\u2726"}</i><span>My Finances</span></Link>
      <nav>
        {tabs.map(({ label, icon, href }) => (
          <Link key={label} href={href} className={pathname === href ? "active" : ""}>
            <b>{icon}</b>{label}
          </Link>
        ))}
      </nav>
      <button className="theme-toggle" type="button" onClick={toggleDarkMode} aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"} title={darkMode ? "Light mode" : "Dark mode"} aria-pressed={darkMode}>
        <b>{darkMode ? "☀" : "☾"}</b>
      </button>
      <div className="sidebar-bottom">
        <div className="avatar">{owner.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div>
        <div><strong>{owner}</strong><small>Individual account</small></div>
        <span>{"\u2304"}</span>
      </div>
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

export function PerformancePanel({ portfolio, range, onRangeChange }) {
  const ranges = ["1M", "3M", "6M", "1Y", "ALL"];

  return (
    <article className="panel performance">
      <div className="panel-title">
        <div><h2>Portfolio performance</h2><p>{money.format(portfolio.totalValue)} <span className="positive">+{portfolio.dailyChangePercent}%</span></p></div>
        <div className="range-picker">
          {ranges.map((item) => (
            <button onClick={() => onRangeChange(item)} className={range === item ? "range-active" : ""} key={item}>{item}</button>
          ))}
        </div>
      </div>
      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={portfolio.chart}>
            <defs><linearGradient id="portfolioFill" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="#6d5dfb" stopOpacity={.28}/><stop offset="95%" stopColor="#6d5dfb" stopOpacity={0}/></linearGradient></defs>
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#87909e", fontSize: 12 }} dy={12}/>
            <YAxis hide domain={[95000, 135000]}/>
            <Tooltip formatter={(value) => money.format(value)} contentStyle={{ borderRadius: 10, border: "1px solid #e7e8ed" }}/>
            <Area type="monotone" dataKey="value" stroke="#6d5dfb" strokeWidth={3} fill="url(#portfolioFill)"/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

export function AllocationPanel({ allocation }) {
  return (
    <article className="panel allocation">
      <div className="panel-title"><div><h2>Asset allocation</h2><p>By sector</p></div><button className="dots" aria-label="More allocation options">•••</button></div>
      <div className="allocation-body">
        <div className="donut">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart><Pie data={allocation} dataKey="value" innerRadius={52} outerRadius={73} paddingAngle={3} stroke="none">{allocation.map((slice) => <Cell key={slice.name} fill={slice.color}/>)}</Pie></PieChart>
          </ResponsiveContainer>
          <div><strong>100%</strong><span>Invested</span></div>
        </div>
        <div className="legend">{allocation.slice(0, 4).map((item) => <p key={item.name}><i style={{ background: item.color }}/>{item.name}<b>{item.value}%</b></p>)}</div>
      </div>
    </article>
  );
}

export function HoldingsTable({ holdings, invested }) {
  return (
    <article className="panel holdings">
      <div className="panel-title"><div><h2>Top holdings</h2><p>{money.format(invested)} across {holdings.length} positions</p></div><button className="view-all">View all holdings {"\u2192"}</button></div>
      <div className="holding-head"><span>ASSET</span><span>SHARES</span><span>LIVE PRICE</span><span>DAY</span><span>ALLOCATION</span></div>
      {holdings.map((holding, index) => (
        <div className="holding" key={holding.symbol}>
          <div className="asset"><em className={`logo logo-${index}`}>{holding.symbol.slice(0, 1)}</em><div><strong>{holding.symbol}</strong><span>{holding.name}</span></div></div>
          <span>{holding.shares}</span><span className="holding-price"><strong>{money.format(holding.price)}</strong><small>Avg. {money.format(holding.averagePrice ?? holding.price)}</small></span>
          <span className={holding.change < 0 ? "negative" : "positive"}>{holding.change > 0 ? "+" : ""}{holding.change}%</span>
          <span>{holding.allocation}%</span>
        </div>
      ))}
    </article>
  );
}
