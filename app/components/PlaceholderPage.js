import { Sidebar } from "./PortfolioDashboard";

export default function PlaceholderPage({ title }) {
  return (
    <main className="shell">
      <Sidebar owner="Alex Morgan" />
      <section className="content">
        <div className="placeholder-page"><h1>{title}</h1></div>
      </section>
    </main>
  );
}
