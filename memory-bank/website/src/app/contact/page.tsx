export default function ContactPage() {
  return (
    <div className="main-content">
      <section className="section container">
        <div className="section-header">
          <span className="badge">Contact</span>
          <h1>Apply for Early Access</h1>
          <p>Join the early access program and be among the first to experience NeureCore.</p>
        </div>

        <div className="contact-wrapper">
          <div className="contact-info">
            <h3>Get in Touch</h3>
            <div className="contact-item">
              <div className="contact-icon">📧</div>
              <div>
                <strong>Email</strong>
                <p>hello@neurecore.com</p>
              </div>
            </div>
            <div className="contact-item">
              <div className="contact-icon">🌐</div>
              <div>
                <strong>Website</strong>
                <p>www.neurecore.com</p>
              </div>
            </div>
            <div className="contact-item">
              <div className="contact-icon">🏢</div>
              <div>
                <strong>Location</strong>
                <p>Enterprise AI Platform - Worldwide</p>
              </div>
            </div>
          </div>

          <form className="contact-form">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input type="text" className="form-input" placeholder="John Doe" />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-input" placeholder="john@company.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Company</label>
              <input type="text" className="form-input" placeholder="Your Company" />
            </div>
            <div className="form-group">
              <label className="form-label">Message</label>
              <textarea className="form-input form-textarea" placeholder="Tell us about your interest in NeureCore..."></textarea>
            </div>
            <button type="submit" className="btn btn-accent" style={{ width: '100%' }}>Submit Application</button>
          </form>
        </div>
      </section>
    </div>
  );
}
