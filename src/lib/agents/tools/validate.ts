/**
 * Argument coercion for tool calls.
 *
 * Models — small local ones especially — send numbers as strings, booleans as
 * "true", and occasionally a JSON blob that never parsed. Coercing here and
 * throwing a specific message keeps a bad argument recoverable: the runtime
 * hands the message back as a tool error and the model retries, instead of the
 * run dying.
 */

export class ToolArgumentError extends Error {}

export function optionalString(
  args: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  throw new ToolArgumentError(`"${key}" must be a string.`);
}

export function requiredString(args: Record<string, unknown>, key: string): string {
  const value = optionalString(args, key);
  if (value === undefined) {
    throw new ToolArgumentError(`"${key}" is required.`);
  }
  return value;
}

export function optionalNumber(
  args: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = args[key];
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new ToolArgumentError(`"${key}" must be a number.`);
  }
  return parsed;
}

/**
 * Coerce to one of a fixed set of values, case-insensitively — models routinely
 * lowercase enum values that the domain types define in title case.
 */
export function optionalEnum<T extends string>(
  args: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T | undefined {
  const value = optionalString(args, key);
  if (value === undefined) return undefined;
  const match = allowed.find((a) => a.toLowerCase() === value.toLowerCase());
  if (!match) {
    throw new ToolArgumentError(
      `"${key}" must be one of: ${allowed.join(", ")}. Received "${value}".`,
    );
  }
  return match;
}
