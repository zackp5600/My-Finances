const MAX_MONTHS = 1200;

// End-of-month contributions, with the annual illustrative rate compounded monthly.
export function monthsToGoal(currentValue, targetValue, monthlyContribution, annualRate) {
  if (![currentValue, targetValue, monthlyContribution, annualRate].every(Number.isFinite)
    || currentValue < 0 || targetValue <= 0 || monthlyContribution < 0 || annualRate < 0) return null;
  if (currentValue >= targetValue) return 0;

  const monthlyRate = annualRate / 12;
  if (monthlyRate === 0) {
    if (monthlyContribution === 0) return null;
    const months = Math.ceil((targetValue - currentValue) / monthlyContribution);
    return months <= MAX_MONTHS ? months : null;
  }
  if (currentValue === 0 && monthlyContribution === 0) return null;

  // Solve target = current(1+r)^n + contribution((1+r)^n - 1)/r for n.
  const contributionBase = monthlyContribution / monthlyRate;
  const months = Math.ceil(Math.log((targetValue + contributionBase) / (currentValue + contributionBase)) / Math.log1p(monthlyRate) - 1e-10);
  return Number.isFinite(months) && months <= MAX_MONTHS ? Math.max(1, months) : null;
}

export function formatGoalDuration(months) {
  if (months === null) return "More than 100 years";
  if (months === 0) return "Goal reached";
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (!years) return `${remainingMonths} ${remainingMonths === 1 ? "month" : "months"}`;
  if (!remainingMonths) return `${years} ${years === 1 ? "year" : "years"}`;
  return `${years} ${years === 1 ? "year" : "years"}, ${remainingMonths} ${remainingMonths === 1 ? "month" : "months"}`;
}
