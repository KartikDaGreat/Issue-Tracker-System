# Future Plan

## 1. Inventory Management

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

## 2. Weekly Ticket Backups to Google Drive (IMPLEMENTED)

Backup system is live. Uses OAuth2 refresh token to upload to Google Drive.
- Weekly automatic via GitHub Actions (Sundays 2AM UTC)
- Full backup mode available via manual trigger
- Also saves as GitHub Actions artifact (90-day retention)
