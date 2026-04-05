export default function AboutPage() {
  return (
    <div className="main-content">
      <section className="section container">
        <div className="about-hero">
          <span className="badge">About NeureCore</span>
          <h1>Building the Future of Enterprise AI</h1>
          <p>NeureCore is a next-generation AI agent platform designed to transform how enterprises automate workflows, managecustomer relationships, and drive productivity.</p>
        </div>

        <div className="about-values">
          <div className="value-card">
            <div className="value-icon">🎯</div>
            <h3>Mission-Driven</h3>
            <p>Empowering enterprises with intelligent AI agents that understand their business.</p>
          </div>
          <div className="value-card">
            <div className="value-icon">🔒</div>
            <h3>Enterprise Security</h3>
            <p>SOC 2 compliant, encrypted, with complete data isolation.</p>
          </div>
          <div className="value-card">
            <div className="value-icon">⚡</div>
            <h3>High Performance</h3>
            <p>Built for scale with multi-tenant architecture and real-time capabilities.</p>
          </div>
          <div className="value-card">
            <div className="value-icon">🤝</div>
            <h3>Customer Focus</h3>
            <p>Tailored solutions with comprehensive support and guidance.</p>
          </div>
        </div>

        <div className="section-header" style={{ marginTop: '4rem' }}>
          <h2>Join Our Journey</h2>
          <p>Were building something transformative. Apply for early access to be part of the AI revolution.</p>
          <div style={{ marginTop: '2rem' }}>
            <a href="/contact" className="btn btn-accent">Apply for Early Access</a>
          </div>
        </div>
      </section>
    </div>
  );
}
