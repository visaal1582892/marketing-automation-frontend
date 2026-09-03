# Impact Analysis: Changing `capabilities` and `roles` to Auto-Increment IDs

## Executive Summary

Both `roles.role_id` (VARCHAR) and `capabilities.capability_id` (VARCHAR) are used as **semantic string identifiers** throughout the entire application — in every SQL query string, domain model, repository method, service, and controller. Changing either to `INT AUTO_INCREMENT` would require modifying **every single reference** across the codebase because the ID is the primary business key, not just a surrogate.

**Estimated impact: 60-80 file changes minimum** (backend + frontend), plus new Flyway migration with complex data migration steps.

---

## 1. Current Schema (Post All Migrations)

### `roles` table (V1, modified V8)
```sql
role_id VARCHAR(50) NOT NULL PRIMARY KEY   -- values: "ADMIN", "MANAGER", "TEAM_LEADER", "ASSIGNEE", etc.
role_name VARCHAR(200) NOT NULL UNIQUE
status ENUM
```

### `capabilities` table (V9)
```sql
capability_id VARCHAR(50) NOT NULL PRIMARY KEY   -- values: "GRAPHIC_DESIGNER", "PHOTOGRAPHER", etc.
capability_name VARCHAR(200) NOT NULL UNIQUE
status ENUM
```

### `users` table (V1)
- **No `role_id` column** in V1 schema. Roles assigned via `user_roles` junction table.
- `FlywaySchemaRepairRunner` has a safety-net that seeds `user_roles` from `users.role_id` if that column exists (legacy support).

---

## 2. All Tables With Foreign Keys to `roles(role_id)` or `capabilities(capability_id)`

### Foreign Keys → `roles(role_id)`:

| # | Table | Column | Constraint Name | FK Action |
|---|-------|--------|-----------------|-----------|
| 1 | `user_roles` | `role_id` VARCHAR(50) | `fk_ur_role` | CASCADE |
| 2 | `role_rights_mapping` | `role_id` VARCHAR(50) | `fk_role_rights_map_role` | CASCADE |
| 3 | `role_task_mapping` | `role_id` VARCHAR(50) | `fk_rtm_role` | CASCADE |
| 4 | `requirement_role_mapping` | `default_role_id` VARCHAR(50) | `fk_rrm_role` | CASCADE |
| 5 | `qc_routing` | `manager_role_id` VARCHAR(50) | `fk_qcr_manager` | CASCADE |

### Tables referencing `roles(role_id)` without FK constraint:

| # | Table | Column | Type |
|---|-------|--------|------|
| 6 | `notification_templates` | `role_id` VARCHAR(50) NULL | No FK (manual UPDATE in V8) |
| 7 | `approval_flow_levels` | `approver_role_id` VARCHAR(20) | No FK, stores role string |
| 8 | `task_approval_levels` | `approver_role_id` VARCHAR(50) | No FK, stores role string |

### Foreign Keys → `capabilities(capability_id)`:

| # | Table | Column | Constraint Name | FK Action |
|---|-------|--------|-----------------|-----------|
| 9 | `user_capabilities` | `capability_id` VARCHAR(50) | `fk_uc_capability` | CASCADE |
| 10 | `capability_task_mapping` | `capability_id` VARCHAR(50) | `fk_ctm_capability` | CASCADE |
| 11 | `requirement_capability_mapping` | `default_capability_id` VARCHAR(50) | `fk_rcm_capability` | CASCADE |
| 12 | `qc_routing` | `worker_capability_id` (was `worker_role_id`) VARCHAR(20) | `fk_qcr_worker` | CASCADE |

> **Note:** `qc_routing` is bifurcated — `worker_capability_id` → capabilities, `manager_role_id` → roles. The app no longer reads this table (V7), but the schema exists as a safety net.

---

## 3. Migration History (How IDs Evolved)

| Migration | What Changed |
|-----------|-------------|
| **V1** | Original schema: `role_id` VARCHAR(20) PK with **numeric string** values ("2", "3", "4", "5", "6", "7", "8", "10", "11", "12", "14", "15", "16", "18", "19", "20", "21", "22"). No `capabilities` table. `role_task_mapping` maps role→task. `qc_routing` maps worker_role→manager_role (both roles). `notification_templates.role_id` nullable FK to roles. |
| **V8** | Migrated `role_id` from numeric strings ("2") to semantic strings ("MANAGER"). Dropped FKs, widened columns to VARCHAR(50), applied `UPDATE roles SET role_id = REPLACE(UPPER(role_name), ' ', '_')`. FKs recreated with `ON UPDATE CASCADE`. |
| **V9** | Created `capabilities` table (VARCHAR(50) PK). Migrated worker roles → capabilities. Created `ASSIGNEE` IAM role. Renamed `role_task_mapping` → `capability_task_mapping`. Created `user_capabilities` junction. Created `requirement_capability_mapping`. `qc_routing.worker_role_id` → capabilities, `manager_role_id` → roles. |
| **V10** | Cleanup: removed orphans, ensured FKs, cleaned stray roles (REGIONAL_MANAGER, ROLE-1). |
| **V11** | Removed incorrectly inherited manager/budget rights from ASSIGNEE. |

---

## 4. Java Backend Files That Must Change

### 4.1 Domain/Entity Files

| File | Current ID Type | Changes Needed |
|------|----------------|----------------|
| `domain/Role.java` | `private String roleId` | Change to `Long` or keep dual-id |
| `domain/User.java` | `List<String> roleIds` | Change to `List<Long>` |
| `domain/CapabilityTask.java` | `String capabilityId` | Change to `Long` |
| `domain/RequirementCapabilityMapping.java` | `String defaultCapabilityId` | Change to `Long` |
| `domain/RoleTask.java` | `String roleId` | Change to `Long` (legacy) |
| `domain/RoutingRule.java` | `String defaultRoleId` | Change to `Long` |
| `domain/NotificationTemplate.java` | `String roleId` (nullable) | Change to `Long` |
| `domain/approval/ApprovalFlowLevel.java` | `String approverRoleId` | Change to `Long` |
| `domain/approval/TaskApprovalLevel.java` | `String approverRoleId` | Change to `Long` |
| `enums/MasterTableType.java` | `ROLES(stringId=false)`, `CAPABILITIES(stringId=true)` | Both become `stringId=false` |
| `enums/SupportedApproverRole.java` | Hard-coded `"TEAM_LEADER"`, `"MANAGER"` role codes | Would need to store numeric IDs |

### 4.2 Repository Files (Raw SQL — Every Query Must Change)

| File | Reference Count | Key Changes |
|------|----------------|-------------|
| `repository/RoleRepository.java` | ~8 queries | All `WHERE role_id = :roleId` → `WHERE role_id = :roleId` (Long param) |
| `repository/UserRepository.java` | ~15 queries | `JOIN user_roles`, `JOIN user_capabilities`, all ID params become Long |
| `repository/RoutingConfigRepository.java` | ~8 queries | All capability/role routing queries |
| `repository/RightRepository.java` | 1 query | `WHERE rrm.role_id = :roleId` |
| `repository/ApprovalLogRepository.java` | 1 query | `r.role_id = u.role_id` (old users.role_id ref) |
| `repository/NotificationRepository.java` | 1 query | `WHERE role_id = :roleId` |
| `repository/WorkTaskRepository.java` | ~6 queries | `tal.approver_role_id IN (SELECT ur.role_id ...)`, user enrichment |
| `repository/TaskAssignmentRepository.java` | 1 query | `SELECT r.role_name FROM user_roles ur JOIN roles r` |
| `repository/approval/ApprovalFlowLevelRepository.java` | ~3 queries | `approver_role_id` inserts/updates |
| `repository/approval/TaskApprovalLevelRepository.java` | ~4 queries | `approver_role_id` inserts/updates |

### 4.3 Service Files

| File | Changes Needed |
|------|---------------|
| `service/RoutingEngineService.java` | `findActiveCapabilityIdsForTask()` returns `List<Long>`, `findBestAvailableUserInCapability(Long)` |
| `service/RoutingConfigService.java` | All capability/role mapping CRUD use Long IDs |
| `service/UserManagementService.java` | `validateCapabilities()` checks `"ASSIGNEE"` string → would need ID lookup |
| `service/approval/AssigneeTeamLeaderResolver.java` | `WHERE r.role_name = 'Team Leader'` — actually uses **role_name**, not role_id (less impacted) |
| `service/approval/ExistingManagerResolver.java` | `WHERE ur.role_id = :roleId` — uses `level.getApproverRoleId()` as String |

### 4.4 Controller Files

| File | Changes Needed |
|------|---------------|
| `controller/RoleController.java` | `INSERT INTO roles (role_id, ...)` — now auto-gen ID, remove `:id` param. Regex validation `^[A-Z0-9_]+$` becomes irrelevant. |
| `controller/MasterDataController.java` | Generic CRUD — `stringId=false` changes ID generation from user-supplied to auto-increment |
| `controller/RoutingConfigController.java` | Path variables and request bodies use `String capabilityId` → `Long` |

### 4.5 Config Files

| File | Changes Needed |
|------|---------------|
| `config/FlywaySchemaRepairRunner.java` | Safety-net DDL: `VARCHAR(20/50)` → `INT AUTO_INCREMENT` for role_id, capability_id. Also `user_roles`, `user_capabilities`, `qc_routing`, `notification_templates`. |
| `config/DataInitializer.java` | `lookupRoleId(String roleName)` returns `String` → `Long`. Uses `MasterTableType.ROLES`. |

---

## 5. Frontend Files That Must Change

| File | Changes |
|------|---------|
| `src/api/masterData.js` | `roleTaskApi` and `capabilityTaskApi` — `roleId`/`capabilityId` params are strings sent as path/query params. Would become numeric. |
| `src/pages/admin/RoleManagementPage.jsx` | `roleId` displayed as monospace text, used in URL paths (`BASE/${row.roleId}`). Create dialog has `roleId` text input — would become auto-generated (remove input). |
| `src/pages/admin/TaskMappingsPage.jsx` | `capabilityId` used extensively in create/edit dialogs, displayed to users. Heavy dual-format support (`row.capabilityId || row.roleId`). |
| `src/pages/admin/UserManagementPage.jsx` | `roleIds: []` and `capabilityIds: []` arrays of strings. String comparison `roleIds.includes('TEAM_LEADER')` → would need name lookup. |
| `src/pages/admin/NotificationTemplatesPage.jsx` | `roleId` displayed as badge (`Role {roleId}`). |
| `src/api/manager.js` | `capacity(roleId)` query param. |
| `src/pages/admin/ApprovalFlowMasterPage.jsx` | Approver role selection — likely uses role codes. |

---

## 6. Data Migration Complexity

A Flyway migration to add auto-increment IDs would need to:

### For `roles` table:
1. Create new `role_id_seq INT AUTO_INCREMENT` column
2. Populate it: `UPDATE roles SET role_id_seq = AUTO_INCREMENT`
3. For every referencing table, create new `_seq` column, populate with join
4. Drop all FK constraints
5. Drop old `role_id VARCHAR` column, rename `role_id_seq` → `role_id`
6. Recreate all FK constraints with `INT` types
7. **Critical:** `notification_templates.role_id` has a unique key `(event_type, role_id)` — NULL handling changes
8. `approval_flow_levels.approver_role_id` and `task_approval_levels.approver_role_id` — no FK, just data update

### For `capabilities` table:
1. Same pattern: new auto-increment column, populate, migrate references
2. Tables: `user_capabilities`, `capability_task_mapping`, `requirement_capability_mapping`, `qc_routing.worker_capability_id`

### Tables that need column type changes (roles):
- `user_roles.role_id` VARCHAR(50) → INT
- `role_rights_mapping.role_id` VARCHAR(50) → INT
- `role_task_mapping.role_id` VARCHAR(50) → INT
- `requirement_role_mapping.default_role_id` VARCHAR(50) → INT
- `qc_routing.manager_role_id` VARCHAR(50) → INT
- `notification_templates.role_id` VARCHAR(50) NULL → INT NULL
- `approval_flow_levels.approver_role_id` VARCHAR(20) → INT
- `task_approval_levels.approver_role_id` VARCHAR(50) → INT

### Tables that need column type changes (capabilities):
- `user_capabilities.capability_id` VARCHAR(50) → INT
- `capability_task_mapping.capability_id` VARCHAR(50) → INT
- `requirement_capability_mapping.default_capability_id` VARCHAR(50) → INT
- `qc_routing.worker_capability_id` VARCHAR(20) → INT

---

## 7. Hard-Coded String Values (Especially Dangerous)

These are string literals in Java code that compare against role/capability IDs:

| Location | Hard-Coded Value | Type |
|----------|-----------------|------|
| `SupportedApproverRole.TEAM_LEADER` | `"TEAM_LEADER"` | role_id |
| `SupportedApproverRole.MANAGER` | `"MANAGER"` | role_id |
| `UserManagementService.validateCapabilities()` | `"ASSIGNEE"` | role_id |
| `V9/V10 migrations` | List of IAM role names in `NOT IN` clauses | role_id |
| `FlywaySchemaRepairRunner` | Seeds notification template with `role_id = "12"` (REQUESTOR) | role_id |
| `RoleController` | Regex `^[A-Z0-9_]+$` for role_id validation | validation |
| `ApprovalFlowLevelRepository` | Stores `approverRoleId` from `SupportedApproverRole.getRoleCode()` | role_id |
| `AssigneeTeamLeaderResolver` | Queries `r.role_name = 'Team Leader'` | Uses name, less impacted |

---

## 8. API Contract Changes

The REST API exposes role IDs and capability IDs in:
- **Path parameters**: `/api/master/roles/{id}`, `/api/master/capabilities/{id}`
- **Request bodies**: `{ "roleId": "ADMIN", "capabilityId": "GRAPHIC_DESIGNER" }`
- **Response bodies**: `{ "roleId": "ADMIN", "roleName": "Admin" }`
- **Query parameters**: `?roleId=TEAM_LEADER`

Changing to integers breaks any cached API consumers, documentation, and frontend expectations.

---

## 9. Risk Assessment

| Risk | Severity |
|------|----------|
| **Breadth of changes** — 60-80 files touch role_id or capability_id | **CRITICAL** |
| **Raw JDBC SQL** — no ORM to abstract the change; every SQL string must be edited manually | **HIGH** |
| **Hard-coded string comparisons** — `roleIds.includes('TEAM_LEADER')` etc. scattered in service logic | **HIGH** |
| **Data migration** — 12+ table columns need type conversion with FK management | **HIGH** |
| **API contract** — client-facing IDs change from strings to integers | **MEDIUM** |
| **Flyway safety-net** — `FlywaySchemaRepairRunner` creates tables with VARCHAR DDL on every startup | **MEDIUM** |
| **Approval system** — `approver_role_id` stored without FK in 2 tables, populated from `SupportedApproverRole` enum | **HIGH** |
| **Notification templates** — `role_id` in unique key `(event_type, role_id)` with NULL allowed | **MEDIUM** |

---

## 10. Recommendation

**Do NOT convert to auto-increment IDs unless there is a compelling technical reason.** The current approach (VARCHAR semantic IDs) is:
- Self-documenting (logs show `"MANAGER"` not `"3"`)
- Safe across migrations (no ID remapping needed)
- Already working with the decoupled IAM/Capability model

If the goal is to allow arbitrary role names without format restrictions, the VARCHAR approach already supports that. If the goal is database normalization, the cost/benefit ratio is extremely unfavorable for this codebase.

If auto-increment is still required, consider a **dual-key approach**: keep the `VARCHAR` as a unique `role_code` / `capability_code` column and add an `INT AUTO_INCREMENT` internal ID. The codebase transitions gradually by using the internal ID for joins while the string code remains for validation, API contracts, and logging.
