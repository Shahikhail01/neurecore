# Week 15+ Implementation Roadmap

## Current Status

Phase 3 Weeks 13-14 complete with 41 production files and ~7,500 lines of code. All authentication, dashboard layout, and advanced security features implemented. Ready for service integration and advanced feature development.

---

## Week 15: Service Integration (4 days)

### Task 1: Wire AgentPage to useAgents Hook

**Goal:** Replace mock data with real API calls

**Files to Modify:**

- `src/app/dashboard/agents/page.tsx`

**Changes:**

```typescript
// Before
const [agents, setAgents] = useState<Agent[]>([
  { id: '1', name: 'Agent 1', ... },
  // ... mock data
])

// After
const { agents, loading, error, createAgent, updateAgent, deleteAgent } = useAgents()
```

**Steps:**

1. Remove mock data initialization
2. Import useAgents hook
3. Replace mock handlers with real API calls
4. Add loading skeleton (Ant Design Skeleton component)
5. Add error message display
6. Test: create → read → update → delete

**Validation:**

- [ ] Agents load from API on page mount
- [ ] Create agent opens modal, calls createAgent()
- [ ] Edit agent calls updateAgent()
- [ ] Delete agent calls deleteAgent() with confirmation
- [ ] Error messages display on API failure
- [ ] Loading spinner shows while fetching

---

### Task 2: Wire TaskPage to useTasks Hook

**Goal:** Replace mock task data with real API calls

**Files to Modify:**

- `src/app/dashboard/tasks/page.tsx`

**Implementation:**

```typescript
const { tasks, loading, createTask, updateTask, deleteTask, updateTaskStatus } = useTasks()

// Handle status change
const handleStatusChange = async (taskId: string, newStatus: string) => {
  try {
    await updateTaskStatus(taskId, newStatus)
    NotificationService.success('Task status updated')
  } catch (error) {
    NotificationService.error(getErrorMessage(error))
  }
}

// Render select dropdown for status
<Select
  value={task.status}
  onChange={(newStatus) => handleStatusChange(task.id, newStatus)}
  options={[
    { label: 'Open', value: 'open' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Completed', value: 'completed' },
    { label: 'Blocked', value: 'blocked' },
  ]}
/>
```

**Steps:**

1. Replace mock task data with useTasksdata
2. Implement task status dropdown with onChange handler
3. Add assignment field (show agents list when editing)
4. Add loading/error states
5. Handle API failures gracefully

**Validation:**

- [ ] Tasks load from API
- [ ] Status dropdown changes task status immediately
- [ ] Create task modal works
- [ ] Edit task updates all fields
- [ ] Delete task removes from table
- [ ] Bulk operations prepare for Week 16

---

### Task 3: Wire ApprovalPage to useApprovals Hook

**Goal:** Implement real approval workflow

**Files to Modify:**

- `src/app/dashboard/approvals/page.tsx`

**Implementation:**

```typescript
const { approvals, pendingApprovals, approve, reject, requestChanges } =
  useApprovals();

// Separate pending from completed
const pendingList = pendingApprovals;
const completedList = approvals.filter((a) => a.status !== "pending");
```

**Steps:**

1. Display pending approvals in "Action Required" section
2. Show completed approvals in "Approval History" section
3. Implement approve button → approval modal with optional comments
4. Implement reject button → rejection modal with required reason
5. Implement "Request Changes" button → feedback modal
6. Update status in real-time after action

**Validation:**

- [ ] Pending approvals display correctly
- [ ] Approve button shows modal, calls approve()
- [ ] Reject button shows modal, calls reject()
- [ ] Request changes modal works
- [ ] Approval history shows all completed items
- [ ] Status updates immediately after action
- [ ] Audit log created for each action

---

### Task 4: Integration Testing

**Goal:** Verify all three pages work end-to-end

**Test Cases:**

1. Login → navigate to Agents → create agent → verify in list
2. Create task → change status → verify status updated
3. Request approval → approve → verify in history
4. Handle API errors gracefully
5. Session timeout during operation

**Files to Create:**

- `src/__tests__/integration/pages.test.tsx`

---

## Week 16: Advanced Features (5 days)

### Task 1: Bulk Operations

**Goal:** Allow multi-select and batch actions

**Implementation:**

```typescript
// Add selection state
const [selectedIds, setSelectedIds] = useState<string[]>([])

// Bulk delete
const handleBulkDelete = async () => {
  await Promise.all(selectedIds.map(id => deleteAgent(id)))
  setSelectedIds([])
  NotificationService.success(`Deleted ${selectedIds.length} agents`)
}

// Ant Design Table with rowSelection
<Table
  rowSelection={{
    selectedRowKeys: selectedIds,
    onChange: (keys) => setSelectedIds(keys as string[]),
  }}
  columns={columns}
  dataSource={agents}
/>
```

**Features:**

- Multi-select checkbox column
- Select all/deselect all header
- Batch delete with confirmation
- Batch status change (for tasks)
- Batch assignment (for tasks to agents)

**Files:**

- Modify: `agents/page.tsx`, `tasks/page.tsx`, `approvals/page.tsx`

---

### Task 2: Advanced Filtering

**Goal:** Add saved filters and complex search

**Implementation:**

```typescript
// Use RequestFilter utility
const [filter, setFilter] = useState<RequestFilter>(new RequestFilter());

// Build query string
const queryString = filter.buildQueryString();

// Save filter
const [savedFilters, setSavedFilters] = useState<
  Record<string, FilterCriteria>
>({});

const saveFilter = (name: string) => {
  setSavedFilters((prev) => ({
    ...prev,
    [name]: filter.getCriteria(),
  }));
};
```

**Features:**

- Search by text (name, email)
- Filter by status (multi-select)
- Filter by role (multi-select)
- Filter by date range
- Save custom filters
- Load saved filters dropdown

**Files:**

- `src/components/FilterPanel.tsx` (new)
- Modify: `agents/page.tsx`, `tasks/page.tsx`

---

### Task 3: Inline Editing

**Goal:** Edit fields without opening modal

**Implementation:**

```typescript
// Editable cell component
<EditableCell
  value={agent.name}
  onSave={(newValue) => updateAgent(agent.id, { name: newValue })}
  loading={loading}
/>

// Create EditableCell component
export function EditableCell({ value, onSave, loading }: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState(value)

  return editing ? (
    <Input
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      onBlur={async () => {
        await onSave(inputValue)
        setEditing(false)
      }}
    />
  ) : (
    <span onClick={() => setEditing(true)}>{value}</span>
  )
}
```

**Features:**

- Click to edit any text field
- Save on blur or Enter key
- Cancel on Escape key
- Loading indicator while saving
- Rollback on error

**Files:**

- `src/components/EditableCell.tsx` (new)
- Modify: `agents/page.tsx`, `tasks/page.tsx`

---

### Task 4: Real-time Updates (WebSocket)

**Goal:** Live updates when multiple users are viewing same page

**Implementation:**

```typescript
// Create WebSocket hook
export function useRealtimeUpdates(channel: string) {
  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_API_URL, {
      query: { token: authToken },
    });

    socket.on(`${channel}:updated`, (data) => {
      // Update local state
      updateAgents((prev) => prev.map((a) => (a.id === data.id ? data : a)));
    });

    return () => socket.disconnect();
  }, [channel]);
}

// Usage
const { agents } = useAgents();
useRealtimeUpdates("agents");
```

**Features:**

- WebSocket connection pool
- Auto-reconnect on disconnect
- Server-sent events handling
- Conflict resolution (refresh on conflict)
- Performance monitoring

**Files:**

- `src/hooks/useRealtimeUpdates.ts` (new)
- `src/services/websocketService.ts` (new)

---

## Week 17: Analytics & Reporting (4 days)

### Task 1: Install & Configure Recharts

**Goal:** Add interactive charts to analytics page

**Steps:**

1. Install Recharts: `pnpm add recharts`
2. Create chart components
3. Wire to analytics page

**Charts to Implement:**

```typescript
// Task completion trend (line chart)
<LineChart data={trends}>
  <XAxis dataKey="date" />
  <YAxis />
  <Line type="monotone" dataKey="completed" />
</LineChart>

// Agent workload distribution (pie chart)
<PieChart>
  <Pie data={agentStats} />
</PieChart>

// Approval SLA performance (bar chart)
<BarChart data={approvalMetrics}>
  <Bar dataKey="approvalTime" />
</BarChart>
```

**Files:**

- `src/components/charts/TaskTrendChart.tsx` (new)
- `src/components/charts/AgentWorkloadChart.tsx` (new)
- `src/components/charts/ApprovalSLAChart.tsx` (new)
- Modify: `analytics/page.tsx`

---

### Task 2: Export to CSV/PDF

**Goal:** Allow users to export data

**Implementation:**

```typescript
// CSV export
const handleExportCSV = () => {
  const csv = Papa.unparse(agents)
  downloadFile(csv, 'agents.csv', 'text/csv')
}

// PDF export
const handleExportPDF = () => {
  const doc = new jsPDF()
  doc.autoTable({
    head: [['Name', 'Email', 'Role']],
    body: agents.map(a => [a.name, a.email, a.role]),
  })
  doc.save('agents.pdf')
}

// Button
<Button onClick={handleExportCSV}>Export CSV</Button>
<Button onClick={handleExportPDF}>Export PDF</Button>
```

**Libraries:**

- `papaparse` (CSV)
- `jsPDF` + `jspdf-autotable` (PDF)

**Files:**

- `src/utils/exportUtils.ts` (new)
- Modify: `agents/page.tsx`, `tasks/page.tsx`

---

## Week 18: Testing & Polish (4 days)

### Task 1: Unit Tests with Jest + React Testing Library

**Goal:** 80%+ code coverage

**Test Examples:**

```typescript
// Test useAgents hook
describe('useAgents', () => {
  it('should fetch agents on mount', async () => {
    const { result } = renderHook(() => useAgents())
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.agents.length).toBeGreaterThan(0)
  })

  it('should create agent', async () => {
    const { result } = renderHook(() => useAgents())
    const newAgent = await result.current.createAgent({ name: 'Test' })
    expect(result.current.agents).toContainEqual(newAgent)
  })
})

// Test component
describe('AgentPage', () => {
  it('should render agents table', () => {
    render(<AgentPage />)
    expect(screen.getByText('Agents')).toBeInTheDocument()
  })

  it('should open create modal on button click', async () => {
    render(<AgentPage />)
    fireEvent.click(screen.getByText('Create Agent'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
```

**Files:**

- `src/__tests__/hooks/useAgents.test.ts`
- `src/__tests__/components/AgentPage.test.tsx`
- `jest.config.js` (update)
- `src/setupTests.ts` (new)

**Commands:**

```bash
pnpm add -D jest @testing-library/react @testing-library/jest-dom
pnpm test                  # Run tests
pnpm test --coverage       # Show coverage
```

---

### Task 2: E2E Tests with Playwright

**Goal:** Test critical user journeys

**Test Scenarios:**

```typescript
// tests/e2e/auth.spec.ts
test("Login flow", async ({ page }) => {
  await page.goto("http://localhost:3000/login");
  await page.fill('[name="email"]', "user@example.com");
  await page.fill('[name="password"]', "password123");
  await page.click('button:has-text("Login")');
  await page.waitForURL("/dashboard");
  expect(await page.url()).toContain("/dashboard");
});

// tests/e2e/agent.spec.ts
test("Create agent workflow", async ({ page }) => {
  // Login first
  // Navigate to agents
  // Click create
  // Fill form
  // Submit
  // Verify in table
});
```

**Files:**

- `playwright.config.ts` (new)
- `tests/e2e/auth.spec.ts` (new)
- `tests/e2e/agent.spec.ts` (new)
- `tests/e2e/task.spec.ts` (new)

**Commands:**

```bash
pnpm add -D @playwright/test
pnpm exec playwright install
pnpm exec playwright test
```

---

### Task 3: Accessibility Audit

**Goal:** WCAG 2.1 AA compliance

**Tools:**

- axe DevTools (browser extension)
- pa11y (CLI)
- Lighthouse (Chrome DevTools)

**Checklist:**

- [ ] All images have alt text
- [ ] Form inputs have labels
- [ ] Color contrast ≥ 4.5:1 (normal), 3:1 (large)
- [ ] Keyboard navigation works
- [ ] ARIA labels where needed
- [ ] Focus indicator visible
- [ ] No orphaned form fields

**Commands:**

```bash
pnpm add -D pa11y-ci
pa11y-ci http://localhost:3000
```

---

### Task 4: Performance Optimization

**Goal:** Core Web Vitals > 90

**Optimization Tasks:**

1. **Code Splitting**

   ```typescript
   const AdminPanel = dynamic(() => import('@/components/AdminPanel'), {
     loading: () => <LoadingScreen />
   })
   ```

2. **Image Optimization**
   - Use `<Image>` component from next/image
   - Add `srcSet` for responsive sizes
   - Use WebP format

3. **Bundle Analysis**

   ```bash
   pnpm add -D @next/bundle-analyzer
   # Configure in next.config.js
   ```

4. **Data Fetching Optimization**
   - Implement request deduplication
   - Add caching headers
   - Use ISR where applicable

5. **Database Query Optimization**
   - Add indexes on frequently queried fields
   - Implement pagination (limit offset)
   - Use selective field loading

---

## Quality Gates

### Before Week 15 Completion

- [ ] All services wired to pages
- [ ] Loading states implemented
- [ ] Error recovery working
- [ ] Manual testing passed

### Before Week 16 Completion

- [ ] Bulk operations working
- [ ] Filtering saved/loaded
- [ ] Inline editing functional
- [ ] Real-time updates live

### Before Week 17 Completion

- [ ] Charts rendering correctly
- [ ] Export to CSV working
- [ ] Export to PDF working
- [ ] Date range filtering works

### Before Week 18 Completion

- [ ] Unit test coverage ≥ 80%
- [ ] E2E tests passing
- [ ] Accessibility audit passing
- [ ] Lighthouse score ≥ 90

---

## Dependency Installation Schedule

### Week 15

- No new dependencies needed (mock data → real API)

### Week 16

- No new dependencies needed (existing components)

### Week 17

```bash
pnpm add recharts papaparse jspdf jspdf-autotable
```

### Week 18

```bash
pnpm add -D jest @testing-library/react @testing-library/jest-dom
pnpm add -D @playwright/test
pnpm add -D pa11y-ci
pnpm add -D @next/bundle-analyzer
```

---

## Risk Mitigation

### Risk: API changes break frontend

**Mitigation:** Mock backend responses in tests, use versioned API endpoints

### Risk: Performance degradation

**Mitigation:** Monitor Core Web Vitals, add performance regression tests

### Risk: Security vulnerabilities

**Mitigation:** Regular dependency updates, OWASP security audit

### Risk: Accessibility compliance

**Mitigation:** Early and frequent testing, WCAG compliance matrix

---

## Success Criteria

### Week 15 ✅

- All three pages (agents/tasks/approvals) connected to backend
- Real API calls working end-to-end
- Loading/error states functional
- 100% of mock data removed

### Week 16 ✅

- Bulk operations feature working
- Advanced filtering implemented
- Inline editing functional
- Real-time updates live

### Week 17 ✅

- Charts rendering with real data
- Export to CSV/PDF working
- Analytics dashboard complete
- Date range filtering functional

### Week 18 ✅

- Unit test coverage ≥ 80%
- All E2E tests passing
- Accessibility audit passed
- Lighthouse score ≥ 90
- Ready for production deployment

---

## Estimated Timeline

| Week      | Tasks                   | Est. Hours | Status   |
| --------- | ----------------------- | ---------- | -------- |
| 13        | Auth UI + Dashboard     | 40         | ✅ Done  |
| 14        | Advanced Auth + Utils   | 35         | ✅ Done  |
| **15**    | **Service Integration** | **30**     | 📋 Ready |
| **16**    | **Advanced Features**   | **35**     | 📋 Ready |
| **17**    | **Analytics & Export**  | **25**     | 📋 Ready |
| **18**    | **Testing & Polish**    | **40**     | 📋 Ready |
| **Total** | **Phase 3 Complete**    | **~200**   |          |

---

## Continuation Notes

- All Week 15-18 tasks are clearly scoped and independent
- Code examples provided for most implementations
- Mock data removal is priority (Week 15)
- Testing should start in Week 17, not saved for end
- Performance should be monitored continuously

**Next Action:** Start Week 15 Task 1 (AgentPage service integration)
