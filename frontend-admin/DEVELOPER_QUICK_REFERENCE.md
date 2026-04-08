# Developer Quick Reference - Week 14

## Custom Hooks

### useAuth()

```typescript
import { useAuth } from "@/hooks/useAuth";

const {
  user, // Current user { id, email, role, tenantId }
  isAuthenticated, // Boolean
  isLoading, // Boolean while hydrating
  error, // String | null
  login, // (email, password) => Promise<void>
  register, // (email, password, name) => Promise<void>
  logout, // () => void
  changePassword, // (oldPassword, newPassword) => Promise<void>
  requestPasswordReset, // (email) => Promise<void>
  resetPassword, // (token, password) => Promise<void>
} = useAuth();
```

### useAgents()

```typescript
import { useAgents } from "@/hooks/useAgents";

const {
  agents, // Agent[]
  loading, // Boolean
  error, // String | null
  fetchAgents, // () => Promise<void>
  createAgent, // (data: CreateAgentRequest) => Promise<Agent>
  updateAgent, // (id: string, data: UpdateAgentRequest) => Promise<Agent>
  deleteAgent, // (id: string) => Promise<void>
} = useAgents();
```

### useTasks()

```typescript
import { useTasks } from "@/hooks/useTasks";

const {
  tasks, // Task[]
  loading, // Boolean
  error, // String | null
  fetchTasks, // () => Promise<void>
  createTask, // (data: CreateTaskRequest) => Promise<Task>
  updateTask, // (id: string, data: UpdateTaskRequest) => Promise<Task>
  deleteTask, // (id: string) => Promise<void>
  updateTaskStatus, // (id: string, status: string) => Promise<Task>
} = useTasks();
```

### useApprovals()

```typescript
import { useApprovals } from "@/hooks/useApprovals";

const {
  approvals, // Approval[]
  pendingApprovals, // Approval[]
  loading, // Boolean
  error, // String | null
  fetchApprovals, // () => Promise<void>
  fetchPendingApprovals, // () => Promise<void>
  approve, // (id: string, comments: string) => Promise<Approval>
  reject, // (id: string, reason: string) => Promise<Approval>
  requestChanges, // (id: string, feedback: string) => Promise<Approval>
} = useApprovals();
```

### useAuthGuard()

```typescript
import { useAuthGuard } from "@/hooks/useAuthGuard";

const {
  hasRole, // (role: UserRole) => boolean
  hasAnyRole, // (roles: UserRole[]) => boolean
  hasAllRoles, // (roles: UserRole[]) => boolean
  canAccess, // (resource: string, action: string) => boolean
  isAdmin, // () => boolean
  isManagerOrHigher, // () => boolean
  getPermissionLevel, // () => 0 | 1 | 2 | 3
} = useAuthGuard();
```

---

## Components

### ProtectedRoute

```typescript
import { ProtectedRoute } from '@/components/ProtectedRoute'

// Basic usage
<ProtectedRoute requiredRoles={['admin']}>
  <AdminPanel />
</ProtectedRoute>
```

### AdvancedProtectedRoute

```typescript
import { AdvancedProtectedRoute } from '@/components/AdvancedProtectedRoute'

// Role-based
<AdvancedProtectedRoute requiredRoles={['admin', 'manager']} requireAny={true}>
  <Dashboard />
</AdvancedProtectedRoute>

// Permission-based
<AdvancedProtectedRoute
  requiredPermissions={[
    { resource: 'agents', action: 'create' },
    { resource: 'agents', action: 'delete' }
  ]}
>
  <CreateAgentButton />
</AdvancedProtectedRoute>
```

### SessionWarning

```typescript
import { SessionWarning } from '@/components/SessionWarning'

// Add to root layout (already done in app/layout.tsx)
<SessionWarning />
// Shows warning 5 min before token expiry
```

### LoadingScreen

```typescript
import { LoadingScreen } from '@/components/LoadingScreen'

// Full screen
<LoadingScreen tip="Loading..." fullScreen={true} />

// Inline
<LoadingScreen tip="Fetching data..." fullScreen={false} />
```

---

## Utilities

### RequestFilter

```typescript
import { RequestFilter } from "@/utils/requestFilter";

// Build query params
const filter = new RequestFilter()
  .set("search", "john")
  .set("status", ["active", "pending"])
  .set("priority", "high")
  .set("limit", 20)
  .set("offset", 0);

const params = filter.build();
const queryString = filter.buildQueryString();

// Parse query string
import { parseQueryString } from "@/utils/requestFilter";
const criteria = parseQueryString("?search=john&status=active,pending");
```

### APIErrorHandler

```typescript
import {
  getErrorMessage,
  isRetryableError,
  retryRequest,
} from "@/utils/apiErrorHandler";

try {
  await apiCall();
} catch (error) {
  // Get user-friendly message
  const message = getErrorMessage(error);

  // Check if retryable
  if (isRetryableError(error)) {
    await retryRequest(() => apiCall());
  }
}
```

### NotificationService

```typescript
import { NotificationService } from "@/utils/notificationService";

// Toast (centered, short-lived)
NotificationService.success("Agent created");
NotificationService.error("Failed to create agent");
NotificationService.warning("This action cannot be undone");
NotificationService.info("Processing...");

// Alerts (top-right, persistent)
NotificationService.successAlert("Success", "Agent created successfully");
NotificationService.errorAlert("Error", "Failed to create agent");

// Loading
const hide = NotificationService.loading("Processing...");
// ... do work ...
hide();

// Clear all
NotificationService.clearAll();
```

### DateTimeFormatter

```typescript
import { DateTimeFormatter, formatDate } from "@/utils/dateTimeFormatter";

// Format
formatDate("2026-04-08"); // "2026-04-08"
DateTimeFormatter.formatDateTime("2026-04-08T14:30:00"); // "2026-04-08 14:30:00"
DateTimeFormatter.formatCalendar("2026-04-08"); // "Today at 2:30 PM"

// Relative time
DateTimeFormatter.fromNow("2026-04-08T10:00:00"); // "4 hours ago"
DateTimeFormatter.toNow("2026-04-08T18:00:00"); // "in 3 hours"

// Calculations
DateTimeFormatter.getDifference("2026-04-08", "2026-04-01", "day"); // 7
DateTimeFormatter.formatDuration(3661000); // "1h 1m"

// Checks
DateTimeFormatter.isToday("2026-04-08"); // boolean
DateTimeFormatter.isPast("2026-04-08"); // boolean
DateTimeFormatter.isFuture("2026-04-08"); // boolean
```

---

## Common Patterns

### Form with Validation

```typescript
import { Form, Input, Button, message } from 'antd'
import { NotificationService } from '@/utils/notificationService'

function MyForm() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const onFinish = async (values) => {
    setLoading(true)
    try {
      // Make API call
      await apiCall(values)

      // Show success
      NotificationService.success('Success')

      // Reset form
      form.resetFields()
    } catch (error) {
      NotificationService.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form form={form} onFinish={onFinish}>
      <Form.Item name="email" rules={[{ required: true }]}>
        <Input type="email" />
      </Form.Item>
      <Button htmlType="submit" loading={loading}>Submit</Button>
    </Form>
  )
}
```

### Protected Component

```typescript
import { useAuthGuard } from '@/hooks/useAuthGuard'

function AdminPanel() {
  const { isAdmin } = useAuthGuard()

  if (!isAdmin()) {
    return <div>Access denied</div>
  }

  return <div>Admin content</div>
}
```

### CRUD Hook Usage

```typescript
import { useAgents } from '@/hooks/useAgents'
import { NotificationService } from '@/utils/notificationService'

function AgentPage() {
  const { agents, loading, createAgent, updateAgent, deleteAgent } = useAgents()

  const handleCreate = async (data) => {
    try {
      await createAgent(data)
      NotificationService.success('Agent created')
    } catch (error) {
      NotificationService.error(getErrorMessage(error))
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteAgent(id)
      NotificationService.success('Agent deleted')
    } catch (error) {
      NotificationService.error(getErrorMessage(error))
    }
  }

  return (
    <div>
      {loading ? <LoadingScreen /> : null}
      <table>
        {agents.map(agent => (
          <tr key={agent.id}>
            <td>{agent.email}</td>
            <td>
              <button onClick={() => handleDelete(agent.id)}>Delete</button>
            </td>
          </tr>
        ))}
      </table>
    </div>
  )
}
```

### Data Fetching with Error Handling

```typescript
import { useEffect, useState } from 'react'
import { agentService } from '@/services/agentService'
import { getErrorMessage } from '@/utils/apiErrorHandler'

function DataComponent() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const result = await agentService.getAgents('tenant-id')
        setData(result)
      } catch (err) {
        setError(getErrorMessage(err))
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) return <LoadingScreen />
  if (error) return <div>Error: {error}</div>
  return <div>{/* render data */}</div>
}
```

---

## Role Permission Matrix

| Operation       | admin | manager | agent | viewer |
| --------------- | ----- | ------- | ----- | ------ |
| Create Agent    | ✅    | ✅      | ❌    | ❌     |
| Create Task     | ✅    | ✅      | ✅    | ❌     |
| Approve Task    | ✅    | ✅      | ❌    | ❌     |
| View Audit Logs | ✅    | ✅      | ❌    | ❌     |
| Change Password | ✅    | ✅      | ✅    | ✅     |
| View Dashboard  | ✅    | ✅      | ✅    | ✅     |

---

## Type Definitions

### User

```typescript
interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: "admin" | "manager" | "agent" | "viewer";
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}
```

### Agent

```typescript
interface Agent {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}
```

### Task

```typescript
interface Task {
  id: string;
  title: string;
  description: string;
  status: "open" | "in_progress" | "completed" | "blocked";
  priority: "low" | "medium" | "high";
  assigneeId: string;
  createdAt: string;
  updatedAt: string;
}
```

### Approval

```typescript
interface Approval {
  id: string;
  title: string;
  status: "pending" | "approved" | "rejected";
  requestedBy: string;
  approvedBy?: string;
  createdAt: string;
  approvedAt?: string;
}
```

---

## Debugging Tips

### Check Auth State

```typescript
// In browser console
localStorage.getItem("auth-state"); // View stored auth
localStorage.getItem("accessToken"); // View stored token
```

### Check API Requests

```typescript
// Network tab in DevTools
// Look for: POST /api/v1/auth/login
// Response headers: Set-Cookie: refreshToken=...
```

### Check Permissions

```typescript
// In component
const { getPermissionLevel, canAccess } = useAuthGuard();
console.log("Permission level:", getPermissionLevel());
console.log("Can create agents:", canAccess("agents", "create"));
```

### Enable Debug Logging

```typescript
// In authService.ts, uncomment console.log lines
// Or add: localStorage.setItem('DEBUG', 'neurecore:*')
```

---

## Production Checklist

- [ ] Set NEXT_PUBLIC_API_URL to production backend URL
- [ ] Enable HTTPS only (remove localhost from env)
- [ ] Review security headers (Content-Security-Policy, X-Frame-Options)
- [ ] Test token refresh on production
- [ ] Verify audit logging is working
- [ ] Check error tracking (Sentry integration)
- [ ] Test 2FA if enabled
- [ ] Load test with K6 or Artillery
- [ ] Run accessibility audit (axe DevTools)
- [ ] Run bundle analysis (next/bundle-analyzer)
- [ ] Review code coverage with Jest
- [ ] Set up monitoring and alerting
