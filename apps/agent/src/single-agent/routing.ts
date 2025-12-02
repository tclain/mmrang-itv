/**
 * Routing logic for the Single Agent
 */

import { AIMessage } from "@langchain/core/messages";
import type { AgentState } from "./state";

/**
 * Determine if we should continue or end graph execution
 * If the LLM made tool calls to frontend actions, end here (frontend handles it)
 * If the LLM made tool calls to backend tools, route to tool_node
 */
export function shouldContinue({ messages, copilotkit }: AgentState): string {
  // Get the last message from the state
  const lastMessage = messages[messages.length - 1] as AIMessage;

  // If the LLM makes a tool call, then we route to the "tools" node
  if (lastMessage.tool_calls?.length) {
    // Actions are the frontend tools coming from CopilotKit
    const actions = copilotkit?.actions;
    const toolCallName = lastMessage.tool_calls![0].name;

    // Only route to the tool node if the tool call is not a CopilotKit action
    if (!actions || actions.every((action) => action.name !== toolCallName)) {
      return "tool_node";
    }
  }

  // Otherwise, we stop (reply to the user) using the special "__end__" node
  return "__end__";
}

