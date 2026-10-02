"use client";

import { Area, ComposedChart, Legend, Line, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { money } from "./PortfolioDashboard";
import { historyForRange, holdingsAllocation, purchaseTimeline } from "./portfolio-charts.mjs";

const liveMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

function dateLabel(date) {
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

function timeLabel(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function PerformancePanel({ holdings, history, liveHistory, quoteStatus, historyStatus, range, onRangeChange }) {
  const ranges = ["LIVE", "1M", "3M", "6M", "1Y", "ALL"];
  const isLive = range === "LIVE";
  const timeline = purchaseTimeline(history, holdings);
  const data = isLive ? liveHistory : historyForRange(timeline, range);
  const hasPurchases = timeline.some((point) => point.invested !== undefined);
  const value = holdings.reduce((sum, holding) => sum + holding.price * holding.shares, 0);
  return (
    <article className="panel performance">
      <div className="panel-title">
        <div><h2>{isLive ? "Live holdings value" : "Holdings value"}</h2><p>{money.format(value)} in stocks and funds</p></div>
        <div className="range-picker" aria-label="Chart date range">
          {ranges.map((item) => <button type="button" onClick={() => onRangeChange(item)} aria-pressed={range === item} className={range === item ? "range-active" : ""} key={item}>{item}</button>)}
        </div>
      </div>
      <div className="chart">
        {data.length ? <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 15, right: 20, bottom: 15, left: 10 }}>
            <defs><linearGradient id="portfolioFill" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="#6d5dfb" stopOpacity={.28}/><stop offset="95%" stopColor="#6d5dfb" stopOpacity={0}/></linearGradient></defs>
            <XAxis dataKey="timestamp" type="number" domain={["dataMin", "dataMax"]} scale="time" tickFormatter={isLive ? timeLabel : dateLabel} axisLine={false} tickLine={false} tick={{ fill: "#87909e", fontSize: 11 }} minTickGap={25}/>
            <YAxis width={isLive ? 82 : 65} domain={isLive ? ["auto", "auto"] : [0, "auto"]} tickFormatter={(amount) => isLive ? liveMoney.format(amount) : money.format(amount)} axisLine={false} tickLine={false} tick={{ fill: "#87909e", fontSize: 10 }}/>
            <Tooltip labelFormatter={isLive ? timeLabel : dateLabel} formatter={(amount, name) => [isLive ? liveMoney.format(amount) : money.format(amount), name]} contentStyle={{ borderRadius: 10, border: "1px solid #e7e8ed" }}/>
            <Area isAnimationActive={false} type="linear" dataKey="value" name="Holdings value" connectNulls stroke="#6d5dfb" strokeWidth={3} fill="url(#portfolioFill)" dot={data.filter((point) => Number.isFinite(point.value)).length === 1 ? { r: 5 } : false}/>
            {!isLive && hasPurchases && <Line isAnimationActive={false} type="stepAfter" dataKey="invested" name="Amount invested" stroke="#33C58D" strokeWidth={2} dot={false}/>}
            {!isLive && hasPurchases && <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }}/>}
          </ComposedChart>
        </ResponsiveContainer> : <p className="chart-empty">{isLive ? quoteStatus === "Live quotes unavailable" ? "Live prices are unavailable. Check the Finnhub API key and connection." : holdings.length ? "Waiting for a live price update. New price changes will appear here as they arrive." : "Add a holding to track live price changes." : historyStatus === "loading" ? "Loading holdings history…" : historyStatus === "error" ? "Could not load holdings history. Check the API connection." : "No recorded values in this date range."}</p>}
      </div>
      <p className="chart-note">{isLive ? "Live shows real quote changes observed about once a minute while the dashboard is open. It starts with the first available quote and keeps today's observations on this device; unchanged prices do not create new points." : "Amount invested follows your dated purchases at buy prices. Holdings value uses recorded daily prices since you started tracking. Share edits change current value, not past purchases."}</p>
      {!isLive && data.length > 0 && historyStatus === "error" && <p className="form-error" role="status">History could not refresh. Showing the last recorded values.</p>}
    </article>
  );
}

export function AllocationPanel({ holdings }) {
  const allocation = holdingsAllocation(holdings);
  return (
    <article className="panel allocation">
      <div className="panel-title"><div><h2>Asset allocation</h2><p>By holding value</p></div></div>
      {allocation.length ? <div className="allocation-body">
        <div className="donut">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart><Pie isAnimationActive={false} data={allocation} nameKey="name" dataKey="value" innerRadius={52} outerRadius={73} paddingAngle={allocation.length > 1 ? 3 : 0} stroke="none">
              {allocation.map((slice) => <Cell key={slice.name} fill={slice.color}/>)}
            </Pie><Tooltip formatter={(amount, name) => [money.format(amount), name]} contentStyle={{ borderRadius: 10, border: "1px solid #e7e8ed" }}/></PieChart>
          </ResponsiveContainer>
          <div><strong>100%</strong><span>Holdings</span></div>
        </div>
        <div className="legend">{allocation.map((item) => <p key={item.name}><i style={{ background: item.color }}/>{item.name}<b>{item.percent.toFixed(1)}%</b></p>)}</div>
      </div> : <p className="chart-empty">Add holdings to see your allocation.</p>}
    </article>
  );
}
