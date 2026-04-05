import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NeureCore | Enterprise AI Agent Platform",
  description: "The next-generation AI agent platform for enterprise automation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.className}>
      <body className="min-h-screen flex flex-col">
        <header className="header">
          <div className="header-content">
            <Link href="/" className="logo">
              <div className="logo-icon">N</div>
              <span>NeureCore</span>
            </Link>
            <nav className="nav">
              <Link href="/industries" className="nav-link">Industries</Link>
              <Link href="/crm-features" className="nav-link">CRM Features</Link>
              <Link href="/about" className="nav-link">About</Link>
              <Link href="/contact" className="nav-link">Contact</Link>
              <Link href="/contact" className="nav-cta">Apply for Early Access</Link>
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="footer">
          <div className="footer-content">
            <div className="footer-grid">
              <div className="footer-brand">
                <Link href="/" className="logo">
                  <div className="logo-icon">N</div>
                  <span>NeureCore</span>
                </Link>
                <p>The next-generation AI agent platform for enterprise automation.</p>
              </div>
              <div className="footer-col">
                <h4>Product</h4>
                <ul>
                  <li><Link href="/industries">Industries</Link></li>
                  <li><Link href="/crm-features">CRM Features</Link></li>
                  <li><Link href="/about">About</Link></li>
                </ul>
              </div>
              <div className="footer-col">
                <h4>Company</h4>
                <ul>
                  <li><Link href="/about">About Us</Link></li>
                  <li><Link href="/contact">Contact</Link></li>
                  <li><Link href="/contact">Careers</Link></li>
                </ul>
              </div>
              <div className="footer-col">
                <h4>Legal</h4>
                <ul>
                  <li><Link href="/privacy">Privacy Policy</Link></li>
                  <li><Link href="/gdpr">GDPR</Link></li>
                  <li><Link href="/terms">Terms</Link></li>
                </ul>
              </div>
            </div>
            <div className="footer-bottom">
              <p>© 2025 NeureCore. All rights reserved.</p>
              <p>Building the future of enterprise AI automation.</p>
            </div>
          </div>
        </footer>

        <div className="countdown-bar">
          <div className="countdown-bar-content">
            <span className="countdown-text">Launch in <span id="countdown-days">30</span> days - Be among the first</span>
            <div className="countdown-timer">
              <span className="countdown-number" id="countdown-d">30</span>
              <span className="countdown-text">days</span>
              <span className="countdown-number" id="countdown-h">00</span>
              <span className="countdown-text">:</span>
              <span className="countdown-number" id="countdown-m">00</span>
              <span className="countdown-text">:</span>
              <span className="countdown-number" id="countdown-s">00</span>
            </div>
            <Link href="/contact" className="countdown-btn">Apply for Early Access</Link>
          </div>
        </div>
      </body>
    </html>
  );
}
