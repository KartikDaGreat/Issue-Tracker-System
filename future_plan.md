# Future Plan

## 1. Inventory Management (IMPLEMENTED)

### Overview
A new sidebar tab "Inventory" visible to ADMIN, OFFICE_MANAGER, and FACILITIES_MANAGER roles. Staff and other roles have no access.

### Database Schema

**InventoryCategory** (grouping for items):
- `id` - UUID, primary key
- `name` - string, required, unique (e.g. "Lab Equipment", "Classroom Devices", "Stationery", "Furniture")
- `createdAt` - timestamp

**InventoryItem** (the items themselves):
- `id` - UUID, primary key
- `code` - string, required, unique (e.g. "LAB-MICRO-001", "STN-PEN-001")
- `name` - string, required (e.g. "Microscope", "Whiteboard Marker")
- `categoryId` - foreign key to InventoryCategory
- `unit` - string (e.g. "pieces", "boxes", "sets", "reams")
- `createdById` - foreign key to User
- `isActive` - boolean, default true
- `createdAt`, `updatedAt` - timestamps

**InventoryLog** (every addition, usage, or breakage):
- `id` - UUID, primary key
- `itemId` - foreign key to InventoryItem
- `action` - enum: PURCHASED | USED | BROKEN
- `quantity` - int, positive
- `details` - string (reason/notes, e.g. "Purchased 50 pens for office", "Broken during lab session")
- `date` - date (when it happened)
- `loggedById` - foreign key to User
- `createdAt` - timestamp

### Enums

```
enum InventoryAction {
  PURCHASED   // new items added to stock
  USED        // consumable items consumed
  BROKEN      // items damaged/destroyed
}
```

### Stock Calculation
`quantityAvailable` is derived at query time:
```
SUM(PURCHASED quantities) - SUM(USED quantities) - SUM(BROKEN quantities)
```
This keeps a full audit trail — no direct stock edits, only logs.

### Access Rules

| Action                            | Facilities Manager | Office Manager | Admin |
|-----------------------------------|-------------------|----------------|-------|
| View inventory                    | Yes               | Yes            | Yes   |
| Add new inventory item            | Yes               | Yes            | Yes   |
| Add new category                  | Yes               | Yes            | Yes   |
| Delete/deactivate inventory item  | No                | No             | Yes   |
| Delete category                   | No                | No             | Yes   |
| Log purchase (add stock)          | Yes               | Yes            | Yes   |
| Log usage (consumables)           | Yes               | Yes            | Yes   |
| Log breakage                      | Yes               | Yes            | Yes   |

### UI Design

**Page layout:**
- Top: Category filter dropdown + "Add Item" button (all roles) + "Manage Categories" button (admin only)
- Table: Code, Name, Category, Quantity Available, Unit, Last Updated, Actions
- Color-code rows where quantity is 0 (red) or below a reasonable threshold
- Each row has a "Log" button that opens the log dialog

**Add Item dialog (popup):**
- Inventory code: text input
- Name: text input
- Category: dropdown (from InventoryCategory)
- Unit: text input
- Submit button

**Log dialog (popup):**
- Action: Purchased / Used / Broken (dropdown)
- Quantity: number input
- Details: text area (required — what was purchased, why it was used, how it broke)
- Date: date picker (defaults to today)
- Submit button

**Item history view:**
- Click on an item row to see its full log history
- Table: Date, Action, Quantity, Details, Logged By

**Admin-only controls:**
- Deactivate/delete button per item (soft delete via isActive flag)
- "Manage Categories" button opens a dialog to add/remove categories

### API Routes
- `GET /api/inventory` - list items with computed stock, optional category filter
- `POST /api/inventory` - create a new inventory item
- `PATCH /api/inventory/[id]` - update item or deactivate (admin only for deactivate)
- `GET /api/inventory/[id]/logs` - get log history for an item
- `POST /api/inventory/[id]/logs` - log a purchase, usage, or breakage
- `GET /api/inventory/categories` - list all categories
- `POST /api/inventory/categories` - create a category (admin only)
- `DELETE /api/inventory/categories/[id]` - delete a category (admin only, only if no items use it)

### Database Indexes
- `@@index([categoryId])` on InventoryItem
- `@@index([itemId])` on InventoryLog
- `@@index([itemId, action])` on InventoryLog (for stock calculation)

### Implementation Order
1. Prisma schema + migration (models, enums, indexes)
2. Seed some default categories (Lab Equipment, Classroom Devices, Stationery, Furniture, Electronics, Sports Equipment)
3. API routes (categories first, then items, then logs)
4. Sidebar link (visible to ADMIN, OFFICE_MANAGER, FACILITIES_MANAGER)
5. Inventory page (server component for data, client component for filters/dialogs)
6. Log dialog + item history view
7. Admin category management

---

## 2. Checklist Templates (Monthly & Event-Based)

### Overview
Reusable checklist templates for recurring tasks (e.g., "Monthly Bills", "Annual Day Prep"). Each template has a list of task items. When you "run" a template, it generates tickets for each item — tying into the existing ticket workflow. Progress is tracked via a run view.

### Two Template Types

| Type | Example | Trigger |
|------|---------|---------|
| **MONTHLY** | Electricity bill, salary processing, fire extinguisher check | Admin clicks "Run" at start of each month |
| **EVENT** | Annual Day, Sports Day, PTM, Exam Season | Admin clicks "Run" when event is upcoming |

### Database Schema

**ChecklistTemplate** (the reusable template):
- `id` - cuid, primary key
- `name` - string (e.g., "Monthly Bills", "Annual Day Preparation")
- `description` - string, optional
- `type` - enum: MONTHLY | EVENT
- `createdById` - FK to User
- `isActive` - boolean, default true
- `createdAt`, `updatedAt` - timestamps

**ChecklistItem** (a task within a template):
- `id` - cuid, primary key
- `templateId` - FK to ChecklistTemplate
- `title` - string (becomes the ticket title)
- `description` - string, optional (becomes the ticket description)
- `category` - Category enum (FACILITIES_ISSUES, ACADEMICS, etc.)
- `severity` - Severity enum, default MEDIUM
- `defaultAssigneeRole` - Role enum, optional (auto-assign to someone with this role)
- `sortOrder` - int (ordering within the template)

**ChecklistRun** (an instance of running a template):
- `id` - cuid, primary key
- `templateId` - FK to ChecklistTemplate
- `label` - string (e.g., "May 2026", "Annual Day 2026")
- `startedById` - FK to User
- `status` - enum: IN_PROGRESS | COMPLETED
- `createdAt`

**ChecklistRunItem** (links each generated ticket back to the run):
- `id` - cuid, primary key
- `runId` - FK to ChecklistRun
- `checklistItemId` - FK to ChecklistItem
- `ticketId` - FK to Ticket (the generated ticket)

### Enums

```
enum ChecklistType {
  MONTHLY
  EVENT
}

enum ChecklistRunStatus {
  IN_PROGRESS
  COMPLETED
}
```

### Workflow

1. **Create template** — Admin creates "Monthly Utilities" with items: "Pay electricity bill", "Pay water bill", "Internet bill payment"
2. **Run template** — Admin clicks "Run" → enters a label (e.g., "June 2026") → system creates a ticket for each item, auto-assigned by role if configured
3. **Track progress** — The run view shows all generated tickets with their statuses. Progress bar shows how many are closed/acknowledged
4. **Reuse** — Next month, run the same template again with label "July 2026". New tickets, same structure

### Access Rules

| Action | Who |
|--------|-----|
| View templates & runs | ADMIN, PRINCIPAL, OFFICE_MANAGER |
| Create/edit templates | ADMIN, OFFICE_MANAGER |
| Run a template (generate tickets) | ADMIN, OFFICE_MANAGER |
| Delete template | ADMIN only |

### UI Design

**Sidebar:** New "Checklists" link (visible to ADMIN, PRINCIPAL, OFFICE_MANAGER)

**Checklists page — two tabs:**
- **Templates** — list of all templates with name, type badge, item count, last run date, "Run" button
- **Runs** — list of all runs with label, template name, progress (e.g., "4/7 done"), status

**Template detail/edit page:**
- Template name, description, type
- Sortable list of items (title, description, category, severity, default assignee role)
- Add/remove/reorder items

**Run detail view (dialog or page):**
- Header: template name, label, started by, date
- Table of items: title, linked ticket #, status badge, assignee
- Progress bar at top
- "Mark Complete" button when all tickets are closed/acknowledged

### API Routes

- `GET /api/checklists/templates` — list templates
- `POST /api/checklists/templates` — create template
- `GET /api/checklists/templates/[id]` — get template with items
- `PATCH /api/checklists/templates/[id]` — update template
- `DELETE /api/checklists/templates/[id]` — delete template (admin only)
- `POST /api/checklists/templates/[id]/items` — add item to template
- `PATCH /api/checklists/templates/[id]/items/[itemId]` — update item
- `DELETE /api/checklists/templates/[id]/items/[itemId]` — remove item
- `POST /api/checklists/templates/[id]/run` — run template (creates tickets + run record)
- `GET /api/checklists/runs` — list runs with progress
- `GET /api/checklists/runs/[id]` — run detail with tickets
- `PATCH /api/checklists/runs/[id]` — mark run as completed

### Example Templates for a School

**Monthly:**
- Monthly Utilities — Electricity bill, Water bill, Internet bill, Phone bill
- Monthly Maintenance — Fire extinguisher check, Generator servicing, Water tank cleaning, Pest control
- Monthly Admin — Staff salary processing, Attendance report, Stock inventory check

**Event:**
- Annual Day — Book venue, Send parent invites, Arrange decorations, Student rehearsals, Sound system setup, Photography booking
- Exam Season — Print question papers, Arrange seating plan, Assign invigilators, Stationery procurement
- New Academic Year — Textbook orders, Classroom setup, Staff orientation, Timetable preparation, Uniform stock check
- Parent-Teacher Meeting — Schedule slots, Prepare report cards, Arrange seating, Refreshments

### Implementation Order

1. Prisma schema + migration (4 models, 2 enums)
2. API routes — templates CRUD, items CRUD, run creation, run listing
3. Sidebar link (ADMIN, PRINCIPAL, OFFICE_MANAGER)
4. Templates list page + create/edit template page
5. Run template flow (dialog with label input → ticket generation)
6. Runs list + run detail view with progress tracking
7. Seed some example templates

---

## 3. Weekly Ticket Backups to Google Drive (IMPLEMENTED)

Backup system is live. Uses OAuth2 refresh token to upload to Google Drive.
- Weekly automatic via GitHub Actions (Sundays 2AM UTC)
- Full backup mode available via manual trigger
- Also saves as GitHub Actions artifact (90-day retention)
