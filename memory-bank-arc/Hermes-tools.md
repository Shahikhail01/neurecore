# Hermes Tools — Complete Test Results

**Last Updated:** 2026-07-28 12:30 PM
**Total Tools:** 106
**Test Environment:** hq.neurecore.com (Tenant: alipiracha@live.com)

---

## WORKING Tools (31 confirmed)

| # | Tool Name | Status | Test Query | Notes |
|---|-----------|--------|------------|-------|
| 1 | calculator | ✅ WORKING | "Calculate 15 + 27.5" | Returns correct result |
| 2 | query | ✅ WORKING | "How many tasks do we have?" | Returns task count |
| 3 | createProject | ✅ WORKING | "Create a project named Test Hermes Project" | Creates project |
| 4 | listProjects | ✅ WORKING | "Show me all projects" | Returns project list |
| 5 | listAgents | ✅ WORKING | "List all agents" | Returns agent list |
| 6 | listDepartments | ✅ WORKING | "List all departments" | Returns department list |
| 7 | getMyNotifications | ✅ WORKING | "Get my notifications" | Returns notifications |
| 8 | getDashboardSummary | ✅ WORKING | "Get dashboard summary" | Returns dashboard data |
| 9 | listWorkflows | ✅ WORKING | "List all workflows" | Returns workflow list |
| 10 | getActivityFeed | ✅ WORKING | "Get activity feed" | Returns activity |
| 11 | getCompanyProfile | ✅ WORKING | "Get company profile" | Returns company info |
| 12 | getTenantSettings | ✅ WORKING | "Get tenant settings" | Returns tenant settings |
| 13 | listInboxItems | ✅ WORKING | "List all inbox items" | Returns inbox items |
| 14 | listPendingApprovals | ✅ WORKING | "List pending approvals" | Returns approvals |
| 15 | listCustomers | ✅ WORKING | "List customers" | Returns customer list |
| 16 | listGoals | ✅ WORKING | "List all goals" | Returns goals list |
| 17 | getTodayCost | ✅ WORKING | "Get today cost" | Returns today's cost |
| 18 | getOverdueTasks | ✅ WORKING | "Get overdue tasks" | Returns overdue tasks |
| 19 | getMyPendingApprovals | ✅ WORKING | "Get my pending approvals" | Returns pending approvals |
| 20 | getCostByDepartment | ✅ WORKING | "Get cost by department" | Returns cost breakdown |
| 21 | getCostByAgent | ✅ WORKING | "Get cost by agent" | Returns agent cost |
| 22 | getInboxSummary | ✅ WORKING | "Get inbox summary" | Returns inbox summary |
| 23 | getOverdueTaskReport | ✅ WORKING | "Get overdue task report" | Returns report |
| 24 | getTenantSnapshot | ✅ WORKING | "Get tenant snapshot" | Returns snapshot |
| 25 | getTaskStats | ✅ WORKING | "Get task stats" | Returns task statistics |
| 26 | getMyTasks | ✅ WORKING | "Get my tasks" | Returns user's tasks |
| 27 | getCostByProject | ✅ WORKING | "Get cost by project" | Returns project cost |
| 28 | listBudgetPolicies | ✅ WORKING | "List budget policies" | Returns policies |
| 29 | listAllNotifications | ✅ WORKING | "List all notifications" | Returns all notifications |
| 30 | setBudgetAlert | ✅ WORKING | "Set budget alert with threshold 10000" | Sets budget alert |
| 31 | createCustomer | ✅ WORKING | "createCustomer with name Test Customer" | Successfully created customer |

---

## FAILED / NOT CALLED Tools (35 confirmed)

### A. Silent Tool Failures (Backend returns "1 failed")

| # | Tool Name | Status | Failure Reason | Backend Investigation |
|---|-----------|--------|---------------|---------------------|
| 1 | createTask | ❌ FAILED | Tool execution returned "1 failed" | Requires valid agentId/projectId |
| 2 | getProject | ❌ FAILED | Tool execution returned "1 failed" | Requires valid projectId |
| 3 | listProjectMembers | ❌ FAILED | Tool execution returned "1 failed" | Requires valid projectId |
| 4 | updateDepartment | ❌ FAILED | Tool execution returned "1 failed" | Requires valid departmentId |
| 5 | archiveDepartment | ❌ FAILED | Tool execution returned "1 failed" | Requires valid departmentId |
| 6 | deleteDepartment | ❌ FAILED | Tool execution returned "1 failed" | Requires valid departmentId |
| 7 | assignManager | ❌ FAILED | Tool execution returned "1 failed" | Requires valid deptId/agentId |
| 8 | getAgent | ❌ FAILED | Tool execution returned "1 failed" | Requires valid agentId |
| 9 | updateAgent | ❌ FAILED | Tool execution returned "1 failed" | Requires valid agentId |
| 10 | pauseAgent | ❌ FAILED | Tool execution returned "1 failed" | Requires valid agentId |
| 11 | resumeAgent | ❌ FAILED | Tool execution returned "1 failed" | Requires valid agentId |
| 12 | archiveAgent | ❌ FAILED | Tool execution returned "1 failed" | Requires valid agentId |
| 13 | updateProject | ❌ FAILED | Tool execution returned "1 failed" | Requires valid projectId |
| 14 | updateTask | ❌ FAILED | Tool execution returned "1 failed" | Requires valid taskId |
| 15 | assignTask | ❌ FAILED | Tool execution returned "1 failed" | Requires valid taskId/agentId |
| 16 | deleteTask | ❌ FAILED | Tool execution returned "1 failed" | Requires valid taskId |
| 17 | bulkAssignTasks | ❌ FAILED | Tool execution returned "1 failed" | Requires valid taskIds/agentId |
| 18 | updateCustomer | ❌ FAILED | Tool execution returned "1 failed" | Requires valid customerId |
| 19 | archiveCustomer | ❌ FAILED | Tool execution returned "1 failed" | Requires valid customerId |
| 20 | addProjectMemory | ❌ FAILED | Tool execution returned "1 failed" | Requires valid projectId |
| 21 | getCostReport | ❌ FAILED | Tool execution returned "1 failed" | Database query error |

### B. Google Integration Required (Not configured in tenant)

| # | Tool Name | Status | Failure Reason | Backend Investigation |
|---|-----------|--------|---------------|---------------------|
| 22 | calendar | ❌ FAILED | GoogleCalendarService error | Requires Google Calendar integration |
| 23 | documents | ❌ FAILED | GoogleDriveService error | Requires Google Drive integration |
| 24 | sheets | ❌ FAILED | GoogleSheetsService error | Requires Google Sheets integration |
| 25 | reports | ⏸️ HANGING | GoogleDriveService.createFile hanging | Requires Google Drive |

### C. LLM Refusal (LLM explicitly refuses to call tool)

| # | Tool Name | Status | Failure Reason | Backend Investigation |
|---|-----------|--------|---------------|---------------------|
| 26 | email | ❌ LLM_REFUSED | LLM claims "cannot send emails" | Tool exists - LLM not calling |
| 27 | http_request | ❌ LLM_REFUSED | LLM claims "cannot make HTTP requests" | Tool exists - LLM not calling |
| 28 | markAllNotificationsRead | ❌ LLM_REFUSED | LLM says no notification data | Tool exists - LLM not calling |
| 29 | updateCompanyProfile | ❌ LLM_REFUSED | LLM says no company profile data | Tool exists - LLM not calling |
| 30 | markTaskComplete | ❌ LLM_REFUSED | LLM gave long refusal response | Tool exists - LLM not calling |

### D. LLM Routing Issues (LLM calls wrong tool or no tool)

| # | Tool Name | Status | Failure Reason | Backend Investigation |
|---|-----------|--------|---------------|---------------------|
| 31 | searchAgents | ❌ LLM_ANSWERED | LLM answered from training data | Tool exists but LLM used training |
| 32 | getAgentWorkload | ❌ LLM_ROUTED | LLM called listAgents instead | Tool routing confusion |
| 33 | listAgentsByDepartment | ❌ LLM_ROUTED | LLM called listDepartments | Tool routing confusion |
| 34 | listDepartmentMembers | ❌ LLM_ROUTED | LLM called listDepartments | Tool routing confusion |
| 35 | getDepartment | ❌ LLM_ROUTED | LLM called listDepartments | Tool routing confusion |

### E. Tool Called But No Data Available

| # | Tool Name | Status | Notes |
|---|-----------|--------|-------|
| 36 | approveRequest | ⚠️ NO_DATA | Tool called but 0 pending approvals |
| 37 | rejectRequest | ⚠️ NO_DATA | Tool called but 0 pending approvals |
| 38 | bulkApprove | ⚠️ NO_DATA | Tool called but 0 pending approvals |
| 39 | searchProjectMemory | ⚠️ NO_DATA | Tool called but no project memory data |
| 40 | respondToInboxItem | ⚠️ NO_DATA | Tool called but no inbox data |
| 41 | updateGoalProgress | ⚠️ NO_DATA | Tool called but no goals data |

---

## NOT YET TESTED (40 tools)

### Agent Management (4 not tested)
- assignAgentToDepartment
- bulkCreateAgents
- bulkAssignToDepartment
- removeAgentFromProject

### Department Management (0 not tested - all tested or failed)

### Project Management (7 not tested)
- archiveProject
- deleteProject
- cloneProject
- updateProjectStatus
- getProjectByName
- getCustomerProjects
- addProjectMember
- removeProjectMember
- updateProjectStage
- listProjectStages

### Task Management (5 not tested)
- unassignTask
- markTaskInProgress
- reopenTask
- changeTaskPriority
- addSubtask
- listSubtasks
- bulkChangeStatus
- cloneTask

### Approval Workflow (3 not tested)
- bulkReject
- createApprovalRequest
- resubmitApproval
- cancelApprovalRequest
- listMyApprovalHistory

### Customer Management (1 not tested)
- findCustomerByName
- unarchiveCustomer
- listCustomerContacts

### Project Memory (1 not tested)
- updateMemoryConfidence

### Workflows (0 not tested)

### Goals (0 not tested)

### Other Tools (5 not tested)
- contextTool
- explainTool
- calculatorEnhancedTool
- httpRequestEnhancedTool
- chatTool (interface itself)

---

## Summary Statistics

| Category | Count |
|---------|-------|
| Total Tools | 106 |
| Tested | 71 |
| Working | 31 |
| Failed/Not Called | 40 |
| Not Yet Tested | 35 |

### Working Rate: 44% (31/71 tested)
### Failed Rate: 56% (40/71 tested)

---

## Root Cause Analysis

### 1. Most Failures Require Valid IDs
The majority of failures (createTask, getProject, updateDepartment, etc.) are because the LLM is passing fake/test IDs (e.g., "test-id", "agent-123") instead of real database IDs. The tools correctly reject these invalid IDs.

**Solution:** Tests need to use real IDs from the database, or the LLM needs to extract IDs from previously returned data.

### 2. Google Integration Not Configured
Tools requiring Google Calendar, Drive, or Sheets fail because the tenant doesn't have these integrations connected.

**Solution:** Connect Google integrations in tenant settings.

### 3. LLM System Prompt Issues
The LLM refuses to call certain tools (email, http_request, markTaskComplete) because its system prompt tells it these are "action requests" it cannot handle.

**Solution:** Update LLM system prompt to emphasize these are callable tools.

### 4. No Pending Data
Approval tools (approveRequest, rejectRequest, bulkApprove) fail because there are 0 pending approvals in the system.

**Solution:** Create pending approvals first before testing these tools.

### 5. Tool Routing Confusion
Similar tool names cause the LLM to route to the wrong tool (e.g., getDepartment → listDepartments).

**Solution:** Improve tool descriptions with better differentiation.
