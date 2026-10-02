"use client";

import dynamic from "next/dynamic";

// Charts are only needed after the dashboard has rendered. Keeping Recharts in
// its own client chunk lets the landing page and the lightweight sections load
// without paying for the charting library.
export const PerformancePanel = dynamic(
  () => import("./DashboardCharts").then((module) => module.PerformancePanel),
  { loading: () => <article className="panel performance" aria-busy="true" /> }
);
export const AllocationPanel = dynamic(
  () => import("./DashboardCharts").then((module) => module.AllocationPanel),
  { loading: () => <article className="panel allocation" aria-busy="true" /> }
);

