import { clsx, type ClassValue } from "clsx";

/** Conditional className helper used throughout the UI. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/** URL-safe, collision-resistant id with an entity prefix (e.g. "dl-9f3a2b1c"). */
export function generateId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36).slice(-4);
  return `${prefix}-${time}${rand}`;
}

/** Safely turn an unknown thrown value into a message string. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unexpected server error";
}
