import { NextRequest, NextResponse } from "next/server";
import { getClient, MODEL, SYSTEM_INSTRUCTION } from "@/lib/ai-agent/gemini-client";
import {
  TOOL_KINDS,
  ToolName,
  toolDeclarations,
  executeReadTool,
  executeWriteTool,
} from "@/lib/ai-agent/tools";
import jwt from "jsonwebtoken";

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

async function requireAuthorizedUser(req: NextRequest) {
  const token = getTokenFromCookies(req);
  if (!token) {
    throw new Error("Unauthorized");
  }
  const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
  const userEmail = (decoded?.email as string || '').toLowerCase().trim();
  if (userEmail !== 'sahilsagvekar230@gmail.com') {
    throw new Error("Forbidden: Access restricted to sahilsagvekar230@gmail.com");
  }
  return decoded;
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
  try {
    await requireAuthorizedUser(req);
  } catch (authErr: any) {
    return NextResponse.json(
      { error: authErr.message || "Forbidden" },
      { status: 403 }
    );
  }

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