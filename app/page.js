import NavigationLink from "./components/NavigationLink";
import LandingReveal from "./components/LandingReveal";

export default function LandingPage() {
  return (
    <main className="landing-page">
      <LandingReveal />
      <div className="landing-orb landing-orb-one" />
      <div className="landing-orb landing-orb-two" />
      <nav className="landing-nav" aria-label="Main navigation">
        <a className="landing-brand" href="#top"><i>✦</i> My Finances </a>
        <NavigationLink className="landing-login" href="/login">Log in</NavigationLink>
      </nav>
      <section className="landing-hero" id="top">
        <p className="landing-eyebrow">YOUR FINANCIAL COMPASS</p>
        <h1>See where your<br /><em>money can go.</em></h1>
        <p className="landing-copy">A calm, clear home for every investment decision you make.</p>
        <NavigationLink className="join-button" href="/signup">Control Your Finances <span>→</span></NavigationLink>
        {/* <p className="landing-note">Start building your portfolio today</p> */}
      </section>
      <a className="landing-scroll-cue" href="#details">Explore what you can do <span aria-hidden="true">↓</span></a>

      <section className="landing-details" id="details" aria-labelledby="details-title">
        <div className="landing-section-intro landing-reveal">
          <p className="landing-eyebrow">A CLEARER VIEW</p>
          <h2 id="details-title">Your portfolio, <em>in perspective.</em></h2>
          <p>Bring your holdings together and see the numbers behind each decision in one calm workspace.</p>
        </div>
        <div className="landing-feature-grid">
          <article className="landing-feature landing-reveal">
            <span className="landing-feature-number">01</span>
            <div className="landing-feature-icon" aria-hidden="true">◫</div>
            <h3>Know what you own</h3>
            <p>View your holdings, share counts, and current values together.</p>
          </article>
          <article className="landing-feature landing-reveal">
            <span className="landing-feature-number">02</span>
            <div className="landing-feature-icon" aria-hidden="true">◔</div>
            <h3>See the balance</h3>
            <p>Understand how each holding contributes to your portfolio allocation.</p>
          </article>
          <article className="landing-feature landing-reveal">
            <span className="landing-feature-number">03</span>
            <div className="landing-feature-icon" aria-hidden="true">↗</div>
            <h3>Follow your progress</h3>
            <p>Compare the amount invested with recorded portfolio values over time.</p>
          </article>
        </div>
      </section>

      <section className="landing-close landing-reveal" aria-labelledby="landing-close-title">
        <p className="landing-eyebrow">READY WHEN YOU ARE</p>
        <h2 id="landing-close-title">Make room for <em>better decisions.</em></h2>
        <p>Start with a clearer picture of your investments.</p>
        <NavigationLink className="join-button" href="/signup">Control Your Finances <span aria-hidden="true">→</span></NavigationLink>
      </section>
    </main>
  );
}
