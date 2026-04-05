export default function IndustriesPage() {
  return (
    <div className="main-content">
      <section className="section container">
        <div className="section-header">
          <span className="badge">Industries</span>
          <h1>Industries We Serve</h1>
          <p>NeureCore delivers tailored AI agent solutions across multiple industries, transforming business operations with intelligent automation.</p>
        </div>
        
        <div className="features-grid">
          <div className="industry-card">
            <div className="industry-icon">🏦</div>
            <h3>Banking & Finance</h3>
            <p>Intelligent automation for financial services, fraud detection, and customer onboarding.</p>
            <ul className="industry-features">
              <li>Automated KYC/AML workflows</li>
              <li>Loan processing agents</li>
              <li>Fraud detection assistants</li>
              <li>Portfolio management bots</li>
            </ul>
          </div>
          
          <div className="industry-card">
            <div className="industry-icon">🏥</div>
            <h3>Healthcare</h3>
            <p>AI agents for patient care, scheduling, and medical data management.</p>
            <ul className="industry-features">
              <li>Appointment scheduling</li>
              <li>Patient triage assistants</li>
              <li>Medical records automation</li>
              <li>Insurance claims processing</li>
            </ul>
          </div>
          
          <div className="industry-card">
            <div className="industry-icon">🛒</div>
            <h3>Retail & E-Commerce</h3>
            <p>Personalized shopping experiences and inventory management.</p>
            <ul className="industry-features">
              <li>AI shopping assistants</li>
              <li>Inventory optimization</li>
              <li>Customer support bots</li>
              <li>Personalized recommendations</li>
            </ul>
          </div>
          
          <div className="industry-card">
            <div className="industry-icon">📦</div>
            <h3>Logistics & Supply Chain</h3>
            <p>End-to-end supply chain automation and tracking.</p>
            <ul className="industry-features">
              <li>Shipment tracking agents</li>
              <li>Route optimization</li>
              <li>Warehouse automation</li>
              <li>Demand forecasting</li>
            </ul>
          </div>
          
          <div className="industry-card">
            <div className="industry-icon">⚙️</div>
            <h3>Manufacturing</h3>
            <p>Smart factory automation and predictive maintenance.</p>
            <ul className="industry-features">
              <li>Predictive maintenance</li>
              <li>Quality control agents</li>
              <li>Production scheduling</li>
              <li>Supply chain coordination</li>
            </ul>
          </div>
          
          <div className="industry-card">
            <div className="industry-icon">🎓</div>
            <h3>Education</h3>
            <p>Personalized learning and administrative automation.</p>
            <ul className="industry-features">
              <li>AI tutoring assistants</li>
              <li>Enrollment processing</li>
              <li>Student support bots</li>
              <li>Grade analysis</li>
            </ul>
          </div>
        </div>
        
        <div className="section-header" style={{ marginTop: '4rem' }}>
          <h2>Ready to Transform Your Industry?</h2>
          <p>Join the early access program and be among the first to experience NeureCore.</p>
          <div style={{ marginTop: '2rem' }}>
            <a href="/contact" className="btn btn-accent">Apply for Early Access</a>
          </div>
        </div>
      </section>
    </div>
  );
}
