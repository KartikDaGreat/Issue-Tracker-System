# Rolling back

The short version: **roll back the code, leave the database alone.**

The two migrations in this change set are additive — they add columns, indexes
and enum values, and drop nothing. The previous build of the app runs correctly
against the migrated schema, so a rollback is a code deploy and nothing else.

---

## Rolling back the application

Production deploys from `main`. The whole change set is a **single commit** on
top of the previous release, so reversing it is one command.

The release that was live before it is tagged `pre-overhaul` (`ef8893d`,
*"fix: Added decreasing order default for issues"*) — that is the rollback
target.

### Fastest: Vercel instant rollback

**Deployments → the last good deployment → Promote to Production.** No rebuild,
no git history change, takes seconds. Use this first if the site looks wrong.
It leaves `main` alone, so you can fix forward afterwards.

### Reverting in git

When you want `main` itself back to the old behaviour:

```bash
git revert --no-edit $(git rev-list pre-overhaul..main)
git push origin main    # redeploys the previous version
```

Deriving the range from the tag rather than hardcoding a SHA means this keeps
working if further commits land on top — it reverts everything added since the
last known-good release.

`revert` is preferred over `reset --hard` + force-push: it is additive, safe on
a shared branch, and leaves the work in history so it can be reapplied later
by reverting the revert.

To inspect or build the old version without touching `main`:

```bash
git checkout pre-overhaul
```

Nothing else is required. Do **not** run the down migration as part of a routine
rollback — see below for why.

---

## Why the database does not need reverting

`20260830120000_audit_edit_and_void_support` adds:

| Table          | Added                                          |
| -------------- | ---------------------------------------------- |
| `Comment`      | `updatedAt`, `editedAt`, `deletedAt`           |
| `InventoryLog` | `updatedAt`, `voidedAt`, `voidReason`, `voidedById` |
| `EventType`    | `SEVERITY_CHANGE`, `DEADLINE_CHANGE`, `EDITED`, `COMMENT_DELETED` |

No column is dropped, renamed, or retyped, so every query the old code issues
still resolves.

`20260831090000_backfill_defaults_for_rollback_safety` exists specifically to
make that true for *writes*. `Comment.updatedAt` and `InventoryLog.updatedAt`
are `NOT NULL`, and Prisma fills `@updatedAt` in the client rather than the
database — so a build from before those columns existed omits them on `INSERT`
and would hit a not-null violation. Commenting and stock logging would break.
That migration adds `DEFAULT CURRENT_TIMESTAMP` to both columns, so Postgres
fills them in when the old client does not send them.

This was verified by issuing old-style `INSERT`s (omitting every new column)
against the migrated database; both succeeded.

### Two cosmetic side effects of rolling back

Neither is data loss, but know about them:

1. **Soft-deleted comments reappear.** The old code has no `deletedAt` filter,
   so any comment deleted through the new UI becomes visible again. The rows
   were never destroyed; rolling forward hides them once more.
2. **Voided stock entries count again.** The old stock maths does not know about
   `voidedAt`, so an item whose bad entry was voided will show its pre-void
   quantity. Again, rolling forward corrects it.
3. **New timeline events read as generic.** A `SEVERITY_CHANGE` or `EDITED`
   event falls through the old timeline's `default:` case and renders as
   *"X performed an action"*. It does not error.

---

## Reverting the schema (last resort)

Only needed if you are abandoning this work permanently and want the columns
gone. **It destroys data**: every soft-deleted comment is restored to the
thread with no record it was deleted, and every void reason is lost.

```bash
psql "$DIRECT_URL" -f prisma/migrations/20260830120000_audit_edit_and_void_support/down.sql
```

Then remove both migration folders and the corresponding rows from
`_prisma_migrations`, or Prisma will report drift on the next deploy.

### The enum values cannot be removed

Postgres has no `ALTER TYPE ... DROP VALUE`. If any `TicketEvent` row already
uses `SEVERITY_CHANGE`, `DEADLINE_CHANGE`, `EDITED` or `COMMENT_DELETED`,
removing the label is impossible without rewriting those rows. The down script
therefore leaves all four in place. Unused enum labels are inert, so this costs
nothing — but it does mean the revert is not byte-for-byte symmetrical.

---

## Taking a backup first

Worth doing before any schema change:

```bash
pg_dump "$DIRECT_URL" --format=custom --file=backup-$(date +%F).dump
```

Supabase also keeps automatic daily backups under **Database → Backups**, and
point-in-time recovery on paid plans.
