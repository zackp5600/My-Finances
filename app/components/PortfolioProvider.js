"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { fallbackPortfolio } from "./portfolio-fixture";
import { appendLiveQuote } from "./portfolio-charts.mjs";

const PortfolioContext = createContext(null);
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function PortfolioProvider({ children }) {
  const [portfolio, setPortfolio] = useState(fallbackPortfolio);
  const [portfolioLoaded, setPortfolioLoaded] = useState(false);
  const [portfolioLoadError, setPortfolioLoadError] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyStatus, setHistoryStatus] = useState("loading");
  const [liveState, setLiveState] = useState({ signature: "", points: [] });
  const [quoteObservation, setQuoteObservation] = useState(null);
  const recordedObservation = useRef(null);
  const [quoteStatus, setQuoteStatus] = useState("Loading quotes…");

  // The shared layout retains this data when dashboard routes change.
  useEffect(() => {
    const controller = new AbortController();
    let isCurrent = true;
    const timeout = setTimeout(() => controller.abort(), 10_000);
    fetch(`${apiUrl}/api/portfolio`, {
      headers: { "x-user-id": window.localStorage.getItem("userId") || "default" },
      signal: controller.signal
    })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((result) => { if (isCurrent) setPortfolio(result); })
      .catch(() => { if (isCurrent) setPortfolioLoadError(true); })
      .finally(() => {
        clearTimeout(timeout);
        if (isCurrent) setPortfolioLoaded(true);
      });
    return () => { isCurrent = false; clearTimeout(timeout); controller.abort(); };
  }, []);

  const symbols = portfolio.holdings.map((holding) => holding.symbol).join(",");
  const holdingsSignature = JSON.stringify(portfolio.holdings.map(({ symbol, shares }) => [symbol, shares]));
  const liveHistory = liveState.signature === holdingsSignature ? liveState.points : [];

  useEffect(() => {
    if (!portfolioLoaded) return;
    const storageKey = `portfolio-live:${window.localStorage.getItem("userId") || "default"}`;
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || "null");
      const today = new Date().toISOString().slice(0, 10);
      const points = saved?.day === today && saved.signature === holdingsSignature && Array.isArray(saved.points)
        ? saved.points.filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.value) && point.value >= 0).slice(-400)
        : [];
      setLiveState({ signature: holdingsSignature, points });
    } catch {
      setLiveState({ signature: holdingsSignature, points: [] });
    }
  }, [portfolioLoaded, holdingsSignature]);

  useEffect(() => {
    if (!portfolioLoaded || liveState.signature !== holdingsSignature) return;
    const storageKey = `portfolio-live:${window.localStorage.getItem("userId") || "default"}`;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({
        day: new Date().toISOString().slice(0, 10), signature: holdingsSignature, points: liveState.points
      }));
    } catch { /* Storage can be disabled; the live chart still works for this visit. */ }
  }, [portfolioLoaded, holdingsSignature, liveState]);

  useEffect(() => {
    if (!quoteObservation || recordedObservation.current === quoteObservation
      || quoteObservation.symbols !== symbols || !portfolioLoaded) return;
    recordedObservation.current = quoteObservation;
    const value = portfolio.holdings.reduce((sum, holding) => sum + holding.price * holding.shares, 0);
    setLiveState((current) => {
      const points = current.signature === holdingsSignature ? current.points : [];
      const next = appendLiveQuote(points, { timestamp: quoteObservation.timestamp, value });
      if (current.signature === holdingsSignature && next.length === points.length
        && next.at(-1)?.timestamp === points.at(-1)?.timestamp) return current;
      return { signature: holdingsSignature, points: next };
    });
  }, [quoteObservation, portfolio.holdings, portfolioLoaded, holdingsSignature, symbols]);

  useEffect(() => {
    // Wait for the user's holdings rather than requesting quotes for sample data.
    if (!portfolioLoaded) return;
    if (!symbols) {
      setQuoteStatus("Add holdings to see live prices");
      return;
    }
    let isCurrent = true;
    let timer;
    let controller;
    async function refreshQuotes() {
      if (document.hidden) {
        timer = setTimeout(refreshQuotes, 60_000);
        return;
      }
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetch(`${apiUrl}/api/quotes?symbols=${encodeURIComponent(symbols)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Live quotes unavailable");
        const { quotes } = await response.json();
        if (!isCurrent) return;
        const validQuotes = Object.values(quotes).filter((quote) => quote && Number.isFinite(quote.price) && quote.price > 0);
        if (!validQuotes.length) throw new Error("Live quotes unavailable");
        setPortfolio((current) => {
          // A holding added while this request was running belongs to the next refresh.
          if (current.holdings.map((holding) => holding.symbol).join(",") !== symbols) return current;
          const holdings = current.holdings.map((holding) => {
            const quote = quotes[holding.symbol];
            return quote ? { ...holding, price: quote.price, change: quote.change } : holding;
          });
          if (holdings.every((holding, index) => holding.price === current.holdings[index].price
            && holding.change === current.holdings[index].change)) return current;
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
        setQuoteObservation({ symbols, timestamp: Date.now() });
        const latestMarketTime = Math.max(...validQuotes.map((quote) => Number(quote.timestamp) || 0)) * 1000;
        const label = latestMarketTime && Date.now() - latestMarketTime > 15 * 60_000 ? "Last market quote" : "Live prices";
        setQuoteStatus(`${label} · ${new Date(latestMarketTime || Date.now()).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
      } catch {
        if (isCurrent) setQuoteStatus("Live quotes unavailable");
      } finally {
        clearTimeout(timeout);
        // Schedule after completion so slow requests cannot overlap.
        if (isCurrent) timer = setTimeout(refreshQuotes, 60_000);
      }
    }
    refreshQuotes();
    return () => { isCurrent = false; clearTimeout(timer); controller?.abort(); };
  }, [portfolioLoaded, symbols]);

  const holdingsKey = JSON.stringify(portfolio.holdings.map(({ symbol, shares, price }) => [symbol, shares, price]));
  useEffect(() => {
    if (!portfolioLoaded) return;
    let isCurrent = true;
    let controller;
    let timer;
    async function refreshHistory() {
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetch(`${apiUrl}/api/portfolio/history`, {
          method: "POST",
          headers: { "x-user-id": window.localStorage.getItem("userId") || "default" },
          signal: controller.signal
        });
        if (!response.ok) throw new Error("History unavailable");
        const result = await response.json();
        if (isCurrent) { setHistory(result.history); setHistoryStatus("ready"); }
      } catch {
        if (isCurrent) setHistoryStatus("error");
      } finally {
        clearTimeout(timeout);
        if (isCurrent) timer = setTimeout(refreshHistory, 60_000);
      }
    }
    // Coalesce the initial load and live quote update into a single snapshot.
    timer = setTimeout(refreshHistory, 400);
    return () => { isCurrent = false; clearTimeout(timer); controller?.abort(); };
  }, [portfolioLoaded, holdingsKey]);

  async function updateShares(symbol, shares) {
    const response = await fetch(`${apiUrl}/api/holdings/${encodeURIComponent(symbol)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-user-id": window.localStorage.getItem("userId") || "default" },
      body: JSON.stringify({ shares })
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || "Could not save share count. Please try again.");
    }
    const result = await response.json();
    setPortfolio((current) => {
      const existing = current.holdings.find((holding) => holding.symbol === result.symbol);
      if (!existing) return current;
      const holdings = current.holdings.map((holding) => holding.symbol === result.symbol ? { ...holding, shares: result.shares } : holding);
      const value = holdings.reduce((sum, holding) => sum + holding.price * holding.shares, 0);
      return {
        ...current,
        totalValue: current.totalValue + (result.shares - existing.shares) * existing.price,
        holdings: holdings.map((holding) => ({ ...holding, allocation: value ? Number((holding.price * holding.shares / value * 100).toFixed(1)) : 0 }))
      };
    });
  }

  return <PortfolioContext.Provider value={{ portfolio, setPortfolio, portfolioLoaded, portfolioLoadError, quoteStatus, updateShares, history, liveHistory, historyStatus }}>{children}</PortfolioContext.Provider>;
}

export function usePortfolio() {
  return useContext(PortfolioContext);
}
