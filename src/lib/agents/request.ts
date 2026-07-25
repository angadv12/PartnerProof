/**
 * Validation for agent run requests arriving over HTTP.
 *
 * Kept out of the route handlers so the streaming endpoint and the plain JSON
 * endpoint enforce identical rules.
 */
import { isAttachableKey, sanitizeKey } from "../storage";
import { isProviderId } from "./types";
import type { RunAttachment, StartRunInput } from "./types";
import { getWorkflow } from "./workflows";

export class BadRequestError extends Error {}

/** Guards against a giant prompt blowing past the model's context. */
const MAX_PROMPT_CHARS = 20_000;

const MAX_ATTACHMENTS = 5;

/**
 * Per-field caps on attachment metadata.
 *
 * These strings are persisted verbatim on the run record and rewritten into
 * db.json on every save, so an unbounded `fileName` is not just a prompt
 * problem — a request carrying megabytes of metadata would bloat the store
 * permanently. Real values are far below these limits; the keys are
 * server-generated and the names come from a filesystem.
 */
const MAX_KEY_CHARS = 300;
const MAX_FILE_NAME_CHARS = 255;
const MAX_CONTENT_TYPE_CHARS = 128;

function boundedField(
  value: string,
  limit: number,
  field: string,
  index: number,
): string {
  if (value.length > limit) {
    throw new BadRequestError(
      `attachments[${index}].${field} is too long (limit ${limit} characters).`,
    );
  }
  return value;
}

function parseAttachment(value: unknown, index: number): RunAttachment {
  if (!value || typeof value !== "object") {
    throw new BadRequestError(`attachments[${index}] must be an object.`);
  }
  const raw = value as Record<string, unknown>;
  const rawKey = typeof raw.key === "string" ? raw.key.trim() : "";
  const fileName = typeof raw.fileName === "string" ? raw.fileName.trim() : "";
  if (!rawKey || !fileName) {
    throw new BadRequestError(`attachments[${index}] requires "key" and "fileName".`);
  }
  boundedField(rawKey, MAX_KEY_CHARS, "key", index);
  boundedField(fileName, MAX_FILE_NAME_CHARS, "fileName", index);

  // The key comes from the client and `read_attachment` reads whatever it names,
  // so it has to be normalized and confined to the agent-upload prefix — an
  // unchecked key would let a run read any object in the bucket.
  let key: string;
  try {
    key = sanitizeKey(rawKey);
  } catch {
    throw new BadRequestError(`attachments[${index}] has an invalid key.`);
  }
  if (!isAttachableKey(key)) {
    throw new BadRequestError(
      `attachments[${index}] must reference a file uploaded through /api/uploads.`,
    );
  }

  const contentType =
    typeof raw.contentType === "string" && raw.contentType.trim()
      ? raw.contentType.trim()
      : "application/octet-stream";
  boundedField(contentType, MAX_CONTENT_TYPE_CHARS, "contentType", index);

  // A negative or non-finite size would render as nonsense in the manifest.
  const rawSize = typeof raw.size === "number" ? raw.size : Number(raw.size);
  const size = Number.isFinite(rawSize) && rawSize > 0 ? Math.floor(rawSize) : 0;

  return { key, fileName, contentType, size };
}

export function parseStartRunInput(body: unknown): StartRunInput {
  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body must be a JSON object.");
  }
  const raw = body as Record<string, unknown>;

  const input = typeof raw.input === "string" ? raw.input.trim() : "";
  if (!input) {
    throw new BadRequestError("A prompt is required.");
  }
  if (input.length > MAX_PROMPT_CHARS) {
    throw new BadRequestError(`Prompt is too long (limit ${MAX_PROMPT_CHARS} characters).`);
  }

  const workflowId = typeof raw.workflowId === "string" ? raw.workflowId.trim() : "";
  if (!workflowId || !getWorkflow(workflowId)) {
    throw new BadRequestError(`Unknown workflow "${workflowId}".`);
  }

  let provider: StartRunInput["provider"];
  if (raw.provider !== undefined && raw.provider !== null && raw.provider !== "") {
    if (!isProviderId(raw.provider)) {
      throw new BadRequestError(`Unknown provider "${String(raw.provider)}".`);
    }
    provider = raw.provider;
  }

  const model = typeof raw.model === "string" && raw.model.trim() ? raw.model.trim() : undefined;

  let attachments: RunAttachment[] | undefined;
  if (raw.attachments !== undefined) {
    if (!Array.isArray(raw.attachments)) {
      throw new BadRequestError('"attachments" must be an array.');
    }
    if (raw.attachments.length > MAX_ATTACHMENTS) {
      throw new BadRequestError(`At most ${MAX_ATTACHMENTS} attachments per run.`);
    }
    attachments = raw.attachments.map(parseAttachment);
  }

  return { workflowId, input, provider, model, attachments };
}
