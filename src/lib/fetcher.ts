/**
 * Client-side fetch helper.
 *
 * Every call site used to hand-roll error handling, and several rendered raw
 * JSON at the user (`toast.error(JSON.stringify(err.error))`). This pulls a
 * readable message out of the API's `{ error, details }` shape instead.
 */

export class RequestError extends Error {
  status: number;
  details?: Record<string, string>;

  constructor(status: number, message: string, details?: Record<string, string>) {
    super(message);
    this.name = "RequestError";
    this.status = status;
    this.details = details;
  }
}

async function readError(res: Response): Promise<RequestError> {
  let message = "Something went wrong. Please try again.";
  let details: Record<string, string> | undefined;

  try {
    const body = await res.json();
    if (typeof body?.error === "string") message = body.error;
    if (body?.details && typeof body.details === "object") {
      details = body.details as Record<string, string>;
      const first = Object.values(details)[0];
      // Surface the specific field problem rather than a generic summary.
      if (typeof first === "string" && first) message = first;
    }
  } catch {
    if (res.status === 401) message = "Your session has expired. Please sign in again.";
    else if (res.status === 403) message = "You do not have access to do that.";
    else if (res.status === 404) message = "That item could not be found.";
  }

  return new RequestError(res.status, message, details);
}

export async function apiFetch<T = unknown>(
  input: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) throw await readError(res);

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return (await res.blob()) as T;
  }

  return res.json() as Promise<T>;
}

export function apiJson<T = unknown>(
  input: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown
): Promise<T> {
  return apiFetch<T>(input, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

/** Normalises anything thrown into a message safe to show a user. */
export function errorMessage(err: unknown): string {
  if (err instanceof RequestError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}
