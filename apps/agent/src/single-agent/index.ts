/**
 * Single Agent Implementation - React Principles
 * Each step outputs tools + AI messages in a single node
 * Based on agent-original-example.ts structure
 *
 * Hybrid approach:
 * - ingestPdfNode: Uses interrupt to load PDF
 * - agent + tool_node: Chat loop with backend tools
 */

import { START, StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { AgentStateAnnotation } from "./state";
import { singleAgentNode } from "./node";
import { shouldContinue } from "./routing";
import { backendTools } from "./tools";
import { ingestPdfNode } from "./ingest-pdf";

// ============================================================================
// GRAPH DEFINITION
// ============================================================================

const workflow = new StateGraph(AgentStateAnnotation)
  .addNode("ingestPdf", ingestPdfNode)
  .addNode("agent", singleAgentNode)
  .addNode("tool_node", new ToolNode(backendTools))
  .addEdge(START, "ingestPdf")
  .addEdge("tool_node", "agent")
  .addConditionalEdges("agent", shouldContinue);

// Initialize checkpointer
const checkpointer = SqliteSaver.fromConnString("./agent.db");

// Compile graph
export const graph = workflow.compile({
  checkpointer,
});
