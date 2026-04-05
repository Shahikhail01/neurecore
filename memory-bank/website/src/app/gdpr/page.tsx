export default function GDPRPage() {
  return (
    <div className="main-content">
      <section className="section container">
        <div className="section-header">
          <span className="badge">Legal</span>
          <h1>GDPR Compliance</h1>
          <p>How we comply with the General Data Protection Regulation</p>
        </div>

        <div className="legal-content">
          <h2>Our Commitment</h2>
          <p>NeureCore is committed to ensuring the privacy and protection of personal data in accordance with the GDPR. We process personal data lawfully, fairly, and transparently.</p>
          
          <h2>Data Controller</h2>
          <p>NeureCore acts as the data controller for personal information collected through our platform. For GDPR-related queries, contact us at hello@neurecore.com.</p>
          
          <h2>Lawful Basis for Processing</h2>
          <p>We process personal data based on:</p>
          <ul>
            <li>Consent - when you explicitly agree to processing</li>
            <li>Contract - when processing is necessary for contract fulfillment</li>
            <li>Legal obligation - when required by law</li>
            <li>Legitimate interests - for our business operations</li>
          </ul>
          
          <h2>Your GDPR Rights</h2>
          <p>Under GDPR, you have the following rights:</p>
          <ul>
            <li><strong>Right to Access</strong> - Request copies of your personal data</li>
            <li><strong>Right to Rectification</strong> - Request correction of inaccurate data</li>
            <li><strong>Right to Erasure</strong> - Request deletion of your personal data</li>
            <li><strong>Right to Restrict Processing</strong> - Request limitation of processing</li>
            <li><strong>Right to Data Portability</strong> - Request transfer of your data</li>
            <li><strong>Right to Object</strong> - Object to certain processing</li>
            <li><strong>Rights Related to Automated Decision</strong> - Not be subject to automated decisions</li>
          </ul>
          
          <h2>Data Retention</h2>
          <p>We retain personal data only as long as necessary for the purposes outlined in our Privacy Policy. When data is no longer needed, we securely delete or anonymize it.</p>
          
          <h2>Data Protection Officer</h2>
          <p>For questions about our GDPR compliance or to exercise your rights, contact our Data Protection Officer at dpo@neurecore.com.</p>
        </div>
      </section>
    </div>
  );
}
