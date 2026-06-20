/**
 * Thin typed wrapper around the REST API for use in client components.
 * Centralizes fetch + error handling so pages stay declarative.
 */
import type {
  AssistantResponse,
  ContractDetail,
  ContractWithStats,
  CreateContractInput,
  DashboardSummary,
  DeliverableFilters,
  DeliverableWithContext,
  EvidenceWithContext,
  ExtractedDeliverable,
  ExtractionContext,
  RecapView,
  Sponsor,
  UpdateDeliverableInput,
} from "./types";

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* non-JSON error body — keep the default message */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

const jsonHeaders = { "Content-Type": "application/json" };

function toQuery(filters: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const api = {
  dashboard: () => jsonFetch<DashboardSummary>("/api/dashboard"),

  sponsors: () => jsonFetch<Sponsor[]>("/api/sponsors"),

  contracts: () => jsonFetch<ContractWithStats[]>("/api/contracts"),

  contract: (id: string) => jsonFetch<ContractDetail>(`/api/contracts/${id}`),

  createContract: (body: CreateContractInput) =>
    jsonFetch<ContractWithStats>("/api/contracts", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    }),

  extract: (text: string, context: ExtractionContext = {}) =>
    jsonFetch<ExtractedDeliverable[]>("/api/extract", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ text, ...context }),
    }),

  deliverables: (filters: DeliverableFilters = {}) =>
    jsonFetch<DeliverableWithContext[]>(
      `/api/deliverables${toQuery({
        status: filters.status,
        category: filters.category,
        sponsorId: filters.sponsorId,
        contractId: filters.contractId,
        priority: filters.priority,
        search: filters.search,
      })}`
    ),

  updateDeliverable: (id: string, body: UpdateDeliverableInput) =>
    jsonFetch<DeliverableWithContext>(`/api/deliverables/${id}`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    }),

  evidence: () => jsonFetch<EvidenceWithContext[]>("/api/evidence"),

  uploadEvidence: (form: FormData) =>
    jsonFetch<EvidenceWithContext>("/api/evidence", { method: "POST", body: form }),

  recap: (contractId: string) =>
    jsonFetch<RecapView>(`/api/contracts/${contractId}/recap`, { method: "POST" }),

  assistant: (query: string) =>
    jsonFetch<AssistantResponse>("/api/assistant", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ query }),
    }),
};
