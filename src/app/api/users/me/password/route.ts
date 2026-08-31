import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  handler,
  requireSession,
  parseBody,
  badRequest,
  notFound,
  ApiError,
  json,
} from "@/lib/api";
import { BCRYPT_ROUNDS, passwordString } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * Lets a signed-in user change their own password.
 *
 * Previously the only way to change a password was for an admin to reset it,
 * which meant admins necessarily learned every user's password.
 */

const schema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: passwordString,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: "Your new password must be different from the current one.",
    path: ["newPassword"],
  });

export const POST = handler(async (req: NextRequest) => {
  const user = await requireSession();
  const data = await parseBody(req, schema);

  // Bound guessing against the current-password check.
  const ip = clientIp(await headers());
  const limit = rateLimit(`password-change:${user.id}:${ip}`, 5, 15 * 60_000);
  if (!limit.allowed) {
    throw new ApiError(
      429,
      `Too many attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minute(s).`
    );
  }

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { hashedPassword: true },
  });
  if (!record) throw notFound("Your account no longer exists.");

  const valid = await bcrypt.compare(data.currentPassword, record.hashedPassword);
  if (!valid) throw badRequest("Your current password is not correct.");

  await prisma.user.update({
    where: { id: user.id },
    data: {
      hashedPassword: await bcrypt.hash(data.newPassword, BCRYPT_ROUNDS),
    },
  });

  return json({ success: true });
});
