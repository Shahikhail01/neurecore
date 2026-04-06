# Creatio-inspired UI/UX Plan for NeureCore

Date: 2026-04-06

## Overview

This document captures the visual and interaction patterns observed in the Creatio screenshots and website, maps those patterns to NeureCore's existing frontend codebase, and defines a prioritized, actionable plan to design and implement a Creatio-inspired UI/UX for NeureCore. It includes component-level decisions (reuse vs. re-implement), a design system proposal (tokens + themes), feature-to-UI mapping, Telegram integration design for agent notifications, accessibility notes, and a rollout roadmap.

## Executive summary

- Creatio's UI patterns we want to borrow: clear vertical app navigation, large scenic hero with a central command/search input, a persistent slide-out chat / AI forecast panel, compact typography with high information density, and frosted/glass panels for context overlays. These patterns suit NeureCore's "Operating System for Companies" positioning because they surface high-value actions and conversational interfaces.
- NeureCore already has a strong code foundation: Next.js + Tailwind, modular React components (TopBar, AdminShell, TenantShell, ConversationPanel, CommandPalette, ActivityStream). We should re-use this structure but extract a coherent design system (tokens + components) and standardize theme handling (light/dark) across frontends.
- Priority deliverables: (1) design tokens & theme toggle, (2) home screen (minimal, hero + quick links), (3) unified chat with multi-agent channels & offline Telegram notifications, (4) component library (buttons/cards/modals/sidebar) and refactors to `AdminShell`/`TenantShell`.

## Research findings — Creatio visual patterns (images + site)

- Full-bleed hero with scenic image and centered conversational / command input (see Home_screenx). Large greeting, subtle time/date, central input box prompting user to message AI.
- Left docked vertical navigation with grouped sections, compact icons, and an app grid launcher in the top-left.
- Floating right slide-out chat/forecast panel with translucent background, card-like forecast content and CTA buttons. The chat appears context-aware, shows a short forecast and a message input at the bottom.
- Compact cards, small-caps group headings in the left nav, and tight spacing for dense dashboards.
- Visual style: subtle gradients, glassmorphism (backdrop blur + semi-translucent panels), high-contrast accent colors for CTAs, muted text for metadata.

## Repo assessment — what already exists

- Frontend framework: Next.js + Tailwind (see `frontend-admin` and `frontend-tenant`).
- The repo already contains these important components that map to the plan:
  - `AdminShell` — main admin layout and sidebar: [frontend-admin/src/components/AdminShell.tsx](frontend-admin/src/components/AdminShell.tsx#L1-L300)
  - `ConversationPanel` (admin): [frontend-admin/src/components/chat/ConversationPanel.tsx](frontend-admin/src/components/chat/ConversationPanel.tsx#L1-L400)
  - `ConversationPanel` (tenant): [frontend-tenant/src/components/chat/ConversationPanel.tsx](frontend-tenant/src/components/chat/ConversationPanel.tsx#L1-L400)
  - `TopBar` — header with command trigger: [frontend-admin/src/components/layout/TopBar.tsx](frontend-admin/src/components/layout/TopBar.tsx#L1-L200)
  - Tailwind config with custom `surface` color tokens: [frontend-admin/tailwind.config.js](frontend-admin/tailwind.config.js#L1-L200)

- Observations from code:
  - Chat message rendering already supports suggestion actions, inline tables and metrics, streaming states, and token usage metadata. This is a major win — we can reuse it and expand scope to multi-channel/team chat.
  - Styling is Tailwind-first with custom colors (dark-first palette in `tailwind.config.js`). There is currently no central CSS-variable based token system for easy light/dark flipping.
  - There are duplicate-but-similar chat panels for admin and tenant; these should be consolidated into a single configurable component.

## Design principles for the new UI

1. Prioritize clarity and actionability: each screen should make the next action obvious (commands, quick links, agent tasks).
2. Conversational-first: make chat and command inputs primary interaction surfaces.
3. Responsive & progressive: desktop-first for console, mobile-friendly for essentials.
4. Themeable and accessible: light/dark themes with sufficient color contrast and keyboard navigation.
5. Reuse before rewrite: prefer refactor and composition over full rewrites where code is good.

## Design system & tokens (proposal)

We will implement a central design token file (CSS variables) and wire Tailwind to use those variables. That allows runtime theme switching and avoids duplicate token definitions.

Files to add / change

- Add `frontend-admin/src/styles/design-tokens.css` (and mirror into `frontend-tenant`) that defines a light and dark theme variables set.
- Update `tailwind.config.js` to map color names to CSS variables (e.g., `colors.surface.DEFAULT: 'var(--surface)'`).

Example token set (high-level):

Light theme variables (example):

:root {
--surface: #ffffff;
--surface-raised: #ffffff;
--surface-overlay: rgba(15, 23, 42, 0.04);
--surface-border: #e6e7eb;
--text-primary: #0f1720;
--text-muted: #6b7280;
--accent: #6d28d9; /_ purple/violet _/
--accent-600: #5b21b6;
--success: #16a34a;
--danger: #ef4444;
}

Dark theme variables (example, `.theme-dark` on `html` or `body`):

.theme-dark {
--surface: #09090b;
--surface-raised: #111113;
--surface-overlay: rgba(255,255,255,0.02);
--surface-border: #27272a;
--text-primary: #e6e6e9;
--text-muted: #9ca3af;
--accent: #7c3aed;
}

Tailwind mapping (high-level):

In `tailwind.config.js` replace hard-coded color values with `var()` references so components use tokens (e.g., `bg-surface` -> `bg-surface`). We'll keep theme-aware classes by toggling `.theme-dark` vs `.theme-light` on `html`.

## Component library and reuse decisions

Goal: Create a `ui/` component layer (shared across `frontend-admin` and `frontend-tenant`) containing atomic and compound components. Where existing components are solid, extract and standardize them; where code is duplicated or inconsistent, consolidate.

- Sidebar / Shell (`AdminShell.tsx`) — Refactor (not rewrite)
  - Action: Extract a `Sidebar` component (collapsible, grouped nav, compact icons, optional mini-mode). Keep `AdminShell` as the orchestration wrapper.
  - Rationale: The current `AdminShell` has the nav and layout; extracting improves testability and allows re-use in tenant shell.
  - File reference: [frontend-admin/src/components/AdminShell.tsx](frontend-admin/src/components/AdminShell.tsx#L1-L300)

- TopBar (`TopBar`) — Reuse + extend
  - Action: Add a `ThemeToggle` control, quick command shortcut, and optional tenant switcher.
  - File reference: [frontend-admin/src/components/layout/TopBar.tsx](frontend-admin/src/components/layout/TopBar.tsx#L1-L200)

- Chat (`ConversationPanel`) — Consolidate/extend
  - Action: Merge the admin & tenant `ConversationPanel` implementations into a single `ui/chat/ChatPanel` component (props: `scope: 'tenant'|'admin'`, `channels`, `accentColor`). Add channel switching (All Agents, Agent X, Direct messages), presence indicators, and persistent threaded history per-channel.
  - Rationale: Both panels share core rendering logic (messages, suggestions, tables). Consolidation reduces duplication and makes global improvements faster.
  - File references: [frontend-admin/src/components/chat/ConversationPanel.tsx](frontend-admin/src/components/chat/ConversationPanel.tsx#L1-L400) and [frontend-tenant/src/components/chat/ConversationPanel.tsx](frontend-tenant/src/components/chat/ConversationPanel.tsx#L1-L400)

- Command Palette & Hotkeys — Reuse
  - Action: Keep `CommandPalette` implementation; ensure the palette is styled using design tokens and is accessible to all pages.

- Cards / KPI / Charts — Refactor for tokenized styles
  - Action: Move presentational logic into `ui/Card`, `ui/KPI`, `ui/Chart` components. Reuse charting code but standardize paddings, radii, and colors.

- Agent Card / Brain Map — Reuse then iterate
  - Action: Reuse existing components under `agent-card/` and `brain-map/`. Improve micro-interactions and hover states to match Creatio visuals.

## Home page (hero) — Implementation notes

Design goal: a clean landing screen similar to `Home_screenx.png` with a centered command box and quick links. This replaces heavy dashboard chrome on first access with a focused entry point.

Structure:

- Full-bleed scenic background image or gradient (configurable per tenant).
- Centered greeting ("Hello, <name>!") and a prominent command/chat input with placeholder: "Message to NeureCore.ai".
- Quick-links row or grid below the input with 4–6 common actions (Tenants, Agents, Billing, Create Agent, Templates, Chat).
- Floating bottom-right chat launcher (existing `ConversationPanel` trigger) and top-left app-grid launcher.

Implementation:

- Add `HomeScreen` component to `frontend-tenant` (or admin depending on routing) and style using the new design tokens.

## Chat & Team chat features (detailed)

Functional requirements (summary):

- Multi-channel chat: channels for 'All Agents', per-department channels, and direct messages between users and agents.
- Agent identity: messages must show agent avatar, role, and a context tag (Agent / Human / System).
- Streaming: show partial responses as they stream (already implemented).
- Suggestions and actionable cards: messages can include suggested actions (already implemented).
- Presence & offline handling: if a human is offline, route urgent agent notifications to Telegram (opt-in) and log delivery status.

Implementation plan (chat):

1. Create a shared `ui/chat/ChatPanel` that supports multiple channels and conversation contexts.
2. Update `chatStore` and `useChat` hooks to support channeled history & per-channel unread badges.
3. Add presence/membership metadata to agent and user profiles.
4. Add settings UI where users can opt in to Telegram notifications and configure mapping (agent -> telegram chat / user).

## Telegram integration design (high-level)

Goal: deliver agent notifications to users on Telegram when they're offline, and allow two-way replies from Telegram to NeureCore (optional, phased).

Architecture

- Backend notification adapter that uses the Telegram Bot API.
- Minimal DB table: `telegram_integrations` with fields: `id, tenant_id, user_id, telegram_chat_id, encrypted_bot_token, created_at, last_verified_at, enabled`.
- Message flow:
  - Agent triggers a notification in NeureCore.
  - Notification dispatcher checks user preferences and online presence.
  - If user is offline and Telegram integration enabled, dispatcher calls Telegram adapter to send a concise, structured message (title, summary, CTA link back to NeureCore).
  - Delivery result is persisted in audit logs and the agent activity stream.

API & UI endpoints

- Backend endpoints to implement:
  - `POST /api/integrations/telegram/link` — link a Telegram chat (verify by sending a pin or using OAuth-style flow)
  - `POST /api/integrations/telegram/send` — internal endpoint used by dispatcher to deliver messages
  - `GET /api/integrations/telegram/status` — show linked accounts and last verification date

- Frontend UI:
  - `Settings → Integrations → Telegram` — link/manage Telegram connections, toggle notifications and mapping (Agent -> user mapping)
  - `Agent → Notifications` — per-agent toggle to route messages to Telegram

Security & privacy

- Store bot tokens/encrypted chat credentials in the database encrypted at rest using server-side KMS or application secrets.
- Provide a clear audit trail and opt-out per user. Avoid sending PII over Telegram by default. If content contains sensitive data, require explicit tenant-level opt-in and masking.

Basic message format (example)

Title: "NeureCore — Agent: Meeting Manager"
Body: "Your Meeting Management Agent scheduled 'Leadership Meeting' for Wed 10:00 AM. View or reschedule: <link>"
Buttons (Telegram inline keyboard): [View][Reschedule]

Proof-of-concept implementation notes

- Use `node-telegram-bot-api` or direct HTTPS calls to `https://api.telegram.org/bot<token>/sendMessage`.
- Keep payloads small; include deep links that open the web console (with a short-lived signin token) for quick context.

## Accessibility & Internationalization

- Contrast: verify color tokens against WCAG AA for both light and dark modes.
- Keyboard nav: ensure `CommandPalette`, nav groups, and modal dialogs are fully keyboard-accessible.
- i18n: surface strings via translation JSON files for tenants using `react-intl` or similar.

## Roadmap & prioritized implementation plan

Phase 0 — Discovery & small infra (1 week)

- Finalize token palette and theme toggling approach.
- Create `design-tokens.css` and wire Tailwind to `var()` tokens.

## Implementation progress (so far)

- Added theme variants and runtime toggle: implemented CSS variables in `frontend-admin/src/app/globals.css` and added `useTheme` hooks in both frontends (`frontend-admin/src/hooks/useTheme.ts` and `frontend-tenant/src/hooks/useTheme.ts`). Integrated a simple Theme toggle into both `TopBar` components.
- Extracted the admin `Sidebar` into `frontend-admin/src/components/layout/Sidebar.tsx` and updated `AdminShell` to use it.
- Scaffolded a `HomeHero` component (`frontend-admin/src/components/home/HomeHero.tsx`) and added it to the admin `overview` page as an initial hero/quick-links pilot.
- Telegram integration (backend): added a `TelegramInboxNotifier` (`backend/src/modules/inbox/notifiers/telegram-inbox.notifier.ts`) that will send Telegram messages when `metadata.telegramChatId` is present in inbox items. Also added a `TelegramService` and a test endpoint at `POST /api/v1/integrations/telegram/send-test` via `notifications/telegram.controller.ts`.
- Frontend test UI: added a simple admin settings test page at `frontend-admin/src/app/settings/integrations/telegram/page.tsx` to send a test Telegram message.
- Chat (admin) channel support: extended the admin chat store to support channel-scoped message history and added a channel selector to the admin `ConversationPanel` so messages are stored per-channel.

These changes are intentionally incremental: they create the infrastructure (tokens, theme, notifier adapter, and basic UI scaffolding) so we can iterate quickly on the visual polish and multi-channel chat features next.

Phase 1 — Foundation & theming (1–2 weeks)

- Implement `ThemeToggle` with `useTheme` hook and persist preference in localStorage / profile.
- Add `ui/` folder and begin extracting low-level atoms (Button, Card, Input, Badge).

Phase 2 — Shell & Home Screen (2 weeks)

- Extract `Sidebar` from `AdminShell` and implement new visuals.
- Build `HomeScreen` hero with quick-links.
- Add `TopBar` theme toggle and account menu.

Phase 3 — Chat consolidation & features (2–3 weeks)

- Consolidate `ConversationPanel` → `ChatPanel`.
- Add multi-channel support, presence, unread badges, and per-agent threads.
- Implement messaging hooks for streaming and inline suggestions.

Phase 4 — Telegram integration & automation (2–3 weeks)

- Implement backend adapter + endpoints.
- Frontend settings UI for linking Telegram and toggling per-agent notifications.
- Add audit logging, delivery metrics, and admin controls.

Phase 5 — Polish & rollout (2 weeks)

- Visual polish: transitions, animations, small UX microcopy.
- A/B rollout with feature flags per tenant, finalize docs.

Estimates (rough)

- Token system + theme toggle: 2–3 dev days
- Sidebar + TopBar + Home screen: 4–7 dev days
- Chat consolidation & channels: 7–12 dev days
- Telegram adapter + basic UI: 5–9 dev days
- QA, accessibility, and rollout: 3–5 dev days

Files to touch (initial)

- `frontend-admin/src/components/AdminShell.tsx` — extract `Sidebar` and reuse
- `frontend-admin/src/components/layout/TopBar.tsx` — add `ThemeToggle`
- `frontend-admin/src/components/chat/ConversationPanel.tsx` — merge to new `ui/chat/ChatPanel`
- `frontend-tenant/src/components/chat/ConversationPanel.tsx` — remove duplication after consolidate
- `frontend-admin/tailwind.config.js` — map tokens to CSS variables
- New: `frontend-admin/src/styles/design-tokens.css` and counterpart in `frontend-tenant`
- New: `backend/src/services/telegram.service.ts` + routes for integration linking

## Migration & rollout plan

1. Feature flags: use tenant-level flags to enable the new shell and theme for early adopters.
2. Targeted rollout: pilot with internal tenants and a small external customer.
3. Monitor: instrument UI interactions (command usage, quick link clicks), chat stability, and Telegram delivery metrics.
4. Support: provide a rollback path (old shell toggle) in the short term.

## Next steps (recommended immediate actions)

1. Approve the design-tokens approach (CSS variables + Tailwind mapping).
2. I'll scaffold `design-tokens.css`, add `ThemeToggle` and integrate with `TopBar` in `frontend-admin` (and mirror to tenant).
3. After tokens are in place, extract `Sidebar` and implement `HomeScreen` hero using `Home_screenx.png` as the visual reference.

## Attachments & references

- Reference images (stored in repo):
  - [memory-bank/UI/Public/Images/Home_screenx.png.webp](memory-bank/UI/Public/Images/Home_screenx.png.webp)
  - [memory-bank/UI/Public/Images/Screenshot from 2026-04-05 23-21-40.png](memory-bank/UI/Public/Images/Screenshot from 2026-04-05 23-21-40.png)
  - Full image set: `memory-bank/UI/Public/Images/` (contains Creatio-derived screenshots used as inspiration).

Appendix A — Example: minimal `ThemeToggle` hook (concept)

```ts
// frontend-admin/src/hooks/useTheme.tsx (concept)
import { useEffect, useState } from "react";

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(
    () =>
      ((typeof window !== "undefined" && localStorage.getItem("theme")) as
        | "light"
        | "dark") || "dark",
  );

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove(theme === "dark" ? "theme-light" : "theme-dark");
    root.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
    localStorage.setItem("theme", theme);
  }, [theme]);

  return { theme, setTheme };
}
```

Appendix B — Telegram send example (curl)

```bash
curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{"chat_id":"12345678","text":"NeureCore: Agent completed task X. View: https://app.neurecore.com/t/abc"}'
```

## Closing notes

This plan aims for an incremental, low-risk approach: centralize tokens and theme handling first, then progressively refactor UI components and consolidate chat. Telegram integration is scoped as a discrete backend + settings UI project that plugs into the chat/notification dispatcher. If you approve, I will scaffold the design tokens, theme toggle, and a `ThemeToggle` component in `TopBar`, then extract `Sidebar` and build the `HomeScreen` hero as the next steps.
