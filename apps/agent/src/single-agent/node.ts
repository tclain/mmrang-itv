/**
 * Single Agent Node - React Principles: Outputs tools + AI messages
 */

import { RunnableConfig } from "@langchain/core/runnables";
import { SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { convertActionsToDynamicStructuredTools } from "@copilotkit/sdk-js/langgraph";
import type { AgentState } from "./state";
import { SYSTEM_PROMPT } from "./prompt";
import { backendTools } from "./tools";

/**
 * Single agent node that processes state and outputs AI messages + tool calls
 * Following React principles: each step outputs tools + AI messages
 */
export async function singleAgentNode(
  state: AgentState,
  config: RunnableConfig
): Promise<Partial<AgentState>> {
  // Initialize model with tools
  const model = new ChatOpenAI({
    temperature: 1,
    model: "gpt-5-mini",
    apiKey: process.env.OPEN_AI_KEY,
  });

  // Get available frontend actions (tools) from CopilotKit
  const frontendActions = state.copilotkit?.actions ?? [];

  // Convert frontend actions to tools that the model can call
  const frontendTools = convertActionsToDynamicStructuredTools(frontendActions);

  // Combine frontend tools with backend tools
  const allTools = [...frontendTools, ...backendTools];

  // Bind tools to model
  const modelWithTools = model.bindTools(allTools);

  // Build context-aware system message
  const systemMessageContent = `${SYSTEM_PROMPT}

## Current State:
- Phase: ${state.currentPhase || "setup"}
- PDF Content Available: ${
    state.pdfContent ? "Yes (already parsed - see below)" : "No"
  }
${
  state.pdfContent
    ? `\n## Parsed PDF Content:\n${state.pdfContent.substring(0, 5000)}${
        state.pdfContent.length > 5000
          ? "\n... (content truncated, full content available in state)"
          : ""
      }\n`
    : ""
}
- Learning Plan: ${
    state.learningPlan
      ? JSON.stringify(state.learningPlan, null, 2)
      : "Not created"
  }
- Plan Approved: ${state.planApproved ?? "Pending"}
- Current MCQ: ${
    state.currentMcq ? JSON.stringify(state.currentMcq, null, 2) : "None"
  }
- User Answer Submitted: ${state.answerSubmitted ? "Yes" : "No"}
- Learning Session Progress: ${
    state.learningSession
      ? JSON.stringify(state.learningSession, null, 2)
      : "Not started"
  }

## Available Frontend Tools:
${frontendTools.map((tool) => `- ${tool.name}: ${tool.description}`).join("\n")}

## Available Backend Tools:
${backendTools.map((tool) => `- ${tool.name}: ${tool.description}`).join("\n")}

Based on the current state and phase, determine what action to take next. Use the appropriate tools and provide helpful messages to guide the user through the learning process.`;

  const systemMessage = new SystemMessage({
    content: systemMessageContent,
  });

  // Invoke model with system message and conversation history
  const response = await modelWithTools.invoke(
    [systemMessage, ...state.messages],
    config
  );

  // Return the response (which includes tool calls if any)
  // The tool calls will be handled by CopilotKit frontend
  return {
    messages: [response],
  };
}
