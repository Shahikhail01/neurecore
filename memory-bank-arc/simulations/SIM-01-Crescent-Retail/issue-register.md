# Issue Register - SIM-01 Crescent Retail Simulation

## NC-SIM01-001

- Title: Hermes Chat project creation mechanism is non-functional
- Module/page: Home Chat Interface / Hermes AI
- Severity: High
- Priority: P1
- Reproducibility: Always
- Test case: S04-TC06 through S04-TC15
- Environment: Production tenant hq.neurecore.com
- Browser and viewport: Chromium, 1920x1080 and 375px
- Tenant: umarabdullah@gmail.com / accounting-audit-services
- First observed: 2026-07-25 23:xx
- Preconditions: Authenticated session, customer [SIM-01] Crescent Retail exists

### Steps to reproduce
1. Navigate to home page
2. Type "lets create a new Project" in the chat input
3. Wait for AI response asking for project name
4. Provide full project details: "[SIM-01-H] Crescent - FY2026 External Financial Statement Audit for customer [SIM-01] Crescent Retail & Distribution (Pvt.) Ltd., project type Audit Engagement, priority High, target date 2026-09-30"
5. Submit with Enter
6. Observe AI response

### Expected result
Hermes should present a project summary and request explicit confirmation, then create exactly one project after confirmation.

### Actual result
Hermes AI executes findCustomerByName tool successfully but then reports "Executed 0 tool(s) successfully, 1 failed" and never creates the project. No confirmation button or creation mechanism is visible.

### User/business impact
Users cannot create projects through the conversational AI interface, forcing them to use the manual form route. This defeats the core value proposition of the Hermes AI assistant for project creation.

### Evidence
- Screenshots: S04-TC20-hermes-chat-response.png
- Console errors: Socket.IO 400 errors observed
- Failed request/status: Hermes tool execution shows failure

### Recovery/workaround
Use form at /projects/new to create projects manually.

### Frequency and retry result
100% - consistently reproducible across multiple attempts

### Suspected area
Hermes tool execution for createProject may be misconfigured or the tool call is failing silently.

### Acceptance criteria for fix
- [ ] Hermes creates project after explicit user confirmation
- [ ] Success feedback is displayed
- [ ] Project appears in Projects list
- [ ] No error in console related to tool execution

### Retest result
NOT RETESTED

---

## NC-SIM01-002

- Title: Socket.IO polling returns 400 errors throughout session
- Module/page: All pages (WebSocket connection)
- Severity: Medium
- Priority: P2
- Reproducibility: Always
- Test case: All stages
- Environment: Production tenant hq.neurecore.com
- Browser and viewport: Chromium
- Tenant: umarabdullah@gmail.com
- First observed: Stage 0 (login page)
- Preconditions: Authenticated session

### Steps to reproduce
1. Open browser developer console
2. Navigate to any page on hq.neurecore.com
3. Observe console network requests

### Expected result
Socket.IO polling should return 200 or successful responses.

### Actual result
Socket.IO polling requests to /socket.io/?EIO=4&transport=polling return 400 status codes continuously.

### User/business impact
Real-time updates may not be received. Could indicate authentication/session issue with Socket.IO.

### Evidence
- Console errors: Multiple "Failed to load resource: the server responded with a status of 400 ()" for Socket.IO endpoints
- Screenshot references: Observed throughout all stages

### Recovery/workaround
No user-facing impact observed yet, but backend issue may cause missed notifications.

### Frequency and retry result
100% - continuous throughout session

### Suspected area
Known issue D-01. Socket.IO configuration or session handling on backend.

### Acceptance criteria for fix
- [ ] Socket.IO polling returns 200
- [ ] No 400 errors in console

### Retest result
NOT RETESTED

---

## NC-SIM01-003

- Title: Session expires during multi-step form submission
- Module/page: /projects/new form
- Severity: High
- Priority: P1
- Reproducibility: Intermittent
- Test case: S04-TC22 (Project H creation)
- Environment: Production tenant hq.neurecore.com
- Browser and viewport: Chromium
- Tenant: umarabdullah@gmail.com
- First observed: 2026-07-25 23:xx
- Preconditions: Authenticated session started for form creation

### Steps to reproduce
1. Authenticate and navigate to /projects/new
2. Fill in Essentials step and click Continue
3. Fill in Discovery steps (objective, start date, priority, phases, outcome)
4. Click Save answer repeatedly through multiple steps
5. Eventually click "Confirm & Create"
6. Observe redirect to login page

### Expected result
Project should be created and user should remain on project detail page or Projects list.

### Actual result
After multiple form steps, clicking "Confirm & Create" redirects to /login instead of creating the project.

### User/business impact
Users lose work when session expires mid-form. Creates duplicate/racy state where user doesn't know if project was created.

### Evidence
- URL change from /projects/new to /login observed
- Project was actually created despite redirect (found in Projects list)
- Screenshot: S04-TC20-project-h-created-form.png shows project exists

### Recovery/workaround
Re-authenticate and check Projects list. The project is usually created despite the redirect.

### Frequency and retry result
Occurred after approximately 5+ form interactions. May be timeout-based.

### Suspected area
Session timeout too aggressive for multi-step form workflows, or auth token not refreshed during form submission.

### Acceptance criteria for fix
- [ ] Session persists through complete form submission
- [ ] No redirect to login after "Confirm & Create"
- [ ] Clear success feedback before any redirect

### Retest result
NOT RETESTED

---

## NC-SIM01-004

- Title: No visible status transition controls in project detail page
- Module/page: /projects/{id} detail page
- Severity: Medium
- Priority: P2
- Reproducibility: Always
- Test case: S07-TC01
- Environment: Production tenant hq.neurecore.com
- Browser and viewport: Chromium 1920x1080
- Tenant: umarabdullah@gmail.com
- First observed: 2026-07-25 23:xx
- Preconditions: Project in LEAD status

### Steps to reproduce
1. Navigate to Projects list
2. Click on any project (e.g., [SIM-01-D])
3. Observe the project detail page
4. Look for status transition controls (e.g., "Change Status", "Move to Proposal", etc.)

### Expected result
Project detail page should show available status transitions based on current lifecycle state (e.g., LEAD → Proposal Sent → Won → Active → Review → Completed).

### Actual result
No status transition buttons or controls are visible on the project detail page. The status "LEAD" is displayed but there is no UI to change it.

### User/business impact
Users cannot advance projects through lifecycle stages via the UI. This blocks the core project workflow.

### Evidence
- Screenshots: S05-TC22-project-d-workspace.png shows LEAD status with no transition controls
- Project detail page inspection shows no buttons for status change

### Recovery/workaround
Status transitions may only be possible via Hermes Chat or API, not discovered in UI.

### Frequency and retry result
100% - no status transition UI found

### Suspected area
Status transition controls may be hidden, require specific permissions, or be accessible only through a context menu or overflow button not identified.

### Acceptance criteria for fix
- [ ] Visible status transition controls on project detail
- [ ] At minimum: LEAD → Proposal Sent → Won → Active options available
- [ ] Clear feedback on status change

### Retest result
NOT RETESTED
