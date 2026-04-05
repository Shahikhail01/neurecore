# NeureCore Website Specification

## Project Overview

- **Project Name**: NeureCore Website
- **Type**: Marketing website for AI Agent Platform
- **Core Functionality**: Showcase NeureCore as an enterprise AI agent operating system with CRM capabilities, workflow automation, and multi-tenant architecture
- **Target Users**: Enterprise decision-makers, IT managers, CTOs, product managers looking for AI agent solutions

---

## Design System

### Color Palette

| Color Name | Hex Code | Usage |
|------------|----------|-------|
| **Primary (UN Blue)** | `#1E3A8A` | Primary buttons, headers, navigation |
| **Primary Light** | `#3B82F6` | Hover states, accents |
| **Primary Dark** | `#1E40AF` | Active states, emphasis |
| **Secondary (Glowing Champagne Dark Red)** | `#7F1D1D` | Accent highlights, badges |
| **Secondary Glow** | `#991B1B` | Hover on secondary elements |
| **Accent (Glowing Orange)** | `#EA580C` | CTA buttons, notifications, glows |
| **Accent Light** | `#F97316` | Hover states |
| **Accent Glow** | `#FB923C` | Subtle glows |
| **Background** | `#FFFFFF` | Main background |
| **Background Alt** | `#F8FAFC` | Card backgrounds, sections |
| **Background Subtle** | `#F1F5F9` | Light grey for boxes |
| **Text Primary** | `#0F172A` | Main text |
| **Text Secondary** | `#475569` | Secondary text |
| **Text Muted** | `#94A3B8` | Muted text |

### Typography

- **Primary Font**: Inter (Google Fonts)
- **Headings**: Inter Bold (700), Inter Semibold (600)
- **Body**: Inter Regular (400), Inter Medium (500)
- **Monospace**: JetBrains Mono (for code/technical content)

#### Font Sizes
- Hero: 64px (desktop), 40px (mobile)
- H1: 48px (desktop), 32px (mobile)
- H2: 36px (desktop), 28px (mobile)
- H3: 24px (desktop), 20px (mobile)
- Body: 16px
- Small: 14px
- Caption: 12px

### Spacing System

- Base unit: 4px
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128

### Visual Effects

- **Shadows**: Subtle shadows for cards (`0 4px 6px -1px rgba(0, 0, 0, 0.1)`)
- **Glows**: Orange glow for CTAs (`0 0 20px rgba(234, 88, 12, 0.3)`)
- **Gradients**: Subtle blue gradients for hero sections
- **Animations**: Fade-in on scroll, hover transitions (0.3s ease)

---

## UI Components

### Navigation (Header)
- Logo: "NeureCore" with icon
- Links: Home, Industries, CRM Features, About, Contact
- CTA Button: "Apply for Early Access" (orange with glow)
- Sticky on scroll with backdrop blur

### Footer
- Company info
- Quick links
- Legal: Privacy Policy, GDPR
- Social links
- Copyright

### Countdown Bar
- Fixed at bottom
- 30-day countdown timer
- Caption: "Apply for Early Access"
- Orange accent color
- Smooth progress bar animation

### Cards
- White background with subtle grey border
- Hover: lift effect with shadow
- Icon + Title + Description format

### Buttons
- **Primary**: UN Blue background, white text
- **Secondary**: Glowing Champagne Dark Red
- **CTA**: Glowing Orange with glow effect
- **Outline**: Blue border, transparent background

---

## Page Structure

### 1. Home Page (`/`)

#### Hero Section
- Headline: "The Operating System for AI Agents — Built for Enterprise"
- Subheadline: "Orchestrate, govern, and scale AI workforces across your entire organization. Multi-tenant security meets powerful workflow automation."
- CTA: "Apply for Early Access" (primary + glow)
- Secondary CTA: "Watch Demo"
- Abstract tech animation/gradient background

#### Features Overview Section
- 6 feature cards in 3x2 grid:
  1. **AI Agent Orchestration** — Build and manage specialized AI agents for every department
  2. **Enterprise Workflow Automation** — Visual workflow builder with intelligent automation
  3. **Multi-Tenant Security** — Row-level isolation with complete data privacy
  4. **Real-Time Collaboration** — WebSocket-powered chat and agent interaction
  5. **CRM Integration Hub** — Connect HubSpot, Salesforce, Pipedrive seamlessly
  6. **Governance & Compliance** — Built-in approval workflows and audit trails

#### Value Proposition Section
- Headline: "Why Enterprise Leaders Choose NeureCore"
- 4 key differentiators:
  1. **Complete Data Isolation** — Every tenant's data is hermetically sealed
  2. **Agent Memory** — Vector-powered knowledge bases with semantic search
  3. **No-Code Workflows** — Drag-and-drop automation without writing code
  4. **Enterprise-Grade Governance** — Approval chains, budgets, compliance

#### Tech Stack Section
- Headline: "Built on Modern Architecture"
- Icons for: Next.js, Node.js, PostgreSQL, Redis, WebSocket, AI/ML

#### CTA Section
- "Ready to Transform Your Enterprise?"
- Early access form/button

### 2. Industries Page (`/industries`)

#### Hero
- Headline: "AI Solutions Tailored to Your Industry"
- Subhead: "Deploy specialized AI agents across verticals"

#### Industry Cards (6 total)
1. **Financial Services** — Fraud detection, compliance automation, risk analysis
2. **Healthcare** — Patient management, medical coding, appointment scheduling
3. **Retail & E-commerce** — Customer service, inventory management, personalization
4. **Manufacturing** — Supply chain optimization, predictive maintenance, quality control
5. **Technology** — DevOps automation, code review, technical support
6. **Professional Services** — Project management, client onboarding, document automation

Each card: Icon, title, description, 3-4 bullet points

### 3. CRM Features Page (`/crm-features`)

#### Hero
- Headline: "Next-Generation Agentic CRM"
- Subhead: "AI-powered customer relationship management with intelligent automation"

#### Core CRM Features Sections

##### Lead Management
- Intelligent lead scoring
- Automated lead routing
- Lead capture from multiple sources
- Pipeline visualization

##### Contact Management
- Unified contact profiles
- Activity timeline
- Communication history
- Custom fields and tags

##### Deal Management
- Pipeline automation
- Deal progression tracking
- Revenue forecasting
- Win/loss analysis

##### Task Automation
- Auto-created tasks from triggers
- Task assignment to agents
- Due date management
- Priority-based routing

##### Integration Hub
- HubSpot sync
- Salesforce integration
- Pipedrive connection
- Custom API connectors

##### Analytics & Insights
- Conversion metrics
- Sales forecasting
- Agent performance
- ROI tracking

### 4. About Page (`/about`)

#### Hero
- Headline: "Pioneering the Future of Enterprise AI"
- Subhead: "We're building the operating system for the AI workforce era"

#### Mission Section
- Mission statement
- Vision statement

#### Company Story
- Founded context
- Problem we're solving
- Our approach

#### Team Section (without specific people - generic)
- "Our Leadership"
- Philosophy on hiring

#### Technology Section
- Platform highlights
- Security commitment
- Innovation focus

### 5. Contact Page (`/contact`)

#### Hero
- Headline: "Let's Talk Enterprise AI"
- Subhead: "Ready to transform your organization? Get in touch."

#### Contact Form
- Name
- Email
- Company
- Phone (optional)
- Message
- Submit button

#### Alternative Contact
- Email: contact@neurecore.com
- Location: (generic)

### 6. Privacy Policy Page (`/privacy`)

#### Sections
- Introduction
- Information We Collect
- How We Use Information
- Data Sharing
- Data Security
- Your Rights
- Cookies
- Changes to Policy
- Contact

### 7. GDPR Page (`/gdpr`)

#### Sections
- GDPR Overview
- Your Rights Under GDPR
- Data Processing
- Data Retention
- Cross-Border Transfers
- Complaint Process
- Contact DPO

---

## Component States

### Buttons
- Default: Solid background
- Hover: Lighter shade, subtle lift
- Active: Darker shade
- Disabled: Grey, no pointer

### Cards
- Default: White background, subtle border
- Hover: Elevated shadow, slight scale
- Focus: Blue outline

### Form Inputs
- Default: White background, grey border
- Focus: Blue border, subtle glow
- Error: Red border, error message
- Success: Green border

---

## Responsive Breakpoints

- **Mobile**: < 640px
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px

---

## Animations

### Page Load
- Fade in from bottom (0.5s)
- Staggered card reveals (0.1s delay each)

### Scroll Animations
- Elements fade in when entering viewport
- Parallax subtle effect on hero

### Interactions
- Button hover: 0.3s ease
- Card hover: 0.2s ease
- Page transitions: 0.3s

### Countdown Bar
- Smooth progress animation
- Pulse effect on numbers
- Subtle glow animation

---

## Content Tone

### Brand Voice Characteristics
- **Professional**: Enterprise-grade, trustworthy
- **Innovative**: Cutting-edge, forward-thinking
- **Approachable**: Clear, understandable
- **Tempting**: Exciting, compelling

### Messaging Style
- Use powerful verbs
- Highlight transformation
- Emphasize outcomes
- Be specific about capabilities
- Avoid jargon where possible
- Focus on "new concepts of AI"

### Taglines
- "The Operating System for AI Agents"
- "Enterprise-Grade AI Workforce"
- "Intelligence, Orchestrated"
- "Your AI Workforce, Unified"

---

## Acceptance Criteria

### Visual Checkpoints
- [ ] White background throughout
- [ ] Light grey (#F1F5F9) for card backgrounds
- [ ] UN Blue (#1E3A8A) as primary color
- [ ] Glowing Champagne Dark Red (#7F1D1D) for accents
- [ ] Glowing Orange (#EA580C) for CTAs with glow effect
- [ ] Countdown bar visible at bottom with 30-day timer
- [ ] No testimonials or customers sections
- [ ] All features categorized systematically

### Functionality
- [ ] All navigation links work
- [ ] Countdown timer displays correctly
- [ ] Responsive on all breakpoints
- [ ] Form validation on contact page
- [ ] Smooth animations throughout

### Content
- [ ] Every feature from memory-bank included
- [ ] Content is tempting and interesting
- [ ] Brand new AI concepts emphasized
- [ ] All required pages present

---

## Technical Implementation

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **Fonts**: Inter (Google Fonts)
- **Deployment**: Ready for Vercel

---

## File Structure

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   ├── industries/page.tsx
│   ├── crm-features/page.tsx
│   ├── about/page.tsx
│   ├── contact/page.tsx
│   ├── privacy/page.tsx
│   └── gdpr/page.tsx
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   └── CountdownBar.tsx
│   └── sections/
│       ├── Hero.tsx
│       ├── Features.tsx
│       └── ...
└── lib/
    └── utils.ts