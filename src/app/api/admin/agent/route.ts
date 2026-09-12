import { NextRequest, NextResponse } from "next/server";
import { getClient, MODEL, SYSTEM_INSTRUCTION } from "@/lib/ai-agent/gemini-client";
import {
  TOOL_KINDS,
  ToolName,
  toolDeclarations,
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

function findFunctionCall(interaction: any) {
  return interaction.steps?.find((s: any) => s.type === "function_call");
}

/**
 * Body shapes handled:
 *
 * 1) New message from the admin:
 *    { message: string, previousInteractionId?: string }
 *
 * 2) Confirming a pending write action:
 *    { confirm: { toolName, args, callId, interactionId } }
 */
export async function POST(req: NextRequest) {
  await requireAdmin(req);
  const body = await req.json();
  const client = getClient();

  // ── Case 1: admin clicked "confirm" on a pending write ─────────────────
  if (body.confirm) {
    const { toolName, args, callId, interactionId } = body.confirm as {
      toolName: ToolName;
      args: any;
      callId: string;
      interactionId: string;
    };

    if (TOOL_KINDS[toolName] !== "write") {
      return NextResponse.json({ error: "Not a write tool" }, { status: 400 });
    }

    const result = await executeWriteTool(toolName, args);

    // Feed the result back into the same interaction so the model can
    // acknowledge it in its own words. `tools` must be re-specified —
    // previous_interaction_id only carries conversation history, not config.
    const followUp = await client.interactions.create({
      model: MODEL,
      system_instruction: SYSTEM_INSTRUCTION,
      tools: toolDeclarations,
      previous_interaction_id: interactionId,
      input: [{ type: "function_result", call_id: callId, name: toolName, result }],
    });

    return NextResponse.json({
      type: "write_executed",
      toolName,
      args,
      result,
      text: followUp.output_text,
      interactionId: followUp.id,
    });
  }

  // ── Case 2: normal message ──────────────────────────────────────────────
  const { message, previousInteractionId } = body as {
    message: string;
    previousInteractionId?: string;
  };

  const interaction = await client.interactions.create({
    model: MODEL,
    system_instruction: SYSTEM_INSTRUCTION,
    tools: toolDeclarations,
    input: message,
    previous_interaction_id: previousInteractionId,
  });

  const call = findFunctionCall(interaction);

  if (!call) {
    // Plain text answer, no tool needed
    return NextResponse.json({
      type: "text",
      text: interaction.output_text,
      interactionId: interaction.id,
    });
  }

  const toolName = call.name as ToolName;
  const args = call.arguments;

  if (TOOL_KINDS[toolName] === "read") {
    // Execute immediately, then feed the result back for a final answer
    const toolResult = await executeReadTool(toolName, args);
    const followUp = await client.interactions.create({
      model: MODEL,
      system_instruction: SYSTEM_INSTRUCTION,
      tools: toolDeclarations,
      previous_interaction_id: interaction.id,
      input: [{ type: "function_result", call_id: call.id, name: toolName, result: toolResult }],
    });
    return NextResponse.json({
      type: "text",
      text: followUp.output_text,
      interactionId: followUp.id,
    });
  }

  // WRITE tool: do NOT execute — hand back everything needed to confirm later
  return NextResponse.json({
    type: "pending_confirmation",
    toolName,
    args,
    callId: call.id,
    interactionId: interaction.id,
    description: describeWriteAction(toolName, args),
  });
}