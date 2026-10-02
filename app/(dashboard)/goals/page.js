"use client";

import { useEffect, useRef, useState } from "react";
import { usePortfolio } from "../../components/PortfolioProvider";
import { formatGoalDuration, monthsToGoal } from "../../components/goal-projection.mjs";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function GoalsPage() {
  const { portfolio, setPortfolio, portfolioLoaded, portfolioLoadError } = usePortfolio();
  const [amountInput, setAmountInput] = useState("");
  const [monthlyInput, setMonthlyInput] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  useEffect(() => {
    if (!portfolioLoaded || !portfolio.goal) return;
    setAmountInput(String(portfolio.goal.amount));
    setMonthlyInput(String(portfolio.goal.monthlyContribution));
  }, [portfolioLoaded, portfolio.goal?.amount, portfolio.goal?.monthlyContribution]);

  async function saveGoal(event) {
    event.preventDefault();
    if (submitting.current || !portfolioLoaded || portfolioLoadError) return;
    const amount = Number(amountInput);
    const monthlyContribution = Number(monthlyInput);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000_000
      || !Number.isFinite(monthlyContribution) || monthlyContribution < 0 || monthlyContribution > 1_000_000_000) {
      setError("Enter a valid goal amount and monthly contribution.");
      return;
    }

    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/api/portfolio/goal`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": window.localStorage.getItem("userId") || "default" },
        body: JSON.stringify({ amount, monthlyContribution })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save goal. Please try again.");
      setPortfolio((current) => ({ ...current, goal: result.goal }));
    } catch (saveError) {
      setError(saveError instanceof TypeError ? "Cannot reach the portfolio server. Try again when it is available." : saveError.message);
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  const goal = portfolio.goal;
  const currentValue = Math.max(0, Number(portfolio.totalValue) || 0);
  const remaining = goal ? Math.max(0, goal.amount - currentValue) : 0;
  const progress = goal ? Math.min(100, currentValue / goal.amount * 100) : 0;
  const fastMonths = goal ? monthsToGoal(currentValue, goal.amount, goal.monthlyContribution, 0.08) : null;
  const slowMonths = goal ? monthsToGoal(currentValue, goal.amount, goal.monthlyContribution, 0.04) : null;

  return (
    <>
      <header>
        <div>
          <p className="eyebrow">LOOKING AHEAD</p>
          <h1>Portfolio goals</h1>
          <p className="subhead">Set a dollar amount for your portfolio and see how far away it may be.</p>
        </div>
      </header>
      {!portfolioLoaded ? <p className="goal-loading" role="status">Loading your portfolio…</p> : portfolioLoadError ? (
        <p className="goal-error" role="alert">Your portfolio could not be loaded. Reconnect to the portfolio server, then refresh to set a goal.</p>
      ) : (
        <div className="goal-layout">
          <section className="panel goal-form-panel" aria-labelledby="goal-form-title">
            <p className="eyebrow">YOUR TARGET</p>
            <h2 id="goal-form-title">Add a portfolio dollar amount goal</h2>
            <p>Choose the portfolio value you want to reach. Add a planned monthly contribution for a more useful estimate.</p>
            <form onSubmit={saveGoal}>
              <label htmlFor="goal-amount">Portfolio goal (USD)</label>
              <div className="goal-input-wrap"><span aria-hidden="true">$</span><input id="goal-amount" type="number" min="0.01" max="1000000000000" step="0.01" inputMode="decimal" value={amountInput} onChange={(event) => setAmountInput(event.target.value)} placeholder="100000" required /></div>
              <label htmlFor="goal-monthly">Planned monthly contribution (USD)</label>
              <div className="goal-input-wrap"><span aria-hidden="true">$</span><input id="goal-monthly" type="number" min="0" max="1000000000" step="0.01" inputMode="decimal" value={monthlyInput} onChange={(event) => setMonthlyInput(event.target.value)} required /></div>
              <p className="goal-field-hint">Use 0 if you do not plan to add money each month.</p>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="add-button" type="submit" disabled={saving}>{saving ? "Saving goal…" : goal ? "Update goal" : "Add goal"}</button>
            </form>
          </section>

          {goal && <section className="panel goal-results" aria-labelledby="goal-results-title">
            <p className="eyebrow">YOUR PROGRESS</p>
            <h2 id="goal-results-title">Your goal at a glance</h2>
            <div className="goal-amounts">
              <div><span>Portfolio now</span><strong>{currency.format(currentValue)}</strong></div>
              <div><span>Goal</span><strong>{currency.format(goal.amount)}</strong></div>
            </div>
            <div className="goal-progress" role="progressbar" aria-label="Portfolio goal progress" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div>
            <p className="goal-remaining">{remaining === 0 ? "You have reached this goal." : `${currency.format(remaining)} to go · ${Math.round(progress)}% of goal reached`}</p>
            {remaining > 0 && <div className="goal-estimates">
              <h3>Illustrative time to goal</h3>
              {fastMonths === null ? <p>{currentValue === 0 && goal.monthlyContribution === 0 ? "Add a holding or a planned monthly contribution to see an estimated date." : "The goal is more than 100 years away under these assumptions. A higher monthly contribution would shorten the estimate."}</p> : <>
                <p className="goal-estimate-range">{formatGoalDuration(fastMonths)}{slowMonths !== fastMonths && ` – ${formatGoalDuration(slowMonths)}`}</p>
                <div className="goal-scenarios"><span>At 8% annual growth <strong>{formatGoalDuration(fastMonths)}</strong></span><span>At 4% annual growth <strong>{formatGoalDuration(slowMonths)}</strong></span></div>
              </>}
            </div>}
            <p className="goal-assumptions">Illustration only: 4%–8% annual growth, compounded monthly, with contributions added at each month’s end. Returns are not guaranteed; market losses, fees, taxes, and inflation are not included.</p>
          </section>}
        </div>
      )}
    </>
  );
}
