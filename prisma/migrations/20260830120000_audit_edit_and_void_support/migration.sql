-- Richer ticket audit events (severity/deadline/edit/comment-deletion are no longer
-- all recorded as a generic STATUS_CHANGE).
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'SEVERITY_CHANGE';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'DEADLINE_CHANGE';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'EDITED';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'COMMENT_DELETED';

-- Comments become editable and soft-deletable so history is never destroyed.
ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);
UPDATE "Comment" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "Comment" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3);
ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Comment_ticketId_deletedAt_idx" ON "Comment"("ticketId", "deletedAt");

-- Inventory logs become voidable (a mistyped quantity was previously permanent).
ALTER TABLE "InventoryLog" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);
UPDATE "InventoryLog" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "InventoryLog" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "InventoryLog" ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3);
ALTER TABLE "InventoryLog" ADD COLUMN IF NOT EXISTS "voidReason" TEXT;
ALTER TABLE "InventoryLog" ADD COLUMN IF NOT EXISTS "voidedById" TEXT;

CREATE INDEX IF NOT EXISTS "InventoryLog_itemId_voidedAt_idx" ON "InventoryLog"("itemId", "voidedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InventoryLog_voidedById_fkey'
  ) THEN
    ALTER TABLE "InventoryLog"
      ADD CONSTRAINT "InventoryLog_voidedById_fkey"
      FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
