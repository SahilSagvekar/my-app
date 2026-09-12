/**
 * Tool definitions for the Admin AI Agent.
 *
 * IMPORTANT: This is the safety boundary. The model can ONLY ever call one of
 * the functions defined below — there is no generic "run a query" or
 * "delete X" tool exposed. If it's not in this file, the agent cannot do it,
 * no matter what it's asked or how it's prompted.
 *
 * Wire the `execute` functions below to your real Prisma calls / existing
 * API route logic (marked with TODO).
 */

import { FunctionDeclaration, SchemaType } from "@google/generative-ai";

// ── Tool categories ──────────────────────────────────────────────────────
// READ tools  -> executed immediately, no confirmation needed
// WRITE tools -> agent proposes the action, UI shows a confirm button,
//                nothing happens until the boss clicks confirm

export const TOOL_KINDS = {
  searchTasks: "read",
  pullReport: "read",
  updateTaskStatus: "write",
  reassignTask: "write",
} as const;

export type ToolName = keyof typeof TOOL_KINDS;

// ── Schemas Gemini sees (function-calling declarations) ─────────────────

export const toolDeclarations: FunctionDeclaration[] = [
  {
    name: "searchTasks",
    description:
      "Search/look up tasks by status, assignee, client, or a free-text query. Read-only.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: {
          type: SchemaType.STRING,
          description: "Free-text search term (task title, client name, etc.) — optional",
        },
        status: {
          type: SchemaType.STRING,
          description: "Filter by task status (e.g. PENDING, IN_PROGRESS, QC, DONE) — optional",
        },
        assignee: {
          type: SchemaType.STRING,
          description: "Filter by assignee name or email — optional",
        },
        limit: {
          type: SchemaType.NUMBER,
          description: "Max number of results to return, default 10",
        },
      },
      required: [],
    },
  },
  {
    name: "pullReport",
    description:
      "Pull a summary report (e.g. task counts by status, workload per editor, overdue tasks). Read-only.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        reportType: {
          type: SchemaType.STRING,
          description:
            "Which report to pull: 'status_summary' | 'workload_by_assignee' | 'overdue_tasks'",
        },
        dateRange: {
          type: SchemaType.STRING,
          description: "Optional date range, e.g. 'last_7_days', 'this_month'",
        },
      },
      required: ["reportType"],
    },
  },
  {
    name: "updateTaskStatus",
    description:
      "Change a task's status (e.g. mark as done, move to QC). WRITE action — requires human confirmation before it takes effect.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        taskId: { type: SchemaType.STRING, description: "The ID of the task to update" },
        newStatus: {
          type: SchemaType.STRING,
          description: "The new status to set, e.g. PENDING, IN_PROGRESS, QC, DONE",
        },
      },
      required: ["taskId", "newStatus"],
    },
  },
  {
    name: "reassignTask",
    description:
      "Reassign a task from one person to another. WRITE action — requires human confirmation before it takes effect.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        taskId: { type: SchemaType.STRING, description: "The ID of the task to reassign" },
        newAssignee: {
          type: SchemaType.STRING,
          description: "Name or email of the person to assign the task to",
        },
      },
      required: ["taskId", "newAssignee"],
    },
  },
];

// ── Execution layer ───────────────────────────────────────────────────────
// Plug your real logic in here. Keep these functions "dumb" — they should do
// exactly what they say and nothing else, so the safety boundary stays true
// to what's declared above.

export async function executeReadTool(name: ToolName, args: any) {
  switch (name) {
    case "searchTasks": {
      // TODO: replace with your real Prisma query, e.g.:
      // return prisma.task.findMany({
      //   where: {
      //     status: args.status ?? undefined,
      //     assignee: args.assignee ? { name: { contains: args.assignee } } : undefined,
      //     title: args.query ? { contains: args.query, mode: "insensitive" } : undefined,
      //   },
      //   take: args.limit ?? 10,
      // });
      return { placeholder: true, message: "Wire this up to your task search logic", args };
    }
    case "pullReport": {
      // TODO: replace with your real reporting logic
      return { placeholder: true, message: "Wire this up to your reporting logic", args };
    }
    default:
      throw new Error(`${name} is not a read tool`);
  }
}

export async function executeWriteTool(name: ToolName, args: any) {
  switch (name) {
    case "updateTaskStatus": {
      // TODO: replace with your real update, e.g.:
      // return prisma.task.update({
      //   where: { id: args.taskId },
      //   data: { status: args.newStatus },
      // });
      return { placeholder: true, message: "Wire this up to your task update logic", args };
    }
    case "reassignTask": {
      // TODO: replace with your real reassignment logic
      return { placeholder: true, message: "Wire this up to your reassignment logic", args };
    }
    default:
      throw new Error(`${name} is not a write tool`);
  }
}

/** Human-readable description of a pending write action, shown in the confirm prompt. */
export function describeWriteAction(name: ToolName, args: any): string {
  switch (name) {
    case "updateTaskStatus":
      return `Mark task ${args.taskId} as ${args.newStatus}`;
    case "reassignTask":
      return `Reassign task ${args.taskId} to ${args.newAssignee}`;
    default:
      return `Run ${name} with ${JSON.stringify(args)}`;
  }
}