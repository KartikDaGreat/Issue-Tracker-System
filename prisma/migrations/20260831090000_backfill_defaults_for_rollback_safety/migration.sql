-- Makes the previous migration safe to roll the application back over.
--
-- `Comment.updatedAt` and `InventoryLog.updatedAt` are NOT NULL, and Prisma
-- fills `@updatedAt` in the client rather than the database. A build of the app
-- from before those columns existed therefore omits them on INSERT and hits a
-- not-null violation, which would break commenting and stock logging the moment
-- the code was rolled back.
--
-- A database-level default removes that coupling: new code still sends an
-- explicit value, older code lets Postgres fill it in. This is additive and
-- changes no existing row.
ALTER TABLE "Comment"      ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "InventoryLog" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
