# Plan: Transform Budget Approvals Page

## Overview
Rename "Unified Approvals" to "Top Up Approvals", group topup requests by task_id as cards with task summary info, add bulk approve/reject modal, and make the entire page highly responsive.

## Backend Changes (3 files)

### 1. `TopupTaskGroupResponse.java` — New DTO
Fields: taskId, requestorName, assigneeName, verticalName, taskTypeName, campaignName, totalTopupAmount, topups (List), createdAt

### 2. `BudgetTopupService.java`
New method: `getPendingTopupsGrouped()` — queries pending topups joined with work_tasks for task info, groups by task_id in Java

### 3. `BudgetTopupController.java`
New endpoints:
- GET `/api/budget/topup/pending/grouped`
- POST `/api/budget/topup/bulk-approve` — body: { topupIds: [Long], comments }
- POST `/api/budget/topup/bulk-reject` — body: { topupIds: [Long], comments }

## Frontend Changes (2 files)

### 4. `budgetTopup.js` — New API methods
`getPendingTopUpsGrouped()`, `bulkApproveTopUps()`, `bulkRejectTopUps()`

### 5. `BudgetApprovalsPage.jsx` — Complete redesign
- Tab renamed to "Top Up Approvals"
- Cards grid: `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`
- Each card: task info, requestor, assignee, total amount, state count, actions
- Bulk modal with row checkboxes, select all/clear, remarks
- Fully responsive: header, tabs, tables, modals all mobile-first
