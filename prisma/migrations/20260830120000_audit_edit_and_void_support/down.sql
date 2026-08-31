-- Reverses 20260830120000_audit_edit_and_void_support.
--
-- NOT needed for an ordinary rollback: the migration is additive and the
-- previous build of the app runs fine against the migrated schema. See
-- docs/ROLLBACK.md. Use this only when abandoning the work permanently.
--
-- DESTRUCTIVE. Dropping "deletedAt" restores every soft-deleted comment to its
-- thread with no record that it was ever removed, and dropping the void columns
-- discards who voided a stock entry and why. Take a backup first:
--   pg_dump "$DIRECT_URL" --format=custom --file=backup.dump

BEGIN;

DROP INDEX IF EXISTS "Comment_ticketId_deletedAt_idx";
DROP INDEX IF EXISTS "InventoryLog_itemId_voidedAt_idx";

ALTER TABLE "InventoryLog" DROP CONSTRAINT IF EXISTS "InventoryLog_voidedById_fkey";

ALTER TABLE "Comment" DROP COLUMN IF EXISTS "deletedAt";
ALTER TABLE "Comment" DROP COLUMN IF EXISTS "editedAt";
ALTER TABLE "Comment" DROP COLUMN IF EXISTS "updatedAt";

ALTER TABLE "InventoryLog" DROP COLUMN IF EXISTS "voidedById";
ALTER TABLE "InventoryLog" DROP COLUMN IF EXISTS "voidReason";
ALTER TABLE "InventoryLog" DROP COLUMN IF EXISTS "voidedAt";
ALTER TABLE "InventoryLog" DROP COLUMN IF EXISTS "updatedAt";

-- The four EventType labels are deliberately left in place: Postgres has no
-- ALTER TYPE ... DROP VALUE, and existing TicketEvent rows may already use
-- them. Unused labels are inert.

COMMIT;
