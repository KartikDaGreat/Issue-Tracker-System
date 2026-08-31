import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { ZodError, type ZodType } from "zod";
import { authOptions } from "./auth";
import type { Role } from "@prisma/client";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

/**
 * Thrown by route handlers for expected failures. `handler()` turns these into
 * clean JSON responses; anything else becomes a logged, opaque 500 so Prisma
 * internals never leak to the client.
 */
export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, message, details);
export const unauthorized = (message = "You are not signed in.") =>
  new ApiError(401, message);
export const forbidden = (message = "You do not have access to this.") =>
  new ApiError(403, message);
export const notFound = (message = "Not found.") => new ApiError(404, message);
export const conflict = (message: string) => new ApiError(409, message);

function errorResponse(status: number, error: string, details?: unknown) {
  return NextResponse.json(
    details === undefined ? { error } : { error, details },
    { status }
  );
}

/**
 * Wraps a route handler so no unhandled rejection can escape as an opaque
 * framework 500. Previously 12 of 15 routes had no error handling at all, so a
 * bad `sort` param or a missing id produced a raw stack-trace 500.
 */
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<NextResponse>
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ApiError) {
        return errorResponse(err.status, err.message, err.details);
      }

      if (err instanceof ZodError) {
        return errorResponse(400, "Some fields are invalid.", flattenZod(err));
      }

      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        switch (err.code) {
          case "P2002": {
            const target = (err.meta?.target as string[] | undefined)?.join(", ");
            return errorResponse(
              409,
              target
                ? `That ${target} is already in use.`
                : "That value is already in use."
            );
          }
          case "P2003":
            return errorResponse(
              400,
              "That referenced record does not exist."
            );
          case "P2025":
            return errorResponse(404, "That record no longer exists.");
        }
      }

      console.error("[api] unhandled error", err);
      return errorResponse(500, "Something went wrong. Please try again.");
    }
  };
}

/** Turns a ZodError into a flat `{ field: message }` map for form display. */
export function flattenZod(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Parses a JSON body against a schema, raising a 400 ApiError on failure. */
export async function parseBody<T>(
  req: Request,
  schema: ZodType<T>
): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw badRequest("Request body must be valid JSON.");
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw badRequest("Some fields are invalid.", flattenZod(parsed.error));
  }
  return parsed.data;
}

/** Requires a signed-in user; throws 401 otherwise. */
export async function requireSession(): Promise<SessionUser> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw unauthorized();
  return session.user as SessionUser;
}

/** Requires a signed-in user holding one of `roles`; throws 401/403. */
export async function requireRole(
  ...roles: Role[]
): Promise<SessionUser> {
  const user = await requireSession();
  if (!roles.includes(user.role)) throw forbidden();
  return user;
}

export const json = NextResponse.json.bind(NextResponse);
