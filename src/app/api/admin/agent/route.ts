import { NextRequest, NextResponse } from "next/server";
import { getClient, MODEL, SYSTEM_INSTRUCTION } from "@/lib/ai-agent/gemini-client";
import {
  TOOL_KINDS,
  ToolName,
  toolDeclarations,
  executeReadTool,
  executeWriteTool,
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
 * Body shape handled:
 *   { message: string, previousInteractionId?: string }
 *
 * NOTE: write actions (updateTaskStatus, reassignTask) now execute
 * immediately, same as read actions — there is no confirm step. The only
 * remaining safety boundary is the fixed tool list itself: no delete or
 * payment tools are defined, so the model has no path to those actions
 * regardless of instruction.
 */
export async function POST(req: NextRequest) {
  await requireAdmin(req);
  const body = await req.json();
  const client = getClient();

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
    return NextResponse.json({
      type: "text",
      text: interaction.output_text,
      interactionId: interaction.id,
    });
  }

  const toolName = call.name as ToolName;
  const args = call.arguments;

  // Both read and write tools now execute immediately.
  const toolResult =
    TOOL_KINDS[toolName] === "read"
      ? await executeReadTool(toolName, args)
      : await executeWriteTool(toolName, args);

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