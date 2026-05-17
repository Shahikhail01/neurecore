# Demo Credentials — NeureCore (May 2026)

> **Security Notice:** These credentials are for local development and demo environments only.
> Never commit real credentials to version control. All passwords below are sample values.

---

## Tiers Overview

| Tier | Purpose | Example Tenant |
|---|---|---|
| **Enterprise** | Full platform access, unlimited agents, priority support | `acme-corp` |
| **Growth** | Advanced features, up to 50 agents, full analytics | `scaleup-io` |
| **Pro** | Core features, up to 10 agents, standard support | `neurecore-demo` |
| **Starter** | Basic access, up to 3 agents, community support | `starter-team` |
| **Admin** | Platform-wide superuser — bypasses tenant isolation | `noreply@neurecore.ai` |

---

## Enterprise Tier

| Field | Value |
|---|---|
| **Tenant ID** | `acme-corp` |
| **Tenant Name** | Acme Corporation |
| **Admin Email** | `admin@acme-corp.example.com` |
| **Admin Password** | `Enterprise@2026!` |
| **Login URL** | `http://localhost:3001/login` |

---

## Growth Tier

| Field | Value |
|---|---|
| **Tenant ID** | `scaleup-io` |
| **Tenant Name** | ScaleUp IO |
| **Admin Email** | `admin@scaleup-io.example.com` |
| **Admin Password** | `Growth@2026!` |
| **Login URL** | `http://localhost:3001/login` |

---

## Pro Tier

| Field | Value |
|---|---|
| **Tenant ID** | `neurecore-demo` |
| **Tenant Name** | NeureCore Demo |
| **Admin Email** | `admin@neurecore-demo.example.com` |
| **Admin Password** | `Pro@2026!` |
| **Login URL** | `http://localhost:3001/login` |

---

## Starter Tier

| Field | Value |
|---|---|
| **Tenant ID** | `starter-team` |
| **Tenant Name** | Starter Team |
| **Admin Email** | `admin@starter-team.example.com` |
| **Admin Password** | `Starter@2026!` |
| **Login URL** | `http://localhost:3001/login` |

---

## Platform Admin (Superuser)

| Field | Value |
|---|---|
| **Email** | `noreply@neurecore.ai` |
| **Password** | `Admin@2026!` |
| **Login URL** | `http://localhost:3001/login` |
| **Notes** | Bypasses tenant isolation. Use only for platform administration. |

---

## Agent Test Accounts (cross-tier)

| Email | Password | Role |
|---|---|---|
| `agent-01@acme-corp.example.com` | `Agent@2026!` | Enterprise Agent |
| `agent-02@scaleup-io.example.com` | `Agent@2026!` | Growth Agent |
| `agent-03@neurecore-demo.example.com` | `Agent@2026!` | Pro Agent |
| `agent-04@starter-team.example.com` | `Agent@2026!` | Starter Agent |

---

## How to Seed These Accounts

```bash
cd backend

# Seed platform admin
node scripts/make-superadmin.cjs noreply@neurecore.ai Admin@2026!

# Seed tenant templates
node prisma/seed-platform-templates.cjs
```

---

## Password Policy

- Minimum 8 characters
- At least one uppercase letter
- At least one number
- At least one special character (`!@#$%^&*`)