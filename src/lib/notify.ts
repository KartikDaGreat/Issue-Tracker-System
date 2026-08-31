import type { Prisma } from "@prisma/client";

/**
 * Single place where in-app notifications are created.
 *
 * Notification fan-out used to be copy-pasted across four routes, each with its
 * own "don't notify the actor" filter. Centralising it also gives email
 * delivery one seam to hook into when that is turned on later — see
 * `deliverExternal` below.
 */

export interface NotifyInput {
  /** Users to notify. Duplicates and the actor are removed automatically. */
  recipientIds: (string | null | undefined)[];
  /** The user performing the action; never notified about their own action. */
  actorId: string;
  message: string;
  link?: string;
}

type TxClient = Prisma.TransactionClient;

/**
 * Creates notifications inside an existing transaction. Returns the recipient
 * ids that were actually notified.
 */
export async function notify(
  tx: TxClient,
  { recipientIds, actorId, message, link }: NotifyInput
): Promise<string[]> {
  const recipients = Array.from(
    new Set(
      recipientIds.filter(
        (id): id is string => typeof id === "string" && id.length > 0
      )
    )
  ).filter((id) => id !== actorId);

  if (recipients.length === 0) return [];

  await tx.notification.createMany({
    data: recipients.map((userId) => ({ message, link, userId })),
  });

  return recipients;
}

/**
 * Placeholder for out-of-band delivery (email/SMS).
 *
 * Email notification on assignment and status change is a decided-but-deferred
 * feature: the transport has not been chosen yet, so nothing is sent. Wire the
 * chosen provider up here and call it from the routes after their transaction
 * commits — deliberately outside the transaction, so a provider outage can
 * never roll back a ticket update.
 */
export async function deliverExternal(): Promise<void> {
  // Intentionally a no-op until an email transport is configured.
}
