# Future Plan

## 1. Inventory Management

### Overview
A new sidebar tab "Inventory" visible to ADMIN and OFFICE_MANAGER roles. The page has two sections: Consumables on top, School Assets below. Staff role is not involved.

### Database Schema

**Resource** (the items themselves):
- `id` - UUID, primary key
- `name` - string, required
- `description` - string, optional
- `type` - enum: CONSUMABLE | SCHOOL_ASSET
- `unit` - string (e.g. "pieces", "boxes", "units")
- `minimumStock` - int, optional (threshold for low-stock warning)
- `createdById` - foreign key to User
- `isActive` - boolean, default true
- `createdAt`, `updatedAt` - timestamps

**ResourceLog** (every addition/removal):
- `id` - UUID, primary key
- `resourceId` - foreign key to Resource
- `action` - enum: ADDED | USED
- `quantity` - int, positive
- `details` - string (notes/reason for usage or addition)
- `dateOfUsage` - date
- `loggedById` - foreign key to User
- `createdAt` - timestamp

### Access Rules

| Action                          | Office Manager | Admin |
|---------------------------------|----------------|-------|
| View inventory                  | Yes            | Yes   |
| Add new resource type           | Yes            | Yes   |
| Delete/deactivate resource type | No             | Yes   |
| Log usage (add/remove stock)    | Yes            | Yes   |

Staff role has no access to inventory.

### Current Stock Calculation
`currentStock` is derived at query time: sum of ADDED quantities minus sum of USED quantities per resource. This keeps a full audit trail with no direct stock edits, only logs.

### UI Design

**Page layout:**
- Two sections separated by headers: "Consumable Resources" and "School Assets"
- Each section shows a table: Name, Description, Current Stock, Unit, Last Updated
- "Add Resource" button at the top opens a dialog to create a new resource type
- "Log Usage" button on each row opens a dialog

**Log Usage / Addition dialog (popup):**
- Action: Added or Used (dropdown)
- Quantity: number input
- Details: text area (reason/notes)
- Date: date picker
- Submit button

**Admin-only controls:**
- Delete/deactivate button per resource type (soft delete via isActive flag)

### API Routes
- `GET /api/inventory` - list resources with computed stock, filtered by type
- `POST /api/inventory` - create a new resource type
- `PATCH /api/inventory/[id]` - update resource or deactivate (admin only for deactivate)
- `GET /api/inventory/[id]/logs` - get logs for a resource
- `POST /api/inventory/[id]/logs` - log a usage or addition

---

## 2. Weekly Ticket Backups to Google Drive

### Overview
A standalone script that runs weekly, exports tickets that have changed since the last backup, and uploads the file to a Google Drive folder.

### Database Schema

**BackupLog:**
- `id` - UUID, primary key
- `fileName` - string
- `ticketCount` - int
- `ranFrom` - datetime (start of backup window)
- `ranTo` - datetime (end of backup window)
- `createdAt` - timestamp

### Google Drive Integration
- Use a Google Service Account with access to a shared folder
- Store credentials in environment variables:
  - `GOOGLE_SERVICE_ACCOUNT_KEY` - JSON key for the service account
  - `GOOGLE_DRIVE_FOLDER_ID` - target folder ID
- Use the `googleapis` npm package for Drive API

### Script: `scripts/weekly-backup.ts`
1. Query the `BackupLog` table for the last backup timestamp (or default to epoch)
2. Fetch all tickets where `updatedAt > lastBackupDate`, including events and comments
3. Export as JSON file named `tickets-backup-YYYY-MM-DD.json`
4. Upload to Google Drive folder via Drive API
5. Insert a new `BackupLog` record

### Backup Content
Each backup file contains:
- All ticket fields for tickets modified since the last backup
- Associated events/comments for those tickets
- Each backup is self-contained for that week's changes

### Scheduling Options
- **Vercel Cron** - add to `vercel.json` with a weekly schedule
- **GitHub Actions** - `.github/workflows/weekly-backup.yml` with `schedule: cron`
- **External cron** - any scheduler that calls the script

### File Naming Convention
`tickets-backup-YYYY-MM-DD.json` (e.g. `tickets-backup-2026-05-20.json`)
