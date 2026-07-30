# User Roles & Access Control Matrix

**Document Created:** 2026-07-17
**Status:** APPROVED FOR IMPLEMENTATION

---

## Overview

This document defines the role-based access control (RBAC) matrix for NeureCore platform, governing access to Frontend Admin (cc.neurecore.com) and Frontend Tenant (hq.neurecore.com).

### Core Principles

1. **SUPER_ADMIN** has exclusive access to Frontend Admin — no other role may access it
2. **OWNER + ADMIN** are merged with identical privileges on Frontend Tenant
3. **PLATFORM_ADMIN, SECURITY_OFFICER** have full tenant access but no admin access
4. **SUPPORT** has limited read-only access
5. **AUDITOR** has read-only access to audit logs
6. **USER** has standard tenant access

---

## Access Summary

| Role | Frontend Admin (cc.neurecore.com) | Frontend Tenant (hq.neurecore.com) |
|------|-----------------------------------|------------------------------------|
| **SUPER_ADMIN** | ✅ Full Access | ✅ Full Access |
| **PLATFORM_ADMIN** | ❌ No Access | ✅ Full Access |
| **SECURITY_OFFICER** | ❌ No Access | ✅ Full Access |
| **SUPPORT** | ❌ No Access | ✅ Read Access (limited) |
| **OWNER** | ❌ No Access | ✅ Full Access |
| **ADMIN** | ❌ No Access | ✅ Full Access |
| **USER** | ❌ No Access | ✅ Standard Access |
| **AUDITOR** | ❌ No Access | ✅ Read Access (audit logs) |

---

## Detailed Permissions Matrix

| Feature | SUPER_ADMIN | PLATFORM_ADMIN | SECURITY_OFFICER | SUPPORT | OWNER | ADMIN | USER | AUDITOR |
|---------|:-----------:|:--------------:|:----------------:|:-------:|:-----:|:-----:|:----:|:-------:|
| **Admin Settings** | | | | | | | | |
| AI Providers Config | ✅ RW | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Platform Settings | ✅ RW | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Tenant Management | ✅ RW | ✅ R | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| User Management | ✅ RW | ✅ R | ❌ | ✅ R | ✅ RW | ✅ RW | ❌ | ❌ |
| Feature Flags | ✅ RW | ✅ RW | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Brevo Dashboard | ✅ RW | ✅ RW | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Tenant Operations** | | | | | | | | |
| Create Project | ✅ RW | ✅ RW | ✅ RW | ❌ | ✅ RW | ✅ RW | ✅ RW | ❌ |
| Delete Project | ✅ RW | ✅ RW | ✅ RW | ❌ | ✅ RW | ✅ RW | ❌ | ❌ |
| Manage Departments | ✅ RW | ✅ RW | ✅ RW | ❌ | ✅ RW | ✅ RW | ❌ | ❌ |
| Manage Agents | ✅ RW | ✅ RW | ✅ RW | ❌ | ✅ RW | ✅ RW | ❌ | ❌ |
| Create Tasks | ✅ RW | ✅ RW | ✅ RW | ❌ | ✅ RW | ✅ RW | ✅ RW | ❌ |
| Approve Decisions | ✅ RW | ✅ RW | ✅ RW | ❌ | ✅ RW | ✅ RW | ❌ | ❌ |
| **Data Access** | | | | | | | | |
| View Projects | ✅ R | ✅ R | ✅ R | ✅ R | ✅ R | ✅ R | ✅ R | ✅ R |
| View Knowledge Base | ✅ RW | ✅ RW | ✅ RW | ✅ R | ✅ RW | ✅ RW | ✅ R | ✅ R |
| View Audit Logs | ✅ RW | ✅ R | ✅ RW | ❌ | ✅ R | ✅ R | ❌ | ✅ R |
| View Costs/Budget | ✅ RW | ✅ RW | ✅ R | ❌ | ✅ RW | ✅ RW | ❌ | ❌ |
| **Customer Management** | | | | | | | | |
| Manage Customers | ✅ RW | ✅ RW | ❌ | ❌ | ✅ RW | ✅ RW | ✅ R | ❌ |
| Manage Approvals | ✅ RW | ✅ RW | ❌ | ❌ | ✅ RW | ✅ RW | ❌ | ❌ |

---

## Frontend Admin Only Pages (cc.neurecore.com)

| Page/Feature | Access |
|--------------|:------:|
| Dashboard Overview | SUPER_ADMIN |
| Tenant List & Management | SUPER_ADMIN, PLATFORM_ADMIN (read) |
| AI Provider Settings | SUPER_ADMIN |
| Platform Feature Flags | SUPER_ADMIN |
| Brevo Admin Panel | SUPER_ADMIN, PLATFORM_ADMIN |
| Audit Logs (Platform) | SUPER_ADMIN, SECURITY_OFFICER, AUDITOR |
| Support Ticket Queue | SUPER_ADMIN, SUPPORT |

---

## Frontend Tenant Only Pages (hq.neurecore.com)

| Page/Feature | Access |
|--------------|:------:|
| Project Workspace | ALL EXCEPT SUPER_ADMIN |
| AI Workforce / Agents | OWNER, ADMIN, PLATFORM_ADMIN, SECURITY_OFFICER |
| Department Manager | OWNER, ADMIN |
| Knowledge Base | ALL AUTHENTICATED |
| Customer Portal | OWNER, ADMIN, USER |
| Approvals | OWNER, ADMIN, PLATFORM_ADMIN, SECURITY_OFFICER |
| Mission Feed | OWNER, ADMIN |
| Reports & Analytics | OWNER, ADMIN, AUDITOR |

---

## Enum Values

The system uses the following UserRole enum values:

```typescript
enum UserRole {
  SUPER_ADMIN    // Platform-wide admin, access to everything
  PLATFORM_ADMIN // Platform operations, tenant management
  SECURITY_OFFICER // Security monitoring and compliance
  SUPPORT        // Helpdesk, limited read
  OWNER         // Tenant owner, full tenant access
  ADMIN         // Tenant admin, full tenant access (merged with OWNER)
  USER          // Standard tenant user
  AUDITOR       // Read-only audit access
}
```

### Role Hierarchy (Highest to Lowest)

```
SUPER_ADMIN
    │
    ├── PLATFORM_ADMIN
    │       │
    │       └── SECURITY_OFFICER
    │               │
    │               └── SUPPORT
    │
    ├── OWNER ──────┐
    │               ├── ADMIN (merged)
    │               │
    │               ├── USER
    │               │
    │               └── AUDITOR
```

---

## Implementation Notes

### Ownership vs Admin Merge
- OWNER and ADMIN have identical permissions on Frontend Tenant
- Both can create/delete projects, manage departments, manage agents, approve decisions
- ADMIN cannot be demoted to lower roles without OWNER approval

### SUPER_ADMIN Constraints
- SUPER_ADMIN should primarily use Frontend Admin
- When accessing Frontend Tenant, treated as OWNER-level permissions
- SUPER_ADMIN actions on tenant data are logged with `actorRole: SUPER_ADMIN`

### Cross-Tenant Access
- PLATFORM_ADMIN can view all tenants but only modify as needed
- SECURITY_OFFICER has cross-tenant security audit capabilities
- SUPPORT has limited cross-tenant view for ticket resolution

### Audit Trail
- All role-changed actions are logged to `audit_logs` table
- Role elevation requires SUPER_ADMIN approval
- Failed access attempts are logged with `accessResult: DENIED`

---

## File References

- Backend Guard: `src/common/guards/roles.guard.ts`
- Frontend Admin Gate: `frontend-admin/src/middleware/adminAccess.ts`
- Frontend Tenant Gate: `frontend-tenant/src/middleware/tenantAccess.ts`
- RBAC Config: `src/config/rbac.config.ts`

---

**Document Status:** APPROVED
**Implementation Status:** ✅ IMPLEMENTED (2026-07-17)

## Implementation Details (2026-07-17)

### Files Modified

| File | Change |
|------|--------|
| `frontend-admin/src/auth/impl/AuthService.ts` | Changed `ADMIN_ROLES` from `['SUPER_ADMIN', 'PLATFORM_ADMIN', 'SECURITY_OFFICER', 'SUPPORT']` to `['SUPER_ADMIN']` only |
| `frontend-admin/src/auth/hooks/useAdminAuth.ts` | Updated to enforce SUPER_ADMIN only access |
| `frontend-admin/src/auth/hooks/useRequirePlatformAdmin.ts` | Updated to enforce SUPER_ADMIN only |
| `frontend-admin/src/middleware.ts` | **Created** — server-side JWT role check enforcing SUPER_ADMIN-only |
| `frontend-admin/src/app/login/page.tsx` | Added URL param check for `?reason=insufficient` redirect |
| `frontend-tenant/src/auth/hooks/useTenantAuth.ts` | Updated to allow all 8 roles |

### Frontend Admin Access Control

**Before:** Multiple roles could access admin portal (SUPER_ADMIN, PLATFORM_ADMIN, SECURITY_OFFICER, SUPPORT)

**After:** Only SUPER_ADMIN may access Frontend Admin (cc.neurecore.com)

- Server-side middleware checks JWT `role` claim on every request
- Login page shows "Admin portal access restricted to SUPER_ADMIN only" for non-SUPER_ADMIN users
- Client-side hooks provide defense-in-depth

### Frontend Tenant Access Control

All 8 roles can access Frontend Tenant (hq.neurecore.com):
- SUPER_ADMIN, PLATFORM_ADMIN, SECURITY_OFFICER, SUPPORT
- OWNER, ADMIN, USER, AUDITOR

### Backend RBAC

Backend `RolesGuard` and `@Roles()` decorators were already correctly implemented:
- Enum comparison works correctly at runtime
- All role-based access properly enforced at API level

### Notes

- API 403 errors during testing were due to **CSRF protection** (`CSRF_ENABLED=true`), not role bugs
- Browser SPAs handle CSRF automatically via `X-CSRF-Token` header
- Direct API calls need manual CSRF token handling
