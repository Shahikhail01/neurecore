import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageShell, GlassPanel, GradientText } from '@neurecore/ui-visual';

export const metadata: Metadata = {
  title: 'Privacy Policy — NeureCore',
  description: 'NeureCore privacy policy describing how we collect, use, and protect your personal information.',
};

export default function PrivacyPage() {
  return (
    <PageShell variant="compact">
      <GlassPanel variant="panel" padding="lg" className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Sign In
          </Link>
        </div>

        <div className="rounded-2xl bg-white/5 p-8 shadow-sm border border-white/10">
          <div className="mb-8 flex items-center gap-3">
            <img src="/logo.png" alt="NeureCore" className="h-8 w-auto object-contain" />
            <h1 className="text-2xl font-bold text-zinc-100"><GradientText>Privacy Policy</GradientText></h1>
          </div>

          <div className="prose prose-invert max-w-none text-sm text-zinc-300">
            <p className="text-xs text-zinc-500">Last updated: June 27, 2026</p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-6">1. Who We Are</h2>
            <p>
              NeureCore (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is an AI agent orchestration platform.
              We operate the web application at{' '}
              <a href="https://hq.neurecore.com" className="text-[color:var(--accent-400)] hover:underline">
                hq.neurecore.com
              </a>{' '}
              (the &quot;Platform&quot;). We are the data controller for the personal information
              collected through the Platform.
            </p>
            <p>
              <strong>Contact:</strong>{' '}
              <a href="mailto:privacy@neurecore.com" className="text-[color:var(--accent-400)] hover:underline">
                privacy@neurecore.com
              </a>
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-6">2. Information We Collect</h2>
            <h3 className="font-medium text-zinc-200">2.1 Account Information</h3>
            <p>
              When you register or sign in, we collect your name, email address, and
              profile information you choose to provide. If you sign in with Google,
              we receive your name and email address from Google OAuth.
            </p>

            <h3 className="font-medium text-zinc-200">2.2 Usage Data</h3>
            <p>
              We collect metadata about how you interact with the Platform, including
              pages visited, features used, timestamps, and device information
              (browser type, IP address, operating system). This data is collected
              automatically to operate and improve the Platform.
            </p>

            <h3 className="font-medium text-zinc-200">2.3 Authentication Tokens</h3>
            <p>
              We issue JWT access tokens (15-minute expiry) and refresh tokens
              (7-day expiry) to maintain your session. These are stored securely
              in your browser and are revocable.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-6">3. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Authenticate you and maintain your session</li>
              <li>Provide, operate, and improve the Platform and its features</li>
              <li>Enforce our{' '}
                <a href="/terms" className="text-[color:var(--accent-400)] hover:underline">Terms of Service</a>
              </li>
              <li>Respond to support requests and communicate important updates</li>
              <li>Detect, investigate, and prevent fraud, abuse, and security incidents</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p className="mt-2">
              We do <strong>not</strong> use your personal information to train AI models,
              sell your data to third parties, or serve advertising.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-6">4. Legal Basis for Processing (GDPR)</h2>
            <p>If you are located in the European Economic Area, our legal bases are:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Contract:</strong> Processing your data is necessary to perform our
                service contract with you (Art. 6(1)(b) GDPR).
              </li>
              <li>
                <strong>Legitimate Interests:</strong> We process usage data and metadata
                to improve security, detect abuse, and operate the Platform
                (Art. 6(1)(f) GDPR).
              </li>
              <li>
                <strong>Consent:</strong> Where required (e.g., optional cookies), we obtain
                your consent before processing (Art. 6(1)(a) GDPR).
              </li>
            </ul>

            <h2 className="text-lg font-semibold text-zinc-100 mt-6">5. Third-Party Services</h2>
            <p>We use the following third-party processors:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Google OAuth</strong> — Used for Google sign-in. Google&apos;s privacy
                policy governs their data handling:{' '}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[color:var(--accent-400)] hover:underline"
                >
                  policies.google.com/privacy
                </a>
              </li>
              <li>
                <strong>Vercel</strong> — Our frontend hosting provider (hq.neurecore.com).
                Their privacy policy:{' '}
                <a
                  href="https://vercel.com/legal/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[color:var(--accent-400)] hover:underline"
                >
                  vercel.com/legal/privacy-policy
                </a>
              </li>
              <li>
                <strong>NeureCore Cloud (Contabo)</strong> — Our backend hosting provider.
                Server infrastructure is located in Germany.
              </li>
              <li>
                <strong>Neon (Neon.tech)</strong> — Managed PostgreSQL database provider.
                Their privacy policy:{' '}
                <a
                  href="https://neon.tech/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[color:var(--accent-400)] hover:underline"
                >
                  neon.tech/privacy-policy
                </a>
              </li>
              <li>
                <strong>Upstash</strong> — Redis provider for session management.
                Their privacy policy:{' '}
                <a
                  href="https://upstash.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[color:var(--accent-400)] hover:underline"
                >
                  upstash.com/privacy
                </a>
              </li>
            </ul>
            <p className="mt-2">
              All third-party processors are bound by data processing agreements that
              restrict their use of your data to the services they provide to us.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-6">6. Data Retention</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Account data</strong> — Retained while your account is active and
                for 30 days after deletion request.
              </li>
              <li>
                <strong>Authentication tokens</strong> — Access tokens expire in 15 minutes;
                refresh tokens in 7 days. Blacklisted tokens are cleared from Redis
                after their original expiry.
              </li>
              <li>
                <strong>Usage logs</strong> — Retained for up to 90 days for security and
                debugging purposes.
              </li>
              <li>
                <strong>Legal obligation</strong> — We may retain data longer where required
                by law (e.g., tax records).
              </li>
            </ul>

            <h2 className="text-lg font-semibold text-zinc-100 mt-6">7. Your Rights</h2>
            <p>
              Depending on your location, you may have the right to:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Access</strong> — Request a copy of your personal data (Art. 15 GDPR).
              </li>
              <li>
                <strong>Rectification</strong> — Correct inaccurate data (Art. 16 GDPR).
              </li>
              <li>
                <strong>Erasure</strong> — Request deletion of your account and data
                (&quot;right to be forgotten&quot;, Art. 17 GDPR).
              </li>
              <li>
                <strong>Portability</strong> — Receive your data in a structured,
                machine-readable format (Art. 20 GDPR).
              </li>
              <li>
                <strong>Object</strong> — Object to processing based on legitimate interests
                (Art. 21 GDPR).
              </li>
              <li>
                <strong>Restrict</strong> — Request restriction of processing in certain
                circumstances (Art. 18 GDPR).
              </li>
              <li>
                <strong>Withdraw consent</strong> — Where we rely on consent, withdraw it
                at any time without affecting prior processing.
              </li>
            </ul>
            <p className="mt-2">
              To exercise any rights, contact us at{' '}
              <a href="mailto:privacy@neurecore.com" className="text-[color:var(--accent-400)] hover:underline">
                privacy@neurecore.com
              </a>
              . We respond to all requests within 30 days.
            </p>
            <p className="mt-2">
              If you are located in the EEA and believe we have not resolved your
              concern, you may lodge a complaint with your local data protection
              authority.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-6">8. Data Security</h2>
            <p>
              We implement industry-standard technical and organizational measures to
              protect your data, including: TLS encryption in transit, hashed
              passwords, JWT authentication with short-lived tokens, Redis-backed
              token blacklisting for revocation, and role-based access controls within
              our systems.
            </p>
            <p className="mt-2">
              No method of transmission over the Internet is 100% secure. While we
              strive to protect your data, we cannot guarantee absolute security.
              In the event of a data breach affecting your personal information, we
              will notify affected users within 72 hours of discovery as required by
              GDPR.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-6">9. Cookies</h2>
            <p>
              We use minimal cookies necessary for authentication and session
              management:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Access token</strong> — Stored in memory (not persisted), cleared
                on browser close.
              </li>
              <li>
                <strong>Refresh token</strong> — Stored in an HTTP-only cookie with a
                7-day expiry, SameSite=Strict.
              </li>
            </ul>
            <p className="mt-2">
              We do not use advertising cookies, analytics cookies (beyond basic
              security/debugging logs), or third-party tracking pixels.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-6">10. Children&apos;s Privacy</h2>
            <p>
              The Platform is not intended for individuals under the age of 16. We do
              not knowingly collect personal information from children. If we become
              aware that we have collected data from a child under 16 without
              verified parental consent, we will delete that account promptly.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-6">11. International Transfers</h2>
            <p>
              Your data is primarily processed within the European Economic Area
              (Germany — Contabo servers; EEA-based managed services). Where data is
              transferred outside the EEA, we ensure appropriate safeguards are in
              place, such as Standard Contractual Clauses (SCCs) or equivalent legal
              mechanisms.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-6">12. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify
              users of material changes via email and/or a prominent notice on the
              Platform prior to the change taking effect. The date of the last
              revision is always indicated at the top of this page.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-6">13. Contact Us</h2>
            <p>
              For privacy-related questions, data subject requests, or to report
              a suspected data incident:
            </p>
            <p className="mt-1">
              <strong>Email:</strong>{' '}
              <a href="mailto:privacy@neurecore.com" className="text-[color:var(--accent-400)] hover:underline">
                privacy@neurecore.com
              </a>
            </p>
            <p className="mt-1">
              <strong>Platform:</strong>{' '}
              <a href="https://hq.neurecore.com" className="text-[color:var(--accent-400)] hover:underline">
                hq.neurecore.com
              </a>
            </p>
          </div>
        </div>
      </GlassPanel>
    </PageShell>
  );
}
