import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageShell, GlassPanel, GradientText } from '@neurecore/ui-visual';

export const metadata: Metadata = {
  title: 'Terms of Service — NeureCore',
  description: 'Terms of Service for the NeureCore AI agent orchestration platform.',
};

export default function TermsPage() {
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
            <h1 className="text-2xl font-bold text-zinc-100"><GradientText>Terms of Service</GradientText></h1>
          </div>

          <div className="prose prose-invert max-w-none text-sm text-zinc-300">
            <p className="text-xs text-zinc-500">Last updated: June 27, 2026</p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-6">1. Acceptance of Terms</h2>
            <p>
              By creating an account or accessing the NeureCore platform at{' '}
              <a href="https://hq.neurecore.com" className="text-[color:var(--accent-400)] hover:underline">
                hq.neurecore.com
              </a>{' '}
              (the &quot;Platform&quot;), you (&quot;you,&quot; &quot;your,&quot; or &quot;User&quot;) agree to be bound by
              these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms,
              do not use the Platform. These Terms form a binding agreement between you
              and NeureCore (&quot;we,&quot; &quot;us,&quot; or &quot;NeureCore&quot;).
            </p>
            <p>
              We may update these Terms from time to time. Continued use of the Platform
              after any update constitutes acceptance of the revised Terms. We will
              notify you of material changes via email or a notice on the Platform prior
              to the changes taking effect.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-6">2. Description of Service</h2>
            <p>
              NeureCore provides an AI agent orchestration platform that allows
              organizations to create, manage, and govern AI agents and workflows
              (&quot;Services&quot;). The Platform includes user authentication, tenant management,
              agent configuration, workflow orchestration, and related tools. We
              reserve the right to modify, suspend, or discontinue any part of the
              Services at any time without prior notice.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-6">3. Eligibility</h2>
            <p>
              The Platform is intended for users aged 16 and older. By registering, you
              represent that you are at least 16 years old and have the legal capacity
              to enter into a binding agreement. If you are registering an organization,
              you represent that you have authority to bind that organization to these
              Terms.
            </p>
            <p>
              The Platform is not available in jurisdictions where its use would
              violate applicable law. You are responsible for ensuring your use
              complies with all local laws.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-6">4. Account Registration and Security</h2>
            <p>
              To access the Platform, you must create an account with accurate and
              complete information. You are solely responsible for:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Maintaining the confidentiality of your login credentials</li>
              <li>All activity that occurs under your account</li>
              <li>Notifying us immediately of any unauthorized use</li>
              <li>Using a strong, unique password and enabling two-factor authentication where available</li>
            </ul>
            <p className="mt-2">
              We reserve the right to suspend or terminate accounts that violate these
              Terms, including accounts used for fraudulent, abusive, or illegal activity.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-6">5. Acceptable Use</h2>
            <p>You agree not to use the Platform to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Violate any applicable local, national, or international law or regulation</li>
              <li>Generate or disseminate harmful content, including hate speech, harassment, or incitement to violence</li>
              <li>Use the Platform to deploy AI agents that facilitate illegal, unethical, or discriminatory acts</li>
              <li>Attempt to gain unauthorized access to any system, data, or account</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Platform</li>
              <li>Use the Platform in any manner that could interfere with, impair, or disrupt its operation or the experience of other users</li>
              <li>Scrape, harvest, or collect data from the Platform without prior written consent</li>
              <li>Impersonate any person or entity, or falsely represent your affiliation</li>
            </ul>
            <p className="mt-2">
              AI agents created within the Platform remain your responsibility. You are
              accountable for their outputs and use. You must ensure agents do not
              produce content that violates these Terms or applicable law.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-6">6. Intellectual Property</h2>
            <h3 className="font-medium text-zinc-200">6.1 NeureCore IP</h3>
            <p>
              NeureCore and its licensors retain all right, title, and interest in and
              to the Platform, including all software, trademarks, logos, documentation,
              and other materials provided through it. These Terms grant you a limited,
              non-exclusive, non-transferable, revocable right to use the Platform in
              accordance with these Terms. No ownership rights are transferred.
            </p>
            <h3 className="font-medium text-zinc-200 mt-3">6.2 Your Content</h3>
            <p>
              You retain all rights to the data, content, and materials you submit to the
              Platform (&quot;User Content&quot;). By using the Platform, you grant us a limited
              license to process your User Content solely to provide and improve the
              Services to you. We do not use your User Content to train AI models.
            </p>
            <h3 className="font-medium text-zinc-200 mt-3">6.3 AI Agent Outputs</h3>
            <p>
              Outputs generated by your AI agents (&quot;Agent Outputs&quot;) are your property.
              NeureCore makes no claim to Agent Outputs. You bear sole responsibility
              for ensuring Agent Outputs do not infringe third-party intellectual
              property or applicable law.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-6">7. Subscription Plans and Fees</h2>
            <p>
              Access to certain features is governed by a subscription plan (STARTER,
              GROWTH, PRO, or ENTERPRISE) selected at tenant registration. Details of
              each plan are available at{' '}
              <a href="https://neurecore.com/plans" className="text-[color:var(--accent-400)] hover:underline">
                neurecore.com/plans
              </a>{' '}
              and are incorporated by reference.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Fees are billed in accordance with your selected plan and are non-refundable except as required by law.</li>
              <li>All fees are exclusive of applicable taxes unless stated otherwise.</li>
              <li>We reserve the right to change plan pricing with 30 days&apos; prior notice.</li>
              <li>Failure to pay fees may result in suspension of your account and data after 14 days of non-payment.</li>
            </ul>

            <h2 className="text-lg font-semibold text-zinc-100 mt-6">8. Confidentiality</h2>
            <p>
              Your account data, including data processed by your AI agents, is
              considered confidential. NeureCore employees and subcontractors are
              bound by confidentiality obligations and access your data only as
              necessary to provide the Services, ensure security, or respond to
              legal obligations. You are responsible for ensuring your agents do not
              process sensitive personal data beyond what is necessary for the
              intended purpose.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-6">9. Service Availability and Support</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                We aim for 99.9% uptime for the Platform but do not guarantee
                uninterrupted availability. Planned maintenance windows will be
                communicated in advance where possible.
              </li>
              <li>
                Bug reports and technical support requests can be submitted via the
                support channels provided to your plan tier.
              </li>
              <li>
                We reserve the right to perform emergency maintenance without prior
                notice to protect the security or integrity of the Platform.
              </li>
            </ul>

            <h2 className="text-lg font-semibold text-zinc-100 mt-6">10. Disclaimer of Warranties</h2>
            <p>
              THE PLATFORM IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES
              OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED
              WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
              NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE PLATFORM WILL BE
              UNINTERRUPTED, ERROR-FREE, OR COMPLETELY SECURE.
            </p>
            <p className="mt-2">
              AI AGENT OUTPUTS ARE GENERATED AUTOMATICALLY AND ARE NOT REVIEWED,
              APPROVED, OR ENDORSED BY NEURECORE. YOU BEAR SOLE RESPONSIBILITY FOR
              REVIEWING, VALIDATING, AND USING AGENT OUTPUTS IN ACCORDANCE WITH THESE
              TERMS AND APPLICABLE LAW.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-6">11. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEURECORE AND ITS AFFILIATES,
              OFFICERS, DIRECTORS, AND EMPLOYEES SHALL NOT BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
              INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR BUSINESS
              OPPORTUNITIES, ARISING OUT OF OR RELATED TO YOUR USE OF OR INABILITY
              TO USE THE PLATFORM, EVEN IF NEURECORE HAS BEEN ADVISED OF THE
              POSSIBILITY OF SUCH DAMAGES.
            </p>
            <p className="mt-2">
              OUR TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATED TO THESE TERMS
              OR THE PLATFORM SHALL NOT EXCEED THE AMOUNT PAID BY YOU TO NEURECORE
              IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
            </p>
            <p className="mt-2">
              THE ABOVE LIMITATIONS DO NOT APPLY TO DAMAGES ARISING FROM DEATH OR
              PERSONAL INJURY, FRAUD, OR INTENTIONAL MISCONDUCT, WHERE SUCH
              LIMITATION WOULD BE UNENFORCEABLE UNDER APPLICABLE LAW.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-6">12. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless NeureCore and its
              affiliates, officers, directors, and employees from and against any
              claims, damages, losses, liabilities, costs, and expenses (including
              reasonable legal fees) arising out of or related to:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your violation of these Terms</li>
              <li>Your use of the Platform in a manner not authorized by these Terms</li>
              <li>Your violation of any applicable law or regulation</li>
              <li>Your AI agents&apos; outputs or the content processed by your AI agents</li>
              <li>Any dispute between you and a third party arising from your use of the Platform</li>
            </ul>

            <h2 className="text-lg font-semibold text-zinc-100 mt-6">13. Termination</h2>
            <p>
              You may terminate your account at any time by contacting us or through
              the account settings within the Platform. We may suspend or terminate
              your account immediately, without prior notice, if we reasonably believe you
              have violated these Terms or applicable law.
            </p>
            <p className="mt-2">
              Upon termination: (a) your right to use the Platform ceases immediately;
              (b) we may delete your account and data within 30 days of termination,
              except where retention is required by law; (c) any outstanding fees are
              due immediately; and (d) sections that by their nature survive termination
              (Intellectual Property, Disclaimer of Warranties, Limitation of Liability,
              Indemnification, and General Provisions) remain in effect.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-6">14. Governing Law and Dispute Resolution</h2>
            <p>
              These Terms are governed by the laws of the Federal Republic of Germany,
              without regard to conflict of law principles. Any dispute arising out of
              or relating to these Terms or your use of the Platform that cannot be
              resolved informally shall be submitted to the courts of Berlin, Germany.
              You consent to the exclusive jurisdiction of such courts.
            </p>
            <p className="mt-2">
              If you are a consumer located in the European Economic Area, this
              provision does not affect your rights under applicable consumer protection
              laws, including your right to bring proceedings in the courts of your
              home country.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-6">15. General Provisions</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Entire Agreement:</strong> These Terms, together with our
                Privacy Policy and plan-specific terms, constitute the entire agreement
                between you and NeureCore regarding your use of the Platform.
              </li>
              <li>
                <strong>Severability:</strong> If any provision of these Terms is held
                unenforceable, the remaining provisions remain in full force and effect.
              </li>
              <li>
                <strong>Waiver:</strong> Failure to enforce any provision of these
                Terms does not constitute a waiver of our right to enforce it later.
              </li>
              <li>
                <strong>Assignment:</strong> You may not assign these Terms without our
                prior written consent. We may assign these Terms to an affiliate or in
                connection with a merger, acquisition, or sale of assets.
              </li>
              <li>
                <strong>Force Majeure:</strong> NeureCore is not liable for any failure
                to perform due to causes beyond its reasonable control, including natural
                disasters, war, terrorism, or infrastructure failures.
              </li>
            </ul>

            <h2 className="text-lg font-semibold text-zinc-100 mt-6">16. Contact Us</h2>
            <p>For questions or notices regarding these Terms:</p>
            <p className="mt-1">
              <strong>Email:</strong>{' '}
              <a href="mailto:legal@neurecore.com" className="text-[color:var(--accent-400)] hover:underline">
                legal@neurecore.com
              </a>
            </p>
            <p className="mt-1">
              <strong>Platform:</strong>{' '}
              <a href="https://hq.neurecore.com" className="text-[color:var(--accent-400)] hover:underline">
                hq.neurecore.com
              </a>
            </p>
            <p className="mt-1">
              <strong>Registered Address:</strong> NeureCore, Berlin, Germany
            </p>
          </div>
        </div>
      </GlassPanel>
    </PageShell>
  );
}
