export default function Home() {
  return (
    <div className="main-content">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content container">
          <span className="badge">Coming Soon - Early Access Open</span>
          <h1>The Future of Enterprise <span style={{ color: 'var(--color-accent)' }}>AI Agents</span></h1>
          <p className="hero-subtitle">
            NeureCore is the next-generation AI agent platform that transforms how enterprises automate workflows. 
            Build, deploy, and orchestrate intelligent agents that understand your business, adapt to your needs, 
            and deliver unprecedented productivity gains.
          </p>
          <div className="hero-buttons">
            <a href="/contact" className="btn btn-accent">Apply for Early Access</a>
            <a href="/crm-features" className="btn btn-outline">Explore Features</a>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-number">50+</div>
              <div className="hero-stat-label">Built-in Agent Tools</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-number">8</div>
              <div className="hero-stat-label">User Roles</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-number">Multi</div>
              <div className="hero-stat-label">Tenant Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="section container">
        <div className="section-header">
          <h2>Powerful AI Agent Platform</h2>
          <p>Everything you need to build enterprise-grade AI agents that transform your business operations.</p>
        </div>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🤖</div>
            <h3>Intelligent Agents</h3>
            <p>AI agents that learn from your data and adapt to your specific business workflows with natural language understanding.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3>Workflow Automation</h3>
            <p>Automate complex business processes with visual workflow builders and intelligent routing.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔗</div>
            <h3>Integrations</h3>
            <p>Connect to 50+ enterprise systems including CRM, ERP, communication tools, and custom APIs.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">👥</div>
            <h3>Multi-Tenant</h3>
            <p>Full data isolation with role-based access control for secure multi-tenant enterprise deployment.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Analytics</h3>
            <p>AI-powered analytics with real-time dashboards, monitoring, and actionable insights.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3>Enterprise Security</h3>
            <p>SOC 2 compliance, encryption, audit logs, and granular governance controls.</p>
          </div>
        </div>
      </section>

      {/* User Roles Section */}
      <section className="section bg-alt">
        <div className="container">
          <div className="section-header">
            <h2>Comprehensive User Roles</h2>
            <p>Eight distinct user roles with granular permissions for complete enterprise control.</p>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <h3>Platform Admin</h3>
              <p>Full system control, tier management, platform analytics, and security configuration.</p>
            </div>
            <div className="feature-card">
              <h3>TenantAdmin</h3>
              <p>Tenant configuration, user management, billing, and cross-department visibility.</p>
            </div>
            <div className="feature-card">
              <h3>Department Admin</h3>
              <p>Department-specific settings and governance rule management.</p>
            </div>
            <div className="feature-card">
              <h3>Team Lead</h3>
              <p>Team user management and routine approvals.</p>
            </div>
            <div className="feature-card">
              <h3>Power User</h3>
              <p>Full feature access with workflow and agent creation.</p>
            </div>
            <div className="feature-card">
              <h3>Standard User</h3>
              <p>Run agents, participate in workflows, and use chat features.</p>
            </div>
            <div className="feature-card">
              <h3>Guest User</h3>
              <p>Limited external access with specific permissions.</p>
            </div>
            <div className="feature-card">
              <h3>API User</h3>
              <p>Programmatic access via REST API with scoped permissions.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section container">
        <div className="section-header">
          <h2>Ready to Transform Your Business?</h2>
          <p>Join the early access program and be among the first to experience the future of enterprise AI automation.</p>
          <div style={{ marginTop: '2rem' }}>
            <a href="/contact" className="btn btn-accent">Apply for Early Access</a>
          </div>
        </div>
      </section>
    </div>
  );
}
