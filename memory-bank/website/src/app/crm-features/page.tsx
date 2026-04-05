export default function CRMFeaturesPage() {
  return (
    <div className="main-content">
      <section className="section container">
        <div className="section-header">
          <span className="badge">CRM Features</span>
          <h1>Complete CRM Capabilities</h1>
          <p>A comprehensiveCustomer Relationship Management system powered by intelligent AI agents.</p>
        </div>

        <div className="crm-feature-section">
          <div className="crm-feature-content">
            <h3>Contact Management</h3>
            <p>Comprehensive contact management with AI-powered insights and relationship tracking.</p>
            <ul className="crm-feature-list">
              <li>Unified contact database</li>
              <li>AI relationship scoring</li>
              <li>Interaction history tracking</li>
              <li>Custom fields and tags</li>
              <li>Duplicate detection</li>
              <li>Contact import/export</li>
            </ul>
          </div>
          <div className="crm-feature-image">👥</div>
        </div>

        <div className="crm-feature-section">
          <div className="crm-feature-content">
            <h3>Lead Management</h3>
            <p>Intelligent lead tracking and qualification with automated scoring and nurturing.</p>
            <ul className="crm-feature-list">
              <li>Lead capture from multiple sources</li>
              <li>AI-powered lead scoring</li>
              <li>Automated lead nurturing</li>
              <li>Pipeline visualization</li>
              <li>Lead assignment automation</li>
              <li>Conversion tracking</li>
            </ul>
          </div>
          <div className="crm-feature-image">🎯</div>
        </div>

        <div className="crm-feature-section">
          <div className="crm-feature-content">
            <h3>Deal Pipeline</h3>
            <p>Visual deal management with forecasting and automation capabilities.</p>
            <ul className="crm-feature-list">
              <li>Drag-and-drop pipeline</li>
              <li>Revenue forecasting</li>
              <li>Automated stage transitions</li>
              <li>Deal probability tracking</li>
              <li>Weighted pipeline values</li>
              <li>Win/loss analysis</li>
            </ul>
          </div>
          <div className="crm-feature-image">💰</div>
        </div>

        <div className="crm-feature-section">
          <div className="crm-feature-content">
            <h3>Email Integration</h3>
            <p>Seamless email integration with tracking and templates.</p>
            <ul className="crm-feature-list">
              <li>Email sync (IMAP/SMTP)</li>
              <li>Email tracking</li>
              <li>Templates with merge</li>
              <li>Scheduled sending</li>
              <li>Email analytics</li>
              <li>Mass email campaigns</li>
            </ul>
          </div>
          <div className="crm-feature-image">📧</div>
        </div>

        <div className="crm-feature-section">
          <div className="crm-feature-content">
            <h3>Task Management</h3>
            <p>Complete task and activity management for sales teams.</p>
            <ul className="crm-feature-list">
              <li>Task creation and assignment</li>
              <li>Due date tracking</li>
              <li>Recurring tasks</li>
              <li>Task dependencies</li>
              <li>Priority levels</li>
              <li>Completion analytics</li>
            </ul>
          </div>
          <div className="crm-feature-image">✓</div>
        </div>

        <div className="crm-feature-section">
          <div className="crm-feature-content">
            <h3>Reporting & Analytics</h3>
            <p>Comprehensive reporting with AI-powered insights.</p>
            <ul className="crm-feature-list">
              <li>Customizable dashboards</li>
              <li>AI-powered insights</li>
              <li>Sales forecasting</li>
              <li>Team performance metrics</li>
              <li>Export capabilities</li>
              <li>Scheduled reports</li>
            </ul>
          </div>
          <div className="crm-feature-image">📊</div>
        </div>

        <div className="section-header" style={{ marginTop: '4rem' }}>
          <h2>Power Your Sales with AI</h2>
          <p>Join the early access program to experience the future of CRM.</p>
          <div style={{ marginTop: '2rem' }}>
            <a href="/contact" className="btn btn-accent">Apply for Early Access</a>
          </div>
        </div>
      </section>
    </div>
  );
}
