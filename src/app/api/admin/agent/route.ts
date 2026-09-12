import { NextRequest, NextResponse } from "next/server";
import { getModel } from "@/lib/ai-agent/gemini-client";
import {
  TOOL_KINDS,
  ToolName,
  executeReadTool,
  executeWriteTool,
  describeWriteAction,
} from "@/lib/ai-agent/tools";

// TODO: swap for your real admin auth check
async function requireAdmin(req: NextRequest) {
  // e.g. const session = await getServerSession(authOptions);
  // if (session?.role !== "ADMIN") throw new Error("Forbidden");
  return true;
}

/**
 * Body shapes handled:
 *
 * 1) New message from the admin:
 *    { message: string, history?: {role, parts}[] }
 *
 * 2) Confirming a pending write action:
 *    { confirm: { toolName: ToolName, args: any } }
 */
export async function POST(req: NextRequest) {
  await requireAdmin(req);
  const body = await req.json();

  // ── Case 1: admin clicked "confirm" on a pending write ─────────────────
  if (body.confirm) {
    const { toolName, args } = body.confirm as { toolName: ToolName; args: any };
    if (TOOL_KINDS[toolName] !== "write") {
      return NextResponse.json({ error: "Not a write tool" }, { status: 400 });
    }
    const result = await executeWriteTool(toolName, args);
    return NextResponse.json({
      type: "write_executed",
      toolName,
      args,
      result,
    });
  }

  // ── Case 2: normal message ──────────────────────────────────────────────
  const { message, history = [] } = body as { message: string; history?: any[] };

  const model = getModel();
  const chat = model.startChat({ history });
  const result = await chat.sendMessage(message);
  const response = result.response;

  const calls = response.functionCalls();

  if (!calls || calls.length === 0) {
    // Plain text answer, no tool needed
    return NextResponse.json({
      type: "text",
      text: response.text(),
    });
  }

  // Handle the first function call (extend to loop over multiple if needed)
  const call = calls[0];
  const toolName = call.name as ToolName;
  const args = call.args;

  if (TOOL_KINDS[toolName] === "read") {
    // Execute immediately, then let the model turn the result into a reply
    const toolResult = await executeReadTool(toolName, args);
    const followUp = await chat.sendMessage([
      {
        functionResponse: {
          name: toolName,
          response: { result: toolResult },
        },
      },
    ]);
    return NextResponse.json({
      type: "text",
      text: followUp.response.text(),
    });
  }

  // WRITE tool: do NOT execute — return a pending confirmation instead
  return NextResponse.json({
    type: "pending_confirmation",
    toolName,
    args,
    description: describeWriteAction(toolName, args),
  });
}