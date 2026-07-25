/**
 * Workflow definitions.
 *
 * A workflow is a named agent configuration: which tools it may call, what its
 * assignment is, and how many tool-calling steps it gets. The platform system
 * prompt is prepended to every one of these by the runtime — `instructions`
 * here only ever appends a role.
 */
import { allToolNames, getTool } from "./tools";

export interface WorkflowDefinition {
  id: string;
  label: string;
  description: string;
  /** Role-specific text appended to the platform system prompt. */
  instructions: string;
  toolNames: string[];
  /** Tool-calling rounds before the runtime forces a final answer. */
  maxSteps: number;
  /** Shown in the UI as a starting point. */
  samplePrompt: string;
  /** Whether this workflow expects an uploaded file. */
  expectsAttachment?: boolean;
}

/** Platform data reads. Trusted input — everything here comes from our own store. */
const DATA_TOOLS = [
  "list_contracts",
  "get_contract",
  "search_deliverables",
  "get_dashboard",
  "list_evidence",
];

/**
 * Reading an attachment pulls untrusted text into the context, where a
 * malicious document can try to steer the agent. Prompt wording alone is not a
 * defense, so a workflow gets `read_attachment` **or** write tools, never both:
 * an injected instruction then has nothing to reach for. Workflows that need to
 * act on a document propose changes for a human to apply.
 */
const ATTACHMENT_TOOLS = [...DATA_TOOLS, "read_attachment"];

export const WORKFLOWS: WorkflowDefinition[] = [
  {
    id: "partnership-analyst",
    label: "Partnership analyst",
    description:
      "Answers questions about obligations, delivery status, and sponsor health using live platform data.",
    instructions: `Answer questions about the team's sponsorship portfolio.

Start by looking up the data you need — do not answer from the question alone. For status questions, search deliverables with the tightest filter that fits. For "how are we doing" questions, use the dashboard roll-up rather than counting rows yourself.

Close with the concrete number the user is actually deciding on: how many obligations are outstanding, what percentage is fulfilled, which sponsor needs attention.`,
    toolNames: ATTACHMENT_TOOLS,
    maxSteps: 8,
    samplePrompt: "What do we still owe Pepsi this season, and what is at risk?",
  },
  {
    id: "risk-audit",
    label: "Risk audit",
    description:
      "Sweeps the portfolio for at-risk and missed obligations, then proposes make-goods per sponsor.",
    instructions: `Audit the portfolio for delivery risk.

Find every obligation that is At Risk or Missed, group them by sponsor, and assess exposure — weight by contract value and how close the season end is. For each sponsor with a problem, propose a specific make-good tied to an activation category the team actually runs.

Do not modify any records. This is an assessment; the user decides what to act on.

Output: a short exposure summary, then one section per affected sponsor with the specific obligations and your proposed make-good.`,
    toolNames: ATTACHMENT_TOOLS,
    maxSteps: 12,
    samplePrompt: "Audit the whole portfolio for delivery risk before the season ends.",
  },
  {
    id: "recap-writer",
    label: "Recap writer",
    description:
      "Builds a sponsor recap report grounded in the delivery record and captured evidence.",
    instructions: `Produce a renewal-ready recap for one contract.

Look up the contract, its deliverables, and its evidence before writing a word. Every claim in the recap must trace to a delivered obligation or an evidence item you actually retrieved. Once you have the data, call generate_recap to persist the report.

If obligations were missed, say so and pair each with a proposed make-good — a recap that hides a miss gets caught in the renewal meeting.

Output: the summary, the highlights with their supporting evidence, and the renewal talking points.`,
    toolNames: [...DATA_TOOLS, "generate_recap"],
    maxSteps: 12,
    samplePrompt: "Write the end-of-season recap for the Gatorade contract.",
  },
  {
    id: "fulfillment-updater",
    label: "Fulfillment updater",
    description:
      "Reconciles delivery records against evidence and applies the status changes you approve.",
    instructions: `Reconcile obligation records against captured evidence.

Find obligations whose recorded status disagrees with the evidence on file — still Pending but with proof attached, or marked Delivered with nothing supporting it. Report what you found first.

Apply an update only when the user's request clearly covers it, or when evidence directly confirms delivery. When evidence is ambiguous, report it and leave the record alone. State every change you made and why.`,
    toolNames: [...DATA_TOOLS, "update_deliverable"],
    maxSteps: 14,
    samplePrompt:
      "Reconcile our social obligations against the evidence on file and fix any that are clearly delivered.",
  },
  {
    id: "contract-intake",
    label: "Contract intake",
    description:
      "Reads an uploaded contract and proposes the deliverables it commits the team to.",
    instructions: `Extract sponsorship obligations from an uploaded contract.

The attachment must be a plain-text export (.txt, .md, .csv, or pasted contract text). Binary formats such as PDF and .docx cannot be read — if read_attachment reports the file is binary, tell the user that plainly and stop. Do not guess at the contents.

Read the attachment first. Pull out every activation the team commits to, with its category, required quantity, and any deadline the text states. Quote the source line for each one so a human can verify it.

Do not guess at quantities the document does not state — say "not specified" instead. Do not create records; this is a proposal the user reviews.

Output: a table of proposed deliverables with title, category, quantity, due date, and the source quote.`,
    toolNames: ["read_attachment", "list_contracts", "search_deliverables"],
    maxSteps: 10,
    samplePrompt: "Extract the deliverables from this contract.",
    expectsAttachment: true,
  },
];

const BY_ID = new Map(WORKFLOWS.map((w) => [w.id, w]));

export function getWorkflow(id: string): WorkflowDefinition | undefined {
  return BY_ID.get(id);
}

export const DEFAULT_WORKFLOW_ID = "partnership-analyst";

/**
 * Guard against a workflow naming a tool that no longer exists — the runtime
 * would silently run with a smaller toolset than intended.
 */
export function findUnknownToolNames(): string[] {
  const known = new Set(allToolNames());
  const unknown = new Set<string>();
  for (const workflow of WORKFLOWS) {
    for (const name of workflow.toolNames) {
      if (!known.has(name)) unknown.add(name);
    }
  }
  return [...unknown];
}

/**
 * Enforce the untrusted-input rule as an invariant rather than a convention:
 * no workflow may combine `read_attachment` with a tool that writes. Asserted by
 * `npm run smoke:agent`, so adding a write tool to an attachment workflow fails
 * the build rather than quietly opening a prompt-injection path to mutations.
 */
export function findWorkflowsMixingAttachmentsAndWrites(): string[] {
  return WORKFLOWS.filter((workflow) => {
    if (!workflow.toolNames.includes("read_attachment")) return false;
    return workflow.toolNames.some((name) => {
      const tool = getTool(name);
      return tool !== undefined && !tool.readOnly;
    });
  }).map((workflow) => workflow.id);
}
