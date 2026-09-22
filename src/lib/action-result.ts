import { z } from "zod";
import { AppError, ValidationError } from "@/lib/errors";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; field?: string };

const GENERIC_ERROR = "Ada yang error nih, coba lagi ya";

/**
 * Turns the first Zod issue into the action's failure shape so the form can
 * highlight the offending field.
 */
export function fromZodError(error: z.ZodError): { ok: false; error: string; field?: string } {
  const issue = error.issues[0];
  const field = issue?.path?.[0];

  return {
    ok: false,
    error: issue?.message ?? GENERIC_ERROR,
    field: typeof field === "string" ? field : undefined,
  };
}

/**
 * Known AppErrors already carry a user-facing Indonesian message. Anything else
 * is logged with its context and reported generically — technical details never
 * reach the client.
 */
export function toActionError(error: unknown, context: string): { ok: false; error: string; field?: string } {
  if (error instanceof z.ZodError) {
    return fromZodError(error);
  }

  if (error instanceof ValidationError) {
    return { ok: false, error: error.message, field: error.field };
  }

  if (error instanceof AppError) {
    return { ok: false, error: error.message };
  }

  console.error(`[${context}]`, error);
  return { ok: false, error: GENERIC_ERROR };
}
