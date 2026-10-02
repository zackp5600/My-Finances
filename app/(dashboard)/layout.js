import DashboardShell from "../components/DashboardShell";
import { PortfolioProvider } from "../components/PortfolioProvider";

export default function DashboardLayout({ children }) {
  return <PortfolioProvider><DashboardShell>{children}</DashboardShell></PortfolioProvider>;
}
